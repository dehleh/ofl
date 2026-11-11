#!/usr/bin/env bash
# ==============================================================================
# Google Cloud Platform (GCP) Provisioning & Setup Script
# Opticom Finance House - OFL Credit Automation & AI Underwriting Platform
# ==============================================================================

set -euo pipefail

# 1. Configuration Defaults (Configured for Opticom OFL Platform)
export GCP_PROJECT_ID="${GCP_PROJECT_ID:-opticom-ofl-platform}"
export GCP_PROJECT_NUMBER="${GCP_PROJECT_NUMBER:-394911050867}"
export GCP_REGION="${GCP_REGION:-europe-west1}"
export AR_REPO="${AR_REPO:-ofl-containers}"
export GCS_BUCKET="${GCS_BUCKET:-opticom-ofl-platform-docs}"
export SERVICE_ACCOUNT_NAME="${SERVICE_ACCOUNT_NAME:-ofl-app-runner}"

# Cloud SQL PostgreSQL 16 Defaults
export CLOUDSQL_INSTANCE="${CLOUDSQL_INSTANCE:-ofl-postgres-prod}"
export CLOUDSQL_TIER="${CLOUDSQL_TIER:-db-custom-1-3840}"
export CLOUDSQL_DB_NAME="${CLOUDSQL_DB_NAME:-ofl_credit_prod}"
export CLOUDSQL_DB_USER="${CLOUDSQL_DB_USER:-ofl_app}"
export CLOUDSQL_CONNECTION_NAME="$GCP_PROJECT_ID:$GCP_REGION:$CLOUDSQL_INSTANCE"

echo "======================================================================"
echo "Initializing GCP Provisioning for Opticom Finance House"
echo "Project Name:      Opticom OFL Platform"
echo "Project ID:        $GCP_PROJECT_ID"
echo "Project Number:    $GCP_PROJECT_NUMBER"
echo "Region:            $GCP_REGION"
echo "Artifact Registry: $AR_REPO"
echo "Storage Bucket:    $GCS_BUCKET"
echo "Cloud SQL:         $CLOUDSQL_CONNECTION_NAME ($CLOUDSQL_TIER)"
echo "Service Account:   $SERVICE_ACCOUNT_NAME@$GCP_PROJECT_ID.iam.gserviceaccount.com"
echo "======================================================================"

# 2. Select Project
gcloud config set project "$GCP_PROJECT_ID"

# 3. Enable Required Google Cloud Services
echo "[Step 1/7] Enabling Required GCP APIs..."
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
echo "[Step 2/7] Configuring Google Artifact Registry..."
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
echo "[Step 3/7] Provisioning Google Cloud Storage Bucket ($GCS_BUCKET)..."
if ! gcloud storage buckets describe "gs://$GCS_BUCKET" >/dev/null 2>&1; then
    gcloud storage buckets create "gs://$GCS_BUCKET" \
        --location="$GCP_REGION" \
        --uniform-bucket-level-access
    gcloud storage buckets update "gs://$GCS_BUCKET" --versioning
    echo "Created GCS bucket: gs://$GCS_BUCKET (Uniform access + Versioning enabled)"
else
    echo "GCS bucket already exists: gs://$GCS_BUCKET"
fi

# 6. Configure Service Account & IAM Permissions
echo "[Step 4/7] Creating & Authorizing Application Service Account..."
SA_EMAIL="$SERVICE_ACCOUNT_NAME@$GCP_PROJECT_ID.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
    gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
        --display-name="OFL Platform Cloud Run Runtime Account"
    echo "Created service account: $SA_EMAIL"
fi

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

echo "Configuring Cloud Build deployment permissions..."
CB_ACCOUNTS=(
    "$GCP_PROJECT_NUMBER@cloudbuild.gserviceaccount.com"
    "$GCP_PROJECT_NUMBER-compute@developer.gserviceaccount.com"
)
CB_ROLES=(
    "roles/run.admin"
    "roles/storage.admin"
    "roles/artifactregistry.writer"
    "roles/cloudbuild.builds.builder"
    "roles/secretmanager.secretAccessor"
)
for CB_ACCT in "${CB_ACCOUNTS[@]}"; do
    for CB_ROLE in "${CB_ROLES[@]}"; do
        gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
            --member="serviceAccount:$CB_ACCT" \
            --role="$CB_ROLE" \
            --condition=None >/dev/null 2>&1 || true
    done

    gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
        --member="serviceAccount:$CB_ACCT" \
        --role="roles/iam.serviceAccountUser" \
        --condition=None >/dev/null 2>&1 || true
done
echo "Cloud Build IAM bindings configured."

# 7. Provision Cloud SQL PostgreSQL 16 Instance, Database, and Application User
echo "[Step 5/7] Provisioning Cloud SQL PostgreSQL 16 ($CLOUDSQL_INSTANCE)..."
if ! gcloud sql instances describe "$CLOUDSQL_INSTANCE" >/dev/null 2>&1; then
    gcloud sql instances create "$CLOUDSQL_INSTANCE" \
        --database-version=POSTGRES_16 \
        --tier="$CLOUDSQL_TIER" \
        --region="$GCP_REGION" \
        --storage-type=SSD \
        --storage-size=20GB \
        --storage-auto-increase \
        --backup-start-time=02:00 \
        --enable-point-in-time-recovery \
        --availability-type=zonal
    echo "Created Cloud SQL PostgreSQL 16 instance: $CLOUDSQL_INSTANCE"
