/**
 * IUC IPGS Admission V2 - Academic Qualification Review & Admission Eligibility Confirmation
 *
 * Official institutional record for INTERNATIONAL applicants only.
 *
 * Policy:
 * - The approved locked IUC template is used for every generated document.
 * - A document is generated only after academic eligibility has been authorised.
 * - DIRECT_ENTRY requires the related SAC session to be finalised.
 * - IA / prerequisite routes generate only after a QUALIFIED outcome.
 * - The PDF is stored in the applicant's existing V2 student folder.
 * - The document is NEVER emailed or sent to the student by this module.
 * - Rejected / not-yet-qualified applicants do not receive an eligibility confirmation.
 */

const V2_AQC_BUILD = 'AQC_V2_20261004_LOCKED';
const V2_AQC_TEMPLATE_DOC_ID = '1F6avvLPXumyXb2EdP3_gelS6z0KMzblKcNWszzMP1Jc';
const V2_AQC_RECONCILE_HANDLER = 'v2AcademicEligibilityReconcileTrigger_';

const V2_AQC_WORKFLOW_HEADERS = [
  'Academic Eligibility Letter Required',
  'Academic Eligibility Letter Status',
  'Academic Eligibility Letter Reference',
  'Academic Eligibility Letter URL',
  'Academic Eligibility Letter File ID',
  'Academic Eligibility Letter Generated At',
  'Academic Eligibility Letter Trigger',
  'Academic Eligibility Letter Error',
  'Academic Eligibility Letter Version'
];

function v2AcademicEligibilityEnsureSchema_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName('V2_WORKFLOW');
  if (!sheet) throw new Error('V2_WORKFLOW sheet not found.');
  v2EnsureHeaders_(sheet, V2_AQC_WORKFLOW_HEADERS);
  return {ok:true, headers:V2_AQC_WORKFLOW_HEADERS.slice(), build:V2_AQC_BUILD};
}

function v2AcademicEligibilityEnsureTrigger_() {
  const existing = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === V2_AQC_RECONCILE_HANDLER;
  });
  if (existing.length) {
    return {ok:true, created:false, count:existing.length, handler:V2_AQC_RECONCILE_HANDLER};
  }
  const created = ScriptApp.newTrigger(V2_AQC_RECONCILE_HANDLER)
    .timeBased()
    .everyMinutes(5)
    .create();
  return {
    ok:true,
    created:true,
    count:1,
    handler:created.getHandlerFunction ? created.getHandlerFunction() : V2_AQC_RECONCILE_HANDLER
  };
}

function v2AcademicEligibilitySetup_() {
  const schema = v2AcademicEligibilityEnsureSchema_();
  let trigger = null;
  try {
    trigger = v2AcademicEligibilityEnsureTrigger_();
  } catch (error) {
    trigger = {ok:false, created:false, error:String(error && error.message || error)};
  }
  const reconciliation = v2AcademicEligibilityReconcileAll_('Academic Eligibility Setup');
  return {
    ok:true,
    build:V2_AQC_BUILD,
    templateDocId:V2_AQC_TEMPLATE_DOC_ID,
    schema:schema,
    trigger:trigger,
    reconciliation:reconciliation,
    emailSent:false
  };
}

function v2AcademicEligibilityReconcileTrigger_() {
  try {
    return v2AcademicEligibilityReconcileAll_('AQC Scheduled Reconciliation');
  } catch (error) {
    Logger.log('AQC scheduled reconciliation failed: ' + String(error && error.message || error));
    return {ok:false, error:String(error && error.message || error), emailSent:false};
  }
}

function v2AcademicEligibilityReconcileAll_(actor) {
  v2AcademicEligibilityEnsureSchema_();
  const workflows = v2Rows_('V2_WORKFLOW');
  const results = [];
  const errors = [];
  const owner = String(actor || 'AQC Reconciliation').trim();

  workflows.forEach(function(row) {
    const reference = String(row['Reference No'] || '').trim();
    if (!reference) return;
    const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
    if (!application || !v2AqcIsInternational_(application.record)) return;
    try {
      results.push(v2AcademicEligibilitySyncReference_(reference, owner, 'RECONCILIATION'));
    } catch (error) {
      errors.push({referenceNo:reference, error:String(error && error.message || error)});
    }
  });

  return {
    ok:errors.length === 0,
    checked:results.length,
    generated:results.filter(function(x){ return x && x.generated === true; }).length,
    pending:results.filter(function(x){ return x && /^PENDING_/.test(String(x.status || '')); }).length,
    alreadyGenerated:results.filter(function(x){ return x && x.duplicate === true; }).length,
    errors:errors,
    emailSent:false
  };
}

