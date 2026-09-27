/**
 * IUC IPGS Admission V2 - Document Review Module
 * DEVELOPMENT / TEST SAFE
 *
 * Purpose:
 * - Review document completeness before SAC.
 * - Keep document review separate from academic eligibility screening.
 * - Update V2_WORKFLOW only.
 * - No email is sent in this development version.
 * - V1 is never read or modified.
 */

const V2_DOCUMENT_REVIEW_SHEET = 'V2_DOCUMENT_REVIEW';

const V2_DOCUMENT_REVIEW_HEADERS = [
  'Reference No',
  'Student Name',
  'Programme',
  'Review Status',
  'Required Documents JSON',
  'Submitted Documents JSON',
  'Missing Documents JSON',
  'Outstanding Documents JSON',
  'Reviewer Remarks',
  'Reviewed At',
  'Reviewed By',
  'Applicant Notification Status',
  'Last Updated'
];


function v2DocumentReviewSetupFoundation() {
  assertDevIdentity_();

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);

  let sheet = ss.getSheetByName(V2_DOCUMENT_REVIEW_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(V2_DOCUMENT_REVIEW_SHEET);
  }

  v2EnsureHeaders_(sheet, V2_DOCUMENT_REVIEW_HEADERS);
  v2StyleHeader_(sheet, V2_DOCUMENT_REVIEW_HEADERS.length);

  const report = {
    ok: true,
    sheet: V2_DOCUMENT_REVIEW_SHEET,
    headersReady: V2_DOCUMENT_REVIEW_HEADERS.every(function(header) {
      return v2Headers_(sheet).indexOf(header) > -1;
    }),
    emailSent: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}


function v2DocumentReviewPreflight() {
  assertDevIdentity_();

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);

  const documentSheet = ss.getSheetByName(V2_DOCUMENT_REVIEW_SHEET);
  const applicationSheet = ss.getSheetByName('V2_APPLICATIONS');
  const workflowSheet = ss.getSheetByName('V2_WORKFLOW');

  const report = {
    ok:
      !!documentSheet &&
      !!applicationSheet &&
      !!workflowSheet &&
      V2_DOCUMENT_REVIEW_HEADERS.every(function(header) {
        return v2Headers_(documentSheet).indexOf(header) > -1;
      }),

    documentReviewSheetExists: !!documentSheet,
    applicationsExists: !!applicationSheet,
    workflowExists: !!workflowSheet,

    emailSent: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}

const V2_DOCUMENT_LABELS = Object.freeze({
  identityDocument: 'Identity Document / NRIC',
  passportPhoto: 'Passport Size Photo',
  passportCopyInternational: 'Passport Copy',
  transcript: 'Highest Academic Transcript',
  certificate: 'Highest Academic / Skills Certificate',
  apelCertificate: 'APEL Certificate',
  cvResume: 'Curriculum Vitae (CV) / Resume',
  otherSupportingDocument: 'Professional / Other Supporting Document',
  completedAdmissionForm: 'Completed International Admission Form',
  completedHealthDeclaration: 'Completed Health Declaration Form',
  emgsPaymentReceipt: 'EMGS / Visa Related Payment Receipt',
  preliminaryResearchIntent: 'Preliminary Research Intent'
});


