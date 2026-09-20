const V2_WEB_APP = 'https://script.google.com/macros/s/AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB/exec';

const PUBLIC_ACTIONS = new Set([
  'v2GetOrientationAttendanceContext',
  'v2ResolveOrientationAttendanceIdentity',
  'v2SubmitOrientationAttendance',
  'v2SubmitOrientationFeedback'
]);

function cleanError(text = '') {
  return String(text)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 600);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed.' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }

  const action = String(body.action || '');
  if (!PUBLIC_ACTIONS.has(action)) {
    return res.status(400).json({ ok: false, message: 'Unsupported attendance action.' });
  }

  try {
    const response = await fetch(V2_WEB_APP, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, data: body.data || {} }),
      redirect: 'follow'
    });
    const text = await response.text();
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (_) { throw new Error(cleanError(text) || 'Attendance service returned an invalid response.'); }

    if (!response.ok || !parsed || parsed.ok === false) {
      throw new Error(parsed?.message || 'Attendance service could not complete the request.');
    }
    return res.status(200).json({ ok: true, result: parsed });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      message: error?.message || 'Unable to reach the attendance service.'
    });
  }
}
