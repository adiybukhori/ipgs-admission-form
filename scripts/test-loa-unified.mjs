import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const legacy=readFileSync(new URL('../apps-script/LOA_V1_PARITY_CONTRACT.js',import.meta.url),'utf8');
const unified=readFileSync(new URL('../apps-script/LOA_UNIFIED_V2_UAT.js',import.meta.url),'utf8');
const policy=readFileSync(new URL('../apps-script/LOA_V2_SINGLE_POLICY.js',import.meta.url),'utf8');
let mail=[],updates=[];
const workflow={
  'Offer Letter Status':'NOT_ISSUED','LOA Registry Matric No':'2601001',
  'Acceptance Review PDF URL':'https://drive.google.com/file/d/acceptance-test/view',
  'Surat Penerimaan Review PDF URL':'https://drive.google.com/file/d/penerimaan-test/view',
  'Surat Akuan Review PDF URL':'https://drive.google.com/file/d/akuan-test/view'
};
const application={
  'Programme':'MBA - Master of Business Administration',
  'ID / Passport No':'TEST001','Personal Email':'real-student-not-for-testing@example.invalid'
};
const state={enabled:true,mode:'TEST',alias:true};
const sandbox={
  PropertiesService:{getScriptProperties:()=>({getProperty:()=>state.enabled?'true':null})},
  v2NotificationEnsureHeaders_:()=>{},
  v2Find_:sheet=>sheet==='V2_WORKFLOW'?{record:workflow}:{record:application},
  v2CurrentOfferProgramme_:v=>v,
  v2OfferProgrammeCode_:()=> 'MBA',
  v2AssessmentNormalizeCredential_:()=> 'TEST001',
  v2OfferExtractDriveId_:url=>(url.match(/\/d\/([^/]+)/)||[])[1]||'',
  DriveApp:{getFileById:id=>({getAs:mime=>({setName:name=>({id,name,mime})})})},
  MimeType:{PDF:'application/pdf'},
  v2NotificationMode_:()=>state.mode,
  V2_LOA_TEST_RECIPIENT:'registry-test@example.invalid',
  v2NotificationTestRecipient_:()=> 'registry-test@example.invalid',
  Session:{getEffectiveUser:()=>({getEmail:()=>state.alias?'registry@innovative.edu.my':'other@example.invalid'})},
  GmailApp:{getAliases:()=>[],sendEmail:(...args)=>mail.push(args)},
  v2NotificationUpdateWorkflow_:(...args)=>updates.push(args),
  v2Audit_:()=>{}
};
runInNewContext(legacy+'\n'+policy+'\n'+unified+'\nthis.issuer={gate:v2LoaRegistryMatric_,send:v2SendOfferNotificationUnified_};',sandbox);
const {gate,send}=sandbox.issuer;
assert.equal(gate('IUC-ADM-V2-TEST',{skyStudentId:'2601001',issuanceBasis:'REGISTRY_CONFIRMED_SKY_MATRIC',source:'ACC_APPLICATIONS'}),'2601001');
assert.throws(()=>gate('IUC-ADM-V2-TEST',{skyStudentId:'2601001',issuanceBasis:'SAC_APPROVED'}),/matric/);
assert.throws(()=>gate('IUC-ADM-V2-TEST',{skyStudentId:'1234',issuanceBasis:'REGISTRY_CONFIRMED_SKY_MATRIC',source:'ACC_APPLICATIONS'}),/matric/);
state.enabled=false;
assert.throws(()=>gate('IUC-ADM-V2-TEST',{skyStudentId:'2601001',issuanceBasis:'REGISTRY_CONFIRMED_SKY_MATRIC',source:'ACC_APPLICATIONS'}),/disabled/);
state.enabled=true;
assert.throws(()=>send('IUC-ADM-V2-TEST','https://test.invalid/accept','loa-file',{testMode:true,testRecipient:'someone-else@example.invalid'}),/non-test recipient/);
assert.equal(mail.length,0);
workflow['Offer Letter Status']='ISSUED';
const result=send('IUC-ADM-V2-TEST','https://test.invalid/accept','loa-file',{testMode:true,testRecipient:'registry-test@example.invalid'});
assert.equal(result.sent,true);
assert.equal(result.attachmentCount,4);
assert.equal(result.mode,'TEST');
assert.equal(mail.length,1);
assert.equal(mail[0][0],'registry-test@example.invalid');
assert.equal(mail[0][1],'[Registry] Letter of Admission – Master of Business Administration');
assert.ok(mail[0][2].includes('Student Matrix No.: 2601001'));
assert.equal(mail[0][3].attachments.length,4);
assert.equal(mail[0][3].cc,undefined);
assert.deepEqual(Array.from(mail[0][3].attachments,x=>x.name),[
  'LOA_MBA_TEST001.pdf','Acceptance_EN_MBA_TEST001.pdf',
  'Surat_Penerimaan_MBA_TEST001.pdf','Surat_Akuan_MBA_TEST001.pdf'
]);
assert.equal(updates.at(-1)[1]['Offer Email Status'],'TEST_SENT_1');
workflow['Surat Akuan Review PDF URL']='';
assert.throws(()=>send('IUC-ADM-V2-TEST','https://test.invalid/accept','loa-file',{testMode:true,testRecipient:'registry-test@example.invalid'}),/Missing V1-compatible/);
workflow['Surat Akuan Review PDF URL']='https://drive.google.com/file/d/akuan-test/view';
state.mode='LIVE';
state.alias=false;
assert.throws(()=>send('IUC-ADM-V2-TEST','https://test.invalid/accept','loa-file',{}),/sender alias/);
assert.equal(mail.length,1);
console.log('PASS: Registry matric, single authorised test recipient, four PDFs, no test CC, sender alias and fail-closed checks.');
