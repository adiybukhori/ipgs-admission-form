/**
 * Admission V2 - PhD Preliminary Research Intent
 *
 * Policy:
 * - Required for PhD admission processing / document review.
 * - NOT a hard blocker for initial Admission Form submission.
 * - If missing at submission, issue a secure upload link.
 * - Applicant cannot become document-complete / proceed to SAC until received.
 * - V1 is never read or modified.
 */

const V2_RESEARCH_INTENT_BUILD = 'V2_RESEARCH_INTENT_20260917';
const V2_RESEARCH_INTENT_MAX_BYTES = 7 * 1024 * 1024;
const V2_RESEARCH_INTENT_HEADERS = [
  'Research Intent Status',
  'Research Intent Upload Token Hash',
  'Research Intent Upload URL',
  'Research Intent Received At',
  'Research Intent File URL'
];

function v2ResearchIntentIsPhd_(programme) {
  const value = String(programme || '').trim();
  return /^PHD\b/i.test(value) || /DOCTOR OF PHILOSOPHY/i.test(value);
}

function v2ResearchIntentEnsureHeaders_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const applications = ss.getSheetByName('V2_APPLICATIONS');
  const workflow = ss.getSheetByName('V2_WORKFLOW');
  if (!applications || !workflow) throw new Error('V2 application/workflow sheets are not ready.');
  v2OfferEnsureHeaders_(applications, V2_RESEARCH_INTENT_HEADERS);
  v2OfferEnsureHeaders_(workflow, ['Research Intent Status','Research Intent Received At']);
  return {applications:applications, workflow:workflow};
}

function v2ResearchIntentExistingFile_(applicationRecord) {
  let files = [];
  try {
    files = JSON.parse(String(applicationRecord['Uploaded Files JSON'] || '[]'));
  } catch (error) {
    files = [];
  }
  if (!Array.isArray(files)) files = [];
  return files.filter(function(item) {
    return item && String(item.field || '') === 'preliminaryResearchIntent';
  })[0] || null;
}

function v2PrepareResearchIntentRequirement_(payload, referenceNo) {
  v2ResearchIntentEnsureHeaders_();
  const reference = String(referenceNo || '').trim();
  const application = v2Find_('V2_APPLICATIONS','Reference No',reference);
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!application || !workflow) throw new Error('Application/workflow record not found for Research Intent preparation.');

  const programme = String(application.record['Programme'] || payload && payload.programme || '');
  const now = new Date().toISOString();
  if (!v2ResearchIntentIsPhd_(programme)) {
    v2UpdateRow_(application.sheet, application.rowNumber, {
      'Research Intent Status':'NOT_APPLICABLE',
      'Research Intent Upload Token Hash':'',
      'Research Intent Upload URL':'',
      'Research Intent Received At':'',
      'Research Intent File URL':'',
      'Last Updated':now
    });
    v2UpdateRow_(workflow.sheet, workflow.rowNumber, {
      'Research Intent Status':'NOT_APPLICABLE',
      'Research Intent Received At':'',
      'Last Updated':now
    });
    return {required:false,status:'NOT_APPLICABLE',uploadUrl:''};
  }

  const existing = v2ResearchIntentExistingFile_(application.record);
  if (existing) {
    v2UpdateRow_(application.sheet, application.rowNumber, {
      'Research Intent Status':'RECEIVED',
      'Research Intent Upload Token Hash':'',
      'Research Intent Upload URL':'',
      'Research Intent Received At':now,
      'Research Intent File URL':String(existing.url || ''),
      'Last Updated':now
    });
    v2UpdateRow_(workflow.sheet, workflow.rowNumber, {
      'Research Intent Status':'RECEIVED',
      'Research Intent Received At':now,
      'Last Updated':now
    });
    return {required:true,status:'RECEIVED',uploadUrl:'',fileUrl:String(existing.url || '')};
  }

  const rawToken = Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'');
  const tokenHash = v2OfferHashToken_(rawToken);
  const serviceUrl = String(ScriptApp.getService().getUrl() || '').trim();
  const uploadUrl = serviceUrl
    ? serviceUrl + '?page=research-intent-v2&token=' + encodeURIComponent(rawToken)
    : '';

  v2UpdateRow_(application.sheet, application.rowNumber, {
    'Research Intent Status':'PENDING',
    'Research Intent Upload Token Hash':tokenHash,
    'Research Intent Upload URL':uploadUrl,
    'Research Intent Received At':'',
    'Research Intent File URL':'',
    'Last Updated':now
  });
  v2UpdateRow_(workflow.sheet, workflow.rowNumber, {
    'Research Intent Status':'PENDING',
    'Research Intent Received At':'',
    'Last Updated':now
  });

  if (typeof v2Audit_ === 'function') {
    v2Audit_(reference,'ADMISSION','RESEARCH_INTENT_PENDING',{}, {
      required:true,status:'PENDING',secureUploadLinkCreated:!!uploadUrl
    }, 'Admission V2', 'SUCCESS', 'Initial application accepted; Research Intent is tracked as outstanding and may be submitted later without blocking the admission workflow.');
  }
  return {required:true,status:'PENDING',uploadUrl:uploadUrl};
}

function v2ResearchIntentFindByToken_(rawToken) {
  const token = String(rawToken || '').trim();
  if (!token) throw new Error('Research Intent upload token is required.');
  const hash = v2OfferHashToken_(token);
  const rows = v2Rows_('V2_APPLICATIONS');
  const row = rows.filter(function(item) {
    return String(item['Research Intent Upload Token Hash'] || '') === hash;
  })[0];
  if (!row) throw new Error('This Research Intent upload link is invalid or no longer available.');
  if (!v2ResearchIntentIsPhd_(row['Programme'])) throw new Error('Research Intent upload is not applicable to this application.');
  return row;
}

