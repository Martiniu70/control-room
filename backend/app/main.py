from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# Instância do FastAPI
app = FastAPI(
    title="Control Room Backend",
    description="API para comunicação com simulador e sensores",
    version="1.0.0"
)

# Obter origem do react
reactAddress = "http://localhost:3000" 

# CORS: permite que o frontend aceda ao backend
app.add_middleware(
    CORSMiddleware,
    allow_origins = [reactAddress],  # Permitir pedidos desta origem
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Endpoint REST para verificar se o backend está online
@app.get("/status")
def read_status():
    """
    Endpoint para verificar se o backend está online.
    """
    return {"status": "online", "message": "Backend da Control Room ."}
