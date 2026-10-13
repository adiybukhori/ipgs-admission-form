function v2IssueOffer_(referenceNo, actor, options) {
  assertDevIdentity_();
  const reference = String(referenceNo || '').trim();
  if (!reference) throw new Error('Reference No is required.');
  const opts = options || {};
  if (opts.testMode === true && String(opts.testRecipient || '').toLowerCase() !== V2_LOA_TEST_RECIPIENT) {
    throw new Error('LOA trial must use the authorised Registry test inbox.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
    const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
    if (!application || !workflow) throw new Error('Application/workflow record not found.');
    v2OfferEnsureHeaders_(workflow.sheet, V2_OFFER_WORKFLOW_HEADERS);
    const w = workflow.record;
    const programme = v2CurrentOfferProgramme_(application.record['Programme']);
    const alreadyIssued = String(w['Offer Letter Status']) === 'ISSUED' && !!w['Offer Letter PDF URL'];
    if (alreadyIssued && v2IsMbaPhdPackage_(application.record['Programme']) && w['Offer Programme'] !== programme) {
      throw new Error('Existing package LOA needs Registry review before replacement; it has not been resent.');
    }
    let prepared, generated;
    if (alreadyIssued) {
      prepared = {acceptanceSigningUrl:String(w['Acceptance Signing URL'] || '')};
      generated = {offerLetterStatus:'ISSUED',applicationStage:w['Application Stage'],offerLetterPdfUrl:w['Offer Letter PDF URL'],pdfFileId:v2OfferExtractDriveId_(w['Offer Letter PDF URL'])};
    } else {
      prepared = v2PrepareOffer_(reference, actor || 'Offer Issuance');
      generated = v2GenerateOfferLetter_(reference, actor || 'Offer Issuance');
    }
    if (!prepared.acceptanceSigningUrl || !generated.pdfFileId) throw new Error('Offer PDF or acceptance link is missing.');
    const acceptancePack = v2AcceptancePackEnsureReviewDocs_(reference, actor || 'Offer Issuance');
    let email = {sent:false,mode:'NOT_REQUESTED',status:'NOT_REQUESTED'};
    let duplicateEmailSuppressed = false;
    if (opts.sendEmail !== false) {
      const mode = opts.testMode === true ? 'TEST' : v2NotificationMode_();
      const recipient = mode === 'TEST' ? String(opts.testRecipient || v2NotificationTestRecipient_()).toLowerCase() : String(application.record['Personal Email'] || '').toLowerCase();
      const props = PropertiesService.getScriptProperties();
      const deliveryKey = 'V2_LOA_DELIVERY_' + v2OfferHashToken_(reference + '|' + generated.pdfFileId + '|' + mode + '|' + recipient);
      const delivery = props.getProperty(deliveryKey);
      if (delivery === 'SENT' || (mode === 'LIVE' && /^LIVE_SENT_/.test(String(w['Offer Email Status'] || '')))) {
        duplicateEmailSuppressed = true;
        email = {sent:false,mode:mode,status:'ALREADY_SENT',recipient:recipient};
      } else if (delivery === 'SENDING' || delivery === 'UNKNOWN') {
        throw new Error('Previous delivery outcome requires Registry verification. Automatic resend was blocked.');
      } else {
        props.setProperty(deliveryKey, 'SENDING');
        try {
          email = v2SendOfferEmail_(reference, prepared.acceptanceSigningUrl, generated.pdfFileId, {testMode:opts.testMode === true,testRecipient:opts.testRecipient});
          props.setProperty(deliveryKey, email.sent ? 'SENT' : 'NOT_SENT');
        } catch (error) {
          props.setProperty(deliveryKey, 'UNKNOWN');
          v2NotificationUpdateWorkflow_(reference, {'Offer Email Status':'DELIVERY_REVIEW_REQUIRED','Last Updated':new Date().toISOString()});
          throw new Error('LOA PDF is saved. Email delivery requires verification before retry: ' + String(error.message || error));
        }
      }
    }
    return {ok:true,referenceNo:reference,offerProgramme:programme,offerLetterStatus:generated.offerLetterStatus,applicationStage:generated.applicationStage,offerLetterPdfUrl:generated.offerLetterPdfUrl,acceptanceSigningUrl:prepared.acceptanceSigningUrl,acceptancePackStatus:String(acceptancePack && acceptancePack.status || ''),acceptancePackDocumentCount:Array.isArray(acceptancePack && acceptancePack.documents) ? acceptancePack.documents.length : 0,emailSent:!!email.sent,emailMode:email.mode || '',emailStatus:email.status || '',emailRecipient:(email.recipients && email.recipients[0]) || email.recipient || '',duplicate:alreadyIssued,duplicateEmailSuppressed:duplicateEmailSuppressed,v1Touched:false};
  } finally { lock.releaseLock(); }
}
