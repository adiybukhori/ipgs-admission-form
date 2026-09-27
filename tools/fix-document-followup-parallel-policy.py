from pathlib import Path

p = Path('apps-script-v2/DocumentReplacementV2.js')
text = p.read_text(encoding='utf-8')

replacements = [
(
"""  const reviewStatus=String(doc.record['Review Status']||wf.record['Document Review Status']||'').toUpperCase();
  if(reviewStatus!=='INCOMPLETE'){
    throw new Error('Missing-document request is only available when Document Review Status is INCOMPLETE.');
  }

  let missing=[];""",
"""  const reviewStatus=String(doc.record['Review Status']||wf.record['Document Review Status']||'').toUpperCase();

  let missing=[];""",
'Missing request status gate'
),
(
"During the quality review of your admission documents, one or more files require replacement before academic screening can continue.",
"During the quality review of your admission documents, one or more files require replacement. Academic screening may continue in parallel, but the pending document must be resolved before SAC unless an authorised SAC exception is recorded.",
'Replacement text policy'
),
(
"During the quality review of your admission documents, one or more files need to be replaced before academic screening can continue.",
"During the quality review of your admission documents, one or more files need to be replaced. Academic screening may continue in parallel, but the pending document must be resolved before SAC unless an authorised SAC exception is recorded.",
'Replacement HTML policy'
),
(
"Your admission application was received successfully. Before academic screening can continue, please provide the required document(s) listed below.",
"Your admission application was received successfully. Please provide the required document(s) listed below. Academic screening may continue in parallel, but the pending document must be resolved before SAC unless an authorised SAC exception is recorded.",
'Missing text policy'
),
(
"Your application has been received. Before academic screening can continue, please provide the required document(s) below.",
"Your application has been received. Please provide the required document(s) below. Academic screening may continue in parallel, but the pending document must be resolved before SAC unless an authorised SAC exception is recorded.",
'Missing HTML policy'
),
]

for old, new, label in replacements:
    if new in text:
        print(label + ': already patched')
        continue
    if old not in text:
        raise SystemExit(label + ': anchor not found')
    text = text.replace(old, new, 1)

p.write_text(text, encoding='utf-8')
print('Document follow-up parallel policy patched.')
