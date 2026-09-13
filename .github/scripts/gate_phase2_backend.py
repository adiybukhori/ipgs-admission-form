from pathlib import Path
p=Path('admin.html')
s=p.read_text(encoding='utf-8')
marker='PHASE2_BACKEND_SYNC_GATE_V1'
if marker not in s:
    anchor="    const ACTION_API = '/api/admin-action';\n"
    repl=anchor+"    // PHASE2_BACKEND_SYNC_GATE_V1: flip only after Apps Script deployment + controlled tests pass.\n    const PHASE2_BACKEND_READY = false;\n"
    if anchor not in s: raise SystemExit('ACTION_API anchor missing')
    s=s.replace(anchor,repl,1)

    s=s.replace('<button class="ops-btn" onclick="retryAutoAiScreening()">Retry AI Auto</button>', '${PHASE2_BACKEND_READY?\'<button class="ops-btn" onclick="retryAutoAiScreening()">Retry AI Auto</button>\':\'<button class="ops-btn" disabled>AI Auto · backend sync pending</button>\'}')
    s=s.replace('<button class="ops-btn primary" onclick="completeManualScreening()">Complete Manual Review</button>', '${PHASE2_BACKEND_READY?\'<button class="ops-btn primary" onclick="completeManualScreening()">Complete Manual Review</button>\':\'<button class="ops-btn" disabled>Manual Override · backend sync pending</button>\'}')
    s=s.replace("actions='<button class=\"ops-btn primary\" onclick=\"issueOffer()\">Generate & Send Offer</button>';", "actions=PHASE2_BACKEND_READY?'<button class=\"ops-btn primary\" onclick=\"issueOffer()\">Generate & Send Offer</button>':'<button class=\"ops-btn\" disabled>Generate Offer · backend sync pending</button>';", 1)
p.write_text(s,encoding='utf-8')
