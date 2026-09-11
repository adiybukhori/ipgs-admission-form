const V2_OFFER_EMAIL_MODE = 'DISABLED/TEST';

const V2_OFFER_WORKFLOW_HEADERS = [
  'Offer Letter PDF URL',
  'Offer Letter Remarks',
  'Acceptance Token Hash',
  'Acceptance Signing URL',
  'Acceptance Received At',
  'Acceptance Remarks',
  'Acceptance PDF URL',
  'Acceptance Signed Name',
  'Acceptance Signed At',
];


function v2OfferSetupFoundation() {
  assertDevIdentity_();

  const ss =
    SpreadsheetApp.openById(
      CONFIG.spreadsheetId
    );

  const workflow =
    ss.getSheetByName('V2_WORKFLOW');

  if (!workflow) {
    throw new Error(
      'V2_WORKFLOW sheet not found.'
    );
  }

  v2OfferEnsureHeaders_(
    workflow,
    V2_OFFER_WORKFLOW_HEADERS
  );

  const report = {
    ok: true,

    workflowExists: true,
    headersReady: true,

    offerEmailMode:
      V2_OFFER_EMAIL_MODE,

    offerGenerated: false,
    acceptanceSent: false,

    v1Touched: false
  };

  Logger.log(
    JSON.stringify(report)
  );

  return report;
}



function v2PrepareOffer_(referenceNo, actor) {
  assertDevIdentity_();

  const reference =
    String(referenceNo || '').trim();

  if (!reference) {
    throw new Error(
      'Reference No is required.'
    );
  }

  const workflow =
    v2Find_(
      'V2_WORKFLOW',
      'Reference No',
      reference
    );

  if (!workflow) {
    throw new Error(
      'V2 workflow record not found.'
    );
  }

  const application =
    v2Find_(
      'V2_APPLICATIONS',
      'Reference No',
      reference
    );

  if (!application) {
    throw new Error(
      'V2 application record not found.'
    );
  }


  // -------------------------------------------
  // 1. Offer gate
  // -------------------------------------------

  const stage =
    String(
      workflow.record[
        'Application Stage'
      ] || ''
    );

  if (
    stage !== 'ELIGIBLE_FOR_OFFER'
  ) {
    throw new Error(
      'Offer blocked: applicant is not ELIGIBLE_FOR_OFFER.'
    );
  }


  v2AssertStageGate_(
    reference,
    'ELIGIBLE_FOR_OFFER'
  );


  // -------------------------------------------
  // 2. Prepare acceptance token
  // Raw token returned once.
  // Only hash stored.
  // -------------------------------------------

  const rawToken =
    Utilities.getUuid()
      .replace(/-/g, '') +
    Utilities.getUuid()
      .replace(/-/g, '');

  const tokenHash =
    v2OfferHashToken_(rawToken);


  const baseUrl =
    String(
      CONFIG.acceptanceSigningBaseUrl ||
      ''
    ).trim();

  const acceptanceUrl =
    baseUrl
      ? baseUrl +
        (baseUrl.indexOf('?') > -1
          ? '&'
          : '?') +
        'token=' +
        encodeURIComponent(rawToken)
      : '';


  const now =
    new Date().toISOString();


  // -------------------------------------------
  // 3. Build LOA data payload
  // No document generated yet.
  // -------------------------------------------

  const offerData = {

    referenceNo:
      reference,

    studentName:
      application.record[
        'Student Name'
      ] || '',

    idPassport:
      application.record[
        'ID / Passport No'
      ] || '',

    email:
      application.record[
        'Personal Email'
      ] || '',

    programme:
      application.record[
        'Programme'
      ] || '',

    studyMode:
      application.record[
        'Study Mode'
      ] || '',

    intake:
      application.record[
        'Intake'
      ] || '',

    feeGroup:
      application.record[
        'Fee Group'
      ] || '',

    studentFolderUrl:
      application.record[
        'Student Folder URL'
      ] || ''
  };


  // -------------------------------------------
  // 4. Update workflow
  // -------------------------------------------

  v2UpdateRow_(
    workflow.sheet,
    workflow.rowNumber,
    {
      'Offer Letter Status':
        'READY_TO_GENERATE',

      'Offer Letter Remarks':
        'Offer eligibility verified. LOA generation pending.',

      'Acceptance Token Hash':
        tokenHash,

      'Acceptance Signing URL':
        acceptanceUrl,

      'Acceptance Status':
        'PENDING',

      'Last Updated':
        now,

      'Updated By':
        actor ||
        'Offer Preparation'
    }
  );


  v2Audit_(
    reference,
    'OFFER',
    'PREPARE_OFFER',
    {},
    {
      stage:
        stage,

      offerStatus:
        'READY_TO_GENERATE',

      acceptanceTokenStored:
        'HASH_ONLY'
    },
    actor ||
      'Offer Preparation',
    'SUCCESS',
    ''
  );


  v2InvalidateCache_();


  return {
    ok: true,

    referenceNo:
      reference,

    offerData:
      offerData,

    offerStatus:
      'READY_TO_GENERATE',

    acceptanceToken:
      rawToken,

    acceptanceSigningUrl:
      acceptanceUrl,

    tokenStorage:
      'SHA-256 HASH ONLY',

    emailSent:
      false,

    offerGenerated:
      false,

    v1Touched:
      false
  };
}



function v2ValidateAcceptanceToken_(
  rawToken
) {
  assertDevIdentity_();

  const token =
    String(rawToken || '')
      .trim();

  if (!token) {
    throw new Error(
      'Acceptance token is required.'
    );
  }

  const hash =
    v2OfferHashToken_(token);

  const rows =
    v2Rows_(
      'V2_WORKFLOW'
    );

  const row =
    rows.filter(function(item) {
      return (
        String(
          item[
            'Acceptance Token Hash'
          ] || ''
        ) === hash
      );
    })[0];

  if (!row) {
    throw new Error(
      'Invalid acceptance token.'
    );
  }

  return {
    ok: true,

    referenceNo:
      row['Reference No'],

    studentName:
      row['Student Name'] || '',

    programme:
      row['Programme'] || '',

    intake:
      row['Intake'] || '',

    acceptanceStatus:
      row[
        'Acceptance Status'
      ] || ''
  };
}



function v2OfferHashToken_(value) {
  const bytes =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm
        .SHA_256,
      String(value || ''),
      Utilities.Charset.UTF_8
    );

  return bytes
    .map(function(byte) {
      const n =
        byte < 0
          ? byte + 256
          : byte;

      const hex =
        n.toString(16);

      return hex.length === 1
        ? '0' + hex
        : hex;
    })
    .join('');
}



function v2OfferEnsureHeaders_(
  sheet,
  requiredHeaders
) {
  const lastColumn =
    Math.max(
      sheet.getLastColumn(),
      1
    );

  let headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getValues()[0]
      .map(function(value) {
        return String(value || '')
          .trim();
      });

  requiredHeaders.forEach(
    function(header) {

      if (
        headers.indexOf(header) === -1
      ) {

        const nextColumn =
          headers.length + 1;

        sheet
          .getRange(
            1,
            nextColumn
          )
          .setValue(header);

        headers.push(header);
      }

    }
  );
}

