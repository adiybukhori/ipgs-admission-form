const SPREADSHEET_ID = '1O-Y-q7_q78xKM1p5e2C3EWyQfYr5rXvhO0oWbVaw5Mw';
const SHEET = 'AGENT_MASTER';

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
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i] ?? ''; });
    return obj;
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  if (req.method !== 'GET') return res.status(405).json({ ok:false, message:'Method not allowed.' });

  try {
    const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET)}&_=${Date.now()}`;
    const response = await fetch(url, { redirect:'follow' });
    if (!response.ok) throw new Error(`AGENT_MASTER returned HTTP ${response.status}`);
    const rows = toObjects(await response.text());
    const agents = rows
      .filter(row => String(row['Agent Code'] || '').trim())
      .filter(row => {
        const active = String(row['Active'] || row['Status'] || '').trim().toLowerCase();
        return !active || active === 'active' || active === 'yes' || active === 'true' || active === '1';
      })
      .map(row => ({
        code: String(row['Agent Code'] || '').trim(),
        name: String(row['Agent Name'] || '').trim(),
        organisation: String(row['Organisation'] || '').trim()
      }))
      .sort((a,b) => a.name.localeCompare(b.name));

    return res.status(200).json({ ok:true, agents });
  } catch (error) {
    return res.status(502).json({ ok:false, message:error?.message || 'Unable to load Academic Consultants.' });
  }
}
