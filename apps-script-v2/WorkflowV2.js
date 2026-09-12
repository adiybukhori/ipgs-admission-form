/**
 * IUC IPGS Admission V2 - workflow foundation.
 * Add as a separate Apps Script file. Existing admission generation remains isolated.
 */

const V2_BUILD = 'ADMISSION_V2_WORKFLOW_20260908';
const V2_CACHE_TTL_SECONDS = 300;

const V2_SHEETS = Object.freeze({
  applications: 'V2_APPLICATIONS',
  workflow: 'V2_WORKFLOW',
  intakeMaster: 'V2_INTAKE_MASTER',
  intakeApplications: 'V2_INTAKE_APPLICATIONS',
  sacSessions: 'V2_SAC_SESSIONS',
  sacCandidates: 'V2_SAC_CANDIDATES',
  assessmentAccounts: 'V2_ASSESSMENT_ACCOUNTS',
  assessmentProgress: 'V2_ASSESSMENT_PROGRESS',
  orientationSessions: 'V2_ORIENTATION_SESSIONS',
  orientationTracking: 'V2_ORIENTATION_TRACKING',
  provisioning: 'V2_PROVISIONING',
  academicPortal: 'V2_ACADEMIC_PORTAL',
  audit: 'V2_AUDIT_LOG'
});

const V2_HEADERS = Object.freeze({
  V2_APPLICATIONS: [
    'Reference No','Submitted At','Applicant Type','Student Name','ID / Passport No',
    'Personal Email','Phone Number','Programme','Level of Study','Study Mode','Intake',
    'Intake ID','Entry Qualification Type','Highest Qualification','Institution / Awarding Body',
    'Field of Study','Academic Result / CGPA / Grade','Transfer Applicant','Agent Code',
    'Agent Name','Agent Email',
    'Prospect Status','SKY Prospect ID','Fee Group','Prospect Updated At','Prospect Remarks',
    'Student Folder URL','Admission Form PDF URL',
    'Uploaded Files JSON','Raw Application JSON','Application Status','Email Status',
    'Last Updated','Version'
  ],
  V2_WORKFLOW: [
    'Reference No','Student Name','ID / Passport No','Personal Email','Innovative Email',
    'Programme','Level of Study','Intake','Application Stage','Application Status',
    'Document Review Status','Document Reviewed At','Document Reviewed By','Missing Document Count',
    'Qualification Screening Status',
    'Field Classification',
    'Relevant Work Experience',
    'Qualification Rule Code',
    'Qualification Screened At',
    'Qualification Screened By',
    'Manual Review Required',

    'Screening Recommendation',
    'Prospect Status','SKY Prospect ID','Fee Group','Prospect Updated At',
    'SAC Session ID','SAC Decision','SAC Endorsed At',
    'Assessment Status','Prerequisite Status','Offer Letter Status','Offer Letter Issued At',
    'Acceptance Status','Orientation Session ID','Orientation Status','Provisioning Status',
    'Academic Handover Status','Student Folder URL','Last Updated','Updated By','Version'
  ],
  V2_INTAKE_MASTER: [
    'Intake ID','Intake Name','Start Date','Application Open','Application Close','Status',
    'Default Orientation Session ID','Notes','Created At','Created By','Updated At'
  ],
  V2_INTAKE_APPLICATIONS: [
    'Intake ID','Reference No','Student Name','Programme','Application Stage','Priority',
    'Deferred','Deferred To Intake ID','Last Updated'
  ],
  V2_SAC_SESSIONS: [
    'SAC Session ID','SAC Name','Meeting Date','Meeting Time','Status','Chairperson',
    'Venue / Meeting Link','Candidate Count','Minutes URL','Endorsement URL','Created At',
    'Created By','Finalised At'
  ],
  V2_SAC_CANDIDATES: [
    'SAC Session ID','Reference No','Student Name','Programme','Form 01 URL',
    'Transcript URL','Certificate URL','Screening Recommendation','Decision','Priority',
    'Reviewer Remarks','Decision At','Decision By','Letter Action','Letter Issued At'
  ],
    V2_SAC_VOTES: [
    'SAC Session ID',
    'Reference No',
    'Student Name',
    'Programme',
    'Reviewer',
    'Vote',
    'Reviewer Remarks',
    'Voted At',
    'Vote Status',
    'Last Updated'
  ],
  V2_ASSESSMENT_ACCOUNTS: [
    'Reference No',
    'Student Name',
    'ID / Passport No',
    'Personal Email',
    'Login ID',

    'Password Hash',
    'Password Updated At',

    'Account Status',
    'Activated At',
    'Last Login At',
    'Created At',
    'Created By'
  ],
  V2_ASSESSMENT_PROGRESS: [
    'Reference No','Assessment Type','Sequence','Component','Status','Submission URL',
    'Interview Slot','Calendar Event ID','Panel Result','Panel Remarks','Completed At',
    'Verified By','Next Action','Last Updated'
  ],
  V2_ORIENTATION_SESSIONS: [
    'Orientation Session ID','Intake ID','Programme Group','Session Date','Start Time',
    'End Time','Meeting Link','Feedback Form URL','Recording URL','Registrar Community URL',
    'Programme Community URL','Status','Created At','Created By'
  ],
  V2_ORIENTATION_TRACKING: [
    'Orientation Session ID','Reference No','Student Name','Programme','Invitation Status',
    'Feedback Submitted','Attendance Status','Feedback Submitted At','Recording Email Status',
    'Community Email Status','Academic Handover Status','Last Updated'
  ],
  V2_PROVISIONING: [
    'Reference No','Student Name','ID / Passport No','Personal Email','Innovative Email',
    'IT Email Status','IT Completed At','IT Completed By','E-Library Status',
    'E-Library Completed At','E-Library Completed By','Moodle Status','Moodle Login Email',
    'Moodle Completed At','Moodle Completed By','Student Notification Status',
    'Student Notified At','Last Updated','Remarks'
  ],
  V2_ACADEMIC_PORTAL: [
    'Reference No','Student ID','Student Name','Programme','Portal Login Email','Portal Status',
    'Current Academic Stage','Current Semester','Subjects Completed JSON',
    'Subjects Current JSON','Subjects Next JSON','Research Milestone','Academic PIC',
    'Activated At','Last Updated'
  ],
  V2_AUDIT_LOG: [
    'Timestamp','Event ID','Reference No','Module','Action','Previous Value JSON',
    'New Value JSON','Actor','Result','Remarks','Build Version'
  ]
});

const V2_STAGES = Object.freeze([
  'APPLICATION_RECEIVED','DOCUMENT_REVIEW','QUALIFICATION_SCREENING','READY_FOR_SAC','SAC_REVIEW',
  'INTERNAL_ASSESSMENT','PREREQUISITE','ELIGIBLE_FOR_OFFER','OFFER_ISSUED',
  'ACCEPTANCE_PENDING','ACCEPTED','ORIENTATION','PROVISIONING',
  'ACADEMIC_HANDOVER','ACTIVE_STUDENT','REJECTED','WITHDRAWN'
]);

const V2_ALLOWED_TRANSITIONS = Object.freeze({
  APPLICATION_RECEIVED: ['DOCUMENT_REVIEW','WITHDRAWN'],
  DOCUMENT_REVIEW: [
  'QUALIFICATION_SCREENING',
  'APPLICATION_RECEIVED',
  'REJECTED',
  'WITHDRAWN'
  ],

  QUALIFICATION_SCREENING: [
    'READY_FOR_SAC',
    'DOCUMENT_REVIEW',
    'REJECTED',
    'WITHDRAWN'
  ],

  READY_FOR_SAC: [
    'SAC_REVIEW',
    'QUALIFICATION_SCREENING',
    'DOCUMENT_REVIEW',
    'WITHDRAWN'
  ],
  SAC_REVIEW: ['INTERNAL_ASSESSMENT','ELIGIBLE_FOR_OFFER','REJECTED','WITHDRAWN'],
  INTERNAL_ASSESSMENT: ['PREREQUISITE','ELIGIBLE_FOR_OFFER','REJECTED','WITHDRAWN'],
  PREREQUISITE: ['ELIGIBLE_FOR_OFFER','REJECTED','WITHDRAWN'],
  ELIGIBLE_FOR_OFFER: ['OFFER_ISSUED','WITHDRAWN'],
  OFFER_ISSUED: ['ACCEPTANCE_PENDING','ACCEPTED','WITHDRAWN'],
  ACCEPTANCE_PENDING: ['ACCEPTED','WITHDRAWN'],
  ACCEPTED: ['ORIENTATION','PROVISIONING','WITHDRAWN'],
  ORIENTATION: ['PROVISIONING','ACADEMIC_HANDOVER','WITHDRAWN'],
  PROVISIONING: ['ACADEMIC_HANDOVER','WITHDRAWN'],
  ACADEMIC_HANDOVER: ['ACTIVE_STUDENT','WITHDRAWN'],
  ACTIVE_STUDENT: ['WITHDRAWN'],
  REJECTED: [],
  WITHDRAWN: []
});

function v2SetupFoundation() {
  assertDevIdentity_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
    const created = [];
    const checked = [];
    Object.keys(V2_HEADERS).forEach(function(name) {
      let sheet = ss.getSheetByName(name);
      if (!sheet) {
        sheet = ss.insertSheet(name);
        created.push(name);
      }
      v2EnsureHeaders_(sheet, V2_HEADERS[name]);
      v2StyleHeader_(sheet, V2_HEADERS[name].length);
      checked.push(name);
    });
    v2SeedDefaults_(ss);
    v2Audit_('', 'SYSTEM', 'SETUP_FOUNDATION', {}, {created: created, checked: checked}, 'Apps Script Editor', 'SUCCESS', '');
    v2InvalidateCache_();
    const report = {ok: true, build: V2_BUILD, created: created, checked: checked, emailSent: false};
    Logger.log(JSON.stringify(report));
    return report;
  } finally {
    lock.releaseLock();
  }
}

/** Read-only migration report. Safe to run from the Apps Script editor. */
function v2PreviewMigrationFromEditor() {
  assertDevIdentity_();
  const report = v2BuildMigrationPlan_();
  const result = {
    ok: true,
    build: V2_BUILD,
    dryRun: true,
    sourceRows: report.sourceRows,
    eligible: report.eligible.length,
    alreadySynced: report.alreadySynced.length,
    skipped: report.skipped,
    duplicateReferences: report.duplicateReferences,
    emailSent: false
  };
  Logger.log(JSON.stringify(result));
  return result;
}

/**
 * Idempotent batch migration. This writes only to V2 sheets and never changes
 * ADMISSION_RESPONSE. Run only after reviewing v2PreviewMigrationFromEditor().
 */
