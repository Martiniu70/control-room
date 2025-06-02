@echo off
echo ================================================
echo       Control Room - Automotive Simulator
echo ================================================

echo.
echo Choose an option:
echo.
echo   1. Start Backend (main application)
echo   2. Start Frontend (React)
echo   3. Run Tests - Cardiac Only
echo   4. Run Tests - EEG Only
echo   5. Run Tests - ZeroMQ Only
echo   6. Run Tests - All Tests
echo   7. Start Backend + Frontend
echo   8. Start All (Backend + Frontend + Tests)
echo.

set /p choice=Enter choice (1-8): 

if "%choice%"=="1" goto backend
if "%choice%"=="2" goto frontend  
if "%choice%"=="3" goto test_cardiac
if "%choice%"=="4" goto test_eeg
if "%choice%"=="5" goto test_zeromq
if "%choice%"=="6" goto test_all
if "%choice%"=="7" goto backend_frontend
if "%choice%"=="8" goto all
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

:test_cardiac
echo Running Cardiac Tests...
cd backend
call .venv\Scripts\activate
python tests\testCardiac.py
pause
goto end

:test_eeg
echo Running EEG Tests...
cd backend
call .venv\Scripts\activate
python tests\testEeg.py
pause
goto end

:test_zeromq
echo Running ZeroMQ Tests...
cd backend
call .venv\Scripts\activate
python tests\testZeroMQPush.py
pause
goto end

:test_all
echo Running All Tests...
cd backend
call .venv\Scripts\activate
python tests\testAll.py
pause
goto end

:backend_frontend
echo Starting Backend...
start "Backend" cmd /k "cd backend && .venv\Scripts\activate && python main.py"

timeout /t 3 /nobreak >nul

echo Starting Frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"
goto end

:all
echo Starting Backend...
start "Backend" cmd /k "cd backend && .venv\Scripts\activate && python main.py"

timeout /t 2 /nobreak >nul

echo Starting Frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"

timeout /t 2 /nobreak >nul

echo Running Tests...
start "Tests" cmd /k "cd backend && .venv\Scripts\activate && python tests\testAll.py"
goto end

:invalid
echo Invalid choice. Please run again and choose 1-8.
pause
goto end

:end
echo.
echo Done!
pause