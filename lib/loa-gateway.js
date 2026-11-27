import {createHmac,randomBytes} from 'node:crypto';
export function makeAccGatewayEnvelope(payload,secret,ts=Date.now(),nonce=randomBytes(16).toString('hex')){
 if(!/^[a-f0-9]{64}$/.test(String(secret||'')))throw Error('ACC gateway secret must be configured.');
 const encoded=JSON.stringify(payload);
 return {ts,nonce,payload:encoded,signature:createHmac('sha256',secret).update(ts+'.'+nonce+'.'+encoded).digest('hex')};
}
export async function accGatewayCall(env,op,payload={}){
 const url=String(env.ACC_LOA_GATEWAY_URL||'');
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url))throw Error('ACC gateway deployment URL invalid.');
 const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify(makeAccGatewayEnvelope({...payload,op},env.ACC_LOA_GATEWAY_SECRET)),
  redirect:'follow',signal:AbortSignal.timeout(95000)});
 const result=await r.json().catch(()=>null);
 if(!r.ok||!result?.ok)throw Error('ACC gateway '+op+' failed; inspect gateway and ledger. No automatic retry.');
 return result.data;
}
