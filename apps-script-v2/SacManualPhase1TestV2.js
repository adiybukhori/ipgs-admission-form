/**
 * Public controlled test entry points for SAC Manual Phase 1.
 * Safe test functions only. No session creation, no calendar invitations, no email, no V1 writes.
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

/**
 * Controlled schema readiness test for SAC Manual Phase 1.
 * This may add missing V2 SAC headers and create/repair SAC_COMMITTEE_MASTER only.
 * It does not create a SAC session, send invitations/email, or touch V1.
 */
function v2SacManualPhase1SchemaControlledTest() {
  assertDevIdentity_();

  const status = v2SacManualPhase1Status_();
  if (status.invitationMode !== 'DISABLED') {
    throw new Error('Controlled SAC schema test requires V2_SAC_INVITE_MODE=DISABLED.');
  }

  v2SacManualEnsureSchema_();

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sessions = ss.getSheetByName('V2_SAC_SESSIONS');
  const committee = ss.getSheetByName(V2_SAC_COMMITTEE_SHEET);
  if (!sessions) throw new Error('V2_SAC_SESSIONS sheet not found after schema ensure.');
  if (!committee) throw new Error('SAC_COMMITTEE_MASTER sheet not found after schema ensure.');

  function headerSet_(sheet) {
    const lastColumn = Math.max(1, sheet.getLastColumn());
    const values = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    const set = {};
    values.forEach(function(value) {
      const key = String(value || '').trim();
      if (key) set[key] = true;
    });
    return set;
  }

  const sessionHeaders = headerSet_(sessions);
  const committeeHeaders = headerSet_(committee);
  const missingSessionHeaders = V2_SAC_SESSION_EXTRA_HEADERS.filter(function(header) { return !sessionHeaders[header]; });
  const missingCommitteeHeaders = V2_SAC_COMMITTEE_HEADERS.filter(function(header) { return !committeeHeaders[header]; });

  const checks = {
    sessionSheetExists: !!sessions,
    committeeSheetExists: !!committee,
    sessionExtraHeadersReady: missingSessionHeaders.length === 0,
    committeeHeadersReady: missingCommitteeHeaders.length === 0,
    invitationDisabled: status.invitationMode === 'DISABLED',
    portalDisabled: status.portalEnabled === false,
    meetingModeManual: status.meetingMode === 'MANUAL'
  };

  const report = {
    ok: Object.keys(checks).every(function(key) { return checks[key] === true; }),
    checks: checks,
    missingSessionHeaders: missingSessionHeaders,
    missingCommitteeHeaders: missingCommitteeHeaders,
    emailSent: false,
    calendarInviteSent: false,
    sessionCreated: false,
    v1Touched: false
  };
  Logger.log(JSON.stringify(report));
  return report;
}
