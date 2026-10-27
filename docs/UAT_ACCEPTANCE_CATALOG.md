# OFL Credit Automation Platform — UAT Acceptance Test Catalogue
## Mapping of PRD Acceptance Criteria to Implementation & Test Evidence

| Test ID | PRD Acceptance Criterion | Verification Method / Module | Automated / UI Test Status |
| :--- | :--- | :--- | :--- |
| **UAT-01** | Applicant submits valid above-₦2m application; case and audit trail created. | `POST /api/v1/intake/direct` & `DirectApplicationCreate` schema. | Verified in `ApplicationIntake.tsx` & Backend API. |
| **UAT-02** | Incomplete submission remains draft and shows actionable field errors. | Frontend validation & Pydantic V2 schema rejection. | Verified with required fields & boundaries. |
| **UAT-03** | Applicant corrects requested documents; analyst validates and reviewer resumes. | `ExceptionManager.tsx` & `POST /api/v1/exceptions/{id}/resolve`. | Verified in Exception resolution workflow. |
| **UAT-04** | Youverify mismatch routes to KYC officer; no automatic clearance. | `YouverifyAdapter.verify_identity` (triggers `KYC_MISMATCH` exception). | Verified in `youverify_adapter.py`. |
| **UAT-05** | Youverify outage retries safely and preserves case state. | Transient error returns `retryable: True`; case remains in state. | Verified in `youverify_adapter.py`. |
| **UAT-06** | AI CAM contains evidence references; analyst edits and validates version. | `AzureAICamService.generate_draft_cam` & `PUT /cam/{id}` sign-off. | Verified in `azure_ai_service.py` & `CamEditor`. |
| **UAT-07** | HRM returns CAM; analyst resubmits new version to HRM. | `POST /approval` with `RETURN_FOR_REWORK` opens rework exception. | Verified in `workflow_router.py`. |
| **UAT-08** | BCC/MD requests reconsideration; HRM coordinates proper reapproval. | Mandate check routes case back to HRM or Analyst. | Verified in `authority_matrix.py`. |
| **UAT-09** | Adverse analyst recommendation does not close case without authorised decision. | `RECOMMEND_REJECT` by analyst does not trigger final decline. | Verified in `state_machine.py` & `AuthorityMatrix`. |
| **UAT-10** | Final rejection records authority and sends approved customer notice. | Rejection restricted to HRM/BCC/MD with mandatory reason. | Verified in `test_state_machine.py`. |
| **UAT-11** | Material change invalidates affected prior approvals. | `TransitionService.invalidate_approvals_if_material_change`. | Verified in `test_state_machine.py` (Unit Test Passed). |
| **UAT-12** | Offer accepted; missing condition prevents disbursement readiness. | `TransitionService` checks `ConditionItem.mandatory` before ready state. | Verified in `state_machine.py`. |
| **UAT-13** | NAV uncertain outcome is reconciled without duplicate instruction. | `Disbursement.nav_reference` unique constraint. | Verified in `nav_adapter.py`. |
| **UAT-14** | Confirmed disbursement syncs once to LOAN-DISC; retry is idempotent. | `IntegrationEvent.idempotency_key` (`LOANDISC_SYNC_{case_number}`). | Verified in `loandisc_adapter.py`. |
| **UAT-15** | Cross-case unauthorised access is denied and logged. | Server-side role validation in routers. | Verified in `workflow_router.py`. |
| **UAT-16** | Opticom can revoke CyberCapSec Azure access and retains billing ownership. | Microsoft Entra ID RBAC configuration documented. | Documented in `ARCHITECTURE.md`. |
| **UAT-17** | Private document access, AI region approval, cost alerts and restore evidenced. | Azure Blob lifecycle and telemetry dashboard. | Verified in `AuditTelemetry.tsx`. |
| **UAT-18** | Audit trail preserves exception, CAM revision and approval history. | `AuditEvent` append-only database table. | Verified in `test_state_machine.py` & `AuditTelemetry`. |

### Section 17.4 BESTO Acceptance Criteria
1. **₦1.5m BESTO submission**: Creates exactly one OFL case in Analyst Review (`test_besto_1_5m_creates_exactly_one_case` — PASSED).
2. **Duplicate Replay**: Replaying the same payload twice never creates a second case (`test_besto_deduplication_replay_never_duplicates` — PASSED).
3. **₦2,000,000 Boundary**: Exactly ₦2m accepted in BESTO; > ₦2m quarantined (`test_besto_boundary_rule` — PASSED).
4. **Incomplete KYC**: Creates owned exception without losing case (`test_besto_incomplete_kyc_creates_exception_without_losing_case` — PASSED).

### Section 17.5 Credit Exception Handling Architecture (Flowchart Verification)
*Automated Verification Module:* `backend/tests/test_flowchart_exceptions.py` (9/9 Unit & Integration Tests Passed)

1. **Exception Ingestion & Payload Tracking (`UAT-EXC-01`)**:
   - Originators: Applicant, Analyst, HRM, BCC, MD, System.
   - Preserves `Case ID + Reason + Originator Owner + Comments + SLA + Version`.
   - Verified via `test_raise_all_six_categories` & `POST /api/v1/exceptions/raise`.
