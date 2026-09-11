/**
 * IUC IPGS Admission V2 - Qualification Screening Engine
 * DEVELOPMENT / TEST SAFE
 *
 * Purpose:
 * - Screen academic entry eligibility only after document review is COMPLETE.
 * - Keep programme-specific rules data-driven.
 * - Produce recommendation for Registry / SAC.
 * - Never auto-issue COL or Offer Letter.
 * - No external email.
 * - V1 is never modified.
 */

const V2_QUALIFICATION_SCREENING_SHEET = 'V2_QUALIFICATION_SCREENING';
const V2_QUALIFICATION_RULES_SHEET = 'V2_QUALIFICATION_RULES';

const V2_QUALIFICATION_SCREENING_HEADERS = [
  'Reference No',
  'Student Name',
  'Programme',
  'Highest Qualification',
  'Qualification Field',
  'Academic Result',
  'Field Classification',
  'Relevant Work Experience',
  'Screening Result',
  'Recommended Route',
  'Rule Code',
  'Screening Remarks',
  'Screened At',
  'Screened By',
  'Manual Review Required',
  'Last Updated'
];

const V2_QUALIFICATION_RULES_HEADERS = [
  'Rule Code',
  'Programme',
  'Qualification Level',
  'Field Classification',
  'Minimum CGPA',
  'Maximum CGPA',
  'Work Experience Requirement',
  'Recommended Route',
  'Rule Status',
  'Source / Authority',
  'Notes',
  'Last Updated'
];


function v2QualificationSetupFoundation() {
  assertDevIdentity_();

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);

  let screeningSheet =
    ss.getSheetByName(V2_QUALIFICATION_SCREENING_SHEET);

  if (!screeningSheet) {
    screeningSheet =
      ss.insertSheet(V2_QUALIFICATION_SCREENING_SHEET);
  }

  let rulesSheet =
    ss.getSheetByName(V2_QUALIFICATION_RULES_SHEET);

  if (!rulesSheet) {
    rulesSheet =
      ss.insertSheet(V2_QUALIFICATION_RULES_SHEET);
  }

  v2EnsureHeaders_(
    screeningSheet,
    V2_QUALIFICATION_SCREENING_HEADERS
  );

  v2EnsureHeaders_(
    rulesSheet,
    V2_QUALIFICATION_RULES_HEADERS
  );

  v2StyleHeader_(
    screeningSheet,
    V2_QUALIFICATION_SCREENING_HEADERS.length
  );

  v2StyleHeader_(
    rulesSheet,
    V2_QUALIFICATION_RULES_HEADERS.length
  );

  const report = {
    ok: true,
    screeningSheet:
      V2_QUALIFICATION_SCREENING_SHEET,
    rulesSheet:
      V2_QUALIFICATION_RULES_SHEET,
    screeningHeadersReady: true,
    rulesHeadersReady: true,
    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}


