/**
 * IPGS Admission V2 - Agent / Fee Group module
 * DEVELOPMENT / TEST SAFE
 *
 * Purpose
 * - Issue one-time unique agent links without login.
 * - Store only SHA-256 token hashes (never the raw token).
 * - Give Marketing / Academic Consultant the applicant information needed to create the Prospect in SKYVIALING.
 * - After Marketing creates the Prospect in SKYVIALING, let them confirm completion and select the approved Fee Group.
 * - Read Fee Groups from FEE_GROUP_MASTER with 5-minute cache.
 * - Prevent duplicate submissions.
 * - Update V2 admission/workflow with Prospect completed status + Fee Group.
 * - Notify Registry that Marketing has completed the Prospect step so Registry can process the application.
 * - Route operational email through the central V2 Notification Engine.
 *
 * V1 data is never read, migrated, or modified by this module.
 */

const V2_AGENT_ACTIONS_SHEET = 'V2_AGENT_ACTIONS';
const V2_AGENT_EMAIL_MODE = 'CENTRAL_ENGINE';

function v2AgentNotificationMode_() {
  return v2NotificationMode_();
}

function v2SendAgentApplicationNotification_(payload, reference, intake, pdf, agent, actionUrl) {
  assertDevIdentity_();
  const result = v2SendAgentNotificationCentral_(payload, reference, intake, pdf, agent, actionUrl, {});
  return result.status;
}
const V2_AGENT_FEE_CACHE_SECONDS = 300;
const V2_AGENT_ACTION_HEADERS = [
  'Action ID',
  'Created At',
  'Reference No',
  'Student Name',
  'Programme',
  'Partner Code',
  'Recipient Email',
  'Token Hash',
  'Action Status',
  'SKY Prospect ID',
  'Fee Group',
  'Remarks',
  'Submitted At',
  'Registry Notification Status',
  'Last Updated',
  'Prospect Details Status',
  'Prospect Details JSON'
];

/**
 * Run once from the confirmed V2 Apps Script editor.
 * Safe, additive setup only. It creates V2_AGENT_ACTIONS if missing and
 * appends missing headers without deleting/reordering existing data.
 */
