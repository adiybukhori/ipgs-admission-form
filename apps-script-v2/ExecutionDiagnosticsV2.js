function v2ExecutionPing() {
  return {
    ok: true,
    timestamp: new Date().toISOString(),
    build: typeof V2_BUILD !== 'undefined' ? V2_BUILD : '',
    spreadsheetId: CONFIG && CONFIG.spreadsheetId ? CONFIG.spreadsheetId : ''
  };
}