function v2OfferControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(
    new Date(),
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'yyyyMMdd-HHmmss'
  );

  const now = new Date().toISOString();

  const reference =
    'V2-OFFER-TEST-' + stamp;

  const blockedReference =
    'V2-OFFER-BLOCKED-TEST-' + stamp;


  // --------------------------------------------------
  // 1. Eligible DIRECT ENTRY application
  // --------------------------------------------------

  v2Append_('V2_APPLICATIONS', {
    'Reference No': reference,
    'Submitted At': now,
    'Student Name':
      'V2 OFFER TEST ' + stamp,
    'ID / Passport No':
      '900101-01-1234',
    'Personal Email':
      'NO-EMAIL-TEST',
    'Programme':
      'MBA - Master of Business Administration',
    'Level of Study':
      'Master',
    'Study Mode':
      'Online',
    'Intake':
      'September 2026',
    'Fee Group':
      'IUC_MBA26001',
    'Application Status':
      'TEST',
    'Email Status':
      'DISABLED',
    'Last Updated':
      now,
    'Version':
      'CONTROLLED_OFFER_TEST'
  });


  v2Append_('V2_WORKFLOW', {
    'Reference No':
      reference,
    'Student Name':
      'V2 OFFER TEST ' + stamp,
    'ID / Passport No':
      '900101-01-1234',
    'Personal Email':
      'NO-EMAIL-TEST',
    'Programme':
      'MBA - Master of Business Administration',
    'Level of Study':
      'Master',
    'Intake':
      'September 2026',

    'Application Stage':
      'ELIGIBLE_FOR_OFFER',

    'Application Status':
      'TEST',

    'SAC Decision':
      'DIRECT_ENTRY',

    'Assessment Status':
      'NOT_REQUIRED',

    'Prerequisite Status':
      'NOT_REQUIRED',

    'Offer Letter Status':
      'NOT_ISSUED',

    'Acceptance Status':
      'PENDING',

    'Last Updated':
      now,

    'Updated By':
      'Controlled Offer Test',

    'Version':
      V2_BUILD
  });


  // --------------------------------------------------
  // 2. Prepare eligible offer
  // --------------------------------------------------

  const result =
    v2PrepareOffer_(
      reference,
      'Controlled Offer Test'
    );


  const workflow =
    v2Find_(
      'V2_WORKFLOW',
      'Reference No',
      reference
    );


  const storedHash =
    String(
      workflow.record[
        'Acceptance Token Hash'
      ] || ''
    );


  // --------------------------------------------------
  // 3. Create blocked applicant
  // --------------------------------------------------

  v2Append_('V2_APPLICATIONS', {
    'Reference No':
      blockedReference,
    'Submitted At':
      now,
    'Student Name':
      'V2 BLOCKED OFFER TEST ' + stamp,
    'ID / Passport No':
      'TEST-BLOCKED-' + stamp,
    'Personal Email':
      'NO-EMAIL-TEST',
    'Programme':
      'MBA - Master of Business Administration',
    'Intake':
      'September 2026',
    'Application Status':
      'TEST',
    'Email Status':
      'DISABLED',
    'Last Updated':
      now,
    'Version':
      'CONTROLLED_OFFER_BLOCKED_TEST'
  });


  v2Append_('V2_WORKFLOW', {
    'Reference No':
      blockedReference,
    'Student Name':
      'V2 BLOCKED OFFER TEST ' + stamp,

    'Application Stage':
      'INTERNAL_ASSESSMENT',

    'Application Status':
      'TEST',

    'SAC Decision':
      'INTERNAL_ASSESSMENT',

    'Assessment Status':
      'IN_PROGRESS',

    'Prerequisite Status':
      'NOT_REQUIRED',

    'Offer Letter Status':
      'NOT_ISSUED',

    'Acceptance Status':
      'PENDING',

    'Last Updated':
      now,

    'Updated By':
      'Controlled Offer Test',

    'Version':
      V2_BUILD
  });


  let blockedApplicantRejected = false;

  try {

    v2PrepareOffer_(
      blockedReference,
      'Controlled Offer Test'
    );

  } catch (error) {

    blockedApplicantRejected = true;
  }


  // --------------------------------------------------
  // 4. Verify token
  // --------------------------------------------------

  const tokenValidation =
    v2ValidateAcceptanceToken_(
      result.acceptanceToken
    );


  const checks = {

    eligibleOfferPrepared:
      result &&
      result.ok === true,

    offerStatusReady:
      String(
        workflow.record[
          'Offer Letter Status'
        ]
      ) === 'READY_TO_GENERATE',

    rawTokenReturned:
      !!String(
        result.acceptanceToken || ''
      ),

    tokenHashStored:
      storedHash.length === 64,

    rawTokenNotStored:
      storedHash !==
      String(
        result.acceptanceToken || ''
      ),

    tokenValidates:
      tokenValidation &&
      tokenValidation.ok === true &&
      tokenValidation.referenceNo ===
        reference,

    blockedApplicantRejected:
      blockedApplicantRejected === true,

    noOfferGenerated:
      result.offerGenerated === false,

    noEmailSent:
      result.emailSent === false
  };


  const report = {

    ok:
      checks.eligibleOfferPrepared &&
      checks.offerStatusReady &&
      checks.rawTokenReturned &&
      checks.tokenHashStored &&
      checks.rawTokenNotStored &&
      checks.tokenValidates &&
      checks.blockedApplicantRejected &&
      checks.noOfferGenerated &&
      checks.noEmailSent,

    referenceNo:
      reference,

    checks:
      checks,

    signingUrlConfigured:
      !!String(
        result.acceptanceSigningUrl || ''
      ),

    offerGenerated:
      false,

    emailSent:
      false,

    v1Touched:
      false
  };


  Logger.log(
    JSON.stringify(report)
  );

  return report;
}

function v2AcceptOfferSubmission(rawToken, data) {
  return v2AcceptOffer_(
    rawToken,
    data || {},
    'Student Acceptance'
  );
}