function v2RunDocumentReview(referenceNo, reviewer, remarks) {
  assertDevIdentity_();

  const reference = String(referenceNo || '').trim();
  const reviewedBy = String(reviewer || 'Registry / Admission').trim();
  const reviewRemarks = String(remarks || '').trim();

  if (!reference) {
    throw new Error('Reference No is required.');
  }

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

  const currentStage = String(
    workflow.record['Application Stage'] || ''
  ).trim();

  if (
    currentStage !== 'APPLICATION_RECEIVED' &&
    currentStage !== 'DOCUMENT_REVIEW'
  ) {
    throw new Error(
      'Document review is not available at current stage: ' +
      currentStage
    );
  }

  // Move formally into DOCUMENT_REVIEW when review starts.
  if (currentStage === 'APPLICATION_RECEIVED') {
    v2UpdateStage_(
      {
        referenceNo: reference,
        stage: 'DOCUMENT_REVIEW',
        remarks: 'Document review started.'
      },
      reviewedBy
    );
  }

  const requiredDocuments =
    v2GetRequiredDocuments_(application.record);

  const submittedDocuments =
    v2GetSubmittedDocuments_(application.record);

  const submittedKeys = submittedDocuments.map(function(doc) {
    return String(doc.field || '').trim();
  });

  const allMissingDocuments = requiredDocuments.filter(function(doc) {
    return submittedKeys.indexOf(doc.key) === -1;
  });

  // Current operational rule: every required item blocks Stage 2.
  // PhD Preliminary Research Intent is an additional mandatory document.
  const outstandingDocuments = [];
  const missingDocuments = allMissingDocuments;

  const status =
    missingDocuments.length === 0 ? 'COMPLETE' : 'INCOMPLETE';

  const now = new Date().toISOString();

  const reviewRow = {
    'Reference No': reference,
    'Student Name': application.record['Student Name'] || '',
    'Programme': application.record['Programme'] || '',
    'Review Status': status,

    'Required Documents JSON':
      JSON.stringify(requiredDocuments),

    'Submitted Documents JSON':
      JSON.stringify(submittedDocuments),

    'Missing Documents JSON':
      JSON.stringify(missingDocuments),

    'Outstanding Documents JSON':
      JSON.stringify(outstandingDocuments),

    'Reviewer Remarks': reviewRemarks,
    'Reviewed At': now,
    'Reviewed By': reviewedBy,

    // Email intentionally disabled in DEV.
    'Applicant Notification Status': 'NOT_SENT',

    'Last Updated': now
  };

  v2Upsert_(
    V2_DOCUMENT_REVIEW_SHEET,
    'Reference No',
    reference,
    reviewRow
  );

  const refreshedWorkflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    reference
  );

  v2UpdateRow_(
    refreshedWorkflow.sheet,
    refreshedWorkflow.rowNumber,
    {
      'Document Review Status': status,
      'Document Reviewed At': now,
      'Document Reviewed By': reviewedBy,
      'Missing Document Count': missingDocuments.length,
      'Last Updated': now,
      'Updated By': reviewedBy
    }
  );

  v2Audit_(
    reference,
    'DOCUMENT_REVIEW',
    'DOCUMENT_REVIEW_COMPLETED',
    {},
    {
      status: status,
      requiredCount: requiredDocuments.length,
      submittedCount: submittedDocuments.length,
      missingCount: missingDocuments.length,
      missingDocuments: missingDocuments,
      outstandingCount: outstandingDocuments.length,
      outstandingDocuments: outstandingDocuments
    },
    reviewedBy,
    'SUCCESS',
    reviewRemarks
  );

  v2InvalidateCache_();

  // Agentic handoff:
  // When n8n orchestration is active, Document Review emits a real event and
  // the Admission Intelligence Agent becomes responsible for the next action.
  // If n8n is unavailable or not configured, preserve the existing local
  // auto-screening behaviour as a safe fallback.
  let autoAiScreening = null;
  let agenticHandoff = null;
  if (status === 'COMPLETE') {
    try {
      if (typeof v2AgenticEnabled_ === 'function' && v2AgenticEnabled_()) {
        agenticHandoff = v2EmitAgentEvent_({
          referenceNo:reference,
          eventType:'DOCUMENT_COMPLETENESS_CONFIRMED',
          agentId:'ORCHESTRATOR',
          agentName:'AI Orchestrator',
          action:'ROUTE_COMPLIANCE',
          status:'QUEUED',
          fromStage:'DOCUMENT_REVIEW',
          toStage:'DOCUMENT_REVIEW',
          source:'ADMISSION_V2',
          summary:'Deterministic completeness is complete. Route applicant to Compliance & Records Agent for document-quality inspection.',
          data:{
            documentReviewStatus:status,
            missingCount:missingDocuments.length,
            outstandingCount:outstandingDocuments.length
          }
        });
      }

      if (agenticHandoff && agenticHandoff.sent) {
        autoAiScreening = {
          ok:true,
          status:'HANDED_TO_N8N_COMPLIANCE',
          eventId:agenticHandoff.eventId,
          manualScreeningAvailable:true
        };
      } else {
        const agenticMode = typeof v2AgenticEnabled_ === 'function' && v2AgenticEnabled_();
        if (agenticMode) {
          const compliance = v2RunComplianceDocumentQuality_(
            {referenceNo:reference},
            'Document Review Local Compliance Fallback'
          );
          autoAiScreening = {
            ok:true,
            status:String(compliance && compliance.status || 'UNKNOWN'),
            compliance:compliance,
            admissionIntelligence:null,
            manualScreeningAvailable:true
          };
          if (compliance && String(compliance.status || '').toUpperCase() === 'PASS') {
            autoAiScreening.admissionIntelligence = v2TryAutoAiScreening_(
              reference,
              'Document Review Local Admission Intelligence Fallback'
            );
          }
        } else {
          autoAiScreening = v2TryAutoAiScreening_(
            reference,
            'Document Review Auto Trigger'
          );
        }
      }
    } catch (autoAiError) {
      autoAiScreening = {
        ok: false,
        status: 'AUTO_FAILED',
        message: String(autoAiError && autoAiError.message || autoAiError),
        manualScreeningAvailable: true
      };
      Logger.log('V2 auto AI / agentic handoff failed non-blocking: ' + autoAiScreening.message);
    }
  }

  const report = {
    ok: true,
    referenceNo: reference,
    status: status,

    requiredCount: requiredDocuments.length,
    submittedCount: submittedDocuments.length,
    missingCount: missingDocuments.length,

    missingDocuments: missingDocuments,
    outstandingCount: outstandingDocuments.length,
    outstandingDocuments: outstandingDocuments,

    nextAction:
      status === 'COMPLETE'
        ? (
            agenticHandoff && agenticHandoff.sent
              ? 'COMPLIANCE_DOCUMENT_QUALITY'
              : (
                  autoAiScreening && autoAiScreening.compliance
                    ? (
                        String(autoAiScreening.compliance.status||'').toUpperCase()==='PASS'
                          ? 'QUALIFICATION_SCREENING'
                          : (
                              String(autoAiScreening.compliance.status||'').toUpperCase()==='FOLLOW_UP_REQUIRED'
                                ? 'REQUEST_REPLACEMENT_DOCUMENTS'
                                : 'HUMAN_DOCUMENT_REVIEW'
                            )
                      )
                    : 'QUALIFICATION_SCREENING'
                )
          )
        : 'REQUEST_MISSING_DOCUMENTS',

    applicationStage: 'DOCUMENT_REVIEW',
    autoAiScreening: autoAiScreening,
    agenticHandoff: agenticHandoff,
    manualScreeningAvailable: status === 'COMPLETE',

    emailSent: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}


