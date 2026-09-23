/**
 * IUC IPGS Admission V2 — Submission Conditional Offer Letter.
 *
 * Purpose:
 * - issue ONE Conditional Offer Letter immediately after a valid Admission Form submission;
 * - this is NOT the Official Offer Letter / LOA;
 * - IA and Prerequisite routes do not generate separate COLs.
 */
const V2_COL_BUILD = 'SUBMISSION_COL_V2_20260923';

function v2EnsureSubmissionColHeaders_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const applicationSheet = ss.getSheetByName('V2_APPLICATIONS');
  const workflowSheet = ss.getSheetByName('V2_WORKFLOW');
  const headers = ['COL Status','COL Reference','COL PDF URL','COL Issued At'];
  if (applicationSheet) v2EnsureHeaders_(applicationSheet, headers);
  if (workflowSheet) v2EnsureHeaders_(workflowSheet, headers);
}

function v2GenerateSubmissionCol_(studentFolder, payload, reference, intake, submittedAt) {
  if (!studentFolder) throw new Error('Student folder is required for COL generation.');

  const studentName = String(payload.fullName || '').trim();
  const programme = String(payload.programme || '').trim();
  const level = String(payload.levelOfStudy || '').trim();
  const studyMode = String(payload.studyMode || '').trim();
  const intakeName = String(intake && intake.name || payload.intake || '').trim();
  const idPassport = String(payload.idPassport || '').trim();
  const issuedAt = submittedAt || new Date();
  const timezone = (CONFIG && CONFIG.timezone) || 'Asia/Kuala_Lumpur';

  if (!studentName || !programme || !intakeName) {
    throw new Error('Student name, programme and intake are required for COL generation.');
  }

  const programmeCode = v2ColProgrammeCode_(programme);
  const intakeYm = v2ColIntakeYearMonth_(intakeName, issuedAt);
  const cleanId = v2ColSafeToken_(idPassport) || 'NOID';
  const colReference = 'COL/' + programmeCode + '/' + intakeYm + '/' + cleanId;
  const issueDate = Utilities.formatDate(issuedAt, timezone, 'dd MMMM yyyy');
  const fileName = 'COL_' + programmeCode + '_' + cleanId + '.pdf';

  const html =
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    '@page{size:A4;margin:22mm 18mm 20mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;font-size:12px;line-height:1.55;margin:0}' +
    '.brand{border-top:7px solid #31206f;border-bottom:3px solid #d9a428;padding:14px 0 12px;margin-bottom:26px}.brand h1{margin:0;color:#31206f;font-size:20px;letter-spacing:.2px}.brand p{margin:3px 0 0;color:#6b7280;font-size:10px}' +
    '.title{text-align:center;margin:6px 0 24px}.title h2{margin:0;color:#241a54;font-size:19px;letter-spacing:.7px}.title p{margin:5px 0 0;color:#7a6c3a;font-size:10px;font-weight:700;letter-spacing:.08em}' +
    '.meta{width:100%;border-collapse:collapse;margin:16px 0 22px}.meta td{padding:8px 9px;border:1px solid #e4e5ea}.meta td:first-child{width:31%;background:#f7f5fd;color:#3a2a77;font-weight:700}' +
    '.congrats{background:#f8f5ff;border:1px solid #ded7f4;border-radius:10px;padding:14px 16px;margin:16px 0}.congrats strong{color:#31206f}' +
    '.conditions{margin:18px 0 0;padding:14px 16px;background:#fbfbfc;border-left:4px solid #d9a428}.conditions h3{margin:0 0 8px;font-size:12px;color:#241a54}.conditions ol{margin:0;padding-left:20px}.conditions li{margin:5px 0}' +
    '.note{margin-top:18px;font-size:10px;color:#6b7280}.sign{margin-top:30px}.sign b{color:#241a54}.footer{margin-top:36px;padding-top:12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:9px;text-align:center}' +
    '</style></head><body>' +
    '<div class="brand"><h1>Innovative University College</h1><p>Institute of Postgraduate Studies (IPGS)</p></div>' +
    '<div class="title"><h2>CONDITIONAL OFFER LETTER</h2><p>POSTGRADUATE ADMISSION</p></div>' +
    '<table class="meta">' +
      '<tr><td>COL Reference</td><td><strong>'+v2ColHtml_(colReference)+'</strong></td></tr>' +
      '<tr><td>Date</td><td>'+v2ColHtml_(issueDate)+'</td></tr>' +
      '<tr><td>Applicant</td><td><strong>'+v2ColHtml_(studentName)+'</strong></td></tr>' +
      '<tr><td>ID / Passport</td><td>'+v2ColHtml_(idPassport)+'</td></tr>' +
      '<tr><td>Programme</td><td><strong>'+v2ColHtml_(programme)+'</strong></td></tr>' +
      '<tr><td>Level</td><td>'+v2ColHtml_(level || '-')+'</td></tr>' +
      '<tr><td>Mode of Study</td><td>'+v2ColHtml_(studyMode || '-')+'</td></tr>' +
      '<tr><td>Intake</td><td>'+v2ColHtml_(intakeName)+'</td></tr>' +
    '</table>' +
    '<p>Dear <strong>'+v2ColHtml_(studentName)+'</strong>,</p>' +
    '<div class="congrats"><strong>Congratulations, and welcome to Innovative University College.</strong><br>' +
    'We are delighted to acknowledge your application to join the Institute of Postgraduate Studies (IPGS). Based on the information submitted through the IUC Admission Form, we are pleased to extend this <strong>Conditional Offer</strong> for the programme stated above while the formal admission process is completed.</div>' +
    '<p>Your application will now proceed through the required verification and academic admission process. Our team will contact you if any additional action or supporting evidence is required.</p>' +
    '<div class="conditions"><h3>Conditions of this offer</h3><ol>' +
      '<li>All information and documents submitted must be authentic, complete and verifiable.</li>' +
      '<li>Admission remains subject to the applicable academic entry requirements and IUC approval process, including SAC, Internal Assessment and/or prerequisite requirements where applicable.</li>' +
      '<li>Any further document or academic requirement requested by IUC must be completed within the stated timeframe.</li>' +
      '<li>The final Official Offer Letter / Letter of Admission will be issued after the applicable admission requirements have been completed and approved.</li>' +
    '</ol></div>' +
    '<p class="note"><strong>Important:</strong> This Conditional Offer Letter is an acknowledgement of your conditional admission status and is not the final Official Offer Letter / Letter of Admission.</p>' +
    '<div class="sign"><p>We look forward to welcoming you into the IUC postgraduate community and supporting you throughout your academic journey.</p>' +
    '<p>Warm regards,<br><b>IPGS Admission Team</b><br>Innovative University College</p></div>' +
    '<div class="footer">GL 35, Block C, Kelana Square, Jalan SS7/26, Kelana Jaya, 47301 Petaling Jaya, Selangor, Malaysia · +603 2726 2436 · ipgs.admission@innovative.edu.my</div>' +
    '</body></html>';

  const pdfBlob = Utilities.newBlob(html, 'text/html', 'conditional-offer.html')
    .getAs(MimeType.PDF)
    .setName(fileName);

  const pdfFile = studentFolder.createFile(pdfBlob);

  return {
    ok: true,
    status: 'ISSUED',
    reference: colReference,
    issuedAt: issuedAt.toISOString(),
    fileId: pdfFile.getId(),
    fileName: pdfFile.getName(),
    url: pdfFile.getUrl(),
    blob: pdfBlob,
    build: V2_COL_BUILD
  };
}

