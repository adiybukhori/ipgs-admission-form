export default function handler(req,res){
  res.setHeader('Cache-Control','no-store, max-age=0');
  if(req.method!=='GET')return res.status(405).json({ok:false,message:'Method not allowed'});
  const production=process.env.VERCEL_ENV==='production';
  const parity=process.env.V2_LOA_V1_PARITY_READY==='true';
  const config=Boolean(process.env.V2_LOA_API_TOKEN&&
    (process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL)&&
    (process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SECRET_KEY));
  // A read-only readiness signal. It does not expose credentials.
  return res.status(200).json({ok:true,ready:production&&parity&&config,preview:!production});
}
