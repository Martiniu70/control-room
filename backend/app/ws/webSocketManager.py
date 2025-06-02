"""
WebSocketManager - Coordenador de conexões WebSocket

Resumo:
Gere todas as conexões WebSocket com browsers/clientes. Recebe dados processados dos sinais
através de eventos e envia-os imediatamente para todos os clientes conectados. Mantém lista
de conexões ativas, atribui IDs únicos a cada cliente, e remove automaticamente conexões
mortas. Também envia dados de status do sistema, anomalias detectadas, e heartbeat periódico.
"""

import asyncio
import logging
from typing import Set, Dict, Any, Optional
from datetime import datetime
from fastapi import WebSocket
from ..services.signalManager import signalManager
from ..core import eventManager, settings

class WebSocketManager:
    """Gere conexões WebSocket e broadcasting de dados"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        
        # Conexões ativas
        self.activeConnections: Set[WebSocket] = set()
        self.connectionData: Dict[WebSocket, Dict[str, Any]] = {}
        self.connectionCounter = 0
        
        # Configurações
        self.maxConnections = settings.websocket.maxConnections
        self.updateInterval = settings.websocket.updateInterval

        self.heartbeatTask: Optional[asyncio.Task] = None
        self.heartbeatInterval = 10.0  
        
        # Subscrever aos eventos do sistema
        self._setupEventSubscriptions()
        
        self.logger.info(f"WebSocketManager initialized - Max connections: {self.maxConnections}")
    
    def _setupEventSubscriptions(self):
        """Configura subscriptions aos eventos"""
        # Eventos principais
        eventManager.subscribe("signal.processed", self.onSignalProcessed)
        eventManager.subscribe("anomaly.detected", self.onAnomalyDetected)

        # Novos eventos ZeroMQ
        eventManager.subscribe("zmq.connected", self.onZmqConnected)
        eventManager.subscribe("zmq.error", self.onZmqError)
        eventManager.subscribe("zmq.warning", self.onZmqWarning)
        eventManager.subscribe("zmq.heartbeat", self.onZmqHeartbeat)
        
        self.logger.info("WebSocket event subscriptions configured")
    
    async def connect(self, websocket: WebSocket, clientInfo: Optional[Dict] = None) -> str:
        """Conecta novo cliente WebSocket"""
        try:
            # Verificar limite de conexões
            if len(self.activeConnections) >= self.maxConnections:
                await websocket.close(code=1008, reason="Maximum connections exceeded")
                raise Exception(f"Connection limit exceeded ({self.maxConnections})")
            
            # Aceitar conexão
            await websocket.accept()
            
            # Gerar ID único
            self.connectionCounter += 1
            clientId = f"client_{self.connectionCounter}"
            
            # Adicionar às conexões ativas
            self.activeConnections.add(websocket)
            self.connectionData[websocket] = {
                "clientId": clientId,
                "connectedAt": datetime.now(),
                "userAgent": clientInfo.get("userAgent", "Unknown") if clientInfo else "Unknown",
                "lastActivity": datetime.now()
            }
            
            self.logger.info(f"Client connected: {clientId} (Total: {len(self.activeConnections)})")
            
            # Enviar mensagem de boas-vindas
            await self._sendToClient(websocket, {
                "type": "connection.established",
                "clientId": clientId,
                "serverTime": datetime.now().isoformat(),
                "availableSignals": ["cardiac", "eeg"],
                "updateInterval": self.updateInterval
            })
            
            # Emitir evento de conexão
            await eventManager.emit("client.connected", {
                "clientId": clientId,
                "timestamp": datetime.now().isoformat(),
                "totalConnections": len(self.activeConnections),
                "userAgent": self.connectionData[websocket]["userAgent"]
            })

            if len(self.activeConnections) == 1:
                await self._startHeartbeat()
            
            return clientId
            
        except Exception as e:
            self.logger.error(f"Error connecting client: {e}")
            raise
    
    async def disconnect(self, websocket: WebSocket, reason: str = "normal_close"):
        """Desconecta cliente WebSocket"""
        try:
            if websocket in self.activeConnections:
                # Obter dados do cliente
                clientData = self.connectionData.get(websocket, {})
                clientId = clientData.get("clientId", "unknown")
                
                # Remover da lista
                self.activeConnections.remove(websocket)
                del self.connectionData[websocket]
                
                self.logger.info(f"Client disconnected: {clientId} - {reason} (Remaining: {len(self.activeConnections)})")
                
                # Emitir evento de desconexão
                await eventManager.emit("client.disconnected", {
                    "clientId": clientId,
                    "timestamp": datetime.now().isoformat(),
                    "totalConnections": len(self.activeConnections),
                    "reason": reason,
                    "sessionDuration": (datetime.now() - clientData.get("connectedAt", datetime.now())).total_seconds()
                })

                if len(self.activeConnections) == 0:
                    await self._stopHeartbeat()
                
        except Exception as e:
            self.logger.error(f"Error disconnecting client: {e}")

    async def _startHeartbeat(self):
        """Inicia heartbeat autónomo"""
        if self.heartbeatTask and not self.heartbeatTask.done():
            return  # Já está a correr
        
        self.heartbeatTask = asyncio.create_task(self._heartbeatLoop())
        self.logger.info("System heartbeat started (10s interval)")
    
    async def _stopHeartbeat(self):
        """Para heartbeat"""
        if self.heartbeatTask and not self.heartbeatTask.done():
            self.heartbeatTask.cancel()
            try:
                await self.heartbeatTask
            except asyncio.CancelledError:
                pass
        
        self.logger.info("System heartbeat stopped")
    
    async def _heartbeatLoop(self):
        """Loop de heartbeat"""
        while len(self.activeConnections) > 0:
            try:
                await self.sendSystemHeartbeat()
                await asyncio.sleep(self.heartbeatInterval)
                
            except asyncio.CancelledError:
                break
                
            except Exception as e:
                self.logger.error(f"Error in heartbeat loop: {e}")
                await asyncio.sleep(self.heartbeatInterval)
            
    async def sendSystemHeartbeat(self):
        """Mandar overall system health"""
        try:
            # Status dos sinais 
            systemHealth = signalManager.getSystemHealth()
            allSignalsStatus = signalManager.getAllSignalsStatus()

            # Detectar fonte de dados dinamicamente
            dataSource = "real_sensors" if settings.useRealSensors else "mock_data"
            
            # Status específico por fonte
            if settings.useRealSensors:
                # Dados reais - usar ZeroMQListener
                from ..services.zeroMQListener import zeroMQListener
                sourceStatus = zeroMQListener.getStatus()
                sourceUptime = zeroMQListener._getUptime()
                sourceCounters = sourceStatus["stats"]
            else:
                # Dados mock - usar DataStreamer
                from .dataStreamer import dataStreamer
                sourceStatus = dataStreamer.getStatus()
                sourceUptime = sourceStatus["uptime"]
                sourceCounters = sourceStatus["counters"]
            
            # Status geral do sistema
            message = {
                "type": "system.heartbeat",
                "timestamp": datetime.now().isoformat(),
                
                # Estado geral
                "systemHealth": systemHealth,
                "signalStatuses": allSignalsStatus,
                
                # Fonte de dados
                "dataSource": dataSource,
                "sourceStatus": sourceStatus["state"] if settings.useRealSensors else sourceStatus["state"],
                "sourceUptime": sourceUptime,
                "activeSignals": list(signalManager.signals.keys()),
                "counters": sourceCounters,
                
                # WebSocket info
                "activeConnections": len(self.activeConnections),
                "maxConnections": self.maxConnections,
                
                # Server info
                "debugMode": settings.debugMode
            }
            
            await self.broadcast(message)
            
        except Exception as e:
            self.logger.error(f"Error sending system heartbeat: {e}")
    
    async def onSignalProcessed(self, event):
        """Reage a dados de sinais processados"""
        data = event.data
        
        # Criar mensagem para frontend
        message = {
            "type": "signal.update",
            "signalType": data["signalType"],
            "dataType": data["dataType"],
            "timestamp": data["timestamp"],
            "value": data["value"],
            "anomalies": data.get("anomalies", [])
        }
        
        # Enviar para todos os clientes
        await self.broadcast(message)
        
        self.logger.debug(f"Broadcasted signal update: {data['signalType']}.{data['dataType']}")
    
    async def onAnomalyDetected(self, event):
        """Reage a anomalias detectadas"""
        data = event.data
        
        message = {
            "type": "anomaly.alert",
            "signalType": data["signalType"],
            "anomalyType": data["anomalyType"],
            "severity": data["severity"],
            "message": data["message"],
            "timestamp": data["timestamp"],
            "value": data.get("value"),
            "threshold": data.get("threshold")
        }
        
        await self.broadcast(message)
        
        self.logger.warning(f"Broadcasted anomaly alert: {data['signalType']} - {data['message']}")

    async def onZmqConnected(self, event):
        """ZeroMQ conectou"""
        await self.broadcast({
            "type": "zmq.connected",
            "timestamp": event.data["timestamp"],
            "socketUrl": event.data["socketUrl"]
        })

    async def onZmqError(self, event):
        """Erro ZeroMQ"""
        await self.broadcast({
            "type": "zmq.error",
            "timestamp": event.data["timestamp"],
            "errorType": event.data["errorType"],
            "message": event.data["message"]
        })

    async def onZmqWarning(self, event):
        """Aviso ZeroMQ"""
        await self.broadcast({
            "type": "zmq.warning",
            "timestamp": event.data["timestamp"],
            "warningType": event.data["warningType"],
            "message": event.data["message"]
        })

    async def onZmqHeartbeat(self, event):
        """Heartbeat ZeroMQ"""
        await self.broadcast({
            "type": "zmq.heartbeat",
            "timestamp": event.data["timestamp"],
            "state": event.data["state"],
            "stats": event.data["stats"]
        })
        
    
    async def broadcast(self, message: Dict[str, Any]):
        """Envia mensagem para todos os clientes conectados"""
        if not self.activeConnections:
            return
        
        # Lista de conexões a remover (se falharem)
        deadConnections = []
        
        # Enviar para cada cliente em paralelo
        tasks = []
        for websocket in self.activeConnections:
            tasks.append(self._sendToClient(websocket, message, deadConnections))
        
        # Executar todos os envios em paralelo
        await asyncio.gather(*tasks, return_exceptions=True)
        
        # Remover conexões mortas
        for websocket in deadConnections:
            await self.disconnect(websocket, "connection_failed")
    
    async def _sendToClient(self, websocket: WebSocket, message: Dict[str, Any], 
                           deadConnections: list = None):
        """Envia mensagem para um cliente específico"""
        try:
            await websocket.send_json(message)
            
            # Atualizar última atividade
            if websocket in self.connectionData:
                self.connectionData[websocket]["lastActivity"] = datetime.now()
                
        except Exception as e:
            self.logger.warning(f"Failed to send message to client: {e}")
            if deadConnections is not None:
                deadConnections.append(websocket)
    
    
    def _getUptime(self) -> float:
        """Calcula uptime do sistema em segundos"""
        #TODO 
        return 0.0
    
    async def sendSignalStatus(self, signalType: str):
        """Envia status detalhado de um sinal específico"""
        from ..services.signalManager import signalManager
        
        try:
            status = signalManager.getSignalStatus(signalType)
            
            if status:
                message = {
                    "type": "signal.status",
                    "signalType": signalType,
                    "timestamp": datetime.now().isoformat(),
                    "status": status
                }
                
                await self.broadcast(message)
            
        except Exception as e:
            self.logger.error(f"Error sending signal status for {signalType}: {e}")
    
    def getConnectionStats(self) -> Dict[str, Any]:
        """Retorna estatísticas das conexões"""
        return {
            "activeConnections": len(self.activeConnections),
            "maxConnections": self.maxConnections,
            "totalConnectionsEver": self.connectionCounter,
            "connectionData": [
                {
                    "clientId": data["clientId"],
                    "connectedAt": data["connectedAt"].isoformat(),
                    "userAgent": data["userAgent"],
                    "lastActivity": data["lastActivity"].isoformat()
                }
                for data in self.connectionData.values()
            ]
        }
    
    async def cleanup(self):
        """Limpa recursos e fecha todas as conexões"""
        self.logger.info("Cleaning up WebSocket connections...")
        
        # Parar heartbeat
        await self._stopHeartbeat()
        
        # Fechar todas as conexões
        for websocket in list(self.activeConnections):
            try:
                await websocket.close(code=1001, reason="Server shutdown")  
            except Exception:
                pass
        
        self.activeConnections.clear()
        self.connectionData.clear()
        
        self.logger.info("WebSocket cleanup completed")

# Instância global
websocketManager = WebSocketManager()