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
function supabaseConfig(){const url=String(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');const key=String(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY||'');return url&&key?{url,key}:null;}
async function fetchSupabaseOperational(referenceNo){
  const cfg=supabaseConfig();if(!cfg)return {candidate:null,state:null,assessments:[],documentBundles:[],documentVersions:[]};
  const h={apikey:cfg.key,Authorization:`Bearer ${cfg.key}`,'Content-Type':'application/json'},q=encodeURIComponent(referenceNo);
  const [cr,sr,ar,br,vr]=await Promise.all([
    fetch(`${cfg.url}/rest/v1/sac_candidates?select=reference_no,student_name,programme,sac_session_id,decision,decision_at,decision_by&reference_no=eq.${q}&order=decision_at.desc.nullslast,updated_at.desc&limit=1`,{headers:h}),
    fetch(`${cfg.url}/rest/v1/workflow_state?select=*&reference_no=eq.${q}&limit=1`,{headers:h}),
    fetch(`${cfg.url}/rest/v1/assessment_cases?select=*&reference_no=eq.${q}&order=created_at.asc`,{headers:h}),
    fetch(`${cfg.url}/rest/v1/document_bundles?select=*&reference_no=eq.${q}&order=updated_at.desc`,{headers:h}),
    fetch(`${cfg.url}/rest/v1/document_versions?select=*&reference_no=eq.${q}&order=document_type.asc,version_no.asc`,{headers:h})
  ]);
  if(!cr.ok||!sr.ok||!ar.ok||!br.ok||!vr.ok)throw new Error('Supabase operational workflow read failed.');
  const [c,s,a,b,v]=await Promise.all([cr.json(),sr.json(),ar.json(),br.json(),vr.json()]);
  return {candidate:Array.isArray(c)?c[0]||null:null,state:Array.isArray(s)?s[0]||null:null,assessments:Array.isArray(a)?a:[],documentBundles:Array.isArray(b)?b:[],documentVersions:Array.isArray(v)?v:[]};
}
function overlaySupabaseOperational(data,o){
  const c=o?.candidate||null,st=o?.state||null,a=o?.assessments||[],b=o?.documentBundles||[],v=o?.documentVersions||[];
  data.V2_DOCUMENT_BUNDLES=b;
  data.V2_DOCUMENT_VERSIONS=v;
  if(c){const e=Array.isArray(data.V2_SAC_CANDIDATES)?data.V2_SAC_CANDIDATES[0]||{}:{};data.V2_SAC_CANDIDATES=[{...e,'Reference No':c.reference_no,'Student Name':c.student_name||e['Student Name']||'','Programme':c.programme||e['Programme']||'','Decision':c.decision||'PENDING','Decision At':c.decision_at||'','Decision By':c.decision_by||''}];}
  if(st){const w=Array.isArray(data.V2_WORKFLOW)&&data.V2_WORKFLOW[0]?data.V2_WORKFLOW[0]:{'Reference No':st.reference_no};data.V2_WORKFLOW=[{...w,'Application Stage':st.current_stage||w['Application Stage']||'','SAC Decision':st.sac_decision||w['SAC Decision']||'','SAC Supabase Decision':st.sac_decision||'','Assessment Status':st.assessment_status||'','Prerequisite Status':st.prerequisite_status||'','Offer Letter Status':st.offer_status||w['Offer Letter Status']||'','Acceptance Status':st.acceptance_status||w['Acceptance Status']||'','Workflow Version':String(st.workflow_version||''),'Workflow Source':'SUPABASE','Legacy Sync Status':st.legacy_sync_status||'','SAC Sync Status':st.legacy_sync_status==='SYNCED'?'SYNCED':'LEGACY_MIRROR_PENDING','Last Updated':st.updated_at||w['Last Updated']||'','Updated By':st.updated_by||w['Updated By']||''}];}
  if(a.length)data.V2_ASSESSMENT_PROGRESS=a.map(x=>({'Reference No':x.reference_no,'Assessment Type':x.assessment_type,'Sequence':String(x.sequence||1),'Component':'OVERALL','Status':x.status,'Panel Result':x.panel_result||'','Remarks':x.remarks||'','Updated At':x.updated_at||'','Updated By':x.completed_by||x.created_by||''}));
}

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
  if(req.method==='GET'&&String(req.query?.health||'')==='1')return res.status(200).json({ok:true,service:'IPGS Admission targeted applicant refresh',build:'ADMIN_RECORD_SUPABASE_WORKFLOW_20261005'});
  if(req.method!=='POST')return res.status(405).json({ok:false,message:'Method not allowed.'});
  const startedAt=Date.now();let body=req.body||{};if(typeof body==='string'){try{body=JSON.parse(body)}catch(_){body={}}}
  const password=String(body.password||''),sessionId=String(body.sessionId||'');
  const authStartedAt=Date.now();if(!(await validateAdminSession(password,sessionId)))return res.status(401).json({ok:false,message:'Invalid admin password.'});const authMs=Date.now()-authStartedAt;
  const referenceNo=String(body.referenceNo||'').trim();if(!referenceNo)return res.status(400).json({ok:false,message:'Reference No is required.'});
  const mode=String(body.mode||'full').toLowerCase()==='light'?'light':'full',targetSheets=mode==='light'?LIGHT_TARGET_SHEETS:FULL_TARGET_SHEETS;
  const dataStartedAt=Date.now();const [settled,agentEventsResult,operationalResult]=await Promise.all([
    Promise.allSettled(targetSheets.map(async([sheet,column])=>[sheet,await fetchReferenceRows(sheet,column,referenceNo)])),
    fetchAgentEventsForReference(referenceNo).then(rows=>({ok:true,rows})).catch(error=>({ok:false,error})),
    fetchSupabaseOperational(referenceNo).then(value=>({ok:true,value})).catch(error=>({ok:false,error}))
  ]);
  const data={},warnings=[];settled.forEach((result,index)=>{const sheet=targetSheets[index][0];if(result.status==='fulfilled')data[sheet]=result.value[1];else{data[sheet]=[];warnings.push(`${sheet}: ${result.reason?.message||'Unable to load'}`)}});
  if(agentEventsResult.ok)data.V2_AGENT_EVENTS=agentEventsResult.rows;else{data.V2_AGENT_EVENTS=[];warnings.push(`V2_AGENT_EVENTS: ${agentEventsResult.error?.message||'Unable to load'}`)}
  if(operationalResult.ok)overlaySupabaseOperational(data,operationalResult.value);else warnings.push(`Supabase workflow: ${operationalResult.error?.message||'Unable to load'}`);
  const dataMs=Date.now()-dataStartedAt,totalMs=Date.now()-startedAt;res.setHeader('Server-Timing',`auth;dur=${authMs}, data;dur=${dataMs}, total;dur=${totalMs}`);
  return res.status(200).json({ok:true,build:'ADMIN_RECORD_SUPABASE_WORKFLOW_20261005',mode,referenceNo,loadedAt:new Date().toISOString(),warnings,performance:{authMs,dataMs,totalMs,sheets:targetSheets.length+1},data});
}
