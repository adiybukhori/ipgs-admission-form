/**
 * IUC IPGS Admission V2 - SAC Phase 1
 * Manual physical SAC meeting + automated administration.
 *
 * Phase 1 rules:
 * - SAC portal / reviewer voting is NOT active.
 * - Meeting is conducted manually / physically.
 * - Admin records the authorised SAC result after the meeting.
 * - Direct SAC decisions: DIRECT_ENTRY / INTERNAL_ASSESSMENT / REJECTED only.
 * - PREREQUISITE can only arise later from the IA panel result.
 * - Calendar invitation support is guarded by V2_SAC_INVITE_MODE.
 * - Default invite mode is DISABLED. No email/invite is sent until explicitly configured.
 */

const V2_SAC_PHASE1_BUILD = 'SAC_MANUAL_PHASE1_V2_20260912';
const V2_SAC_PORTAL_ENABLED = false;
const V2_SAC_MEETING_MODE = 'MANUAL';
const V2_SAC_COMMITTEE_SHEET = 'SAC_COMMITTEE_MASTER';

const V2_SAC_SESSION_EXTRA_HEADERS = [
  'Meeting Mode',
  'Committee Emails',
  'Calendar Event ID',
  'Calendar Status',
  'Invitation Mode',
  'Invitation Sent At',
  'Portal Enabled',
  'Last Updated'
];

const V2_SAC_COMMITTEE_HEADERS = [
  'Name',
  'Email',
  'Role',
  'Active',
  'Default Invite',
  'Notes',
  'Created At',
  'Updated At'
];

function v2SacManualEnsureSchema_() {
  assertDevIdentity_();
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sessions = ss.getSheetByName('V2_SAC_SESSIONS');
  if (!sessions) throw new Error('V2_SAC_SESSIONS sheet not found.');

  v2EnsureHeaders_(
    sessions,
    (V2_HEADERS && V2_HEADERS.V2_SAC_SESSIONS ? V2_HEADERS.V2_SAC_SESSIONS : []).concat(V2_SAC_SESSION_EXTRA_HEADERS)
  );

  let committee = ss.getSheetByName(V2_SAC_COMMITTEE_SHEET);
  if (!committee) committee = ss.insertSheet(V2_SAC_COMMITTEE_SHEET);
  v2EnsureHeaders_(committee, V2_SAC_COMMITTEE_HEADERS);
  v2StyleHeader_(committee, V2_SAC_COMMITTEE_HEADERS.length);

  return {ok:true, portalEnabled:false, meetingMode:V2_SAC_MEETING_MODE};
}

function v2SacManualInviteMode_() {
  const mode = String(
    PropertiesService.getScriptProperties().getProperty('V2_SAC_INVITE_MODE') || 'DISABLED'
  ).trim().toUpperCase();
  return ['DISABLED','TEST','LIVE'].indexOf(mode) >= 0 ? mode : 'DISABLED';
}

function v2SacManualNormaliseEmails_(value) {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '');
  const seen = {};
  return raw
    .split(/[;,\n]+/)
    .map(function(email){ return String(email || '').trim().toLowerCase(); })
    .filter(function(email){
      if (!email || email.indexOf('@') < 1 || seen[email]) return false;
      seen[email] = true;
      return true;
    });
}

function v2SacManualActiveCommittee_() {
  v2SacManualEnsureSchema_();
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(V2_SAC_COMMITTEE_SHEET);
  const rows = v2SheetRowsFromSheet_(sheet);
  return rows.filter(function(row){
    return String(row['Active'] || '').toUpperCase() !== 'NO' && String(row['Email'] || '').trim();
  });
}

function v2SheetRowsFromSheet_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) return [];
  const values = sheet.getRange(1,1,lastRow,lastColumn).getValues();
  const headers = values.shift().map(function(v){ return String(v || '').trim(); });
  return values.filter(function(row){
    return row.some(function(v){ return String(v || '').trim() !== ''; });
  }).map(function(row){
    const obj = {};
    headers.forEach(function(header, index){ if (header) obj[header] = row[index]; });
    return obj;
  });
}

