from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PACK = ROOT / 'apps-script-v2' / 'AcceptancePackV2.js'
HTML = ROOT / 'apps-script-v2' / 'acceptance-v2.html'


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'{label}: source pattern not found')
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------
# Backend: Surat Akuan paragraphs can live inside a table cell. Calling
# body.getChildIndex(paragraph) on a nested paragraph throws:
# "Element does not contain the specified child element."
# Keep the date in the same paragraph as the signature so it works in
# Body or TableCell containers without parent-index assumptions.
# ---------------------------------------------------------------------
pack = PACK.read_text(encoding='utf-8')
pack = replace_once(
    pack,
    """    v2AcceptancePackAppendSignature_(target, '', signatureBlob);\n    const idx = body.getChildIndex(target);\n    body.insertParagraph(idx + 1, 'Tarikh: ' + signedDate);\n    return;""",
    """    v2AcceptancePackAppendSignature_(target, '', signatureBlob);\n    target.appendText('\\nTarikh: ' + signedDate);\n    return;""",
    'nested Surat Akuan signature/date fix'
)

# Remove the fragile fallback body.getChildIndex() path as well. If the
# dotted signature line is absent, use a safe body paragraph instead of
# indexing a possibly nested paragraph.
pack = replace_once(
    pack,
    """    if (!target) {\n      const truePara = v2AcceptancePackFindParagraph_(body, ['Yang Benar']);\n      if (truePara) {\n        const idx = body.getChildIndex(truePara);\n        if (idx > -1 && idx + 1 < bodyChildren) {\n          const next = body.getChild(idx + 1);\n          if (next.getType() === DocumentApp.ElementType.PARAGRAPH) target = next.asParagraph();\n        }\n        if (!target) target = body.insertParagraph(idx + 1, '');\n      }\n    }""",
    """    if (!target) {\n      const truePara = v2AcceptancePackFindParagraph_(body, ['Yang Benar']);\n      if (truePara) target = body.appendParagraph('');\n    }""",
    'safe Surat Akuan fallback'
)
PACK.write_text(pack, encoding='utf-8')


# ---------------------------------------------------------------------
# Frontend: never expose Apps Script/DocumentApp exception text to a
# student. On a failed callback first re-check status in case the backend
# completed but the browser lost the success response. Only show a calm,
# user-facing retry message when the record is still pending.
# ---------------------------------------------------------------------
html = HTML.read_text(encoding='utf-8')
old_handler = ".withFailureHandler(error=>{stopSigningProgress(true);button.disabled=false;button.textContent='Submit Acceptance';showMessage(error.message||'Unable to submit acceptance. Please try again.')})"
new_handler = ".withFailureHandler(error=>{console.error('Acceptance submission failed',error);verifyAcceptanceAfterFailure(button)})"
html = replace_once(html, old_handler, new_handler, 'student-safe failure handler')

anchor = """function showMessage(text){const box=document.getElementById('formMessage');box.textContent=text;box.className='message error'}"""
helper = """function verifyAcceptanceAfterFailure(button){\n  google.script.run\n    .withSuccessHandler(result=>{\n      if(String(result&&result.acceptanceStatus||'').toUpperCase()==='ACCEPTED'){\n        stopSigningProgress(false);updateSigningProgress(100,'Acceptance completed');button.textContent='Completed';\n        setTimeout(()=>{document.getElementById('acceptanceView').classList.add('hidden');document.getElementById('completedView').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'})},300);\n        return;\n      }\n      stopSigningProgress(true);button.disabled=false;button.textContent='Submit Acceptance';\n      showMessage('We could not complete your acceptance just now. Your acceptance has not been duplicated. Please wait a few seconds and try once more. If the issue continues, please contact IPGS.');\n    })\n    .withFailureHandler(()=>{\n      stopSigningProgress(true);button.disabled=false;button.textContent='Submit Acceptance';\n      showMessage('We could not confirm the submission status just now. Please wait a few seconds and try once more. If the issue continues, please contact IPGS.');\n    })\n    .v2GetAcceptancePackForToken(ACCEPTANCE_TOKEN);\n}\nfunction showMessage(text){const box=document.getElementById('formMessage');box.textContent=text;box.className='message error'}"""
html = replace_once(html, anchor, helper, 'failure status verification helper')
HTML.write_text(html, encoding='utf-8')

print('Acceptance submit safety patch applied.')
