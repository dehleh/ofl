# OFL Credit Automation & AI-Assisted Underwriting Platform
**Client**: Opticom Finance House (RC: 347832)  
**Implementation**: CyberCapSec Limited  
**Baseline**: PRD Version 1.1 / Technical Development Roadmap v1.2 (20 October 2026)

---

## 1. Executive Overview
The **OFL Credit Automation & AI-Assisted Underwriting Platform** centralises credit origination and underwriting for **ALL** Opticom loan applications:
- **BESTO Channel (`₦300,000` to `₦2,000,000` inclusive)**: Ingests lower-value loan submissions and KYC from the BESTO portal with strict deduplication on `(source_system, source_application_id)`.
- **OFL Direct Channel (`> ₦2,000,000`)**: High-value facility origination for Individuals, SMEs, and Corporates through the new portal.
- **Workflow Parity**: Both channels enter the same credit pipeline, financial calculation engine, AI-assisted CAM drafting, HRM/BCC/MD review, and Treasury handoff.
- **Human-Controlled Governance**: **AI does not approve or disburse loans.** All numerical calculations, DSR ratios, and policy limits are executed strictly deterministically outside the LLM.

---

## 2. Technology Stack
- **Cloud Infrastructure**: Google Cloud Platform (GCP) — [Google Cloud Run](https://cloud.google.com/run), [Google Cloud Storage](https://cloud.google.com/storage), [Secret Manager](https://cloud.google.com/secret-manager), and [Cloud Logging](https://cloud.google.com/logging).
- **Backend API**: Python 3.13 with [FastAPI](https://fastapi.tiangolo.com/), [SQLAlchemy 2.0](https://www.sqlalchemy.org/), [Pydantic V2](https://docs.pydantic.dev/), and [Pytest](https://docs.pytest.org/).
- **Database**: PostgreSQL (Cloud SQL on GCP in production; SQLite local dev zero-setup).
- **Frontend Portal**: [React 18](https://react.dev/) + [Vite](https://vitejs.dev/) + TypeScript with vanilla enterprise CSS tokens tailored to Opticom Finance's brand guidelines.
- **AI Underwriter**: Google Cloud Vertex AI ([Gemini 1.5 Pro / Flash](https://cloud.google.com/vertex-ai)) for narrative CAM drafting, evidence citations, and token budget telemetry.

---

## 3. Quick Start (Local Development)

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### One-Command Launcher
Run both the FastAPI backend (`http://127.0.0.1:8000`) and the Vite web portal (`http://localhost:5173`):
```bash
python run_dev.py
```

### Running Backend Individually
```bash
# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Start FastAPI server
uvicorn backend.app.main:app --port 8000 --reload
```
- Interactive Swagger API Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- API Health Check: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

### Running Frontend Individually
```bash
cd frontend
npm run dev
```
- Web Portal: [http://localhost:5173](http://localhost:5173)

---

## 4. Automated Test Suite
Run the test suite verifying all 10 core acceptance and financial rules:
```bash
.\venv\Scripts\pytest.exe -v
```
All tests pass verifying:
- Deterministic PMT calculation & DSR threshold detection (`FR-05`, `FR-28`)
- BESTO ₦1.5m case creation (`Section 17.4`)
- Duplicate payload rejection with 0 duplicate cases created (`FR-22`)
- ₦2,000,000 boundary rule enforcement (`Section 17.1`)
- Incomplete KYC exception routing without losing case data (`FR-25`)
- State machine transition invariants & audit persistence (`Section 6.1`)
- Material term change detection and prior approval invalidation (`FR-12`)
- Delegation of authority amount limits for HRM, BCC, and MD (`FR-09`)

---

## 5. UI Screen Inventory (PRD Section 11)
1. **Work Queue (`CaseQueue.tsx`)**: Filterable credit pipeline by stage, channel, and search.
2. **Direct OFL Intake (`ApplicationIntake.tsx`)**: Applications > ₦2m with live repayment and DSR calculations.
3. **BESTO Simulator & Quarantine Lab (`BestoIngestionLab.tsx`)**: Inbound payload testing with presets for ₦1.5m intake, duplicate replay, boundary test, and quarantine inspector.
4. **Case Workspace Dossier (`CaseWorkspace.tsx`)**: Comprehensive case dossier:
   - Borrower Profile & Documents with SHA-256 checksums
   - Deterministic Financial Assessment & Policy Flag callouts
   - AI-assisted CAM Editor with cited source evidence and analyst sign-off
   - Approval Authority decision console with mandate checks
   - Binding Offer Letter generation, acceptance, and Conditions Precedent checklist
   - Treasury Microsoft Dynamics NAV confirmation and idempotent LOAN-DISC synchronization
5. **Exceptions & Rework (`ExceptionManager.tsx`)**: Open exceptions queue with SLA aging.
6. **Platform Telemetry & Audit Integrity (`AuditTelemetry.tsx`)**: Tamper-evident audit log and Google Cloud Vertex AI (Gemini) token/cost dashboard.