function v2MigrateExistingApplicationsFromEditor() {
  assertDevIdentity_();
  if (!v2FoundationReady_()) throw new Error('Run v2SetupFoundation first.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const plan = v2BuildMigrationPlan_();
    const migrated = [];
    const failed = [];
    plan.eligible.forEach(function(item) {
      try {
        const result = v2SyncApplication_({referenceNo:item.referenceNo, updatedBy:'V2 Batch Migration'});
        migrated.push({referenceNo:item.referenceNo, created:result.created});
      } catch (error) {
        failed.push({referenceNo:item.referenceNo, message:String(error && error.message || error)});
      }
    });
    const result = {
      ok: failed.length === 0,
      build: V2_BUILD,
      migrated: migrated.length,
      alreadySynced: plan.alreadySynced.length,
      skipped: plan.skipped,
      failed: failed,
      emailSent: false
    };
    v2Audit_('', 'WORKFLOW', 'BATCH_MIGRATION', {}, result, 'Apps Script Editor', failed.length ? 'PARTIAL' : 'SUCCESS', 'Source sheet unchanged.');
    Logger.log(JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function v2BuildMigrationPlan_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sourceSheet = ss.getSheetByName(CONFIG.sheetName);
  if (!sourceSheet) throw new Error('Source admission sheet not found: ' + CONFIG.sheetName);
  const lastRow = sourceSheet.getLastRow();
  const lastColumn = sourceSheet.getLastColumn();
  if (lastRow < 2 || lastColumn < 1) {
    return {sourceRows:0, eligible:[], alreadySynced:[], skipped:[], duplicateReferences:[]};
  }
  const values = sourceSheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values.shift().map(function(value) { return String(value || '').trim(); });
  const referenceIndex = headers.indexOf('Reference No');
  if (referenceIndex < 0) throw new Error('Reference No header is missing from ' + CONFIG.sheetName + '.');
  const existing = {};
  v2Rows_('V2_WORKFLOW').forEach(function(row) {
    const reference = String(row['Reference No'] || '').trim();
    if (reference) existing[reference] = true;
  });
  const seen = {};
  const eligible = [];
  const alreadySynced = [];
  const skipped = [];
  const duplicateReferences = [];
  values.forEach(function(row, index) {
    const sheetRow = index + 2;
    const reference = String(row[referenceIndex] || '').trim();
    if (!reference) {
      skipped.push({row:sheetRow, reason:'MISSING_REFERENCE'});
      return;
    }
    if (seen[reference]) {
      duplicateReferences.push({referenceNo:reference, firstRow:seen[reference], duplicateRow:sheetRow});
      return;
    }
    seen[reference] = sheetRow;
    if (existing[reference]) {
      alreadySynced.push({referenceNo:reference, row:sheetRow});
      return;
    }
    eligible.push({referenceNo:reference, row:sheetRow});
  });
  return {
    sourceRows: values.length,
    eligible: eligible,
    alreadySynced: alreadySynced,
    skipped: skipped,
    duplicateReferences: duplicateReferences
  };
}

function handleV2Get_(params) {
  const action = String(params.action || '');
  if (action === 'v2Health') return v2ApiOutput_({ok:true, build:V2_BUILD, workflowReady:v2FoundationReady_()}, params.callback);
  if (action === 'v2Bootstrap') {
    v2VerifyAdminApiAccess_(params.token);
    return v2ApiOutput_(v2Bootstrap_(), params.callback);
  }
  throw new Error('Unsupported V2 GET action.');
}

function v2ApiOutput_(obj, callback) {
  if (callback) {
    const safeCallback = String(callback || '').replace(/[^A-Za-z0-9_.$]/g, '');
    return ContentService.createTextOutput(safeCallback + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonOutput_(obj);
}

function handleV2Post_(payload) {
  const action = String(payload.action || '');
  if (action === 'v2SubmitAdmission') return v2SubmitAdmission_(payload.data || payload);
  v2VerifyAdminApiAccess_(payload.token);
  if (action === 'v2ListWorkflow') return v2ListWorkflow_(payload);
  if (action === 'v2SyncApplication') return v2SyncApplication_(payload.data || {});
  if (action === 'v2UpdateStage') return v2UpdateStage_(payload.data || {}, payload.updatedBy);
  if (action === 'v2RunDocumentReview') {
    const data = payload.data || {};
    return v2RunDocumentReview(
      data.referenceNo,
      payload.updatedBy || data.reviewer || 'Admin Portal V2',
      data.remarks || ''
    );
  }
  if (action === 'v2RunQualificationScreening') {
    const data = payload.data || {};
    return v2RunQualificationScreening(data.referenceNo, {
      fieldClassification: data.fieldClassification,
      relevantWorkExperience: data.relevantWorkExperience,
      screenedBy: payload.updatedBy || data.screenedBy || 'Admin Portal V2',
      remarks: data.remarks || ''
    });
  }
  if (action === 'v2RecordAiScreeningResult') return v2RecordAiScreeningResult_(payload.data || {}, payload.updatedBy);
  if (action === 'v2ConfirmAiScreening') return v2ConfirmAiScreening_(payload.data || {}, payload.updatedBy);
  if (action === 'v2CreateSacSession') return v2CreateSacSession_(payload.data || {}, payload.updatedBy);
  if (action === 'v2AssignSacCandidate') return v2AssignSacCandidate_(payload.data || {}, payload.updatedBy);
  if (action === 'v2RecordSacDecision') return v2RecordSacDecision_(payload.data || {}, payload.updatedBy);
  if (action === 'v2CreateSacSessionManual') return v2CreateSacSessionManual_(payload.data || {}, payload.updatedBy);
  if (action === 'v2SendSacCalendarInvitationManual') return v2SendSacCalendarInvitationManual_(payload.data || {}, payload.updatedBy);
  if (action === 'v2RecordSacDecisionManual') return v2RecordSacDecisionManual_(payload.data || {}, payload.updatedBy);
  if (action === 'v2FinalizeSacSessionManual') return v2FinalizeSacSessionManual_(payload.data || {}, payload.updatedBy);
  if (action === 'v2SacManualPhase1Status') return v2SacManualPhase1Status_();
  if (action === 'v2UpdateAssessment') return v2UpdateAssessment_(payload.data || {}, payload.updatedBy);
  if (action === 'v2UpsertOrientationSession') return v2UpsertOrientationSession_(payload.data || {}, payload.updatedBy);
  if (action === 'v2UpdateOrientation') return v2UpdateOrientation_(payload.data || {}, payload.updatedBy);
  if (action === 'v2UpdateProvisioning') return v2UpdateProvisioning_(payload.data || {}, payload.updatedBy);
  throw new Error('Unsupported V2 POST action.');
}

function v2VerifyAdminApiAccess_(token) {
  assertDevIdentity_();
  const properties = PropertiesService.getScriptProperties();
  const expected = String(properties.getProperty('V2_ADMIN_API_PASSWORD') || CONFIG.adminApiPassword || '').trim();
  const received = String(token || '').trim();
  if (!expected) throw new Error('V2 admin password is not configured in Script Properties.');
  if (!received || received !== expected) throw new Error('Invalid V2 admin password.');
  return true;
}

function v2SetAdminPasswordFromEditor(password) {
  assertDevIdentity_();
  const value = String(password || '').trim();
  if (value.length < 12) throw new Error('Use a V2 admin password with at least 12 characters.');
  PropertiesService.getScriptProperties().setProperty('V2_ADMIN_API_PASSWORD', value);
  CacheService.getScriptCache().removeAll(['V2_BOOTSTRAP_' + V2_BUILD]);
  return {ok:true, configured:true, passwordReturned:false};
}

function v2Bootstrap_() {
  const cache = CacheService.getScriptCache();
  const key = 'V2_BOOTSTRAP_' + V2_BUILD;
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const result = {
    ok: true,
    build: V2_BUILD,
    stages: V2_STAGES,
    intakes: v2Rows_('V2_INTAKE_MASTER'),
    sacSessions: v2Rows_('V2_SAC_SESSIONS'),
    orientationSessions: v2Rows_('V2_ORIENTATION_SESSIONS')
  };
  cache.put(key, JSON.stringify(result), V2_CACHE_TTL_SECONDS);
  return result;
}

function v2ListWorkflow_(payload) {
  const rows = v2Rows_('V2_WORKFLOW');
  const intake = String(payload.intake || '').trim();
  const stage = String(payload.stage || '').trim();
  const filtered = rows.filter(function(row) {
    return (!intake || String(row['Intake']) === intake) &&
      (!stage || String(row['Application Stage']) === stage);
  });
  return {ok:true, build:V2_BUILD, records:filtered};
}

function v2SyncApplication_(data) {
  const reference = v2Required_(data.referenceNo, 'Reference No');
  const source = v2FindAdmission_(reference);
  if (!source) throw new Error('Application reference not found.');
  const now = new Date().toISOString();
  const row = {
    'Reference No': reference,
    'Student Name': source['Full Name'] || '',
    'ID / Passport No': source['ID / Passport No'] || '',
    'Personal Email': source['Email'] || source['Captured Email'] || '',
    'Innovative Email': '',
    'Programme': source['Programme'] || '',
    'Level of Study': source['Level of Study'] || '',
    'Intake': source['Intake'] || '',
    'Application Stage': 'APPLICATION_RECEIVED',
    'Application Status': 'Active',
    'Document Review Status': 'PENDING',
    'Document Reviewed At': '',
    'Document Reviewed By': '',
    'Missing Document Count': 0,
    'Screening Recommendation': 'PENDING_QUALIFICATION_SCREENING',
    'SAC Session ID': '', 'SAC Decision': '', 'SAC Endorsed At': '',
    'Assessment Status': 'NOT_DETERMINED', 'Prerequisite Status': 'NOT_DETERMINED',
    'Offer Letter Status': 'NOT_ISSUED', 'Offer Letter Issued At': '',
    'Acceptance Status': 'NOT_OPEN', 'Orientation Session ID': '',
    'Orientation Status': 'NOT_ASSIGNED', 'Provisioning Status': 'NOT_STARTED',
    'Academic Handover Status': 'NOT_READY',
    'Student Folder URL': source['Student Folder URL'] || '',
    'Last Updated': now, 'Updated By': data.updatedBy || 'V2 Sync', 'Version': V2_BUILD
  };
  const saved = v2Upsert_('V2_WORKFLOW', 'Reference No', reference, row);
  v2Upsert_('V2_INTAKE_APPLICATIONS', 'Reference No', reference, {
    'Intake ID': v2NormaliseIntakeId_(row['Intake']), 'Reference No':reference,
    'Student Name':row['Student Name'], 'Programme':row['Programme'],
    'Application Stage':row['Application Stage'], 'Priority':'NORMAL',
    'Deferred':'NO', 'Deferred To Intake ID':'', 'Last Updated':now
  });
  v2Audit_(reference,'WORKFLOW','SYNC_APPLICATION',saved.previous,row,row['Updated By'],'SUCCESS','');
  v2InvalidateCache_();
  return {ok:true, record:row, created:saved.created};
}

function v2UpdateStage_(data, actor) {
  const reference = v2Required_(data.referenceNo, 'Reference No');
  const next = v2Required_(data.stage, 'Application Stage');
  if (V2_STAGES.indexOf(next) < 0) throw new Error('Invalid V2 stage.');
  const current = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!current) throw new Error('V2 workflow record not found.');
  const previousStage = String(current.record['Application Stage'] || 'APPLICATION_RECEIVED');
  if (previousStage !== next && (V2_ALLOWED_TRANSITIONS[previousStage] || []).indexOf(next) < 0) {
    throw new Error('Stage transition blocked: ' + previousStage + ' -> ' + next);
  }
  v2AssertStageGate_(reference,next);
  const updates = {'Application Stage':next,'Last Updated':new Date().toISOString(),'Updated By':actor || 'Admin Portal','Version':V2_BUILD};
  v2UpdateRow_(current.sheet,current.rowNumber,updates);
  v2Audit_(reference,'WORKFLOW','UPDATE_STAGE',{stage:previousStage},{stage:next},actor || 'Admin Portal','SUCCESS',data.remarks || '');
  v2InvalidateCache_();
  return {ok:true, referenceNo:reference, previousStage:previousStage, stage:next};
}

function v2CreateSacSession_(data, actor) {
  const name = v2Required_(data.name,'SAC Name');
  const meetingDate = v2Required_(data.meetingDate,'Meeting Date');
  const id = String(data.sessionId || ('SAC-' + Utilities.formatDate(new Date(meetingDate),CONFIG.timezone,'yyyyMMdd') + '-' + Utilities.getUuid().slice(0,6).toUpperCase()));
  const existing = v2Find_('V2_SAC_SESSIONS','SAC Session ID',id);
  if (existing) return {ok:true, duplicate:true, session:existing.record};
  const now = new Date().toISOString();
  const row = {'SAC Session ID':id,'SAC Name':name,'Meeting Date':meetingDate,
    'Meeting Time':data.meetingTime || '10:00','Status':'DRAFT','Chairperson':data.chairperson || '',
    'Venue / Meeting Link':data.venueLink || '','Candidate Count':0,'Minutes URL':'',
    'Endorsement URL':'','Created At':now,'Created By':actor || 'Admin Portal','Finalised At':''};
  v2Append_('V2_SAC_SESSIONS',row);
  v2Audit_('','SAC','CREATE_SESSION',{},row,actor || 'Admin Portal','SUCCESS','');
  v2InvalidateCache_();
  return {ok:true, duplicate:false, session:row};
}

function v2AssignSacCandidate_(data, actor) {
  const sessionId = v2Required_(data.sessionId,'SAC Session ID');
  const reference = v2Required_(data.referenceNo,'Reference No');
  if (!v2Find_('V2_SAC_SESSIONS','SAC Session ID',sessionId)) throw new Error('SAC session not found.');
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!workflow) throw new Error('V2 workflow record not found.');
  const w = workflow.record;
  const row = {'SAC Session ID':sessionId,'Reference No':reference,'Student Name':w['Student Name'],
    'Programme':w['Programme'],'Form 01 URL':data.form01Url || '','Transcript URL':data.transcriptUrl || '',
    'Certificate URL':data.certificateUrl || '','Screening Recommendation':w['Screening Recommendation'] || '',
    'Decision':'PENDING','Priority':data.priority || 'NORMAL','Reviewer Remarks':'','Decision At':'',
    'Decision By':'','Letter Action':'NONE','Letter Issued At':''};
  const saved = v2UpsertComposite_('V2_SAC_CANDIDATES',['SAC Session ID','Reference No'],[sessionId,reference],row);
  v2UpdateRow_(workflow.sheet,workflow.rowNumber,{'SAC Session ID':sessionId,'Application Stage':'SAC_REVIEW','Last Updated':new Date().toISOString(),'Updated By':actor || 'Admin Portal'});
  v2RecountSac_(sessionId);
  v2Audit_(reference,'SAC','ASSIGN_CANDIDATE',saved.previous,row,actor || 'Admin Portal','SUCCESS','');
  v2InvalidateCache_();
  return {ok:true, created:saved.created, candidate:row};
}

function v2RecordSacVote_(data, actor) {
  const sessionId = v2Required_(
    data.sessionId,
    'SAC Session ID'
  );

  const reference = v2Required_(
    data.referenceNo,
    'Reference No'
  );

  const reviewer = String(
    data.reviewer || actor || ''
  ).trim();

  const vote = v2Required_(
    data.vote,
    'SAC Vote'
  );

  const remarks = String(
    data.remarks || ''
  ).trim();

  if (!reviewer) {
    throw new Error('Reviewer is required.');
  }

  const allowedVotes = [
    'DIRECT_ENTRY',
    'INTERNAL_ASSESSMENT',
    'PREREQUISITE',
    'REJECTED'
  ];

  if (allowedVotes.indexOf(vote) < 0) {
    throw new Error('Invalid SAC vote.');
  }

  const session = v2Find_(
    'V2_SAC_SESSIONS',
    'SAC Session ID',
    sessionId
  );

  if (!session) {
    throw new Error('SAC session not found.');
  }

  const candidate = v2FindComposite_(
    'V2_SAC_CANDIDATES',
    ['SAC Session ID', 'Reference No'],
    [sessionId, reference]
  );

  if (!candidate) {
    throw new Error('SAC candidate not found.');
  }

  const workflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );

  if (!workflow) {
    throw new Error('V2 workflow record not found.');
  }

  if (
    String(workflow.record['Application Stage'] || '') !==
    'SAC_REVIEW'
  ) {
    throw new Error(
      'SAC voting is only allowed during SAC_REVIEW stage.'
    );
  }

  const now = new Date().toISOString();

  const row = {
    'SAC Session ID': sessionId,
    'Reference No': reference,
    'Student Name':
      workflow.record['Student Name'] || '',
    'Programme':
      workflow.record['Programme'] || '',
    'Reviewer': reviewer,
    'Vote': vote,
    'Reviewer Remarks': remarks,
    'Voted At': now,
    'Vote Status': 'ACTIVE',
    'Last Updated': now
  };

  const saved = v2UpsertComposite_(
    'V2_SAC_VOTES',
    [
      'SAC Session ID',
      'Reference No',
      'Reviewer'
    ],
    [
      sessionId,
      reference,
      reviewer
    ],
    row
  );

  v2Audit_(
    reference,
    'SAC',
    'RECORD_VOTE',
    saved.previous || {},
    row,
    reviewer,
    'SUCCESS',
    remarks
  );

  v2InvalidateCache_();

  return {
    ok: true,
    sessionId: sessionId,
    referenceNo: reference,
    reviewer: reviewer,
    vote: vote,
    created: saved.created,
    finalDecisionMade: false,
    emailSent: false,
    v1Touched: false
  };
}

function v2GetSacVoteSummary_(sessionId, referenceNo) {
  const session = String(sessionId || '').trim();
  const reference = String(referenceNo || '').trim();

  if (!session) {
    throw new Error('SAC Session ID is required.');
  }

  if (!reference) {
    throw new Error('Reference No is required.');
  }

  const candidate = v2FindComposite_(
    'V2_SAC_CANDIDATES',
    ['SAC Session ID', 'Reference No'],
    [session, reference]
  );

  if (!candidate) {
    throw new Error('SAC candidate not found.');
  }

  const votes = v2Rows_('V2_SAC_VOTES').filter(function(row) {
    return (
      String(row['SAC Session ID'] || '') === session &&
      String(row['Reference No'] || '') === reference &&
      String(row['Vote Status'] || '') === 'ACTIVE'
    );
  });

  const counts = {
    DIRECT_ENTRY: 0,
    INTERNAL_ASSESSMENT: 0,
    PREREQUISITE: 0,
    REJECTED: 0
  };

  votes.forEach(function(row) {
    const vote = String(row['Vote'] || '').trim();

    if (Object.prototype.hasOwnProperty.call(counts, vote)) {
      counts[vote]++;
    }
  });

  const reviewers = votes.map(function(row) {
    return {
      reviewer: String(row['Reviewer'] || ''),
      vote: String(row['Vote'] || ''),
      remarks: String(row['Reviewer Remarks'] || ''),
      votedAt: String(row['Voted At'] || '')
    };
  });

  const activeVoteTypes = Object.keys(counts).filter(function(key) {
    return counts[key] > 0;
  });

  const unanimous =
    votes.length > 0 &&
    activeVoteTypes.length === 1;

  const unanimousVote =
    unanimous ? activeVoteTypes[0] : '';

  return {
    ok: true,

    sessionId: session,
    referenceNo: reference,

    studentName:
      candidate.record['Student Name'] || '',

    programme:
      candidate.record['Programme'] || '',

    activeVoteCount: votes.length,

    counts: counts,
    reviewers: reviewers,

    unanimous: unanimous,
    unanimousVote: unanimousVote,

    finalDecisionMade:
      !!String(
        candidate.record['Decision'] || ''
      ).trim() &&
      String(candidate.record['Decision']) !== 'PENDING',

    finalDecision:
      String(candidate.record['Decision'] || 'PENDING'),

    v1Touched: false
  };
}

function v2RecordSacDecision_(data, actor) {
  const sessionId = v2Required_(data.sessionId,'SAC Session ID');
  const reference = v2Required_(data.referenceNo,'Reference No');
  const decision = v2Required_(data.decision,'SAC Decision');
  if (
    [
      'DIRECT_ENTRY',
      'INTERNAL_ASSESSMENT',
      'PREREQUISITE',
      'REJECTED'
    ].indexOf(decision) < 0
  ) {
    throw new Error('Invalid SAC decision.');
  }
  const candidate = v2FindComposite_('V2_SAC_CANDIDATES',['SAC Session ID','Reference No'],[sessionId,reference]);
  if (!candidate) throw new Error('SAC candidate not found.');
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (
    String(workflow.record['Application Stage'] || '') !== 'SAC_REVIEW'
  ) {
    throw new Error(
      'SAC decision can only be finalised during SAC_REVIEW stage.'
    );
  }

  if (data.confirmed !== true) {
    throw new Error(
      'Explicit SAC final decision confirmation is required.'
    );
  }

  const voteSummary = v2GetSacVoteSummary_(
    sessionId,
    reference
  );

  if (voteSummary.activeVoteCount < 1) {
    throw new Error(
      'SAC decision cannot be finalised without an active reviewer vote.'
    );
  }
  if (!workflow) throw new Error('V2 workflow record not found.');
  const now = new Date().toISOString();
  const nextStage =
  decision === 'DIRECT_ENTRY'
    ? 'ELIGIBLE_FOR_OFFER'
    : decision === 'INTERNAL_ASSESSMENT'
      ? 'INTERNAL_ASSESSMENT'
      : decision === 'PREREQUISITE'
        ? 'PREREQUISITE'
        : 'REJECTED';

const letterAction =
  decision === 'DIRECT_ENTRY'
    ? 'OFFER_READY'
    : decision === 'INTERNAL_ASSESSMENT'
      ? 'COL_IA_READY'
      : decision === 'PREREQUISITE'
        ? 'COL_PREREQUISITE_READY'
        : 'DECISION_NOTICE_READY';

  v2UpdateRow_(candidate.sheet,candidate.rowNumber,{'Decision':decision,'Priority':data.priority || candidate.record['Priority'],
    'Reviewer Remarks':data.remarks || '','Decision At':now,'Decision By':actor || 'SAC Reviewer','Letter Action':letterAction});
  v2UpdateRow_(workflow.sheet,workflow.rowNumber,{'SAC Decision':decision,'SAC Endorsed At':now,
    'Application Stage':nextStage,'Assessment Status':
  decision === 'INTERNAL_ASSESSMENT'
    ? 'ACCOUNT_PENDING'
    : 'NOT_REQUIRED',

'Prerequisite Status':
  decision === 'PREREQUISITE'
    ? 'REQUIRED'
    : 'NOT_REQUIRED',
    'Last Updated':now,'Updated By':actor || 'SAC Reviewer'});
  if (
    decision === 'INTERNAL_ASSESSMENT' ||
    decision === 'PREREQUISITE'
  ) {
    v2CreateAssessmentAccount_(
      workflow.record,
      actor || 'SAC Reviewer'
    );
  }
  v2Audit_(reference,'SAC','RECORD_DECISION',candidate.record,{decision:decision,nextStage:nextStage,letterAction:letterAction},actor || 'SAC Reviewer','SUCCESS',data.remarks || '');
  v2InvalidateCache_();
  return {
    ok: true,
    referenceNo: reference,
    decision: decision,
    nextStage: nextStage,
    letterAction: letterAction,

    voteSummary: voteSummary,

    explicitlyConfirmed: true,
    confirmedBy: actor || 'SAC Reviewer',

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };
  }

function v2FinalizeSacSession_(data, actor) {
  const sessionId = v2Required_(
    data.sessionId,
    'SAC Session ID'
  );

  if (data.confirmed !== true) {
    throw new Error(
      'Explicit SAC session finalisation confirmation is required.'
    );
  }

  const session = v2Find_(
    'V2_SAC_SESSIONS',
    'SAC Session ID',
    sessionId
  );

  if (!session) {
    throw new Error('SAC session not found.');
  }

  const candidates = v2Rows_(
    'V2_SAC_CANDIDATES'
  ).filter(function(row) {
    return String(row['SAC Session ID'] || '') === sessionId;
  });

  if (!candidates.length) {
    throw new Error(
      'SAC session cannot be finalised without candidates.'
    );
  }

  const pendingCandidates = candidates.filter(function(row) {
    const decision = String(
      row['Decision'] || ''
    ).trim();

    return (
      !decision ||
      decision === 'PENDING'
    );
  });

  if (pendingCandidates.length > 0) {
    throw new Error(
      'SAC session cannot be finalised while candidate decisions are pending.'
    );
  }

  const counts = {
    DIRECT_ENTRY: 0,
    INTERNAL_ASSESSMENT: 0,
    PREREQUISITE: 0,
    REJECTED: 0
  };

  candidates.forEach(function(row) {
    const decision = String(
      row['Decision'] || ''
    ).trim();

    if (
      Object.prototype.hasOwnProperty.call(
        counts,
        decision
      )
    ) {
      counts[decision]++;
    }
  });

  const now = new Date().toISOString();

  v2UpdateRow_(
    session.sheet,
    session.rowNumber,
    {
      'Status': 'FINALIZED',
      'Candidate Count': candidates.length,
      'Finalised At': now
    }
  );

  v2Audit_(
    '',
    'SAC',
    'FINALIZE_SESSION',
    {
      status: session.record['Status'] || ''
    },
    {
      sessionId: sessionId,
      status: 'FINALIZED',
      candidateCount: candidates.length,
      decisionCounts: counts
    },
    actor || 'SAC Chair',
    'SUCCESS',
    String(data.remarks || '')
  );

  v2InvalidateCache_();

  const report = {
    ok: true,

    sessionId: sessionId,
    status: 'FINALIZED',

    candidateCount: candidates.length,
    pendingCandidateCount: 0,

    decisionCounts: counts,

    readyForMinutes: true,
    readyForEndorsement: true,

    minutesGenerated: false,
    endorsementGenerated: false,

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2CreateAssessmentAccount_(workflow, actor) {
  const reference = workflow['Reference No'];

  const loginId = v2AssessmentNormalizeCredential_(
    workflow['ID / Passport No'] || reference
  );

  if (!loginId) {
    throw new Error(
      'Assessment account cannot be created without ID / Passport No.'
    );
  }

  const existing = v2Find_(
    'V2_ASSESSMENT_ACCOUNTS',
    'Reference No',
    reference
  );

  const now = new Date().toISOString();

  // Default password = normalized IC / Passport.
  // If student already changed password, preserve existing hash.
  const existingHash = existing
    ? String(existing.record['Password Hash'] || '').trim()
    : '';

  const passwordHash = existingHash ||
    v2AssessmentHashPassword_(loginId);

  const passwordUpdatedAt =
    existing &&
    String(existing.record['Password Updated At'] || '').trim()
      ? existing.record['Password Updated At']
      : now;

  return v2Upsert_(
    'V2_ASSESSMENT_ACCOUNTS',
    'Reference No',
    reference,
    {
      'Reference No': reference,

      'Student Name':
        workflow['Student Name'] || '',

      'ID / Passport No':
        workflow['ID / Passport No'] || '',

      'Personal Email':
        workflow['Personal Email'] || '',

      'Login ID':
        loginId,

      'Password Hash':
        passwordHash,

      'Password Updated At':
        passwordUpdatedAt,

      'Account Status':
        existing
          ? existing.record['Account Status'] || 'ACTIVE'
          : 'ACTIVE',

      'Activated At':
        existing
          ? existing.record['Activated At'] || now
          : now,

      'Last Login At':
        existing
          ? existing.record['Last Login At'] || ''
          : '',

      'Created At':
        existing
          ? existing.record['Created At'] || now
          : now,

      'Created By':
        existing
          ? existing.record['Created By'] || actor
          : actor
    }
  );
}


function v2AssessmentNormalizeCredential_(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}


function v2AssessmentHashPassword_(password) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(password || ''),
    Utilities.Charset.UTF_8
  );

  return bytes.map(function(byte) {
    const value = byte < 0 ? byte + 256 : byte;
    const hex = value.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function v2UpdateAssessment_(data, actor) {
  const reference = v2Required_(data.referenceNo,'Reference No');
  const type = v2Required_(data.assessmentType,'Assessment Type');
  if (['INTERNAL_ASSESSMENT','PREREQUISITE'].indexOf(type) < 0) throw new Error('Invalid assessment type.');
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!workflow) throw new Error('V2 workflow record not found.');
  if (type === 'PREREQUISITE') {

    const prerequisiteFromIa =
      String(
        workflow.record['Assessment Status'] || ''
      ) === 'COMPLETED_PREREQUISITE_REQUIRED';

    const prerequisiteFromSac =
      String(
        workflow.record['SAC Decision'] || ''
      ) === 'PREREQUISITE';

    if (
      !prerequisiteFromIa &&
      !prerequisiteFromSac
    ) {
      throw new Error(
        'Prerequisite can only start after SAC endorsement or Internal Assessment panel confirmation.'
      );
    }
  }
  const now = new Date().toISOString();
  const row = {'Reference No':reference,'Assessment Type':type,'Sequence':Number(data.sequence || 1),
    'Component':data.component || 'OVERALL','Status':data.status || 'IN_PROGRESS',
    'Submission URL':data.submissionUrl || '','Interview Slot':data.interviewSlot || '',
    'Calendar Event ID':data.calendarEventId || '','Panel Result':data.panelResult || '',
    'Panel Remarks':data.panelRemarks || '','Completed At':data.status === 'COMPLETED' ? now : '',
    'Verified By':actor || 'Assessment Panel','Next Action':data.nextAction || '','Last Updated':now};
  v2UpsertComposite_('V2_ASSESSMENT_PROGRESS',['Reference No','Assessment Type','Sequence'],[reference,type,Number(data.sequence || 1)],row);
  const updates = {'Last Updated':now,'Updated By':actor || 'Assessment Panel'};
  if (type === 'INTERNAL_ASSESSMENT' && data.status === 'COMPLETED') {
    if (data.panelResult === 'PREREQUISITE_REQUIRED') {
      updates['Assessment Status'] = 'COMPLETED_PREREQUISITE_REQUIRED';
      updates['Prerequisite Status'] = 'REQUIRED';
      updates['Application Stage'] = 'PREREQUISITE';
    } else if (data.panelResult === 'QUALIFIED') {
      updates['Assessment Status'] = 'COMPLETED_QUALIFIED';
      updates['Application Stage'] = 'ELIGIBLE_FOR_OFFER';
    } else if (data.panelResult === 'NOT_QUALIFIED') {
      updates['Assessment Status'] = 'COMPLETED_NOT_QUALIFIED';
      updates['Application Stage'] = 'REJECTED';
    }
  }
  if (type === 'PREREQUISITE' && data.status === 'COMPLETED') {
    updates['Prerequisite Status'] = data.panelResult === 'QUALIFIED' ? 'COMPLETED_QUALIFIED' : 'COMPLETED_NOT_QUALIFIED';
    updates['Application Stage'] = data.panelResult === 'QUALIFIED' ? 'ELIGIBLE_FOR_OFFER' : 'REJECTED';
  }
  v2UpdateRow_(workflow.sheet,workflow.rowNumber,updates);
  v2Audit_(reference,'ASSESSMENT','UPDATE_PROGRESS',{},row,actor || 'Assessment Panel','SUCCESS','');
  v2InvalidateCache_();
  return {ok:true, progress:row, workflowUpdates:updates};
}

function v2UpsertOrientationSession_(data, actor) {
  const id = String(data.sessionId || ('ORI-' + Utilities.getUuid().slice(0,8).toUpperCase()));
  const now = new Date().toISOString();
  const row = {'Orientation Session ID':id,'Intake ID':v2Required_(data.intakeId,'Intake ID'),
    'Programme Group':data.programmeGroup || 'ALL','Session Date':v2Required_(data.sessionDate,'Session Date'),
    'Start Time':data.startTime || '08:30','End Time':data.endTime || '09:30',
    'Meeting Link':data.meetingLink || '','Feedback Form URL':data.feedbackFormUrl || '',
    'Recording URL':data.recordingUrl || '','Registrar Community URL':data.registrarCommunityUrl || '',
    'Programme Community URL':data.programmeCommunityUrl || '','Status':data.status || 'SCHEDULED',
    'Created At':now,'Created By':actor || 'Admin Portal'};
  const saved = v2Upsert_('V2_ORIENTATION_SESSIONS','Orientation Session ID',id,row);
  v2Audit_('','ORIENTATION','UPSERT_SESSION',saved.previous,row,actor || 'Admin Portal','SUCCESS','');
  v2InvalidateCache_();
  return {ok:true, created:saved.created, session:row};
}

function v2UpdateOrientation_(data, actor) {
  const reference = v2Required_(data.referenceNo,'Reference No');
  const sessionId = v2Required_(data.sessionId,'Orientation Session ID');
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!workflow) throw new Error('V2 workflow record not found.');
  if (!v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId)) throw new Error('Orientation session not found.');
  const now = new Date().toISOString();
  const row = {'Orientation Session ID':sessionId,'Reference No':reference,
    'Student Name':workflow.record['Student Name'],'Programme':workflow.record['Programme'],
    'Invitation Status':data.invitationStatus || 'PENDING','Feedback Submitted':data.feedbackSubmitted ? 'YES':'NO',
    'Attendance Status':data.attendanceStatus || 'NOT_UPDATED','Feedback Submitted At':data.feedbackSubmitted ? now:'',
    'Recording Email Status':data.recordingEmailStatus || 'NOT_SENT','Community Email Status':data.communityEmailStatus || 'NOT_SENT',
    'Academic Handover Status':'NOT_READY','Last Updated':now};
  v2UpsertComposite_('V2_ORIENTATION_TRACKING',['Orientation Session ID','Reference No'],[sessionId,reference],row);
  v2UpdateRow_(workflow.sheet,workflow.rowNumber,{'Orientation Session ID':sessionId,
    'Orientation Status':row['Attendance Status'],'Application Stage':'ORIENTATION','Last Updated':now,'Updated By':actor || 'Admin Portal'});
  v2Audit_(reference,'ORIENTATION','UPDATE_TRACKING',{},row,actor || 'Admin Portal','SUCCESS','');
  v2InvalidateCache_();
  return {ok:true, tracking:row};
}

function v2UpdateProvisioning_(data, actor) {
  const reference = v2Required_(data.referenceNo,'Reference No');
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!workflow) throw new Error('V2 workflow record not found.');
  const existing = v2Find_('V2_PROVISIONING','Reference No',reference);
  const old = existing ? existing.record : {};
  const now = new Date().toISOString();
  const row = {
    'Reference No':reference,'Student Name':workflow.record['Student Name'],
    'ID / Passport No':workflow.record['ID / Passport No'],'Personal Email':workflow.record['Personal Email'],
    'Innovative Email':data.innovativeEmail !== undefined ? data.innovativeEmail : old['Innovative Email'] || '',
    'IT Email Status':data.itEmailStatus || old['IT Email Status'] || 'PENDING',
    'IT Completed At':data.itEmailStatus === 'COMPLETED' ? now : old['IT Completed At'] || '',
    'IT Completed By':data.itEmailStatus === 'COMPLETED' ? actor || 'IT' : old['IT Completed By'] || '',
    'E-Library Status':data.eLibraryStatus || old['E-Library Status'] || 'PENDING',
    'E-Library Completed At':data.eLibraryStatus === 'COMPLETED' ? now : old['E-Library Completed At'] || '',
    'E-Library Completed By':data.eLibraryStatus === 'COMPLETED' ? actor || 'Library' : old['E-Library Completed By'] || '',
    'Moodle Status':data.moodleStatus || old['Moodle Status'] || 'PENDING',
    'Moodle Login Email':workflow.record['Personal Email'],
    'Moodle Completed At':data.moodleStatus === 'COMPLETED' ? now : old['Moodle Completed At'] || '',
    'Moodle Completed By':data.moodleStatus === 'COMPLETED' ? actor || 'Academic' : old['Moodle Completed By'] || '',
    'Student Notification Status':old['Student Notification Status'] || 'NOT_READY',
    'Student Notified At':old['Student Notified At'] || '','Last Updated':now,'Remarks':data.remarks || old['Remarks'] || ''
  };
  const ready = row['IT Email Status'] === 'COMPLETED' && row['E-Library Status'] === 'COMPLETED' && row['Moodle Status'] === 'COMPLETED';
  row['Student Notification Status'] = ready && row['Student Notification Status'] === 'NOT_READY' ? 'READY_TO_SEND' : row['Student Notification Status'];
  v2Upsert_('V2_PROVISIONING','Reference No',reference,row);
  v2UpdateRow_(workflow.sheet,workflow.rowNumber,{
    'Innovative Email':row['Innovative Email'],'Provisioning Status':ready ? 'COMPLETED':'IN_PROGRESS',
    'Last Updated':now,'Updated By':actor || 'Admin Portal'
  });
  v2Audit_(reference,'PROVISIONING','UPDATE_CHECKLIST',old,row,actor || 'Admin Portal','SUCCESS','No credential email is sent by this action.');
  v2InvalidateCache_();
  return {ok:true, readyToNotifyStudent:ready, provisioning:row, emailSent:false};
}

