#!/usr/bin/env bash
# ==============================================================================
# Script to Grant Developer & Operator IAM Roles
# Project: opticom-ofl-platform (394911050867)
# ==============================================================================

set -euo pipefail

export GCP_PROJECT_ID="${GCP_PROJECT_ID:-opticom-ofl-platform}"
export GCP_REGION="${GCP_REGION:-europe-west1}"
export AR_REPO="${AR_REPO:-ofl-containers}"
export RUNTIME_SA="ofl-app-runner@${GCP_PROJECT_ID}.iam.gserviceaccount.com"

# Default to currently authenticated gcloud user if TARGET_PRINCIPAL is not passed
CURRENT_ACCOUNT=$(gcloud config get-value account 2>/dev/null)
export TARGET_PRINCIPAL="${1:-${TARGET_PRINCIPAL:-$CURRENT_ACCOUNT}}"

if [[ -z "$TARGET_PRINCIPAL" ]]; then
    echo "ERROR: No target principal specified. Usage: ./grant_developer_roles.sh user:developer@opticom.ng"
    exit 1
fi

# Ensure prefix: user:, serviceAccount:, or group:
if [[ ! "$TARGET_PRINCIPAL" =~ ^(user|serviceAccount|group): ]]; then
    if [[ "$TARGET_PRINCIPAL" =~ gserviceaccount\.com$ ]]; then
        MEMBER="serviceAccount:$TARGET_PRINCIPAL"
    else
        MEMBER="user:$TARGET_PRINCIPAL"
    fi
else
    MEMBER="$TARGET_PRINCIPAL"
fi

echo "======================================================================"
echo "Granting Requested Roles to: $MEMBER"
echo "Project: $GCP_PROJECT_ID"
echo "======================================================================"

# Project-level roles:
PROJECT_ROLES=(
    "roles/run.developer"
    "roles/cloudsql.viewer"
    "roles/aiplatform.user"
    "roles/logging.viewer"
    "roles/monitoring.viewer"
)

for ROLE in "${PROJECT_ROLES[@]}"; do
    echo "Assigning $ROLE..."
    gcloud projects add-iam-policy-binding "$GCP_PROJECT_ID" \
        --member="$MEMBER" \
        --role="$ROLE" \
        --condition=None >/dev/null
    echo "  [OK] $ROLE granted."
done

# Repository-level role: roles/artifactregistry.reader on ofl-containers
echo "Assigning roles/artifactregistry.reader on repository '$AR_REPO'..."
gcloud artifacts repositories add-iam-policy-binding "$AR_REPO" \
    --location="$GCP_REGION" \
    --project="$GCP_PROJECT_ID" \
    --member="$MEMBER" \
    --role="roles/artifactregistry.reader" >/dev/null
echo "  [OK] roles/artifactregistry.reader granted on $AR_REPO."

# Service Account User on designated runtime service account
echo "Assigning roles/iam.serviceAccountUser on $RUNTIME_SA..."
gcloud iam service-accounts add-iam-policy-binding "$RUNTIME_SA" \
    --project="$GCP_PROJECT_ID" \
    --member="$MEMBER" \
    --role="roles/iam.serviceAccountUser" >/dev/null
echo "  [OK] roles/iam.serviceAccountUser granted on $RUNTIME_SA."

echo "======================================================================"
echo "All requested IAM roles successfully granted to $MEMBER!"
echo "======================================================================"

