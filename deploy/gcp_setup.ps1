# ==============================================================================
# Google Cloud Platform (GCP) Provisioning Script (PowerShell for Windows)
# Client: Opticom Finance House (RC: 347832) - OFL Credit Platform
# ==============================================================================

$ErrorActionPreference = "Stop"

$GCP_PROJECT_ID = if ($env:GCP_PROJECT_ID) { $env:GCP_PROJECT_ID } else { "opticom-ofl-platform" }
$GCP_PROJECT_NUMBER = if ($env:GCP_PROJECT_NUMBER) { $env:GCP_PROJECT_NUMBER } else { "394911050867" }
$GCP_REGION = if ($env:GCP_REGION) { $env:GCP_REGION } else { "europe-west1" }
$AR_REPO = if ($env:AR_REPO) { $env:AR_REPO } else { "ofl-containers" }
$GCS_BUCKET = if ($env:GCS_BUCKET) { $env:GCS_BUCKET } else { "opticom-ofl-platform-docs" }
$SERVICE_ACCOUNT_NAME = if ($env:SERVICE_ACCOUNT_NAME) { $env:SERVICE_ACCOUNT_NAME } else { "ofl-app-runner" }
$SA_EMAIL = "$SERVICE_ACCOUNT_NAME@$GCP_PROJECT_ID.iam.gserviceaccount.com"

# Cloud SQL PostgreSQL 16 Configuration
$CLOUDSQL_INSTANCE = if ($env:CLOUDSQL_INSTANCE) { $env:CLOUDSQL_INSTANCE } else { "ofl-postgres-prod" }
$CLOUDSQL_TIER = if ($env:CLOUDSQL_TIER) { $env:CLOUDSQL_TIER } else { "db-custom-1-3840" }
$CLOUDSQL_DB_NAME = if ($env:CLOUDSQL_DB_NAME) { $env:CLOUDSQL_DB_NAME } else { "ofl_credit_prod" }
$CLOUDSQL_DB_USER = if ($env:CLOUDSQL_DB_USER) { $env:CLOUDSQL_DB_USER } else { "ofl_app" }
$CLOUDSQL_CONNECTION_NAME = "${GCP_PROJECT_ID}:${GCP_REGION}:${CLOUDSQL_INSTANCE}"

