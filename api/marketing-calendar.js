import {validateAdminSession} from './admin-data.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST')return res.status(405).json({ok:false,message:'Method not allowed'});
  let body=req.body||{};
  if(typeof body==='string'){try{body=JSON.parse(body)}catch{body={}}}
  if(!(await validateAdminSession(body.password,body.sessionId)))
    return res.status(401).json({ok:false,message:'Invalid ACC admin session'});
  const token=String(process.env.MARKETING_ACC_TOKEN||'');
  if(!token)return res.status(503).json({ok:false,message:'Marketing calendar link is not configured'});
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),32000);
  try{
    const headers={'x-acc-calendar-token':token,'Accept':'application/json'};
    if(process.env.MARKETING_VERCEL_BYPASS)headers['x-vercel-protection-bypass']=process.env.MARKETING_VERCEL_BYPASS;
    const remote=await fetch('https://ipgs-marketing-portal.vercel.app/api/acc-calendar',{
      method:'GET',headers,cache:'no-store',signal:ctrl.signal,redirect:'follow'
    });
    const text=await remote.text();
    let payload;try{payload=JSON.parse(text)}catch{throw new Error('Marketing bridge returned non-JSON response (access or deployment protection may need review)')}
    if(!remote.ok||!Array.isArray(payload.candidates))
      throw new Error(payload.error||('Marketing bridge returned HTTP '+remote.status));
    const candidates=payload.candidates.map(c=>({
      id:String(c.id||''),name:String(c.name||''),ic:String(c.ic||''),
      email:String(c.email||''),programme:String(c.programme||''),
      intake:String(c.intake||''),registeredAt:String(c.registeredAt||''),
      registrationEvents:Array.isArray(c.registrationEvents)?c.registrationEvents.map(e=>({
        registeredAt:String(e.registeredAt||''),sourceTab:String(e.sourceTab||'')
      })):[],
      sourceTab:String(c.sourceTab||''),registrationCount:Number(c.registrationCount||0),
      accFound:c.accFound===true,activated:c.activated===true,
      snapshotCategory:String(c.snapshotCategory||''),processingCategory:String(c.processingCategory||'')
    }));
    return res.status(200).json({ok:true,candidates,refreshedAt:payload.refreshedAt||null,sourceStatus:'live'});
  }catch(error){
    return res.status(502).json({ok:false,message:'Marketing calendar data unavailable: '+String(error.message||error).slice(0,180)});
  }finally{clearTimeout(timer)}
}
