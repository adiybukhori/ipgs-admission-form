const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),assert=require('assert');
const token='a'.repeat(64);
const helper=fs.readFileSync('apps-script-v2/LoaRepairV2.js','utf8').replace(/const V2_LOA_SERVICE_TOKEN_SHA256 = '[^']+';/,"const V2_LOA_SERVICE_TOKEN_SHA256 = '"+crypto.createHash('sha256').update(token).digest('hex')+"';");
const wrapper=fs.readFileSync('tools/loa-issuer-wrapper.js','utf8');
function fixture(){
  const props=new Map(),w={'Application Stage':'ELIGIBLE_FOR_OFFER','Offer Letter Status':'NOT_ISSUED'},a={'Programme':'MBA + PhD','Personal Email':'student@example.test'};
  const counts={prepare:0,pdf:0,send:0,release:0};
  const c={counts,w,a,props,console,V2_OFFER_WORKFLOW_HEADERS:[],assertDevIdentity_:()=>{},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},computeDigest:(_,s)=>[...crypto.createHash('sha256').update(s).digest()]},LockService:{getScriptLock:()=>({waitLock:()=>{},releaseLock:()=>counts.release++})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},v2Find_:(sheet)=>({record:sheet==='V2_WORKFLOW'?w:a,sheet:{}}),v2OfferEnsureHeaders_:()=>{},v2PrepareOffer_:()=>{counts.prepare++;if(w['Application Stage']!=='ELIGIBLE_FOR_OFFER')throw Error('ineligible');w['Acceptance Signing URL']='secure-test-link';return {acceptanceSigningUrl:w['Acceptance Signing URL']};},v2GenerateOfferLetter_:()=>{counts.pdf++;Object.assign(w,{'Offer Letter Status':'ISSUED','Offer Letter PDF URL':'pdf-one','Offer Programme':'Master of Business Administration (MBA)','Application Stage':'OFFER_ISSUED'});return {offerLetterStatus:'ISSUED',applicationStage:'OFFER_ISSUED',offerLetterPdfUrl:'pdf-one',pdfFileId:'pdf-one'};},v2OfferExtractDriveId_:s=>s,v2AcceptancePackEnsureReviewDocs_:()=>({status:'READY',documents:[1,2,3,4]}),v2NotificationMode_:()=> 'LIVE',v2NotificationTestRecipient_:()=> 'other-test@example.test',v2OfferHashToken_:s=>crypto.createHash('sha256').update(s).digest('hex'),v2SendOfferEmail_:(_,url,pdf,opts)=>{counts.send++;return {sent:true,mode:opts.testMode?'TEST':'LIVE',status:'SENT',recipient:opts.testRecipient||a['Personal Email']};},v2NotificationUpdateWorkflow_:(_,updates)=>Object.assign(w,updates)};
  vm.createContext(c);vm.runInContext(helper+'\n'+wrapper,c);return c;
}
let c=fixture();
assert.equal(c.v2CurrentOfferProgramme_('MBA + PhD'),'Master of Business Administration (MBA)');
assert.equal(c.v2CurrentOfferProgramme_('PhD - Doctor of Philosophy in Management'),'PhD - Doctor of Philosophy in Management');
assert.equal(c.v2CurrentOfferProgramme_('MBA - Master of Business Administration'),'MBA - Master of Business Administration');
assert.equal(c.v2VerifyLoaServiceAccess_(token,'v2IssueOffer'),true);
assert.equal(c.v2VerifyLoaServiceAccess_(token,'v2RecordSacDecision'),false);
assert.equal(c.v2VerifyLoaServiceAccess_('invalid','v2IssueOffer'),false);
assert.throws(()=>c.v2AssertCurrentAwardDocument_({getText:()=> 'MBA and PhD'},'MBA + PhD'));
c.v2AssertCurrentAwardDocument_({getText:()=> 'Master of Business Administration (MBA)'},'MBA + PhD');
let first=c.v2IssueOffer_('TEST','Registry',{testMode:true,testRecipient:'adiybukhori.ipgs@innovative.edu.my'});
let second=c.v2IssueOffer_('TEST','Registry',{testMode:true,testRecipient:'adiybukhori.ipgs@innovative.edu.my'});
assert.equal(first.emailRecipient,'adiybukhori.ipgs@innovative.edu.my');assert.equal(second.duplicateEmailSuppressed,true);assert.equal(c.counts.prepare,1);assert.equal(c.counts.pdf,1);assert.equal(c.counts.send,1);assert.equal(second.acceptanceSigningUrl,first.acceptanceSigningUrl);
assert.throws(()=>c.v2IssueOffer_('TEST','Registry',{testMode:true,testRecipient:'student@example.test'}));
c=fixture();c.v2SendOfferEmail_=()=>{c.counts.send++;throw Error('delivery connection lost');};
assert.throws(()=>c.v2IssueOffer_('TEST','Registry',{}),/verification/);
assert.throws(()=>c.v2IssueOffer_('TEST','Registry',{}),/resend was blocked/);assert.equal(c.counts.send,1);assert.equal(c.counts.release,2);
c=fixture();c.w['Application Stage']='SAC_REVIEW';assert.throws(()=>c.v2IssueOffer_('TEST','Registry',{}),/ineligible/);assert.equal(c.counts.send,0);
console.log('LOA_REPAIR_TESTS_OK: MBA-only, standalone programmes, narrow authentication, duplicate PDF/link/email, uncertainty guard, eligibility gate, exact test inbox');
