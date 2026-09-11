/**
 * IUC IPGS Admission V2 - SAC Minutes / Endorsement Generator
 * DEVELOPMENT / TEST SAFE
 *
 * Existing IUC SAC document structure:
 * 1. Agenda Item
 * 2. Candidate Qualification Review
 * 3. Documents Reviewed
 * 4. Discussion and Findings
 * 5. SAC Resolution
 * 6. Follow-up Actions
 * 7. Verification and Endorsement
 *
 * One controlled document contains Minutes + Resolution + Endorsement.
 *
 * No email.
 * No Offer Letter.
 * No COL.
 * V1 is never touched.
 */

const V2_SAC_DOCUMENT_BUILD =
  'SAC_DOCUMENTS_V2_DEV_20260909';


function v2SacDocumentsPreflight() {
  assertDevIdentity_();

  const ss = SpreadsheetApp.openById(
    CONFIG.spreadsheetId
  );

  const sessions =
    ss.getSheetByName('V2_SAC_SESSIONS');

  const candidates =
    ss.getSheetByName('V2_SAC_CANDIDATES');

  const votes =
    ss.getSheetByName('V2_SAC_VOTES');

  const workflow =
    ss.getSheetByName('V2_WORKFLOW');

  const applications =
    ss.getSheetByName('V2_APPLICATIONS');


  const report = {
    ok:
      !!sessions &&
      !!candidates &&
      !!votes &&
      !!workflow &&
      !!applications,

    sacSessionsExists: !!sessions,
    sacCandidatesExists: !!candidates,
    sacVotesExists: !!votes,
    workflowExists: !!workflow,
    applicationsExists: !!applications,

    documentStructure: [
      'AGENDA_ITEM',
      'CANDIDATE_QUALIFICATION_REVIEW',
      'DOCUMENTS_REVIEWED',
      'DISCUSSION_AND_FINDINGS',
      'SAC_RESOLUTION',
      'FOLLOW_UP_ACTIONS',
      'VERIFICATION_AND_ENDORSEMENT'
    ],

    combinedMinutesAndEndorsement: true,

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}


function v2GetSacDocumentData_(sessionId) {
  const id = String(sessionId || '').trim();

  if (!id) {
    throw new Error('SAC Session ID is required.');
  }

  const session = v2Find_(
    'V2_SAC_SESSIONS',
    'SAC Session ID',
    id
  );

  if (!session) {
    throw new Error('SAC session not found.');
  }

  if (
    String(session.record['Status'] || '') !==
    'FINALIZED'
  ) {
    throw new Error(
      'SAC document can only be generated after session FINALIZED.'
    );
  }


  const candidates = v2Rows_(
    'V2_SAC_CANDIDATES'
  ).filter(function(row) {
    return (
      String(row['SAC Session ID'] || '') === id
    );
  });


  if (!candidates.length) {
    throw new Error(
      'No SAC candidates found for this session.'
    );
  }


  const pending = candidates.filter(function(row) {
    const decision = String(
      row['Decision'] || ''
    ).trim();

    return (
      !decision ||
      decision === 'PENDING'
    );
  });


  if (pending.length > 0) {
    throw new Error(
      'SAC document cannot be generated while decisions are pending.'
    );
  }


  const rows = candidates.map(function(candidate) {

    const reference = String(
      candidate['Reference No'] || ''
    );

    const application = v2Find_(
      'V2_APPLICATIONS',
      'Reference No',
      reference
    );

    const workflow = v2Find_(
      'V2_WORKFLOW',
      'Reference No',
      reference
    );

    const voteSummary =
      v2GetSacVoteSummary_(
        id,
        reference
      );


    return {
      referenceNo: reference,

      studentName:
        candidate['Student Name'] || '',

      programme:
        candidate['Programme'] || '',

      intake:
        workflow
          ? workflow.record['Intake'] || ''
          : '',

      highestQualification:
        application
          ? application.record[
              'Highest Qualification'
            ] || ''
          : '',

      academicResult:
        application
          ? application.record[
              'Academic Result / CGPA / Grade'
            ] || ''
          : '',

      qualificationField:
        application
          ? application.record[
              'Field of Study'
            ] || ''
          : '',

      fieldClassification:
        workflow
          ? workflow.record[
              'Field Classification'
            ] || ''
          : '',

      relevantWorkExperience:
        workflow
          ? workflow.record[
              'Relevant Work Experience'
            ] || ''
          : '',

      screeningRecommendation:
        candidate[
          'Screening Recommendation'
        ] || '',

      sacDecision:
        candidate['Decision'] || '',

      reviewerRemarks:
        candidate['Reviewer Remarks'] || '',

      voteSummary: voteSummary
    };
  });


  const counts = {
    DIRECT_ENTRY: 0,
    INTERNAL_ASSESSMENT: 0,
    PREREQUISITE: 0,
    REJECTED: 0
  };


  rows.forEach(function(row) {
    if (
      Object.prototype.hasOwnProperty.call(
        counts,
        row.sacDecision
      )
    ) {
      counts[row.sacDecision]++;
    }
  });


  return {
    sessionId: id,

    sacName:
      session.record['SAC Name'] || '',

    meetingDate:
      session.record['Meeting Date'] || '',

    meetingTime:
      session.record['Meeting Time'] || '',

    chairperson:
      session.record['Chairperson'] || '',

    venue:
      session.record[
        'Venue / Meeting Link'
      ] || '',

    candidateCount:
      rows.length,

    decisionCounts:
      counts,

    candidates:
      rows
  };
}

function v2GenerateSacMinutesEndorsement_(data, actor) {
  assertDevIdentity_();

  const sessionId = v2Required_(
    data.sessionId,
    'SAC Session ID'
  );

  if (data.confirmed !== true) {
    throw new Error(
      'Explicit confirmation is required to generate SAC Minutes / Endorsement.'
    );
  }

  const sacData = v2GetSacDocumentData_(sessionId);

  const session = v2Find_(
    'V2_SAC_SESSIONS',
    'SAC Session ID',
    sessionId
  );

  if (
    String(session.record['Status'] || '') !== 'FINALIZED'
  ) {
    throw new Error(
      'SAC session must be FINALIZED before document generation.'
    );
  }


  // Prevent accidental duplicate generation.
  const existingMinutes =
    String(session.record['Minutes URL'] || '').trim();

  if (existingMinutes) {
    return {
      ok: true,
      duplicate: true,
      sessionId: sessionId,
      documentUrl: existingMinutes,
      minutesUrl: existingMinutes,
      endorsementUrl:
        String(session.record['Endorsement URL'] || existingMinutes),

      emailSent: false,
      offerGenerated: false,
      colGenerated: false,
      v1Touched: false
    };
  }


  const meetingDateText = v2SacFormatDate_(
    sacData.meetingDate
  );

  const title =
    'SAC Meeting Minutes - ' +
    String(sacData.sacName || sessionId);


  // --------------------------------------------------
  // Create controlled Google Doc
  // --------------------------------------------------

  const doc = DocumentApp.create(title);
  const body = doc.getBody();

  body.clear();


  // --------------------------------------------------
  // Header
  // --------------------------------------------------

  body.appendParagraph(
    'STUDENT ADMISSION COMMITTEE (SAC)'
  )
  .setHeading(DocumentApp.ParagraphHeading.HEADING1)
  .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph(
    'ADMISSION QUALIFICATION REVIEW AND ENDORSEMENT'
  )
  .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
  .setBold(true);

  body.appendParagraph(
    'SAC MEETING MINUTES | ' +
    meetingDateText +
    ' | ' +
    sacData.candidateCount +
    ' ADMISSION CASE' +
    (sacData.candidateCount === 1 ? '' : 'S')
  )
  .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
  .setBold(true);


  body.appendParagraph('');


  // --------------------------------------------------
  // Session information
  // --------------------------------------------------

  const sessionTable = body.appendTable([
    ['SAC Session', String(sacData.sacName || '')],
    ['Meeting Date', meetingDateText],
    ['Meeting Time', v2SacFormatTime_(sacData.meetingTime)],
    ['Chairperson', String(sacData.chairperson || '')],
    ['Venue / Meeting Link', String(sacData.venue || '')]
  ]);

  v2SacStyleTable_(sessionTable);


  // --------------------------------------------------
  // 1. Agenda Item
  // --------------------------------------------------

  body.appendParagraph('1. AGENDA ITEM')
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  body.appendParagraph(
    'Review and endorsement of postgraduate admission qualifications ' +
    'for candidates presented to the Student Admission Committee, ' +
    'and determination of the appropriate admission route for each candidate.'
  );


  // --------------------------------------------------
  // 2. Candidate Qualification Review
  // --------------------------------------------------

  body.appendParagraph(
    '2. CANDIDATE QUALIFICATION REVIEW'
  )
  .setHeading(DocumentApp.ParagraphHeading.HEADING2);


  const candidateRows = [[
    'No.',
    'Student / ID',
    'Intake',
    'Previous Qualification',
    'Entry CGPA',
    'Field Review',
    'Experience Evidence',
    'SAC Decision'
  ]];


  sacData.candidates.forEach(function(candidate, index) {
    candidateRows.push([
      String(index + 1),

      String(candidate.studentName || '') +
      '\n' +
      String(candidate.referenceNo || ''),

      v2SacFormatIntake_(candidate.intake),

      String(candidate.highestQualification || ''),

      String(candidate.academicResult || ''),

      String(candidate.fieldClassification || ''),

      String(candidate.relevantWorkExperience || ''),

      v2SacDecisionLabel_(candidate.sacDecision)
    ]);
  });


  const candidateTable =
    body.appendTable(candidateRows);

  v2SacStyleTable_(candidateTable);


  // --------------------------------------------------
  // 3. Documents Reviewed
  // --------------------------------------------------

  body.appendParagraph('3. DOCUMENTS REVIEWED')
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  body.appendParagraph(
    'The Committee reviewed the admission application records, ' +
    'academic qualification information, supporting admission documents, ' +
    'qualification screening records and reviewer evidence available ' +
    'for the candidates presented in this session.'
  );


  // --------------------------------------------------
  // 4. Discussion and Findings
  // --------------------------------------------------

  body.appendParagraph(
    '4. DISCUSSION AND FINDINGS'
  )
  .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  body.appendParagraph(
    'The Committee reviewed ' +
    sacData.candidateCount +
    ' admission case' +
    (sacData.candidateCount === 1 ? '' : 's') +
    '. The final endorsed outcomes were: ' +
    sacData.decisionCounts.DIRECT_ENTRY +
    ' Direct Entry, ' +
    sacData.decisionCounts.INTERNAL_ASSESSMENT +
    ' Internal Assessment, ' +
    sacData.decisionCounts.PREREQUISITE +
    ' Prerequisite, and ' +
    sacData.decisionCounts.REJECTED +
    ' Rejected.'
  );

  body.appendParagraph(
    'The final admission route for each candidate is the decision recorded ' +
    'in the Candidate Qualification Review table above.'
  );


  // --------------------------------------------------
  // 5. SAC Resolution
  // --------------------------------------------------

  body.appendParagraph('5. SAC RESOLUTION')
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  body.appendParagraph(
    'The qualification reviews and individual decisions recorded ' +
    'in these minutes are endorsed by the Student Admission Committee.'
  );

  body.appendParagraph(
    'Candidates endorsed for Direct Entry may proceed to the next approved ' +
    'admission stage.'
  );

  body.appendParagraph(
    'Candidates endorsed for Internal Assessment shall complete the approved ' +
    'Internal Assessment process before progression.'
  );

  body.appendParagraph(
    'Candidates endorsed for Prerequisite shall complete the approved ' +
    'Prerequisite process before progression.'
  );


  // --------------------------------------------------
  // 6. Follow-up Actions
  // --------------------------------------------------

  body.appendParagraph('6. FOLLOW-UP ACTIONS')
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);

  const followUpTable = body.appendTable([
    [
      'Action',
      'Responsible Unit',
      'Status'
    ],
    [
      'Proceed with the approved next admission action based on each endorsed SAC decision.',
      'Registry / IPGS',
      'To be actioned'
    ],
    [
      'Arrange Internal Assessment / Prerequisite process for applicable candidates.',
      'Registry / IPGS',
      'To be actioned'
    ]
  ]);

  v2SacStyleTable_(followUpTable);


  // --------------------------------------------------
  // 7. Verification and Endorsement
  // --------------------------------------------------

  body.appendParagraph(
    '7. VERIFICATION AND ENDORSEMENT'
  )
  .setHeading(DocumentApp.ParagraphHeading.HEADING2);


  const endorsementTable = body.appendTable([
    ['Prepared by', 'Verified by', 'Endorsed by'],
    [
      actor || 'Admission Team / Registry',
      'Student Admission Committee',
      String(sacData.chairperson || 'SAC Chairperson')
    ],
    [
      'Designation: Admission Team / Registry',
      'Designation: SAC Member',
      'Designation: SAC Chairperson'
    ],
    [
      'Signature: ____________________',
      'Signature: ____________________',
      'Signature: ____________________'
    ],
    [
      'Date: ' + meetingDateText,
      'Date: ' + meetingDateText,
      'Date: ' + meetingDateText
    ]
  ]);

  v2SacStyleTable_(endorsementTable);


  doc.saveAndClose();


  // --------------------------------------------------
  // Move document into V2 root folder
  // --------------------------------------------------

  const file = DriveApp.getFileById(doc.getId());
  const root = DriveApp.getFolderById(
    CONFIG.rootFolderId
  );

  root.addFile(file);

  try {
    DriveApp.getRootFolder().removeFile(file);
  } catch (ignore) {}


  const documentUrl = doc.getUrl();
  const now = new Date().toISOString();


  // Existing V2 schema has Minutes URL + Endorsement URL.
  // Because the existing IUC format combines both,
  // both fields intentionally point to the same controlled document.
  v2UpdateRow_(
    session.sheet,
    session.rowNumber,
    {
      'Minutes URL': documentUrl,
      'Endorsement URL': documentUrl,
      'Last Updated': now
    }
  );


  v2Audit_(
    '',
    'SAC',
    'GENERATE_MINUTES_ENDORSEMENT',
    {},
    {
      sessionId: sessionId,
      documentUrl: documentUrl,
      combinedDocument: true,
      candidateCount: sacData.candidateCount,
      decisionCounts: sacData.decisionCounts
    },
    actor || 'Registry / IPGS',
    'SUCCESS',
    String(data.remarks || '')
  );


  v2InvalidateCache_();


  const report = {
    ok: true,
    duplicate: false,

    sessionId: sessionId,

    documentId: doc.getId(),
    documentUrl: documentUrl,

    minutesUrl: documentUrl,
    endorsementUrl: documentUrl,

    combinedMinutesAndEndorsement: true,

    candidateCount: sacData.candidateCount,
    decisionCounts: sacData.decisionCounts,

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}


function v2SacFormatDate_(value) {
  if (!value) return '';

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (isNaN(date.getTime())) {
    return String(value);
  }

  return Utilities.formatDate(
    date,
    CONFIG.timezone || 'Asia/Kuala_Lumpur',
    'dd MMMM yyyy'
  );
}

function v2SacFormatTime_(value) {
  if (!value) return '';

  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(
      value,
      CONFIG.timezone || 'Asia/Kuala_Lumpur',
      'hh.mm a'
    );
  }

  const text = String(value || '').trim();

  const timeMatch = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

  if (timeMatch) {
    const date = new Date(2000, 0, 1);
    date.setHours(
      Number(timeMatch[1]),
      Number(timeMatch[2]),
      0,
      0
    );

    return Utilities.formatDate(
      date,
      CONFIG.timezone || 'Asia/Kuala_Lumpur',
      'hh.mm a'
    );
  }

  const parsed = new Date(value);

  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(
      parsed,
      CONFIG.timezone || 'Asia/Kuala_Lumpur',
      'hh.mm a'
    );
  }

  return text;
}


