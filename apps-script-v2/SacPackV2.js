/**
 * IUC IPGS Admission V2 - Standardised PG Eligibility Form + SAC Print Pack
 *
 * Production intent:
 * - One PG-ADM-01 form for all postgraduate programmes.
 * - Form is generated into the student's Drive folder only.
 * - The form is the first page/document for that candidate and acts as the separator.
 * - SAC print preparation reports missing files but allows Admin to choose Proceed or Skip.
 * - SAC decision remains physical/manual and is recorded in the system only after the meeting.
 * - Prerequisite is never an initial SAC outcome; it may only arise after IA.
 */

const V2_PG_ELIGIBILITY_FORM_VERSION = 'PG-ADM-01-V1';

const V2_SAC_PACK_CANDIDATE_HEADERS = [
  'Document Pack Status',
  'Missing Document Count',
  'Missing Documents JSON',
  'Pack Prepared At',
  'PG Eligibility Form Version'
];

const V2_SAC_PACK_SESSION_HEADERS = [
  'Pack Complete Count',
  'Pack Incomplete Count',
  'Pack Prepared At'
];

function v2PrepareSacPack_(data, actor) {
  assertDevIdentity_();

  const sessionId = String(data && data.sessionId || '').trim();
  const preparedBy = String(actor || data && data.preparedBy || 'Admin Portal V2').trim();
  if (!sessionId) throw new Error('SAC Session ID is required.');

  const session = v2Find_('V2_SAC_SESSIONS', 'SAC Session ID', sessionId);
  if (!session) throw new Error('SAC session not found.');

  v2SacPackEnsureHeaders_();

  const candidates = v2SacPackCandidatesForSession_(sessionId);
  if (!candidates.length) {
    return {
      ok: true,
      sessionId: sessionId,
      sessionName: session.record['SAC Name'] || sessionId,
      candidateCount: 0,
      completeCount: 0,
      incompleteCount: 0,
      candidates: [],
      message: 'No candidates are assigned to this SAC session.',
      v1Touched: false
    };
  }

  const preparedAt = new Date().toISOString();
  const resultCandidates = candidates.map(function(candidate) {
    const reference = String(candidate.record['Reference No'] || '').trim();
    if (!reference) throw new Error('SAC candidate is missing Reference No.');

    const form = v2GeneratePgEligibilityForm_(reference, sessionId, preparedBy);
    const manifest = v2BuildSacCandidateManifest_(sessionId, reference, false);

    v2UpdateRow_(candidate.sheet, candidate.rowNumber, {
      'Form 01 URL': form.url,
      'Document Pack Status': manifest.complete ? 'COMPLETE' : 'INCOMPLETE',
      'Missing Document Count': manifest.missingDocuments.length,
      'Missing Documents JSON': JSON.stringify(manifest.missingDocuments),
      'Pack Prepared At': preparedAt,
      'PG Eligibility Form Version': V2_PG_ELIGIBILITY_FORM_VERSION
    });

    return {
      referenceNo: reference,
      studentName: manifest.studentName,
      programme: manifest.programme,
      complete: manifest.complete,
      missingDocuments: manifest.missingDocuments,
      documentCount: manifest.documents.length,
      documents: manifest.documents.map(function(doc) {
        return {
          key: doc.key,
          label: doc.label,
          fileName: doc.fileName,
          mimeType: doc.mimeType
        };
      })
    };
  });

  const completeCount = resultCandidates.filter(function(item) { return item.complete; }).length;
  const incompleteCount = resultCandidates.length - completeCount;

  v2UpdateRow_(session.sheet, session.rowNumber, {
    'Candidate Count': resultCandidates.length,
    'Pack Complete Count': completeCount,
    'Pack Incomplete Count': incompleteCount,
    'Pack Prepared At': preparedAt
  });

  v2Audit_('', 'SAC', 'PREPARE_PRINT_PACK', {}, {
    sessionId: sessionId,
    candidateCount: resultCandidates.length,
    completeCount: completeCount,
    incompleteCount: incompleteCount
  }, preparedBy, 'SUCCESS', 'PG-ADM-01 generated into student folders. No SAC decision recorded.');

  v2InvalidateCache_();

  return {
    ok: true,
    sessionId: sessionId,
    sessionName: session.record['SAC Name'] || sessionId,
    meetingDate: session.record['Meeting Date'] || '',
    candidateCount: resultCandidates.length,
    completeCount: completeCount,
    incompleteCount: incompleteCount,
    candidates: resultCandidates,
    formVersion: V2_PG_ELIGIBILITY_FORM_VERSION,
    prerequisitePolicy: 'PREREQUISITE_AFTER_IA_ONLY',
    v1Touched: false
  };
}

