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
async function fetchLiveSacCandidates(password,sessionId,force=false){const now=Date.now();if(!force&&ADMIN_DATA_CACHE.sacCandidates&&(now-ADMIN_DATA_CACHE.sacCandidatesAt)<SAC_LIVE_CACHE_MS)return cloneCached(ADMIN_DATA_CACHE.sacCandidates);const response=await fetch(ADMIN_BRIDGE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:String(password||''),sessionId:String(sessionId||''),action:'v2ListSacCandidates',data:{},updatedBy:'Admin Data Live SAC Authoritative Read'}),redirect:'follow'});const text=await response.text();let parsed;try{parsed=JSON.parse(text)}catch(_){throw new Error('SAC live read returned HTTP '+response.status+'.')}if(!response.ok||!parsed||parsed.ok===false)throw new Error(parsed?.message||('SAC live read returned HTTP '+response.status+'.'));const payload=parsed?.result?.result||parsed?.result||parsed;const rows=Array.isArray(payload?.candidates)?payload.candidates:[];ADMIN_DATA_CACHE.sacCandidates=cloneCached(rows);ADMIN_DATA_CACHE.sacCandidatesAt=now;return rows;}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method==='GET'&&String(req.query?.health||'')==='1')return res.status(200).json({ok:true,service:'IPGS Unified Admission Admin Data',build:'ADMIN_DATA_RESILIENT_AUTH_20261004'});
  if(req.method!=='POST')return res.status(405).json({ok:false,message:'Method not allowed.'});
  const startedAt=Date.now();let body=req.body||{};if(typeof body==='string'){try{body=JSON.parse(body)}catch(_){body={}}}
  const authStarted=Date.now();if(!(await validateAdminSession(body.password,body.sessionId)))return res.status(401).json({ok:false,message:'Invalid admin password.'});const authMs=Date.now()-authStarted;
  const force=body.force===true,scope=String(body.scope||'full').toLowerCase(),now=Date.now();let data={},warnings=[],v2CacheHit=false;
  const sheetsStarted=Date.now();
  if(scope==='sac')data=await fetchSheets(SAC_SHEETS,warnings);
  else if(!force&&ADMIN_DATA_CACHE.v2&&(now-ADMIN_DATA_CACHE.v2At)<V2_DATA_CACHE_MS){data=cloneCached(ADMIN_DATA_CACHE.v2);v2CacheHit=true;}
  else{data=await fetchSheets(SHEETS,warnings);ADMIN_DATA_CACHE.v2=cloneCached(data);ADMIN_DATA_CACHE.v2At=now;}
  const sheetsMs=Date.now()-sheetsStarted;
  const sacStarted=Date.now();const hasSacSessions=Array.isArray(data.V2_SAC_SESSIONS)&&data.V2_SAC_SESSIONS.length;
  if(scope==='sac'||hasSacSessions){
    const sheetSacCandidates=Array.isArray(data.V2_SAC_CANDIDATES)?cloneCached(data.V2_SAC_CANDIDATES):[];
    try{
      const liveSacCandidates=await fetchLiveSacCandidates(body.password,body.sessionId,scope==='sac'&&force);
      const sheetByRef=new Map(sheetSacCandidates.map(row=>[String(row?.['Reference No']||row?.referenceNo||'').trim(),row]));
      const liveRows=Array.isArray(liveSacCandidates)?liveSacCandidates:[];
      data.V2_SAC_CANDIDATES=(liveRows.length?liveRows:sheetSacCandidates).map(row=>{
        const ref=String(row?.['Reference No']||row?.referenceNo||'').trim();
        const base=sheetByRef.get(ref)||{};
        const merged={...base,...row};
        const sid=String(merged['SAC Session ID']||merged['Session ID']||merged.sacSessionId||merged.sessionId||base['SAC Session ID']||base['Session ID']||'').trim();
        const decision=String(merged['Decision']||merged['Final Decision']||merged['SAC Decision']||merged.decision||merged.finalDecision||merged.sacDecision||'').trim();
        if(ref)merged['Reference No']=ref;
        if(sid)merged['SAC Session ID']=sid;
        if(decision)merged['Decision']=decision;
        return merged;
      });
      if(ADMIN_DATA_CACHE.v2)ADMIN_DATA_CACHE.v2.V2_SAC_CANDIDATES=cloneCached(data.V2_SAC_CANDIDATES);
    }catch(error){
      const fallback=sheetSacCandidates.length?sheetSacCandidates:(Array.isArray(ADMIN_DATA_CACHE.sacCandidates)?ADMIN_DATA_CACHE.sacCandidates:(Array.isArray(ADMIN_DATA_CACHE.v2?.V2_SAC_CANDIDATES)?ADMIN_DATA_CACHE.v2.V2_SAC_CANDIDATES:null));
      if(fallback)data.V2_SAC_CANDIDATES=cloneCached(fallback);
      warnings.push('V2_SAC_CANDIDATES authoritative load: '+(error?.message||'Unable to load')+(fallback?' · retained sheet/cached candidates':''));
    }
  }
  const sacMs=Date.now()-sacStarted;
  if(scope!=='sac'){data.V1_MASTER_DATABASE=[];data.V1_LEGACY_META=[{source:'ARCHIVED_AFTER_UNIFIED_MIGRATION',count:0,readOnly:true,cacheHit:false}];}
  sortSacSessions(data);const totalMs=Date.now()-startedAt;res.setHeader('Server-Timing',`auth;dur=${authMs}, sheets;dur=${sheetsMs}, sac;dur=${sacMs}, total;dur=${totalMs}`);
  return res.status(200).json({ok:true,build:'ADMIN_DATA_RESILIENT_AUTH_20261004',scope,loadedAt:new Date().toISOString(),warnings,cache:{unifiedHit:v2CacheHit,ttlSeconds:30,forced:force},performance:{authMs,sheetsMs,sacMs,totalMs},data});
}
