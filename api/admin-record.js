const SPREADSHEET_ID = '1O-Y-q7_q78xKM1p5e2C3EWyQfYr5rXvhO0oWbVaw5Mw';
const ADMIN_BRIDGE = 'https://anasbukhori.app.n8n.cloud/webhook/iuc-admission-v2-admin-bridge';

const FULL_TARGET_SHEETS = [
  ['V2_APPLICATIONS', 'A'],
  ['V2_WORKFLOW', 'A'],
  ['V2_DOCUMENT_REVIEW', 'A'],
  ['V2_AI_SCREENING', 'A'],
  ['V2_QUALIFICATION_SCREENING', 'A'],
  ['V2_SAC_CANDIDATES', 'B'],
  ['V2_ASSESSMENT_PROGRESS', 'A'],
  ['V2_AUDIT_LOG', 'C']
];
const LIGHT_TARGET_SHEETS = FULL_TARGET_SHEETS.filter(([name]) => !['V2_APPLICATIONS', 'V2_AUDIT_LOG'].includes(name));
const AGENT_EVENTS_CACHE_MS = 8 * 1000;
const agentEventsCache = globalThis.__IPGS_RECORD_AGENT_EVENTS_CACHE__ || { rows: null, at: 0 };
globalThis.__IPGS_RECORD_AGENT_EVENTS_CACHE__ = agentEventsCache;

function parseCsv(text) {
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(ch==='"'){if(quoted&&next==='"'){field+='"';i++;}else quoted=!quoted;continue;}
    if(ch===','&&!quoted){row.push(field);field='';continue;}
    if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(field);if(row.some(v=>String(v||'').trim()!==''))rows.push(row);row=[];field='';continue;}
    field+=ch;
  }
  row.push(field);if(row.some(v=>String(v||'').trim()!==''))rows.push(row);return rows;
}
function toObjects(csv){const rows=parseCsv(csv);if(!rows.length)return[];const headers=rows[0].map(v=>String(v||'').trim());return rows.slice(1).filter(row=>row.some(v=>String(v||'').trim()!=='')).map(row=>{const obj={};headers.forEach((header,i)=>{if(header)obj[header]=row[i]??''});return obj});}
function gvizLiteral(value){return String(value||'').replace(/'/g,"''");}

async function validateAdminSession(password,sessionId){
  if(!password)return false;
  const response=await fetch(ADMIN_BRIDGE,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:String(password||''),sessionId:String(sessionId||''),action:'__AUTH_SESSION__',data:{},updatedBy:'ACC targeted refresh auth'}),redirect:'follow'});
  const text=await response.text();let parsed;try{parsed=JSON.parse(text)}catch(_){return false}
  return response.ok&&parsed&&parsed.ok===true&&parsed.authenticated===true;
}
async function fetchReferenceRows(sheet,column,referenceNo){const tq=`select * where ${column} = '${gvizLiteral(referenceNo)}'`;const url=`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&tq=${encodeURIComponent(tq)}&_=${Date.now()}`;const response=await fetch(url,{redirect:'follow'});if(!response.ok)throw new Error(`${sheet} returned HTTP ${response.status}`);return toObjects(await response.text());}
async function fetchWholeSheet(sheet){const url=`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_=${Date.now()}`;const response=await fetch(url,{redirect:'follow'});if(!response.ok)throw new Error(`${sheet} returned HTTP ${response.status}`);return toObjects(await response.text());}
async function fetchAgentEventsForReference(referenceNo){const now=Date.now();let rows=agentEventsCache.rows;if(!Array.isArray(rows)||(now-Number(agentEventsCache.at||0))>AGENT_EVENTS_CACHE_MS){rows=await fetchWholeSheet('V2_AGENT_EVENTS');agentEventsCache.rows=rows;agentEventsCache.at=now;}const ref=String(referenceNo||'').trim();return rows.filter(row=>String(row?.['Reference No']||row?.['Reference']||row?.referenceNo||'').trim()===ref);}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method==='GET'&&String(req.query?.health||'')==='1')return res.status(200).json({ok:true,service:'IPGS Admission targeted applicant refresh',build:'ADMIN_RECORD_SESSION_FAST_20260928'});
  if(req.method!=='POST')return res.status(405).json({ok:false,message:'Method not allowed.'});
  const startedAt=Date.now();let body=req.body||{};if(typeof body==='string'){try{body=JSON.parse(body)}catch(_){body={}}}
  const password=String(body.password||''),sessionId=String(body.sessionId||'');
  const authStartedAt=Date.now();if(!(await validateAdminSession(password,sessionId)))return res.status(401).json({ok:false,message:'Invalid admin password.'});const authMs=Date.now()-authStartedAt;
  const referenceNo=String(body.referenceNo||'').trim();if(!referenceNo)return res.status(400).json({ok:false,message:'Reference No is required.'});
  const mode=String(body.mode||'full').toLowerCase()==='light'?'light':'full',targetSheets=mode==='light'?LIGHT_TARGET_SHEETS:FULL_TARGET_SHEETS;
  const dataStartedAt=Date.now();const [settled,agentEventsResult]=await Promise.all([
    Promise.allSettled(targetSheets.map(async([sheet,column])=>[sheet,await fetchReferenceRows(sheet,column,referenceNo)])),
    fetchAgentEventsForReference(referenceNo).then(rows=>({ok:true,rows})).catch(error=>({ok:false,error}))
  ]);
  const data={},warnings=[];settled.forEach((result,index)=>{const sheet=targetSheets[index][0];if(result.status==='fulfilled')data[sheet]=result.value[1];else{data[sheet]=[];warnings.push(`${sheet}: ${result.reason?.message||'Unable to load'}`)}});
  if(agentEventsResult.ok)data.V2_AGENT_EVENTS=agentEventsResult.rows;else{data.V2_AGENT_EVENTS=[];warnings.push(`V2_AGENT_EVENTS: ${agentEventsResult.error?.message||'Unable to load'}`)}
  const dataMs=Date.now()-dataStartedAt,totalMs=Date.now()-startedAt;res.setHeader('Server-Timing',`auth;dur=${authMs}, data;dur=${dataMs}, total;dur=${totalMs}`);
  return res.status(200).json({ok:true,build:'ADMIN_RECORD_SESSION_FAST_20260928',mode,referenceNo,loadedAt:new Date().toISOString(),warnings,performance:{authMs,dataMs,totalMs,sheets:targetSheets.length+1},data});
}