2. **Branch 1: Technical Failure (`UAT-EXC-02`)**:
   - Automated assignment to `IT / Integration Owner` (Default SLA: 4 hours).
   - Retry counting, reconciliation notes, and restoration of original workflow state.
   - Verified via `test_branch_1_technical_failure_retry_and_restore`.
3. **Branch 2: Internal Correction (`UAT-EXC-03`)**:
   - Assigned to `Credit Analyst` (Default SLA: 24 hours).
   - Correct CAM / Calculations / Analysis -> Creates revised CAM version -> Converges to Material Credit Change check.
4. **Branch 3: Rejection Recommendation (`UAT-EXC-04`)**:
   - Routed to `Authorised Decision-Maker` (MD / BCC).
   - **Decision: Reject**: Records reason, authority citation, and date -> Emits approved notification -> Transitions case to `REJECTED` and closes.
   - **Decision: Further Assessment**: Routes to HRM -> HRM coordinates reassessment with Analyst -> Analyst revises.
   - Verified via `test_branch_3_rejection_recommendation_reject_flow` and `test_branch_3_rejection_recommendation_further_assessment`.
5. **Branch 4: Risk Reconsideration (`UAT-EXC-05`)**:
   - Routed to `HRM` -> Coordinates restructuring / mitigation with Credit Analyst -> Analyst revises.
   - Verified via `test_branch_4_risk_reconsideration_and_hrm_coordination`.
6. **Branch 5: Withdrawal / Expiry (`UAT-EXC-06`)**:
   - Validates withdrawal / expiry rules -> Transitions case to `WITHDRAWN` or authorizes renewal.
   - Verified via `test_branch_5_withdrawal_expiry_close`.
7. **Branch 6: Applicant Correction Loop (`UAT-EXC-07`)**:
   - Assigned to `Credit Analyst / BDO` -> Sends specific request to applicant -> Applicant views and uploads replacement docs via public tracker (`/track/{case_number}`) -> Analyst validates changes.
   - Verified via `test_branch_6_applicant_correction_lifecycle`.
8. **Convergence Node: Material Credit Change (`UAT-EXC-08`)**:
   - **Material Change (YES)**: `TransitionService.invalidate_approvals_if_material_change()` invalidates affected prior approvals, bumps case revision, and restarts applicable approval chain.
   - **Non-Material Change (NO)**: Preserves prior approvals and returns to required reviewer with original comments.
   - Verified via `test_convergence_material_change_invalidates_approvals` and `test_convergence_non_material_change_preserves_approvals`.

### Section 17.6 Enterprise Robustness & Production Improvements
*Automated Verification Module:* `backend/tests/test_enterprise_improvements.py` (6/6 Unit & Integration Tests Passed)

1. **Enterprise Identity & Access Management (OAuth2 / JWT / RBAC) (`UAT-ENT-01`)**:
   - High-security signed HS256 JWT Bearer tokens with 12-hour session expiry and role scopes (`ANALYST`, `HRM`, `BCC`, `MD`, `TREASURY`, `IT_OWNER`).
   - Enterprise Staff Directory authentication with PIN verification (`POST /api/v1/auth/login`) and Google Workspace / Entra ID token exchange (`POST /api/v1/auth/sso-callback`).
   - Route-level RBAC enforcement via `require_roles` dependency and current identity inspection (`GET /api/v1/auth/me`).
   - Verified via `test_enterprise_iam_login_and_token_validation` and `test_enterprise_iam_invalid_credentials`.

2. **Inbound Webhook Cryptographic Verification (HMAC SHA-256) (`UAT-ENT-02`)**:
   - Header `X-Signature-SHA256` constant-time cryptographic verification on inbound BESTO webhook endpoints (`POST /api/v1/intake/besto`).
   - Prevents payload tampering and unauthorized third-party injection. Tampered payloads return `401 Unauthorized`.
   - Verified via `test_inbound_webhook_hmac_verification`.

3. **Scanned Statement OCR via Google Cloud Document AI Fallback (`UAT-ENT-03`)**:
   - Automatic heuristic detection of scanned photocopy PDFs (< 80 extractable characters).
   - Seamless fallback synthesis invoking Google Cloud Document AI / Vision OCR engine with turnover and bank transaction extraction.
   - Verified via `test_scanned_statement_ocr_fallback`.

4. **Asynchronous Background Task Queue & Job Tracker (`UAT-ENT-04`)**:
   - Decoupled worker threads and `JobManager` registry avoiding HTTP 504 timeouts on heavy OCR, Document AI, and Vertex AI CAM synthesis.
   - Live status polling via `GET /api/v1/jobs/{job_id}` and task inventory via `GET /api/v1/jobs`.
   - Verified via `test_asynchronous_background_job_queue`.

5. **Multi-Channel Outbound Notifications (SMS & Email Dispatch Service) (`UAT-ENT-05`)**:
   - Transactional SMS alerts (Termii Nigeria / Twilio) and official email dispatch (SendGrid / Google Workspace SMTP) on exception rework requests, offer issuances, and disbursement confirmations.
   - Comprehensive audit logging streamed to Google Cloud Logging and queryable via `GET /api/v1/telemetry/notifications`.
   - Verified via `test_multi_channel_notifications_and_telemetry`.

6. **Production Database Schema Versioning via Alembic Migrations (`UAT-ENT-06`)**:
   - Configured Alembic environment connected to canonical SQLAlchemy model metadata.
   - Initial canonical migration generated and verified with zero drift (`alembic upgrade head`).
