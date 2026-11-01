import { createHash, timingSafeEqual } from 'node:crypto';
import adminDataHandler from './admin-data.js';

const required = ['V2_APPLICATIONS','V2_WORKFLOW'];
const also = ['V2_DOCUMENT_REVIEW','V2_QUALIFICATION_SCREENING','V2_SAC_CANDIDATES','V2_AGENT_EVENTS'];
const text = v => String(v ?? '').trim();
const id = v => text(v).toUpperCase().replace(/[^A-Z0-9]/g,'');
const email = v => text(v).toLowerCase();
const name = v => text(v).toUpperCase().replace(/\s+/g,' ');
const phone = v => { let n=text(v).replace(/\D/g,'');return n.startsWith('0')?'60'+n.slice(1):n; };
const field = (r,...keys) => keys.map(k=>r?.[k]).find(v=>text(v)) || '';
function authorized(req) {
  const expected=text(process.env.DANIA_ACC_READ_TOKEN_SHA256).toLowerCase();
  if(!/^[a-f0-9]{64}$/.test(expected))return null;
  const match=/^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(text(req.headers?.authorization));
  if(!match)return false;
  const hashed=createHash('sha256').update(match[1]).digest('hex');
  return timingSafeEqual(Buffer.from(hashed,'hex'),Buffer.from(expected,'hex'));
}
async function readAcc() {
  const password=text(process.env.V2_ADMIN_API_PASSWORD);
  if(!password)throw new Error('ACC_BACKEND_NOT_CONFIGURED');
  const r={statusCode:200,body:null,setHeader(){return this;},status(n){this.statusCode=n;return this;},json(data){this.body=data;return this;}};
  await adminDataHandler({method:'POST',body:{password,scope:'full'},query:{}},r);
  if(r.statusCode!==200 || !r.body?.ok || !r.body?.data)throw new Error('ACC_DATA_UNAVAILABLE');
  return r.body;
}
async function findDurable(e) {
  if(!e)return false;
  const base=text(process.env.SUPABASE_URL).replace(/\/$/,'');
  const key=text(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY);
  if(!base || !key)throw new Error('ADMISSION_RECEIPTS_UNAVAILABLE');
  const u=base+'/rest/v1/admission_submissions?select=reference_no&email=eq.'+encodeURIComponent(e)+'&limit=1';
  const r=await fetch(u,{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(6500)});
  if(!r.ok)throw new Error('ADMISSION_RECEIPTS_UNAVAILABLE');
  const rows=await r.json();
  return Array.isArray(rows)&&rows.length>0;
}
function rowMatch(r,q) {
  const ri=id(field(r,'ID / Passport No','IC / Passport','Passport No'));
  const re=email(field(r,'Personal Email','Email','Email Address'));
  const rp=phone(field(r,'Phone Number','Phone'));
  if(q.id && ri===q.id)return 'IDENTITY';
  if(q.email && re===q.email)return 'EMAIL';
  if(q.phone && rp===q.phone)return 'PHONE';
  return null;
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store,max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method==='GET'&&req.query?.health==='1')return res.status(200).json({ok:true,service:'DANIA ACC read-only',configured:authorized({headers:{}})!==null});
  if(req.method!=='POST')return res.status(405).json({ok:false,status:'METHOD_NOT_ALLOWED'});
  const auth=authorized(req);
  if(auth===null)return res.status(503).json({ok:false,status:'UNCONFIGURED'});
  if(!auth)return res.status(401).json({ok:false,status:'UNAUTHORIZED'});
  let b=req.body||{};
  if(typeof b==='string'){try{b=JSON.parse(b);}catch{b={};}}
  const q={id:id(b.idPassport).slice(0,64),email:email(b.email).slice(0,254),phone:phone(b.phone).slice(0,22),name:name(b.fullName).slice(0,160)};
  if(!q.id&&!q.email&&!q.phone)return res.status(422).json({ok:false,status:'IDENTITY_REQUIRED'});
  try{
    const [acc,durable]=await Promise.allSettled([readAcc(),findDurable(q.email)]);
    if(durable.status==='fulfilled'&&durable.value)return res.status(200).json({ok:true,status:'APPLIED',sources:['ADMISSION_SUBMISSIONS'],checkedAt:new Date().toISOString()});
    if(acc.status!=='fulfilled')return res.status(503).json({ok:false,status:'UNKNOWN',reason:'ACC_READ_UNAVAILABLE'});
    const {data,warnings=[]}=acc.value;
    if(required.some(s=>!Array.isArray(data[s])||warnings.some(w=>String(w).startsWith(s+':'))))return res.status(503).json({ok:false,status:'UNKNOWN',reason:'REQUIRED_SOURCE_UNAVAILABLE'});
    let strong=[],phoneOnly=false;
    for(const source of required)for(const row of data[source]){
      const kind=rowMatch(row,q);
      if(kind==='IDENTITY'||kind==='EMAIL')strong.push(source);
      else if(kind==='PHONE')phoneOnly=true;
    }
    if(strong.length)return res.status(200).json({ok:true,status:'APPLIED',sources:[...new Set(strong)],checkedAt:new Date().toISOString()});
    if(phoneOnly)return res.status(200).json({ok:true,status:'REVIEW_REQUIRED',reason:'PHONE_ONLY_MATCH'});
    if(q.name)for(const source of [...required,...also])for(const row of (data[source]||[])){
      if(name(field(row,'Student Name','Name'))===q.name)return res.status(200).json({ok:true,status:'REVIEW_REQUIRED',reason:'POSSIBLE_NAME_MATCH'});
    }
    if(durable.status!=='fulfilled'&&q.email)return res.status(503).json({ok:false,status:'UNKNOWN',reason:'DURABLE_RECEIPT_UNAVAILABLE'});
    if(!q.id&&!q.email)return res.status(200).json({ok:true,status:'REVIEW_REQUIRED',reason:'NO_STRONG_IDENTIFIER'});
    return res.status(200).json({ok:true,status:'NO_MATCH',sources:['V2_APPLICATIONS','V2_WORKFLOW','ADMISSION_SUBMISSIONS'],checkedAt:new Date().toISOString()});
  }catch{return res.status(503).json({ok:false,status:'UNKNOWN',reason:'INTERNAL_READ_ERROR'});}
}