function v2SacFormatIntake_(value) {
  if (!value) return '';

  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(
      value,
      CONFIG.timezone || 'Asia/Kuala_Lumpur',
      'MMMM yyyy'
    );
  }

  const text = String(value || '').trim();

  const parsed = new Date(value);

  if (
    !isNaN(parsed.getTime()) &&
    /GMT|^\d{4}-\d{2}-\d{2}|^[A-Za-z]{3}\s/.test(text)
  ) {
    return Utilities.formatDate(
      parsed,
      CONFIG.timezone || 'Asia/Kuala_Lumpur',
      'MMMM yyyy'
    );
  }

  const match = text.match(
    /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)[\s_-]*(\d{4})$/i
  );

  if (match) {
    const months = {
      JAN: 'January',
      FEB: 'February',
      MAR: 'March',
      APR: 'April',
      MAY: 'May',
      JUN: 'June',
      JUL: 'July',
      AUG: 'August',
      SEP: 'September',
      SEPT: 'September',
      OCT: 'October',
      NOV: 'November',
      DEC: 'December'
    };

    return months[match[1].toUpperCase()] + ' ' + match[2];
  }

  return text;
}

function v2SacDecisionLabel_(decision) {
  const labels = {
    DIRECT_ENTRY: 'DIRECT ENTRY',
    INTERNAL_ASSESSMENT: 'INTERNAL ASSESSMENT',
    PREREQUISITE: 'PREREQUISITE',
    REJECTED: 'REJECTED'
  };

  return labels[String(decision || '')] ||
    String(decision || '');
}


