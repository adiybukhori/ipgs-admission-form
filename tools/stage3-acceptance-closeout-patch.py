#!/usr/bin/env python3
from pathlib import Path
import sys

mode = (sys.argv[1] if len(sys.argv) > 1 else "").strip().lower()

def replace_once(path, old, new, label):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"{label}: target not found in {path}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")

if mode == "main":
    replace_once("api/admin-action.js", "  'v2IssueOffer',\n", "  'v2IssueOffer',\n  'v2ResendAcceptanceConfirmation',\n", "admin action allowlist")

    replace_once("admin.html",
        "handbookUrl=w['Student Handbook URL']||'',packStatus=w['Acceptance Pack Status']||'';/* ACCEPTANCE_PACK_ADMIN_V1 */",
        "handbookUrl=w['Student Handbook URL']||'',handbookAckUrl=w['Student Handbook Acknowledgement Signed PDF URL']||'',packStatus=w['Acceptance Pack Status']||'',acceptanceEmailStatus=w['Acceptance Confirmation Email Status']||'',acceptanceEmailAt=w['Acceptance Confirmation Email Sent At']||'';/* ACCEPTANCE_PACK_ADMIN_V2 */",
        "admin acceptance variables")

    replace_once("admin.html",
        "${suratAkuanPdf?`<a class=\"ops-btn\" target=\"_blank\" href=\"${esc(suratAkuanPdf)}\">Surat Akuan Signed</a>`:''}${handbookUrl?`<a class=\"ops-btn\" target=\"_blank\" href=\"${esc(handbookUrl)}\">Student Handbook</a>`:''}<a class=\"ops-btn\" target=\"_blank\" href=\"/acceptance-demo.html\">Preview Acceptance Page</a>",
        "${suratAkuanPdf?`<a class=\"ops-btn\" target=\"_blank\" href=\"${esc(suratAkuanPdf)}\">Surat Akuan Signed</a>`:''}${handbookAckUrl?`<a class=\"ops-btn\" target=\"_blank\" href=\"${esc(handbookAckUrl)}\">Handbook Acknowledgement Signed</a>`:''}${handbookUrl?`<a class=\"ops-btn\" target=\"_blank\" href=\"${esc(handbookUrl)}\">Student Handbook</a>`:''}${accepted?'<button class=\"ops-btn\" onclick=\"resendAcceptanceConfirmation()\">Resend Acceptance Email</button>':''}<a class=\"ops-btn\" target=\"_blank\" href=\"/acceptance-demo.html\">Preview Acceptance Page</a>",
        "admin acceptance links")

    replace_once("admin.html",
        "Acceptance pack status: ${esc(pretty(packStatus||acceptanceStatus))}. One student signature is applied to the approved signable documents, and the signed PDFs are saved in the student folder. The preview link is visual only.",
        "Acceptance pack status: ${esc(pretty(packStatus||acceptanceStatus))}. Confirmation email: ${esc(pretty(acceptanceEmailStatus||'NOT_SENT'))}${acceptanceEmailAt?` · ${esc(formatDate(acceptanceEmailAt))}`:''}. One student signature is applied to the approved signable documents, and all 4 signed PDFs are saved in the student folder. The preview link is visual only.",
        "admin acceptance note")

    replace_once("admin.html",
        "    function renderLegacyDetailTabs",
        """    function resendAcceptanceConfirmation(){
      if(!selected||selected.source==='V1')return;
      const status=String(selected.workflow?.['Acceptance Status']||'').toUpperCase();
      if(status!=='ACCEPTED'){setOpsMessage('Acceptance must be completed before sending the confirmation email.','error');return}
      runAdminAction('v2ResendAcceptanceConfirmation',{referenceNo:selected.ref},`Resend acceptance confirmation and 4 signed documents to ${selected.app['Personal Email']||'the student'}?`)
    }
    function renderLegacyDetailTabs""",
        "admin resend acceptance function")

