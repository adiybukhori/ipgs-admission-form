// Offline regression tests for the isolated Apps Script LOA policy.
// Run: node scripts/test-loa-v2-single-policy.mjs
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
const src=readFileSync(new URL('../apps-script/LOA_V2_SINGLE_POLICY.js',import.meta.url),'utf8');
const sandbox={};runInNewContext(src,sandbox,{timeout:1500});
const gate=sandbox.v2LoaUnifiedGate_;
const checkStage=sandbox.v2LoaUnifiedAssertSacPreserved_;
const checkFiles=sandbox.v2LoaUnifiedVerifyFourAttachments_;
const ref='IUC-ADM-V2-20261126-TEST0001';
const base={issuanceBasis:'REGISTRY_CONFIRMED_SKY_MATRIC',source:'ACC_APPLICATIONS',skyStudentId:'2601001'};
const app={'Personal Email':'nonstudent@example.invalid'};
for(const stage of ['READY_FOR_SAC','INTERNAL_ASSESSMENT','PREREQUISITE','ELIGIBLE_FOR_OFFER']){
  assert.equal(gate(ref,base,{'Application Stage':stage},app).originalStage,stage);
}
assert.throws(()=>gate(ref,{...base,skyStudentId:''},{'Application Stage':'ELIGIBLE_FOR_OFFER'},app),/7-digit/);
assert.throws(()=>gate(ref,{...base,source:'ORCHESTRATOR'}, {},app),/Only Registry-confirmed/);
assert.throws(()=>gate(ref,base,{'Offer Letter Status':'ISSUED'},app),/Already issued/);
assert.throws(()=>gate(ref,base,{'SKY Student ID':'2509002'},app),/matric conflict/);
const before={'Application Stage':'READY_FOR_SAC','SAC Decision':'PENDING','IA Status':'PENDING'};
assert.equal(checkStage(before,{...before,'Offer Letter Status':'ISSUED'}),true);
assert.throws(()=>checkStage(before,{...before,'Application Stage':'OFFER_ISSUED'}),/forbidden/);
const files=['LOA_MBA_TEST.pdf','Acceptance_EN_MBA_TEST.pdf','Surat_Penerimaan_MBA_TEST.pdf','Surat_Akuan_MBA_TEST.pdf'];
const blobs=files.map(n=>({getName:()=>n}));
assert.equal(checkFiles(blobs,files),true);
assert.throws(()=>checkFiles(blobs.slice(0,3),files),/Exactly 4 PDFs/);
console.log('PASS: 4 pending/approved stages, missing matric, non-ACC origin, duplicate issue, ID conflict, SAC preservation, four PDFs.');
