/**
 * Admission V2 - Stage 4 Orientation Module
 *
 * Core flow:
 * create session -> add any unassigned applicant -> send invitation ->
 * automatic reminder -> attendance tracking. This module is standalone.
 */

const V2_ORIENTATION_BUILD = 'ORIENTATION_V2_ATTENDANCE_RECORDING_20260920';
const V2_ORIENTATION_TRIGGER_VERSION = 'MILESTONE_V2_15MIN';
const V2_ORIENTATION_REMINDER_HANDLER = 'v2OrientationReminderSweep';
const V2_ORIENTATION_SESSION_HEADERS = [
  'Orientation Name','Mode','Venue','Reminder Days','Assigned Count',
  'Invitation Count','Reminder Count',
  'Attendance Status','Attendance Opened At','Attendance Opened By','Attendance Closed At',
  'Attendance Link','Recording Email Count','Recording Sent At','Updated At'
];
const V2_ORIENTATION_TRACKING_HEADERS = [
  'Student Email','Assigned At','Assigned By','Invitation Sent At',
  'Reminder Status','Reminder Sent At','Reminder History JSON','Last Reminder Milestone',
  'Invitation Delivery Detail',
  'Attendance Token','Attendance Source','Attendance Submitted At','Attendance Identifier',
  'Attendance Link Status','Attendance Link Sent At',
  'Feedback Status','Feedback JSON',
  'Manual Override At','Manual Override By','Manual Override From',
  'Recording Email Sent At','Recording Delivery Detail'
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

  // Fixed production cadence: 3 days, 2 days, 1 day and approximately 1 hour before.
  const reminderDays = 3;
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
  const historicalOnly = data.historicalOnly === true;
  const sessionEnded = v2OrientationMarkEndedIfPast_(session, actor || 'Admin Portal V2');
  if (sessionEnded && !historicalOnly) {
    throw new Error('Orientation session has ended. New invitation emails are disabled. Use historical record mode to add a missed student without sending an email.');
  }
  if (!sessionEnded && !/SCHEDULED|OPEN|ACTIVE/i.test(String(session.record['Status'] || 'SCHEDULED'))) {
    throw new Error('Orientation session is not open for student assignment.');
  }

  const references = Array.from(new Set((data.referenceNos || []).map(function(v){ return String(v || '').trim(); }).filter(Boolean)));
  if (!references.length) throw new Error('Select at least one accepted student.');
  if (references.length > 100) throw new Error('Assign a maximum of 100 students at one time.');

  const assigned = [];
  const skipped = [];
  const failed = [];
  const alreadyAssignedRefs = {};
  v2Rows_('V2_ORIENTATION_TRACKING').forEach(function(row) {
    const ref = String(row['Reference No'] || '').trim();
    if (ref) alreadyAssignedRefs[ref] = String(row['Orientation Session ID'] || '');
  });

  references.forEach(function(reference) {
    try {
      const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
      const application = v2Find_('V2_APPLICATIONS','Reference No',reference);
      if (!application) throw new Error('Application record not found.');

      if (alreadyAssignedRefs[reference]) {
        skipped.push({
          referenceNo:reference,
          message:'Student is already assigned to Orientation Session ' + alreadyAssignedRefs[reference] + '.'
        });
        return;
      }

      const existing = v2FindComposite_(
        'V2_ORIENTATION_TRACKING',
        ['Orientation Session ID','Reference No'],
        [sessionId,reference]
      );
      const old = existing ? existing.record : {};
      const now = new Date().toISOString();
      const priorInvitationStatus = String(old['Invitation Status'] || '').trim().toUpperCase();
      const priorReminderStatus = String(old['Reminder Status'] || '').trim().toUpperCase();
      const row = {
        'Orientation Session ID':sessionId,
        'Reference No':reference,
        'Student Name':(workflow && workflow.record['Student Name']) || application.record['Student Name'] || '',
        'Programme':(workflow && workflow.record['Programme']) || application.record['Programme'] || '',
        'Student Email':application.record['Personal Email'] || (workflow && workflow.record['Personal Email']) || '',
        'Assigned At':old['Assigned At'] || now,
        'Assigned By':old['Assigned By'] || actor || 'Admin Portal V2',
        'Invitation Status':historicalOnly && priorInvitationStatus !== 'SENT' ? 'NOT_REQUIRED' : (old['Invitation Status'] || 'PENDING'),
        'Invitation Sent At':old['Invitation Sent At'] || '',
        'Invitation Delivery Detail':historicalOnly && priorInvitationStatus !== 'SENT' ? 'HISTORICAL_RECORD_ONLY' : (old['Invitation Delivery Detail'] || ''),
        'Reminder Status':historicalOnly && priorReminderStatus !== 'SENT' ? 'NOT_REQUIRED' : (old['Reminder Status'] || 'NOT_SENT'),
        'Reminder Sent At':old['Reminder Sent At'] || '',
        'Reminder History JSON':old['Reminder History JSON'] || '{}',
        'Last Reminder Milestone':old['Last Reminder Milestone'] || '',
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
      if (workflow) {
        v2UpdateRow_(workflow.sheet,workflow.rowNumber,{
          'Orientation Session ID':sessionId,
          'Orientation Status':'ASSIGNED',
          'Last Updated':now,
          'Updated By':actor || 'Admin Portal V2'
        });
      }

      let invitation = historicalOnly
        ? {sent:false,status:'HISTORICAL_RECORD_ONLY',mode:v2NotificationMode_()}
        : {sent:false,status:'ALREADY_SENT',mode:v2NotificationMode_()};
      if (!historicalOnly && (String(row['Invitation Status'] || '').toUpperCase() !== 'SENT' || data.resendInvitation === true)) {
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
        invitationSent:!!invitation.sent,
        historicalOnly:historicalOnly
      },actor || 'Admin Portal V2','SUCCESS','');
      assigned.push({referenceNo:reference, invitationSent:!!invitation.sent, invitationStatus:invitation.status});
    } catch (error) {
      failed.push({referenceNo:reference, message:String(error && error.message || error)});
    }
  });

  v2OrientationRecountSession_(sessionId);
  if (!historicalOnly) v2OrientationEnsureReminderTrigger_();
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
    historicalOnly:historicalOnly,
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
  const now = new Date().toISOString();
  const previousAttendance = String(tracking.record['Attendance Status'] || 'NOT_UPDATED').toUpperCase();
  v2UpdateRow_(tracking.sheet,tracking.rowNumber,{
    'Attendance Status':attendance,
    'Attendance Source':'MANUAL',
    'Manual Override At':now,
    'Manual Override By':actor || 'Admin Portal V2',
    'Manual Override From':previousAttendance,
    'Last Updated':now
  });
  if (workflow) {
    v2UpdateRow_(workflow.sheet,workflow.rowNumber,{
      'Orientation Status':attendance,
      'Last Updated':now,
      'Updated By':actor || 'Admin Portal V2'
    });
  }

  v2Audit_(reference,'ORIENTATION','UPDATE_ATTENDANCE',{},{
    sessionId:sessionId,
    attendanceStatus:attendance,
    standalone:true
  },actor || 'Admin Portal V2','SUCCESS','');
  v2InvalidateCache_();
  return {ok:true,referenceNo:reference,sessionId:sessionId,attendanceStatus:attendance,standalone:true};
}


