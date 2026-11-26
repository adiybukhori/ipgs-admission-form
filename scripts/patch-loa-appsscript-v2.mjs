/**
 * Offline source migration for the pinned Apps Script V2 LOA release.
 * Input: a READ-ONLY clasp pull of production version 131 into an isolated
 * directory. This NEVER runs clasp push, modifies a deployment, sends Gmail
 * or uses live Sheets/Drive.
 *
 * Usage: node scripts/patch-loa-appsscript-v2.mjs "C:\...\IPGS_LOA_CLEAN_UAT_20261126"
 * Required additional Apps Script files in that directory:
 *   LOA_V1_PARITY_CONTRACT.js (from repo apps-script/)
 *   LOA_UNIFIED_V2_UAT.js (from repo apps-script/)
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=process.argv[2];
if(!root||!fs.existsSync(root))throw Error('Provide an existing isolated source directory.');
if(fs.existsSync(path.join(root,'.clasp.json')))throw Error('Refusing to modify a clasp-linked directory. Remove .clasp.json in a COPY first.');
const sources=new Map();
const filenames=['OfferLetterV2.js','NotificationEngineV2.js','AcceptancePackV2.js','WorkflowV2.js','AgenticBridgeV2.js'];
for(const name of filenames)sources.set(name,fs.readFileSync(path.join(root,name),'utf8'));
function uniqueReplace(src,oldValue,newValue,label){
 const re=typeof oldValue==='string'?null:oldValue;
 const matches=re?[...src.matchAll(new RegExp(re.source,re.flags.includes('g')?re.flags:re.flags+'g'))].length:src.split(oldValue).length-1;
 if(matches!==1)throw Error(label+': expected one anchor, found '+matches);
 return src.replace(oldValue,newValue);
}
function editFunction(file,name,editor){
 let src=sources.get(file),i=src.indexOf('function '+name+'(');
 if(i<0)throw Error('Missing '+file+'::'+name);
 const tail=src.slice(i);
 const regex=/\nfunction\s+[A-Za-z_$][A-Za-z0-9_$]*\s*\(/g;regex.lastIndex=10;
 const next=regex.exec(tail);
 const end=next?i+next.index:src.length;
 const before=src.slice(i,end),after=editor(before);
 if(!after||before===after)throw Error('No change '+name);
 sources.set(file,src.slice(0,i)+after+src.slice(end));
}
editFunction('OfferLetterV2.js','v2PrepareOffer_',function(t){
 t=uniqueReplace(t,'function v2PrepareOffer_(referenceNo, actor) {','function v2PrepareOffer_(referenceNo, actor, options) {','prepare args');
 t=uniqueReplace(t,/  const stage =[\s\S]*?  v2AssertStageGate_\([\s\S]*?\);\s*/,
 "  const stage=String(workflow.record['Application Stage']||'');\n  const matric=v2LoaRegistryMatric_(reference,options);\n\n",'prepare SAC gate');
 t=uniqueReplace(t,'  v2UpdateRow_(\n    workflow.sheet,','  v2OfferEnsureHeaders_(workflow.sheet,[\'LOA Registry Matric No\']);\n  v2UpdateRow_(\n    workflow.sheet,','prepare header');
 t=uniqueReplace(t,/'Offer Letter Status':\s*'READY_TO_GENERATE',/,"'Offer Letter Status':'READY_TO_GENERATE',\n      'LOA Registry Matric No':matric,", 'prepare store matric');
 return t;
});
editFunction('OfferLetterV2.js','v2GenerateOfferLetter_',function(t){
 t=uniqueReplace(t,'function v2GenerateOfferLetter_(referenceNo, actor) {','function v2GenerateOfferLetter_(referenceNo, actor, options) {','generate args');
 t=uniqueReplace(t,/  const stage =[\s\S]*?  if \(stage !== 'ELIGIBLE_FOR_OFFER'\) \{[\s\S]*?\n  \}/,
 "  const stage=String(workflow.record['Application Stage']||'');\n  const matric=v2LoaRegistryMatric_(reference,options);\n  if(String(workflow.record['LOA Registry Matric No']||'').trim()!==matric)\n    throw new Error('Registry-confirmed SKY matric changed between preparation and issue.');",
 'generate SAC gate');
 t=uniqueReplace(t,/CONFIG\.officialLoaTemplateId/,'V2_LOA_V1_ORIGINAL_TEMPLATES.offer','exact original V1 LOA template');
 t=uniqueReplace(t,/'{{MATRIX_NO}}':\s*'',/,"'{{MATRIX_NO}}':matric,",'populate matric');
 t=uniqueReplace(t,/'Application Stage':\s*'OFFER_ISSUED',/,"'LOA Registry Matric No':matric,",'preserve SAC stage in LOA');
 t=uniqueReplace(t,/applicationStage:\s*'OFFER_ISSUED',/,'applicationStage:stage,','return unchanged SAC stage');
 return t;
});
editFunction('OfferLetterV2.js','v2IssueOffer_',function(t){
 t=uniqueReplace(t,"prepared = v2PrepareOffer_(reference, actor || 'Offer Issuance');","prepared = v2PrepareOffer_(reference, actor || 'Offer Issuance',opts);",'issuer passes matric to preparation');
 t=uniqueReplace(t,"generated = v2GenerateOfferLetter_(reference, actor || 'Offer Issuance');","generated = v2GenerateOfferLetter_(reference, actor || 'Offer Issuance',opts);",'issuer passes matric to generator');
 return t;
});
editFunction('OfferLetterV2.js','v2AcceptOffer_',function(t){
 t=uniqueReplace(t,/  if \(\s*stage !== 'OFFER_ISSUED' &&\s*stage !== 'ACCEPTANCE_PENDING'\s*\) \{[\s\S]*?\n  \}\s*/,
 '\n  // Acceptance follows issued LOA and valid token; SAC/IA/PR stage is independent.\n\n','Acceptance SAC gate');
 t=uniqueReplace(t,/'Application Stage':\s*'ACCEPTED',\s*/,'','Acceptance must not mutate SAC');
 t=uniqueReplace(t,/applicationStage:\s*'ACCEPTED',/,'applicationStage:stage,','Acceptance returns unchanged SAC');
 return t;
});
editFunction('NotificationEngineV2.js','v2SendOfferNotificationCentral_',function(t){
 return "function v2SendOfferNotificationCentral_(referenceNo,acceptanceUrl,pdfFileId,options){\n  return v2SendOfferNotificationUnified_(referenceNo,acceptanceUrl,pdfFileId,options||{});\n}\n\n";
});
editFunction('AcceptancePackV2.js','v2AcceptancePackTemplateIds_',function(t){
 for(const [k,name] of [['acceptanceEn','AcceptanceEN'],['suratPenerimaan','Penerimaan'],['suratAkuan','Akuan']]){
   t=uniqueReplace(t,new RegExp('CONFIG\\.'+k+'TemplateId\\s*\\|\\|\\s*V2_ACCEPTANCE_PACK_TEMPLATE_FALLBACKS\\.'+k),
     'V2_ACCEPTANCE_PACK_TEMPLATE_FALLBACKS.'+k,'single V1 template '+name);
 }
 return t;
});
editFunction('WorkflowV2.js','handleV2Post_',function(t){
 t=uniqueReplace(t,/if \(action === 'v2IssueOffer'\) return v2IssueOffer_\(\(payload\.data \|\| \{\}\)\.referenceNo, payload\.updatedBy \|\| 'Admin Portal V2', payload\.data \|\| \{\}\);/,
 "if (action === 'v2IssueOffer') {\n    if(!v2VerifyLoaServiceAccess_(payload.token,action))throw new Error('Dedicated LOA service token required.');\n    return v2IssueOffer_((payload.data||{}).referenceNo,payload.updatedBy||'Admin Portal V2',payload.data||{});\n  }",'dedicated authorised LOA only');
 return t;
});
editFunction('AgenticBridgeV2.js','v2AgentActionGateway_',function(t){
 const start=t.indexOf("} else if (requestedAction === 'ISSUE_OFFER') {");
 const end=t.indexOf("} else if (requestedAction === 'PREPARE_ACADEMIC_HANDOVER') {",start);
 if(start<0||end<0)throw Error('Independent Agentic LOA writer not found');
 return t.slice(0,start)+"} else if (requestedAction === 'ISSUE_OFFER') {\n      throw new Error('LOA issuance must originate from ACC Applications after Registry matric confirmation.');\n    "+t.slice(end);
});
for(const [name,src] of sources){
 vm.Script===undefined?null:new vm.Script(src,{filename:name});
 fs.writeFileSync(path.join(root,name),src,'utf8');
}
console.log('Patched and syntax-checked '+sources.size+' Apps Script files in ISOLATED UAT copy. No deployment or service writes.');
