/** ACC LOA Gateway. Deploy as IPGS Admission. No public unauthenticated operations. */
const ACC_GW_SENDER='ipgs.admission@innovative.edu.my';
const ACC_GW_SHEET='1O-Y-q7_q78xKM1p5e2C3EWyQfYr5rXvhO0oWbVaw5Mw';
const ACC_GW_TEMPLATES={
 loa:'1BXx6GK7XPIbw8tmF8gmeGr8KUL1opFfCmEoC1TXnxwA',
 acceptance:'1JuIwpkPXIebWohnJrBUyJLw5flbVi3nbX0IsOgYlzlg',
 penerimaan:'1-fG3WrLOIpl3yl0Mqt4Geqiw1g6FNwGJ2DvXbtXmUB4',
 akuan:'1dwVfTaHh5Zue_Ob2521ZoGHK-nwIC-WV7yK8p8m7pPc'
};
const ACC_GW_PREFIX={loa:'LOA',acceptance:'Acceptance_EN',penerimaan:'Surat_Penerimaan',akuan:'Surat_Akuan'};
const ACC_GW_FIELDS=['Offer Letter Status','Offer Letter PDF URL','Offer Letter Issued At','Offer Email Status','Offer Email Sent At','Offer Letter Remarks','Acceptance Token Hash','Acceptance Signing URL','Acceptance Status'];
function gwFail_(message){throw new Error(message)}
function gwJson_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)}
function gwHex_(bytes){return bytes.map(b=>('0'+((b+256)%256).toString(16)).slice(-2)).join('')}
function gwEq_(a,b){if(a.length!==b.length)return false;let n=0;for(let i=0;i<a.length;i++)n|=a.charCodeAt(i)^b.charCodeAt(i);return n===0}
function gwAuth_(envelope,secret,now){
 if(!secret||!/^[a-f0-9]{64}$/.test(secret))gwFail_('Gateway secret not configured');
 if(!envelope||typeof envelope.payload!=='string'||envelope.payload.length>600000||!Number.isSafeInteger(envelope.ts)||Math.abs(now-envelope.ts)>120000||!/^[a-f0-9]{32}$/.test(envelope.nonce||'')||!/^[a-f0-9]{64}$/.test(envelope.signature||''))gwFail_('Invalid authentication envelope');
 const signed=envelope.ts+'.'+envelope.nonce+'.'+envelope.payload;
 const expected=gwHex_(Utilities.computeHmacSha256Signature(signed,secret,Utilities.Charset.UTF_8));
 if(!gwEq_(expected,envelope.signature))gwFail_('Invalid authentication');
 const payload=JSON.parse(envelope.payload);
 if(!payload||!['health','preflight','pdf','write','send','set_study_mode','acceptance_next'].includes(payload.op))gwFail_('Unsupported operation');
 return payload;
}
function doGet(){return gwJson_({ok:false,error:'Signed POST required'})}
function doPost(e){
 let lock;
 try{
  const props=PropertiesService.getScriptProperties();
  const envelope=JSON.parse(e.postData.contents);
  const p=gwAuth_(envelope,props.getProperty('ACC_GATEWAY_SECRET'),Date.now());
  if(Session.getEffectiveUser().getEmail().toLowerCase()!==ACC_GW_SENDER)gwFail_('Wrong execution account');
  lock=LockService.getScriptLock();if(!lock.tryLock(15000))gwFail_('Gateway busy');
  const cache=CacheService.getScriptCache(),nonce='accgw:'+envelope.nonce;
  if(cache.get(nonce))gwFail_('Replay rejected');cache.put(nonce,'1',300);
  if(p.op==='health')return gwJson_({ok:true,data:gwHealth_(props)});
  if(props.getProperty('ACC_GATEWAY_WRITE_ENABLED')!=='true')gwFail_('Gateway writes disabled');
  const data=p.op==='acceptance_next'?gwAcceptanceNext_():gwDispatch_(p,props);
  return gwJson_({ok:true,data:data});
 }catch(err){console.error('ACC gateway rejected: '+String(err&&err.message||'Unknown').slice(0,200).replace(/https?:\/\/\S+/g,'[URL]'));return gwJson_({ok:false,error:'Gateway rejected request; inspect authorized execution logs'})}
 finally{if(lock&&lock.hasLock())lock.releaseLock()}
}
function gwRow_(tab,reference){
 if(!/^IUC-ADM-[A-Za-z0-9-]{3,160}$/.test(reference||''))gwFail_('Invalid ACC reference');
 const sh=SpreadsheetApp.openById(ACC_GW_SHEET).getSheetByName(tab);
 if(!sh)gwFail_('Sheet not found');
 const rows=sh.getDataRange().getDisplayValues(),header=rows[0]||[],index=header.indexOf('Reference No');
 if(index<0)gwFail_('Reference column not found');
 const hits=[];for(let i=1;i<rows.length;i++)if(String(rows[i][index]).trim()===reference)hits.push(i);
 if(hits.length!==1)gwFail_('Reference must identify exactly one row');
 const i=hits[0],record={};header.forEach((h,j)=>record[h]=rows[i][j]||'');
 return {sh,header,row:i+1,record};
}
function gwContext_(p){
 const app=gwRow_('V2_APPLICATIONS',p.referenceNo).record, wf=gwRow_('V2_WORKFLOW',p.referenceNo);
 const folder=(String(app['Student Folder URL']||'').match(/\/folders\/([-A-Za-z0-9_]+)/)||[])[1];
 if(!folder||p.folderId&&p.folderId!==folder)gwFail_('Applicant folder mismatch');
 return {app,wf,folder};
}
function gwHealth_(props){
 const ss=SpreadsheetApp.openById(ACC_GW_SHEET);
 const sheet=ss.getSheetByName('V2_WORKFLOW');
 const header=sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
 const app=ss.getSheetByName('V2_APPLICATIONS');
 const ah=app.getRange(1,1,1,app.getLastColumn()).getDisplayValues()[0];
 const templates=Object.keys(ACC_GW_TEMPLATES).map(k=>({key:k,accessible:DriveApp.getFileById(ACC_GW_TEMPLATES[k]).getMimeType()===MimeType.GOOGLE_DOCS}));
 return {sender:ACC_GW_SENDER,studyModeRevision:1,acceptanceMailRevision:1,loaRevisionSupport:1,workflowReady:ACC_GW_FIELDS.every(k=>header.includes(k))&&header.includes('Reference No'),applicationReady:['Reference No','Student Folder URL','Personal Email','ID / Passport No'].every(k=>ah.includes(k)),templates:templates,writeEnabled:props.getProperty('ACC_GATEWAY_WRITE_ENABLED')==='true'};
}
function gwFileName_(ctx,name,kind,revision){
 const clean=String(ctx.app['ID / Passport No']||'').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
 const prefix=ACC_GW_PREFIX[kind];
 if(!clean||!prefix||typeof name!=='string'||!name.startsWith(prefix+'_')||!name.endsWith('_'+clean+(revision?'_R'+String(revision).padStart(2,'0'):'')+'.pdf')||!/^[A-Za-z0-9_]+\.pdf$/.test(name))gwFail_('PDF filename mismatch');
}
function gwSet_(wf,fields){
 const data=Object.keys(fields).map(k=>{
  const col=wf.header.indexOf(k);if(!ACC_GW_FIELDS.includes(k)||col<0)gwFail_('Unapproved workflow column');
  let n=col+1,label='';while(n){n--;label=String.fromCharCode(65+n%26)+label;n=Math.floor(n/26)}
  return {range:"'V2_WORKFLOW'!"+label+wf.row,values:[[String(fields[k]||'')]]};
 });
 Sheets.Spreadsheets.Values.batchUpdate({valueInputOption:'RAW',data:data},ACC_GW_SHEET);
}
function gwDispatch_(p,props){
 const ctx=gwContext_(p),wf=ctx.wf,record=wf.record;
 if(p.op==='set_study_mode')return gwStudyMode_(p,ctx);
 const marker=String(record['Offer Letter Remarks']||''),match=marker.match(/; Revision R(\d{2,4})$/),revision=match?Number(match[1]):0;
 if(p.revision!==undefined&&(!Number.isInteger(p.revision)||p.revision<2||p.revision>1000||p.revision!==revision))gwFail_('Revision marker mismatch');
 if(revision&&p.revision!==revision)gwFail_('Revision authorization missing');
 if(p.expectedStudyMode&&gwMode_(ctx.app['Study Mode'])!==p.expectedStudyMode)gwFail_('Study mode changed; review required');
 if(p.op==='preflight'){
  if(!ACC_GW_FIELDS.every(k=>wf.header.includes(k)))gwFail_('Workflow columns missing');
  if(['ISSUED','SENT'].includes(String(record['Offer Letter Status']).toUpperCase())||record['Acceptance Token Hash']||record['Acceptance Signing URL']||record['Offer Letter PDF URL'])gwFail_('Existing LOA requires review');
  DriveApp.getFolderById(ctx.folder).getName();return {ready:true};
 }
 if(p.op==='pdf'){
  if(record['Offer Letter Status']==='ISSUED'||record['Acceptance Token Hash'])gwFail_('Existing LOA requires review');
  const kind=Object.keys(ACC_GW_TEMPLATES).find(k=>ACC_GW_TEMPLATES[k]===p.templateId);
  gwFileName_(ctx,p.name,kind,p.revision);
  const allowed=['{{STUDENT_NAME}}','{{PROGRAMME_NAME}}','{{INTAKE}}','{{IC}}','{{SESSION_MONTH}}','{{SESSION_YEAR}}','{{REF_NO}}','{{OFFER_DATE_LONG}}','{{STUDENT_ADDRESS}}','{{MATRIX_NO}}','Study Mode\t: Full Time'];
  if(!p.replacements||!Object.keys(p.replacements).every(k=>allowed.includes(k)&&typeof p.replacements[k]==='string'&&p.replacements[k].length<=3000))gwFail_('Invalid replacement fields');
  if(kind==='loa'&&p.expectedStudyMode&&p.replacements['Study Mode\t: Full Time']!=='Study Mode\t: '+p.expectedStudyMode.replace('-',' '))gwFail_('Study mode replacement mismatch');
  if(kind!=='loa'&&Object.prototype.hasOwnProperty.call(p.replacements,'Study Mode\t: Full Time'))gwFail_('Study mode replacement only allowed for LOA');
  const folder=DriveApp.getFolderById(ctx.folder);
  if(folder.getFilesByName(p.name).hasNext())gwFail_('Existing PDF requires review');
  const copy=DriveApp.getFileById(p.templateId).makeCopy('TEMP_ACC_LOA_'+Utilities.getUuid(),folder);
  try{
   const changes=Object.keys(p.replacements);
   const replaced=Docs.Documents.batchUpdate({requests:changes.map(k=>({replaceAllText:{containsText:{text:k,matchCase:true},replaceText:p.replacements[k]}}))},copy.getId());
   const modeIdx=changes.indexOf('Study Mode\t: Full Time');
   if(modeIdx>=0&&p.expectedStudyMode==='Part-Time'&&Number(replaced.replies[modeIdx].replaceAllText.occurrencesChanged)!==1)gwFail_('Study mode template anchor missing or ambiguous');
   const pdf=copy.getAs(MimeType.PDF).setName(p.name),bytes=pdf.getBytes();
   if(bytes.length<1000||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')gwFail_('Invalid PDF');
   const file=folder.createFile(pdf);return {id:file.getId(),name:p.name,url:'https://drive.google.com/file/d/'+file.getId()+'/view'};
  }finally{copy.setTrashed(true)}
 }
 if(p.op==='write'){
  const f=p.fields||{}, keys=Object.keys(f);
  if(keys.length===ACC_GW_FIELDS.length&&ACC_GW_FIELDS.every(k=>keys.includes(k))){
   if(record['Offer Letter Status']==='ISSUED'||record['Acceptance Token Hash']||record['Offer Letter PDF URL'])gwFail_('Existing LOA requires review');
   if(p.revision&&f['Offer Letter Remarks']!=='Issued by ACC native LOA engine; SKY matric confirmed; Revision R'+String(p.revision).padStart(2,'0'))gwFail_('Revision write mismatch');
   if(f['Offer Letter Status']!=='ISSUED'||f['Offer Email Status']!=='SENDING'||f['Acceptance Status']!=='PENDING'||!/^https:\/\/drive\.google\.com\/file\/d\/[-\w]+\/view/.test(f['Offer Letter PDF URL']||''))gwFail_('Invalid issuance workflow');
   const tok=(String(f['Acceptance Signing URL']||'').match(/^https:\/\/script\.google\.com\/macros\/s\/AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB\/exec\?page=acceptance-v2&token=([a-f0-9]{64})$/)||[])[1];
   if(!tok||gwHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,tok,Utilities.Charset.UTF_8))!==f['Acceptance Token Hash'])gwFail_('Invalid acceptance token');
  }else if(keys.length===2&&f['Offer Email Status']==='LIVE_SENT_1'&&keys.includes('Offer Email Sent At')){
   if(record['Offer Email Status']!=='GATEWAY_SENDING')gwFail_('No pending gateway send');
  }else gwFail_('Unsupported workflow transition');
  gwSet_(wf,f);return {written:true};
 }
 if(p.op==='send'){
  if(record['Offer Letter Status']!=='ISSUED'||record['Offer Email Status']!=='SENDING'||!record['Acceptance Token Hash'])gwFail_('No pending LOA delivery');
  if(p.recipient!==String(ctx.app['Personal Email']).trim()||!gwEmail_(p.recipient))gwFail_('Recipient mismatch');
  const routes=JSON.parse(props.getProperty('ACC_GATEWAY_CC_ROUTING_JSON')||'{}');
  if(!Array.isArray(routes[p.programmeCode])||JSON.stringify(routes[p.programmeCode])!==JSON.stringify(p.cc)||!p.cc.every(gwEmail_))gwFail_('CC routing not approved');
  if(!Array.isArray(p.files)||p.files.length!==4||new Set(p.files.map(f=>f.id)).size!==4)gwFail_('Four unique PDFs required');
  const kinds=Object.keys(ACC_GW_TEMPLATES);
  const pdfs=p.files.map((item,i)=>{
   gwFileName_(ctx,item.name,kinds[i],p.revision);const file=DriveApp.getFileById(item.id);
   const parents=file.getParents();let inFolder=false;while(parents.hasNext())if(parents.next().getId()===ctx.folder)inFolder=true;
   if(!inFolder||file.getName()!==item.name||file.getMimeType()!==MimeType.PDF)gwFail_('Attachment mismatch');
   return {name:item.name,bytes:file.getBlob().getBytes()};
  });
  if(!String(p.html||'').includes(record['Acceptance Signing URL'].replace(/&/g,'&amp;'))&&!String(p.html||'').includes(record['Acceptance Signing URL']))gwFail_('Missing acceptance link');
  if(!String(p.html||'').includes('Complete Online Acceptance')||!String(p.html||'').includes('IPGS_Official_Email_Header.jpg'))gwFail_('Approved HTML required');
  const mime=gwMime_(p,pdfs);
  // Persistent workflow marker BEFORE Gmail; uncertain delivery never retries.
  gwSet_(wf,{'Offer Email Status':'GATEWAY_SENDING'});
  const sent=Gmail.Users.Messages.send({raw:mime},'me');
  if(!sent||!sent.id)gwFail_('Gmail did not return message ID');
  return {id:sent.id};
 }
 gwFail_('Unsupported operation');
}
function gwMode_(value){const m=String(value||'').trim().replace(/[-\s]+/g,' ').toLowerCase();return m==='full time'?'Full-Time':m==='part time'?'Part-Time':'';}
function gwStudyMode_(p,ctx){
 const next=String(p.studyMode||''),prior=gwMode_(ctx.app['Study Mode']);
 if(!['Full-Time','Part-Time'].includes(next))gwFail_('Invalid study mode');
 if(p.expectedStudyMode!==prior)gwFail_('Study mode changed; refresh record');
 const w=ctx.wf.record;
 if(w['Offer Letter PDF URL']||w['Offer Letter Issued At']||['ISSUED','SENT'].includes(String(w['Offer Letter Status']).toUpperCase())||w['Acceptance Token Hash'])gwFail_('Issued LOA requires controlled revision');
 if(next===prior)return {studyMode:prior,unchanged:true};
 const a=gwRow_('V2_APPLICATIONS',p.referenceNo),ss=a.sh.getParent(),audit=ss.getSheetByName('V2_AUDIT_LOG');
 const h=audit.getRange(1,1,1,audit.getLastColumn()).getDisplayValues()[0];
 const row={'Timestamp':new Date().toISOString(),'Event ID':Utilities.getUuid(),'Reference No':p.referenceNo,'Module':'APPLICATION','Action':'STUDY_MODE_CHANGED','Previous Value JSON':JSON.stringify({studyMode:prior}),'New Value JSON':JSON.stringify({studyMode:next}),'Actor':'ACC Registry Admin','Result':'SUCCESS','Remarks':String(p.reason||'Registry amendment').slice(0,300),'Build Version':'ACC_STUDY_MODE_V1'};
 if(!Object.keys(row).every(k=>h.includes(k)))gwFail_('Audit schema missing');
 const requests=['Study Mode','Last Updated'].map(k=>{const c=a.header.indexOf(k);if(c<0)gwFail_('Application column missing');return {updateCells:{range:{sheetId:a.sh.getSheetId(),startRowIndex:a.row-1,endRowIndex:a.row,startColumnIndex:c,endColumnIndex:c+1},rows:[{values:[{userEnteredValue:{stringValue:k==='Study Mode'?next:row.Timestamp}}]}],fields:'userEnteredValue'}}});
 requests.push({appendCells:{sheetId:audit.getSheetId(),rows:[{values:h.map(k=>row[k]?{userEnteredValue:{stringValue:row[k]}}:{})}],fields:'userEnteredValue'}});
 Sheets.Spreadsheets.batchUpdate({requests:requests},ACC_GW_SHEET);
 return {studyMode:next,previousStudyMode:prior,updatedAt:row.Timestamp};
}
function gwEmail_(s){return typeof s==='string'&&/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(s)}
function gwMime_(p,files){
 const b='acc-'+Utilities.getUuid(),alt=b+'-alt',e='\r\n';
 const b64=s=>Utilities.base64Encode(s,Utilities.Charset.UTF_8);
 const wrap=s=>s.match(/.{1,76}/g).join(e);
 if(typeof p.subject!=='string'||/[\r\n]/.test(p.subject)||p.subject.length>500)gwFail_('Invalid subject');
 let raw='From: "IPGS Admission" <'+ACC_GW_SENDER+'>'+e+'To: '+p.recipient+e+(p.cc.length?'Cc: '+p.cc.join(', ')+e:'')+'Subject: =?UTF-8?B?'+b64(p.subject)+'?='+e+'MIME-Version: 1.0'+e+'Content-Type: multipart/mixed; boundary="'+b+'"'+e+e;
 raw+='--'+b+e+'Content-Type: multipart/alternative; boundary="'+alt+'"'+e+e;
 for(const part of [['plain',p.text],['html',p.html]])raw+='--'+alt+e+'Content-Type: text/'+part[0]+'; charset=UTF-8'+e+'Content-Transfer-Encoding: base64'+e+e+wrap(b64(String(part[1])))+e;
 raw+='--'+alt+'--'+e;
 for(const f of files)raw+='--'+b+e+'Content-Type: application/pdf; name="'+f.name+'"'+e+'Content-Disposition: attachment; filename="'+f.name+'"'+e+'Content-Transfer-Encoding: base64'+e+e+wrap(Utilities.base64Encode(f.bytes))+e;
 raw+='--'+b+'--'+e;return Utilities.base64EncodeWebSafe(raw,Utilities.Charset.UTF_8).replace(/=+$/,'');
}
// Run once manually in the editor as IPGS Admission to authorize access.
// No email, document generation, workflow update or secret output.
function verifyGatewaySetup(){const p=PropertiesService.getScriptProperties();if(Session.getEffectiveUser().getEmail().toLowerCase()!==ACC_GW_SENDER)gwFail_('Wrong account');return gwHealth_(p)}

