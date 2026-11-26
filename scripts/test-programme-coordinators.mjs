import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const root = new URL('../', import.meta.url);
const form = readFileSync(new URL('index.html',root),'utf8');
const directory = readFileSync(new URL('lib/acc-programme-directory.js',root),'utf8')
  .replace(/^export (const|function) /gm,'$1 ');
const source = readFileSync(new URL('lib/loa-premium-email.js',root),'utf8')
  .replace(/^import .*;$/gm,'').replace(/^export function /gm,'function ');
const email = readFileSync(new URL('lib/loa-v1-email.js',root),'utf8')
  .replace(/^export \{[^}]+\};/gm,'');
const native = readFileSync(new URL('lib/loa-native.js',root),'utf8')
  .replace(/^import .*;$/gm,'').replace(/^export (const|function|async function)/gm,'$1');
const ctx={URL,process:{env:{}},Buffer};
runInNewContext(directory+'\n'+source+'\n'+email+'\n'+native+'\nthis.api={picForProgramme,renderPremiumLoaHtml,renderPremiumLoaText,accNativeLoaReference,v2LoaV1MailContract_,accResolveCoordinator,accValidateDirectoryRow,PROGRAMME_COORDINATOR_SEEDS};',ctx);
const {picForProgramme,renderPremiumLoaHtml,renderPremiumLoaText,accNativeLoaReference,v2LoaV1MailContract_}=ctx.api;
Object.assign(ctx,ctx.api);
const cases=[
 ['PGDT - Postgraduate Diploma in Teaching','Rushdina Arifah Rushdan','rushdina@innovative.edu.my'],
 ['DPLI - Diploma Pendidikan Lepasan Ijazah','Rushdina Arifah Rushdan','rushdina@innovative.edu.my'],
 ['MBA - Master of Business Administration','Muhammad Naqiyuddin Bin Mohd Jihat','naqiyuddin.ipgs@innovative.edu.my'],
 ['MBM - Master in Business Management','Abuzar Bin Azizan','abuzar@innovative.edu.my'],
 ['MHUM - Master in Hajj & Umrah Management','Muhammad Naqiyuddin Bin Mohd Jihat','naqiyuddin.ipgs@innovative.edu.my'],
 ['MIS - Master in Islamic Studies','Aminah Binti Abdullah','aminah.abdullah@innovative.edu.my'],
 ['PhD - Doctor of Philosophy in Management','Noorus Sarah','noorus.sarah@innovative.edu.my'],
 ['DBA - Doctorate of Business Administration','Noorus Sarah','noorus.sarah@innovative.edu.my'],
 ['MEDU - Master in Education','Muhammad Abu Huzaifah Bin Zulkifli','abu.huzaifah.ipgs@innovative.edu.my'],
 ['BBA - Bachelor in Business Administration','Muhammad Naqiyuddin Bin Mohd Jihat','naqiyuddin.ipgs@innovative.edu.my'],
 ['MBA + PhD - Master of Business Administration & PhD (Package)','Muhammad Naqiyuddin Bin Mohd Jihat','naqiyuddin.ipgs@innovative.edu.my'],
 ['MBM + PhD - Master in Business Management & PhD (Package)','Abuzar Bin Azizan','abuzar@innovative.edu.my']
];
for(const [programme,name,emailAddress] of cases){
 const pic=picForProgramme(programme,null,true);
 assert.equal(pic?.name,name,'Coordinator mismatch for '+programme);
 assert.equal(pic?.email,emailAddress,'Email mismatch for '+programme);
 const data={programme,studentName:'UAT TEST STUDENT',matricNo:'2699999',intake:'January 2027',
   acceptanceUrl:'https://ipgs-admission-form.innovative.edu.my/acceptance-demo.html',preview:true};
 const rendered=renderPremiumLoaHtml(data);
 assert.ok(rendered.includes(name),programme+' missing coordinator in HTML');
 assert.ok(rendered.includes(emailAddress),programme+' missing PIC email in HTML');
 const plain=renderPremiumLoaText(data);
 assert.ok(plain.includes(emailAddress),programme+' missing PIC email in plain text');
}
assert.equal(picForProgramme('UNKNOWN - New Programme',null,true),null);
assert.throws(()=>picForProgramme('UNKNOWN - New Programme',null,false),/coordinator/);
const unknown=renderPremiumLoaHtml({programme:'UNKNOWN - New Programme',studentName:'Test',matricNo:'2699999',
 intake:'January 2027',acceptanceUrl:'https://ipgs-admission-form.innovative.edu.my/acceptance-demo.html',preview:true});
assert.ok(unknown.includes('ipgs.admission@innovative.edu.my'),'Unknown programme must fall back to Registry');
assert.ok(!unknown.includes('ACADEMIC & PROGRAMME MATTERS'),'Unknown programme must not show a guessed PIC');
assert.ok(form.includes('"MEDU - Master in Education"'),'MEDU is missing from ACC admission form');
assert.ok(!form.includes('DBA ODL'),'Excluded DBA ODL Diploma must not be added to ACC options');
assert.equal(accNativeLoaReference('MEDU - Master in Education','January 2027','TEST001').code,'MEDU');
assert.equal(accNativeLoaReference('BBA - Bachelor in Business Administration','January 2027','TEST001').code,'BBA');
assert.equal(v2LoaV1MailContract_('BBA - Bachelor in Business Administration','2699999','BBA','TEST001').subject,
 '[Registry] Letter of Admission – Bachelor in Business Administration');
assert.throws(()=>ctx.accResolveCoordinator('DBA ODL - Diploma in Business Administration',ctx.PROGRAMME_COORDINATOR_SEEDS),/no configured coordinator/);
assert.throws(()=>ctx.accResolveCoordinator('NEWP - New Programme',ctx.PROGRAMME_COORDINATOR_SEEDS),/no configured coordinator/);
assert.throws(()=>ctx.accValidateDirectoryRow({programme_code:'NEWP',programme_name:'New Programme',level:'Master',coordinator_name:'',coordinator_email:'',coordinator_role:'',is_active:true},{allowIncomplete:true}),/Cannot activate/);
const added={programme_code:'NEWP',programme_name:'New Programme',level:'Master',coordinator_name:'Assigned Coordinator',coordinator_email:'assigned@innovative.edu.my',coordinator_role:'New Programme Coordinator',is_active:true};
assert.equal(ctx.accResolveCoordinator('NEWP - New Programme',[added]).name,'Assigned Coordinator');
const inactive={...added,is_active:false};
assert.throws(()=>ctx.accResolveCoordinator('NEWP - New Programme',[inactive]),/inactive/);
assert.throws(()=>ctx.accResolveCoordinator('NEWP - Unapproved Programme',[added]),/does not match/);
console.log('PASS: 12 programme/PIC scenarios, package master routing, MEDU/BBA ACC and LOA support, excluded DBA ODL.');