function v2AgentSetupFoundation() {
  assertDevIdentity_();

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const actionSheet = v2EnsureSheetWithHeaders_(ss, V2_AGENT_ACTIONS_SHEET, V2_AGENT_ACTION_HEADERS);
  const feeSheet = ss.getSheetByName(CONFIG.feeGroupMasterSheetName || 'FEE_GROUP_MASTER');

  const report = {
    ok: true,
    build: CONFIG.buildVersion,
    databaseId: ss.getId(),
    actionSheet: actionSheet.getName(),
    actionHeadersReady: v2HasHeaders_(actionSheet, V2_AGENT_ACTION_HEADERS),
    feeGroupMasterExists: !!feeSheet,
    emailMode: v2AgentNotificationMode_(),
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

/**
 * Run after v2SetupFoundation(). Read-only preflight: no deployment and no email.
 */
function v2AgentModulePreflight() {
  assertDevIdentity_();

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const actionSheet = ss.getSheetByName(V2_AGENT_ACTIONS_SHEET);
  const feeSheet = ss.getSheetByName(CONFIG.feeGroupMasterSheetName || 'FEE_GROUP_MASTER');
  const admissionSheet = ss.getSheetByName(CONFIG.sheetName);
  const feeGroups = feeSheet ? v2ReadFeeGroupsNoCache_(feeSheet) : [];

  const checks = {
    identity: true,
    databaseAccessible: ss.getId() === CONFIG.spreadsheetId,
    admissionSheetExists: !!admissionSheet,
    actionSheetExists: !!actionSheet,
    actionHeadersReady: !!actionSheet && v2HasHeaders_(actionSheet, V2_AGENT_ACTION_HEADERS),
    feeGroupMasterExists: !!feeSheet,
    feeGroupCodeHeaderExists: !!feeSheet && v2FindHeaderIndex_(v2Headers_(feeSheet), ['Fee Group Code']) > -1,
    feeGroupCount: feeGroups.length,
    cacheSeconds: V2_AGENT_FEE_CACHE_SECONDS,
    tokenStorage: 'SHA-256 HASH ONLY',
    duplicateSubmissionGuard: true,
    emailMode: v2AgentNotificationMode_(),
    externalEmailSent: false,
    v1Touched: false
  };

  checks.ok = checks.identity && checks.databaseAccessible && checks.admissionSheetExists &&
    checks.actionSheetExists && checks.actionHeadersReady && checks.feeGroupMasterExists &&
    checks.feeGroupCodeHeaderExists;

  Logger.log(JSON.stringify(checks));
  return checks;
}

/**
 * Called by Code.gs when creating the prospect-action email.
 * Each call invalidates older ACTIVE links for the same application.
 */
function v2CreateAgentActionLink_(payload, reference) {
  assertDevIdentity_();

  const cleanRef = String(reference || '').trim();
  if (!cleanRef) throw new Error('V2_AGENT_REFERENCE_REQUIRED');

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = v2EnsureSheetWithHeaders_(ss, V2_AGENT_ACTIONS_SHEET, V2_AGENT_ACTION_HEADERS);
  const token = v2GenerateRawToken_();
  const tokenHash = v2HashToken_(token);
  const now = v2Now_();
  const actionId = 'AGT-' + Utilities.getUuid().replace(/-/g, '').slice(0, 16).toUpperCase();

  const recipient = v2ResolveProspectRecipient_(payload || {});
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);

  try {
    v2SupersedeOpenActionsForReference_(sheet, cleanRef, now);
    const rowData = {
      'Action ID': actionId,
      'Created At': now,
      'Reference No': cleanRef,
      'Student Name': payload && payload.fullName ? payload.fullName : '',
      'Programme': payload && payload.programme ? payload.programme : '',
      'Partner Code': payload && payload.partnerCode ? payload.partnerCode : '',
      'Recipient Email': recipient,
      'Token Hash': tokenHash,
      'Action Status': 'ACTIVE',
      'SKY Prospect ID': '',
      'Fee Group': '',
      'Remarks': '',
      'Submitted At': '',
      'Registry Notification Status': V2_AGENT_EMAIL_MODE,
      'Last Updated': now,
      'Prospect Details Status': 'PENDING',
      'Prospect Details JSON': ''
    };
    const headers = v2Headers_(sheet);
    sheet.appendRow(headers.map(function(header) {
      return Object.prototype.hasOwnProperty.call(rowData, header) ? rowData[header] : '';
    }));
  } finally {
    lock.releaseLock();
  }

  const base = v2AgentBaseUrl_();
  return base + (base.indexOf('?') === -1 ? '?' : '&') +
    'page=agent-v2&actionId=' + encodeURIComponent(actionId) +
    '&token=' + encodeURIComponent(token);
}

/** Render the no-login agent page. */
function v2RenderAgentPage_(params) {
  assertDevIdentity_();
  const template = HtmlService.createTemplateFromFile('agent-v2');
  template.token = String((params && (params.token || params.t)) || '');
  template.actionId = String((params && (params.actionId || params.a)) || '');
  return template.evaluate()
    .setTitle('IUC Prospect & Fee Group Update')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Called by agent-v2.html when the page opens. */
function v2AgentGetAction(token, actionId) {
  assertDevIdentity_();

  const rawToken = String(token || '').trim();
  const cleanActionId = String(actionId || '').trim();
  if (!rawToken) return { ok: false, message: 'Invalid or missing action link.' };

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const actionSheet = ss.getSheetByName(V2_AGENT_ACTIONS_SHEET);
  if (!actionSheet) return { ok: false, message: 'Agent action module is not set up.' };

  let match = cleanActionId ? v2FindActionById_(actionSheet, cleanActionId) : null;
  if (match) {
    const expectedHash = String(match.record['Token Hash'] || '').trim();
    const actualHash = v2HashToken_(rawToken);
    if (!expectedHash || expectedHash !== actualHash) {
      return { ok: false, message: 'This secure action link is invalid.' };
    }
  } else {
    // Backward compatibility for previously issued links without actionId.
    match = v2FindActionByTokenHash_(actionSheet, v2HashToken_(rawToken));
  }
  if (!match) return { ok: false, message: 'This action link is invalid or no longer available.' };

  const status = String(match.record['Action Status'] || '').trim().toUpperCase();
  if (status === 'SUPERSEDED' || status === 'REVOKED') {
    return { ok: false, message: 'This action link has been replaced by a newer link.' };
  }

  const admission = v2FindAdmissionByReference_(ss, match.record['Reference No']);
  if (!admission) return { ok: false, message: 'The application record could not be found.' };

  const submitted = status === 'SUBMITTED';
  const programme = admission.record['Programme'] || match.record['Programme'] || '';
  const feeGroupOptions = (typeof v2GetFeeGroupOptions_ === 'function')
    ? v2GetFeeGroupOptions_(
        programme,
        admission.record['Level of Study'] || '',
        admission.record['Study Mode'] || admission.record['Mode of Study'] || '',
        admission.record['Intake ID'] || '',
        admission.record['Intake'] || ''
      )
    : v2GetFeeGroups_().map(function(code){ return {code:code,label:code}; });
  return {
    ok: true,
    submitted: submitted,
    referenceNo: match.record['Reference No'] || '',
    studentName: admission.record['Student Name'] || match.record['Student Name'] || '',
    programme: programme,
    intake: admission.record['Intake'] || '',
    partnerCode: admission.record['Agent Code'] || match.record['Partner Code'] || '',
    feeGroup: match.record['Fee Group'] || admission.record['Fee Group'] || '',
    remarks: match.record['Remarks'] || '',
    feeGroups: feeGroupOptions.map(function(x){ return x.code; }),
    feeGroupOptions: feeGroupOptions,
    message: submitted ? 'Prospect completion and Fee Group have already been submitted.' : ''
  };
}

/**
 * JSON-safe bridge for the public agent page.
 * Returning a string avoids Apps Script client/server serialization edge cases.
 */
function v2AgentGetActionJson(token, actionId) {
  try {
    const result = v2AgentGetAction(token, actionId);
    return JSON.stringify(result || {ok:false, message:'No action data returned.'});
  } catch (error) {
    return JSON.stringify({
      ok: false,
      message: error && error.message ? error.message : String(error),
      code: 'AGENT_ACTION_LOAD_ERROR'
    });
  }
}

/** Called once by agent-v2.html. Duplicate submissions are blocked server-side. */
function v2AgentSubmitAction(token, actionId, formData) {
  assertDevIdentity_();

  const rawToken = String(token || '').trim();
  const cleanActionId = String(actionId || '').trim();
  const data = formData || {};
  const prospectCompleted = data.prospectCompleted === true ||
    String(data.prospectCompleted || '').trim().toUpperCase() === 'YES';
  const feeGroup = String(data.feeGroup || '').trim();
  const remarks = String(data.remarks || '').trim();

  if (!rawToken) throw new Error('Invalid or missing action token.');
  if (!prospectCompleted) {
    throw new Error('Please confirm that the applicant has already been entered in SKYVIALING Marketing > Prospect.');
  }
  if (!feeGroup) throw new Error('Fee Group is required.');
  if (remarks.length > 1000) throw new Error('Remarks must be 1000 characters or fewer.');

  const feeGroups = v2GetFeeGroups_();
  if (feeGroups.indexOf(feeGroup) === -1) {
    throw new Error('Please select a valid Fee Group from the approved master list.');
  }

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const actionSheet = v2EnsureSheetWithHeaders_(ss, V2_AGENT_ACTIONS_SHEET, V2_AGENT_ACTION_HEADERS);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    let match = cleanActionId ? v2FindActionById_(actionSheet, cleanActionId) : null;
    if (match) {
      const expectedHash = String(match.record['Token Hash'] || '').trim();
      const actualHash = v2HashToken_(rawToken);
      if (!expectedHash || expectedHash !== actualHash) {
        throw new Error('This secure action link is invalid.');
      }
    } else {
      match = v2FindActionByTokenHash_(actionSheet, v2HashToken_(rawToken));
    }
    if (!match) throw new Error('This action link is invalid or no longer available.');

    const status = String(match.record['Action Status'] || '').trim().toUpperCase();
    if (status === 'SUBMITTED') {
      return {
        ok: false,
        duplicate: true,
        message: 'Prospect completion and Fee Group have already been submitted. No duplicate update was created.'
      };
    }
    if (status !== 'ACTIVE') throw new Error('This action link is no longer active.');

    const referenceNo = String(match.record['Reference No'] || '').trim();
    const admission = v2FindAdmissionByReference_(ss, referenceNo);
    if (!admission) throw new Error('Matching V2 application record not found.');

    if (typeof v2GetFeeGroupOptions_ === 'function') {
      const applicable = v2GetFeeGroupOptions_(
        admission.record['Programme'] || '',
        admission.record['Level of Study'] || '',
        admission.record['Study Mode'] || admission.record['Mode of Study'] || '',
        admission.record['Intake ID'] || '',
        admission.record['Intake'] || ''
      ).some(function(option){
        return String(option.code || '') === feeGroup;
      });
      if (!applicable) throw new Error('The selected Fee Group is not active or is not applicable to this programme, level, study mode or intake.');
    }

    const workflow = v2Find_('V2_WORKFLOW', 'Reference No', referenceNo);
    if (!workflow) throw new Error('Matching V2 workflow record not found.');

    const now = v2Now_();

    const patch = {
      'Prospect Status': 'PROSPECT_COMPLETED',
      'Fee Group': feeGroup,
      'Prospect Updated At': now,
      'Prospect Remarks': remarks,
      'Last Updated': now
    };

    v2SetRecordValues_(admission.sheet, admission.rowNumber, patch);
    v2SetRecordValues_(workflow.sheet, workflow.rowNumber, Object.assign({}, patch, {
      'Updated By': 'Marketing / Academic Consultant'
    }));

    v2SetRecordValues_(actionSheet, match.rowNumber, {
      'Action Status': 'SUBMITTED',
      'Prospect Details Status': 'COMPLETED_IN_SKY',
      'Prospect Details JSON': '',
      'Fee Group': feeGroup,
      'Remarks': remarks,
      'Submitted At': now,
      'Registry Notification Status': v2AgentNotificationMode_(),
      'Last Updated': now
    });

    v2Audit_(
      referenceNo,
      'PROSPECT',
      'MARKETING_CONFIRMED_SKY_PROSPECT_COMPLETED',
      {},
      {
        'Prospect Status': 'PROSPECT_COMPLETED',
        'Fee Group': feeGroup
      },
      'Marketing / Academic Consultant',
      'SUCCESS',
      remarks || ''
    );

    SpreadsheetApp.flush();

    const registryNotification = v2NotifyRegistryProspectCompletedByAgent_(
      referenceNo,
      feeGroup,
      remarks,
      'Marketing / Academic Consultant'
    );

    v2SetRecordValues_(actionSheet, match.rowNumber, {
      'Registry Notification Status': registryNotification.status || 'UNKNOWN',
      'Last Updated': v2Now_()
    });

    Logger.log(JSON.stringify({
      event: 'V2_MARKETING_PROSPECT_COMPLETED',
      referenceNo: referenceNo,
      feeGroup: feeGroup,
      registryNotificationStatus: registryNotification.status || 'NOT_SENT'
    }));

    return {
      ok: true,
      referenceNo: referenceNo,
      feeGroup: feeGroup,
      prospectStatus: 'PROSPECT_COMPLETED',
      registryNotificationStatus: registryNotification.status || 'NOT_SENT',
      message: 'Prospect completion and Fee Group have been recorded. Registry has been notified to continue processing the application.'
    };
  } finally {
    lock.releaseLock();
  }
}

function v2AgentSubmitActionJson(token, actionId, formDataJson) {
  try {
    let formData = {};
    if (typeof formDataJson === 'string') {
      formData = JSON.parse(formDataJson || '{}');
    } else {
      formData = formDataJson || {};
    }
    const result = v2AgentSubmitAction(token, actionId, formData);
    return JSON.stringify(result || {ok:false, message:'No submission response returned.'});
  } catch (error) {
    return JSON.stringify({
      ok: false,
      message: error && error.message ? error.message : String(error),
      code: 'AGENT_ACTION_SUBMIT_ERROR'
    });
  }
}

function v2AgentProspectDefaults_(record) {
  const r = record || {};
  let raw = {};
  try {
    raw = r['Raw Application JSON'] ? JSON.parse(String(r['Raw Application JSON'])) : {};
  } catch (ignore) {}

  function pick(columnName, rawKey) {
    const direct = String(r[columnName] || '').trim();
    if (direct) return direct;
    return String(raw[rawKey] || '').trim();
  }

  return {
    fullName: pick('Student Name', 'fullName'),
    idPassport: pick('ID / Passport No', 'idPassport'),
    email: pick('Personal Email', 'email'),
    phoneNumber: pick('Phone Number', 'phoneNumber'),
    applicantType: pick('Applicant Type', 'applicantType'),
    nationality: pick('Nationality', 'nationality'),
    gender: pick('Gender', 'gender'),
    country: pick('Country', 'country'),
    fullAddress: pick('Full Address', 'fullAddress'),
    programme: pick('Programme', 'programme'),
    levelOfStudy: pick('Level of Study', 'levelOfStudy'),
    studyMode: pick('Study Mode', 'studyMode'),
    intake: pick('Intake', 'intake'),
    referralSource: pick('Referral Source', 'referralSource'),
    partnerCode: pick('Agent Code', 'partnerCode')
  };
}

function v2AgentCleanProspectDetails_(input) {
  const d = input || {};
  function clean(value, max) {
    return String(value || '').trim().slice(0, max || 500);
  }
  return {
    fullName: clean(d.fullName, 200),
    idPassport: clean(d.idPassport, 100),
    email: clean(d.email, 200).toLowerCase(),
    phoneNumber: clean(d.phoneNumber, 100),
    applicantType: clean(d.applicantType, 120),
    nationality: clean(d.nationality, 120),
    gender: clean(d.gender, 50),
    country: clean(d.country, 120),
    fullAddress: clean(d.fullAddress, 1000),
    programme: clean(d.programme, 250),
    levelOfStudy: clean(d.levelOfStudy, 100),
    studyMode: clean(d.studyMode, 100),
    intake: clean(d.intake, 120),
    referralSource: clean(d.referralSource, 150),
    partnerCode: clean(d.partnerCode, 100)
  };
}

function v2NotifyRegistryProspectCompletedByAgent_(referenceNo, feeGroup, remarks, actor) {
  assertDevIdentity_();
  const reference = String(referenceNo || '').trim();
  const app = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  if (!app || !workflow) throw new Error('Application/workflow record not found.');

  const a = app.record || {};
  const recipients = typeof v2NotificationAdminRecipients_ === 'function'
    ? v2NotificationAdminRecipients_()
    : [String(CONFIG.defaultNotificationEmail || '')];

  const subject = '[IPGS Admission] Prospect Completed by Marketing - ' +
    String(a['Student Name'] || reference);

  const html =
    '<div style="font-family:Arial,sans-serif;max-width:700px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">' +
      '<div style="background:#2d2363;color:#fff;padding:22px"><h2 style="margin:0">Prospect Completed by Marketing</h2></div>' +
      '<div style="padding:24px">' +
        '<p>Marketing / Academic Consultant has confirmed that this applicant has been entered in <strong>SKYVIALING → Marketing → Prospect</strong>.</p>' +
        '<div style="background:#ecfdf3;border:1px solid #abefc6;border-radius:10px;padding:13px 15px;margin:16px 0;color:#147a4b"><strong>Prospect Status:</strong> COMPLETED<br><strong>Fee Group:</strong> '+v2Html_(feeGroup)+'</div>' +
        '<p><strong>Student:</strong> '+v2Html_(a['Student Name'] || '')+
        '<br><strong>ID / Passport:</strong> '+v2Html_(a['ID / Passport No'] || '')+
        '<br><strong>Programme:</strong> '+v2Html_(a['Programme'] || '')+
        '<br><strong>Intake:</strong> '+v2Html_(a['Intake'] || '')+
        '<br><strong>Reference:</strong> '+v2Html_(reference)+'</p>' +
        (remarks ? '<p><strong>Marketing remarks:</strong> '+v2Html_(remarks)+'</p>' : '') +
        '<p><strong>Registry action:</strong> Continue the normal admission processing for this application.</p>' +
        '<p>Regards,<br><strong>IPGS Admission System</strong></p>' +
      '</div>' +
    '</div>';

  const textBody =
    'Marketing / Academic Consultant has confirmed that the applicant has been entered in SKYVIALING Marketing > Prospect.\n' +
    'Student: ' + String(a['Student Name'] || '') + '\n' +
    'Reference: ' + reference + '\n' +
    'Prospect Status: COMPLETED\n' +
    'Fee Group: ' + String(feeGroup || '') + '\n' +
    'Registry action: Continue the normal admission processing.';

  const result = v2NotificationSend_(
    'MARKETING_PROSPECT_COMPLETED',
    recipients,
    subject,
    textBody,
    html,
    {}
  );

  const now = v2Now_();
  const notifyPatch = {
    'Registry Prospect Notification Status': result.status || 'UNKNOWN',
    'Registry Prospect Notified At': result.sent ? now : '',
    'Last Updated': now
  };
  v2SetRecordValues_(app.sheet, app.rowNumber, notifyPatch);
  v2SetRecordValues_(workflow.sheet, workflow.rowNumber, Object.assign({}, notifyPatch, {
    'Updated By': actor || 'Marketing / Academic Consultant'
  }));

  return result;
}

function v2GetFeeGroups_() {
  assertDevIdentity_();
  const cache = CacheService.getScriptCache();
  const key = 'V2_FEE_GROUPS_' + String(CONFIG.spreadsheetId || '').slice(-10);

  try {
    const hit = cache.get(key);
    if (hit) return JSON.parse(hit);
  } catch (ignore) {}

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.feeGroupMasterSheetName || 'FEE_GROUP_MASTER');
  if (!sheet) return [];

  const groups = v2ReadFeeGroupsNoCache_(sheet);
  try { cache.put(key, JSON.stringify(groups), V2_AGENT_FEE_CACHE_SECONDS); } catch (ignore2) {}
  return groups;
}

