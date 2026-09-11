from pathlib import Path

# Patch Code.js: allow authenticated V2 admin POST actions while keeping legacy/V1 locked.
code_path = Path('apps-script-v2/Code.js')
code = code_path.read_text(encoding='utf-8')
old = '''function doPost(e) {
  try {
    // Public V2 parser — does not use the locked legacy parsePayload_().
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('No POST payload received.');
    }

    const payload = JSON.parse(e.postData.contents);

    // Allow ONLY public Admission V2 submission.
    if (payload && payload.action === 'v2SubmitAdmission') {
      const result = handleV2Post_(payload);

      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // All other legacy / unsupported POST operations remain locked.
    assertDevOperationsLocked_();

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        success: false,
        message: error && error.message
          ? error.message
          : String(error)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
'''
new = '''function doPost(e) {
  try {
    // Public V2 parser — does not use the locked legacy parsePayload_().
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('No POST payload received.');
    }

    const payload = JSON.parse(e.postData.contents);
    const action = String(payload && payload.action ? payload.action : '');

    // Public Admission V2 submission remains available without admin token.
    if (action === 'v2SubmitAdmission') {
      const result = handleV2Post_(payload);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Protected V2 admin actions. handleV2Post_ verifies the V2 admin password
    // before dispatching any non-public action.
    if (action.indexOf('v2') === 0 && payload.token) {
      const result = handleV2Post_(payload);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // V1 / legacy / unauthenticated operations remain locked.
    assertDevOperationsLocked_();

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        success: false,
        message: error && error.message
          ? error.message
          : String(error)
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
'''
if old not in code:
    raise SystemExit('Code.js doPost marker not found; refusing unsafe patch')
code = code.replace(old, new, 1)
code_path.write_text(code, encoding='utf-8')

# Patch WorkflowV2.js: expose existing Document Review and Qualification Screening modules
# through the authenticated V2 dispatcher.
wf_path = Path('apps-script-v2/WorkflowV2.js')
wf = wf_path.read_text(encoding='utf-8')
old_dispatch = '''  if (action === 'v2ListWorkflow') return v2ListWorkflow_(payload);
  if (action === 'v2SyncApplication') return v2SyncApplication_(payload.data || {});
  if (action === 'v2UpdateStage') return v2UpdateStage_(payload.data || {}, payload.updatedBy);
  if (action === 'v2CreateSacSession') return v2CreateSacSession_(payload.data || {}, payload.updatedBy);
'''
new_dispatch = '''  if (action === 'v2ListWorkflow') return v2ListWorkflow_(payload);
  if (action === 'v2SyncApplication') return v2SyncApplication_(payload.data || {});
  if (action === 'v2UpdateStage') return v2UpdateStage_(payload.data || {}, payload.updatedBy);
  if (action === 'v2RunDocumentReview') {
    const data = payload.data || {};
    return v2RunDocumentReview(
      data.referenceNo,
      payload.updatedBy || data.reviewer || 'Admin Portal V2',
      data.remarks || ''
    );
  }
  if (action === 'v2RunQualificationScreening') {
    const data = payload.data || {};
    return v2RunQualificationScreening(data.referenceNo, {
      fieldClassification: data.fieldClassification,
      relevantWorkExperience: data.relevantWorkExperience,
      screenedBy: payload.updatedBy || data.screenedBy || 'Admin Portal V2',
      remarks: data.remarks || ''
    });
  }
  if (action === 'v2CreateSacSession') return v2CreateSacSession_(payload.data || {}, payload.updatedBy);
'''
if old_dispatch not in wf:
    raise SystemExit('WorkflowV2.js dispatcher marker not found; refusing unsafe patch')
wf = wf.replace(old_dispatch, new_dispatch, 1)
wf_path.write_text(wf, encoding='utf-8')

print('Protected Admin V2 Apps Script routes patched successfully.')
