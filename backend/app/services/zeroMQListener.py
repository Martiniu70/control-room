"""
ZeroMQListener - Recepção de dados reais de sensores

Resumo:
Sistema de recepção de dados em tempo real dos sensores através do protocolo ZeroMQ.
Estabelece uma conexão PULL socket que aguarda mensagens dos sensores
(CardioWheel, Halo EEG, câmara facial, simulador Unity) e processa os dados recebidos
através do SignalManager.

Funcionalidades principais:
- Conexão ZeroMQ PULL socket para receber dados de múltiplos sensores PUSH
- Validação do formato das mensagens JSON recebidas
- Reconexão automática em caso de falha de comunicação
- Monitorização contínua da saúde da conexão com métricas detalhadas
- Deteção de timeouts e problemas de comunicação
- Emissão de eventos de estado para monitorização externa
- Processamento assíncrono de mensagens com controlo da performance

O listener substitui o DataStreamer quando sensores reais estão conectados.


# TODO , primeira coisa a testar quando formos aao SIM, esta classe está sujeita a imensas mudanças se não for PUSH/PULL ....
# TODO pelos vistos o zeroMQ pelo tambem tem PUB / SUB que é exatamente como acontece com o nosso eventManager, mas assumi
# TODO que fosse PUSH/PULL porque fez-me sentido ser direct connect do zeroMQ para só um backend (o nosso) mas de certa forma 
# TODO para expansão do projeto provavelemtne fizeram PUB/SUB, a correção caso necessária leva a um big revamp da classe
"""

import asyncio
import json
import logging
import zmq
import zmq.asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from enum import Enum

from ..core import settings, eventManager
from ..core.exceptions import ZeroMQError

class ListenerState(Enum):
    """Estados possíveis do listener ZeroMQ"""
    STOPPED = "stopped"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    RECONNECTING = "reconnecting"
    ERROR = "error"

