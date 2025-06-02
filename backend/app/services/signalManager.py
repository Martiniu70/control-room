"""
SignalManager com suporte para EEG (CORRIGIDO)

Resumo:
Manager central para coordenar sinais - versão expandida com EEG e cardiac.
Coordena todos os tipos de sinais (CardiacSignal, EEGSignal) e processa dados 
vindos de diferentes fontes (ZeroMQ, DataStreamer). Funciona como "dirigente de orquestra"
que recebe dados brutos, os distribui pelos sinais corretos, e emite eventos 
quando processados. Inclui validação, gestão de erros, e avaliação da saúde geral do sistema.
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

from ..models.signals.cardiacSignal import CardiacSignal
from ..models.signals.eegSignal import EEGSignal
from ..models.base import SignalPoint
from ..core import eventManager, settings

class SignalManager:
    """Manager central para coordenar sinais - versão com EEG corrigida"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Sinais implementados: cardiac + EEG
        self.signals: Dict[str, Any] = {
            "cardiac": CardiacSignal(),
            "eeg": EEGSignal()
        }
        
        # Mapeamento de data types por sinal (mais robusto)
        self.dataTypeMappings = {
            "cardiac": ["ecg", "hr"],
            "eeg": ["eegRaw", "eegBands"]
        }
        
        # Mapeamento de métodos específicos de status por sinal
        self.statusMethods = {
            "cardiac": "getCardiacStatus",
            "eeg": "getEegStatus"
        }
        
        # Estatísticas do manager
        self.stats = {
            "totalDataProcessed": 0,
            "dataProcessedBySignal": {signal: 0 for signal in self.signals.keys()},
            "totalErrors": 0,
            "lastProcessedTime": None,
            "startTime": datetime.now().isoformat()
        }
        
        self.logger.info(f"SignalManager initialized with signals: {list(self.signals.keys())}")
    
    async def addSignalData(self, signalType: str, dataType: str, value: Any, 
                           timestamp: Optional[float] = None) -> bool:
        """
        Adiciona dados a um sinal específico
        
        Args:
            signalType: "cardiac", "eeg"
            dataType: "ecg", "hr", "eegRaw", "eegBands"
            value: Valor do sinal
            timestamp: Timestamp opcional
        """
        
        # Verificar se sinal existe
        if signalType not in self.signals:
            self.logger.warning(f"Unknown signal type: {signalType}")
            self.stats["totalErrors"] += 1
            return False
        
        # Verificar se dataType é válido para o sinal
        if dataType not in self.dataTypeMappings.get(signalType, []):
            self.logger.warning(f"Invalid data type {dataType} for signal {signalType}. Valid types: {self.dataTypeMappings.get(signalType, [])}")
            self.stats["totalErrors"] += 1
            return False
        
        try:
            # Criar SignalPoint
            point = SignalPoint(
                timestamp=timestamp or datetime.now().timestamp(),
                value=value,
                quality=1.0,  # Por agora qualidade fixa
                metadata={"dataType": dataType, "source": "signal_manager"}
            )
            
            # Obter anomalias antes de adicionar
            signal = self.signals[signalType]
            previousAnomalies = set(signal.getRecentAnomalies())

            # Adicionar ao sinal
            success = signal.addPoint(point)

            if success:
                # Obter anomalias depois de adicionar
                currentAnomalies = signal.getRecentAnomalies()
                newAnomalies = [a for a in currentAnomalies if a not in previousAnomalies]
                
                # Atualizar estatísticas
                self.stats["totalDataProcessed"] += 1
                self.stats["dataProcessedBySignal"][signalType] += 1
                self.stats["lastProcessedTime"] = datetime.now().isoformat()
                
                self.logger.debug(f"Added {dataType} data to {signalType}")
                
                # Emitir evento normal (sempre)
                await eventManager.emit("signal.processed", {
                    "signalType": signalType,
                    "dataType": dataType,
                    "value": value,
                    "timestamp": point.timestamp,
                    "anomalies": currentAnomalies
                })
                
                # Emitir evento para novas anomalias
                for anomaly in newAnomalies:
                    await self._emitAnomalyDetected(signalType, anomaly, value)
                
                return True
            else:
                self.logger.warning(f"Failed to add {dataType} to {signalType}")
                self.stats["totalErrors"] += 1
                return False
                
        except Exception as e:
            self.logger.error(f"Error adding signal data: {e}")
            self.stats["totalErrors"] += 1
            return False
    
    async def processZeroMQData(self, rawData: Dict[str, Any]) -> bool:
        """
        Processa dados vindos do ZeroMQ - versão expandida e robusta
        
        Formato esperado:
        {
            "timestamp": 1653123456.789,
            "source": "cardiowheel|halo|camera|unity",
            "data": {
                # Cardiac
                "ecg": [sample1, sample2, ...],
                "hr": 75.5,
                
                # EEG
                "eegRaw": {
                    "ch1": [samples...], "ch2": [samples...], 
                    "ch3": [samples...], "ch4": [samples...]
                },
                "eegBands": {
                    "delta": 0.25, "theta": 0.33, "alpha": 0.42, 
                    "beta": 0.18, "gamma": 0.05
                }
            }
        }
        """
        
        try:
            # Validação básica da estrutura
            if not isinstance(rawData, dict):
                self.logger.error("ZeroMQ data must be a dictionary")
                self.stats["totalErrors"] += 1
                return False
            
            timestamp = rawData.get("timestamp")
            source = rawData.get("source", "unknown")
            data = rawData.get("data", {})
            
            if not isinstance(data, dict):
                self.logger.error("ZeroMQ data.data must be a dictionary")
                self.stats["totalErrors"] += 1
                return False
            
            self.logger.debug(f"Processing ZeroMQ data from {source} with keys: {list(data.keys())}")
            
            overallSuccess = True
            processedCount = 0
            errors = []
            
            # Processar dados cardíacos
            if "ecg" in data or "hr" in data:
                try:
                    cardiacSuccess = await self._processCardiacData(data, timestamp)
                    overallSuccess = overallSuccess and cardiacSuccess
                    if cardiacSuccess:
                        processedCount += 1
                except Exception as e:
                    errors.append(f"Cardiac processing failed: {e}")
                    overallSuccess = False
            
            # Processar dados EEG
            if "eegRaw" in data or "eegBands" in data:
                try:
                    eegSuccess = await self._processEegData(data, timestamp)
                    overallSuccess = overallSuccess and eegSuccess
                    if eegSuccess:
                        processedCount += 1
                except Exception as e:
                    errors.append(f"EEG processing failed: {e}")
                    overallSuccess = False
            
            # Verificar se processamos alguma coisa
            if processedCount > 0:
                """
                self.logger.info(f"Successfully processed {processedCount} signal types from {source}")
                """
            else:
                self.logger.warning(f"No recognizable data types in message from {source}. Available keys: {list(data.keys())}")
                overallSuccess = False
            
            # Log de erros se houver
            if errors:
                for error in errors:
                    self.logger.error(error)
                self.stats["totalErrors"] += len(errors)
            
            return overallSuccess
            
        except Exception as e:
            self.logger.error(f"Error processing ZeroMQ data: {e}")
            self.stats["totalErrors"] += 1
            return False
    
    async def _processCardiacData(self, data: Dict[str, Any], timestamp: Optional[float]) -> bool:
        """Processa dados cardíacos específicos com validação"""
        success = True
        
        # Processar ECG se presente
        if "ecg" in data:
            try:
                ecgSuccess = await self.addSignalData(
                    signalType="cardiac",
                    dataType="ecg", 
                    value=data["ecg"],
                    timestamp=timestamp
                )
                success = success and ecgSuccess
                if not ecgSuccess:
                    self.logger.warning(f"Failed to process ECG data")
            except Exception as e:
                self.logger.error(f"Error processing ECG data: {e}")
                success = False
        
        # Processar HR se presente
        if "hr" in data:
            try:
                hrSuccess = await self.addSignalData(
                    signalType="cardiac",
                    dataType="hr",
                    value=data["hr"],
                    timestamp=timestamp
                )
                success = success and hrSuccess
                if not hrSuccess:
                    self.logger.warning(f"Failed to process HR data: {data['hr']}")
            except Exception as e:
                self.logger.error(f"Error processing HR data: {e}")
                success = False
        
        return success
    
    async def _processEegData(self, data: Dict[str, Any], timestamp: Optional[float]) -> bool:
        """Processa dados EEG específicos com validação"""
        success = True
        
        # Processar EEG Raw se presente
        if "eegRaw" in data:
            try:
                rawSuccess = await self.addSignalData(
                    signalType="eeg",
                    dataType="eegRaw",
                    value=data["eegRaw"],
                    timestamp=timestamp
                )
                success = success and rawSuccess
                if not rawSuccess:
                    self.logger.warning(f"Failed to process EEG raw data")
            except Exception as e:
                self.logger.error(f"Error processing EEG raw data: {e}")
                success = False
        
        # Processar EEG Bands se presente
        if "eegBands" in data:
            try:
                bandsSuccess = await self.addSignalData(
                    signalType="eeg",
                    dataType="eegBands",
                    value=data["eegBands"],
                    timestamp=timestamp
                )
                success = success and bandsSuccess
                if not bandsSuccess:
                    self.logger.warning(f"Failed to process EEG bands data")
            except Exception as e:
                self.logger.error(f"Error processing EEG bands data: {e}")
                success = False
        
        return success
    
    def getLatestData(self) -> Dict[str, Any]:
        """Retorna dados mais recentes de todos os sinais"""
        result = {}
        
        for signalName, signal in self.signals.items():
            try:
                latest = signal.getLatestValue()
                if latest:
                    result[signalName] = {
                        "timestamp": latest.timestamp,
                        "value": latest.value,
                        "quality": latest.quality,
                        "dataType": latest.metadata.get("dataType", "unknown")
                    }
                else:
                    result[signalName] = None
            except Exception as e:
                self.logger.error(f"Error getting latest data for {signalName}: {e}")
                result[signalName] = {"error": str(e)}
        
        return result
    
    def getSignalStatus(self, signalType: str) -> Optional[Dict[str, Any]]:
        """Status de um sinal específico - com verificação de métodos"""
        if signalType not in self.signals:
            return None
        
        signal = self.signals[signalType]
        
        try:
            # Verificar se o sinal tem método específico de status
            statusMethodName = self.statusMethods.get(signalType)
            if statusMethodName and hasattr(signal, statusMethodName):
                statusMethod = getattr(signal, statusMethodName)
                return statusMethod()
            else:
                # Fallback para método base
                return signal.getStatus()
                
        except Exception as e:
            self.logger.error(f"Error getting status for {signalType}: {e}")
            return {
                "signalName": signalType,
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def getAllSignalsStatus(self) -> Dict[str, Any]:
        """Status de todos os sinais"""
        status = {}
        
        for signalName in self.signals:
            try:
                signalStatus = self.getSignalStatus(signalName)
                status[signalName] = signalStatus
            except Exception as e:
                self.logger.error(f"Error getting status for {signalName}: {e}")
                status[signalName] = {"error": str(e)}
        
        return status
    
    def getSystemHealth(self) -> Dict[str, Any]:
        """Avalia saúde geral do sistema"""
        try:
            allSignalsStatus = self.getAllSignalsStatus()
            
            health = "healthy"
            issues = []
            warnings = []
            
            # Verificar cada sinal
            activeSignals = 0
            totalAnomalies = 0
            
            for signalName, status in allSignalsStatus.items():
                if not status:
                    health = "critical"
                    issues.append(f"{signalName}: no status available")
                    continue
                
                if "error" in status:
                    health = "warning" if health == "healthy" else health
                    issues.append(f"{signalName}: {status['error']}")
                    continue
                
                # Verificar se está ativo
                if not status.get("isActive", False):
                    health = "warning" if health == "healthy" else health
                    warnings.append(f"{signalName}: not active")
                else:
                    activeSignals += 1
                
                # Contar anomalias
                anomalyCount = status.get("anomalyCount", 0)
                totalAnomalies += anomalyCount
                
                # Verificar tempo desde última atualização
                timeSinceUpdate = status.get("timeSinceUpdate")
                if timeSinceUpdate and timeSinceUpdate > 30:  # 30 segundos
                    health = "warning" if health == "healthy" else health
                    warnings.append(f"{signalName}: no updates for {timeSinceUpdate:.1f}s")
            
            # Verificar estatísticas gerais
            errorRate = self.stats["totalErrors"] / max(1, self.stats["totalDataProcessed"])
            if errorRate > 0.1:  # >10% erro
                health = "warning" if health == "healthy" else health
                warnings.append(f"High error rate: {errorRate:.1%}")
            
            # Verificar se há sinais ativos
            if activeSignals == 0:
                health = "critical"
                issues.append("No active signals")
            elif activeSignals < len(self.signals):
                health = "warning" if health == "healthy" else health
                warnings.append(f"Only {activeSignals}/{len(self.signals)} signals active")
            
            # Verificar anomalias excessivas
            if totalAnomalies > 5:
                health = "warning" if health == "healthy" else health
                warnings.append(f"High anomaly count: {totalAnomalies}")
            
            # Calcular uptime
            startTime = datetime.fromisoformat(self.stats["startTime"])
            uptime = (datetime.now() - startTime).total_seconds()
            
            return {
                "health": health,
                "issues": issues,
                "warnings": warnings,
                "summary": {
                    "activeSignals": activeSignals,
                    "totalSignals": len(self.signals),
                    "totalAnomalies": totalAnomalies,
                    "errorRate": errorRate,
                    "uptime": uptime
                },
                "stats": self.stats.copy(),
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error assessing system health: {e}")
            return {
                "health": "critical",
                "issues": [f"Health assessment failed: {e}"],
                "warnings": [],
                "timestamp": datetime.now().isoformat()
            }
    
    def getSignalMetrics(self, signalType: str, lastN: Optional[int] = None) -> Optional[Dict]:
        """Métricas de um sinal"""
        if signalType not in self.signals:
            return None
        
        try:
            signal = self.signals[signalType]
            return signal.getMetrics(lastN)
        except Exception as e:
            self.logger.error(f"Error getting metrics for {signalType}: {e}")
            return None
    
    def checkAnomalies(self) -> List[Dict[str, Any]]:
        """Verifica anomalias em todos os sinais"""
        allAnomalies = []
        
        for signalName, signal in self.signals.items():
            try:
                anomalies = signal.getRecentAnomalies()
                
                for anomaly in anomalies:
                    allAnomalies.append({
                        "signalType": signalName,
                        "message": anomaly,
                        "timestamp": datetime.now().isoformat(),
                        "severity": self._classifyAnomalySeverity(anomaly)
                    })
                    
            except Exception as e:
                self.logger.error(f"Error checking anomalies for {signalName}: {e}")
                allAnomalies.append({
                    "signalType": signalName,
                    "message": f"Error checking anomalies: {e}",
                    "timestamp": datetime.now().isoformat(),
                    "severity": "critical"
                })
        
        return allAnomalies
    
    async def _emitAnomalyDetected(self, signalType: str, anomalyMessage: str, value: Any):
        """Emite evento específico de anomalia detectada"""
        
        # Extrair informações da mensagem de anomalia
        anomalyInfo = self._parseAnomalyMessage(anomalyMessage)
        
        await eventManager.emit("anomaly.detected", {
            "signalType": signalType,
            "anomalyType": anomalyInfo["type"],
            "severity": anomalyInfo["severity"],
            "message": anomalyMessage,
            "timestamp": datetime.now().isoformat(),
            "value": value,
            "threshold": anomalyInfo.get("threshold")
        })

    def _parseAnomalyMessage(self, message: str) -> Dict[str, Any]:
        """Extrai informações da mensagem de anomalia"""
        message_lower = message.lower()
        
        # Detectar tipo de anomalia
        if "bradicardia" in message_lower:
            anomaly_type = "bradycardia"
            threshold = settings.signals.cardiacConfig["hr"]["bradycardiaThreshold"]
        elif "taquicardia" in message_lower:
            anomaly_type = "tachycardia" 
            threshold = settings.signals.cardiacConfig["hr"]["tachycardiaThreshold"]
        elif "eletrodo" in message_lower and "solto" in message_lower:
            anomaly_type = "electrode_loose"
            threshold = None
        elif "saturação" in message_lower:
            anomaly_type = "saturation"
            threshold = settings.signals.eegConfig["raw"]["saturationThreshold"]
        elif "dominância" in message_lower and "delta" in message_lower:
            anomaly_type = "delta_dominance"
            threshold = settings.signals.eegConfig["bands"]["deltaExcessThreshold"]
        elif "amplitude" in message_lower and "baixa" in message_lower:
            anomaly_type = "low_amplitude"
            threshold = settings.signals.cardiacConfig["ecg"]["lowAmplitudeThreshold"]
        else:
            anomaly_type = "unknown"
            threshold = None
        
        # Detectar severidade
        severity = self._classifyAnomalySeverity(message)
        
        return {
            "type": anomaly_type,
            "severity": severity,
            "threshold": threshold
        }
    
    def _classifyAnomalySeverity(self, anomalyMessage: str) -> str:
        """Classifica severidade de anomalia - melhorada"""
        message = anomalyMessage.lower()
        
        # Crítico
        if any(word in message for word in [
            "severe", "crítico", "saturação", "solto", "muito baixa", "muito alta",
            "error", "failed", "connection", "timeout"
        ]):
            return "critical"
        
        # Aviso
        elif any(word in message for word in [
            "moderate", "alta", "súbita", "dominância", "excessiva", "warning",
            "drift", "artefacto", "movimento", "variabilidade"
        ]):
            return "warning"
        
        # Info
        else:
            return "info"
    
    def getManagerStats(self) -> Dict[str, Any]:
        """Estatísticas do SignalManager"""
        uptime = (datetime.now() - self.stats["startTime"]).total_seconds()
        
        return {
            **self.stats,
            "uptime": uptime,
            "availableSignals": list(self.signals.keys()),
            "dataTypeMappings": self.dataTypeMappings,
            "averageProcessingRate": self.stats["totalDataProcessed"] / max(1, uptime),
            "successRate": 1 - (self.stats["totalErrors"] / max(1, self.stats["totalDataProcessed"]))
        }
    
    def reset(self) -> None:
        """Reset de todos os sinais e estatísticas"""
        try:
            for signal in self.signals.values():
                signal.reset()
            
            # Reset das estatísticas
            self.stats = {
                "totalDataProcessed": 0,
                "dataProcessedBySignal": {signal: 0 for signal in self.signals.keys()},
                "totalErrors": 0,
                "lastProcessedTime": None,
                "startTime": datetime.now()
            }
            
            self.logger.info("All signals and statistics reset")
            
        except Exception as e:
            self.logger.error(f"Error during reset: {e}")

# Instância global
signalManager = SignalManager()