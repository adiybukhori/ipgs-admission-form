/**
 * IUC IPGS Admission V2 - Provider-Agnostic AI Screening Layer
 * DEVELOPMENT / TEST SAFE
 *
 * Purpose:
 * - Store AI document-screening output in a stable schema.
 * - Keep GPT Work and OpenAI API interchangeable through an adapter contract.
 * - Never let AI make the official admission decision.
 * - Require human confirmation before values are used by the formal rule engine.
 * - No email. V1 is never read or modified.
 */

const V2_AI_SCREENING_SHEET = 'V2_AI_SCREENING';
const V2_AI_SCREENING_CONFIG_SHEET = 'V2_AI_SCREENING_CONFIG';
const V2_AI_SCHEMA_VERSION = '1.1';
const V2_AI_PROMPT_VERSION = 'AI_SCREENING_V2_OFFICIAL_REPORT';

const V2_AI_SCREENING_HEADERS = [
  'Reference No',
  'Provider',
  'Model',
  'Prompt Version',
  'Schema Version',
  'Status',
  'Source Documents JSON',
  'Qualification',
  'Institution',
  'Field of Study',
  'CGPA / Grade',
  'Graduation Year',
  'Relevant Work Experience',
  'Work Experience Summary',
  'Field Classification',
  'Confidence',
  'Evidence JSON',
  'Flags JSON',
  'Raw Result JSON',
  'Normalized Result JSON',
  'AI Screened At',
  'AI Run ID',
  'Human Review Status',
  'Human Reviewed At',
  'Human Reviewed By',
  'Human Field Classification',
  'Human Relevant Work Experience',
  'Human Remarks',
  'Confirmed For Rule Engine',
  'Rule Engine Input Source',
  'Report Status',
  'Report Version',
  'Report PDF URL',
  'Report File ID',
  'Report Generated At',
  'Report Finalized At',
  'Last Updated'
];

const V2_AI_CONFIG_HEADERS = [
  'Key', 'Value', 'Description', 'Updated At', 'Updated By'
];

function v2AiScreeningSetupFoundation() {
  assertDevIdentity_();
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);

  let resultSheet = ss.getSheetByName(V2_AI_SCREENING_SHEET);
  if (!resultSheet) resultSheet = ss.insertSheet(V2_AI_SCREENING_SHEET);
  v2EnsureHeaders_(resultSheet, V2_AI_SCREENING_HEADERS);
  v2StyleHeader_(resultSheet, V2_AI_SCREENING_HEADERS.length);

  let configSheet = ss.getSheetByName(V2_AI_SCREENING_CONFIG_SHEET);
  if (!configSheet) configSheet = ss.insertSheet(V2_AI_SCREENING_CONFIG_SHEET);
  v2EnsureHeaders_(configSheet, V2_AI_CONFIG_HEADERS);
  v2StyleHeader_(configSheet, V2_AI_CONFIG_HEADERS.length);

  const defaults = [
    ['AI_PROVIDER', 'WORK', 'Pilot provider only. Core workflow must not depend on provider implementation.'],
    ['AI_SCHEMA_VERSION', V2_AI_SCHEMA_VERSION, 'Stable normalized output contract shared by GPT Work and OpenAI API.'],
    ['AI_PROMPT_VERSION', V2_AI_PROMPT_VERSION, 'Versioned screening prompt. Provider adapters must use the same output contract.'],
    ['AI_CONFIDENCE_REVIEW_THRESHOLD', '0.80', 'Below this confidence, human review is mandatory.'],
    ['AI_AUTO_DECISION_ENABLED', 'FALSE', 'AI may extract and recommend only; it cannot make the official admission decision.'],
    ['AI_RULE_ENGINE_INPUT', 'HUMAN_CONFIRMED_ONLY', 'Formal rule engine must use human-confirmed field classification and work-experience values.'],
    ['WORK_ENABLED', 'TRUE', 'GPT Work pilot adapter may supply normalized screening results.'],
    ['OPENAI_API_ENABLED', 'FALSE', 'Enable only after API credentials, billing, and production validation are ready.'],
    ['AI_PROVIDER_SWITCH_MODE', 'ADAPTER', 'Provider migration changes the adapter only; dashboard, schema, rule engine and SAC flow stay unchanged.']
  ];

  const now = new Date().toISOString();
  defaults.forEach(function(item) {
    const existing = v2Find_(V2_AI_SCREENING_CONFIG_SHEET, 'Key', item[0]);
    if (!existing) {
      v2Append_(V2_AI_SCREENING_CONFIG_SHEET, {
        'Key': item[0],
        'Value': item[1],
        'Description': item[2],
        'Updated At': now,
        'Updated By': 'AI Screening Setup'
      });
    }
  });

  return {
    ok: true,
    resultSheet: V2_AI_SCREENING_SHEET,
    configSheet: V2_AI_SCREENING_CONFIG_SHEET,
    schemaVersion: V2_AI_SCHEMA_VERSION,
    promptVersion: V2_AI_PROMPT_VERSION,
    providerLockIn: false,
    aiAutoDecisionEnabled: false,
    emailSent: false,
    v1Touched: false
  };
}

