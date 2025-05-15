@echo off
echo === 💻 CONTROL ROOM SETUP SCRIPT ===

:: 1. Criar ambiente virtual se não existir
IF NOT EXIST "backend\.venv" (
    echo [1/6] Criar ambiente virtual Python...
    python -m venv backend\.venv
)

:: 2. Ativar ambiente virtual
echo [2/6] Ativar ambiente virtual...
CALL backend\.venv\Scripts\activate

:: 3. Instalar dependências do backend
echo [3/6] Instalar requirements.txt...
pip install -r backend\requirements.txt

:: 4. Voltar à raiz do projeto
cd /d %~dp0

:: 5. Instalar dependências do frontend (se node_modules não existir)
IF NOT EXIST "frontend\node_modules" (
    echo [4/6] Instalar dependências do frontend (React)...
    cd frontend
    npm install
    cd ..
) ELSE (
    echo [4/6] Dependências do frontend já instaladas.
)

:: 6. Fim
echo === ✅ SETUP COMPLETO! ===
echo.
echo Agora podes abrir dois terminais:
echo - Backend: ativar .venv e correr `uvicorn app.main:app --reload`
echo - Frontend: ir a `frontend/` e correr `npm start`
pause
