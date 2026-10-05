import { PDFDocument } from 'pdf-lib';

export const config = { maxDuration: 300 };

const AUTH_WEB_APP = 'https://script.google.com/macros/s/AKfycbw22-UOsHkaap3dzU16aOjA6XFr7jWGr9qQPfp8F1CQrXboP7YdRZJKKJhHijC3us4/exec';
const ADMIN_BRIDGE = 'https://anasbukhori.app.n8n.cloud/webhook/iuc-admission-v2-admin-bridge';
const FILE_FETCH_CONCURRENCY = 8;
const FILE_FETCH_TIMEOUT_MS = 25000;

async function validateAdminPassword(password) {
  if (!password) return false;
  const url = `${AUTH_WEB_APP}?action=applications&token=${encodeURIComponent(password)}&_=${Date.now()}`;
  const response = await fetch(url, { redirect: 'follow' });
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return response.ok && data && data.ok === true;
  } catch (_) {
    return false;
  }
}

async function callAppsScriptV2(action, data, password, timeoutMs = 60000) {
  const token = String(process.env.V2_ADMIN_API_PASSWORD || password || '');
  if (!token) throw new Error('V2 backend token is not configured.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://script.google.com/macros/s/AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB/exec', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token, data: data || {}, updatedBy: 'Admin Portal V2 - SAC Pack' }),
      redirect: 'follow', signal: controller.signal
    });
    const text = await response.text();
    let parsed; try { parsed = JSON.parse(text); } catch (_) { throw new Error(`V2 backend returned HTTP ${response.status}.`); }
    if (!response.ok || !parsed || parsed.ok === false) throw new Error(parsed?.message || `V2 backend returned HTTP ${response.status}.`);
    return parsed;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error(action + ' timed out.');
    throw error;
  } finally { clearTimeout(timer); }
}

async function callV2(action, data, password, timeoutMs = 60000, authSessionId = '') {
  let bridgeError = null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 20000));
  try {
    const response = await fetch(ADMIN_BRIDGE, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password:String(password||''), sessionId:String(authSessionId||''), action, data:data||{}, updatedBy:'Admin Portal V2 - SAC Pack' }),
      redirect: 'follow', signal: controller.signal
    });
    const text = await response.text(); let parsed = null; try { parsed = JSON.parse(text); } catch (_) {}
    if (response.ok && parsed && parsed.ok !== false) return parsed;
    bridgeError = new Error(parsed?.message || `Admin bridge returned HTTP ${response.status}.`);
  } catch (error) {
    bridgeError = error?.name === 'AbortError' ? new Error(action + ' bridge timed out.') : error;
  } finally { clearTimeout(timer); }

  try {
    return await callAppsScriptV2(action, data, password, timeoutMs);
  } catch (directError) {
    throw new Error(`SAC pack backend failed. Bridge: ${bridgeError?.message || 'unavailable'} | V2 backend: ${directError?.message || 'failed'}`);
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const source = Array.isArray(items) ? items : [];
  const results = new Array(source.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= source.length) return;
      results[index] = await worker(source[index], index);
    }
  }

  const workerCount = Math.max(1, Math.min(Number(concurrency) || 1, source.length || 1));
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}

async function appendPdf(target, bytes) {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: false });
  const indices = source.getPageIndices();
  const copied = await target.copyPages(source, indices);
  copied.forEach(page => target.addPage(page));
}