function v2GetSacPackFile_(data) {
  assertDevIdentity_();

  const sessionId = String(data && data.sessionId || '').trim();
  const reference = String(data && data.referenceNo || '').trim();
  const documentKey = String(data && data.documentKey || '').trim();

  if (!sessionId) throw new Error('SAC Session ID is required.');
  if (!reference) throw new Error('Reference No is required.');
  if (!documentKey) throw new Error('Document key is required.');

  const candidate = v2SacPackFindCandidate_(sessionId, reference);
  if (!candidate) throw new Error('Candidate is not assigned to this SAC session.');

  const manifest = v2BuildSacCandidateManifest_(sessionId, reference, false);
  const doc = manifest.documents.filter(function(item) {
    return item.key === documentKey;
  })[0];

  if (!doc || !doc.fileId) throw new Error('Requested SAC pack document was not found.');

  const file = DriveApp.getFileById(doc.fileId);
  const prepared = v2SacPackPrintableBlob_(file);
  const bytes = prepared.blob.getBytes();

  return {
    ok: true,
    sessionId: sessionId,
    referenceNo: reference,
    documentKey: documentKey,
    fileName: prepared.fileName,
    mimeType: prepared.mimeType,
    base64: Utilities.base64Encode(bytes),
    size: bytes.length,
    v1Touched: false
  };
}