function v2AcceptOffer_(rawToken, data, actor) {
  assertDevIdentity_();

  const token =
    String(rawToken || '').trim();

  if (!token) {
    throw new Error(
      'Acceptance token is required.'
    );
  }

  const signedName =
    String(
      data.signedName || ''
    ).trim();

  if (!signedName) {
    throw new Error(
      'Signed name is required.'
    );
  }

  if (data.declarationAccepted !== true) {
    throw new Error(
      'Student declaration must be accepted.'
    );
  }


  const tokenHash =
    v2OfferHashToken_(token);

  const rows =
    v2Rows_('V2_WORKFLOW');

  const matched =
    rows.filter(function(row) {
      return (
        String(
          row['Acceptance Token Hash'] || ''
        ) === tokenHash
      );
    })[0];


  if (!matched) {
    throw new Error(
      'Invalid or expired acceptance token.'
    );
  }


  const reference =
    String(
      matched['Reference No'] || ''
    );

  const workflow =
    v2Find_(
      'V2_WORKFLOW',
      'Reference No',
      reference
    );

  if (!workflow) {
    throw new Error(
      'Workflow record not found.'
    );
  }


  const offerStatus =
    String(
      workflow.record[
        'Offer Letter Status'
      ] || ''
    );

  if (offerStatus !== 'ISSUED') {
    throw new Error(
      'Acceptance blocked: Offer Letter has not been issued.'
    );
  }


  const currentAcceptance =
    String(
      workflow.record[
        'Acceptance Status'
      ] || ''
    );

  if (currentAcceptance === 'ACCEPTED') {
    throw new Error(
      'Offer has already been accepted.'
    );
  }


  const stage =
    String(
      workflow.record[
        'Application Stage'
      ] || ''
    );

  if (
    stage !== 'OFFER_ISSUED' &&
    stage !== 'ACCEPTANCE_PENDING'
  ) {
    throw new Error(
      'Acceptance blocked: invalid application stage.'
    );
  }


  const now =
    new Date().toISOString();


  v2UpdateRow_(
    workflow.sheet,
    workflow.rowNumber,
    {
      'Acceptance Status':
        'ACCEPTED',

      'Acceptance Received At':
        now,

      'Acceptance Remarks':
        'Electronically accepted by ' +
        signedName,

      'Application Stage':
        'ACCEPTED',

      // one-time token
      'Acceptance Token Hash':
        '',

      'Last Updated':
        now,

      'Updated By':
        actor ||
        'Student Acceptance'
    }
  );


  v2Audit_(
    reference,
    'ACCEPTANCE',
    'ACCEPT_OFFER',
    {
      acceptanceStatus:
        currentAcceptance
    },
    {
      acceptanceStatus:
        'ACCEPTED',

      signedName:
        signedName,

      acceptedAt:
        now
    },
    actor ||
      'Student Acceptance',
    'SUCCESS',
    ''
  );


  v2InvalidateCache_();


  return {
    ok: true,

    referenceNo:
      reference,

    acceptanceStatus:
      'ACCEPTED',

    applicationStage:
      'ACCEPTED',

    acceptedAt:
      now,

    signedName:
      signedName,

    tokenConsumed:
      true,

    emailSent:
      false,

    v1Touched:
      false
  };
}



function v2AcceptanceControlledTest() {
  assertDevIdentity_();

  const stamp =
    Utilities.formatDate(
      new Date(),
      CONFIG.timezone ||
        'Asia/Kuala_Lumpur',
      'yyyyMMdd-HHmmss'
    );

  const now =
    new Date().toISOString();

  const reference =
    'V2-ACCEPTANCE-TEST-' +
    stamp;


  // -------------------------------------------
  // 1. Controlled eligible applicant
  // -------------------------------------------

  v2Append_(
    'V2_APPLICATIONS',
    {
      'Reference No':
        reference,

      'Submitted At':
        now,

      'Student Name':
        'V2 ACCEPTANCE TEST ' +
        stamp,

      'ID / Passport No':
        '900101-01-1234',

      'Personal Email':
        'NO-EMAIL-TEST',

      'Programme':
        'MBA - Master of Business Administration',

      'Study Mode':
        'Online',

      'Intake':
        'September 2026',

      'Application Status':
        'TEST',

      'Email Status':
        'DISABLED',

      'Last Updated':
        now,

      'Version':
        'CONTROLLED_ACCEPTANCE_TEST'
    }
  );


  v2Append_(
    'V2_WORKFLOW',
    {
      'Reference No':
        reference,

      'Student Name':
        'V2 ACCEPTANCE TEST ' +
        stamp,

      'ID / Passport No':
        '900101-01-1234',

      'Personal Email':
        'NO-EMAIL-TEST',

      'Programme':
        'MBA - Master of Business Administration',

      'Intake':
        'September 2026',

      'Application Stage':
        'ELIGIBLE_FOR_OFFER',

      'Application Status':
        'TEST',

      'SAC Decision':
        'DIRECT_ENTRY',

      'Assessment Status':
        'NOT_REQUIRED',

      'Prerequisite Status':
        'NOT_REQUIRED',

      'Offer Letter Status':
        'NOT_ISSUED',

      'Acceptance Status':
        'PENDING',

      'Last Updated':
        now,

      'Updated By':
        'Controlled Acceptance Test',

      'Version':
        V2_BUILD
    }
  );


  // -------------------------------------------
  // 2. Prepare offer/token
  // -------------------------------------------

  const prepared =
    v2PrepareOffer_(
      reference,
      'Controlled Acceptance Test'
    );


  // -------------------------------------------
  // 3. Simulate LOA issuance
  // Actual PDF generator tested separately.
  // -------------------------------------------

  const workflow =
    v2Find_(
      'V2_WORKFLOW',
      'Reference No',
      reference
    );


  v2UpdateRow_(
    workflow.sheet,
    workflow.rowNumber,
    {
      'Offer Letter Status':
        'ISSUED',

      'Offer Letter Issued At':
        now,

      'Application Stage':
        'OFFER_ISSUED',

      'Acceptance Status':
        'PENDING',

      'Last Updated':
        now,

      'Updated By':
        'Controlled Acceptance Test'
    }
  );


  // -------------------------------------------
  // 4. Student accepts
  // -------------------------------------------

  const accepted =
    v2AcceptOffer_(
      prepared.acceptanceToken,
      {
        signedName:
          'V2 TEST STUDENT',

        declarationAccepted:
          true
      },
      'Controlled Acceptance Test'
    );


  const finalWorkflow =
    v2Find_(
      'V2_WORKFLOW',
      'Reference No',
      reference
    );


  // -------------------------------------------
  // 5. Reuse token must fail
  // -------------------------------------------

  let reusedTokenBlocked =
    false;

  try {

    v2AcceptOffer_(
      prepared.acceptanceToken,
      {
        signedName:
          'V2 TEST STUDENT',

        declarationAccepted:
          true
      },
      'Controlled Acceptance Test'
    );

  } catch (error) {

    reusedTokenBlocked =
      true;
  }


  const checks = {

    tokenPrepared:
      prepared &&
      prepared.ok === true,

    acceptanceRecorded:
      accepted &&
      accepted.ok === true,

    acceptanceStatusCorrect:
      String(
        finalWorkflow.record[
          'Acceptance Status'
        ]
      ) === 'ACCEPTED',

    applicationStageCorrect:
      String(
        finalWorkflow.record[
          'Application Stage'
        ]
      ) === 'ACCEPTED',

    receivedAtRecorded:
      !!String(
        finalWorkflow.record[
          'Acceptance Received At'
        ] || ''
      ),

    tokenConsumed:
      String(
        finalWorkflow.record[
          'Acceptance Token Hash'
        ] || ''
      ) === '',

    reusedTokenBlocked:
      reusedTokenBlocked === true
  };


  const report = {

    ok:
      checks.tokenPrepared &&
      checks.acceptanceRecorded &&
      checks.acceptanceStatusCorrect &&
      checks.applicationStageCorrect &&
      checks.receivedAtRecorded &&
      checks.tokenConsumed &&
      checks.reusedTokenBlocked,

    referenceNo:
      reference,

    checks:
      checks,

    emailSent:
      false,

    offerPdfGenerated:
      false,

    v1Touched:
      false
  };


  Logger.log(
    JSON.stringify(report)
  );

  return report;
}

