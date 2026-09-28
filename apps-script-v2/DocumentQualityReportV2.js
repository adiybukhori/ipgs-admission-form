/**
 * IUC IPGS Admission V2 - Official Document Quality Review Report
 *
 * Internal Registry / SAC record generated from V2_DOCUMENT_REVIEW.
 * Saved automatically into the student's Drive folder and included in the SAC pack.
 */

const V2_DOCUMENT_QUALITY_REPORT_TEMPLATE = 'DOCUMENT_QUALITY_REPORT_V1';
const V2_DOCUMENT_QUALITY_REPORT_HEADERS = [
  'Document Quality Report Status',
  'Document Quality Report PDF URL',
  'Document Quality Report File ID',
  'Document Quality Report Generated At'
];

function v2GenerateDocumentQualityReport_(data, actor) {
  assertDevIdentity_();
  const input = data || {};
  const reference = v2Required_(input.referenceNo, 'Reference No');
  const generatedBy = String(actor || input.generatedBy || 'Compliance & Records Agent').trim();

  const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  const review = v2Find_('V2_DOCUMENT_REVIEW', 'Reference No', reference);
  if (!application || !review) throw new Error('Application/document review record not found.');

  v2DocumentQualityReportEnsureHeaders_();

  const app = application.record;
  const wf = workflow ? workflow.record : {};
  const doc = review.record;
  const status = String(doc['AI Quality Status'] || wf['Document Quality Status'] || doc['Review Status'] || 'PENDING').toUpperCase();
  const confidence = Number(doc['AI Quality Confidence'] || wf['Document Quality Confidence'] || 0);
  const findings = v2AiReportParseJson_(doc['AI Quality Findings JSON'], []);
  const followUp = v2AiReportParseJson_(doc['AI Quality Follow-up JSON'], []);
  const flags = v2AiReportParseJson_(doc['AI Quality Flags JSON'], []);
  const sourceDocuments = v2AiReportParseJson_(doc['AI Quality Source Documents JSON'], []);
  const missingDocuments = v2AiReportParseJson_(doc['Missing Documents JSON'], []);
  const outstandingDocuments = v2AiReportParseJson_(doc['Outstanding Documents JSON'], []);
  const now = new Date().toISOString();

  const folderId = v2AiReportExtractDriveId_(app['Student Folder URL'] || wf['Student Folder URL']);
  if (!folderId) throw new Error('Student folder could not be resolved.');
  const folder = DriveApp.getFolderById(folderId);
  const studentName = String(app['Student Name'] || wf['Student Name'] || reference).trim();
  const programme = String(app['Programme'] || wf['Programme'] || '').trim();
  const baseName = 'DOCUMENT_QUALITY_REPORT_' + v2AiReportFileToken_(studentName) + '_' + v2AiReportFileToken_(v2AiReportProgrammeCode_(programme));
  const fileName = baseName + '_FINAL.pdf';

  const reportDoc = DocumentApp.create(baseName + '_WORKING');
  const reportDocId = reportDoc.getId();
  const body = reportDoc.getBody();
  body.clear();
  body.setMarginTop(28).setMarginBottom(30).setMarginLeft(34).setMarginRight(34);
  v2AiReportAddHeader_(body);

  const title = body.appendParagraph('OFFICIAL DOCUMENT QUALITY REVIEW REPORT');
  title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  title.editAsText().setFontFamily('Arial').setFontSize(15).setBold(true).setForegroundColor('#17231E');
  const sub = body.appendParagraph('Prepared by the IUC Compliance & Records AI for Registry and SAC review.');
  sub.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#66716D');
  body.appendParagraph('');

  const info = body.appendTable([
    ['Applicant', studentName, 'Programme', programme],
    ['Application Ref.', reference, 'Document Review', String(doc['Review Status'] || 'PENDING')],
    ['Quality Status', status, 'Confidence', v2AiReportPercent_(confidence)]
  ]);
  v2AiReportStyleInfoTable_(info);

  v2AiReportSection_(body, '1. Document Completeness');
  const completenessRows = [['ITEM', 'STATUS / DETAILS']];
  completenessRows.push(['Required document review', String(doc['Review Status'] || 'PENDING')]);
  completenessRows.push(['Missing documents', missingDocuments.length ? missingDocuments.map(function(x){ return String(x.label || x.key || x); }).join('; ') : 'None recorded']);
  completenessRows.push(['Outstanding / follow-up items', outstandingDocuments.length ? outstandingDocuments.map(function(x){ return String(x.label || x.key || x); }).join('; ') : 'None recorded']);
  v2AiReportStyleGrid_(body.appendTable(completenessRows), [0]);

  v2AiReportSection_(body, '2. AI Document Quality Assessment');
  const qualityRows = [['DOCUMENT', 'STATUS', 'ISSUES / OBSERVATIONS']];
  if (Array.isArray(findings) && findings.length) {
    findings.forEach(function(item) {
      const issues = Array.isArray(item.issues) ? item.issues : [];
      const evidence = Array.isArray(item.evidence) ? item.evidence : [];
      const notes = [];
      if (issues.length) notes.push('Issues: ' + issues.join('; '));
      if (evidence.length) notes.push('Evidence: ' + evidence.slice(0, 4).join('; '));
      if (item.replacementInstruction) notes.push('Follow-up: ' + item.replacementInstruction);
      qualityRows.push([
        String(item.label || item.field || item.fileName || 'Document'),
        String(item.status || 'REVIEWED'),
        notes.join('\n') || 'No material issue recorded.'
      ]);
    });
  } else {
    qualityRows.push(['Document set', status, 'No granular AI quality findings are recorded.']);
  }
  v2AiReportStyleGrid_(body.appendTable(qualityRows), [0]);

  v2AiReportSection_(body, '3. Follow-up & Flags');
  const followRows = [['ITEM', 'ACTION']];
  if (Array.isArray(followUp) && followUp.length) {
    followUp.forEach(function(item) {
      followRows.push([String(item.label || item.field || 'Document'), String(item.instruction || item.replacementInstruction || 'Student follow-up required.')]);
    });
  }
  if (Array.isArray(flags) && flags.length) {
    flags.forEach(function(flag) { followRows.push([String(flag), 'Retain for Registry / SAC awareness.']); });
  }
  if (followRows.length === 1) followRows.push(['None', 'No document-quality follow-up flag is currently recorded.']);
  v2AiReportStyleGrid_(body.appendTable(followRows), [0]);

  v2AiReportSection_(body, '4. Source Documents Reviewed');
  const sourceRows = [['DOCUMENT', 'FILE']];
  if (Array.isArray(sourceDocuments) && sourceDocuments.length) {
    sourceDocuments.forEach(function(item) {
      sourceRows.push([String(item.label || item.field || 'Document'), String(item.fileName || '')]);
    });
  } else {
    sourceRows.push(['Document set', 'Source-document list not recorded.']);
  }
  v2AiReportStyleGrid_(body.appendTable(sourceRows), [0]);

  v2AiReportSection_(body, '5. Compliance Declaration');
  const declaration = body.appendTable([[
    'This report records the AI-assisted document quality review performed for admission processing. ' +
    'It checks document usability and consistency, including document type, readability, cropping, blur/glare, orientation and page completeness. ' +
    'Pending or replacement documents remain follow-up items and do not, by themselves, stop admission progression to SAC. ' +
    'The report does not replace academic screening or the authorised SAC decision.'
  ]]);
  declaration.setBorderColor('#4A2A78').setBorderWidth(1);
  declaration.getCell(0,0).setBackgroundColor('#F7F5FB');
  declaration.getCell(0,0).editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#17231E');

  const meta = body.appendParagraph('Template: ' + V2_DOCUMENT_QUALITY_REPORT_TEMPLATE + ' | Provider: ' + String(doc['AI Quality Provider'] || '') + ' | Model: ' + String(doc['AI Quality Model'] || '') + ' | Generated: ' + now);
  meta.editAsText().setFontFamily('Arial').setFontSize(6.5).setForegroundColor('#7A817E');

  reportDoc.saveAndClose();
  const pdfBlob = DriveApp.getFileById(reportDocId).getBlob().getAs(MimeType.PDF).setName(fileName);
  const duplicates = folder.getFilesByName(fileName);
  while (duplicates.hasNext()) {
    try { duplicates.next().setTrashed(true); } catch (_) {}
  }
  const pdf = folder.createFile(pdfBlob);
  try { DriveApp.getFileById(reportDocId).setTrashed(true); } catch (_) {}

  v2UpdateRow_(review.sheet, review.rowNumber, {
    'Document Quality Report Status':'FINAL',
    'Document Quality Report PDF URL':pdf.getUrl(),
    'Document Quality Report File ID':pdf.getId(),
    'Document Quality Report Generated At':now,
    'Last Updated':now
  });

  v2Audit_(reference, 'DOCUMENT_REVIEW', 'GENERATE_DOCUMENT_QUALITY_REPORT', {}, {
    template:V2_DOCUMENT_QUALITY_REPORT_TEMPLATE,
    qualityStatus:status,
    fileName:fileName,
    fileId:pdf.getId(),
    followUpCount:Array.isArray(followUp) ? followUp.length : 0
  }, generatedBy, 'SUCCESS', 'Official document quality report saved to the student folder.');

  v2InvalidateCache_();
  return {ok:true, referenceNo:reference, reportStatus:'FINAL', fileName:fileName, fileId:pdf.getId(), url:pdf.getUrl(), folderId:folderId, template:V2_DOCUMENT_QUALITY_REPORT_TEMPLATE};
}

function v2DocumentQualityReportEnsureHeaders_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName('V2_DOCUMENT_REVIEW');
  if (!sheet) throw new Error('V2_DOCUMENT_REVIEW sheet is missing.');
  v2EnsureHeaders_(sheet, V2_DOCUMENT_REVIEW_HEADERS.concat(V2_COMPLIANCE_REVIEW_HEADERS).concat(V2_DOCUMENT_QUALITY_REPORT_HEADERS));
}
