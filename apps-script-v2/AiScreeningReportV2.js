/**
 * IUC IPGS Admission V2 - Official AI Admission Screening Report
 *
 * Locked template: AI_SCREENING_REPORT_V2
 * - Official internal Registry / SAC screening record.
 * - Generated from V2_AI_SCREENING + V2_QUALIFICATION_SCREENING.
 * - Saved automatically into the student's Drive folder.
 * - AI is explicitly declared as the screening reviewer.
 * - SAC remains the authorised admission decision.
 */

const V2_AI_SCREENING_REPORT_TEMPLATE = 'AI_SCREENING_REPORT_V2';
const V2_AI_SCREENING_REPORT_HEADERS = [
  'Rule Engine Input Source',
  'Report Status',
  'Report Version',
  'Report PDF URL',
  'Report File ID',
  'Report Generated At',
  'Report Finalized At'
];

// Official logo assets in IUC/IPGS Drive.
const V2_AI_REPORT_IUC_LOGO_ID = '1Ihg_h-L7ZH5kGCHjLMYXUWclpOloaa2E';
const V2_AI_REPORT_IPGS_LOGO_ID = '1YACP9HsO94-m-mQ-tLPq4J3RbTqyA36r';

function v2GenerateAiScreeningReport_(data, actor) {
  assertDevIdentity_();

  const input = data || {};
  const reference = v2Required_(input.referenceNo, 'Reference No');
  const generatedBy = String(actor || input.generatedBy || 'Admission Intelligence Agent').trim();
  const requestedFinal = input.finalize === true || String(input.finalize || '').toUpperCase() === 'TRUE';

  const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  const ai = v2Find_('V2_AI_SCREENING', 'Reference No', reference);
  const screening = v2Find_('V2_QUALIFICATION_SCREENING', 'Reference No', reference);

  if (!application) throw new Error('V2 application record not found.');
  if (!ai) throw new Error('AI screening result not found.');

  v2AiReportEnsureHeaders_();

  const aiRecord = ai.record;
  const app = application.record;
  const wf = workflow ? workflow.record : {};
  const qs = screening ? screening.record : {};
  const normalized = v2AiReportParseJson_(aiRecord['Normalized Result JSON'], {});
  const evidence = v2AiReportParseJson_(aiRecord['Evidence JSON'], []);
  const flags = v2AiReportParseJson_(aiRecord['Flags JSON'], []);
  const sourceDocuments = v2AiReportParseJson_(aiRecord['Source Documents JSON'], []);

  const fieldClassification = String(
    qs['Field Classification'] ||
    wf['Field Classification'] ||
    aiRecord['Human Field Classification'] ||
    aiRecord['Field Classification'] || ''
  ).trim().toUpperCase();

  const relevantExperience = String(
    qs['Relevant Work Experience'] ||
    wf['Relevant Work Experience'] ||
    aiRecord['Human Relevant Work Experience'] ||
    aiRecord['Relevant Work Experience'] || ''
  ).trim().toUpperCase();

  const recommendation = String(
    qs['Recommended Route'] ||
    wf['Screening Recommendation'] || ''
  ).trim().toUpperCase();

  const manualRequired =
    /YES|REQUIRED/.test(String(qs['Manual Review Required'] || wf['Manual Review Required'] || '').toUpperCase()) ||
    /REVIEW_REQUIRED|AUTO_FAILED|AUTO_PENDING/.test(String(aiRecord['Status'] || '').toUpperCase());

  const unresolvedFlags = Array.isArray(flags) ? flags.filter(function(flag) {
    return !/^INFO_/i.test(String(flag || ''));
  }) : [];

  const screeningResult = String(qs['Screening Result'] || '').toUpperCase();
  const screeningResolved =
    !!screening &&
    !!recommendation &&
    !manualRequired &&
    /RULE_MATCHED|MANUAL_SCREENING_COMPLETED|COMPLETED/.test(screeningResult);

  // A PDF may be generated at any point for review, but FINAL is reserved for
  // a case whose deterministic qualification screening route is already resolved.
  const finalised = requestedFinal && screeningResolved;
  const reportStatus = finalised
    ? 'FINAL'
    : (manualRequired ? 'PENDING_HUMAN_REVIEW' : (!screeningResolved ? 'PENDING_RULE_ENGINE' : 'SCREENED'));
  const previousVersion = parseInt(String(aiRecord['Report Version'] || '0').replace(/\D+/g, ''), 10) || 0;
  const version = previousVersion + 1;
  const now = new Date().toISOString();

  const folderId = v2AiReportExtractDriveId_(app['Student Folder URL']);
  if (!folderId) throw new Error('Student folder could not be resolved.');
  const folder = DriveApp.getFolderById(folderId);

  const studentName = String(app['Student Name'] || wf['Student Name'] || reference).trim();
  const programme = String(app['Programme'] || wf['Programme'] || '').trim();
  const programmeCode = v2AiReportProgrammeCode_(programme);
  const baseName = 'AI_ADMISSION_SCREENING_REPORT_' +
    v2AiReportFileToken_(studentName) + '_' +
    v2AiReportFileToken_(programmeCode);

  const suffix = finalised ? '_FINAL.pdf' : '_V' + ('0' + version).slice(-2) + '.pdf';
  const fileName = baseName + suffix;

  const doc = DocumentApp.create(baseName + '_WORKING');
  const docId = doc.getId();
  const body = doc.getBody();
  body.clear();
  body.setMarginTop(28).setMarginBottom(30).setMarginLeft(34).setMarginRight(34);

  v2AiReportAddHeader_(body);

  const title = body.appendParagraph('OFFICIAL AI-ASSISTED ADMISSION SCREENING REPORT');
  title.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  title.editAsText().setFontFamily('Arial').setFontSize(15).setBold(true).setForegroundColor('#17231E');

  const sub = body.appendParagraph('Prepared by the IUC Admission Intelligence Agent for Registry and SAC review.');
  sub.editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#66716D');

  body.appendParagraph('');

  const info = body.appendTable([
    ['Applicant', studentName, 'Programme', programme],
    ['Application Ref.', reference, 'Screening Status', reportStatus],
    ['Screened By', 'IUC Admission Intelligence Agent', 'Report Version', finalised ? 'FINAL' : 'V' + ('0' + version).slice(-2)]
  ]);
  v2AiReportStyleInfoTable_(info);

  v2AiReportSection_(body, '1. AI Screening Decision Inputs');
  const inputTable = body.appendTable([
    ['SCREENING INPUT', 'AI RESULT', 'PRIMARY EVIDENCE', 'CONFIDENCE'],
    ['Field Relationship',
      fieldClassification || 'PENDING',
      'Academic certificate + transcript',
      v2AiReportPercent_(aiRecord['Confidence'])],
    ['Relevant Work Experience',
      relevantExperience || 'PENDING',
      'CV / Resume employment history',
      v2AiReportPercent_(aiRecord['Confidence'])]
  ]);
  v2AiReportStyleGrid_(inputTable, [0]);

  v2AiReportSection_(body, '2. Academic Qualification & Transcript Assessment');
  const academicRows = [
    ['CHECK', 'AI FINDING', 'ASSESSMENT'],
    ['Qualification Award',
      String(aiRecord['Qualification'] || app['Highest Qualification'] || ''),
      'Qualification title identified from the submitted academic evidence.'],
    ['Institution / Awarding Body',
      String(aiRecord['Institution'] || app['Institution / Awarding Body'] || ''),
      'Institution extracted and cross-checked against the application.'],
    ['Academic Field',
      String(aiRecord['Field of Study'] || app['Field of Study'] || ''),
      'Used together with transcript/certificate evidence to determine field relationship.'],
    ['Field Relationship',
      fieldClassification || 'PENDING',
      String(normalized.fieldClassificationRationale || v2AiReportDefaultFieldRationale_(fieldClassification, programme))],
    ['Transcript Result',
      String(aiRecord['CGPA / Grade'] || app['Academic Result / CGPA / Grade'] || ''),
      String(normalized.transcriptAssessment || 'Academic result extracted from the submitted transcript.')],
    ['CGPA / Grade Equivalency',
      String(normalized.gradeEquivalencyStatus || v2AiReportGradeStatus_(aiRecord['CGPA / Grade'] || app['Academic Result / CGPA / Grade'])),
      String(normalized.gradeEquivalencyNote || v2AiReportGradeNote_(aiRecord['CGPA / Grade'] || app['Academic Result / CGPA / Grade']))]
  ];
  const academicTable = body.appendTable(academicRows);
  v2AiReportStyleGrid_(academicTable, [0]);

  v2AiReportSection_(body, '3. CV / Resume Assessment');
  const cvRows = [
    ['AREA', 'AI FINDING', 'EVIDENCE / USE IN SCREENING'],
    ['Relevant Work Experience',
      relevantExperience || 'PENDING',
      String(normalized.workExperienceSummary || aiRecord['Work Experience Summary'] || 'CV/resume reviewed for programme-relevant employment evidence.')],
    ['Experience Rationale',
      String(normalized.workExperienceRationale || (relevantExperience === 'YES' ? 'Relevant experience identified.' : relevantExperience === 'NO' ? 'No sufficient programme-relevant experience identified.' : 'Pending evidence.')),
      'Used to populate the Relevant Work Experience screening input.'],
    ['Cross-document consistency',
      unresolvedFlags.length ? 'FLAGGED FOR REVIEW' : 'NO MAJOR CONFLICT IDENTIFIED',
      'AI cross-checks qualification claims, academic evidence and CV/resume against available applicant data.']
  ];
  const cvTable = body.appendTable(cvRows);
  v2AiReportStyleGrid_(cvTable, [0]);

  v2AiReportSection_(body, '4. Evidence Trace');
  const evidenceRows = [['AI FINDING', 'SOURCE / TRACE']];
  if (Array.isArray(evidence) && evidence.length) {
    evidence.slice(0, 8).forEach(function(item) {
      if (item && typeof item === 'object') {
        evidenceRows.push([
          String(item.finding || item.label || item.type || 'Evidence'),
          String(item.source || item.evidence || item.text || JSON.stringify(item))
        ]);
      } else {
        evidenceRows.push(['Supporting evidence', String(item)]);
      }
    });
  } else {
    evidenceRows.push(['Supporting evidence', 'No granular evidence trace was returned by the AI provider.']);
  }
  const evidenceTable = body.appendTable(evidenceRows);
  v2AiReportStyleGrid_(evidenceTable, [0]);

  if (Array.isArray(sourceDocuments) && sourceDocuments.length) {
    const sourceLine = body.appendParagraph('Documents reviewed: ' + sourceDocuments.map(function(item) {
      return String(item.fileName || item.field || 'Document');
    }).join('; '));
    sourceLine.editAsText().setFontFamily('Arial').setFontSize(7).setForegroundColor('#66716D');
  }

  v2AiReportSection_(body, '5. Qualification Rule Assessment');
  const routeTitle = v2AiReportRouteTitle_(recommendation, manualRequired);
  const routeTable = body.appendTable([
    ['AI / RULE ENGINE OUTPUT'],
    [routeTitle],
    [v2AiReportRouteNarrative_(recommendation, manualRequired, qs, unresolvedFlags)]
  ]);
  v2AiReportStyleRoute_(routeTable, manualRequired);

  if (manualRequired || unresolvedFlags.length) {
    v2AiReportSection_(body, '6. Human Confirmation / Exception');
    const humanRows = [['ITEM', 'STATUS / ACTION']];
    if (unresolvedFlags.length) {
      unresolvedFlags.forEach(function(flag) {
        humanRows.push([String(flag), 'Human confirmation or additional evidence required before the screening route is finalised.']);
      });
    }
    if (String(qs['Manual Review Required'] || wf['Manual Review Required'] || '').toUpperCase() === 'YES') {
      humanRows.push(['Qualification rule exception', 'Authorised manual academic review is required.']);
    }
    const humanTable = body.appendTable(humanRows);
    v2AiReportStyleGrid_(humanTable, [0]);
  }

  v2AiReportSection_(body, manualRequired ? '7. AI Screening Declaration' : '6. AI Screening Declaration');
  const declaration = body.appendTable([[
    'This screening was performed by the IUC Admission Intelligence Agent. ' +
    'The AI reviewed the submitted academic certificate, transcript and CV/resume to extract academic facts, ' +
    'assess field relationship and relevant work experience, and prepare the screening input for the approved IUC qualification rule engine. ' +
    'Where institutional equivalency, policy exception or authorised academic judgement is required, the item is flagged instead of being assumed.\n\n' +
    'This report is an official internal screening record for Registry and SAC use. It does not replace the authorised SAC decision.'
  ]]);
  declaration.setBorderColor('#4A2A78').setBorderWidth(1);
  declaration.getCell(0,0).setBackgroundColor('#F7F5FB');
  declaration.getCell(0,0).editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#17231E');

  const meta = body.appendParagraph(
    'Template: ' + V2_AI_SCREENING_REPORT_TEMPLATE +
    ' | AI Provider: ' + String(aiRecord['Provider'] || '') +
    ' | Model: ' + String(aiRecord['Model'] || '') +
    ' | AI Run ID: ' + String(aiRecord['AI Run ID'] || '') +
    ' | Generated: ' + now
  );
  meta.editAsText().setFontFamily('Arial').setFontSize(6.5).setForegroundColor('#7A817E');

  doc.saveAndClose();

  const pdfBlob = DriveApp.getFileById(docId).getBlob().getAs(MimeType.PDF).setName(fileName);

  // Avoid duplicate exact-name generated reports.
  const duplicates = folder.getFilesByName(fileName);
  while (duplicates.hasNext()) {
    const duplicate = duplicates.next();
    try { duplicate.setTrashed(true); } catch (_) {}
  }

  const pdf = folder.createFile(pdfBlob);
  try { DriveApp.getFileById(docId).setTrashed(true); } catch (_) {}

  const updates = {
    'Rule Engine Input Source': v2AiReportInputSource_(aiRecord, qs),
    'Report Status': reportStatus,
    'Report Version': String(version),
    'Report PDF URL': pdf.getUrl(),
    'Report File ID': pdf.getId(),
    'Report Generated At': now,
    'Report Finalized At': finalised ? now : String(aiRecord['Report Finalized At'] || ''),
    'Last Updated': now
  };
  v2UpdateRow_(ai.sheet, ai.rowNumber, updates);

  v2Audit_(
    reference,
    'AI_SCREENING',
    finalised ? 'FINALIZE_AI_SCREENING_REPORT' : 'GENERATE_AI_SCREENING_REPORT',
    {},
    {
      template: V2_AI_SCREENING_REPORT_TEMPLATE,
      reportStatus: reportStatus,
      reportVersion: version,
      fileName: fileName,
      fileId: pdf.getId(),
      recommendedRoute: recommendation,
      fieldClassification: fieldClassification,
      relevantWorkExperience: relevantExperience
    },
    generatedBy,
    'SUCCESS',
    'Official AI-assisted screening report saved to the student folder.'
  );

  v2InvalidateCache_();
  return {
    ok: true,
    referenceNo: reference,
    reportStatus: reportStatus,
    reportVersion: version,
    finalised: finalised,
    fileName: fileName,
    fileId: pdf.getId(),
    url: pdf.getUrl(),
    folderId: folderId,
    template: V2_AI_SCREENING_REPORT_TEMPLATE
  };
}

