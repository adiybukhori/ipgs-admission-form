/**
 * Admission V2 - Controlled PG-ADM-01 generator
 *
 * Controlled layout authority:
 * - PG-ADM-01_STANDARD_TEMPLATE_V1.pdf
 * - Approved one-page MBA/PhD-style table layout with IUC + IPGS logos
 *
 * Reliability rules:
 * - Generate for every V2 admission and refresh before SAC printing.
 * - Save exactly one current PDF in the student folder using 00_ prefix.
 * - Track GENERATED / FAILED status and error details in V2_WORKFLOW.
 * - V1 is never read or modified.
 */

const V2_PG_ADM01_BUILD = 'PG_ADM_01_CONTROLLED_LAYOUT_20260918';
const V2_PG_ADM01_VERSION = 'PG-ADM-01-V2-CONTROLLED';
const V2_PG_ADM01_SOURCE = 'CONTROLLED_REFERENCE_LAYOUT';
const V2_PG_ADM01_IUC_LOGO_ID = '1aCvoX1s-k6t_XXWQRFLCo2KIli5QiyS_';
const V2_PG_ADM01_IPGS_LOGO_ID = '1YACP9HsO94-m-mQ-tLPq4J3RbTqyA36r';
const V2_PG_ADM01_CONTROLLED_REFERENCE_PDF_ID = '1oAVVfCzHdOesKfOSPX30M0xJxXXaIJQ4';
const V2_PG_ADM01_DEPRECATED_TEXT_MASTER_ID = '1TweYhiWWoh6S-PHciBRpxACQSrQfhGkIo8kWQEcKleU';
const V2_PG_ADM01_WORKFLOW_HEADERS = [
  'PG-ADM-01 Status',
  'PG-ADM-01 URL',
  'PG-ADM-01 Generated At',
  'PG-ADM-01 Error',
  'PG-ADM-01 Version',
  'PG-ADM-01 Source'
];

function v2PgAdm01EnsureHeaders_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName('V2_WORKFLOW');
  if (!sheet) throw new Error('V2_WORKFLOW sheet not found.');
  v2EnsureHeaders_(sheet, V2_PG_ADM01_WORKFLOW_HEADERS);
  return sheet;
}

function v2PgAdm01UpdateStatus_(reference, values) {
  v2PgAdm01EnsureHeaders_();
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  if (!workflow) return false;
  const patch = Object.assign({'Last Updated':new Date().toISOString()}, values || {});
  v2UpdateRow_(workflow.sheet, workflow.rowNumber, patch);
  return true;
}

