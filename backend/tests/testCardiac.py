"""
Testes específicos para CardiacSignal

Resumo:
Esta classe contém um conjunto de testes automatizados focados nos sinais cardíacos (HR e ECG).
Utiliza um mock generator para simular dados reais e anómalos, e verifica se o sistema responde corretamente.

Os testes incluem:
- Funcionalidade básica: adicionar e ler dados de HR/ECG
- Detecção de anomalias: bradicardia, taquicardia, ECG de baixa amplitude
- Simulação de stream: envia dados contínuos durante alguns segundos para testar o sistema em tempo real

Também verifica se os eventos esperados são emitidos (via eventManager) e se os dados são corretamente processados.
"""
import asyncio
import logging
import sys
import os

# Configuração de paths para imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configurar logging para mostrar informações relevantes
logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(name)s - %(message)s')

from app.services.signalManager import signalManager
from app.core import eventManager
from mockData import CardiacMockGenerator
from utils import TestRunner, EventLogger

class CardiacTests:
    """Classe de testes para validação de sinais cardíacos"""
    
    def __init__(self):
        # Inicializar componentes de teste
        self.runner = TestRunner("CardiacSignal")
        self.eventLogger = EventLogger("Cardiac")
        self.mockGenerator = CardiacMockGenerator()
        
        # Registar listener para eventos de processamento de sinais
        eventManager.subscribe("signal.processed", self.eventLogger.onEvent)
    
    async def testBasicFunctionality(self):
        """
        Testa funcionalidade básica de processamento de dados cardíacos.
        
        Verifica se o sistema consegue:
        - Adicionar dados de frequência cardíaca (HR) ao buffer
        - Processar segmentos de ECG com múltiplas amostras
        - Emitir eventos corretos para notificação de outros componentes
        - Manter dados acessíveis através da interface de consulta
        """
        self.runner.startTest("Basic Cardiac Signal Functionality")
        
        # Limpar estado anterior para garantir teste isolado
        signalManager.reset()
        self.eventLogger.clear()
        
        # Teste 1: Adicionar valor de frequência cardíaca
        # Simula receção de dados de um sensor Polar ou similar
        mockHr= self.mockGenerator.generateHrEvent()
        success = await signalManager.addSignalData(
            signalType="cardiac",
            dataType="hr", 
            value= mockHr
        )
        self.runner.assert_true(success, "HR addition successful")
        
        # Teste 2: Adicionar segmento de ECG
        # Gera 100ms de dados ECG simulados a 1000Hz (100 amostras)
        mockEcg = self.mockGenerator.generateEcgSegment(duration=0.1)
        success = await signalManager.addSignalData(
            signalType="cardiac",
            dataType="ecg",
            value=mockEcg
        )
        self.runner.assert_true(success, "ECG addition successful")
        
        # Teste 3: Verificar disponibilidade de dados recentes
        # Confirma que dados foram armazenados e são acessíveis
        latestData = signalManager.getLatestData()
        self.runner.assert_true("cardiac" in latestData, "Cardiac data present")
        
        # Teste 4: Verificar emissão de eventos de processamento
        # Aguarda processamento assíncrono dos eventos
        await asyncio.sleep(0.1)
        eventCount = self.eventLogger.getEventCount("signal.processed")
        self.runner.assert_equal(eventCount, 2, "Events emitted for both signals")
    
    async def testAnomalyDetection(self):
        """
        Testa sistema de detecção de anomalias cardíacas.
        
        Valida detecção de condições médicas críticas:
        - Bradicardia: Frequência cardíaca abaixo do limite normal
        - Taquicardia: Frequência cardíaca acima do limite normal  
        - ECG de baixa amplitude: Possível eletrodo solto ou mau contacto
        
        Estas detecções são cruciais para alertas médicos em tempo real.
        """
        self.runner.startTest("Anomaly Detection")
        
        # Reiniciar sistema para teste isolado
        signalManager.reset()
        self.eventLogger.clear()
        
        # Teste 1: Detecção de bradicardia (frequência cardíaca baixa)
        print("Testing Bradycardia...")
        bradyData = self.mockGenerator.generateAnomalyData("bradycardia")
        await signalManager.addSignalData("cardiac", "hr", bradyData["hr"])
        
        # Aguardar processamento do algoritmo de detecção
        await asyncio.sleep(0.1)
        
        # Verificar se anomalia foi detectada pelo sistema
        cardiacSignal = signalManager.signals["cardiac"]
        anomalies = cardiacSignal.getRecentAnomalies()
        print(f"Anomalies after bradycardia: {anomalies}")
        
        hasBradycardia = any("bradicardia" in a.lower() for a in anomalies)
        self.runner.assert_true(hasBradycardia, "Bradycardia detected")
        
        # Teste 2: Detecção de taquicardia (frequência cardíaca elevada)
        print("Testing Tachycardia...")
        tachyData = self.mockGenerator.generateAnomalyData("tachycardia")
        await signalManager.addSignalData("cardiac", "hr", tachyData["hr"])
        await asyncio.sleep(0.1)
        
        anomalies = cardiacSignal.getRecentAnomalies()
        print(f"Anomalies after tachycardia: {anomalies}")
        
        hasTachycardia = any("taquicardia" in a.lower() for a in anomalies)
        self.runner.assert_true(hasTachycardia, "Tachycardia detected")
        
        # Teste 3: Detecção de ECG com amplitude baixa
        print("Testing Low Amplitude ECG...")
        lowEcgData = self.mockGenerator.generateAnomalyData("low_amplitude_ecg")
        await signalManager.addSignalData("cardiac", "ecg", lowEcgData["ecg"])
        await asyncio.sleep(0.1)
        
        anomalies = cardiacSignal.getRecentAnomalies()
        print(f"Anomalies after low ECG: {anomalies}")
        
        hasLowAmplitude = any("amplitude" in a.lower() for a in anomalies)
        self.runner.assert_true(hasLowAmplitude, "Low amplitude ECG detected")
        
    async def testMockDataStream(self, durationSeconds: int = 5):
        """
        Testa processamento de stream contínuo de dados cardíacos.
        
        Simula funcionamento em tempo real do sistema durante período especificado:
        - Gera dados cardíacos com frequência realista
        - Verifica processamento correto de cada mensagem
        - Valida estado final do buffer de dados
        - Confirma que valores de HR estão dentro de ranges fisiológicos
        
        Args:
            durationSeconds: Duração do teste de stream em segundos
        """
        self.runner.startTest(f"Mock Data Stream ({durationSeconds}s)")
        
        # Preparar sistema para teste de stream
        signalManager.reset()
        self.eventLogger.clear()
        
        # Simular recepção contínua de dados dos sensores
        for i in range(durationSeconds):
            # Gerar mensagem ZeroMQ simulada com dados cardíacos
            mockData = self.mockGenerator.generateZeroMQMessage()
            success = await signalManager.processZeroMQData(mockData)
            self.runner.assert_true(success, f"ZeroMQ data {i+1} processed")
            
            # Simular intervalo típico entre mensagens
            await asyncio.sleep(0.1)
        
        # Verificar estado final do sistema após stream
        cardiacStatus = signalManager.getSignalStatus("cardiac")
        self.runner.assert_true(cardiacStatus["isActive"], "Signal is active")
        self.runner.assert_true(cardiacStatus["bufferSize"] > 0, "Buffer has data")
        
        # Validar que último valor de HR está em range fisiológico válido
        latestHr = cardiacStatus.get("latestHr")
        self.runner.assert_true(latestHr is not None, "Latest HR available")
        self.runner.assert_true(30 <= latestHr <= 250, f"HR in valid range: {latestHr}")
    
    async def runAllTests(self):
        """
        Executa sequência completa de testes cardíacos.
        
        Coordena execução de todos os testes definidos, captura excepções
        e produz resumo final dos resultados. Garante que falhas individuais
        não impedem execução dos testes seguintes.
        
        Returns:
            bool: True se todos os testes passaram, False caso contrário
        """
        print("Control Room - Cardiac Signal Tests")
        print("=" * 50)
        
        try:
            # Executar bateria completa de testes
            await self.testBasicFunctionality()
            await self.testAnomalyDetection()
            await self.testMockDataStream(durationSeconds=10)
            
            # Gerar resumo de resultados
            success = self.runner.summary()
            return success
            
        except Exception as e:
            print(f"\nTest execution failed: {e}")
            import traceback
            traceback.print_exc()
            return False

async def main():
    """
    Função principal para execução standalone dos testes cardíacos.
    
    Permite executar testes cardíacos independentemente de outros
    componentes do sistema de testes.
    
    Returns:
        int: Código de saída (0 para sucesso, 1 para falha)
    """
    tests = CardiacTests()
    success = await tests.runAllTests()
    
    if success:
        print("\n-------------- All cardiac tests passed --------------")
        return 0
    else:
        print("\n-------------- Some tests failed --------------")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)