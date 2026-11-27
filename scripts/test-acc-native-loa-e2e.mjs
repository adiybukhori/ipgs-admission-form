// Synthetic end-to-end native issuance. All network calls are intercepted.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {issueAccNativeLoa} from '../lib/loa-native.js';
import {renderLegacyLoaEmail} from '../lib/loa-v1-email.js';
import {accResolveCoordinator,PROGRAMME_COORDINATOR_SEEDS} from '../lib/acc-programme-directory.js';
const reference='IUC-ADM-UAT-ONLY', matric='2699999';
const app={'Student Name':'SYNTHETIC TEST ONLY','Personal Email':'uat@example.invalid',
  'ID / Passport No':'TEST001',Programme:'MBA - Master of Business Administration',Intake:'January 2027',
  'Study Mode':'Full Time','Raw Application JSON':JSON.stringify({fullAddress:'Fictional Test Address'}),
  'Student Folder URL':'https://drive.google.com/drive/folders/SYNTHETICFOLDER'};
const env={VERCEL_ENV:'production',ACC_LOA_GOOGLE_CLIENT_ID:'mock',ACC_LOA_GOOGLE_CLIENT_SECRET:'mock',
 ACC_LOA_GOOGLE_REFRESH_TOKEN:'mock',ACC_LOA_SENDER_EMAIL:'registry@example.invalid',
 ACC_LOA_CC_ROUTING_JSON:'{"MBA":["registry-test@example.invalid"]}',SUPABASE_URL:'https://mock.invalid',
 SUPABASE_SERVICE_ROLE_KEY:'mock',ACC_LOA_NATIVE_READY:'true',ACC_LOA_LEGACY_CREDENTIAL_TEXT_APPROVED:'true',
 ACC_LOA_ACCEPTANCE_BACKEND_READY:'true'};
const fields=['Reference No','Application Stage','SAC Decision','Offer Letter Status','Offer Letter PDF URL',
 'Offer Letter Issued At','Offer Email Status','Offer Email Sent At','Offer Letter Remarks',
 'Acceptance Token Hash','Acceptance Signing URL','Acceptance Status'];
let claim=false, copies=0, exports=0, uploads=0, sends=0, sheetWrites=0, ledger=[], sheet={}, missing=false, failMail=false;
const pdf=Buffer.concat([Buffer.from('%PDF-1.7\n'),Buffer.alloc(1500,32)]);
const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
const realFetch=globalThis.fetch;
globalThis.fetch=async(url,opts={})=>{
 const u=String(url),method=opts.method||'GET';
 const body=typeof opts.body==='string'?JSON.parse(opts.body.startsWith('{')||opts.body.startsWith('[')?opts.body:'null'):null;
 if(u.includes('oauth2.googleapis.com/token'))return json({access_token:'FAKE_TOKEN'});
 if(u.includes('sheets.googleapis.com')&&method==='GET'){
   const h=missing?fields.filter(x=>x!=='Acceptance Token Hash'):fields;
   return json({values:[h,h.map(k=>k==='Reference No'?reference:k==='Application Stage'?'READY_FOR_SAC':k==='SAC Decision'?'PENDING':sheet[k]||'')]});
 }
 if(u.includes('sheets.googleapis.com')&&method==='POST'){
   sheetWrites++;for(const d of body.data){const col=d.range.match(/!([A-Z]+)\d+$/)[1];let n=0;for(const c of col)n=n*26+c.charCodeAt(0)-64;sheet[fields[n-1]]=d.values[0][0];}
   assert.equal(sheet['Application Stage'],undefined);assert.equal(sheet['SAC Decision'],undefined);
   return json({totalUpdatedCells:body.data.length});
 }
 if(u.includes('mock.invalid/rest/v1/acc_loa_issuance')){
   if(method==='POST'){if(claim)return json([]);claim=true;ledger.push('PREPARING');return json([{reference_no:reference}]);}
   if(method==='PATCH'){ledger.push(body.status);return json([body]);}
 }
 if(u.includes('drive/v3/files/')&&u.includes('/copy?'))return json({id:'temporary'+(++copies)});
 if(u.includes('docs.googleapis.com')&&method==='POST')return json({replies:[]});
 if(u.includes('/export?')){exports++;return new Response(pdf);}
 if(u.includes('/upload/drive/v3/files')){uploads++;return json({id:'file'+uploads,webViewLink:'https://drive.google.com/file/d/file'+uploads+'/view'});}
 if(u.includes('drive/v3/files/')&&method==='DELETE')return new Response(null,{status:204});
 if(u.includes('gmail.googleapis.com')&&method==='POST'){
   sends++;
   assert.equal(sheet['Offer Letter Status'],'ISSUED','Portal must work before sending.');
   const raw=Buffer.from(body.raw,'base64url').toString('utf8');
   assert.match(raw,/To: uat@example\.invalid/);
   assert.equal((raw.match(/Content-Type: application\/pdf;/g)||[]).length,4);
   assert.match(raw,/Content-Type: text\/html/);
   const token=new URL(sheet['Acceptance Signing URL']).searchParams.get('token');
   assert.match(token,/^[a-f0-9]{64}$/);
   assert.equal(createHash('sha256').update(token).digest('hex'),sheet['Acceptance Token Hash']);
   if(failMail)return json({error:{message:'simulated Gmail failure'}},503);
   return json({id:'mock-msg'});
 }
 throw Error('Unexpected network call blocked: '+u);
};
const input={referenceNo:reference,matricNo:matric,application:app,workflow:{'Application Stage':'READY_FOR_SAC'},
 coordinator:accResolveCoordinator(app.Programme,PROGRAMME_COORDINATOR_SEEDS),emailContract:renderLegacyLoaEmail,env};
try{
 const result=await issueAccNativeLoa(input);
 assert.equal(result.emailSent,true);assert.equal(result.attachmentCount,4);
 assert.deepEqual([copies,exports,uploads,sends,sheetWrites],[4,4,4,1,2]);
 assert.deepEqual(ledger,['PREPARING','PDFS_READY','SENDING','SENT']);
 assert.equal(sheet['Offer Email Status'],'LIVE_SENT_1');
 await assert.rejects(()=>issueAccNativeLoa(input),/already claimed/);
 assert.equal(sends,1);
 claim=false;missing=true;
 await assert.rejects(()=>issueAccNativeLoa(input),/column missing/);
 assert.equal(claim,false);assert.equal(copies,4);assert.equal(sends,1);
 missing=false;failMail=true;ledger=[];
 await assert.rejects(()=>issueAccNativeLoa(input),/manual review/);
 assert.equal(ledger.at(-1),'REVIEW_REQUIRED');assert.equal(sends,2);
 await assert.rejects(()=>issueAccNativeLoa(input),/already claimed/);
 assert.equal(sends,2);
 await assert.rejects(()=>issueAccNativeLoa({...input,env:{...env,ACC_LOA_ACCEPTANCE_BACKEND_READY:''}}),/not configured/);
 assert.equal(sends,2);
 console.log('PASS: synthetic complete native issuance, 4 PDF copy/export/upload, MIME, token before Gmail, SAC untouched, duplicate block, missing column block, failed delivery review, readiness gate. NO REAL NETWORK OR MAIL.');
}finally{globalThis.fetch=realFetch;}
