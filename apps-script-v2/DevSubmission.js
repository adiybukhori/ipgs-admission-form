/** ADD AS DevSubmission.gs in V2 only. Keep Code.gs LOCKED unchanged.
 * Editor-only fixed dummy test. No mail, deployments, triggers or production calls.
 * This is NOT the public submission endpoint or completed admission upgrade.
 */
const V2_TEST_HEADERS = ['Request ID','Submitted At','Intake','Status','Payload JSON','Folder URL','Uploads JSON','Admission PDF URL','Email Preview URL','COL Status','Email Status','Error'];

function v2Fixture_() {
  return {fullName:'TEST APPLICANT DO NOT PROCESS',idPassport:'TEST-ONLY-001',
    email:'applicant@example.invalid',capturedEmail:'applicant@example.invalid',
    applicantType:'Local (Malaysian Citizen)',levelOfStudy:'Master',
    programme:'MBM - Master in Business Management',intake:'January 2027',
    entryQualificationType:'Academic Qualification',gender:'Male',nationality:'Malaysian',
    country:'Malaysia',fullAddress:'TEST ADDRESS ONLY',placeOfBirth:'TEST',race:'TEST',
    religion:'TEST',maritalStatus:'Single',phoneNumber:'TEST PHONE',
    studyMode:'Part Time',highestQualification:'TEST Bachelor Degree',lastInstitution:'TEST Institution',
    fieldOfStudy:'Business',yearOfCompletion:'2025',academicResult:'3.00',
    healthDeclaration:'I declare that I am physically and mentally fit to undertake my studies.',
    okuStatus:'No',employmentStatus:'Not Working',nonWorkingCategory:'TEST',
    emergencyName:'TEST CONTACT',emergencyRelationship:'TEST',emergencyPhone:'TEST',
    emergencySameAsApplicant:true,paymentArrangement:'One-off',paymentSource:'Self-funded',
    referralSource:'Direct',declarationAccepted:true};
}

/** Run this function ONLY from the V2 editor. Creates one reusable dummy record. */
function devRunSubmissionSmokeTest() {
  assertDevIdentity_();
  if (CONFIG.buildVersion !== 'DEV_SAFETY_LOCKED_20260904') throw new Error('BASELINE_MISMATCH');
  const result = v2SubmitDummy_(v2Fixture_());
  Logger.log(JSON.stringify(result));
  return result;
}

