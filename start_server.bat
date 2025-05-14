@echo off
echo Ativando o ambiente virtual...

cd backend

call .venv\Scripts\activate

echo Ambiente virtual ativado.
echo Iniciando servidor FastAPI...

uvicorn app.main:app --reload

pause