function v2QualificationPreflight() {
  assertDevIdentity_();

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);

  const screening =
    ss.getSheetByName(V2_QUALIFICATION_SCREENING_SHEET);

  const rules =
    ss.getSheetByName(V2_QUALIFICATION_RULES_SHEET);

  const applications =
    ss.getSheetByName('V2_APPLICATIONS');

  const workflow =
    ss.getSheetByName('V2_WORKFLOW');

  const documentReview =
    ss.getSheetByName('V2_DOCUMENT_REVIEW');

  const report = {
    ok:
      !!screening &&
      !!rules &&
      !!applications &&
      !!workflow &&
      !!documentReview,

    screeningSheetExists: !!screening,
    rulesSheetExists: !!rules,
    applicationsExists: !!applications,
    workflowExists: !!workflow,
    documentReviewExists: !!documentReview,

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2QualificationSeedVerifiedRules() {
  assertDevIdentity_();

  const now = new Date().toISOString();

  const rules = [

    // ==================================================
    // MBA - MASTER OF BUSINESS ADMINISTRATION
    // ==================================================

    {
      'Rule Code': 'MBA-REL-250-UP',
      'Programme': 'MBA - Master of Business Administration',
      'Qualification Level': 'BACHELOR',
      'Field Classification': 'RELATED',
      'Minimum CGPA': 2.50,
      'Maximum CGPA': '',
      'Work Experience Requirement': 'ANY',
      'Recommended Route': 'DIRECT_ENTRY',
      'Rule Status': 'DEV_TEST',
      'Source / Authority':
        'IUC MBA Prerequisite Course Admission Process & Operating Manual v1.0',
      'Notes':
        'Related Bachelor degree; CGPA 2.50 or above. Subject to complete requirements and authorised approval.',
      'Last Updated': now
    },

    {
      'Rule Code': 'MBA-REL-200-249',
      'Programme': 'MBA - Master of Business Administration',
      'Qualification Level': 'BACHELOR',
      'Field Classification': 'RELATED',
      'Minimum CGPA': 2.00,
      'Maximum CGPA': 2.4999,
      'Work Experience Requirement': 'ANY',
      'Recommended Route': 'INTERNAL_ASSESSMENT',
      'Rule Status': 'DEV_TEST',
      'Source / Authority':
        'IUC MBA Prerequisite Course Admission Process & Operating Manual v1.0',
      'Notes':
        'Related Bachelor degree; CGPA 2.00 to below 2.50. Rigorous internal assessment required.',
      'Last Updated': now
    },

    {
      'Rule Code': 'MBA-NREL-200-UP-EXP',
      'Programme': 'MBA - Master of Business Administration',
      'Qualification Level': 'BACHELOR',
      'Field Classification': 'NON_RELATED',
      'Minimum CGPA': 2.00,
      'Maximum CGPA': '',
      'Work Experience Requirement': 'YES',
      'Recommended Route': 'INTERNAL_ASSESSMENT',
      'Rule Status': 'DEV_TEST',
      'Source / Authority':
        'IUC MBA Prerequisite Course Admission Process & Operating Manual v1.0',
      'Notes':
        'Non-related Bachelor degree with verified relevant working experience.',
      'Last Updated': now
    },

    {
      'Rule Code': 'MBA-NREL-200-UP-NOEXP',
      'Programme': 'MBA - Master of Business Administration',
      'Qualification Level': 'BACHELOR',
      'Field Classification': 'NON_RELATED',
      'Minimum CGPA': 2.00,
      'Maximum CGPA': '',
      'Work Experience Requirement': 'NO',
      'Recommended Route': 'PREREQUISITE_OR_BRIDGING_REVIEW',
      'Rule Status': 'DEV_TEST',
      'Source / Authority':
        'IUC MBA Prerequisite Course Admission Process & Operating Manual v1.0',
      'Notes':
        'Regulatory verification required before imposing prerequisite. May become IUC readiness/bridging route.',
      'Last Updated': now
    },

    {
      'Rule Code': 'MBA-BELOW-200',
      'Programme': 'MBA - Master of Business Administration',
      'Qualification Level': 'BACHELOR',
      'Field Classification': 'ANY',
      'Minimum CGPA': '',
      'Maximum CGPA': 1.9999,
      'Work Experience Requirement': 'ANY',
      'Recommended Route': 'NOT_ELIGIBLE_CONVENTIONAL',
      'Rule Status': 'DEV_TEST',
      'Source / Authority':
        'IUC MBA Prerequisite Course Admission Process & Operating Manual v1.0',
      'Notes':
        'Below CGPA 2.00 under conventional academic route. Refer to another formally approved pathway if applicable.',
      'Last Updated': now
    },

    {
      'Rule Code': 'MBA-PARTIAL-MANUAL',
      'Programme': 'MBA - Master of Business Administration',
      'Qualification Level': 'BACHELOR',
      'Field Classification': 'PARTIALLY_RELATED',
      'Minimum CGPA': '',
      'Maximum CGPA': '',
      'Work Experience Requirement': 'ANY',
      'Recommended Route': 'MANUAL_ACADEMIC_REVIEW',
      'Rule Status': 'DEV_TEST',
      'Source / Authority':
        'IUC MBA Prerequisite Course Admission Process & Operating Manual v1.0',
      'Notes':
        'Partially related field requires curriculum/transcript-based academic judgement.',
      'Last Updated': now
    },


    // ==================================================
    // PHD IN MANAGEMENT
    // ==================================================

    {
      'Rule Code': 'PHD-MASTER-RELATED',
      'Programme': 'PhD in Management',
      'Qualification Level': 'MASTER',
      'Field Classification': 'RELATED',
      'Minimum CGPA': '',
      'Maximum CGPA': '',
      'Work Experience Requirement': 'ANY',
      'Recommended Route': 'NORMAL_ADMISSION_SCREENING',
      'Rule Status': 'DEV_TEST',
      'Source / Authority':
        'IUC PhD Management Admission Quality Manual',
      'Notes':
        'Related Master qualification. Still subject to research intent, supervisor fit, capacity and approved requirements.',
      'Last Updated': now
    },

    {
      'Rule Code': 'PHD-MASTER-NREL-EXP',
      'Programme': 'PhD in Management',
      'Qualification Level': 'MASTER',
      'Field Classification': 'NON_RELATED',
      'Minimum CGPA': '',
      'Maximum CGPA': '',
      'Work Experience Requirement': 'YES',
      'Recommended Route': 'INTERNAL_ASSESSMENT',
      'Rule Status': 'DEV_TEST',
      'Source / Authority':
        'IUC PhD Management Admission Quality Manual',
      'Notes':
        'Non-related Master qualification with verified relevant management/professional experience.',
      'Last Updated': now
    },

    {
      'Rule Code': 'PHD-MASTER-NREL-NOEXP',
      'Programme': 'PhD in Management',
      'Qualification Level': 'MASTER',
      'Field Classification': 'NON_RELATED',
      'Minimum CGPA': '',
      'Maximum CGPA': '',
      'Work Experience Requirement': 'NO',
      'Recommended Route': 'PREREQUISITE',
      'Rule Status': 'DEV_TEST',
      'Source / Authority':
        'IUC PhD Management Admission Quality Manual',
      'Notes':
        'Non-related Master qualification without sufficient relevant experience.',
      'Last Updated': now
    },

    {
      'Rule Code': 'PHD-BACHELOR-367-UP',
      'Programme': 'PhD in Management',
      'Qualification Level': 'BACHELOR',
      'Field Classification': 'ANY',
      'Minimum CGPA': 3.67,
      'Maximum CGPA': '',
      'Work Experience Requirement': 'ANY',
      'Recommended Route': 'EXCEPTIONAL_INTERNAL_ASSESSMENT',
      'Rule Status': 'DEV_TEST',
      'Source / Authority':
        'IUC PhD Management Admission Quality Manual',
      'Notes':
        'Exceptional direct Bachelor route. Requires rigorous internal assessment and authorised/Senate approval.',
      'Last Updated': now
    }
  ];


  rules.forEach(function(rule) {
    v2Upsert_(
      V2_QUALIFICATION_RULES_SHEET,
      'Rule Code',
      rule['Rule Code'],
      rule
    );
  });

  const report = {
    ok: true,
    rulesSeeded: rules.length,
    ruleStatus: 'DEV_TEST',
    mbaRules: rules.filter(function(r) {
      return r['Rule Code'].indexOf('MBA-') === 0;
    }).length,
    phdRules: rules.filter(function(r) {
      return r['Rule Code'].indexOf('PHD-') === 0;
    }).length,

    liveRulesEnabled: false,
    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2RunQualificationScreening(referenceNo, screeningInput) {
  assertDevIdentity_();

  const reference = String(referenceNo || '').trim();
  const input = screeningInput || {};

  if (!reference) {
    throw new Error('Reference No is required.');
  }

  const screenedBy =
    String(input.screenedBy || 'Registry / Admission').trim();

  const remarks =
    String(input.remarks || '').trim();

  const application = v2Find_(
    'V2_APPLICATIONS',
    'Reference No',
    reference
  );

  if (!application) {
    throw new Error('V2 application record not found.');
  }

  const workflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );

  if (!workflow) {
    throw new Error('V2 workflow record not found.');
  }

  const documentReview = v2Find_(
    'V2_DOCUMENT_REVIEW',
    'Reference No',
    reference
  );

  if (
    !documentReview ||
    String(documentReview.record['Review Status'] || '') !== 'COMPLETE'
  ) {
    throw new Error(
      'Qualification screening blocked: document review is not COMPLETE.'
    );
  }

  const currentStage =
    String(workflow.record['Application Stage'] || '').trim();

  if (
    currentStage !== 'DOCUMENT_REVIEW' &&
    currentStage !== 'QUALIFICATION_SCREENING'
  ) {
    throw new Error(
      'Qualification screening is not available at current stage: ' +
      currentStage
    );
  }

  // Enter qualification screening stage formally.
  if (currentStage === 'DOCUMENT_REVIEW') {
    v2UpdateStage_(
      {
        referenceNo: reference,
        stage: 'QUALIFICATION_SCREENING',
        remarks: 'Qualification screening started.'
      },
      screenedBy
    );
  }


  // --------------------------------------------------
  // Screening inputs
  // --------------------------------------------------

  const programme =
    v2QualificationNormalizeProgramme_(
      application.record['Programme']
    );

  const qualificationLevel =
    v2QualificationResolveLevel_(
      application.record['Highest Qualification']
    );

  const fieldClassification =
    v2QualificationNormalizeField_(
      input.fieldClassification
    );

  const relevantWorkExperience =
    v2QualificationNormalizeWorkExperience_(
      input.relevantWorkExperience
    );

  const cgpa =
    v2QualificationParseCgpa_(
      application.record['Academic Result / CGPA / Grade']
    );


  if (!fieldClassification) {
    throw new Error(
      'Field Classification is required: RELATED, PARTIALLY_RELATED or NON_RELATED.'
    );
  }

  if (!relevantWorkExperience) {
    throw new Error(
      'Relevant Work Experience is required: YES or NO.'
    );
  }

  if (!qualificationLevel) {
    throw new Error(
      'Qualification level could not be determined from Highest Qualification.'
    );
  }


  // --------------------------------------------------
  // Match against DEV_TEST rules
  // First matching rule in controlled rule-table order wins.
  // --------------------------------------------------

  const rules = v2Rows_(
    V2_QUALIFICATION_RULES_SHEET
  ).filter(function(rule) {
    return (
      String(rule['Rule Status'] || '').trim() === 'DEV_TEST' &&
      String(rule['Programme'] || '').trim() === programme
    );
  });

  let matchedRule = null;

  for (let i = 0; i < rules.length; i++) {
    if (
      v2QualificationRuleMatches_(
        rules[i],
        qualificationLevel,
        fieldClassification,
        relevantWorkExperience,
        cgpa
      )
    ) {
      matchedRule = rules[i];
      break;
    }
  }


  const recommendedRoute = matchedRule
    ? String(matchedRule['Recommended Route'] || '').trim()
    : 'MANUAL_ACADEMIC_REVIEW';

  const ruleCode = matchedRule
    ? String(matchedRule['Rule Code'] || '').trim()
    : '';

  const manualReviewRequired =
    !matchedRule ||
    recommendedRoute === 'MANUAL_ACADEMIC_REVIEW';

  const screeningResult = matchedRule
    ? (
        manualReviewRequired
          ? 'RULE_MATCHED_MANUAL_REVIEW'
          : 'RULE_MATCHED'
      )
    : 'NO_MATCHING_RULE';

  const screeningStatus =
    manualReviewRequired
      ? 'MANUAL_REVIEW_REQUIRED'
      : 'COMPLETED';

  const now = new Date().toISOString();


  // --------------------------------------------------
  // Save detailed screening record
  // --------------------------------------------------

  v2Upsert_(
    V2_QUALIFICATION_SCREENING_SHEET,
    'Reference No',
    reference,
    {
      'Reference No': reference,
      'Student Name':
        application.record['Student Name'] || '',
      'Programme':
        application.record['Programme'] || '',
      'Highest Qualification':
        application.record['Highest Qualification'] || '',
      'Qualification Field':
        application.record['Field of Study'] || '',
      'Academic Result':
        application.record['Academic Result / CGPA / Grade'] || '',
      'Field Classification':
        fieldClassification,
      'Relevant Work Experience':
        relevantWorkExperience,
      'Screening Result':
        screeningResult,
      'Recommended Route':
        recommendedRoute,
      'Rule Code':
        ruleCode,
      'Screening Remarks':
        remarks,
      'Screened At':
        now,
      'Screened By':
        screenedBy,
      'Manual Review Required':
        manualReviewRequired ? 'YES' : 'NO',
      'Last Updated':
        now
    }
  );


  // --------------------------------------------------
  // Update workflow summary
  // --------------------------------------------------

  const refreshedWorkflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );

  v2UpdateRow_(
    refreshedWorkflow.sheet,
    refreshedWorkflow.rowNumber,
    {
      'Qualification Screening Status':
        screeningStatus,
      'Field Classification':
        fieldClassification,
      'Relevant Work Experience':
        relevantWorkExperience,
      'Qualification Rule Code':
        ruleCode,
      'Qualification Screened At':
        now,
      'Qualification Screened By':
        screenedBy,
      'Manual Review Required':
        manualReviewRequired ? 'YES' : 'NO',
      'Screening Recommendation':
        recommendedRoute,
      'Last Updated':
        now,
      'Updated By':
        screenedBy
    }
  );


  // --------------------------------------------------
  // Audit
  // --------------------------------------------------

  v2Audit_(
    reference,
    'QUALIFICATION_SCREENING',
    'QUALIFICATION_SCREENING_COMPLETED',
    {},
    {
      programme: programme,
      qualificationLevel: qualificationLevel,
      cgpa: isFinite(cgpa) ? cgpa : '',
      fieldClassification: fieldClassification,
      relevantWorkExperience: relevantWorkExperience,
      ruleCode: ruleCode,
      recommendedRoute: recommendedRoute,
      manualReviewRequired: manualReviewRequired
    },
    screenedBy,
    'SUCCESS',
    remarks
  );


  // --------------------------------------------------
  // Only completed screening moves to READY_FOR_SAC.
  // Manual academic review remains at QUALIFICATION_SCREENING.
  // --------------------------------------------------

  if (!manualReviewRequired) {
    v2UpdateStage_(
      {
        referenceNo: reference,
        stage: 'READY_FOR_SAC',
        remarks:
          'Qualification screening completed. Recommended route: ' +
          recommendedRoute
      },
      screenedBy
    );
  }


  v2InvalidateCache_();

  const finalWorkflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );

  const report = {
    ok: true,

    referenceNo: reference,

    programme: programme,
    qualificationLevel: qualificationLevel,

    fieldClassification: fieldClassification,
    relevantWorkExperience: relevantWorkExperience,

    cgpa: isFinite(cgpa) ? cgpa : null,

    ruleMatched: !!matchedRule,
    ruleCode: ruleCode,

    screeningStatus: screeningStatus,
    recommendedRoute: recommendedRoute,
    manualReviewRequired: manualReviewRequired,

    applicationStage:
      finalWorkflow.record['Application Stage'],

    nextAction:
      manualReviewRequired
        ? 'MANUAL_ACADEMIC_REVIEW'
        : 'SAC_PREPARATION',

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}


function v2QualificationRuleMatches_(
  rule,
  qualificationLevel,
  fieldClassification,
  relevantWorkExperience,
  cgpa
) {
  const ruleLevel =
    String(rule['Qualification Level'] || '')
      .trim()
      .toUpperCase();

  const ruleField =
    String(rule['Field Classification'] || '')
      .trim()
      .toUpperCase();

  const ruleExperience =
    String(rule['Work Experience Requirement'] || '')
      .trim()
      .toUpperCase();

  const minRaw = rule['Minimum CGPA'];
  const maxRaw = rule['Maximum CGPA'];

  const min =
    minRaw === '' || minRaw === null
      ? null
      : Number(minRaw);

  const max =
    maxRaw === '' || maxRaw === null
      ? null
      : Number(maxRaw);


  if (
    ruleLevel &&
    ruleLevel !== 'ANY' &&
    ruleLevel !== qualificationLevel
  ) {
    return false;
  }

  if (
    ruleField &&
    ruleField !== 'ANY' &&
    ruleField !== fieldClassification
  ) {
    return false;
  }

  if (
    ruleExperience &&
    ruleExperience !== 'ANY' &&
    ruleExperience !== relevantWorkExperience
  ) {
    return false;
  }

  if (min !== null) {
    if (!isFinite(cgpa) || cgpa < min) {
      return false;
    }
  }

  if (max !== null) {
    if (!isFinite(cgpa) || cgpa > max) {
      return false;
    }
  }

  return true;
}


function v2QualificationNormalizeProgramme_(programme) {
  const value = String(programme || '').trim();

  if (
    /\bMBA\b/i.test(value) ||
    /MASTER OF BUSINESS ADMINISTRATION/i.test(value)
  ) {
    return 'MBA - Master of Business Administration';
  }

  if (
    (
      /\bPHD\b/i.test(value) ||
      /DOCTOR OF PHILOSOPHY/i.test(value)
    ) &&
    /MANAGEMENT/i.test(value)
  ) {
    return 'PhD in Management';
  }

  return value;
}


function v2QualificationResolveLevel_(highestQualification) {
  const value =
    String(highestQualification || '').toUpperCase();

  if (
    value.indexOf('MASTER') > -1 ||
    value.indexOf('SARJANA ') > -1
  ) {
    return 'MASTER';
  }

  if (
    value.indexOf('BACHELOR') > -1 ||
    value.indexOf('SARJANA MUDA') > -1
  ) {
    return 'BACHELOR';
  }

  return '';
}


function v2QualificationNormalizeField_(value) {
  const normal =
    String(value || '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');

  if (
    normal === 'RELATED' ||
    normal === 'PARTIALLY_RELATED' ||
    normal === 'NON_RELATED'
  ) {
    return normal;
  }

  return '';
}


function v2QualificationNormalizeWorkExperience_(value) {
  if (value === true) return 'YES';
  if (value === false) return 'NO';

  const normal =
    String(value || '').trim().toUpperCase();

  if (
    normal === 'YES' ||
    normal === 'Y' ||
    normal === 'RELEVANT'
  ) {
    return 'YES';
  }

  if (
    normal === 'NO' ||
    normal === 'N' ||
    normal === 'NOT RELEVANT'
  ) {
    return 'NO';
  }

  return '';
}


function v2QualificationParseCgpa_(value) {
  const text = String(value || '').trim();

  const match = text.match(
    /(\d+(?:\.\d+)?)/
  );

  if (!match) {
    return NaN;
  }

  const result = Number(match[1]);

  return isFinite(result)
    ? result
    : NaN;
}

function v2QualificationControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const now = new Date().toISOString();

  const cases = [
    {
      ref: 'V2-QS-MBA-DIRECT-' + stamp,
      name: 'V2 QS MBA DIRECT TEST',
      programme: 'MBA - Master of Business Administration',
      highestQualification: 'Bachelor Degree',
      fieldOfStudy: 'Business Administration',
      cgpa: '3.00',
      fieldClassification: 'RELATED',
      relevantWorkExperience: 'NO',
      expectedRoute: 'DIRECT_ENTRY'
    },
    {
      ref: 'V2-QS-MBA-IA-' + stamp,
      name: 'V2 QS MBA IA TEST',
      programme: 'MBA - Master of Business Administration',
      highestQualification: 'Bachelor Degree',
      fieldOfStudy: 'Business Administration',
      cgpa: '2.30',
      fieldClassification: 'RELATED',
      relevantWorkExperience: 'NO',
      expectedRoute: 'INTERNAL_ASSESSMENT'
    },
    {
      ref: 'V2-QS-MBA-PRQ-' + stamp,
      name: 'V2 QS MBA PREREQ TEST',
      programme: 'MBA - Master of Business Administration',
      highestQualification: 'Bachelor Degree',
      fieldOfStudy: 'Engineering',
      cgpa: '2.80',
      fieldClassification: 'NON_RELATED',
      relevantWorkExperience: 'NO',
      expectedRoute: 'PREREQUISITE_OR_BRIDGING_REVIEW'
    },
    {
      ref: 'V2-QS-PHD-IA-' + stamp,
      name: 'V2 QS PHD IA TEST',
      programme: 'PhD in Management',
      highestQualification: 'Master Degree',
      fieldOfStudy: 'Engineering',
      cgpa: '3.20',
      fieldClassification: 'NON_RELATED',
      relevantWorkExperience: 'YES',
      expectedRoute: 'INTERNAL_ASSESSMENT'
    }
  ];


  function createBaseRecords(testCase) {
    v2Append_('V2_APPLICATIONS', {
      'Reference No': testCase.ref,
      'Submitted At': now,
      'Applicant Type': 'Local (Malaysian Citizen)',
      'Student Name': testCase.name,
      'ID / Passport No': 'TEST-' + testCase.ref,
      'Personal Email': 'NO-EMAIL-TEST',
      'Phone Number': 'TEST',
      'Programme': testCase.programme,
      'Level of Study':
        testCase.programme.indexOf('PhD') > -1 ? 'Doctorate' : 'Master',
      'Study Mode': 'Online',
      'Intake': 'September 2026',
      'Intake ID': 'SEP-2026',
      'Entry Qualification Type': 'Academic Qualification',
      'Highest Qualification': testCase.highestQualification,
      'Institution / Awarding Body': 'V2 Test Environment',
      'Field of Study': testCase.fieldOfStudy,
      'Academic Result / CGPA / Grade': testCase.cgpa,
      'Transfer Applicant': 'NO',
      'Agent Code': '',
      'Agent Name': '',
      'Agent Email': '',
      'Prospect Status': 'PENDING',
      'SKY Prospect ID': '',
      'Fee Group': '',
      'Prospect Updated At': '',
      'Prospect Remarks': '',
      'Student Folder URL': '',
      'Admission Form PDF URL': '',
      'Uploaded Files JSON': '[]',
      'Raw Application JSON': '{}',
      'Application Status': 'TEST',
      'Email Status': 'DISABLED',
      'Last Updated': now,
      'Version': 'CONTROLLED_QUALIFICATION_TEST'
    });

    v2Append_('V2_WORKFLOW', {
      'Reference No': testCase.ref,
      'Student Name': testCase.name,
      'ID / Passport No': 'TEST-' + testCase.ref,
      'Personal Email': 'NO-EMAIL-TEST',
      'Innovative Email': '',
      'Programme': testCase.programme,
      'Level of Study':
        testCase.programme.indexOf('PhD') > -1 ? 'Doctorate' : 'Master',
      'Intake': 'SEP-2026',

      'Application Stage': 'DOCUMENT_REVIEW',
      'Application Status': 'TEST',

      'Document Review Status': 'COMPLETE',
      'Document Reviewed At': now,
      'Document Reviewed By': 'Controlled Test',
      'Missing Document Count': 0,

      'Qualification Screening Status': 'PENDING',
      'Field Classification': '',
      'Relevant Work Experience': '',
      'Qualification Rule Code': '',
      'Qualification Screened At': '',
      'Qualification Screened By': '',
      'Manual Review Required': '',

      'Screening Recommendation':
        'PENDING_QUALIFICATION_SCREENING',

      'Prospect Status': 'PENDING',
      'SKY Prospect ID': '',
      'Fee Group': '',
      'Prospect Updated At': '',

      'SAC Session ID': '',
      'SAC Decision': '',
      'SAC Endorsed At': '',

      'Assessment Status': 'NOT_DETERMINED',
      'Prerequisite Status': 'NOT_DETERMINED',
      'Offer Letter Status': 'NOT_ISSUED',
      'Offer Letter Issued At': '',
      'Acceptance Status': 'NOT_OPEN',
      'Orientation Session ID': '',
      'Orientation Status': 'NOT_ASSIGNED',
      'Provisioning Status': 'NOT_STARTED',
      'Academic Handover Status': 'NOT_READY',

      'Student Folder URL': '',
      'Last Updated': now,
      'Updated By': 'Controlled Qualification Test',
      'Version': V2_BUILD
    });

    v2Upsert_(
      'V2_DOCUMENT_REVIEW',
      'Reference No',
      testCase.ref,
      {
        'Reference No': testCase.ref,
        'Student Name': testCase.name,
        'Programme': testCase.programme,
        'Review Status': 'COMPLETE',
        'Required Documents JSON': '[]',
        'Submitted Documents JSON': '[]',
        'Missing Documents JSON': '[]',
        'Reviewer Remarks': 'Controlled qualification test',
        'Reviewed At': now,
        'Reviewed By': 'Controlled Test',
        'Applicant Notification Status': 'NOT_SENT',
        'Last Updated': now
      }
    );
  }


  const results = [];

  cases.forEach(function(testCase) {
    createBaseRecords(testCase);

    const result = v2RunQualificationScreening(
      testCase.ref,
      {
        fieldClassification:
          testCase.fieldClassification,
        relevantWorkExperience:
          testCase.relevantWorkExperience,
        screenedBy:
          'Controlled Qualification Test',
        remarks:
          'Controlled rule matching test.'
      }
    );

    results.push({
      referenceNo: testCase.ref,
      expectedRoute: testCase.expectedRoute,
      actualRoute: result.recommendedRoute,
      stage: result.applicationStage,
      passed:
        result.recommendedRoute === testCase.expectedRoute &&
        result.applicationStage === 'READY_FOR_SAC'
    });
  });


  const report = {
    ok: results.every(function(item) {
      return item.passed === true;
    }),

    results: results,

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false,
    testRecordsCreated: cases.length
  };

  Logger.log(JSON.stringify(report));
  return report;
}