function v2AiScreeningPreflight() {
  assertDevIdentity_();
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const resultSheet = ss.getSheetByName(V2_AI_SCREENING_SHEET);
  const configSheet = ss.getSheetByName(V2_AI_SCREENING_CONFIG_SHEET);
  const resultHeaders = resultSheet ? v2Headers_(resultSheet) : [];
  const configHeaders = configSheet ? v2Headers_(configSheet) : [];

  return {
    ok: !!resultSheet && !!configSheet &&
      V2_AI_SCREENING_HEADERS.every(function(h) { return resultHeaders.indexOf(h) > -1; }) &&
      V2_AI_CONFIG_HEADERS.every(function(h) { return configHeaders.indexOf(h) > -1; }),
    resultSheetExists: !!resultSheet,
    configSheetExists: !!configSheet,
    schemaVersion: V2_AI_SCHEMA_VERSION,
    aiAutoDecisionEnabled: false,
    emailSent: false,
    v1Touched: false
  };
}

function v2RecordAiScreeningResult_(data, actor) {
  assertDevIdentity_();
  const input = data || {};
  const reference = v2Required_(input.referenceNo, 'Reference No');
  const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  if (!application) throw new Error('V2 application record not found.');

  const provider = v2AiNormalizeProvider_(input.provider || 'WORK');
  const normalized = v2AiNormalizeResult_(input.result || input, provider);
  const now = new Date().toISOString();
  const runId = String(input.runId || ('AI-' + Utilities.getUuid().slice(0, 12).toUpperCase()));
  const confidence = normalized.confidence;
  const threshold = v2AiConfigNumber_('AI_CONFIDENCE_REVIEW_THRESHOLD', 0.80);
  const status = confidence < threshold || normalized.flags.length > 0
    ? 'REVIEW_REQUIRED'
    : 'AI_SCREENED';

  const row = {
    'Reference No': reference,
    'Provider': provider,
    'Model': String(input.model || ''),
    'Prompt Version': String(input.promptVersion || V2_AI_PROMPT_VERSION),
    'Schema Version': String(input.schemaVersion || V2_AI_SCHEMA_VERSION),
    'Status': status,
    'Source Documents JSON': JSON.stringify(input.sourceDocuments || []),
    'Qualification': normalized.qualification,
    'Institution': normalized.institution,
    'Field of Study': normalized.fieldOfStudy,
    'CGPA / Grade': normalized.cgpaGrade,
    'Graduation Year': normalized.graduationYear,
    'Relevant Work Experience': normalized.relevantWorkExperience,
    'Work Experience Summary': normalized.workExperienceSummary,
    'Field Classification': normalized.fieldClassification,
    'Confidence': normalized.confidence,
    'Evidence JSON': JSON.stringify(normalized.evidence),
    'Flags JSON': JSON.stringify(normalized.flags),
    'Raw Result JSON': JSON.stringify(input.rawResult || input.result || {}),
    'Normalized Result JSON': JSON.stringify(normalized),
    'AI Screened At': now,
    'AI Run ID': runId,
    'Human Review Status': 'PENDING',
    'Human Reviewed At': '',
    'Human Reviewed By': '',
    'Human Field Classification': '',
    'Human Relevant Work Experience': '',
    'Human Remarks': '',
    'Confirmed For Rule Engine': 'NO',
    'Last Updated': now
  };

  const saved = v2Upsert_(V2_AI_SCREENING_SHEET, 'Reference No', reference, row);

  v2Audit_(
    reference,
    'AI_SCREENING',
    'RECORD_AI_SCREENING',
    saved.previous || {},
    {
      provider: provider,
      model: row['Model'],
      status: status,
      confidence: normalized.confidence,
      fieldClassification: normalized.fieldClassification,
      relevantWorkExperience: normalized.relevantWorkExperience,
      flags: normalized.flags,
      autoDecisionMade: false
    },
    actor || 'AI Screening Adapter',
    'SUCCESS',
    'AI output stored for human review only.'
  );

  v2InvalidateCache_();
  return {
    ok: true,
    referenceNo: reference,
    provider: provider,
    runId: runId,
    status: status,
    normalized: normalized,
    humanReviewStatus: 'PENDING',
    confirmedForRuleEngine: false,
    autoDecisionMade: false,
    emailSent: false,
    v1Touched: false
  };
}

function v2ConfirmAiScreening_(data, actor) {
  assertDevIdentity_();
  const input = data || {};
  const reference = v2Required_(input.referenceNo, 'Reference No');
  const existing = v2Find_(V2_AI_SCREENING_SHEET, 'Reference No', reference);
  if (!existing) throw new Error('AI screening result not found.');

  const humanField = v2AiNormalizeField_(input.fieldClassification);
  const humanExperience = v2AiNormalizeExperience_(input.relevantWorkExperience);
  if (!humanField) {
    throw new Error('Human Field Classification is required: RELATED, PARTIALLY_RELATED or NON_RELATED.');
  }
  if (!humanExperience) {
    throw new Error('Human Relevant Work Experience is required: YES or NO.');
  }

  const now = new Date().toISOString();
  const reviewer = String(actor || input.reviewedBy || 'Registry / Admission').trim();
  const updates = {
    'Status': 'HUMAN_CONFIRMED',
    'Human Review Status': 'CONFIRMED',
    'Human Reviewed At': now,
    'Human Reviewed By': reviewer,
    'Human Field Classification': humanField,
    'Human Relevant Work Experience': humanExperience,
    'Human Remarks': String(input.remarks || ''),
    'Confirmed For Rule Engine': 'YES',
    'Last Updated': now
  };
  v2UpdateRow_(existing.sheet, existing.rowNumber, updates);

  v2Audit_(
    reference,
    'AI_SCREENING',
    'CONFIRM_AI_SCREENING',
    {
      humanReviewStatus: existing.record['Human Review Status'] || '',
      confirmedForRuleEngine: existing.record['Confirmed For Rule Engine'] || 'NO'
    },
    {
      humanReviewStatus: 'CONFIRMED',
      fieldClassification: humanField,
      relevantWorkExperience: humanExperience,
      confirmedForRuleEngine: true
    },
    reviewer,
    'SUCCESS',
    String(input.remarks || '')
  );

  v2InvalidateCache_();
  return {
    ok: true,
    referenceNo: reference,
    humanReviewStatus: 'CONFIRMED',
    fieldClassification: humanField,
    relevantWorkExperience: humanExperience,
    confirmedForRuleEngine: true,
    nextAction: 'RUN_QUALIFICATION_SCREENING',
    autoDecisionMade: false,
    emailSent: false,
    v1Touched: false
  };
}

