import { timingSafeEqual } from 'node:crypto';
const AUTH_URL='https://script.google.com/macros/s/AKfycbw22-UOsHkaap3dzU16aOjA6XFr7jWGr9qQPfp8F1CQrXboP7YdRZJKKJhHijC3us4/exec';
function equal(a,b){const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length>0&&x.length===y.length&&timingSafeEqual(x,y)}
async function verify(password){if(!password)return false;const own=process.env.V2_ADMIN_API_PASSWORD;if(own&&equal(password,own))return true;const c=new AbortController(),t=setTimeout(()=>c.abort(),6000);try{const r=await fetch(AUTH_URL+'?action=applications&token='+encodeURIComponent(password),{signal:c.signal});const d=await r.json();return r.ok&&d?.ok===true}catch{return false}finally{clearTimeout(t)}}
async function supa(path){const root=String(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;if(!root||!key)throw Error('Backend IA configuration missing');const c=new AbortController(),t=setTimeout(()=>c.abort(),8000);try{const r=await fetch(root+'/rest/v1/'+path,{headers:{apikey:key,Authorization:'Bearer '+key},signal:c.signal});const d=await r.json();if(!r.ok)throw Error(d?.message||'Backend error');return d}finally{clearTimeout(t)}}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({ok:false,message:'Method not allowed'});
 res.setHeader('Cache-Control','no-store');const {password,caseId}=req.body||{};
 if(!(await verify(password)))return res.status(401).json({ok:false,message:'ACC authentication required'});
 try{
 const cases=await supa('ia_cases?select=id,reference_no,student_name,email,programme,intake,source_system,status,progress_percent,email_status,panel_status,panel_result,panel_remarks,started_at,last_activity_at,submitted_at,created_at,updated_at&order=created_at.desc&limit=1000');
 if(caseId){const row=cases.find(x=>x.id===caseId);if(!row)return res.status(404).json({ok:false,message:'Case not found'});const responses=await supa('ia_responses?select=section_key,answer_text,word_count,saved_at&case_id=eq.'+encodeURIComponent(caseId));return res.status(200).json({ok:true,case:row,responses});}
 return res.status(200).json({ok:true,cases});
 }catch(e){return res.status(503).json({ok:false,message:e.message||'IA backend unavailable'})}
}