function v2GeneratePgEligibilityForm_(referenceNo, sessionId, actor) {
  const reference = String(referenceNo || '').trim();
  if (!reference) throw new Error('Reference No is required for PG-ADM-01.');

  const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  const candidate = v2SacPackFindCandidate_(sessionId, reference);

  if (!application) throw new Error('V2 application record not found.');
  if (!workflow) throw new Error('V2 workflow record not found.');
  if (!candidate) throw new Error('SAC candidate record not found.');

  const folderId = v2SacPackExtractDriveId_(
    application.record['Student Folder URL'] || workflow.record['Student Folder URL'] || ''
  );
  if (!folderId) throw new Error('Student folder could not be resolved for PG-ADM-01.');

  const folder = DriveApp.getFolderById(folderId);
  const studentName = String(application.record['Student Name'] || workflow.record['Student Name'] || '').trim();
  const safeName = v2SacPackSafeFileName_(studentName || reference);
  const safeRef = v2SacPackSafeFileName_(reference);
  const pdfName = 'PG-ADM-01_' + safeName + '_' + safeRef + '.pdf';

  const raw = v2SacPackParseJson_(application.record['Raw Application JSON'], {});
  const programme = String(application.record['Programme'] || workflow.record['Programme'] || '').trim();
  const level = String(application.record['Level of Study'] || workflow.record['Level of Study'] || '').trim();
  const intake = String(application.record['Intake'] || workflow.record['Intake'] || '').trim();
  const highestQualification = String(application.record['Highest Qualification'] || '').trim();
  const institution = String(application.record['Institution / Awarding Body'] || '').trim();
  const field = String(application.record['Field of Study'] || '').trim();
  const result = String(application.record['Academic Result / CGPA / Grade'] || '').trim();
  const nationality = String(raw.nationality || raw.country || '').trim();
  const fieldClass = String(workflow.record['Field Classification'] || '').trim();
  const workExperience = String(workflow.record['Relevant Work Experience'] || '').trim();
  const recommendation = String(workflow.record['Screening Recommendation'] || '').trim();
  const documentStatus = String(workflow.record['Document Review Status'] || '').trim();
  const isResearch = /PHD|DOCTOR OF PHILOSOPHY|RESEARCH/i.test(programme + ' ' + level);

  // Replace the previous generated version so the folder keeps one current pre-SAC copy.
  const oldFiles = folder.getFilesByName(pdfName);
  while (oldFiles.hasNext()) {
    try { oldFiles.next().setTrashed(true); } catch (_) {}
  }

  const doc = DocumentApp.create('TEMP_' + pdfName.replace(/\.pdf$/i, ''));
  const docFile = DriveApp.getFileById(doc.getId());
  docFile.moveTo(folder);

  const body = doc.getBody();
  body.setMarginTop(28).setMarginBottom(28).setMarginLeft(32).setMarginRight(32);

  const header = body.appendParagraph('INNOVATIVE UNIVERSITY COLLEGE | POSTGRADUATE ADMISSION');
  header.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  header.editAsText().setFontSize(8).setBold(true).setForegroundColor('#4B2E83');

  const title = body.appendParagraph('FORM PG-ADM-01: POSTGRADUATE ELIGIBILITY & ADMISSION ROUTE DETERMINATION CHECKLIST');
  title.setSpacingBefore(8).setSpacingAfter(8);
  title.editAsText().setFontSize(13).setBold(true).setForegroundColor('#4B2E83');

  const info = body.appendTable();
  v2SacPackInfoRow_(info, 'Applicant name', studentName, 'Application no.', reference);
  v2SacPackInfoRow_(info, 'Programme', programme, 'Intake', intake);
  v2SacPackInfoRow_(info, 'Nationality', nationality, 'Level', level);
  v2SacPackInfoRow_(info, 'Highest qualification', highestQualification, 'Institution', institution);
  v2SacPackInfoRow_(info, 'Field / major', field, 'CGPA / equivalent', result);
  v2SacPackStyleInfoTable_(info);

  body.appendParagraph('Eligibility Check').editAsText().setBold(true).setForegroundColor('#4B2E83').setFontSize(10);

  const checklist = body.appendTable([
    ['Check', 'Yes', 'No', 'N/A', 'Evidence / Remarks'],
    ['Qualification is recognised/equivalent to the required entry level for the applied programme.', '[ ]', '[ ]', '[ ]', highestQualification || ''],
    ['Minimum academic result / CGPA / equivalent requirement is met.', '[ ]', '[ ]', '[ ]', result || ''],
    ['Academic field classification has been confirmed.', '[ ]', '[ ]', '[ ]', fieldClass ? 'Field: ' + fieldClass : ''],
    ['Relevant working experience is claimed, where applicable.', '[ ]', '[ ]', '[ ]', workExperience ? 'Work experience: ' + workExperience : ''],
    ['Relevant working experience has been verified, where applicable.', '[ ]', '[ ]', '[ ]', 'CV / employer evidence'],
    ['Applicable English-language requirement is met.', '[ ]', '[ ]', '[ ]', 'Approved evidence'],
    ['Application file is complete and authentic.', documentStatus === 'COMPLETE' ? '[X]' : '[ ]', documentStatus === 'COMPLETE' ? '[ ]' : '[X]', '[ ]', documentStatus || 'Registry check'],
    ['Research-methodology preparation is demonstrated. (Research programme only)', '[ ]', '[ ]', isResearch ? '[ ]' : '[X]', isResearch ? 'Transcript / certificate / writing sample' : 'Not applicable'],
    ['Preliminary Research Intent is within the programme field and researchable. (Research programme only)', '[ ]', '[ ]', isResearch ? '[ ]' : '[X]', isResearch ? 'Preliminary topic screening' : 'Not applicable'],
    ['Suitable supervisory expertise and capacity are available. (Research programme only)', '[ ]', '[ ]', isResearch ? '[ ]' : '[X]', isResearch ? 'Supervisor-fit / capacity record' : 'Not applicable']
  ]);
  v2SacPackStyleChecklist_(checklist);

  body.appendParagraph('Admission Route Recommendation').editAsText().setBold(true).setForegroundColor('#4B2E83').setFontSize(10);

  const route = v2SacPackRouteFlags_(recommendation);
  const routeTable = body.appendTable([
    ['Selection', 'Basis / Remarks'],
    [route.direct ? '[X] Direct / Normal Admission' : '[ ] Direct / Normal Admission', 'Eligible to proceed after authorised SAC decision.'],
    [route.ia ? '[X] Internal Assessment (IA)' : '[ ] Internal Assessment (IA)', 'Candidate requires rigorous internal assessment before final admission eligibility.'],
    [route.notEligible ? '[X] Not Eligible / Refer' : '[ ] Not Eligible / Refer', 'Minimum requirement, evidence or another mandatory condition is not met.'],
    [route.special ? '[X] Special Route / Further Academic Review' : '[ ] Special Route / Further Academic Review', 'Use only where an approved programme-specific route applies.']
  ]);
  v2SacPackStyleRouteTable_(routeTable);

  const policy = body.appendParagraph('Policy note: Prerequisite is not an initial SAC route. Where applicable, Prerequisite may only be required after the Internal Assessment result.');
  policy.setSpacingBefore(5).setSpacingAfter(10);
  policy.editAsText().setFontSize(8).setItalic(true).setForegroundColor('#5F6777');

  const signatures = body.appendTable([
    ['____________________________', '____________________________', '____________________________'],
    ['Signature / Date', 'Signature / Date', 'Signature / Date'],
    ['Checked by\nAdmissions Officer', 'Academic field/topic classification\nProgramme Leader', 'Verified by\nRegistrar / Dean']
  ]);
  signatures.setBorderWidth(0);
  for (let r = 0; r < signatures.getNumRows(); r++) {
    for (let c = 0; c < signatures.getRow(r).getNumCells(); c++) {
      const cell = signatures.getCell(r, c);
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      const paragraphs = cell.getParagraphs();
      paragraphs.forEach(function(p) {
        p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        p.editAsText().setFontSize(r === 0 ? 8 : 7);
      });
    }
  }

  const footer = body.appendParagraph('Controlled Document | Internal Use | ' + V2_PG_ELIGIBILITY_FORM_VERSION + ' | SAC: ' + String(sessionId || ''));
  footer.setAlignment(DocumentApp.HorizontalAlignment.CENTER).setSpacingBefore(8);
  footer.editAsText().setFontSize(7).setForegroundColor('#777777');

  doc.saveAndClose();

  const sourceFile = DriveApp.getFileById(doc.getId());
  const pdfBlob = sourceFile.getBlob().getAs(MimeType.PDF).setName(pdfName);
  const pdfFile = folder.createFile(pdfBlob);
  try { sourceFile.setTrashed(true); } catch (_) {}

  v2Audit_(reference, 'SAC', 'GENERATE_PG_ADM_01', {}, {
    sessionId: sessionId,
    fileName: pdfName,
    url: pdfFile.getUrl(),
    version: V2_PG_ELIGIBILITY_FORM_VERSION
  }, actor || 'Admin Portal V2', 'SUCCESS', 'Standardised PG eligibility form saved to student folder.');

  return {
    ok: true,
    referenceNo: reference,
    fileId: pdfFile.getId(),
    fileName: pdfName,
    url: pdfFile.getUrl(),
    version: V2_PG_ELIGIBILITY_FORM_VERSION
  };
}

