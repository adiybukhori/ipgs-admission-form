from pathlib import Path

path = Path('apps-script-v2/SacDocumentsV2.js')
text = path.read_text(encoding='utf-8')

old = """    sacData.decisionCounts.INTERNAL_ASSESSMENT +\n    ' Internal Assessment, ' +\n    sacData.decisionCounts.PREREQUISITE +\n    ' Prerequisite, and ' +\n    sacData.decisionCounts.REJECTED +\n    ' Rejected.'\n"""
new = """    sacData.decisionCounts.INTERNAL_ASSESSMENT +\n    ' Internal Assessment, and ' +\n    sacData.decisionCounts.REJECTED +\n    ' Rejected.'\n"""
if old not in text:
    raise SystemExit('Decision count paragraph pattern not found; stopping safely.')
text = text.replace(old, new, 1)

old = """  body.appendParagraph(\n    'Candidates endorsed for Prerequisite shall complete the approved ' +\n    'Prerequisite process before progression.'\n  );\n"""
new = """  body.appendParagraph(\n    'Prerequisite is not a direct SAC decision in Phase 1. Where required, ' +\n    'it may only be assigned after the Internal Assessment panel result.'\n  );\n"""
if old not in text:
    raise SystemExit('Prerequisite resolution paragraph not found; stopping safely.')
text = text.replace(old, new, 1)

old = "'Arrange Internal Assessment / Prerequisite process for applicable candidates.'"
new = "'Arrange Internal Assessment for applicable candidates. Any prerequisite requirement must arise from the IA panel result.'"
if old not in text:
    raise SystemExit('Follow-up action text not found; stopping safely.')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
print('Updated SAC Minutes/Endorsement wording for Phase 1 manual policy.')
