"""
OFL Credit Automation & AI-Assisted Underwriting Platform
FastAPI Application Entrypoint
"""
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .config import settings
from .database import engine, Base, SessionLocal
from .api.v1.intake_router import router as intake_router
from .api.v1.cases_router import router as cases_router
from .api.v1.cam_router import router as cam_router
from .api.v1.workflow_router import router as workflow_router
from .api.v1.offer_router import router as offer_router
from .api.v1.treasury_router import router as treasury_router
from .api.v1.exceptions_router import router as exceptions_router
from .api.v1.telemetry_router import router as telemetry_router
from .api.v1.audit_router import router as audit_router
from .api.v1.auth_router import router as auth_router
from .api.v1.jobs_router import router as jobs_router
from .api.v1.admin_router import router as admin_router
from .api.v1.copilot_router import router as copilot_router
from .core.config_manager import ConfigManager

def seed_initial_demo_data():
    """
    Seeds initial realistic demonstration cases for UAT walkthrough.
    """
    if settings.ENVIRONMENT.lower() == "production":
        return

    db = SessionLocal()
    ConfigManager.seed_defaults_if_needed(db)
    from .models import CreditCase
    seed_demo = None
    try:
        from scripts.seed_executive_demo import seed_demo
    except Exception:
        try:
            import sys, os
            sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
            from scripts.seed_executive_demo import seed_demo
        except Exception:
            seed_demo = None
    
    if seed_demo and db.query(CreditCase).count() == 0:
        seed_demo(db_session=db)
    db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    Base.metadata.create_all(bind=engine)
    seed_initial_demo_data()
    yield

is_production = settings.ENVIRONMENT.lower() == "production"

# In production, documentation and OpenAPI schemas are disabled to eliminate endpoint reconnaissance
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="GCP-hosted, human-controlled credit origination and Google Cloud Vertex AI (Gemini) underwriting platform for Opticom Finance House.",
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
    lifespan=lifespan
)

# CORS Middleware: Enforce whitelist in production; permit wildcard in dev
cors_origins = settings.CORS_ORIGINS if is_production else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Security Response Headers Middleware (OWASP Banking Hardening)
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    return response

# Register API Routers
app.include_router(intake_router, prefix="/api/v1")
app.include_router(cases_router, prefix="/api/v1")
app.include_router(cam_router, prefix="/api/v1")
app.include_router(workflow_router, prefix="/api/v1")
app.include_router(offer_router, prefix="/api/v1")
app.include_router(treasury_router, prefix="/api/v1")
app.include_router(exceptions_router, prefix="/api/v1")
app.include_router(telemetry_router, prefix="/api/v1")
app.include_router(audit_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(jobs_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(copilot_router, prefix="/api/v1")

@app.get("/health")
@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT
    }

# ==============================================================================
# Production Static SPA Mounting (Google Cloud Run Multi-stage Container)
# ==============================================================================
frontend_dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend_dist"))
if not os.path.exists(frontend_dist_dir):
    frontend_dist_dir = os.path.abspath("frontend_dist")

if os.path.exists(frontend_dist_dir):
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse

    assets_dir = os.path.join(frontend_dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="static_assets")

    @app.get("/{full_path:path}")
    async def serve_spa_app(full_path: str):
        # Allow API and Swagger routes to pass through
        if full_path.startswith(("api/", "docs", "redoc", "openapi.json", "health")):
            raise HTTPException(status_code=404, detail="API route not found")
        
        target_file = os.path.join(frontend_dist_dir, full_path)
        if os.path.isfile(target_file):
            return FileResponse(target_file)
        
        index_file = os.path.join(frontend_dist_dir, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        return {"platform": settings.APP_NAME, "status": "frontend_dist missing index.html"}
else:
    @app.get("/")
    def root():
        return {
            "platform": settings.APP_NAME,
            "client": "Opticom Finance House",
            "vendor": "CyberCapSec Limited",
            "documentation": "/docs",
            "api_v1": "/api/v1"
        }
