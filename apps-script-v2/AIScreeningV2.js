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
const V2_AI_SCHEMA_VERSION = '1.0';
const V2_AI_PROMPT_VERSION = 'AI_SCREENING_V1';

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
    fieldClassification: v2AiNormalizeField_(input.fieldClassification || input.field_classification) || 'UNKNOWN',
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