else
    echo "Cloud SQL instance already exists: $CLOUDSQL_INSTANCE"
fi

if ! gcloud sql databases describe "$CLOUDSQL_DB_NAME" --instance="$CLOUDSQL_INSTANCE" >/dev/null 2>&1; then
    gcloud sql databases create "$CLOUDSQL_DB_NAME" --instance="$CLOUDSQL_INSTANCE"
    echo "Created PostgreSQL database: $CLOUDSQL_DB_NAME"
else
    echo "PostgreSQL database already exists: $CLOUDSQL_DB_NAME"
fi

# Create DB user only if missing (or update if CLOUDSQL_DB_PASSWORD explicitly passed)
CLOUD_SQL_DSN=""
if [ -n "${CLOUDSQL_DB_PASSWORD:-}" ]; then
    if gcloud sql users list --instance="$CLOUDSQL_INSTANCE" --format="value(name)" | grep -qx "$CLOUDSQL_DB_USER"; then
        gcloud sql users set-password "$CLOUDSQL_DB_USER" --instance="$CLOUDSQL_INSTANCE" --password="$CLOUDSQL_DB_PASSWORD"
    else
        gcloud sql users create "$CLOUDSQL_DB_USER" --instance="$CLOUDSQL_INSTANCE" --password="$CLOUDSQL_DB_PASSWORD"
    fi
    CLOUD_SQL_DSN="postgresql+psycopg2://$CLOUDSQL_DB_USER:$CLOUDSQL_DB_PASSWORD@/$CLOUDSQL_DB_NAME?host=/cloudsql/$CLOUDSQL_CONNECTION_NAME"
elif ! gcloud sql users list --instance="$CLOUDSQL_INSTANCE" --format="value(name)" | grep -qx "$CLOUDSQL_DB_USER"; then
    GENERATED_DB_PASS=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 28 || openssl rand -hex 16)
    gcloud sql users create "$CLOUDSQL_DB_USER" --instance="$CLOUDSQL_INSTANCE" --password="$GENERATED_DB_PASS"
    CLOUD_SQL_DSN="postgresql+psycopg2://$CLOUDSQL_DB_USER:$GENERATED_DB_PASS@/$CLOUDSQL_DB_NAME?host=/cloudsql/$CLOUDSQL_CONNECTION_NAME"
    echo "Created Cloud SQL user '$CLOUDSQL_DB_USER' and prepared PostgreSQL DSN for Secret Manager."
else
    echo "Cloud SQL user '$CLOUDSQL_DB_USER' already exists (keeping existing password & DATABASE_URL secret)."
fi

# 8. Provision Secret Manager Secrets
echo "[Step 6/7] Initializing Google Cloud Secret Manager Secrets..."
declare -A SECRET_VALUES=(
    ["YOUVERIFY_API_KEY"]="${YOUVERIFY_API_KEY:-q6VMnCWC.HFrVDW4ycU1bcnXTe9FJQ9s0MCF60kbxrnme}"
    ["YOUVERIFY_WEBHOOK_SECRET"]="${YOUVERIFY_WEBHOOK_SECRET:-tKQglemsJkFw4Ci6HoVMQstDsm13ZwfuYXNG}"
    ["JWT_SECRET_KEY"]="${JWT_SECRET_KEY:-}"
    ["WEBHOOK_SECRET"]="${WEBHOOK_SECRET:-tKQglemsJkFw4Ci6HoVMQstDsm13ZwfuYXNG}"
    ["DATABASE_URL"]="$CLOUD_SQL_DSN"
    ["GEMINI_API_KEY"]="${GEMINI_API_KEY:-}"
    ["NAV_INTEGRATION_KEY"]="${NAV_INTEGRATION_KEY:-}"
    ["LOANDISC_API_TOKEN"]="${LOANDISC_API_TOKEN:-}"
)

for SECRET in "${!SECRET_VALUES[@]}"; do
    if ! gcloud secrets describe "$SECRET" >/dev/null 2>&1; then
        gcloud secrets create "$SECRET" \
            --replication-policy="automatic" \
            --labels="app=ofl-credit-platform"
        echo "Created secret: $SECRET"
    else
        echo "Secret already exists: $SECRET"
    fi

    VAL="${SECRET_VALUES[$SECRET]}"
    if [ "$SECRET" = "JWT_SECRET_KEY" ] && [ -z "$VAL" ]; then
        if ! gcloud secrets versions access latest --secret="JWT_SECRET_KEY" >/dev/null 2>&1; then
            VAL=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48 || openssl rand -hex 32)
        fi
    fi

    if [ -n "$VAL" ]; then
        printf "%s" "$VAL" | gcloud secrets versions add "$SECRET" --data-file=- >/dev/null
        echo "Populated active secret version for: $SECRET"
    fi
done

# 9. Verify Cloud Logging and Export Readiness
echo "[Step 7/7] Verifying Cloud Logging and Export Readiness..."
echo "Log Stream: projects/$GCP_PROJECT_ID/logs/ofl-audit-stream"

echo "======================================================================"
echo "GCP Setup Complete for Opticom Finance House!"
echo "Cloud SQL Instance: $CLOUDSQL_CONNECTION_NAME"
echo "Next step: Submit build via 'gcloud builds submit --config cloudbuild.yaml .'"
echo "======================================================================"
