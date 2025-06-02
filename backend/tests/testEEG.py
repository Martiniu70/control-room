"""
Testes específicos para EEGSignal

Resumo:
Esta classe contém um conjunto de testes automatizados focados nos sinais EEG (raw + power bands).
Utiliza um mock generator para simular dados reais e anómalos, e verifica se o sistema responde corretamente.

Os testes incluem:
- Funcionalidade básica: adicionar e ler dados de EEG raw/power bands
- Detecção de anomalias: eletrodos soltos, saturação, dominância anómala de bandas
- Simulação de stream: envia dados contínuos durante alguns segundos para testar o sistema em tempo real

Também verifica se os eventos esperados são emitidos (via eventManager) e se os dados são corretamente processados.
"""

import asyncio
import logging
import sys
import os

# Setup para imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


from app.services import signalManager
from app.core import settings
from app.core import eventManager
from mockData import EEGMockGenerator
from utils import TestRunner, EventLogger

# Configurar logging
logging.basicConfig(level=settings.testLogLevel, format='%(levelname)s - %(name)s - %(message)s')

class EEGTests:
    """Testes para EEGSignal"""
    
    def __init__(self):
        self.runner = TestRunner("EEGSignal")
        self.eventLogger = EventLogger("EEG")
        self.mockGenerator = EEGMockGenerator()
        
        # Subscrever aos eventos
        eventManager.subscribe("signal.processed", self.eventLogger.onEvent)
    
    async def testBasicFunctionality(self):
        """Teste básico de funcionalidade"""
        self.runner.startTest("Basic EEG Signal Functionality")
        
        # Reset para começar limpo
        signalManager.reset()
        self.eventLogger.clear()
        
        # Teste 1: Adicionar EEG Raw
        mockRaw = self.mockGenerator.generateEegRawSegment(duration=0.1)  # 100ms
        success = await signalManager.addSignalData(
            signalType="eeg",
            dataType="eegRaw",
            value=mockRaw
        )
        self.runner.assert_true(success, "EEG Raw addition successful")
        
        # Teste 2: Adicionar Power Bands
        mockBands = self.mockGenerator.generatePowerBands()
        success = await signalManager.addSignalData(
            signalType="eeg", 
            dataType="eegBands",
            value=mockBands
        )
        self.runner.assert_true(success, "EEG Bands addition successful")
        
        # Teste 3: Verificar dados recentes
        latestData = signalManager.getLatestData()
        self.runner.assert_true("eeg" in latestData, "EEG data present")
        
        # Teste 4: Verificar eventos emitidos
        await asyncio.sleep(0.1)  # Dar tempo para eventos processarem
        eventCount = self.eventLogger.getEventCount("signal.processed")
        self.runner.assert_equal(eventCount, 2, "Events emitted for both EEG signals")
    
    async def testAnomalyDetection(self):
        """Teste detecção de anomalias"""
        self.runner.startTest("EEG Anomaly Detection")
        
        signalManager.reset()
        self.eventLogger.clear()
        
        # Teste 1: Eletrodo solto
        print("Testing Electrode Loose...")
        looseData = self.mockGenerator.generateAnomalyData("electrode_loose")
        await signalManager.addSignalData("eeg", "eegRaw", looseData["eegRaw"])
        await asyncio.sleep(0.1)
        
        eegSignal = signalManager.signals["eeg"]
        anomalies = eegSignal.getRecentAnomalies()
        print(f"Anomalies after electrode loose: {anomalies}")
        
        hasElectrodeAnomaly = any("solto" in a.lower() or "plano" in a.lower() for a in anomalies)
        self.runner.assert_true(hasElectrodeAnomaly, "Electrode loose detected")
        
        # Teste 2: Saturação
        print("Testing Saturation...")
        saturationData = self.mockGenerator.generateAnomalyData("saturation")
        await signalManager.addSignalData("eeg", "eegRaw", saturationData["eegRaw"])
        await asyncio.sleep(0.1)
        
        anomalies = eegSignal.getRecentAnomalies()
        print(f"Anomalies after saturation: {anomalies}")
        
        hasSaturation = any("saturação" in a.lower() for a in anomalies)
        self.runner.assert_true(hasSaturation, "Saturation detected")
        
        # Teste 3: Dominância delta excessiva
        print("Testing Delta Dominance...")
        deltaData = self.mockGenerator.generateAnomalyData("delta_dominance")
        await signalManager.addSignalData("eeg", "eegBands", deltaData["eegBands"])
        await asyncio.sleep(0.1)
        
        anomalies = eegSignal.getRecentAnomalies()
        print(f"Anomalies after delta dominance: {anomalies}")
        
        hasDeltaDominance = any("delta" in a.lower() for a in anomalies)
        self.runner.assert_true(hasDeltaDominance, "Delta dominance detected")
        
    async def testMockDataStream(self, durationSeconds: int = 5):
        """Teste com stream mock"""
        self.runner.startTest(f"EEG Mock Data Stream ({durationSeconds}s)")
        
        signalManager.reset()
        self.eventLogger.clear()
        
        # Simular stream
        for i in range(durationSeconds):
            mockData = self.mockGenerator.generateZeroMQMessage()
            success = await signalManager.processZeroMQData(mockData)
            self.runner.assert_true(success, f"EEG ZeroMQ data {i+1} processed")
            await asyncio.sleep(0.1)  # Simular intervalo
        
        # Verificar estado final
        eegStatus = signalManager.getSignalStatus("eeg")
        self.runner.assert_true(eegStatus["isActive"], "EEG Signal is active")
        self.runner.assert_true(eegStatus["bufferSize"] > 0, "EEG Buffer has data")
        
        # Verificar brain state
        brainState = eegStatus.get("brainState")
        if brainState:
            self.runner.assert_true(brainState["state"] in ["relaxed", "alert", "drowsy", "sleepy", "neutral"], 
                                  f"Valid brain state: {brainState['state']}")
    
    async def runAllTests(self):
        """Executa todos os testes EEG"""
        print("Control Room - EEG Signal Tests")
        print("=" * 50)
        
        try:
            await self.testBasicFunctionality()
            await self.testAnomalyDetection()
            await self.testMockDataStream(durationSeconds=10)
            
            success = self.runner.summary()
            return success
            
        except Exception as e:
            print(f"\nTest execution failed: {e}")
            import traceback
            traceback.print_exc()
            return False

async def main():
    """Função principal"""
    tests = EEGTests()
    success = await tests.runAllTests()
    
    if success:
        print("\n -------------- All EEG tests passed --------------")
        return 0
    else:
        print("\n-------------- Some EEG tests failed --------------")
        return 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)