function v2AcademicEligibilitySyncSacSession_(sessionId, actor) {
  v2AcademicEligibilityEnsureSchema_();
  try { v2AcademicEligibilityEnsureTrigger_(); } catch (_) {}

  const id = String(sessionId || '').trim();
  if (!id) throw new Error('SAC Session ID is required.');
  const candidates = v2Rows_('V2_SAC_CANDIDATES').filter(function(row) {
    return String(row['SAC Session ID'] || '') === id;
  });
  const results = [];
  const errors = [];
  const owner = String(actor || 'SAC Finalisation').trim();

  candidates.forEach(function(candidate) {
    const reference = String(candidate['Reference No'] || '').trim();
    if (!reference) return;
    try {
      results.push(v2AcademicEligibilitySyncReference_(reference, owner, 'SAC_FINALISATION'));
    } catch (error) {
      errors.push({referenceNo:reference, error:String(error && error.message || error)});
    }
  });

  return {
    ok:errors.length === 0,
    sessionId:id,
    checked:results.length,
    generated:results.filter(function(x){ return x && x.generated === true; }).length,
    results:results,
    errors:errors,
    emailSent:false
  };
}

function v2AcademicEligibilitySyncReference_(referenceNo, actor, triggerSource) {
  v2AcademicEligibilityEnsureSchema_();
  const reference = String(referenceNo || '').trim();
  if (!reference) throw new Error('Reference No is required.');

  const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  if (!application) throw new Error('V2 application record not found.');
  if (!workflow) throw new Error('V2 workflow record not found.');

  if (!v2AqcIsInternational_(application.record)) {
    v2AqcUpdateWorkflow_(workflow, {
      'Academic Eligibility Letter Required':'NO',
      'Academic Eligibility Letter Status':'NOT_APPLICABLE',
      'Academic Eligibility Letter Error':'',
      'Academic Eligibility Letter Version':V2_AQC_BUILD
    }, actor);
    return {ok:true, referenceNo:reference, required:false, status:'NOT_APPLICABLE', generated:false, emailSent:false};
  }

  const currentStatus = String(workflow.record['Academic Eligibility Letter Status'] || '').trim().toUpperCase();
  const existingFileId = String(workflow.record['Academic Eligibility Letter File ID'] || '').trim();
  if (currentStatus === 'GENERATED' && existingFileId && v2AqcDriveFileExists_(existingFileId)) {
    return {
      ok:true,
      referenceNo:reference,
      required:true,
      status:'GENERATED',
      generated:false,
      duplicate:true,
      url:String(workflow.record['Academic Eligibility Letter URL'] || ''),
      fileId:existingFileId,
      emailSent:false
    };
  }

  const gate = v2AqcEligibilityGate_(workflow.record);
  if (!gate.eligible) {
    const pendingStatus = v2AqcPendingStatus_(workflow.record);
    v2AqcUpdateWorkflow_(workflow, {
      'Academic Eligibility Letter Required':'YES',
      'Academic Eligibility Letter Status':pendingStatus,
      'Academic Eligibility Letter Trigger':String(triggerSource || ''),
      'Academic Eligibility Letter Error':'',
      'Academic Eligibility Letter Version':V2_AQC_BUILD
    }, actor);
    return {
      ok:true,
      referenceNo:reference,
      required:true,
      status:pendingStatus,
      generated:false,
      gate:gate,
      emailSent:false
    };
  }

  return v2AcademicEligibilityGenerate_(reference, actor, triggerSource, application, workflow);
}