function v2GetRequiredDocuments_(application) {
  const required = [];

  function add(key) {
    if (!V2_DOCUMENT_LABELS[key]) return;

    if (!required.some(function(item) {
      return item.key === key;
    })) {
      required.push({
        key: key,
        label: V2_DOCUMENT_LABELS[key]
      });
    }
  }

  const applicantType =
    String(application['Applicant Type'] || '').toUpperCase();

  const programme =
    String(application['Programme'] || '');

  const international =
    applicantType.indexOf('INTERNATIONAL') > -1 ||
    applicantType.indexOf('NON-MALAYSIAN') > -1;

  // Latest operational rule: four core documents are mandatory.
  // Local identity = IC/NRIC. International identity = passport copy.
  if (international) {
    add('passportCopyInternational');
  } else {
    add('identityDocument');
  }

  add('transcript');
  add('certificate');
  add('cvResume');

  // PhD has one additional mandatory document.
  if (
    /^PHD\b/i.test(programme) ||
    /DOCTOR OF PHILOSOPHY/i.test(programme)
  ) {
    add('preliminaryResearchIntent');
  }

  return required;
}


function v2GetSubmittedDocuments_(application) {
  let uploaded = [];

  try {
    uploaded = JSON.parse(
      String(application['Uploaded Files JSON'] || '[]')
    );
  } catch (error) {
    uploaded = [];
  }

  if (!Array.isArray(uploaded)) {
    return [];
  }

  return uploaded
    .filter(function(doc) {
      return (
        doc &&
        String(doc.field || '').trim() &&
        (
          String(doc.url || '').trim() ||
          String(doc.fileName || '').trim()
        )
      );
    })
    .map(function(doc) {
      const key = String(doc.field || '').trim();

      return {
        field: key,
        label: V2_DOCUMENT_LABELS[key] || key,
        fileName: String(doc.fileName || ''),
        url: String(doc.url || '')
      };
    });
}

