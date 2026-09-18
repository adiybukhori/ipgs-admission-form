/**
 * Admission V2 - Stage 4 Orientation Module
 *
 * Core flow:
 * create session -> assign ACCEPTED students -> send invitation ->
 * automatic reminder -> attendance -> ready for Academic Handover.
 */

const V2_ORIENTATION_BUILD = 'ORIENTATION_V2_STAGE4_20260918';
const V2_ORIENTATION_REMINDER_HANDLER = 'v2OrientationReminderSweep';
const V2_ORIENTATION_SESSION_HEADERS = [
  'Orientation Name','Mode','Venue','Reminder Days','Assigned Count',
  'Invitation Count','Reminder Count','Updated At'
];
const V2_ORIENTATION_TRACKING_HEADERS = [
  'Student Email','Assigned At','Assigned By','Invitation Sent At',
  'Reminder Status','Reminder Sent At','Invitation Delivery Detail'
];

function v2OrientationEnsureHeaders_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sessions = ss.getSheetByName('V2_ORIENTATION_SESSIONS');
  const tracking = ss.getSheetByName('V2_ORIENTATION_TRACKING');
  if (!sessions || !tracking) throw new Error('Orientation foundation sheets are missing.');
  v2EnsureHeaders_(sessions, V2_ORIENTATION_SESSION_HEADERS);
  v2EnsureHeaders_(tracking, V2_ORIENTATION_TRACKING_HEADERS);
  return {sessions:sessions, tracking:tracking};
}

function v2CreateOrientationSession_(data, actor) {
  v2OrientationEnsureHeaders_();
  const name = v2Required_(data.name, 'Orientation Name');
  const intakeId = v2Required_(data.intakeId, 'Intake ID');
  const sessionDate = v2Required_(data.sessionDate, 'Session Date');
  const mode = String(data.mode || 'ONLINE').trim().toUpperCase();
  if (['ONLINE','PHYSICAL','HYBRID'].indexOf(mode) < 0) throw new Error('Orientation mode must be Online, Physical or Hybrid.');

  const reminderDaysRaw = Number(data.reminderDays == null ? 3 : data.reminderDays);
  const reminderDays = Math.max(1, Math.min(14, isFinite(reminderDaysRaw) ? Math.round(reminderDaysRaw) : 3));
  const now = new Date().toISOString();
  const id = String(data.sessionId || (
    'ORI-' + String(sessionDate).replace(/[^0-9]/g,'') + '-' + Utilities.getUuid().slice(0,6).toUpperCase()
  )).trim();

  const existing = v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',id);
  const createdAt = existing ? String(existing.record['Created At'] || now) : now;
  const createdBy = existing ? String(existing.record['Created By'] || actor || 'Admin Portal V2') : (actor || 'Admin Portal V2');

  const row = {
    'Orientation Session ID':id,
    'Orientation Name':name,
    'Intake ID':intakeId,
    'Programme Group':String(data.programmeGroup || 'ALL').trim() || 'ALL',
    'Session Date':sessionDate,
    'Start Time':String(data.startTime || '08:30').trim(),
    'End Time':String(data.endTime || '10:30').trim(),
    'Mode':mode,
    'Venue':String(data.venue || '').trim(),
    'Meeting Link':String(data.meetingLink || '').trim(),
    'Feedback Form URL':String(data.feedbackFormUrl || '').trim(),
    'Recording URL':String(data.recordingUrl || '').trim(),
    'Registrar Community URL':String(data.registrarCommunityUrl || '').trim(),
    'Programme Community URL':String(data.programmeCommunityUrl || '').trim(),
    'Reminder Days':reminderDays,
    'Status':String(data.status || 'SCHEDULED').trim().toUpperCase(),
    'Assigned Count':existing ? Number(existing.record['Assigned Count'] || 0) : 0,
    'Invitation Count':existing ? Number(existing.record['Invitation Count'] || 0) : 0,
    'Reminder Count':existing ? Number(existing.record['Reminder Count'] || 0) : 0,
    'Created At':createdAt,
    'Created By':createdBy,
    'Updated At':now
  };

  const saved = v2Upsert_('V2_ORIENTATION_SESSIONS','Orientation Session ID',id,row);
  const automation = v2OrientationEnsureReminderTrigger_();
  v2Audit_('', 'ORIENTATION', 'CREATE_SESSION', saved.previous || {}, row, actor || 'Admin Portal V2', 'SUCCESS',
    'Orientation reminder automation: ' + automation.status);
  v2InvalidateCache_();
  return {ok:true, created:saved.created, session:row, reminderAutomation:automation, build:V2_ORIENTATION_BUILD};
}