function v2AiReportEnsureHeaders_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName('V2_AI_SCREENING');
  if (!sheet) throw new Error('V2_AI_SCREENING sheet is missing.');
  const expected = V2_AI_SCREENING_HEADERS.concat(V2_AI_SCREENING_REPORT_HEADERS);
  v2EnsureHeaders_(sheet, expected);
}

function v2AiReportAddHeader_(body) {
  const table = body.appendTable([['', '', '']]);
  table.setBorderWidth(0);
  const left = table.getCell(0,0);
  const centre = table.getCell(0,1);
  const right = table.getCell(0,2);
  try {
    const iuc = left.appendImage(DriveApp.getFileById(V2_AI_REPORT_IUC_LOGO_ID).getBlob());
    v2AiReportScaleImage_(iuc, 120, 42);
  } catch (_) {
    left.appendParagraph('INNOVATIVE UNIVERSITY COLLEGE');
  }
  centre.appendParagraph('');
  try {
    const ipgs = right.appendImage(DriveApp.getFileById(V2_AI_REPORT_IPGS_LOGO_ID).getBlob());
    v2AiReportScaleImage_(ipgs, 105, 42);
  } catch (_) {
    right.appendParagraph('IPGS');
  }
  right.getChild(right.getNumChildren()-1).getParent();
  body.appendHorizontalRule();
}