const V2_ORIENTATION_ATTENDANCE_BASE_URL = 'https://n-form.innovative.edu.my/orientation-attendance.html';

function v2OrientationAttendancePublicSession_(session) {
  return {
    sessionId:String(session['Orientation Session ID'] || ''),
    name:String(session['Orientation Name'] || 'Postgraduate Orientation Session'),
    date:v2OrientationDisplayDate_(session['Session Date']),
    startTime:v2OrientationDisplayTime_(session['Start Time']),
    endTime:v2OrientationDisplayTime_(session['End Time']),
    mode:v2OrientationPretty_(session['Mode'] || 'ONLINE'),
    venue:String(session['Venue'] || ''),
    attendanceStatus:String(session['Attendance Status'] || 'NOT_OPEN').toUpperCase()
  };
}

function v2OrientationAttendanceToken_() {
  return Utilities.getUuid().replace(/-/g,'') + Utilities.getUuid().replace(/-/g,'').slice(0,16);
}

function v2OrientationAttendanceOpen_(sessionRecord) {
  return String(sessionRecord && sessionRecord['Attendance Status'] || '').toUpperCase() === 'OPEN';
}

function v2OrientationAttendanceRequireOpen_(sessionRecord) {
  if (!v2OrientationAttendanceOpen_(sessionRecord)) {
    throw new Error('Attendance for this Orientation Session is not open.');
  }
}

function v2OrientationEnsureWalkinSheet_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  let sheet = ss.getSheetByName('V2_ORIENTATION_WALKINS');
  const headers = [
    'Walk-in ID','Orientation Session ID','Reference No','Student Name','Personal Email',
    'ID / Passport No','Programme','Match Status','Review Status','Attendance Status',
    'Attendance At','Source','Remarks','Created At','Last Updated'
  ];
  if (!sheet) {
    sheet = ss.insertSheet('V2_ORIENTATION_WALKINS');
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    try { v2StyleHeader_(sheet, headers.length); } catch (_) {}
  } else {
    v2EnsureHeaders_(sheet, headers);
  }
  return sheet;
}

function v2OrientationNormaliseIdentifier_(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g,'');
}

function v2OrientationFindApplicationByIdentifier_(identifier) {
  const key = v2OrientationNormaliseIdentifier_(identifier);
  if (!key) return null;
  const apps = v2Rows_('V2_APPLICATIONS');
  for (let i=0;i<apps.length;i++) {
    const app = apps[i];
    const candidates = [
      app['Personal Email'],
      app['ID / Passport No'],
      app['SKY Student ID'],
      app['Reference No']
    ].map(v2OrientationNormaliseIdentifier_);
    if (candidates.indexOf(key) >= 0) return app;
  }
  const workflow = v2Rows_('V2_WORKFLOW');
  for (let i=0;i<workflow.length;i++) {
    const row = workflow[i];
    const candidates = [
      row['Personal Email'],
      row['ID / Passport No'],
      row['SKY Student ID'],
      row['Reference No']
    ].map(v2OrientationNormaliseIdentifier_);
    if (candidates.indexOf(key) >= 0) {
      return apps.filter(function(app){return String(app['Reference No']||'')===String(row['Reference No']||'');})[0] || row;
    }
  }
  return null;
}

function v2OpenOrientationAttendance_(data, actor) {
  v2OrientationEnsureHeaders_();
  const sessionId = v2Required_(data.sessionId,'Orientation Session ID');
  const session = v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
  if (!session) throw new Error('Orientation session not found.');
  if (String(session.record['Status'] || '').toUpperCase() === 'CANCELLED') throw new Error('Cancelled Orientation Session cannot open attendance.');

  const trackingRows = v2Rows_('V2_ORIENTATION_TRACKING').filter(function(row){
    return String(row['Orientation Session ID'] || '') === sessionId;
  });
  if (!trackingRows.length) throw new Error('Add students to this Orientation Session before opening attendance.');

  const now = new Date().toISOString();
  const genericLink = V2_ORIENTATION_ATTENDANCE_BASE_URL + '?s=' + encodeURIComponent(sessionId);
  v2UpdateRow_(session.sheet,session.rowNumber,{
    'Attendance Status':'OPEN',
    'Attendance Opened At':now,
    'Attendance Opened By':actor || 'Admin Portal V2',
    'Attendance Closed At':'',
    'Attendance Link':genericLink,
    'Updated At':now
  });

  let sentCount=0, failedCount=0, skippedCount=0;
  trackingRows.forEach(function(row){
    const found = v2FindComposite_('V2_ORIENTATION_TRACKING',['Orientation Session ID','Reference No'],[sessionId,row['Reference No']]);
    if (!found) return;
    let token = String(found.record['Attendance Token'] || '').trim();
    if (!token) token = v2OrientationAttendanceToken_();
    const personalLink = V2_ORIENTATION_ATTENDANCE_BASE_URL + '?t=' + encodeURIComponent(token);
    const email = String(found.record['Student Email'] || '').trim();
    const student = String(found.record['Student Name'] || 'Student').trim();
    let delivery = {sent:false,status:'NO_EMAIL'};
    if (email && email.indexOf('@') > 0) {
      const subject='[IUC IPGS] Orientation Attendance is Now Open';
      const html='<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">'+
        '<div style="background:#2d2363;color:#fff;padding:24px"><h2 style="margin:0">Orientation Attendance</h2></div>'+
        '<div style="padding:24px"><p>Dear <strong>'+v2Html_(student)+'</strong>,</p>'+
        '<p>Attendance for <strong>'+v2Html_(session.record['Orientation Name'] || 'Postgraduate Orientation')+'</strong> is now open.</p>'+
        '<p style="margin:28px 0"><a href="'+v2Html_(personalLink)+'" style="background:#2d2363;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold">Confirm Attendance</a></p>'+
        '<p>This link is personalised for you. Please do not forward it to another student.</p>'+
        '<p>Regards,<br><strong>IPGS Registry</strong><br>Innovative University College</p></div></div>';
      const textBody='Orientation attendance is now open.\nConfirm attendance: '+personalLink;
      delivery=v2NotificationSend_('ORIENTATION_ATTENDANCE_OPEN',[email],subject,textBody,html,{});
    }
    if (delivery.sent) sentCount++; else if (delivery.status === 'NO_EMAIL') skippedCount++; else failedCount++;
    v2UpdateRow_(found.sheet,found.rowNumber,{
      'Attendance Token':token,
      'Attendance Link Status':delivery.sent ? 'SENT' : (delivery.status || 'NOT_SENT'),
      'Attendance Link Sent At':delivery.sent ? now : '',
      'Last Updated':now
    });
  });

  v2Audit_('','ORIENTATION','OPEN_ATTENDANCE',{},{
    sessionId:sessionId, attendanceStatus:'OPEN', sentCount:sentCount, failedCount:failedCount, skippedCount:skippedCount
  },actor || 'Admin Portal V2','SUCCESS','Attendance remains open until Registry closes it manually.');
  v2InvalidateCache_();
  return {ok:true,sessionId:sessionId,attendanceStatus:'OPEN',attendanceLink:genericLink,sentCount:sentCount,failedCount:failedCount,skippedCount:skippedCount};
}