async function appendImage(target, bytes, mimeType) {
  let image;
  if (/png/i.test(mimeType)) image = await target.embedPng(bytes);
  else image = await target.embedJpg(bytes);
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const margin = 24;
  const maxWidth = pageWidth - margin * 2;
  const maxHeight = pageHeight - margin * 2;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  const page = target.addPage([pageWidth, pageHeight]);
  page.drawImage(image, {
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed.' });

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }

  const password = String(body.password || '');
  const authSessionId = String(body.adminSessionId || '').trim();
  try {
    const local = String(process.env.V2_ADMIN_API_PASSWORD || '');
    const authenticated = Boolean(local && local === password) || await validateAdminPassword(password);
    if (!authenticated) return res.status(401).json({ ok:false, message:'Invalid admin password.' });
  } catch (error) {
    return res.status(502).json({ ok:false, message:error?.message || 'Unable to authenticate SAC pack request.' });
  }

  const sessionId = String(body.sessionId || '').trim();
  if (!sessionId) return res.status(400).json({ ok: false, message: 'SAC Session ID is required.' });

  const candidates = (Array.isArray(body.candidates) ? body.candidates : [])
    .map(item => ({referenceNo:String(item?.referenceNo||'').trim(),studentName:String(item?.studentName||''),programme:String(item?.programme||'')}))
    .filter(item => item.referenceNo);
  if (!candidates.length) return res.status(400).json({ ok:false, message:'No candidates found in this SAC session.' });
  const DOCS=[
    {key:'admissionForm',label:'Admission Form',internal:true},
    {key:'pgAdm01',label:'PG-ADM-01',internal:true},
    {key:'certificate',label:'Certificate'},
    {key:'transcript',label:'Transcript'},
    {key:'resume',label:'Resume / CV'},
    {key:'aiScreeningReport',label:'Final AI Screening Report',internal:true}
  ];

  try {
    const jobs=[];
    for(const candidate of candidates) for(const doc of DOCS) jobs.push({candidate,doc});
    const fetched=await mapWithConcurrency(jobs,FILE_FETCH_CONCURRENCY,async({candidate,doc})=>{
      const attempts=doc.internal?2:1; let lastError='FILE_NOT_AVAILABLE';
      for(let attempt=1;attempt<=attempts;attempt++){
        try{
          const response=await callV2('v2GetSacPackFile',{sessionId,referenceNo:candidate.referenceNo,documentKey:doc.key},password,FILE_FETCH_TIMEOUT_MS,authSessionId);
          const file=response?.result||response;
          if(file?.base64)return {candidate,doc,file};
          lastError='FILE_NOT_AVAILABLE';
        }catch(error){lastError=error?.message||'FILE_FETCH_FAILED';}
      }
      return {candidate,doc,error:lastError};
    });
    const files=fetched.filter(item=>item.file?.base64);
    const stats=new Map(candidates.map(c=>[c.referenceNo,new Set()]));
    for(const item of files) stats.get(item.candidate.referenceNo)?.add(item.doc.key);
    const incompleteCount=candidates.filter(c=>(stats.get(c.referenceNo)?.size||0)<DOCS.length).length;

    const merged = await PDFDocument.create();
    merged.setTitle(`${sessionId} - SAC Print Pack`);
    merged.setSubject('IPGS SAC physical meeting print pack');
    merged.setCreator('IUC IPGS Admission V2');
    merged.setProducer('IUC IPGS Admission V2');

    // Never block the whole SAC pack because one student's file is missing/unprintable.
    const generatedRefs = new Set();
    for (const item of files) {
      try {
        const file = item.file;
        const bytes = Buffer.from(file.base64, 'base64');
        const mime = String(file.mimeType || '').toLowerCase();
        if (mime === 'application/pdf') await appendPdf(merged, bytes);
        else if (/^image\/(png|jpeg|jpg)$/.test(mime)) await appendImage(merged, bytes, mime);
        else continue;
        generatedRefs.add(String(item.candidate.referenceNo || ''));
      } catch (_) { continue; }
    }
    if (!generatedRefs.size) return res.status(400).json({ ok: false, message: 'No printable SAC documents were available.' });

    const bytes = await merged.save({ useObjectStreams: true });
    const safe = String(sessionId)
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'SAC';
    const oneCandidate = candidates.length === 1 ? candidates[0] : null;
    const candidateSafe = oneCandidate ? String(oneCandidate.studentName || oneCandidate.referenceNo || 'Candidate').replace(/[\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 70) : '';
    const fileName = oneCandidate ? `${safe}_${candidateSafe}_SAC-Pack.pdf` : `${safe}_SAC-Print-Pack.pdf`;

    // Persist to Drive when available, but never discard a valid generated PDF because Drive/bridge saving failed.
    let saved = {}, saveWarning = '';
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const savedResponse = await callV2('v2SaveSacPackPdf', {
          sessionId,
          fileName,
          base64: Buffer.from(bytes).toString('base64')
        }, password, 60000, authSessionId);
        saved = savedResponse?.result || savedResponse || {};
        saveWarning = '';
        break;
      } catch (error) {
        saveWarning = error?.message || 'Unable to save SAC Pack to Drive.';
      }
    }

    res.setHeader('X-SAC-Pack-URL', String(saved.fileUrl || ''));
    res.setHeader('X-SAC-Folder-URL', String(saved.folderUrl || ''));
    if (saveWarning) res.setHeader('X-SAC-Save-Warning', encodeURIComponent(saveWarning).slice(0, 1500));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('X-SAC-Candidate-Count', String(generatedRefs.size));
    res.setHeader('X-SAC-Incomplete-Count', String(incompleteCount));
    res.setHeader('X-SAC-Document-Count', String(files.length));
    return res.status(200).send(Buffer.from(bytes));
  } catch (error) {
    return res.status(502).json({ ok: false, message: error?.message || 'Unable to generate SAC print pack.' });
  }
}
