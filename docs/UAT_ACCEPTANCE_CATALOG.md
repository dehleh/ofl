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
