/* DEVELOPMENT SAFETY BASELINE ONLY.
 * All existing operations are deliberately locked.
 * Run ONLY devSafetyPreflight from the V2 editor.
 * No deployment or submission testing at this stage.
 * Original workflow bodies retained; auto-COL still awaits the next upgrade.
 */
/***********************
 * IUC Admission Backend
 * Google Apps Script Web App
 * Cleaned + fixed version
 ***********************/

const CONFIG = {
  spreadsheetId: '1O-Y-q7_q78xKM1p5e2C3EWyQfYr5rXvhO0oWbVaw5Mw',
  sheetName: 'ADMISSION_RESPONSE',
  rootFolderId: '1DjGzCloTBLUbP84vLfV5xjkxuWf-Zxd1',
  notificationEmails: ['adiybukhori@innovative.edu.my'],
  timezone: 'Asia/Kuala_Lumpur',
  iucLogoFileId: '1aCvoX1s-k6t_XXWQRFLCo2KIli5QiyS_',
  buildVersion: 'DEV_SAFETY_LOCKED_20260904',
  adminApiPassword: '',
  masterFolderName: 'MASTER',
  colTemplateId: '1jrjIribeYBVSgd1Is2w71dilIanPgyAFkTGqsY9_uYI',
  acceptanceTemplateId: '111FQaIYVSBFyHbFIQmbGlTD0rGluJgKY3Q7cHu8g_lU',
  internationalColTemplateId: '1UFoDgdIaPS2bs8fvb1Fc8ETJvzcoEUcjhkPXDJ13vz8',
  agentMasterSheetName: 'AGENT_MASTER',
  epfTrackingSheetName: 'EPF_TRACKING',
  defaultNotificationEmail: 'adiybukhori@innovative.edu.my',
  isoNotificationEmail: 'muhammadadiy93@gmail.com',
  epfNotificationEmail: 'nurazila@innovative.edu.my',

  officialLoaTemplateId: '',
  acceptanceEnTemplateId: '',
  suratPenerimaanTemplateId: '',
  suratAkuanTemplateId: '',

  studentHandbookFileId: '',
  studentPortalManualFileId: '',
  additionalStaticAttachmentFileIds: [],

  feeGroupMasterSheetName: 'FEE_GROUP_MASTER',
  acceptanceSigningBaseUrl: 'https://ipgs-admission-form.innovative.edu.my/acceptance.html',

  agentActionBaseUrl: '',
  agentActionSheetName: 'V2_AGENT_ACTIONS',
  agentActionEmailMode: 'DISABLED/TEST',
  
  officialLoaTemplateId: '1BXx6GK7XPIbw8tmF8gmeGr8KUL1opFfCmEoC1TXnxwA',

  acceptanceEnTemplateId: '1JuIwpkPXIebWohnJrBUyJLw5flbVi3nbX0IsOgYlzlg',
};

const HEADERS = [
  'Reference No',
  'Submitted At',
  'Captured Email',
  'Applicant Type',
  'Level of Study',
  'Programme',
  'Intake',
  'Entry Qualification Type',
  'Proposed Supervisor',
  'Referral Source',
  'Partner Code',
  'Full Name',
  'ID / Passport No',
  'Gender',
  'Email',
  'Phone Number',
  'Country',
  'Full Address',
  'Place of Birth',
  'Nationality',
  'Race',
  'Religion',
  'Marital Status',
  'Emergency Contact Name',
  'Emergency Relationship',
  'Emergency Phone',
  'Emergency Address',
  'Emergency Same As Applicant',
  'Payment Arrangement',
  'Installment Frequency',
  'Payment Source',
  'Payment Source Other',
  'Declaration Accepted',
  'Student Folder URL',
  'Uploaded Files JSON',
  'Source',
  'User Agent',
  'Prospect Status',
  'Fee Group',
  'Prospect Updated At',
  'Prospect Remarks'

];

const WORKFLOW_HEADERS = [
  'Application Status',
  'Application Stage',
  'Document Check Status',
  'Orientation Status',
  'Document Remarks',
  'RO PIC',
  'SAC Status',
  'SAC Date',

  'Offer Letter Status',
  'COL Issued At',
  'Offer Letter PDF URL',
  'Admission Form PDF URL',
  'Offer Letter Remarks',
  'LOA Email Sent To',
  'LOA CC Email',

  'Acceptance Status',
  'Acceptance Received At',
  'Acceptance Token',
  'Acceptance Signing URL',
  'Acceptance Remarks',

  'Prospect Status',
  'Fee Group',
  'Sky Prospect ID',

  'Registration Status',
  'Student ID / Matric No',
  'Activated At',

  'Bursar Status',
  'ISO Status',
  'Registry Remark',
  'Internal Remarks',

  'Last Updated',
  'Updated By',

  'Qualification Status',
  'SAC Sitting',
  'Admin Remarks',

  'Employment Status',
  'Employment Sector',
  'Salary Range',
  'Non-Working Category',

  'Mode of Study',

  'Highest Qualification',
  'Last Institution / Awarding Body',
  'Field of Study / Qualification Area',
  'Year of Completion',
  'Academic Result / CGPA / Grade',
  'Certificate / Reference No.',

  'Health Declaration',
  'Health Declaration Remarks',
  'OKU Status',
  'OKU Category',
  'OKU Card Number',
  'Support Required',

  'Sky Document Upload Status',
  'Sky Uploaded At',
  'Sky Upload PIC',
  'Sky Document Remarks',
];

const FILE_LABELS = {
  identityDocument: 'IC',
  passportPhoto: 'PHOTO',
  apelCertificate: 'APEL',
  transcript: 'TRANSCRIPT',
  certificate: 'CERTIFICATE',
  otherSupportingDocument: 'SUPPORTING_DOC',
  englishCertificate: 'ENGLISH_CERT',
  cvResume: 'CV',
  passportCopyInternational: 'PASSPORT_COPY',
  completedAdmissionForm: 'ADMISSION_FORM',
  completedHealthDeclaration: 'HEALTH_DECLARATION',
  emgsPaymentReceipt: 'EMGS_RECEIPT'
};

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};

  if (params.page === 'agent-v2') {
    return v2RenderAgentPage_(params);
  }

  if (params.page === 'assessment-v2') {
    return v2RenderAssessmentPortal_();
  }

  if (params.page === 'acceptance-v2') {
    return v2RenderAcceptancePage_(params);
  } 

  if (String(params.action || '').indexOf('v2') === 0) {
    try {
      return handleV2Get_(params);
    } catch (error) {
      return jsonOutput_({ok:false, success:false, message:error && error.message ? error.message : String(error)});
    }
  }

  assertDevOperationsLocked_();

    if (params.action === 'version') {
    return jsonOutput_({
      ok: true,
      version: CONFIG.buildVersion,
      logoFileId: CONFIG.iucLogoFileId
    });
  }

  if (params.action === 'agents') {
    return apiOutput_({
      ok: true,
      agents: getActiveAgentCodes()
    }, params.callback);
  }

  if (params.action === 'applications') {
    return apiOutput_(getApplicationsForAdminApi_(params), params.callback);
  }

  if (params.page === 'dashboard') {
    return HtmlService.createHtmlOutputFromFile('dashboard');
  }

  return ContentService
  .createTextOutput('IUC Admission API is running.')
  .setMimeType(ContentService.MimeType.TEXT);
}

function apiOutput_(obj, callback) {
  assertDevOperationsLocked_();
  if (callback) {
    const safeCallback = String(callback || '').replace(/[^A-Za-z0-9_.$]/g, '');

    return ContentService
      .createTextOutput(safeCallback + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return jsonOutput_(obj);
}

function doPost(e) {
  try {
    // Public V2 parser — does not use the locked legacy parsePayload_().
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('No POST payload received.');
    }

    const payload = JSON.parse(e.postData.contents);
    const action = String(payload && payload.action ? payload.action : '');

    // Public Admission V2 submission remains available without admin token.
    if (action === 'v2SubmitAdmission') {
      const result = handleV2Post_(payload);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Protected V2 admin actions. handleV2Post_ verifies the V2 admin password
    // before dispatching any non-public action.
    if (action.indexOf('v2') === 0 && payload.token) {
      const result = handleV2Post_(payload);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // V1 / legacy / unauthenticated operations remain locked.
    assertDevOperationsLocked_();

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        success: false,
        message: error && error.message
          ? error.message
          : String(error)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function submitAdmissionForm(payload) {
  assertDevOperationsLocked_();
  if (!payload) {
    throw new Error('Missing payload. This function must be called from the admission form.');
  }

  return processAdmissionSubmission_(payload);
}

function processAdmissionSubmission_(payload) {
  assertDevOperationsLocked_();
  validatePayload_(payload);

  const reference = generateReference_(payload);
  const submittedAt = new Date();
  const submittedAtText = Utilities.formatDate(submittedAt, CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss');

  const sheet = getOrCreateSheet_();
  const rootFolder = DriveApp.getFolderById(CONFIG.rootFolderId);
  const studentFolder = createStudentFolder_(rootFolder, payload, submittedAt);
  const uploadedFiles = saveUploadedFiles_(studentFolder, payload);

  let admissionFormPdf = null;
  let colDocument = null;
  let colPdf = null;
  let acceptancePdf = null;

  // IMPORTANT:
  // Save row first so application is not lost if PDF / COL / email fails.
  appendRow_(sheet, payload, reference, submittedAt, studentFolder, uploadedFiles, admissionFormPdf);

  const rowNumber = sheet.getLastRow();

  try {
    admissionFormPdf = generateAdmissionFormPdf_(
      payload,
      reference,
      studentFolder,
      submittedAt,
      uploadedFiles
    );

    setRowValuesByHeader_(sheet, rowNumber, {
      'Admission Form PDF URL': admissionFormPdf && admissionFormPdf.url ? admissionFormPdf.url : '',
      'Last Updated': submittedAtText,
      'Updated By': 'System'
    });

  } catch (err) {
    Logger.log('Admission Form PDF generation failed: ' + err);

    setRowValuesByHeader_(sheet, rowNumber, {
      'Internal Remarks': 'Admission Form PDF generation failed: ' + String(err && err.message ? err.message : err),
      'Last Updated': submittedAtText,
      'Updated By': 'System'
    });
  }

  try {
    colDocument = generateColDocument_(payload, reference, studentFolder, submittedAt);
    colPdf = createColPdf_(colDocument, studentFolder);

    if (payload.applicantType === 'International (Non-Malaysian Citizen)') {
      const acceptanceDoc = generateAcceptanceDocument_(payload, reference, studentFolder, submittedAt);
      acceptancePdf = createAcceptancePdf_(acceptanceDoc, studentFolder);
    }

    sendStudentColEmail_(payload, reference, colPdf, acceptancePdf, admissionFormPdf);

    setRowValuesByHeader_(sheet, rowNumber, {
      'Offer Letter Status': 'Issued',
      'COL Issued At': submittedAtText,
      'Offer Letter PDF URL': colPdf && colPdf.url ? colPdf.url : '',
      'Offer Letter Remarks': 'Auto-issued upon application submission.',
      'LOA Email Sent To': payload.email || '',
      'Last Updated': submittedAtText,
      'Updated By': 'System'
    });

  } catch (err) {
    Logger.log('COL / email generation failed: ' + err);

    setRowValuesByHeader_(sheet, rowNumber, {
      'Offer Letter Status': 'Generation Failed',
      'Offer Letter Remarks': String(err && err.message ? err.message : err),
      'Last Updated': submittedAtText,
      'Updated By': 'System'
    });
  }

  try {
    appendEpfTracking_(payload, reference, submittedAt, studentFolder);
  } catch (err) {
    Logger.log('EPF tracking failed: ' + err);
  }

  try {
    sendNotificationEmail_(payload, reference, studentFolder, uploadedFiles);
  } catch (err) {
    Logger.log('Admin notification email failed: ' + err);
  }

  try {
    sendAgentProspectEmail_(payload, reference, studentFolder);
  } catch (err) {
    Logger.log('Agent prospect email failed: ' + err);
  }

  try {
    sendEpfNotificationEmail_(payload, reference, studentFolder);
  } catch (err) {
    Logger.log('EPF notification email failed: ' + err);
  }

  return {
    ok: true,
    success: true,
    reference: reference,
    folderUrl: studentFolder.getUrl(),
    colDocUrl: colDocument && colDocument.docUrl ? colDocument.docUrl : '',
    colPdfUrl: colPdf && colPdf.url ? colPdf.url : '',
    admissionFormPdfUrl: admissionFormPdf && admissionFormPdf.url ? admissionFormPdf.url : '',
    message: 'Application submitted successfully.'
  };
}

function parsePayload_(e) {
  assertDevOperationsLocked_();
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('No POST payload received.');
  }

  return JSON.parse(e.postData.contents);
}

function validatePayload_(payload) {
  assertDevOperationsLocked_();
  const required = {
    capturedEmail: 'Captured Email',
    applicantType: 'Applicant Type',
    levelOfStudy: 'Level of Study',
    programme: 'Programme',
    intake: 'Intake',
    entryQualificationType: 'Entry Qualification Type',
    fullName: 'Full Name',
    idPassport: 'ID / Passport No',
    gender: 'Gender',
    email: 'Email',
    phoneNumber: 'Phone Number',
    country: 'Country',
    fullAddress: 'Full Address',
    placeOfBirth: 'Place of Birth',
    nationality: 'Nationality',
    race: 'Race',
    religion: 'Religion',
    maritalStatus: 'Marital Status',
    studyMode: 'Mode of Study',
    highestQualification: 'Highest Qualification',
    lastInstitution: 'Last Institution / Awarding Body',
    yearOfCompletion: 'Year of Completion',
    healthDeclaration: 'Health Declaration',
    okuStatus: 'OKU Status',
    employmentStatus: 'Employment Status',
    emergencyName: 'Emergency Contact Name',
    emergencyRelationship: 'Emergency Relationship',
    emergencyPhone: 'Emergency Phone',
    paymentArrangement: 'Payment Arrangement',
    paymentSource: 'Payment Source'
  };

  Object.keys(required).forEach(function (key) {
    if (!payload[key] || String(payload[key]).trim() === '') {
      throw new Error(required[key] + ' is required.');
    }
  });

    if (
      payload.healthDeclaration &&
      payload.healthDeclaration !== 'I declare that I am physically and mentally fit to undertake my studies.' &&
      !payload.healthDeclarationRemarks
    ) {
      throw new Error('Health Declaration Remarks is required.');
    }

    if (
      payload.okuStatus &&
      String(payload.okuStatus).startsWith('Yes') &&
      !payload.okuCategory
    ) {
      throw new Error('OKU Category is required.');
    }

    if (payload.employmentStatus === 'Working' && !payload.employmentSector) {
      throw new Error('Employment Sector is required.');
    }

     if (payload.employmentStatus === 'Working' && !payload.salaryRange) {
       throw new Error('Salary Range is required.');
    }

    if (payload.employmentStatus === 'Not Working' && !payload.nonWorkingCategory) {
      throw new Error('Current Profile / Background is required.');
    }

  const isPartnerFlow = payload.referralSource === 'Education Consultant';

  if (isPartnerFlow) {
    const agentCode = String(payload.partnerCode || '').trim().toUpperCase();
    const agent = getAgentByCode_(agentCode);

    if (!agent) {
      throw new Error('Invalid Partner / Agent Code. Please select from the list.');
    }
  }

  if (!payload.emergencySameAsApplicant && (!payload.emergencyAddress || String(payload.emergencyAddress).trim() === '')) {
    throw new Error('Emergency Address is required.');
  }

  if (payload.paymentArrangement === 'Installment Plan' && !payload.installmentFrequency) {
    throw new Error('Installment Frequency is required for Installment Plan.');
  }

  if (payload.paymentSource === 'Other' && !payload.paymentSourceOther) {
    throw new Error('Payment Source Other is required when Payment Source is Other.');
  }

  if (!payload.declarationAccepted) {
    throw new Error('Declaration must be accepted before submission.');
  }

  if (
    payload.applicantType === 'International (Non-Malaysian Citizen)' &&
    payload.paymentSource === 'EPF Withdrawal (KWSP)'
  ) {
    throw new Error('EPF Withdrawal (KWSP) is only applicable for local Malaysian applicants.');
  }
}

function getOrCreateSheet_() {
  assertDevOperationsLocked_();
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  let sheet = ss.getSheetByName(CONFIG.sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.sheetName);
  }

  ensureAdmissionResponseHeaders_(sheet);

  return sheet;
}

function getRequiredAdmissionHeaders_() {
  assertDevOperationsLocked_();
  return HEADERS.concat(WORKFLOW_HEADERS);
}

function ensureAdmissionResponseHeaders_(sheet) {
  assertDevOperationsLocked_();
  const requiredHeaders = getRequiredAdmissionHeaders_();

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    styleAdmissionHeaderRow_(sheet);
    return;
  }

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const existingHeaders = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(function (h) {
      return String(h || '').trim();
    });

  requiredHeaders.forEach(function (headerName) {
    if (existingHeaders.indexOf(headerName) === -1) {
      const newColumn = sheet.getLastColumn() + 1;
      sheet.getRange(1, newColumn).setValue(headerName);
      existingHeaders.push(headerName);
    }
  });

  styleAdmissionHeaderRow_(sheet);
}

function styleAdmissionHeaderRow_(sheet) {
  assertDevOperationsLocked_();
  const lastColumn = sheet.getLastColumn();
  if (lastColumn < 1) return;

  sheet.setFrozenRows(1);

  sheet
    .getRange(1, 1, 1, lastColumn)
    .setFontWeight('bold')
    .setBackground('#2d2363')
    .setFontColor('#ffffff')
    .setWrap(true);
}

function generateReference_(payload) {
  assertDevOperationsLocked_();
  const now = Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyyMMdd-HHmmss');
  const cleanedId = sanitizeForName_(payload.idPassport || 'NOID')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 10) || 'NOID';

  return 'IUC-ADM-' + now + '-' + cleanedId;
}

function createStudentFolder_(rootFolder, payload, submittedAt) {
  assertDevOperationsLocked_();
  const masterFolder = getOrCreateSubFolder_(rootFolder, CONFIG.masterFolderName);
  const intakeFolderName = buildIntakeFolderName_(payload.intake, submittedAt);
  const intakeFolder = getOrCreateSubFolder_(masterFolder, intakeFolderName);
  const levelFolder = getOrCreateSubFolder_(
    intakeFolder,
    sanitizeForName_((payload.levelOfStudy || 'General Level').toUpperCase())
  );

  const studentFolderName = buildStudentFolderName_(payload);
  return getOrCreateSubFolder_(levelFolder, studentFolderName);
}

function buildIntakeFolderName_(intake, submittedAt) {
  assertDevOperationsLocked_();
  const year = Utilities.formatDate(submittedAt || new Date(), CONFIG.timezone, 'yyyy');
  const intakeText = sanitizeForName_((intake || 'General Intake').toUpperCase());
  return intakeText + ' ' + year;
}

function getMainIntake_(monthlyIntake) {
  assertDevOperationsLocked_();
  const intake = String(monthlyIntake || '').trim().toLowerCase();

  const map = {
    january: 'January',
    jan: 'January',
    february: 'January',
    feb: 'January',
    march: 'May',
    mar: 'May',
    april: 'May',
    apr: 'May',
    may: 'May',
    june: 'May',
    jun: 'May',
    july: 'September',
    jul: 'September',
    august: 'September',
    aug: 'September',
    september: 'September',
    sept: 'September',
    sep: 'September',
    october: 'September',
    oct: 'September',
    november: 'September',
    nov: 'September',
    december: 'January',
    dec: 'January'
  };

  return map[intake] || monthlyIntake || '';
}

function getMainIntakeWithYear_(monthlyIntake, submittedAt) {
  assertDevOperationsLocked_();
  const mainIntake = getMainIntake_(monthlyIntake);
  const intake = String(monthlyIntake || '').trim().toLowerCase();
  let year = Number(Utilities.formatDate(submittedAt || new Date(), CONFIG.timezone, 'yyyy'));

  if (intake === 'december' || intake === 'dec') {
    year += 1;
  }

  return mainIntake + ' ' + year;
}

function buildStudentFolderName_(payload) {
  assertDevOperationsLocked_();
  const cleanName = sanitizeForName_(payload.fullName || 'Unknown Student')
    .replace(/\s+/g, '_')
    .toUpperCase();
  const cleanId = sanitizeForName_(payload.idPassport || 'NOID').replace(/\s+/g, '');

  return cleanName + '_' + cleanId;
}

function getOrCreateSubFolder_(parent, folderName) {
  assertDevOperationsLocked_();
  const existing = parent.getFoldersByName(folderName);
  if (existing.hasNext()) return existing.next();
  return parent.createFolder(folderName);
}

function saveUploadedFiles_(studentFolder, payload) {
  assertDevOperationsLocked_();
  const docs = payload.documents || {};
  const uploaded = [];

  Object.keys(docs).forEach(function (key) {
    const doc = docs[key];
    if (!doc || !doc.base64) return;

    const fileName = buildFileName_(payload, key, doc.fileName);
    const contentType = doc.mimeType || MimeType.PDF;
    const bytes = Utilities.base64Decode(doc.base64);
    const blob = Utilities.newBlob(bytes, contentType, fileName);
    const file = studentFolder.createFile(blob);

    uploaded.push({
      field: key,
      fileName: file.getName(),
      url: file.getUrl(),
      mimeType: contentType,
      size: doc.size || ''
    });
  });

  return uploaded;
}

function buildFileName_(payload, fieldKey, originalName) {
  assertDevOperationsLocked_();
  const ext = getFileExtension_(originalName);
  const label = FILE_LABELS[fieldKey] || fieldKey;
  const studentName = sanitizeForName_(payload.fullName || 'Unknown')
    .replace(/\s+/g, '_')
    .toUpperCase();

  return label + '_' + studentName + ext;
}

function getFileExtension_(originalName) {
  assertDevOperationsLocked_();
  if (!originalName || originalName.indexOf('.') === -1) return '';
  return '.' + originalName.split('.').pop();
}

function sanitizeForName_(value) {
  assertDevOperationsLocked_();
  return String(value || '')
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function appendRow_(sheet, payload, reference, submittedAt, studentFolder, uploadedFiles, admissionFormPdf) {
  assertDevOperationsLocked_();
  const row = [
    reference,
    Utilities.formatDate(submittedAt, CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss'),
    payload.capturedEmail || '',
    payload.applicantType || '',
    payload.levelOfStudy || '',
    payload.programme || '',
    payload.intake || '',
    payload.entryQualificationType || '',
    payload.proposedSupervisor || '',
    payload.referralSource || '',
    payload.partnerCode || '',
    payload.fullName || '',
    payload.idPassport || '',
    payload.gender || '',
    payload.email || '',
    payload.phoneNumber || '',
    payload.country || '',
    payload.fullAddress || '',
    payload.placeOfBirth || '',
    payload.nationality || '',
    payload.race || '',
    payload.religion || '',
    payload.maritalStatus || '',
    payload.emergencyName || '',
    payload.emergencyRelationship || '',
    payload.emergencyPhone || '',
    payload.emergencyAddress || '',
    payload.emergencySameAsApplicant ? 'Yes' : 'No',
    payload.paymentArrangement || '',
    payload.installmentFrequency || '',
    payload.paymentSource || '',
    payload.paymentSourceOther || '',
    payload.declarationAccepted ? 'Yes' : 'No',
    studentFolder.getUrl(),
    JSON.stringify(uploadedFiles),
    payload.meta && payload.meta.source ? payload.meta.source : '',
    payload.meta && payload.meta.userAgent ? payload.meta.userAgent : ''
  ];

  sheet.appendRow(row);

  const rowNumber = sheet.getLastRow();
  const updatedAt = Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss');

  setRowValuesByHeader_(sheet, rowNumber, {
    'Application Status': 'New Application',
    'Application Stage': 'New Submission',
    'Document Check Status': 'Pending Review',
    'Orientation Status': 'Not Updated',
    'SAC Status': 'Not Started',

    'Offer Letter Status': 'Not Issued',
    'COL Issued At': '',
    'Admission Form PDF URL': admissionFormPdf && admissionFormPdf.url ? admissionFormPdf.url : '',
    'Offer Letter Remarks': '',

    'Acceptance Status': 'Pending Acceptance',
    'Acceptance Received At': '',
    'Acceptance Remarks': '',

    'Prospect Status': 'Pending Prospect Update',
    'Registration Status': 'Not Registered',

    'Sky Document Upload Status': 'Not Started',
    'Sky Uploaded At': '',
    'Sky Upload PIC': '',
    'Sky Document Remarks': '',

    'Employment Status': payload.employmentStatus || '',
    'Employment Sector': payload.employmentSector || '',
    'Salary Range': payload.salaryRange || '',
    'Non-Working Category': payload.nonWorkingCategory || '',

    'Mode of Study': payload.studyMode || '',

    'Highest Qualification': payload.highestQualification || '',
    'Last Institution / Awarding Body': payload.lastInstitution || '',
    'Field of Study / Qualification Area': payload.fieldOfStudy || '',
    'Year of Completion': payload.yearOfCompletion || '',
    'Academic Result / CGPA / Grade': payload.academicResult || '',
    'Certificate / Reference No.': payload.certificateReferenceNo || '',

    'Health Declaration': payload.healthDeclaration || '',
    'Health Declaration Remarks': payload.healthDeclarationRemarks || '',
    'OKU Status': payload.okuStatus || '',
    'OKU Category': payload.okuCategory || '',
    'OKU Card Number': payload.okuCardNumber || '',
    'Support Required': payload.supportRequired || '',

    'Last Updated': updatedAt,
    'Updated By': 'System'
  });
}

function sendNotificationEmail_(payload, reference, studentFolder, uploadedFiles) {
  assertDevOperationsLocked_();
  const routing = getNotificationRecipients_(payload);
  const recipients = routing.emails;
  const agent = routing.agent;

  if (!recipients.length) return;

  const subject = '[IUC Admission] New Application Received - ' + reference;
  const body = [
    'A new admission application has been submitted.',
    '',
    'Reference: ' + reference,
    'Submitted By: ' + (payload.fullName || '-'),
    'Applicant Type: ' + (payload.applicantType || '-'),
    'Programme: ' + (payload.programme || '-'),
    'Intake: ' + (payload.intake || '-'),
    'Email: ' + (payload.email || '-'),
    'Phone: ' + (payload.phoneNumber || '-'),
    'Payment Source: ' + (payload.paymentSource || '-'),
    'Partner Code: ' + (payload.partnerCode || '-'),
    'Assigned Agent: ' + (agent ? (agent.name || '-') : 'Direct / No Agent'),
    'Agent Organisation: ' + (agent ? (agent.organisation || '-') : '-'),
    'Student Folder: ' + studentFolder.getUrl(),
    'Uploaded Files: ' + uploadedFiles.length,
    '',
    'This notification is auto-generated from the admission system.'
  ].join('\n');

  try {
    blockedDevSendEmail_({
      to: recipients.join(','),
      subject: subject,
      body: body
    });
  } catch (err) {
    Logger.log('Email notification failed: ' + err);
  }
}

function sendStudentColEmail_(payload, reference, colPdf, acceptancePdf, admissionFormPdf) {
  assertDevOperationsLocked_();
  if (!payload.email) return;

  const studentName = toTitleCase_(payload.fullName || 'Applicant');
  const programmeName = getProgrammeNameOnly_(payload.programme || '-');
  const mainIntake = payload.applicantType === 'International (Non-Malaysian Citizen)'
    ? getInternationalIntakePlusFour_(payload.intake || '-', new Date())
    : getMainIntakeWithYear_(payload.intake || '-', new Date());

  const attachments = [];

  if (colPdf && colPdf.blob) {
    attachments.push(colPdf.blob);
  }

  if (admissionFormPdf && admissionFormPdf.blob) {
    attachments.push(admissionFormPdf.blob);
  }

  if (acceptancePdf && acceptancePdf.blob) {
    attachments.push(acceptancePdf.blob);
  }

  const subject = 'Conditional Offer of Admission – Innovative University College';

  const body = [
    'Dear ' + studentName + ',',
    '',
    'Greetings from Innovative University College.',
    ...(payload.applicantType === 'International (Non-Malaysian Citizen)'
      ? ['', 'For international applicants:', 'Please complete, sign, and return the attached Acceptance Form by replying to this email.']
      : []),
    '',
    'We are pleased to inform you that your application has been successfully reviewed, and we are delighted to extend to you a Conditional Offer of Admission for the following programme:',
    '',
    'Programme: ' + programmeName,
    'Study Mode: ' + (payload.studyMode || '-'),
    'Intake: ' + mainIntake,
    'Reference No: ' + reference,
    '',
    'Please find attached the following documents for your reference:',
    '1. Conditional Offer Letter',
    '2. System-generated Admission Form',
    ...(acceptancePdf ? ['3. Acceptance Form'] : []),
    '',
    'Kindly review the documents carefully and proceed with the next steps as advised.',
    '',
    'Should you require any further clarification, please do not hesitate to contact us.',
    '',
    'We look forward to welcoming you to Innovative University College.',
    '',
    'Thank you.',
    '',
    'Best regards,',
    'Registry Department',
    'Innovative University College',
    'Email: info@innovative.edu.my',
    'Tel: +603 2726 2436'
  ].join('\n');

  try {
    blockedDevSendEmail_({
      to: payload.email,
      subject: subject,
      body: body,
      attachments: attachments
    });
  } catch (err) {
    Logger.log('Student email failed: ' + err);
  }
}

function jsonOutput_(obj) {
  assertDevOperationsLocked_();
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateColDocument_(payload, reference, studentFolder, submittedAt) {
  assertDevOperationsLocked_();
  const isInternationalStudent = payload.applicantType === 'International (Non-Malaysian Citizen)';
  const templateId = isInternationalStudent ? CONFIG.internationalColTemplateId : CONFIG.colTemplateId;
  const templateFile = DriveApp.getFileById(templateId);
  const studentNameForFile = toTitleCase_(payload.fullName || '').replace(/\s+/g, '_');
  const copyName = 'COL_' + studentNameForFile;
  const docCopy = templateFile.makeCopy(copyName, studentFolder);
  const docId = docCopy.getId();
  const doc = DocumentApp.openById(docId);
  const body = doc.getBody();
  const formattedDate = Utilities.formatDate(submittedAt || new Date(), CONFIG.timezone, 'dd/MM/yyyy');
  const studentName = String(payload.fullName || '').toUpperCase();
  const studentAddress = formatAddressForLetter_(payload.fullAddress || '');
  const programmeNameOnly = getProgrammeNameOnly_(payload.programme || '');
  const mainIntake = isInternationalStudent
    ? getInternationalIntakePlusFour_(payload.intake || '', submittedAt)
    : getMainIntakeWithYear_(payload.intake || '', submittedAt);
  const durationStudy = getStudyDuration_(payload.levelOfStudy || '', payload.programme || '');
  const country = payload.country || payload.nationality || '';

  body.replaceText('{{REF_NO}}', safeReplace_(reference));
  body.replaceText('{{DATE}}', safeReplace_(formattedDate));
  body.replaceText('{{STUDENT_NAME}}', safeReplace_(studentName));
  body.replaceText('{{STUDENT_ADDRESS}}', safeReplace_(studentAddress));
  body.replaceText('{{PROGRAMME_NAME}}', safeReplace_(programmeNameOnly));
  body.replaceText('{{MODE_OF_STUDY}}', safeReplace_(payload.studyMode || ''));
  body.replaceText('{{INTAKE}}', safeReplace_(mainIntake));
  body.replaceText('{{COUNTRY}}', safeReplace_(country));

  if (isInternationalStudent) {
    body.replaceText('{{DURATION_STUDY}}', safeReplace_(durationStudy));
  }

  doc.saveAndClose();

  return {
    docId: docId,
    docFile: docCopy,
    docUrl: docCopy.getUrl(),
    fileName: copyName
  };
}

function createColPdf_(colDocument, studentFolder) {
  assertDevOperationsLocked_();
  const pdfBlob = DriveApp.getFileById(colDocument.docId)
    .getAs(MimeType.PDF)
    .setName(colDocument.fileName + '.pdf');

  const pdfFile = studentFolder.createFile(pdfBlob);

  return {
    fileId: pdfFile.getId(),
    fileName: pdfFile.getName(),
    url: pdfFile.getUrl(),
    blob: pdfBlob
  };
}

function generateAcceptanceDocument_(payload, reference, studentFolder, submittedAt) {
  assertDevOperationsLocked_();
  const templateFile = DriveApp.getFileById(CONFIG.acceptanceTemplateId);
  const studentNameForFile = toTitleCase_(payload.fullName || '').replace(/\s+/g, '_');
  const copyName = 'ACCEPTANCE_' + studentNameForFile;
  const docCopy = templateFile.makeCopy(copyName, studentFolder);
  const docId = docCopy.getId();
  const doc = DocumentApp.openById(docId);
  const body = doc.getBody();
  const studentName = String(payload.fullName || '').toUpperCase();
  const idPassport = payload.idPassport || '';
  const programmeNameOnly = getProgrammeNameOnly_(payload.programme || '');
  const intakeDisplay = getInternationalIntakePlusFour_(payload.intake || '', submittedAt);

  body.replaceText('{{STUDENT_NAME}}', safeReplace_(studentName));
  body.replaceText('{{IC/PASSPORT}}', safeReplace_(idPassport));
  body.replaceText('{{PROGRAMME_NAME}}', safeReplace_(programmeNameOnly));
  body.replaceText('{{INTAKE}}', safeReplace_(intakeDisplay));

  doc.saveAndClose();

  return {
    docId: docId,
    fileName: copyName,
    docFile: docCopy
  };
}

function createAcceptancePdf_(acceptanceDoc, studentFolder) {
  assertDevOperationsLocked_();
  const pdfBlob = DriveApp.getFileById(acceptanceDoc.docId)
    .getAs(MimeType.PDF)
    .setName(acceptanceDoc.fileName + '.pdf');

  const pdfFile = studentFolder.createFile(pdfBlob);

  return {
    fileId: pdfFile.getId(),
    fileName: pdfFile.getName(),
    url: pdfFile.getUrl(),
    blob: pdfBlob
  };
}

function generateAdmissionFormPdf_(payload, reference, studentFolder, submittedAt, uploadedFiles) {
  assertDevOperationsLocked_();
  const studentNameForFile = toTitleCase_(payload.fullName || 'Applicant').replace(/\s+/g, '_');
  const fileName = 'ADMISSION_FORM_' + studentNameForFile + '.pdf';

  const html = buildAdmissionFormHtml_(payload, reference, submittedAt, uploadedFiles);

  const htmlBlob = Utilities.newBlob(
    html,
    'text/html',
    'admission_form.html'
  );

  const pdfBlob = htmlBlob
    .getAs(MimeType.PDF)
    .setName(fileName);

  const pdfFile = studentFolder.createFile(pdfBlob);

  return {
    fileId: pdfFile.getId(),
    fileName: pdfFile.getName(),
    url: pdfFile.getUrl(),
    blob: pdfBlob
  };
}

function getIucLogoDataUri_() {
  assertDevOperationsLocked_();
  try {
    const file = DriveApp.getFileById(CONFIG.iucLogoFileId);
    const blob = file.getBlob();
    const contentType = blob.getContentType() || 'image/png';
    const base64 = Utilities.base64Encode(blob.getBytes());

    return 'data:' + contentType + ';base64,' + base64;
  } catch (err) {
    Logger.log('Logo load failed: ' + err);
    return '';
  }
}

function buildAdmissionFormHtml_(payload, reference, submittedAt, uploadedFiles) {
  assertDevOperationsLocked_();
  const submittedDisplay = Utilities.formatDate(
    submittedAt || new Date(),
    CONFIG.timezone,
    'dd MMMM yyyy, h:mm a'
  );

  const logoDataUri = getIucLogoDataUri_();
  const checklistRows = buildAdmissionDocumentChecklistRows_(payload, uploadedFiles);
  const programmeNameOnly = getProgrammeNameOnly_(payload.programme || payload.programme);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: A4;
      margin: 12mm 12mm 14mm 12mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      font-size: 10.5px;
      line-height: 1.35;
      background: #ffffff;
    }

    .page-break {
      page-break-before: always;
    }

    .top-header {
      border: 1px solid #d7dce3;
      border-radius: 8px;
      overflow: hidden;
      margin-bottom: 10px;
    }

    .top-band {
      background: #f3f0fb;
      border-bottom: 4px solid #2d2363;
      padding: 14px 16px;
    }

    .header-table {
      width: 100%;
      border-collapse: collapse;
    }

    .header-table td {
      vertical-align: middle;
      border: none;
      padding: 0;
    }

    .logo-cell {
      width: 45%;
    }

    .logo {
      width: 250px;
      max-height: 92px;
      object-fit: contain;
    }

    .fallback-logo {
      color: #2d2363;
      font-size: 26px;
      font-weight: 800;
      line-height: 1.05;
    }

    .contact-cell {
      width: 55%;
      text-align: right;
      color: #111827;
      font-size: 10.5px;
      line-height: 1.45;
    }

    .contact-cell strong {
      color: #2d2363;
    }

    .form-title-wrap {
      text-align: center;
      padding: 13px 16px 12px;
      background: #ffffff;
    }

    .form-title {
      margin: 0;
      color: #111827;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 26px;
      letter-spacing: 1px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .form-subtitle {
      margin-top: 5px;
      color: #6b7280;
      font-size: 10.5px;
    }

    .system-tag {
      display: inline-block;
      margin-top: 8px;
      padding: 4px 10px;
      border-radius: 999px;
      background: #ecfdf5;
      color: #047857;
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: .3px;
      text-transform: uppercase;
    }

    .meta-table,
    .info-table,
    .checklist-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 9px;
    }

    .meta-table th,
    .meta-table td,
    .info-table th,
    .info-table td,
    .checklist-table th,
    .checklist-table td {
      border: 1px solid #d7dce3;
      padding: 6px 8px;
      vertical-align: top;
    }

    .meta-table th {
      width: 18%;
      background: #f3f4f6;
      color: #111827;
      text-align: left;
      font-weight: 700;
    }

    .meta-table td {
      width: 32%;
      background: #ffffff;
    }

    .section-title {
      background: #2d2363;
      color: #ffffff;
      font-family: Georgia, 'Times New Roman', serif;
      font-weight: 700;
      font-size: 14px;
      letter-spacing: .4px;
      padding: 7px 10px;
      margin: 12px 0 0 0;
      border-radius: 6px 6px 0 0;
      text-transform: uppercase;
    }

    .section-title.small-title {
      font-size: 13px;
    }

    .info-table {
      margin-top: 0;
    }

    .section-title {
      page-break-after: avoid;
    }

    .info-table,
    .checklist-table {
      page-break-inside: avoid;
    }

    .info-table tr,
    .checklist-table tr {
      page-break-inside: avoid;
    }
    
    .info-table th {
      background: #f8fafc;
      width: 30%;
      text-align: left;
      font-weight: 700;
      color: #111827;
    }

    .info-table td {
      background: #ffffff;
      color: #111827;
    }

    .two-col {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 3px;
    }

    .two-col td {
      width: 50%;
      vertical-align: top;
      padding: 0;
      border: none;
    }

    .two-col .left {
      padding-right: 5px;
    }

    .two-col .right {
      padding-left: 5px;
    }

    .checklist-table th {
      background: #f3f4f6;
      text-align: left;
      font-weight: 700;
    }

    .checklist-table td {
      background: #ffffff;
    }

    .check {
      text-align: center;
      width: 82px;
      font-size: 14px;
      font-weight: 700;
    }

    .tick {
      color: #047857;
      font-weight: 800;
    }

    .untick {
      color: #9ca3af;
      font-weight: 800;
    }

    .notice-box {
      border: 1px solid #d7dce3;
      border-left: 5px solid #2d2363;
      background: #fafafa;
      padding: 9px 11px;
      margin-bottom: 10px;
    }

    .declaration-box {
      border: 1px solid #d7dce3;
      background: #ffffff;
      padding: 10px 12px;
      margin-bottom: 12px;
    }

    .confirmation-table th {
      width: 28%;
    }

    .page-footer {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #d7dce3;
      color: #6b7280;
      font-size: 8.5px;
      text-align: center;
    }

    .muted {
      color: #6b7280;
    }

    .compact-note {
      color: #4b5563;
      font-size: 9.5px;
      margin: 6px 0 10px;
    }

    .signature-line {
      margin-top: 18px;
      width: 260px;
      border-top: 1px solid #111827;
      padding-top: 5px;
      font-size: 9.5px;
      color: #374151;
    }
  </style>
</head>

<body>
  <div class="top-header">
    <div class="top-band">
      <table class="header-table">
        <tr>
          <td class="logo-cell">
            ${
              logoDataUri
                ? '<img class="logo" src="' + logoDataUri + '">'
                : '<div class="fallback-logo">Innovative<br>University College</div>'
            }
          </td>
          <td class="contact-cell">
            <strong>Innovative University College</strong><br>
            GL 35, Ground Floor, Block C, Kelana Square,<br>
            Jalan SS7/26, Kelana Jaya, 47301 Petaling Jaya,<br>
            Selangor, Malaysia<br>
            <strong>Tel:</strong> +603 2726 2436 &nbsp;&nbsp;
            <strong>Email:</strong> info@innovative.edu.my<br>
            <strong>URL:</strong> www.innovative.edu.my
          </td>
        </tr>
      </table>
    </div>

    <div class="form-title-wrap">
      <h1 class="form-title">Application for Admission</h1>
      <div class="form-subtitle">Institute of Postgraduate Studies - Innovative University College</div>
      <div class="system-tag">System Generated Student Copy</div>
    </div>
  </div>

  <table class="meta-table">
    <tr>
      <th>Application Reference</th>
      <td>${pdfValue_(reference)}</td>
      <th>Submitted Date</th>
      <td>${pdfValue_(submittedDisplay)}</td>
    </tr>
    <tr>
      <th>Submission Method</th>
      <td>IUC Online Admission Form</td>
      <th>Document Type</th>
      <td>Student Copy</td>
    </tr>
  </table>

  <div class="section-title">A. Programme Information</div>
  <table class="info-table">
    ${pdfRow_('Applicant Type', payload.applicantType)}
    ${pdfRow_('Level of Study', payload.levelOfStudy)}
    ${pdfRow_('Intended Programme of Study', programmeNameOnly || payload.programme)}
    ${pdfRow_('Study Mode', payload.studyMode)}
    ${pdfRow_('Intake', payload.intake)}
    ${pdfRow_('Entry Qualification Type', payload.entryQualificationType)}
    ${pdfRow_('Proposed Supervisor', payload.proposedSupervisor)}
    ${pdfRow_('Referral Source', payload.referralSource)}
    ${pdfRow_('Partner / Agent Code', payload.partnerCode)}
  </table>

  <div class="section-title">B. Student Information</div>
  <table class="info-table">
    ${pdfRow_('Full Name', String(payload.fullName || '').toUpperCase())}
    ${pdfRow_('ID / Passport Number', payload.idPassport)}
    ${pdfRow_('Gender', payload.gender)}
    ${pdfRow_('Email Address', payload.email)}
    ${pdfRow_('Phone Number', payload.phoneNumber)}
    ${pdfRow_('Country', payload.country)}
    ${pdfRow_('Full Address', payload.fullAddress)}
    ${pdfRow_('Place of Birth', payload.placeOfBirth)}
    ${pdfRow_('Nationality', payload.nationality)}
    ${pdfRow_('Race', payload.race)}
    ${pdfRow_('Religion', payload.religion)}
    ${pdfRow_('Marital Status', payload.maritalStatus)}
  </table>

  <div class="page-break"></div>

    <div class="section-title">C. Student Profiling</div>
    <table class="info-table">
      ${pdfRow_('Employment Status', payload.employmentStatus)}
      ${pdfRow_('Employment Sector', payload.employmentSector)}
      ${pdfRow_('Monthly Salary Range', payload.salaryRange)}
      ${pdfRow_('Current Profile / Background', payload.nonWorkingCategory)}
    </table>

    <div class="section-title">D. Emergency Contact / Next of Kin</div>
    <table class="info-table">
      ${pdfRow_('Name', payload.emergencyName)}
      ${pdfRow_('Relationship', payload.emergencyRelationship)}
      ${pdfRow_('Phone Number', payload.emergencyPhone)}
      ${pdfRow_('Address', payload.emergencySameAsApplicant ? 'Same as applicant address' : payload.emergencyAddress)}
    </table>

  <div class="section-title">E. Academic Qualification</div>
  <table class="info-table">
    ${pdfRow_('Highest Qualification', payload.highestQualification)}
    ${pdfRow_('Institution / Awarding Body', payload.lastInstitution)}
    ${pdfRow_('Field of Study / Qualification Area', payload.fieldOfStudy)}
    ${pdfRow_('Year of Completion', payload.yearOfCompletion)}
    ${pdfRow_('Result / CGPA / Grade', payload.academicResult)}
    ${pdfRow_('Certificate / Reference No.', payload.certificateReferenceNo)}
  </table>

  <div class="section-title">F. Health & OKU Declaration</div>
  <table class="info-table">
    ${pdfRow_('Health Declaration', payload.healthDeclaration)}
    ${pdfRow_('Health Remarks', payload.healthDeclarationRemarks)}
    ${pdfRow_('OKU / Disability Status', payload.okuStatus)}
    ${pdfRow_('OKU Category', payload.okuCategory)}
    ${pdfRow_('OKU Card Number', payload.okuCardNumber)}
    ${pdfRow_('Support Required', payload.supportRequired)}
  </table>

  <div class="section-title">G. Payment Information</div>
  <table class="info-table">
    ${pdfRow_('Payment Arrangement', payload.paymentArrangement)}
    ${pdfRow_('Installment Frequency', payload.installmentFrequency)}
    ${pdfRow_('Payment Source', payload.paymentSource)}
    ${pdfRow_('Payment Source Other', payload.paymentSourceOther)}
  </table>

  <div class="section-title">H. Document Checklist</div>
  <table class="checklist-table">
    <tr>
      <th style="width:45px;">No.</th>
      <th>Document Required</th>
      <th class="check">Submitted</th>
    </tr>
    ${checklistRows}
  </table>

  <div class="compact-note">
    Note: The checklist above is generated based on the documents requested in the online admission form. Tick marks indicate documents uploaded by the applicant at the time of submission.
  </div>

  <div class="page-break"></div>

  <div class="section-title">I. Applicant Declaration</div>
  <div class="declaration-box">
    I hereby confirm that all information and documents submitted in this application are true, complete, and accurate to the best of my knowledge. I understand that Innovative University College reserves the right to reject, defer, withdraw, or revoke this application or any offer issued if any information or document provided is found to be false, misleading, incomplete, or invalid.
  </div>

  <div class="section-title">J. Data Protection Consent</div>
  <div class="declaration-box">
    I hereby consent to the processing of my personal data by Innovative University College for the purpose of admission, registration, academic administration, student record management, communication, reporting, and other related purposes in accordance with the policies and procedures of Innovative University College.
  </div>

  <div class="section-title">K. Electronic Confirmation</div>
  <table class="info-table confirmation-table">
    ${pdfRow_('Declaration Status', payload.declarationAccepted ? 'Confirmed' : 'Not Confirmed')}
    ${pdfRow_('Submitted Via', 'IUC Online Admission Form')}
    ${pdfRow_('Applicant Name', String(payload.fullName || '').toUpperCase())}
    ${pdfRow_('NRIC / Passport No.', payload.idPassport)}
    ${pdfRow_('Email Used for Submission', payload.capturedEmail || payload.email)}
    ${pdfRow_('Submission Date & Time', submittedDisplay)}
    ${pdfRow_('Application Reference No.', reference)}
  </table>

  <div class="notice-box">
    This application was submitted electronically through the official IUC Online Admission Form. The applicant confirmed the declaration by selecting the declaration checkbox before submission. No physical signature is required for this system-generated admission form.
  </div>

  <div class="signature-line">
    System-generated confirmation
  </div>

  <div class="page-footer">
    System-generated admission form - Institute of Postgraduate Studies, Innovative University College
  </div>
</body>
</html>
`;
}

function buildAdmissionDocumentChecklistRows_(payload, uploadedFiles) {
  assertDevOperationsLocked_();
  const uploadedMap = {};

  (uploadedFiles || []).forEach(function (file) {
    uploadedMap[file.field] = true;
  });

  const entryType = String(payload.entryQualificationType || '');
  const isInternationalStudent = payload.applicantType === 'International (Non-Malaysian Citizen)';
  const items = [];

  items.push({
    key: 'identityDocument',
    label: isInternationalStudent
      ? 'Identity Document / National ID, if available'
      : 'Identity Document / NRIC / Passport'
  });

  items.push({
    key: 'passportPhoto',
    label: 'Passport Size Photo'
  });

  if (isInternationalStudent) {
    items.push({
      key: 'passportCopyInternational',
      label: 'Passport Copy'
    });
  }

  if (entryType === 'APEL') {
    items.push({
      key: 'apelCertificate',
      label: 'APEL Certificate'
    });
  }

  if (entryType === 'Academic Qualification') {
    items.push({
      key: 'transcript',
      label: 'Highest Academic Transcript'
    });

    items.push({
      key: 'certificate',
      label: 'Highest Academic Certificate'
    });
  }

  if (entryType === 'SKM / TVET / Skills Qualification') {
    items.push({
      key: 'certificate',
      label: 'Relevant Skills Certificate'
    });
  }

  items.push({
    key: 'cvResume',
    label: 'Curriculum Vitae (CV) / Resume'
  });

  items.push({
    key: 'otherSupportingDocument',
    label: 'Other Supporting Document'
  });

  items.push({
    key: 'englishCertificate',
    label: 'English Language Proficiency Certificate'
  });

  if (isInternationalStudent) {
    items.push({
      key: 'completedAdmissionForm',
      label: 'Completed Admission Form'
    });

    items.push({
      key: 'completedHealthDeclaration',
      label: 'Completed Health Declaration Form'
    });

    items.push({
      key: 'emgsPaymentReceipt',
      label: 'EMGS / Visa Related Payment Receipt'
    });
  }

  return items.map(function (item, index) {
    const tick = uploadedMap[item.key]
    ? '<span class="tick">&#9745;</span>'
    : '<span class="untick">&#9744;</span>';

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${pdfValue_(item.label)}</td>
        <td class="check">${tick}</td>
      </tr>
    `;
  }).join('');
}

function pdfRow_(label, value) {
  assertDevOperationsLocked_();
  return `
    <tr>
      <th>${pdfValue_(label)}</th>
      <td>${pdfMultilineValue_(value)}</td>
    </tr>
  `;
}

function pdfValue_(value) {
  assertDevOperationsLocked_();
  const text = String(value === null || value === undefined ? '' : value).trim();
  return text ? escapeForPdfHtml_(text) : '-';
}

function pdfMultilineValue_(value) {
  assertDevOperationsLocked_();
  const text = String(value === null || value === undefined ? '' : value).trim();

  if (!text) {
    return '-';
  }

  return escapeForPdfHtml_(text).replace(/\n/g, '<br>');
}

function escapeForPdfHtml_(value) {
  assertDevOperationsLocked_();
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeReplace_(text) {
  assertDevOperationsLocked_();
  return String(text || '').replace(/\$/g, '$$$$');
}

function toTitleCase_(text) {
  assertDevOperationsLocked_();
  return String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function formatAddressForLetter_(address) {
  assertDevOperationsLocked_();
  return String(address || '')
    .split(',')
    .map(function (part) {
      return toTitleCase_(String(part || '').trim());
    })
    .filter(Boolean)
    .join('\n');
}

function getProgrammeNameOnly_(programme) {
  assertDevOperationsLocked_();
  const value = String(programme || '').trim();
  if (!value) return '';
  const parts = value.split(' - ');
  return parts.length > 1 ? parts.slice(1).join(' - ').trim() : value;
}

function getStudyDuration_(levelOfStudy, programme) {
  assertDevOperationsLocked_();
  const level = String(levelOfStudy || '').toLowerCase();
  const programmeText = String(programme || '').toLowerCase();

  if (level === 'master') return '1 year (12 months)';
  if (level === 'doctorate') return '3 years (36 months)';
  if (programmeText.includes('phd')) return '3 years (36 months)';
  return '1 year (12 months)';
}

function getInternationalIntakePlusFour_(monthlyIntake, submittedAt) {
  assertDevOperationsLocked_();
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const input = String(monthlyIntake || '').trim().toLowerCase();
  const currentIndex = months.findIndex(function (m) {
    return m.toLowerCase() === input;
  });

  if (currentIndex === -1) return '';

  const targetIndex = (currentIndex + 4) % 12;
  let year = Number(Utilities.formatDate(submittedAt || new Date(), CONFIG.timezone, 'yyyy'));

  if (currentIndex + 4 >= 12) {
    year += 1;
  }

  return months[targetIndex] + ' ' + year;
}

function getAgentByCode_(agentCode) {
  assertDevOperationsLocked_();
  const code = String(agentCode || '').trim().toUpperCase();
  if (!code) return null;

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.agentMasterSheetName);
  if (!sheet) return null;

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;

  const headers = values[0];
  const rows = values.slice(1);
  const idxCode = headers.indexOf('Agent Code');
  const idxName = headers.indexOf('Agent Name');
  const idxOrg = headers.indexOf('Organisation');
  const idxEmail = headers.indexOf('Agent Email');
  const idxActive = headers.indexOf('Active');
  const idxPicType = headers.indexOf('PIC Type');

  if (idxCode === -1 || idxEmail === -1) return null;

  for (var i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowCode = String(row[idxCode] || '').trim().toUpperCase();
    const active = String(row[idxActive] || '').trim().toLowerCase();

    if (rowCode === code && active === 'active') {
      return {
        code: row[idxCode] || '',
        name: idxName > -1 ? row[idxName] || '' : '',
        organisation: idxOrg > -1 ? row[idxOrg] || '' : '',
        email: row[idxEmail] || '',
        picType: idxPicType > -1 ? row[idxPicType] || '' : ''
      };
    }
  }

  return null;
}

function getNotificationRecipients_(payload) {
  assertDevOperationsLocked_();
  const recipients = [];
  const agent = getAgentByCode_(payload.partnerCode || '');

  recipients.push(...getConfigEmails_('DEFAULT_NOTIFICATION_EMAIL'));

  if (payload.applicantType === 'International (Non-Malaysian Citizen)') {
    recipients.push(...getConfigEmails_('ISO_NOTIFICATION_EMAIL'));
  }

  const uniqueRecipients = recipients
    .map(function (email) {
      return String(email || '').trim().toLowerCase();
    })
    .filter(Boolean)
    .filter(function (email, index, arr) {
      return arr.indexOf(email) === index;
    });

  return {
    emails: uniqueRecipients,
    agent: agent
  };
}

function appendEpfTracking_(payload, reference, submittedAt, studentFolder) {
  assertDevOperationsLocked_();
  if (payload.paymentSource !== 'EPF Withdrawal (KWSP)') return;

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.epfTrackingSheetName);
  if (!sheet) return;

  const row = [
    Utilities.formatDate(submittedAt, CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss'),
    reference,
    payload.fullName || '',
    payload.idPassport || '',
    payload.programme || '',
    payload.intake || '',
    payload.email || '',
    payload.phoneNumber || '',
    payload.paymentSource || '',
    studentFolder.getUrl(),
    'New',
    'Luqman'
  ];

  sheet.appendRow(row);
}

function getActiveAgentCodes() {
  assertDevOperationsLocked_();
  const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId)
    .getSheetByName(CONFIG.agentMasterSheetName);

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  const idx = {
    code: headers.indexOf("Agent Code"),
    name: headers.indexOf("Agent Name"),
    org: headers.indexOf("Organisation"),
    email: headers.indexOf("Agent Email"),
    active: headers.indexOf("Active")
  };

  return data
    .filter(row => String(row[idx.active]).toLowerCase() === "active")
    .map(row => ({
      code: row[idx.code],
      name: row[idx.name],
      organisation: row[idx.org],
      email: row[idx.email]
    }));
}

function buildProspectUpdateLink_(payload, reference) {
  return v2CreateAgentActionLink_(payload, reference);
}

function sendAgentProspectEmail_(payload, reference, studentFolder) {
  assertDevOperationsLocked_();
  const recipient = getProspectActionRecipient_(payload);
  if (!recipient) return;

  const agent = getAgentByCode_(payload.partnerCode || '');
  const prospectUpdateLink = buildProspectUpdateLink_(payload, reference);

  const subject = "[IUC Admission] New Application Received - Please update prospect - " + reference;

  const body = `
NEW STUDENT APPLICATION RECEIVED

ACTION REQUIRED:
Please create Prospect in SKY using the information below.

==================================================
PERSONAL INFORMATION
==================================================

International:
${payload.applicantType === "International (Non-Malaysian Citizen)" ? "Yes" : "No"}

ID Type:
${payload.applicantType === "International (Non-Malaysian Citizen)" ? "Passport" : "MyKad"}

ID No:
${payload.idPassport || "-"}

Name:
${payload.fullName || "-"}

Gender:
${payload.gender || "-"}

Email:
${payload.email || "-"}

Phone:
${payload.phoneNumber || "-"}

Nationality:
${payload.nationality || "-"}

Race:
${payload.race || "-"}

Religion:
${payload.religion || "-"}

==================================================
ADDRESS
==================================================

Address:
${toTitleCase_(payload.fullAddress || "-")}

==================================================
PROGRAM
==================================================

Intake:
${getMainIntakeWithYear_(payload.intake || "-", new Date())}

Programme:
${payload.programme || "-"}

==================================================

AFTER CREATING PROSPECT IN SKY,
PLEASE UPDATE FEE GROUP HERE:

${prospectUpdateLink}

==================================================

Reference No:
${reference}

Student Folder:
${studentFolder.getUrl()}

Assigned Agent:
${agent ? agent.name || "-" : "-"}

Agent Organisation:
${agent ? agent.organisation || "-" : "-"}

Thank you.
`;

  try {
    blockedDevSendEmail_({
      to: recipient,
      subject: subject,
      body: body
    });
  } catch (err) {
    Logger.log("Prospect action email failed: " + err);
  }
}

function getProspectActionRecipient_(payload) {
  assertDevOperationsLocked_();
  const referralSource = String(payload.referralSource || '').trim();

  if (referralSource === 'Education Consultant') {
    const agent = getAgentByCode_(payload.partnerCode || '');
    return agent && agent.email ? agent.email : CONFIG.defaultNotificationEmail;
  }

  if (referralSource === 'Innovative Staff') {
    return payload.capturedEmail || payload.email || CONFIG.defaultNotificationEmail;
  }

  return CONFIG.defaultNotificationEmail;
}

function testDriveAccess() {
  assertDevOperationsLocked_();
  DriveApp.getFolderById(CONFIG.rootFolderId);
  DriveApp.getFileById(CONFIG.colTemplateId);
  DriveApp.getFileById(CONFIG.acceptanceTemplateId);
  DriveApp.getFileById(CONFIG.internationalColTemplateId);
  Logger.log("Drive access OK");
}

function testRootFolderOnly() {
  assertDevOperationsLocked_();
  const folder = DriveApp.getFolderById(CONFIG.rootFolderId);
  Logger.log(folder.getName());
}

function testEachFile() {
  assertDevOperationsLocked_();
  try {
    const col = DriveApp.getFileById(CONFIG.colTemplateId);
    Logger.log("COL OK: " + col.getName());
  } catch(e) {
    Logger.log("COL ERROR: " + e);
  }

  try {
    const acc = DriveApp.getFileById(CONFIG.acceptanceTemplateId);
    Logger.log("ACCEPTANCE OK: " + acc.getName());
  } catch(e) {
    Logger.log("ACCEPTANCE ERROR: " + e);
  }

  try {
    const intl = DriveApp.getFileById(CONFIG.internationalColTemplateId);
    Logger.log("INTL OK: " + intl.getName());
  } catch(e) {
    Logger.log("INTL ERROR: " + e);
  }
}

function sendEpfNotificationEmail_(payload, reference, studentFolder) {
  assertDevOperationsLocked_();
  if (payload.paymentSource !== 'EPF Withdrawal (KWSP)') return;

  const subject = '[EPF ACTION REQUIRED] New EPF Application - ' + reference;

  const body = `
NEW EPF / KWSP APPLICATION REQUEST

Dear Bursar Team,

A new student has selected EPF Withdrawal (KWSP) as the payment source.

Please proceed with the EPF application process based on the details below.

==================================================
STUDENT INFORMATION
==================================================

Reference No:
${reference}

Name:
${payload.fullName || '-'}

IC / Passport No:
${payload.idPassport || '-'}

Programme:
${payload.programme || '-'}

Intake:
${payload.intake || '-'}

Email:
${payload.email || '-'}

Phone:
${payload.phoneNumber || '-'}

==================================================
PAYMENT INFORMATION
==================================================

Payment Source:
${payload.paymentSource || '-'}

Payment Arrangement:
${payload.paymentArrangement || '-'}

Installment Frequency:
${payload.installmentFrequency || '-'}

==================================================
STUDENT DOCUMENT FOLDER
==================================================

${studentFolder.getUrl()}

==================================================

Action required:
Please review the student's documents and proceed with the EPF / KWSP application preparation.

Thank you.
`;

  try {
    blockedDevSendEmail_({
      to: getConfigEmails_('EPF_NOTIFICATION_EMAIL').join(','),
      subject: subject,
      body: body
    });
  } catch (err) {
    Logger.log('EPF notification email failed: ' + err);
  }
}

function onProspectUpdateSubmit(e) {
  assertDevOperationsLocked_();
  const response = e.namedValues || {};

  Logger.log(JSON.stringify(response));

  const referenceNo = getFormValue_(response, 'Reference No');
  const studentName = getFormValue_(response, 'Student Name');
  const programme = getFormValue_(response, 'Programme');
  const partnerCode = getFormValue_(response, 'Partner Code');
  const feeGroup = getFormValue_(response, 'Fee Group');
  const remarks = getFormValue_(response, 'Remarks (optional)');

  Logger.log('Reference from form: ' + referenceNo);

  if (!referenceNo) {
    Logger.log('No reference number found.');
    return;
  }

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.sheetName);
  if (!sheet) {
    Logger.log('ADMISSION_RESPONSE sheet not found.');
    return;
  }

  ensureAdmissionResponseColumns_(sheet, [
    'Prospect Status',
    'Fee Group',
    'Prospect Updated At',
    'Prospect Remarks'
  ]);

  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const idxRef = headers.indexOf('Reference No');
  const idxStatus = headers.indexOf('Prospect Status');
  const idxFeeGroup = headers.indexOf('Fee Group');
  const idxUpdatedAt = headers.indexOf('Prospect Updated At');
  const idxRemarks = headers.indexOf('Prospect Remarks');

  if (idxRef === -1) {
    Logger.log('Reference No column not found in ADMISSION_RESPONSE.');
    return;
  }

  const cleanRef = String(referenceNo).trim();

  for (let i = 1; i < data.length; i++) {
    const rowRef = String(data[i][idxRef] || '').trim();

    if (rowRef === cleanRef) {
      const rowNumber = i + 1;
      const updatedAt = Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss');

      sheet.getRange(rowNumber, idxStatus + 1).setValue('Prospect Updated');
      sheet.getRange(rowNumber, idxFeeGroup + 1).setValue(feeGroup || '-');
      sheet.getRange(rowNumber, idxUpdatedAt + 1).setValue(updatedAt);
      sheet.getRange(rowNumber, idxRemarks + 1).setValue(remarks || '');

      sendRegistryProspectUpdateEmail_({
        referenceNo,
        studentName,
        programme,
        partnerCode,
        feeGroup,
        remarks,
        updatedAt
      });

      Logger.log('Updated ADMISSION_RESPONSE row: ' + rowNumber);
      return;
    }
  }

  Logger.log('No matching reference found in ADMISSION_RESPONSE: ' + cleanRef);
}

function sendRegistryProspectUpdateEmail_(data) {
  assertDevOperationsLocked_();
  const recipients = getConfigEmails_('REGISTRY_NOTIFICATION_EMAILS');
  if (!recipients.length) return;

  const subject = '[REGISTRY ACTION] Prospect Fee Group Updated - ' + data.referenceNo;

  const body = `
PROSPECT UPDATE COMPLETED

The prospect has been created/updated by agent or staff.

==================================================
STUDENT INFORMATION
==================================================

Reference No:
${data.referenceNo || '-'}

Student Name:
${data.studentName || '-'}

Programme:
${data.programme || '-'}

Partner Code:
${data.partnerCode || '-'}

==================================================
FEE GROUP
==================================================

Fee Group:
${data.feeGroup || '-'}

Updated At:
${data.updatedAt || '-'}

Remarks:
${data.remarks || '-'}

==================================================

Action required:
Registry may proceed with student registration using the fee group above.

Thank you.
`;

  blockedDevSendEmail_({
    to: recipients.join(','),
    subject: subject,
    body: body
  });
}

function getFormValue_(namedValues, key) {
  assertDevOperationsLocked_();
  const targetKey = String(key || '').trim().toLowerCase();

  for (const actualKey in namedValues) {
    if (String(actualKey || '').trim().toLowerCase() === targetKey) {
      const value = namedValues[actualKey];
      return Array.isArray(value)
        ? String(value[0] || '').trim()
        : String(value || '').trim();
    }
  }

  return '';
}

function ensureAdmissionResponseColumns_(sheet, columnNames) {
  assertDevOperationsLocked_();
  if (!sheet) return;

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  columnNames.forEach(function (name) {
    const headers = sheet
      .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
      .getValues()[0]
      .map(function (h) {
        return String(h || '').trim();
      });

    if (headers.indexOf(name) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(name);
    }
  });

  styleAdmissionHeaderRow_(sheet);
}

function getConfigEmails_(key) {
  assertDevOperationsLocked_();
  const sheet = SpreadsheetApp.openById(CONFIG.spreadsheetId)
    .getSheetByName('CONTROL_PANEL');

  const data = sheet.getDataRange().getValues();

  for (let i = 0; i < data.length; i++) {
    if (data[i][0] === key) {
      return String(data[i][1] || '')
        .split(',')           // pecahkan ikut comma
        .map(e => e.trim())  // buang space
        .filter(Boolean);    // buang kosong
    }
  }

  return [];
}

function testRegistryEmailConfig() {
  assertDevOperationsLocked_();
  Logger.log(getConfigEmails_('REGISTRY_NOTIFICATION_EMAILS'));
}

function testProspectUpdateFromLastRow() {
  assertDevOperationsLocked_();
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName('PROSPECT & FEE GROUP');
  const lastRow = sheet.getLastRow();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = sheet.getRange(lastRow, 1, 1, sheet.getLastColumn()).getValues()[0];

  const namedValues = {};
  headers.forEach((h, i) => namedValues[h] = [values[i]]);

  onProspectUpdateSubmit({ namedValues });
}

function login() {
  assertDevOperationsLocked_();
  STAFF_NAME = document.getElementById('staffName').value || 'Staff';

  google.script.run
    .withSuccessHandler(function(response) {
      if (!response.success) {
        document.getElementById('loginMessage').innerText = response.message;
        return;
      }

      applications = response.applications;
      document.getElementById('loginBox').classList.add('hidden');
      document.getElementById('dashboard').classList.remove('hidden');
      renderTable();
    })
    .getApplications();
}

function updateApplication(payload) {
  assertDevOperationsLocked_();
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.sheetName);

  if (!sheet) {
    return {
      success: false,
      message: 'Sheet not found: ' + CONFIG.sheetName
    };
  }

  ensureAdmissionResponseHeaders_(sheet);

  const row = Number(payload.rowNumber);

  if (!row || row < 2) {
    return {
      success: false,
      message: 'Invalid row number.'
    };
  }

  const updatedAt = Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyy-MM-dd HH:mm:ss');

  setRowValuesByHeader_(sheet, row, {
    'Application Status': payload.applicationStatus || '',
    'Qualification Status': payload.qualificationStatus || '',
    'Document Check Status': payload.documentCheckStatus || '',
    'Orientation Status': payload.orientationStatus || '',
    'SAC Date': payload.sacDate || '',
    'SAC Sitting': payload.sacSitting || '',
    'Admin Remarks': payload.adminRemarks || '',

    'Offer Letter Status': payload.offerLetterStatus || '',
    'COL Issued At': payload.offerLetterIssuedAt || '',
    'Offer Letter Remarks': payload.offerLetterRemarks || '',

    'Acceptance Status': payload.acceptanceStatus || '',
    'Acceptance Received At': payload.acceptanceReceivedAt || '',
    'Acceptance Remarks': payload.acceptanceRemarks || '',

    'Sky Document Upload Status': payload.skyDocumentUploadStatus || '',
    'Sky Uploaded At': payload.skyUploadedAt || '',
    'Sky Upload PIC': payload.skyUploadPic || '',
    'Sky Document Remarks': payload.skyDocumentRemarks || '',

    'Last Updated': updatedAt,
    'Updated By': payload.updatedBy || 'Admin Portal'
  });

  return {
    success: true,
    message: 'Application updated successfully.',
    updatedAt: updatedAt
  };
}

function setRowValuesByHeader_(sheet, rowNumber, valuesByHeader) {
  assertDevOperationsLocked_();
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getValues()[0]
    .map(function (h) {
      return String(h || '').trim();
    });

  Object.keys(valuesByHeader).forEach(function (headerName) {
    const colIndex = headers.indexOf(headerName);

    if (colIndex !== -1) {
      sheet.getRange(rowNumber, colIndex + 1).setValue(valuesByHeader[headerName]);
    }
  });
}

function getApplications() {
  assertDevOperationsLocked_();
  try {
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
    const sheet = ss.getSheetByName(CONFIG.sheetName);

    if (!sheet) {
      return {
        success: false,
        message: 'Sheet not found: ' + CONFIG.sheetName
      };
    }

    ensureAdmissionResponseHeaders_(sheet);

    const data = sheet.getDataRange().getDisplayValues();

    if (!data || data.length < 2) {
      return {
        success: true,
        applications: []
      };
    }

    const headers = data[0];
    const rows = data.slice(1);

    const applications = rows
      .filter(row => row.join('').trim() !== '')
      .map((row, index) => {
        let item = {};

        headers.forEach((header, i) => {
          item[String(header).trim()] = row[i] || '';
        });

        item.rowNumber = index + 2;
        return item;
      });

    return {
      success: true,
      applications: applications
    };

  } catch (err) {
    return {
      success: false,
      message: err.message || String(err)
    };
  }
}

function copyValue(value) {
  assertDevOperationsLocked_();
  navigator.clipboard.writeText(value || '').then(function () {
    document.getElementById('copyMessage').innerText = 'Copied: ' + value;
  });
}

function testEnsureAdmissionHeaders() {
  assertDevOperationsLocked_();
  const sheet = getOrCreateSheet_();
  ensureAdmissionResponseHeaders_(sheet);

  Logger.log('Admission headers checked and updated successfully.');
}

function verifyAdminApiAccess_(token) {
  assertDevOperationsLocked_();
  const expected = String(CONFIG.adminApiPassword || '').trim();
  const received = String(token || '').trim();

  if (!expected) {
    throw new Error('Admin API password is not configured in CONFIG.adminApiPassword.');
  }

  if (!received || received !== expected) {
    throw new Error('Invalid admin password.');
  }

  return true;
}

function getApplicationsForAdminApi_(params) {
  assertDevOperationsLocked_();
  try {
    verifyAdminApiAccess_(params.token);

    const result = getApplications();

    return {
      ok: true,
      success: true,
      applications: result && result.applications ? result.applications : [],
      message: 'Applications loaded successfully.'
    };

  } catch (error) {
    return {
      ok: false,
      success: false,
      message: error && error.message ? error.message : String(error)
    };
  }
}

function updateApplicationFromAdminApi_(payload) {
  assertDevOperationsLocked_();
  try {
    verifyAdminApiAccess_(payload.token);

    const data = payload.data || {};

    const result = updateApplication(data);

    return {
      ok: !!(result && result.success),
      success: !!(result && result.success),
      message: result && result.message ? result.message : 'Application updated.',
      updatedAt: result && result.updatedAt ? result.updatedAt : ''
    };

  } catch (error) {
    return {
      ok: false,
      success: false,
      message: error && error.message ? error.message : String(error)
    };
  }
}

function setupOfficialLoaPhase2() {
  assertDevOperationsLocked_();
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);

  // 1. Ensure ADMISSION_RESPONSE headers
  const admissionSheet = getOrCreateSheet_();
  ensureAdmissionResponseHeaders_(admissionSheet);

  // 2. Create / prepare FEE_GROUP_MASTER
  let feeSheet = ss.getSheetByName(CONFIG.feeGroupMasterSheetName);

  if (!feeSheet) {
    feeSheet = ss.insertSheet(CONFIG.feeGroupMasterSheetName);
  }

  if (feeSheet.getLastRow() === 0) {
    feeSheet.getRange(1, 1, 1, 2).setValues([[
      'Fee Group Code',
      'File ID PDF'
    ]]);
  } else {
    const headers = feeSheet
      .getRange(1, 1, 1, Math.max(feeSheet.getLastColumn(), 2))
      .getValues()[0]
      .map(function (h) {
        return String(h || '').trim();
      });

    if (headers.indexOf('Fee Group Code') === -1) {
      feeSheet.getRange(1, feeSheet.getLastColumn() + 1).setValue('Fee Group Code');
    }

    if (headers.indexOf('File ID PDF') === -1) {
      feeSheet.getRange(1, feeSheet.getLastColumn() + 1).setValue('File ID PDF');
    }
  }

  feeSheet.setFrozenRows(1);
  feeSheet
    .getRange(1, 1, 1, feeSheet.getLastColumn())
    .setFontWeight('bold')
    .setBackground('#2d2363')
    .setFontColor('#ffffff')
    .setWrap(true);

  Logger.log('Official LOA Phase 2 setup completed.');
}

