from pathlib import Path
import re

ROOT = Path('apps-script-v2')

# Keep the existing controlled admission smoke test compatible with the
# centralized student + admin notification result.
adm = ROOT / 'AdmissionV2.js'
text = adm.read_text(encoding='utf-8')
old = "if (result.emailStatus !== 'TEST_SENT_1') {\n      throw new Error('Smoke test email routing failed: ' + result.emailStatus);\n    }"
new = "if (String(result.emailStatus || '').indexOf('STUDENT=TEST_SENT_1') < 0 || String(result.emailStatus || '').indexOf('ADMIN=TEST_SENT_1') < 0) {\n      throw new Error('Smoke test email routing failed: ' + result.emailStatus);\n    }"
if old in text:
    text = text.replace(old, new, 1)
adm.write_text(text, encoding='utf-8')

# Remove stale agent email-mode messaging now that the central engine owns it.
agent = ROOT / 'AgentProspectV2.js'
text = agent.read_text(encoding='utf-8')
text = text.replace(' * - Keep registry email DISABLED/TEST until explicitly enabled in a later release.\n', ' * - Route operational email through the central V2 Notification Engine.\n')
text = text.replace("const V2_AGENT_EMAIL_MODE = 'DISABLED/TEST';", "const V2_AGENT_EMAIL_MODE = 'CENTRAL_ENGINE';")
text = text.replace('emailMode: V2_AGENT_EMAIL_MODE,', 'emailMode: v2AgentNotificationMode_(),')
text = text.replace("'Registry Notification Status': V2_AGENT_EMAIL_MODE,", "'Registry Notification Status': v2AgentNotificationMode_(),")
agent.write_text(text, encoding='utf-8')

# Remove stale Offer email safety labels and make preflight reflect the live
# centralized engine rather than the old hard-coded disabled constant.
offer = ROOT / 'OfferLetterV2.js'
text = offer.read_text(encoding='utf-8')
text = text.replace("const V2_OFFER_EMAIL_MODE = 'DISABLED/TEST';", "const V2_OFFER_EMAIL_MODE = 'CENTRAL_ENGINE';")
text = text.replace('offerEmailMode:\n      V2_OFFER_EMAIL_MODE,', 'offerEmailMode:\n      v2NotificationMode_(),')
old_block = """  const emailDisabled =\n    String(\n      V2_OFFER_EMAIL_MODE || ''\n    ) === 'DISABLED/TEST';"""
new_block = """  const notificationEngineReady =\n    typeof v2NotificationSend_ === 'function' &&\n    v2NotificationMode_() !== 'DISABLED';"""
if old_block in text:
    text = text.replace(old_block, new_block, 1)
text = text.replace('emailStillDisabled:\n      emailDisabled', 'notificationEngineReady:\n      notificationEngineReady')
text = text.replace('checks.emailStillDisabled', 'checks.notificationEngineReady')
offer.write_text(text, encoding='utf-8')

# Expose non-sensitive notification runtime state in the existing health check
# so deployment can be verified without sending an email or exposing recipients.
workflow = ROOT / 'WorkflowV2.js'
text = workflow.read_text(encoding='utf-8')
old = "if (action === 'v2Health') return v2ApiOutput_({ok:true, build:V2_BUILD, workflowReady:v2FoundationReady_()}, params.callback);"
new = "if (action === 'v2Health') return v2ApiOutput_({ok:true, build:V2_BUILD, workflowReady:v2FoundationReady_(), notificationBuild:(typeof V2_NOTIFICATION_BUILD !== 'undefined' ? V2_NOTIFICATION_BUILD : ''), notificationMode:(typeof v2NotificationMode_ === 'function' ? v2NotificationMode_() : 'UNAVAILABLE')}, params.callback);"
if old not in text:
    raise SystemExit('WorkflowV2 v2Health anchor not found')
text = text.replace(old, new, 1)
workflow.write_text(text, encoding='utf-8')

print('Stage 1 notification cleanup completed.')