function v2ReadFeeGroupsNoCache_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (v) { return String(v || '').trim(); });
  const idxCode = v2FindHeaderIndex_(headers, ['Fee Group Code', 'Fee Group', 'Code']);
  const idxActive = v2FindHeaderIndex_(headers, ['Active', 'Status']);
  if (idxCode < 0) return [];

  return values.slice(1)
    .filter(function (row) {
      const code = String(row[idxCode] || '').trim();
      if (!code) return false;
      if (idxActive < 0) return true;
      const active = String(row[idxActive] || '').trim().toLowerCase();
      return !active || active === 'active' || active === 'yes' || active === 'true' || active === '1';
    })
    .map(function (row) { return String(row[idxCode] || '').trim(); })
    .filter(function (v, i, a) { return a.indexOf(v) === i; })
    .sort();
}

function v2ResolveProspectRecipient_(payload) {
  const referral = String(payload.referralSource || '').trim();
  if (referral === 'Education Consultant') {
    const agent = v2FindActiveAgent_(payload.partnerCode || '');
    return agent && agent.email ? agent.email : String(CONFIG.defaultNotificationEmail || '');
  }
  if (referral === 'Innovative Staff') {
    return String(payload.capturedEmail || payload.email || CONFIG.defaultNotificationEmail || '');
  }
  return String(CONFIG.defaultNotificationEmail || '');
}

