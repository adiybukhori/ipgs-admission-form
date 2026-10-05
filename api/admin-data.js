import { timingSafeEqual } from 'crypto';

const SPREADSHEET_ID = '1O-Y-q7_q78xKM1p5e2C3EWyQfYr5rXvhO0oWbVaw5Mw';
const ADMIN_BRIDGE = 'https://anasbukhori.app.n8n.cloud/webhook/iuc-admission-v2-admin-bridge';
const LEGACY_AUTH_WEB_APP = 'https://script.google.com/macros/s/AKfycbw22-UOsHkaap3dzU16aOjA6XFr7jWGr9qQPfp8F1CQrXboP7YdRZJKKJhHijC3us4/exec';

const SHEETS = [
  'V2_APPLICATIONS','V2_WORKFLOW','V2_DOCUMENT_REVIEW','V2_AI_SCREENING','V2_QUALIFICATION_SCREENING',
  'V2_AGENT_EVENTS','V2_AGENT_EXECUTIONS','V2_HUMAN_TASKS','V2_MANAGEMENT_INTELLIGENCE','V2_SAC_SESSIONS',
  'V2_SAC_CANDIDATES','SAC_COMMITTEE_MASTER','AGENT_MASTER','FEE_GROUP_MASTER','V2_ASSESSMENT_PROGRESS',
  'V2_INTAKE_MASTER','V2_ORIENTATION_SESSIONS','V2_ORIENTATION_TRACKING','V2_ORIENTATION_WALKINS',
  'V2_HANDOVER_BATCHES','V2_HANDOVER_STUDENTS','V2_PROVISIONING','V2_ACADEMIC_PORTAL','V2_AUDIT_LOG'
];
const SAC_SHEETS=['V2_SAC_SESSIONS','V2_SAC_CANDIDATES','SAC_COMMITTEE_MASTER'];
const ADMIN_DATA_CACHE=globalThis.__IPGS_ADMIN_DATA_CACHE__||(globalThis.__IPGS_ADMIN_DATA_CACHE__={v2:null,v2At:0,sacCandidates:null,sacCandidatesAt:0});
const V2_DATA_CACHE_MS=30*1000,SAC_LIVE_CACHE_MS=5*1000;

function cloneCached(value){return JSON.parse(JSON.stringify(value));}
function parseCsv(text){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i],next=text[i+1];if(ch==='"'){if(quoted&&next==='"'){field+='"';i++;}else quoted=!quoted;continue;}if(ch===','&&!quoted){row.push(field);field='';continue;}if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(field);if(row.some(v=>String(v||'').trim()!==''))rows.push(row);row=[];field='';continue;}field+=ch;}row.push(field);if(row.some(v=>String(v||'').trim()!==''))rows.push(row);return rows;}
function toObjects(csv){const rows=parseCsv(csv);if(!rows.length)return[];const headers=rows[0].map(v=>String(v||'').trim());return rows.slice(1).filter(row=>row.some(v=>String(v||'').trim()!=='')).map(row=>{const obj={};headers.forEach((h,i)=>{if(h)obj[h]=row[i]??''});return obj});}
function sacSessionSortValue(row){const meetingValue=Date.parse([String(row?.['Meeting Date']||'').trim(),String(row?.['Meeting Time']||'').trim()].filter(Boolean).join(' '));if(Number.isFinite(meetingValue))return meetingValue;const createdValue=Date.parse(String(row?.['Created At']||'').trim());return Number.isFinite(createdValue)?createdValue:0;}
function sortSacSessions(data){if(Array.isArray(data.V2_SAC_SESSIONS))data.V2_SAC_SESSIONS.sort((a,b)=>{const d=sacSessionSortValue(b)-sacSessionSortValue(a);if(d!==0)return d;return(Date.parse(String(b?.['Created At']||''))||0)-(Date.parse(String(a?.['Created At']||''))||0)});}
function safeEqual(a,b){const left=Buffer.from(String(a||''));const right=Buffer.from(String(b||''));if(!left.length||left.length!==right.length)return false;return timingSafeEqual(left,right);}

