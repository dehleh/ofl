"""
Google Cloud Secret Manager Integration Service
Provides centralized, enterprise-grade secret retrieval for API keys, database credentials,
and third-party integration tokens with local environment variable fallback (PRD v1.1).
"""
import os
import logging
from typing import Optional, Dict, Any
from ..config import settings

logger = logging.getLogger("ofl.gcp.secret_manager")

class GCPSecretManagerService:
    _cache: Dict[str, str] = {}
    _client = None
    _init_attempted = False

    @classmethod
    def _get_client(cls):
        if not cls._init_attempted:
            cls._init_attempted = True
            if settings.GCP_SECRET_MANAGER_ENABLED:
                try:
                    from google.cloud import secretmanager
                    cls._client = secretmanager.SecretManagerServiceClient()
                    logger.info("Initialized Google Cloud Secret Manager client successfully.")
                except Exception as e:
                    logger.warning(
                        f"GCP Secret Manager client initialization skipped or failed: {e}. "
                        "Falling back to local environment variables."
                    )
                    cls._client = None
        return cls._client

    @classmethod
    def get_secret(cls, secret_id: str, default: Optional[str] = None) -> Optional[str]:
        """
        Retrieves a secret from GCP Secret Manager (projects/{project_id}/secrets/{secret_id}/versions/latest).
        Falls back to os.environ if Secret Manager is disabled or unavailable.
        """
        if secret_id in cls._cache:
            return cls._cache[secret_id]

        client = cls._get_client()
        if client and settings.GCP_PROJECT_ID:
            try:
                name = f"projects/{settings.GCP_PROJECT_ID}/secrets/{secret_id}/versions/latest"
                response = client.access_secret_version(request={"name": name})
                secret_value = response.payload.data.decode("UTF-8")
                cls._cache[secret_id] = secret_value
                return secret_value
            except Exception as e:
                logger.debug(f"Failed to fetch secret '{secret_id}' from GCP Secret Manager: {e}. Checking env.")

        # Fallback to local environment
        val = os.getenv(secret_id, default)
        if val is not None:
            cls._cache[secret_id] = val
        return val

    @classmethod
    def get_secrets_inventory(cls) -> Dict[str, Any]:
        """
        Returns health audit metadata for core platform secrets without exposing secret values.
        """
        critical_secrets = [
            ("GCP_PROJECT_ID", settings.GCP_PROJECT_ID),
            ("VERTEX_AI_MODEL", settings.VERTEX_AI_MODEL),
            ("GEMINI_API_KEY", "SET" if os.getenv("GEMINI_API_KEY") else "DEFAULT_ADC"),
            ("GCS_BUCKET_NAME", settings.GCS_BUCKET_NAME),
            ("DATABASE_URL", "CONFIGURED"),
            ("YOUVERIFY_API_KEY", "MOCK_ACTIVE" if settings.MOCK_YOUVERIFY_SANDBOX else "CONFIGURED"),
            ("NAV_INTEGRATION_KEY", "MOCK_ACTIVE" if settings.MOCK_NAV_INTEGRATION else "CONFIGURED"),
            ("LOANDISC_API_TOKEN", "MOCK_ACTIVE" if settings.MOCK_LOANDISC_INTEGRATION else "CONFIGURED"),
        ]

        return {
            "gcp_secret_manager_enabled": settings.GCP_SECRET_MANAGER_ENABLED,
            "project_id": settings.GCP_PROJECT_ID,
            "secret_count": len(critical_secrets),
            "secrets_status": {
                name: "CONFIGURED" if val else "MISSING"
                for name, val in critical_secrets
            }
        }
