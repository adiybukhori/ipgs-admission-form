from pathlib import Path
import re

root = Path('apps-script-v2')
def edit(name, fn):
    p = root / name
    text = p.read_text()
    if name == 'OfferLetterV2.js':
        text = text.replace("    'Study Mode\\s*:\\s*Full[ -]?Time',\n    'Mode of Study     : ' + studyMode", "    'Full[ -]?Time',\n    studyMode")
    if 'LOA_REPAIR_20261013' in text:
        if name == 'WorkflowV2.js':
            text = text.replace("if (action === 'v2LoaControlledTest') return v2LoaControlledTest(payload.data || {});", "if (action === 'v2LoaControlledTest') { try { return v2LoaControlledTest(payload.data || {}); } catch (e) { return {ok:false,message:String(e.message||e),stack:String(e.stack||'')}; } }")
            text = text.replace("return {ok:true,build:V2_LOA_REPAIR_BUILD,officialTemplateId:CONFIG.officialLoaTemplateId,syntheticTestOnly:true};", "return v2LoaTestRunStatus_();")
            p.write_text(text)
        return
    p.write_text(fn(text) + '\n// LOA_REPAIR_20261013\n')

def offer(text):
    text = re.sub(r"application\.record\[\s*'Programme'\s*\]", "v2CurrentOfferProgramme_(application.record['Programme'])", text)
    text = text.replace("row['Programme'] || ''", "v2CurrentOfferProgramme_(row['Programme']) || ''")
    text = text.replace("  'Offer Letter PDF URL',", "  'Offer Programme',\n  'Offer Letter PDF URL',", 1)
    # Preserve the issuer's original eligibility gate and official template.
    text = text.replace("  doc.saveAndClose();\n\n\n  // --------------------------------------------------\n  // 7. Create PDF", "  v2AssertCurrentAwardDocument_(body, application.record['Programme']);\n  doc.saveAndClose();\n\n\n  // --------------------------------------------------\n  // 7. Create PDF", 1)
    a = text.index('function v2GenerateOfferLetter_(')
    b = text.index('\nfunction v2OfferProgrammeCode_', a)
    generator = text[a:b].replace("      'Offer Letter Status':\n        'ISSUED',\n\n      'Offer Letter Issued At':", "      'Offer Programme': programme,\n      'Offer Letter Status':\n        'ISSUED',\n\n      'Offer Letter Issued At':", 1)
    text = text[:a] + generator + text[b:]
    a = text.index('function v2IssueOffer_(')
    b = text.index('\nfunction v2SendOfferEmail_', a)
    wrapper = Path('tools/loa-issuer-wrapper.js').read_text()
    text = text[:a] + wrapper + text[b:]
    return text

def col(text):
    text = text.replace("const programme = String(payload.programme || '').trim();", "const programme = v2CurrentOfferProgramme_(payload.programme);")
    text = text.replace("v2ColStudyDuration_(payload.levelOfStudy, programme)", "v2ColStudyDuration_(v2IsMbaPhdPackage_(payload.programme) ? 'Master' : payload.levelOfStudy, programme)")
    text = text.replace('  doc.saveAndClose();', "  v2AssertCurrentAwardDocument_(body, payload.programme);\n  doc.saveAndClose();", 1)
    return text

def notify(text):
    text = text.replace("const programmeRaw = String(payload.programme || '').trim();", "const programmeRaw = v2CurrentOfferProgramme_(payload.programme);")
    text = text.replace("const programme = String(application.record['Programme'] || '');", "const programme = v2CurrentOfferProgramme_(application.record['Programme']);")
    text = text.replace("if (mode === 'TEST') recipients = v2NotificationUniqueEmails_([v2NotificationTestRecipient_()]);", "if (mode === 'TEST') recipients = v2NotificationUniqueEmails_([opts.testRecipient || v2NotificationTestRecipient_()]);")
    text = text.replace("{attachments:[attachment], modeOverride:(opts.testMode === true ? 'TEST' : opts.modeOverride)}", "{attachments:[attachment], testRecipient:opts.testRecipient, modeOverride:(opts.testMode === true ? 'TEST' : opts.modeOverride)}")
    # TEST results must not mark a real student's offer email as live-sent.
    text = text.replace("'Offer Email Sent At': result.sent ? now : '',", "'Offer Email Sent At': result.sent && result.mode === 'LIVE' ? now : '',")
    return text

def pack(text):
    return text.replace("programme: String(app['Programme'] || '').trim(),", "programme: v2CurrentOfferProgramme_(app['Programme']),")

def workflow(text):
    text = text.replace('v2VerifyAdminApiAccess_(payload.token);', 'v2VerifyAdminApiAccess_(payload.token, action);', 1)
    text = text.replace('function v2VerifyAdminApiAccess_(token) {', "function v2VerifyAdminApiAccess_(token, action) {\n  if (v2VerifyLoaServiceAccess_(token, action)) return true;", 1)
    anchor = "  if (action === 'v2ListWorkflow') return v2ListWorkflow_(payload);"
    text = text.replace(anchor, anchor + "\n  if (action === 'v2LoaControlledTest') { try { return v2LoaControlledTest(payload.data || {}); } catch (e) { return {ok:false,message:String(e.message||e),stack:String(e.stack||'')}; } }\n  if (action === 'v2LoaDiagnostics') return v2LoaTestRunStatus_();", 1)
    return text

edit('OfferLetterV2.js', offer)
edit('ConditionalOfferV2.js', col)
edit('NotificationEngineV2.js', notify)
edit('AcceptancePackV2.js', pack)
edit('WorkflowV2.js', workflow)
print('LOA_REPAIR_PATCH_OK')
