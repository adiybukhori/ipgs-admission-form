// Deterministic LOA safety regression. No network, email or student records.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const dir=readFileSync(new URL('../lib/acc-programme-directory.js',import.meta.url),'utf8').replace(/^export (const|function) /gm,'$1 ');
const email=readFileSync(new URL('../lib/loa-premium-email.js',import.meta.url),'utf8')
 .replace(/^import .*;$/gm,'').replace(/^export function /gm,'function ');
const native=readFileSync(new URL('../lib/loa-native.js',import.meta.url),'utf8')
 .replace(/^import .*;$/gm,'').replace(/^export (const|function|async function) /gm,'$1 ');
const context={URL,process:{env:{}},Buffer};
runInNewContext(dir+'\n'+email+'\n'+native+'\nthis.api={PROGRAMME_COORDINATOR_SEEDS,accValidateDirectoryRow,accResolveCoordinator,accNativeLoaValidate,renderPremiumLoaHtml};',
context,{timeout:3000});
const x=context.api;
const application={
  Programme:'MBA - Master of Business Administration','Student Name':'SYNTHETIC UAT',
  'Personal Email':'uat@example.invalid','Study Mode':'Full Time',Intake:'January 2027',
  'ID / Passport No':'UATTEST001','Raw Application JSON':JSON.stringify({fullAddress:'UAT Test Address Kuala Lumpur'}),
  'Student Folder URL':'https://drive.google.com/drive/folders/UATFOLDER'
};
const base={referenceNo:'IUC-ADM-UAT-001',matricNo:'2699999',application,workflow:{}};
for(const stage of ['READY_FOR_SAC','INTERNAL_ASSESSMENT','PREREQUISITE','ELIGIBLE_FOR_OFFER']){
  assert.equal(x.accNativeLoaValidate({...base,workflow:{'Application Stage':stage}}).code,'MBA');
}
for(const key of ['Student Name','Personal Email','Study Mode','ID / Passport No','Raw Application JSON','Student Folder URL']){
  assert.throws(()=>x.accNativeLoaValidate({...base,application:{...application,[key]:''}}),/blocked/);
}
assert.throws(()=>x.accNativeLoaValidate({...base,matricNo:''}),/matric/);
assert.throws(()=>x.accNativeLoaValidate({...base,workflow:{'Offer Letter Status':'ISSUED'}}),/already issued/);
const seed=x.PROGRAMME_COORDINATOR_SEEDS;
assert.equal(x.accResolveCoordinator(application.Programme,seed).email,'naqiyuddin.ipgs@innovative.edu.my');
assert.throws(()=>x.accResolveCoordinator('NEWP - New Programme',seed),/no configured coordinator/);
assert.throws(()=>x.accResolveCoordinator(application.Programme,[{...seed[1],is_active:false}]),/inactive/);
assert.throws(()=>x.accValidateDirectoryRow({
 programme_code:'NEWP',programme_name:'New Programme',level:'Master',
 coordinator_name:'',coordinator_email:'',coordinator_role:'',is_active:true
},{allowIncomplete:true}),/Cannot activate/);
assert.throws(()=>x.accResolveCoordinator('DBA ODL - Diploma in Business Administration',seed),/no configured coordinator/);
assert.throws(()=>x.accResolveCoordinator('MBA - Unapproved Title',seed),/does not match/);
assert.throws(()=>x.accValidateDirectoryRow({
 ...seed[6],programme_name:'Diploma in Business Administration ODL'
}),/outside IPGS/);
const newProgramme={programme_code:'NEWP',programme_name:'New Programme',level:'Master',
  coordinator_name:'Test Coordinator',coordinator_email:'test.coordinator@innovative.edu.my',
  coordinator_role:'Programme Coordinator',is_active:true};
assert.equal(x.accResolveCoordinator('NEWP - New Programme',[newProgramme]).name,'Test Coordinator');
const preview={programme:application.Programme,studentName:'SYNTHETIC UAT',
 matricNo:'2699999',intake:application.Intake,studyMode:'Full Time',
 preview:true,acceptanceUrl:'https://ipgs-admission-form.innovative.edu.my/acceptance-demo.html'};
const html=x.renderPremiumLoaHtml(preview);
assert.ok(html.includes('IPGS_Official_Email_Header.jpg'));
assert.ok(!html.includes('bgcolor="#2D2363"'));
assert.ok(html.indexOf('Congratulations on your admission!')>html.indexOf('IPGS_Official_Email_Header.jpg'));
const secureLink='https://script.google.com/macros/s/AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB/exec?page=acceptance-v2&token='+'x'.repeat(64);
assert.throws(()=>x.renderPremiumLoaHtml({...preview,preview:false,acceptanceUrl:secureLink}),/coordinator/);
const full=x.renderPremiumLoaHtml({...preview,preview:false,acceptanceUrl:secureLink,
 coordinator:x.accResolveCoordinator(application.Programme,seed)});
assert.ok(full.includes('Complete Online Acceptance'));
console.log('PASS — LOA safety: student details, coordinator availability, programme mismatch, DBA ODL exclusion and single IPGS header.');
