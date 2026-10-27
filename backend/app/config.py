"""
OFL Credit Automation Platform - Configuration Module
Supports local development (SQLite / GCS Emulator) and Google Cloud Platform (Cloud SQL, Cloud Run, Vertex AI, GCS, Secret Manager, Cloud Logging).
"""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "OFL Credit Automation & Underwriting Platform"
    APP_VERSION: str = "1.2.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    CLOUD_PROVIDER: str = "GCP"
    
    # Database (Cloud SQL PostgreSQL on GCP in Production; SQLite local dev zero-setup)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", 
        "sqlite:///./ofl.db"
    )
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000"
    ]
    
    # Boundary thresholds (PRD v1.1 Section 17.1)
    BESTO_MIN_AMOUNT: float = 300_000.0
    BESTO_MAX_AMOUNT: float = 2_000_000.0  # Exact 2,000,000 boundary belongs to BESTO
    OFL_DIRECT_MIN_AMOUNT: float = 2_000_000.01
    
    # Approval Authority Thresholds (FR-09)
    THRESHOLD_ANALYST_RECOMMEND_ONLY: float = 2_000_000.0
    THRESHOLD_HRM_APPROVAL_LIMIT: float = 5_000_000.0
    THRESHOLD_BCC_APPROVAL_LIMIT: float = 15_000_000.0
    # MD approval required for > 15,000,000
    
    # Google Cloud Platform (GCP) Configuration
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "opticom-finance-platform")
    GCP_LOCATION: str = os.getenv("GCP_LOCATION", "europe-west1")
    GCP_REGION: str = os.getenv("GCP_REGION", "europe-west1")
    
    # GCP Vertex AI & Gemini AI Underwriter (PRD Section 9, FR-28, FR-29)
    AI_ENABLED: bool = True
    VERTEX_AI_ENABLED: bool = True
    VERTEX_AI_MODEL: str = os.getenv("VERTEX_AI_MODEL", "gemini-1.5-pro")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    AI_MAX_TOKENS_PER_CAM: int = 4000
    AI_COST_PER_1K_TOKENS_USD: float = 0.0003  # Gemini 1.5 Pro benchmark pricing
    
    # Legacy alias for backward compatibility
    AZURE_OPENAI_DEPLOYMENT_NAME: str = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gemini-1.5-pro")
    
    # Google Cloud Storage (GCS) Document Repository
    GCS_BUCKET_NAME: str = os.getenv("GCS_BUCKET_NAME", "ofl-credit-documents")
    GCS_LOCAL_EMULATOR: bool = os.getenv("GCS_LOCAL_EMULATOR", "true").lower() == "true"
    
    # Google Cloud Secret Manager
    GCP_SECRET_MANAGER_ENABLED: bool = os.getenv("GCP_SECRET_MANAGER_ENABLED", "false").lower() == "true"
    
    # Google Cloud Logging
    GCP_CLOUD_LOGGING_ENABLED: bool = os.getenv("GCP_CLOUD_LOGGING_ENABLED", "false").lower() == "true"
    
    # Third party mock/adapter mode
    MOCK_YOUVERIFY_SANDBOX: bool = True
    MOCK_NAV_INTEGRATION: bool = True
    MOCK_LOANDISC_INTEGRATION: bool = True

    model_config = SettingsConfigDict(case_sensitive=True)

settings = Settings()

