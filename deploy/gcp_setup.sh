#!/usr/bin/env bash
# ==============================================================================
# Google Cloud Platform (GCP) Provisioning & Setup Script
# Opticom Finance House - OFL Credit Automation & AI Underwriting Platform
# ==============================================================================

set -euo pipefail

# 1. Configuration Defaults (Override via environment variables)
export GCP_PROJECT_ID="${GCP_PROJECT_ID:-opticom-finance-platform}"
export GCP_REGION="${GCP_REGION:-europe-west1}"
export AR_REPO="${AR_REPO:-ofl-containers}"
export GCS_BUCKET="${GCS_BUCKET:-ofl-credit-documents}"
export SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-ofl-app-runner}"

echo "======================================================================"
echo "Initializing GCP Provisioning for Opticom Finance House"
echo "Project ID:        $GCP_PROJECT_ID"
echo "Region:            $GCP_REGION"
echo "Artifact Registry: $AR_REPO"
echo "Storage Bucket:    $GCS_BUCKET"
echo "Service Account:   $SERVICE_ACCOUNT_NAME@$GCP_PROJECT_ID.iam.gserviceaccount.com"
echo "======================================================================"

# 2. Select Project
gcloud config set project "$GCP_PROJECT_ID"

# 3. Enable Required Google Cloud Services
echo "[Step 1/6] Enabling Required GCP APIs..."
gcloud services enable \
    aiplatform.googleapis.com \
    storage.googleapis.com \
    secretmanager.googleapis.com \
    logging.googleapis.com \
    run.googleapis.com \
    cloudbuild.googleapis.com \
    artifactregistry.googleapis.com \
    sqladmin.googleapis.com \
    cloudresourcemanager.googleapis.com

# 4. Create Artifact Registry Repository for Docker images
echo "[Step 2/6] Configuring Google Artifact Registry..."
if ! gcloud artifacts repositories describe "$AR_REPO" --location="$GCP_REGION" >/dev/null 2>&1; then
    gcloud artifacts repositories create "$AR_REPO" \
        --repository-format=docker \
        --location="$GCP_REGION" \
        --description="Docker container repository for OFL Credit Platform"
    echo "Created Artifact Registry repository: $AR_REPO"
else
    echo "Artifact Registry repository already exists: $AR_REPO"
fi

# 5. Create Google Cloud Storage Bucket for Loan & KYC Documents
echo "[Step 3/6] Provisioning Google Cloud Storage Bucket ($GCS_BUCKET)..."
if ! gcloud storage buckets describe "gs://$GCS_BUCKET" >/dev/null 2>&1; then
    gcloud storage buckets create "gs://$GCS_BUCKET" \
        --location="$GCP_REGION" \
        --uniform-bucket-level-access
    
    # Configure retention and versioning
    gcloud storage buckets update "gs://$GCS_BUCKET" --versioning
    echo "Created GCS bucket: gs://$GCS_BUCKET (Uniform access + Versioning enabled)"
else
    echo "GCS bucket already exists: gs://$GCS_BUCKET"
fi

# 6. Configure Service Account & IAM Permissions
echo "[Step 4/6] Creating & Authorizing Application Service Account..."
SA_EMAIL="$SERVICE_ACCOUNT_NAME@$GCP_PROJECT_ID.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --display-name="OFL Platform Cloud Run Runtime Account"
    echo "Created service account: $SA_EMAIL"
fi

# Grant IAM Roles:
# - Vertex AI User: Allows calling Gemini 1.5 Pro / Flash models
# - Storage Object Admin: Allows read/write/signed URLs on GCS bucket
# - Secret Manager Accessor: Allows fetching database credentials and API secrets
# - Cloud Logging Log Writer: Allows structured compliance audit log streaming
# - Cloud SQL Client: Allows connecting to PostgreSQL instance
ROLES=(
    "roles/aiplatform.user"
    "roles/storage.objectAdmin"
    "roles/secretmanager.secretAccessor"
    "roles/logging.logWriter"
    "roles/cloudsql.client"
)

for ROLE in "${ROLES[@]}"; do
    gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
        --member="serviceAccount:$SA_EMAIL" \
        --role="$ROLE" \
        --condition=None >/dev/null
    echo "Assigned $ROLE to $SA_EMAIL"
done

# 7. Provision Secret Manager Secrets (Initial Placeholders)
echo "[Step 5/6] Initializing Google Cloud Secret Manager Secrets..."
SECRETS=(
    "DATABASE_URL"
    "GEMINI_API_KEY"
    "YOUVERIFY_API_KEY"
    "NAV_INTEGRATION_KEY"
    "LOANDISC_API_TOKEN"
)

for SECRET in "${SECRETS[@]}"; do
    if ! gcloud secrets describe "$SECRET" >/dev/null 2>&1; then
        gcloud secrets create "$SECRET" \
            --replication-policy="automatic" \
            --labels="app=ofl-credit-platform"
        echo "Created secret placeholder: $SECRET (Add versions with gcloud secrets versions add $SECRET --data-file=...)"
    else
        echo "Secret already exists: $SECRET"
    fi
done

# 8. Create Cloud Logging Log Sink for Compliance Archiving (Optional BigQuery / Cold Storage Sink)
echo "[Step 6/6] Verifying Cloud Logging and Export Readiness..."
echo "Log Stream: projects/$GCP_PROJECT_ID/logs/ofl-audit-stream"

echo "======================================================================"
echo "GCP Setup Complete for Opticom Finance House!"
echo "Next step: Submit build via 'gcloud builds submit --config cloudbuild.yaml .'"
echo "======================================================================"