function v2AssignOrientationBatch_(data, actor) {
  v2OrientationEnsureHeaders_();
  const sessionId = v2Required_(data.sessionId,'Orientation Session ID');
  const session = v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
  if (!session) throw new Error('Orientation session not found.');
  if (!/SCHEDULED|OPEN|ACTIVE/i.test(String(session.record['Status'] || 'SCHEDULED'))) {
    throw new Error('Orientation session is not open for student assignment.');
  }

  const references = Array.from(new Set((data.referenceNos || []).map(function(v){ return String(v || '').trim(); }).filter(Boolean)));
  if (!references.length) throw new Error('Select at least one accepted student.');
  if (references.length > 100) throw new Error('Assign a maximum of 100 students at one time.');

  const assigned = [];
  const skipped = [];
  const failed = [];

  references.forEach(function(reference) {
    try {
      const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
      const application = v2Find_('V2_APPLICATIONS','Reference No',reference);
      if (!workflow || !application) throw new Error('Application/workflow record not found.');

      const acceptance = String(workflow.record['Acceptance Status'] || '').toUpperCase();
      const stage = String(workflow.record['Application Stage'] || '').toUpperCase();
      if (acceptance !== 'ACCEPTED' || ['ACCEPTED','ORIENTATION'].indexOf(stage) < 0) {
        throw new Error('Student is not eligible for orientation assignment. Acceptance must be completed first.');
      }

      const existing = v2FindComposite_(
        'V2_ORIENTATION_TRACKING',
        ['Orientation Session ID','Reference No'],
        [sessionId,reference]
      );
      const old = existing ? existing.record : {};
      const now = new Date().toISOString();
      const row = {
        'Orientation Session ID':sessionId,
        'Reference No':reference,
        'Student Name':workflow.record['Student Name'] || application.record['Student Name'] || '',
        'Programme':workflow.record['Programme'] || application.record['Programme'] || '',
        'Student Email':application.record['Personal Email'] || workflow.record['Personal Email'] || '',
        'Assigned At':old['Assigned At'] || now,
        'Assigned By':old['Assigned By'] || actor || 'Admin Portal V2',
        'Invitation Status':old['Invitation Status'] || 'PENDING',
        'Invitation Sent At':old['Invitation Sent At'] || '',
        'Invitation Delivery Detail':old['Invitation Delivery Detail'] || '',
        'Reminder Status':old['Reminder Status'] || 'NOT_SENT',
        'Reminder Sent At':old['Reminder Sent At'] || '',
        'Feedback Submitted':old['Feedback Submitted'] || 'NO',
        'Attendance Status':old['Attendance Status'] || 'NOT_UPDATED',
        'Feedback Submitted At':old['Feedback Submitted At'] || '',
        'Recording Email Status':old['Recording Email Status'] || 'NOT_SENT',
        'Community Email Status':old['Community Email Status'] || 'NOT_SENT',
        'Academic Handover Status':old['Academic Handover Status'] || 'NOT_READY',
        'Last Updated':now
      };

      v2UpsertComposite_(
        'V2_ORIENTATION_TRACKING',
        ['Orientation Session ID','Reference No'],
        [sessionId,reference],
        row
      );
      v2UpdateRow_(workflow.sheet,workflow.rowNumber,{
        'Orientation Session ID':sessionId,
        'Orientation Status':'ASSIGNED',
        'Application Stage':'ORIENTATION',
        'Academic Handover Status':'NOT_READY',
        'Last Updated':now,
        'Updated By':actor || 'Admin Portal V2'
      });

      let invitation = {sent:false,status:'ALREADY_SENT',mode:v2NotificationMode_()};
      if (String(row['Invitation Status'] || '').toUpperCase() !== 'SENT' || data.resendInvitation === true) {
        invitation = v2OrientationSendStudentEmail_(session.record, row, 'INVITATION');
        const tracking = v2FindComposite_(
          'V2_ORIENTATION_TRACKING',
          ['Orientation Session ID','Reference No'],
          [sessionId,reference]
        );
        if (tracking) {
          v2UpdateRow_(tracking.sheet,tracking.rowNumber,{
            'Invitation Status':invitation.sent ? 'SENT' : (invitation.status === 'DISABLED' ? 'DISABLED' : 'FAILED'),
            'Invitation Sent At':invitation.sent ? new Date().toISOString() : '',
            'Invitation Delivery Detail':String(invitation.status || ''),
            'Last Updated':new Date().toISOString()
          });
        }
      }

      v2Audit_(reference,'ORIENTATION','ASSIGN_STUDENT',{},{
        sessionId:sessionId,
        invitationStatus:invitation.status,
        invitationSent:!!invitation.sent
      },actor || 'Admin Portal V2','SUCCESS','');
      assigned.push({referenceNo:reference, invitationSent:!!invitation.sent, invitationStatus:invitation.status});
    } catch (error) {
      failed.push({referenceNo:reference, message:String(error && error.message || error)});
    }
  });

  v2OrientationRecountSession_(sessionId);
  v2OrientationEnsureReminderTrigger_();
  v2InvalidateCache_();
  return {
    ok:true,
    completed:failed.length === 0,
    partial:failed.length > 0 && assigned.length > 0,
    assignedCount:assigned.length,
    invitationSentCount:assigned.filter(function(x){return x.invitationSent;}).length,
    assigned:assigned,
    skipped:skipped,
    failed:failed,
    sessionId:sessionId,
    build:V2_ORIENTATION_BUILD
  };
}

