/**
 * OFL Credit Automation API Service Client
 */
const API_BASE = '/api/v1';

export async function fetchCases(params: { stage?: string; channel?: string; search?: string } = {}) {
  const query = new URLSearchParams();
  if (params.stage && params.stage !== 'ALL') query.append('stage', params.stage);
  if (params.channel && params.channel !== 'ALL') query.append('channel', params.channel);
  if (params.search) query.append('search', params.search);
  
  const res = await fetch(`${API_BASE}/cases?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch credit cases');
  return res.json();
}

export async function fetchCaseWorkspace(caseId: string) {
  const res = await fetch(`${API_BASE}/cases/${caseId}`);
  if (!res.ok) throw new Error(`Failed to load case workspace for ${caseId}`);
  return res.json();
}

export async function submitDirectApplication(data: any) {
  const res = await fetch(`${API_BASE}/intake/direct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function submitBestoPayload(payload: any) {
  const res = await fetch(`${API_BASE}/intake/besto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function fetchQuarantinedBesto() {
  const res = await fetch(`${API_BASE}/intake/besto/quarantine`);
  if (!res.ok) throw new Error('Failed to fetch quarantine list');
  return res.json();
}

export async function generateAICam(caseId: string, actor: string = 'Credit Analyst') {
  const res = await fetch(`${API_BASE}/cases/${caseId}/cam/generate?actor=${encodeURIComponent(actor)}`, {
    method: 'POST'
  });
  if (!res.ok) throw new Error('Failed to generate AI CAM');
  return res.json();
}

export async function updateCam(caseId: string, versionId: string, data: any) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/cam/${versionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to update CAM');
  return res.json();
}

export async function submitApprovalDecision(caseId: string, data: { decision: string; actor: string; role: string; comments: string; conditions_mandated?: string[] }) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function generateOffer(caseId: string, data: any) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/offer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Failed to generate offer');
  return res.json();
}

export async function takeOfferAction(caseId: string, action: 'ACCEPT' | 'REJECT' | 'RENEGOTIATE', evidence?: string) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/offer/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, acceptance_evidence: evidence })
  });
  if (!res.ok) throw new Error(`Failed to execute offer action ${action}`);
  return res.json();
}

export async function updateCondition(caseId: string, conditionId: string, status: string, verifiedBy: string) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/conditions/${conditionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, verified_by: verifiedBy })
  });
  if (!res.ok) throw new Error('Failed to update condition');
  return res.json();
}

export async function confirmNavDisbursement(caseId: string, data: { nav_reference: string; amount: number; confirmation_evidence: string; actor: string }) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/treasury/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function syncLoanDisc(caseId: string) {
  const res = await fetch(`${API_BASE}/cases/${caseId}/treasury/sync-loandisc`, {
    method: 'POST'
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function fetchExceptions(params?: { status?: string; category?: string; caseId?: string }) {
  const query = new URLSearchParams();
  if (params?.status) query.set('status_filter', params.status);
  if (params?.category) query.set('category_filter', params.category);
  if (params?.caseId) query.set('case_id_filter', params.caseId);
  const res = await fetch(`${API_BASE}/exceptions?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch exceptions');
  return res.json();
}

export async function raiseException(data: {
  case_id: string;
  category: string;
  originator_role: string;
  originator_name?: string;
  reason: string;
  comments?: string;
  sla_hours?: number;
  action_payload?: any;
}) {
  const res = await fetch(`${API_BASE}/exceptions/raise`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function takeExceptionAction(exceptionId: string, actionData: {
  action_type: string;
  actor: string;
  decision?: string;
  notes?: string;
  details?: any;
}) {
  const res = await fetch(`${API_BASE}/exceptions/${exceptionId}/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(actionData)
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function resolveException(exceptionId: string, payload: {
  resolution_notes: string;
  resolved_by: string;
  return_to_stage?: string;
  is_material_change?: boolean;
  resolution_category?: string;
}) {
  const res = await fetch(`${API_BASE}/exceptions/${exceptionId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function respondToApplicantException(caseNumber: string, data: {
  exception_id?: string;
  notes: string;
  documents?: Array<{ name: string; type: string; summary?: string }>;
}) {
  const res = await fetch(`${API_BASE}/intake/track/${encodeURIComponent(caseNumber.trim())}/respond-exception`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function fetchTelemetry() {
  const [overviewRes, aiCostRes, infraRes] = await Promise.all([
    fetch(`${API_BASE}/telemetry/overview`),
    fetch(`${API_BASE}/telemetry/ai-costs`),
    fetch(`${API_BASE}/telemetry/gcp-infrastructure`)
  ]);
  const overview = await overviewRes.json();
  const aiCost = await aiCostRes.json();
  const infrastructure = infraRes.ok ? await infraRes.json() : null;
  return { overview, aiCost, infrastructure };
}

export async function fetchAuditEvents() {
  const res = await fetch(`${API_BASE}/audit?limit=40`);
  if (!res.ok) throw new Error('Failed to fetch audit events');
  return res.json();
}

export async function uploadBankStatement(caseId: string, file: File, actor: string = 'Credit Analyst') {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/cases/${caseId}/bank-statements/upload?actor=${encodeURIComponent(actor)}`, {
    method: 'POST',
    body: formData
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function analyzeDemoBankStatement(caseId: string, bankPreset: string = 'UBA_HAULAGE', actor: string = 'Credit Analyst') {
  const res = await fetch(`${API_BASE}/cases/${caseId}/bank-statements/analyze-demo?bank_preset=${encodeURIComponent(bankPreset)}&actor=${encodeURIComponent(actor)}`, {
    method: 'POST'
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function applyStatementToFinancials(caseId: string, documentId: string, actor: string = 'Credit Analyst') {
  const res = await fetch(`${API_BASE}/cases/${caseId}/bank-statements/${documentId}/apply-to-financials?actor=${encodeURIComponent(actor)}`, {
    method: 'POST'
  });
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}

export async function trackApplication(caseNumber: string) {
  const res = await fetch(`${API_BASE}/intake/track/${encodeURIComponent(caseNumber.trim())}`);
  const json = await res.json();
  if (!res.ok) throw json;
  return json;
}
