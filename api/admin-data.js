const SPREADSHEET_ID = '1O-Y-q7_q78xKM1p5e2C3EWyQfYr5rXvhO0oWbVaw5Mw';
const V1_SPREADSHEET_ID = '1RqRfq9savLdoi_A640A4lS-FPcD1TqmQ8zBgS_MeQuI';
const V1_MASTER_SHEET = 'MASTER_DATABASE';
const AUTH_WEB_APP = 'https://script.google.com/macros/s/AKfycbw22-UOsHkaap3dzU16aOjA6XFr7jWGr9qQPfp8F1CQrXboP7YdRZJKKJhHijC3us4/exec';

const SHEETS = [
  'V2_APPLICATIONS',
  'V2_WORKFLOW',
  'V2_DOCUMENT_REVIEW',
  'V2_AI_SCREENING',
  'V2_QUALIFICATION_SCREENING',
  'V2_SAC_SESSIONS',
  'V2_SAC_CANDIDATES',
  'SAC_COMMITTEE_MASTER',
  'AGENT_MASTER',
  'V2_ASSESSMENT_PROGRESS',
  'V2_INTAKE_MASTER',
  'V2_ORIENTATION_SESSIONS',
  'V2_ORIENTATION_TRACKING',
  'V2_AUDIT_LOG'
];

const ADMIN_DATA_CACHE = globalThis.__IPGS_ADMIN_DATA_CACHE__ || (globalThis.__IPGS_ADMIN_DATA_CACHE__ = {
  v2: null,
  v2At: 0,
  v1: null,
  v1At: 0,
  v1Source: ''
});
const V2_DATA_CACHE_MS = 30 * 1000;
const V1_DATA_CACHE_MS = 5 * 60 * 1000;

function cloneCached(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (ch === '"') {
      if (quoted && next === '"') { field += '"'; i++; }
      else quoted = !quoted;
      continue;
    }
    if (ch === ',' && !quoted) { row.push(field); field = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(field);
      if (row.some(v => String(v || '').trim() !== '')) rows.push(row);
      row = []; field = ''; continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some(v => String(v || '').trim() !== '')) rows.push(row);
  return rows;
}

function toObjects(csv) {
  const rows = parseCsv(csv);
  if (!rows.length) return [];
  const headers = rows[0].map(v => String(v || '').trim());
  return rows.slice(1).filter(row => row.some(v => String(v || '').trim() !== '')).map(row => {
    const obj = {};
    headers.forEach((header, i) => { if (header) obj[header] = row[i] ?? ''; });
    return obj;
  });
}

function firstValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function normalizeLegacyRow(row) {
  const source = row && typeof row === 'object' ? row : {};
  return {
    ...source,
    'Timestamp': firstValue(source, ['Timestamp', 'Submitted At', 'submittedAt', 'createdAt', 'Created At']),
    'Ref No': firstValue(source, ['Ref No', 'Reference No', 'referenceNo', 'reference', 'ref', 'LOA Ref', 'LOA Reference']),
    'Student Name': firstValue(source, ['Student Name', 'studentName', 'name', 'Full Name']),
    'IC': firstValue(source, ['IC', 'ID / Passport No', 'ic', 'idPassport', 'passportNo']),
    'Email': firstValue(source, ['Email', 'Personal Email', 'email', 'personalEmail']),
    'Programme': firstValue(source, ['Programme', 'programme', 'Program', 'program']),
    'Intake': firstValue(source, ['Intake', 'intake', 'Session', 'session']),
    'Folder URL': firstValue(source, ['Folder URL', 'Student Folder URL', 'folderUrl', 'studentFolderUrl']),
    'Email Sent': firstValue(source, ['Email Sent', 'Offer Email Sent', 'LOA Email Sent', 'emailSent']),
    'Offer Letter File': firstValue(source, ['Offer Letter File', 'Offer Letter PDF URL', 'Offer Letter URL', 'LOA File', 'LOA URL', 'offerLetterUrl']),
    'Acceptance Status': firstValue(source, ['Acceptance Status', 'acceptanceStatus', 'Status']),
    'Acceptance Received At': firstValue(source, ['Acceptance Received At', 'acceptanceReceivedAt', 'Accepted At']),
    'Acceptance Offer File': firstValue(source, ['Acceptance Offer File', 'Acceptance PDF URL', 'acceptanceFile', 'acceptanceUrl']),
    'Surat Akuan File': firstValue(source, ['Surat Akuan File', 'Surat Akuan PDF URL', 'suratAkuanFile']),
    'Surat Penerimaan File': firstValue(source, ['Surat Penerimaan File', 'Surat Penerimaan PDF URL', 'suratPenerimaanFile']),
    'Remark': firstValue(source, ['Remark', 'Remarks', 'remark', 'remarks'])
  };
}

function extractLegacyRows(payload) {
  const candidates = [
    payload?.applications,
    payload?.records,
    payload?.rows,
    payload?.MASTER_DATABASE,
    payload?.masterDatabase,
    payload?.data?.applications,
    payload?.data?.records,
    payload?.data?.rows,
    payload?.data?.MASTER_DATABASE,
    payload?.data?.masterDatabase,
    Array.isArray(payload?.data) ? payload.data : null
  ];
  const list = candidates.find(value => Array.isArray(value) && value.length && typeof value[0] === 'object');
  return Array.isArray(list) ? list.map(normalizeLegacyRow).filter(row => String(row['Ref No'] || row['Student Name'] || '').trim()) : [];
}