function v2GetResearchIntentUploadForToken(rawToken) {
  assertDevIdentity_();
  v2ResearchIntentEnsureHeaders_();
  const row = v2ResearchIntentFindByToken_(rawToken);
  return {
    ok:true,
    referenceNo:String(row['Reference No'] || ''),
    studentName:String(row['Student Name'] || ''),
    programme:String(row['Programme'] || ''),
    intake:v2OfferDisplayIntake_(row['Intake'] || ''),
    status:String(row['Research Intent Status'] || 'PENDING'),
    receivedAt:String(row['Research Intent Received At'] || ''),
    build:V2_RESEARCH_INTENT_BUILD
  };
}

function v2SubmitResearchIntentUpload(rawToken, fileData) {
  assertDevIdentity_();
  v2ResearchIntentEnsureHeaders_();
  const tokenRow = v2ResearchIntentFindByToken_(rawToken);
  const reference = String(tokenRow['Reference No'] || '').trim();
  const application = v2Find_('V2_APPLICATIONS','Reference No',reference);
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!application || !workflow) throw new Error('Application/workflow record not found.');

  if (String(application.record['Research Intent Status'] || '').toUpperCase() === 'RECEIVED') {
    return {ok:true,alreadyReceived:true,referenceNo:reference,status:'RECEIVED'};
  }

  const file = fileData || {};
  const mimeType = String(file.mimeType || '').trim();
  const allowed = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  if (allowed.indexOf(mimeType) === -1) {
    throw new Error('Please upload the Research Intent as a PDF, DOC or DOCX file.');
  }
  const size = Number(file.size || 0);
  if (size < 1 || size > V2_RESEARCH_INTENT_MAX_BYTES) {
    throw new Error('Research Intent file must be 7MB or smaller.');
  }
  const base64 = String(file.base64 || '').trim();
  if (!base64) throw new Error('Research Intent file is missing.');

  const folderId = v2OfferExtractDriveId_(String(application.record['Student Folder URL'] || workflow.record['Student Folder URL'] || ''));
  if (!folderId) throw new Error('Student folder could not be identified.');
  const folder = DriveApp.getFolderById(folderId);
  const extension = mimeType === 'application/pdf' ? '.pdf' : (mimeType === 'application/msword' ? '.doc' : '.docx');
  const safeName = v2SafeName_(String(application.record['Student Name'] || 'STUDENT')).replace(/\s+/g,'_').toUpperCase();
  const blob = Utilities.newBlob(
    Utilities.base64Decode(base64),
    mimeType,
    'PRELIMINARY_RESEARCH_INTENT_' + safeName + extension
  );
  const saved = folder.createFile(blob);

  let uploaded = [];
  try { uploaded = JSON.parse(String(application.record['Uploaded Files JSON'] || '[]')); } catch (error) { uploaded = []; }
  if (!Array.isArray(uploaded)) uploaded = [];
  uploaded = uploaded.filter(function(item) { return String(item && item.field || '') !== 'preliminaryResearchIntent'; });
  uploaded.push({
    field:'preliminaryResearchIntent',
    fileName:saved.getName(),
    url:saved.getUrl(),
    mimeType:mimeType,
    size:size
  });

  const now = new Date().toISOString();
  v2UpdateRow_(application.sheet, application.rowNumber, {
    'Uploaded Files JSON':JSON.stringify(uploaded),
    'Research Intent Status':'RECEIVED',
    'Research Intent Received At':now,
    'Research Intent File URL':saved.getUrl(),
    'Last Updated':now
  });
  v2UpdateRow_(workflow.sheet, workflow.rowNumber, {
    'Research Intent Status':'RECEIVED',
    'Research Intent Received At':now,
    'Last Updated':now,
    'Updated By':'Student Research Intent Upload'
  });

  if (typeof v2Audit_ === 'function') {
    v2Audit_(reference,'ADMISSION','RESEARCH_INTENT_RECEIVED',{}, {
      status:'RECEIVED',fileUrl:saved.getUrl()
    }, 'Applicant', 'SUCCESS', 'Preliminary Research Intent uploaded after initial application submission.');
  }

  try {
    if (typeof v2NotificationSend_ === 'function') {
      const recipient = String(application.record['Personal Email'] || '').trim();
      const html = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2 style="color:#2d2363">Research Intent Received</h2><p>Dear <strong>'+v2Html_(application.record['Student Name'] || 'Applicant')+'</strong>,</p><p>Your Preliminary Research Intent has been received successfully and added to your admission record.</p><p><strong>Reference:</strong> '+v2Html_(reference)+'</p><p>IPGS Registry will continue the admission document review process.</p></div>';
      v2NotificationSend_('RESEARCH_INTENT_RECEIVED',[recipient],'[IUC IPGS] Research Intent Received - ' + reference,'Your Preliminary Research Intent has been received. Reference: ' + reference,html,{});
    }
  } catch (emailError) {
    Logger.log('Research Intent confirmation email failed non-blocking: ' + String(emailError && emailError.message || emailError));
  }

  v2InvalidateCache_();
  return {ok:true,referenceNo:reference,status:'RECEIVED',fileUrl:saved.getUrl(),receivedAt:now};
}

function v2RenderResearchIntentPage_(params) {
  assertDevIdentity_();
  const template = HtmlService.createTemplateFromFile('research-intent-v2');
  template.token = String(params && (params.token || params.t) || '');
  return template.evaluate().setTitle('IUC Preliminary Research Intent Upload');
}
