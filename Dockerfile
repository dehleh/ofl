# ==============================================================================
# Multi-stage Dockerfile for OFL Credit Automation Platform on Google Cloud Run
# Client: Opticom Finance House (RC: 347832)
# ==============================================================================

# Stage 1: Build Frontend Assets
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Production Python Backend & Static Asset Server
FROM python:3.13-slim AS production

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080 \
    ENVIRONMENT=production

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r ./requirements.txt

# Copy backend application code, migrations, and scripts
COPY backend/app ./app
COPY backend/alembic ./alembic
COPY backend/alembic.ini ./alembic.ini
COPY backend/scripts ./scripts

# Copy built frontend static assets into static folder for FastAPI to serve in production
COPY --from=frontend-builder /app/frontend/dist ./frontend_dist

# Expose Google Cloud Run default port
EXPOSE 8080

# Bootstrap Cloud SQL schema & mandatory system configs once before spawning workers
CMD python -c "from app.database import init_db; init_db()" && exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 2