function v2CreateSacSessionManual_(data, actor) {
  assertDevIdentity_();
  v2SacManualEnsureSchema_();

  const name = v2Required_(data.name, 'SAC Name');
  const meetingDate = v2Required_(data.meetingDate, 'Meeting Date');
  const meetingTime = String(data.meetingTime || '10:00').trim();
  const chairperson = String(data.chairperson || '').trim();
  const venue = String(data.venueLink || data.venue || '').trim();

  const sessionId = String(
    data.sessionId ||
    ('SAC-' + Utilities.formatDate(new Date(meetingDate), CONFIG.timezone, 'yyyyMMdd') + '-' + Utilities.getUuid().slice(0,6).toUpperCase())
  );

  const existing = v2Find_('V2_SAC_SESSIONS', 'SAC Session ID', sessionId);
  if (existing) return {ok:true, duplicate:true, session:existing.record, invitation:{sent:false, reason:'DUPLICATE_SESSION'}};

  let committeeEmails = v2SacManualNormaliseEmails_(data.committeeEmails || []);
  if (!committeeEmails.length) {
    committeeEmails = v2SacManualActiveCommittee_()
      .filter(function(row){ return String(row['Default Invite'] || '').toUpperCase() !== 'NO'; })
      .map(function(row){ return String(row['Email'] || '').trim(); });
  }

  const now = new Date().toISOString();
  const inviteMode = v2SacManualInviteMode_();
  const row = {
    'SAC Session ID': sessionId,
    'SAC Name': name,
    'Meeting Date': meetingDate,
    'Meeting Time': meetingTime,
    'Status': 'DRAFT',
    'Chairperson': chairperson,
    'Venue / Meeting Link': venue,
    'Candidate Count': 0,
    'Minutes URL': '',
    'Endorsement URL': '',
    'Created At': now,
    'Created By': actor || 'Admin Portal V2',
    'Finalised At': '',
    'Meeting Mode': V2_SAC_MEETING_MODE,
    'Committee Emails': committeeEmails.join(', '),
    'Calendar Event ID': '',
    'Calendar Status': 'NOT_CREATED',
    'Invitation Mode': inviteMode,
    'Invitation Sent At': '',
    'Portal Enabled': 'NO',
    'Last Updated': now
  };

  v2Append_('V2_SAC_SESSIONS', row);
  v2Audit_('', 'SAC', 'CREATE_MANUAL_SESSION', {}, row, actor || 'Admin Portal V2', 'SUCCESS', 'Manual physical SAC; portal disabled.');
  v2InvalidateCache_();

  let invitation = {ok:true, sent:false, mode:inviteMode, reason:'INVITATION_DISABLED'};
  if (data.sendInvitation !== false) {
    invitation = v2SendSacCalendarInvitationManual_({sessionId:sessionId}, actor || 'Admin Portal V2');
  }

  const refreshed = v2Find_('V2_SAC_SESSIONS', 'SAC Session ID', sessionId);
  return {
    ok:true,
    duplicate:false,
    session: refreshed ? refreshed.record : row,
    invitation:invitation,
    meetingMode:V2_SAC_MEETING_MODE,
    portalEnabled:false,
    v1Touched:false
  };
}

