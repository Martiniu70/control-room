@echo off
echo === 💻 CONTROL ROOM SETUP SCRIPT ===

:: 1. Criar ambiente virtual se não existir
IF NOT EXIST "backend\.venv" (
    echo [1/6] Criar ambiente virtual Python...
    python -m venv backend\.venv
)

:: 2. Instalar dependências do backend (chamando pip diretamente do venv)
echo [2/6] Instalar requirements.txt...
:: Chamando pip diretamente do ambiente virtual para evitar problemas de ambiente
"backend\.venv\Scripts\pip" install -r "backend\requirements.txt"

:: 3. Voltar à raiz do projeto
echo [3/6] A voltar à raiz do projeto...
cd /d "%~dp0"

:: 4. Instalar dependências do frontend (se node_modules não existir)
IF NOT EXIST "frontend\node_modules" (
    echo [4/6] Instalar dependências do frontend (React + Vite)...
    cd frontend
    npm install --legacy-peer-deps
    
    :: Instalar three.js e suas definições de tipo
    echo [5/6] Instalar three.js e @types/three...
    npm install three
    npm install --save-dev @types/three
    
    cd ..
) ELSE (
    echo [4/6] Dependências do frontend já instaladas.
    echo [5/6] three.js e @types/three já instalados (verificar manualmente se necessário).
)

:: 6. Fim
echo.
echo === ✅ SETUP COMPLETO! ===
echo.
echo Agora podes abrir dois terminais:
echo ------------------------------------
echo [Backend] Ativa o ambiente virtual:
echo     CALL backend\.venv\Scripts\activate
echo     uvicorn app.main:app --reload
echo.
echo [Frontend] Inicia com:
echo     cd frontend
echo     npm run dev
echo ------------------------------------
pause