function v2AcademicEligibilityGenerate_(referenceNo, actor, triggerSource, applicationFound, workflowFound) {
  const reference = String(referenceNo || '').trim();
  const application = applicationFound || v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  const workflow = workflowFound || v2Find_('V2_WORKFLOW', 'Reference No', reference);
  if (!application || !workflow) throw new Error('Application / workflow record not found.');
  if (!v2AqcIsInternational_(application.record)) {
    throw new Error('Academic Eligibility Confirmation is only generated for international applicants.');
  }

  const gate = v2AqcEligibilityGate_(workflow.record);
  if (!gate.eligible) throw new Error('Academic eligibility is not yet authorised.');

  const model = v2AqcBuildDocumentModel_(application.record, workflow.record, reference);
  const missing = [];
  if (!model.studentName) missing.push('Applicant Name');
  if (!model.passportNo) missing.push('Passport No.');
  if (!model.programme) missing.push('Programme');
  if (!model.academicQualification) missing.push('Academic Qualification');
  if (!model.awardingInstitution) missing.push('Awarding Institution');
  if (!model.officialAcademicResult) missing.push('Official Academic Result');
  if (!model.studentFolderUrl) missing.push('Student Folder URL');

  if (missing.length) {
    const message = 'Official Academic Eligibility Confirmation requires review: missing ' + missing.join(', ') + '.';
    v2AqcUpdateWorkflow_(workflow, {
      'Academic Eligibility Letter Required':'YES',
      'Academic Eligibility Letter Status':'MANUAL_REVIEW_REQUIRED',
      'Academic Eligibility Letter Trigger':String(triggerSource || ''),
      'Academic Eligibility Letter Error':message,
      'Academic Eligibility Letter Version':V2_AQC_BUILD
    }, actor);
    v2Audit_(reference, 'ACADEMIC_ELIGIBILITY', 'AQC_GENERATION_BLOCKED', {}, {
      missing:missing,
      trigger:triggerSource || '',
      eligibleGate:gate.reason
    }, actor || 'AQC Generator', 'BLOCKED', message);
    return {
      ok:true,
      referenceNo:reference,
      required:true,
      status:'MANUAL_REVIEW_REQUIRED',
      generated:false,
      missing:missing,
      emailSent:false
    };
  }

  const folderId = v2AqcExtractDriveId_(model.studentFolderUrl);
  if (!folderId) throw new Error('Student Folder URL is invalid.');
  const folder = DriveApp.getFolderById(folderId);
  const safeStudent = v2SafeName_(model.studentName).toUpperCase().replace(/\s+/g, '_').slice(0,80) || 'STUDENT';
  const safePassport = v2SafeName_(model.passportNo).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0,40) || 'PASSPORT';
  const pdfName = 'ACADEMIC_QUALIFICATION_ELIGIBILITY_' + safeStudent + '_' + safePassport + '.pdf';
  const tempName = 'TEMP_AQC_' + safeStudent + '_' + Utilities.getUuid().slice(0,8).toUpperCase();

  let tempFile = null;
  try {
    const templateFile = DriveApp.getFileById(V2_AQC_TEMPLATE_DOC_ID);
    tempFile = templateFile.makeCopy(tempName, folder);
    const doc = DocumentApp.openById(tempFile.getId());
    const body = doc.getBody();
    const replacements = {
      REF_NO:model.documentReference,
      DATE:model.dateIssued,
      PROGRAMME_UPPER:model.programme.toUpperCase(),
      STUDENT_NAME:model.studentName.toUpperCase(),
      PASSPORT_NO:model.passportNo,
      ACADEMIC_QUALIFICATION:model.academicQualification,
      AWARDING_INSTITUTION:model.awardingInstitution,
      OFFICIAL_ACADEMIC_RESULT:model.officialAcademicResult,
      GRADING_SYSTEM:model.gradingSystem,
      ACADEMIC_REVIEW:model.academicReview,
      ELIGIBILITY_CONFIRMATION:model.eligibilityConfirmation
    };

    Object.keys(replacements).forEach(function(key) {
      body.replaceText('\\{\\{' + key + '\\}\\}', v2AqcReplacementText_(replacements[key]));
    });
    doc.saveAndClose();

    const leftovers = DocumentApp.openById(tempFile.getId()).getBody().getText().match(/\{\{[A-Z0-9_]+\}\}/g) || [];
    if (leftovers.length) {
      throw new Error('Locked template contains unresolved placeholders: ' + leftovers.join(', '));
    }

    v2AqcTrashExistingNamedFiles_(folder, pdfName);
    const pdfBlob = tempFile.getAs(MimeType.PDF).setName(pdfName);
    const pdfFile = folder.createFile(pdfBlob);
    const now = new Date().toISOString();

    const updates = {
      'Academic Eligibility Letter Required':'YES',
      'Academic Eligibility Letter Status':'GENERATED',
      'Academic Eligibility Letter Reference':model.documentReference,
      'Academic Eligibility Letter URL':pdfFile.getUrl(),
      'Academic Eligibility Letter File ID':pdfFile.getId(),
      'Academic Eligibility Letter Generated At':now,
      'Academic Eligibility Letter Trigger':String(triggerSource || 'ACADEMIC_ELIGIBILITY'),
      'Academic Eligibility Letter Error':'',
      'Academic Eligibility Letter Version':V2_AQC_BUILD
    };
    v2AqcUpdateWorkflow_(workflow, updates, actor);
    v2Audit_(reference, 'ACADEMIC_ELIGIBILITY', 'GENERATE_AQC', {}, {
      documentReference:model.documentReference,
      fileId:pdfFile.getId(),
      fileUrl:pdfFile.getUrl(),
      trigger:triggerSource || '',
      templateId:V2_AQC_TEMPLATE_DOC_ID,
      emailSent:false
    }, actor || 'AQC Generator', 'SUCCESS', 'Official academic eligibility confirmation saved to student folder. No student email sent.');

    return {
      ok:true,
      referenceNo:reference,
      required:true,
      status:'GENERATED',
      generated:true,
      documentReference:model.documentReference,
      url:pdfFile.getUrl(),
      fileId:pdfFile.getId(),
      fileName:pdfName,
      emailSent:false
    };
  } catch (error) {
    const message = String(error && error.message || error);
    v2AqcUpdateWorkflow_(workflow, {
      'Academic Eligibility Letter Required':'YES',
      'Academic Eligibility Letter Status':'GENERATION_FAILED',
      'Academic Eligibility Letter Trigger':String(triggerSource || ''),
      'Academic Eligibility Letter Error':message,
      'Academic Eligibility Letter Version':V2_AQC_BUILD
    }, actor);
    v2Audit_(reference, 'ACADEMIC_ELIGIBILITY', 'GENERATE_AQC', {}, {
      trigger:triggerSource || '',
      templateId:V2_AQC_TEMPLATE_DOC_ID
    }, actor || 'AQC Generator', 'FAILED', message);
    throw error;
  } finally {
    if (tempFile) {
      try { tempFile.setTrashed(true); } catch (_) {}
    }
  }
}