function v2SendSacCalendarInvitationManual_(data, actor) {
  assertDevIdentity_();
  v2SacManualEnsureSchema_();

  const sessionId = v2Required_(data.sessionId, 'SAC Session ID');
  const session = v2Find_('V2_SAC_SESSIONS', 'SAC Session ID', sessionId);
  if (!session) throw new Error('SAC session not found.');

  const mode = v2SacManualInviteMode_();
  const existingEventId = String(session.record['Calendar Event ID'] || '').trim();
  if (existingEventId && data.force !== true) {
    return {ok:true, sent:false, duplicate:true, mode:mode, eventId:existingEventId, reason:'CALENDAR_EVENT_ALREADY_EXISTS'};
  }

  if (mode === 'DISABLED') {
    v2UpdateRow_(session.sheet, session.rowNumber, {
      'Invitation Mode':'DISABLED',
      'Calendar Status':'DISABLED',
      'Last Updated':new Date().toISOString()
    });
    return {ok:true, sent:false, mode:mode, reason:'INVITATION_MODE_DISABLED'};
  }

  let guests = [];
  if (mode === 'TEST') {
    const testEmail = String(PropertiesService.getScriptProperties().getProperty('V2_SAC_TEST_EMAIL') || '').trim();
    if (!testEmail) {
      v2UpdateRow_(session.sheet, session.rowNumber, {
        'Invitation Mode':'TEST',
        'Calendar Status':'TEST_EMAIL_NOT_CONFIGURED',
        'Last Updated':new Date().toISOString()
      });
      return {ok:true, sent:false, mode:mode, reason:'TEST_EMAIL_NOT_CONFIGURED'};
    }
    guests = [testEmail];
  } else {
    guests = v2SacManualNormaliseEmails_(session.record['Committee Emails'] || '');
  }

  if (!guests.length) {
    v2UpdateRow_(session.sheet, session.rowNumber, {
      'Invitation Mode':mode,
      'Calendar Status':'NO_GUESTS',
      'Last Updated':new Date().toISOString()
    });
    return {ok:true, sent:false, mode:mode, reason:'NO_COMMITTEE_EMAILS'};
  }

  const meetingDate = String(session.record['Meeting Date'] || '').trim();
  const meetingTime = String(session.record['Meeting Time'] || '10:00').trim();
  const start = Utilities.parseDate(meetingDate + ' ' + meetingTime, CONFIG.timezone, 'yyyy-MM-dd HH:mm');
  const durationMinutes = Number(data.durationMinutes || 60);
  const end = new Date(start.getTime() + Math.max(15, durationMinutes) * 60000);
  const titlePrefix = mode === 'TEST' ? '[TEST] ' : '';
  const title = titlePrefix + String(session.record['SAC Name'] || sessionId);
  const venue = String(session.record['Venue / Meeting Link'] || '').trim();
  const description = [
    'IUC / IPGS Student Admission Committee (SAC)',
    'Meeting mode: Manual / Physical',
    'SAC Portal: Not active',
    'Session ID: ' + sessionId,
    'Candidate list and agenda will be managed by IPGS / Registry.'
  ].join('\n');

  const event = CalendarApp.getDefaultCalendar().createEvent(title, start, end, {
    description: description,
    location: venue,
    guests: guests.join(','),
    sendInvites: true
  });

  const now = new Date().toISOString();
  const eventId = String(event.getId() || '');
  v2UpdateRow_(session.sheet, session.rowNumber, {
    'Calendar Event ID':eventId,
    'Calendar Status':'INVITED',
    'Invitation Mode':mode,
    'Invitation Sent At':now,
    'Last Updated':now
  });

  v2Audit_('', 'SAC', 'SEND_CALENDAR_INVITATION', {}, {
    sessionId:sessionId,
    mode:mode,
    guestCount:guests.length,
    eventId:eventId
  }, actor || 'Admin Portal V2', 'SUCCESS', 'Calendar invitation sent.');
  v2InvalidateCache_();

  return {ok:true, sent:true, mode:mode, eventId:eventId, guestCount:guests.length, emailSent:true, v1Touched:false};
}

