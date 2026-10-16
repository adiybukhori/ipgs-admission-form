// Backend authentication is independent of staff login and LOA credentials.
const V2_WORKFLOW_AUTH_BUILD = 'WORKFLOW_SERVICE_AUTH_20261016';
const V2_WORKFLOW_SERVICE_TOKEN_SHA256 = 'd9a34cbabd9837aacd51a07b817674c629926ea56fd283a05114c3ee142505a8';
const V2_WORKFLOW_SERVICE_ACTIONS = ["v2ListWorkflow","v2UpsertFeeStructure","v2SetFeeStructureStatus","v2UpsertAgent","v2AgentAdminStatus","v2UpdateStage","v2RunDocumentReview","v2RegeneratePgAdm01","v2CompleteManualDocumentReview","v2RunQualificationScreening","v2RunAutoAiScreening","v2CompleteManualQualificationScreening","v2RecordAiScreeningResult","v2ConfirmAiScreening","v2GenerateAiScreeningReport","v2RunComplianceDocumentQuality","v2SendDocumentReplacementRequest","v2SendMissingDocumentRequest","v2PrepareSacCoordination","v2PrepareIaCoordination","v2PreparePrerequisiteCoordination","v2PrepareOrientationForAccepted","v2RunOrientationSessionSupervisor","v2PrepareSkyActivation","v2PrepareAcademicHandover","v2PrepareStudentAccessDelivery","v2RunManagementIntelligence","v2AgenticStatus","v2GetAgentCaseState","v2AgentActionGateway","v2RecordAgentActivity","v2CreateHumanTask","v2ResolveHumanTask","v2ListOpenHumanTasks","v2IssueOffer","v2LoaDiagnostics","v2PrepareAcceptancePack","v2ResendAcceptanceConfirmation","v2CreateSacSession","v2AssignSacCandidate","v2RemoveSacCandidate","v2PrepareSacPack","v2PrepareSacPackAsync","v2GetSacPackPrepareStatus","v2GetSacPackFile","v2SaveSacPackPdf","v2ListSacCandidates","v2RecordSacDecision","v2CreateSacSessionManual","v2UpdateSacSessionManual","v2DeleteSacSessionManual","v2SendSacCalendarInvitationManual","v2RecordSacDecisionManual","v2FinalizeSacSessionManual","v2SacManualPhase1Status","v2SacResultStatus","v2PrepareSacResultDocument","v2PreviewSacResult","v2SendSacResultEmail","v2UpdateAssessment","v2CreateOrientationSession","v2AssignOrientationBatch","v2SendOrientationInvitation","v2RemoveOrientationStudent","v2MoveOrientationStudent","v2UpdateOrientationAttendance","v2SendOrientationReminderNow","v2EndOrientationSession","v2EditOrientationSession","v2OpenOrientationAttendance","v2CloseOrientationAttendance","v2SetOrientationRecording","v2SendOrientationRecording","v2OrientationCompletionAssessment","v2CompleteOrientationAndGenerateReport","v2RegenerateOrientationReport","v2GetOrientationReportFile","v2CreateHandoverSession","v2AddHandoverStudents","v2SendHandoverSession","v2CreateAcademicHandoverBatch","v2ResendAcademicHandoverEmail","v2UpdateProvisioningTask","v2ResendProvisioningTaskEmails","v2SendStudentProvisioningAccess","v2RegistryUpsertProspect","v2RefreshFeeStructure","v2NotifyRegistryProspectReady","v2ActivateStudentInSky","v2SetApplicationAgent","v2MoveApplicationToActivated","v2ReturnApplicationFromActivated","v2ConfirmSkyActivationInAcc","v2WorkflowDiagnostics","v2Bootstrap"];
function v2VerifyWorkflowServiceAccess_(token, action) {
  if (V2_WORKFLOW_SERVICE_ACTIONS.indexOf(String(action || '')) < 0) return false;
  const value = String(token || '').trim();
  if (!/^[a-f0-9]{64}$/.test(value)) return false;
  const hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8)
    .map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  return hash === V2_WORKFLOW_SERVICE_TOKEN_SHA256;
}
function v2WorkflowDiagnostics_() {
  assertDevIdentity_();
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheets = ['V2_APPLICATIONS','V2_WORKFLOW','V2_SAC_SESSIONS','V2_ASSESSMENT_PROGRESS',
    'V2_ORIENTATION_SESSIONS','V2_ORIENTATION_TRACKING','V2_PROVISIONING','V2_AUDIT_LOG'];
  const readiness = {};
  sheets.forEach(function(name) { readiness[name] = !!ss.getSheetByName(name); });
  const id = 'ORI-UAT-AUTH-20261016';
  const rows = v2Rows_('V2_ORIENTATION_SESSIONS').filter(function(r) { return String(r['Orientation Session ID']) === id; });
  const r = rows[0] || {};
  const tracking = v2Rows_('V2_ORIENTATION_TRACKING').filter(function(r) { return String(r['Orientation Session ID']) === id; });
  let reminderAutomation = 'UNAVAILABLE';
  try { reminderAutomation = ScriptApp.getProjectTriggers().some(function(t) {
    return t.getHandlerFunction() === V2_ORIENTATION_REMINDER_HANDLER;
  }) ? 'ACTIVE' : 'NOT_INSTALLED'; } catch (_) {}
  return {ok:true,build:V2_WORKFLOW_AUTH_BUILD,sheets:readiness,
    handlers:{orientation:typeof v2CreateOrientationSession_==='function',offer:typeof v2IssueOffer_==='function',
      acceptance:typeof v2AcceptancePackEnsureReviewDocs_==='function',ia:typeof v2PrepareIaCoordination_==='function',
      handover:typeof v2CreateHandoverSession_==='function',sac:typeof v2CreateSacSessionManual_==='function'},
    reminderAutomation:reminderAutomation,
    orientationVerification:{sessionId:id,rowCount:rows.length,name:r['Orientation Name']||'',
      status:r.Status||'',date:r['Session Date']||'',assignedCount:tracking.length},
    realStudentsChanged:false};
}