function v2BuildSacCandidateManifest_(sessionId, referenceNo, generateForm) {
  const reference = String(referenceNo || '').trim();
  const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  const candidate = v2SacPackFindCandidate_(sessionId, reference);

  if (!application) throw new Error('V2 application record not found for ' + reference + '.');
  if (!workflow) throw new Error('V2 workflow record not found for ' + reference + '.');
  if (!candidate) throw new Error('SAC candidate record not found for ' + reference + '.');

  if (generateForm || !candidate.record['Form 01 URL']) {
    const generated = v2GeneratePgEligibilityForm_(reference, sessionId, 'SAC Pack Preparation');
    candidate.record['Form 01 URL'] = generated.url;
  }

  const required = v2SacPackRequiredDocs_(application.record);
  const submitted = v2SacPackSubmittedDocs_(application.record);
  const submittedByKey = {};
  submitted.forEach(function(doc) {
    const key = String(doc.field || '').trim();
    if (key && !submittedByKey[key]) submittedByKey[key] = doc;
  });

  const missing = [];
  required.forEach(function(req) {
    if (!submittedByKey[req.key]) missing.push({key:req.key, label:req.label});
  });

  const documents = [];
  const formId = v2SacPackExtractDriveId_(candidate.record['Form 01 URL'] || '');
  if (formId) documents.push(v2SacPackManifestDoc_('form01', 'PG-ADM-01 Eligibility Form', formId));
  else missing.unshift({key:'form01', label:'PG-ADM-01 Eligibility Form'});

  const admissionFormId = v2SacPackExtractDriveId_(application.record['Admission Form PDF URL'] || '');
  if (admissionFormId) documents.push(v2SacPackManifestDoc_('admissionForm', 'Admission Form', admissionFormId));
  else missing.push({key:'admissionForm', label:'Admission Form PDF'});

  const priority = [
    'identityDocument','passportCopyInternational','passportPhoto','transcript','certificate',
    'apelCertificate','cvResume','preliminaryResearchIntent','englishCertificate',
    'completedAdmissionForm','completedHealthDeclaration','emgsPaymentReceipt','otherSupportingDocument'
  ];

  submitted.sort(function(a, b) {
    const ai = priority.indexOf(String(a.field || ''));
    const bi = priority.indexOf(String(b.field || ''));
    return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
  }).forEach(function(doc, index) {
    const fileId = String(doc.fileId || v2SacPackExtractDriveId_(doc.url || '') || '').trim();
    if (!fileId) return;
    const key = 'upload:' + String(doc.field || 'document') + ':' + index;
    documents.push({
      key: key,
      label: String(doc.label || doc.fileName || doc.field || 'Supporting Document'),
      fileId: fileId,
      fileName: String(doc.fileName || ''),
      mimeType: String(doc.mimeType || '')
    });
  });

  // Deduplicate missing labels if the same requirement is reported twice.
  const seenMissing = {};
  const missingUnique = missing.filter(function(item) {
    const key = String(item.key || item.label || '');
    if (seenMissing[key]) return false;
    seenMissing[key] = true;
    return true;
  });

  return {
    referenceNo: reference,
    studentName: application.record['Student Name'] || workflow.record['Student Name'] || '',
    programme: application.record['Programme'] || workflow.record['Programme'] || '',
    complete: missingUnique.length === 0,
    missingDocuments: missingUnique,
    documents: documents
  };
}

