@echo off
setlocal

title Petodo Launcher
cd /d "%~dp0"

echo.
echo ==============================
echo   Petodo frontend + backend
echo ==============================
echo.

if not exist "backend\main.py" (
  echo [ERROR] backend\main.py was not found. Run this file from the petodo-pet-app folder.
  pause
  exit /b 1
)

if not exist "frontend\package.json" (
  echo [ERROR] frontend\package.json was not found. Run this file from the petodo-pet-app folder.
  pause
  exit /b 1
)

set "PYTHON_CMD="

where py >nul 2>nul
if not errorlevel 1 (
  py -3 --version >nul 2>nul
)
if not errorlevel 1 (
  set "PYTHON_CMD=py -3"
)

if not defined PYTHON_CMD (
  where python >nul 2>nul
  if not errorlevel 1 (
    python --version >nul 2>nul
  )
  if not errorlevel 1 (
    set "PYTHON_CMD=python"
  )
)

if not defined PYTHON_CMD (
  echo [ERROR] Python 3 was not found. Please install Python 3 first.
  pause
  exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Please install Node.js first.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm was not found. Please reinstall Node.js.
  pause
  exit /b 1
)

if not exist "backend\.venv\Scripts\python.exe" (
  echo [1/4] Creating backend environment...
  %PYTHON_CMD% -m venv "backend\.venv"
  if errorlevel 1 (
    echo [ERROR] Backend environment creation failed.
    pause
    exit /b 1
  )
) else (
  echo [1/4] Backend environment already exists.
)

echo [2/4] Checking backend packages...
"backend\.venv\Scripts\python.exe" -m pip install --disable-pip-version-check -r "backend\requirements.txt"
if errorlevel 1 (
  echo [ERROR] Backend package installation failed.
  pause
  exit /b 1
)

if not exist "frontend\node_modules" (
  echo [3/4] Installing frontend packages...
  pushd "frontend"
  call npm install
  if errorlevel 1 (
    popd
    echo [ERROR] Frontend package installation failed.
    pause
    exit /b 1
  )
  popd
) else (
  echo [3/4] Frontend packages already exist.
)

echo [4/4] Starting Petodo...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:8000/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  start "Petodo Backend" /D "%~dp0backend" cmd /k ".venv\Scripts\python.exe -m uvicorn main:app --reload"
  ping 127.0.0.1 -n 3 >nul
) else (
  echo Backend is already running.
)
start "Petodo Frontend" /D "%~dp0frontend" cmd /k "npm start"

echo.
echo Petodo has been started.
echo To fully stop it, close the two new windows.
echo.
pause