function v2CloseOrientationAttendance_(data, actor) {
  v2OrientationEnsureHeaders_();
  const sessionId=v2Required_(data.sessionId,'Orientation Session ID');
  const session=v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
  if (!session) throw new Error('Orientation session not found.');
  const now=new Date().toISOString();
  v2UpdateRow_(session.sheet,session.rowNumber,{
    'Attendance Status':'CLOSED','Attendance Closed At':now,'Updated At':now
  });
  v2Audit_('','ORIENTATION','CLOSE_ATTENDANCE',{status:session.record['Attendance Status'] || ''},{
    sessionId:sessionId,attendanceStatus:'CLOSED',closedAt:now
  },actor || 'Admin Portal V2','SUCCESS','Manual attendance remains available in ACC.');
  v2InvalidateCache_();
  return {ok:true,sessionId:sessionId,attendanceStatus:'CLOSED',closedAt:now};
}

function v2GetOrientationAttendanceContext_(data) {
  v2OrientationEnsureHeaders_();
  const token=String(data.token || '').trim();
  const sessionId=String(data.sessionId || '').trim();

  if (token) {
    const rows=v2Rows_('V2_ORIENTATION_TRACKING');
    const tracking=rows.filter(function(row){return String(row['Attendance Token'] || '')===token;})[0];
    if (!tracking) throw new Error('Attendance link is invalid or no longer available.');
    const session=v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',tracking['Orientation Session ID']);
    if (!session) throw new Error('Orientation session not found.');
    return {
      ok:true,mode:'PERSONAL',open:v2OrientationAttendanceOpen_(session.record),
      session:v2OrientationAttendancePublicSession_(session.record),
      student:{
        referenceNo:String(tracking['Reference No'] || ''),
        name:String(tracking['Student Name'] || ''),
        programme:String(tracking['Programme'] || ''),
        attendanceStatus:String(tracking['Attendance Status'] || 'NOT_UPDATED'),
        feedbackStatus:String(tracking['Feedback Status'] || 'NOT_SUBMITTED')
      }
    };
  }

  const session=v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',v2Required_(sessionId,'Orientation Session ID'));
  if (!session) throw new Error('Orientation session not found.');
  return {ok:true,mode:'SESSION',open:v2OrientationAttendanceOpen_(session.record),session:v2OrientationAttendancePublicSession_(session.record)};
}

function v2ResolveOrientationAttendanceIdentity_(data) {
  v2OrientationEnsureHeaders_();
  const sessionId=v2Required_(data.sessionId,'Orientation Session ID');
  const identifier=v2Required_(data.identifier,'Email / Student ID / IC / Passport');
  const session=v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
  if (!session) throw new Error('Orientation session not found.');
  v2OrientationAttendanceRequireOpen_(session.record);

  const key=v2OrientationNormaliseIdentifier_(identifier);
  const assigned=v2Rows_('V2_ORIENTATION_TRACKING').filter(function(row){
    if (String(row['Orientation Session ID'] || '') !== sessionId) return false;
    const app=v2OrientationFindApplicationByIdentifier_(row['Reference No']);
    const values=[
      row['Student Email'],row['Reference No'],
      app && app['Personal Email'],app && app['ID / Passport No'],app && app['SKY Student ID']
    ].map(v2OrientationNormaliseIdentifier_);
    return values.indexOf(key)>=0;
  })[0];

  if (assigned) {
    let token=String(assigned['Attendance Token'] || '').trim();
    if (!token) {
      token=v2OrientationAttendanceToken_();
      const found=v2FindComposite_('V2_ORIENTATION_TRACKING',['Orientation Session ID','Reference No'],[sessionId,assigned['Reference No']]);
      if (found) v2UpdateRow_(found.sheet,found.rowNumber,{'Attendance Token':token,'Last Updated':new Date().toISOString()});
    }
    return {ok:true,matchStatus:'ASSIGNED',token:token,student:{referenceNo:assigned['Reference No'],name:assigned['Student Name'],programme:assigned['Programme']}};
  }

  const app=v2OrientationFindApplicationByIdentifier_(identifier);
  if (app) {
    const reference=String(app['Reference No'] || '');
    const elsewhere=v2Rows_('V2_ORIENTATION_TRACKING').filter(function(row){
      return String(row['Reference No'] || '')===reference && String(row['Orientation Session ID'] || '')!==sessionId;
    })[0];
    if (elsewhere) {
      return {ok:true,matchStatus:'REVIEW_REQUIRED',message:'Your student record is already linked to another Orientation Session. Registry will verify your attendance.',student:{name:app['Student Name'] || '',programme:app['Programme'] || ''}};
    }
    return {ok:true,matchStatus:'WALK_IN',student:{referenceNo:reference,name:app['Student Name'] || '',programme:app['Programme'] || '',email:app['Personal Email'] || ''}};
  }

  return {ok:true,matchStatus:'UNMATCHED',message:'We could not match your details automatically. Please provide your details for Registry review.'};
}