function v2AqcBuildDocumentModel_(application, workflow, reference) {
  let raw = {};
  try { raw = JSON.parse(String(application['Raw Application JSON'] || '{}')); } catch (_) { raw = {}; }

  const aiFound = v2Find_('V2_AI_SCREENING', 'Reference No', reference);
  const ai = aiFound ? aiFound.record : {};
  const aiConfirmed = String(ai['Confirmed For Rule Engine'] || '').toUpperCase() === 'YES' ||
    String(ai['Human Review Status'] || '').toUpperCase() === 'CONFIRMED' ||
    String(ai['Status'] || '').toUpperCase() === 'HUMAN_CONFIRMED';
  let normalized = {};
  try { normalized = JSON.parse(String(ai['Normalized Result JSON'] || '{}')); } catch (_) { normalized = {}; }

  const qsFound = v2Find_('V2_QUALIFICATION_SCREENING', 'Reference No', reference);
  const qs = qsFound ? qsFound.record : {};

  const studentName = String(application['Student Name'] || workflow['Student Name'] || raw.fullName || '').trim();
  const passportNo = String(application['ID / Passport No'] || workflow['ID / Passport No'] || raw.idPassport || '').trim();
  const programme = String(application['Programme'] || workflow['Programme'] || raw.programme || '').trim();
  const qualification = String(
    (aiConfirmed ? ai['Qualification'] : '') ||
    qs['Highest Qualification'] ||
    application['Highest Qualification'] ||
    raw.highestQualification || ''
  ).trim();
  const institution = String(
    (aiConfirmed ? ai['Institution'] : '') ||
    application['Institution / Awarding Body'] ||
    raw.lastInstitution || ''
  ).trim();
  const result = String(
    qs['Academic Result'] ||
    (aiConfirmed ? ai['CGPA / Grade'] : '') ||
    application['Academic Result / CGPA / Grade'] ||
    raw.academicResult || raw.cgpa || raw.grade || ''
  ).trim();
  const year = String(
    (aiConfirmed ? ai['Graduation Year'] : '') ||
    raw.yearOfCompletion || ''
  ).trim();

  const resultType = String(normalized.academicResultType || '').trim().toUpperCase();
  const transcriptAssessment = String(normalized.transcriptAssessment || '').trim();
  const gradeNote = String(normalized.gradeEquivalencyNote || '').trim();
  const gradingSystem = v2AqcResolveGradingSystem_(resultType, transcriptAssessment, gradeNote);
  const qualificationDisplay = v2AqcQualificationDisplay_(qualification, year);
  const academicReview = v2AqcBuildAcademicReview_(qualification, institution, year, result, gradingSystem, resultType, transcriptAssessment, gradeNote);
  const eligibilityConfirmation = 'Based on the submitted academic documents and IUC\'s approved entry requirements for the programme, Innovative University College confirms that the applicant satisfies the academic qualification requirement and is academically eligible for admission to the ' + programme + ' programme.';

  return {
    studentName:studentName,
    passportNo:passportNo,
    programme:programme,
    academicQualification:qualificationDisplay,
    awardingInstitution:institution,
    officialAcademicResult:result,
    gradingSystem:gradingSystem,
    academicReview:academicReview,
    eligibilityConfirmation:eligibilityConfirmation,
    studentFolderUrl:String(application['Student Folder URL'] || workflow['Student Folder URL'] || '').trim(),
    documentReference:v2AqcReference_(programme, passportNo),
    dateIssued:v2AqcDate_(new Date())
  };
}