function v2FindActiveAgent_(agentCode) {
  const code = String(agentCode || '').trim().toUpperCase();
  if (!code) return null;
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.agentMasterSheetName || 'AGENT_MASTER');
  if (!sheet || sheet.getLastRow() < 2) return null;

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (v) { return String(v || '').trim(); });
  const idxCode = v2FindHeaderIndex_(headers, ['Agent Code']);
  const idxEmail = v2FindHeaderIndex_(headers, ['Agent Email', 'Email']);
  const idxActive = v2FindHeaderIndex_(headers, ['Active', 'Status']);
  if (idxCode < 0 || idxEmail < 0) return null;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxCode] || '').trim().toUpperCase() !== code) continue;
    const active = idxActive < 0 ? 'active' : String(values[i][idxActive] || '').trim().toLowerCase();
    if (idxActive < 0 || active === 'active' || active === 'yes' || active === 'true' || active === '1') {
      return { code: values[i][idxCode] || '', email: values[i][idxEmail] || '' };
    }
  }
  return null;
}

function v2AgentBaseUrl_() {
  if (CONFIG.agentActionBaseUrl) return String(CONFIG.agentActionBaseUrl).replace(/[?&]+$/, '');
  const serviceUrl = ScriptApp.getService().getUrl();
  if (serviceUrl) return serviceUrl;
  // Safe development fallback. This link is not emailed while V2_AGENT_EMAIL_MODE is DISABLED/TEST.
  return 'https://script.google.com/macros/s/DEPLOYMENT_REQUIRED/exec';
}

