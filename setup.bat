@echo off
start "" cmd /k "cd backend && call .venv\Scripts\activate && uvicorn app.main:app --reload"
start "" cmd /k "cd frontend && npm start"
