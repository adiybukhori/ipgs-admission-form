export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      message: 'Method not allowed'
    });
  }

  const APPS_SCRIPT_V2_URL =
    'https://script.google.com/macros/s/AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB/exec';

  try {
    const response = await fetch(APPS_SCRIPT_V2_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: typeof req.body === 'string'
      ? req.body
      : JSON.stringify(req.body || {}),
      redirect: 'follow'
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (e) {
      data = {
        ok: false,
        message: text || 'Invalid response from Admission V2 backend.'
      };
    }

    res.setHeader('Cache-Control', 'no-store');

    return res.status(response.ok ? 200 : 502).json(data);

  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error.message || 'Unable to connect to Admission V2 backend.'
    });
  }
}
