/** Public, read-only Academic Consultant directory for the V2 admission form. */
function v2PublicAgents() {
  assertDevIdentity_();
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(CONFIG.agentMasterSheetName || 'AGENT_MASTER');
  if (!sheet || sheet.getLastRow() < 2) return {ok:true, agents:[], v1Touched:false};

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function(v){ return String(v || '').trim(); });
  const idxCode = headers.indexOf('Agent Code');
  const idxName = headers.indexOf('Agent Name');
  const idxOrg = headers.indexOf('Organisation');
  const idxActive = headers.indexOf('Active');
  if (idxCode < 0) return {ok:true, agents:[], v1Touched:false};

  const agents = values.slice(1)
    .filter(function(row){
      const code = String(row[idxCode] || '').trim();
      if (!code) return false;
      if (idxActive < 0) return true;
      const active = String(row[idxActive] || '').trim().toLowerCase();
      return !active || active === 'active' || active === 'yes' || active === 'true' || active === '1';
    })
    .map(function(row){
      return {
        code: String(row[idxCode] || '').trim(),
        name: idxName > -1 ? String(row[idxName] || '').trim() : '',
        organisation: idxOrg > -1 ? String(row[idxOrg] || '').trim() : ''
      };
    })
    .sort(function(a,b){ return a.name.localeCompare(b.name); });

  return {ok:true, agents:agents, v1Touched:false};
}
