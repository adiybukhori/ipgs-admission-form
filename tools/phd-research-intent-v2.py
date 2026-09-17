from pathlib import Path

ROOT = Path('apps-script-v2')


def replace_once(path, old, new, label):
    text = path.read_text(encoding='utf-8')
    if new in text:
        return False
    if old not in text:
        raise SystemExit(f'{label} insertion point not found in {path}')
    path.write_text(text.replace(old, new, 1), encoding='utf-8')
    return True

# AdmissionV2: prepare deferred Research Intent before acknowledgement emails.
admission = ROOT / 'AdmissionV2.js'
replace_once(
    admission,
    "    v2StartWorkflowForApplication_(row);\n\n    // V2_PG_ADM01_ON_SUBMISSION_V1",
    "    v2StartWorkflowForApplication_(row);\n\n    // PhD Research Intent is required for admission processing, but it must not\n    // block the applicant from submitting the initial Admission Form. If it is\n    // missing, create a secure follow-up upload link before acknowledgement mail.\n    const researchIntentRequirement = v2PrepareResearchIntentRequirement_(payload, reference);\n\n    // V2_PG_ADM01_ON_SUBMISSION_V1",
    'research intent preparation'
)

# Remove the old hard-block validator if still present.
text = admission.read_text(encoding='utf-8')
old_validator = """  if (v2IsPhdProgramme_(payload.programme)) {\n    const intent = payload.documents && payload.documents.preliminaryResearchIntent;\n    if (!intent || !intent.base64) throw new Error('Preliminary Research Intent is required for PhD applicants.');\n  }\n"""
if old_validator in text:
    text = text.replace(old_validator, """  // Preliminary Research Intent is intentionally NOT a hard blocker here.\n  // PhD applicants may submit first and provide it through the secure follow-up link.\n""", 1)
    admission.write_text(text, encoding='utf-8')

# Add research intent state to audit and API response.
replace_once(
    admission,
    "      pgAdm01Generated:!!(pgAdm01 && pgAdm01.url)\n    }, 'Applicant'",
    "      pgAdm01Generated:!!(pgAdm01 && pgAdm01.url),\n      researchIntentStatus:researchIntentRequirement.status,\n      researchIntentOutstanding:researchIntentRequirement.status === 'PENDING'\n    }, 'Applicant'",
    'audit research intent status'
)
replace_once(
    admission,
    "      pgAdm01PdfUrl:pgAdm01 && pgAdm01.url ? pgAdm01.url : '',\n      emailStatus:emailStatus,",
    "      pgAdm01PdfUrl:pgAdm01 && pgAdm01.url ? pgAdm01.url : '',\n      researchIntentStatus:researchIntentRequirement.status,\n      researchIntentOutstanding:researchIntentRequirement.status === 'PENDING',\n      emailStatus:emailStatus,",
    'response research intent status'
)

# NotificationEngine: include a clear PhD outstanding-document notice and upload CTA.
notification = ROOT / 'NotificationEngineV2.js'
replace_once(
    notification,
    "  const attachment = pdf && pdf.blob ? [pdf.blob] : [];\n\n  const studentSubject",
    "  const attachment = pdf && pdf.blob ? [pdf.blob] : [];\n  const applicationRow = v2Find_('V2_APPLICATIONS','Reference No',reference);\n  const researchIntentStatus = applicationRow ? String(applicationRow.record['Research Intent Status'] || '') : '';\n  const researchIntentUrl = applicationRow ? String(applicationRow.record['Research Intent Upload URL'] || '') : '';\n  const researchIntentPending = researchIntentStatus === 'PENDING' && !!researchIntentUrl;\n  const researchIntentStudentBlock = researchIntentPending\n    ? '<div style=\"margin:18px 0;padding:15px 16px;background:#fff7df;border:1px solid #f0d995;border-radius:12px;color:#785816\"><strong>Outstanding document: Preliminary Research Intent</strong><br><span style=\"font-size:13px;line-height:1.6\">Your application has been received. Please provide your 2–3 page preliminary Research Intent before your file can proceed for SAC consideration.</span><div style=\"margin-top:12px\"><a href=\"'+v2Html_(researchIntentUrl)+'\" style=\"display:inline-block;background:#2d2363;color:#fff;text-decoration:none;padding:10px 15px;border-radius:9px;font-weight:700\">Upload Research Intent</a></div></div>'\n    : '';\n  const researchIntentAdminLine = researchIntentStatus\n    ? '<br><strong>Research Intent:</strong> '+v2Html_(researchIntentStatus)\n    : '';\n\n  const studentSubject",
    'notification research intent context'
)
replace_once(
    notification,
    "    '<p>Your Admission Form is attached for your reference. We will contact you when the next admission action is required.</p>' +\n    '<p>Regards,",
    "    '<p>Your Admission Form is attached for your reference. We will contact you when the next admission action is required.</p>' +\n    researchIntentStudentBlock +\n    '<p>Regards,",
    'student research intent email block'
)
replace_once(
    notification,
    "    '<p><strong>Student:</strong> '+v2Html_(student)+'<br><strong>Programme:</strong> '+v2Html_(programme)+'<br><strong>Intake:</strong> '+v2Html_(intakeName)+'<br><strong>Reference:</strong> '+v2Html_(reference)+agentLine+'</p>' +",
    "    '<p><strong>Student:</strong> '+v2Html_(student)+'<br><strong>Programme:</strong> '+v2Html_(programme)+'<br><strong>Intake:</strong> '+v2Html_(intakeName)+'<br><strong>Reference:</strong> '+v2Html_(reference)+agentLine+researchIntentAdminLine+'</p>' +",
    'admin research intent email line'
)

# Code.js: expose the secure Research Intent upload page.
code = ROOT / 'Code.js'
replace_once(
    code,
    "  if (params.page === 'acceptance-v2') {\n    return v2RenderAcceptancePage_(params);\n  } \n",
    "  if (params.page === 'acceptance-v2') {\n    return v2RenderAcceptancePage_(params);\n  }\n\n  if (params.page === 'research-intent-v2') {\n    return v2RenderResearchIntentPage_(params);\n  } \n",
    'research intent doGet route'
)

print('PhD Research Intent backend patch applied.')