function v2GenerateOfferLetter_(referenceNo, actor) {
  assertDevIdentity_();

  const reference =
    String(referenceNo || '').trim();

  if (!reference) {
    throw new Error('Reference No is required.');
  }


  const workflow =
    v2Find_(
      'V2_WORKFLOW',
      'Reference No',
      reference
    );

  const application =
    v2Find_(
      'V2_APPLICATIONS',
      'Reference No',
      reference
    );


  if (!workflow) {
    throw new Error(
      'V2 workflow record not found.'
    );
  }

  if (!application) {
    throw new Error(
      'V2 application record not found.'
    );
  }


  // --------------------------------------------------
  // 1. Eligibility gate
  // --------------------------------------------------

  const stage =
    String(
      workflow.record[
        'Application Stage'
      ] || ''
    );

  if (stage !== 'ELIGIBLE_FOR_OFFER') {
    throw new Error(
      'LOA generation blocked: applicant is not ELIGIBLE_FOR_OFFER.'
    );
  }


  const existingStatus =
    String(
      workflow.record[
        'Offer Letter Status'
      ] || ''
    );

  const existingUrl =
    String(
      workflow.record[
        'Offer Letter PDF URL'
      ] || ''
    );


  // Prevent duplicate LOA
  if (
    existingStatus === 'ISSUED' &&
    existingUrl
  ) {
    return {
      ok: true,
      duplicate: true,
      referenceNo: reference,
      offerLetterPdfUrl:
        existingUrl,
      offerLetterStatus:
        'ISSUED',
      emailSent: false,
      v1Touched: false
    };
  }


  if (
    existingStatus !== 'READY_TO_GENERATE'
  ) {
    throw new Error(
      'LOA generation blocked: Offer must be prepared first.'
    );
  }


  // --------------------------------------------------
  // 2. Template
  // --------------------------------------------------

  const templateId =
    String(
      CONFIG.officialLoaTemplateId || ''
    ).trim();

  if (!templateId) {
    throw new Error(
      'officialLoaTemplateId is not configured.'
    );
  }


  // --------------------------------------------------
  // 3. Student folder
  // --------------------------------------------------

  const folderUrl =
    String(
      application.record[
        'Student Folder URL'
      ] ||
      workflow.record[
        'Student Folder URL'
      ] ||
      ''
    ).trim();

  if (!folderUrl) {
    throw new Error(
      'Student Folder URL is missing.'
    );
  }


  const folderId =
    v2OfferExtractDriveId_(
      folderUrl
    );

  if (!folderId) {
    throw new Error(
      'Unable to identify student folder.'
    );
  }


  const studentFolder =
    DriveApp.getFolderById(
      folderId
    );


  // --------------------------------------------------
  // 4. Application information
  // --------------------------------------------------

  const studentName =
    String(
      application.record[
        'Student Name'
      ] || ''
    ).trim();


  const idPassport =
    String(
      application.record[
        'ID / Passport No'
      ] || ''
    ).trim();


  const programme =
    String(
      application.record[
        'Programme'
      ] || ''
    ).trim();


  const studyMode =
    String(
      application.record[
        'Study Mode'
      ] || ''
    ).trim() || 'Full Time';


  const intake =
    String(
      application.record[
        'Intake'
      ] || ''
    ).trim();


  let rawApplication = {};

  try {
    rawApplication =
      JSON.parse(
        String(
          application.record[
            'Raw Application JSON'
          ] || '{}'
        )
      );
  } catch (error) {
    rawApplication = {};
  }


  const address =
    String(
      rawApplication.fullAddress ||
      rawApplication.address ||
      ''
    ).trim();


  // --------------------------------------------------
  // 5. LOA Reference
  // --------------------------------------------------

  const programmeCode =
    v2OfferProgrammeCode_(
      programme
    );


  const intakeYearMonth =
    v2OfferIntakeYearMonth_(
      intake
    );


  const cleanId =
    v2AssessmentNormalizeCredential_(
      idPassport
    );


  const loaReference =
    'LOA/' +
    programmeCode +
    '/' +
    intakeYearMonth +
    '/' +
    cleanId;


  const now =
    new Date();


  const nowIso =
    now.toISOString();


  const offerDate =
    v2OfferFormatDateLong_(
      now
    );


  // --------------------------------------------------
  // 6. Copy official template
  // --------------------------------------------------

  const tempName =
    'LOA_SOURCE_' +
    programmeCode +
    '_' +
    cleanId;


  const templateCopy =
    DriveApp
      .getFileById(templateId)
      .makeCopy(
        tempName,
        studentFolder
      );


  const doc =
    DocumentApp.openById(
      templateCopy.getId()
    );


  const body =
    doc.getBody();


  const replacements = {
    '{{REF_NO}}':
      loaReference,

    '{{OFFER_DATE_LONG}}':
      offerDate,

    '{{STUDENT_NAME}}':
      studentName,

    '{{STUDENT_ADDRESS}}':
      address,

    // Student ID only exists after activation.
    '{{MATRIX_NO}}':
      '',

    '{{PROGRAMME_NAME}}':
      programme,

    '{{STUDY_MODE}}':
      studyMode,

    '{{INTAKE}}':
      intake,

    '{{SESSION_MONTH}}':
      v2OfferIntakeMonth_(
        intake
      ),

    '{{SESSION_YEAR}}':
      v2OfferIntakeYear_(
        intake
      )
  };


  Object.keys(
    replacements
  ).forEach(function(key) {

    body.replaceText(
      v2OfferRegexEscape_(key),
      String(
        replacements[key] || ''
      )
    );

  });


  /*
   * Existing IUC template currently has
   * "Study Mode : Full Time" hard-coded.
   * Change ONLY the generated copy.
   */
  body.replaceText(
    'Study Mode\\s*:\\s*Full Time',
    'Study Mode        : ' +
      studyMode
  );


  doc.saveAndClose();


  // --------------------------------------------------
  // 7. Create PDF
  // --------------------------------------------------

  const pdfName =
    'LOA_' +
    programmeCode +
    '_' +
    cleanId +
    '.pdf';


  const pdfBlob =
    DriveApp
      .getFileById(
        templateCopy.getId()
      )
      .getAs(
        MimeType.PDF
      )
      .setName(
        pdfName
      );


  const pdfFile =
    studentFolder.createFile(
      pdfBlob
    );


  // Temporary editable copy not needed.
  templateCopy.setTrashed(true);


  // --------------------------------------------------
  // 8. Workflow update
  // --------------------------------------------------

  v2UpdateRow_(
    workflow.sheet,
    workflow.rowNumber,
    {
      'Offer Letter Status':
        'ISSUED',

      'Offer Letter Issued At':
        nowIso,

      'Offer Letter PDF URL':
        pdfFile.getUrl(),

      'Offer Letter Remarks':
        'Official LOA generated from approved IUC template.',

      'Application Stage':
        'OFFER_ISSUED',

      'Acceptance Status':
        'PENDING',

      'Last Updated':
        nowIso,

      'Updated By':
        actor ||
        'Offer Letter Generator'
    }
  );


  v2Audit_(
    reference,
    'OFFER',
    'GENERATE_OFFICIAL_LOA',
    {
      offerStatus:
        existingStatus
    },
    {
      offerStatus:
        'ISSUED',

      loaReference:
        loaReference,

      pdfUrl:
        pdfFile.getUrl()
    },
    actor ||
      'Offer Letter Generator',
    'SUCCESS',
    ''
  );


  v2InvalidateCache_();


  return {
    ok: true,
    duplicate: false,

    referenceNo:
      reference,

    loaReference:
      loaReference,

    programmeCode:
      programmeCode,

    pdfFileId:
      pdfFile.getId(),

    offerLetterPdfUrl:
      pdfFile.getUrl(),

    offerLetterStatus:
      'ISSUED',

    applicationStage:
      'OFFER_ISSUED',

    acceptanceStatus:
      'PENDING',

    emailSent:
      false,

    v1Touched:
      false
  };
}