function sacSessionSortValue(row) {
  const meetingDate = String(row?.['Meeting Date'] || '').trim();
  const meetingTime = String(row?.['Meeting Time'] || '').trim();
  const meetingValue = Date.parse([meetingDate, meetingTime].filter(Boolean).join(' '));
  if (Number.isFinite(meetingValue)) return meetingValue;

  const createdValue = Date.parse(String(row?.['Created At'] || '').trim());
  return Number.isFinite(createdValue) ? createdValue : 0;
}

async function fetchAdminAuth(password) {
  if (!password) return { valid: false, payload: null };
  const url = `${AUTH_WEB_APP}?action=applications&token=${encodeURIComponent(password)}&_=${Date.now()}`;
  const response = await fetch(url, { redirect: 'follow' });
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    return { valid: response.ok && data && data.ok === true, payload: data };
  } catch (_) {
    return { valid: false, payload: null };
  }
}

async function fetchSheet(sheet) {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_=${Date.now()}`;
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`${sheet} returned HTTP ${response.status}`);
  return toObjects(await response.text());
}

async function fetchLegacyMasterSheet() {
  const url = `https://docs.google.com/spreadsheets/d/${V1_SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(V1_MASTER_SHEET)}&_=${Date.now()}`;
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`${V1_MASTER_SHEET} returned HTTP ${response.status}`);
  return toObjects(await response.text()).map(normalizeLegacyRow).filter(row => String(row['Ref No'] || row['Student Name'] || '').trim());
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'GET' && String(req.query?.health || '') === '1') {
    return res.status(200).json({ ok: true, service: 'IPGS Admission Admin Data V2 + V1 Legacy', build: 'ADMIN_DATA_V2_V1_CACHE_20260915' });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed.' });

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }

  const auth = await fetchAdminAuth(body.password);
  if (!auth.valid) {
    return res.status(401).json({ ok: false, message: 'Invalid admin password.' });
  }

  const force = body.force === true;
  const nowMs = Date.now();
  let data = {};
  const warnings = [];
  let v2CacheHit = false;
  let v1CacheHit = false;

  if (!force && ADMIN_DATA_CACHE.v2 && (nowMs - ADMIN_DATA_CACHE.v2At) < V2_DATA_CACHE_MS) {
    data = cloneCached(ADMIN_DATA_CACHE.v2);
    v2CacheHit = true;
  } else {
    const settled = await Promise.allSettled(SHEETS.map(async sheet => [sheet, await fetchSheet(sheet)]));
    settled.forEach((result, index) => {
      const sheet = SHEETS[index];
      if (result.status === 'fulfilled') {
        const [name, rows] = result.value;
        data[name] = rows;
      } else {
        data[sheet] = [];
        warnings.push(`${sheet}: ${result.reason?.message || 'Unable to load'}`);
      }
    });
    ADMIN_DATA_CACHE.v2 = cloneCached(data);
    ADMIN_DATA_CACHE.v2At = nowMs;
  }

  let legacyRows = [];
  let legacySource = '';
  if (!force && ADMIN_DATA_CACHE.v1 && (nowMs - ADMIN_DATA_CACHE.v1At) < V1_DATA_CACHE_MS) {
    legacyRows = cloneCached(ADMIN_DATA_CACHE.v1);
    legacySource = ADMIN_DATA_CACHE.v1Source || 'CACHE';
    v1CacheHit = true;
  } else {
    legacyRows = extractLegacyRows(auth.payload);
    legacySource = legacyRows.length ? 'V1_AUTH_WEB_APP' : '';
    if (!legacyRows.length) {
      try {
        legacyRows = await fetchLegacyMasterSheet();
        legacySource = 'V1_MASTER_DATABASE';
      } catch (error) {
        warnings.push(`V1 Legacy: ${error?.message || 'Unable to load legacy data'}`);
      }
    }
    ADMIN_DATA_CACHE.v1 = cloneCached(legacyRows);
    ADMIN_DATA_CACHE.v1At = nowMs;
    ADMIN_DATA_CACHE.v1Source = legacySource;
  }
  data.V1_MASTER_DATABASE = legacyRows;
  data.V1_LEGACY_META = [{ source: legacySource || 'UNAVAILABLE', count: legacyRows.length, readOnly: true, cacheHit: v1CacheHit }];

  if (Array.isArray(data.V2_SAC_SESSIONS)) {
    data.V2_SAC_SESSIONS.sort((a, b) => {
      const meetingDiff = sacSessionSortValue(b) - sacSessionSortValue(a);
      if (meetingDiff !== 0) return meetingDiff;
      const createdA = Date.parse(String(a?.['Created At'] || '').trim()) || 0;
      const createdB = Date.parse(String(b?.['Created At'] || '').trim()) || 0;
      return createdB - createdA;
    });
  }

  return res.status(200).json({ ok: true, build: 'ADMIN_DATA_V2_V1_CACHE_20260915', loadedAt: new Date().toISOString(), warnings, cache: { v2Hit: v2CacheHit, v1Hit: v1CacheHit, v2TtlSeconds: 30, v1TtlSeconds: 300, forced: force }, data });
}
