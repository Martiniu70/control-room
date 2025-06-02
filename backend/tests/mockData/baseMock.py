"""
Base class para mock data generators

Resumo:
Esta é a classe base para todos os geradores de dados fictícios (mock). 
Define a estrutura comum que todos os geradores devem seguir:
- Nome do gerador
- Estado de execução (a correr ou parado)
- Logger para registar o que acontece
- Contador interno de tempo

Inclui também métodos úteis:
- `generateMockData`: função abstrata que cada gerador tem de implementar para gerar os seus dados específicos.
- `generateZeroMQMessage`: estrutura padrão que inclui timestamp, nome da origem e os dados simulados.
- `start` e `stop`: controlam o início e fim da geração de dados, com mensagens no log.

Esta classe não gera dados por si, mas serve de base para subclasses específicas como o ecg, eeg etc...
"""
import time
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any
from app.core import settings

class BaseMockGenerator(ABC):
    """Base para todos os mock generators"""
    
    def __init__(self, name: str):
        self.name = name
        self.isRunning = False
        self.logger = logging.getLogger(f"MockGenerator.{name}")
        self.time = 0
        self.mockConfig = settings.signals.mockConfig

    
    @abstractmethod
    def generateMockData(self) -> Dict[str, Any]:
        """Gera dados mock específicos"""
        pass
    
    def generateZeroMQMessage(self) -> Dict[str, Any]:
        """Formato padrão ZeroMQ"""
        self.time += 1
        
        return {
            "timestamp": time.time(),
            "source": f"{self.name}_mock",
            "data": self.generateMockData()
        }
    
    def start(self):
        """Inicia geração"""
        self.isRunning = True
        self.logger.info(f"{self.name} mock generator started")
    
    def stop(self):
        """Para geração"""
        self.isRunning = False
        self.logger.info(f"{self.name} mock generator stopped")