function v2SubmitDummy_(p) {
  assertDevIdentity_();
  // Exact fixture restriction: cannot be used with copied student data or arbitrary input.
  if (JSON.stringify(p) !== JSON.stringify(v2Fixture_())) throw new Error('DUMMY_DATA_ONLY');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('TEST_BUSY: Retry later. No changes made.');
  let sheet, row, values;
  try {
    const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
    sheet = ss.getSheetByName('DEV_SUBMISSION_TEST');
    if (!sheet) {
      sheet = ss.insertSheet('DEV_SUBMISSION_TEST');
      sheet.getRange(1,1,1,V2_TEST_HEADERS.length).setValues([V2_TEST_HEADERS]);
      sheet.setFrozenRows(1);
    }
    const data = sheet.getDataRange().getValues();
    if (JSON.stringify(data[0]) !== JSON.stringify(V2_TEST_HEADERS)) throw new Error('TEST_HEADER_MISMATCH');
    const key = 'TEST-SUBMISSION-001';
    const hits = data.map((r,i)=>r[0]===key ? i+1 : 0).filter(Boolean);
    if (hits.length>1) throw new Error('DUPLICATE_TEST_ROWS: Manual review required.');
    row = hits[0] || sheet.getLastRow()+1;
    values = hits.length ? data[row-1].slice() : [key,new Date().toISOString(),p.intake,'RECEIVED',JSON.stringify(p),'','','','','NOT ISSUED','PREVIEW ONLY',''];
    if (values[4] !== JSON.stringify(p)) throw new Error('REQUEST_CONFLICT');
    if (values[3] === 'PREVIEW_READY') return v2Result_(values,true);
    values[3]='PROCESSING'; values[11]='';
    sheet.getRange(row,1,1,values.length).setValues([values]);
    SpreadsheetApp.flush();
    // Never follow stored folder URLs (copied sheets may contain production URLs).
    const root = DriveApp.getFolderById(CONFIG.rootFolderId);
    const testRoot = v2Folder_(root,'DEV_SUBMISSION_TEST_ONLY');
    const intakeFolder = v2Folder_(testRoot,p.intake);
    const folder = v2Folder_(intakeFolder,key);
    values[5]=folder.getUrl();
    const upload = v2File_(folder,'TEST_SUPPORTING_DOCUMENT.txt',()=>Utilities.newBlob('DUMMY SUPPORTING DOCUMENT - NOT A QUALIFICATION','text/plain','TEST_SUPPORTING_DOCUMENT.txt'));
    const uploads=[{field:'otherSupportingDocument',fileName:upload.getName(),url:upload.getUrl(),mimeType:'text/plain',size:0}];
    values[6]=JSON.stringify(uploads);
    sheet.getRange(row,1,1,values.length).setValues([values]);
    const pdf = v2File_(folder,'TEST_ADMISSION_FORM.pdf',()=>{
      let html=v2pdf_buildAdmissionFormHtml_(p,key,new Date(values[1]),uploads);
      html=html.replace('<body>','<body><div style="color:#b91c1c;font-weight:bold;text-align:center">DEVELOPMENT TEST — NOT AN OFFICIAL APPLICATION</div>');
      return Utilities.newBlob(html,'text/html','admission.html').getAs(MimeType.PDF).setName('TEST_ADMISSION_FORM.pdf');
    });
    values[7]=pdf.getUrl();
    sheet.getRange(row,1,1,values.length).setValues([values]);
    const preview=v2File_(folder,'TEST_ACKNOWLEDGEMENT_PREVIEW.html',()=>Utilities.newBlob(v2Acknowledgement_(p,key),'text/html','TEST_ACKNOWLEDGEMENT_PREVIEW.html'));
    values[8]=preview.getUrl();values[3]='PREVIEW_READY';values[11]='';
    sheet.getRange(row,1,1,values.length).setValues([values]);
    return v2Result_(values,false);
  } catch(error) {
    if (sheet && row && values && values[3]==='PROCESSING') {
      values[3]='FAILED_RETRYABLE';values[11]=String(error.message||error).slice(0,500);
      sheet.getRange(row,1,1,values.length).setValues([values]);
    }
    throw error;
  } finally {
    try { SpreadsheetApp.flush(); } finally { lock.releaseLock(); }
  }
}

function v2Result_(v,duplicate) {
  return {status:v[3],duplicate:duplicate,intake:v[2],folderUrl:v[5],admissionPdfUrl:v[7],
    emailPreviewUrl:v[8],col:'NOT ISSUED',email:'NOT SENT',productionReady:false};
}

function v2Folder_(parent,name) {
  const items=parent.getFoldersByName(name);
  if (!items.hasNext()) return parent.createFolder(name);
  const item=items.next();
  if(items.hasNext()) throw new Error('AMBIGUOUS_TEST_FOLDER');
  return item;
}

function v2File_(folder,name,createBlob) {
  const files=folder.getFilesByName(name);
  if(files.hasNext()) {
    const file=files.next();
    if(files.hasNext()) throw new Error('AMBIGUOUS_TEST_FILE');
    return file;
  }
  return folder.createFile(createBlob());
}

function v2Acknowledgement_(p,ref) {
  const esc=v2pdf_escapeForPdfHtml_;
  return '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>'+
    '<body style="margin:0;background:#f6f4ef;font-family:Arial,sans-serif;color:#243047"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px">'+
    '<table role="presentation" width="100%" style="max-width:620px;background:white"><tr><td style="background:#2d2363;color:white;padding:28px"><h2>Innovative University College</h2>Postgraduate Application Received</td></tr>'+
    '<tr><td style="padding:28px;line-height:1.7"><p style="color:#b91c1c">DEVELOPMENT PREVIEW — NOT SENT</p><p>Dear '+esc(p.fullName)+',</p>'+
    '<p>Thank you for submitting your postgraduate application. Your application has been received and is pending Registry review and consideration by the Student Admission Committee (SAC).</p>'+
    '<p><strong>Reference:</strong> '+esc(ref)+'<br><strong>Programme:</strong> '+esc(p.programme)+'<br><strong>Intake:</strong> '+esc(p.intake)+'</p>'+
    '<p>This acknowledgement is not an Offer Letter or Conditional Offer Letter.</p><h3>What happens next?</h3><ol>'+ 
    '<li>Registry reviews your application and supporting documents.</li><li>SAC considers your eligibility for direct entry or Internal Assessment.</li>'+
    '<li>If Internal Assessment is required, a COL and assessment instructions will follow. The panel will determine whether assessment is sufficient or prerequisite study is required.</li>'+
    '<li>Eligible applicants receive an Offer Letter and instructions for acceptance, registration and orientation.</li></ol>'+
    '<p>You will be contacted if further information is needed.</p><p>Institute of Postgraduate Studies (IPGS)<br>Innovative University College</p>'+
    '<hr><p style="font-size:12px;color:#64748b">Preview attachment plan: completed Admission Form PDF. Separate Admission Journey Guideline awaits approval; no guideline attachment is claimed in this test.</p>'+
    '</td></tr></table></td></tr></table></body></html>';
}

