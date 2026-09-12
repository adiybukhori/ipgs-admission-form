const V2_LEGACY_IMPORT_BUILD = 'V1_TO_V2_LEGACY_IMPORT_20260912';
const V2_LEGACY_IMPORT_CONFIRM = 'IMPORT_V1_TO_V2_CONFIRMED_64';

function v2LegacyMigrationDryRun() {
  assertDevIdentity_();

  const sourceRows = v2Rows_('ADMISSION_RESPONSE');
  const existingRows = v2Rows_('V2_APPLICATIONS');
  const existingRefs = {};
  const idCounts = {};

  existingRows.forEach(function(row) {
    const ref = String(row['Reference No'] || '').trim();
    if (ref) existingRefs[ref] = true;
  });

  sourceRows.forEach(function(row) {
    const ref = String(row['Reference No'] || '').trim();
    if (!ref) return;
    const id = v2LegacyNormalizeId_(row['ID / Passport No']);
    if (id) idCounts[id] = (idCounts[id] || 0) + 1;
  });

  const items = [];
  let uniqueMap = {};

  sourceRows.forEach(function(row) {
    const ref = String(row['Reference No'] || '').trim();
    if (!ref) return;

    const name = String(row['Full Name'] || '').trim();
    const id = v2LegacyNormalizeId_(row['ID / Passport No']);
    const programme = String(row['Programme'] || '').trim();
    const folderUrl = String(row['Student Folder URL'] || '').trim();
    const filesJson = String(row['Uploaded Files JSON'] || '').trim();

    if (id) uniqueMap[id] = true;

    const warnings = [];
    if (!folderUrl) warnings.push('Missing folder');
    if (!filesJson) warnings.push('Missing files JSON');
    if (id && idCounts[id] > 1) warnings.push('Repeat applicant ID');
    if (existingRefs[ref]) warnings.push('Exact ref already in V2');

    let status = 'READY';
    if (!ref || !name || !id || !programme) status = 'BLOCKED';
    else if (existingRefs[ref]) status = 'SKIP_EXISTING';
    else if (warnings.length) status = 'READY_WITH_WARNING';

    items.push({
      referenceNo: ref,
      studentName: name,
      normalizedId: id,
      programme: programme,
      submittedAt: String(row['Submitted At'] || ''),
      folderUrl: folderUrl,
      filesPresent: !!filesJson,
      duplicateApplicant: !!(id && idCounts[id] > 1),
      exactRefExistsInV2: !!existingRefs[ref],
      status: status,
      warnings: warnings
    });
  });

  const report = {
    ok: true,
    mode: 'DRY_RUN',
    sourceSheet: 'ADMISSION_RESPONSE',
    targetSheets: ['V2_APPLICATIONS', 'V2_WORKFLOW', 'V2_AUDIT_LOG'],
    submissionsFound: items.length,
    uniqueApplicants: Object.keys(uniqueMap).length,
    extraRepeatSubmissions: items.length - Object.keys(uniqueMap).length,
    duplicateFlaggedRows: items.filter(function(item) { return item.duplicateApplicant; }).length,
    ready: items.filter(function(item) { return item.status === 'READY'; }).length,
    readyWithWarning: items.filter(function(item) { return item.status === 'READY_WITH_WARNING'; }).length,
    skipExisting: items.filter(function(item) { return item.status === 'SKIP_EXISTING'; }).length,
    blocked: items.filter(function(item) { return item.status === 'BLOCKED'; }).length,
    missingFolder: items.filter(function(item) { return !item.folderUrl; }).length,
    missingFilesJson: items.filter(function(item) { return !item.filesPresent; }).length,
    emailSent: false,
    folderCreated: false,
    pdfGenerated: false,
    v1Touched: false,
    importExecuted: false,
    confirmationRequired: V2_LEGACY_IMPORT_CONFIRM,
    items: items
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2LegacyMigrationExecute(confirmText) {
  assertDevIdentity_();

  if (String(confirmText || '').trim() !== V2_LEGACY_IMPORT_CONFIRM) {
    throw new Error('Legacy import blocked: explicit confirmation text is required.');
  }

  const dryRun = v2LegacyMigrationDryRun();

  if (dryRun.submissionsFound !== 64) {
    throw new Error('Legacy import blocked: expected 64 V1 submissions, found ' + dryRun.submissionsFound + '. Run dry-run again and review.');
  }

  if (dryRun.blocked > 0) {
    throw new Error('Legacy import blocked: ' + dryRun.blocked + ' source record(s) are missing core fields.');
  }

  const sourceRows = v2Rows_('ADMISSION_RESPONSE');
  const duplicateIds = {};
  dryRun.items.forEach(function(item) {
    if (item.duplicateApplicant && item.normalizedId) duplicateIds[item.normalizedId] = true;
  });

  const imported = [];
  const skipped = [];
  const now = new Date().toISOString();

  sourceRows.forEach(function(row) {
    const reference = String(row['Reference No'] || '').trim();
    if (!reference) return;

    if (v2Find_('V2_APPLICATIONS', 'Reference No', reference)) {
      skipped.push({ referenceNo: reference, reason: 'EXACT_REFERENCE_EXISTS' });
      return;
    }

    const normalizedId = v2LegacyNormalizeId_(row['ID / Passport No']);
    const duplicateApplicant = !!duplicateIds[normalizedId];
    const raw = v2LegacyBuildRaw_(row, duplicateApplicant);
    const applicationStatus = 'HISTORICAL';

    v2Append_('V2_APPLICATIONS', {
      'Reference No': reference,
      'Submitted At': String(row['Submitted At'] || ''),
      'Applicant Type': String(row['Applicant Type'] || ''),
      'Student Name': String(row['Full Name'] || ''),
      'ID / Passport No': String(row['ID / Passport No'] || ''),
      'Personal Email': String(row['Email'] || row['Captured Email'] || ''),
      'Phone Number': String(row['Phone Number'] || ''),
      'Programme': String(row['Programme'] || ''),
      'Level of Study': String(row['Level of Study'] || ''),
      'Study Mode': String(row['Mode of Study'] || ''),
      'Intake': String(row['Intake'] || ''),
      'Intake ID': '',
      'Entry Qualification Type': String(row['Entry Qualification Type'] || ''),
      'Highest Qualification': String(row['Highest Qualification'] || ''),
      'Institution / Awarding Body': String(row['Last Institution / Awarding Body'] || ''),
      'Field of Study': String(row['Field of Study / Qualification Area'] || ''),
      'Academic Result / CGPA / Grade': String(row['Academic Result / CGPA / Grade'] || ''),
      'Transfer Applicant': 'NO',
      'Agent Code': '',
      'Agent Name': '',
      'Agent Email': '',
      'Student Folder URL': String(row['Student Folder URL'] || ''),
      'Admission Form PDF URL': String(row['Admission Form PDF URL'] || ''),
      'Uploaded Files JSON': String(row['Uploaded Files JSON'] || '[]'),
      'Raw Application JSON': JSON.stringify(raw),
      'Application Status': applicationStatus,
      'Email Status': 'LEGACY_NO_EMAIL',
      'Last Updated': now,
      'Version': V2_LEGACY_IMPORT_BUILD,
      'Prospect Status': String(row['Prospect Status'] || ''),
      'SKY Prospect ID': String(row['Sky Prospect ID'] || ''),
      'Fee Group': String(row['Fee Group'] || ''),
      'Prospect Updated At': String(row['Prospect Updated At'] || ''),
      'Prospect Remarks': v2LegacyMergeRemarks_(row['Prospect Remarks'], duplicateApplicant ? 'Repeat applicant ID in V1 history.' : '')
    });

    v2Append_('V2_WORKFLOW', {
      'Reference No': reference,
      'Student Name': String(row['Full Name'] || ''),
      'ID / Passport No': String(row['ID / Passport No'] || ''),
      'Personal Email': String(row['Email'] || row['Captured Email'] || ''),
      'Innovative Email': '',
      'Programme': String(row['Programme'] || ''),
      'Level of Study': String(row['Level of Study'] || ''),
      'Intake': String(row['Intake'] || ''),
      'Application Stage': 'LEGACY_IMPORTED',
      'Application Status': 'HISTORICAL',
      'Screening Recommendation': v2LegacyScreeningSummary_(row),
      'SAC Session ID': String(row['SAC Sitting'] || ''),
      'SAC Decision': '',
      'SAC Endorsed At': String(row['SAC Date'] || ''),
      'Assessment Status': 'LEGACY_NOT_MAPPED',
      'Prerequisite Status': 'LEGACY_NOT_MAPPED',
      'Offer Letter Status': v2LegacyOfferStatus_(row['Offer Letter Status']),
      'Offer Letter Issued At': String(row['COL Issued At'] || ''),
      'Acceptance Status': v2LegacyAcceptanceStatus_(row['Acceptance Status']),
      'Orientation Session ID': '',
      'Orientation Status': String(row['Orientation Status'] || 'LEGACY_NOT_MAPPED'),
      'Provisioning Status': 'LEGACY_NOT_MAPPED',
      'Academic Handover Status': 'LEGACY_NOT_MAPPED',
      'Student Folder URL': String(row['Student Folder URL'] || ''),
      'Last Updated': now,
      'Updated By': 'V1 Legacy Migration',
      'Version': V2_LEGACY_IMPORT_BUILD,
      'Prospect Status': String(row['Prospect Status'] || ''),
      'SKY Prospect ID': String(row['Sky Prospect ID'] || ''),
      'Fee Group': String(row['Fee Group'] || ''),
      'Prospect Updated At': String(row['Prospect Updated At'] || ''),
      'Document Review Status': v2LegacyDocumentStatus_(row['Document Check Status']),
      'Document Reviewed At': '',
      'Document Reviewed By': '',
      'Missing Document Count': '',
      'Qualification Screening Status': 'LEGACY_IMPORTED',
      'Field Classification': '',
      'Relevant Work Experience': '',
      'Qualification Rule Code': '',
      'Qualification Screened At': '',
      'Qualification Screened By': '',
      'Manual Review Required': 'LEGACY_HISTORY',
      'Offer Letter PDF URL': String(row['Offer Letter PDF URL'] || ''),
      'Offer Letter Remarks': v2LegacyMergeRemarks_(row['Offer Letter Remarks'], 'Imported from V1 history; no document regenerated.'),
      'Acceptance Token Hash': '',
      'Acceptance Signing URL': String(row['Acceptance Signing URL'] || ''),
      'Acceptance Received At': String(row['Acceptance Received At'] || ''),
      'Acceptance Remarks': String(row['Acceptance Remarks'] || ''),
      'Acceptance PDF URL': '',
      'Acceptance Signed Name': '',
      'Acceptance Signed At': ''
    });

    v2Audit_(
      reference,
      'LEGACY_MIGRATION',
      'IMPORT_V1_HISTORY',
      { source: 'ADMISSION_RESPONSE' },
      {
        applicationStatus: 'HISTORICAL',
        applicationStage: 'LEGACY_IMPORTED',
        duplicateApplicant: duplicateApplicant,
        reusedExistingFolder: !!String(row['Student Folder URL'] || ''),
        reusedExistingDocuments: !!String(row['Uploaded Files JSON'] || '')
      },
      'V1 Legacy Migration',
      'SUCCESS',
      'No email sent. No folder or PDF generated. V1 source unchanged.'
    );

    imported.push(reference);
  });

  v2InvalidateCache_();

  const report = {
    ok: true,
    mode: 'EXECUTE',
    importedCount: imported.length,
    skippedCount: skipped.length,
    importedReferences: imported,
    skipped: skipped,
    emailSent: false,
    folderCreated: false,
    pdfGenerated: false,
    v1Touched: false,
    historicalOnly: true,
    build: V2_LEGACY_IMPORT_BUILD
  };

  Logger.log(JSON.stringify(report));
  return report;
}

function v2LegacyNormalizeId_(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function v2LegacyBuildRaw_(row, duplicateApplicant) {
  return {
    source: 'V1_LEGACY_IMPORT',
    legacyReferenceNo: String(row['Reference No'] || ''),
    legacyApplicationStatus: String(row['Application Status'] || ''),
    legacyApplicationStage: String(row['Application Stage'] || ''),
    legacyQualificationStatus: String(row['Qualification Status'] || ''),
    legacySacStatus: String(row['SAC Status'] || ''),
    legacyRegistrationStatus: String(row['Registration Status'] || ''),
    legacyDuplicateApplicant: duplicateApplicant === true,
    referralSource: String(row['Referral Source'] || ''),
    partnerCode: String(row['Partner Code'] || ''),
    proposedSupervisor: String(row['Proposed Supervisor'] || ''),
    country: String(row['Country'] || ''),
    nationality: String(row['Nationality'] || ''),
    gender: String(row['Gender'] || ''),
    fullAddress: String(row['Full Address'] || ''),
    placeOfBirth: String(row['Place of Birth'] || ''),
    race: String(row['Race'] || ''),
    religion: String(row['Religion'] || ''),
    maritalStatus: String(row['Marital Status'] || ''),
    employmentStatus: String(row['Employment Status'] || ''),
    employmentSector: String(row['Employment Sector'] || ''),
    salaryRange: String(row['Salary Range'] || ''),
    nonWorkingCategory: String(row['Non-Working Category'] || ''),
    yearOfCompletion: String(row['Year of Completion'] || ''),
    healthDeclaration: String(row['Health Declaration'] || ''),
    healthDeclarationRemarks: String(row['Health Declaration Remarks'] || ''),
    okuStatus: String(row['OKU Status'] || ''),
    okuCategory: String(row['OKU Category'] || ''),
    supportRequired: String(row['Support Required'] || ''),
    paymentArrangement: String(row['Payment Arrangement'] || ''),
    paymentSource: String(row['Payment Source'] || ''),
    legacyLastUpdated: String(row['Last Updated'] || ''),
    legacyUpdatedBy: String(row['Updated By'] || '')
  };
}

function v2LegacyDocumentStatus_(value) {
  const text = String(value || '').trim().toUpperCase();
  if (text === 'COMPLETE') return 'COMPLETE';
  if (text === 'INCOMPLETE') return 'INCOMPLETE';
  if (text.indexOf('PENDING') > -1) return 'PENDING';
  return text ? 'LEGACY_' + text.replace(/[^A-Z0-9]+/g, '_') : 'LEGACY_UNKNOWN';
}

function v2LegacyOfferStatus_(value) {
  const text = String(value || '').trim().toUpperCase();
  if (text === 'ISSUED') return 'ISSUED';
  if (text.indexOf('NOT') > -1) return 'NOT_ISSUED';
  return text ? 'LEGACY_' + text.replace(/[^A-Z0-9]+/g, '_') : 'NOT_ISSUED';
}

function v2LegacyAcceptanceStatus_(value) {
  const text = String(value || '').trim().toUpperCase();
  if (text === 'ACCEPTED') return 'ACCEPTED';
  if (text.indexOf('PENDING') > -1) return 'PENDING';
  if (text.indexOf('DECLIN') > -1) return 'DECLINED';
  return text ? 'LEGACY_' + text.replace(/[^A-Z0-9]+/g, '_') : 'NOT_OPEN';
}

function v2LegacyScreeningSummary_(row) {
  const qualification = String(row['Qualification Status'] || '').trim();
  const sac = String(row['SAC Status'] || '').trim();
  const stage = String(row['Application Stage'] || '').trim();
  const parts = [];
  if (qualification) parts.push('Qualification: ' + qualification);
  if (sac) parts.push('SAC: ' + sac);
  if (stage) parts.push('V1 Stage: ' + stage);
  return parts.length ? parts.join(' | ') : 'LEGACY_HISTORY';
}

function v2LegacyMergeRemarks_(a, b) {
  return [String(a || '').trim(), String(b || '').trim()]
    .filter(function(value) { return !!value; })
    .join(' | ');
}
