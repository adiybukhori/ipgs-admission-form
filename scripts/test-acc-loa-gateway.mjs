import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHmac,createHash} from 'node:crypto';
import {makeAccGatewayEnvelope} from '../lib/loa-gateway.js';
import {issueAccNativeLoa,accNativeLoaReadiness} from '../lib/loa-native.js';
import {renderLegacyLoaEmail} from '../lib/loa-v1-email.js';
import {accResolveCoordinator,PROGRAMME_COORDINATOR_SEEDS} from '../lib/acc-programme-directory.js';
const secret='a'.repeat(64),now=Date.now();
const ctx=vm.createContext({Utilities:{Charset:{UTF_8:'UTF-8'},computeHmacSha256Signature:(s,k)=>Array.from(createHmac('sha256',k).update(s).digest())}});
vm.runInContext(readFileSync('gateway/acc-loa/Code.gs','utf8'),ctx);
const signed=makeAccGatewayEnvelope({op:'health'},secret,now,'b'.repeat(32));
assert.equal(ctx.gwAuth_(signed,secret,now).op,'health');
assert.throws(()=>ctx.gwAuth_({...signed,payload:'{"op":"send"}'},secret,now),/Invalid authentication/);
assert.throws(()=>ctx.gwAuth_(signed,secret,now+121000),/Invalid authentication envelope/);
assert.throws(()=>ctx.gwAuth_(makeAccGatewayEnvelope({op:'deleteAll'},secret,now),secret,now),/Unsupported operation/);
const env={VERCEL_ENV:'production',ACC_LOA_TRANSPORT:'gateway',ACC_LOA_GATEWAY_URL:'https://script.google.com/macros/s/SYNTHETIC/exec',ACC_LOA_GATEWAY_SECRET:secret,ACC_LOA_GATEWAY_READY:'true',ACC_LOA_SENDER_EMAIL:'ipgs.admission@innovative.edu.my',ACC_LOA_CC_ROUTING_JSON:'{"MBA":[]}',SUPABASE_URL:'https://mock.invalid',SUPABASE_SERVICE_ROLE_KEY:'mock',ACC_LOA_NATIVE_READY:'true',ACC_LOA_LEGACY_CREDENTIAL_TEXT_APPROVED:'true',ACC_LOA_ACCEPTANCE_BACKEND_READY:'true'};
assert.equal(accNativeLoaReadiness(env).ready,true);
assert.equal(accNativeLoaReadiness({...env,ACC_LOA_GATEWAY_READY:'false'}).ready,false);
assert.equal(accNativeLoaReadiness({...env,ACC_LOA_SENDER_EMAIL:'wrong@example.invalid'}).ready,false);
assert.equal(accNativeLoaReadiness({...env,ACC_LOA_GATEWAY_SECRET:''}).ready,false);
const app={'Student Name':'SYNTHETIC TEST ONLY','Personal Email':'uat@example.invalid','ID / Passport No':'TEST001',Programme:'MBA - Master of Business Administration',Intake:'January 2027','Study Mode':'Full Time','Raw Application JSON':JSON.stringify({fullAddress:'Fictional Test Address'}),'Student Folder URL':'https://drive.google.com/drive/folders/SYNTHETICFOLDER'};
const input={referenceNo:'IUC-ADM-UAT-ONLY',matricNo:'2699999',application:app,workflow:{'Application Stage':'READY_FOR_SAC'},coordinator:accResolveCoordinator(app.Programme,PROGRAMME_COORDINATOR_SEEDS),emailContract:renderLegacyLoaEmail,env};
let claimed=false,steps=[],ledger=[],wf={},failSend=false;
const realFetch=globalThis.fetch;
const json=x=>new Response(JSON.stringify(x));
globalThis.fetch=async(url,opts)=>{
 if(url.startsWith('https://mock.invalid/')){
  const b=JSON.parse(opts.body||'null');
  if(opts.method==='POST'){if(claimed)return json([]);claimed=true;ledger.push('PREPARING');return json([{}]);}
  ledger.push(b.status);return json([b]);
 }
 assert.equal(url,env.ACC_LOA_GATEWAY_URL);
 const envelope=JSON.parse(opts.body),p=ctx.gwAuth_(envelope,secret,Date.now());
 assert.equal(p.referenceNo,input.referenceNo);assert.equal(p.folderId,'SYNTHETICFOLDER');
 steps.push(p.op);
 if(p.op==='pdf')return json({ok:true,data:{id:'pdf'+steps.length,name:p.name,url:'https://drive.google.com/file/d/pdf'+steps.length+'/view'}});
 if(p.op==='write'){assert.ok(!Object.hasOwn(p.fields,'Application Stage'));Object.assign(wf,p.fields);return json({ok:true,data:{written:true}});}
 if(p.op==='send'){
  assert.equal(wf['Offer Letter Status'],'ISSUED');
  assert.equal(p.recipient,app['Personal Email']);assert.equal(p.files.length,4);
  assert.ok(p.html.includes('Complete Online Acceptance'));
  const token=new URL(wf['Acceptance Signing URL']).searchParams.get('token');
  assert.equal(createHash('sha256').update(token).digest('hex'),wf['Acceptance Token Hash']);
  return failSend?json({ok:false}):json({ok:true,data:{id:'mock-msg'}});
 }
 return json({ok:true,data:{ready:true}});
};
try{
 const r=await issueAccNativeLoa(input);assert.equal(r.emailSent,true);assert.equal(r.attachmentCount,4);
 assert.deepEqual(steps,['preflight','pdf','pdf','pdf','pdf','write','send','write']);
 assert.deepEqual(ledger,['PREPARING','PDFS_READY','SENDING','SENT']);
 await assert.rejects(()=>issueAccNativeLoa(input),/already claimed/);
 assert.equal(steps.filter(x=>x==='send').length,1);
 claimed=false;failSend=true;steps=[];ledger=[];
 await assert.rejects(()=>issueAccNativeLoa(input),/manual review/);assert.equal(ledger.at(-1),'REVIEW_REQUIRED');
 await assert.rejects(()=>issueAccNativeLoa(input),/already claimed/);assert.equal(steps.filter(x=>x==='send').length,1);
 console.log('PASS: signed gateway contract, tampered/expired/unsupported request blocked, readiness, 4 PDFs, token before send, duplicate ledger, uncertain send review. Synthetic only.');
}finally{globalThis.fetch=realFetch;}
