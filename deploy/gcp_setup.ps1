# ==============================================================================
# Google Cloud Platform (GCP) Provisioning Script (PowerShell for Windows)
# Client: Opticom Finance House (RC: 347832) - OFL Credit Platform
# ==============================================================================

$ErrorActionPreference = "Stop"

$GCP_PROJECT_ID = "opticom-ofl-platform"
$GCP_PROJECT_NUMBER = "394911050867"
$GCP_REGION = "europe-west1"
$AR_REPO = "ofl-containers"
$GCS_BUCKET = "opticom-ofl-platform-docs"
$SERVICE_ACCOUNT_NAME = "ofl-app-runner"
$SA_EMAIL = "$SERVICE_ACCOUNT_NAME@$GCP_PROJECT_ID.iam.gserviceaccount.com"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Initializing GCP Provisioning for Opticom Finance House" -ForegroundColor Cyan
Write-Host "Project Name:      Opticom OFL Platform"
Write-Host "Project ID:        $GCP_PROJECT_ID"
Write-Host "Project Number:    $GCP_PROJECT_NUMBER"
Write-Host "Region:            $GCP_REGION"
Write-Host "Artifact Registry: $AR_REPO"
Write-Host "Storage Bucket:    $GCS_BUCKET"
Write-Host "Service Account:   $SA_EMAIL"
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Set Project
Write-Host "`n[Step 1/6] Selecting project $GCP_PROJECT_ID..." -ForegroundColor Yellow
gcloud config set project $GCP_PROJECT_ID

# 2. Enable Required APIs
Write-Host "`n[Step 2/6] Enabling Required Google Cloud APIs..." -ForegroundColor Yellow
gcloud services enable `
    aiplatform.googleapis.com `
    storage.googleapis.com `
    secretmanager.googleapis.com `
    logging.googleapis.com `
    run.googleapis.com `
    cloudbuild.googleapis.com `
    artifactregistry.googleapis.com `
    sqladmin.googleapis.com `
    cloudresourcemanager.googleapis.com

# 3. Create Artifact Registry Repository
Write-Host "`n[Step 3/6] Configuring Google Artifact Registry ($AR_REPO)..." -ForegroundColor Yellow
$repoCheck = gcloud artifacts repositories describe $AR_REPO --location=$GCP_REGION 2>&1
if ($LASTEXITCODE -ne 0) {
    gcloud artifacts repositories create $AR_REPO `
        --repository-format=docker `
        --location=$GCP_REGION `
        --description="Docker container repository for OFL Credit Platform"
    Write-Host "Created Artifact Registry repository: $AR_REPO" -ForegroundColor Green
} else {
    Write-Host "Artifact Registry repository already exists: $AR_REPO" -ForegroundColor Gray
}

# 4. Create Google Cloud Storage Bucket
Write-Host "`n[Step 4/6] Provisioning Google Cloud Storage Bucket (gs://$GCS_BUCKET)..." -ForegroundColor Yellow
$bucketCheck = gcloud storage buckets describe "gs://$GCS_BUCKET" 2>&1
if ($LASTEXITCODE -ne 0) {
    gcloud storage buckets create "gs://$GCS_BUCKET" `
        --location=$GCP_REGION `
        --uniform-bucket-level-access
    gcloud storage buckets update "gs://$GCS_BUCKET" --versioning
    Write-Host "Created GCS bucket: gs://$GCS_BUCKET (Uniform access + Versioning enabled)" -ForegroundColor Green
} else {
    Write-Host "GCS bucket already exists: gs://$GCS_BUCKET" -ForegroundColor Gray
}

# 5. Service Account & IAM Permissions
Write-Host "`n[Step 5/6] Configuring Service Account & IAM Permissions..." -ForegroundColor Yellow
$saCheck = gcloud iam service-accounts describe $SA_EMAIL 2>&1
if ($LASTEXITCODE -ne 0) {
    gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME `
        --display-name="OFL Platform Cloud Run Runtime Account"
    Write-Host "Created service account: $SA_EMAIL" -ForegroundColor Green
} else {
    Write-Host "Service account already exists: $SA_EMAIL" -ForegroundColor Gray
}

$roles = @(
    "roles/aiplatform.user",
    "roles/storage.objectAdmin",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
    "roles/cloudsql.client"
)

foreach ($role in $roles) {
    gcloud projects add-iam-policy-binding $GCP_PROJECT_ID `
        --member="serviceAccount:$SA_EMAIL" `
        --role="$role" `
        --condition=None 2>&1 | Out-Null
    Write-Host "Assigned $role to $SA_EMAIL" -ForegroundColor Green
}

# Grant Cloud Build deployment permissions
$cbAccounts = @(
    "$GCP_PROJECT_NUMBER@cloudbuild.gserviceaccount.com",
    "$GCP_PROJECT_NUMBER-compute@developer.gserviceaccount.com"
)
foreach ($cb in $cbAccounts) {
    gcloud projects add-iam-policy-binding $GCP_PROJECT_ID `
        --member="serviceAccount:$cb" `
        --role="roles/run.admin" `
        --condition=None 2>&1 | Out-Null
    
    gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL `
        --member="serviceAccount:$cb" `
        --role="roles/iam.serviceAccountUser" `
        --condition=None 2>&1 | Out-Null
}
Write-Host "Cloud Build IAM deployment bindings configured." -ForegroundColor Green

# 6. Secret Manager Provisioning & Seeding
Write-Host "`n[Step 6/6] Initializing Google Cloud Secret Manager Secrets..." -ForegroundColor Yellow
$secrets = @{
    "YOUVERIFY_API_KEY"        = "q6VMnCWC.HFrVDW4ycU1bcnXTe9FJQ9s0MCF60kbxrnme"
    "YOUVERIFY_WEBHOOK_SECRET" = "tKQglemsJkFw4Ci6HoVMQstDsm13ZwfuYXNG"
    "JWT_SECRET_KEY"           = "OFL-ENTERPRISE-CREDIT-SECRET-KEY-2026-X99"
    "WEBHOOK_SECRET"           = "tKQglemsJkFw4Ci6HoVMQstDsm13ZwfuYXNG"
    "DATABASE_URL"             = "sqlite:///./ofl.db"
    "GEMINI_API_KEY"           = ""
    "NAV_INTEGRATION_KEY"      = ""
    "LOANDISC_API_TOKEN"       = ""
}

foreach ($key in $secrets.Keys) {
    $secCheck = gcloud secrets describe $key 2>&1
    if ($LASTEXITCODE -ne 0) {
        gcloud secrets create $key --replication-policy="automatic" --labels="app=ofl-credit-platform"
        Write-Host "Created secret: $key" -ForegroundColor Green
    } else {
        Write-Host "Secret already exists: $key" -ForegroundColor Gray
    }

    $val = $secrets[$key]
    if (![string]::IsNullOrEmpty($val)) {
        $val | gcloud secrets versions add $key --data-file=- 2>&1 | Out-Null
        Write-Host "Populated active secret version for: $key" -ForegroundColor Green
    }
}

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "GCP Setup Complete for Opticom Finance House!" -ForegroundColor Green
Write-Host "Next step: Run 'gcloud builds submit --config cloudbuild.yaml .'" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

