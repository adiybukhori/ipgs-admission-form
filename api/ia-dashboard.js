import { timingSafeEqual } from 'node:crypto';
const AUTH_URL='https://script.google.com/macros/s/AKfycbw22-UOsHkaap3dzU16aOjA6XFr7jWGr9qQPfp8F1CQrXboP7YdRZJKKJhHijC3us4/exec';
const safeEqual=(a,b)=>{const x=Buffer.from(String(a||'')),y=Buffer.from(String(b||''));return x.length>0&&x.length===y.length&&timingSafeEqual(x,y)};
async function verify(password){if(!password)return false;const own=process.env.V2_ADMIN_API_PASSWORD;if(own&&safeEqual(password,own))return true;const c=new AbortController(),t=setTimeout(()=>c.abort(),6000);try{const r=await fetch(AUTH_URL+'?action=applications&token='+encodeURIComponent(password),{signal:c.signal});const d=await r.json();return r.ok&&d?.ok===true}catch{return false}finally{clearTimeout(t)}}
async function supa(path,body){const root=String(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY;if(!root||!key)throw Error('Backend IA configuration missing');const c=new AbortController(),t=setTimeout(()=>c.abort(),8000);try{const r=await fetch(root+'/rest/v1/'+path,{method:body===undefined?'GET':'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:c.signal});const d=await r.json();if(!r.ok)throw Error(d?.message||'Backend error');return d}finally{clearTimeout(t)}}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({ok:false,message:'Method not allowed'});
 res.setHeader('Cache-Control','no-store');const {password,caseId,action,result,remarks,confirm}=req.body||{};
 if(!(await verify(password)))return res.status(401).json({ok:false,message:'ACC authentication required'});
 try{
 if(action==='finalize'){
 if(!/^[0-9a-f-]{36}$/i.test(String(caseId||'')))return res.status(400).json({ok:false,message:'Valid case required'});
 if(!['QUALIFIED','PREREQUISITE_REQUIRED','NOT_QUALIFIED','DEFERRED_FOR_INFORMATION'].includes(result)||confirm!==true)return res.status(400).json({ok:false,message:'Invalid or unconfirmed decision'});
 if(String(remarks||'').length>4000)return res.status(400).json({ok:false,message:'Remarks too long'});
 const saved=await supa('rpc/ia_acc_record_panel_decision',{p_case_id:caseId,p_result:result,p_remarks:remarks||null,p_actor:'ACC IA Panel',p_confirm:true});
 return res.status(200).json({ok:true,decision:saved});
 }
 const cases=await supa('ia_cases?select=id,reference_no,student_name,email,programme,intake,source_system,status,progress_percent,email_status,panel_status,panel_result,panel_remarks,started_at,last_activity_at,submitted_at,created_at,updated_at&order=created_at.desc&limit=1000');
 if(caseId){const row=cases.find(x=>x.id===caseId);if(!row)return res.status(404).json({ok:false,message:'Case not found'});const responses=await supa('ia_responses?select=section_key,answer_text,word_count,saved_at&case_id=eq.'+encodeURIComponent(caseId));return res.status(200).json({ok:true,case:row,responses});}
 return res.status(200).json({ok:true,cases});
 }catch(e){return res.status(503).json({ok:false,message:e.message||'IA backend unavailable'})}
}