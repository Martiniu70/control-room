from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import simulator as simulator_routes
from app.tasks.generatorLoop import startGeneratorLoop
from app.tasks.zeromqListener import zmqPullLoop
from contextlib import asynccontextmanager
import asyncio

reactAddress = "http://localhost:3000"

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Data generator loop
    asyncio.create_task(startGeneratorLoop())
    asyncio.create_task(zmqPullLoop())
    yield

# App creation
app = FastAPI(
    title="Control Room Backend",
    description="API para comunicação com simulador e sensores",
    version="1.0.0",
    lifespan=lifespan
)

# Middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[reactAddress],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(simulator_routes.router)

# Status endpoint 
@app.get("/status")
def read_status():
    return {
        "status": "online",
        "message": "Backend da Control Room ."
    }