function New-RandomAlphanumeric {
    param([int]$Length = 28)
    $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".ToCharArray()
    $bytes = New-Object byte[] $Length
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "Initializing GCP Provisioning for Opticom Finance House" -ForegroundColor Cyan
Write-Host "Project Name:      Opticom OFL Platform"
Write-Host "Project ID:        $GCP_PROJECT_ID"
Write-Host "Project Number:    $GCP_PROJECT_NUMBER"
Write-Host "Region:            $GCP_REGION"
Write-Host "Artifact Registry: $AR_REPO"
Write-Host "Storage Bucket:    $GCS_BUCKET"
Write-Host "Cloud SQL:         $CLOUDSQL_CONNECTION_NAME ($CLOUDSQL_TIER)"
Write-Host "Service Account:   $SA_EMAIL"
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Set Project
Write-Host "`n[Step 1/7] Selecting project $GCP_PROJECT_ID..." -ForegroundColor Yellow
gcloud config set project $GCP_PROJECT_ID

# 2. Enable Required APIs
Write-Host "`n[Step 2/7] Enabling Required Google Cloud APIs..." -ForegroundColor Yellow
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
Write-Host "`n[Step 3/7] Configuring Google Artifact Registry ($AR_REPO)..." -ForegroundColor Yellow
$null = gcloud artifacts repositories describe $AR_REPO --location=$GCP_REGION 2>&1
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
Write-Host "`n[Step 4/7] Provisioning Google Cloud Storage Bucket (gs://$GCS_BUCKET)..." -ForegroundColor Yellow
$null = gcloud storage buckets describe "gs://$GCS_BUCKET" 2>&1
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
Write-Host "`n[Step 5/7] Configuring Service Account & IAM Permissions..." -ForegroundColor Yellow
$null = gcloud iam service-accounts describe $SA_EMAIL 2>&1
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

$cbAccounts = @(
    "$GCP_PROJECT_NUMBER@cloudbuild.gserviceaccount.com",
    "$GCP_PROJECT_NUMBER-compute@developer.gserviceaccount.com"
)
foreach ($cb in $cbAccounts) {
    foreach ($cbRole in @("roles/run.admin", "roles/secretmanager.secretAccessor")) {
        gcloud projects add-iam-policy-binding $GCP_PROJECT_ID `
            --member="serviceAccount:$cb" `
            --role="$cbRole" `
            --condition=None 2>&1 | Out-Null
    }
    gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL `
        --member="serviceAccount:$cb" `
        --role="roles/iam.serviceAccountUser" `
        --condition=None 2>&1 | Out-Null
}
Write-Host "Cloud Build IAM deployment bindings configured." -ForegroundColor Green

# 6. Provision Cloud SQL PostgreSQL 16 Instance, Database, and User
Write-Host "`n[Step 6/7] Provisioning Cloud SQL PostgreSQL 16 ($CLOUDSQL_INSTANCE)..." -ForegroundColor Yellow
$null = gcloud sql instances describe $CLOUDSQL_INSTANCE 2>&1
if ($LASTEXITCODE -ne 0) {
    gcloud sql instances create $CLOUDSQL_INSTANCE `
        --database-version=POSTGRES_16 `
        --tier=$CLOUDSQL_TIER `
        --region=$GCP_REGION `
        --storage-type=SSD `
        --storage-size=20GB `
        --storage-auto-increase `
        --backup-start-time=02:00 `
        --enable-point-in-time-recovery `
        --availability-type=zonal
    Write-Host "Created Cloud SQL PostgreSQL 16 instance: $CLOUDSQL_INSTANCE" -ForegroundColor Green
} else {
    Write-Host "Cloud SQL instance already exists: $CLOUDSQL_INSTANCE" -ForegroundColor Gray
}

$null = gcloud sql databases describe $CLOUDSQL_DB_NAME --instance=$CLOUDSQL_INSTANCE 2>&1
if ($LASTEXITCODE -ne 0) {
    gcloud sql databases create $CLOUDSQL_DB_NAME --instance=$CLOUDSQL_INSTANCE
    Write-Host "Created PostgreSQL database: $CLOUDSQL_DB_NAME" -ForegroundColor Green
} else {
    Write-Host "PostgreSQL database already exists: $CLOUDSQL_DB_NAME" -ForegroundColor Gray
}

$existingUsers = gcloud sql users list --instance=$CLOUDSQL_INSTANCE --format="value(name)" 2>&1
$userExists = ($existingUsers -split "`r?`n") -contains $CLOUDSQL_DB_USER
$cloudSqlDsn = ""

if (![string]::IsNullOrEmpty($env:CLOUDSQL_DB_PASSWORD)) {
    if ($userExists) {
        gcloud sql users set-password $CLOUDSQL_DB_USER --instance=$CLOUDSQL_INSTANCE --password="$($env:CLOUDSQL_DB_PASSWORD)"
    } else {
        gcloud sql users create $CLOUDSQL_DB_USER --instance=$CLOUDSQL_INSTANCE --password="$($env:CLOUDSQL_DB_PASSWORD)"
    }
    $cloudSqlDsn = "postgresql+psycopg2://${CLOUDSQL_DB_USER}:$($env:CLOUDSQL_DB_PASSWORD)@/${CLOUDSQL_DB_NAME}?host=/cloudsql/${CLOUDSQL_CONNECTION_NAME}"
} elseif (-not $userExists) {
    $genPass = New-RandomAlphanumeric -Length 28
    gcloud sql users create $CLOUDSQL_DB_USER --instance=$CLOUDSQL_INSTANCE --password="$genPass"
    $cloudSqlDsn = "postgresql+psycopg2://${CLOUDSQL_DB_USER}:${genPass}@/${CLOUDSQL_DB_NAME}?host=/cloudsql/${CLOUDSQL_CONNECTION_NAME}"
    Write-Host "Created Cloud SQL user '$CLOUDSQL_DB_USER' and prepared PostgreSQL DSN." -ForegroundColor Green
} else {
    Write-Host "Cloud SQL user '$CLOUDSQL_DB_USER' already exists (keeping existing password & DATABASE_URL secret)." -ForegroundColor Gray
}

# 7. Secret Manager Provisioning & Seeding
Write-Host "`n[Step 7/7] Initializing Google Cloud Secret Manager Secrets..." -ForegroundColor Yellow
$secrets = @{
    "YOUVERIFY_API_KEY"        = if ($env:YOUVERIFY_API_KEY) { $env:YOUVERIFY_API_KEY } else { "q6VMnCWC.HFrVDW4ycU1bcnXTe9FJQ9s0MCF60kbxrnme" }
    "YOUVERIFY_WEBHOOK_SECRET" = if ($env:YOUVERIFY_WEBHOOK_SECRET) { $env:YOUVERIFY_WEBHOOK_SECRET } else { "tKQglemsJkFw4Ci6HoVMQstDsm13ZwfuYXNG" }
    "JWT_SECRET_KEY"           = if ($env:JWT_SECRET_KEY) { $env:JWT_SECRET_KEY } else { "" }
    "WEBHOOK_SECRET"           = if ($env:WEBHOOK_SECRET) { $env:WEBHOOK_SECRET } else { "tKQglemsJkFw4Ci6HoVMQstDsm13ZwfuYXNG" }
    "DATABASE_URL"             = $cloudSqlDsn
    "GEMINI_API_KEY"           = if ($env:GEMINI_API_KEY) { $env:GEMINI_API_KEY } else { "" }
    "NAV_INTEGRATION_KEY"      = if ($env:NAV_INTEGRATION_KEY) { $env:NAV_INTEGRATION_KEY } else { "" }
    "LOANDISC_API_TOKEN"       = if ($env:LOANDISC_API_TOKEN) { $env:LOANDISC_API_TOKEN } else { "" }
}

foreach ($key in $secrets.Keys) {
    $null = gcloud secrets describe $key 2>&1
    if ($LASTEXITCODE -ne 0) {
        gcloud secrets create $key --replication-policy="automatic" --labels="app=ofl-credit-platform"
        Write-Host "Created secret: $key" -ForegroundColor Green
    } else {
        Write-Host "Secret already exists: $key" -ForegroundColor Gray
    }

    $val = $secrets[$key]
    if ($key -eq "JWT_SECRET_KEY" -and [string]::IsNullOrEmpty($val)) {
        $null = gcloud secrets versions access latest --secret="JWT_SECRET_KEY" 2>&1
        if ($LASTEXITCODE -ne 0) {
            $val = New-RandomAlphanumeric -Length 48
        }
    }

    if (![string]::IsNullOrEmpty($val)) {
        $tmpFile = [System.IO.Path]::GetTempFileName()
        try {
            [System.IO.File]::WriteAllText($tmpFile, $val, [System.Text.UTF8Encoding]::new($false))
            gcloud secrets versions add $key --data-file="$tmpFile" 2>&1 | Out-Null
            Write-Host "Populated active secret version for: $key" -ForegroundColor Green
        } finally {
            Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "`n======================================================================" -ForegroundColor Cyan
Write-Host "GCP Setup Complete for Opticom Finance House!" -ForegroundColor Green
Write-Host "Cloud SQL Instance: $CLOUDSQL_CONNECTION_NAME" -ForegroundColor Cyan
Write-Host "Next step: Run 'gcloud builds submit --config cloudbuild.yaml .'" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan
