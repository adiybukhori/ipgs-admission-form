/**
 * IUC IPGS Admission V2 - isolated public submission pipeline.
 * Production V1 functions remain locked. Email is disabled unless a Script
 * Property explicitly enables TEST or LIVE mode.
 */

const V2_ADMISSION_BUILD = 'ADMISSION_V2_MODULE1_20260908';
const V2_MAX_DOCUMENT_BYTES = 7 * 1024 * 1024;
let V2_BRANDED_RENDER_CONTEXT = false;
const V2_ALLOWED_MIME_TYPES = Object.freeze([
  'application/pdf','image/jpeg','image/png'
]);

function submitAdmissionFormV2(payload) {
  return v2SubmitAdmission_(payload || {});
}

function v2SubmitAdmission_(payload) {
  assertDevIdentity_();
  if (!v2FoundationReady_()) throw new Error('V2 foundation is not ready.');
  v2ValidateAdmissionPayload_(payload);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    v2AssertNoDuplicateApplication_(payload);
    const submittedAt = new Date();
    const reference = v2GenerateAdmissionReference_(payload, submittedAt);
    const intake = v2ResolveIntake_(payload.intake, submittedAt);
    const agent = v2ResolveAgent_(payload.partnerCode);
    const root = DriveApp.getFolderById(CONFIG.rootFolderId);
    const studentFolder = v2CreateStudentFolder_(root, payload, intake);
    const uploadedFiles = v2SaveAdmissionDocuments_(studentFolder, payload);
    const pdf = v2GenerateAdmissionPdf_(studentFolder, payload, reference, intake, submittedAt, uploadedFiles);
    const row = v2SaveApplicationRecord_(payload, reference, intake, submittedAt, studentFolder, uploadedFiles, pdf, agent, 'PENDING');
    v2StartWorkflowForApplication_(row);
    let emailStatus = 'DISABLED';
    try {
      emailStatus = v2SendSubmissionAcknowledgements_(payload, reference, intake, pdf, agent);
    } catch (emailError) {
      emailStatus = 'FAILED: ' + String(emailError && emailError.message || emailError);
      Logger.log('V2 acknowledgement email failed: ' + emailStatus);
    }
    const savedApplication = v2Find_('V2_APPLICATIONS','Reference No',reference);
    if (savedApplication) {
      v2UpdateRow_(savedApplication.sheet,savedApplication.rowNumber,{
        'Email Status':emailStatus,'Last Updated':new Date().toISOString()
      });
    }
    v2Audit_(reference, 'ADMISSION', 'V2_APPLICATION_SUBMITTED', {}, {
      intakeId:intake.id, programme:payload.programme, emailStatus:emailStatus
    }, 'Applicant', 'SUCCESS', 'Admission PDF only. No COL or Offer Letter generated.');
    v2InvalidateCache_();
    return {
      ok:true,
      success:true,
      build:V2_ADMISSION_BUILD,
      reference:reference,
      intakeId:intake.id,
      folderUrl:studentFolder.getUrl(),
      admissionFormPdfUrl:pdf.url,
      emailStatus:emailStatus,
      colGenerated:false,
      offerLetterGenerated:false,
      message:'Application submitted successfully and is pending review.'
    };
  } finally {
    lock.releaseLock();
  }
}

function v2ValidateAdmissionPayload_(payload) {
  const required = {
    applicantType:'Applicant Type', levelOfStudy:'Level of Study', programme:'Programme',
    intake:'Intake', studyMode:'Mode of Study', entryQualificationType:'Entry Qualification Type',
    fullName:'Full Name', idPassport:'ID / Passport No', email:'Email', phoneNumber:'Phone Number',
    highestQualification:'Highest Qualification', lastInstitution:'Institution / Awarding Body',
    fieldOfStudy:'Field of Study', yearOfCompletion:'Year of Completion'
  };
  Object.keys(required).forEach(function(key) {
    if (!String(payload[key] || '').trim()) throw new Error(required[key] + ' is required.');
  });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email || '').trim())) {
    throw new Error('A valid personal email is required.');
  }
  if (!payload.declarationAccepted) throw new Error('Declaration must be accepted.');
  if (payload.referralSource === 'Education Consultant' && !v2ResolveAgent_(payload.partnerCode)) {
    throw new Error('Select a valid registered partner / agent code.');
  }
  if (v2IsPhdProgramme_(payload.programme)) {
    const intent = payload.documents && payload.documents.preliminaryResearchIntent;
    if (!intent || !intent.base64) throw new Error('Preliminary Research Intent is required for PhD applicants.');
  }
  const documents = payload.documents || {};
  Object.keys(documents).forEach(function(key) {
    const doc = documents[key];
    if (!doc || !doc.base64) return;
    const size = Number(doc.size || 0);
    if (size < 1 || size > V2_MAX_DOCUMENT_BYTES) throw new Error('Invalid document size for ' + key + '.');
    if (V2_ALLOWED_MIME_TYPES.indexOf(String(doc.mimeType || '')) < 0) {
      throw new Error('Unsupported document type for ' + key + '.');
    }
  });
}

function v2AssertNoDuplicateApplication_(payload) {
  const id = String(payload.idPassport || '').trim().toUpperCase();
  const programme = String(payload.programme || '').trim().toUpperCase();
  const intake = v2ResolveIntake_(payload.intake, new Date()).id;
  const duplicate = v2Rows_('V2_APPLICATIONS').some(function(row) {
    return String(row['ID / Passport No'] || '').trim().toUpperCase() === id &&
      String(row['Programme'] || '').trim().toUpperCase() === programme &&
      String(row['Intake ID'] || '').trim().toUpperCase() === intake &&
      String(row['Application Status'] || '').toUpperCase() !== 'WITHDRAWN';
  });
  if (duplicate) throw new Error('An application already exists for this ID, programme and intake.');
}

function v2GenerateAdmissionReference_(payload, submittedAt) {
  const stamp = Utilities.formatDate(submittedAt, CONFIG.timezone, 'yyyyMMdd-HHmmss');
  const id = v2SafeName_(payload.idPassport).replace(/[^A-Za-z0-9]/g, '').slice(0,8) || 'NOID';
  return 'IUC-ADM-V2-' + stamp + '-' + id + '-' + Utilities.getUuid().slice(0,4).toUpperCase();
}

function v2ResolveIntake_(value, submittedAt) {
  const monthNames = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
  const raw = String(value || '').trim().toUpperCase();
  let monthIndex = monthNames.indexOf(raw);
  let explicitYear = 0;
  const match = raw.match(/^([A-Z]+)\s+(\d{4})$/);
  if (match) {
    monthIndex = monthNames.indexOf(match[1]);
    explicitYear = Number(match[2]);
  }
  if (monthIndex < 0) throw new Error('Invalid intake month.');
  const now = submittedAt || new Date();
  let year = explicitYear || Number(Utilities.formatDate(now, CONFIG.timezone, 'yyyy'));
  const currentMonth = Number(Utilities.formatDate(now, CONFIG.timezone, 'M')) - 1;
  if (!explicitYear && monthIndex < currentMonth) year += 1;
  const month = monthNames[monthIndex];
  return {id:month.slice(0,3) + '-' + year, name:month.charAt(0) + month.slice(1).toLowerCase() + ' ' + year, month:month, year:year};
}

function v2CreateStudentFolder_(root, payload, intake) {
  const master = v2GetOrCreateFolder_(root, 'V2_STUDENTS');
  const intakeFolder = v2GetOrCreateFolder_(master, intake.id);
  const programmeFolder = v2GetOrCreateFolder_(intakeFolder, v2SafeName_(payload.programme).slice(0,80) || 'PROGRAMME');
  return v2GetOrCreateFolder_(programmeFolder,
    v2SafeName_(payload.fullName).toUpperCase() + '_' + v2SafeName_(payload.idPassport).replace(/\s+/g,''));
}

function v2GetOrCreateFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function v2SaveAdmissionDocuments_(folder, payload) {
  const uploaded = [];
  const documents = payload.documents || {};
  Object.keys(documents).forEach(function(key) {
    const doc = documents[key];
    if (!doc || !doc.base64) return;
    const extension = v2DocumentExtension_(doc.fileName, doc.mimeType);
    const fileName = v2SafeName_(key).toUpperCase() + '_' + v2SafeName_(payload.fullName).toUpperCase() + extension;
    const blob = Utilities.newBlob(Utilities.base64Decode(doc.base64), doc.mimeType, fileName);
    const file = folder.createFile(blob);
    uploaded.push({field:key,fileName:file.getName(),url:file.getUrl(),mimeType:doc.mimeType,size:Number(doc.size || 0)});
  });
  return uploaded;
}

function v2DocumentExtension_(fileName, mimeType) {
  const match = String(fileName || '').match(/\.[A-Za-z0-9]{2,5}$/);
  if (match) return match[0].toLowerCase();
  return mimeType === 'application/pdf' ? '.pdf' : (mimeType === 'image/png' ? '.png' : '.jpg');
}

function v2GenerateAdmissionPdf_(folder, payload, reference, intake, submittedAt, uploadedFiles) {
  const brandedPayload = Object.assign({}, payload, {intake:intake.name});
    V2_BRANDED_RENDER_CONTEXT = true;
const brandedHtml = buildAdmissionFormHtml_(brandedPayload, reference, submittedAt, uploadedFiles);
    
const brandedBlob = Utilities.newBlob(brandedHtml,'text/html','admission_form.html').getAs(MimeType.PDF)
    .setName('ADMISSION_FORM_' + toTitleCase_(payload.fullName || 'Applicant').replace(/\\s+/g,'_') + '.pdf');
  const brandedFile = folder.createFile(brandedBlob);
    V2_BRANDED_RENDER_CONTEXT = false;
return {fileId:brandedFile.getId(),fileName:brandedFile.getName(),url:brandedFile.getUrl(),blob:brandedBlob};

  const rows = [
    ['Reference No',reference],['Submitted At',Utilities.formatDate(submittedAt,CONFIG.timezone,'dd MMMM yyyy, hh:mm a')],
    ['Full Name',String(payload.fullName || '').toUpperCase()],['ID / Passport No',payload.idPassport],
    ['Personal Email',payload.email],['Phone Number',payload.phoneNumber],['Applicant Type',payload.applicantType],
    ['Programme',payload.programme],['Level of Study',payload.levelOfStudy],['Mode of Study',payload.studyMode],
    ['Intake',intake.name],['Entry Qualification',payload.entryQualificationType],
    ['Highest Qualification',payload.highestQualification],['Institution / Awarding Body',payload.lastInstitution],
    ['Field of Study',payload.fieldOfStudy],['Academic Result / CGPA / Grade',payload.academicResult || '-'],
    ['Transfer Applicant',payload.isTransferApplicant ? 'Yes' : 'No'],['Partner / Agent Code',payload.partnerCode || '-']
  ];
  const htmlRows = rows.map(function(row) {
    return '<tr><th>'+v2Html_(row[0])+'</th><td>'+v2Html_(row[1])+'</td></tr>';
  }).join('');
  const files = uploadedFiles.map(function(file) { return '<li>'+v2Html_(file.field)+' — '+v2Html_(file.fileName)+'</li>'; }).join('');
  const html = '<html><head><style>body{font-family:Arial,sans-serif;color:#202124;padding:28px}h1{color:#2d2363;font-size:22px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{width:34%;background:#f5f3ff}small{color:#666}</style></head><body>'+
    '<h1>Innovative University College — Postgraduate Admission Form</h1><p><small>System generated application record. This is not an Offer Letter or Conditional Offer Letter.</small></p>'+
    '<table>'+htmlRows+'</table><h2>Uploaded Documents</h2><ul>'+(files || '<li>No document metadata recorded.</li>')+'</ul>'+
    '<p><strong>Declaration:</strong> Applicant confirmed that the submitted information and documents are true and complete.</p></body></html>';
  const blob = Utilities.newBlob(html,'text/html','admission-v2.html').getAs(MimeType.PDF)
    .setName('ADMISSION_FORM_' + v2SafeName_(payload.fullName).replace(/\s+/g,'_').toUpperCase() + '.pdf');
  const file = folder.createFile(blob);
  return {fileId:file.getId(),fileName:file.getName(),url:file.getUrl(),blob:blob};
}

function v2SaveApplicationRecord_(payload, reference, intake, submittedAt, folder, uploadedFiles, pdf, agent, emailStatus) {
  const now = submittedAt.toISOString();
  const cleanPayload = JSON.parse(JSON.stringify(payload));
  cleanPayload.documents = Object.keys(payload.documents || {}).reduce(function(result,key) {
    const doc = payload.documents[key] || {};
    result[key] = {fileName:doc.fileName || '',mimeType:doc.mimeType || '',size:Number(doc.size || 0)};
    return result;
  }, {});
  const row = {
    'Reference No':reference,'Submitted At':now,'Applicant Type':payload.applicantType,
    'Student Name':payload.fullName,'ID / Passport No':payload.idPassport,'Personal Email':payload.email,
    'Phone Number':payload.phoneNumber,'Programme':payload.programme,'Level of Study':payload.levelOfStudy,
    'Study Mode':payload.studyMode,'Intake':intake.name,'Intake ID':intake.id,
    'Entry Qualification Type':payload.entryQualificationType,'Highest Qualification':payload.highestQualification,
    'Institution / Awarding Body':payload.lastInstitution,'Field of Study':payload.fieldOfStudy,
    'Academic Result / CGPA / Grade':payload.academicResult || '',
    'Transfer Applicant':payload.isTransferApplicant ? 'YES':'NO','Agent Code':agent ? agent.code : '',
    'Agent Name':agent ? agent.name : '','Agent Email':agent ? agent.email : '',
    'Student Folder URL':folder.getUrl(),'Admission Form PDF URL':pdf.url,
    'Uploaded Files JSON':JSON.stringify(uploadedFiles),'Raw Application JSON':JSON.stringify(cleanPayload),
    'Application Status':'RECEIVED','Email Status':emailStatus,'Last Updated':now,'Version':V2_ADMISSION_BUILD
  };
  v2Append_('V2_APPLICATIONS', row);
  v2AppendIntakeRegister_(row);
  return row;
}

function v2AppendIntakeRegister_(row) {
  const sheetName = ('V2_INTAKE_' + String(row['Intake ID'] || '').replace(/[^A-Za-z0-9_-]/g,'_')).slice(0,99);
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  const headers = ['Reference No','Submitted At','Student Name','ID / Passport No','Personal Email','Programme','Application Stage','Priority','Last Updated'];
  v2EnsureHeaders_(sheet, headers);
  v2StyleHeader_(sheet, headers.length);
  sheet.appendRow([row['Reference No'],row['Submitted At'],row['Student Name'],row['ID / Passport No'],row['Personal Email'],row['Programme'],'APPLICATION_RECEIVED','NORMAL',row['Last Updated']]);
}