function v2UpdateOrientationAttendance_(data, actor) {
  v2OrientationEnsureHeaders_();
  const sessionId = v2Required_(data.sessionId,'Orientation Session ID');
  const reference = v2Required_(data.referenceNo,'Reference No');
  const attendance = String(data.attendanceStatus || '').trim().toUpperCase();
  if (['ATTENDED','ABSENT','EXCUSED','NOT_UPDATED'].indexOf(attendance) < 0) {
    throw new Error('Invalid attendance status.');
  }

  const tracking = v2FindComposite_(
    'V2_ORIENTATION_TRACKING',
    ['Orientation Session ID','Reference No'],
    [sessionId,reference]
  );
  if (!tracking) throw new Error('Orientation tracking record not found.');
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!workflow) throw new Error('V2 workflow record not found.');

  const now = new Date().toISOString();
  const ready = attendance === 'ATTENDED';
  v2UpdateRow_(tracking.sheet,tracking.rowNumber,{
    'Attendance Status':attendance,
    'Academic Handover Status':ready ? 'READY' : 'NOT_READY',
    'Last Updated':now
  });
  v2UpdateRow_(workflow.sheet,workflow.rowNumber,{
    'Orientation Status':attendance,
    'Academic Handover Status':ready ? 'READY' : 'NOT_READY',
    'Application Stage':'ORIENTATION',
    'Last Updated':now,
    'Updated By':actor || 'Admin Portal V2'
  });

  v2Audit_(reference,'ORIENTATION','UPDATE_ATTENDANCE',{},{
    sessionId:sessionId,
    attendanceStatus:attendance,
    academicHandoverStatus:ready ? 'READY' : 'NOT_READY'
  },actor || 'Admin Portal V2','SUCCESS','');
  v2InvalidateCache_();
  return {ok:true,referenceNo:reference,sessionId:sessionId,attendanceStatus:attendance,academicHandoverStatus:ready?'READY':'NOT_READY'};
}

function v2SendOrientationReminderNow_(data, actor) {
  v2OrientationEnsureHeaders_();
  const sessionId = v2Required_(data.sessionId,'Orientation Session ID');
  const result = v2OrientationReminderForSession_(sessionId, true, actor || 'Admin Portal V2');
  v2InvalidateCache_();
  return Object.assign({ok:true,manual:true},result);
}

function v2OrientationReminderSweep() {
  assertDevIdentity_();
  v2OrientationEnsureHeaders_();
  const sessions = v2Rows_('V2_ORIENTATION_SESSIONS');
  const results = [];
  sessions.forEach(function(session) {
    const status = String(session['Status'] || '').toUpperCase();
    if (['SCHEDULED','OPEN','ACTIVE'].indexOf(status) < 0) return;
    const daysUntil = v2OrientationDaysUntil_(session['Session Date']);
    const reminderDays = Math.max(1, Number(session['Reminder Days'] || 3));
    if (daysUntil < 0 || daysUntil > reminderDays) return;
    results.push(v2OrientationReminderForSession_(session['Orientation Session ID'], false, 'Orientation Reminder Automation'));
  });
  v2Audit_('','ORIENTATION','REMINDER_SWEEP',{},{
    sessionsChecked:sessions.length,
    sessionsTriggered:results.length,
    sent:results.reduce(function(n,x){return n+Number(x.sentCount||0);},0)
  },'Orientation Reminder Automation','SUCCESS','');
  v2InvalidateCache_();
  return {ok:true,build:V2_ORIENTATION_BUILD,results:results};
}

