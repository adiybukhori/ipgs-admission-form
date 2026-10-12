import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
const same=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length>0&&x.length===y.length&&timingSafeEqual(x,y)};
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({ok:false,error:'METHOD_NOT_ALLOWED'});
 const body=req.body||{};
 if(!same(body.secret,process.env.V2_ADMIN_API_PASSWORD))return res.status(401).json({ok:false,error:'UNAUTHORIZED'});
 const referenceNo=String(body.referenceNo||'').trim(),email=String(body.email||'').trim();
 if(!/^IUC-ADM-[\w/-]{3,150}$/i.test(referenceNo)||!/^\S+@\S+\.\S+$/.test(email)||String(body.studentName||'').length<3||String(body.programme||'').length<2||body.decision!=='INTERNAL_ASSESSMENT'||body.finalised!==true)
 return res.status(400).json({ok:false,error:'INVALID_IA_ASSIGNMENT'});
 const url=String(process.env.SUPABASE_URL||'').replace(/\/$/,'');
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;
 if(!url||!key)return res.status(503).json({ok:false,error:'DATABASE_NOT_CONFIGURED'});
 const token=randomBytes(32).toString('hex');
 const hash=createHash('sha256').update(token).digest('hex');
 const payload={reference_no:referenceNo,student_name:String(body.studentName).trim().slice(0,250),email,
 programme:String(body.programme).slice(0,200),intake:String(body.intake||'').slice(0,100),
 source_system:'ACC_V2_SAC',source_event_id:String(body.sessionId||'').slice(0,160),
 access_token_hash:hash,status:'READY',preparation_status:'READY',email_status:'NOT_SENT'};
 try{
 const r=await fetch(url+'/rest/v1/ia_cases',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify(payload)});
 const result=await r.json().catch(()=>[]);
 if(r.status===409)return res.status(409).json({ok:false,error:'IA_ALREADY_EXISTS',message:'IA assignment exists; manual review required before issuing another token.'});
 if(!r.ok)throw Error(result?.message||'Database rejected IA assignment');
 const row=Array.isArray(result)?result[0]:null;
 if(!row?.id)throw Error('Assignment confirmation missing');
 return res.status(201).json({ok:true,caseId:row.id,referenceNo,invitationUrl:'https://iuc-internal-assessment.vercel.app/?token='+token});
 }catch(e){return res.status(503).json({ok:false,error:'IA_ASSIGN_FAILED',message:String(e.message||e)})}
}