const SPREADSHEET_ID = '1O-Y-q7_q78xKM1p5e2C3EWyQfYr5rXvhO0oWbVaw5Mw';
const AUTH_WEB_APP = 'https://script.google.com/macros/s/AKfycbw22-UOsHkaap3dzU16aOjA6XFr7jWGr9qQPfp8F1CQrXboP7YdRZJKKJhHijC3us4/exec';

const TARGET_SHEETS = [
  ['V2_APPLICATIONS', 'A'],
  ['V2_WORKFLOW', 'A'],
  ['V2_DOCUMENT_REVIEW', 'A'],
  ['V2_AI_SCREENING', 'A'],
  ['V2_QUALIFICATION_SCREENING', 'A'],
  ['V2_SAC_CANDIDATES', 'B'],
  ['V2_ASSESSMENT_PROGRESS', 'A'],
  ['V2_AUDIT_LOG', 'C']
];

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
    return res.status(200).json({ ok: true, service: 'IPGS Admission targeted applicant refresh', build: 'ADMIN_RECORD_TARGETED_20260915' });
  }
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

  const referenceNo = String(body.referenceNo || '').trim();
  if (!referenceNo) {
    return res.status(400).json({ ok: false, message: 'Reference No is required.' });
  }

  const settled = await Promise.allSettled(
    TARGET_SHEETS.map(async ([sheet, column]) => [sheet, await fetchReferenceRows(sheet, column, referenceNo)])
  );

  const data = {};
  const warnings = [];
  settled.forEach((result, index) => {
    const sheet = TARGET_SHEETS[index][0];
    if (result.status === 'fulfilled') {
      data[sheet] = result.value[1];
    } else {
      data[sheet] = [];
      warnings.push(`${sheet}: ${result.reason?.message || 'Unable to load'}`);
    }
  });

  return res.status(200).json({
    ok: true,
    build: 'ADMIN_RECORD_TARGETED_20260915',
    referenceNo,
    loadedAt: new Date().toISOString(),
    warnings,
    data
  });
}