function v2OfferProgrammeCode_(programme) {

  const value =
    String(programme || '')
      .toUpperCase();


  if (
    value.indexOf(
      'MASTER OF BUSINESS ADMINISTRATION'
    ) > -1
  ) {
    return 'MBA';
  }


  if (
    value.indexOf(
      'MASTER IN BUSINESS MANAGEMENT'
    ) > -1
  ) {
    return 'MBM';
  }


  if (
    value.indexOf(
      'MASTER IN HAJJ AND UMRAH MANAGEMENT'
    ) > -1
  ) {
    return 'MHUM';
  }


  if (
    value.indexOf(
      'MASTER IN ISLAMIC STUDIES'
    ) > -1
  ) {
    return 'MIM';
  }


  if (
    value.indexOf(
      'DOCTOR OF PHILOSOPHY IN MANAGEMENT'
    ) > -1 ||
    value.indexOf(
      'PHD IN MANAGEMENT'
    ) > -1
  ) {
    return 'PHD';
  }


  if (
    value.indexOf(
      'DOCTORATE OF BUSINESS ADMINISTRATION'
    ) > -1 ||
    value.indexOf(
      'DOCTOR OF BUSINESS ADMINISTRATION'
    ) > -1
  ) {
    return 'DBA';
  }


  throw new Error(
    'Programme not recognised for LOA reference.'
  );
}



function v2OfferIntakeYearMonth_(intake) {

  const monthMap = {
    JANUARY: '01',
    FEBRUARY: '02',
    MARCH: '03',
    APRIL: '04',
    MAY: '05',
    JUNE: '06',
    JULY: '07',
    AUGUST: '08',
    SEPTEMBER: '09',
    OCTOBER: '10',
    NOVEMBER: '11',
    DECEMBER: '12'
  };


  const value =
    String(intake || '')
      .trim()
      .toUpperCase();


  const yearMatch =
    value.match(/\b(20\d{2})\b/);


  const year =
    yearMatch
      ? yearMatch[1]
      : Utilities.formatDate(
          new Date(),
          CONFIG.timezone ||
            'Asia/Kuala_Lumpur',
          'yyyy'
        );


  let month =
    Utilities.formatDate(
      new Date(),
      CONFIG.timezone ||
        'Asia/Kuala_Lumpur',
      'MM'
    );


  Object.keys(
    monthMap
  ).some(function(name) {

    if (
      value.indexOf(name) > -1
    ) {
      month =
        monthMap[name];

      return true;
    }

    return false;
  });


  return year + '-' + month;
}



function v2OfferIntakeMonth_(intake) {

  const value =
    String(intake || '')
      .trim();

  const match =
    value.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December)/i
    );

  return match
    ? match[1]
    : '';
}



function v2OfferIntakeYear_(intake) {

  const match =
    String(intake || '')
      .match(/\b(20\d{2})\b/);

  return match
    ? match[1]
    : '';
}



function v2OfferFormatDateLong_(date) {

  const timezone =
    CONFIG.timezone ||
    'Asia/Kuala_Lumpur';

  const day =
    Number(
      Utilities.formatDate(
        date,
        timezone,
        'd'
      )
    );


  let suffix =
    'th';


  if (
    day % 100 < 11 ||
    day % 100 > 13
  ) {

    if (day % 10 === 1) {
      suffix = 'st';
    }

    if (day % 10 === 2) {
      suffix = 'nd';
    }

    if (day % 10 === 3) {
      suffix = 'rd';
    }
  }


  return (
    day +
    suffix +
    ' ' +
    Utilities.formatDate(
      date,
      timezone,
      'MMMM yyyy'
    )
  );
}



function v2OfferExtractDriveId_(url) {

  const value =
    String(url || '').trim();

  const match =
    value.match(
      /[-\w]{20,}/
    );

  return match
    ? match[0]
    : '';
}



function v2OfferRegexEscape_(value) {

  return String(value || '')
    .replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );
}

function v2OfferPdfControlledTest() {
  assertDevIdentity_();

  const stamp =
    Utilities.formatDate(
      new Date(),
      CONFIG.timezone ||
        'Asia/Kuala_Lumpur',
      'yyyyMMdd-HHmmss'
    );


  const now =
    new Date().toISOString();


  const reference =
    'V2-LOA-PDF-TEST-' +
    stamp;


  const root =
    DriveApp.getFolderById(
      CONFIG.rootFolderId
    );


  const testRoot =
    v2GetOrCreateFolder_(
      root,
      'V2_TEST_OUTPUT'
    );


  const studentFolder =
    v2GetOrCreateFolder_(
      testRoot,
      'LOA_TEST_' + stamp
    );


  v2Append_(
    'V2_APPLICATIONS',
    {
      'Reference No':
        reference,

      'Submitted At':
        now,

      'Student Name':
        'V2 LOA PDF TEST ' +
        stamp,

      'ID / Passport No':
        '900101-01-1234',

      'Personal Email':
        'NO-EMAIL-TEST',

      'Programme':
        'MBA - Master of Business Administration',

      'Level of Study':
        'Master',

      'Study Mode':
        'Part Time',

      'Intake':
        'September 2026',

      'Student Folder URL':
        studentFolder.getUrl(),

      'Raw Application JSON':
        JSON.stringify({
          fullAddress:
            'TEST ADDRESS ONLY'
        }),

      'Application Status':
        'TEST',

      'Email Status':
        'DISABLED',

      'Last Updated':
        now,

      'Version':
        'CONTROLLED_LOA_PDF_TEST'
    }
  );


  v2Append_(
    'V2_WORKFLOW',
    {
      'Reference No':
        reference,

      'Student Name':
        'V2 LOA PDF TEST ' +
        stamp,

      'ID / Passport No':
        '900101-01-1234',

      'Personal Email':
        'NO-EMAIL-TEST',

      'Programme':
        'MBA - Master of Business Administration',

      'Level of Study':
        'Master',

      'Intake':
        'September 2026',

      'Application Stage':
        'ELIGIBLE_FOR_OFFER',

      'Application Status':
        'TEST',

      'SAC Decision':
        'DIRECT_ENTRY',

      'Assessment Status':
        'NOT_REQUIRED',

      'Prerequisite Status':
        'NOT_REQUIRED',

      'Offer Letter Status':
        'NOT_ISSUED',

      'Acceptance Status':
        'PENDING',

      'Student Folder URL':
        studentFolder.getUrl(),

      'Last Updated':
        now,

      'Updated By':
        'Controlled LOA PDF Test',

      'Version':
        V2_BUILD
    }
  );


  // Prepare token and offer gate.
  v2PrepareOffer_(
    reference,
    'Controlled LOA PDF Test'
  );


  // Generate real TEST PDF.
  const generated =
    v2GenerateOfferLetter_(
      reference,
      'Controlled LOA PDF Test'
    );


  const workflow =
    v2Find_(
      'V2_WORKFLOW',
      'Reference No',
      reference
    );


  const pdfFile =
    DriveApp.getFileById(
      generated.pdfFileId
    );


  const checks = {

    pdfGenerated:
      generated &&
      generated.ok === true,

    pdfExists:
      !!pdfFile,

    pdfMimeCorrect:
      pdfFile.getMimeType() ===
        MimeType.PDF,

    offerStatusIssued:
      String(
        workflow.record[
          'Offer Letter Status'
        ]
      ) === 'ISSUED',

    workflowStageCorrect:
      String(
        workflow.record[
          'Application Stage'
        ]
      ) === 'OFFER_ISSUED',

    acceptancePending:
      String(
        workflow.record[
          'Acceptance Status'
        ]
      ) === 'PENDING',

    pdfUrlSaved:
      !!String(
        workflow.record[
          'Offer Letter PDF URL'
        ] || ''
      ),

    referenceCorrect:
      String(
        generated.loaReference || ''
      ).indexOf(
        'LOA/MBA/2026-09/'
      ) === 0,

    noEmailSent:
      generated.emailSent === false
  };


  const report = {

    ok:
      checks.pdfGenerated &&
      checks.pdfExists &&
      checks.pdfMimeCorrect &&
      checks.offerStatusIssued &&
      checks.workflowStageCorrect &&
      checks.acceptancePending &&
      checks.pdfUrlSaved &&
      checks.referenceCorrect &&
      checks.noEmailSent,

    referenceNo:
      reference,

    loaReference:
      generated.loaReference,

    pdfUrl:
      generated.offerLetterPdfUrl,

    checks:
      checks,

    emailSent:
      false,

    v1Touched:
      false
  };


  Logger.log(
    JSON.stringify(report)
  );

  return report;
}

