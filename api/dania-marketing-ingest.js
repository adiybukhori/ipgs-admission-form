// Deploy refreshed HMAC production relay configuration.
import { createHmac, timingSafeEqual } from 'node:crypto';
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
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(req.method==='GET' && req.query?.health==='1')return res.status(200).json({ok:true,service:'DANIA marketing relay',configured:!!process.env.DANIA_WEBHOOK_SECRET});
  if(req.method!=='POST')return res.status(405).json({ok:false});
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
