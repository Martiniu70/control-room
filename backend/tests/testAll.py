"""
Executa todos os testes do Control Room

Resumo:
Executa todos os testes disponíveis do sistema. 
Agrupa os testes por tipo (cardíaco, EEG, ZeroMQ) e corre-os de forma sequencial. 

Durante a execução:
- Mostra mensagens no terminal a indicar o progresso
- Regista os resultados de cada grupo de testes
- No fim, apresenta um resumo com os grupos que passaram ou falharam

Inclui testes para todos os componentes principais: sinais cardíacos, EEG, 
e comunicação ZeroMQ para verificar se está tudo funcional.
"""
import asyncio
import logging
import sys
import os

# Configuração de paths
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Configurar logging para mostrar apenas warnings críticos durante testes
logging.basicConfig(level=logging.WARNING)

from testCardiac import CardiacTests
from testEEG import EEGTests
from testZeroMQPush import ZeroMQTests

class AllTestsRunner:
    
    def __init__(self):
        # Dicionário para armazenar resultados de cada grupo de testes
        self.results = {}
    
    async def runAllTests(self):
        """
        Executa sequência completa de testes de todos os subsistemas.
        
        Coordena execução de testes para cada componente crítico do sistema:
        - Testes isolados para evitar interferências entre subsistemas
        - Captura das exeções para evitar paragem em falhas pontuais
        - Relatório detalhado do progresso durante execução
        - Compilação dos resultados finais para análise
        """
        print("Control Room - Automotive Simulator: Complete System Test ")
        print("=" * 60)
        
        # Testes de processamento de sinais cardíacos
        print("\nExecuting Cardiac Signal Tests...")
        print("-" * 40)
        try:
            cardiacTests = CardiacTests()
            self.results["cardiac"] = await cardiacTests.runAllTests()
        except Exception as e:
            print(f"Cardiac tests failed with exception: {e}")
            self.results["cardiac"] = False
        
        # Testes de processamento de sinais EEG
        print("\nExecuting EEG Signal Tests...")
        print("-" * 40)
        try:
            eegTests = EEGTests()
            self.results["eeg"] = await eegTests.runAllTests()
        except Exception as e:
            print(f"EEG tests failed with exception: {e}")
            self.results["eeg"] = False
        
        # Testes de comunicação ZeroMQ
        print("\nExecuting ZeroMQ Communication Tests...")
        print("-" * 40)
        try:
            zeroMqTests = ZeroMQTests()
            self.results["zeromq"] = await zeroMqTests.runAllTests()
        except Exception as e:
            print(f"ZeroMQ tests failed with exception: {e}")
            self.results["zeromq"] = False
        
        # Testes futuros (comentados até implementação)
        # print("\nExecuting Unity Simulation Tests...")
        # print("-" * 40)
        # try:
        #     unityTests = UnityTests()
        #     self.results["unity"] = await unityTests.runAllTests()
        # except Exception as e:
        #     print(f"Unity tests failed with exception: {e}")
        #     self.results["unity"] = False
        
        # print("\nExecuting Camera Processing Tests...")
        # print("-" * 40)
        # try:
        #     cameraTests = CameraTests()
        #     self.results["camera"] = await cameraTests.runAllTests()
        # except Exception as e:
        #     print(f"Camera tests failed with exception: {e}")
        #     self.results["camera"] = False
        
        # Gerar resumo final consolidado
        self.printFinalSummary()
    
    def printFinalSummary(self):
        """
        Produz resumo estatístico final de todos os testes executados.
        
        Apresenta resultado de cada subsistema testado com:
        - Estado de sucesso/falha claramente identificado
        - Contagem total de grupos que passaram vs falharam
        - Taxa de sucesso percentual do sistema completo
        - Mensagens de status apropriadas para o resultado final
        """
        print("\n" + "=" * 60)
        print("FINAL TEST SUMMARY")
        print("=" * 60)
        
        # Contadores para estatísticas
        passed = 0
        failed = 0
        
        # Mapeamento de ícones para cada subsistema
        testIcons = {
            "cardiac": "[HEART]",
            "eeg": "[BRAIN]",
            "zeromq": "[COMM]",
            "unity": "[SIM]",
            "camera": "[CAM]"
        }
        
        # Apresentar resultado de cada grupo de testes
        for testGroup, success in self.results.items():
            icon = testIcons.get(testGroup, "[TEST]")
            status = "PASS" if success else "FAIL"
            print(f"  {icon} {testGroup.capitalize()}: {status}")
            
            if success:
                passed += 1
            else:
                failed += 1
        
        # Calcular e apresentar estatísticas globais
        total = passed + failed
        successRate = (passed / total * 100) if total > 0 else 0
        
        print(f"\nOverall Results: {passed}/{total} test groups passed ({successRate:.1f}%)")
        
        # Mensagem final baseada no resultado
        if failed == 0:
            print("\nSUCCESS: All test groups passed!")
        else:
            print(f"\nFAILURE: {failed} test group(s) failed")

async def main():
    runner = AllTestsRunner()
    await runner.runAllTests()

if __name__ == "__main__":
    asyncio.run(main())