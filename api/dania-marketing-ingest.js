// Deploy refreshed HMAC production relay configuration.
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
const json = v => JSON.stringify(v);
const text = v => String(v ?? '').trim();
function verify(req) {
  const secret=text(process.env.DANIA_WEBHOOK_SECRET);
  if(secret.length<32)return null;
  const ts=text(req.headers['x-dania-timestamp']);
  const sig=text(req.headers['x-dania-signature']);
  const m=/^sha256=([a-f0-9]{64})$/.exec(sig);
  const n=Number(ts);
  if(!m || !/^\d{10}$/.test(ts) || Math.abs(Math.floor(Date.now()/1000)-n)>300)return false;
  const encoded=ts+'.'+json(req.body);
  const hash=createHmac('sha256',secret).update(encoded).digest('hex');
  return timingSafeEqual(Buffer.from(m[1],'hex'),Buffer.from(hash,'hex'));
}



function verifyPull(req) {
  const expected=text(process.env.DANIA_ACC_READ_TOKEN_SHA256).toLowerCase();
  if(!/^[a-f0-9]{64}$/.test(expected))return null;
  const m=/^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(text(req.headers?.authorization));
  if(!m)return false;
  const actual=createHash('sha256').update(m[1]).digest('hex');
  return timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(expected,'hex'));
}
async function pollOrAck(req,res) {
  const valid=verifyPull(req);
  if(valid===null)return res.status(503).json({ok:false,reason:'POLL_UNCONFIGURED'});
  if(!valid)return res.status(401).json({ok:false,reason:'UNAUTHORIZED'});
  let body=req.body||{};
  if(typeof body==='string'){try{body=JSON.parse(body)}catch{body={}}}
  const base=text(process.env.SUPABASE_URL).replace(/\/$/,'');
  const key=text(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY);
  if(!base||!key)return res.status(503).json({ok:false,reason:'STORE_NOT_CONFIGURED'});
  const headers={apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'};
  try {
    if(body.action==='pull'){
      const limit=Math.min(Math.max(Number(body.limit)||10,1),25);
      const u=base+'/rest/v1/dania_marketing_events?select=source_ref,event_type,payload,created_at&acknowledged_at=is.null&order=created_at.asc&limit='+limit;
      const r=await fetch(u,{headers,signal:AbortSignal.timeout(6500)});
      if(!r.ok)return res.status(503).json({ok:false,reason:'STORE_READ_REJECTED'});
      const rows=await r.json();
      return res.status(200).json({ok:true,events:Array.isArray(rows)?rows:[],count:Array.isArray(rows)?rows.length:0});
    }
    if(body.action==='ack'){
      const ref=text(body.source_ref),status=text(body.status);
      if(!/^IPGS-[A-Za-z0-9-]{6,45}$/.test(ref)||!['INGESTED','DUPLICATE','SKIPPED_MANUAL_CONTACT','STOPPED_NO_CONSENT','ERROR_REVIEW'].includes(status))return res.status(422).json({ok:false,reason:'INVALID_ACK'});
      const u=base+'/rest/v1/dania_marketing_events?source_ref=eq.'+encodeURIComponent(ref)+'&acknowledged_at=is.null';
      const r=await fetch(u,{method:'PATCH',headers:{...headers,Prefer:'return=representation'},body:JSON.stringify({acknowledged_at:new Date().toISOString(),ack_status:status}),signal:AbortSignal.timeout(6500)});
      if(!r.ok)return res.status(503).json({ok:false,reason:'ACK_FAILED'});
      const changed=await r.json();
      return res.status(200).json({ok:true,updated:Array.isArray(changed)?changed.length:0});
    }
    return res.status(422).json({ok:false,reason:'INVALID_ACTION'});
  }catch{return res.status(503).json({ok:false,reason:'STORE_UNAVAILABLE'});}
}

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET' && req.query?.health==='1')return res.status(200).json({ok:true,service:'DANIA marketing relay',configured:!!process.env.DANIA_WEBHOOK_SECRET,pollConfigured:verifyPull({headers:{}})!==null});
  if(req.method!=='POST')return res.status(405).json({ok:false});
  if(req.headers?.authorization)return pollOrAck(req,res);
  if(!req.body || typeof req.body!=='object')return res.status(400).json({ok:false});
  const verified=verify(req);
  if(verified===null)return res.status(503).json({ok:false,reason:'UNCONFIGURED'});
  if(!verified)return res.status(401).json({ok:false,reason:'INVALID_SIGNATURE'});
  const v=req.body;
  const ref=text(v.source_ref);
  if(!/^IPGS-[A-Za-z0-9-]{6,45}$/.test(ref) || v.event_type!=='marketing_registration_completed' || text(v.source)!=='ipgs-briefing-registration' || !v.applicant || typeof v.applicant!=='object')return res.status(422).json({ok:false,reason:'INVALID_EVENT'});
  const base=text(process.env.SUPABASE_URL).replace(/\/$/,'');
  const key=text(process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY);
  if(!base||!key)return res.status(503).json({ok:false,reason:'RECEIPT_STORE_UNAVAILABLE'});
  const stored={source_ref:ref,event_type:'marketing_registration_completed',payload:{event_type:'marketing_registration_completed',source_ref:ref,idempotency_key:text(v.idempotency_key),occurred_at:text(v.occurred_at),whatsapp_consent:v.whatsapp_consent===true,whatsapp_consent_version:text(v.whatsapp_consent_version),applicant:{full_name:text(v.applicant.full_name).slice(0,160),ic_passport:text(v.applicant.ic_passport).slice(0,80),phone:text(v.applicant.phone).slice(0,32),email:text(v.applicant.email).slice(0,254),programme:text(v.applicant.programme).slice(0,160),preferred_intake:text(v.applicant.preferred_intake).slice(0,160)}}};
  try{
    const url=base+'/rest/v1/dania_marketing_events?on_conflict=source_ref';
    const r=await fetch(url,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:json([stored]),signal:AbortSignal.timeout(6500)});
    if(!r.ok)return res.status(503).json({ok:false,reason:'STORE_REJECTED'});
    return res.status(200).json({ok:true,accepted:true,idempotent:true});
  }catch{return res.status(503).json({ok:false,reason:'STORE_UNAVAILABLE'});}
}