function v2AssertStageGate_(reference, next) {
  const w = v2Find_('V2_WORKFLOW','Reference No',reference).record;
  if (next === 'ELIGIBLE_FOR_OFFER' && w['SAC Decision'] !== 'DIRECT_ENTRY' &&
      w['Assessment Status'] !== 'COMPLETED_QUALIFIED' && w['Prerequisite Status'] !== 'COMPLETED_QUALIFIED') {
    throw new Error('Offer gate blocked: SAC or assessment qualification is incomplete.');
  }
  if (next === 'ACADEMIC_HANDOVER' && w['Orientation Status'] !== 'ATTENDED') {
    throw new Error('Academic handover blocked: orientation attendance is incomplete.');
  }
}

function v2ScreeningRecommendation_(source) {
  const result = parseFloat(String(source['Academic Result / CGPA / Grade'] || '').replace(/[^0-9.]/g,''));
  const field = String(source['Field of Study / Qualification Area'] || '').toLowerCase();
  if (!isFinite(result)) return 'MANUAL_REVIEW';
  if (result < 2.50) return 'INTERNAL_ASSESSMENT';
  if (!field) return 'MANUAL_FIELD_REVIEW';
  return 'DIRECT_ENTRY_RECOMMENDED';
}

function v2FoundationReady_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  return Object.keys(V2_HEADERS).every(function(name) { return !!ss.getSheetByName(name); });
}

