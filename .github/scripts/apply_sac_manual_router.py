from pathlib import Path

path = Path('apps-script-v2/WorkflowV2.js')
text = path.read_text(encoding='utf-8')

needle = "  if (action === 'v2CreateSacSession') return v2CreateSacSession_(payload.data || {}, payload.updatedBy);\n  if (action === 'v2AssignSacCandidate') return v2AssignSacCandidate_(payload.data || {}, payload.updatedBy);\n  if (action === 'v2RecordSacDecision') return v2RecordSacDecision_(payload.data || {}, payload.updatedBy);\n"
insert = needle + "  if (action === 'v2CreateSacSessionManual') return v2CreateSacSessionManual_(payload.data || {}, payload.updatedBy);\n  if (action === 'v2SendSacCalendarInvitationManual') return v2SendSacCalendarInvitationManual_(payload.data || {}, payload.updatedBy);\n  if (action === 'v2RecordSacDecisionManual') return v2RecordSacDecisionManual_(payload.data || {}, payload.updatedBy);\n  if (action === 'v2FinalizeSacSessionManual') return v2FinalizeSacSessionManual_(payload.data || {}, payload.updatedBy);\n  if (action === 'v2SacManualPhase1Status') return v2SacManualPhase1Status_();\n"

if "v2CreateSacSessionManual" in text:
    print('Manual SAC routes already present; no change needed.')
else:
    if needle not in text:
        raise SystemExit('Expected SAC router block not found; stopping safely.')
    text = text.replace(needle, insert, 1)
    path.write_text(text, encoding='utf-8')
    print('Patched WorkflowV2.js with manual SAC phase 1 routes.')
