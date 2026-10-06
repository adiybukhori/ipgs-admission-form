export const config = {
  api: {
    bodyParser: false,
  },
};

const APPS_SCRIPT_V2_URL =
  'https://script.google.com/macros/s/AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB/exec';

const SUPABASE_URL = 'https://mcfdepjrpeaeqqjbojzo.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Gk-dzl5VgKFEE4wskPeAIQ_5sm3V7_z';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function cleanMessage(message) {
  const text = String(message || '');
  if (/file or directory could not be found/i.test(text)) {
    return 'Your application has been securely received and is being finalised.';
  }
  return text;
}

async function supabaseRpc(name, body) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { message: text }; }
  if (!response.ok) {
    const err = new Error((data && (data.message || data.error)) || 'Secure receipt service unavailable.');
    err.code = response.status;
    throw err;
  }
  return data;
}

async function safetyStoreChunk(data) {
  const buffer = Buffer.from(String(data.base64 || ''), 'base64');
  const safeUploadId = encodeURIComponent(String(data.uploadId || ''));
  const safeField = encodeURIComponent(String(data.field || ''));
  const path = `chunks/${safeUploadId}/${safeField}/${Number(data.chunkIndex)}.bin`;

  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/admission-safety-buffer/${path}`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/octet-stream'
      },
      body: buffer
    }
  );

  if (!response.ok) {
    const text = await response.text();
    const duplicate = response.status === 400 && /already exists|duplicate|resource already exists/i.test(text);
    if (!duplicate) {
      throw new Error(text || 'Unable to secure document upload.');
    }
  }

  await supabaseRpc('admission_record_chunk', {
    p_upload_id: String(data.uploadId || ''),
    p_field_key: String(data.field || ''),
    p_chunk_index: Number(data.chunkIndex),
    p_chunk_count: Number(data.chunkCount),
    p_file_name: String(data.fileName || ''),
    p_mime_type: String(data.mimeType || 'application/octet-stream'),
    p_file_size: Number(data.size || 0),
    p_storage_path: path,
    p_bytes_stored: buffer.length
  });

  return path;
}

async function postLegacy(payload) {
  const response = await fetch(APPS_SCRIPT_V2_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = { ok: false, message: text || 'Invalid response from Admission V2 backend.' };
  }
  return { httpOk: response.ok, data };
}

async function markBackendResult(submissionKey, ok, reference, errorMessage) {
  try {
    await supabaseRpc('admission_mark_backend_result', {
      p_submission_key: submissionKey,
      p_ok: !!ok,
      p_reference: reference || null,
      p_error_message: errorMessage || null
    });
  } catch (_) {
    // Receipt is already durable; never convert a successful receipt into a student-facing failure.
  }
}

async function triggerRecovery(submissionKey) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admission-recovery-worker`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ submissionKey })
    });
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = {}; }
    return response.ok ? data : null;
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Admission-Proxy-Version', 'v3-durable-receipt-20261006');

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  try {
    const rawBody = await readRawBody(req);
    if (!rawBody) {
      return res.status(400).json({ ok: false, message: 'Empty admission request body.' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (_) {
      return res.status(400).json({ ok: false, message: 'Invalid admission request.' });
    }

    if (!payload || !payload.action) {
      return res.status(400).json({ ok: false, message: 'Unsupported admission action.' });
    }

    if (payload.action === 'v2SubmissionStatus') {
      const receiptNo = String(payload.receiptNo || payload.data?.receiptNo || '').trim();
      if (!receiptNo) {
        return res.status(400).json({ ok: false, message: 'Receipt number is required.' });
      }
      const status = await supabaseRpc('admission_receipt_status', { p_receipt_no: receiptNo });
      return res.status(200).json(status);
    }

    if (payload.action !== 'v2SubmitAdmission') {
      return res.status(400).json({ ok: false, message: 'Unsupported admission action.' });
    }

    const data = payload.data || {};

    // 1) DOCUMENT CHUNK: first make a durable safety copy in Supabase.
    if (data.__admissionUploadChunk === true) {
      if (!data.uploadId || !data.field || !data.fileName ||
          !Number.isInteger(Number(data.chunkIndex)) || !Number.isInteger(Number(data.chunkCount)) ||
          !data.base64) {
        return res.status(400).json({
          ok: false,
          message: 'We could not securely receive this document. Please retry the submission.'
        });
      }

      await safetyStoreChunk(data);

      return res.status(200).json({
        ok: true,
        securelyReceived: true,
        message: 'Document securely received.'
      });
    }

    // 2) FINAL RECEIPT: do not show success until Supabase confirms the form + all declared docs.
    const submissionKey = String(data?.meta?.submissionKey || '').trim();
    if (!submissionKey) {
      return res.status(400).json({
        ok: false,
        message: 'We could not securely confirm this submission. Please try again.'
      });
    }

    let receipt;
    try {
      receipt = await supabaseRpc('admission_finalize_receipt', {
        p_submission_key: submissionKey,
        p_payload: data
      });
    } catch (_) {
      return res.status(503).json({
        ok: false,
        message: 'We could not securely confirm this submission. Please try again.'
      });
    }

    // 3) Acknowledge immediately after durable receipt.
    // Google Drive / Apps Script finalisation runs asynchronously through the Supabase recovery worker.
    return res.status(200).json({
      ok: true,
      received: true,
      processingComplete: false,
      receiptNo: receipt.receiptNo,
      reference: receipt.receiptNo,
      message: 'Application securely received.'
    });
  } catch (_) {
    return res.status(503).json({
      ok: false,
      message: 'We could not securely confirm this submission. Please try again.'
    });
  }
}