function v2GetConfirmedAiScreeningInput_(referenceNo) {
  assertDevIdentity_();
  const reference = String(referenceNo || '').trim();
  if (!reference) throw new Error('Reference No is required.');
  const existing = v2Find_(V2_AI_SCREENING_SHEET, 'Reference No', reference);
  if (!existing) return null;
  const row = existing.record;
  if (String(row['Confirmed For Rule Engine'] || '') !== 'YES') return null;
  return {
    referenceNo: reference,
    fieldClassification: String(row['Human Field Classification'] || ''),
    relevantWorkExperience: String(row['Human Relevant Work Experience'] || ''),
    reviewedBy: String(row['Human Reviewed By'] || ''),
    reviewedAt: String(row['Human Reviewed At'] || ''),
    aiProvider: String(row['Provider'] || ''),
    aiModel: String(row['Model'] || ''),
    aiRunId: String(row['AI Run ID'] || '')
  };
}

function v2AiNormalizeResult_(raw, provider) {
  const input = raw || {};
  const evidence = Array.isArray(input.evidence) ? input.evidence.map(String).filter(Boolean) : [];
  const flags = Array.isArray(input.flags) ? input.flags.map(String).filter(Boolean) : [];
  const confidenceRaw = Number(input.confidence);
  const confidence = isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0;

  return {
    schemaVersion: V2_AI_SCHEMA_VERSION,
    provider: provider,
    qualification: String(input.qualification || ''),
    institution: String(input.institution || ''),
    fieldOfStudy: String(input.fieldOfStudy || input.field_of_study || ''),
    cgpaGrade: String(input.cgpaGrade || input.cgpa || input.grade || ''),
    graduationYear: String(input.graduationYear || input.graduation_year || ''),
    relevantWorkExperience: v2AiNormalizeExperience_(input.relevantWorkExperience || input.relevant_work_experience) || 'UNKNOWN',
    workExperienceSummary: String(input.workExperienceSummary || input.work_experience_summary || ''),
    workExperienceRationale: String(input.workExperienceRationale || input.work_experience_rationale || ''),
    fieldClassification: v2AiNormalizeField_(input.fieldClassification || input.field_classification) || 'UNKNOWN',
    fieldClassificationRationale: String(input.fieldClassificationRationale || input.field_classification_rationale || ''),
    transcriptAssessment: String(input.transcriptAssessment || input.transcript_assessment || ''),
    academicResultType: String(input.academicResultType || input.academic_result_type || 'UNKNOWN').toUpperCase(),
    gradeEquivalencyStatus: String(input.gradeEquivalencyStatus || input.grade_equivalency_status || 'UNKNOWN').toUpperCase(),
    gradeEquivalencyNote: String(input.gradeEquivalencyNote || input.grade_equivalency_note || ''),
    confidence: confidence,
    evidence: evidence,
    flags: flags
  };
}

function v2AiNormalizeProvider_(value) {
  const provider = String(value || '').trim().toUpperCase();
  if (['WORK', 'OPENAI', 'MANUAL_IMPORT'].indexOf(provider) < 0) {
    throw new Error('Unsupported AI screening provider.');
  }
  return provider;
}

function v2AiNormalizeField_(value) {
  const normal = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return ['RELATED', 'PARTIALLY_RELATED', 'NON_RELATED'].indexOf(normal) > -1 ? normal : '';
}

function v2AiNormalizeExperience_(value) {
  if (value === true) return 'YES';
  if (value === false) return 'NO';
  const normal = String(value || '').trim().toUpperCase();
  if (['YES', 'Y', 'RELEVANT'].indexOf(normal) > -1) return 'YES';
  if (['NO', 'N', 'NOT RELEVANT', 'NOT_RELEVANT'].indexOf(normal) > -1) return 'NO';
  return '';
}

function v2AiConfigValue_(key, fallback) {
  const found = v2Find_(V2_AI_SCREENING_CONFIG_SHEET, 'Key', String(key || ''));
  if (!found) return fallback;
  const value = found.record['Value'];
  return value === '' || value === null || value === undefined ? fallback : value;
}

function v2AiConfigNumber_(key, fallback) {
  const value = Number(v2AiConfigValue_(key, fallback));
  return isFinite(value) ? value : fallback;
}