function v2GenerateRawToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function v2HashToken_(token) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(token || ''),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, '');
}

function v2SupersedeOpenActionsForReference_(sheet, referenceNo, nowText) {
  if (!sheet || sheet.getLastRow() < 2) return;
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (v) { return String(v || '').trim(); });
  const idxRef = headers.indexOf('Reference No');
  const idxStatus = headers.indexOf('Action Status');
  const idxUpdated = headers.indexOf('Last Updated');
  if (idxRef < 0 || idxStatus < 0) return;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxRef] || '').trim() === referenceNo &&
        String(values[i][idxStatus] || '').trim().toUpperCase() === 'ACTIVE') {
      sheet.getRange(i + 1, idxStatus + 1).setValue('SUPERSEDED');
      if (idxUpdated > -1) sheet.getRange(i + 1, idxUpdated + 1).setValue(nowText);
    }
  }
}

function v2FindActionById_(sheet, actionId) {
  if (!sheet || sheet.getLastRow() < 2) return null;
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (v) { return String(v || '').trim(); });
  const idxAction = headers.indexOf('Action ID');
  if (idxAction < 0) return null;

  const cleanId = String(actionId || '').trim();
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxAction] || '').trim() === cleanId) {
      return { sheet: sheet, rowNumber: i + 1, record: v2RowToRecord_(headers, values[i]) };
    }
  }
  return null;
}