function v2pdf_getIucLogoDataUri_() {
  assertDevIdentity_();
  const key='DEV_LOGO_V1_'+CONFIG.iucLogoFileId;
  let cache;
  try {cache=CacheService.getScriptCache();const hit=cache.get(key);if(hit)return hit;}catch(e){}
  const blob=DriveApp.getFileById(CONFIG.iucLogoFileId).getBlob();
  const data='data:'+blob.getContentType()+';base64,'+Utilities.base64Encode(blob.getBytes());
  try {if(cache && data.length<90000)cache.put(key,data,600);}catch(e){}
  return data;
}

// Original PDF layout and escaping helpers copied verbatim; names isolated from locked backend.
function v2pdf_buildAdmissionFormHtml_(payload, reference, submittedAt, uploadedFiles) {
  const submittedDisplay = Utilities.formatDate(
    submittedAt || new Date(),
    CONFIG.timezone,
    'dd MMMM yyyy, h:mm a'
  );

  const logoDataUri = v2pdf_getIucLogoDataUri_();
  const checklistRows = v2pdf_buildAdmissionDocumentChecklistRows_(payload, uploadedFiles);
  const programmeNameOnly = v2pdf_getProgrammeNameOnly_(payload.programme || payload.programme);

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
      <td>${v2pdf_pdfValue_(reference)}</td>
      <th>Submitted Date</th>
      <td>${v2pdf_pdfValue_(submittedDisplay)}</td>
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
    ${v2pdf_pdfRow_('Applicant Type', payload.applicantType)}
    ${v2pdf_pdfRow_('Level of Study', payload.levelOfStudy)}
    ${v2pdf_pdfRow_('Intended Programme of Study', programmeNameOnly || payload.programme)}
    ${v2pdf_pdfRow_('Study Mode', payload.studyMode)}
    ${v2pdf_pdfRow_('Intake', payload.intake)}
    ${v2pdf_pdfRow_('Entry Qualification Type', payload.entryQualificationType)}
    ${v2pdf_pdfRow_('Proposed Supervisor', payload.proposedSupervisor)}
    ${v2pdf_pdfRow_('Referral Source', payload.referralSource)}
    ${v2pdf_pdfRow_('Partner / Agent Code', payload.partnerCode)}
  </table>

  <div class="section-title">B. Student Information</div>
  <table class="info-table">
    ${v2pdf_pdfRow_('Full Name', String(payload.fullName || '').toUpperCase())}
    ${v2pdf_pdfRow_('ID / Passport Number', payload.idPassport)}
    ${v2pdf_pdfRow_('Gender', payload.gender)}
    ${v2pdf_pdfRow_('Email Address', payload.email)}
    ${v2pdf_pdfRow_('Phone Number', payload.phoneNumber)}
    ${v2pdf_pdfRow_('Country', payload.country)}
    ${v2pdf_pdfRow_('Full Address', payload.fullAddress)}
    ${v2pdf_pdfRow_('Place of Birth', payload.placeOfBirth)}
    ${v2pdf_pdfRow_('Nationality', payload.nationality)}
    ${v2pdf_pdfRow_('Race', payload.race)}
    ${v2pdf_pdfRow_('Religion', payload.religion)}
    ${v2pdf_pdfRow_('Marital Status', payload.maritalStatus)}
  </table>

  <div class="page-break"></div>

    <div class="section-title">C. Student Profiling</div>
    <table class="info-table">
      ${v2pdf_pdfRow_('Employment Status', payload.employmentStatus)}
      ${v2pdf_pdfRow_('Employment Sector', payload.employmentSector)}
      ${v2pdf_pdfRow_('Monthly Salary Range', payload.salaryRange)}
      ${v2pdf_pdfRow_('Current Profile / Background', payload.nonWorkingCategory)}
    </table>

    <div class="section-title">D. Emergency Contact / Next of Kin</div>
    <table class="info-table">
      ${v2pdf_pdfRow_('Name', payload.emergencyName)}
      ${v2pdf_pdfRow_('Relationship', payload.emergencyRelationship)}
      ${v2pdf_pdfRow_('Phone Number', payload.emergencyPhone)}
      ${v2pdf_pdfRow_('Address', payload.emergencySameAsApplicant ? 'Same as applicant address' : payload.emergencyAddress)}
    </table>

  <div class="section-title">E. Academic Qualification</div>
  <table class="info-table">
    ${v2pdf_pdfRow_('Highest Qualification', payload.highestQualification)}
    ${v2pdf_pdfRow_('Institution / Awarding Body', payload.lastInstitution)}
    ${v2pdf_pdfRow_('Field of Study / Qualification Area', payload.fieldOfStudy)}
    ${v2pdf_pdfRow_('Year of Completion', payload.yearOfCompletion)}
    ${v2pdf_pdfRow_('Result / CGPA / Grade', payload.academicResult)}
    ${v2pdf_pdfRow_('Certificate / Reference No.', payload.certificateReferenceNo)}
  </table>

  <div class="section-title">F. Health & OKU Declaration</div>
  <table class="info-table">
    ${v2pdf_pdfRow_('Health Declaration', payload.healthDeclaration)}
    ${v2pdf_pdfRow_('Health Remarks', payload.healthDeclarationRemarks)}
    ${v2pdf_pdfRow_('OKU / Disability Status', payload.okuStatus)}
    ${v2pdf_pdfRow_('OKU Category', payload.okuCategory)}
    ${v2pdf_pdfRow_('OKU Card Number', payload.okuCardNumber)}
    ${v2pdf_pdfRow_('Support Required', payload.supportRequired)}
  </table>

  <div class="section-title">G. Payment Information</div>
  <table class="info-table">
    ${v2pdf_pdfRow_('Payment Arrangement', payload.paymentArrangement)}
    ${v2pdf_pdfRow_('Installment Frequency', payload.installmentFrequency)}
    ${v2pdf_pdfRow_('Payment Source', payload.paymentSource)}
    ${v2pdf_pdfRow_('Payment Source Other', payload.paymentSourceOther)}
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
    ${v2pdf_pdfRow_('Declaration Status', payload.declarationAccepted ? 'Confirmed' : 'Not Confirmed')}
    ${v2pdf_pdfRow_('Submitted Via', 'IUC Online Admission Form')}
    ${v2pdf_pdfRow_('Applicant Name', String(payload.fullName || '').toUpperCase())}
    ${v2pdf_pdfRow_('NRIC / Passport No.', payload.idPassport)}
    ${v2pdf_pdfRow_('Email Used for Submission', payload.capturedEmail || payload.email)}
    ${v2pdf_pdfRow_('Submission Date & Time', submittedDisplay)}
    ${v2pdf_pdfRow_('Application Reference No.', reference)}
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

function v2pdf_buildAdmissionDocumentChecklistRows_(payload, uploadedFiles) {
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
        <td>${v2pdf_pdfValue_(item.label)}</td>
        <td class="check">${tick}</td>
      </tr>
    `;
  }).join('');
}

function v2pdf_pdfRow_(label, value) {
  return `
    <tr>
      <th>${v2pdf_pdfValue_(label)}</th>
      <td>${v2pdf_pdfMultilineValue_(value)}</td>
    </tr>
  `;
}

function v2pdf_pdfValue_(value) {
  const text = String(value === null || value === undefined ? '' : value).trim();
  return text ? v2pdf_escapeForPdfHtml_(text) : '-';
}

function v2pdf_pdfMultilineValue_(value) {
  const text = String(value === null || value === undefined ? '' : value).trim();

  if (!text) {
    return '-';
  }

  return v2pdf_escapeForPdfHtml_(text).replace(/\n/g, '<br>');
}

function v2pdf_escapeForPdfHtml_(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function v2pdf_toTitleCase_(text) {
  return String(text || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function v2pdf_getProgrammeNameOnly_(programme) {
  const value = String(programme || '').trim();
  if (!value) return '';
  const parts = value.split(' - ');
  return parts.length > 1 ? parts.slice(1).join(' - ').trim() : value;
}

