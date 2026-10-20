"""
OFL Credit Automation Platform - Configuration Module
Supports local development (SQLite) and enterprise Azure cloud deployment (PostgreSQL Flexible Server).
"""
import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    APP_NAME: str = "OFL Credit Automation & Underwriting Platform"
    APP_VERSION: str = "1.1.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    # Database
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
    
    # AI Governance (PRD Section 9, FR-28)
    AI_ENABLED: bool = True
    AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    AZURE_OPENAI_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    AZURE_OPENAI_DEPLOYMENT_NAME: str = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o-mini")
    AI_MAX_TOKENS_PER_CAM: int = 4000
    AI_COST_PER_1K_TOKENS_USD: float = 0.00015
    
    # Storage & Azure Integrations
    AZURE_STORAGE_CONNECTION_STRING: str = os.getenv("AZURE_STORAGE_CONNECTION_STRING", "")
    AZURE_BLOB_CONTAINER: str = os.getenv("AZURE_BLOB_CONTAINER", "credit-documents")
    
    # Third party mock/adapter mode
    MOCK_YOUVERIFY_SANDBOX: bool = True
    MOCK_NAV_INTEGRATION: bool = True
    MOCK_LOANDISC_INTEGRATION: bool = True

    model_config = SettingsConfigDict(case_sensitive=True)

settings = Settings()