async function fetchWithTimeout(url,options,timeoutMs){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{return await fetch(url,{...(options||{}),signal:controller.signal});}
  finally{clearTimeout(timer);}
}

async function validateLegacyAdminPassword(password){
  if(!password)return false;
  try{
    const url=`${LEGACY_AUTH_WEB_APP}?action=applications&token=${encodeURIComponent(String(password||''))}&_=${Date.now()}`;
    const response=await fetchWithTimeout(url,{redirect:'follow'},6500);
    const text=await response.text();let parsed;try{parsed=JSON.parse(text)}catch(_){return false;}
    return response.ok&&parsed&&parsed.ok===true;
  }catch(_){return false;}
}

async function validateAdminSession(password,sessionId){
  if(!password)return false;
  const localSecret=String(process.env.V2_ADMIN_API_PASSWORD||'');
  if(localSecret&&safeEqual(password,localSecret))return true;
  try{
    const response=await fetchWithTimeout(ADMIN_BRIDGE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:String(password||''),sessionId:String(sessionId||''),action:'__AUTH_SESSION__',data:{},updatedBy:'ACC admin data auth'}),redirect:'follow'},4500);
    const text=await response.text();let parsed;try{parsed=JSON.parse(text)}catch(_){parsed=null;}
    if(response.ok&&parsed&&parsed.ok===true&&parsed.authenticated===true)return true;
  }catch(_){}
  return validateLegacyAdminPassword(password);
}

async function fetchSheet(sheet){const url=`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_=${Date.now()}`;const response=await fetch(url,{redirect:'follow'});if(!response.ok)throw new Error(`${sheet} returned HTTP ${response.status}`);return toObjects(await response.text());}
async function fetchSheets(names,warnings){const data={};const settled=await Promise.allSettled(names.map(async sheet=>[sheet,await fetchSheet(sheet)]));settled.forEach((result,index)=>{const sheet=names[index];if(result.status==='fulfilled'){const[name,rows]=result.value;data[name]=rows}else{data[sheet]=[];warnings.push(`${sheet}: ${result.reason?.message||'Unable to load'}`)}});return data;}

function supabaseConfig(){
  const url=String(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');
  const key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY||'');
  return url&&key?{url,key}:null;
}
async function supabaseGet(path){
  const cfg=supabaseConfig();if(!cfg)throw new Error('Supabase is not configured.');
  const response=await fetchWithTimeout(`${cfg.url}/rest/v1/${path}`,{headers:{apikey:cfg.key,Authorization:`Bearer ${cfg.key}`,'Content-Type':'application/json'}},6500);
  const text=await response.text();let parsed;try{parsed=text?JSON.parse(text):[]}catch(_){throw new Error(`Supabase returned HTTP ${response.status}.`)}
  if(!response.ok)throw new Error(parsed?.message||`Supabase returned HTTP ${response.status}.`);return parsed;
}
function mapSupabaseSession(row,candidateCount){return{
  'SAC Session ID':row.legacy_session_id||'', 'SAC Name':row.sac_name||'', 'Meeting Date':row.meeting_date||'', 'Meeting Time':row.meeting_time||'',
  'Status':row.status||'DRAFT','Chairperson':row.chairperson||'','Venue / Meeting Link':row.venue||'','Candidate Count':String(candidateCount||0),
  'Minutes URL':row.minutes_url||'','Endorsement URL':row.endorsement_url||'','Created At':row.created_at||'','Created By':row.created_by||'',
  'Finalised At':row.finalised_at||'','Meeting Mode':row.meeting_mode||'','Committee Emails':Array.isArray(row.committee_emails)?row.committee_emails.join(', '):'',
  'Calendar Status':row.calendar_status||'','Invitation Mode':row.invitation_mode||'','Invitation Sent At':row.invitation_sent_at||'',
  'SAC Folder URL':row.sac_folder_url||'','SAC Pack URL':row.sac_pack_url||'','Last Updated':row.updated_at||''
}}
function mapSupabaseCandidate(row,sessionLegacyId){return{
  'SAC Session ID':sessionLegacyId||'', 'Reference No':row.reference_no||'', 'Student Name':row.student_name||'', 'Programme':row.programme||'',
  'Form 01 URL':row.form_01_url||'','Transcript URL':row.transcript_url||'','Certificate URL':row.certificate_url||'',
  'Screening Recommendation':row.screening_recommendation||'','Decision':row.decision||'PENDING','Priority':row.priority||'NORMAL',
  'Reviewer Remarks':row.reviewer_remarks||'','Decision At':row.decision_at||'','Decision By':row.decision_by||'','Letter Action':row.letter_action||'',
  'Letter Issued At':row.letter_issued_at||'','Document Pack Status':row.document_pack_status||'','Missing Document Count':String(row.missing_document_count||0),
  'Missing Documents JSON':JSON.stringify(row.missing_documents||[]),'Pack Prepared At':row.pack_prepared_at||''
}}
async function fetchSupabaseSac(){
  const [sessions,candidates]=await Promise.all([supabaseGet('sac_sessions?select=*&order=meeting_date.desc.nullslast,created_at.desc'),supabaseGet('sac_candidates?select=*&order=created_at.asc')]);
  const sessionById=new Map((sessions||[]).map(s=>[String(s.id),s]));
  const counts=new Map();for(const c of (candidates||[])){const id=String(c.sac_session_id||'');counts.set(id,(counts.get(id)||0)+1)}
  return{
    sessions:(sessions||[]).filter(s=>!s.is_hidden).map(s=>mapSupabaseSession(s,counts.get(String(s.id))||0)),
    candidates:(candidates||[]).map(c=>mapSupabaseCandidate(c,sessionById.get(String(c.sac_session_id))?.legacy_session_id||''))
  };
}

