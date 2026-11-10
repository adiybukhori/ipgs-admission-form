/**
 * IPGS Orientation HTML email sender — Apps Script integration helper.
 *
 * This source is intentionally not live by itself. The existing Apps Script
 * action dispatcher for v2SendOrientationInvitation must call
 * ipgsSendOrientationHtml_(trackingRow, sessionRow) in place of its current
 * email-sending call, retaining existing authorization, invitations sent
 * flags, audit, retries, and reminders.
 *
 * NEVER call both old and new send functions for the same student.
 *
 * Both arguments are existing ACC row objects indexed by sheet headers.
 */
const IPGS_ORIENTATION_EMAIL_TEMPLATE_URL_ =
  'https://ipgs-admission-form.innovative.edu.my/templates/orientation-invitation.html';
const IPGS_ORIENTATION_EMAIL_REPLY_TO_ = 'ipgs.admission@innovative.edu.my';

function ipgsOrientationEmailEscape_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function(c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function ipgsOrientationDisplayTime_(value) {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) throw new Error('Orientation time is invalid.');
  const hour = Number(m[1]);
  if (hour > 23) throw new Error('Orientation hour is invalid.');
  return String(hour % 12 || 12) + ':' + m[2] + (hour >= 12 ? ' PM' : ' AM');
}

function ipgsOrientationEmailData_(trackingRow, sessionRow) {
  const to = String(trackingRow['Student Email'] || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new Error('Student email is missing/invalid.');
  const status = String(trackingRow['Assignment Status'] || 'ACTIVE').trim().toUpperCase();
  if (status !== 'ACTIVE') throw new Error('Cannot invite inactive orientation assignment.');
  if (String(trackingRow['Invitation Status'] || 'NOT_SENT').toUpperCase() === 'SENT') {
    throw new Error('Invitation already sent. Do not send twice.');
  }
  const sessionStatus = String(sessionRow['Status'] || '').toUpperCase().trim();
  if (sessionStatus !== 'SCHEDULED') throw new Error('Orientation session must be SCHEDULED.');
  const link = String(sessionRow['Meeting Link'] || '').trim();
  if (!/^https:\/\/meet\.google\.com\/[a-z0-9-]+(?:[/?#].*)?$/i.test(link)) {
    throw new Error('Valid Google Meet link is required before sending invitation.');
  }
  const sessionDate = String(sessionRow['Session Date'] || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) throw new Error('Orientation date must use YYYY-MM-DD.');
  const date = new Date(sessionDate + 'T12:00:00+08:00');
  if (isNaN(date.getTime())) throw new Error('Invalid orientation date.');
  const name = String(trackingRow['Student Name'] || '').trim();
  if (!name) throw new Error('Student name is missing.');
  const sessionName = String(sessionRow['Orientation Name'] || 'Postgraduate Orientation').trim();
  const displayDate = Utilities.formatDate(date,'Asia/Kuala_Lumpur','EEEE, d MMMM yyyy');
  const displayTime = ipgsOrientationDisplayTime_(sessionRow['Start Time']) + ' – ' +
    ipgsOrientationDisplayTime_(sessionRow['End Time']);
  const programme = String(trackingRow['Programme'] || sessionRow['Programme Group'] || 'Postgraduate').trim();
  return {to,name,sessionName,sessionDate:displayDate,displayTime,programme,link};
}

function ipgsBuildOrientationEmail_(trackingRow, sessionRow) {
  const data = ipgsOrientationEmailData_(trackingRow,sessionRow);
  const response = UrlFetchApp.fetch(IPGS_ORIENTATION_EMAIL_TEMPLATE_URL_, {
    method:'get',muteHttpExceptions:true,followRedirects:true
  });
  if (response.getResponseCode() !== 200) throw new Error(
    'Orientation email HTML template unavailable: HTTP '+response.getResponseCode());
  const template = response.getContentText();
  if (!template.includes('{{STUDENT_NAME}}') || !template.includes('{{MEETING_LINK}}')) {
    throw new Error('Orientation HTML template missing placeholders.');
  }
  const fields = {
    STUDENT_NAME:data.name,
    SESSION_NAME:data.sessionName,
    SESSION_DATE:data.sessionDate,
    SESSION_TIME:data.displayTime,
    PROGRAMME:data.programme,
    MEETING_LINK:data.link
  };
  const htmlBody = template.replace(/{{(STUDENT_NAME|SESSION_NAME|SESSION_DATE|SESSION_TIME|PROGRAMME|MEETING_LINK)}}/g,
    function(_,key){return ipgsOrientationEmailEscape_(fields[key]);});
  if (/{{[A-Z_]+}}/.test(htmlBody)) throw new Error('Orientation HTML contains an unresolved placeholder.');
  const subject = '[IUC IPGS] Orientation Invitation – ' + data.sessionName;
  const body = [
    'Dear ' + data.name + ',',
    '',
    'You are invited to ' + data.sessionName + '.',
    'Date: ' + data.sessionDate,
    'Time: ' + data.displayTime + ' (Malaysia Time)',
    'Programme: ' + data.programme,
    'Mode: Online via Google Meet',
    'Join: ' + data.link,
    '',
    'Regards,',
    'IPGS Registry',
    'Innovative University College'
  ].join('\n');
  return {to:data.to,subject,htmlBody,body};
}

function ipgsSendOrientationHtml_(trackingRow,sessionRow) {
  const message = ipgsBuildOrientationEmail_(trackingRow,sessionRow);
  // Call this once, within the authorized existing v2SendOrientationInvitation
  // per-student send loop. On success, let the existing code mark SENT and log
  // its audit record. On error, do not mark SENT.
  GmailApp.sendEmail(message.to,message.subject,message.body,{
    htmlBody:message.htmlBody,
    name:'IPGS Registry | Innovative University College',
    replyTo:IPGS_ORIENTATION_EMAIL_REPLY_TO_
  });
  return {sent:true,to:message.to,subject:message.subject};
}
