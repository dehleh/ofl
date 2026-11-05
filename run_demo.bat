@echo off
title Opticom Commercial Credit Platform Launcher
echo ====================================================================
echo      OPTICOM FINANCE LIMITED - COMMERCIAL CREDIT PLATFORM
echo               Demonstration & Walkthrough Launcher
echo ====================================================================
echo.
echo [1/2] Starting Python FastAPI Backend on http://127.0.0.1:8000...
start "Opticom Backend (Port 8000)" cmd /k "venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000 --reload"

echo [2/2] Starting React Vite Frontend on http://localhost:5173...
start "Opticom Frontend (Port 5173)" cmd /k "cd frontend && npm run dev"

echo.
echo ====================================================================
echo  DEMO ENVIRONMENT READY:
echo  1. Public Borrower Portal : http://localhost:5173/
echo  2. Internal Staff Cockpit : http://localhost:5173/staff
echo  3. Interactive API Specs  : http://127.0.0.1:8000/docs
echo ====================================================================
echo.
echo Press any key to open the platforms in your default browser...
pause >nul
start http://localhost:5173/
start http://localhost:5173/staff