function v2StartWorkflowForApplication_(application) {
  const source = {
    'Reference No':application['Reference No'],'Full Name':application['Student Name'],
    'ID / Passport No':application['ID / Passport No'],'Email':application['Personal Email'],
    'Programme':application['Programme'],'Level of Study':application['Level of Study'],
    'Intake':application['Intake'],'Student Folder URL':application['Student Folder URL'],
    'Field of Study / Qualification Area':application['Field of Study'],
    'Academic Result / CGPA / Grade':application['Academic Result / CGPA / Grade']
  };
  const now = new Date().toISOString();
  const workflow = {
    'Reference No':source['Reference No'],'Student Name':source['Full Name'],'ID / Passport No':source['ID / Passport No'],
    'Personal Email':source['Email'],'Innovative Email':'','Programme':source['Programme'],
    'Level of Study':source['Level of Study'],'Intake':application['Intake ID'],'Application Stage':'APPLICATION_RECEIVED',
    'Application Status':'Active', 'Document Review Status':'PENDING',
    'Document Reviewed At':'',
    'Document Reviewed By':'',
    'Missing Document Count':0,
    'Screening Recommendation':'PENDING_QUALIFICATION_SCREENING',
    'SAC Session ID':'','SAC Decision':'','SAC Endorsed At':'','Assessment Status':'NOT_DETERMINED',
    'Prerequisite Status':'NOT_DETERMINED','Offer Letter Status':'NOT_ISSUED','Offer Letter Issued At':'',
    'Acceptance Status':'NOT_OPEN','Orientation Session ID':'','Orientation Status':'NOT_ASSIGNED',
    'Provisioning Status':'NOT_STARTED','Academic Handover Status':'NOT_READY',
    'Student Folder URL':source['Student Folder URL'],'Last Updated':now,'Updated By':'Admission V2','Version':V2_BUILD
  };
  v2Upsert_('V2_WORKFLOW','Reference No',source['Reference No'],workflow);
  v2Upsert_('V2_INTAKE_APPLICATIONS','Reference No',source['Reference No'],{
    'Intake ID':application['Intake ID'],'Reference No':source['Reference No'],'Student Name':source['Full Name'],
    'Programme':source['Programme'],'Application Stage':'APPLICATION_RECEIVED','Priority':'NORMAL',
    'Deferred':'NO','Deferred To Intake ID':'','Last Updated':now
  });
}

function v2ResolveAgent_(code) {
  const cleanCode = String(code || '').trim().toUpperCase();
  if (!cleanCode) return null;
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.agentMasterSheetName);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  const index = function(name) { return headers.indexOf(name); };
  const codeIndex=index('Agent Code'), emailIndex=index('Agent Email'), activeIndex=index('Active');
  if (codeIndex < 0 || emailIndex < 0) return null;
  for (let i=0;i<values.length;i++) {
    const row=values[i];
    if (String(row[codeIndex] || '').trim().toUpperCase() === cleanCode && String(row[activeIndex] || '').trim().toLowerCase() === 'active') {
      return {code:String(row[codeIndex] || ''),name:index('Agent Name')>-1?String(row[index('Agent Name')] || ''):'',organisation:index('Organisation')>-1?String(row[index('Organisation')] || ''):'',email:String(row[emailIndex] || '')};
    }
  }
  return null;
}

function v2SendSubmissionAcknowledgements_(payload, reference, intake, pdf, agent) {
  const properties = PropertiesService.getScriptProperties();
  const mode = String(properties.getProperty('V2_EMAIL_MODE') || 'DISABLED').toUpperCase();
  if (mode === 'DISABLED') return 'DISABLED';
  const testRecipient = String(properties.getProperty('V2_TEST_EMAIL') || 'adiybukhori@innovative.edu.my').trim();
  const intended = [payload.email].concat(CONFIG.notificationEmails || []);
  if (agent && agent.email) intended.push(agent.email);
  const recipients = mode === 'TEST' ? [testRecipient] : intended.filter(Boolean);
  const unique = recipients.filter(function(value,index,array) { return array.indexOf(value) === index; });
  const subject = '[IPGS Admission V2] Application Received - ' + reference;
  const html = '<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden"><div style="background:#2d2363;color:white;padding:24px"><h2 style="margin:0">Application Received</h2></div><div style="padding:24px"><p>Dear '+v2Html_(payload.fullName)+',</p><p>Your postgraduate application has been received and is currently under review.</p><p><strong>Reference:</strong> '+v2Html_(reference)+'<br><strong>Programme:</strong> '+v2Html_(payload.programme)+'<br><strong>Intake:</strong> '+v2Html_(intake.name)+'</p><p>The next process may include document review, SAC endorsement, Internal Assessment or prerequisite requirements. An Offer Letter or COL has not been issued at this stage.</p></div></div>';
  unique.forEach(function(to) { GmailApp.sendEmail(to,subject,'Your application has been received.',{htmlBody:html,attachments:[pdf.blob],name:'IPGS Admission'}); });
  return mode + '_SENT_' + unique.length;
}