function v2AqcBuildAcademicReview_(qualification, institution, year, result, gradingSystem, resultType, transcriptAssessment, gradeNote) {
  const q = String(qualification || 'the submitted qualification').trim();
  const institutionText = String(institution || 'the awarding institution').trim();
  const yearText = String(year || '').trim();
  const resultText = String(result || '').trim();
  const systemText = String(gradingSystem || 'As stated in the submitted academic records').trim();
  let first = 'The applicant holds ' + q + ' from ' + institutionText;
  if (yearText) first += ', awarded in ' + yearText;
  first += '.';

  let second = resultText
    ? ' The submitted academic records state an official academic result of ' + resultText + ' and are reviewed according to the ' + systemText + '.'
    : ' The submitted academic records are reviewed according to the ' + systemText + '.';

  const combined = (String(transcriptAssessment || '') + ' ' + String(gradeNote || '')).toLowerCase();
  const nonCgpaType = ['MARKS','PERCENTAGE','CLASSIFICATION','DIVISION','MARKS_AND_DIVISION'].indexOf(String(resultType || '').toUpperCase()) >= 0;
  if (nonCgpaType || /no\s+cgpa|cgpa\s+not|without\s+cgpa/.test(combined)) {
    second += ' No artificial CGPA conversion has been applied by IUC.';
  }
  return first + second;
}

function v2AqcResolveGradingSystem_(resultType, transcriptAssessment, gradeNote) {
  const type = String(resultType || '').trim().toUpperCase();
  const context = (String(transcriptAssessment || '') + ' ' + String(gradeNote || '')).toLowerCase();
  if (/annual/.test(context) && /division/.test(context)) return 'Annual Examination / Marks and Division';
  if (/annual/.test(context) && /mark/.test(context)) return 'Annual Examination / Marks-Based Assessment';
  if (type === 'CGPA') return 'CGPA System';
  if (type === 'GPA') return 'GPA System';
  if (type === 'PERCENTAGE') return 'Percentage-Based Assessment';
  if (type === 'MARKS') return 'Marks-Based Assessment';
  if (type === 'CLASSIFICATION' || type === 'DIVISION') return 'Classification / Division System';
  if (type === 'MARKS_AND_DIVISION') return 'Marks and Division System';
  return 'As stated in the submitted academic records';
}