function v2SubmitOrientationAttendance_(data) {
  v2OrientationEnsureHeaders_();
  const token=String(data.token || '').trim();
  let sessionId=String(data.sessionId || '').trim();
  let reference=String(data.referenceNo || '').trim();
  let tracking=null;

  if (token) {
    const row=v2Rows_('V2_ORIENTATION_TRACKING').filter(function(x){return String(x['Attendance Token'] || '')===token;})[0];
    if (!row) throw new Error('Attendance link is invalid.');
    sessionId=String(row['Orientation Session ID'] || '');
    reference=String(row['Reference No'] || '');
  }

  const session=v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',v2Required_(sessionId,'Orientation Session ID'));
  if (!session) throw new Error('Orientation session not found.');
  v2OrientationAttendanceRequireOpen_(session.record);

  if (reference) {
    tracking=v2FindComposite_('V2_ORIENTATION_TRACKING',['Orientation Session ID','Reference No'],[sessionId,reference]);
    if (!tracking) {
      const app=v2Find_('V2_APPLICATIONS','Reference No',reference);
      if (!app) throw new Error('Student record not found.');
      const other=v2Rows_('V2_ORIENTATION_TRACKING').filter(function(x){
        return String(x['Reference No'] || '')===reference && String(x['Orientation Session ID'] || '')!==sessionId;
      })[0];
      if (other) throw new Error('This student is already linked to another Orientation Session. Registry review is required.');
      const now=new Date().toISOString();
      const newToken=v2OrientationAttendanceToken_();
      v2UpsertComposite_('V2_ORIENTATION_TRACKING',['Orientation Session ID','Reference No'],[sessionId,reference],{
        'Orientation Session ID':sessionId,'Reference No':reference,
        'Student Name':app.record['Student Name'] || '','Programme':app.record['Programme'] || '',
        'Student Email':app.record['Personal Email'] || '',
        'Assigned At':now,'Assigned By':'WALK_IN_SELF_CHECKIN',
        'Invitation Status':'NOT_REQUIRED','Reminder Status':'NOT_REQUIRED',
        'Attendance Token':newToken,'Attendance Status':'NOT_UPDATED',
        'Feedback Submitted':'NO','Feedback Status':'NOT_SUBMITTED',
        'Recording Email Status':'NOT_SENT','Community Email Status':'NOT_SENT',
        'Academic Handover Status':'NOT_READY','Last Updated':now
      });
      tracking=v2FindComposite_('V2_ORIENTATION_TRACKING',['Orientation Session ID','Reference No'],[sessionId,reference]);
    }
  }

  if (!tracking) {
    const sheet=v2OrientationEnsureWalkinSheet_();
    const now=new Date().toISOString();
    const walkinId='WALKIN-'+Utilities.getUuid().slice(0,8).toUpperCase();
    const headers=sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
    const row={
      'Walk-in ID':walkinId,'Orientation Session ID':sessionId,
      'Student Name':String(data.studentName || '').trim(),
      'Personal Email':String(data.email || '').trim(),
      'ID / Passport No':String(data.idPassport || '').trim(),
      'Programme':String(data.programme || '').trim(),
      'Match Status':'UNMATCHED','Review Status':'PENDING',
      'Attendance Status':'PENDING_REVIEW','Attendance At':now,
      'Source':'SESSION_QR_UNMATCHED','Remarks':'Submitted through public Orientation attendance form.',
      'Created At':now,'Last Updated':now
    };
    sheet.appendRow(headers.map(function(h){return row[h] || '';}));
    return {ok:true,matchStatus:'UNMATCHED',reviewRequired:true,walkinId:walkinId};
  }

  const now=new Date().toISOString();
  const prior=String(tracking.record['Attendance Status'] || 'NOT_UPDATED');
  let currentToken=String(tracking.record['Attendance Token'] || '').trim();
  if (!currentToken) currentToken=v2OrientationAttendanceToken_();
  const source=token ? 'PERSONAL_LINK' : (String(tracking.record['Assigned By'] || '')==='WALK_IN_SELF_CHECKIN' ? 'SESSION_QR_WALK_IN' : 'SESSION_QR');
  v2UpdateRow_(tracking.sheet,tracking.rowNumber,{
    'Attendance Status':'ATTENDED','Attendance Source':source,
    'Attendance Submitted At':now,'Attendance Identifier':String(data.identifier || ''),
    'Attendance Token':currentToken,'Last Updated':now
  });
  const workflow=v2Find_('V2_WORKFLOW','Reference No',reference);
  if (workflow) {
    v2UpdateRow_(workflow.sheet,workflow.rowNumber,{
      'Orientation Session ID':sessionId,'Orientation Status':'ATTENDED',
      'Last Updated':now,'Updated By':'Student Attendance Form'
    });
  }
  v2Audit_(reference,'ORIENTATION','SELF_CHECKIN',{attendanceStatus:prior},{
    sessionId:sessionId,attendanceStatus:'ATTENDED',source:source
  },'Student Attendance Form','SUCCESS','');
  v2OrientationRecountSession_(sessionId);
  v2InvalidateCache_();
  return {ok:true,matchStatus:'ATTENDED',referenceNo:reference,token:currentToken,attendanceStatus:'ATTENDED',submittedAt:now};
}

function v2SubmitOrientationFeedback_(data) {
  v2OrientationEnsureHeaders_();
  const token=v2Required_(data.token,'Attendance token');
  const row=v2Rows_('V2_ORIENTATION_TRACKING').filter(function(x){return String(x['Attendance Token'] || '')===token;})[0];
  if (!row) throw new Error('Attendance record not found.');
  const found=v2FindComposite_('V2_ORIENTATION_TRACKING',['Orientation Session ID','Reference No'],[row['Orientation Session ID'],row['Reference No']]);
  if (!found) throw new Error('Attendance record not found.');
  const now=new Date().toISOString();
  const feedback={
    satisfaction:String(data.satisfaction || ''),
    clarity:String(data.clarity || ''),
    useful:String(data.useful || ''),
    improvement:String(data.improvement || '')
  };
  v2UpdateRow_(found.sheet,found.rowNumber,{
    'Feedback Submitted':'YES','Feedback Status':'SUBMITTED',
    'Feedback Submitted At':now,'Feedback JSON':JSON.stringify(feedback),'Last Updated':now
  });
  v2Audit_(String(row['Reference No'] || ''),'ORIENTATION','SUBMIT_FEEDBACK',{},{
    sessionId:String(row['Orientation Session ID'] || ''),feedbackStatus:'SUBMITTED'
  },'Student Attendance Form','SUCCESS','');
  v2InvalidateCache_();
  return {ok:true,feedbackStatus:'SUBMITTED',submittedAt:now};
}

