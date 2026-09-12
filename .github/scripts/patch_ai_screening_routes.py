from pathlib import Path

path = Path('apps-script-v2/WorkflowV2.js')
text = path.read_text(encoding='utf-8')

marker = "  if (action === 'v2CreateSacSession') return v2CreateSacSession_(payload.data || {}, payload.updatedBy);\n"
insert = """  if (action === 'v2RecordAiScreeningResult') return v2RecordAiScreeningResult_(payload.data || {}, payload.updatedBy);\n  if (action === 'v2ConfirmAiScreening') return v2ConfirmAiScreening_(payload.data || {}, payload.updatedBy);\n"""

if insert in text:
    print('AI screening routes already present.')
elif marker in text:
    text = text.replace(marker, insert + marker, 1)
    path.write_text(text, encoding='utf-8')
    print('AI screening routes patched.')
else:
    raise SystemExit('Expected WorkflowV2 router marker not found; refusing to patch.')