function v2SacPackPrintableBlob_(file) {
  const mime = String(file.getMimeType() || '');
  const name = String(file.getName() || 'document');

  if (mime === MimeType.PDF || mime === 'application/pdf') {
    return {blob:file.getBlob(), mimeType:'application/pdf', fileName:name};
  }

  if (/^image\/(png|jpeg|jpg)$/i.test(mime)) {
    return {blob:file.getBlob(), mimeType:mime, fileName:name};
  }

  if (/^application\/vnd\.google-apps\.(document|spreadsheet|presentation)$/i.test(mime)) {
    const url = 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(file.getId()) + '/export?mimeType=application%2Fpdf';
    const response = UrlFetchApp.fetch(url, {
      headers: {Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
      muteHttpExceptions: true
    });
    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
      const blob = response.getBlob().setName(name.replace(/\.[^.]+$/, '') + '.pdf');
      return {blob:blob, mimeType:'application/pdf', fileName:blob.getName()};
    }
  }

  try {
    const converted = file.getBlob().getAs(MimeType.PDF).setName(name.replace(/\.[^.]+$/, '') + '.pdf');
    return {blob:converted, mimeType:'application/pdf', fileName:converted.getName()};
  } catch (error) {
    throw new Error('Document cannot be converted for printing: ' + name + '. ' + String(error && error.message || error));
  }
}

