/**
 * IUC IPGS Admission V2 — Submission Conditional Offer Letter.
 *
 * Purpose:
 * - issue ONE Conditional Offer Letter immediately after a valid Admission Form submission;
 * - this is NOT the Official Offer Letter / LOA;
 * - IA and Prerequisite routes do not generate separate COLs.
 */
const V2_COL_BUILD = 'SUBMISSION_COL_TEMPLATE_V2_20260925';

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
  const issueDate = Utilities.formatDate(issuedAt, timezone, 'dd/MM/yyyy');
  const isInternational = String(payload.applicantType || '').toLowerCase().indexOf('international') >= 0;

  const templateId = isInternational
    ? String(CONFIG.internationalColTemplateId || '').trim()
    : String(CONFIG.colTemplateId || '').trim();

  if (!templateId) throw new Error('Approved Conditional Offer Letter template is not configured.');

  const programmeName = v2ColProgrammeName_(programme);
  const fileBase = 'COL_' + v2ColFileName_(studentName || programmeCode);
  const templateFile = DriveApp.getFileById(templateId);
  const docCopy = templateFile.makeCopy(fileBase, studentFolder);
  const doc = DocumentApp.openById(docCopy.getId());
  const body = doc.getBody();

  body.replaceText('{{REF_NO}}', v2ColDocReplacement_(colReference));
  body.replaceText('{{DATE}}', v2ColDocReplacement_(issueDate));
  body.replaceText('{{STUDENT_NAME}}', v2ColDocReplacement_(String(studentName).toUpperCase()));
  body.replaceText('{{STUDENT_ADDRESS}}', v2ColDocReplacement_(v2ColAddress_(payload.fullAddress || '')));
  body.replaceText('{{PROGRAMME_NAME}}', v2ColDocReplacement_(programmeName));
  body.replaceText('{{MODE_OF_STUDY}}', v2ColDocReplacement_(studyMode));
  body.replaceText('{{INTAKE}}', v2ColDocReplacement_(intakeName));
  body.replaceText('{{COUNTRY}}', v2ColDocReplacement_(payload.country || payload.nationality || ''));
  body.replaceText('{{DURATION_STUDY}}', v2ColDocReplacement_(v2ColStudyDuration_(payload.levelOfStudy, programme)));

  doc.saveAndClose();

  const pdfBlob = DriveApp.getFileById(docCopy.getId())
    .getAs(MimeType.PDF)
    .setName(fileBase + '.pdf');
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
    sourceDocumentId: docCopy.getId(),
    sourceDocumentUrl: docCopy.getUrl(),
    templateId: templateId,
    build: V2_COL_BUILD
  };
}

function v2ColProgrammeName_(programme) {
  const value = String(programme || '').trim();
  if (!value) return '';
  const parts = value.split(' - ');
  return parts.length > 1 ? parts.slice(1).join(' - ').trim() : value;
}

function v2ColFileName_(value) {
  return String(value || 'Applicant')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(function(word){ return word.charAt(0).toUpperCase() + word.slice(1); })
    .join('_')
    .replace(/[^A-Za-z0-9_-]/g,'');
}

function v2ColAddress_(address) {
  return String(address || '')
    .split(',')
    .map(function(part){
      return String(part || '').trim().toLowerCase().split(/\s+/).filter(Boolean).map(function(word){
        return /^[0-9]+[A-Za-z]?$/.test(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1);
      }).join(' ');
    })
    .filter(Boolean)
    .join('\n');
}

function v2ColStudyDuration_(levelOfStudy, programme) {
  const level = String(levelOfStudy || '').toLowerCase();
  const programmeText = String(programme || '').toLowerCase();
  if (level === 'doctorate' || programmeText.indexOf('phd') >= 0 || programmeText.indexOf('doctor') >= 0) return '3 years (36 months)';
  if (level === 'master' || programmeText.indexOf('master') >= 0) return '1 year (12 months)';
  return '';
}

function v2ColDocReplacement_(value) {
  return String(value == null ? '' : value).replace(/\$/g, '$$$$');
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
