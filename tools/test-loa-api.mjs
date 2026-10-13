import fs from 'node:fs';
import assert from 'node:assert/strict';
const {default:handler}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('api/admin-action.js','utf8')).toString('base64'));
process.env.V2_ADMIN_API_PASSWORD='staff-test-password';process.env.V2_LOA_API_TOKEN='scope-test-token';
let issued=0,authenticated=0;
globalThis.fetch=async (url,options)=>{
  if(String(url).includes('AKfycbw22')){authenticated++;return {ok:true,text:async()=>JSON.stringify({ok:false})};}
  const body=JSON.parse(options.body);assert.equal(body.token,'scope-test-token');issued++;
  return {ok:true,text:async()=>JSON.stringify({ok:true,offerProgramme:'Master of Business Administration (MBA)',emailStatus:'ALREADY_SENT',duplicateEmailSuppressed:true})};
};
async function request(password,data={},action='v2IssueOffer'){
  let output,status;const res={setHeader(){},status(n){status=n;return this;},json(j){output=j;return this;}};
  await handler({method:'POST',body:{action,password,data}},res);return {status,output};
}
assert.equal((await request('wrong-password',{referenceNo:'IUC-ADM-REAL'})).status,401);assert.equal(issued,0);
assert.equal((await request('scope-test-token',{referenceNo:'IUC-ADM-REAL'})).status,401);assert.equal(issued,0);
const staff=await request('staff-test-password',{referenceNo:'IUC-ADM-REAL'});assert.equal(staff.status,200);assert.equal(staff.output.transport,'APPS_SCRIPT_LOA_SCOPED');assert.equal(issued,1);
const trial=await request('scope-test-token',{referenceNo:'IUC-ADM-LOA-UAT-20261013',testMode:true,testRecipient:'adiybukhori.ipgs@innovative.edu.my'});assert.equal(trial.status,200);assert.equal(issued,2);
assert.equal((await request('scope-test-token',{},'v2LoaDiagnostics')).status,200);
console.log('LOA_API_TESTS_OK: staff auth retained, wrong passwords blocked, service token cannot issue real records, exact synthetic trial permitted, direct issuer path');