function v2GeneratePgEligibilityPdf_(referenceNo, sessionId, actor) {
  const reference = String(referenceNo || '').trim();
  const generatedBy = String(actor || 'System').trim();
  if (!reference) throw new Error('Reference No is required for PG-ADM-01.');

  v2PgAdm01UpdateStatus_(reference, {
    'PG-ADM-01 Status':'GENERATING',
    'PG-ADM-01 Error':'',
    'PG-ADM-01 Version':V2_PG_ADM01_VERSION,
    'PG-ADM-01 Source':V2_PG_ADM01_SOURCE
  });

  try {
    const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
    if (!application) throw new Error('V2 application record not found for PG-ADM-01.');

    const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
    const app = application.record;
    const flow = workflow ? workflow.record : {};

    const folderId = v2PgAdm01ExtractDriveId_(app['Student Folder URL'] || flow['Student Folder URL'] || '');
    if (!folderId) throw new Error('Student folder could not be resolved for PG-ADM-01.');
    const folder = DriveApp.getFolderById(folderId);

    const raw = v2PgAdm01ParseJson_(app['Raw Application JSON'], {});
    const studentName = String(app['Student Name'] || flow['Student Name'] || '').trim();
    const intake = v2OfferDisplayIntake_(app['Intake'] || flow['Intake'] || '');
    const highestQualification = String(app['Highest Qualification'] || '').trim();
    const institution = String(app['Institution / Awarding Body'] || '').trim();
    const field = String(app['Field of Study'] || '').trim();
    const result = String(app['Academic Result / CGPA / Grade'] || '').trim();
    const nationality = String(raw.nationality || raw.country || '').trim();

    const sacSessionId = String(sessionId || flow['SAC Session ID'] || '').trim();

    const safeName = v2PgAdm01Safe_(studentName || reference);
    const safeRef = v2PgAdm01Safe_(reference);
    const pdfName = '00_PG-ADM-01_' + safeName + '_' + safeRef + '.pdf';

    v2PgAdm01TrashMatching_(folder, pdfName);
    v2PgAdm01TrashMatching_(folder, 'PG-ADM-01_' + safeName + '_' + safeRef + '.pdf');

    const iucLogo = v2PgAdm01DataUrl_(CONFIG.iucLogoFileId || V2_PG_ADM01_IUC_LOGO_ID);
    const ipgsLogo = v2PgAdm01DataUrl_(V2_PG_ADM01_IPGS_LOGO_ID);
    if (!iucLogo || !ipgsLogo) throw new Error('Approved IUC/IPGS logo assets could not be loaded.');

    const e = v2PgAdm01Html_;
    const checks = [
      'Qualification is recognised / equivalent to the required entry level.',
      'Minimum academic result / CGPA / equivalent requirement is met.',
      'Academic field classification has been confirmed.',
      'Relevant working experience is claimed, where applicable.',
      'Relevant working experience has been verified, where applicable.',
      'Experience is relevant to the applied postgraduate programme.',
      'Applicable English-language requirement is met.',
      'Application file is complete and authentic.',
      'Research-methodology preparation is demonstrated.',
      'Research Intent is within the programme field and researchable.',
      'Suitable supervisory expertise and capacity are available.'
    ];

    const checkRows = checks.map(function(label) {
      return '<tr>' +
        '<td class="check-text">' + e(label) + '</td>' +
        '<td class="yn"><span class="box">&#9633;</span></td>' +
        '<td class="yn"><span class="box">&#9633;</span></td>' +
        '<td class="remarks"></td>' +
      '</tr>';
    }).join('');

    const html = '<!doctype html><html><head><meta charset="utf-8"><style>' +
      '@page{size:A4 landscape;margin:9mm 11mm 8mm 11mm}' +
      '*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#151515;margin:0;font-size:9.4px}' +
      '.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px}' +
      '.logos{display:flex;align-items:center;gap:11px}.logos img{display:block;object-fit:contain}.iuc{width:155px;height:60px}.ipgs{width:185px;height:60px}' +
      '.strap{font-size:7.6px;font-weight:700;color:#4a2d88;margin-top:6px;text-align:right;white-space:nowrap}' +
      '.rule{height:1.3px;background:#4a2d88;margin:-1px 0 7px 0}' +
      'h1{font-size:18px;line-height:1.05;margin:0 0 7px 0;color:#4a2d88;font-weight:700}' +
      'table{width:100%;border-collapse:collapse;table-layout:fixed}td,th{border:1px solid #b7b7b7;padding:4px 6px;vertical-align:middle}' +
      '.info td{height:24px}.label{background:#f2effa;font-weight:700}.value{background:#fff}' +
      '.info .c1{width:36%}.info .c2{width:21%}.info .c3{width:16%}.info .c4{width:27%}' +
      '.check{margin-top:7px}.check th{background:#4b2d88;color:#fff;font-size:9.2px;font-weight:700;padding:5px 6px;text-align:center}' +
      '.check .check-col{width:42%}.check .yes-col,.check .no-col{width:15%}.check .remarks-col{width:28%}' +
      '.check td{height:21px;padding-top:3px;padding-bottom:3px}.check-text{text-align:left}.yn{text-align:center!important}.remarks{text-align:left}.box{font-size:13px;line-height:1;display:inline-block}' +
      '.section{font-size:16px;color:#4a2d88;font-weight:700;margin:10px 0 5px}' +
      '.route{width:84%;margin:0 auto}.route th{background:#4b2d88;color:#fff;font-weight:700;text-align:left;padding:5px 6px}.route td{height:22px}.route .sel{width:30%;background:#f3f0fa}.route .basis{width:70%}' +
      '.policy{font-size:8.4px;margin:7px 0 10px;color:#333}.policy b{color:#222}' +
      '.signatures{display:flex;justify-content:center;gap:34px;margin-top:20px}.sig{width:24%;text-align:center;font-size:8.6px}.line{border-top:1px solid #333;margin:0 0 5px}.sig-title{margin-top:5px;line-height:1.22}' +
      '.footer{text-align:center;color:#6d6d6d;font-size:7.6px;margin-top:22px}' +
      '</style></head><body>' +

      '<div class="header"><div class="logos">' +
        '<img class="iuc" src="' + iucLogo + '">' +
        '<img class="ipgs" src="' + ipgsLogo + '">' +
      '</div><div class="strap">INNOVATIVE UNIVERSITY COLLEGE&nbsp;&nbsp;|&nbsp;&nbsp;INSTITUTE OF POSTGRADUATE STUDIES (IPGS)</div></div>' +
      '<div class="rule"></div>' +
      '<h1>FORM PG-ADM-01. Eligibility and Route Determination Checklist</h1>' +

      '<table class="info">' +
        '<colgroup><col class="c1"><col class="c2"><col class="c3"><col class="c4"></colgroup>' +
        '<tr><td class="label">Applicant name</td><td class="value">' + e(studentName) + '</td><td class="label">Application no.</td><td class="value">' + e(reference) + '</td></tr>' +
        '<tr><td class="label">Nationality</td><td class="value">' + e(nationality) + '</td><td class="label">Intake</td><td class="value">' + e(intake) + '</td></tr>' +
        '<tr><td class="label">Highest qualification</td><td class="value">' + e(highestQualification) + '</td><td class="label">Institution</td><td class="value">' + e(institution) + '</td></tr>' +
        '<tr><td class="label">Field / major</td><td class="value">' + e(field) + '</td><td class="label">CGPA / equivalent</td><td class="value">' + e(result) + '</td></tr>' +
      '</table>' +

      '<table class="check">' +
        '<colgroup><col class="check-col"><col class="yes-col"><col class="no-col"><col class="remarks-col"></colgroup>' +
        '<tr><th>Check</th><th>Yes</th><th>No</th><th>Evidence / Remarks</th></tr>' +
        checkRows +
      '</table>' +

      '<div class="section">Route decision</div>' +
      '<table class="route"><colgroup><col class="sel"><col class="basis"></colgroup>' +
        '<tr><th>Selection</th><th>Basis</th></tr>' +
        '<tr><td class="sel">&#9633;&nbsp; Normal admission route</td><td>Meets programme entry requirement and may proceed under normal admission.</td></tr>' +
        '<tr><td class="sel">&#9633;&nbsp; Rigorous internal assessment</td><td>Requires internal assessment before final admission eligibility is confirmed.</td></tr>' +
        '<tr><td class="sel">&#9633;&nbsp; Prerequisite-course route</td><td>May only be applied after internal assessment, where applicable.</td></tr>' +
        '<tr><td class="sel">&#9633;&nbsp; Not eligible / refer</td><td>Qualification, evidence, or another mandatory requirement is not met.</td></tr>' +
      '</table>' +

      '<div class="policy"><b>Policy note:</b> Prerequisite is not an initial SAC route. Where applicable, Prerequisite may only be required after the Internal Assessment result.</div>' +

      '<div class="signatures">' +
        '<div class="sig"><div class="line"></div><div>Signature / Date</div><div class="sig-title">Checked by<br>Admissions Officer</div></div>' +
        '<div class="sig"><div class="line"></div><div>Signature / Date</div><div class="sig-title">Academic field/topic classification<br>Programme Leader</div></div>' +
        '<div class="sig"><div class="line"></div><div>Signature / Date</div><div class="sig-title">Verified by<br>Registrar / Dean</div></div>' +
      '</div>' +

      '<div class="footer">Controlled Document&nbsp;&nbsp;|&nbsp;&nbsp;Internal Use' +
        (sacSessionId ? '&nbsp;&nbsp;|&nbsp;&nbsp;SAC: ' + e(sacSessionId) : '') +
      '</div>' +
      '</body></html>';

    const pdfBlob = Utilities.newBlob(html, 'text/html', 'pg-adm-01.html')
      .getAs(MimeType.PDF)
      .setName(pdfName);
    const pdfFile = folder.createFile(pdfBlob);

    const now = new Date().toISOString();
    v2PgAdm01UpdateStatus_(reference, {
      'PG-ADM-01 Status':'GENERATED',
      'PG-ADM-01 URL':pdfFile.getUrl(),
      'PG-ADM-01 Generated At':now,
      'PG-ADM-01 Error':'',
      'PG-ADM-01 Version':V2_PG_ADM01_VERSION,
      'PG-ADM-01 Source':V2_PG_ADM01_SOURCE
    });

    try {
      v2Audit_(reference, sacSessionId ? 'SAC' : 'ADMISSION', 'GENERATE_PG_ADM_01', {}, {
        sessionId:sacSessionId,
        fileName:pdfName,
        url:pdfFile.getUrl(),
        version:V2_PG_ADM01_VERSION,
        source:V2_PG_ADM01_SOURCE,
        controlledReferencePdfId:V2_PG_ADM01_CONTROLLED_REFERENCE_PDF_ID,
        position:'FIRST_DOCUMENT_IN_SAC_PACK'
      }, generatedBy, 'SUCCESS', 'Approved one-page PG-ADM-01 generated from controlled reference layout.');
    } catch (_) {}
    v2InvalidateCache_();

    return {
      ok:true,
      referenceNo:reference,
      fileId:pdfFile.getId(),
      fileName:pdfName,
      url:pdfFile.getUrl(),
      status:'GENERATED',
      version:V2_PG_ADM01_VERSION,
      source:V2_PG_ADM01_SOURCE,
      controlledReferencePdfId:V2_PG_ADM01_CONTROLLED_REFERENCE_PDF_ID
    };
  } catch (error) {
    const message = String(error && error.message || error || 'Unknown PG-ADM-01 generation error');
    v2PgAdm01UpdateStatus_(reference, {
      'PG-ADM-01 Status':'FAILED',
      'PG-ADM-01 Error':message,
      'PG-ADM-01 Version':V2_PG_ADM01_VERSION,
      'PG-ADM-01 Source':V2_PG_ADM01_SOURCE
    });
    try {
      v2Audit_(reference, sessionId ? 'SAC' : 'ADMISSION', 'GENERATE_PG_ADM_01', {}, {
        sessionId:String(sessionId || ''),
        error:message,
        version:V2_PG_ADM01_VERSION,
        source:V2_PG_ADM01_SOURCE
      }, generatedBy, 'FAILED', message);
    } catch (_) {}
    v2InvalidateCache_();
    throw error;
  }
}