function v2FindActionByTokenHash_(sheet, tokenHash) {
  if (!sheet || sheet.getLastRow() < 2) return null;
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (v) { return String(v || '').trim(); });
  const idxHash = headers.indexOf('Token Hash');
  if (idxHash < 0) return null;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxHash] || '').trim() === tokenHash) {
      return { sheet: sheet, rowNumber: i + 1, record: v2RowToRecord_(headers, values[i]) };
    }
  }
  return null;
}

function v2FindAdmissionByReference_(ss, referenceNo) {
  const sheet = ss.getSheetByName('V2_APPLICATIONS');
  if (!sheet || sheet.getLastRow() < 2) return null;

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (v) {
    return String(v || '').trim();
  });

  const idxRef = headers.indexOf('Reference No');
  if (idxRef < 0) return null;

  for (let i = 1; i < values.length; i++) {
    if (
      String(values[i][idxRef] || '').trim() ===
      String(referenceNo || '').trim()
    ) {
      return {
        sheet: sheet,
        rowNumber: i + 1,
        record: v2RowToRecord_(headers, values[i])
      };
    }
  }

  return null;
}

function v2SetRecordValues_(sheet, rowNumber, updates) {
  v2AgentEnsureHeaders_(sheet, Object.keys(updates));
  const headers = v2Headers_(sheet);
  Object.keys(updates).forEach(function (name) {
    const idx = headers.indexOf(name);
    if (idx > -1) sheet.getRange(rowNumber, idx + 1).setValue(updates[name]);
  });
}

