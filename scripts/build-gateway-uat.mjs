import {writeFileSync} from 'node:fs';
import {renderPremiumLoaHtml,renderPremiumLoaText} from '../lib/loa-premium-email.js';
const model={studentName:'UAT TEST ONLY - NOT A STUDENT',programme:'MBA - Master of Business Administration',intake:'January 2027',studyMode:'Full Time',matricNo:'2699999',preview:true,acceptanceUrl:'https://ipgs-admission-form.innovative.edu.my/acceptance-demo.html'};
const html=renderPremiumLoaHtml(model),text=renderPremiumLoaText(model);
const script = `// Editor-only isolated test. Never deploy this helper as a public route.
function runAccLoaIsolatedUAT(){
 const lock=LockService.getScriptLock();
 if(!lock.tryLock(15000))throw Error('Gateway is busy');
 const p=PropertiesService.getScriptProperties(),key='ACC_GW_UAT_20261127';
 try{
  if(Session.getEffectiveUser().getEmail().toLowerCase()!==ACC_GW_SENDER)throw Error('Wrong execution account');
  if(p.getProperty('ACC_GATEWAY_WRITE_ENABLED')!=='false')throw Error('Live writes must remain explicitly disabled');
  if(p.getProperty(key))throw Error('UAT already attempted. Check execution log and Sent folder; do not retry blindly.');
  p.setProperty(key,'STARTED');
  const folder=DriveApp.createFolder('ACC LOA UAT ONLY - NOT OFFICIAL - 20261127');
  const common={'{{STUDENT_NAME}}':'UAT TEST ONLY - NOT A STUDENT','{{PROGRAMME_NAME}}':'Master of Business Administration','{{INTAKE}}':'January 2027','{{IC}}':'SYNTHETICUAT20261127','{{SESSION_MONTH}}':'January','{{SESSION_YEAR}}':'2027'};
  const specs=Object.keys(ACC_GW_TEMPLATES).map(kind=>({kind,name:ACC_GW_PREFIX[kind]+'_MBA_SYNTHETICUAT20261127.pdf',replacements:kind==='loa'?Object.assign({},common,{'{{REF_NO}}':'UAT/NOT-OFFICIAL/20261127','{{OFFER_DATE_LONG}}':'27 November 2026','{{STUDENT_ADDRESS}}':'Fictional address - test only','{{MATRIX_NO}}':'2699999'}):common}));
  const files=[];
  for(const spec of specs){
   const copy=DriveApp.getFileById(ACC_GW_TEMPLATES[spec.kind]).makeCopy('TEMP_ACC_LOA_UAT_'+Utilities.getUuid(),folder);
   try{
    Docs.Documents.batchUpdate({requests:Object.keys(spec.replacements).map(k=>({replaceAllText:{containsText:{text:k,matchCase:true},replaceText:spec.replacements[k]}}))},copy.getId());
    const pdf=copy.getAs(MimeType.PDF).setName(spec.name),bytes=pdf.getBytes();
    if(bytes.length<1000||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('Invalid PDF '+spec.kind);
    const file=folder.createFile(pdf);files.push({name:spec.name,bytes:file.getBlob().getBytes()});
   }finally{copy.setTrashed(true)}
  }
  if(files.length!==4)throw Error('Four PDFs required');
  const recipient='adiybukhori.ipgs@innovative.edu.my';
  const html=${JSON.stringify(html)};
  const text=${JSON.stringify(text)};
  p.setProperty(key,'SENDING - MANUAL REVIEW IF INTERRUPTED');
  const sent=Gmail.Users.Messages.send({raw:gwMime_({recipient,cc:[],subject:'[UAT ONLY - NOT OFFICIAL] ACC LOA Gateway PDF and Email Test 20261127',html,text},files)},'me');
  if(!sent||!sent.id)throw Error('No Gmail message ID');
  p.setProperty(key,'SENT:'+sent.id);
  const report={ok:true,syntheticOnly:true,pdfCount:files.length,pdfs:files.map(f=>({name:f.name,size:f.bytes.length})),sender:ACC_GW_SENDER,recipient,folderUrl:folder.getUrl(),messageId:sent.id,productionWorkflowTouched:false,writeEnabled:false,acceptance:'DEMO ONLY'};
  console.log(JSON.stringify(report));return report;
 }finally{lock.releaseLock()}
}
`;
writeFileSync('gateway/acc-loa/UAT.gs',script,'utf8');
console.log('Built isolated UAT helper using approved premium preview renderer; no live data.');