// Acceptance mail: the only input is a signed request to process one queued acceptance.
// Recipient, document IDs and content derive from the authoritative accepted record.
function gwAcceptanceNext_(){
 const rows=Sheets.Spreadsheets.Values.get(ACC_GW_SHEET,"'V2_WORKFLOW'!A:CX").values||[],h=rows[0]||[];
 const qi=h.indexOf('Acceptance Confirmation Email Status'),ri=h.indexOf('Reference No');
 if(qi<0||ri<0)gwFail_('Acceptance mail schema missing');
 const row=rows.slice(1).find(x=>x[qi]==='GATEWAY_QUEUED');
 if(!row)return {processed:false};
 const ref=String(row[ri]||'');
 const ctx=gwContext_({referenceNo:ref}),w=ctx.wf.record,app=ctx.app;
 if(w['Acceptance Confirmation Email Status']!=='GATEWAY_QUEUED')return {processed:false};
 function set(status,sentAt){const fields={'Acceptance Confirmation Email Status':status,'Acceptance Confirmation Email Sent At':sentAt};const data=Object.keys(fields).map(k=>{let n=ctx.wf.header.indexOf(k)+1,label='';if(n<=0)gwFail_('Acceptance mail column missing');while(n){n--;label=String.fromCharCode(65+n%26)+label;n=Math.floor(n/26)}return {range:"'V2_WORKFLOW'!"+label+ctx.wf.row,values:[[fields[k]]]};});Sheets.Spreadsheets.Values.batchUpdate({valueInputOption:'RAW',data:data},ACC_GW_SHEET);}
 try{
  if(w['Acceptance Status']!=='ACCEPTED'||w['Acceptance Pack Status']!=='ACCEPTED')gwFail_('Acceptance not complete');
  const recipient=String(app['Personal Email']||'').trim();if(!gwEmail_(recipient))gwFail_('Recipient missing');
  const keys=['Acceptance PDF URL','Surat Penerimaan Signed PDF URL','Surat Akuan Signed PDF URL','Student Handbook Acknowledgement Signed PDF URL'];
  const prefixes=['SIGNED_Acceptance_Handbook_','SIGNED_Surat_Penerimaan_','SIGNED_Surat_Akuan_','SIGNED_Student_Handbook_Acknowledgement_'];
  const ids=keys.map(k=>(String(w[k]||'').match(/^https:\/\/drive\.google\.com\/file\/d\/([-\w]+)\/view(?:\?.*)?$/)||[])[1]);
  if(ids.some(x=>!x)||new Set(ids).size!==4)gwFail_('Four unique signed PDFs required');
  const files=ids.map((id,i)=>{const file=DriveApp.getFileById(id),name=file.getName(),parents=file.getParents();let inFolder=false;while(parents.hasNext())if(parents.next().getId()===ctx.folder)inFolder=true;
   if(!inFolder||file.isTrashed()||file.getMimeType()!==MimeType.PDF||!name.startsWith(prefixes[i])||!name.endsWith('.pdf'))gwFail_('Invalid signed PDF');
   const bytes=file.getBlob().getBytes();if(bytes.length<1000||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')gwFail_('Invalid PDF bytes');return {name:name.replace(/[^A-Za-z0-9_.-]/g,'_'),bytes:bytes};});
  const esc=x=>String(x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const subject='[IUC IPGS] Acceptance Successfully Received - '+String(app.Programme||'').replace(/[\r\n]/g,' ').slice(0,300);
  const html='<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden"><div style="background:#2d2363;color:#fff;padding:24px"><h2 style="margin:0">Acceptance Successfully Received</h2></div><div style="padding:24px"><p>Dear <strong>'+esc(app['Student Name'])+'</strong>,</p><p>Thank you. Your acceptance of the IUC postgraduate offer has been successfully recorded.</p><p><strong>Reference:</strong> '+esc(ref)+'<br><strong>Programme:</strong> '+esc(app.Programme)+'<br><strong>Intake:</strong> '+esc(app.Intake)+'</p><p>Your signed admission documents are attached for your record.</p><p>We will contact you regarding the next registration/orientation process.</p><p>Regards,<br><strong>IPGS Registry</strong><br>Innovative University College</p></div></div>';
  const raw=gwMime_({recipient:recipient,cc:[],subject:subject,text:'Your acceptance has been successfully received. Reference: '+ref,html:html},files);
  // Commit the non-retry marker before Gmail. Never automatically retry uncertainty.
  set('GATEWAY_ACCEPTANCE_SENDING','');
  const sent=Gmail.Users.Messages.send({raw:raw},'me');if(!sent||!sent.id)gwFail_('Gmail did not confirm send');
  set('LIVE_SENT_1',new Date().toISOString());return {processed:true,sent:true};
 }catch(err){try{set('REVIEW_REQUIRED','')}catch(ignore){}console.error('Acceptance delivery requires review: '+String(err&&err.message||'Unknown').slice(0,160));return {processed:true,sent:false,reviewRequired:true};}
}
