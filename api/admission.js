export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

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
    const rawBody = await readRawBody(req);

    if (!rawBody) {
      return res.status(400).json({
        ok: false,
        message: 'Empty admission request body.'
      });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      return res.status(400).json({
        ok: false,
        message: 'Invalid admission request JSON.'
      });
    }

    if (!payload || payload.action !== 'v2SubmitAdmission') {
      return res.status(400).json({
        ok: false,
        message: 'Unsupported admission action.'
      });
    }

    const response = await fetch(APPS_SCRIPT_V2_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (error) {
      data = {
        ok: false,
        message: text || 'Invalid response from Admission V2 backend.'
      };
    }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Admission-Proxy-Version', 'v2-raw-body-20260910');

    return res.status(response.ok ? 200 : 502).json(data);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: error && error.message
        ? error.message
        : 'Unable to connect to Admission V2 backend.'
    });
  }
}