function v2AiReportScaleImage_(image, maxWidth, maxHeight) {
  const w = image.getWidth();
  const h = image.getHeight();
  const scale = Math.min(maxWidth / w, maxHeight / h, 1);
  image.setWidth(Math.round(w * scale));
  image.setHeight(Math.round(h * scale));
}

function v2AiReportSection_(body, text) {
  const p = body.appendParagraph(text);
  p.editAsText().setFontFamily('Arial').setFontSize(10).setBold(true).setForegroundColor('#17231E');
  p.setSpacingBefore(8).setSpacingAfter(4);
  return p;
}

function v2AiReportStyleInfoTable_(table) {
  table.setBorderColor('#DDE3E0').setBorderWidth(1);
  for (let r = 0; r < table.getNumRows(); r++) {
    for (let c = 0; c < table.getRow(r).getNumCells(); c++) {
      const cell = table.getCell(r,c);
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      if (c === 0 || c === 2) cell.setBackgroundColor('#F7F9F8');
      cell.editAsText().setFontFamily('Arial').setFontSize(7.5).setBold(c === 0 || c === 2);
    }
  }
}

function v2AiReportStyleGrid_(table, headerRows) {
  table.setBorderColor('#DDE3E0').setBorderWidth(1);
  const headerMap = {};
  (headerRows || [0]).forEach(function(i){headerMap[i] = true;});
  for (let r = 0; r < table.getNumRows(); r++) {
    for (let c = 0; c < table.getRow(r).getNumCells(); c++) {
      const cell = table.getCell(r,c);
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      if (headerMap[r]) cell.setBackgroundColor('#17231E');
      cell.editAsText()
        .setFontFamily('Arial')
        .setFontSize(7)
        .setBold(!!headerMap[r])
        .setForegroundColor(headerMap[r] ? '#FFFFFF' : '#17231E');
    }
  }
}