function v2RecordSacDecisionManual_(data, actor) {
  assertDevIdentity_();
  const sessionId = v2Required_(data.sessionId, 'SAC Session ID');
  const reference = v2Required_(data.referenceNo, 'Reference No');
  const decision = v2Required_(data.decision, 'SAC Decision');

  if (['DIRECT_ENTRY','INTERNAL_ASSESSMENT','REJECTED'].indexOf(decision) < 0) {
    throw new Error('Phase 1 SAC decision must be DIRECT_ENTRY, INTERNAL_ASSESSMENT or REJECTED. Prerequisite is only allowed after IA.');
  }
  if (data.confirmed !== true) throw new Error('Explicit SAC final decision confirmation is required.');

  const session = v2Find_('V2_SAC_SESSIONS', 'SAC Session ID', sessionId);
  if (!session) throw new Error('SAC session not found.');

  const candidate = v2FindComposite_('V2_SAC_CANDIDATES', ['SAC Session ID','Reference No'], [sessionId,reference]);
  if (!candidate) throw new Error('SAC candidate not found.');

  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  if (!workflow) throw new Error('V2 workflow record not found.');
  if (String(workflow.record['Application Stage'] || '') !== 'SAC_REVIEW') {
    throw new Error('SAC decision can only be finalised during SAC_REVIEW stage.');
  }

  const now = new Date().toISOString();
  const nextStage = decision === 'DIRECT_ENTRY' ? 'ELIGIBLE_FOR_OFFER' :
    decision === 'INTERNAL_ASSESSMENT' ? 'INTERNAL_ASSESSMENT' : 'REJECTED';
  const letterAction = decision === 'DIRECT_ENTRY' ? 'OFFER_READY' :
    decision === 'INTERNAL_ASSESSMENT' ? 'COL_IA_READY' : 'DECISION_NOTICE_READY';

  v2UpdateRow_(candidate.sheet, candidate.rowNumber, {
    'Decision':decision,
    'Priority':data.priority || candidate.record['Priority'] || 'NORMAL',
    'Reviewer Remarks':String(data.remarks || ''),
    'Decision At':now,
    'Decision By':actor || 'Admin Portal V2',
    'Letter Action':letterAction
  });

  v2UpdateRow_(workflow.sheet, workflow.rowNumber, {
    'SAC Decision':decision,
    'SAC Endorsed At':now,
    'Application Stage':nextStage,
    'Assessment Status':decision === 'INTERNAL_ASSESSMENT' ? 'ACCOUNT_PENDING' : 'NOT_REQUIRED',
    'Prerequisite Status':'NOT_REQUIRED',
    'Last Updated':now,
    'Updated By':actor || 'Admin Portal V2'
  });

  if (decision === 'INTERNAL_ASSESSMENT') {
    v2CreateAssessmentAccount_(workflow.record, actor || 'Admin Portal V2');
  }

  v2Audit_(reference, 'SAC', 'RECORD_MANUAL_DECISION', candidate.record, {
    decision:decision,
    nextStage:nextStage,
    letterAction:letterAction,
    meetingMode:V2_SAC_MEETING_MODE,
    portalEnabled:false
  }, actor || 'Admin Portal V2', 'SUCCESS', String(data.remarks || ''));
  v2InvalidateCache_();

  return {
    ok:true,
    referenceNo:reference,
    decision:decision,
    nextStage:nextStage,
    letterAction:letterAction,
    meetingMode:V2_SAC_MEETING_MODE,
    portalEnabled:false,
    reviewerVoteRequired:false,
    explicitlyConfirmed:true,
    emailSent:false,
    v1Touched:false
  };
}

function v2FinalizeSacSessionManual_(data, actor) {
  assertDevIdentity_();
  const sessionId = v2Required_(data.sessionId, 'SAC Session ID');
  if (data.confirmed !== true) throw new Error('Explicit SAC session finalisation confirmation is required.');

  const finalised = v2FinalizeSacSession_({sessionId:sessionId, confirmed:true}, actor || 'Admin Portal V2');
  let documents = null;
  if (data.generateDocuments !== false) {
    documents = v2GenerateSacMinutesEndorsement_({sessionId:sessionId, confirmed:true}, actor || 'Admin Portal V2');
  }
  return {
    ok:true,
    sessionId:sessionId,
    finalised:finalised,
    documents:documents,
    meetingMode:V2_SAC_MEETING_MODE,
    portalEnabled:false,
    v1Touched:false
  };
}

function v2SacManualPhase1Status_() {
  return {
    ok:true,
    build:V2_SAC_PHASE1_BUILD,
    meetingMode:V2_SAC_MEETING_MODE,
    portalEnabled:V2_SAC_PORTAL_ENABLED,
    invitationMode:v2SacManualInviteMode_(),
    allowedFinalDecisions:['DIRECT_ENTRY','INTERNAL_ASSESSMENT','REJECTED'],
    prerequisitePolicy:'AFTER_IA_ONLY'
  };
}