function v2SacPackRequiredDocs_(applicationRecord) {
  if (typeof v2GetRequiredDocuments_ === 'function') {
    return v2GetRequiredDocuments_(applicationRecord);
  }

  const applicantType = String(applicationRecord['Applicant Type'] || '').toUpperCase();
  const programme = String(applicationRecord['Programme'] || '').toUpperCase();
  const out = [];
  const add = function(key, label) {
    if (!out.some(function(item) { return item.key === key; })) out.push({key:key, label:label});
  };

  add('passportPhoto', 'Passport Size Photo');
  if (/INTERNATIONAL|NON-MALAYSIAN/.test(applicantType)) add('passportCopyInternational', 'Passport Copy');
  else add('identityDocument', 'Identity Document / NRIC');
  add('transcript', 'Highest Academic Transcript');
  add('certificate', 'Highest Academic Certificate');
  if (/PHD|DOCTOR OF PHILOSOPHY/.test(programme)) add('preliminaryResearchIntent', 'Preliminary Research Intent');
  return out;
}

function v2SacPackSubmittedDocs_(applicationRecord) {
  if (typeof v2GetSubmittedDocuments_ === 'function') {
    return v2GetSubmittedDocuments_(applicationRecord);
  }
  const parsed = v2SacPackParseJson_(applicationRecord['Uploaded Files JSON'], []);
  return Array.isArray(parsed) ? parsed : [];
}

function v2SacPackEnsureHeaders_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const candidateSheet = ss.getSheetByName('V2_SAC_CANDIDATES');
  const sessionSheet = ss.getSheetByName('V2_SAC_SESSIONS');
  if (!candidateSheet || !sessionSheet) throw new Error('SAC foundation sheets are missing.');

  const candidateHeaders = V2_HEADERS.V2_SAC_CANDIDATES.concat(V2_SAC_PACK_CANDIDATE_HEADERS);
  const sessionHeaders = V2_HEADERS.V2_SAC_SESSIONS.concat(V2_SAC_PACK_SESSION_HEADERS);
  v2EnsureHeaders_(candidateSheet, candidateHeaders);
  v2EnsureHeaders_(sessionSheet, sessionHeaders);
}

function v2SacPackCandidatesForSession_(sessionId) {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName('V2_SAC_CANDIDATES');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(function(value) { return String(value || '').trim(); });
  return values.map(function(row, index) {
    const record = {};
    headers.forEach(function(header, i) { record[header] = row[i]; });
    return {sheet:sheet, rowNumber:index + 2, record:record};
  }).filter(function(item) {
    return String(item.record['SAC Session ID'] || '') === String(sessionId || '');
  });
}

function v2SacPackFindCandidate_(sessionId, referenceNo) {
  const candidates = v2SacPackCandidatesForSession_(sessionId);
  const reference = String(referenceNo || '').trim();
  for (let i = 0; i < candidates.length; i++) {
    if (String(candidates[i].record['Reference No'] || '').trim() === reference) return candidates[i];
  }
  return null;
}

