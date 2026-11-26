/**
 * ACC LOA Unified Issuer — STAGED FOR UAT, NOT DEPLOYED.
 * Requires LOA_V1_PARITY_CONTRACT.js in the same Apps Script project.
 *
 * Authoritative rule: ACC Registry-confirmed 7-digit Sky matric, not SAC stage.
 * This module is deliberately fail-closed until explicit Script Property
 * V2_LOA_REGISTRY_GATE_ENABLED=true is set after UAT.
 *
 * Only an authenticated v2IssueOffer dispatch bearing the dedicated LOA service
 * token may call the patched issuer; never expose this to general Workflow API
 * or AgenticBridge orchestration. See companion patch instructions.
 */
const V2_LOA_UAT_BUILD = 'ACC_LOA_UNIFIED_20261126';

function v2LoaRegistryMatric_(referenceNo, options) {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('V2_LOA_REGISTRY_GATE_ENABLED') !== 'true') {
    throw new Error('Unified Registry LOA issuer is disabled until UAT is approved.');
  }
  const opt = options || {};
  const matric = String(opt.skyStudentId || '').trim();
  if (!/^\d{7}$/.test(matric) ||
      opt.issuanceBasis !== 'REGISTRY_CONFIRMED_SKY_MATRIC' ||
      !/^IUC-ADM-/i.test(String(referenceNo || ''))) {
    throw new Error('LOA blocked: Registry-confirmed 7-digit SKY matric is required.');
  }
  return matric;
}

function v2SendOfferNotificationUnified_(referenceNo, acceptanceUrl, pdfFileId, options) {
  v2NotificationEnsureHeaders_();
  const ref=String(referenceNo||'').trim();
  const opt=options||{};
  const app=v2Find_('V2_APPLICATIONS','Reference No',ref);
  const flow=v2Find_('V2_WORKFLOW','Reference No',ref);
  if(!app||!flow)throw new Error('ACC application/workflow record not found.');
  const w=flow.record;
  if(String(w['Offer Letter Status']||'')!=='ISSUED')throw new Error('LOA must be issued before email.');
  if(!acceptanceUrl||!pdfFileId)throw new Error('Issued LOA PDF or Acceptance URL missing.');

  const programme=v2CurrentOfferProgramme_(app.record['Programme']);
  const programmeCode=v2OfferProgrammeCode_(programme);
  const idPassport=v2AssessmentNormalizeCredential_(app.record['ID / Passport No']||'');
  const matric=String(w['LOA Registry Matric No']||'').trim();
  const contract=v2LoaV1MailContract_(programme,matric,programmeCode,idPassport);

  const reviewFields=[
    'Acceptance Review PDF URL',
    'Surat Penerimaan Review PDF URL',
    'Surat Akuan Review PDF URL'
  ];
  const files=[DriveApp.getFileById(pdfFileId)];
  reviewFields.forEach(function(field){
    const url=String(w[field]||'').trim();
    const id=v2OfferExtractDriveId_(url);
    if(!id)throw new Error('Missing V1-compatible initial offer attachment: '+field);
    files.push(DriveApp.getFileById(id));
  });
  if(files.length!==4)throw new Error('Initial LOA mail must contain four PDFs.');
  const attachments=files.map(function(file,i){
    const blob=file.getAs(MimeType.PDF);
    return blob.setName(contract.attachmentNames[i]);
  });

  const mode=opt.testMode===true?'TEST':v2NotificationMode_();
  if(mode==='DISABLED')return {sent:false,status:'DISABLED',mode:'DISABLED',recipients:[]};
  if(['TEST','LIVE'].indexOf(mode)<0)throw new Error('Unknown Registry mail mode.');
  const recipient=mode==='TEST'?
    String(opt.testRecipient||v2NotificationTestRecipient_()||'').trim().toLowerCase():
    String(app.record['Personal Email']||'').trim().toLowerCase();
  if(!recipient||recipient.indexOf('@')<0)throw new Error('Valid Registry test/student email is required.');
  if(mode==='TEST'&&recipient!==String(V2_LOA_TEST_RECIPIENT).trim().toLowerCase())
    throw new Error('UAT LOA mail cannot target a non-test recipient.');

  const sender='registry@innovative.edu.my';
  const own=String(Session.getEffectiveUser().getEmail()||'').toLowerCase();
  const opts={name:'Registry Department, IUC',attachments:attachments};
  if(own!==sender){
    const aliases=GmailApp.getAliases().map(function(e){return String(e).trim().toLowerCase()});
    if(aliases.indexOf(sender)<0)throw new Error('Registry sender alias is not available. LOA not emailed.');
    opts.from=sender;
  }
  if(mode==='LIVE'){
    const cc=['registry@innovative.edu.my','fadhilhasif@innovative.edu.my'];
    if(/\bMBA\b|Master of Business Administration/i.test(programme))
      cc.splice(1,0,'oissm@innovative.edu.my');
    opts.cc=cc.join(',');
  }

  GmailApp.sendEmail(recipient,contract.subject,contract.body,opts);
  const now=new Date().toISOString(),status=mode+'_SENT_1';
  v2NotificationUpdateWorkflow_(ref,{
    'Offer Email Status':status,
    'Offer Email Sent At':mode==='LIVE'?now:'',
    'Last Updated':now
  });
  if(typeof v2Audit_==='function'){
    v2Audit_(ref,'OFFER','SEND_OFFER_EMAIL_V1_PARITY',{},{
      mode:mode,attachmentCount:attachments.length,recipient:recipient
    },'ACC Registry', 'SUCCESS','');
  }
  return {sent:true,status:status,mode:mode,recipients:[recipient],attachmentCount:4};
}
