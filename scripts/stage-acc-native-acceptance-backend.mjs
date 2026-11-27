// Stages the signing-only patch from the current authorised Apps Script source.
// Does not run clasp, deploy, or change the source unless an explicit output is supplied.
// Usage: node scripts/stage-acc-native-acceptance-backend.mjs <source OfferLetterV2.js> <output file>
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const [source,output]=process.argv.slice(2);
assert.ok(source&&output&&resolve(source)!==resolve(output),'Provide different source and staged output files.');
let text=readFileSync(source,'utf8').replace(/\r\n/g,'\n');
const start=text.indexOf('function v2AcceptOffer_(rawToken, data, actor) {');
assert.ok(start>=0,'Expected acceptance function missing.');
const end=text.indexOf('\nfunction ',start+1);
assert.ok(end>start,'Could not isolate acceptance function.');
let fn=text.slice(start,end);
function replace(oldValue,newValue){
 assert.equal(fn.split(oldValue).length,2,'Unexpected acceptance source; refusing patch.');
 fn=fn.replace(oldValue,newValue);
}
const gate="  if (\n    stage !== 'OFFER_ISSUED' &&\n    stage !== 'ACCEPTANCE_PENDING'\n  ) {\n    throw new Error(\n      'Acceptance blocked: invalid application stage.'\n    );\n  }";
replace(gate,"  // ACC-native LOA and SAC/IA/PR are independent. Legacy flows keep their gate.\n  const nativeAcc = String(workflow.record['Offer Letter Remarks'] || '').indexOf('Issued by ACC native LOA engine; SKY matric confirmed') === 0;\n  if (nativeAcc) {\n    // Only a completed electronic signature pack may finalise ACC-native acceptance.\n    const signedFields = ['Acceptance PDF URL','Surat Penerimaan Signed PDF URL','Surat Akuan Signed PDF URL','Student Handbook Acknowledgement Signed PDF URL'];\n    if (String(workflow.record['Acceptance Pack Status'] || '') !== 'SIGNED' || !signedFields.every(function(field) { return v2AcceptancePackUrlExists_(workflow.record[field]); })) {\n      throw new Error('Acceptance blocked: four signed documents are required.');\n    }\n  } else {\n"+gate.split('\n').map(x=>'  '+x).join('\n')+"\n  }");
replace("      'Application Stage':\n        'ACCEPTED',","      // Do not overwrite the SAC/IA/Prerequisite stage for ACC-native LOA.\n      ...(!nativeAcc ? {'Application Stage':'ACCEPTED'} : {}),");
replace("    applicationStage:\n      'ACCEPTED',","    applicationStage:\n      nativeAcc ? stage : 'ACCEPTED',");
text=text.slice(0,start)+fn+text.slice(end);
writeFileSync(output,text,'utf8');
console.log('Staged acceptance-only patch; original source untouched.');