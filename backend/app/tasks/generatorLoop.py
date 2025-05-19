import asyncio
from app.services import simulator

async def start_generator_loop():
    while True:
        simulator.generate_all()
        await asyncio.sleep(1) 
