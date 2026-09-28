import { PDFDocument } from 'pdf-lib';

const AUTH_WEB_APP = 'https://script.google.com/macros/s/AKfycbw22-UOsHkaap3dzU16aOjA6XFr7jWGr9qQPfp8F1CQrXboP7YdRZJKKJhHijC3us4/exec';
const ADMIN_BRIDGE = 'https://anasbukhori.app.n8n.cloud/webhook/iuc-admission-v2-admin-bridge';
const FILE_FETCH_CONCURRENCY = 6;

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

async function callV2(action, data, password) {
  const response = await fetch(ADMIN_BRIDGE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      password: String(password || ''),
      action,
      data: data || {},
      updatedBy: 'Admin Portal V2 - SAC Pack'
    }),
    redirect: 'follow'
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (_) { throw new Error(`Admin bridge returned HTTP ${response.status}.`); }
  if (!response.ok || !parsed || parsed.ok === false) {
    throw new Error(parsed?.message || `Admin bridge returned HTTP ${response.status}.`);
  }
  return parsed;
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
  if (!(await validateAdminPassword(password))) {
    return res.status(401).json({ ok: false, message: 'Invalid admin password.' });
  }

  const sessionId = String(body.sessionId || '').trim();
  if (!sessionId) return res.status(400).json({ ok: false, message: 'SAC Session ID is required.' });

  const choices = Array.isArray(body.choices) ? body.choices : [];
  const choiceMap = new Map(choices.map(item => [String(item.referenceNo || ''), String(item.action || '').toUpperCase()]));

  try {
    const preparedStatus = await callV2('v2GetSacPackPrepareStatus', { sessionId }, password);
    const status = preparedStatus?.result || preparedStatus;
    if (String(status?.status || '').toUpperCase() !== 'COMPLETED' || !status?.payload) {
      return res.status(409).json({ ok: false, message: 'SAC pack preparation is not complete. Please prepare the SAC pack first.' });
    }
    const pack = status.payload?.result || status.payload;
    const candidates = Array.isArray(pack?.candidates) ? pack.candidates : [];
    const kindOf = doc => { const x=String((doc?.key||'')+' '+(doc?.label||'')).toLowerCase(); if(/pg.?adm.?0?1|form.?0?1|eligibility/.test(x))return 'pgAdm01'; if(/ai.*screen|screen.*report/.test(x))return 'aiScreeningReport'; if(/transcript/.test(x))return 'transcript'; if(/certificate|academic.?cert|scroll/.test(x))return 'certificate'; if(/(^|\W)(cv|resume|curriculum)(\W|$)/.test(x))return 'resume'; return ''; };
    const order={pgAdm01:0,aiScreeningReport:1,certificate:2,transcript:3,resume:4};
    const essentialDocs = candidate => (Array.isArray(candidate.documents)?candidate.documents:[]).map(doc=>({doc,kind:kindOf(doc)})).filter(x=>x.kind).sort((a,b)=>order[a.kind]-order[b.kind]).filter((x,i,a)=>a.findIndex(y=>y.kind===x.kind)===i).map(x=>x.doc);
    const essentialComplete = candidate => essentialDocs(candidate).length===5;
    const selected = candidates;
    const incompleteCount = candidates.filter(candidate => !essentialComplete(candidate)).length;

    if (!selected.length) return res.status(400).json({ ok: false, message: 'No candidates found in this SAC session.' });

    const jobs = [];
    for (const candidate of selected) for (const doc of essentialDocs(candidate)) jobs.push({ candidate, doc });

    const fetched = await mapWithConcurrency(jobs, FILE_FETCH_CONCURRENCY, async ({ candidate, doc }) => {
      try {
        const response = await callV2('v2GetSacPackFile', { sessionId, referenceNo: candidate.referenceNo, documentKey: doc.key }, password);
        const file = response?.result || response;
        if (!file?.base64) return { candidate, doc, error: 'FILE_NOT_AVAILABLE' };
        return { candidate, doc, file };
      } catch (error) { return { candidate, doc, error: error?.message || 'FILE_FETCH_FAILED' }; }
    });
    const files = fetched.filter(item => item.file?.base64);

    const merged = await PDFDocument.create();
    merged.setTitle(`${pack.sessionName || sessionId} - SAC Print Pack`);
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
    const safe = String(pack.sessionName || sessionId)
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'SAC';
    const fileName = `${safe}_SAC-Print-Pack.pdf`;

    // Persist the merged pack in the session's Drive folder before returning it.
    const savedResponse = await callV2('v2SaveSacPackPdf', {
      sessionId,
      fileName,
      base64: Buffer.from(bytes).toString('base64')
    }, password);
    const saved = savedResponse?.result || savedResponse || {};

    res.setHeader('X-SAC-Pack-URL', String(saved.fileUrl || ''));
    res.setHeader('X-SAC-Folder-URL', String(saved.folderUrl || ''));
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
