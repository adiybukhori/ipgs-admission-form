const V2_WEB_APP = 'https://script.google.com/macros/s/AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB/exec';
const AUTH_WEB_APP = 'https://script.google.com/macros/s/AKfycbw22-UOsHkaap3dzU16aOjA6XFr7jWGr9qQPfp8F1CQrXboP7YdRZJKKJhHijC3us4/exec';

const ALLOWED_ACTIONS = new Set([
  'v2ListWorkflow',
  'v2UpdateStage',
  'v2RunDocumentReview',
  'v2RunQualificationScreening',
  'v2CreateSacSession',
  'v2AssignSacCandidate',
  'v2RecordSacDecision',
  'v2UpdateAssessment'
]);

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

function extractAppsScriptError(text = '') {
  const clean = String(text)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  const match = clean.match(/Error:\s*([^]*?)(?:\(line|$)/i);
  return (match && match[1] ? match[1] : clean).trim().slice(0, 700);
}

async function callV2(action, data, password, updatedBy) {
  const token = process.env.V2_ADMIN_API_PASSWORD || password;
  const payload = { action, token, data: data || {}, updatedBy: updatedBy || 'Admin Portal V2' };
  const response = await fetch(V2_WEB_APP, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });
  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    const message = extractAppsScriptError(text) || `V2 backend returned HTTP ${response.status}.`;
    const error = new Error(message);
    error.code = /DEV_LOCKED/i.test(message) ? 'V2_ACTIONS_LOCKED' : 'V2_BACKEND_INVALID_RESPONSE';
    throw error;
  }
  if (!response.ok || !parsed || parsed.ok === false) {
    const error = new Error(parsed?.message || `V2 backend returned HTTP ${response.status}.`);
    error.code = /DEV_LOCKED/i.test(error.message) ? 'V2_ACTIONS_LOCKED' : 'V2_ACTION_FAILED';
    throw error;
  }
  return parsed;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed.' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }

  const password = String(body.password || '');
  if (!(await validateAdminPassword(password))) {
    return res.status(401).json({ ok: false, message: 'Invalid admin password.' });
  }

  const action = String(body.action || '');
  if (!ALLOWED_ACTIONS.has(action)) {
    return res.status(400).json({ ok: false, message: 'Unsupported or unapproved Admin V2 action.' });
  }

  try {
    const result = await callV2(action, body.data || {}, password, body.updatedBy);
    return res.status(200).json({ ok: true, action, result });
  } catch (error) {
    const locked = error?.code === 'V2_ACTIONS_LOCKED';
    return res.status(locked ? 503 : 502).json({
      ok: false,
      code: error?.code || 'V2_ACTION_FAILED',
      message: error?.message || 'Unable to complete the Admin V2 action.'
    });
  }
}
