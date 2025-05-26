import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services import simulator
from app.tasks.zeromqListener import latestData #Importar a variavel que 

router = APIRouter()

@router.websocket("/ws/simulator/latest")
async def websocketSimulator(websocket: WebSocket):
    await websocket.accept()
    print("[WebSocket] Cliente conectado.")
    try:
        while True:
            latest = simulator.getLatestData()
            print("[WebSocket] Dados enviados:", latest)
            #print("[WebSocket] Dados enviados vindos do zeroMQ: ", latestData)
            await websocket.send_json(latest)
            await asyncio.sleep(1)  # envia de 1 em 1 segundo
    except WebSocketDisconnect:
        print("[WebSocket] Cliente desconectado.")