function testAddAcademicHealthOkuHeadersOnly() {
  assertDevOperationsLocked_();
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.sheetName);

  if (!sheet) {
    throw new Error('Sheet not found: ' + CONFIG.sheetName);
  }

  const requiredHeaders = [
    'Highest Qualification',
    'Last Institution / Awarding Body',
    'Field of Study / Qualification Area',
    'Year of Completion',
    'Academic Result / CGPA / Grade',
    'Certificate / Reference No.',
    'Health Declaration',
    'Health Declaration Remarks',
    'OKU Status',
    'OKU Category',
    'OKU Card Number',
    'Support Required'
  ];

  const lastColumn = Math.max(sheet.getLastColumn(), 1);

  const existingHeaders = sheet
    .getRange(1, 1, 1, lastColumn)
    .getValues()[0]
    .map(function (h) {
      return String(h || '').trim();
    });

  requiredHeaders.forEach(function (headerName) {
    if (existingHeaders.indexOf(headerName) === -1) {
      const newColumn = sheet.getLastColumn() + 1;
      sheet.getRange(1, newColumn).setValue(headerName);
      existingHeaders.push(headerName);
    }
  });

  Logger.log('Academic, Health and OKU headers checked successfully.');
}

function assertDevIdentity_() {
  if (ScriptApp.getScriptId() !== '1MhvRLN2s336ndaFwLzQpGNSMEgafXxj_I5NIS8D9ZzyG3NGujHwXdih3') {
    throw new Error('DEV_IDENTITY_MISMATCH: This file is for the confirmed V2 project only.');
  }
  if (CONFIG.spreadsheetId !== '1O-Y-q7_q78xKM1p5e2C3EWyQfYr5rXvhO0oWbVaw5Mw' ||
      CONFIG.rootFolderId !== '1DjGzCloTBLUbP84vLfV5xjkxuWf-Zxd1') {
    throw new Error('DEV_RESOURCE_MISMATCH: Development resource IDs changed.');
  }
}

