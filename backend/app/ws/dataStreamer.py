"""
DataStreamer - Loop contínuo de dados para desenvolvimento

Resumo:
Cria um loop infinito que simula dados de sensores chegando constantemente, usando os 
mock generators. Gera dados de cardiac e EEG em frequências realistas e envia-os 
através do SignalManager como se fossem dados reais de sensores. Inclui controlo 
de frequência para cada tipo de sinal, possibilidade de pausar/retomar, e injeção 
ocasional de anomalias para testar o sistema. É como ter sensores virtuais sempre 
a enviar dados para desenvolvimento e demonstração.
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from enum import Enum

from ..core import eventManager, settings
from ..services.signalManager import signalManager
from tests.mockData import CardiacMockGenerator
from tests.mockData import EEGMockGenerator

class StreamerState(Enum):
    """Estados do streamer"""
    STOPPED = "stopped"
    RUNNING = "running"
    PAUSED = "paused"

class DataStreamer:
    """Gera stream contínuo de dados mock para desenvolvimento"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Mock generators
        self.cardiacMock = CardiacMockGenerator()
        self.eegMock = EEGMockGenerator()
        
        # Estado do streamer
        self.state = StreamerState.STOPPED
        self.startTime: Optional[datetime] = None
        self.pausedTime: Optional[float] = 0.0
        
        # Configurações de frequência (Hz)
        self.frequencies = {
            "cardiac_ecg": 10,      # 10Hz para ECG (simplificado para teste)
            "cardiac_hr": 1,        # 1Hz para eventos HR
            "eeg_raw": 25,          # 25Hz para EEG raw (simplificado)
            "eeg_bands": 0.2        # 0.2Hz (a cada 5s) para power bands
        }
        
        # Contadores internos
        self.counters = {
            "cardiac_ecg": 0,
            "cardiac_hr": 0, 
            "eeg_raw": 0,
            "eeg_bands": 0
        }
        
        # Configurações de anomalias
        self.anomalyChance = 0.02  # 2% chance por ciclo
        self.lastAnomalyTime = datetime.now()
        self.minAnomalyInterval = 10.0  # Mínimo 10s entre anomalias
        
        # Tasks assíncronas
        self.tasks: Dict[str, asyncio.Task] = {}
        
        self.logger.info("DataStreamer initialized")
    
    async def start(self):
        """Inicia o streaming de dados"""
        if self.state == StreamerState.RUNNING:
            self.logger.warning("DataStreamer already running")
            return
        
        self.state = StreamerState.RUNNING
        self.startTime = datetime.now()
        
        # Iniciar mock generators
        self.cardiacMock.start()
        self.eegMock.start()
        
        # Criar tasks para cada tipo de sinal
        self.tasks = {
            "cardiac_ecg": asyncio.create_task(self._streamCardiacEcg()),
            "cardiac_hr": asyncio.create_task(self._streamCardiacHr()),
            "eeg_raw": asyncio.create_task(self._streamEegRaw()),
            "eeg_bands": asyncio.create_task(self._streamEegBands()),
            "anomaly_injector": asyncio.create_task(self._anomalyInjector())
        }
        
        # Emitir evento de início
        await eventManager.emit("system.streaming_started", {
            "timestamp": datetime.now().isoformat(),
            "frequencies": self.frequencies
        })
        
        self.logger.info("DataStreamer started with frequencies: %s", self.frequencies)
    
    async def stop(self):
        """Para o streaming de dados"""
        if self.state == StreamerState.STOPPED:
            return
        
        self.state = StreamerState.STOPPED
        
        # Cancelar todas as tasks
        for taskName, task in self.tasks.items():
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass
        
        self.tasks.clear()
        
        # Parar mock generators
        self.cardiacMock.stop()
        self.eegMock.stop()
        
        # Emitir evento de paragem
        await eventManager.emit("system.streaming_stopped", {
            "timestamp": datetime.now().isoformat(),
            "uptime": self._getUptime()
        })
        
        self.logger.info("DataStreamer stopped")
    
    async def pause(self):
        """Pausa o streaming"""
        if self.state != StreamerState.RUNNING:
            return
        
        self.state = StreamerState.PAUSED
        self.pausedTime = datetime.now().timestamp()
        
        self.logger.info("DataStreamer paused")
    
    async def resume(self):
        """Retoma o streaming"""
        if self.state != StreamerState.PAUSED:
            return
        
        self.state = StreamerState.RUNNING
        
        # Ajustar tempo pausado
        if self.pausedTime:
            pauseDuration = datetime.now().timestamp() - self.pausedTime
            self.pausedTime = 0.0
        
        self.logger.info("DataStreamer resumed")
    
    async def _streamCardiacEcg(self):
        """Stream de dados ECG"""
        interval = 1.0 / self.frequencies["cardiac_ecg"]
        
        while self.state != StreamerState.STOPPED:
            if self.state == StreamerState.RUNNING:
                try:
                    # Gerar dados ECG
                    ecgData = self.cardiacMock.generateEcgSegment(duration=0.1)  # 100ms de dados
                    
                    # Enviar através do SignalManager
                    await signalManager.processZeroMQData({
                        "timestamp": datetime.now().timestamp(),
                        "source": "cardiac_streamer",
                        "data": {"ecg": ecgData}
                    })
                    
                    self.counters["cardiac_ecg"] += 1
                    
                except Exception as e:
                    self.logger.error(f"Error streaming cardiac ECG: {e}")
            
            await asyncio.sleep(interval)
    
    async def _streamCardiacHr(self):
        """Stream de eventos HR"""
        interval = 1.0 / self.frequencies["cardiac_hr"]
        
        while self.state != StreamerState.STOPPED:
            if self.state == StreamerState.RUNNING:
                try:
                    # Gerar evento HR
                    hrValue = self.cardiacMock.generateHrEvent()
                    
                    # Enviar através do SignalManager
                    await signalManager.processZeroMQData({
                        "timestamp": datetime.now().timestamp(),
                        "source": "cardiac_streamer",
                        "data": {"hr": hrValue}
                    })
                    
                    self.counters["cardiac_hr"] += 1
                    
                except Exception as e:
                    self.logger.error(f"Error streaming cardiac HR: {e}")
            
            await asyncio.sleep(interval)
    
    async def _streamEegRaw(self):
        """Stream de dados EEG raw"""
        interval = 1.0 / self.frequencies["eeg_raw"]
        
        while self.state != StreamerState.STOPPED:
            if self.state == StreamerState.RUNNING:
                try:
                    # Gerar dados EEG raw
                    eegRawData = self.eegMock.generateEegRawSegment(duration=0.04)  # 40ms de dados
                    
                    # Enviar através do SignalManager
                    await signalManager.processZeroMQData({
                        "timestamp": datetime.now().timestamp(),
                        "source": "eeg_streamer",
                        "data": {"eegRaw": eegRawData}
                    })
                    
                    self.counters["eeg_raw"] += 1
                    
                except Exception as e:
                    self.logger.error(f"Error streaming EEG raw: {e}")
            
            await asyncio.sleep(interval)
    
    async def _streamEegBands(self):
        """Stream de power bands EEG"""
        interval = 1.0 / self.frequencies["eeg_bands"]
        
        while self.state != StreamerState.STOPPED:
            if self.state == StreamerState.RUNNING:
                try:
                    # Gerar power bands
                    bandsData = self.eegMock.generatePowerBands()
                    
                    # Enviar através do SignalManager
                    await signalManager.processZeroMQData({
                        "timestamp": datetime.now().timestamp(),
                        "source": "eeg_streamer",
                        "data": {"eegBands": bandsData}
                    })
                    
                    self.counters["eeg_bands"] += 1
                    
                except Exception as e:
                    self.logger.error(f"Error streaming EEG bands: {e}")
            
            await asyncio.sleep(interval)
    
    
    async def _anomalyInjector(self):
        """Injeta anomalias ocasionalmente para teste"""
        interval = 2.0  # Verificar a cada 2 segundos
        
        while self.state != StreamerState.STOPPED:
            if self.state == StreamerState.RUNNING:
                try:
                    # Verificar se deve injetar anomalia
                    now = datetime.now()
                    timeSinceLastAnomaly = (now - self.lastAnomalyTime).total_seconds()
                    
                    if (timeSinceLastAnomaly > self.minAnomalyInterval and 
                        asyncio.get_event_loop().time() % 100 < self.anomalyChance * 100):
                        
                        await self._injectRandomAnomaly()
                        self.lastAnomalyTime = now
                    
                except Exception as e:
                    self.logger.error(f"Error in anomaly injector: {e}")
            
            await asyncio.sleep(interval)
    
    async def _injectRandomAnomaly(self):
        """Injeta uma anomalia aleatória"""
        import random
        
        anomalyTypes = [
            ("cardiac", "bradycardia"),
            ("cardiac", "tachycardia"),
            ("eeg", "electrode_loose"),
            ("eeg", "delta_dominance")
        ]
        
        signalType, anomalyType = random.choice(anomalyTypes)
        
        if signalType == "cardiac":
            anomalyData = self.cardiacMock.generateAnomalyData(anomalyType)
        else:
            anomalyData = self.eegMock.generateAnomalyData(anomalyType)
        
        # Enviar dados anómalos
        await signalManager.processZeroMQData({
            "timestamp": datetime.now().timestamp(),
            "source": f"{signalType}_anomaly_injector",
            "data": anomalyData
        })
        
        self.logger.warning(f"Injected anomaly: {signalType}.{anomalyType}")
    
    def _getUptime(self) -> float:
        """Calcula uptime em segundos"""
        if not self.startTime:
            return 0.0
        
        return (datetime.now() - self.startTime).total_seconds()
    
    def getStatus(self) -> Dict[str, Any]:
        """Retorna status atual do streamer"""
        return {
            "state": self.state.value,
            "uptime": self._getUptime(),
            "frequencies": self.frequencies,
            "counters": self.counters.copy(),
            "activeTasks": len([t for t in self.tasks.values() if not t.done()]),
            "totalTasks": len(self.tasks)
        }
    
    async def adjustFrequency(self, signalType: str, newFrequency: float):
        """Ajusta frequência de um tipo de sinal em tempo real"""
        if signalType in self.frequencies:
            oldFreq = self.frequencies[signalType]
            self.frequencies[signalType] = newFrequency
            
            self.logger.info(f"Adjusted {signalType} frequency: {oldFreq}Hz → {newFrequency}Hz")
            
            # Reiniciar task específica se estiver a correr
            if self.state == StreamerState.RUNNING and signalType in self.tasks:
                self.tasks[signalType].cancel()
                
                # Criar nova task com nova frequência
                if signalType == "cardiac_ecg":
                    self.tasks[signalType] = asyncio.create_task(self._streamCardiacEcg())
                elif signalType == "cardiac_hr":
                    self.tasks[signalType] = asyncio.create_task(self._streamCardiacHr())
                elif signalType == "eeg_raw":
                    self.tasks[signalType] = asyncio.create_task(self._streamEegRaw())
                elif signalType == "eeg_bands":
                    self.tasks[signalType] = asyncio.create_task(self._streamEegBands())

# Instância global
dataStreamer = DataStreamer()