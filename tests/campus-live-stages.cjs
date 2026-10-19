// Regression tests for the read-only Campus V9 live stage adapter.
// Run: node --test tests/campus-live-stages.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const file = path.join(__dirname,'..','campus-v9','WorkflowAdapter.js');
const script = fs.readFileSync(file,'utf8')
  .replace(/^import\{BY_ID,ROUTES\}from'\.\/config\.js';\s*/,'')
  .replace(/^import\{ApplicantActor\}from'\.\/ApplicantActor\.js';\s*/,'')
  .replace(/^import\{CampusOccupancy\}from'\.\/CampusOccupancy\.js';\s*/,'')
  .replace('export class WorkflowAdapter','class WorkflowAdapter')
  + '\n globalThis.WorkflowAdapter = WorkflowAdapter;';
const routes={direct:['admission','sac','offer','services','handover'],ia:['admission','sac','ia','offer','services','handover'],prerequisite:['admission','sac','prerequisite','offer','services','handover']};
const context={BY_ID:{},ROUTES:routes,ApplicantActor:class {}};
vm.createContext(context);
vm.runInContext(script,context,{filename:file,timeout:1000});

const ref='LOA/MBA/2026-05/890427016245';
function stage(workflow={},other={}){
  const data={V2_APPLICATIONS:[{'Reference No':ref,'Student Name':'Test Student','Programme':'MBA'}],V2_WORKFLOW:[{'Reference No':ref,...workflow}]};
  for(const [name,extra] of Object.entries(other))data[name]=[{'Reference No':ref,...extra}];
  const record=context.WorkflowAdapter.normalize(data)[0];
  return {station:record.station,status:record.status,primary:record.primaryStation};
}
const expectStage=(workflow,station,status,other)=>{const actual=stage(workflow,other);assert.equal(actual.station,station);if(status)assert.equal(actual.status,status);};

test('unassigned new admission with negative offer status remains at Admission',()=>{
  expectStage({'Application Stage':'APPLICATION_RECEIVED','Offer Letter Status':'NOT_ISSUED','Acceptance Status':'NOT_RECEIVED'},'admission','WAITING_SAC_ASSIGNMENT');
  expectStage({'Application Stage':'SKY_ACTIVATED','Offer Letter Status':'NOT_ISSUED','Acceptance Status':'PENDING'},'admission','WAITING_SAC_ASSIGNMENT');
  expectStage({'Application Stage':'SKY_ACTIVATED','Offer Letter Status':'NOT_DETERMINED','Acceptance Status':'NOT_DETERMINED'},'admission');
});
test('assigned to SAC but undecided stays in SAC even with parallel activation',()=>{
  expectStage({'SAC Session ID':'SAC/OCT/2026','SAC Decision':'NOT_DETERMINED','Application Stage':'SKY_ACTIVATED'},'sac','WAITING_SAC_SESSION');
  expectStage({'SAC Decision':'PENDING','Offer Letter Status':'NOT_ISSUED'},'sac','WAITING_SAC_SESSION',{'V2_SAC_CANDIDATES':{'SAC Session ID':'SAC/OCT/2026','Decision':'PENDING'}});
});
test('approved SAC proceeds to offer while IA and prerequisite decisions use their offices',()=>{
  expectStage({'SAC Session ID':'SAC/OCT/2026','SAC Decision':'DIRECT_ENTRY','Offer Letter Status':'NOT_ISSUED'},'offer','PROCESSING');
  expectStage({'SAC Session ID':'SAC/OCT/2026','SAC Decision':'IA_REQUIRED','Assessment Status':'IN_PROGRESS'},'ia','WAITING_IA');
  expectStage({'SAC Session ID':'SAC/OCT/2026','SAC Decision':'PREREQUISITE_REQUIRED','Prerequisite Status':'NOT_STARTED'},'prerequisite','WAITING_PREREQUISITE');
  expectStage({'SAC Session ID':'SAC/OCT/2026','SAC Decision':'IA_REQUIRED','Assessment Status':'COMPLETED'},'offer','PROCESSING');
});
test('historical Azam and Ameera cases never regress to Admission',()=>{
  expectStage({'Application Stage':'SKY_ACTIVATED','SAC Decision':'','Offer Letter Status':'ISSUED','Acceptance Status':'ACCEPTED','Provisioning Status':'NOT_STARTED'},'offer','ACCEPTED');
  expectStage({'Application Stage':'SKY_ACTIVATED','SAC Decision':'','Offer Letter Status':'ISSUED','Acceptance Status':'PENDING','Provisioning Status':'NOT_STARTED'},'offer','WAITING_ACCEPTANCE');
});
test('orientation is a temporary visit, not a permanent primary stage',()=>{
  const w={'SAC Session ID':'SAC/OCT/2026','SAC Decision':'NOT_DETERMINED'};
  const active=stage(w,{'V2_ORIENTATION_TRACKING':{'Status':'IN_PROGRESS'}});
  assert.equal(active.station,'orientation');assert.equal(active.primary,'sac');
  assert.equal(stage(w,{'V2_ORIENTATION_TRACKING':{'Status':'ATTENDED'}}).station,'sac');
});
test('document check and screening evidence never assign a SAC',()=>{
  expectStage({'Application Stage':'DOCUMENT_REVIEW'},'admission',null,{'V2_DOCUMENT_REVIEW':{'Status':'IN_PROGRESS'}});
  expectStage({'Application Stage':'SCREENING'},'admission',null,{'V2_AI_SCREENING':{'Status':'IN_PROGRESS'}});
});
test('completed acceptance proceeds only when student services work is active',()=>{
  expectStage({'SAC Decision':'DIRECT_ENTRY','Offer Letter Status':'ISSUED','Acceptance Status':'ACCEPTED','Provisioning Status':'IN_PROGRESS'},'services','PROVISIONING');
});