function assertDevOperationsLocked_() {
  assertDevIdentity_();

  // Allow legacy rendering helpers ONLY while
  // Admission V2 is generating the branded Admission Form PDF.
  if (
    typeof V2_BRANDED_RENDER_CONTEXT !== 'undefined' &&
    V2_BRANDED_RENDER_CONTEXT === true
  ) {
    return true;
  }

  throw new Error(
    'DEV_LOCKED: Admission, data updates and email are disabled. Run only devSafetyPreflight.'
  );
}

function blockedDevSendEmail_() {
  throw new Error('DEV_EMAIL_BLOCKED: No email is sent by this safety baseline.');
}

/** Read-only check. Does not create files, edit cells, send mail or install triggers.
 * Google may request authorization for services used elsewhere in this project.
 * A successful result does NOT mean the admission workflow has been tested.
 */
function devSafetyPreflight() {
  assertDevIdentity_();
  const database = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const root = DriveApp.getFolderById(CONFIG.rootFolderId);
  const report = {
    build: CONFIG.buildVersion,
    identity: 'V2_MATCH',
    databaseAccessible: database.getId() === CONFIG.spreadsheetId,
    admissionSheetExists: !!database.getSheetByName(CONFIG.sheetName),
    folderAccessible: root.getId() === CONFIG.rootFolderId,
    operations: 'LOCKED',
    email: 'BLOCKED',
    workflowReady: false
  };
  Logger.log(JSON.stringify(report));
  return report;
}