function v2EnsureSheetWithHeaders_(ss, name, requiredHeaders) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  v2AgentEnsureHeaders_(sheet, requiredHeaders);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .setFontWeight('bold')
    .setBackground('#2d2363')
    .setFontColor('#ffffff')
    .setWrap(true);
  return sheet;
}

function v2AgentEnsureHeaders_(sheet, requiredHeaders) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    return;
  }
  const headers = v2Headers_(sheet);
  requiredHeaders.forEach(function (name) {
    if (headers.indexOf(name) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(name);
      headers.push(name);
    }
  });
}

function v2HasHeaders_(sheet, requiredHeaders) {
  const headers = v2Headers_(sheet);
  return requiredHeaders.every(function (h) { return headers.indexOf(h) > -1; });
}

function v2Headers_(sheet) {
  if (!sheet || sheet.getLastColumn() < 1) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (v) { return String(v || '').trim(); });
}

function v2FindHeaderIndex_(headers, candidates) {
  for (let i = 0; i < candidates.length; i++) {
    const idx = headers.indexOf(candidates[i]);
    if (idx > -1) return idx;
  }
  return -1;
}

function v2RowToRecord_(headers, row) {
  const record = {};
  headers.forEach(function (h, i) { record[h] = row[i]; });
  return record;
}

function v2Now_() {
  return Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd HH:mm:ss');
}

