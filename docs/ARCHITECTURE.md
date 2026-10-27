# OFL Credit Automation & AI-Assisted Underwriting Platform
## Architectural Baseline & System Design Specification (PRD v1.1 / Roadmap v1.2)

### 1. Architectural Overview & Boundaries
The platform serves as the single credit processing and decisioning system for **ALL** Opticom loan origination channels:
- **BESTO Channel (`₦300,000` to `₦2,000,000` inclusive)**: Lower-value applicants originate through the existing BESTO mobile/web portal and KYC channel. Payloads are ingested via authenticated webhooks/batches into the OFL pipeline. Uniqueness is enforced on `(source_system, source_application_id)`.
- **OFL Direct Channel (`> ₦2,000,000`)**: High-value borrowers originate via the new OFL portal (direct or BDO-assisted). Applications at or below ₦2,000,000 are dynamically blocked and routed to BESTO.
- **Credit Workflow Parity**: Both channels produce canonical `CreditCase` records subjected to identical risk analysis, deterministic financial ratio evaluation, AI CAM synthesis, and authority mandate routing.

---

### 2. Core Modules & Directory Layout
```
ofl/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI entrypoint, lifespan, CORS, seed data
│   │   ├── config.py                   # Environment settings & policy thresholds
│   │   ├── database.py                 # SQLAlchemy engine, session management
│   │   ├── models/entities.py          # 14 Canonical entities (PRD Section 7)
│   │   ├── schemas/schemas.py          # Pydantic v2 schemas
│   │   ├── core/
│   │   │   ├── financial_engine.py     # Deterministic PMT, DSR, NDI, and policy checks
│   │   │   ├── state_machine.py        # Strict transition service with invariants (Section 6.1)
│   │   │   ├── authority_matrix.py     # Amount-based delegation limits (Analyst, HRM, BCC, MD)
│   │   │   └── cloud_logger.py         # Google Cloud Logging & structured audit stream
│   │   ├── integrations/
│   │   │   ├── besto_adapter.py        # Section 17.3 BESTO ingestion, deduplication, quarantine
│   │   │   ├── youverify_adapter.py    # Identity verification & mismatch exception routing
│   │   │   ├── nav_adapter.py          # Treasury NAV disbursement packet & confirmation
│   │   │   ├── loandisc_adapter.py     # Post-disbursement idempotent synchronization
│   │   │   ├── vertex_ai_service.py    # Google Cloud Vertex AI (Gemini) CAM drafting & telemetry
│   │   │   ├── gcs_service.py          # Google Cloud Storage document repository & SHA-256
│   │   │   └── secret_manager_service.py # GCP Secret Manager credential retrieval
│   │   └── api/v1/                     # 8 REST Routers
│   ├── tests/                          # Pytest automated test suite (15 core & GCP tests)
│   └── requirements.txt
├── frontend/                           # React 18 + Vite + TypeScript web portal
│   ├── src/
│   │   ├── components/                 # Header with persona switcher, brand logo
│   │   ├── screens/                    # 12 UI screens (Intake, Queue, Workspace, CAM, etc.)
│   │   ├── services/api.ts             # API client
│   │   └── index.css                   # Opticom Finance design system
├── docs/                               # Architecture and UAT documentation
└── run_dev.py                          # Dual-server launcher
```

---

### 3. Canonical Data Entities (PRD Section 7)
1. **`Customer`**: Individual, SME, or Corporate entity details with verified BVN/NIN/RC credentials.
2. **`Application`**: Financial request parameters (amount, currency, tenor, purpose, channel).
3. **`CreditCase`**: Primary workflow case record with immutable `case_number`, state, and revision counter.
4. **`Document`**: Files with SHA-256 checksums, versioning, and malware scan status.
5. **`KYCCheck`**: Verification transactions with provider references (`YOUVERIFY`, `BESTO_REUSE`).
6. **`FinancialAssessment`**: Immutable record of inputs and deterministic ratios calculated outside the LLM.
7. **`CAMVersion`**: Numbered Credit Appraisal Memorandums preserving source snapshots and analyst sign-offs.
8. **`ExceptionItem`**: Segregated exception records (applicant corrections, KYC mismatches, rework).
9. **`Approval`**: Authority deliberations linked to case revisions and cryptographic terms hashes.
10. **`Offer`**: Official binding loan terms with customer acceptance evidence and 14-day validity.
11. **`ConditionItem`**: Pre- and post-disbursement condition checklist items.
12. **`Disbursement`**: Confirmed NAV facility reference and disbursement confirmation evidence.
13. **`IntegrationEvent`**: Outbound/inbound communication events with idempotency keys.
14. **`AuditEvent`**: Append-only tamper-evident compliance audit trail.

---

### 4. Transition Invariants (PRD Section 6.1)
- State changes can only be performed by the authorized `TransitionService`.
- Every transition logs `actor`, `role`, `timestamp`, `from_state`, `to_state`, `reason`, `case_revision`, and `correlation_id`.
- Exceptions operate in parallel to the case primary stage; exception state and case state are separate.
- Material alterations to loan amount, tenor, or capacity invalidate prior approvals (`FR-12`) and bump the case revision.
- Retries must be idempotent: repeated deliveries never duplicate cases, disbursements, or LOAN-DISC records.
