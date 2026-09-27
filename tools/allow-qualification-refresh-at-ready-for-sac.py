from pathlib import Path

p = Path('apps-script-v2/QualificationScreeningV2.js')
text = p.read_text(encoding='utf-8')
old = """  if (currentStage !== 'DOCUMENT_REVIEW' && currentStage !== 'QUALIFICATION_SCREENING') {
    throw new Error('Qualification screening is not available at current stage: ' + currentStage);
  }
"""
new = """  if (
    currentStage !== 'DOCUMENT_REVIEW' &&
    currentStage !== 'QUALIFICATION_SCREENING' &&
    currentStage !== 'READY_FOR_SAC'
  ) {
    throw new Error('Qualification screening is not available at current stage: ' + currentStage);
  }
"""
if new in text:
    print('READY_FOR_SAC qualification refresh already enabled.')
elif old not in text:
    raise SystemExit('Qualification stage-gate anchor not found.')
else:
    text = text.replace(old, new, 1)
    p.write_text(text, encoding='utf-8')
    print('READY_FOR_SAC qualification refresh enabled.')