function v2SeedDefaults_(ss) {
  const intake = ss.getSheetByName('V2_INTAKE_MASTER');
  if (intake.getLastRow() === 1) {
    const year = Utilities.formatDate(new Date(),CONFIG.timezone,'yyyy');
    ['JANUARY','MAY','SEPTEMBER'].forEach(function(month) {
      v2Append_('V2_INTAKE_MASTER',{'Intake ID':year+'-'+month,'Intake Name':month.charAt(0)+month.slice(1).toLowerCase()+' '+year,
        'Start Date':'','Application Open':'','Application Close':'','Status':'PLANNED',
        'Default Orientation Session ID':'','Notes':'','Created At':new Date().toISOString(),
        'Created By':'V2 Setup','Updated At':new Date().toISOString()});
    });
  }
}

function v2FindAdmission_(reference) {
  return v2Rows_(CONFIG.sheetName).filter(function(row) { return String(row['Reference No']) === reference; })[0] || null;
}

function v2Rows_(sheetName) {
  const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getDisplayValues();
  const headers = values.shift();
  return values.filter(function(row) { return row.some(function(v) { return v !== ''; }); }).map(function(row) {
    const obj = {};
    headers.forEach(function(header,index) { obj[header] = row[index]; });
    return obj;
  });
}

function v2Find_(sheetName, keyHeader, keyValue) {
  return v2FindComposite_(sheetName,[keyHeader],[keyValue]);
}

function v2FindComposite_(sheetName, keyHeaders, keyValues) {
  const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const indexes = keyHeaders.map(function(h) { return headers.indexOf(h); });
  if (indexes.some(function(i){return i < 0;})) throw new Error('Missing V2 key header.');
  for (let r=1;r<data.length;r++) {
    const match = indexes.every(function(index,i) { return String(data[r][index]) === String(keyValues[i]); });
    if (match) {
      const record = {};
      headers.forEach(function(h,i){record[h]=data[r][i];});
      return {sheet:sheet,rowNumber:r+1,record:record};
    }
  }
  return null;
}

function v2Append_(sheetName, values) {
  const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId).getSheetByName(sheetName);
  if (!sheet) throw new Error('Missing V2 sheet: '+sheetName);
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map(function(h){return values[h] === undefined ? '' : values[h];}));
  return sheet.getLastRow();
}

function v2Upsert_(sheetName,keyHeader,keyValue,values) {
  return v2UpsertComposite_(sheetName,[keyHeader],[keyValue],values);
}

function v2UpsertComposite_(sheetName,keyHeaders,keyValues,values) {
  const found = v2FindComposite_(sheetName,keyHeaders,keyValues);
  if (!found) {
    v2Append_(sheetName,values);
    return {created:true,previous:{}};
  }
  const previous = found.record;
  v2UpdateRow_(found.sheet,found.rowNumber,values);
  return {created:false,previous:previous};
}

function v2UpdateRow_(sheet,rowNumber,values) {
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  const current = sheet.getRange(rowNumber,1,1,headers.length).getValues()[0];
  headers.forEach(function(header,index) {
    if (Object.prototype.hasOwnProperty.call(values,header)) current[index]=values[header];
  });
  sheet.getRange(rowNumber,1,1,headers.length).setValues([current]);
}

function v2EnsureHeaders_(sheet, expected) {
  const lastColumn = Math.max(sheet.getLastColumn(),1);
  const current = sheet.getRange(1,1,1,lastColumn).getValues()[0].filter(String);
  if (!current.length) {
    sheet.getRange(1,1,1,expected.length).setValues([expected]);
    return;
  }
  const missing = expected.filter(function(header){return current.indexOf(header)<0;});
  if (missing.length) sheet.getRange(1,current.length+1,1,missing.length).setValues([missing]);
}

function v2StyleHeader_(sheet,count) {
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,count).setBackground('#2d2363').setFontColor('#ffffff').setFontWeight('bold').setWrap(true);
}

function v2RecountSac_(sessionId) {
  const count = v2Rows_('V2_SAC_CANDIDATES').filter(function(r){return r['SAC Session ID']===sessionId;}).length;
  const session = v2Find_('V2_SAC_SESSIONS','SAC Session ID',sessionId);
  if (session) v2UpdateRow_(session.sheet,session.rowNumber,{'Candidate Count':count});
}

function v2Audit_(reference,module,action,previous,next,actor,result,remarks) {
  v2Append_('V2_AUDIT_LOG',{'Timestamp':new Date().toISOString(),'Event ID':Utilities.getUuid(),
    'Reference No':reference || '','Module':module,'Action':action,
    'Previous Value JSON':JSON.stringify(previous || {}),'New Value JSON':JSON.stringify(next || {}),
    'Actor':actor || 'System','Result':result || 'SUCCESS','Remarks':remarks || '','Build Version':V2_BUILD});
}

function v2NormaliseIntakeId_(intake) {
  return String(intake || '').trim().toUpperCase().replace(/\s+/g,'-');
}

function v2Required_(value,label) {
  const text = String(value === undefined || value === null ? '' : value).trim();
  if (!text) throw new Error(label+' is required.');
  return text;
}

function v2InvalidateCache_() {
  CacheService.getScriptCache().remove('V2_BOOTSTRAP_' + V2_BUILD);
}