function v2SacStyleTable_(table) {
  if (!table) return;

  for (let r = 0; r < table.getNumRows(); r++) {
    const row = table.getRow(r);

    for (let c = 0; c < row.getNumCells(); c++) {
      const cell = row.getCell(c);

      cell.setPaddingTop(4);
      cell.setPaddingBottom(4);
      cell.setPaddingLeft(4);
      cell.setPaddingRight(4);

      if (r === 0) {
        cell.setBackgroundColor('#2d2363');
        cell.editAsText()
          .setForegroundColor('#ffffff')
          .setBold(true);
      }
    }
  }
}

function v2SacDocumentControlledTest() {
  assertDevIdentity_();

  const sessionId =
    'SAC-SESSION-TEST-20260909-050312';

  const result = v2GenerateSacMinutesEndorsement_(
    {
      sessionId: sessionId,
      confirmed: true,
      remarks:
        'Controlled SAC Minutes / Endorsement generation test.'
    },
    'Controlled SAC Document Test'
  );

  const session = v2Find_(
    'V2_SAC_SESSIONS',
    'SAC Session ID',
    sessionId
  );

  const minutesUrl = String(
    session.record['Minutes URL'] || ''
  ).trim();

  const endorsementUrl = String(
    session.record['Endorsement URL'] || ''
  ).trim();

  const checks = {
    generationOk:
      result && result.ok === true,

    documentCreated:
      !!String(result.documentUrl || '').trim(),

    minutesUrlSaved:
      !!minutesUrl,

    endorsementUrlSaved:
      !!endorsementUrl,

    sameCombinedDocument:
      minutesUrl === endorsementUrl,

    sessionStillFinalized:
      String(session.record['Status'] || '') ===
      'FINALIZED',

    combinedDocument:
      result.combinedMinutesAndEndorsement === true,

    oneCandidateIncluded:
      Number(result.candidateCount) === 1
  };

  const report = {
    ok:
      checks.generationOk &&
      checks.documentCreated &&
      checks.minutesUrlSaved &&
      checks.endorsementUrlSaved &&
      checks.sameCombinedDocument &&
      checks.sessionStillFinalized &&
      checks.combinedDocument &&
      checks.oneCandidateIncluded,

    sessionId: sessionId,

    documentUrl: result.documentUrl || '',
    minutesUrl: minutesUrl,
    endorsementUrl: endorsementUrl,

    checks: checks,

    emailSent: false,
    offerGenerated: false,
    colGenerated: false,
    v1Touched: false
  };

  Logger.log(JSON.stringify(report));
  return report;
}