function v2SubmitSignedAcceptance(rawToken, data) {
  assertDevIdentity_();

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {

    const token =
      String(rawToken || '').trim();

    const form =
      data || {};

    const signedName =
      String(
        form.signedName || ''
      ).trim();

    const signatureDataUrl =
      String(
        form.signatureDataUrl || ''
      ).trim();


    if (!token) {
      throw new Error(
        'Acceptance token is required.'
      );
    }

    if (!signedName) {
      throw new Error(
        'Signed name is required.'
      );
    }

    if (
      form.declarationAccepted !== true
    ) {
      throw new Error(
        'Student declaration must be accepted.'
      );
    }

    if (
      !/^data:image\/png;base64,/i
        .test(signatureDataUrl)
    ) {
      throw new Error(
        'Electronic signature is required.'
      );
    }


    // ---------------------------------------
    // 1. Validate token
    // ---------------------------------------

    const tokenResult =
      v2ValidateAcceptanceToken_(
        token
      );

    const reference =
      tokenResult.referenceNo;


    const workflow =
      v2Find_(
        'V2_WORKFLOW',
        'Reference No',
        reference
      );

    const application =
      v2Find_(
        'V2_APPLICATIONS',
        'Reference No',
        reference
      );


    if (!workflow || !application) {
      throw new Error(
        'Acceptance record not found.'
      );
    }


    if (
      String(
        workflow.record[
          'Offer Letter Status'
        ] || ''
      ) !== 'ISSUED'
    ) {
      throw new Error(
        'Acceptance blocked: Offer Letter has not been issued.'
      );
    }


    // ---------------------------------------
    // 2. Student folder
    // ---------------------------------------

    const folderUrl =
      String(
        application.record[
          'Student Folder URL'
        ] ||
        workflow.record[
          'Student Folder URL'
        ] ||
        ''
      ).trim();


    const folderId =
      v2OfferExtractDriveId_(
        folderUrl
      );


    if (!folderId) {
      throw new Error(
        'Student folder could not be identified.'
      );
    }


    const studentFolder =
      DriveApp.getFolderById(
        folderId
      );


    // ---------------------------------------
    // 3. Acceptance template
    // ---------------------------------------

    const templateId =
      String(
        CONFIG.acceptanceEnTemplateId ||
        ''
      ).trim();


    if (!templateId) {
      throw new Error(
        'Acceptance template is not configured.'
      );
    }


    const studentName =
      String(
        application.record[
          'Student Name'
        ] || ''
      );


    const idPassport =
      String(
        application.record[
          'ID / Passport No'
        ] || ''
      );


    const programme =
      String(
        application.record[
          'Programme'
        ] || ''
      );


    const intake =
      String(
        application.record[
          'Intake'
        ] || ''
      );


    const studyMode =
      String(
        application.record[
          'Study Mode'
        ] || ''
      ).trim();


    const now =
      new Date();

    const nowIso =
      now.toISOString();


    const dateText =
      v2OfferFormatDateLong_(
        now
      );


    // ---------------------------------------
    // 4. Copy template
    // ---------------------------------------

    const cleanId =
      v2AssessmentNormalizeCredential_(
        idPassport
      );


    const tempCopy =
      DriveApp
        .getFileById(
          templateId
        )
        .makeCopy(
          'ACCEPTANCE_SOURCE_' +
            cleanId,
          studentFolder
        );


    const doc =
      DocumentApp.openById(
        tempCopy.getId()
      );


    const body =
      doc.getBody();


    const replacements = {

      '{{STUDENT_NAME}}':
        studentName,

      '{{IC}}':
        idPassport,

      '{{PROGRAMME_NAME}}':
        programme,

      '{{INTAKE}}':
        intake
    };


    Object.keys(
      replacements
    ).forEach(function(key) {

      body.replaceText(
        v2OfferRegexEscape_(key),
        String(
          replacements[key] || ''
        )
      );

    });


    // Replace generic full-time/part-time wording
    // only in generated copy.
    if (studyMode) {

      body.replaceText(
        'full-time/part-time',
        studyMode.toLowerCase()
      );

    }


    // Fill signature date.
    body.replaceText(
      'Date\\s*:',
      'Date        : ' +
        dateText
    );


    // ---------------------------------------
    // 5. Insert electronic signature image
    // ---------------------------------------

    const base64 =
      signatureDataUrl.replace(
        /^data:image\/png;base64,/i,
        ''
      );


    const signatureBytes =
      Utilities.base64Decode(
        base64
      );


    if (
      signatureBytes.length >
      1024 * 1024
    ) {
      throw new Error(
        'Signature image is too large.'
      );
    }


    const signatureBlob =
      Utilities.newBlob(
        signatureBytes,
        'image/png',
        'electronic-signature.png'
      );


    const signatureMatch =
      body.findText(
        'Student’s Signature'
      );


    if (signatureMatch) {

      const textElement =
        signatureMatch
          .getElement()
          .asText();

      const paragraph =
        textElement
          .getParent()
          .asParagraph();

      const image =
        paragraph.appendInlineImage(
          signatureBlob
        );

      image.setWidth(180);
      image.setHeight(60);

    } else {

      body.appendParagraph(
        'Electronic Signature'
      );

      const image =
        body.appendImage(
          signatureBlob
        );

      image.setWidth(180);
      image.setHeight(60);
    }


    body.appendParagraph(
      'Electronically signed by: ' +
      signedName
    );

    body.appendParagraph(
      'Signed at: ' +
      dateText
    );


    doc.saveAndClose();


    // ---------------------------------------
    // 6. Export signed Acceptance PDF
    // ---------------------------------------

    const pdfName =
      'ACCEPTANCE_OF_OFFER_' +
      cleanId +
      '.pdf';


    const pdfBlob =
      DriveApp
        .getFileById(
          tempCopy.getId()
        )
        .getAs(
          MimeType.PDF
        )
        .setName(
          pdfName
        );


    const pdfFile =
      studentFolder.createFile(
        pdfBlob
      );


    tempCopy.setTrashed(true);


    // ---------------------------------------
    // 7. Save document record
    // ---------------------------------------

    v2UpdateRow_(
      workflow.sheet,
      workflow.rowNumber,
      {
        'Acceptance PDF URL':
          pdfFile.getUrl(),

        'Acceptance Signed Name':
          signedName,

        'Acceptance Signed At':
          nowIso,

        'Last Updated':
          nowIso,

        'Updated By':
          'Student E-Signature'
      }
    );


    // ---------------------------------------
    // 8. Finalise Acceptance
    // Existing function consumes token.
    // ---------------------------------------

    const accepted =
      v2AcceptOffer_(
        token,
        {
          signedName:
            signedName,

          declarationAccepted:
            true
        },
        'Student E-Signature'
      );


    return {
      ok: true,

      referenceNo:
        reference,

      acceptanceStatus:
        accepted.acceptanceStatus,

      applicationStage:
        accepted.applicationStage,

      acceptancePdfUrl:
        pdfFile.getUrl(),

      signedName:
        signedName,

      tokenConsumed:
        accepted.tokenConsumed,

      signatureImageStored:
        false,

      emailSent:
        false,

      v1Touched:
        false
    };

  } finally {

    lock.releaseLock();
  }
}

