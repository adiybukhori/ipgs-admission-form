/**
 * IPGS Admission V2 - Academic Consultant / Agent administration
 * V2 ONLY. V1 is never read or modified.
 */

const V2_AGENT_MASTER_HEADERS = [
  'Agent Code',
  'Agent Name',
  'Organisation',
  'Agent Email',
  'Active',
  'Referral Link',
  'Created At',
  'Created By',
  'Updated At',
  'Updated By'
];

function v2UpsertAgent_(data, actor) {
  assertDevIdentity_();
  data = data || {};

  const name = String(data.name || data.agentName || '').trim();
  const email = String(data.email || data.agentEmail || '').trim().toLowerCase();
  const organisation = String(data.organisation || '').trim();
  const activeRaw = data.active;
  const inactive = activeRaw === false || ['FALSE','NO','0','INACTIVE'].indexOf(String(activeRaw || '').trim().toUpperCase()) > -1;
  const active = inactive ? 'Inactive' : 'Active';

  if (!name) throw new Error('Academic Consultant / Agent Name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid Academic Consultant / Agent Email is required.');
  }

  let code = String(data.code || data.agentCode || '').trim().toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
  if (!code) code = 'AC-' + Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  if (code.length < 3 || code.length > 30) throw new Error('Agent Code must be between 3 and 30 characters.');

  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = v2EnsureSheetWithHeaders_(
    ss,
    CONFIG.agentMasterSheetName || 'AGENT_MASTER',
    V2_AGENT_MASTER_HEADERS
  );

  const rows = sheet.getLastRow() > 1 ? sheet.getDataRange().getValues() : [];
  const headers = rows.length ? rows[0].map(function(v){ return String(v || '').trim(); }) : v2Headers_(sheet);
  const codeIndex = headers.indexOf('Agent Code');
  const emailIndex = headers.indexOf('Agent Email');

  for (let i = 1; i < rows.length; i++) {
    const rowCode = String(rows[i][codeIndex] || '').trim().toUpperCase();
    const rowEmail = String(rows[i][emailIndex] || '').trim().toLowerCase();
    if (rowEmail === email && rowCode && rowCode !== code) {
      throw new Error('This email is already registered under Agent Code ' + rowCode + '.');
    }
  }

  const existing = v2FindAgentMasterByCode_(sheet, code);
  const now = new Date().toISOString();
  const referralLink = v2AgentReferralLink_(code);
  const updates = {
    'Agent Code': code,
    'Agent Name': name,
    'Organisation': organisation,
    'Agent Email': email,
    'Active': active,
    'Referral Link': referralLink,
    'Created At': existing ? (existing.record['Created At'] || now) : now,
    'Created By': existing ? (existing.record['Created By'] || actor || 'Admin Portal V2') : (actor || 'Admin Portal V2'),
    'Updated At': now,
    'Updated By': actor || 'Admin Portal V2'
  };

  if (existing) {
    v2SetRecordValues_(sheet, existing.rowNumber, updates);
  } else {
    sheet.appendRow(new Array(Math.max(sheet.getLastColumn(), 1)).fill(''));
    v2SetRecordValues_(sheet, sheet.getLastRow(), updates);
  }

  v2Audit_(
    '',
    'AGENT',
    existing ? 'UPDATE_AGENT' : 'ADD_AGENT',
    existing ? existing.record : {},
    updates,
    actor || 'Admin Portal V2',
    'SUCCESS',
    'Academic Consultant / Agent master updated.'
  );

  v2InvalidateCache_();
  return {
    ok: true,
    created: !existing,
    agent: updates,
    referralLink: referralLink,
    emailSent: false,
    v1Touched: false
  };
}

function v2FindAgentMasterByCode_(sheet, code) {
  if (!sheet || sheet.getLastRow() < 2) return null;
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(v){ return String(v || '').trim(); });
  const idx = headers.indexOf('Agent Code');
  if (idx < 0) return null;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idx] || '').trim().toUpperCase() === String(code || '').trim().toUpperCase()) {
      return { sheet: sheet, rowNumber: i + 1, record: v2RowToRecord_(headers, values[i]) };
    }
  }
  return null;
}

function v2AgentReferralLink_(code) {
  const base = String(
    PropertiesService.getScriptProperties().getProperty('V2_PUBLIC_ADMISSION_URL') ||
    'https://ipgs-admission-form.innovative.edu.my/'
  ).trim().replace(/\?+$/, '');
  return base + (base.indexOf('?') === -1 ? '?' : '&') + 'agent=' + encodeURIComponent(String(code || '').trim().toUpperCase());
}

function v2AgentAdminStatus_() {
  assertDevIdentity_();
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.agentMasterSheetName || 'AGENT_MASTER');
  const rows = sheet && sheet.getLastRow() > 1 ? sheet.getDataRange().getValues() : [];
  const headers = rows.length ? rows[0].map(function(v){ return String(v || '').trim(); }) : [];
  const activeIndex = headers.indexOf('Active');
  const total = rows.length ? rows.length - 1 : 0;
  let active = 0;
  if (rows.length && activeIndex > -1) {
    for (let i = 1; i < rows.length; i++) {
      if (String(rows[i][activeIndex] || '').trim().toLowerCase() === 'active') active++;
    }
  }
  return {
    ok: true,
    sheetExists: !!sheet,
    totalAgents: total,
    activeAgents: active,
    referralBase: 'https://ipgs-admission-form.innovative.edu.my/',
    emailMode: v2AgentNotificationMode_(),
    externalEmailSent: false,
    v1Touched: false
  };
}

function v2AgentAdminControlledTest() {
  assertDevIdentity_();
  const sampleCode = 'AC-TEST';
  const link = v2AgentReferralLink_(sampleCode);
  const checks = {
    linkUsesPublicAdmissionDomain: link.indexOf('https://ipgs-admission-form.innovative.edu.my/') === 0,
    linkContainsAgentCode: link.indexOf('agent=' + sampleCode) > -1,
    emailModeSafetyGated: ['DISABLED','TEST','LIVE'].indexOf(v2AgentNotificationMode_()) > -1
  };
  const report = {
    ok: Object.keys(checks).every(function(k){ return checks[k] === true; }),
    checks: checks,
    sampleReferralLink: link,
    emailSent: false,
    v1Touched: false
  };
  Logger.log(JSON.stringify(report));
  return report;
}
