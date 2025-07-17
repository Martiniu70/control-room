@echo off
echo ================================================
echo       Control Room - Automotive Simulator
echo ================================================

echo.
echo Choose an option:
echo.
echo   1. Start Backend (main application)
echo   2. Start Frontend (React)
echo   3. Start Backend + Frontend
echo.

set /p choice=Enter choice (1-3): 

if "%choice%"=="1" goto backend
if "%choice%"=="2" goto frontend  
if "%choice%"=="3" goto backend_frontend
goto invalid

:backend
echo Starting Backend...
cd backend
call .venv\Scripts\activate
python main.py
goto end

:frontend
echo Starting Frontend...
cd frontend
npm run dev
goto end

:backend_frontend
echo Starting Backend...
start "Backend" cmd /k "cd backend && .venv\Scripts\activate && python main.py"

timeout /t 3 /nobreak >nul

echo Starting Frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"
goto end

:invalid
echo Invalid choice. Please run again and choose 1-3.
pause
goto end

:end
echo.
echo Done!
pause