elif mode == "apps":
    replace_once("apps-script-v2/WorkflowV2.js",
        "  if (action === 'v2IssueOffer') return v2IssueOffer_((payload.data || {}).referenceNo, payload.updatedBy || 'Admin Portal V2', payload.data || {});\n",
        "  if (action === 'v2IssueOffer') return v2IssueOffer_((payload.data || {}).referenceNo, payload.updatedBy || 'Admin Portal V2', payload.data || {});\n  if (action === 'v2ResendAcceptanceConfirmation') return v2ResendAcceptanceConfirmation_(payload.data || {}, payload.updatedBy || 'Admin Portal V2');\n",
        "workflow resend route")

    replace_once("apps-script-v2/AcceptancePackV2.js",
        """      createdFiles.push(handbookAckFile);
      updates['Student Handbook Acknowledgement Signed PDF URL'] = handbookAckFile.getUrl();
""",
        """      createdFiles.push(handbookAckFile);
      updates['Student Handbook Acknowledgement Signed PDF URL'] = handbookAckFile.getUrl();

      // Stage 3 closeout gate: do not mark the offer accepted unless all four
      // required signed outputs exist in Drive.
      const signedUrls = [
        updates['Acceptance PDF URL'],
        updates['Surat Penerimaan Signed PDF URL'],
        updates['Surat Akuan Signed PDF URL'],
        updates['Student Handbook Acknowledgement Signed PDF URL']
      ];
      if (signedUrls.length !== 4 || !signedUrls.every(v2AcceptancePackUrlExists_)) {
        throw new Error('Acceptance pack is incomplete. All 4 signed documents must be generated before final acceptance.');
      }
""",
        "acceptance four-document gate")

    replace_once("apps-script-v2/NotificationEngineV2.js",
        """  const urls = signedDocumentUrls || [];
  const attachments = urls.map(v2NotificationBlobFromUrl_).filter(Boolean);

  const subject = '[IUC IPGS] Acceptance Successfully Received - ' + programme;
""",
        """  const urls = (signedDocumentUrls || []).filter(Boolean);
  if (urls.length !== 4) {
    throw new Error('Acceptance confirmation requires all 4 signed admission documents.');
  }
  const attachments = urls.map(v2NotificationBlobFromUrl_).filter(Boolean);
  if (attachments.length !== 4) {
    throw new Error('One or more signed acceptance documents could not be attached.');
  }

  const subject = '[IUC IPGS] Acceptance Successfully Received - ' + programme;
""",
        "acceptance email four attachment gate")

    replace_once("apps-script-v2/NotificationEngineV2.js",
        "function v2NotificationStatus_() {\n",
        """function v2ResendAcceptanceConfirmation_(data, actor) {
  v2NotificationEnsureHeaders_();
  const reference = String(data && data.referenceNo || '').trim();
  if (!reference) throw new Error('Reference No is required.');
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!workflow) throw new Error('Workflow record not found.');
  if (String(workflow.record['Acceptance Status'] || '').toUpperCase() !== 'ACCEPTED') {
    throw new Error('Acceptance confirmation can only be sent after the offer has been accepted.');
  }
  const signedUrls = [
    String(workflow.record['Acceptance PDF URL'] || '').trim(),
    String(workflow.record['Surat Penerimaan Signed PDF URL'] || '').trim(),
    String(workflow.record['Surat Akuan Signed PDF URL'] || '').trim(),
    String(workflow.record['Student Handbook Acknowledgement Signed PDF URL'] || '').trim()
  ];
  if (signedUrls.some(function(url){ return !url; })) {
    throw new Error('Acceptance confirmation blocked: one or more signed documents are missing.');
  }
  const result = v2SendAcceptanceConfirmationCentral_(reference, signedUrls);
  if (typeof v2Audit_ === 'function') {
    v2Audit_(reference,'ACCEPTANCE','RESEND_ACCEPTANCE_CONFIRMATION',{},
      {status:result.status,recipients:result.recipients,signedDocuments:4},
      actor || 'Admin Portal V2',result.sent ? 'SUCCESS' : 'SKIPPED',
      'Acceptance confirmation manually resent from Admin.');
  }
  return Object.assign({ok:true,referenceNo:reference,signedDocumentCount:4,v1Touched:false},result);
}

function v2NotificationStatus_() {
""",
        "acceptance resend function")

    replace_once("apps-script-v2/acceptance-v2.html",
        "<p>Your signed Acceptance & Student Handbook Confirmation, Surat Penerimaan Tawaran, Surat Akuan and Student Handbook Acknowledgement have been generated and saved in your admission folder.</p>",
        "<p>Your signed Acceptance & Student Handbook Confirmation, Surat Penerimaan Tawaran, Surat Akuan and Student Handbook Acknowledgement have been generated and saved securely.</p><p><strong>Please check your email</strong> for your acceptance confirmation and copies of the 4 signed documents. The Registry Office will contact you regarding the next step.</p>",
        "acceptance success message")
else:
    raise SystemExit("Use: stage3-acceptance-closeout-patch.py main|apps")