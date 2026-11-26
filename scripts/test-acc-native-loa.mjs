// ACC native LOA regression — no Google APIs, student data or email are touched.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const native=readFileSync(new URL('../lib/loa-native.js',import.meta.url),'utf8')
  .replace("import { randomUUID } from 'node:crypto';","const randomUUID=()=> 'synthetic-id';")
  .replace(/export (const|function|async function)/g,'$1');
const email=readFileSync(new URL('../lib/loa-v1-email.js',import.meta.url),'utf8')
  .replace(/export \{[^}]+\};/g,'');
const context={process:{env:{}},URLSearchParams,Intl,Date,RegExp,String,Object,Array,JSON};
runInNewContext(native+'\n'+email,context,{timeout:2000});
const app={'Student Folder URL':'https://drive.google.com/drive/folders/1SyntheticTest',
  'Student Name':'SYNTHETIC UAT','Personal Email':'uat@example.invalid',
  'ID / Passport No':'TEST-001','Programme':'MBA - Master of Business Administration',
  'Intake':'January 2027'};
const verify=context.accNativeLoaValidate;
for(const stage of ['READY_FOR_SAC','INTERNAL_ASSESSMENT','PREREQUISITE','ELIGIBLE_FOR_OFFER']){
  assert.equal(verify({referenceNo:'IUC-ADM-UAT-0001',matricNo:'2601001',application:app,
    workflow:{'Application Stage':stage}}).code,'MBA');
}
assert.throws(()=>verify({referenceNo:'IUC-ADM-UAT-0001',matricNo:'123',
  application:app,workflow:{}}),/seven-digit/);
assert.throws(()=>verify({referenceNo:'IUC-ADM-UAT-0001',matricNo:'2601001',
  application:app,workflow:{'Offer Letter Status':'ISSUED'}}),/already issued/);
assert.equal(context.accNativeLoaReadiness({}).ready,false);
const result=context.v2LoaV1MailContract_(app.Programme,'2601001','MBA',app['ID / Passport No']);
assert.equal(result.attachmentNames.length,4);
assert.ok(result.body.includes('Student Matrix No.: 2601001'));
console.log('ACC native LOA: PASS — 4 SAC/IA/PR scenarios, invalid matric, duplicate, offline-safe gate and four PDFs.');