function v2AqcQualificationDisplay_(qualification, year) {
  const q = String(qualification || '').trim();
  const y = String(year || '').trim();
  if (!q || !y || q.indexOf(y) >= 0) return q;
  return q + ' (' + y + ')';
}

function v2AqcEligibilityGate_(workflow) {
  const stage = String(workflow['Application Stage'] || '').trim().toUpperCase();
  const sacDecision = String(workflow['SAC Decision'] || '').trim().toUpperCase();
  const assessmentStatus = String(workflow['Assessment Status'] || '').trim().toUpperCase();
  const prerequisiteStatus = String(workflow['Prerequisite Status'] || '').trim().toUpperCase();

  if (assessmentStatus === 'COMPLETED_QUALIFIED') {
    return {eligible:true, reason:'IA_QUALIFIED'};
  }
  if (prerequisiteStatus === 'COMPLETED_QUALIFIED') {
    return {eligible:true, reason:'PREREQUISITE_QUALIFIED'};
  }
  if (sacDecision === 'DIRECT_ENTRY' && stage === 'ELIGIBLE_FOR_OFFER') {
    const sessionId = String(workflow['SAC Session ID'] || '').trim();
    if (!sessionId) return {eligible:false, reason:'SAC_SESSION_NOT_FINALISED'};
    const session = v2Find_('V2_SAC_SESSIONS', 'SAC Session ID', sessionId);
    if (!session) return {eligible:false, reason:'SAC_SESSION_NOT_FOUND'};
    const status = String(session.record['Status'] || '').trim().toUpperCase();
    if (/FINAL/.test(status) || String(session.record['Finalised At'] || '').trim()) {
      return {eligible:true, reason:'SAC_DIRECT_ENTRY_FINALISED'};
    }
    return {eligible:false, reason:'SAC_SESSION_NOT_FINALISED'};
  }
  return {eligible:false, reason:'ACADEMIC_APPROVAL_PENDING'};
}

function v2AqcPendingStatus_(workflow) {
  const stage = String(workflow['Application Stage'] || '').trim().toUpperCase();
  const decision = String(workflow['SAC Decision'] || '').trim().toUpperCase();
  if (stage === 'REJECTED' || decision === 'REJECTED') return 'NOT_ISSUED_REJECTED';
  if (stage === 'INTERNAL_ASSESSMENT' || decision === 'INTERNAL_ASSESSMENT') return 'PENDING_INTERNAL_ASSESSMENT';
  if (stage === 'PREREQUISITE') return 'PENDING_PREREQUISITE';
  if (decision === 'DIRECT_ENTRY') return 'PENDING_SAC_FINALISATION';
  return 'PENDING_ACADEMIC_APPROVAL';
}

function v2AqcIsInternational_(application) {
  let raw = {};
  try { raw = JSON.parse(String(application['Raw Application JSON'] || '{}')); } catch (_) { raw = {}; }
  const value = String(application['Applicant Type'] || raw.applicantType || '').trim().toUpperCase();
  return value.indexOf('INTERNATIONAL') >= 0 || value.indexOf('NON-MALAYSIAN') >= 0 || value.indexOf('FOREIGN') >= 0;
}

function v2AqcReference_(programme, passportNo) {
  const code = v2AqcProgrammeCode_(programme);
  const year = Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'yyyy');
  const passport = String(passportNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,30) || 'NOID';
  return 'AQC/' + code + '/' + year + '/' + passport;
}