function v2AiReportStyleRoute_(table, warning) {
  table.setBorderColor(warning ? '#A36A00' : '#0D7A55').setBorderWidth(1);
  table.getCell(0,0).setBackgroundColor(warning ? '#A36A00' : '#0D7A55');
  table.getCell(0,0).editAsText().setFontFamily('Arial').setFontSize(7).setBold(true).setForegroundColor('#FFFFFF');
  table.getCell(1,0).setBackgroundColor(warning ? '#FFF7E1' : '#EAF7F1');
  table.getCell(1,0).editAsText().setFontFamily('Arial').setFontSize(11).setBold(true).setForegroundColor(warning ? '#8A5A00' : '#0D7A55');
  table.getCell(2,0).setBackgroundColor(warning ? '#FFF7E1' : '#EAF7F1');
  table.getCell(2,0).editAsText().setFontFamily('Arial').setFontSize(8).setForegroundColor('#17231E');
}

function v2AiReportRouteTitle_(route, manualRequired) {
  if (manualRequired) return 'PENDING AUTHORISED REVIEW';
  if (!route) return 'SCREENING COMPLETED - ROUTE PENDING';
  return String(route).replace(/_/g, ' ');
}

function v2AiReportRouteNarrative_(route, manualRequired, qs, flags) {
  if (manualRequired) {
    const flagText = flags && flags.length ? ' Outstanding item(s): ' + flags.join('; ') + '.' : '';
    return 'The AI screening record contains an item that requires human confirmation or authorised academic review before the case may proceed.' + flagText;
  }
  const rule = String(qs && qs['Rule Code'] || '').trim();
  return 'The Admission Intelligence Agent supplied the screened inputs to the approved IUC qualification rule engine. ' +
    'The rule engine returned ' + (route ? String(route).replace(/_/g, ' ') : 'a screening result') +
    (rule ? ' under rule ' + rule + '.' : '.');
}