function v2TestPublicSubmissionEndpoint() {
  const url =
    'https://script.google.com/macros/s/AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB/exec';

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone,
    'yyyyMMdd-HHmmss'
  );

  const payload = {
    action: 'v2SubmitAdmission',
    data: {
      applicantType: 'Local (Malaysian Citizen)',
      levelOfStudy: 'Master',
      programme: 'MBA - Master of Business Administration',
      intake: 'SEPTEMBER 2026',
      studyMode: 'Online',
      entryQualificationType: 'Normal Entry',

      fullName: 'PUBLIC ENDPOINT TEST ' + stamp,
      idPassport: 'HTTP-' + stamp,
      email: 'adiybukhori@innovative.edu.my',
      phoneNumber: 'TEST-NO-PHONE',

      highestQualification: 'Bachelor Degree',
      lastInstitution: 'IUC Test Environment',
      fieldOfStudy: 'Business Administration',
      yearOfCompletion: '2026',
      academicResult: '3.00',

      isTransferApplicant: false,
      referralSource: 'Direct Application',
      partnerCode: '',
      declarationAccepted: true,
      documents: {}
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'text/plain;charset=utf-8',
    payload: JSON.stringify(payload),
    followRedirects: true,
    muteHttpExceptions: true
  });

  const report = {
    httpCode: response.getResponseCode(),
    response: response.getContentText()
  };

  Logger.log(JSON.stringify(report));
  return report;
}