function v2AiScreeningControlledTest() {
  assertDevIdentity_();
  const testToken = String(PropertiesService.getScriptProperties().getProperty('V2_ADMIN_API_PASSWORD') || CONFIG.adminApiPassword || '').trim();
  v2VerifyAdminApiAccess_(testToken);
  function callTestRoute(action, data) {
    return handleV2Post_({ action: action, token: testToken, data: data, updatedBy: 'Controlled AI Screening Test' });
  }
  const stamp = Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'yyyyMMdd-HHmmss');
  const reference = 'V2-AI-SCREENING-TEST-' + stamp;
  const now = new Date().toISOString();

  v2Append_('V2_APPLICATIONS', {
    'Reference No': reference,
    'Submitted At': now,
    'Applicant Type': 'Local (Malaysian Citizen)',
    'Student Name': 'V2 AI SCREENING TEST ' + stamp,
    'ID / Passport No': 'TEST-' + stamp,
    'Personal Email': 'NO-EMAIL-TEST',
    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Study Mode': 'Online',
    'Intake': 'September 2026',
    'Entry Qualification Type': 'Academic Qualification',
    'Highest Qualification': 'Bachelor Degree',
    'Institution / Awarding Body': 'V2 Test Environment',
    'Field of Study': 'Engineering',
    'Academic Result / CGPA / Grade': '2.85',
    'Application Status': 'TEST',
    'Email Status': 'DISABLED',
    'Last Updated': now,
    'Version': 'CONTROLLED_AI_SCREENING_TEST'
  });

  const recorded = callTestRoute('v2RecordAiScreeningResult', {
    referenceNo: reference,
    provider: 'WORK',
    model: 'PILOT',
    result: {
      qualification: 'Bachelor Degree',
      institution: 'V2 Test Environment',
      fieldOfStudy: 'Engineering',
      cgpaGrade: '2.85',
      graduationYear: '2024',
      relevantWorkExperience: 'YES',
      workExperienceSummary: 'Five years in operations management.',
      fieldClassification: 'PARTIALLY_RELATED',
      confidence: 0.91,
      evidence: ['Transcript states Engineering degree.', 'CV shows management responsibilities.'],
      flags: []
    }
  });

  const unconfirmedInput = v2GetConfirmedAiScreeningInput_(reference);
  const confirmed = callTestRoute('v2ConfirmAiScreening', {
    referenceNo: reference,
    fieldClassification: 'PARTIALLY_RELATED',
    relevantWorkExperience: 'YES',
    remarks: 'Controlled test confirmation.'
  });

  const input = v2GetConfirmedAiScreeningInput_(reference);
  const checks = {
    resultRecorded: recorded && recorded.ok === true,
    humanConfirmationRequired: recorded.humanReviewStatus === 'PENDING',
    noAutoDecision: recorded.autoDecisionMade === false,
    unconfirmedInputBlocked: unconfirmedInput === null,
    confirmationSaved: confirmed && confirmed.confirmedForRuleEngine === true,
    confirmedInputAvailable: input && input.fieldClassification === 'PARTIALLY_RELATED' && input.relevantWorkExperience === 'YES'
  };

  const report = {
    ok: Object.keys(checks).every(function(k) { return checks[k] === true; }),
    referenceNo: reference,
    checks: checks,
    emailSent: false,
    v1Touched: false
  };
  Logger.log(JSON.stringify(report));
  return report;
}

// V2_AI_AUTO_AND_MANUAL_SECOND_LAYER_V1
// AI auto screening is an accelerator only. The deterministic qualification
// rule engine remains the route engine. Manual screening can win the race at
// any time while the application is still in DOCUMENT_REVIEW or
// QUALIFICATION_SCREENING.

