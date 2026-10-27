"""
Google Cloud Storage (GCS) Document Repository Service
Handles cryptographic document verification (SHA-256), private case document storage,
and time-limited signed URL generation for underwriters and auditors (PRD FR-03, Section 7).
"""
import os
import hashlib
import logging
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta, timezone
from ..config import settings

logger = logging.getLogger("ofl.gcp.storage")

class GoogleCloudStorageService:
    _client = None
    _bucket = None
    _init_attempted = False
    
    LOCAL_STORAGE_DIR = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
        "storage", 
        "gcs_emulator"
    )

    @classmethod
    def _get_client_and_bucket(cls):
        if not cls._init_attempted:
            cls._init_attempted = True
            if not settings.GCS_LOCAL_EMULATOR:
                try:
                    from google.cloud import storage
                    cls._client = storage.Client(project=settings.GCP_PROJECT_ID)
                    cls._bucket = cls._client.bucket(settings.GCS_BUCKET_NAME)
                    logger.info(f"Connected to Google Cloud Storage bucket: {settings.GCS_BUCKET_NAME}")
                except Exception as e:
                    logger.warning(
                        f"GCS client connection failed: {e}. Defaulting to local storage emulator at {cls.LOCAL_STORAGE_DIR}."
                    )
                    cls._client = None
                    cls._bucket = None
            else:
                os.makedirs(cls.LOCAL_STORAGE_DIR, exist_ok=True)
                logger.info(f"Using local GCS emulator directory: {cls.LOCAL_STORAGE_DIR}")
        return cls._client, cls._bucket

    @classmethod
    def compute_sha256(cls, file_bytes: bytes) -> str:
        """
        Calculates SHA-256 hash for document integrity validation.
        """
        hasher = hashlib.sha256()
        hasher.update(file_bytes)
        return hasher.hexdigest()

    @classmethod
    def upload_document(
        cls,
        case_id: str,
        document_type: str,
        filename: str,
        content_bytes: bytes,
        content_type: str = "application/pdf"
    ) -> Dict[str, Any]:
        """
        Uploads document to GCS bucket (or emulator) under:
        cases/{case_id}/{document_type}/{filename}
        Returns checksum, blob path, storage URI, and upload metadata.
        """
        checksum = cls.compute_sha256(content_bytes)
        blob_path = f"cases/{case_id}/{document_type}/{filename}"
        client, bucket = cls._get_client_and_bucket()

        if bucket is not None:
            try:
                blob = bucket.blob(blob_path)
                blob.metadata = {
                    "case_id": case_id,
                    "document_type": document_type,
                    "sha256_checksum": checksum,
                    "uploaded_at": datetime.now(timezone.utc).isoformat()
                }
                blob.upload_from_string(content_bytes, content_type=content_type)
                gcs_uri = f"gs://{settings.GCS_BUCKET_NAME}/{blob_path}"
                logger.info(f"Uploaded {filename} to GCS: {gcs_uri} (SHA256: {checksum[:8]}...)")
                return {
                    "blob_path": blob_path,
                    "storage_uri": gcs_uri,
                    "checksum": checksum,
                    "size_bytes": len(content_bytes),
                    "storage_backend": "GOOGLE_CLOUD_STORAGE"
                }
            except Exception as e:
                logger.error(f"Error uploading to live GCS: {e}. Storing in local emulator.")

        # Local emulator fallback
        local_target = os.path.join(cls.LOCAL_STORAGE_DIR, blob_path.replace("/", os.sep))
        os.makedirs(os.path.dirname(local_target), exist_ok=True)
        with open(local_target, "wb") as f:
            f.write(content_bytes)

        return {
            "blob_path": blob_path,
            "storage_uri": f"gs://{settings.GCS_BUCKET_NAME}/{blob_path} [EMULATED]",
            "checksum": checksum,
            "size_bytes": len(content_bytes),
            "storage_backend": "GCS_LOCAL_EMULATOR"
        }

    @classmethod
    def generate_signed_read_url(
        cls, 
        blob_path: str, 
        expiration_minutes: int = 60
    ) -> str:
        """
        Generates a time-limited signed URL for private document inspection.
        """
        client, bucket = cls._get_client_and_bucket()
        if bucket is not None:
            try:
                blob = bucket.blob(blob_path)
                url = blob.generate_signed_url(
                    version="v4",
                    expiration=timedelta(minutes=expiration_minutes),
                    method="GET"
                )
                return url
            except Exception as e:
                logger.warning(f"Could not generate live GCS signed URL: {e}")

        # Local emulator simulated view path
        return f"/api/v1/storage/documents/view?path={blob_path}"

    @classmethod
    def get_storage_telemetry(cls) -> Dict[str, Any]:
        """
        Returns summary telemetry for GCS storage consumption.
        """
        client, bucket = cls._get_client_and_bucket()
        is_live = bucket is not None
        
        return {
            "bucket_name": settings.GCS_BUCKET_NAME,
            "project_id": settings.GCP_PROJECT_ID,
            "location": settings.GCP_LOCATION,
            "storage_mode": "GCS_LIVE_BUCKET" if is_live else "GCS_LOCAL_EMULATOR",
            "encryption": "Google-managed encryption keys (CMEK-ready)",
            "retention_policy": "Opticom 7-Year Prudential Compliance Retention"
        }
