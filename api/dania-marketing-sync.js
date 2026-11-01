import { createHash, timingSafeEqual } from 'node:crypto';
const text=v=>String(v??'').trim();
function authenticate(req) {
  const expected=text(process.env.DANIA_ACC_READ_TOKEN_SHA256);
  if(!/^[a-f0-9]{64}$/i.test(expected))return null;
  const m=/^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(text(req.headers?.authorization));
  if(!m)return false;
  const hash=createHash('sha256').update(m[1]).digest('hex');
  return timingSafeEqual(Buffer.from(hash,'hex'),Buffer.from(expected,'hex'));
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET' && req.query?.health==='1')return res.status(200).json({ok:true,service:'DANIA marketing poll',configured:authenticate({headers:{}})!==null});
  if(req.method!=='POST')return res.status(405).json({ok:false});
  const auth=authenticate(req);
  if(auth===null)return res.status(503).json({ok:false,reason:'UNCONFIGURED'});
  if(!auth)return res.status(401).json({ok:false,reason:'UNAUTHORIZED'});
  let body=req.body||{};
  if(typeof body==='string'){try{body=JSON.parse(body);}catch{body={}}}
  const base=text(process.env.SUPABASE_URL).replace(/\/$/,'');
  const key=text(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY);
  if(!base||!key)return res.status(503).json({ok:false,reason:'STORE_NOT_CONFIGURED'});
  const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  try{
    if(body.action==='pull'){
      const limit=Math.min(Math.max(Number(body.limit)||10,1),25);
      const url=base+'/rest/v1/dania_marketing_events?select=source_ref,event_type,payload,created_at&acknowledged_at=is.null&order=created_at.asc&limit='+limit;
      const r=await fetch(url,{headers,signal:AbortSignal.timeout(6500)});
      if(!r.ok)return res.status(503).json({ok:false,reason:'STORE_READ_REJECTED'});
      const rows=await r.json();
      return res.status(200).json({ok:true,events:Array.isArray(rows)?rows:[],count:Array.isArray(rows)?rows.length:0});
    }
    if(body.action==='ack'){
      const ref=text(body.source_ref);
      const status=text(body.status);
      if(!/^IPGS-[A-Za-z0-9-]{6,45}$/.test(ref)||!['INGESTED','DUPLICATE','SKIPPED_MANUAL_CONTACT','STOPPED_NO_CONSENT','ERROR_REVIEW'].includes(status))return res.status(422).json({ok:false,reason:'INVALID_ACK'});
      const url=base+'/rest/v1/dania_marketing_events?source_ref=eq.'+encodeURIComponent(ref)+'&acknowledged_at=is.null';
      const r=await fetch(url,{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({acknowledged_at:new Date().toISOString(),ack_status:status}),signal:AbortSignal.timeout(6500)});
      if(!r.ok)return res.status(503).json({ok:false,reason:'ACK_FAILED'});
      const changed=await r.json();
      return res.status(200).json({ok:true,updated:Array.isArray(changed)?changed.length:0});
    }
    return res.status(422).json({ok:false,reason:'INVALID_ACTION'});
  }catch{return res.status(503).json({ok:false,reason:'STORE_UNAVAILABLE'});}
}
