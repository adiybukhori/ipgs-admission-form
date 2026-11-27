const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const index = fs.readFileSync('index.html','utf8');
const admin = fs.readFileSync('agents.html','utf8');
const routing = JSON.parse(fs.readFileSync('vercel.json','utf8'));
const parse = index.match(/const cleanPartnerPath = [^\n]+;\s*const AGENT_REFERRAL_CODE = [^\n]+;/)[0];
function code(pathname,search=''){return vm.runInNewContext(parse+'\nAGENT_REFERRAL_CODE',{window:{location:{pathname,search}},URLSearchParams});}
assert.equal(code('/aireaseeducation'),'AIREASEEDUCATION');
assert.equal(code('/','?agent=AIREASEEDUCATION'),'AIREASEEDUCATION');
assert.equal(code('/other_partner-12/'),'OTHER_PARTNER-12');
assert.equal(code('/'),'');
assert.equal(code('/index.html','?agent=TEST'),'TEST');
assert.equal(code('/first','?agent=SECOND'),'FIRST');
const fn = admin.match(/function referralLink\(a\)\{[^\n]+\}/)[0];
function link(agent){return vm.runInNewContext(fn+'\nreferralLink(agent)',{agent,encodeURIComponent});}
assert.equal(link({'Agent Code':'AIREASEEDUCATION','Referral Link':'old'}),'https://ipgs-admission-form.innovative.edu.my/aireaseeducation');
assert.equal(link({'Agent Code':'SKY_TEST'}),'');
assert.equal(link({'Agent Code':'OTHER_PARTNER-12'}),'https://ipgs-admission-form.innovative.edu.my/other_partner-12');
assert.ok(routing.rewrites.some(r=>r.source==='/:partner([A-Za-z0-9_-]+)'&&r.destination==='/index.html'));
console.log('Partner link checks passed');
