from pathlib import Path

path = Path('index.html')
text = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'{label} insertion point not found')
    text = text.replace(old, new, 1)

replace_once(
    "      emgsPaymentReceipt: 'EMGS Receipt'\n    };",
    "      emgsPaymentReceipt: 'EMGS Receipt',\n      preliminaryResearchIntent: 'Preliminary Research Intent'\n    };",
    'document label'
)
replace_once(
    '      "englishCertificate", "cvResume", "passportCopyInternational", "completedAdmissionForm", "completedHealthDeclaration", "emgsPaymentReceipt"\n    ];',
    '      "englishCertificate", "cvResume", "passportCopyInternational", "completedAdmissionForm", "completedHealthDeclaration", "emgsPaymentReceipt", "preliminaryResearchIntent"\n    ];',
    'file key'
)
replace_once(
    "    function isPartnerFlow() {\n      return formState.referralSource === \"Education Consultant\";\n    }\n\n    function visibleDocumentFields()",
    "    function isPartnerFlow() {\n      return formState.referralSource === \"Education Consultant\";\n    }\n\n    function isPhdProgramme() {\n      const programme = String(formState.programme || '').trim();\n      return /^PhD\\b/i.test(programme) || /Doctor of Philosophy/i.test(programme);\n    }\n\n    function visibleDocumentFields()",
    'phd helper'
)
replace_once(
    "        showEmgsPaymentReceipt: isInternational(),\n      };",
    "        showEmgsPaymentReceipt: isInternational(),\n        showPreliminaryResearchIntent: isPhdProgramme(),\n      };",
    'research intent visibility'
)
replace_once(
    '          <div class="field"><label>Intended Programme of Study <span class="required">*</span></label><select data-field="programme" ${programmeDisabled ? "disabled" : ""}>${selectOptions(getProgrammeOptions(), programmeDisabled ? "Please select level of study first" : "Select programme", formState.programme)}</select></div>\n          <div class="field"><label>Intake',
    '          <div class="field"><label>Intended Programme of Study <span class="required">*</span></label><select data-field="programme" ${programmeDisabled ? "disabled" : ""}>${selectOptions(getProgrammeOptions(), programmeDisabled ? "Please select level of study first" : "Select programme", formState.programme)}</select></div>\n          ${isPhdProgramme() ? `\n            <div class="info-box" style="grid-column:1 / -1;background:#fff7df;border-color:#f0d995;color:#785816">\n              <strong>PhD Preliminary Research Intent</strong><br>\n              A preliminary Research Intent (approximately 2–3 pages) is required before your admission file can proceed to SAC. If you already have it, you may upload it in the Document Upload section. <strong>If you do not have it yet, you may still submit this application now.</strong> We will email you a secure link to upload it later.\n            </div>\n          ` : ""}\n          <div class="field"><label>Intake',
    'early phd notice'
)
replace_once(
    "          ${visible.showEmgsPaymentReceipt ? fileRow('emgsPaymentReceipt', 'EMGS / Visa Related Payment Receipt', true, 'Upload the payment receipt for international fee processing.') : ''}\n        </div>",
    "          ${visible.showEmgsPaymentReceipt ? fileRow('emgsPaymentReceipt', 'EMGS / Visa Related Payment Receipt', true, 'Upload the payment receipt for international fee processing.') : ''}\n          ${visible.showPreliminaryResearchIntent ? `\n            <div class=\"info-box\" style=\"background:#fff7df;border-color:#f0d995;color:#785816\"><strong>PhD document</strong><br>You may upload your preliminary Research Intent now, or submit the application first and provide it later through the secure upload link sent to your email. It remains required before your document review can be completed for SAC.</div>\n            ${fileRow('preliminaryResearchIntent', 'Preliminary Research Intent (2–3 pages)', false, 'Optional at initial submission. Required before SAC. Upload PDF, JPG, JPEG or PNG now; if pending, a secure follow-up upload link will be emailed after submission.')}\n          ` : ''}\n        </div>",
    'research intent upload row'
)
replace_once(
    "      <div class=\"review-box\" style=\"background:#f8fafc\">\n        <strong>Review Your Application</strong>\n        <div class=\"small\" style=\"margin-top:6px\">Please review the summary before submitting.</div>\n      </div>",
    "      <div class=\"review-box\" style=\"background:#f8fafc\">\n        <strong>Review Your Application</strong>\n        <div class=\"small\" style=\"margin-top:6px\">Please review the summary before submitting.</div>\n      </div>\n      ${isPhdProgramme() && !formState.documents.preliminaryResearchIntent ? `\n        <div class=\"info-box\" style=\"background:#fff7df;border-color:#f0d995;color:#785816\">\n          <strong>Research Intent will remain outstanding.</strong><br>Your application can still be submitted. A secure upload link will be sent to your email, and the document must be received before your application can proceed to SAC.\n        </div>\n      ` : ''}",
    'review research intent reminder'
)

path.write_text(text, encoding='utf-8')
print('PhD Research Intent frontend UX patch applied.')
