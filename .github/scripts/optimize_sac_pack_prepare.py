from pathlib import Path

path = Path('apps-script-v2/SacPackV2.js')
text = path.read_text(encoding='utf-8')
marker = 'V2_SAC_PACK_REUSE_EXISTING_FORM_V1'

if marker in text:
    print('SAC pack form reuse optimization already present.')
    raise SystemExit(0)

old = """    const form = v2GeneratePgEligibilityPdf_(reference, sessionId, preparedBy);\n    const manifest = v2BuildSacCandidateManifest_(sessionId, reference, false);\n"""

new = """    // V2_SAC_PACK_REUSE_EXISTING_FORM_V1\n    // Reuse the already-prepared controlled PG-ADM-01 when it is still present\n    // and on the current form version. Re-generating this Google Doc/PDF on\n    // every Print Pack click was the main avoidable delay in SAC preparation.\n    let form = null;\n    const existingFormUrl = String(candidate.record['Form 01 URL'] || '').trim();\n    const existingFormId = v2SacPackExtractDriveId_(existingFormUrl);\n    const existingFormVersion = String(candidate.record['PG Eligibility Form Version'] || '').trim();\n    let canReuseForm = false;\n\n    if (existingFormId && existingFormVersion === V2_PG_ELIGIBILITY_FORM_VERSION) {\n      try {\n        const existingFormFile = DriveApp.getFileById(existingFormId);\n        canReuseForm = !existingFormFile.isTrashed();\n      } catch (ignore) {\n        canReuseForm = false;\n      }\n    }\n\n    if (canReuseForm) {\n      form = {url: existingFormUrl, reused: true};\n    } else {\n      form = v2GeneratePgEligibilityPdf_(reference, sessionId, preparedBy);\n      form.reused = false;\n    }\n\n    const manifest = v2BuildSacCandidateManifest_(sessionId, reference, false);\n"""

if old not in text:
    raise SystemExit('SAC pack generation anchor not found; source changed unexpectedly.')

text = text.replace(old, new, 1)
text = text.replace(
    "'PG-ADM-01 generated into student folders. No SAC decision recorded.'",
    "'PG-ADM-01 prepared/reused in student folders. No SAC decision recorded.'",
    1,
)
path.write_text(text, encoding='utf-8')
print('Applied SAC pack existing-form reuse optimization.')