function v2SetOrientationRecording_(data, actor) {
  v2OrientationEnsureHeaders_();
  const sessionId=v2Required_(data.sessionId,'Orientation Session ID');
  const url=v2Required_(data.recordingUrl,'Recording URL');
  if (!/^https?:\/\//i.test(url)) throw new Error('Enter a valid recording URL.');
  const session=v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
  if (!session) throw new Error('Orientation session not found.');
  const now=new Date().toISOString();
  v2UpdateRow_(session.sheet,session.rowNumber,{'Recording URL':url,'Updated At':now});
  v2Audit_('','ORIENTATION','SET_RECORDING',{recordingUrl:session.record['Recording URL'] || ''},{
    sessionId:sessionId,recordingUrl:url
  },actor || 'Admin Portal V2','SUCCESS','Recording email is not sent until Registry clicks Send Recording.');
  v2InvalidateCache_();
  return {ok:true,sessionId:sessionId,recordingUrl:url};
}

function v2SendOrientationRecording_(data, actor) {
  v2OrientationEnsureHeaders_();
  const sessionId=v2Required_(data.sessionId,'Orientation Session ID');
  const session=v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
  if (!session) throw new Error('Orientation session not found.');
  const url=String(session.record['Recording URL'] || '').trim();
  if (!url) throw new Error('Add the recording link before sending.');
  const rows=v2Rows_('V2_ORIENTATION_TRACKING').filter(function(row){
    return String(row['Orientation Session ID'] || '')===sessionId;
  });
  const now=new Date().toISOString();
  let sentCount=0,failedCount=0,skippedCount=0;
  rows.forEach(function(row){
    const email=String(row['Student Email'] || '').trim();
    const found=v2FindComposite_('V2_ORIENTATION_TRACKING',['Orientation Session ID','Reference No'],[sessionId,row['Reference No']]);
    if (!found) return;
    if (!email || email.indexOf('@')<1) {
      skippedCount++;
      v2UpdateRow_(found.sheet,found.rowNumber,{'Recording Email Status':'NO_EMAIL','Recording Delivery Detail':'NO_EMAIL','Last Updated':now});
      return;
    }
    const student=String(row['Student Name'] || 'Student');
    const subject='[IUC IPGS] Orientation Recording - '+String(session.record['Orientation Name'] || 'Postgraduate Orientation');
    const html='<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">'+
      '<div style="background:#2d2363;color:#fff;padding:24px"><h2 style="margin:0">Orientation Recording</h2></div>'+
      '<div style="padding:24px"><p>Dear <strong>'+v2Html_(student)+'</strong>,</p>'+
      '<p>The recording for your postgraduate orientation session is now available.</p>'+
      '<p style="margin:28px 0"><a href="'+v2Html_(url)+'" style="background:#2d2363;color:#fff;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:bold">Watch Orientation Recording</a></p>'+
      '<p>Please keep this email for your reference.</p>'+
      '<p>Regards,<br><strong>IPGS Registry</strong><br>Innovative University College</p></div></div>';
    const result=v2NotificationSend_('ORIENTATION_RECORDING',[email],subject,'Orientation recording: '+url,html,{});
    if (result.sent) sentCount++; else failedCount++;
    v2UpdateRow_(found.sheet,found.rowNumber,{
      'Recording Email Status':result.sent ? 'SENT' : 'FAILED',
      'Recording Email Sent At':result.sent ? now : '',
      'Recording Delivery Detail':String(result.status || ''),
      'Last Updated':now
    });
  });
  v2UpdateRow_(session.sheet,session.rowNumber,{
    'Recording Email Count':sentCount,'Recording Sent At':sentCount ? now : (session.record['Recording Sent At'] || ''),'Updated At':now
  });
  v2Audit_('','ORIENTATION','SEND_RECORDING',{},{
    sessionId:sessionId,sentCount:sentCount,failedCount:failedCount,skippedCount:skippedCount
  },actor || 'Admin Portal V2','SUCCESS','Recording sent to all students assigned to the session.');
  v2InvalidateCache_();
  return {ok:true,sessionId:sessionId,sentCount:sentCount,failedCount:failedCount,skippedCount:skippedCount};
}

function v2SendOrientationReminderNow_(data, actor) {
  v2OrientationEnsureHeaders_();
  const sessionId = v2Required_(data.sessionId,'Orientation Session ID');
  const session = v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
  if (!session) throw new Error('Orientation session not found.');
  if (v2OrientationMarkEndedIfPast_(session, actor || 'Admin Portal V2') ||
      ['ENDED','CANCELLED','CLOSED'].indexOf(String(session.record['Status'] || '').toUpperCase()) >= 0) {
    throw new Error('Orientation session has ended. Reminder sending is disabled.');
  }
  const result = v2OrientationReminderForSession_(sessionId, true, actor || 'Admin Portal V2', 'MANUAL');
  v2InvalidateCache_();
  return Object.assign({ok:true,manual:true},result);
}

function v2OrientationReminderHistory_(row) {
  try {
    const parsed = JSON.parse(String(row && row['Reminder History JSON'] || '{}'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function v2OrientationSessionStart_(session) {
  const tz = CONFIG.timezone || Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur';
  let dateText = '';
  const rawDate = session && session['Session Date'];
  if (Object.prototype.toString.call(rawDate) === '[object Date]' && !isNaN(rawDate.getTime())) {
    dateText = Utilities.formatDate(rawDate, tz, 'yyyy-MM-dd');
  } else {
    dateText = String(rawDate || '').trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateText)) {
      const parts = dateText.split('/');
      dateText = parts[2] + '-' + String(parts[1]).padStart(2,'0') + '-' + String(parts[0]).padStart(2,'0');
    }
  }
  const timeText = String(session && session['Start Time'] || '08:30').trim().slice(0,5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !/^\d{2}:\d{2}$/.test(timeText)) return null;
  try {
    return Utilities.parseDate(dateText + ' ' + timeText, tz, 'yyyy-MM-dd HH:mm');
  } catch (_) {
    return null;
  }
}

function v2OrientationSessionEnd_(session) {
  const tz = CONFIG.timezone || Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur';
  let dateText = '';
  const rawDate = session && session['Session Date'];
  if (Object.prototype.toString.call(rawDate) === '[object Date]' && !isNaN(rawDate.getTime())) {
    dateText = Utilities.formatDate(rawDate, tz, 'yyyy-MM-dd');
  } else {
    dateText = String(rawDate || '').trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateText)) {
      const parts = dateText.split('/');
      dateText = parts[2] + '-' + String(parts[1]).padStart(2,'0') + '-' + String(parts[0]).padStart(2,'0');
    }
  }
  const endText = String(session && (session['End Time'] || session['Start Time']) || '10:30').trim().slice(0,5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText) || !/^\d{2}:\d{2}$/.test(endText)) return null;
  try {
    return Utilities.parseDate(dateText + ' ' + endText, tz, 'yyyy-MM-dd HH:mm');
  } catch (_) {
    return null;
  }
}

function v2OrientationSessionHasEnded_(session, now) {
  const status = String(session && session['Status'] || '').trim().toUpperCase();
  if (['ENDED','CANCELLED','CLOSED'].indexOf(status) >= 0) return true;
  const end = v2OrientationSessionEnd_(session);
  return !!(end && end.getTime() <= (now || new Date()).getTime());
}

function v2OrientationMarkEndedIfPast_(sessionFound, actor) {
  if (!sessionFound || !sessionFound.record) return false;
  const status = String(sessionFound.record['Status'] || '').trim().toUpperCase();
  if (['ENDED','CANCELLED','CLOSED'].indexOf(status) >= 0) return true;
  if (!v2OrientationSessionHasEnded_(sessionFound.record, new Date())) return false;

  const now = new Date().toISOString();
  v2UpdateRow_(sessionFound.sheet,sessionFound.rowNumber,{
    'Status':'ENDED',
    'Updated At':now
  });
  try {
    v2Audit_('', 'ORIENTATION', 'AUTO_END_SESSION', {status:status}, {
      sessionId:String(sessionFound.record['Orientation Session ID'] || ''),
      status:'ENDED',
      endedAt:now
    }, actor || 'Orientation Automation', 'SUCCESS', 'Orientation session ended automatically after the scheduled end time.');
  } catch (_) {}
  return true;
}

function v2EndOrientationSession_(data, actor) {
  v2OrientationEnsureHeaders_();
  const sessionId = v2Required_(data.sessionId,'Orientation Session ID');
  const session = v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
  if (!session) throw new Error('Orientation session not found.');

  const currentStatus = String(session.record['Status'] || 'SCHEDULED').trim().toUpperCase();
  if (currentStatus === 'ENDED') {
    return {ok:true,sessionId:sessionId,status:'ENDED',alreadyEnded:true};
  }

  const now = new Date().toISOString();
  v2UpdateRow_(session.sheet,session.rowNumber,{
    'Status':'ENDED',
    'Updated At':now
  });
  v2Audit_('', 'ORIENTATION', 'END_SESSION', {status:currentStatus}, {
    sessionId:sessionId,
    status:'ENDED',
    endedAt:now
  }, actor || 'Admin Portal V2', 'SUCCESS', 'Orientation session manually ended. Invitations and reminders are disabled; attendance remains editable.');
  v2InvalidateCache_();

  return {ok:true,sessionId:sessionId,status:'ENDED',endedAt:now};
}

