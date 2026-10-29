"""
Development launcher for OFL Credit Automation Platform.
Runs FastAPI backend on port 8000 and Vite frontend on port 5173.
"""
import subprocess
import sys
import time
import os

def main():
    root_dir = os.path.dirname(os.path.abspath(__file__))
    venv_python = os.path.join(root_dir, "venv", "Scripts", "python.exe")
    frontend_dir = os.path.join(root_dir, "frontend")

    print("=================================================================")
    print("  OPTICOM FINANCE HOUSE | OFL Credit Automation Platform (v1.1)  ")
    print("=================================================================")
    print("Starting Backend API (FastAPI) on http://127.0.0.1:8000 ...")
    
    backend_proc = subprocess.Popen(
        [venv_python, "-m", "uvicorn", "backend.app.main:app", "--port", "8000", "--reload"],
        cwd=root_dir
    )

    print("Starting Frontend Portal (Vite) on http://localhost:5173 ...")
    npm_cmd = "npm.cmd" if sys.platform == "win32" else "npm"
    frontend_proc = subprocess.Popen(
        [npm_cmd, "run", "dev"],
        cwd=frontend_dir
    )

    print("\n[OK] Platform running:")
    print("  * Web Portal: http://localhost:5173")
    print("  * API & Swagger Docs: http://127.0.0.1:8000/docs")
    print("  * Health check: http://127.0.0.1:8000/health")
    print("\nPress Ctrl+C to terminate both servers.")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping OFL platform servers...")
        backend_proc.terminate()
        frontend_proc.terminate()
        print("Shutdown complete.")

if __name__ == "__main__":
    main()
