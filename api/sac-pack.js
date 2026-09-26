import { PDFDocument } from 'pdf-lib';

const AUTH_WEB_APP = 'https://script.google.com/macros/s/AKfycbw22-UOsHkaap3dzU16aOjA6XFr7jWGr9qQPfp8F1CQrXboP7YdRZJKKJhHijC3us4/exec';
const ADMIN_BRIDGE = 'https://anasbukhori.app.n8n.cloud/webhook/iuc-admission-v2-admin-bridge';

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
    const prepared = await callV2('v2PrepareSacPack', { sessionId }, password);
    const pack = prepared?.result || prepared;
    const candidates = Array.isArray(pack?.candidates) ? pack.candidates : [];
    const selected = candidates.filter(candidate => candidate.complete || choiceMap.get(String(candidate.referenceNo || '')) === 'PROCEED');

    if (!selected.length) return res.status(400).json({ ok: false, message: 'No candidates were selected for printing.' });

    const merged = await PDFDocument.create();
    merged.setTitle(`${pack.sessionName || sessionId} - SAC Print Pack`);
    merged.setSubject('IPGS SAC physical meeting print pack');
    merged.setCreator('IUC IPGS Admission V2');
    merged.setProducer('IUC IPGS Admission V2');

    for (const candidate of selected) {
      const docs = Array.isArray(candidate.documents) ? candidate.documents : [];
      for (const doc of docs) {
        const response = await callV2('v2GetSacPackFile', {
          sessionId,
          referenceNo: candidate.referenceNo,
          documentKey: doc.key
        }, password);
        const file = response?.result || response;
        if (!file?.base64) throw new Error(`Unable to retrieve ${doc.label || doc.key} for ${candidate.studentName || candidate.referenceNo}.`);

        const bytes = Buffer.from(file.base64, 'base64');
        const mime = String(file.mimeType || '').toLowerCase();
        if (mime === 'application/pdf') await appendPdf(merged, bytes);
        else if (/^image\/(png|jpeg|jpg)$/.test(mime)) await appendImage(merged, bytes, mime);
        else throw new Error(`Unsupported printable file type for ${file.fileName || doc.label}: ${mime || 'unknown'}.`);
      }
    }

    const bytes = await merged.save({ useObjectStreams: true });
    const safe = String(pack.sessionName || sessionId)
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'SAC';
    const fileName = `${safe}_SAC-Print-Pack.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('X-SAC-Candidate-Count', String(selected.length));
    return res.status(200).send(Buffer.from(bytes));
  } catch (error) {
    return res.status(502).json({ ok: false, message: error?.message || 'Unable to generate SAC print pack.' });
  }
}