function v2EditOrientationSession_(data, actor) {
  v2OrientationEnsureHeaders_();
  const sessionId = v2Required_(data.sessionId,'Orientation Session ID');
  const session = v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
  if (!session) throw new Error('Orientation session not found.');

  const old = session.record || {};
  const updates = {};
  const has = function(key){ return Object.prototype.hasOwnProperty.call(data,key); };

  if (has('name')) updates['Orientation Name'] = v2Required_(data.name,'Orientation Name');
  if (has('intakeId')) updates['Intake ID'] = v2Required_(data.intakeId,'Intake ID');
  if (has('programmeGroup')) updates['Programme Group'] = String(data.programmeGroup || 'ALL').trim() || 'ALL';
  if (has('sessionDate')) updates['Session Date'] = v2Required_(data.sessionDate,'Session Date');
  if (has('startTime')) updates['Start Time'] = v2Required_(data.startTime,'Start Time');
  if (has('endTime')) updates['End Time'] = v2Required_(data.endTime,'End Time');
  if (has('venue')) updates['Venue'] = String(data.venue || '').trim();
  if (has('meetingLink')) updates['Meeting Link'] = String(data.meetingLink || '').trim();

  if (has('mode')) {
    const mode = String(data.mode || '').trim().toUpperCase();
    if (['ONLINE','PHYSICAL','HYBRID'].indexOf(mode) < 0) throw new Error('Orientation mode must be Online, Physical or Hybrid.');
    updates['Mode'] = mode;
  }

  if (updates['Start Time'] && !/^\d{2}:\d{2}$/.test(String(updates['Start Time']).slice(0,5))) {
    throw new Error('Invalid Orientation start time.');
  }
  if (updates['End Time'] && !/^\d{2}:\d{2}$/.test(String(updates['End Time']).slice(0,5))) {
    throw new Error('Invalid Orientation end time.');
  }

  const scheduleChanged =
    (has('sessionDate') && String(updates['Session Date']) !== String(old['Session Date'] || '')) ||
    (has('startTime') && String(updates['Start Time']) !== String(old['Start Time'] || '')) ||
    (has('endTime') && String(updates['End Time']) !== String(old['End Time'] || ''));

  const preview = Object.assign({}, old, updates);
  const currentStatus = String(old['Status'] || 'SCHEDULED').trim().toUpperCase();
  const newEnd = v2OrientationSessionEnd_(preview);
  let reopened = false;

  if (scheduleChanged && currentStatus === 'ENDED' && newEnd && newEnd.getTime() > Date.now()) {
    updates['Status'] = 'SCHEDULED';
    reopened = true;
  } else if (scheduleChanged && ['SCHEDULED','OPEN','ACTIVE'].indexOf(currentStatus) >= 0 &&
             newEnd && newEnd.getTime() <= Date.now()) {
    updates['Status'] = 'ENDED';
  }

  const now = new Date().toISOString();
  updates['Updated At'] = now;
  v2UpdateRow_(session.sheet,session.rowNumber,updates);

  const next = Object.assign({}, old, updates);
  v2Audit_('', 'ORIENTATION', 'EDIT_SESSION', old, next, actor || 'Admin Portal V2', 'SUCCESS',
    reopened
      ? 'Orientation schedule corrected and session reopened automatically because the revised end time is in the future.'
      : 'Orientation session details edited. Session ID remains unchanged.');

  if (reopened || ['SCHEDULED','OPEN','ACTIVE'].indexOf(String(next['Status'] || '').toUpperCase()) >= 0) {
    v2OrientationEnsureReminderTrigger_();
  }
  v2InvalidateCache_();

  return {
    ok:true,
    sessionId:sessionId,
    status:String(next['Status'] || currentStatus),
    reopened:reopened,
    scheduleChanged:scheduleChanged,
    session:next,
    build:V2_ORIENTATION_BUILD
  };
}

function v2OrientationCalendarDaysUntil_(session, now) {
  const tz = CONFIG.timezone || Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur';
  const start = v2OrientationSessionStart_(session);
  if (!start) return 9999;
  const today = Utilities.formatDate(now || new Date(), tz, 'yyyy-MM-dd').split('-').map(Number);
  const target = Utilities.formatDate(start, tz, 'yyyy-MM-dd').split('-').map(Number);
  return Math.round((Date.UTC(target[0],target[1]-1,target[2]) - Date.UTC(today[0],today[1]-1,today[2])) / 86400000);
}

function v2OrientationDueMilestone_(session, now) {
  const current = now || new Date();
  const start = v2OrientationSessionStart_(session);
  if (!start) return '';
  const msUntil = start.getTime() - current.getTime();
  if (msUntil <= 0) return '';

  // Highest-priority reminder: within the final hour.
  if (msUntil <= 60 * 60 * 1000) return 'H1';

  // Daily reminders are sent from 8:00 AM local time on the 3rd, 2nd and 1st
  // calendar day before the session. An hourly/15-minute sweep means a student
  // assigned later that day still receives the relevant reminder on the next run.
  const tz = CONFIG.timezone || Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur';
  const daysUntil = v2OrientationCalendarDaysUntil_(session, current);
  const hour = Number(Utilities.formatDate(current, tz, 'H'));
  if (hour < 8) return '';
  if (daysUntil === 3) return 'D3';
  if (daysUntil === 2) return 'D2';
  if (daysUntil === 1) return 'D1';
  return '';
}

function v2OrientationReminderMilestoneLabel_(milestone) {
  const labels = {
    D3:'3 days before',
    D2:'2 days before',
    D1:'1 day before',
    H1:'1 hour before',
    MANUAL:'Manual reminder'
  };
  return labels[String(milestone || '').toUpperCase()] || 'Orientation reminder';
}

function v2OrientationReminderSweep() {
  assertDevIdentity_();
  v2OrientationEnsureHeaders_();

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return {ok:true,skipped:true,reason:'REMINDER_SWEEP_ALREADY_RUNNING'};

  try {
    const sessions = v2Rows_('V2_ORIENTATION_SESSIONS');
    const results = [];
    const now = new Date();

    sessions.forEach(function(session) {
      const status = String(session['Status'] || '').toUpperCase();
      if (['SCHEDULED','OPEN','ACTIVE'].indexOf(status) < 0) return;

      if (v2OrientationSessionHasEnded_(session, now)) {
        const current = v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',session['Orientation Session ID']);
        if (current) v2OrientationMarkEndedIfPast_(current, 'Orientation Reminder Automation');
        return;
      }

      const milestone = v2OrientationDueMilestone_(session, now);
      if (!milestone) return;
      results.push(v2OrientationReminderForSession_(
        session['Orientation Session ID'],
        false,
        'Orientation Reminder Automation',
        milestone
      ));
    });

    const sentTotal = results.reduce(function(n,x){return n+Number(x.sentCount||0);},0);
    if (results.length || sentTotal) {
      v2Audit_('','ORIENTATION','REMINDER_SWEEP',{},{
        sessionsChecked:sessions.length,
        sessionsTriggered:results.length,
        sent:sentTotal,
        milestones:results.map(function(x){return x.milestone || '';})
      },'Orientation Reminder Automation','SUCCESS','Milestone reminder sweep.');
      v2InvalidateCache_();
    }
    return {ok:true,build:V2_ORIENTATION_BUILD,results:results};
  } finally {
    lock.releaseLock();
  }
}

