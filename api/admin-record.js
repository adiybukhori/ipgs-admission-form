import { createHash } from 'crypto';

const SPREADSHEET_ID = '1O-Y-q7_q78xKM1p5e2C3EWyQfYr5rXvhO0oWbVaw5Mw';
const AUTH_WEB_APP = 'https://script.google.com/macros/s/AKfycbw22-UOsHkaap3dzU16aOjA6XFr7jWGr9qQPfp8F1CQrXboP7YdRZJKKJhHijC3us4/exec';

const FULL_TARGET_SHEETS = [
  ['V2_APPLICATIONS', 'A'],
  ['V2_WORKFLOW', 'A'],
  ['V2_DOCUMENT_REVIEW', 'A'],
  ['V2_AI_SCREENING', 'A'],
  ['V2_QUALIFICATION_SCREENING', 'A'],
  ['V2_SAC_CANDIDATES', 'B'],
  ['V2_ASSESSMENT_PROGRESS', 'A'],
  ['V2_AUDIT_LOG', 'C']
];

// Used after normal saves. Static application data and the full audit trail are
// already present in the browser and do not need to be re-read after every click.
const LIGHT_TARGET_SHEETS = FULL_TARGET_SHEETS.filter(([name]) => !['V2_APPLICATIONS', 'V2_AUDIT_LOG'].includes(name));

const AUTH_CACHE_TTL_MS = 20 * 60 * 1000;
const authCache = globalThis.__IPGS_RECORD_AUTH_CACHE__ || new Map();
globalThis.__IPGS_RECORD_AUTH_CACHE__ = authCache;

function authKey(password) {
  return createHash('sha256').update(String(password || '')).digest('hex');
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
      row = [];
      field = '';
      continue;
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
  return rows.slice(1)
    .filter(row => row.some(v => String(v || '').trim() !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((header, i) => { if (header) obj[header] = row[i] ?? ''; });
      return obj;
    });
}

async function validateAdminPassword(password) {
  if (!password) return false;
  const key = authKey(password);
  const cachedUntil = Number(authCache.get(key) || 0);
  if (cachedUntil > Date.now()) return true;
  if (cachedUntil) authCache.delete(key);

  const url = `${AUTH_WEB_APP}?action=applications&token=${encodeURIComponent(password)}&_=${Date.now()}`;
  const response = await fetch(url, { redirect: 'follow' });
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    const valid = response.ok && data && data.ok === true;
    if (valid) {
      authCache.set(key, Date.now() + AUTH_CACHE_TTL_MS);
      if (authCache.size > 100) {
        const firstKey = authCache.keys().next().value;
        if (firstKey) authCache.delete(firstKey);
      }
    }
    return valid;
  } catch (_) {
    return false;
  }
}

function gvizLiteral(value) {
  return String(value || '').replace(/'/g, "''");
}

async function fetchReferenceRows(sheet, column, referenceNo) {
  const tq = `select * where ${column} = '${gvizLiteral(referenceNo)}'`;
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&tq=${encodeURIComponent(tq)}&_=${Date.now()}`;
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`${sheet} returned HTTP ${response.status}`);
  return toObjects(await response.text());
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'GET' && String(req.query?.health || '') === '1') {
    return res.status(200).json({ ok: true, service: 'IPGS Admission targeted applicant refresh', build: 'ADMIN_RECORD_FAST_20260928' });
  }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Method not allowed.' });

  const startedAt = Date.now();
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }

  const password = String(body.password || '');
  const authStartedAt = Date.now();
  if (!(await validateAdminPassword(password))) {
    return res.status(401).json({ ok: false, message: 'Invalid admin password.' });
  }
  const authMs = Date.now() - authStartedAt;

  const referenceNo = String(body.referenceNo || '').trim();
  if (!referenceNo) return res.status(400).json({ ok: false, message: 'Reference No is required.' });

  const mode = String(body.mode || 'full').toLowerCase() === 'light' ? 'light' : 'full';
  const targetSheets = mode === 'light' ? LIGHT_TARGET_SHEETS : FULL_TARGET_SHEETS;
  const dataStartedAt = Date.now();
  const settled = await Promise.allSettled(
    targetSheets.map(async ([sheet, column]) => [sheet, await fetchReferenceRows(sheet, column, referenceNo)])
  );

  const data = {};
  const warnings = [];
  settled.forEach((result, index) => {
    const sheet = targetSheets[index][0];
    if (result.status === 'fulfilled') data[sheet] = result.value[1];
    else {
      data[sheet] = [];
      warnings.push(`${sheet}: ${result.reason?.message || 'Unable to load'}`);
    }
  });

  const dataMs = Date.now() - dataStartedAt;
  const totalMs = Date.now() - startedAt;
  res.setHeader('Server-Timing', `auth;dur=${authMs}, data;dur=${dataMs}, total;dur=${totalMs}`);
  return res.status(200).json({
    ok: true,
    build: 'ADMIN_RECORD_FAST_20260928',
    mode,
    referenceNo,
    loadedAt: new Date().toISOString(),
    warnings,
    performance: { authMs, dataMs, totalMs, sheets: targetSheets.length },
    data
  });
}