function v2TryAutoAiScreening_(referenceNo, actor) {
  assertDevIdentity_();
  const reference = String(referenceNo || '').trim();
  if (!reference) throw new Error('Reference No is required.');

  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  const documentReview = v2Find_('V2_DOCUMENT_REVIEW', 'Reference No', reference);
  if (!workflow || !application) throw new Error('V2 application/workflow record not found.');
  if (!documentReview || String(documentReview.record['Review Status'] || '') !== 'COMPLETE') {
    return {ok:false, status:'WAITING_FOR_DOCUMENTS', manualScreeningAvailable:false};
  }

  const startStage = String(workflow.record['Application Stage'] || '');
  if (['DOCUMENT_REVIEW','QUALIFICATION_SCREENING'].indexOf(startStage) < 0) {
    return {
      ok:true, skipped:true, status:'RACE_ALREADY_RESOLVED',
      winner:'MANUAL_OR_PRIOR_SCREENING', applicationStage:startStage,
      manualScreeningAvailable:false
    };
  }

  const properties = PropertiesService.getScriptProperties();
  const enabled = String(properties.getProperty('V2_AI_AUTO_ENABLED') || 'TRUE').toUpperCase() !== 'FALSE';
  if (!enabled) {
    v2AiSetAutoStatus_(reference, 'AUTO_DISABLED', ['AI_AUTO_DISABLED']);
    return {ok:true, status:'AUTO_DISABLED', manualScreeningAvailable:true};
  }

  const apiKey = String(properties.getProperty('OPENAI_API_KEY') || '').trim();
  if (!apiKey) {
    v2AiSetAutoStatus_(reference, 'AUTO_PENDING', ['OPENAI_API_KEY_MISSING']);
    return {
      ok:true, status:'AUTO_PENDING', reason:'OPENAI_API_KEY_MISSING',
      manualScreeningAvailable:true
    };
  }

  v2AiSetAutoStatus_(reference, 'AUTO_RUNNING', []);
  let aiResult;
  try {
    aiResult = v2CallOpenAiScreening_(application.record, apiKey);
  } catch (error) {
    v2AiSetAutoStatus_(reference, 'AUTO_FAILED', [String(error && error.message || error)]);
    return {
      ok:false, status:'AUTO_FAILED',
      message:String(error && error.message || error),
      manualScreeningAvailable:true
    };
  }

  const recorded = v2RecordAiScreeningResult_({
    referenceNo: reference,
    provider: 'OPENAI',
    model: aiResult.model,
    promptVersion: V2_AI_PROMPT_VERSION,
    sourceDocuments: aiResult.sourceDocuments,
    runId: aiResult.runId,
    result: aiResult.result,
    rawResult: aiResult.raw
  }, actor || 'AI Auto Screening');

  const normalized = recorded.normalized || {};
  const threshold = v2AiConfigNumber_('AI_CONFIDENCE_REVIEW_THRESHOLD', 0.80);
  const safeForRuleEngine =
    Number(normalized.confidence || 0) >= threshold &&
    Array.isArray(normalized.flags) && normalized.flags.length === 0 &&
    ['RELATED','PARTIALLY_RELATED','NON_RELATED'].indexOf(String(normalized.fieldClassification || '')) > -1 &&
    ['YES','NO'].indexOf(String(normalized.relevantWorkExperience || '')) > -1;

  if (!safeForRuleEngine) {
    const row = v2Find_(V2_AI_SCREENING_SHEET, 'Reference No', reference);
    if (row) v2UpdateRow_(row.sheet, row.rowNumber, {
      'Status':'REVIEW_REQUIRED',
      'Rule Engine Input Source':'AI_AGENT',
      'Last Updated':new Date().toISOString()
    });
    let report = null;
    try {
      report = v2GenerateAiScreeningReport_({referenceNo:reference,finalize:false}, actor || 'Admission Intelligence Agent');
    } catch (reportError) {
      v2Audit_(reference,'AI_SCREENING','AI_SCREENING_REPORT_FAILED',{},{
        message:String(reportError && reportError.message || reportError)
      },actor || 'Admission Intelligence Agent','FAILED','AI screening result was saved; report generation requires attention.');
    }
    return {
      ok:true, status:'REVIEW_REQUIRED', aiRecorded:true,
      confidence:Number(normalized.confidence || 0),
      report:report,
      manualScreeningAvailable:true
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const fresh = v2Find_('V2_WORKFLOW', 'Reference No', reference);
    const freshStage = fresh ? String(fresh.record['Application Stage'] || '') : '';
    if (['DOCUMENT_REVIEW','QUALIFICATION_SCREENING'].indexOf(freshStage) < 0) {
      const row = v2Find_(V2_AI_SCREENING_SHEET, 'Reference No', reference);
      if (row) v2UpdateRow_(row.sheet, row.rowNumber, {
        'Status':'MANUAL_WON',
        'Last Updated':new Date().toISOString()
      });
      return {
        ok:true, skipped:true, status:'MANUAL_WON', winner:'MANUAL',
        applicationStage:freshStage, manualScreeningAvailable:false
      };
    }

    const screening = v2RunQualificationScreening(reference, {
      fieldClassification: normalized.fieldClassification,
      relevantWorkExperience: normalized.relevantWorkExperience,
      screenedBy: actor || 'IUC Admission Intelligence Agent',
      remarks: 'AI document screening accepted at confidence ' + normalized.confidence + '; approved deterministic V2 qualification rule engine executed.'
    });

    const aiRow = v2Find_(V2_AI_SCREENING_SHEET, 'Reference No', reference);
    if (aiRow) v2UpdateRow_(aiRow.sheet, aiRow.rowNumber, {
      'Status': screening.manualReviewRequired ? 'REVIEW_REQUIRED' : 'AUTO_COMPLETED',
      'Confirmed For Rule Engine':'YES',
      'Rule Engine Input Source':'AI_AGENT',
      'Last Updated':new Date().toISOString()
    });

    let report = null;
    try {
      report = v2GenerateAiScreeningReport_({
        referenceNo:reference,
        finalize:!screening.manualReviewRequired
      }, actor || 'IUC Admission Intelligence Agent');
    } catch (reportError) {
      v2Audit_(reference,'AI_SCREENING','AI_SCREENING_REPORT_FAILED',{},{
        message:String(reportError && reportError.message || reportError)
      },actor || 'IUC Admission Intelligence Agent','FAILED','Qualification screening completed; official report generation requires attention.');
    }

    return {
      ok:true,
      status:screening.manualReviewRequired ? 'REVIEW_REQUIRED' : 'AUTO_COMPLETED',
      winner:screening.manualReviewRequired ? '' : 'AI_AUTO',
      screening:screening,
      report:report,
      manualScreeningAvailable:!!screening.manualReviewRequired
    };
  } finally {
    lock.releaseLock();
  }
}

function v2CompleteManualQualificationScreening_(data, actor) {
  assertDevIdentity_();
  const input = data || {};
  const reference = v2Required_(input.referenceNo, 'Reference No');
  const reviewer = String(actor || input.screenedBy || 'Registry Manual Screening').trim();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
    const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
    const documentReview = v2Find_('V2_DOCUMENT_REVIEW', 'Reference No', reference);
    if (!workflow || !application) throw new Error('V2 application/workflow record not found.');
    if (!documentReview || String(documentReview.record['Review Status'] || '') !== 'COMPLETE') {
      throw new Error('Manual screening blocked: document review is not COMPLETE.');
    }

    const currentStage = String(workflow.record['Application Stage'] || '');
    if (['DOCUMENT_REVIEW','QUALIFICATION_SCREENING'].indexOf(currentStage) < 0) {
      return {
        ok:true, skipped:true, winner:'AI_AUTO_OR_PRIOR',
        applicationStage:currentStage,
        message:'Screening was already resolved before the manual action.'
      };
    }

    const field = v2QualificationNormalizeField_(input.fieldClassification);
    const experience = v2QualificationNormalizeWorkExperience_(input.relevantWorkExperience);
    const recommendation = String(input.recommendedRoute || '').trim().toUpperCase();
    const allowed = ['DIRECT_ENTRY','NORMAL_ADMISSION_SCREENING','INTERNAL_ASSESSMENT','NOT_ELIGIBLE_CONVENTIONAL'];
    if (!field) throw new Error('Field Classification is required.');
    if (!experience) throw new Error('Relevant Work Experience is required.');
    if (allowed.indexOf(recommendation) < 0) {
      throw new Error('Select a valid manual screening recommendation.');
    }

    if (currentStage === 'DOCUMENT_REVIEW') {
      v2UpdateStage_({referenceNo:reference,stage:'QUALIFICATION_SCREENING',remarks:'Manual qualification screening started.'}, reviewer);
    }

    const now = new Date().toISOString();
    v2Upsert_(V2_QUALIFICATION_SCREENING_SHEET, 'Reference No', reference, {
      'Reference No':reference,
      'Student Name':application.record['Student Name'] || '',
      'Programme':application.record['Programme'] || '',
      'Highest Qualification':application.record['Highest Qualification'] || '',
      'Qualification Field':application.record['Field of Study'] || '',
      'Academic Result':application.record['Academic Result / CGPA / Grade'] || '',
      'Field Classification':field,
      'Relevant Work Experience':experience,
      'Screening Result':'MANUAL_SCREENING_COMPLETED',
      'Recommended Route':recommendation,
      'Rule Code':'MANUAL_SECOND_LAYER',
      'Screening Remarks':String(input.remarks || ''),
      'Screened At':now,
      'Screened By':reviewer,
      'Manual Review Required':'NO',
      'Last Updated':now
    });

    const refreshed = v2Find_('V2_WORKFLOW', 'Reference No', reference);
    v2UpdateRow_(refreshed.sheet, refreshed.rowNumber, {
      'Qualification Screening Status':'COMPLETED_MANUAL',
      'Field Classification':field,
      'Relevant Work Experience':experience,
      'Qualification Rule Code':'MANUAL_SECOND_LAYER',
      'Qualification Screened At':now,
      'Qualification Screened By':reviewer,
      'Manual Review Required':'NO',
      'Screening Recommendation':recommendation,
      'Last Updated':now,
      'Updated By':reviewer
    });

    v2UpdateStage_({
      referenceNo:reference,
      stage:'READY_FOR_SAC',
      remarks:'Manual second-layer screening completed. Recommendation: ' + recommendation
    }, reviewer);

    const aiRow = v2Find_(V2_AI_SCREENING_SHEET, 'Reference No', reference);
    if (aiRow && !/AUTO_COMPLETED/.test(String(aiRow.record['Status'] || ''))) {
      v2UpdateRow_(aiRow.sheet, aiRow.rowNumber, {
        'Status':'MANUAL_WON',
        'Last Updated':now
      });
    }

    v2Audit_(reference,'QUALIFICATION_SCREENING','MANUAL_SECOND_LAYER_COMPLETED',{}, {
      fieldClassification:field,
      relevantWorkExperience:experience,
      recommendedRoute:recommendation,
      winner:'MANUAL'
    }, reviewer, 'SUCCESS', String(input.remarks || ''));

    let report = null;
    if (aiRow) {
      try {
        report = v2GenerateAiScreeningReport_({referenceNo:reference,finalize:true}, reviewer);
      } catch (reportError) {
        v2Audit_(reference,'AI_SCREENING','AI_SCREENING_REPORT_FAILED',{},{
          message:String(reportError && reportError.message || reportError)
        },reviewer,'FAILED','Manual screening completed; report regeneration requires attention.');
      }
    }

    v2InvalidateCache_();

    return {
      ok:true, referenceNo:reference, winner:'MANUAL',
      screeningStatus:'COMPLETED_MANUAL', recommendedRoute:recommendation,
      applicationStage:'READY_FOR_SAC', nextAction:'SAC_PREPARATION',
      report:report
    };
  } finally {
    lock.releaseLock();
  }
}