function v2AqcProgrammeCode_(programme) {
  const p = String(programme || '').trim().toUpperCase();
  if (/MASTER.*BUSINESS ADMINISTRATION|\bMBA\b/.test(p)) return 'MBA';
  if (/MASTER.*BUSINESS MANAGEMENT|\bMBM\b/.test(p)) return 'MBM';
  if (/MASTER.*INFORMATION MANAGEMENT|\bMIM\b/.test(p)) return 'MIM';
  if (/HAJJ|UMRAH|\bMHUM\b/.test(p)) return 'MHUM';
  if (/DOCTOR.*BUSINESS ADMINISTRATION|\bDBA\b/.test(p)) return 'DBA';
  if (/DOCTOR.*PHILOSOPHY|\bPHD\b|PH\.D/.test(p)) return 'PHD';
  const words = p.replace(/[^A-Z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
  const initials = words.map(function(word){ return word.charAt(0); }).join('').slice(0,6);
  return initials || 'PG';
}

function v2AqcDate_(date) {
  const d = Number(Utilities.formatDate(date, CONFIG.timezone || 'Asia/Kuala_Lumpur', 'd'));
  const lastTwo = d % 100;
  let suffix = 'th';
  if (lastTwo < 11 || lastTwo > 13) {
    if (d % 10 === 1) suffix = 'st';
    else if (d % 10 === 2) suffix = 'nd';
    else if (d % 10 === 3) suffix = 'rd';
  }
  return d + suffix + ' ' + Utilities.formatDate(date, CONFIG.timezone || 'Asia/Kuala_Lumpur', 'MMMM yyyy');
}

function v2AqcReplacementText_(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/\$/g, '\\$');
}

function v2AqcExtractDriveId_(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const folderMatch = text.match(/\/folders\/([A-Za-z0-9_-]+)/);
  if (folderMatch) return folderMatch[1];
  const fileMatch = text.match(/\/d\/([A-Za-z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];
  if (/^[A-Za-z0-9_-]{20,}$/.test(text)) return text;
  return '';
}

function v2AqcDriveFileExists_(fileId) {
  try {
    const file = DriveApp.getFileById(String(fileId || ''));
    return !!file && !file.isTrashed();
  } catch (_) {
    return false;
  }
}

function v2AqcTrashExistingNamedFiles_(folder, fileName) {
  const files = folder.getFilesByName(fileName);
  while (files.hasNext()) {
    try { files.next().setTrashed(true); } catch (_) {}
  }
}

function v2AqcUpdateWorkflow_(workflowFound, updates, actor) {
  const patch = Object.assign({}, updates || {}, {
    'Last Updated':new Date().toISOString(),
    'Updated By':String(actor || 'AQC Automation')
  });
  v2UpdateRow_(workflowFound.sheet, workflowFound.rowNumber, patch);
  v2InvalidateCache_();
  return patch;
}

function v2AcademicEligibilityRetry_(referenceNo, actor) {
  const reference = String(referenceNo || '').trim();
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  if (!workflow) throw new Error('V2 workflow record not found.');
  v2AqcUpdateWorkflow_(workflow, {
    'Academic Eligibility Letter Status':'RETRY_REQUESTED',
    'Academic Eligibility Letter Error':''
  }, actor || 'Registry Manual Retry');
  return v2AcademicEligibilitySyncReference_(reference, actor || 'Registry Manual Retry', 'MANUAL_RETRY');
}

function v2AcademicEligibilityStatus_(referenceNo) {
  v2AcademicEligibilityEnsureSchema_();
  const reference = String(referenceNo || '').trim();
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  if (!workflow) throw new Error('V2 workflow record not found.');
  return {
    ok:true,
    referenceNo:reference,
    required:String(workflow.record['Academic Eligibility Letter Required'] || ''),
    status:String(workflow.record['Academic Eligibility Letter Status'] || ''),
    documentReference:String(workflow.record['Academic Eligibility Letter Reference'] || ''),
    url:String(workflow.record['Academic Eligibility Letter URL'] || ''),
    fileId:String(workflow.record['Academic Eligibility Letter File ID'] || ''),
    generatedAt:String(workflow.record['Academic Eligibility Letter Generated At'] || ''),
    trigger:String(workflow.record['Academic Eligibility Letter Trigger'] || ''),
    error:String(workflow.record['Academic Eligibility Letter Error'] || ''),
    version:String(workflow.record['Academic Eligibility Letter Version'] || ''),
    emailSent:false
  };
}
