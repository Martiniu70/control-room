import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services import simulator

router = APIRouter()

@router.websocket("/ws/simulator/latest")
async def websocket_simulator(websocket: WebSocket):
    await websocket.accept()
    print("[WebSocket] Cliente conectado.")
    try:
        while True:
            latest = simulator.get_latest_data()
            print("[WebSocket] Dados enviados:", latest)
            await websocket.send_json(latest)
            await asyncio.sleep(1)  # envia de 1 em 1 segundo
    except WebSocketDisconnect:
        print("[WebSocket] Cliente desconectado.")