function v2OrientationReminderForSession_(sessionId, force, actor) {
  const session = v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
  if (!session) throw new Error('Orientation session not found.');
  const trackingRows = v2Rows_('V2_ORIENTATION_TRACKING').filter(function(row){
    return String(row['Orientation Session ID'] || '') === sessionId;
  });

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  trackingRows.forEach(function(row) {
    const alreadySent = String(row['Reminder Status'] || '').toUpperCase() === 'SENT';
    if (alreadySent && !force) { skippedCount += 1; return; }
    if (!force && String(row['Invitation Status'] || '').toUpperCase() !== 'SENT') { skippedCount += 1; return; }

    try {
      const delivery = v2OrientationSendStudentEmail_(session.record, row, 'REMINDER');
      const current = v2FindComposite_(
        'V2_ORIENTATION_TRACKING',
        ['Orientation Session ID','Reference No'],
        [sessionId,row['Reference No']]
      );
      if (current) {
        v2UpdateRow_(current.sheet,current.rowNumber,{
          'Reminder Status':delivery.sent ? 'SENT' : (delivery.status === 'DISABLED' ? 'DISABLED' : 'FAILED'),
          'Reminder Sent At':delivery.sent ? new Date().toISOString() : '',
          'Last Updated':new Date().toISOString()
        });
      }
      if (delivery.sent) sentCount += 1;
      else failedCount += 1;
    } catch (error) {
      failedCount += 1;
      const current = v2FindComposite_(
        'V2_ORIENTATION_TRACKING',
        ['Orientation Session ID','Reference No'],
        [sessionId,row['Reference No']]
      );
      if (current) {
        v2UpdateRow_(current.sheet,current.rowNumber,{
          'Reminder Status':'FAILED',
          'Last Updated':new Date().toISOString()
        });
      }
    }
  });

  v2OrientationRecountSession_(sessionId);
  v2Audit_('','ORIENTATION',force ? 'SEND_REMINDER_NOW' : 'SEND_AUTOMATIC_REMINDER',{},{
    sessionId:sessionId,
    sentCount:sentCount,
    skippedCount:skippedCount,
    failedCount:failedCount
  },actor || 'Orientation Reminder Automation','SUCCESS','');

  return {sessionId:sessionId,sentCount:sentCount,skippedCount:skippedCount,failedCount:failedCount};
}

function v2OrientationSendStudentEmail_(session, tracking, type) {
  const recipient = String(tracking['Student Email'] || '').trim();
  const student = String(tracking['Student Name'] || 'Student').trim();
  const name = String(session['Orientation Name'] || 'Postgraduate Orientation Session').trim();
  const date = v2OrientationDisplayDate_(session['Session Date']);
  const start = String(session['Start Time'] || '').trim();
  const end = String(session['End Time'] || '').trim();
  const mode = String(session['Mode'] || 'ONLINE').trim().toUpperCase();
  const venue = String(session['Venue'] || '').trim();
  const meetingLink = String(session['Meeting Link'] || '').trim();
  const isReminder = type === 'REMINDER';

  const subject = isReminder
    ? '[IUC IPGS] Reminder - ' + name + ' - ' + date
    : '[IUC IPGS] Orientation Invitation - ' + name;

  let access = '';
  if (mode === 'ONLINE') {
    access = meetingLink
      ? '<p><strong>Online session:</strong> <a href="' + v2Html_(meetingLink) + '">Join orientation session</a></p>'
      : '<p><strong>Online session:</strong> The joining link will be shared by Registry.</p>';
  } else if (mode === 'PHYSICAL') {
    access = '<p><strong>Venue:</strong> ' + v2Html_(venue || 'To be confirmed') + '</p>';
  } else {
    access = '<p><strong>Venue:</strong> ' + v2Html_(venue || 'To be confirmed') + '</p>' +
      (meetingLink ? '<p><strong>Online option:</strong> <a href="' + v2Html_(meetingLink) + '">Join orientation session</a></p>' : '');
  }

  const html = '<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">' +
    '<div style="background:#2d2363;color:#fff;padding:24px"><h2 style="margin:0">' +
    (isReminder ? 'Orientation Reminder' : 'Postgraduate Orientation') + '</h2></div>' +
    '<div style="padding:24px"><p>Dear <strong>' + v2Html_(student) + '</strong>,</p>' +
    '<p>' + (isReminder
      ? 'This is a reminder for your upcoming postgraduate orientation session.'
      : 'You have been scheduled for the postgraduate orientation session below.') + '</p>' +
    '<div style="background:#faf8ff;border:1px solid #e5def6;border-radius:14px;padding:18px">' +
    '<strong>Session:</strong> ' + v2Html_(name) + '<br>' +
    '<strong>Date:</strong> ' + v2Html_(date) + '<br>' +
    '<strong>Time:</strong> ' + v2Html_([start,end].filter(Boolean).join(' - ')) + '<br>' +
    '<strong>Mode:</strong> ' + v2Html_(v2OrientationPretty_(mode)) +
    '</div>' + access +
    '<p>Please keep this email for your reference. If you are unable to attend, contact the Registry Office.</p>' +
    '<p>Regards,<br><strong>IPGS Registry</strong><br>Innovative University College</p></div></div>';

  const textBody = (isReminder ? 'Orientation reminder' : 'Orientation invitation') +
    '\nSession: ' + name + '\nDate: ' + date + '\nTime: ' + [start,end].filter(Boolean).join(' - ') +
    '\nMode: ' + mode + (venue ? '\nVenue: ' + venue : '') + (meetingLink ? '\nLink: ' + meetingLink : '');

  return v2NotificationSend_(
    isReminder ? 'ORIENTATION_REMINDER' : 'ORIENTATION_INVITATION',
    [recipient],
    subject,
    textBody,
    html,
    {}
  );
}

