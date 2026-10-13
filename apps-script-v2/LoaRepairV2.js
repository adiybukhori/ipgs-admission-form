const V2_LOA_REPAIR_BUILD = 'LOA_REPAIR_20261013';
const V2_LOA_TEST_RECIPIENT = 'adiybukhori.ipgs@innovative.edu.my';
const V2_LOA_SERVICE_TOKEN_SHA256 = '92d2f484fd3111e956bc50cda1d0581492c3f3156548b0042c67a036153ada3d';

function v2IsMbaPhdPackage_(programme) {
  const value = String(programme || '');
  return /\bMBA\b|Master\s+of\s+Business\s+Administration/i.test(value) && /\bPhD\b|Doctor\s+of\s+Philosophy/i.test(value);
}

function v2CurrentOfferProgramme_(programme) {
  return v2IsMbaPhdPackage_(programme) ? 'Master of Business Administration (MBA)' : String(programme || '').trim();
}

function v2AssertCurrentAwardDocument_(body, originalProgramme) {
  if (!v2IsMbaPhdPackage_(originalProgramme)) return;
  const text = body.getText();
  if (!/Master\s+of\s+Business\s+Administration/i.test(text) || /\bPhD\b|Doctor\s+of\s+Philosophy/i.test(text)) {
    throw new Error('MBA-only template validation failed. No letter was emailed.');
  }
}

function v2VerifyLoaServiceAccess_(token, action) {
  if (['v2IssueOffer','v2LoaControlledTest','v2LoaDiagnostics'].indexOf(String(action || '')) < 0) return false;
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) return false;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(token),Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');
  return digest === V2_LOA_SERVICE_TOKEN_SHA256;
}

function v2LoaControlledTest() {
  assertDevIdentity_();
  const reference = 'IUC-ADM-LOA-UAT-20261013';
  const name = 'REGISTRY LOA TEST - MBA PATHWAY';
  const programme = 'MBA + PhD - Master of Business Administration + Doctor of Philosophy';
  let application = v2Find_('V2_APPLICATIONS','Reference No',reference);
  if (!application) {
    const now = new Date().toISOString();
    const testRoot = v2GetOrCreateFolder_(DriveApp.getFolderById(CONFIG.rootFolderId),'V2_TEST_OUTPUT');
    const folder = v2GetOrCreateFolder_(testRoot,'LOA_REPAIR_20261013');
    v2Append_('V2_APPLICATIONS',{'Reference No':reference,'Submitted At':now,'Student Name':name,'ID / Passport No':'LOA-UAT-20261013','Personal Email':V2_LOA_TEST_RECIPIENT,'Programme':programme,'Level of Study':'Doctorate','Study Mode':'Part Time','Intake':'October 2026','Student Folder URL':folder.getUrl(),'Raw Application JSON':JSON.stringify({fullAddress:'REGISTRY TEST ADDRESS, KELANA SQUARE, PETALING JAYA'}),'Application Status':'TEST','Email Status':'TEST','Last Updated':now,'Version':V2_LOA_REPAIR_BUILD});
    v2Append_('V2_WORKFLOW',{'Reference No':reference,'Student Name':name,'Personal Email':V2_LOA_TEST_RECIPIENT,'Programme':programme,'Intake':'October 2026','Application Stage':'ELIGIBLE_FOR_OFFER','Application Status':'TEST','SAC Decision':'DIRECT_ENTRY','Assessment Status':'NOT_REQUIRED','Prerequisite Status':'NOT_REQUIRED','Offer Letter Status':'NOT_ISSUED','Acceptance Status':'PENDING','Student Folder URL':folder.getUrl(),'Last Updated':now,'Updated By':'Authorised Registry Synthetic Test','Version':V2_LOA_REPAIR_BUILD});
    v2InvalidateCache_();
    application = v2Find_('V2_APPLICATIONS','Reference No',reference);
  }
  if (application.record['Version'] !== V2_LOA_REPAIR_BUILD || application.record['Student Name'] !== name || application.record['Personal Email'] !== V2_LOA_TEST_RECIPIENT) throw new Error('Controlled test identity mismatch.');
  const folder = DriveApp.getFolderById(v2OfferExtractDriveId_(application.record['Student Folder URL']));
  const col = v2GenerateSubmissionCol_(folder,{fullName:name,programme:programme,levelOfStudy:'Doctorate',studyMode:'Part Time',idPassport:'LOA-UAT-20261013',fullAddress:'REGISTRY TEST ADDRESS'},reference,{name:'October 2026'},new Date());
  const issued = v2IssueOffer_(reference,'Authorised Registry Synthetic Test',{sendEmail:true,testMode:true,testRecipient:V2_LOA_TEST_RECIPIENT});
  const duplicate = v2IssueOffer_(reference,'Authorised Registry Synthetic Test',{sendEmail:true,testMode:true,testRecipient:V2_LOA_TEST_RECIPIENT});
  const token = decodeURIComponent(issued.acceptanceSigningUrl.match(/[?&]token=([^&]+)/)[1]);
  const acceptance = v2GetAcceptancePackForToken(token);
  const pdf = DriveApp.getFileById(v2OfferExtractDriveId_(issued.offerLetterPdfUrl));
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference).record;
  if (!duplicate.duplicateEmailSuppressed || issued.offerProgramme !== 'Master of Business Administration (MBA)' || acceptance.programme !== issued.offerProgramme || pdf.getMimeType() !== MimeType.PDF || workflow['Application Stage'] !== 'OFFER_ISSUED') throw new Error('Controlled LOA verification failed.');
  return {ok:true,build:V2_LOA_REPAIR_BUILD,referenceNo:reference,recipient:V2_LOA_TEST_RECIPIENT,offerProgramme:issued.offerProgramme,colReference:col.reference,colPdfUrl:col.url,loaPdfUrl:issued.offerLetterPdfUrl,loaPdfBytes:pdf.getBlob().getBytes().length,templateId:CONFIG.officialLoaTemplateId,acceptanceProgramme:acceptance.programme,acceptanceLinkVerified:true,acceptancePackStatus:issued.acceptancePackStatus,acceptancePackDocumentCount:issued.acceptancePackDocumentCount,emailSent:issued.emailSent,emailStatus:issued.emailStatus,duplicateEmailSuppressed:duplicate.duplicateEmailSuppressed,samePdf:issued.offerLetterPdfUrl===duplicate.offerLetterPdfUrl,sameAcceptanceLink:issued.acceptanceSigningUrl===duplicate.acceptanceSigningUrl,applicationStage:workflow['Application Stage'],realStudentsChanged:false};
}
