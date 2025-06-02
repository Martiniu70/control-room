"""
Main Application - FastAPI com WebSocket integrado

Resumo:
Aplicação principal que junta tudo: FastAPI server, WebSocket endpoints, streaming
contínuo de dados, e API REST. Configura CORS para frontend, inclui todos os routers,
e inicia automaticamente o DataStreamer para simular dados. Também inclui endpoints
de controlo para pausar/retomar streaming e ajustar frequências. É o "maestro"
que coordena toda a orquestra do sistema.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core import settings
from app.ws.webSocketRouter import router as websocket_router
from app.ws.webSocketManager import websocketManager
from app.ws.dataStreamer import dataStreamer
from app.services.signalManager import signalManager
from app.services.zeroMQListener import zeroMQListener
from tests.mockData import CardiacMockGenerator
from tests.mockData import EEGMockGenerator

# Configurar logging
logging.basicConfig(
    level=getattr(logging, settings.logLevel),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Gere ciclo de vida da aplicação"""
    # Startup
    logger.info("Starting Control Room Backend...")
    
    try:
        if settings.useRealSensors:
            # Usar dados reais
            logger.info("Starting ZeroMQ listener for real sensor data...")
            await zeroMQListener.start()
            logger.info("ZeroMQ listener started")
        else:
            # Modo desenvolvimento - usar mock data
            logger.info("Starting DataStreamer for mock sensor data...")
            await dataStreamer.start()
            logger.info("DataStreamer started")
        
        yield  # Aplicação roda aqui
        
    finally:
        # Shutdown
        logger.info("Shutting down Control Room Backend...")
        
        try:
            if settings.useRealSensors:
                await zeroMQListener.stop()
                logger.info("ZeroMQ listener stopped")
            else:
                await dataStreamer.stop()
                logger.info("DataStreamer stopped")
            
            # Limpar WebSocket connections
            await websocketManager.cleanup()
            logger.info("WebSocket connections cleaned up")
            
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")

# Criar aplicação FastAPI
app = FastAPI(
    title="Control Room - Automotive Simulator",
    description="Backend para simulador de condução",
    version=settings.version,
    lifespan=lifespan
)

# Configurar CORS para frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.corsOrigins,  # ["http://localhost:3000"]
    allow_credentials=True,              # Permitir cookies / auth
    allow_methods=["*"],                 # POST , GET etc..
    allow_headers=["*"],                 # Content-Type, Authorization
)

# Incluir routers WebSocket
app.include_router(websocket_router, prefix="/api", tags=["websocket"])

# Endpoints REST básicos
@app.get("/")
async def root():
    """Endpoint raiz - informação básica"""
    return {
        "name": settings.projectName,
        "version": settings.version,
        "status": "running",
        "timestamp": datetime.now().isoformat(),
        "websocket_url": "/ws",
        "docs_url": "/docs"
    }

@app.get("/api/status")
async def get_system_status():
    """Status completo do sistema"""
    try:
        # Status de todos os componentes
        system_status = {
            "timestamp": datetime.now().isoformat(),
            "server": {
                "name": settings.projectName,
                "version": settings.version,
                "debug_mode": settings.debugMode
            },
            "signals": signalManager.getAllSignalsStatus(),
            "system_health": signalManager.getSystemHealth(),
            "streaming": dataStreamer.getStatus(),
            "websocket": {
                "endpoint": "/ws",
                "active_connections": len(getattr(app.state, 'websocket_connections', [])) #TODO fix
            }
        }
        
        return JSONResponse(content=system_status)
        
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )

@app.get("/api/signals/{signal_type}/status")
async def get_signal_status(signal_type: str):
    """Status de um sinal específico"""
    try:
        status = signalManager.getSignalStatus(signal_type)
        
        if status is None:
            return JSONResponse(
                status_code=404,
                content={"error": f"Signal type '{signal_type}' not found"}
            )
        
        return JSONResponse(content={
            "signal_type": signal_type,
            "timestamp": datetime.now().isoformat(),
            "status": status
        })
        
    except Exception as e:
        logger.error(f"Error getting status for {signal_type}: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )

# Endpoints de controlo do streaming
@app.post("/api/streaming/start") #TODO Testar adicionando botão POST request no frontend
async def start_streaming():
    """Inicia streaming de dados"""
    try:
        await dataStreamer.start()
        return {"status": "started", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        logger.error(f"Error starting streaming: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.post("/api/streaming/stop")
async def stop_streaming(): #TODO Testar adicionando botão POST request no frontend
    """Para streaming de dados"""
    try:
        logger.info(f"Client is trying to stop streaming")
        await dataStreamer.stop()
        return {"status": "stopped", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        logger.error(f"Error stopping streaming: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.post("/api/streaming/pause") #TODO Testar adicionando botão POST request no frontend
async def pause_streaming():
    """Pausa streaming de dados"""
    try:
        await dataStreamer.pause()
        return {"status": "paused", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        logger.error(f"Error pausing streaming: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.post("/api/streaming/resume")
async def resume_streaming(): #TODO Testar adicionando botão POST request no frontend
    """Retoma streaming de dados"""
    try:
        await dataStreamer.resume()
        return {"status": "resumed", "timestamp": datetime.now().isoformat()}
    except Exception as e:
        logger.error(f"Error resuming streaming: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

@app.get("/api/streaming/status")
async def get_streaming_status(): 
    """Status do streaming"""
    try:
        return JSONResponse(content=dataStreamer.getStatus())
    except Exception as e:
        logger.error(f"Error getting streaming status: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": "Internal server error"}
        )

@app.post("/api/streaming/frequency/{signal_type}") #TODO Testar adicionando parametros no frontend
async def adjust_frequency(signal_type: str, frequency: float):
    """Ajusta frequência de um tipo de sinal"""
    try:
        await dataStreamer.adjustFrequency(signal_type, frequency)
        return {
            "signal_type": signal_type,
            "new_frequency": frequency,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Error adjusting frequency for {signal_type}: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

# Endpoint para injetar anomalias manualmente (desenvolvimento)
@app.post("/api/testing/inject_anomaly") #TODO Testar adicionando parametros no frontend
async def inject_anomaly(signal_type: str, anomaly_type: str):
    """Injeta anomalia manualmente para teste"""
    try:
        if signal_type == "cardiac":
            mock = CardiacMockGenerator()
            anomaly_data = mock.generateAnomalyData(anomaly_type)
        elif signal_type == "eeg":
            mock = EEGMockGenerator()
            anomaly_data = mock.generateAnomalyData(anomaly_type)
        else:
            return JSONResponse(
                status_code=400,
                content={"error": f"Unknown signal type: {signal_type}"}
            )
        
        # Enviar dados anómalos
        await signalManager.processZeroMQData({
            "timestamp": datetime.now().timestamp(),
            "source": f"manual_anomaly_injection",
            "data": anomaly_data
        })
        
        return {
            "injected": True,
            "signal_type": signal_type,
            "anomaly_type": anomaly_type,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error injecting anomaly: {e}")
        return JSONResponse(
            status_code=500,
            content={"error": str(e)}
        )

if __name__ == "__main__":
    import uvicorn
    
    # Executar servidor
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.debugMode,
        log_level=settings.logLevel.lower()
    )