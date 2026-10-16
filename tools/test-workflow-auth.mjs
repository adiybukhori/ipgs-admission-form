import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const source=fs.readFileSync(new URL('../api/admin-action.js',import.meta.url),'utf8');
async function request(password,action,data={},failure=false){
  const calls=[];
  const context={process:{env:{V2_ADMIN_API_PASSWORD:'staff-local',V2_WORKFLOW_API_TOKEN:'workflow-service',V2_LOA_API_TOKEN:'loa-service',N8N_ADMIN_BRIDGE_URL:'https://retired-bridge.invalid'}},Date,JSON,Set,Map,Error,String,Array,Object,Number,encodeURIComponent,
    fetch:async(url,init)=>{calls.push({url,init});
      if(url.includes('action=applications'))return{ok:true,text:async()=>JSON.stringify({ok:password==='legacy-staff'})};
      if(failure)throw Error('backend connection lost');
      return{ok:true,text:async()=>JSON.stringify({ok:true,session:data})};}};
  vm.createContext(context);vm.runInContext(source.replace('export default async function handler','async function handler')+';this.handler=handler;',context);
  const res={code:200,setHeader(){},status(code){this.code=code;return this},json(body){this.body=body;return this}};
  await context.handler({method:'POST',body:{password,action,data}},res);
  return{res,calls};
}
let r=await request('wrong','v2CreateOrientationSession');assert.equal(r.res.code,401);assert.equal(r.calls.filter(c=>c.init?.method==='POST').length,0);
r=await request('staff-local','v2CreateOrientationSession');assert.equal(r.res.code,200);assert.equal(JSON.parse(r.calls[0].init.body).token,'workflow-service');
r=await request('legacy-staff','v2CreateOrientationSession');assert.equal(r.res.code,200);assert.equal(JSON.parse(r.calls.at(-1).init.body).token,'workflow-service');
r=await request('staff-local','v2IssueOffer');assert.equal(JSON.parse(r.calls[0].init.body).token,'loa-service');
r=await request('workflow-service','v2CreateOrientationSession',{sessionId:'another'});assert.equal(r.res.code,401);
r=await request('workflow-service','v2WorkflowDiagnostics');assert.equal(r.res.code,200);
r=await request('workflow-service','v2CreateOrientationSession',{sessionId:'ORI-UAT-AUTH-20261016',name:'REGISTRY SYSTEM TEST - DO NOT INVITE',status:'CANCELLED'});assert.equal(r.res.code,200);
r=await request('staff-local','v2CreateOrientationSession',{},true);assert.equal(r.res.code,502);assert.equal(r.calls.length,1);assert.ok(r.calls.every(c=>!c.url.includes('retired-bridge')));

const elements=Object.fromEntries(Object.entries({oriName:'Test Orientation',oriIntake:'JAN2027',oriDate:'2026-10-17',oriStart:'08:30',oriEnd:'10:30',oriMode:'ONLINE',oriVenue:'',oriMeetingLink:'',oriProgrammeGroup:'ALL'}).map(([id,value])=>[id,{value}]));
elements.orientationCreateSaveBtn={disabled:false};elements.orientationCreateModal={dataset:{},remove(){}};
let requests=[],release;
const ui={window:{},document:{getElementById:id=>elements[id]||null},confirm:()=>true,crypto,ACTION_API:'/api/admin-action',password:'staff',loadData:async()=>{},fetch:async(url,init)=>{requests.push(JSON.parse(init.body));await new Promise(resolve=>{release=resolve});return{ok:false,json:async()=>({ok:false,message:'temporary failure'})}}};
vm.createContext(ui);vm.runInContext(fs.readFileSync(new URL('../orientation-admin.js',import.meta.url),'utf8'),ui);
const first=ui.window.createOrientationSession();await ui.window.createOrientationSession();assert.equal(requests.length,1);release();await first;
const retry=ui.window.createOrientationSession();assert.equal(requests.length,2);assert.equal(requests[0].data.sessionId,requests[1].data.sessionId);release();await retry;
console.log('PASS: 8 API authentication/transport checks; UI blocks concurrent create and reuses request ID on retry.');