function v2ColProgrammeCode_(programme) {
  const value = String(programme || '').toUpperCase();
  if (value.indexOf('MASTER OF BUSINESS ADMINISTRATION') > -1 || /\bMBA\b/.test(value)) return 'MBA';
  if (value.indexOf('MASTER IN BUSINESS MANAGEMENT') > -1 || /\bMBM\b/.test(value)) return 'MBM';
  if (value.indexOf('HAJJ') > -1 || value.indexOf('UMRAH') > -1 || /\bMHUM\b/.test(value)) return 'MHUM';
  if (value.indexOf('MASTER IN ISLAMIC STUDIES') > -1 || /\bMIM\b/.test(value)) return 'MIM';
  if (value.indexOf('DOCTOR OF PHILOSOPHY') > -1 || /\bPHD\b/.test(value)) return 'PHD';
  if (value.indexOf('DOCTOR OF BUSINESS ADMINISTRATION') > -1 || value.indexOf('DOCTORATE OF BUSINESS ADMINISTRATION') > -1 || /\bDBA\b/.test(value)) return 'DBA';
  if (value.indexOf('POSTGRADUATE DIPLOMA IN EDUCATION') > -1 || /\bDPLI\b/.test(value)) return 'DPLI';
  return (value.replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'PG');
}

function v2ColIntakeYearMonth_(intake, fallbackDate) {
  const value = String(intake || '').toUpperCase();
  const months = {
    JANUARY:'01',FEBRUARY:'02',MARCH:'03',APRIL:'04',MAY:'05',JUNE:'06',
    JULY:'07',AUGUST:'08',SEPTEMBER:'09',OCTOBER:'10',NOVEMBER:'11',DECEMBER:'12'
  };
  let month = '';
  Object.keys(months).some(function(name){
    if (value.indexOf(name) > -1) { month = months[name]; return true; }
    return false;
  });
  const yearMatch = value.match(/\b(20\d{2})\b/);
  const timezone = (CONFIG && CONFIG.timezone) || 'Asia/Kuala_Lumpur';
  const date = fallbackDate || new Date();
  const year = yearMatch ? yearMatch[1] : Utilities.formatDate(date, timezone, 'yyyy');
  if (!month) month = Utilities.formatDate(date, timezone, 'MM');
  return year + '-' + month;
}

function v2ColSafeToken_(value) {
  return String(value || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 20).toUpperCase();
}

function v2ColHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}