function v2RegeneratePgAdm01_(data, actor) {
  const reference = String(data && data.referenceNo || '').trim();
  if (!reference) throw new Error('Reference No is required.');
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!workflow) throw new Error('V2 workflow record not found.');
  const sessionId = String(data && data.sessionId || workflow.record['SAC Session ID'] || '').trim();
  const generated = v2GeneratePgEligibilityPdf_(reference, sessionId, actor || 'Admin Portal V2');

  if (sessionId) {
    const candidate = v2FindComposite_('V2_SAC_CANDIDATES',['SAC Session ID','Reference No'],[sessionId,reference]);
    if (candidate) {
      v2UpdateRow_(candidate.sheet,candidate.rowNumber,{
        'Form 01 URL':generated.url,
        'PG Eligibility Form Version':V2_PG_ADM01_VERSION,
        'Pack Prepared At':''
      });
    }
  }
  return Object.assign({regenerated:true,v1Touched:false},generated);
}

function v2PgAdm01DataUrl_(fileId) {
  try {
    const blob = DriveApp.getFileById(String(fileId || '')).getBlob();
    return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
  } catch (_) {
    return '';
  }
}

function v2PgAdm01TrashMatching_(folder, name) {
  const files = folder.getFilesByName(name);
  while (files.hasNext()) {
    try { files.next().setTrashed(true); } catch (_) {}
  }
}

function v2PgAdm01ExtractDriveId_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (typeof v2OfferExtractDriveId_ === 'function') {
    const shared = String(v2OfferExtractDriveId_(text) || '').trim();
    if (shared) return shared;
  }
  const match = text.match(/[-A-Za-z0-9_]{20,}/);
  return match ? match[0] : '';
}

function v2PgAdm01ParseJson_(value, fallback) {
  try {
    const parsed = JSON.parse(String(value || ''));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch (_) { return fallback; }
}

function v2PgAdm01Safe_(value) {
  const clean = String(value || '')
    .replace(/[\\/:*?"<>|#%{}]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0,72);
  return clean || 'STUDENT';
}

function v2PgAdm01Html_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
