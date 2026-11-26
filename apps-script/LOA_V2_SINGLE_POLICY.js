/**
 * One LOA eligibility policy for ACC and Apps Script V2.
 * Stage-only SAC gates in OfferLetterV2/AgenticBridgeV2 must be REMOVED
 * before this helper is wired into the tested Apps Script deployment.
 * Requires server-verified ACC request: issuanceBasis, 7-digit SKY matric,
 * source "ACC_APPLICATIONS" and an existing application reference.
 * No workflow stage mutation occurs here.
 * NOT A PRODUCTION DEPLOYMENT.
 */
function v2LoaUnifiedGate_(referenceNo, options, workflowRecord, applicationRecord) {
  const opts=options||{}, w=workflowRecord||{}, a=applicationRecord||{};
  const ref=String(referenceNo||'').trim();
  const matric=String(opts.skyStudentId||'').trim();
  if(!/^IUC-ADM-[A-Za-z0-9-]+$/.test(ref)||ref.length>160){
    throw new Error('LOA_REJECTED: Invalid ACC Application Reference.');
  }
  if(opts.issuanceBasis!=='REGISTRY_CONFIRMED_SKY_MATRIC' ||
     opts.source!=='ACC_APPLICATIONS') {
    throw new Error('LOA_REJECTED: Only Registry-confirmed Applications can initiate official LOA.');
  }
  if(!/^\d{7}$/.test(matric)) {
    throw new Error('LOA_REJECTED: Registry-confirmed 7-digit SKY matric is mandatory.');
  }
  if(!String(a['Personal Email']||'').trim()){
    throw new Error('LOA_REJECTED: Student email is unavailable.');
  }
  // Workflow's SKY ID may be blank while ACC Supabase holds Registry's
  // confirmation. If populated, it MUST NOT conflict with that confirmation.
  const previouslyRecorded=String(w['SKY Student ID']||'').trim();
  if(previouslyRecorded&&previouslyRecorded!==matric){
    throw new Error('LOA_REJECTED: SKY matric conflict between ACC and workflow.');
  }
  if(['ISSUED','SENT'].includes(String(w['Offer Letter Status']||'').toUpperCase()) ||
     String(w['Offer Letter PDF URL']||'').trim() ||
     String(w['Offer Letter Issued At']||'').trim()){
    throw new Error('LOA_REJECTED: Already issued; open existing PDF.');
  }
  return Object.freeze({
    referenceNo:ref,
    matricNo:matric,
    applicantEmail:String(a['Personal Email']).trim(),
    originalStage:String(w['Application Stage']||'').trim(),
    // SAC/IA/Prerequisite stage is deliberately never an eligibility gate.
    verified:true
  });
}
function v2LoaUnifiedAssertSacPreserved_(before, after){
  const keys=['Application Stage','SAC Decision','IA Status','Prerequisite Status'];
  for(const key of keys){
    if(String((before||{})[key]||'')!==String((after||{})[key]||'')){
      throw new Error('LOA_INTEGRITY: Issuance modified '+key+'. This is forbidden.');
    }
  }
  return true;
}
function v2LoaUnifiedVerifyFourAttachments_(attachments, expectedNames){
  const blobs=attachments||[],names=expectedNames||[];
  if(blobs.length!==4||names.length!==4)throw new Error('LOA_ATTACHMENTS: Exactly 4 PDFs required.');
  for(let i=0;i<4;i++){
    const item=blobs[i],name=item&&typeof item.getName==='function'?item.getName():String(item&&item.name||'');
    if(name!==names[i]||!name.toLowerCase().endsWith('.pdf'))throw new Error('LOA_ATTACHMENTS: PDF #'+(i+1)+' missing or misnamed.');
  }
  return true;
}
