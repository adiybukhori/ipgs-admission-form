/**
 * Public controlled test entry point for SAC Manual Phase 1.
 * Read-only: does not create sessions, send calendar invitations, send email, or touch V1.
 */
function v2SacManualPhase1ControlledTest() {
  assertDevIdentity_();
  const status = v2SacManualPhase1Status_();
  const checks = {
    meetingModeManual: status.meetingMode === 'MANUAL',
    portalDisabled: status.portalEnabled === false,
    invitationDisabled: status.invitationMode === 'DISABLED',
    directEntryAllowed: status.allowedFinalDecisions.indexOf('DIRECT_ENTRY') >= 0,
    internalAssessmentAllowed: status.allowedFinalDecisions.indexOf('INTERNAL_ASSESSMENT') >= 0,
    rejectedAllowed: status.allowedFinalDecisions.indexOf('REJECTED') >= 0,
    prerequisiteNotDirect: status.allowedFinalDecisions.indexOf('PREREQUISITE') < 0,
    prerequisiteAfterIaOnly: status.prerequisitePolicy === 'AFTER_IA_ONLY'
  };

  const report = {
    ok: Object.keys(checks).every(function(key) { return checks[key] === true; }),
    status: status,
    checks: checks,
    emailSent: false,
    calendarInviteSent: false,
    v1Touched: false
  };
  Logger.log(JSON.stringify(report));
  return report;
}