function v2AiSetAutoStatus_(reference, status, flags) {
  const now = new Date().toISOString();
  const existing = v2Find_(V2_AI_SCREENING_SHEET, 'Reference No', reference);
  const row = {
    'Reference No':reference,'Provider':'OPENAI','Model':'','Prompt Version':V2_AI_PROMPT_VERSION,
    'Schema Version':V2_AI_SCHEMA_VERSION,'Status':status,'Source Documents JSON':'[]',
    'Qualification':'','Institution':'','Field of Study':'','CGPA / Grade':'','Graduation Year':'',
    'Relevant Work Experience':'','Work Experience Summary':'','Field Classification':'','Confidence':'',
    'Evidence JSON':'[]','Flags JSON':JSON.stringify(flags || []),'Raw Result JSON':'{}','Normalized Result JSON':'{}',
    'AI Screened At':'','AI Run ID':'','Human Review Status':'PENDING','Human Reviewed At':'','Human Reviewed By':'',
    'Human Field Classification':'','Human Relevant Work Experience':'','Human Remarks':'','Confirmed For Rule Engine':'NO',
    'Rule Engine Input Source':'','Report Status':'','Report Version':'','Report PDF URL':'','Report File ID':'','Report Generated At':'','Report Finalized At':'',
    'Last Updated':now
  };
  if (existing) {
    v2UpdateRow_(existing.sheet, existing.rowNumber, {'Status':status,'Flags JSON':row['Flags JSON'],'Last Updated':now});
  } else {
    v2Append_(V2_AI_SCREENING_SHEET, row);
  }
  v2InvalidateCache_();
}

