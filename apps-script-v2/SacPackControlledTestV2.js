/**
 * Controlled runtime test for the physical SAC print-pack workflow.
 * Creates TEST-only V2 records/folders. No email is sent and V1 is untouched.
 */
function v2SacPackControlledTest() {
  assertDevIdentity_();

  const stamp = Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'yyyyMMdd-HHmmss');
  const now = new Date().toISOString();
  const root = DriveApp.getFolderById(CONFIG.rootFolderId);
  const testRoot = root.createFolder('V2_SAC_PACK_TEST_' + stamp);
  const completeFolder = testRoot.createFolder('COMPLETE_CANDIDATE');
  const incompleteFolder = testRoot.createFolder('INCOMPLETE_CANDIDATE');

  const completeRef = 'V2-SAC-PACK-COMPLETE-' + stamp;
  const incompleteRef = 'V2-SAC-PACK-INCOMPLETE-' + stamp;
  const meetingDate = Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
  const sessionId = 'SAC-PACK-TEST-' + stamp;

  function makePdf(folder, name, text) {
    const doc = DocumentApp.create('TEMP_' + name + '_' + stamp);
    doc.getBody().appendParagraph('CONTROLLED TEST DOCUMENT - NOT A REAL STUDENT');
    doc.getBody().appendParagraph(text || name);
    doc.saveAndClose();
    const source = DriveApp.getFileById(doc.getId());
    const pdf = folder.createFile(source.getBlob().getAs(MimeType.PDF).setName(name));
    source.setTrashed(true);
    return pdf;
  }

  function upload(folder, field, fileName) {
    const file = makePdf(folder, fileName, field);
    return {field:field, fileName:file.getName(), url:file.getUrl(), mimeType:'application/pdf'};
  }

  const completeUploads = [
    upload(completeFolder, 'identityDocument', 'TEST_IC.pdf'),
    upload(completeFolder, 'passportPhoto', 'TEST_PHOTO.pdf'),
    upload(completeFolder, 'transcript', 'TEST_TRANSCRIPT.pdf'),
    upload(completeFolder, 'certificate', 'TEST_CERTIFICATE.pdf')
  ];

  const incompleteUploads = [
    upload(incompleteFolder, 'identityDocument', 'TEST_IC.pdf'),
    upload(incompleteFolder, 'passportPhoto', 'TEST_PHOTO.pdf'),
    upload(incompleteFolder, 'transcript', 'TEST_TRANSCRIPT.pdf')
  ];

  const completeAdmission = makePdf(completeFolder, 'TEST_ADMISSION_FORM.pdf', 'Admission Form');
  const incompleteAdmission = makePdf(incompleteFolder, 'TEST_ADMISSION_FORM.pdf', 'Admission Form');

  function seedApplication(reference, name, folder, uploads, admissionForm, docStatus) {
    v2Append_('V2_APPLICATIONS', {
      'Reference No':reference,
      'Submitted At':now,
      'Applicant Type':'Local (Malaysian Citizen)',
      'Student Name':name,
      'ID / Passport No':'TEST-' + stamp,
      'Personal Email':'NO-EMAIL-TEST',
      'Programme':'MBA - Master of Business Administration',
      'Level of Study':'Master',
      'Study Mode':'Online',
      'Intake':'September 2026',
      'Entry Qualification Type':'Academic Qualification',
      'Highest Qualification':'Bachelor Degree',
      'Institution / Awarding Body':'Controlled Test University',
      'Field of Study':'Business Administration',
      'Academic Result / CGPA / Grade':'3.20',
      'Uploaded Files JSON':JSON.stringify(uploads),
      'Admission Form PDF URL':admissionForm.getUrl(),
      'Student Folder URL':folder.getUrl(),
      'Raw Application JSON':JSON.stringify({nationality:'Malaysian', country:'Malaysia'}),
      'Application Status':'TEST',
      'Email Status':'DISABLED',
      'Last Updated':now,
      'Version':'SAC_PACK_CONTROLLED_TEST'
    });

    v2Append_('V2_WORKFLOW', {
      'Reference No':reference,
      'Student Name':name,
      'ID / Passport No':'TEST-' + stamp,
      'Personal Email':'NO-EMAIL-TEST',
      'Programme':'MBA - Master of Business Administration',
      'Level of Study':'Master',
      'Intake':'September 2026',
      'Application Stage':'READY_FOR_SAC',
      'Application Status':'TEST',
      'Document Review Status':docStatus,
      'Field Classification':'RELATED',
      'Relevant Work Experience':'YES',
      'Screening Recommendation':'DIRECT_ENTRY',
      'Assessment Status':'NOT_REQUIRED',
      'Prerequisite Status':'NOT_REQUIRED',
      'Offer Letter Status':'NOT_ISSUED',
      'Acceptance Status':'NOT_OPEN',
      'Student Folder URL':folder.getUrl(),
      'Last Updated':now,
      'Updated By':'Controlled SAC Pack Test',
      'Version':V2_BUILD
    });
  }

  seedApplication(completeRef, 'V2 SAC PACK COMPLETE ' + stamp, completeFolder, completeUploads, completeAdmission, 'COMPLETE');
  seedApplication(incompleteRef, 'V2 SAC PACK INCOMPLETE ' + stamp, incompleteFolder, incompleteUploads, incompleteAdmission, 'INCOMPLETE');

  const session = v2CreateSacSessionManual_({
    sessionId:sessionId,
    name:'CONTROLLED SAC PACK TEST ' + stamp,
    meetingDate:meetingDate,
    meetingTime:'10:00',
    chairperson:'Controlled Test',
    sendInvitation:false
  }, 'Controlled SAC Pack Test');

  v2AssignSacCandidate_({sessionId:sessionId, referenceNo:completeRef}, 'Controlled SAC Pack Test');
  v2AssignSacCandidate_({sessionId:sessionId, referenceNo:incompleteRef}, 'Controlled SAC Pack Test');

  const prepared = v2PrepareSacPack_({sessionId:sessionId}, 'Controlled SAC Pack Test');
  const complete = prepared.candidates.filter(function(c){ return c.referenceNo === completeRef; })[0];
  const incomplete = prepared.candidates.filter(function(c){ return c.referenceNo === incompleteRef; })[0];
  const completeCandidate = v2SacPackFindCandidate_(sessionId, completeRef);
  const incompleteCandidate = v2SacPackFindCandidate_(sessionId, incompleteRef);

  const firstDocIsForm = !!complete && complete.documents && complete.documents.length > 0 && complete.documents[0].key === 'form01';
  const formUrl = completeCandidate ? String(completeCandidate.record['Form 01 URL'] || '') : '';
  const formId = v2SacPackExtractDriveId_(formUrl);
  let formExists = false;
  if (formId) {
    try { formExists = !!DriveApp.getFileById(formId); } catch (_) { formExists = false; }
  }

  let fileFetchOk = false;
  if (complete && complete.documents && complete.documents.length) {
    const filePayload = v2GetSacPackFile_({
      sessionId:sessionId,
      referenceNo:completeRef,
      documentKey:complete.documents[0].key
    });
    fileFetchOk = !!(filePayload && filePayload.base64 && filePayload.mimeType === 'application/pdf');
  }

  const completeDecisionStillPending = completeCandidate && String(completeCandidate.record['Decision'] || '') === 'PENDING';
  const incompleteDecisionStillPending = incompleteCandidate && String(incompleteCandidate.record['Decision'] || '') === 'PENDING';
  const missingCertificate = !!incomplete && (incomplete.missingDocuments || []).some(function(item){ return item.key === 'certificate'; });

  const report = {
    ok:
      !!prepared && prepared.ok === true &&
      prepared.candidateCount === 2 &&
      prepared.completeCount === 1 &&
      prepared.incompleteCount === 1 &&
      !!complete && complete.complete === true &&
      !!incomplete && incomplete.complete === false &&
      firstDocIsForm && formExists && fileFetchOk &&
      missingCertificate && completeDecisionStillPending && incompleteDecisionStillPending,
    sessionId:sessionId,
    candidateCount:prepared.candidateCount,
    completeCount:prepared.completeCount,
    incompleteCount:prepared.incompleteCount,
    firstDocumentIsPgAdm01:firstDocIsForm,
    pgAdm01SavedInStudentFolder:formExists,
    pgAdm01FileFetchOk:fileFetchOk,
    incompleteCandidateMissingCertificate:missingCertificate,
    sacDecisionUnaffected:!!(completeDecisionStillPending && incompleteDecisionStillPending),
    prerequisitePolicy:prepared.prerequisitePolicy,
    testFolderUrl:testRoot.getUrl(),
    emailSent:false,
    offerGenerated:false,
    v1Touched:false
  };

  Logger.log(JSON.stringify(report));
  return report;
}
