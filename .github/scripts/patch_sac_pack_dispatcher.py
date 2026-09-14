from pathlib import Path

path = Path('apps-script-v2/WorkflowV2.js')
text = path.read_text(encoding='utf-8')
marker = "  if (action === 'v2AssignSacCandidate') return v2AssignSacCandidate_(payload.data || {}, payload.updatedBy);\n"
insert = marker + "  if (action === 'v2PrepareSacPack') return v2PrepareSacPack_(payload.data || {}, payload.updatedBy);\n  if (action === 'v2GetSacPackFile') return v2GetSacPackFile_(payload.data || {});\n"
if "v2PrepareSacPack" in text and "v2GetSacPackFile" in text:
    print('SAC pack dispatcher actions already present.')
elif marker not in text:
    raise SystemExit('Dispatcher patch target not found')
else:
    text = text.replace(marker, insert, 1)
    path.write_text(text, encoding='utf-8')
    print('Added SAC pack actions to WorkflowV2 dispatcher.')