function v2SignedAcceptancePdfControlledTest() {
  assertDevIdentity_();

  const stamp =
    Utilities.formatDate(
      new Date(),
      CONFIG.timezone || 'Asia/Kuala_Lumpur',
      'yyyyMMdd-HHmmss'
    );

  const now =
    new Date().toISOString();

  const reference =
    'V2-ESIGN-TEST-' + stamp;

  const root =
    DriveApp.getFolderById(
      CONFIG.rootFolderId
    );

  const testRoot =
    v2GetOrCreateFolder_(
      root,
      'V2_TEST_OUTPUT'
    );

  const studentFolder =
    v2GetOrCreateFolder_(
      testRoot,
      'ESIGN_TEST_' + stamp
    );


  v2Append_(
    'V2_APPLICATIONS',
    {
      'Reference No': reference,
      'Submitted At': now,

      'Student Name':
        'V2 ESIGN TEST ' + stamp,

      'ID / Passport No':
        '900101-01-1234',

      'Personal Email':
        'NO-EMAIL-TEST',

      'Programme':
        'MBA - Master of Business Administration',

      'Level of Study':
        'Master',

      'Study Mode':
        'Part Time',

      'Intake':
        'September 2026',

      'Student Folder URL':
        studentFolder.getUrl(),

      'Application Status':
        'TEST',

      'Email Status':
        'DISABLED',

      'Last Updated':
        now,

      'Version':
        'CONTROLLED_ESIGN_TEST'
    }
  );


  v2Append_(
    'V2_WORKFLOW',
    {
      'Reference No':
        reference,

      'Student Name':
        'V2 ESIGN TEST ' + stamp,

      'ID / Passport No':
        '900101-01-1234',

      'Personal Email':
        'NO-EMAIL-TEST',

      'Programme':
        'MBA - Master of Business Administration',

      'Level of Study':
        'Master',

      'Intake':
        'September 2026',

      'Application Stage':
        'ELIGIBLE_FOR_OFFER',

      'Application Status':
        'TEST',

      'SAC Decision':
        'DIRECT_ENTRY',

      'Assessment Status':
        'NOT_REQUIRED',

      'Prerequisite Status':
        'NOT_REQUIRED',

      'Offer Letter Status':
        'NOT_ISSUED',

      'Acceptance Status':
        'PENDING',

      'Student Folder URL':
        studentFolder.getUrl(),

      'Last Updated':
        now,

      'Updated By':
        'Controlled E-Sign Test',

      'Version':
        V2_BUILD
    }
  );


  const prepared =
    v2PrepareOffer_(
      reference,
      'Controlled E-Sign Test'
    );


  const workflow =
    v2Find_(
      'V2_WORKFLOW',
      'Reference No',
      reference
    );


  // Simulate LOA already issued.
  v2UpdateRow_(
    workflow.sheet,
    workflow.rowNumber,
    {
      'Offer Letter Status':
        'ISSUED',

      'Offer Letter Issued At':
        now,

      'Application Stage':
        'OFFER_ISSUED',

      'Acceptance Status':
        'PENDING'
    }
  );


  // Tiny valid PNG for controlled test only.
  const testSignature =
    'data:image/png;base64,' +
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB' +
    'CAQAAAC1HAwCAAAAC0lEQVR42mNk' +
    'YAAAAAYAAjCB0C8AAAAASUVORK5CYII=';


  const result =
    v2SubmitSignedAcceptance(
      prepared.acceptanceToken,
      {
        signedName:
          'V2 TEST STUDENT',

        signatureDataUrl:
          testSignature,

        declarationAccepted:
          true
      }
    );


  const finalWorkflow =
    v2Find_(
      'V2_WORKFLOW',
      'Reference No',
      reference
    );


  const pdfUrl =
    String(
      finalWorkflow.record[
        'Acceptance PDF URL'
      ] || ''
    );


  const checks = {

    signedPdfGenerated:
      !!pdfUrl,

    acceptanceRecorded:
      result &&
      result.ok === true,

    acceptanceStatusCorrect:
      String(
        finalWorkflow.record[
          'Acceptance Status'
        ]
      ) === 'ACCEPTED',

    applicationStageCorrect:
      String(
        finalWorkflow.record[
          'Application Stage'
        ]
      ) === 'ACCEPTED',

    signedNameRecorded:
      String(
        finalWorkflow.record[
          'Acceptance Signed Name'
        ]
      ) === 'V2 TEST STUDENT',

    signedAtRecorded:
      !!String(
        finalWorkflow.record[
          'Acceptance Signed At'
        ] || ''
      ),

    tokenConsumed:
      String(
        finalWorkflow.record[
          'Acceptance Token Hash'
        ] || ''
      ) === '',

    signatureRawNotStored:
      result.signatureImageStored === false,

    noEmailSent:
      result.emailSent === false
  };


  const report = {

    ok:
      checks.signedPdfGenerated &&
      checks.acceptanceRecorded &&
      checks.acceptanceStatusCorrect &&
      checks.applicationStageCorrect &&
      checks.signedNameRecorded &&
      checks.signedAtRecorded &&
      checks.tokenConsumed &&
      checks.signatureRawNotStored &&
      checks.noEmailSent,

    referenceNo:
      reference,

    acceptancePdfUrl:
      pdfUrl,

    checks:
      checks,

    emailSent:
      false,

    v1Touched:
      false
  };


  Logger.log(
    JSON.stringify(report)
  );

  return report;
}

