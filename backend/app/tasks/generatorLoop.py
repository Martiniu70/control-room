import asyncio
from app.services import simulator

async def startGeneratorLoop():
    while True:
        simulator.generateAll()
        await asyncio.sleep(1) 