function v2OrientationRecountSession_(sessionId) {
  const session = v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
  if (!session) return null;
  const rows = v2Rows_('V2_ORIENTATION_TRACKING').filter(function(row){
    return String(row['Orientation Session ID'] || '') === sessionId;
  });
  const patch = {
    'Assigned Count':rows.length,
    'Invitation Count':rows.filter(function(row){return String(row['Invitation Status'] || '').toUpperCase()==='SENT';}).length,
    'Reminder Count':rows.filter(function(row){return String(row['Reminder Status'] || '').toUpperCase()==='SENT';}).length,
    'Updated At':new Date().toISOString()
  };
  v2UpdateRow_(session.sheet,session.rowNumber,patch);
  return patch;
}

function v2OrientationEnsureReminderTrigger_() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const existing = triggers.filter(function(trigger){
      return trigger.getHandlerFunction() === V2_ORIENTATION_REMINDER_HANDLER;
    });
    if (existing.length) return {ok:true,status:'ACTIVE',created:false,count:existing.length};

    ScriptApp.newTrigger(V2_ORIENTATION_REMINDER_HANDLER)
      .timeBased()
      .everyDays(1)
      .atHour(8)
      .create();
    return {ok:true,status:'ACTIVE',created:true,count:1};
  } catch (error) {
    Logger.log('Orientation reminder trigger setup failed: ' + String(error && error.message || error));
    return {ok:false,status:'TRIGGER_SETUP_FAILED',created:false,error:String(error && error.message || error)};
  }
}

function v2SetupOrientationAutomation() {
  assertDevIdentity_();
  v2OrientationEnsureHeaders_();
  return v2OrientationEnsureReminderTrigger_();
}

function v2OrientationDaysUntil_(dateValue) {
  const targetText = String(dateValue || '').trim().slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetText)) return 9999;
  const todayText = Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
  const a = todayText.split('-').map(Number);
  const b = targetText.split('-').map(Number);
  const todayUtc = Date.UTC(a[0],a[1]-1,a[2]);
  const targetUtc = Date.UTC(b[0],b[1]-1,b[2]);
  return Math.round((targetUtc - todayUtc) / 86400000);
}

function v2OrientationDisplayDate_(dateValue) {
  const text = String(dateValue || '').trim();
  if (!text) return '';
  const parts = text.slice(0,10).split('-').map(Number);
  if (parts.length === 3 && parts.every(function(n){return isFinite(n);})){
    return Utilities.formatDate(
      new Date(parts[0],parts[1]-1,parts[2],12,0,0),
      CONFIG.timezone || 'Asia/Kuala_Lumpur',
      'dd MMMM yyyy'
    );
  }
  return text;
}

function v2OrientationPretty_(value) {
  return String(value || '').toLowerCase().replace(/\b\w/g,function(m){return m.toUpperCase();});
}