function v2AiReportDefaultFieldRationale_(classification, programme) {
  const field = String(classification || '').toUpperCase();
  if (field === 'RELATED') return 'The submitted academic qualification is assessed as directly related to the applied programme.';
  if (field === 'PARTIALLY_RELATED') return 'The submitted academic qualification has partial disciplinary relevance and may require academic judgement.';
  if (field === 'NON_RELATED') return 'The submitted academic qualification is not directly related to the applied programme.';
  return 'Field relationship could not be finalised from the available evidence.';
}

function v2AiReportGradeStatus_(value) {
  const text = String(value || '').trim();
  if (!text) return 'NOT AVAILABLE';
  if (/\b\d+(?:\.\d+)?\s*%/.test(text) || /FIRST\s+DIVISION|SECOND\s+DIVISION|GRADE/i.test(text) && !/CGPA|GPA/i.test(text)) {
    return 'PENDING IUC EQUIVALENCY CONFIRMATION';
  }
  return 'RESULT IDENTIFIED';
}

function v2AiReportGradeNote_(value) {
  const status = v2AiReportGradeStatus_(value);
  if (/PENDING/.test(status)) {
    return 'The submitted grading format must not be automatically converted to an IUC CGPA threshold unless an approved equivalency is available.';
  }
  return 'Academic result identified from the submitted transcript and used by the applicable screening rule where possible.';
}

