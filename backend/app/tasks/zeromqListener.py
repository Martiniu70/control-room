import asyncio
import zmq
import zmq.asyncio
import json

# Contexto async do ZeroMQ
ctx = zmq.asyncio.Context()

# Último pacote recebido (acessível via import) temporario para podermos testar se a data está a ser passada em primeira instância
# Depois vai ser adaptado para receber dados passar os dados para uma função que divide e armazena nas classes correspondentes
latestData: dict = {}

async def zmqPullLoop():
    socket = ctx.socket(zmq.PULL)
    socket.bind("tcp://*:5555")  # ou .connect("tcp://IP:PORT") se fores cliente

    print("ZeroMQ PULL iniciado na porta 5555")

    while True:
        try:
            msg = await socket.recv_string()
            data = json.loads(msg)

            if isinstance(data, dict):
                global latestData
                latestData = data
                print("Data recebida do ZMQ:", data)
        except Exception as e:
            print("Erro no ZMQ:", e)

        await asyncio.sleep(0)
