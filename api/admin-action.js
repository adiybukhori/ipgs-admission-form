const ADMIN_BRIDGE = 'https://anasbukhori.app.n8n.cloud/webhook/iuc-admission-v2-admin-bridge';

const ALLOWED_ACTIONS = new Set([
  'v2ListWorkflow','v2UpsertFeeStructure','v2SetFeeStructureStatus','v2UpsertAgent','v2AgentAdminStatus','v2UpdateStage','v2RunDocumentReview','v2RegeneratePgAdm01','v2CompleteManualDocumentReview','v2RunQualificationScreening','v2RunAutoAiScreening','v2CompleteManualQualificationScreening','v2RecordAiScreeningResult','v2ConfirmAiScreening','v2GenerateAiScreeningReport','v2RunComplianceDocumentQuality','v2SendDocumentReplacementRequest','v2SendMissingDocumentRequest','v2PrepareSacCoordination','v2PrepareIaCoordination','v2PreparePrerequisiteCoordination','v2PrepareOrientationForAccepted','v2RunOrientationSessionSupervisor','v2PrepareSkyActivation','v2PrepareAcademicHandover','v2PrepareStudentAccessDelivery','v2RunManagementIntelligence','v2AgenticStatus','v2GetAgentCaseState','v2AgentActionGateway','v2RecordAgentActivity','v2CreateHumanTask','v2ResolveHumanTask','v2ListOpenHumanTasks',
  'v2IssueOffer','v2PrepareAcceptancePack','v2ResendAcceptanceConfirmation','v2CreateSacSession','v2AssignSacCandidate','v2PrepareSacPack','v2GetSacPackFile','v2SaveSacPackPdf','v2ListSacCandidates','v2RecordSacDecision','v2CreateSacSessionManual','v2UpdateSacSessionManual','v2DeleteSacSessionManual','v2SendSacCalendarInvitationManual','v2RecordSacDecisionManual','v2FinalizeSacSessionManual','v2SacManualPhase1Status','v2SacResultStatus','v2PrepareSacResultDocument','v2PreviewSacResult','v2SendSacResultEmail','v2UpdateAssessment','v2CreateOrientationSession','v2AssignOrientationBatch','v2SendOrientationInvitation','v2RemoveOrientationStudent','v2MoveOrientationStudent','v2UpdateOrientationAttendance','v2SendOrientationReminderNow','v2EndOrientationSession','v2EditOrientationSession','v2OpenOrientationAttendance','v2CloseOrientationAttendance','v2SetOrientationRecording','v2SendOrientationRecording','v2OrientationCompletionAssessment','v2CompleteOrientationAndGenerateReport','v2RegenerateOrientationReport','v2GetOrientationReportFile','v2CreateHandoverSession','v2AddHandoverStudents','v2SendHandoverSession','v2CreateAcademicHandoverBatch','v2ResendAcademicHandoverEmail','v2UpdateProvisioningTask','v2ResendProvisioningTaskEmails','v2SendStudentProvisioningAccess','v2RegistryUpsertProspect','v2RefreshFeeStructure','v2NotifyRegistryProspectReady','v2ActivateStudentInSky'
]);

async function callV2(action, data, password, sessionId, updatedBy) {
  const startedAt = Date.now();
  const response = await fetch(ADMIN_BRIDGE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password: String(password || ''),
      sessionId: String(sessionId || ''),
      action,
      data: data || {},
      updatedBy: updatedBy || 'Admin Portal V2'
    }),
    redirect: 'follow'
  });

  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (_) { throw new Error(`Admin bridge returned HTTP ${response.status}.`); }

  if (!response.ok || !parsed || parsed.ok === false) {
    const error = new Error(parsed?.message || `Admin bridge returned HTTP ${response.status}.`);
    error.code = response.status === 401 ? 'ADMIN_AUTH_FAILED' : 'V2_ACTION_FAILED';
    throw error;
  }
  return { parsed, bridgeMs: Date.now() - startedAt };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed.' });

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }

  const action = String(body.action || '');
  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ ok: false, message: 'Unsupported or unapproved Admin V2 action.' });
  }

  const password = String(body.password || '');
  if (!password) return res.status(401).json({ ok: false, message: 'Admin password is required.' });

  const startedAt = Date.now();
  try {
    const { parsed: result, bridgeMs } = await callV2(action, body.data || {}, password, body.sessionId, body.updatedBy);
    const totalMs = Date.now() - startedAt;
    res.setHeader('Server-Timing', `bridge;dur=${bridgeMs}, total;dur=${totalMs}`);
    return res.status(200).json({ ok: true, action, result, performance: { bridgeMs, totalMs } });
  } catch (error) {
    return res.status(error?.code === 'ADMIN_AUTH_FAILED' ? 401 : 502).json({
      ok: false,
      code: error?.code || 'V2_ACTION_FAILED',
      message: error?.message || 'Unable to complete the Admin V2 action.'
    });
  }
}
