from pathlib import Path

manual = Path('apps-script-v2/SacManualPhase1V2.js')
text = manual.read_text(encoding='utf-8')

if 'function v2UpdateSacSessionManual_' not in text:
    anchor = 'function v2SendSacCalendarInvitationManual_(data, actor) {'
    if anchor not in text:
        raise SystemExit('SAC invitation function anchor not found')

    fn = r'''function v2UpdateSacSessionManual_(data, actor) {
  assertDevIdentity_();
  v2SacManualEnsureSchema_();

  const sessionId = v2Required_(data.sessionId, 'SAC Session ID');
  const session = v2Find_('V2_SAC_SESSIONS', 'SAC Session ID', sessionId);
  if (!session) throw new Error('SAC session not found.');

  const status = String(session.record['Status'] || '').toUpperCase();
  if (status === 'FINALISED' || session.record['Finalised At']) {
    throw new Error('Finalised SAC session cannot be edited.');
  }

  const calendarStatus = String(session.record['Calendar Status'] || '').toUpperCase();
  const eventId = String(session.record['Calendar Event ID'] || '').trim();
  const changingInviteFields =
    Object.prototype.hasOwnProperty.call(data, 'meetingDate') ||
    Object.prototype.hasOwnProperty.call(data, 'meetingTime') ||
    Object.prototype.hasOwnProperty.call(data, 'venueLink') ||
    Object.prototype.hasOwnProperty.call(data, 'venue') ||
    Object.prototype.hasOwnProperty.call(data, 'committeeEmails');

  if (eventId && calendarStatus === 'INVITED' && changingInviteFields) {
    throw new Error('This SAC invitation has already been sent. Rescheduling an invited SAC is not enabled yet.');
  }

  const updates = {};
  if (Object.prototype.hasOwnProperty.call(data, 'name')) {
    updates['SAC Name'] = v2Required_(data.name, 'SAC Name');
  }
  if (Object.prototype.hasOwnProperty.call(data, 'meetingDate')) {
    updates['Meeting Date'] = v2Required_(data.meetingDate, 'Meeting Date');
  }
  if (Object.prototype.hasOwnProperty.call(data, 'meetingTime')) {
    updates['Meeting Time'] = String(data.meetingTime || '10:00').trim();
  }
  if (Object.prototype.hasOwnProperty.call(data, 'chairperson')) {
    updates['Chairperson'] = String(data.chairperson || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(data, 'venueLink') || Object.prototype.hasOwnProperty.call(data, 'venue')) {
    updates['Venue / Meeting Link'] = String(data.venueLink || data.venue || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(data, 'committeeEmails')) {
    updates['Committee Emails'] = v2SacManualNormaliseEmails_(data.committeeEmails || []).join(', ');
  }

  updates['Last Updated'] = new Date().toISOString();
  v2UpdateRow_(session.sheet, session.rowNumber, updates);
  v2Audit_('', 'SAC', 'UPDATE_MANUAL_SESSION', session.record, updates, actor || 'Admin Portal V2', 'SUCCESS', 'SAC session details/panel updated.');
  v2InvalidateCache_();

  const refreshed = v2Find_('V2_SAC_SESSIONS', 'SAC Session ID', sessionId);
  return {
    ok: true,
    session: refreshed ? refreshed.record : Object.assign({}, session.record, updates),
    v1Touched: false
  };
}

'''
    text = text.replace(anchor, fn + anchor, 1)
    manual.write_text(text, encoding='utf-8')

workflow = Path('apps-script-v2/WorkflowV2.js')
text = workflow.read_text(encoding='utf-8')
if "action === 'v2UpdateSacSessionManual'" not in text:
    anchor = "  if (action === 'v2CreateSacSessionManual') return v2CreateSacSessionManual_(payload.data || {}, payload.updatedBy);\n"
    if anchor not in text:
        raise SystemExit('Workflow SAC manual dispatcher anchor not found')
    text = text.replace(
        anchor,
        anchor + "  if (action === 'v2UpdateSacSessionManual') return v2UpdateSacSessionManual_(payload.data || {}, payload.updatedBy);\n",
        1,
    )
    workflow.write_text(text, encoding='utf-8')

print('SAC session backend patch ready')