function v2FinalDevPreflight() {
  assertDevIdentity_();

  const ss =
    SpreadsheetApp.openById(
      CONFIG.spreadsheetId
    );


  // --------------------------------------------------
  // 1. Core V2 sheets
  // --------------------------------------------------

  const requiredSheets = [
    'V2_APPLICATIONS',
    'V2_WORKFLOW',
    'V2_DOCUMENT_REVIEW',
    'V2_QUALIFICATION_SCREENING',
    'V2_QUALIFICATION_RULES',
    'V2_SAC_SESSIONS',
    'V2_SAC_CANDIDATES',
    'V2_SAC_VOTES',
    'V2_ASSESSMENT_ACCOUNTS',
    'V2_ASSESSMENT_PROGRESS',
    'V2_AGENT_ACTIONS',
    'V2_AUDIT_LOG'
  ];


  const missingSheets =
    requiredSheets.filter(
      function(name) {
        return !ss.getSheetByName(name);
      }
    );


  // --------------------------------------------------
  // 2. Templates/config
  // --------------------------------------------------

  const loaTemplateConfigured =
    !!String(
      CONFIG.officialLoaTemplateId || ''
    ).trim();


  const acceptanceTemplateConfigured =
    !!String(
      CONFIG.acceptanceEnTemplateId || ''
    ).trim();


  let loaTemplateAccessible = false;
  let acceptanceTemplateAccessible = false;


  try {

    loaTemplateAccessible =
      !!DriveApp.getFileById(
        CONFIG.officialLoaTemplateId
      );

  } catch (error) {

    loaTemplateAccessible = false;
  }


  try {

    acceptanceTemplateAccessible =
      !!DriveApp.getFileById(
        CONFIG.acceptanceEnTemplateId
      );

  } catch (error) {

    acceptanceTemplateAccessible =
      false;
  }


  // --------------------------------------------------
  // 3. Student Assessment Portal UI
  // --------------------------------------------------

  const assessmentHtml =
    v2RenderAssessmentPortal_()
      .getContent();


  const assessmentPortalReady =
    assessmentHtml.indexOf(
      'function login()'
    ) > -1 &&

    assessmentHtml.indexOf(
      'function changePassword()'
    ) > -1 &&

    assessmentHtml.indexOf(
      'function submitAssessmentWork()'
    ) > -1 &&

    assessmentHtml.indexOf(
      'function bookInterviewSlot()'
    ) > -1;


  // --------------------------------------------------
  // 4. Acceptance e-sign UI
  // --------------------------------------------------

  const acceptanceOutput =
    v2RenderAcceptancePage_({
      token: 'DEV-PREFLIGHT-TOKEN'
    });


  const acceptanceHtml =
    acceptanceOutput.getContent();


  const acceptancePageReady =
    acceptanceHtml.indexOf(
      'Acceptance of Offer'
    ) > -1 &&

    acceptanceHtml.indexOf(
      'signatureCanvas'
    ) > -1 &&

    acceptanceHtml.indexOf(
      'function submitAcceptance()'
    ) > -1 &&

    acceptanceHtml.indexOf(
      'v2SubmitSignedAcceptance'
    ) > -1;


  // --------------------------------------------------
  // 5. Agent UI
  // --------------------------------------------------

  const agentOutput =
    v2RenderAgentPage_({
      token: 'DEV-PREFLIGHT-TOKEN'
    });


  const agentHtml =
    agentOutput.getContent();


  const agentPortalReady =
    !!agentHtml &&
    agentHtml.indexOf(
      'v2Agent'
    ) > -1;


  // --------------------------------------------------
  // 6. Offer / Acceptance headers
  // --------------------------------------------------

  const workflowSheet =
    ss.getSheetByName(
      'V2_WORKFLOW'
    );


  const headers =
    workflowSheet
      .getRange(
        1,
        1,
        1,
        workflowSheet.getLastColumn()
      )
      .getValues()[0]
      .map(function(value) {
        return String(value || '').trim();
      });


  const requiredOfferHeaders = [
    'Offer Letter PDF URL',
    'Offer Letter Remarks',
    'Acceptance Token Hash',
    'Acceptance Signing URL',
    'Acceptance Received At',
    'Acceptance Remarks',
    'Acceptance PDF URL',
    'Acceptance Signed Name',
    'Acceptance Signed At'
  ];


  const missingOfferHeaders =
    requiredOfferHeaders.filter(
      function(header) {
        return headers.indexOf(header) === -1;
      }
    );


  // --------------------------------------------------
  // 7. Safety state
  // --------------------------------------------------

  const emailDisabled =
    String(
      V2_OFFER_EMAIL_MODE || ''
    ) === 'DISABLED/TEST';


  // --------------------------------------------------
  // Final report
  // --------------------------------------------------

  const checks = {

    allCoreSheetsExist:
      missingSheets.length === 0,

    loaTemplateConfigured:
      loaTemplateConfigured,

    loaTemplateAccessible:
      loaTemplateAccessible,

    acceptanceTemplateConfigured:
      acceptanceTemplateConfigured,

    acceptanceTemplateAccessible:
      acceptanceTemplateAccessible,

    assessmentPortalReady:
      assessmentPortalReady,

    acceptancePageReady:
      acceptancePageReady,

    agentPortalReady:
      agentPortalReady,

    offerHeadersReady:
      missingOfferHeaders.length === 0,

    emailStillDisabled:
      emailDisabled
  };


  const report = {

    ok:
      checks.allCoreSheetsExist &&
      checks.loaTemplateConfigured &&
      checks.loaTemplateAccessible &&
      checks.acceptanceTemplateConfigured &&
      checks.acceptanceTemplateAccessible &&
      checks.assessmentPortalReady &&
      checks.acceptancePageReady &&
      checks.agentPortalReady &&
      checks.offerHeadersReady &&
      checks.emailStillDisabled,

    checks:
      checks,

    missingSheets:
      missingSheets,

    missingOfferHeaders:
      missingOfferHeaders,

    deploymentPerformed:
      false,

    emailSent:
      false,

    v1Touched:
      false
  };


  Logger.log(
    JSON.stringify(report)
  );

  return report;
}

function v2RenderAcceptancePage_(params) {
  assertDevIdentity_();

  const template =
    HtmlService.createTemplateFromFile(
      'acceptance-v2'
    );

  template.token =
    String(
      (
        params &&
        (params.token || params.t)
      ) || ''
    );

  return template
    .evaluate()
    .setTitle(
      'IUC Acceptance of Offer'
    );
}