function v2DocumentReviewControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const now = new Date().toISOString();

  const completeRef = 'V2-DOC-COMPLETE-' + stamp;
  const incompleteRef = 'V2-DOC-INCOMPLETE-' + stamp;

  // Local core requirement:
  // identityDocument, transcript, certificate, cvResume

  const completeFiles = [
    {
      field: 'identityDocument',
      fileName: 'TEST_IC.pdf',
      url: 'TEST://identity'
    },
    {
      field: 'transcript',
      fileName: 'TEST_TRANSCRIPT.pdf',
      url: 'TEST://transcript'
    },
    {
      field: 'certificate',
      fileName: 'TEST_CERTIFICATE.pdf',
      url: 'TEST://certificate'
    },
    {
      field: 'cvResume',
      fileName: 'TEST_CV.pdf',
      url: 'TEST://cv'
    }
  ];

  // Certificate intentionally missing.
  const incompleteFiles = [
    {
      field: 'identityDocument',
      fileName: 'TEST_IC.pdf',
      url: 'TEST://identity'
    },
    {
      field: 'transcript',
      fileName: 'TEST_TRANSCRIPT.pdf',
      url: 'TEST://transcript'
    },
    {
      field: 'cvResume',
      fileName: 'TEST_CV.pdf',
      url: 'TEST://cv'
    }
  ];


  function createTestApplication(reference, name, files) {
    v2Append_('V2_APPLICATIONS', {
      'Reference No': reference,
      'Submitted At': now,
      'Applicant Type': 'Local (Malaysian Citizen)',
      'Student Name': name,
      'ID / Passport No': 'TEST-' + reference,
      'Personal Email': 'NO-EMAIL-TEST',
      'Phone Number': 'TEST',
      'Programme': 'MBA - Master of Business Administration',
      'Level of Study': 'Master',
      'Study Mode': 'Online',
      'Intake': 'September 2026',
      'Intake ID': 'SEP-2026',

      'Entry Qualification Type': 'Academic Qualification',
      'Highest Qualification': 'Bachelor Degree - Test',
      'Institution / Awarding Body': 'V2 Test Environment',
      'Field of Study': 'Business Administration',
      'Academic Result / CGPA / Grade': '3.00',

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

      'Uploaded Files JSON': JSON.stringify(files),
      'Raw Application JSON': '{}',

      'Application Status': 'TEST',
      'Email Status': 'DISABLED',
      'Last Updated': now,
      'Version': 'CONTROLLED_DOCUMENT_REVIEW_TEST'
    });


    v2Append_('V2_WORKFLOW', {
      'Reference No': reference,
      'Student Name': name,
      'ID / Passport No': 'TEST-' + reference,
      'Personal Email': 'NO-EMAIL-TEST',
      'Innovative Email': '',

      'Programme': 'MBA - Master of Business Administration',
      'Level of Study': 'Master',
      'Intake': 'SEP-2026',

      'Application Stage': 'APPLICATION_RECEIVED',
      'Application Status': 'TEST',

      'Document Review Status': 'PENDING',
      'Document Reviewed At': '',
      'Document Reviewed By': '',
      'Missing Document Count': 0,

      'Screening Recommendation': 'MANUAL_REVIEW',

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
      'Updated By': 'Controlled Document Review Test',
      'Version': V2_BUILD
    });
  }


  // --------------------------------------------------
  // Create two isolated V2 test records
  // --------------------------------------------------

  createTestApplication(
    completeRef,
    'V2 DOCUMENT COMPLETE TEST ' + stamp,
    completeFiles
  );

  createTestApplication(
    incompleteRef,
    'V2 DOCUMENT INCOMPLETE TEST ' + stamp,
    incompleteFiles
  );


  // --------------------------------------------------
  // Run actual Document Review logic
  // --------------------------------------------------

  const completeResult = v2RunDocumentReview(
    completeRef,
    'Controlled Test',
    'Complete document scenario.'
  );

  const incompleteResult = v2RunDocumentReview(
    incompleteRef,
    'Controlled Test',
    'Incomplete document scenario.'
  );


  // --------------------------------------------------
  // Verify workflow results
  // --------------------------------------------------

  const completeWorkflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    completeRef
  );

  const incompleteWorkflow = v2Find_(
    'V2_WORKFLOW',
    'Reference No',
    incompleteRef
  );


  const checks = {
    completeDetected:
      completeResult.status === 'COMPLETE',

    completeMissingZero:
      Number(completeResult.missingCount) === 0,

    completeNextAction:
      completeResult.nextAction === 'QUALIFICATION_SCREENING',

    completeStageControlled:
      completeWorkflow &&
      String(
        completeWorkflow.record['Application Stage']
      ) === 'DOCUMENT_REVIEW',


    incompleteDetected:
      incompleteResult.status === 'INCOMPLETE',

    incompleteMissingOne:
      Number(incompleteResult.missingCount) === 1,

    incompleteCertificateDetected:
      incompleteResult.missingDocuments.some(function(item) {
        return item.key === 'certificate';
      }),

    incompleteNextAction:
      incompleteResult.nextAction === 'REQUEST_MISSING_DOCUMENTS',

    incompleteStageControlled:
      incompleteWorkflow &&
      String(
        incompleteWorkflow.record['Application Stage']
      ) === 'DOCUMENT_REVIEW'
  };


  const report = {
    ok:
      checks.completeDetected &&
      checks.completeMissingZero &&
      checks.completeNextAction &&
      checks.completeStageControlled &&
      checks.incompleteDetected &&
      checks.incompleteMissingOne &&
      checks.incompleteCertificateDetected &&
      checks.incompleteNextAction &&
      checks.incompleteStageControlled,

    completeReference: completeRef,
    incompleteReference: incompleteRef,

    checks: checks,

    emailSent: false,
    v1Touched: false,
    testRecordsCreated: 2
  };


  Logger.log(JSON.stringify(report));
  return report;
}