function v2OrientationReminderForSession_(sessionId, force, actor, milestone) {
  const session = v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
  if (!session) throw new Error('Orientation session not found.');
  if (v2OrientationMarkEndedIfPast_(session, actor || 'Orientation Reminder Automation') ||
      ['ENDED','CANCELLED','CLOSED'].indexOf(String(session.record['Status'] || '').toUpperCase()) >= 0) {
    if (force) throw new Error('Orientation session has ended. Reminder sending is disabled.');
    return {sessionId:sessionId,milestone:'',sentCount:0,skippedCount:0,failedCount:0,status:'ENDED'};
  }

  const resolvedMilestone = String(milestone || (force ? 'MANUAL' : v2OrientationDueMilestone_(session.record, new Date()))).toUpperCase();
  if (!force && !resolvedMilestone) {
    return {sessionId:sessionId,milestone:'',sentCount:0,skippedCount:0,failedCount:0};
  }

  const trackingRows = v2Rows_('V2_ORIENTATION_TRACKING').filter(function(row){
    return String(row['Orientation Session ID'] || '') === sessionId;
  });

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  trackingRows.forEach(function(row) {
    const history = v2OrientationReminderHistory_(row);
    if (!force && history[resolvedMilestone]) { skippedCount += 1; return; }
    if (!force && String(row['Invitation Status'] || '').toUpperCase() !== 'SENT') { skippedCount += 1; return; }

    try {
      const delivery = v2OrientationSendStudentEmail_(session.record, row, 'REMINDER', resolvedMilestone);
      const current = v2FindComposite_(
        'V2_ORIENTATION_TRACKING',
        ['Orientation Session ID','Reference No'],
        [sessionId,row['Reference No']]
      );
      const nowIso = new Date().toISOString();

      if (delivery.sent) {
        if (force) {
          if (!Array.isArray(history.MANUAL)) history.MANUAL = [];
          history.MANUAL.push(nowIso);
        } else {
          history[resolvedMilestone] = nowIso;
        }
      }

      if (current) {
        v2UpdateRow_(current.sheet,current.rowNumber,{
          'Reminder Status':delivery.sent ? 'SENT' : (delivery.status === 'DISABLED' ? 'DISABLED' : 'FAILED'),
          'Reminder Sent At':delivery.sent ? nowIso : String(current.record['Reminder Sent At'] || ''),
          'Reminder History JSON':JSON.stringify(history),
          'Last Reminder Milestone':delivery.sent ? resolvedMilestone : String(current.record['Last Reminder Milestone'] || ''),
          'Last Updated':nowIso
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
    milestone:resolvedMilestone,
    milestoneLabel:v2OrientationReminderMilestoneLabel_(resolvedMilestone),
    sentCount:sentCount,
    skippedCount:skippedCount,
    failedCount:failedCount
  },actor || 'Orientation Reminder Automation','SUCCESS','');

  return {
    sessionId:sessionId,
    milestone:resolvedMilestone,
    milestoneLabel:v2OrientationReminderMilestoneLabel_(resolvedMilestone),
    sentCount:sentCount,
    skippedCount:skippedCount,
    failedCount:failedCount
  };
}

function v2OrientationSendStudentEmail_(session, tracking, type, milestone) {
  const recipient = String(tracking['Student Email'] || '').trim();
  const student = String(tracking['Student Name'] || 'Student').trim();
  const name = String(session['Orientation Name'] || 'Postgraduate Orientation Session').trim();
  const date = v2OrientationDisplayDate_(session['Session Date']);
  const start = v2OrientationDisplayTime_(session['Start Time']);
  const end = v2OrientationDisplayTime_(session['End Time']);
  const mode = String(session['Mode'] || 'ONLINE').trim().toUpperCase();
  const venue = String(session['Venue'] || '').trim();
  const meetingLink = String(session['Meeting Link'] || '').trim();
  const isReminder = type === 'REMINDER';
  const reminderLabel = isReminder ? v2OrientationReminderMilestoneLabel_(milestone) : '';

  const subject = isReminder
    ? '[IUC IPGS] Orientation Reminder - ' + reminderLabel + ' - ' + date
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
      ? '<strong>' + v2Html_(reminderLabel) + ':</strong> Your postgraduate orientation is coming up. Please keep the session details below ready.'
      : 'You have been scheduled for the postgraduate orientation session below.') + '</p>' +
    '<div style="background:#faf8ff;border:1px solid #e5def6;border-radius:14px;padding:18px">' +
    '<strong>Session:</strong> ' + v2Html_(name) + '<br>' +
    '<strong>Date:</strong> ' + v2Html_(date) + '<br>' +
    '<strong>Time:</strong> ' + v2Html_([start,end].filter(Boolean).join(' - ')) + '<br>' +
    '<strong>Mode:</strong> ' + v2Html_(v2OrientationPretty_(mode)) +
    '</div>' + access +
    '<p>Please keep this email for your reference. If you are unable to attend, contact the Registry Office.</p>' +
    '<p>Regards,<br><strong>IPGS Registry</strong><br>Innovative University College</p></div></div>';

  const textBody = (isReminder ? 'Orientation reminder - ' + reminderLabel : 'Orientation invitation') +
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
    'Reminder Count':rows.reduce(function(total,row){
      const history = v2OrientationReminderHistory_(row);
      let count = ['D3','D2','D1','H1'].filter(function(key){return !!history[key];}).length;
      if (Array.isArray(history.MANUAL)) count += history.MANUAL.length;
      if (!count && String(row['Reminder Status'] || '').toUpperCase()==='SENT') count = 1;
      return total + count;
    },0),
    'Updated At':new Date().toISOString()
  };
  v2UpdateRow_(session.sheet,session.rowNumber,patch);
  return patch;
}

function v2OrientationEnsureReminderTrigger_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const configuredVersion = String(props.getProperty('V2_ORIENTATION_TRIGGER_VERSION') || '');
    const triggers = ScriptApp.getProjectTriggers();
    const existing = triggers.filter(function(trigger){
      return trigger.getHandlerFunction() === V2_ORIENTATION_REMINDER_HANDLER;
    });

    if (existing.length && configuredVersion === V2_ORIENTATION_TRIGGER_VERSION) {
      return {
        ok:true,
        status:'ACTIVE',
        created:false,
        count:existing.length,
        frequency:'EVERY_15_MINUTES',
        schedule:'D3_D2_D1_H1'
      };
    }

    // Migrate any legacy daily reminder trigger to the milestone scheduler.
    existing.forEach(function(trigger) {
      try { ScriptApp.deleteTrigger(trigger); } catch (_) {}
    });

    ScriptApp.newTrigger(V2_ORIENTATION_REMINDER_HANDLER)
      .timeBased()
      .everyMinutes(15)
      .create();

    props.setProperty('V2_ORIENTATION_TRIGGER_VERSION', V2_ORIENTATION_TRIGGER_VERSION);
    return {
      ok:true,
      status:'ACTIVE',
      created:true,
      count:1,
      frequency:'EVERY_15_MINUTES',
      schedule:'D3_D2_D1_H1'
    };
  } catch (error) {
    Logger.log('Orientation reminder trigger setup failed: ' + String(error && error.message || error));
    return {
      ok:false,
      status:'TRIGGER_SETUP_FAILED',
      created:false,
      error:String(error && error.message || error),
      frequency:'NOT_ACTIVE',
      schedule:'D3_D2_D1_H1'
    };
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
  if (!dateValue) return '';
  const timezone = CONFIG.timezone || 'Asia/Kuala_Lumpur';

  if (Object.prototype.toString.call(dateValue) === '[object Date]' && !isNaN(dateValue.getTime())) {
    return Utilities.formatDate(dateValue, timezone, 'dd MMMM yyyy');
  }

  const text = String(dateValue || '').trim();
  if (!text) return '';

  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return Utilities.formatDate(
      new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12, 0, 0),
      timezone,
      'dd MMMM yyyy'
    );
  }

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, timezone, 'dd MMMM yyyy');
  }

  return text;
}

