import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const script = readFileSync(new URL('../apps-script/LOA_V1_PARITY_CONTRACT.js', import.meta.url), 'utf8');
const sandbox = {};
runInNewContext(script, sandbox, {filename:'LOA_V1_PARITY_CONTRACT.js', timeout:2000});
assert.equal(typeof sandbox.v2LoaV1MailContract_, 'function');

const cases = [
  ['MBA - Master of Business Administration', 'Master of Business Administration', 'MBA'],
  ['MBM - Master in Business Management', 'Master in Business Management', 'MBM'],
  ['DBA - Doctorate of Business Administration', 'Doctorate of Business Administration', 'DBA'],
  ['PhD - Doctor of Philosophy in Management', 'Doctor of Philosophy in Management', 'PHD']
];

for (const [raw,full,code] of cases){
  const c=sandbox.v2LoaV1MailContract_(raw,'2601001',code,'TEST001');
  assert.equal(c.subject,'[Registry] Letter of Admission – '+full);
  assert.equal(c.attachmentNames.length,4);
  assert.deepEqual(Array.from(c.attachmentNames),[
    'LOA_'+code+'_TEST001.pdf',
    'Acceptance_EN_'+code+'_TEST001.pdf',
    'Surat_Penerimaan_'+code+'_TEST001.pdf',
    'Surat_Akuan_'+code+'_TEST001.pdf'
  ]);
  assert.ok(c.body.includes('Student Matrix No.: 2601001'));
  assert.ok(c.body.includes('https://innovative.vialing.com/sp/login'));
  assert.ok(c.body.includes('https://forms.gle/xvVDEnnt9Fq4jAKp7'));
  assert.ok(c.body.includes('https://forms.gle/rDVdXAbzenxnUEeRA'));
  assert.ok(c.body.includes('Warm regards,\n\nRegistry Department'));
}
assert.throws(()=>sandbox.v2LoaV1MailContract_('MBA','abc','MBA','TEST001'),/7-digit/);
console.log('LOA V1 parity contract: 4 programme scenarios + invalid matric passed.');
