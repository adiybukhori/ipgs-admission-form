const SPREADSHEET_ID = '1O-Y-q7_q78xKM1p5e2C3EWyQfYr5rXvhO0oWbVaw5Mw';
const AUTH_WEB_APP = 'https://script.google.com/macros/s/AKfycbw22-UOsHkaap3dzU16aOjA6XFr7jWGr9qQPfp8F1CQrXboP7YdRZJKKJhHijC3us4/exec';
const EVENT_SHEET = 'V2_AGENT_EVENTS';
const EXECUTION_SHEET = 'V2_AGENT_EXECUTIONS';

function parseCsv(text) {
  const rows=[]; let row=[], field='', quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i], next=text[i+1];
    if(ch==='"'){ if(quoted&&next==='"'){field+='"';i++;} else quoted=!quoted; continue; }
    if(ch===','&&!quoted){row.push(field);field='';continue;}
    if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&next==='\n')i++;
      row.push(field); if(row.some(v=>String(v||'').trim()!==''))rows.push(row);
      row=[];field='';continue;
    }
    field+=ch;
  }
  row.push(field); if(row.some(v=>String(v||'').trim()!==''))rows.push(row);
  return rows;
}

function toObjects(csv){
  const rows=parseCsv(csv); if(!rows.length)return [];
  const headers=rows[0].map(v=>String(v||'').trim());
  return rows.slice(1).filter(r=>r.some(v=>String(v||'').trim()!=='')).map(r=>{
    const out={}; headers.forEach((h,i)=>{if(h)out[h]=r[i]??'';}); return out;
  });
}

async function validateAdminPassword(password){
  if(!password)return false;
  const url = AUTH_WEB_APP + '?action=applications&token=' + encodeURIComponent(password) + '&_=' + Date.now();
  const response=await fetch(url,{redirect:'follow'});
  const text=await response.text();
  try{const data=JSON.parse(text);return response.ok&&data&&data.ok===true;}catch(_){return false;}
}

async function fetchSheet(sheet){
  const url=`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_=${Date.now()}`;
  const response=await fetch(url,{redirect:'follow'});
  if(!response.ok){
    if(response.status===400||response.status===404)return {exists:false,rows:[]};
    throw new Error(`${sheet} returned HTTP ${response.status}`);
  }
  return {exists:true,rows:toObjects(await response.text())};
}

function ts(row){
  const raw=String(row?.['Timestamp']||row?.['Last Updated']||row?.['Started At']||'');
  const n=Date.parse(raw); return Number.isFinite(n)?n:0;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method!=='POST')return res.status(405).json({ok:false,message:'Method not allowed.'});

  let body=req.body||{};
  if(typeof body==='string'){try{body=JSON.parse(body);}catch(_){body={};}}
  const password=String(body.password||'');
  if(!(await validateAdminPassword(password)))return res.status(401).json({ok:false,message:'Invalid admin password.'});

  try{
    const [eventResult,executionResult]=await Promise.all([fetchSheet(EVENT_SHEET),fetchSheet(EXECUTION_SHEET)]);
    const events=eventResult.rows.sort((a,b)=>ts(a)-ts(b)).slice(-150);
    const executions=executionResult.rows.sort((a,b)=>ts(a)-ts(b)).slice(-150);

    const now=Date.now();
    const liveN8nEvent=events.slice().reverse().find(r=>{
      const source=String(r['Source']||'').toUpperCase();
      const age=now-ts(r);
      return source==='N8N' && age>=0 && age<=5*60*1000;
    });

    const running=executions.filter(r=>String(r['Status']||'').toUpperCase()==='RUNNING').length;
    const failed=executions.filter(r=>String(r['Status']||'').toUpperCase()==='FAILED').length;
    const completed=executions.filter(r=>String(r['Status']||'').toUpperCase()==='COMPLETED').length;
    const latestByRef={};
    events.forEach(r=>{const ref=String(r['Reference No']||'').trim();if(ref)latestByRef[ref]=r;});
    const humanWaiting=Object.values(latestByRef).filter(r=>
      String(r['Status']||'').toUpperCase()==='WAITING_HUMAN' ||
      (String(r['Requires Human']||'').toUpperCase()==='YES' && !/COMPLETED|RESOLVED/.test(String(r['Status']||'').toUpperCase()))
    ).length;

    return res.status(200).json({
      ok:true,
      bridgeReady:eventResult.exists&&executionResult.exists,
      n8nLive:!!liveN8nEvent,
      lastN8nEventAt:liveN8nEvent?liveN8nEvent['Timestamp']:'',
      events,
      executions,
      summary:{running,failed,completed,humanWaiting,totalEvents:events.length,totalExecutions:executions.length}
    });
  }catch(error){
    return res.status(502).json({ok:false,message:error?.message||'Unable to load agent runtime state.'});
  }
}
