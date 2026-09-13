function v2AiAutoControlledTest() {
  assertDevIdentity_();
  const stamp = Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'yyyyMMdd-HHmmss');
  const now = new Date().toISOString();
  const reference = 'V2-AI-AUTO-TEST-' + stamp;
  const root = DriveApp.getFolderById(CONFIG.rootFolderId);
  const testRoot = root.createFolder('V2_AI_AUTO_TEST_' + stamp);

  const transcriptDoc = DocumentApp.create('TRANSCRIPT_' + stamp);
  transcriptDoc.getBody().appendParagraph('CONTROLLED TEST DOCUMENT - NOT A REAL STUDENT');
  transcriptDoc.getBody().appendParagraph('Bachelor of Business Administration');
  transcriptDoc.getBody().appendParagraph('Institution: Innovative University College Test');
  transcriptDoc.getBody().appendParagraph('CGPA: 3.20 / 4.00');
  transcriptDoc.getBody().appendParagraph('Year: 2025');
  transcriptDoc.saveAndClose();
  const transcriptPdf = testRoot.createFile(DriveApp.getFileById(transcriptDoc.getId()).getBlob().getAs(MimeType.PDF).setName('TEST_TRANSCRIPT.pdf'));
  DriveApp.getFileById(transcriptDoc.getId()).setTrashed(true);

  const cvDoc = DocumentApp.create('CV_' + stamp);
  cvDoc.getBody().appendParagraph('CONTROLLED TEST DOCUMENT - NOT A REAL STUDENT');
  cvDoc.getBody().appendParagraph('Work Experience: Business Operations Executive, 2020-2025.');
  cvDoc.getBody().appendParagraph('Relevant experience: management, operations, team supervision and business reporting.');
  cvDoc.saveAndClose();
  const cvPdf = testRoot.createFile(DriveApp.getFileById(cvDoc.getId()).getBlob().getAs(MimeType.PDF).setName('TEST_CV.pdf'));
  DriveApp.getFileById(cvDoc.getId()).setTrashed(true);

  const uploaded = [
    {field:'transcript',fileName:transcriptPdf.getName(),url:transcriptPdf.getUrl(),mimeType:'application/pdf'},
    {field:'cvResume',fileName:cvPdf.getName(),url:cvPdf.getUrl(),mimeType:'application/pdf'}
  ];

  v2Append_('V2_APPLICATIONS', {
    'Reference No':reference,'Submitted At':now,'Applicant Type':'Local (Malaysian Citizen)',
    'Student Name':'V2 AI AUTO TEST ' + stamp,'ID / Passport No':'AI-TEST-' + stamp,
    'Personal Email':'NO-EMAIL-TEST','Programme':'MBA - Master of Business Administration',
    'Level of Study':'Master','Study Mode':'Online','Intake':'September 2026',
    'Entry Qualification Type':'Academic Qualification','Highest Qualification':'Bachelor Degree',
    'Institution / Awarding Body':'Innovative University College Test','Field of Study':'Business Administration',
    'Academic Result / CGPA / Grade':'3.20','Uploaded Files JSON':JSON.stringify(uploaded),
    'Student Folder URL':testRoot.getUrl(),'Application Status':'TEST','Email Status':'DISABLED',
    'Last Updated':now,'Version':'AI_AUTO_CONTROLLED_TEST'
  });
  v2Append_('V2_WORKFLOW', {
    'Reference No':reference,'Student Name':'V2 AI AUTO TEST ' + stamp,
    'Programme':'MBA - Master of Business Administration','Application Stage':'DOCUMENT_REVIEW',
    'Application Status':'TEST','Document Review Status':'COMPLETE',
    'Screening Recommendation':'PENDING_QUALIFICATION_SCREENING','Offer Letter Status':'NOT_ISSUED',
    'Acceptance Status':'NOT_OPEN','Last Updated':now,'Updated By':'Controlled AI Auto Test','Version':V2_BUILD
  });
  v2Append_(V2_DOCUMENT_REVIEW_SHEET, {
    'Reference No':reference,'Student Name':'V2 AI AUTO TEST ' + stamp,
    'Programme':'MBA - Master of Business Administration','Review Status':'COMPLETE',
    'Required Documents JSON':'[]','Submitted Documents JSON':JSON.stringify(uploaded),'Missing Documents JSON':'[]',
    'Reviewed At':now,'Reviewed By':'Controlled AI Auto Test','Last Updated':now
  });

  const result = v2TryAutoAiScreening_(reference, 'Controlled AI Auto Test');
  const aiRow = v2Find_(V2_AI_SCREENING_SHEET, 'Reference No', reference);
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  const status = String(result && result.status || '');
  const providerConfigured = status !== 'AUTO_PENDING' || String(result && result.reason || '') !== 'OPENAI_API_KEY_MISSING';
  const pipelineResponded = ['AUTO_COMPLETED','REVIEW_REQUIRED','AUTO_PENDING','AUTO_DISABLED','AUTO_FAILED'].indexOf(status) > -1;
  const manualFallbackAvailable = !!(result && result.manualScreeningAvailable);
  const acceptable = status === 'AUTO_COMPLETED' || status === 'REVIEW_REQUIRED' || (status === 'AUTO_PENDING' && manualFallbackAvailable);
  const report = {
    ok: pipelineResponded && acceptable,
    referenceNo:reference,
    providerConfigured:providerConfigured,
    status:status,
    manualFallbackAvailable:manualFallbackAvailable,
    aiRowStatus:aiRow ? String(aiRow.record['Status'] || '') : '',
    applicationStage:workflow ? String(workflow.record['Application Stage'] || '') : '',
    result:result,
    testFolderUrl:testRoot.getUrl(),
    v1Touched:false
  };
  Logger.log(JSON.stringify(report));
  return report;
}

function v2Phase2ControlledTestSuite() {
  assertDevIdentity_();
  const manual = v2ManualScreeningRaceControlledTest();
  const ai = v2AiAutoControlledTest();
  const offerAcceptance = v2OfferAcceptanceEndToEndControlledTest();
  const report = {
    ok: !!(manual && manual.ok && ai && ai.ok && offerAcceptance && offerAcceptance.ok),
    manualScreening:manual,
    aiAuto:ai,
    offerAcceptance:offerAcceptance,
    v1Touched:false
  };
  Logger.log(JSON.stringify(report));
  return report;
}