function v2IsPhdProgramme_(programme) {
  return /^PHD\b/i.test(String(programme || '').trim()) || /DOCTOR OF PHILOSOPHY/i.test(String(programme || ''));
}

function v2SafeName_(value) {
  return String(value || '').replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g,'').replace(/\s+/g,' ').trim();
}

function v2Html_(value) {
  return String(value == null ? '' : value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
/**
 * Controlled end-to-end smoke test for the V2 admission pipeline.
 *
 * Safety guarantees:
 * - creates a fresh dummy V2 application only;
 * - forces email routing to the approved test inbox only;
 * - restores the previous Script Property values after the run;
 * - does not create a COL or Offer Letter and does not touch V1 records.
 */
function v2RunControlledSmokeTest() {
  const properties = PropertiesService.getScriptProperties();
  const previousMode = properties.getProperty('V2_EMAIL_MODE');
  const previousRecipient = properties.getProperty('V2_TEST_EMAIL');
  const approvedRecipient = 'adiybukhori@innovative.edu.my';
  const testStamp = Utilities.formatDate(new Date(), CONFIG.timezone, 'yyyyMMdd-HHmmss');

  properties.setProperty('V2_EMAIL_MODE', 'TEST');
  properties.setProperty('V2_TEST_EMAIL', approvedRecipient);

  try {
    const result = v2SubmitAdmission_({
      applicantType: 'Local (Malaysian Citizen)',
      levelOfStudy: 'Master',
      programme: 'MBA - Master of Business Administration',
      intake: 'SEPTEMBER 2026',
      studyMode: 'Online',
      entryQualificationType: 'Normal Entry',
      fullName: 'V2 CONTROLLED TEST ' + testStamp,
      idPassport: 'TEST-' + testStamp,
      email: approvedRecipient,
      phoneNumber: 'TEST-NO-PHONE',
      highestQualification: 'Bachelor Degree (Test Record)',
      lastInstitution: 'IUC V2 Test Environment',
      fieldOfStudy: 'Business Administration',
      yearOfCompletion: '2026',
      academicResult: 'TEST RECORD',
      isTransferApplicant: false,
      referralSource: 'Direct Application',
      partnerCode: '',
      declarationAccepted: true,
      documents: {}
    });

    if (result.emailStatus !== 'TEST_SENT_1') {
      throw new Error('Smoke test email routing failed: ' + result.emailStatus);
    }
    if (result.colGenerated !== false || result.offerLetterGenerated !== false) {
      throw new Error('Smoke test safety failure: a prohibited letter was generated.');
    }
    Logger.log(JSON.stringify({
      ok: true,
      test: 'V2_CONTROLLED_SMOKE_TEST',
      recipient: approvedRecipient,
      reference: result.reference,
      intakeId: result.intakeId,
      emailStatus: result.emailStatus,
      colGenerated: result.colGenerated,
      offerLetterGenerated: result.offerLetterGenerated,
      folderUrl: result.folderUrl,
      admissionFormPdfUrl: result.admissionFormPdfUrl
    }));
    return result;
  } finally {
    if (previousMode === null) properties.deleteProperty('V2_EMAIL_MODE');
    else properties.setProperty('V2_EMAIL_MODE', previousMode);
    if (previousRecipient === null) properties.deleteProperty('V2_TEST_EMAIL');
    else properties.setProperty('V2_TEST_EMAIL', previousRecipient);
  }
}