function v2SacVotingControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const now = new Date().toISOString();

  const reference = 'V2-SAC-VOTE-TEST-' + stamp;
  const sessionId = 'SAC-TEST-' + stamp;
  const studentName = 'V2 SAC VOTING TEST ' + stamp;

  // --------------------------------------------------
  // 1. Create isolated V2 applicant
  // --------------------------------------------------

  v2Append_('V2_APPLICATIONS', {
    'Reference No': reference,
    'Submitted At': now,
    'Applicant Type': 'Local (Malaysian Citizen)',
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Phone Number': 'TEST',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Study Mode': 'Online',
    'Intake': 'September 2026',
    'Intake ID': 'SEP-2026',

    'Entry Qualification Type': 'Academic Qualification',
    'Highest Qualification': 'Bachelor Degree',
    'Institution / Awarding Body': 'V2 Test Environment',
    'Field of Study': 'Business Administration',
    'Academic Result / CGPA / Grade': '3.00',

    'Transfer Applicant': 'NO',

    'Agent Code': '',
    'Agent Name': '',
    'Agent Email': '',

    'Prospect Status': 'PENDING',
    'SKY Prospect ID': '',
    'Fee Group': '',
    'Prospect Updated At': '',
    'Prospect Remarks': '',

    'Student Folder URL': '',
    'Admission Form PDF URL': '',
    'Uploaded Files JSON': '[]',
    'Raw Application JSON': '{}',

    'Application Status': 'TEST',
    'Email Status': 'DISABLED',
    'Last Updated': now,
    'Version': 'CONTROLLED_SAC_VOTING_TEST'
  });


  // --------------------------------------------------
  // 2. Create workflow already READY_FOR_SAC
  // --------------------------------------------------

  v2Append_('V2_WORKFLOW', {
    'Reference No': reference,
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Innovative Email': '',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Intake': 'SEP-2026',

    'Application Stage': 'READY_FOR_SAC',
    'Application Status': 'TEST',

    'Document Review Status': 'COMPLETE',
    'Document Reviewed At': now,
    'Document Reviewed By': 'Controlled Test',
    'Missing Document Count': 0,

    'Qualification Screening Status': 'COMPLETED',
    'Field Classification': 'RELATED',
    'Relevant Work Experience': 'NO',
    'Qualification Rule Code': 'MBA-REL-250-UP',
    'Qualification Screened At': now,
    'Qualification Screened By': 'Controlled Test',
    'Manual Review Required': 'NO',

    'Screening Recommendation': 'DIRECT_ENTRY',

    'Prospect Status': 'PENDING',
    'SKY Prospect ID': '',
    'Fee Group': '',
    'Prospect Updated At': '',

    'SAC Session ID': '',
    'SAC Decision': '',
    'SAC Endorsed At': '',

    'Assessment Status': 'NOT_DETERMINED',
    'Prerequisite Status': 'NOT_DETERMINED',

    'Offer Letter Status': 'NOT_ISSUED',
    'Offer Letter Issued At': '',
    'Acceptance Status': 'NOT_OPEN',

    'Orientation Session ID': '',
    'Orientation Status': 'NOT_ASSIGNED',
    'Provisioning Status': 'NOT_STARTED',
    'Academic Handover Status': 'NOT_READY',

    'Student Folder URL': '',
    'Last Updated': now,
    'Updated By': 'Controlled SAC Voting Test',
    'Version': V2_BUILD
  });


  // --------------------------------------------------
  // 3. Create SAC session
  // --------------------------------------------------

  const session = v2CreateSacSession_(
    {
      sessionId: sessionId,
      name: 'Controlled SAC Voting Test',
      meetingDate: Utilities.formatDate(
        new Date(),
        CONFIG.timezone || 'Asia/Kuala_Lumpur',
        'yyyy-MM-dd'
      ),
      meetingTime: '10:00',
      chairperson: 'Controlled Test Chair',
      venueLink: 'TEST'
    },
    'Controlled SAC Voting Test'
  );


  // --------------------------------------------------
  // 4. Assign candidate
  // --------------------------------------------------

  const candidate = v2AssignSacCandidate_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      priority: 'NORMAL'
    },
    'Controlled SAC Voting Test'
  );


  // --------------------------------------------------
  // 5. Reviewer 1 votes DIRECT_ENTRY
  // --------------------------------------------------

  const vote1 = v2RecordSacVote_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      reviewer: 'Reviewer 1',
      vote: 'DIRECT_ENTRY',
      remarks: 'Initial vote.'
    },
    'Reviewer 1'
  );


  // --------------------------------------------------
  // 6. Reviewer 2 votes INTERNAL_ASSESSMENT
  // --------------------------------------------------

  const vote2 = v2RecordSacVote_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      reviewer: 'Reviewer 2',
      vote: 'INTERNAL_ASSESSMENT',
      remarks: 'Second reviewer vote.'
    },
    'Reviewer 2'
  );


  // --------------------------------------------------
  // 7. Reviewer 1 changes vote
  // Must update same reviewer record, not create duplicate.
  // --------------------------------------------------

  const vote1Updated = v2RecordSacVote_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      reviewer: 'Reviewer 1',
      vote: 'INTERNAL_ASSESSMENT',
      remarks: 'Reviewer changed vote.'
    },
    'Reviewer 1'
  );


  // --------------------------------------------------
  // 8. Verify votes
  // --------------------------------------------------

  const votes = v2Rows_('V2_SAC_VOTES').filter(function(row) {
    return (
      String(row['SAC Session ID']) === sessionId &&
      String(row['Reference No']) === reference &&
      String(row['Vote Status']) === 'ACTIVE'
    );
  });

  const reviewer1Votes = votes.filter(function(row) {
    return String(row['Reviewer']) === 'Reviewer 1';
  });

  const reviewer2Votes = votes.filter(function(row) {
    return String(row['Reviewer']) === 'Reviewer 2';
  });

  const workflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );

  const checks = {
    sessionCreated:
      !!session && session.ok === true,

    candidateAssigned:
      !!candidate && candidate.ok === true,

    workflowInSacReview:
      !!workflow &&
      String(workflow.record['Application Stage']) === 'SAC_REVIEW',

    reviewer1SingleActiveVote:
      reviewer1Votes.length === 1,

    reviewer1VoteUpdated:
      reviewer1Votes.length === 1 &&
      String(reviewer1Votes[0]['Vote']) === 'INTERNAL_ASSESSMENT',

    reviewer2SingleActiveVote:
      reviewer2Votes.length === 1,

    reviewer2VoteCorrect:
      reviewer2Votes.length === 1 &&
      String(reviewer2Votes[0]['Vote']) === 'INTERNAL_ASSESSMENT',

    totalActiveVotes:
      votes.length === 2,

    noFinalDecisionYet:
      !!workflow &&
      !String(workflow.record['SAC Decision'] || '').trim()
  };


  const report = {
    ok:
      checks.sessionCreated &&
      checks.candidateAssigned &&
      checks.workflowInSacReview &&
      checks.reviewer1SingleActiveVote &&
      checks.reviewer1VoteUpdated &&
      checks.reviewer2SingleActiveVote &&
      checks.reviewer2VoteCorrect &&
      checks.totalActiveVotes &&
      checks.noFinalDecisionYet,

    sessionId: sessionId,
    referenceNo: reference,

    activeVoteCount: votes.length,

    checks: checks,

    finalDecisionMade: false,
    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2SacVoteSummaryControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const now = new Date().toISOString();

  const reference = 'V2-SAC-SUMMARY-TEST-' + stamp;
  const sessionId = 'SAC-SUMMARY-TEST-' + stamp;
  const studentName = 'V2 SAC SUMMARY TEST ' + stamp;


  // --------------------------------------------------
  // 1. Create isolated test applicant
  // --------------------------------------------------

  v2Append_('V2_APPLICATIONS', {
    'Reference No': reference,
    'Submitted At': now,
    'Applicant Type': 'Local (Malaysian Citizen)',
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Phone Number': 'TEST',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Study Mode': 'Online',
    'Intake': 'September 2026',
    'Intake ID': 'SEP-2026',

    'Entry Qualification Type': 'Academic Qualification',
    'Highest Qualification': 'Bachelor Degree',
    'Institution / Awarding Body': 'V2 Test Environment',
    'Field of Study': 'Business Administration',
    'Academic Result / CGPA / Grade': '3.00',

    'Transfer Applicant': 'NO',

    'Application Status': 'TEST',
    'Email Status': 'DISABLED',
    'Last Updated': now,
    'Version': 'CONTROLLED_SAC_SUMMARY_TEST'
  });


  // --------------------------------------------------
  // 2. Workflow READY_FOR_SAC
  // --------------------------------------------------

  v2Append_('V2_WORKFLOW', {
    'Reference No': reference,
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Innovative Email': '',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Intake': 'SEP-2026',

    'Application Stage': 'READY_FOR_SAC',
    'Application Status': 'TEST',

    'Document Review Status': 'COMPLETE',
    'Qualification Screening Status': 'COMPLETED',
    'Screening Recommendation': 'INTERNAL_ASSESSMENT',

    'SAC Session ID': '',
    'SAC Decision': '',
    'SAC Endorsed At': '',

    'Assessment Status': 'NOT_DETERMINED',
    'Prerequisite Status': 'NOT_DETERMINED',
    'Offer Letter Status': 'NOT_ISSUED',
    'Acceptance Status': 'NOT_OPEN',

    'Last Updated': now,
    'Updated By': 'Controlled SAC Summary Test',
    'Version': V2_BUILD
  });


  // --------------------------------------------------
  // 3. Create session and assign candidate
  // --------------------------------------------------

  v2CreateSacSession_(
    {
      sessionId: sessionId,
      name: 'Controlled SAC Summary Test',
      meetingDate: Utilities.formatDate(
        new Date(),
        CONFIG.timezone || 'Asia/Kuala_Lumpur',
        'yyyy-MM-dd'
      ),
      meetingTime: '10:00',
      chairperson: 'Controlled Test Chair'
    },
    'Controlled SAC Summary Test'
  );

  v2AssignSacCandidate_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      priority: 'NORMAL'
    },
    'Controlled SAC Summary Test'
  );


  // --------------------------------------------------
  // 4. First voting pattern = split decision
  // --------------------------------------------------

  v2RecordSacVote_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      reviewer: 'Reviewer 1',
      vote: 'DIRECT_ENTRY',
      remarks: 'Vote 1'
    },
    'Reviewer 1'
  );

  v2RecordSacVote_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      reviewer: 'Reviewer 2',
      vote: 'INTERNAL_ASSESSMENT',
      remarks: 'Vote 2'
    },
    'Reviewer 2'
  );


  const splitSummary =
    v2GetSacVoteSummary_(sessionId, reference);


  // --------------------------------------------------
  // 5. Reviewer 1 changes vote -> unanimous IA
  // --------------------------------------------------

  v2RecordSacVote_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      reviewer: 'Reviewer 1',
      vote: 'INTERNAL_ASSESSMENT',
      remarks: 'Changed to IA'
    },
    'Reviewer 1'
  );


  const unanimousSummary =
    v2GetSacVoteSummary_(sessionId, reference);


  // --------------------------------------------------
  // 6. Verify
  // --------------------------------------------------

  const checks = {

    splitVoteCount:
      splitSummary.activeVoteCount === 2,

    splitDirectCount:
      splitSummary.counts.DIRECT_ENTRY === 1,

    splitIaCount:
      splitSummary.counts.INTERNAL_ASSESSMENT === 1,

    splitNotUnanimous:
      splitSummary.unanimous === false,

    noFinalDecisionDuringSplit:
      splitSummary.finalDecisionMade === false,


    unanimousVoteCount:
      unanimousSummary.activeVoteCount === 2,

    unanimousDirectZero:
      unanimousSummary.counts.DIRECT_ENTRY === 0,

    unanimousIaTwo:
      unanimousSummary.counts.INTERNAL_ASSESSMENT === 2,

    unanimousDetected:
      unanimousSummary.unanimous === true,

    unanimousVoteCorrect:
      unanimousSummary.unanimousVote === 'INTERNAL_ASSESSMENT',

    stillNoFinalDecision:
      unanimousSummary.finalDecisionMade === false
  };


  const report = {
    ok:
      checks.splitVoteCount &&
      checks.splitDirectCount &&
      checks.splitIaCount &&
      checks.splitNotUnanimous &&
      checks.noFinalDecisionDuringSplit &&
      checks.unanimousVoteCount &&
      checks.unanimousDirectZero &&
      checks.unanimousIaTwo &&
      checks.unanimousDetected &&
      checks.unanimousVoteCorrect &&
      checks.stillNoFinalDecision,

    sessionId: sessionId,
    referenceNo: reference,

    splitSummary: splitSummary,
    unanimousSummary: unanimousSummary,

    checks: checks,

    finalDecisionMade: false,
    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2SacFinalisationControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const now = new Date().toISOString();

  const reference = 'V2-SAC-FINAL-TEST-' + stamp;
  const sessionId = 'SAC-FINAL-TEST-' + stamp;
  const studentName = 'V2 SAC FINALISATION TEST ' + stamp;


  // --------------------------------------------------
  // 1. Create isolated V2 application
  // --------------------------------------------------

  v2Append_('V2_APPLICATIONS', {
    'Reference No': reference,
    'Submitted At': now,
    'Applicant Type': 'Local (Malaysian Citizen)',
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Phone Number': 'TEST',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Study Mode': 'Online',
    'Intake': 'September 2026',
    'Intake ID': 'SEP-2026',

    'Entry Qualification Type': 'Academic Qualification',
    'Highest Qualification': 'Bachelor Degree',
    'Institution / Awarding Body': 'V2 Test Environment',
    'Field of Study': 'Engineering',
    'Academic Result / CGPA / Grade': '2.80',

    'Application Status': 'TEST',
    'Email Status': 'DISABLED',
    'Last Updated': now,
    'Version': 'CONTROLLED_SAC_FINALISATION_TEST'
  });


  // --------------------------------------------------
  // 2. Workflow READY_FOR_SAC
  // --------------------------------------------------

  v2Append_('V2_WORKFLOW', {
    'Reference No': reference,
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Innovative Email': '',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Intake': 'SEP-2026',

    'Application Stage': 'READY_FOR_SAC',
    'Application Status': 'TEST',

    'Document Review Status': 'COMPLETE',
    'Qualification Screening Status': 'COMPLETED',
    'Field Classification': 'NON_RELATED',
    'Relevant Work Experience': 'NO',
    'Screening Recommendation':
      'PREREQUISITE_OR_BRIDGING_REVIEW',

    'SAC Session ID': '',
    'SAC Decision': '',
    'SAC Endorsed At': '',

    'Assessment Status': 'NOT_DETERMINED',
    'Prerequisite Status': 'NOT_DETERMINED',

    'Offer Letter Status': 'NOT_ISSUED',
    'Acceptance Status': 'NOT_OPEN',

    'Last Updated': now,
    'Updated By': 'Controlled SAC Finalisation Test',
    'Version': V2_BUILD
  });


  // --------------------------------------------------
  // 3. Create SAC session + assign candidate
  // --------------------------------------------------

  v2CreateSacSession_(
    {
      sessionId: sessionId,
      name: 'Controlled SAC Finalisation Test',
      meetingDate: Utilities.formatDate(
        new Date(),
        CONFIG.timezone || 'Asia/Kuala_Lumpur',
        'yyyy-MM-dd'
      ),
      meetingTime: '10:00',
      chairperson: 'Controlled Test Chair'
    },
    'Controlled SAC Finalisation Test'
  );

  v2AssignSacCandidate_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      priority: 'NORMAL'
    },
    'Controlled SAC Finalisation Test'
  );


  // --------------------------------------------------
  // 4. Two reviewers vote PREREQUISITE
  // --------------------------------------------------

  v2RecordSacVote_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      reviewer: 'Reviewer 1',
      vote: 'PREREQUISITE',
      remarks: 'Prerequisite recommended.'
    },
    'Reviewer 1'
  );

  v2RecordSacVote_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      reviewer: 'Reviewer 2',
      vote: 'PREREQUISITE',
      remarks: 'Prerequisite recommended.'
    },
    'Reviewer 2'
  );


  // --------------------------------------------------
  // 5. Must BLOCK without explicit confirmation
  // --------------------------------------------------

  let blockedWithoutConfirmation = false;
  let blockedMessage = '';

  try {
    v2RecordSacDecision_(
      {
        sessionId: sessionId,
        referenceNo: reference,
        decision: 'PREREQUISITE',
        confirmed: false,
        remarks: 'This must be blocked.'
      },
      'Controlled SAC Chair'
    );

  } catch (error) {
    blockedWithoutConfirmation = true;
    blockedMessage = String(
      error && error.message || error
    );
  }


  // --------------------------------------------------
  // 6. Explicit final confirmation
  // --------------------------------------------------

  const finalResult = v2RecordSacDecision_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      decision: 'PREREQUISITE',
      confirmed: true,
      priority: 'NORMAL',
      remarks:
        'Explicitly confirmed after SAC vote review.'
    },
    'Controlled SAC Chair'
  );


  // --------------------------------------------------
  // 7. Verify final state
  // --------------------------------------------------

  const workflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );

  const candidate = v2FindComposite_(
    'V2_SAC_CANDIDATES',
    ['SAC Session ID', 'Reference No'],
    [sessionId, reference]
  );

  const finalSummary =
    v2GetSacVoteSummary_(sessionId, reference);


  const checks = {

    blockedWithoutConfirmation:
      blockedWithoutConfirmation === true,

    blockedReasonCorrect:
      blockedMessage.indexOf(
        'Explicit SAC final decision confirmation is required'
      ) > -1,

    finalResultOk:
      finalResult &&
      finalResult.ok === true,

    finalDecisionCorrect:
      String(workflow.record['SAC Decision']) ===
      'PREREQUISITE',

    workflowStageCorrect:
      String(workflow.record['Application Stage']) ===
      'PREREQUISITE',

    prerequisiteStatusCorrect:
      String(workflow.record['Prerequisite Status']) ===
      'REQUIRED',

    assessmentStatusCorrect:
      String(workflow.record['Assessment Status']) ===
      'NOT_REQUIRED',

    candidateDecisionCorrect:
      String(candidate.record['Decision']) ===
      'PREREQUISITE',

    letterActionCorrect:
      String(candidate.record['Letter Action']) ===
      'COL_PREREQUISITE_READY',

    finalDecisionNowMade:
      finalSummary.finalDecisionMade === true,

    finalSummaryCorrect:
      finalSummary.finalDecision ===
      'PREREQUISITE',

    explicitConfirmationRecorded:
      finalResult.explicitlyConfirmed === true
  };


  const report = {
    ok:
      checks.blockedWithoutConfirmation &&
      checks.blockedReasonCorrect &&
      checks.finalResultOk &&
      checks.finalDecisionCorrect &&
      checks.workflowStageCorrect &&
      checks.prerequisiteStatusCorrect &&
      checks.assessmentStatusCorrect &&
      checks.candidateDecisionCorrect &&
      checks.letterActionCorrect &&
      checks.finalDecisionNowMade &&
      checks.finalSummaryCorrect &&
      checks.explicitConfirmationRecorded,

    sessionId: sessionId,
    referenceNo: reference,

    checks: checks,

    finalDecision: finalSummary.finalDecision,
    nextStage: workflow.record['Application Stage'],

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2SacSessionFinalisationControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const now = new Date().toISOString();

  const reference = 'V2-SAC-SESSION-TEST-' + stamp;
  const sessionId = 'SAC-SESSION-TEST-' + stamp;
  const studentName = 'V2 SAC SESSION FINAL TEST ' + stamp;


  // --------------------------------------------------
  // 1. Create isolated V2 applicant
  // --------------------------------------------------

  v2Append_('V2_APPLICATIONS', {
    'Reference No': reference,
    'Submitted At': now,
    'Applicant Type': 'Local (Malaysian Citizen)',
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Phone Number': 'TEST',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Study Mode': 'Online',
    'Intake': 'September 2026',
    'Intake ID': 'SEP-2026',

    'Entry Qualification Type': 'Academic Qualification',
    'Highest Qualification': 'Bachelor Degree',
    'Institution / Awarding Body': 'V2 Test Environment',
    'Field of Study': 'Business Administration',
    'Academic Result / CGPA / Grade': '3.00',

    'Application Status': 'TEST',
    'Email Status': 'DISABLED',
    'Last Updated': now,
    'Version': 'CONTROLLED_SAC_SESSION_TEST'
  });


  // --------------------------------------------------
  // 2. Workflow READY_FOR_SAC
  // --------------------------------------------------

  v2Append_('V2_WORKFLOW', {
    'Reference No': reference,
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Innovative Email': '',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Intake': 'SEP-2026',

    'Application Stage': 'READY_FOR_SAC',
    'Application Status': 'TEST',

    'Document Review Status': 'COMPLETE',
    'Qualification Screening Status': 'COMPLETED',
    'Screening Recommendation': 'DIRECT_ENTRY',

    'SAC Session ID': '',
    'SAC Decision': '',
    'SAC Endorsed At': '',

    'Assessment Status': 'NOT_DETERMINED',
    'Prerequisite Status': 'NOT_DETERMINED',

    'Offer Letter Status': 'NOT_ISSUED',
    'Acceptance Status': 'NOT_OPEN',

    'Last Updated': now,
    'Updated By': 'Controlled SAC Session Test',
    'Version': V2_BUILD
  });


  // --------------------------------------------------
  // 3. Create SAC session + assign candidate
  // --------------------------------------------------

  v2CreateSacSession_(
    {
      sessionId: sessionId,
      name: 'Controlled SAC Session Finalisation Test',
      meetingDate: Utilities.formatDate(
        new Date(),
        CONFIG.timezone || 'Asia/Kuala_Lumpur',
        'yyyy-MM-dd'
      ),
      meetingTime: '10:00',
      chairperson: 'Controlled Test Chair'
    },
    'Controlled SAC Session Test'
  );

  v2AssignSacCandidate_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      priority: 'NORMAL'
    },
    'Controlled SAC Session Test'
  );


  // --------------------------------------------------
  // 4. Finalisation must be BLOCKED while decision pending
  // --------------------------------------------------

  let pendingBlocked = false;
  let pendingBlockedMessage = '';

  try {
    v2FinalizeSacSession_(
      {
        sessionId: sessionId,
        confirmed: true,
        remarks: 'Must be blocked because candidate is pending.'
      },
      'Controlled Test Chair'
    );

  } catch (error) {
    pendingBlocked = true;
    pendingBlockedMessage = String(
      error && error.message || error
    );
  }


  // --------------------------------------------------
  // 5. Record vote + explicit final decision
  // --------------------------------------------------

  v2RecordSacVote_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      reviewer: 'Reviewer 1',
      vote: 'DIRECT_ENTRY',
      remarks: 'Direct entry recommended.'
    },
    'Reviewer 1'
  );

  v2RecordSacDecision_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      decision: 'DIRECT_ENTRY',
      confirmed: true,
      remarks: 'Explicit final decision.'
    },
    'Controlled Test Chair'
  );


  // --------------------------------------------------
  // 6. Finalise complete SAC session
  // --------------------------------------------------

  const finalResult = v2FinalizeSacSession_(
    {
      sessionId: sessionId,
      confirmed: true,
      remarks: 'All candidate decisions completed.'
    },
    'Controlled Test Chair'
  );


  // --------------------------------------------------
  // 7. Verify session
  // --------------------------------------------------

  const session = v2Find_(
    'V2_SAC_SESSIONS',
    'SAC Session ID',
    sessionId
  );


  const checks = {

    pendingFinalisationBlocked:
      pendingBlocked === true,

    pendingBlockReasonCorrect:
      pendingBlockedMessage.indexOf(
        'candidate decisions are pending'
      ) > -1,

    finalResultOk:
      finalResult &&
      finalResult.ok === true,

    sessionFinalized:
      String(session.record['Status']) === 'FINALIZED',

    candidateCountCorrect:
      Number(finalResult.candidateCount) === 1,

    pendingCountZero:
      Number(finalResult.pendingCandidateCount) === 0,

    directEntryCountCorrect:
      Number(
        finalResult.decisionCounts.DIRECT_ENTRY
      ) === 1,

    readyForMinutes:
      finalResult.readyForMinutes === true,

    readyForEndorsement:
      finalResult.readyForEndorsement === true,

    minutesNotGeneratedYet:
      finalResult.minutesGenerated === false,

    endorsementNotGeneratedYet:
      finalResult.endorsementGenerated === false
  };


  const report = {
    ok:
      checks.pendingFinalisationBlocked &&
      checks.pendingBlockReasonCorrect &&
      checks.finalResultOk &&
      checks.sessionFinalized &&
      checks.candidateCountCorrect &&
      checks.pendingCountZero &&
      checks.directEntryCountCorrect &&
      checks.readyForMinutes &&
      checks.readyForEndorsement &&
      checks.minutesNotGeneratedYet &&
      checks.endorsementNotGeneratedYet,

    sessionId: sessionId,
    referenceNo: reference,

    checks: checks,

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2PrerequisiteDirectSacControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const now = new Date().toISOString();

  const reference = 'V2-PRQ-DIRECT-TEST-' + stamp;
  const sessionId = 'SAC-PRQ-DIRECT-TEST-' + stamp;
  const studentName = 'V2 DIRECT PREREQUISITE TEST ' + stamp;


  // --------------------------------------------------
  // 1. Create isolated application
  // --------------------------------------------------

  v2Append_('V2_APPLICATIONS', {
    'Reference No': reference,
    'Submitted At': now,
    'Applicant Type': 'Local (Malaysian Citizen)',
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Phone Number': 'TEST',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Study Mode': 'Online',
    'Intake': 'September 2026',
    'Intake ID': 'SEP-2026',

    'Entry Qualification Type': 'Academic Qualification',
    'Highest Qualification': 'Bachelor Degree',
    'Institution / Awarding Body': 'V2 Test Environment',
    'Field of Study': 'Engineering',
    'Academic Result / CGPA / Grade': '2.80',

    'Application Status': 'TEST',
    'Email Status': 'DISABLED',
    'Last Updated': now,
    'Version': 'CONTROLLED_DIRECT_PREREQUISITE_TEST'
  });


  // --------------------------------------------------
  // 2. Workflow READY_FOR_SAC
  // --------------------------------------------------

  v2Append_('V2_WORKFLOW', {
    'Reference No': reference,
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Innovative Email': '',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Intake': 'SEP-2026',

    'Application Stage': 'READY_FOR_SAC',
    'Application Status': 'TEST',

    'Document Review Status': 'COMPLETE',
    'Qualification Screening Status': 'COMPLETED',
    'Field Classification': 'NON_RELATED',
    'Relevant Work Experience': 'NO',
    'Screening Recommendation':
      'PREREQUISITE_OR_BRIDGING_REVIEW',

    'SAC Session ID': '',
    'SAC Decision': '',
    'SAC Endorsed At': '',

    'Assessment Status': 'NOT_DETERMINED',
    'Prerequisite Status': 'NOT_DETERMINED',

    'Offer Letter Status': 'NOT_ISSUED',
    'Acceptance Status': 'NOT_OPEN',

    'Last Updated': now,
    'Updated By': 'Controlled Direct Prerequisite Test',
    'Version': V2_BUILD
  });


  // --------------------------------------------------
  // 3. SAC session + candidate
  // --------------------------------------------------

  v2CreateSacSession_(
    {
      sessionId: sessionId,
      name: 'Controlled Direct Prerequisite Test',
      meetingDate: Utilities.formatDate(
        new Date(),
        CONFIG.timezone || 'Asia/Kuala_Lumpur',
        'yyyy-MM-dd'
      ),
      meetingTime: '10:00',
      chairperson: 'Controlled Test Chair'
    },
    'Controlled Test'
  );

  v2AssignSacCandidate_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      priority: 'NORMAL'
    },
    'Controlled Test'
  );


  // --------------------------------------------------
  // 4. Vote + final SAC decision = PREREQUISITE
  // --------------------------------------------------

  v2RecordSacVote_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      reviewer: 'Reviewer 1',
      vote: 'PREREQUISITE',
      remarks: 'Prerequisite recommended.'
    },
    'Reviewer 1'
  );

  const sacResult = v2RecordSacDecision_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      decision: 'PREREQUISITE',
      confirmed: true,
      remarks: 'Direct prerequisite route confirmed.'
    },
    'Controlled Test Chair'
  );


  // --------------------------------------------------
  // 5. Verify account auto-created
  // --------------------------------------------------

  const account = v2Find_(
    'V2_ASSESSMENT_ACCOUNTS',
    'Reference No',
    reference
  );


  // --------------------------------------------------
  // 6. Start prerequisite
  // --------------------------------------------------

  const startResult = v2UpdateAssessment_(
    {
      referenceNo: reference,
      assessmentType: 'PREREQUISITE',
      sequence: 1,
      component: 'OVERALL',
      status: 'IN_PROGRESS',
      panelRemarks: 'Controlled prerequisite started.'
    },
    'Controlled Test'
  );


  // --------------------------------------------------
  // 7. Complete prerequisite as QUALIFIED
  // --------------------------------------------------

  const completeResult = v2UpdateAssessment_(
    {
      referenceNo: reference,
      assessmentType: 'PREREQUISITE',
      sequence: 1,
      component: 'OVERALL',
      status: 'COMPLETED',
      panelResult: 'QUALIFIED',
      panelRemarks: 'Controlled prerequisite completed.'
    },
    'Controlled Test'
  );


  // --------------------------------------------------
  // 8. Verify final workflow
  // --------------------------------------------------

  const workflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );


  const checks = {

    sacDecisionPrerequisite:
      sacResult &&
      sacResult.decision === 'PREREQUISITE',

    stageAfterSacCorrect:
      sacResult &&
      sacResult.nextStage === 'PREREQUISITE',

    accountAutoCreated:
      !!account,

    accountActive:
      !!account &&
      String(account.record['Account Status']) === 'ACTIVE',

    prerequisiteStartAllowed:
      startResult &&
      startResult.ok === true,

    prerequisiteCompleteAllowed:
      completeResult &&
      completeResult.ok === true,

    prerequisiteQualified:
      String(
        workflow.record['Prerequisite Status']
      ) === 'COMPLETED_QUALIFIED',

    finalStageEligibleForOffer:
      String(
        workflow.record['Application Stage']
      ) === 'ELIGIBLE_FOR_OFFER'
  };


  const report = {
    ok:
      checks.sacDecisionPrerequisite &&
      checks.stageAfterSacCorrect &&
      checks.accountAutoCreated &&
      checks.accountActive &&
      checks.prerequisiteStartAllowed &&
      checks.prerequisiteCompleteAllowed &&
      checks.prerequisiteQualified &&
      checks.finalStageEligibleForOffer,

    referenceNo: reference,
    sessionId: sessionId,

    checks: checks,

    finalStage:
      workflow.record['Application Stage'],

    prerequisiteStatus:
      workflow.record['Prerequisite Status'],

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2IaToPrerequisiteControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const now = new Date().toISOString();

  const reference = 'V2-IA-PRQ-TEST-' + stamp;
  const sessionId = 'SAC-IA-PRQ-TEST-' + stamp;
  const studentName = 'V2 IA TO PREREQUISITE TEST ' + stamp;


  // --------------------------------------------------
  // 1. Create isolated application
  // --------------------------------------------------

  v2Append_('V2_APPLICATIONS', {
    'Reference No': reference,
    'Submitted At': now,
    'Applicant Type': 'Local (Malaysian Citizen)',
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Phone Number': 'TEST',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Study Mode': 'Online',
    'Intake': 'September 2026',
    'Intake ID': 'SEP-2026',

    'Entry Qualification Type': 'Academic Qualification',
    'Highest Qualification': 'Bachelor Degree',
    'Institution / Awarding Body': 'V2 Test Environment',
    'Field of Study': 'Engineering',
    'Academic Result / CGPA / Grade': '2.80',

    'Application Status': 'TEST',
    'Email Status': 'DISABLED',
    'Last Updated': now,
    'Version': 'CONTROLLED_IA_TO_PREREQUISITE_TEST'
  });


  // --------------------------------------------------
  // 2. Workflow READY_FOR_SAC
  // --------------------------------------------------

  v2Append_('V2_WORKFLOW', {
    'Reference No': reference,
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Innovative Email': '',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Intake': 'SEP-2026',

    'Application Stage': 'READY_FOR_SAC',
    'Application Status': 'TEST',

    'Document Review Status': 'COMPLETE',
    'Qualification Screening Status': 'COMPLETED',
    'Field Classification': 'NON_RELATED',
    'Relevant Work Experience': 'YES',
    'Screening Recommendation': 'INTERNAL_ASSESSMENT',

    'SAC Session ID': '',
    'SAC Decision': '',
    'SAC Endorsed At': '',

    'Assessment Status': 'NOT_DETERMINED',
    'Prerequisite Status': 'NOT_DETERMINED',

    'Offer Letter Status': 'NOT_ISSUED',
    'Acceptance Status': 'NOT_OPEN',

    'Last Updated': now,
    'Updated By': 'Controlled IA to Prerequisite Test',
    'Version': V2_BUILD
  });


  // --------------------------------------------------
  // 3. SAC session + candidate
  // --------------------------------------------------

  v2CreateSacSession_(
    {
      sessionId: sessionId,
      name: 'Controlled IA to Prerequisite Test',
      meetingDate: Utilities.formatDate(
        new Date(),
        CONFIG.timezone || 'Asia/Kuala_Lumpur',
        'yyyy-MM-dd'
      ),
      meetingTime: '10:00',
      chairperson: 'Controlled Test Chair'
    },
    'Controlled Test'
  );

  v2AssignSacCandidate_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      priority: 'NORMAL'
    },
    'Controlled Test'
  );


  // --------------------------------------------------
  // 4. SAC decision = INTERNAL_ASSESSMENT
  // --------------------------------------------------

  v2RecordSacVote_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      reviewer: 'Reviewer 1',
      vote: 'INTERNAL_ASSESSMENT',
      remarks: 'IA recommended.'
    },
    'Reviewer 1'
  );

  const sacResult = v2RecordSacDecision_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      decision: 'INTERNAL_ASSESSMENT',
      confirmed: true,
      remarks: 'Internal Assessment confirmed.'
    },
    'Controlled Test Chair'
  );


  // --------------------------------------------------
  // 5. Verify IA account created
  // --------------------------------------------------

  const account = v2Find_(
    'V2_ASSESSMENT_ACCOUNTS',
    'Reference No',
    reference
  );


  // --------------------------------------------------
  // 6. Start IA
  // --------------------------------------------------

  const iaStart = v2UpdateAssessment_(
    {
      referenceNo: reference,
      assessmentType: 'INTERNAL_ASSESSMENT',
      sequence: 1,
      component: 'OVERALL',
      status: 'IN_PROGRESS',
      panelRemarks: 'Controlled IA started.'
    },
    'Controlled IA Panel'
  );


  // --------------------------------------------------
  // 7. Complete IA -> PREREQUISITE_REQUIRED
  // --------------------------------------------------

  const iaComplete = v2UpdateAssessment_(
    {
      referenceNo: reference,
      assessmentType: 'INTERNAL_ASSESSMENT',
      sequence: 1,
      component: 'OVERALL',
      status: 'COMPLETED',
      panelResult: 'PREREQUISITE_REQUIRED',
      panelRemarks:
        'IA panel requires prerequisite before admission.'
    },
    'Controlled IA Panel'
  );


  const afterIa = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );


  // --------------------------------------------------
  // 8. Start prerequisite after IA
  // --------------------------------------------------

  const prerequisiteStart = v2UpdateAssessment_(
    {
      referenceNo: reference,
      assessmentType: 'PREREQUISITE',
      sequence: 1,
      component: 'OVERALL',
      status: 'IN_PROGRESS',
      panelRemarks:
        'Prerequisite started following IA result.'
    },
    'Controlled Prerequisite Panel'
  );


  // --------------------------------------------------
  // 9. Complete prerequisite -> QUALIFIED
  // --------------------------------------------------

  const prerequisiteComplete = v2UpdateAssessment_(
    {
      referenceNo: reference,
      assessmentType: 'PREREQUISITE',
      sequence: 1,
      component: 'OVERALL',
      status: 'COMPLETED',
      panelResult: 'QUALIFIED',
      panelRemarks:
        'Prerequisite completed and qualified.'
    },
    'Controlled Prerequisite Panel'
  );


  // --------------------------------------------------
  // 10. Verify final workflow
  // --------------------------------------------------

  const finalWorkflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );


  const checks = {

    sacDecisionIa:
      sacResult &&
      sacResult.decision === 'INTERNAL_ASSESSMENT',

    stageAfterSacIa:
      sacResult &&
      sacResult.nextStage === 'INTERNAL_ASSESSMENT',

    accountAutoCreated:
      !!account,

    accountActive:
      !!account &&
      String(account.record['Account Status']) === 'ACTIVE',

    iaStartAllowed:
      iaStart &&
      iaStart.ok === true,

    iaCompleteAllowed:
      iaComplete &&
      iaComplete.ok === true,

    iaResultRequiresPrerequisite:
      String(
        afterIa.record['Assessment Status']
      ) === 'COMPLETED_PREREQUISITE_REQUIRED',

    stageAfterIaPrerequisite:
      String(
        afterIa.record['Application Stage']
      ) === 'PREREQUISITE',

    prerequisiteMarkedRequired:
      String(
        afterIa.record['Prerequisite Status']
      ) === 'REQUIRED',

    prerequisiteStartAllowed:
      prerequisiteStart &&
      prerequisiteStart.ok === true,

    prerequisiteCompleteAllowed:
      prerequisiteComplete &&
      prerequisiteComplete.ok === true,

    prerequisiteQualified:
      String(
        finalWorkflow.record['Prerequisite Status']
      ) === 'COMPLETED_QUALIFIED',

    finalStageEligibleForOffer:
      String(
        finalWorkflow.record['Application Stage']
      ) === 'ELIGIBLE_FOR_OFFER'
  };


  const report = {
    ok:
      checks.sacDecisionIa &&
      checks.stageAfterSacIa &&
      checks.accountAutoCreated &&
      checks.accountActive &&
      checks.iaStartAllowed &&
      checks.iaCompleteAllowed &&
      checks.iaResultRequiresPrerequisite &&
      checks.stageAfterIaPrerequisite &&
      checks.prerequisiteMarkedRequired &&
      checks.prerequisiteStartAllowed &&
      checks.prerequisiteCompleteAllowed &&
      checks.prerequisiteQualified &&
      checks.finalStageEligibleForOffer,

    referenceNo: reference,
    sessionId: sessionId,

    checks: checks,

    finalStage:
      finalWorkflow.record['Application Stage'],

    assessmentStatus:
      finalWorkflow.record['Assessment Status'],

    prerequisiteStatus:
      finalWorkflow.record['Prerequisite Status'],

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2IaQualifiedControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const now = new Date().toISOString();

  const reference = 'V2-IA-QUALIFIED-TEST-' + stamp;
  const sessionId = 'SAC-IA-QUALIFIED-TEST-' + stamp;
  const studentName = 'V2 IA QUALIFIED TEST ' + stamp;


  // --------------------------------------------------
  // 1. Create isolated application
  // --------------------------------------------------

  v2Append_('V2_APPLICATIONS', {
    'Reference No': reference,
    'Submitted At': now,
    'Applicant Type': 'Local (Malaysian Citizen)',
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Phone Number': 'TEST',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Study Mode': 'Online',
    'Intake': 'September 2026',
    'Intake ID': 'SEP-2026',

    'Entry Qualification Type': 'Academic Qualification',
    'Highest Qualification': 'Bachelor Degree',
    'Institution / Awarding Body': 'V2 Test Environment',
    'Field of Study': 'Business Administration',
    'Academic Result / CGPA / Grade': '2.30',

    'Application Status': 'TEST',
    'Email Status': 'DISABLED',
    'Last Updated': now,
    'Version': 'CONTROLLED_IA_QUALIFIED_TEST'
  });


  // --------------------------------------------------
  // 2. Workflow READY_FOR_SAC
  // --------------------------------------------------

  v2Append_('V2_WORKFLOW', {
    'Reference No': reference,
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Innovative Email': '',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Intake': 'SEP-2026',

    'Application Stage': 'READY_FOR_SAC',
    'Application Status': 'TEST',

    'Document Review Status': 'COMPLETE',
    'Qualification Screening Status': 'COMPLETED',
    'Field Classification': 'RELATED',
    'Relevant Work Experience': 'NO',
    'Screening Recommendation': 'INTERNAL_ASSESSMENT',

    'SAC Session ID': '',
    'SAC Decision': '',
    'SAC Endorsed At': '',

    'Assessment Status': 'NOT_DETERMINED',
    'Prerequisite Status': 'NOT_DETERMINED',

    'Offer Letter Status': 'NOT_ISSUED',
    'Acceptance Status': 'NOT_OPEN',

    'Last Updated': now,
    'Updated By': 'Controlled IA Qualified Test',
    'Version': V2_BUILD
  });


  // --------------------------------------------------
  // 3. SAC session + candidate
  // --------------------------------------------------

  v2CreateSacSession_(
    {
      sessionId: sessionId,
      name: 'Controlled IA Qualified Test',
      meetingDate: Utilities.formatDate(
        new Date(),
        CONFIG.timezone || 'Asia/Kuala_Lumpur',
        'yyyy-MM-dd'
      ),
      meetingTime: '10:00',
      chairperson: 'Controlled Test Chair'
    },
    'Controlled Test'
  );

  v2AssignSacCandidate_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      priority: 'NORMAL'
    },
    'Controlled Test'
  );


  // --------------------------------------------------
  // 4. SAC decision = INTERNAL_ASSESSMENT
  // --------------------------------------------------

  v2RecordSacVote_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      reviewer: 'Reviewer 1',
      vote: 'INTERNAL_ASSESSMENT',
      remarks: 'IA recommended.'
    },
    'Reviewer 1'
  );

  const sacResult = v2RecordSacDecision_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      decision: 'INTERNAL_ASSESSMENT',
      confirmed: true,
      remarks: 'IA confirmed.'
    },
    'Controlled Test Chair'
  );


  // --------------------------------------------------
  // 5. Verify account
  // --------------------------------------------------

  const account = v2Find_(
    'V2_ASSESSMENT_ACCOUNTS',
    'Reference No',
    reference
  );


  // --------------------------------------------------
  // 6. Start IA
  // --------------------------------------------------

  const iaStart = v2UpdateAssessment_(
    {
      referenceNo: reference,
      assessmentType: 'INTERNAL_ASSESSMENT',
      sequence: 1,
      component: 'OVERALL',
      status: 'IN_PROGRESS',
      panelRemarks: 'Controlled IA started.'
    },
    'Controlled IA Panel'
  );


  // --------------------------------------------------
  // 7. Complete IA = QUALIFIED
  // --------------------------------------------------

  const iaComplete = v2UpdateAssessment_(
    {
      referenceNo: reference,
      assessmentType: 'INTERNAL_ASSESSMENT',
      sequence: 1,
      component: 'OVERALL',
      status: 'COMPLETED',
      panelResult: 'QUALIFIED',
      panelRemarks: 'IA completed and qualified.'
    },
    'Controlled IA Panel'
  );


  // --------------------------------------------------
  // 8. Verify workflow
  // --------------------------------------------------

  const workflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );


  const checks = {

    sacDecisionIa:
      sacResult &&
      sacResult.decision === 'INTERNAL_ASSESSMENT',

    stageAfterSacIa:
      sacResult &&
      sacResult.nextStage === 'INTERNAL_ASSESSMENT',

    accountAutoCreated:
      !!account,

    accountActive:
      !!account &&
      String(account.record['Account Status']) === 'ACTIVE',

    iaStartAllowed:
      iaStart &&
      iaStart.ok === true,

    iaCompleteAllowed:
      iaComplete &&
      iaComplete.ok === true,

    assessmentQualified:
      String(
        workflow.record['Assessment Status']
      ) === 'COMPLETED_QUALIFIED',

    finalStageEligibleForOffer:
      String(
        workflow.record['Application Stage']
      ) === 'ELIGIBLE_FOR_OFFER',

    prerequisiteNotRequired:
      String(
        workflow.record['Prerequisite Status'] || ''
      ) !== 'REQUIRED'
  };


  const report = {
    ok:
      checks.sacDecisionIa &&
      checks.stageAfterSacIa &&
      checks.accountAutoCreated &&
      checks.accountActive &&
      checks.iaStartAllowed &&
      checks.iaCompleteAllowed &&
      checks.assessmentQualified &&
      checks.finalStageEligibleForOffer &&
      checks.prerequisiteNotRequired,

    referenceNo: reference,
    sessionId: sessionId,

    checks: checks,

    finalStage:
      workflow.record['Application Stage'],

    assessmentStatus:
      workflow.record['Assessment Status'],

    prerequisiteStatus:
      workflow.record['Prerequisite Status'],

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2IaNotQualifiedControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const now = new Date().toISOString();

  const reference = 'V2-IA-FAILED-TEST-' + stamp;
  const sessionId = 'SAC-IA-FAILED-TEST-' + stamp;
  const studentName = 'V2 IA NOT QUALIFIED TEST ' + stamp;


  v2Append_('V2_APPLICATIONS', {
    'Reference No': reference,
    'Submitted At': now,
    'Applicant Type': 'Local (Malaysian Citizen)',
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Phone Number': 'TEST',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Study Mode': 'Online',
    'Intake': 'September 2026',
    'Intake ID': 'SEP-2026',

    'Entry Qualification Type': 'Academic Qualification',
    'Highest Qualification': 'Bachelor Degree',
    'Institution / Awarding Body': 'V2 Test Environment',
    'Field of Study': 'Business Administration',
    'Academic Result / CGPA / Grade': '2.30',

    'Application Status': 'TEST',
    'Email Status': 'DISABLED',
    'Last Updated': now,
    'Version': 'CONTROLLED_IA_NOT_QUALIFIED_TEST'
  });


  v2Append_('V2_WORKFLOW', {
    'Reference No': reference,
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Innovative Email': '',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Intake': 'SEP-2026',

    'Application Stage': 'READY_FOR_SAC',
    'Application Status': 'TEST',

    'Document Review Status': 'COMPLETE',
    'Qualification Screening Status': 'COMPLETED',
    'Screening Recommendation': 'INTERNAL_ASSESSMENT',

    'SAC Session ID': '',
    'SAC Decision': '',
    'SAC Endorsed At': '',

    'Assessment Status': 'NOT_DETERMINED',
    'Prerequisite Status': 'NOT_DETERMINED',

    'Offer Letter Status': 'NOT_ISSUED',
    'Acceptance Status': 'NOT_OPEN',

    'Last Updated': now,
    'Updated By': 'Controlled IA Not Qualified Test',
    'Version': V2_BUILD
  });


  v2CreateSacSession_(
    {
      sessionId: sessionId,
      name: 'Controlled IA Not Qualified Test',
      meetingDate: Utilities.formatDate(
        new Date(),
        CONFIG.timezone || 'Asia/Kuala_Lumpur',
        'yyyy-MM-dd'
      ),
      meetingTime: '10:00',
      chairperson: 'Controlled Test Chair'
    },
    'Controlled Test'
  );


  v2AssignSacCandidate_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      priority: 'NORMAL'
    },
    'Controlled Test'
  );


  v2RecordSacVote_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      reviewer: 'Reviewer 1',
      vote: 'INTERNAL_ASSESSMENT',
      remarks: 'IA recommended.'
    },
    'Reviewer 1'
  );


  const sacResult = v2RecordSacDecision_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      decision: 'INTERNAL_ASSESSMENT',
      confirmed: true,
      remarks: 'IA confirmed.'
    },
    'Controlled Test Chair'
  );


  const iaStart = v2UpdateAssessment_(
    {
      referenceNo: reference,
      assessmentType: 'INTERNAL_ASSESSMENT',
      sequence: 1,
      component: 'OVERALL',
      status: 'IN_PROGRESS'
    },
    'Controlled IA Panel'
  );


  const iaComplete = v2UpdateAssessment_(
    {
      referenceNo: reference,
      assessmentType: 'INTERNAL_ASSESSMENT',
      sequence: 1,
      component: 'OVERALL',
      status: 'COMPLETED',
      panelResult: 'NOT_QUALIFIED',
      panelRemarks: 'Controlled test - not qualified.'
    },
    'Controlled IA Panel'
  );


  const workflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );


  const checks = {
    sacDecisionIa:
      sacResult &&
      sacResult.decision === 'INTERNAL_ASSESSMENT',

    iaStartAllowed:
      iaStart &&
      iaStart.ok === true,

    iaCompleteAllowed:
      iaComplete &&
      iaComplete.ok === true,

    assessmentNotQualified:
      String(
        workflow.record['Assessment Status']
      ) === 'COMPLETED_NOT_QUALIFIED',

    finalStageRejected:
      String(
        workflow.record['Application Stage']
      ) === 'REJECTED',

    offerStillNotIssued:
      String(
        workflow.record['Offer Letter Status'] || ''
      ) !== 'ISSUED'
  };


  const report = {
    ok:
      checks.sacDecisionIa &&
      checks.iaStartAllowed &&
      checks.iaCompleteAllowed &&
      checks.assessmentNotQualified &&
      checks.finalStageRejected &&
      checks.offerStillNotIssued,

    referenceNo: reference,
    sessionId: sessionId,

    checks: checks,

    finalStage:
      workflow.record['Application Stage'],

    assessmentStatus:
      workflow.record['Assessment Status'],

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2PrerequisiteNotQualifiedControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const now = new Date().toISOString();

  const reference = 'V2-PRQ-FAILED-TEST-' + stamp;
  const sessionId = 'SAC-PRQ-FAILED-TEST-' + stamp;
  const studentName = 'V2 PREREQUISITE NOT QUALIFIED TEST ' + stamp;


  // --------------------------------------------------
  // 1. Create isolated application
  // --------------------------------------------------

  v2Append_('V2_APPLICATIONS', {
    'Reference No': reference,
    'Submitted At': now,
    'Applicant Type': 'Local (Malaysian Citizen)',
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Phone Number': 'TEST',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Study Mode': 'Online',
    'Intake': 'September 2026',
    'Intake ID': 'SEP-2026',

    'Entry Qualification Type': 'Academic Qualification',
    'Highest Qualification': 'Bachelor Degree',
    'Institution / Awarding Body': 'V2 Test Environment',
    'Field of Study': 'Engineering',
    'Academic Result / CGPA / Grade': '2.80',

    'Application Status': 'TEST',
    'Email Status': 'DISABLED',
    'Last Updated': now,
    'Version': 'CONTROLLED_PREREQUISITE_NOT_QUALIFIED_TEST'
  });


  // --------------------------------------------------
  // 2. Workflow READY_FOR_SAC
  // --------------------------------------------------

  v2Append_('V2_WORKFLOW', {
    'Reference No': reference,
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Innovative Email': '',

    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Intake': 'SEP-2026',

    'Application Stage': 'READY_FOR_SAC',
    'Application Status': 'TEST',

    'Document Review Status': 'COMPLETE',
    'Qualification Screening Status': 'COMPLETED',
    'Field Classification': 'NON_RELATED',
    'Relevant Work Experience': 'NO',
    'Screening Recommendation':
      'PREREQUISITE_OR_BRIDGING_REVIEW',

    'SAC Session ID': '',
    'SAC Decision': '',
    'SAC Endorsed At': '',

    'Assessment Status': 'NOT_DETERMINED',
    'Prerequisite Status': 'NOT_DETERMINED',

    'Offer Letter Status': 'NOT_ISSUED',
    'Acceptance Status': 'NOT_OPEN',

    'Last Updated': now,
    'Updated By': 'Controlled Prerequisite Not Qualified Test',
    'Version': V2_BUILD
  });


  // --------------------------------------------------
  // 3. SAC session + candidate
  // --------------------------------------------------

  v2CreateSacSession_(
    {
      sessionId: sessionId,
      name: 'Controlled Prerequisite Not Qualified Test',
      meetingDate: Utilities.formatDate(
        new Date(),
        CONFIG.timezone || 'Asia/Kuala_Lumpur',
        'yyyy-MM-dd'
      ),
      meetingTime: '10:00',
      chairperson: 'Controlled Test Chair'
    },
    'Controlled Test'
  );

  v2AssignSacCandidate_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      priority: 'NORMAL'
    },
    'Controlled Test'
  );


  // --------------------------------------------------
  // 4. SAC decision = PREREQUISITE
  // --------------------------------------------------

  v2RecordSacVote_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      reviewer: 'Reviewer 1',
      vote: 'PREREQUISITE',
      remarks: 'Prerequisite recommended.'
    },
    'Reviewer 1'
  );

  const sacResult = v2RecordSacDecision_(
    {
      sessionId: sessionId,
      referenceNo: reference,
      decision: 'PREREQUISITE',
      confirmed: true,
      remarks: 'Prerequisite confirmed.'
    },
    'Controlled Test Chair'
  );


  // --------------------------------------------------
  // 5. Start prerequisite
  // --------------------------------------------------

  const prerequisiteStart = v2UpdateAssessment_(
    {
      referenceNo: reference,
      assessmentType: 'PREREQUISITE',
      sequence: 1,
      component: 'OVERALL',
      status: 'IN_PROGRESS'
    },
    'Controlled Prerequisite Panel'
  );


  // --------------------------------------------------
  // 6. Complete prerequisite = NOT_QUALIFIED
  // --------------------------------------------------

  const prerequisiteComplete = v2UpdateAssessment_(
    {
      referenceNo: reference,
      assessmentType: 'PREREQUISITE',
      sequence: 1,
      component: 'OVERALL',
      status: 'COMPLETED',
      panelResult: 'NOT_QUALIFIED',
      panelRemarks:
        'Controlled test - prerequisite not qualified.'
    },
    'Controlled Prerequisite Panel'
  );


  // --------------------------------------------------
  // 7. Verify workflow
  // --------------------------------------------------

  const workflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );


  const checks = {
    sacDecisionPrerequisite:
      sacResult &&
      sacResult.decision === 'PREREQUISITE',

    prerequisiteStartAllowed:
      prerequisiteStart &&
      prerequisiteStart.ok === true,

    prerequisiteCompleteAllowed:
      prerequisiteComplete &&
      prerequisiteComplete.ok === true,

    prerequisiteNotQualified:
      String(
        workflow.record['Prerequisite Status']
      ) === 'COMPLETED_NOT_QUALIFIED',

    finalStageRejected:
      String(
        workflow.record['Application Stage']
      ) === 'REJECTED',

    offerStillNotIssued:
      String(
        workflow.record['Offer Letter Status'] || ''
      ) !== 'ISSUED'
  };


  const report = {
    ok:
      checks.sacDecisionPrerequisite &&
      checks.prerequisiteStartAllowed &&
      checks.prerequisiteCompleteAllowed &&
      checks.prerequisiteNotQualified &&
      checks.finalStageRejected &&
      checks.offerStillNotIssued,

    referenceNo: reference,
    sessionId: sessionId,

    checks: checks,

    finalStage:
      workflow.record['Application Stage'],

    prerequisiteStatus:
      workflow.record['Prerequisite Status'],

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2AssessmentAccountControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const reference = 'V2-ACCOUNT-TEST-' + stamp;

  const testIc = '900101-01-1234';

  const workflow = {
    'Reference No': reference,
    'Student Name': 'V2 ASSESSMENT ACCOUNT TEST ' + stamp,
    'ID / Passport No': testIc,
    'Personal Email': 'NO-EMAIL-TEST'
  };


  // --------------------------------------------------
  // 1. Create assessment account
  // --------------------------------------------------

  const created = v2CreateAssessmentAccount_(
    workflow,
    'Controlled Account Test'
  );


  // --------------------------------------------------
  // 2. Read saved account
  // --------------------------------------------------

  const account = v2Find_(
    'V2_ASSESSMENT_ACCOUNTS',
    'Reference No',
    reference
  );

  if (!account) {
    throw new Error(
      'Controlled assessment account was not created.'
    );
  }


  const loginId = String(
    account.record['Login ID'] || ''
  );

  const passwordHash = String(
    account.record['Password Hash'] || ''
  );

  const expectedLoginId =
    '900101011234';

  const expectedHash =
    v2AssessmentHashPassword_(
      expectedLoginId
    );


  const checks = {

    accountCreated:
      !!created,

    loginIdNormalised:
      loginId === expectedLoginId,

    accountActive:
      String(
        account.record['Account Status']
      ) === 'ACTIVE',

    passwordHashCreated:
      passwordHash.length === 64,

    passwordHashCorrect:
      passwordHash === expectedHash,

    rawPasswordNotStored:
      passwordHash !== expectedLoginId &&
      passwordHash !== testIc,

    passwordUpdatedAtRecorded:
      !!String(
        account.record['Password Updated At'] || ''
      ).trim(),

    originalIdPreserved:
      String(
        account.record['ID / Passport No']
      ) === testIc
  };


  const report = {
    ok:
      checks.accountCreated &&
      checks.loginIdNormalised &&
      checks.accountActive &&
      checks.passwordHashCreated &&
      checks.passwordHashCorrect &&
      checks.rawPasswordNotStored &&
      checks.passwordUpdatedAtRecorded &&
      checks.originalIdPreserved,

    referenceNo: reference,

    loginId: loginId,

    defaultPasswordForTest:
      expectedLoginId,

    checks: checks,

    rawPasswordStored: false,

    emailSent: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2AssessmentLogin(loginId, password) {
  assertDevIdentity_();

  const normalizedLogin =
    v2AssessmentNormalizeCredential_(loginId);

  if (!normalizedLogin) {
    throw new Error('Login ID is required.');
  }

  if (!String(password || '')) {
    throw new Error('Password is required.');
  }

  const account = v2Find_(
    'V2_ASSESSMENT_ACCOUNTS',
    'Login ID',
    normalizedLogin
  );

  if (!account) {
    throw new Error('Invalid Login ID or password.');
  }

  if (
    String(account.record['Account Status'] || '') !== 'ACTIVE'
  ) {
    throw new Error('Assessment account is not active.');
  }

  const storedHash = String(
    account.record['Password Hash'] || ''
  );

  const suppliedHash =
    v2AssessmentHashPassword_(
      String(password || '')
    );

  if (
    !storedHash ||
    suppliedHash !== storedHash
  ) {
    throw new Error('Invalid Login ID or password.');
  }

  const reference =
    String(account.record['Reference No'] || '');

  const now = new Date().toISOString();

  v2UpdateRow_(
    account.sheet,
    account.rowNumber,
    {
      'Last Login At': now
    }
  );

  const sessionToken =
    Utilities.getUuid().replace(/-/g, '') +
    Utilities.getUuid().replace(/-/g, '');

  const sessionData = {
    referenceNo: reference,
    loginId: normalizedLogin,
    createdAt: now
  };

  CacheService.getScriptCache().put(
    'V2_ASSESS_SESSION_' + sessionToken,
    JSON.stringify(sessionData),
    3600
  );

  return {
    ok: true,
    sessionToken: sessionToken,

    referenceNo: reference,
    studentName:
      account.record['Student Name'] || '',

    loginId: normalizedLogin,

    email:
      account.record['Personal Email'] || '',

    accountStatus:
      account.record['Account Status'] || '',

    passwordHashReturned: false,
    emailSent: false,
    v1Touched: false
  };
}


function v2AssessmentGetPortalData(sessionToken) {
  assertDevIdentity_();

  const session =
    v2AssessmentValidateSession_(sessionToken);

  const reference =
    session.referenceNo;

  const account = v2Find_(
    'V2_ASSESSMENT_ACCOUNTS',
    'Reference No',
    reference
  );

  const workflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );

  const progress = v2Rows_(
    'V2_ASSESSMENT_PROGRESS'
  ).filter(function(row) {
    return (
      String(row['Reference No'] || '') === reference
    );
  });

  return {
    ok: true,

    student: {
      referenceNo: reference,
      studentName:
        account
          ? account.record['Student Name'] || ''
          : '',
      loginId:
        account
          ? account.record['Login ID'] || ''
          : '',
      email:
        account
          ? account.record['Personal Email'] || ''
          : '',
      programme:
        workflow
          ? workflow.record['Programme'] || ''
          : '',
      intake:
        workflow
          ? workflow.record['Intake'] || ''
          : ''
    },

    workflow: workflow
      ? {
          applicationStage:
            workflow.record['Application Stage'] || '',

          assessmentStatus:
            workflow.record['Assessment Status'] || '',

          prerequisiteStatus:
            workflow.record['Prerequisite Status'] || ''
        }
      : {},

    assessmentProgress: progress,

    emailSent: false,
    v1Touched: false
  };
}


function v2AssessmentChangePassword(
  sessionToken,
  currentPassword,
  newPassword
) {
  assertDevIdentity_();

  const session =
    v2AssessmentValidateSession_(sessionToken);

  const reference =
    session.referenceNo;

  const account = v2Find_(
    'V2_ASSESSMENT_ACCOUNTS',
    'Reference No',
    reference
  );

  if (!account) {
    throw new Error('Assessment account not found.');
  }

  const storedHash = String(
    account.record['Password Hash'] || ''
  );

  const currentHash =
    v2AssessmentHashPassword_(
      String(currentPassword || '')
    );

  if (
    !storedHash ||
    storedHash !== currentHash
  ) {
    throw new Error(
      'Current password is incorrect.'
    );
  }

  const nextPassword =
    String(newPassword || '');

  if (!nextPassword) {
    throw new Error(
      'New password is required.'
    );
  }

  if (nextPassword === String(currentPassword || '')) {
    throw new Error(
      'New password must be different from current password.'
    );
  }

  const now = new Date().toISOString();

  v2UpdateRow_(
    account.sheet,
    account.rowNumber,
    {
      'Password Hash':
        v2AssessmentHashPassword_(nextPassword),

      'Password Updated At':
        now
    }
  );

  return {
    ok: true,
    passwordChanged: true,
    passwordUpdatedAt: now,

    rawPasswordStored: false,
    emailSent: false,
    v1Touched: false
  };
}


function v2AssessmentLogout(sessionToken) {
  const token =
    String(sessionToken || '').trim();

  if (token) {
    CacheService.getScriptCache().remove(
      'V2_ASSESS_SESSION_' + token
    );
  }

  return {
    ok: true,
    loggedOut: true
  };
}


function v2AssessmentValidateSession_(sessionToken) {
  const token =
    String(sessionToken || '').trim();

  if (!token) {
    throw new Error(
      'Assessment session is required.'
    );
  }

  const cached =
    CacheService.getScriptCache().get(
      'V2_ASSESS_SESSION_' + token
    );

  if (!cached) {
    throw new Error(
      'Assessment session has expired. Please login again.'
    );
  }

  return JSON.parse(cached);
}


/**
 * Controlled Login + Change Password test.
 */
function v2AssessmentLoginControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const reference =
    'V2-LOGIN-TEST-' + stamp;

  const testIc =
    '900101-01-1234';

  const loginId =
    '900101011234';

  const newPassword =
    'TEST-NEW-PASSWORD-' + stamp;


  // Create controlled account.
  v2CreateAssessmentAccount_(
    {
      'Reference No': reference,
      'Student Name':
        'V2 LOGIN TEST ' + stamp,
      'ID / Passport No':
        testIc,
      'Personal Email':
        'NO-EMAIL-TEST'
    },
    'Controlled Login Test'
  );


  // Default IC password login.
  const loginResult =
    v2AssessmentLogin(
      loginId,
      loginId
    );


  // Change password.
  const changeResult =
    v2AssessmentChangePassword(
      loginResult.sessionToken,
      loginId,
      newPassword
    );


  // Old password must fail.
  let oldPasswordBlocked = false;

  try {
    v2AssessmentLogin(
      loginId,
      loginId
    );
  } catch (error) {
    oldPasswordBlocked = true;
  }


  // New password must work.
  const newLogin =
    v2AssessmentLogin(
      loginId,
      newPassword
    );


  const account = v2Find_(
    'V2_ASSESSMENT_ACCOUNTS',
    'Reference No',
    reference
  );


  const checks = {

    defaultPasswordLoginWorks:
      loginResult &&
      loginResult.ok === true,

    sessionTokenCreated:
      !!String(
        loginResult.sessionToken || ''
      ),

    passwordChanged:
      changeResult &&
      changeResult.passwordChanged === true,

    oldPasswordBlocked:
      oldPasswordBlocked === true,

    newPasswordLoginWorks:
      newLogin &&
      newLogin.ok === true,

    hashStillStored:
      String(
        account.record['Password Hash'] || ''
      ).length === 64,

    rawNewPasswordNotStored:
      String(
        account.record['Password Hash'] || ''
      ) !== newPassword
  };


  const report = {
    ok:
      checks.defaultPasswordLoginWorks &&
      checks.sessionTokenCreated &&
      checks.passwordChanged &&
      checks.oldPasswordBlocked &&
      checks.newPasswordLoginWorks &&
      checks.hashStillStored &&
      checks.rawNewPasswordNotStored,

    referenceNo: reference,
    loginId: loginId,

    checks: checks,

    emailSent: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2RenderAssessmentPortal_() {
  return HtmlService
    .createHtmlOutputFromFile(
      'assessment-v2'
    )
    .setTitle(
      'IUC IPGS Assessment Portal'
    );
}

function v2AssessmentSubmitStudentWork(
  sessionToken,
  assessmentType,
  sequence,
  submissionUrl
) {
  assertDevIdentity_();

  const session =
    v2AssessmentValidateSession_(sessionToken);

  const reference =
    session.referenceNo;

  const type =
    String(assessmentType || '')
      .trim()
      .toUpperCase();

  if (
    ['INTERNAL_ASSESSMENT', 'PREREQUISITE']
      .indexOf(type) < 0
  ) {
    throw new Error(
      'Invalid assessment type.'
    );
  }

  const url =
    String(submissionUrl || '').trim();

  if (!url) {
    throw new Error(
      'Submission URL is required.'
    );
  }

  if (!/^https?:\/\//i.test(url)) {
    throw new Error(
      'Enter a valid submission URL.'
    );
  }

  const seq =
    Number(sequence || 1);

  const existing = v2FindComposite_(
    'V2_ASSESSMENT_PROGRESS',
    [
      'Reference No',
      'Assessment Type',
      'Sequence'
    ],
    [
      reference,
      type,
      seq
    ]
  );

  const now =
    new Date().toISOString();

  const old =
    existing ? existing.record : {};

  const row = {
    'Reference No':
      reference,

    'Assessment Type':
      type,

    'Sequence':
      seq,

    'Component':
      old['Component'] || 'OVERALL',

    'Status':
      old['Status'] || 'SUBMITTED',

    'Submission URL':
      url,

    'Interview Slot':
      old['Interview Slot'] || '',

    'Calendar Event ID':
      old['Calendar Event ID'] || '',

    'Panel Result':
      old['Panel Result'] || '',

    'Panel Remarks':
      old['Panel Remarks'] || '',

    'Completed At':
      old['Completed At'] || '',

    'Verified By':
      old['Verified By'] || '',

    'Next Action':
      old['Next Action'] ||
      'PENDING_REVIEW',

    'Last Updated':
      now
  };

  if (
    !old['Status'] ||
    old['Status'] === 'IN_PROGRESS'
  ) {
    row['Status'] = 'SUBMITTED';
  }

  v2UpsertComposite_(
    'V2_ASSESSMENT_PROGRESS',
    [
      'Reference No',
      'Assessment Type',
      'Sequence'
    ],
    [
      reference,
      type,
      seq
    ],
    row
  );

  v2Audit_(
    reference,
    'ASSESSMENT',
    'STUDENT_SUBMISSION',
    old,
    row,
    'Student',
    'SUCCESS',
    ''
  );

  v2InvalidateCache_();

  return {
    ok: true,
    referenceNo: reference,
    assessmentType: type,
    sequence: seq,
    submissionUrl: url,
    status: row['Status'],

    emailSent: false,
    v1Touched: false
  };
}


function v2AssessmentBookInterviewSlot(
  sessionToken,
  assessmentType,
  sequence,
  interviewSlot
) {
  assertDevIdentity_();

  const session =
    v2AssessmentValidateSession_(sessionToken);

  const reference =
    session.referenceNo;

  const type =
    String(assessmentType || '')
      .trim()
      .toUpperCase();

  if (
    ['INTERNAL_ASSESSMENT', 'PREREQUISITE']
      .indexOf(type) < 0
  ) {
    throw new Error(
      'Invalid assessment type.'
    );
  }

  const slot =
    String(interviewSlot || '').trim();

  if (!slot) {
    throw new Error(
      'Interview slot is required.'
    );
  }

  const seq =
    Number(sequence || 1);

  const existing = v2FindComposite_(
    'V2_ASSESSMENT_PROGRESS',
    [
      'Reference No',
      'Assessment Type',
      'Sequence'
    ],
    [
      reference,
      type,
      seq
    ]
  );

  const now =
    new Date().toISOString();

  const old =
    existing ? existing.record : {};

  const row = {
    'Reference No':
      reference,

    'Assessment Type':
      type,

    'Sequence':
      seq,

    'Component':
      old['Component'] || 'OVERALL',

    'Status':
      old['Status'] || 'IN_PROGRESS',

    'Submission URL':
      old['Submission URL'] || '',

    'Interview Slot':
      slot,

    'Calendar Event ID':
      old['Calendar Event ID'] || '',

    'Panel Result':
      old['Panel Result'] || '',

    'Panel Remarks':
      old['Panel Remarks'] || '',

    'Completed At':
      old['Completed At'] || '',

    'Verified By':
      old['Verified By'] || '',

    'Next Action':
      old['Next Action'] ||
      'INTERVIEW_BOOKED',

    'Last Updated':
      now
  };

  v2UpsertComposite_(
    'V2_ASSESSMENT_PROGRESS',
    [
      'Reference No',
      'Assessment Type',
      'Sequence'
    ],
    [
      reference,
      type,
      seq
    ],
    row
  );

  v2Audit_(
    reference,
    'ASSESSMENT',
    'STUDENT_BOOK_INTERVIEW',
    old,
    row,
    'Student',
    'SUCCESS',
    slot
  );

  v2InvalidateCache_();

  return {
    ok: true,
    referenceNo: reference,
    assessmentType: type,
    sequence: seq,
    interviewSlot: slot,

    calendarEventCreated: false,
    emailSent: false,
    v1Touched: false
  };
}

function v2AssessmentPortalActionsControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const reference =
    'V2-PORTAL-ACTION-TEST-' + stamp;

  const testIc =
    '910202-02-5678';

  const loginId =
    '910202025678';

  const submissionUrl =
    'https://drive.google.com/test-submission-' + stamp;

  const interviewSlot =
    '2026-09-15 10:00';


  // 1. Create assessment account
  v2CreateAssessmentAccount_(
    {
      'Reference No': reference,
      'Student Name':
        'V2 PORTAL ACTION TEST ' + stamp,
      'ID / Passport No':
        testIc,
      'Personal Email':
        'NO-EMAIL-TEST'
    },
    'Controlled Portal Test'
  );


  // 2. Login using default IC password
  const login =
    v2AssessmentLogin(
      loginId,
      loginId
    );


  // 3. Student submits work
  const submission =
    v2AssessmentSubmitStudentWork(
      login.sessionToken,
      'INTERNAL_ASSESSMENT',
      1,
      submissionUrl
    );


  // 4. Student books interview slot
  const interview =
    v2AssessmentBookInterviewSlot(
      login.sessionToken,
      'INTERNAL_ASSESSMENT',
      1,
      interviewSlot
    );


  // 5. Read portal data
  const portal =
    v2AssessmentGetPortalData(
      login.sessionToken
    );


  const progress =
    portal.assessmentProgress.filter(
      function(row) {
        return (
          String(row['Assessment Type']) ===
            'INTERNAL_ASSESSMENT' &&
          Number(row['Sequence']) === 1
        );
      }
    )[0];


  const checks = {

    loginWorks:
      login &&
      login.ok === true,

    submissionSaved:
      submission &&
      submission.ok === true,

    submissionStatusCorrect:
      submission.status === 'SUBMITTED',

    interviewSaved:
      interview &&
      interview.ok === true,

    submissionVisibleInPortal:
      !!progress &&
      String(
        progress['Submission URL']
      ) === submissionUrl,

    interviewVisibleInPortal:
      !!progress &&
      String(
        progress['Interview Slot']
      ) === interviewSlot,

    calendarNotCreated:
      interview.calendarEventCreated === false
  };


  const report = {
    ok:
      checks.loginWorks &&
      checks.submissionSaved &&
      checks.submissionStatusCorrect &&
      checks.interviewSaved &&
      checks.submissionVisibleInPortal &&
      checks.interviewVisibleInPortal &&
      checks.calendarNotCreated,

    referenceNo: reference,

    checks: checks,

    emailSent: false,
    calendarEventCreated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2AssessmentPortalUiPreflight() {
  assertDevIdentity_();

  const html =
    v2RenderAssessmentPortal_();

  const content =
    html.getContent();

  const checks = {
    htmlRendered:
      !!content,

    loginFunctionExists:
      content.indexOf('function login()') > -1,

    changePasswordExists:
      content.indexOf('function changePassword()') > -1,

    submitWorkExists:
      content.indexOf('function submitAssessmentWork()') > -1,

    interviewBookingExists:
      content.indexOf('function bookInterviewSlot()') > -1,

    progressAreaExists:
      content.indexOf('progressArea') > -1,

    assessmentTypeExists:
      content.indexOf('assessmentType') > -1,

    interviewSlotExists:
      content.indexOf('interviewSlot') > -1
  };

  const report = {
    ok:
      checks.htmlRendered &&
      checks.loginFunctionExists &&
      checks.changePasswordExists &&
      checks.submitWorkExists &&
      checks.interviewBookingExists &&
      checks.progressAreaExists &&
      checks.assessmentTypeExists &&
      checks.interviewSlotExists,

    checks: checks,

    emailSent: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}