function v2CallOpenAiScreening_(application, apiKey) {
  const properties = PropertiesService.getScriptProperties();
  const model = String(properties.getProperty('V2_AI_MODEL') || 'gpt-5.6-luna').trim();
  const uploaded = v2AiReadApplicationDocuments_(application);
  const content = [{
    type:'input_text',
    text:[
      'Screen this postgraduate admission application using ONLY the supplied application data and documents.',
      'Do not make the final admission decision. Extract evidence and classify only.',
      'Target programme: ' + String(application['Programme'] || ''),
      'Declared highest qualification: ' + String(application['Highest Qualification'] || ''),
      'Declared institution: ' + String(application['Institution / Awarding Body'] || ''),
      'Declared field: ' + String(application['Field of Study'] || ''),
      'Declared academic result: ' + String(application['Academic Result / CGPA / Grade'] || ''),
      'Field Classification means relationship of the qualification to the target programme. Base it primarily on certificate/transcript evidence and explain the rationale.',
      'Relevant Work Experience means evidence in the CV/resume of work experience relevant to the target programme. Explain exactly what evidence supports YES or NO.',
      'Review the transcript precisely: identify the reported CGPA, percentage, grade or classification exactly as shown.',
      'Never convert a foreign percentage, division, grade or classification into an IUC CGPA unless the supplied evidence explicitly contains an approved equivalency.',
      'Use gradeEquivalencyStatus=PENDING_IUC_CONFIRMATION when the result uses a foreign/non-CGPA grading format and no approved equivalency is supplied.',
      'Use gradeEquivalencyStatus=NOT_REQUIRED only when the academic result is already expressed in a directly usable CGPA/GPA format or equivalency is explicitly documented.',
      'Evidence entries must name the source document and the fact found, e.g. "Transcript: 71.20% First Division".',
      'If evidence is insufficient, use UNKNOWN and add a clear flag.'
    ].join('\n')
  }];
  uploaded.items.forEach(function(item) { content.push(item); });
  const schema = {
    type:'object', additionalProperties:false,
    properties:{
      qualification:{type:'string'}, institution:{type:'string'}, fieldOfStudy:{type:'string'},
      cgpaGrade:{type:'string'}, graduationYear:{type:'string'},
      transcriptAssessment:{type:'string'},
      academicResultType:{type:'string',enum:['CGPA','GPA','PERCENTAGE','GRADE','CLASSIFICATION','UNKNOWN']},
      gradeEquivalencyStatus:{type:'string',enum:['NOT_REQUIRED','PENDING_IUC_CONFIRMATION','CONFIRMED','UNKNOWN']},
      gradeEquivalencyNote:{type:'string'},
      relevantWorkExperience:{type:'string',enum:['YES','NO','UNKNOWN']},
      workExperienceSummary:{type:'string'},
      workExperienceRationale:{type:'string'},
      fieldClassification:{type:'string',enum:['RELATED','PARTIALLY_RELATED','NON_RELATED','UNKNOWN']},
      fieldClassificationRationale:{type:'string'},
      confidence:{type:'number',minimum:0,maximum:1},evidence:{type:'array',items:{type:'string'}},flags:{type:'array',items:{type:'string'}}
    },
    required:['qualification','institution','fieldOfStudy','cgpaGrade','graduationYear','transcriptAssessment','academicResultType','gradeEquivalencyStatus','gradeEquivalencyNote','relevantWorkExperience','workExperienceSummary','workExperienceRationale','fieldClassification','fieldClassificationRationale','confidence','evidence','flags']
  };
  const request = {
    model:model,store:false,reasoning:{effort:'low'},
    instructions:'You are the IUC IPGS Admission Intelligence Agent preparing an official internal screening record for Registry and SAC. Review the certificate, academic transcript and CV/resume carefully. Be conservative and evidence-led. Never invent qualification, CGPA, grade equivalency, field relationship or work experience. You may classify Field Relationship and Relevant Work Experience, but you do not make the authorised SAC decision. Return only the required structured output.',
    input:[{role:'user',content:content}],
    text:{format:{type:'json_schema',name:'iuc_admission_screening',description:'Normalized admission document screening output',strict:true,schema:schema}}
  };
  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
    method:'post',contentType:'application/json',headers:{Authorization:'Bearer ' + apiKey},
    payload:JSON.stringify(request),muteHttpExceptions:true
  });
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code < 200 || code >= 300) throw new Error('OPENAI_HTTP_' + code + ': ' + text.slice(0,600));
  const raw = JSON.parse(text);
  const outputText = v2AiExtractResponseText_(raw);
  if (!outputText) throw new Error('OpenAI response did not contain output_text.');
  return {model:model,runId:String(raw.id || ''),sourceDocuments:uploaded.sources,result:JSON.parse(outputText),raw:{id:raw.id || '',status:raw.status || '',model:raw.model || model}};
}