function v2AiReportInputSource_(ai, qs) {
  if (String(ai['Human Review Status'] || '').toUpperCase() === 'CONFIRMED') return 'HUMAN_CONFIRMED_AI';
  if (qs && String(qs['Screened By'] || '').toUpperCase().indexOf('AI') > -1) return 'AI_AGENT';
  return 'AI_SCREENING';
}

function v2AiReportPercent_(value) {
  const n = Number(value);
  if (!isFinite(n)) return '';
  return Math.round((n <= 1 ? n * 100 : n)) + '%';
}

function v2AiReportProgrammeCode_(programme) {
  const text = String(programme || '').toUpperCase();
  if (/MASTER OF BUSINESS ADMINISTRATION|\bMBA\b/.test(text)) return 'MBA';
  if (/MASTER OF BUSINESS MANAGEMENT|\bMBM\b/.test(text)) return 'MBM';
  if (/HAJJ|HAJ|UMRAH|MHUM/.test(text)) return 'MHUM';
  if (/MASTER OF INFORMATION|\bMIM\b|\bMIS\b/.test(text)) return 'MIM';
  if (/PHD|PH\.D|DOCTOR OF PHILOSOPHY/.test(text)) return 'PHD';
  if (/DOCTOR OF BUSINESS ADMINISTRATION|\bDBA\b/.test(text)) return 'DBA';
  return String(programme || 'PROGRAMME').split(/\s+-\s+/)[0] || 'PROGRAMME';
}

function v2AiReportFileToken_(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 70) || 'UNKNOWN';
}

function v2AiReportExtractDriveId_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^[A-Za-z0-9_-]{20,}$/.test(text)) return text;
  const patterns = [
    /\/d\/([A-Za-z0-9_-]{20,})/,
    /\/folders\/([A-Za-z0-9_-]{20,})/,
    /[?&]id=([A-Za-z0-9_-]{20,})/
  ];
  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (match) return match[1];
  }
  return '';
}

function v2AiReportParseJson_(value, fallback) {
  try {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'object') return value;
    return JSON.parse(String(value));
  } catch (_) {
    return fallback;
  }
}
