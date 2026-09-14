from pathlib import Path

# Admission V2: create PG-ADM-01 immediately after the application/workflow rows exist.
p = Path('apps-script-v2/AdmissionV2.js')
s = p.read_text(encoding='utf-8')
marker = '// V2_PG_ADM01_ON_SUBMISSION_V1'
if marker not in s:
    old = """    v2StartWorkflowForApplication_(row);\n    let emailStatus = 'DISABLED';\n"""
    new = """    v2StartWorkflowForApplication_(row);\n\n    // V2_PG_ADM01_ON_SUBMISSION_V1\n    // Create the standard PG-ADM-01 at the same time as the Admission Form.\n    // It is stored in the student folder only and is not emailed to the applicant.\n    let pgAdm01 = null;\n    try {\n      pgAdm01 = v2GeneratePgEligibilityPdf_(reference, '', 'Admission Submission');\n    } catch (pgAdmError) {\n      Logger.log('V2 PG-ADM-01 generation failed non-blocking: ' +\n        String(pgAdmError && pgAdmError.message || pgAdmError));\n    }\n\n    let emailStatus = 'DISABLED';\n"""
    if old not in s:
        raise SystemExit('Admission workflow anchor not found.')
    s = s.replace(old, new, 1)

    old = """      agentNotificationStatus:agentNotificationStatus\n    }, 'Applicant', 'SUCCESS', 'Admission PDF only. No COL or Offer Letter generated.');\n"""
    new = """      agentNotificationStatus:agentNotificationStatus,\n      pgAdm01Generated:!!(pgAdm01 && pgAdm01.url)\n    }, 'Applicant', 'SUCCESS', 'Admission PDF + PG-ADM-01 generated. No COL or Offer Letter generated.');\n"""
    if old not in s:
        raise SystemExit('Admission audit anchor not found.')
    s = s.replace(old, new, 1)

    old = """      admissionFormPdfUrl:pdf.url,\n      emailStatus:emailStatus,\n"""
    new = """      admissionFormPdfUrl:pdf.url,\n      pgAdm01PdfUrl:pgAdm01 && pgAdm01.url ? pgAdm01.url : '',\n      emailStatus:emailStatus,\n"""
    if old not in s:
        raise SystemExit('Admission return anchor not found.')
    s = s.replace(old, new, 1)
    p.write_text(s, encoding='utf-8')

# SAC Pack: always use the same approved PG-ADM-01 generator.
p = Path('apps-script-v2/SacPackV2.js')
s = p.read_text(encoding='utf-8')
old_call = 'v2GeneratePgEligibilityForm_('
new_call = 'v2GeneratePgEligibilityPdf_('
count = s.count(old_call)
if count < 2:
    raise SystemExit(f'Expected at least 2 SAC PG-ADM-01 call sites, found {count}.')
s = s.replace(old_call, new_call)

# Keep the documented first-document rule explicit beside the manifest construction.
first_marker = '// V2_SAC_PACK_FORM_FIRST_V1'
if first_marker not in s:
    old = """  const documents = [];\n  const formId = v2SacPackExtractDriveId_(candidate.record['Form 01 URL'] || '');\n"""
    new = """  const documents = [];\n  // V2_SAC_PACK_FORM_FIRST_V1\n  // PG-ADM-01 is always pushed before Admission Form and uploaded documents.\n  const formId = v2SacPackExtractDriveId_(candidate.record['Form 01 URL'] || '');\n"""
    if old not in s:
        raise SystemExit('SAC manifest first-document anchor not found.')
    s = s.replace(old, new, 1)

p.write_text(s, encoding='utf-8')

print('PG-ADM-01 submission + SAC pack patch applied.')
