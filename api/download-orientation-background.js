// Public, read-only download of the official IUC/IPGS orientation virtual background.
// Source: IPGS Drive > ORIENTATION > Orientation Background.png (1920x1080).
const SOURCE = 'https://raw.githubusercontent.com/adiybukhori/ipgs-admission-form/main/assets/email/Orientation_Background.png';
const FILENAME = 'IPGS_Orientation_Background.png';

export default async function handler(req, res) {
  res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='GET' && req.method!=='HEAD'){
    res.setHeader('Allow','GET, HEAD');
    return res.status(405).json({ok:false,message:'Method not allowed'});
  }
  try {
    const upstream = await fetch(SOURCE, {method:'GET',signal:AbortSignal.timeout(10000)});
    if(!upstream.ok || !String(upstream.headers.get('content-type')||'').includes('image/'))
      throw new Error('Orientation background asset is unavailable');
    const bytes = Buffer.from(await upstream.arrayBuffer());
    if(bytes.length<10000 || bytes.length>4*1024*1024 || bytes.toString('hex',0,8)!=='89504e470d0a1a0a')
      throw new Error('Invalid orientation background PNG');
    res.setHeader('Content-Type','image/png');
    res.setHeader('Content-Disposition','attachment; filename="'+FILENAME+'"');
    res.setHeader('Content-Length',String(bytes.length));
    if(req.method==='HEAD')return res.status(200).end();
    return res.status(200).end(bytes);
  } catch(error) {
    console.error('IPGS orientation background download failure:',error.message);
    return res.status(502).json({ok:false,message:'Unable to download the official orientation background right now.'});
  }
}
