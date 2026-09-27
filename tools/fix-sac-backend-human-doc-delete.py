from pathlib import Path

p=Path('apps-script-v2/WorkflowV2.js')
s=p.read_text()
old="""    const qualityStatus = String(dr['AI Quality Status'] || 'NOT_REVIEWED').toUpperCase();
    const replacementStatus = String(dr['Replacement Request Status'] || '').toUpperCase();
    let missing = [];
"""
new="""    const qualityStatus = String(dr['AI Quality Status'] || 'NOT_REVIEWED').toUpperCase();
    const humanQualityDecision = String(dr['Human Quality Decision'] || '').toUpperCase();
    const workflowQualityStatus = String(w['Document Quality Status'] || '').toUpperCase();
    const humanQualityApproved = humanQualityDecision === 'APPROVED_TO_PROCEED' || workflowQualityStatus === 'HUMAN_OVERRIDE_APPROVED';
    const replacementStatus = String(dr['Replacement Request Status'] || '').toUpperCase();
    let missing = [];
"""
if old in s:
    s=s.replace(old,new)
elif 'humanQualityApproved' not in s:
    raise SystemExit('quality variables anchor not found')

old="""    if (qualityStatus && qualityStatus !== 'PASS' && qualityStatus !== 'NOT_REVIEWED') {
      sacGateIssues.push('DOCUMENT_QUALITY_' + qualityStatus);
    }
    if (replacementStatus === 'AWAITING_STUDENT') {
      sacGateIssues.push('AWAITING_STUDENT_DOCUMENT');
    }
"""
new="""    if (!humanQualityApproved && qualityStatus && qualityStatus !== 'PASS' && qualityStatus !== 'NOT_REVIEWED') {
      sacGateIssues.push('DOCUMENT_QUALITY_' + qualityStatus);
    }
    if (!humanQualityApproved && replacementStatus === 'AWAITING_STUDENT') {
      sacGateIssues.push('AWAITING_STUDENT_DOCUMENT');
    }
"""
if old in s:
    s=s.replace(old,new)
elif '!humanQualityApproved && qualityStatus' not in s:
    raise SystemExit('quality gate anchor not found')

old="  if (action === 'v2UpdateSacSessionManual') return v2UpdateSacSessionManual_(payload.data || {}, payload.updatedBy);\n"
if old in s and 'v2DeleteSacSessionManual' not in s:
    s=s.replace(old,old+"  if (action === 'v2DeleteSacSessionManual') return v2DeleteSacSessionManual_(payload.data || {}, payload.updatedBy || 'Admin Portal V2');\n")
elif 'v2DeleteSacSessionManual' not in s:
    raise SystemExit('dispatcher anchor not found')
p.write_text(s)

p=Path('apps-script-v2/SacManualPhase1V2.js')
s=p.read_text()
anchor="function v2SendSacCalendarInvitationManual_(data, actor) {\n"
if 'function v2DeleteSacSessionManual_' not in s:
    fn="""function v2DeleteSacSessionManual_(data, actor) {
  assertDevIdentity_();
  v2SacManualEnsureSchema_();

  const sessionId = v2Required_(data.sessionId, 'SAC Session ID');
  const session = v2Find_('V2_SAC_SESSIONS', 'SAC Session ID', sessionId);
  if (!session) throw new Error('SAC session not found.');

  const status = String(session.record['Status'] || '').toUpperCase();
  if (status === 'FINALISED' || status === 'FINALIZED' || session.record['Finalised At']) {
    throw new Error('Finalised SAC session cannot be deleted.');
  }

  const candidates = v2Rows_('V2_SAC_CANDIDATES').filter(function(row){
    return String(row['SAC Session ID'] || row['Session ID'] || '') === sessionId;
  });
  if (candidates.length) {
    throw new Error('Remove all SAC candidates before deleting this session.');
  }

  const calendarStatus = String(session.record['Calendar Status'] || '').toUpperCase();
  const eventId = String(session.record['Calendar Event ID'] || '').trim();
  if (eventId || calendarStatus === 'INVITED') {
    throw new Error('This SAC session already has a calendar invitation/event and cannot be deleted automatically.');
  }

  const previous = session.record;
  v2Audit_('', 'SAC', 'DELETE_MANUAL_SESSION', previous, {sessionId:sessionId, deleted:true}, actor || 'Admin Portal V2', 'SUCCESS', 'Empty non-finalised SAC session deleted.');
  session.sheet.deleteRow(session.rowNumber);
  v2InvalidateCache_();
  return {ok:true, deleted:true, sessionId:sessionId, v1Touched:false};
}

"""
    if anchor not in s:
        raise SystemExit('delete function anchor not found')
    s=s.replace(anchor,fn+anchor)
p.write_text(s)
print('SAC backend patch applied')
