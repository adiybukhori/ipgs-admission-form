/**
 * ACC-native LOA engine.
 * No Google Apps Script call is made here. Deployment disabled until Google
 * OAuth, sender approval, database ledger and synthetic UAT are configured.
 * The original V1 Google Docs remain the one template source.
 */
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { renderPremiumLoaHtml, renderPremiumLoaText } from './loa-premium-email.js';
import {accResolveCoordinator,accProgrammeCode} from './acc-programme-directory.js';

export const LOA_V1_TEMPLATES = Object.freeze({
  loa: '1BXx6GK7XPIbw8tmF8gmeGr8KUL1opFfCmEoC1TXnxwA',
  acceptance: '1JuIwpkPXIebWohnJrBUyJLw5flbVi3nbX0IsOgYlzlg',
  penerimaan: '1-fG3WrLOIpl3yl0Mqt4Geqiw1g6FNwGJ2DvXbtXmUB4',
  akuan: '1dwVfTaHh5Zue_Ob2521ZoGHK-nwIC-WV7yK8p8m7pPc'
});

export function accNativeLoaReadiness(env=process.env) {
  const required = [
    'ACC_LOA_GOOGLE_CLIENT_ID','ACC_LOA_GOOGLE_CLIENT_SECRET',
    'ACC_LOA_GOOGLE_REFRESH_TOKEN','ACC_LOA_SENDER_EMAIL',
    'ACC_LOA_CC_ROUTING_JSON','SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ];
  const missing=required.filter(k=>!String(env[k]||'').trim());
  const approval=String(env.ACC_LOA_NATIVE_READY||'')==='true' &&
    String(env.ACC_LOA_LEGACY_CREDENTIAL_TEXT_APPROVED||'')==='true' &&
    String(env.ACC_LOA_ACCEPTANCE_BACKEND_READY||'')==='true';
  return {ready:!missing.length&&approval,missing,approval};
}
export function accNativeLoaReference(programme,intake,idPassport) {
  const name=String(programme||'');
  const code=accProgrammeCode(name);
  if(!code)throw Error('LOA programme mapping must be approved for this programme.');
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const m=months.findIndex(mon=>new RegExp(mon,'i').test(String(intake||'')));
  const year=(String(intake||'').match(/\b20\d{2}\b/)||[])[0];
  const clean=String(idPassport||'').replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  if(m<0||!year||!clean)throw Error('Programme intake or ID/passport is missing.');
  return {code,clean,reference:'LOA/'+code+'/'+year+String(m+1).padStart(2,'0')+'/'+clean,
    month:months[m],year};
}
export function accNativeLoaValidate(input) {
  const {referenceNo,matricNo,application,workflow}=input||{};
  if(!/^IUC-ADM-[A-Za-z0-9-]{3,160}$/.test(String(referenceNo||'')))throw Error('Valid ACC application reference required.');
  if(!/^\d{7}$/.test(String(matricNo||'')))throw Error('Registry-confirmed seven-digit SKY matric number required.');
  if(!application||String(application['Student Name']||'').trim().length<3)throw Error('LOA blocked: full student name is missing.');
  const email=String(application['Personal Email']||'').trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('LOA blocked: valid student email is missing.');
  if(String(application.Programme||'').trim().length<8)throw Error('LOA blocked: approved programme is missing.');
  if(!/\b20\d{2}\b/.test(String(application.Intake||'')))throw Error('LOA blocked: intake month/year is incomplete.');
  if(!String(application['Study Mode']||'').trim())throw Error('LOA blocked: mode of study is missing.');
  if(String(application['ID / Passport No']||'').trim().length<5)throw Error('LOA blocked: identification or passport details are missing.');
  let raw={};try{raw=JSON.parse(String(application['Raw Application JSON']||'{}'))}catch{}
  if(String(raw.fullAddress||raw.address||'').trim().length<8)throw Error('LOA blocked: student address is missing from the application.');
  if(!String(application['Student Folder URL']||'').includes('drive.google.com'))throw Error('LOA blocked: student Drive folder is missing.');
  const status=String(workflow?.['Offer Letter Status']||'').toUpperCase();
  if(['ISSUED','SENT'].includes(status)||workflow?.['Offer Letter PDF URL']||workflow?.['Offer Letter Issued At'])
    throw Error('LOA already issued; open the existing PDF.');
  // SAC/IA/Prerequisite status intentionally does not gate an LOA.
  const recorded=String(workflow?.['SKY Student ID']||'').trim();
  if(recorded&&recorded!==matricNo)throw Error('Conflict with existing SKY Student ID.');
  const folderId=(String(application['Student Folder URL']).match(/\/folders\/([-\w]+)/)||[])[1];
  if(!folderId)throw Error('Student folder URL is invalid.');
  return {folderId,...accNativeLoaReference(application.Programme,application.Intake,application['ID / Passport No'])};
}

async function getGoogleToken(env) {
  const params=new URLSearchParams({client_id:env.ACC_LOA_GOOGLE_CLIENT_ID,
    client_secret:env.ACC_LOA_GOOGLE_CLIENT_SECRET,refresh_token:env.ACC_LOA_GOOGLE_REFRESH_TOKEN,
    grant_type:'refresh_token'});
  const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params.toString()});
  const json=await response.json().catch(()=>({}));
  if(!response.ok||!json.access_token)throw Error('ACC LOA Google OAuth authentication failed.');
  return json.access_token;
}
async function googleJson(url,token,method='GET',body) {
  const response=await fetch(url,{method,headers:{Authorization:'Bearer '+token,
    ...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const content=await response.text();
  let json={};try{json=JSON.parse(content)}catch{}
  if(!response.ok)throw Error('ACC Google API error '+response.status+': '+String(json.error?.message||'Request failed').slice(0,170));
  return json;
}
async function createTemplatePdf(token,templateId,folderId,fileName,replacements) {
  const base='https://www.googleapis.com/drive/v3/files/';
  const copy=await googleJson(base+encodeURIComponent(templateId)+'/copy?fields=id,name',token,'POST',
    {name:'TEMP_ACC_LOA_'+randomUUID(),parents:[folderId]});
  const docId=copy.id;
  try{
    const requests=Object.entries(replacements).map(([key,value])=>({
      replaceAllText:{containsText:{text:key,matchCase:true},replaceText:String(value??'')}
    }));
    await googleJson('https://docs.googleapis.com/v1/documents/'+encodeURIComponent(docId)+':batchUpdate',
      token,'POST',{requests});
    const pdfRes=await fetch(base+encodeURIComponent(docId)+'/export?mimeType=application%2Fpdf',
      {headers:{Authorization:'Bearer '+token}});
    if(!pdfRes.ok)throw Error('Could not export original template to PDF.');
    const pdf=Buffer.from(await pdfRes.arrayBuffer());
    if(pdf.length<1000||pdf.subarray(0,5).toString()!=='%PDF-')throw Error('Invalid PDF created from original template.');
    const boundary='acc-loa-'+randomUUID();
    const meta=Buffer.from('--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+
      JSON.stringify({name:fileName,mimeType:'application/pdf',parents:[folderId]})+'\r\n--'+boundary+
      '\r\nContent-Type: application/pdf\r\n\r\n');
    const tail=Buffer.from('\r\n--'+boundary+'--');
    const uploaded=await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
      {method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'multipart/related; boundary='+boundary},
       body:Buffer.concat([meta,pdf,tail])});
    const info=await uploaded.json().catch(()=>({}));
    if(!uploaded.ok||!info.id)throw Error('Unable to store ACC LOA PDF in student Drive folder.');
    return {id:info.id,name:fileName,bytes:pdf,url:info.webViewLink||
      'https://drive.google.com/file/d/'+info.id+'/view'};
  }finally{
    // Only the temporary editable copy is deleted; the source template stays untouched.
    await fetch(base+encodeURIComponent(docId),{method:'DELETE',headers:{Authorization:'Bearer '+token}}).catch(()=>{});
  }
}
function encodeHeader(value){return '=?UTF-8?B?'+Buffer.from(String(value),'utf8').toString('base64')+'?=';}
function wrap64(s){return s.replace(/.{1,76}/g,'$&\r\n').trim();}
function makeMime(sender,recipient,cc,subject,body,html,files){
  const boundary='ipgs-loa-'+randomUUID(),altBoundary='ipgs-loa-alt-'+randomUUID(),eol='\r\n';
  if(!String(html||'').includes('Complete Online Acceptance')||
     !String(html||'').includes('IPGS_Official_Email_Header.jpg')||
     !String(html||'').includes('href="https://innovative.vialing.com/sp/login"')||files.length!==4)
    throw Error('Approved premium Registry LOA HTML and four PDFs are required.');
  // Registry-approved change: official LOA now uses IPGS Admission as the From display name.
  // ACC must be authorised to send as the verified IPGS Admission address.
  const from='"IPGS Admission" <'+String(sender).trim()+'>';
  let raw='From: '+from+eol+'To: '+recipient+eol+(cc.length?'Cc: '+cc.join(', ')+eol:'')+
    'Subject: '+encodeHeader(subject)+eol+'MIME-Version: 1.0'+eol+
    'Content-Type: multipart/mixed; boundary="'+boundary+'"'+eol+eol;
  raw+='--'+boundary+eol+'Content-Type: multipart/alternative; boundary="'+altBoundary+'"'+eol+eol;
  raw+='--'+altBoundary+eol+'Content-Type: text/plain; charset=UTF-8'+eol+
    'Content-Transfer-Encoding: base64'+eol+eol+wrap64(Buffer.from(body,'utf8').toString('base64'))+eol;
  raw+='--'+altBoundary+eol+'Content-Type: text/html; charset=UTF-8'+eol+
    'Content-Transfer-Encoding: base64'+eol+eol+wrap64(Buffer.from(html,'utf8').toString('base64'))+eol;
  raw+='--'+altBoundary+'--'+eol;
  for(const f of files){
    raw+='--'+boundary+eol+'Content-Type: application/pdf; name="'+f.name+'"'+eol+
      'Content-Disposition: attachment; filename="'+f.name+'"'+eol+
      'Content-Transfer-Encoding: base64'+eol+eol+wrap64(f.bytes.toString('base64'))+eol;
  }
  raw+='--'+boundary+'--'+eol;
  return Buffer.from(raw,'utf8').toString('base64url');
}
async function supaRequest(env,method,path,body,prefer='return=representation'){
  const url=String(env.SUPABASE_URL).replace(/\/$/,'')+'/rest/v1/'+path;
  const r=await fetch(url,{method,headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type':'application/json',Prefer:prefer},
    body:body?JSON.stringify(body):undefined});
  const s=await r.text();let obj=[];try{obj=s?JSON.parse(s):[]}catch{}
  if(!r.ok)throw Error('ACC LOA ledger unavailable (HTTP '+r.status+'). Check migration and RLS.');
  return obj;
}
async function ledgerUpdate(env,referenceNo,status,data){
  await supaRequest(env,'PATCH','acc_loa_issuance?reference_no=eq.'+encodeURIComponent(referenceNo),
    {status,...data,updated_at:new Date().toISOString()});
}
async function prepareWorkflowSheetWrite(token,referenceNo,fields) {
  const sheetId='1O-Y-q7_q78xKM1p5e2C3EWyQfYr5rXvhO0oWbVaw5Mw';
  const base='https://sheets.googleapis.com/v4/spreadsheets/'+sheetId;
  const values=await googleJson(base+'/values/'+encodeURIComponent("'V2_WORKFLOW'!A1:CX4000"),token);
  const rows=values.values||[],headers=rows[0]||[];
  const rowIndex=rows.findIndex((r,i)=>i>0&&String(r[headers.indexOf('Reference No')]||'').trim()===referenceNo);
  if(rowIndex<1)throw Error('ACC workflow row not found; no LOA may be sent.');
  if(rows.filter((r,i)=>i>0&&String(r[headers.indexOf('Reference No')]||'').trim()===referenceNo).length!==1)throw Error('Duplicate ACC workflow rows; no LOA may be sent.');
  const pending=Object.entries(fields).map(([header,value])=>{
    const col=headers.indexOf(header);if(col<0)throw Error('ACC workflow column missing: '+header);
    let n=col+1,label='';while(n){n--;label=String.fromCharCode(65+n%26)+label;n=Math.floor(n/26)}
    return {range:"'V2_WORKFLOW'!"+label+(rowIndex+1),values:[[String(value||'')]]};
  });
  return {base,pending};
}
async function updateWorkflowSheet(token,referenceNo,fields){
  const {base,pending}=await prepareWorkflowSheetWrite(token,referenceNo,fields);
  await googleJson(base+'/values:batchUpdate',token,'POST',{valueInputOption:'RAW',data:pending});
}
export async function issueAccNativeLoa({referenceNo,matricNo,application,workflow,actor,
  coordinator,emailContract,env=process.env}){
  if(env.VERCEL_ENV!=='production')throw Error('Native ACC LOA writes are disabled outside production.');
  const readiness=accNativeLoaReadiness(env);
  if(!readiness.ready)throw Error('ACC native LOA is not configured and approved: '+readiness.missing.join(', '));
  const prepared=accNativeLoaValidate({referenceNo,matricNo,application,workflow});
  // Second independent gate: no verified active coordinator, no documents,
  // no Gmail, no ledger claim. Never use preview seeds here.
  const verifiedCoordinator=accResolveCoordinator(application.Programme,coordinator?[{
    programme_code:coordinator.code,programme_name:coordinator.programmeName,
    level:coordinator.level,coordinator_name:coordinator.name,
    coordinator_email:coordinator.email,coordinator_role:coordinator.role,is_active:true
  }]:[]);
  // ACC owns issuance and token creation. The existing signing-only backend
  // validates this hash, consumes it exactly once and preserves SAC stage.
  // Do not reuse or expose an old token, and do not call legacy LOA preparation.
  if(String(workflow?.['Acceptance Status']||'').toUpperCase()==='ACCEPTED')throw Error('LOA blocked: acceptance already recorded.');
  if(String(workflow?.['Acceptance Token Hash']||'').trim()||String(workflow?.['Acceptance Signing URL']||'').trim())throw Error('LOA blocked: an existing acceptance token requires Registry review.');
  const acceptanceToken=randomBytes(32).toString('hex');
  const acceptanceHash=createHash('sha256').update(acceptanceToken,'utf8').digest('hex');
  const acceptanceUrl='https://script.google.com/macros/s/AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB/exec?page=acceptance-v2&token='+acceptanceToken;
  // Render before external side effects.
  renderPremiumLoaText({studentName:application['Student Name'],
    programme:application.Programme,intake:application.Intake,
    studyMode:application['Study Mode'],matricNo,coordinator:verifiedCoordinator,
    acceptanceUrl,
    preview:false});
  if(!emailContract||typeof emailContract!=='function')throw Error('Verified V1 email contract required.');
  let ccConfig;try{ccConfig=JSON.parse(env.ACC_LOA_CC_ROUTING_JSON)}catch{throw Error('Registry CC routing is not valid JSON.')}
  const cc=ccConfig[prepared.code];
  if(!Array.isArray(cc)||!cc.every(x=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))){
    throw Error('Registry CC routing not approved for programme '+prepared.code);
  }
  const token=await getGoogleToken(env);
  // Verify the target workflow row and all write columns before PDF or mail work.
  const initialWorkflowFields={'Offer Letter Status':'ISSUED','Offer Letter PDF URL':'',
    'Offer Letter Issued At':'','Offer Email Status':'SENDING','Offer Email Sent At':'',
    'Offer Letter Remarks':'Issued by ACC native LOA engine; SKY matric confirmed',
    'Acceptance Token Hash':acceptanceHash,'Acceptance Signing URL':acceptanceUrl,'Acceptance Status':'PENDING'};
  await prepareWorkflowSheetWrite(token,referenceNo,initialWorkflowFields);
  // Unique reference number reservation is fail-closed. A second click cannot
  // overwrite or re-send any prior attempt, even after an uncertain Gmail result.
  const claimed=await supaRequest(env,'POST','acc_loa_issuance?on_conflict=reference_no',
    [{reference_no:referenceNo,matric_no:matricNo,status:'PREPARING',actor:String(actor||'Registry'),
      created_at:new Date().toISOString()}],
    'return=representation,resolution=ignore-duplicates');
  if(!Array.isArray(claimed)||claimed.length!==1)throw Error('LOA already claimed; open existing record or ask Registry to review.');
  let files=[],mailResult=null;
  try {
    let raw={};try{raw=JSON.parse(String(application['Raw Application JSON']||'{}'))}catch{}
    const studentName=String(application['Student Name']||'').trim();
    const prog=String(application.Programme||'').replace(/^\s*[A-Za-z][A-Za-z0-9]{1,14}\s*[-–]\s*/,'').trim();
    const date=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',
      timeZone:'Asia/Kuala_Lumpur'}).format(new Date());
    const common={'{{STUDENT_NAME}}':studentName,'{{PROGRAMME_NAME}}':prog,
      '{{INTAKE}}':String(application.Intake||''),'{{IC}}':String(application['ID / Passport No']||''),
      '{{SESSION_MONTH}}':prepared.month,'{{SESSION_YEAR}}':prepared.year};
    const specs=[
      [LOA_V1_TEMPLATES.loa,'LOA_'+prepared.code+'_'+prepared.clean+'.pdf',
        {...common,'{{REF_NO}}':prepared.reference,'{{OFFER_DATE_LONG}}':date,
          '{{STUDENT_ADDRESS}}':String(raw.fullAddress||raw.address||''),
          '{{MATRIX_NO}}':matricNo}],
      [LOA_V1_TEMPLATES.acceptance,'Acceptance_EN_'+prepared.code+'_'+prepared.clean+'.pdf',common],
      [LOA_V1_TEMPLATES.penerimaan,'Surat_Penerimaan_'+prepared.code+'_'+prepared.clean+'.pdf',common],
      [LOA_V1_TEMPLATES.akuan,'Surat_Akuan_'+prepared.code+'_'+prepared.clean+'.pdf',common]
    ];
    for(const [template,name,replacements] of specs){
      const file=await createTemplatePdf(token,template,prepared.folderId,name,replacements);
      files.push(file);
    }
    await ledgerUpdate(env,referenceNo,'PDFS_READY',{pdf_files:files.map(f=>({name:f.name,id:f.id,url:f.url}))});
    const email=emailContract(application.Programme,matricNo,prepared.code,application['ID / Passport No']);
    if(email.attachmentNames.join('|')!==files.map(x=>x.name).join('|'))throw Error('Four PDF filenames do not match legacy Registry contract.');
    await ledgerUpdate(env,referenceNo,'SENDING',{recipient:String(application['Personal Email'])});
    // Do not send before the portal has a valid, committed token and PDF link.
    // Each student must receive a working, individually tokenised e-sign link.
    // Never fall back to a generic Acceptance Form or token-less public portal.
    const messageContext={studentName:application['Student Name'],
      programme:application.Programme,intake:application.Intake,
      studyMode:application['Study Mode'],matricNo,acceptanceUrl,
      coordinator:verifiedCoordinator,preview:false};
    const emailHtml=renderPremiumLoaHtml(messageContext);
    const emailText=renderPremiumLoaText(messageContext);
    const rawMime=makeMime(env.ACC_LOA_SENDER_EMAIL,String(application['Personal Email']).trim(),
      cc,email.subject,emailText,emailHtml,files);
    await updateWorkflowSheet(token,referenceNo,{...initialWorkflowFields,
      'Offer Letter PDF URL':files[0].url,'Offer Letter Issued At':new Date().toISOString()});
    const sent=await googleJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      token,'POST',{raw:rawMime});
    if(!sent.id)throw Error('Gmail did not return message ID.');
    mailResult={id:sent.id};
    await ledgerUpdate(env,referenceNo,'SENT',{gmail_message_id:sent.id,sent_at:new Date().toISOString()});
    // Never mutate Application Stage, SAC Decision, IA or Prerequisite fields.
    await updateWorkflowSheet(token,referenceNo,{
      'Offer Email Status':'LIVE_SENT_1','Offer Email Sent At':new Date().toISOString()});
    return {ok:true,referenceNo,offerLetterStatus:'ISSUED',offerLetterPdfUrl:files[0].url,
      attachmentCount:4,attachmentUrls:files.map(f=>f.url),emailSent:true,
      emailMessageId:mailResult.id,matricNo,sacStagePreserved:true};
  } catch(error){
    await ledgerUpdate(env,referenceNo,'REVIEW_REQUIRED',{
      pdf_files:files.map(f=>({name:f.name,id:f.id,url:f.url})),
      failure_reason:String(error?.message||'Unknown').slice(0,300),
      gmail_message_id:mailResult?.id||null}).catch(()=>{});
    // Never automatically retry after a potential Gmail delivery.
    throw Error('ACC LOA requires manual review. No automatic retry: '+String(error?.message||'Failed'));
  }
}