class ZeroMQListener:
    """Listener para recepção de dados reais de sensores via ZeroMQ"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Carregar configurações ZeroMQ centralizadas
        zmqConfig = settings.zeromq
        
        # Configurações de conexão
        self.sensorPort = zmqConfig.sensorPort
        self.timeout = zmqConfig.timeout
        self.socketUrl = f"tcp://*:{self.sensorPort}"
        
        # Configurações de socket
        self.lingerTime = zmqConfig.lingerTime
        self.receiveHighWaterMark = zmqConfig.receiveHighWaterMark
        self.socketType = zmqConfig.socketType
        
        # Configurações de reconexão e timeouts
        self.maxReconnectAttempts = zmqConfig.maxReconnectAttempts
        self.reconnectDelay = zmqConfig.reconnectDelay
        self.messageTimeout = zmqConfig.messageTimeout
        self.heartbeatInterval = zmqConfig.heartbeatInterval
        
        # Configurações de validação
        self.maxTimestampDifference = zmqConfig.maxTimestampDifference
        self.recognizedDataTypes = zmqConfig.recognizedDataTypes
        
        # Configurações de performance
        self.processingTimeoutWarning = zmqConfig.processingTimeoutWarning
        self.errorRateWarningThreshold = zmqConfig.errorRateWarningThreshold
        self.rejectionRateWarningThreshold = zmqConfig.rejectionRateWarningThreshold
        
        # Estado da conexão
        self.state = ListenerState.STOPPED
        self.startTime: Optional[datetime] = None
        self.lastMessageTime: Optional[datetime] = None
        self.reconnectAttempts = 0
        
        # Componentes ZeroMQ
        self.context: Optional[zmq.asyncio.Context] = None
        self.socket: Optional[zmq.asyncio.Socket] = None
        self.listenerTask: Optional[asyncio.Task] = None
        self.heartbeatTask: Optional[asyncio.Task] = None
        
        # Estatísticas de monitorização
        self.stats = {
            "messagesReceived": 0,
            "messagesProcessed": 0,
            "messagesRejected": 0,
            "lastMessageTimestamp": None,
            "connectionUptime": 0.0,
            "reconnections": 0,
            "errors": 0,
            "averageProcessingTime": 0.0,
            "messageTypes": {}
        }
        
        # Cache para SignalManager (evitar import circular) #  TODO
        self._signalManager = None
        
        self.logger.info(f"ZeroMQListener initialized - Port: {self.sensorPort}, Socket: {self.socketType}")
    
    def _getSignalManager(self): # TOdo averiguar este bug estranho, isto foi só fast fix cause idk what the fuck was going on e eram 5 da manhã queria ir dormir com tudo a dar
        """Obtém referência ao SignalManager evitando import circular"""
        if self._signalManager is None:
            from .signalManager import signalManager
            self._signalManager = signalManager
        return self._signalManager
    
    async def start(self):
        """
        Inicia o listener ZeroMQ e estabelece conexão com sensores.
        
        Configura o socket PULL, inicia as tasks de recepção e monitorização,
        e emite eventos de estado para notificar outros componentes.
        
        Raises:
            ZeroMQError: Se falhar ao estabelecer conexão inicial
        """
        if self.state in [ListenerState.CONNECTING, ListenerState.CONNECTED]:
            self.logger.warning("ZeroMQListener already running")
            return
        
        self.logger.info("Starting ZeroMQ listener...")
        self.startTime = datetime.now()
        self.reconnectAttempts = 0
        
        try:
            # Estabelecer conexão ZeroMQ
            await self._connect()
            
            # Iniciar tasks de processamento
            self.listenerTask = asyncio.create_task(self._messageLoop())
            self.heartbeatTask = asyncio.create_task(self._heartbeatLoop())
            
            # Emitir evento de início
            await eventManager.emit("zmq.listener_started", {
                "timestamp": datetime.now().isoformat(),
                "socketUrl": self.socketUrl,
                "socketType": self.socketType,
                "timeout": self.timeout
            })
            
            self.logger.info(f"ZeroMQListener started successfully on {self.socketUrl}")
            
        except Exception as e:
            self.state = ListenerState.ERROR
            self.stats["errors"] += 1
            await self._emitError("startup_failed", str(e))
            raise ZeroMQError("startup", str(e))
    
    async def stop(self):
        """
        Para o listener ZeroMQ e limpa recursos.
        
        Cancela tasks em execução, fecha socket e contexto ZeroMQ,
        e emite evento de paragem com estatísticas finais.
        """
        if self.state == ListenerState.STOPPED:
            return
        
        self.logger.info("Stopping ZeroMQ listener...")
        self.state = ListenerState.STOPPED
        
        try:
            # Cancelar tasks de processamento
            if self.listenerTask and not self.listenerTask.done():
                self.listenerTask.cancel()
                try:
                    await self.listenerTask
                except asyncio.CancelledError:
                    pass
            
            if self.heartbeatTask and not self.heartbeatTask.done():
                self.heartbeatTask.cancel()
                try:
                    await self.heartbeatTask
                except asyncio.CancelledError:
                    pass
            
            # Fechar conexão ZeroMQ
            await self._disconnect()
            
            # Emitir evento de paragem com estatísticas
            await eventManager.emit("zmq.listener_stopped", {
                "timestamp": datetime.now().isoformat(),
                "uptime": self._getUptime(),
                "finalStats": self.stats.copy()
            })
            
            self.logger.info("ZeroMQListener stopped successfully")
            
        except Exception as e:
            self.logger.error(f"Error stopping ZeroMQListener: {e}")
            self.stats["errors"] += 1
    
    async def _connect(self):
        """
        Estabelece conexão ZeroMQ PULL socket para receber dados dos sensores.
        
        Configura socket com parâmetros de timeout, buffer e faz bind ao porto
        especificado para aguardar conexões dos dispositivos PUSH.
        
        Raises:
            ZeroMQError: Se falhar ao estabelecer conexão
        """
        try:
            self.state = ListenerState.CONNECTING
            
            # Criar contexto e socket ZeroMQ
            self.context = zmq.asyncio.Context()
            self.socket = self.context.socket(zmq.PULL)
            
            # Configurar parâmetros do socket
            self.socket.setsockopt(zmq.RCVTIMEO, self.timeout)
            self.socket.setsockopt(zmq.LINGER, self.lingerTime)
            self.socket.setsockopt(zmq.RCVHWM, self.receiveHighWaterMark)
            
            # Fazer bind ao porto configurado
            self.socket.bind(self.socketUrl)
            
            # Atualizar estado e timestamps
            self.state = ListenerState.CONNECTED
            self.lastMessageTime = datetime.now()
            self.reconnectAttempts = 0
            
            # Emitir evento de conexão estabelecida
            await eventManager.emit("zmq.connected", {
                "timestamp": datetime.now().isoformat(),
                "socketUrl": self.socketUrl,
                "socketType": self.socketType,
                "reconnectAttempt": self.reconnectAttempts
            })
            
            self.logger.info(f"ZeroMQ {self.socketType} socket bound to {self.socketUrl}")
            
        except Exception as e:
            self.state = ListenerState.ERROR
            self.stats["errors"] += 1
            raise ZeroMQError("connection", str(e))
    
    async def _disconnect(self):
        """
        Fecha socket e termina contexto ZeroMQ de forma segura.
        """
        try:
            if self.socket:
                self.socket.close()
                self.socket = None
            
            if self.context:
                self.context.term()
                self.context = None
            
            self.logger.debug(f"ZeroMQ {self.socketType} socket closed")
            
        except Exception as e:
            self.logger.error(f"Error closing ZeroMQ socket: {e}")
            self.stats["errors"] += 1
    
    async def _messageLoop(self):
        """
        Loop principal de recepção e processamento de mensagens.
        
        Executa continuamente enquanto o listener estiver activo, recebendo
        mensagens dos sensores ou tentando reconectar em caso de falha.
        """
        while self.state != ListenerState.STOPPED:
            try:
                if self.state == ListenerState.CONNECTED:
                    await self._receiveMessage()
                else:
                    await self._attemptReconnect()
                
            except asyncio.CancelledError:
                break
                
            except Exception as e:
                self.logger.error(f"Error in message loop: {e}")
                self.stats["errors"] += 1
                await self._handleConnectionError(str(e))
    
    async def _receiveMessage(self):
        """
        Recebe e processa uma mensagem individual do socket ZeroMQ.
        
        Aguarda mensagem com timeout configurado, mede tempo de processamento
        e actualiza estatísticas de performance.
        """
        try:
            # Aguardar mensagem com timeout
            message = await asyncio.wait_for(
                self.socket.recv_string(zmq.NOBLOCK),
                timeout=self.timeout / 1000.
            )
            
            # Atualizar contador de mensagens recebidas
            self.stats["messagesReceived"] += 1
            self.lastMessageTime = datetime.now()
            
            # Processar mensagem com medição de tempo
            startTime = datetime.now()
            await self._processMessage(message)
            processingTime = (datetime.now() - startTime).total_seconds()
            
            # Verificar se processamento demorou mais que o esperado
            if processingTime > self.processingTimeoutWarning:
                self.logger.warning(f"Slow message processing: {processingTime:.3f}s")
            
            # Atualizar tempo médio de processamento
            if self.stats["messagesProcessed"] > 0:
                currentAvg = self.stats["averageProcessingTime"]
                processedCount = self.stats["messagesProcessed"]
                self.stats["averageProcessingTime"] = (
                    (currentAvg * (processedCount - 1) + processingTime) / processedCount
                )
            
        except asyncio.TimeoutError:
            # Timeout esperado - verificar se não há mensagens há muito tempo
            await self._checkMessageTimeout()
            
        except zmq.Again:
            # Não há mensagens disponíveis no momento
            await asyncio.sleep(0.01)
            
        except Exception as e:
            self.logger.error(f"Error receiving message: {e}")
            self.stats["errors"] += 1
            await self._handleConnectionError(str(e))
    
    async def _processMessage(self, message: str):
        """
        Processa mensagem JSON recebida dos sensores.
        
        Valida formato da mensagem, actualiza estatísticas de tipos de dados
        e envia para processamento pelo SignalManager.
        
        Args:
            message: Mensagem JSON em string recebida do sensor
        """
        try:
            # Fazer parse da mensagem JSON
            data = json.loads(message)
            
            # Validar estrutura básica da mensagem
            if not self._validateMessageFormat(data):
                self.stats["messagesRejected"] += 1
                self.logger.warning(f"Invalid message format: {message[:100]}...")
                return
            
            # Atualizar timestamp da última mensagem válida
            self.stats["lastMessageTimestamp"] = data.get("timestamp")
            
            # Contar tipos de dados recebidos para estatísticas
            dataTypes = list(data.get("data", {}).keys())
            for dataType in dataTypes:
                self.stats["messageTypes"][dataType] = self.stats["messageTypes"].get(dataType, 0) + 1
            
            # Enviar para processamento pelo SignalManager
            signalManager = self._getSignalManager()
            success = await signalManager.processZeroMQData(data)
            
            if success:
                self.stats["messagesProcessed"] += 1
                self.logger.debug(f"Message processed from {data.get('source', 'unknown')} with types: {dataTypes}")
            else:
                self.stats["messagesRejected"] += 1
                self.logger.warning(f"Message rejected by SignalManager from {data.get('source', 'unknown')}")
            
            # Emitir evento de mensagem recebida
            await eventManager.emit("zmq.message_received", {
                "timestamp": datetime.now().isoformat(),
                "source": data.get("source", "unknown"),
                "dataTypes": dataTypes,
                "processed": success,
                "messageSize": len(message)
            })
            
        except json.JSONDecodeError:
            self.stats["messagesRejected"] += 1
            self.logger.warning(f"Invalid JSON received: {message[:100]}...")
            
        except Exception as e:
            self.stats["messagesRejected"] += 1
            self.stats["errors"] += 1
            self.logger.error(f"Error processing message: {e}")
    
    def _validateMessageFormat(self, data: Dict[str, Any]) -> bool:
        """
        Valida formato e conteúdo da mensagem recebida.
        
        Verifica estrutura JSON, campos obrigatórios, timestamp válido
        e presença de tipos de dados reconhecidos pelo sistema.
        
        Args:
            data: Dados da mensagem a validar
            
        Returns:
            True se mensagem é válida, False caso contrário
        """
        try:
            # Verificar se é dicionário
            if not isinstance(data, dict):
                self.logger.debug("Message is not a dictionary")
                return False
            
            # Verificar campos obrigatórios
            if "timestamp" not in data:
                self.logger.debug("Message missing timestamp")
                return False
            
            if "source" not in data:
                self.logger.debug("Message missing source")
                return False
            
            if "data" not in data or not isinstance(data["data"], dict):
                self.logger.debug("Message missing or invalid data field")
                return False
            
            # Validar timestamp
            try:
                timestamp = float(data["timestamp"])
                currentTime = datetime.now().timestamp()
                
                # Verificar se timestamp está dentro do range aceitável
                if abs(timestamp - currentTime) > self.maxTimestampDifference:
                    self.logger.debug(f"Timestamp too far from current time: {timestamp} vs {currentTime}")
                    return False
                    
            except (ValueError, TypeError):
                self.logger.debug(f"Invalid timestamp format: {data['timestamp']}")
                return False
            
            # Verificar se contém tipos de dados reconhecidos
            dataKeys = data["data"].keys()
            if not any(key in self.recognizedDataTypes for key in dataKeys):
                self.logger.debug(f"No recognized data types in message: {list(dataKeys)}")
                return False
            
            return True
            
        except Exception as e:
            self.logger.debug(f"Error validating message format: {e}")
            return False
    
    async def _checkMessageTimeout(self):
        """
        Verifica se há timeout na recepção de mensagens.
        
        Emite aviso se não foram recebidas mensagens por período superior
        ao timeout configurado, indicando possível problema de comunicação.
        """
        if self.lastMessageTime:
            timeSinceLastMessage = (datetime.now() - self.lastMessageTime).total_seconds()
            
            if timeSinceLastMessage > self.messageTimeout:
                await self._emitWarning("message_timeout", 
                    f"No messages received for {timeSinceLastMessage:.1f}s")
    
    async def _attemptReconnect(self):
        """
        Tenta restabelecer conexão ZeroMQ em caso de falha.
        
        Implementa backoff exponencial e limite de tentativas para
        evitar sobrecarga em caso de problemas persistentes.
        """
        if self.reconnectAttempts >= self.maxReconnectAttempts:
            self.state = ListenerState.ERROR
            await self._emitError("max_reconnect_attempts", 
                f"Failed to reconnect after {self.maxReconnectAttempts} attempts")
            return
        
        self.state = ListenerState.RECONNECTING
        self.reconnectAttempts += 1
        
        self.logger.info(f"Attempting to reconnect ({self.reconnectAttempts}/{self.maxReconnectAttempts})...")
        
        try:
            # Fechar conexão anterior
            await self._disconnect()
            
            # Aguardar antes de tentar reconectar
            await asyncio.sleep(self.reconnectDelay)
            
            # Tentar restabelecer conexão
            await self._connect()
            
            self.stats["reconnections"] += 1
            self.logger.info(f"Reconnection successful after {self.reconnectAttempts} attempts")
            
        except Exception as e:
            self.logger.error(f"Reconnection attempt {self.reconnectAttempts} failed: {e}")
            self.stats["errors"] += 1
            await asyncio.sleep(self.reconnectDelay)
    
    async def _handleConnectionError(self, error: str):
        """
        Gere erros de conexão e inicia processo de reconexão.
        
        Args:
            error: Descrição do erro de conexão
        """
        self.logger.error(f"Connection error: {error}")
        
        if self.state == ListenerState.CONNECTED:
            self.state = ListenerState.RECONNECTING
            await self._emitError("connection_lost", error)
    
    async def _heartbeatLoop(self):
        """
        Loop de monitorização que envia heartbeat periódico.
        
        Emite evento de heartbeat com estatísticas e estado da conexão
        para permitir monitorização externa da saúde do sistema.
        """
        while self.state != ListenerState.STOPPED:
            try:
                if self.state == ListenerState.CONNECTED:
                    await self._sendHeartbeat()
                
                await asyncio.sleep(self.heartbeatInterval)
                
            except asyncio.CancelledError:
                break
                
            except Exception as e:
                self.logger.error(f"Error in heartbeat loop: {e}")
                self.stats["errors"] += 1
    
    async def _sendHeartbeat(self):
        """
        Envia heartbeat com estado actual e métricas de performance.
        
        Inclui estatísticas de mensagens, saúde da conexão e tempo
        desde última mensagem para monitorização externa.
        """
        try:
            await eventManager.emit("zmq.heartbeat", {
                "timestamp": datetime.now().isoformat(),
                "state": self.state.value,
                "uptime": self._getUptime(),
                "stats": self.stats.copy(),
                "lastMessageAge": self._getLastMessageAge(),
                "health": self.getConnectionHealth()
            })
            
        except Exception as e:
            self.logger.error(f"Error sending heartbeat: {e}")
            self.stats["errors"] += 1
    
    async def _emitError(self, errorType: str, message: str):
        """
        Emite evento de erro com detalhes do problema.
        
        Args:
            errorType: Tipo específico do erro
            message: Descrição detalhada do erro
        """
        await eventManager.emit("zmq.error", {
            "timestamp": datetime.now().isoformat(),
            "errorType": errorType,
            "message": message,
            "state": self.state.value,
            "stats": self.stats.copy()
        })
    
    async def _emitWarning(self, warningType: str, message: str):
        """
        Emite evento de aviso para problemas não críticos.
        
        Args:
            warningType: Tipo específico do aviso
            message: Descrição do problema
        """
        await eventManager.emit("zmq.warning", {
            "timestamp": datetime.now().isoformat(),
            "warningType": warningType,
            "message": message,
            "state": self.state.value
        })
    
    def _getUptime(self) -> float:
        """
        Calcula tempo de funcionamento em segundos.
        
        Returns:
            Uptime em segundos desde o início do listener
        """
        if not self.startTime:
            return 0.0
        return (datetime.now() - self.startTime).total_seconds()
    
    def _getLastMessageAge(self) -> Optional[float]:
        """
        Calcula idade da última mensagem recebida.
        
        Returns:
            Segundos desde última mensagem ou None se nunca recebeu
        """
        if not self.lastMessageTime:
            return None
        return (datetime.now() - self.lastMessageTime).total_seconds()
    
    def getStatus(self) -> Dict[str, Any]:
        """
        Retorna estado completo do listener para monitorização.
        
        Inclui estado da conexão, estatísticas, configurações e
        métricas de saúde para debug e monitorização externa.
        
        Returns:
            Dicionário com estado completo do sistema
        """
        return {
            "state": self.state.value,
            "socketUrl": self.socketUrl,
            "socketType": self.socketType,
            "uptime": self._getUptime(),
            "lastMessageAge": self._getLastMessageAge(),
            "reconnectAttempts": self.reconnectAttempts,
            "maxReconnectAttempts": self.maxReconnectAttempts,
            "stats": self.stats.copy(),
            "health": self.getConnectionHealth(),
            "config": {
                "sensorPort": self.sensorPort,
                "timeout": self.timeout,
                "messageTimeout": self.messageTimeout,
                "reconnectDelay": self.reconnectDelay,
                "heartbeatInterval": self.heartbeatInterval,
                "recognizedDataTypes": self.recognizedDataTypes
            }
        }
    
    def getConnectionHealth(self) -> Dict[str, Any]:
        """
        Avalia saúde da conexão baseada em métricas e thresholds.
        
        Analisa estado da conexão, taxa de erros, tempo sem mensagens
        e outros indicadores para determinar se sistema está saudável.
        
        Returns:
            Dicionário com avaliação de saúde e métricas
        """
        health = "healthy"
        issues = []
        warnings = []
        
        # Verificar estado da conexão
        if self.state == ListenerState.ERROR:
            health = "critical"
            issues.append("Connection in error state")
        elif self.state == ListenerState.RECONNECTING:
            health = "warning"
            warnings.append("Currently reconnecting")
        elif self.state != ListenerState.CONNECTED:
            health = "warning"
            warnings.append(f"Not connected (state: {self.state.value})")
        
        # Verificar timeout de mensagens
        lastMessageAge = self._getLastMessageAge()
        if lastMessageAge and lastMessageAge > self.messageTimeout:
            health = "warning" if health == "healthy" else health
            warnings.append(f"No messages for {lastMessageAge:.1f}s")
        elif lastMessageAge is None and self._getUptime() > 5.0:
            health = "warning" if health == "healthy" else health
            warnings.append("Never received messages")
        
        # Verificar tentativas de reconexão
        if self.reconnectAttempts > 0:
            if self.reconnectAttempts >= self.maxReconnectAttempts / 2:
                health = "warning" if health == "healthy" else health
                warnings.append(f"Multiple reconnection attempts ({self.reconnectAttempts})")
        
        # Verificar taxa de erro
        if self.stats["messagesReceived"] > 0:
            errorRate = self.stats["errors"] / self.stats["messagesReceived"]
            if errorRate > self.errorRateWarningThreshold:
                health = "warning" if health == "healthy" else health
                warnings.append(f"High error rate: {errorRate:.1%}")
        
        # Verificar taxa de rejeição
        if self.stats["messagesReceived"] > 0:
            rejectionRate = self.stats["messagesRejected"] / self.stats["messagesReceived"]
            if rejectionRate > self.rejectionRateWarningThreshold:
                health = "warning" if health == "healthy" else health
                warnings.append(f"High rejection rate: {rejectionRate:.1%}")
        
        return {
            "health": health,
            "issues": issues,
            "warnings": warnings,
            "lastCheck": datetime.now().isoformat(),
            "metrics": {
                "errorRate": self.stats["errors"] / max(1, self.stats["messagesReceived"]),
                "rejectionRate": self.stats["messagesRejected"] / max(1, self.stats["messagesReceived"]),
                "processingRate": self.stats["messagesProcessed"] / max(1, self.stats["messagesReceived"])
            }
        }

# Instância global
zeroMQListener = ZeroMQListener()