function v2OrientationDisplayTime_(timeValue) {
  if (timeValue === null || timeValue === undefined || timeValue === '') return '';
  const timezone = CONFIG.timezone || 'Asia/Kuala_Lumpur';

  if (Object.prototype.toString.call(timeValue) === '[object Date]' && !isNaN(timeValue.getTime())) {
    return Utilities.formatDate(timeValue, timezone, 'h:mm a');
  }

  const text = String(timeValue || '').trim();
  if (!text) return '';

  const hhmm = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (hhmm) {
    const hour = Number(hhmm[1]);
    const minute = Number(hhmm[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      const d = new Date(2000, 0, 1, hour, minute, 0);
      return Utilities.formatDate(d, timezone, 'h:mm a');
    }
  }

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, timezone, 'h:mm a');
  }

  return text;
}

function v2OrientationPretty_(value) {
  return String(value || '').toLowerCase().replace(/\b\w/g,function(m){return m.toUpperCase();});
}


/**
 * Controlled Stage 4 UAT.
 * Creates an isolated synthetic accepted applicant using the executing admin account,
 * then exercises the real Orientation flow end-to-end:
 * create session -> assign -> invitation send -> attendance -> Academic Handover READY.
 * The UAT session is closed immediately after the test so reminder automation will not
 * send future reminders for this synthetic record.
 */
function v2RunStage4Uat() {
  assertDevIdentity_();
  v2OrientationEnsureHeaders_();

  const actor = 'Stage 4 Automated UAT';
  const now = new Date();
  const stamp = Utilities.formatDate(now, Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyyMMdd-HHmmss');
  const email = String(Session.getEffectiveUser().getEmail() || '').trim();
  if (!email || email.indexOf('@') < 1) throw new Error('Stage 4 UAT could not resolve the executing admin email.');

  const reference = 'V2-ORI-UAT-' + stamp;
  const sessionId = 'ORI-UAT-' + stamp;
  const studentName = 'V2 ORIENTATION UAT ' + stamp;
  const sessionDate = Utilities.formatDate(new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)), Session.getScriptTimeZone() || 'Asia/Kuala_Lumpur', 'yyyy-MM-dd');
  const iso = now.toISOString();

  v2Upsert_('V2_APPLICATIONS', 'Reference No', reference, {
    'Reference No': reference,
    'Submitted At': iso,
    'Applicant Type': 'LOCAL',
    'Student Name': studentName,
    'ID / Passport No': 'UAT-' + stamp,
    'Personal Email': email,
    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Study Mode': 'ONLINE',
    'Intake': 'September 2026',
    'Intake ID': '2026-September',
    'Entry Qualification Type': 'BACHELOR',
    'Application Status': 'TEST',
    'Email Status': 'UAT',
    'Last Updated': iso,
    'Version': V2_BUILD
  });

  v2Upsert_('V2_WORKFLOW', 'Reference No', reference, {
    'Reference No': reference,
    'Student Name': studentName,
    'ID / Passport No': 'UAT-' + stamp,
    'Personal Email': email,
    'Programme': 'MBA - Master of Business Administration',
    'Level of Study': 'Master',
    'Intake': 'September 2026',
    'Application Stage': 'ACCEPTED',
    'Application Status': 'TEST',
    'Assessment Status': 'NOT_REQUIRED',
    'Prerequisite Status': 'NOT_REQUIRED',
    'Offer Letter Status': 'ISSUED',
    'Acceptance Status': 'ACCEPTED',
    'Orientation Status': 'NOT_ASSIGNED',
    'Provisioning Status': 'NOT_STARTED',
    'Academic Handover Status': 'NOT_READY',
    'Last Updated': iso,
    'Updated By': actor,
    'Version': V2_BUILD
  });

  const created = v2CreateOrientationSession_({
    sessionId: sessionId,
    name: 'Stage 4 UAT - ' + stamp,
    intakeId: '2026-September',
    programmeGroup: 'UAT',
    sessionDate: sessionDate,
    startTime: '08:30',
    endTime: '10:30',
    mode: 'ONLINE',
    reminderDays: 1,
    status: 'SCHEDULED'
  }, actor);

  if (!created || !created.ok) throw new Error('Stage 4 UAT failed to create the orientation session.');
  if (!created.reminderAutomation || created.reminderAutomation.status !== 'ACTIVE') {
    throw new Error('Stage 4 UAT reminder automation is not ACTIVE.');
  }

  const assigned = v2AssignOrientationBatch_({
    sessionId: sessionId,
    referenceNos: [reference]
  }, actor);

  if (!assigned || assigned.assignedCount !== 1) {
    throw new Error('Stage 4 UAT failed student assignment.');
  }
  if (assigned.invitationSentCount !== 1) {
    throw new Error('Stage 4 UAT invitation email was not sent.');
  }

  const attendance = v2UpdateOrientationAttendance_({
    sessionId: sessionId,
    referenceNo: reference,
    attendanceStatus: 'ATTENDED'
  }, actor);

  if (!attendance || attendance.attendanceStatus !== 'ATTENDED' || attendance.academicHandoverStatus !== 'READY') {
    throw new Error('Stage 4 UAT attendance / Academic Handover readiness gate failed.');
  }

  const session = v2Find_('V2_ORIENTATION_SESSIONS', 'Orientation Session ID', sessionId);
  if (session) {
    v2UpdateRow_(session.sheet, session.rowNumber, {
      'Status': 'UAT_COMPLETE',
      'Updated At': new Date().toISOString()
    });
  }

  const tracking = v2FindComposite_(
    'V2_ORIENTATION_TRACKING',
    ['Orientation Session ID', 'Reference No'],
    [sessionId, reference]
  );
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  if (!tracking || String(tracking.record['Invitation Status'] || '').toUpperCase() !== 'SENT') {
    throw new Error('Stage 4 UAT tracking did not persist Invitation Status = SENT.');
  }
  if (String(tracking.record['Attendance Status'] || '').toUpperCase() !== 'ATTENDED') {
    throw new Error('Stage 4 UAT tracking did not persist Attendance Status = ATTENDED.');
  }
  if (!workflow || String(workflow.record['Academic Handover Status'] || '').toUpperCase() !== 'READY') {
    throw new Error('Stage 4 UAT workflow did not persist Academic Handover Status = READY.');
  }

  v2Audit_(reference, 'ORIENTATION', 'STAGE4_UAT_PASS', {}, {
    sessionId: sessionId,
    invitationStatus: 'SENT',
    attendanceStatus: 'ATTENDED',
    academicHandoverStatus: 'READY',
    reminderAutomation: 'ACTIVE'
  }, actor, 'SUCCESS', 'Controlled Stage 4 end-to-end UAT passed.');

  v2InvalidateCache_();
  return {
    ok: true,
    stage: 4,
    uat: 'PASS',
    referenceNo: reference,
    sessionId: sessionId,
    reminderAutomation: 'ACTIVE',
    invitationStatus: 'SENT',
    attendanceStatus: 'ATTENDED',
    academicHandoverStatus: 'READY',
    sessionStatus: 'UAT_COMPLETE',
    build: V2_ORIENTATION_BUILD
  };
}