function v2AiReadApplicationDocuments_(application) {
  let files = [];
  try { files = JSON.parse(String(application['Uploaded Files JSON'] || '[]')); } catch (_) { files = []; }
  if (!Array.isArray(files)) files = [];
  const wanted = ['transcript','certificate','cvResume','preliminaryResearchIntent','otherSupportingDocument'];
  const selected = files.filter(function(file) { return wanted.indexOf(String(file && file.field || '')) > -1; });
  const items = [], sources = [];
  let totalBytes = 0;
  const maxTotal = 12 * 1024 * 1024;
  selected.some(function(meta) {
    const idMatch = String(meta.url || '').match(/[-\w]{20,}/);
    if (!idMatch) return false;
    try {
      const file = DriveApp.getFileById(idMatch[0]);
      const blob = file.getBlob();
      const bytes = blob.getBytes();
      if (totalBytes + bytes.length > maxTotal) return false;
      totalBytes += bytes.length;
      const mime = String(blob.getContentType() || meta.mimeType || 'application/pdf');
      const base64 = Utilities.base64Encode(bytes);
      if (/^image\/(png|jpeg)$/i.test(mime)) items.push({type:'input_image',image_url:'data:' + mime + ';base64,' + base64,detail:'auto'});
      else if (mime === 'application/pdf') items.push({type:'input_file',filename:String(meta.fileName || file.getName() || 'document.pdf'),file_data:base64});
      sources.push({field:String(meta.field || ''),fileName:String(meta.fileName || file.getName()),mimeType:mime,size:bytes.length});
    } catch (error) {
      sources.push({field:String(meta.field || ''),fileName:String(meta.fileName || ''),error:String(error && error.message || error)});
    }
    return totalBytes >= maxTotal;
  });
  return {items:items,sources:sources,totalBytes:totalBytes};
}

function v2AiExtractResponseText_(response) {
  if (response && typeof response.output_text === 'string' && response.output_text) return response.output_text;
  const output = response && Array.isArray(response.output) ? response.output : [];
  for (let i=0;i<output.length;i++) {
    const content = Array.isArray(output[i].content) ? output[i].content : [];
    for (let j=0;j<content.length;j++) {
      if (content[j] && content[j].type === 'output_text' && typeof content[j].text === 'string') return content[j].text;
    }
  }
  return '';
}

function v2ManualScreeningRaceControlledTest() {
  assertDevIdentity_();
  const stamp = Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'yyyyMMdd-HHmmss');
  const reference = 'V2-MANUAL-RACE-TEST-' + stamp;
  const now = new Date().toISOString();
  v2Append_('V2_APPLICATIONS', {'Reference No':reference,'Submitted At':now,'Applicant Type':'Local (Malaysian Citizen)','Student Name':'V2 MANUAL SCREEN TEST ' + stamp,'ID / Passport No':'TEST-' + stamp,'Personal Email':'NO-EMAIL-TEST','Programme':'MBA - Master of Business Administration','Level of Study':'Master','Study Mode':'Online','Intake':'September 2026','Entry Qualification Type':'Academic Qualification','Highest Qualification':'Bachelor Degree','Institution / Awarding Body':'IUC Test','Field of Study':'Business Administration','Academic Result / CGPA / Grade':'3.00','Uploaded Files JSON':'[]','Application Status':'TEST','Email Status':'DISABLED','Last Updated':now,'Version':'MANUAL_RACE_CONTROLLED_TEST'});
  v2Append_('V2_WORKFLOW', {'Reference No':reference,'Student Name':'V2 MANUAL SCREEN TEST ' + stamp,'Programme':'MBA - Master of Business Administration','Application Stage':'DOCUMENT_REVIEW','Application Status':'TEST','Document Review Status':'COMPLETE','Screening Recommendation':'PENDING_QUALIFICATION_SCREENING','Offer Letter Status':'NOT_ISSUED','Acceptance Status':'NOT_OPEN','Last Updated':now,'Updated By':'Controlled Test','Version':V2_BUILD});
  v2Append_(V2_DOCUMENT_REVIEW_SHEET, {'Reference No':reference,'Student Name':'V2 MANUAL SCREEN TEST ' + stamp,'Programme':'MBA - Master of Business Administration','Review Status':'COMPLETE','Required Documents JSON':'[]','Submitted Documents JSON':'[]','Missing Documents JSON':'[]','Reviewed At':now,'Reviewed By':'Controlled Test','Last Updated':now});
  const manual = v2CompleteManualQualificationScreening_({referenceNo:reference,fieldClassification:'RELATED',relevantWorkExperience:'YES',recommendedRoute:'DIRECT_ENTRY',remarks:'Controlled manual second-layer test.'}, 'Controlled Manual Screening Test');
  const autoAfter = v2TryAutoAiScreening_(reference, 'Controlled Auto After Manual');
  const finalWorkflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  const checks = {manualCompleted:manual && manual.ok === true && manual.winner === 'MANUAL',stageReadyForSac:String(finalWorkflow.record['Application Stage'] || '') === 'READY_FOR_SAC',autoDidNotOverwrite:autoAfter && autoAfter.skipped === true,recommendationPreserved:String(finalWorkflow.record['Screening Recommendation'] || '') === 'DIRECT_ENTRY'};
  const report = {ok:Object.keys(checks).every(function(k){return checks[k]===true;}),referenceNo:reference,checks:checks,manual:manual,autoAfter:autoAfter,v1Touched:false};
  Logger.log(JSON.stringify(report));
  return report;
}