async function fetchLiveSacCandidates(password,sessionId,force=false){const now=Date.now();if(!force&&ADMIN_DATA_CACHE.sacCandidates&&(now-ADMIN_DATA_CACHE.sacCandidatesAt)<SAC_LIVE_CACHE_MS)return cloneCached(ADMIN_DATA_CACHE.sacCandidates);const response=await fetch(ADMIN_BRIDGE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:String(password||''),sessionId:String(sessionId||''),action:'v2ListSacCandidates',data:{},updatedBy:'Admin Data Live SAC Authoritative Read'}),redirect:'follow'});const text=await response.text();let parsed;try{parsed=JSON.parse(text)}catch(_){throw new Error('SAC live read returned HTTP '+response.status+'.')}if(!response.ok||!parsed||parsed.ok===false)throw new Error(parsed?.message||('SAC live read returned HTTP '+response.status+'.'));const payload=parsed?.result?.result||parsed?.result||parsed;const rows=Array.isArray(payload?.candidates)?payload.candidates:[];ADMIN_DATA_CACHE.sacCandidates=cloneCached(rows);ADMIN_DATA_CACHE.sacCandidatesAt=now;return rows;}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method==='GET'&&String(req.query?.health||'')==='1')return res.status(200).json({ok:true,service:'IPGS Unified Admission Admin Data',build:'ADMIN_DATA_SAC_DUAL_WRITE_GUARD_20261005'});
  if(req.method!=='POST')return res.status(405).json({ok:false,message:'Method not allowed.'});
  const startedAt=Date.now();let body=req.body||{};if(typeof body==='string'){try{body=JSON.parse(body)}catch(_){body={}}}
  const authStarted=Date.now();if(!(await validateAdminSession(body.password,body.sessionId)))return res.status(401).json({ok:false,message:'Invalid admin password.'});const authMs=Date.now()-authStarted;
  const force=body.force===true,scope=String(body.scope||'full').toLowerCase(),now=Date.now();let data={},warnings=[],v2CacheHit=false;
  const sheetsStarted=Date.now();
  if(scope==='sac'){
    data=await fetchSheets(['SAC_COMMITTEE_MASTER'],warnings);
  } else if(!force&&ADMIN_DATA_CACHE.v2&&(now-ADMIN_DATA_CACHE.v2At)<V2_DATA_CACHE_MS){data=cloneCached(ADMIN_DATA_CACHE.v2);v2CacheHit=true;}
  else{data=await fetchSheets(SHEETS,warnings);ADMIN_DATA_CACHE.v2=cloneCached(data);ADMIN_DATA_CACHE.v2At=now;}
  const sheetsMs=Date.now()-sheetsStarted;
  const sacStarted=Date.now();
  try{
    const supa=await fetchSupabaseSac();
    data.V2_SAC_SESSIONS=supa.sessions;
    data.V2_SAC_CANDIDATES=supa.candidates;
    if(ADMIN_DATA_CACHE.v2){ADMIN_DATA_CACHE.v2.V2_SAC_SESSIONS=cloneCached(supa.sessions);ADMIN_DATA_CACHE.v2.V2_SAC_CANDIDATES=cloneCached(supa.candidates);}
  }catch(error){
    warnings.push('Supabase SAC read: '+(error?.message||'Unable to load')+' · falling back to Google Sheet / bridge');
    if(scope==='sac'){
      const fallback=await fetchSheets(['V2_SAC_SESSIONS','V2_SAC_CANDIDATES'],warnings);Object.assign(data,fallback);
    }
    const hasSacSessions=Array.isArray(data.V2_SAC_SESSIONS)&&data.V2_SAC_SESSIONS.length;
    if(scope==='sac'||hasSacSessions){
      const sheetSacCandidates=Array.isArray(data.V2_SAC_CANDIDATES)?cloneCached(data.V2_SAC_CANDIDATES):[];
      try{const liveSacCandidates=await fetchLiveSacCandidates(body.password,body.sessionId,scope==='sac'&&force);if(Array.isArray(liveSacCandidates)&&liveSacCandidates.length)data.V2_SAC_CANDIDATES=liveSacCandidates;}catch(_){}
      if(!Array.isArray(data.V2_SAC_CANDIDATES)||!data.V2_SAC_CANDIDATES.length)data.V2_SAC_CANDIDATES=sheetSacCandidates;
    }
  }
  if(scope!=='sac'&&Array.isArray(data.V2_WORKFLOW)&&Array.isArray(data.V2_SAC_CANDIDATES)){
    const decided=new Map(data.V2_SAC_CANDIDATES.filter(c=>String(c['Decision']||'').toUpperCase()&&String(c['Decision']||'').toUpperCase()!=='PENDING').map(c=>[String(c['Reference No']||''),String(c['Decision']||'').toUpperCase()]));
    data.V2_WORKFLOW=data.V2_WORKFLOW.map(w=>{
      const ref=String(w['Reference No']||w['Reference']||''),d=decided.get(ref);if(!d)return w;
      const expected=d==='DIRECT_ENTRY'?'ELIGIBLE_FOR_OFFER':d==='INTERNAL_ASSESSMENT'?'INTERNAL_ASSESSMENT':d==='REJECTED'?'REJECTED':'';
      const backendDecision=String(w['SAC Decision']||'').toUpperCase(),backendStage=String(w['Application Stage']||'').toUpperCase();
      const synced=!!expected&&backendDecision===d&&backendStage===expected;
      return {...w,'SAC Supabase Decision':d,'SAC Expected Stage':expected,'SAC Sync Status':synced?'SYNCED':'PENDING_BACKEND_SYNC','Pending SAC Decision':synced?'':d};
    });
  }
  const sacMs=Date.now()-sacStarted;
  if(scope!=='sac'){data.V1_MASTER_DATABASE=[];data.V1_LEGACY_META=[{source:'ARCHIVED_AFTER_UNIFIED_MIGRATION',count:0,readOnly:true,cacheHit:false}];}
  sortSacSessions(data);const totalMs=Date.now()-startedAt;res.setHeader('Server-Timing',`auth;dur=${authMs}, sheets;dur=${sheetsMs}, sac;dur=${sacMs}, total;dur=${totalMs}`);
  return res.status(200).json({ok:true,build:'ADMIN_DATA_SAC_DUAL_WRITE_GUARD_20261005',scope,loadedAt:new Date().toISOString(),warnings,cache:{unifiedHit:v2CacheHit,ttlSeconds:30,forced:force},performance:{authMs,sheetsMs,sacMs,totalMs},data});
}