function v2SacPackManifestDoc_(key, label, fileId) {
  const file = DriveApp.getFileById(fileId);
  return {
    key: key,
    label: label,
    fileId: fileId,
    fileName: file.getName(),
    mimeType: file.getMimeType()
  };
}

function v2SacPackRouteFlags_(recommendation) {
  const route = String(recommendation || '').toUpperCase();
  return {
    direct: /DIRECT_ENTRY|NORMAL_ADMISSION_SCREENING|NORMAL_ADMISSION/.test(route),
    ia: /INTERNAL_ASSESSMENT|EXCEPTIONAL_INTERNAL_ASSESSMENT/.test(route),
    notEligible: /NOT_ELIGIBLE|REJECT/.test(route),
    special: !!route && !/DIRECT_ENTRY|NORMAL_ADMISSION_SCREENING|NORMAL_ADMISSION|INTERNAL_ASSESSMENT|EXCEPTIONAL_INTERNAL_ASSESSMENT|NOT_ELIGIBLE|REJECT/.test(route)
  };
}

function v2SacPackInfoRow_(table, leftLabel, leftValue, rightLabel, rightValue) {
  const row = table.appendTableRow();
  row.appendTableCell(leftLabel);
  row.appendTableCell(leftValue || '');
  row.appendTableCell(rightLabel);
  row.appendTableCell(rightValue || '');
}

function v2SacPackStyleInfoTable_(table) {
  table.setBorderColor('#C9C4DA').setBorderWidth(1);
  for (let r = 0; r < table.getNumRows(); r++) {
    for (let c = 0; c < table.getRow(r).getNumCells(); c++) {
      const cell = table.getCell(r, c);
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      if (c === 0 || c === 2) cell.setBackgroundColor('#F1EFF8');
      cell.getParagraphs().forEach(function(p) {
        p.editAsText().setFontSize(8).setBold(c === 0 || c === 2);
      });
    }
  }
}

function v2SacPackStyleChecklist_(table) {
  table.setBorderColor('#C9C4DA').setBorderWidth(1);
  for (let r = 0; r < table.getNumRows(); r++) {
    for (let c = 0; c < table.getRow(r).getNumCells(); c++) {
      const cell = table.getCell(r, c);
      if (r === 0) cell.setBackgroundColor('#4B2E83');
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);
      cell.getParagraphs().forEach(function(p) {
        p.editAsText().setFontSize(7).setBold(r === 0).setForegroundColor(r === 0 ? '#FFFFFF' : '#222222');
        if (c > 0 && c < 4) p.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      });
    }
  }
}

function v2SacPackStyleRouteTable_(table) {
  table.setBorderColor('#C9C4DA').setBorderWidth(1);
  for (let r = 0; r < table.getNumRows(); r++) {
    for (let c = 0; c < table.getRow(r).getNumCells(); c++) {
      const cell = table.getCell(r, c);
      if (r === 0) cell.setBackgroundColor('#4B2E83');
      cell.getParagraphs().forEach(function(p) {
        p.editAsText().setFontSize(7).setBold(r === 0).setForegroundColor(r === 0 ? '#FFFFFF' : '#222222');
      });
    }
  }
}

function v2SacPackExtractDriveId_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^[A-Za-z0-9_-]{20,}$/.test(text)) return text;
  const patterns = [
    /\/d\/([A-Za-z0-9_-]{20,})/,
    /\/folders\/([A-Za-z0-9_-]{20,})/,
    /[?&]id=([A-Za-z0-9_-]{20,})/,
    /file\/d\/([A-Za-z0-9_-]{20,})/
  ];
  for (let i = 0; i < patterns.length; i++) {
    const match = text.match(patterns[i]);
    if (match) return match[1];
  }
  return '';
}

function v2SacPackParseJson_(value, fallback) {
  try {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'object') return value;
    return JSON.parse(String(value));
  } catch (_) {
    return fallback;
  }
}

function v2SacPackSafeFileName_(value) {
  return String(value || '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'STUDENT';
}
