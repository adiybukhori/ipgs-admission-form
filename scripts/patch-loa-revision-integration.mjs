import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=process.argv[2];if(!root)throw Error('Explicit staged acceptance source required');
function edit(p,fn){let s=fs.readFileSync(p,'utf8');const nl=s.includes('\r\n')?'\r\n':'\n';s=s.replace(/\r\n/g,'\n');const n=fn(s);assert.notEqual(n,s,p);fs.writeFileSync(p,n.replace(/\n/g,nl));}
function one(s,a,b){assert.equal(s.split(a).length,2,'Expected exactly one match: '+a.slice(0,100));return s.replace(a,()=>b);}
edit('lib/loa-revision.js',s=>{
s=one(s,"offerIssuedAt:workflow['Offer Letter Issued At']||'',acceptedAt:workflow['Acceptance Signed At']||''","offerIssuedAt:revisionDate(workflow['Offer Letter Issued At']||ledger.sent_at),acceptedAt:state==='ACCEPTED'?revisionDate(workflow['Acceptance Signed At']||workflow['Acceptance Received At']):''");
s=one(s,"export function prepareLoaRevision(","function revisionDate(value){const d=new Date(value);if(!value||!Number.isFinite(d.valueOf()))throw Error('Revision timestamp missing or invalid');return d.toISOString();}\nexport function prepareLoaRevision(");return s;});
edit('lib/loa-native.js',s=>{
s=one(s,"import {accGatewayCall} from './loa-gateway.js';","import {accGatewayCall} from './loa-gateway.js';\nimport {revisionPdfName} from './loa-revision.js';");
s=one(s,"coordinator,emailContract,env=process.env})","coordinator,emailContract,revision=1,env=process.env})");
s=one(s,"  const prepared=accNativeLoaValidate({referenceNo,matricNo,application,workflow});","  const prepared=accNativeLoaValidate({referenceNo,matricNo,application,workflow});\n  if(!Number.isInteger(revision)||revision<1||revision>1000)throw Error('Invalid LOA revision');\n  const revised=revision>1,suffix='R'+String(revision).padStart(2,'0');\n  if(revised&&(env.ACC_LOA_TRANSPORT!=='gateway'||workflow['Offer Letter Remarks']!=='ACC revised LOA preparing; Revision '+suffix))throw Error('Revision not prepared by acceptance backend');\n  if(!revised&&String(workflow['Offer Letter Remarks']||'').startsWith('ACC revised LOA preparing'))throw Error('Revision reservation required');");
s=one(s,"expectedStudyMode:prepared.studyMode,...payload","expectedStudyMode:prepared.studyMode,...(revised?{revision}:{}),...payload");
s=one(s,"'Offer Letter Remarks':'Issued by ACC native LOA engine; SKY matric confirmed',","'Offer Letter Remarks':'Issued by ACC native LOA engine; SKY matric confirmed'+(revised?'; Revision '+suffix:''),");
s=one(s,"created_at:new Date().toISOString()}],","created_at:new Date().toISOString(),...(revised?{revision}:{})}],");
s=one(s,"'{{REF_NO}}':prepared.reference,","'{{REF_NO}}':prepared.reference+(revised?'/'+suffix:''),");
s=one(s,"    for(const [template,name,replacements] of specs){","    for(const [template,originalName,replacements] of specs){\n      const name=revised?revisionPdfName(originalName,revision):originalName;");
s=one(s,"if(email.attachmentNames.join('|')!==files.map(x=>x.name).join('|'))","if(email.attachmentNames.map(n=>revised?revisionPdfName(n,revision):n).join('|')!==files.map(x=>x.name).join('|'))");
s=one(s,"    const emailHtml=renderPremiumLoaHtml(messageContext);\n    const emailText=renderPremiumLoaText(messageContext);","    const revisionNotice='Revised Letter of Admission '+suffix+' — Study Mode: '+prepared.studyMode+'. This replaces the previous offer. Please complete Online Acceptance again using the new link.';\n    const baseHtml=renderPremiumLoaHtml(messageContext);\n    const emailHtml=revised?baseHtml.replace(/<body([^>]*)>/i,(_,attrs)=>'<body'+attrs+'><div style=\"padding:18px;background:#f4effc;color:#302064;font-family:Arial,sans-serif\">'+revisionNotice+'</div>'):baseHtml;\n    const emailText=(revised?revisionNotice+'\\n\\n':'')+renderPremiumLoaText(messageContext);\n    const subject=revised?'[Registry] Revised Letter of Admission '+suffix+' — '+prog:email.subject;");
s=one(s,"subject:email.subject,text:emailText","subject,text:emailText");s=one(s,"recipient,cc,email.subject,emailText","recipient,cc,subject,emailText");return s;});
edit('gateway/acc-loa/Code.gs',s=>{
s=one(s,"acceptanceMailRevision:1,","acceptanceMailRevision:1,loaRevisionSupport:1,");
s=one(s,"function gwFileName_(ctx,name,kind){","function gwFileName_(ctx,name,kind,revision){");
s=one(s,"!name.endsWith('_'+clean+'.pdf')","!name.endsWith('_'+clean+(revision?'_R'+String(revision).padStart(2,'0'):'')+'.pdf')");
s=one(s," if(p.op==='set_study_mode')return gwStudyMode_(p,ctx);"," if(p.op==='set_study_mode')return gwStudyMode_(p,ctx);\n const marker=String(record['Offer Letter Remarks']||''),match=marker.match(/; Revision R(\\d{2,4})$/),revision=match?Number(match[1]):0;\n if(p.revision!==undefined&&(!Number.isInteger(p.revision)||p.revision<2||p.revision>1000||p.revision!==revision))gwFail_('Revision marker mismatch');\n if(revision&&p.revision!==revision)gwFail_('Revision authorization missing');");
s=one(s,"gwFileName_(ctx,p.name,kind);","gwFileName_(ctx,p.name,kind,p.revision);");s=one(s,"gwFileName_(ctx,item.name,kinds[i]);","gwFileName_(ctx,item.name,kinds[i],p.revision);");
s=one(s,"   if(f['Offer Letter Status']!=='ISSUED'","   if(p.revision&&f['Offer Letter Remarks']!=='Issued by ACC native LOA engine; SKY matric confirmed; Revision R'+String(p.revision).padStart(2,'0'))gwFail_('Revision write mismatch');\n   if(f['Offer Letter Status']!=='ISSUED'");return s;});
edit(path.join(root,'WorkflowServiceAuthV2.js'),s=>one(s,'"v2ResendAcceptanceConfirmation",','"v2ResendAcceptanceConfirmation","v2PrepareAccLoaRevision",'));
edit(path.join(root,'WorkflowV2.js'),s=>{
s=one(s,"  if (action === 'v2ResendAcceptanceConfirmation')","  if (action === 'v2PrepareAccLoaRevision') {if(!v2VerifyWorkflowServiceAccess_(payload.token,action))throw Error('Revision requires workflow service authentication');return v2PrepareAccLoaRevision_(payload.data||{});}\n  if (action === 'v2ResendAcceptanceConfirmation')");
s=one(s,"  if (action === 'v2PrepareAcceptancePack') return v2AcceptancePackEnsureReviewDocs_((payload.data || {}).referenceNo, payload.updatedBy || 'Admin Portal V2');","  if (action === 'v2PrepareAcceptancePack') {const lock=LockService.getScriptLock();lock.waitLock(30000);try{return v2AcceptancePackEnsureReviewDocs_((payload.data||{}).referenceNo,payload.updatedBy||'Admin Portal V2');}finally{lock.releaseLock();}}");
return s+String.raw`
// The signing portal's own lock serializes token invalidation with student acceptance.
function v2PrepareAccLoaRevision_(plan){
 assertDevIdentity_();
 const lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  const ref=String(plan.referenceNo||''),next=String(plan.nextStudyMode||''),old=plan.previous||{},revision=Number(plan.revision),suffix='R'+String(revision).padStart(2,'0');
  if(!/^IUC-ADM-[A-Za-z0-9-]{3,160}$/.test(ref)||!Number.isInteger(revision)||revision<2||revision>1000||old.revision!==revision-1||!['Full-Time','Part-Time'].includes(next)||next===old.studyMode||!String(plan.reason||'').trim())throw Error('Invalid revision request');
  const a=v2Find_('V2_APPLICATIONS','Reference No',ref),w=v2Find_('V2_WORKFLOW','Reference No',ref);
  if(!a||!w)throw Error('Revision record missing');
  const r=w.record,mode=String(a.record['Study Mode']||'').trim().replace(/[-\s]+/g,' ').toLowerCase();
  const oldMode=String(old.studyMode||'').replace('-',' ').toLowerCase(),marker=String(r['Offer Letter Remarks']||''),match=marker.match(/; Revision R(\d{2,4})$/);
  if(mode!==oldMode||(match?Number(match[1]):1)!==old.revision||!marker.startsWith('Issued by ACC native LOA engine; SKY matric confirmed')||r['Offer Letter Status']!=='ISSUED'||r['Offer Email Status']!=='LIVE_SENT_1'||r['Offer Letter PDF URL']!==plan.expectedOfferUrl||r['Acceptance Status']!==plan.expectedAcceptanceStatus)throw Error('Offer or acceptance changed; Registry review required');
  const mail=String(r['Acceptance Confirmation Email Status']||''),pack=String(r['Acceptance Pack Status']||'');
  const signedKeys=['Acceptance PDF URL','Surat Penerimaan Signed PDF URL','Surat Akuan Signed PDF URL','Student Handbook Acknowledgement Signed PDF URL'];
  const signed=signedKeys.map(k=>String(r[k]||'')).filter(Boolean);
  if(['GATEWAY_QUEUED','GATEWAY_ACCEPTANCE_SENDING','REVIEW_REQUIRED'].includes(mail)||['SIGNED','SIGNATURE_FAILED'].includes(pack)||JSON.stringify(signed)!==JSON.stringify(old.signedDocumentUrls||[]))throw Error('Acceptance changed or unfinished');
  if(r['Acceptance Status']==='ACCEPTED'){if(plan.registryConfirmed!==true||pack!=='ACCEPTED'||!/^LIVE_SENT_/.test(mail)||signed.length!==4)throw Error('Signed acceptance requires Registry confirmation');}
  else if(r['Acceptance Status']!=='PENDING'||signed.length||pack==='ACCEPTED')throw Error('Acceptance not eligible');
  // Audit snapshot exists in database before this operation. Preserve all signed and issued files.
  const reviewKeys=['Acceptance Review PDF URL','Surat Penerimaan Review PDF URL','Surat Akuan Review PDF URL','Student Handbook Acknowledgement Review PDF URL'];
  const reset={'Offer Letter Status':'NOT_ISSUED','Offer Letter PDF URL':'','Offer Letter Issued At':'','Offer Email Status':'NOT_SENT','Offer Email Sent At':'','Offer Letter Remarks':'ACC revised LOA preparing; Revision '+suffix,'Acceptance Token Hash':'','Acceptance Signing URL':'','Acceptance Status':'NOT_OPEN','Acceptance Received At':'','Acceptance Signed At':'','Acceptance Remarks':'','Acceptance Pack Status':'','Acceptance Pack Signed At':'','Acceptance Confirmation Email Status':'','Acceptance Confirmation Email Sent At':'','Last Updated':new Date().toISOString(),'Updated By':'Registry LOA Revision'};
  [...signedKeys,...reviewKeys].forEach(k=>reset[k]='');
  const headers=w.sheet.getRange(1,1,1,w.sheet.getLastColumn()).getValues()[0],appHeaders=a.sheet.getRange(1,1,1,a.sheet.getLastColumn()).getValues()[0];
  if(!Object.keys(reset).every(k=>headers.includes(k))||!['Study Mode','Last Updated'].every(k=>appHeaders.includes(k)))throw Error('Revision schema incomplete');
  // Under the same lock: remove the old token and old offer state before changing the mode.
  // A partial write is deliberately blocked for manual review, never retried.
  v2UpdateRow_(w.sheet,w.rowNumber,reset);SpreadsheetApp.flush();
  v2UpdateRow_(a.sheet,a.rowNumber,{'Study Mode':next,'Last Updated':reset['Last Updated']});SpreadsheetApp.flush();
  // Only remove unsigned review PDFs from the current student folder; never delete signed records.
  let remaining=0;const folderId=v2OfferExtractDriveId_(a.record['Student Folder URL']);
  for(const k of reviewKeys){const id=v2OfferExtractDriveId_(r[k]);if(!id)continue;try{const f=DriveApp.getFileById(id),parents=f.getParents();let inside=false;while(parents.hasNext())if(parents.next().getId()===folderId)inside=true;if(inside&&f.getName().startsWith('REVIEW_')&&f.getMimeType()===MimeType.PDF){f.setTrashed(true);if(!f.isTrashed())remaining++;}}catch(e){remaining++;}}
  v2Audit_(ref,'LOA','REVISION_PREPARED',{studyMode:old.studyMode,revision:old.revision,acceptanceStatus:old.acceptanceStatus},{studyMode:next,revision:revision,reviewFilesRemaining:remaining},'Registry LOA Revision','SUCCESS',String(plan.reason).slice(0,300));
  return {ok:true,revision:revision,studyMode:next,tokenRevoked:true,reviewFilesRemaining:remaining};
 }finally{lock.releaseLock();}
}
`;
});
edit(path.join(root,'AcceptancePackV2.js'),s=>{
s=one(s,"function v2AcceptancePackSafeName_(value) {","function v2AcceptancePackVersionedName_(ctx,value){const m=String(ctx.workflow.record['Offer Letter Remarks']||'').match(/; Revision R(\\d{2,4})$/);return v2AcceptancePackSafeName_(value)+(m?'_R'+m[1]:'');}\nfunction v2AcceptancePackSafeName_(value) {");
s=one(s,"const safeName = v2AcceptancePackSafeName_(ctx.studentName);","const safeName = v2AcceptancePackVersionedName_(ctx,ctx.studentName);");s=one(s,"const safeName = v2AcceptancePackSafeName_(masterName);","const safeName = v2AcceptancePackVersionedName_(ctx,masterName);");return s;});
console.log('Revision engine, gateway, locked signing backend and versioned signed filenames staged.');