function v2AgentTokenSmokeTest() {
  assertDevIdentity_();

  const rawToken = v2GenerateRawToken_();
  const hashedToken = v2HashToken_(rawToken);

  const report = {
    ok: true,
    rawTokenGenerated: !!rawToken,
    rawTokenLength: rawToken.length,
    hashGenerated: !!hashedToken,
    hashLength: hashedToken.length,
    rawEqualsHash: rawToken === hashedToken,
    emailMode: v2AgentNotificationMode_(),
    externalEmailSent: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2AgentV2SyncPreflight() {
  assertDevIdentity_();

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);

  const appSheet = ss.getSheetByName('V2_APPLICATIONS');
  const workflowSheet = ss.getSheetByName('V2_WORKFLOW');
  const actionSheet = ss.getSheetByName(V2_AGENT_ACTIONS_SHEET);

  const appRequired = [
    'Reference No',
    'Student Name',
    'Agent Code',
    'Prospect Status',
    'SKY Prospect ID',
    'Fee Group',
    'Prospect Updated At',
    'Prospect Remarks',
    'Last Updated'
  ];

  const workflowRequired = [
    'Reference No',
    'Student Name',
    'Prospect Status',
    'SKY Prospect ID',
    'Fee Group',
    'Prospect Updated At',
    'Last Updated',
    'Updated By'
  ];

  const report = {
    ok:
      !!appSheet &&
      !!workflowSheet &&
      !!actionSheet &&
      v2HasHeaders_(appSheet, appRequired) &&
      v2HasHeaders_(workflowSheet, workflowRequired),

    v2ApplicationsExists: !!appSheet,
    v2ApplicationsHeadersReady:
      !!appSheet && v2HasHeaders_(appSheet, appRequired),

    v2WorkflowExists: !!workflowSheet,
    v2WorkflowHeadersReady:
      !!workflowSheet && v2HasHeaders_(workflowSheet, workflowRequired),

    agentActionsExists: !!actionSheet,

    targetApplicationSheet: 'V2_APPLICATIONS',
    targetWorkflowSheet: 'V2_WORKFLOW',

    emailMode: v2AgentNotificationMode_(),
    externalEmailSent: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2AgentControlledSyncTest() {
  assertDevIdentity_();

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const feeGroups = v2GetFeeGroups_();

  if (!feeGroups.length) {
    throw new Error('No Fee Group available for controlled test.');
  }

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const reference = 'V2-AGENT-TEST-' + stamp;
  const studentName = 'V2 AGENT CONTROLLED TEST ' + stamp;
  const testSkyId = 'SKY-TEST-' + stamp;
  const testFeeGroup = feeGroups[0];
  const now = new Date().toISOString();

  // --------------------------------------------------
  // 1. Create isolated V2 test application
  // --------------------------------------------------
  v2Append_('V2_APPLICATIONS', {
    'Reference No': reference,
    'Submitted At': now,
    'Applicant Type': 'TEST RECORD',
    'Student Name': studentName,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Phone Number': 'TEST',
    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Study Mode': 'Online',
    'Intake': 'September 2026',
    'Intake ID': 'SEP-2026',
    'Entry Qualification Type': 'Normal Entry',
    'Highest Qualification': 'Bachelor Degree - Test',
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
    'Version': 'CONTROLLED_AGENT_TEST'
  });

  // --------------------------------------------------
  // 2. Create matching V2 workflow
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
    'Application Stage': 'APPLICATION_RECEIVED',
    'Application Status': 'TEST',
    'Screening Recommendation': 'MANUAL_REVIEW',
    'Prospect Status': 'PENDING',
    'SKY Prospect ID': '',
    'Fee Group': '',
    'Prospect Updated At': '',
    'SAC Session ID': '',
    'SAC Decision': '',
    'SAC Endorsed At': '',
    'Assessment Status': 'NOT_REQUIRED',
    'Prerequisite Status': 'NOT_REQUIRED',
    'Offer Letter Status': 'NOT_ISSUED',
    'Offer Letter Issued At': '',
    'Acceptance Status': 'PENDING',
    'Orientation Session ID': '',
    'Orientation Status': 'NOT_ASSIGNED',
    'Provisioning Status': 'NOT_STARTED',
    'Academic Handover Status': 'NOT_READY',
    'Student Folder URL': '',
    'Last Updated': now,
    'Updated By': 'Controlled Agent Test',
    'Version': V2_BUILD
  });

  // --------------------------------------------------
  // 3. Create secure one-time Agent action
  // --------------------------------------------------
  const actionLink = v2CreateAgentActionLink_({
    fullName: studentName,
    programme: 'MBA - Master of Business Administration',
    referralSource: 'Direct Application',
    partnerCode: ''
  }, reference);

  const tokenPart = String(actionLink).split('token=')[1] || '';
  const rawToken = decodeURIComponent(tokenPart.split('&')[0]);

  if (!rawToken) {
    throw new Error('Controlled test could not extract agent action token.');
  }

  // --------------------------------------------------
  // 4. Submit Agent Prospect + Fee Group
  // --------------------------------------------------
  const submitResult = v2AgentSubmitAction(rawToken, {
    skyProspectId: testSkyId,
    feeGroup: testFeeGroup,
    remarks: 'CONTROLLED V2 AGENT SYNC TEST'
  });

  // --------------------------------------------------
  // 5. Verify all V2 tables
  // --------------------------------------------------
  const app = v2Find_(
    'V2_APPLICATIONS',
    'Reference No',
    reference
  );

  const workflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );

  const actionSheet = ss.getSheetByName(V2_AGENT_ACTIONS_SHEET);
  const action = v2FindActionByTokenHash_(
    actionSheet,
    v2HashToken_(rawToken)
  );

  const audits = v2Rows_('V2_AUDIT_LOG').filter(function(row) {
    return String(row['Reference No']) === reference &&
      String(row['Action']) === 'AGENT_PROSPECT_UPDATED';
  });

  // Duplicate submission must be blocked
  const duplicateResult = v2AgentSubmitAction(rawToken, {
    skyProspectId: testSkyId,
    feeGroup: testFeeGroup,
    remarks: 'DUPLICATE TEST'
  });

  const checks = {
    applicationUpdated:
      !!app &&
      String(app.record['SKY Prospect ID']) === testSkyId &&
      String(app.record['Fee Group']) === testFeeGroup &&
      String(app.record['Prospect Status']) === 'PROSPECT_UPDATED',

    workflowUpdated:
      !!workflow &&
      String(workflow.record['SKY Prospect ID']) === testSkyId &&
      String(workflow.record['Fee Group']) === testFeeGroup &&
      String(workflow.record['Prospect Status']) === 'PROSPECT_UPDATED',

    agentActionSubmitted:
      !!action &&
      String(action.record['Action Status']) === 'SUBMITTED',

    auditRecorded: audits.length > 0,

    duplicateBlocked:
      !!duplicateResult &&
      duplicateResult.duplicate === true
  };

  const report = {
    ok:
      checks.applicationUpdated &&
      checks.workflowUpdated &&
      checks.agentActionSubmitted &&
      checks.auditRecorded &&
      checks.duplicateBlocked,

    referenceNo: reference,
    skyProspectId: testSkyId,
    feeGroup: testFeeGroup,

    checks: checks,

    emailMode: v2AgentNotificationMode_(),
    externalEmailSent: false,
    v1Touched: false,

    testRecordCreated: true
  };

  Logger.log(JSON.stringify(report));
  return report;
}
