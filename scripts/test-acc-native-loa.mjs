// ACC native LOA regression — no Google APIs, student data or email are touched.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {URL} from 'node:url';
const native=readFileSync(new URL('../lib/loa-native.js',import.meta.url),'utf8')
  .replace(/^import .*;$/gm,'')
  .replace(/^/,'const randomUUID=()=> "synthetic-id";\n')
  .replace(/export (const|function|async function)/g,'$1');
const email=readFileSync(new URL('../lib/loa-v1-email.js',import.meta.url),'utf8')
  .replace(/export \{[^}]+\};/g,'');
const htmlTemplate=readFileSync(new URL('../lib/loa-v1-html.js',import.meta.url),'utf8')
  .replace('export function renderLegacyLoaHtml','function renderLegacyLoaHtml');
const premium=readFileSync(new URL('../lib/loa-premium-email.js',import.meta.url),'utf8')
  .replace(/export function /g,'function ');
const context={process:{env:{}},URL,URLSearchParams,Intl,Date,RegExp,String,Object,Array,JSON};
runInNewContext(native+'\n'+email+'\n'+htmlTemplate+'\n'+premium,context,{timeout:2000});
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
const html=context.renderLegacyLoaHtml(app.Programme,'2601001');
assert.ok(html.includes('<ol>'),'Original numbered list missing');
assert.ok(html.includes('<b>Official Offer Letter</b>'),'Original document bold missing');
assert.ok(html.includes('href="https://innovative.vialing.com/sp/login"'),'Original portal hyperlink missing');
assert.ok(html.includes('2601001')&&!html.includes('{{'),'Template placeholders remain');
const previewOptions={studentName:'UAT TEST STUDENT',programme:app.Programme,
  matricNo:'2601001',intake:'January 2027',preview:true,
  acceptanceUrl:'https://ipgs-admission-form.innovative.edu.my/acceptance-demo.html'};
const premiumHtml=context.renderPremiumLoaHtml(previewOptions);
assert.ok(premiumHtml.includes('NEXT STEP')&&premiumHtml.includes('Preview Acceptance Portal'));
assert.ok(premiumHtml.includes('Open Student Portal')&&premiumHtml.includes('Join WhatsApp Community'));
assert.ok(premiumHtml.includes('Apply for Physical Student ID Card'));
assert.ok(premiumHtml.includes('Access the IUC Student Portal'),'Student Portal section missing');
assert.ok(premiumHtml.includes('YOUR STUDENT ACCOUNT'),'Portal account heading missing');
assert.ok(premiumHtml.includes('Initial Password:'),'Portal login instructions missing');
assert.ok(premiumHtml.includes('2699999')===false,'Synthetic preview must use test matric 2601001');
assert.ok(premiumHtml.includes('Join the Official WhatsApp Community'),'WhatsApp action missing');
assert.ok(premiumHtml.includes('orientation updates, class information'),'Original WhatsApp explanation missing');
assert.ok(premiumHtml.includes('Students who require a physical Student ID Card'),'Original ID card explanation missing');
assert.ok(premiumHtml.includes('OPTIONAL STUDENT SERVICE'),'Optional physical card label missing');
assert.ok(premiumHtml.includes('Open Physical Student ID Card Application'),'Physical card action missing');
assert.ok(!premiumHtml.includes('Student essentials'),'Old button strip still present');
assert.equal((premiumHtml.match(/<h3 /g)||[]).length,3,'Must show exactly three service cards');
assert.ok(!premiumHtml.includes('xvVDEnnt9Fq4jAKp7'),'Manual Acceptance Form must not be linked');
assert.throws(()=>context.renderPremiumLoaHtml({...previewOptions,preview:false,
  acceptanceUrl:'https://script.google.com/macros/s/AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB/exec?page=acceptance-v2'}),/token/);
const liveHtml=context.renderPremiumLoaHtml({...previewOptions,preview:false,
  acceptanceUrl:'https://script.google.com/macros/s/AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB/exec?page=acceptance-v2&token='+'a'.repeat(64)});
assert.ok(liveHtml.includes('Complete Online Acceptance'));
assert.ok(!liveHtml.includes('UAT DESIGN PREVIEW'));
console.log('ACC native LOA: PASS — 4 SAC/IA/PR scenarios, invalid matric, duplicate, offline-safe gate four PDFs, online Acceptance and CTA buttons.');
