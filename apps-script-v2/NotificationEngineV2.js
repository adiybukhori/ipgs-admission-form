/**
 * Admission V2 - Central Notification Engine
 *
 * One notification mode controls all Admission V2 operational email:
 * NEW_APPLICATION_STUDENT, NEW_APPLICATION_ADMIN, AGENT_NEW_APPLICATION,
 * OFFER_ISSUED and ACCEPTANCE_COMPLETED.
 *
 * Production default is LIVE. Set Script Property V2_NOTIFICATION_MODE to
 * TEST or DISABLED when required. TEST routes all messages to the configured
 * test inbox and never to the intended recipient.
 */

const V2_NOTIFICATION_BUILD = 'V2_NOTIFICATION_ENGINE_20260917';

function v2NotificationMode_() {
  const props = PropertiesService.getScriptProperties();
  const explicit = String(props.getProperty('V2_NOTIFICATION_MODE') || '').trim().toUpperCase();
  if (['LIVE', 'TEST', 'DISABLED'].indexOf(explicit) >= 0) return explicit;

  // Preserve controlled tests that temporarily set the old admission mode to TEST,
  // but do not inherit legacy DISABLED flags that previously blocked production mail.
  const legacyAdmission = String(props.getProperty('V2_EMAIL_MODE') || '').trim().toUpperCase();
  if (legacyAdmission === 'TEST') return 'TEST';
  return 'LIVE';
}

function v2NotificationTestRecipient_() {
  const props = PropertiesService.getScriptProperties();
  return String(
    props.getProperty('V2_NOTIFICATION_TEST_EMAIL') ||
    props.getProperty('V2_TEST_EMAIL') ||
    'adiybukhori@innovative.edu.my'
  ).trim();
}

function v2NotificationAdminRecipients_() {
  const props = PropertiesService.getScriptProperties();
  const configured = String(props.getProperty('V2_ADMIN_NOTIFICATION_EMAILS') || '').trim();
  let values = [];
  if (configured) values = configured.split(/[;,]/);
  if (!values.length && CONFIG && Array.isArray(CONFIG.notificationEmails)) {
    values = CONFIG.notificationEmails.slice();
  }

  // Core observers always receive the new-application Registry notification
  // in addition to the assigned Academic Consultant / Marketing agent.
  values = values.concat([
    'adiybukhori@innovative.edu.my',
    'abu.huzaifah@innovative.edu.my'
  ]);

  return v2NotificationUniqueEmails_(values);
}

function v2NotificationUniqueEmails_(values) {
  const out = [];
  (values || []).forEach(function(value) {
    const email = String(value || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (out.indexOf(email) === -1) out.push(email);
  });
  return out;
}

function v2NotificationSend_(eventName, intendedRecipients, subject, textBody, htmlBody, options) {
  const opts = options || {};
  const override = String(opts.modeOverride || '').trim().toUpperCase();
  const mode = ['LIVE', 'TEST', 'DISABLED'].indexOf(override) >= 0 ? override : v2NotificationMode_();
  if (mode === 'DISABLED') {
    return {sent:false, status:'DISABLED', mode:mode, event:eventName, recipients:[]};
  }

  let recipients = v2NotificationUniqueEmails_(intendedRecipients || []);
  if (mode === 'TEST') recipients = v2NotificationUniqueEmails_([v2NotificationTestRecipient_()]);
  if (!recipients.length) {
    return {sent:false, status:'SKIPPED_NO_RECIPIENT', mode:mode, event:eventName, recipients:[]};
  }

  const mailOptions = {
    htmlBody: String(htmlBody || ''),
    name: String(opts.senderName || 'IUC IPGS Admission')
  };
  if (opts.attachments && opts.attachments.length) mailOptions.attachments = opts.attachments;
  if (opts.inlineImages) mailOptions.inlineImages = opts.inlineImages;

  const requestedFrom = String(opts.fromAlias || '').trim().toLowerCase();
  let senderAliasApplied = false;
  let effectiveSender = '';
  if (requestedFrom) {
    try {
      const effectiveUser = String(Session.getEffectiveUser().getEmail() || '').trim().toLowerCase();
      const aliases = GmailApp.getAliases().map(function(value){ return String(value || '').trim().toLowerCase(); });
      if (effectiveUser === requestedFrom) {
        // Primary mailbox already is the requested admission sender.
        senderAliasApplied = true;
        effectiveSender = requestedFrom;
      } else if (aliases.indexOf(requestedFrom) >= 0) {
        mailOptions.from = requestedFrom;
        senderAliasApplied = true;
        effectiveSender = requestedFrom;
      } else {
        // Keep delivery operational while making replies route to the official mailbox.
        // Once the alias is authorised on the Apps Script execution account, GmailApp
        // will automatically use it as the actual From address.
        mailOptions.replyTo = requestedFrom;
        effectiveSender = effectiveUser;
        Logger.log('Requested V2 notification From alias is not authorised for this Apps Script user: ' + requestedFrom);
      }
    } catch (senderError) {
      mailOptions.replyTo = requestedFrom;
      Logger.log('Unable to inspect Gmail aliases for V2 notification sender: ' + String(senderError && senderError.message || senderError));
    }
  }
  if (opts.replyTo) mailOptions.replyTo = String(opts.replyTo);

  recipients.forEach(function(to) {
    GmailApp.sendEmail(to, String(subject || 'IUC IPGS Admission'), String(textBody || ''), mailOptions);
  });

  return {
    sent:true,
    status:mode + '_SENT_' + recipients.length,
    mode:mode,
    event:eventName,
    recipients:recipients,
    requestedFrom:requestedFrom,
    senderAliasApplied:senderAliasApplied,
    effectiveSender:effectiveSender
  };
}

function v2NotificationEnsureHeaders_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const applications = ss.getSheetByName('V2_APPLICATIONS');
  const workflow = ss.getSheetByName('V2_WORKFLOW');
  if (applications) v2OfferEnsureHeaders_(applications, [
    'Application Student Email Status','Application Student Email Sent At',
    'Application Admin Email Status','Application Admin Email Sent At',
    'Agent Notification Status','Agent Notification Sent At'
  ]);
  if (workflow) v2OfferEnsureHeaders_(workflow, [
    'Offer Email Status','Offer Email Sent At',
    'Acceptance Confirmation Email Status','Acceptance Confirmation Email Sent At'
  ]);
}

function v2NotificationUpdateApplication_(referenceNo, values) {
  const row = v2Find_('V2_APPLICATIONS', 'Reference No', String(referenceNo || '').trim());
  if (row) v2UpdateRow_(row.sheet, row.rowNumber, values || {});
}

function v2NotificationUpdateWorkflow_(referenceNo, values) {
  const row = v2Find_('V2_WORKFLOW', 'Reference No', String(referenceNo || '').trim());
  if (row) v2UpdateRow_(row.sheet, row.rowNumber, values || {});
}

function v2AdmissionEmailHeaderHtml_() {
  return '<div style="background:#ffffff;border-bottom:5px solid #39206f;overflow:hidden">' +
    '<img src="cid:ipgsHeader" alt="Innovative University College · Institute of Postgraduate Studies" style="display:block;width:100%;height:auto;border:0">' +
    '</div>';
}

function v2SendApplicationNotifications_(payload, reference, intake, pdf, col) {
  v2NotificationEnsureHeaders_();
  const now = new Date().toISOString();
  const student = String(payload.fullName || 'Applicant').trim();
  const programme = String(payload.programme || '').trim();
  const intakeName = String(intake && intake.name || payload.intake || '').trim();
  const admissionAttachment = pdf && pdf.blob ? [pdf.blob] : [];
  const studentAttachments = [];
  if (col && col.blob) studentAttachments.push(col.blob);
  if (pdf && pdf.blob) studentAttachments.push(pdf.blob);

  const applicationRow = v2Find_('V2_APPLICATIONS','Reference No',reference);
  const researchIntentStatus = applicationRow ? String(applicationRow.record['Research Intent Status'] || '') : '';
  const researchIntentUrl = applicationRow ? String(applicationRow.record['Research Intent Upload URL'] || '') : '';
  const researchIntentPending = researchIntentStatus === 'PENDING' && !!researchIntentUrl;

  const supplementaryBlock = researchIntentPending
    ? '<div style="margin:26px 0 0;padding:12px 14px;background:#fffaf0;border:1px solid #eddcae;border-radius:10px;color:#715728;font-size:12px;line-height:1.55">' +
        '<strong style="display:block;margin-bottom:4px">One additional item for your file</strong>' +
        'For your PhD application, the Preliminary Research Intent (2–3 pages) is still outstanding. This does not affect issuance of your COL, but it will be required for the later academic review process.' +
        '<div style="margin-top:9px"><a href="'+v2Html_(researchIntentUrl)+'" style="color:#39206f;font-weight:700;text-decoration:none">Upload Research Intent →</a></div>' +
      '</div>'
    : '<div style="margin:26px 0 0;padding-top:12px;border-top:1px solid #ececf0;color:#7a7d89;font-size:11px;line-height:1.55">If any additional supporting document or academic information is required during the review, the IPGS Admission Team will contact you separately.</div>';

  const studentSubject = 'Congratulations, ' + student + '! Welcome to IUC IPGS — Your Conditional Offer Letter';
  const studentText =
    'Dear ' + student + ',\n\n' +
    'Congratulations and welcome to Innovative University College. We are delighted to receive your application for ' + programme + '.\n\n' +
    'Your Conditional Offer Letter and a copy of your submitted Admission Form are attached to this email.\n\n' +
    'Reference: ' + reference + '\nProgramme: ' + programme + '\nIntake: ' + intakeName + '\n\n' +
    'Your application will continue through the formal verification and academic admission process. The final Official Offer Letter / Letter of Admission will be issued after the applicable admission requirements are completed and approved.\n\n' +
    'Warm regards,\nIPGS Admission Team\nInnovative University College';

  const studentHtml =
    '<div style="margin:0;padding:0;background:#f3f4f8;font-family:Arial,Helvetica,sans-serif;color:#252637">' +
      '<div style="max-width:760px;margin:0 auto;padding:28px 12px">' +
        '<div style="background:#fff;border:1px solid #e5e6eb;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(45,35,99,.08)">' +
          v2AdmissionEmailHeaderHtml_() +
          '<div style="padding:34px 34px 30px">' +
            '<div style="font-size:12px;font-weight:800;letter-spacing:.11em;color:#9a7622;text-transform:uppercase">Your postgraduate journey starts here</div>' +
            '<h1 style="margin:9px 0 7px;color:#2d1d68;font-size:29px;line-height:1.2">Congratulations, '+v2Html_(student)+'!</h1>' +
            '<p style="margin:0 0 22px;color:#6a6f7f;font-size:15px;line-height:1.65">We are delighted to welcome your application to <strong style="color:#2d1d68">Innovative University College</strong> and the <strong style="color:#2d1d68">Institute of Postgraduate Studies (IPGS)</strong>.</p>' +

            '<div style="margin:22px 0;padding:21px 22px;background:linear-gradient(135deg,#34206f,#5c3ea5);border-radius:15px;color:#fff">' +
              '<div style="font-size:11px;letter-spacing:.1em;font-weight:800;color:#eadb9d;text-transform:uppercase">Conditional Offer Issued</div>' +
              '<div style="font-size:18px;line-height:1.4;font-weight:700;margin-top:6px">We are pleased to issue your Conditional Offer Letter for '+v2Html_(programme)+'.</div>' +
              '<div style="margin-top:12px;font-size:12px;line-height:1.55;color:#e9e5f7">Your COL confirms your conditional admission status while our formal verification and academic admission process continues.</div>' +
            '</div>' +

            '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:0;margin:22px 0;border:1px solid #e7e6ec;border-radius:12px;overflow:hidden">' +
              '<tr><td style="width:30%;padding:11px 13px;background:#f8f6fd;color:#6d6289;font-size:12px;font-weight:700;border-bottom:1px solid #eceaf1">Reference No.</td><td style="padding:11px 13px;font-size:13px;font-weight:700;border-bottom:1px solid #eceaf1">'+v2Html_(reference)+'</td></tr>' +
              '<tr><td style="padding:11px 13px;background:#f8f6fd;color:#6d6289;font-size:12px;font-weight:700;border-bottom:1px solid #eceaf1">Programme</td><td style="padding:11px 13px;font-size:13px;font-weight:700;border-bottom:1px solid #eceaf1">'+v2Html_(programme)+'</td></tr>' +
              '<tr><td style="padding:11px 13px;background:#f8f6fd;color:#6d6289;font-size:12px;font-weight:700">Intake</td><td style="padding:11px 13px;font-size:13px;font-weight:700">'+v2Html_(intakeName)+'</td></tr>' +
            '</table>' +

            '<div style="margin:24px 0 10px;font-size:16px;font-weight:800;color:#2d1d68">What happens next?</div>' +
            '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse"><tr>' +
              '<td style="width:33.33%;padding:8px 8px 8px 0;vertical-align:top"><div style="height:100%;padding:13px;border:1px solid #e7e6ec;border-radius:11px"><div style="font-size:11px;font-weight:800;color:#9a7622">01 · VERIFICATION</div><div style="margin-top:5px;font-size:12px;line-height:1.5;color:#555b6b">Registry reviews your submitted information and documents.</div></div></td>' +
              '<td style="width:33.33%;padding:8px 4px;vertical-align:top"><div style="height:100%;padding:13px;border:1px solid #e7e6ec;border-radius:11px"><div style="font-size:11px;font-weight:800;color:#9a7622">02 · ACADEMIC PROCESS</div><div style="margin-top:5px;font-size:12px;line-height:1.5;color:#555b6b">SAC, IA or prerequisite requirements are managed only when applicable.</div></div></td>' +
              '<td style="width:33.33%;padding:8px 0 8px 8px;vertical-align:top"><div style="height:100%;padding:13px;border:1px solid #e7e6ec;border-radius:11px"><div style="font-size:11px;font-weight:800;color:#9a7622">03 · OFFICIAL OFFER</div><div style="margin-top:5px;font-size:12px;line-height:1.5;color:#555b6b">The final Official Offer Letter is issued after the approved admission route is completed.</div></div></td>' +
            '</tr></table>' +

            '<div style="margin:24px 0 0;padding:15px 17px;background:#f8f9fb;border-radius:11px;border:1px solid #e8e9ed">' +
              '<strong style="display:block;color:#2d1d68;font-size:13px;margin-bottom:5px">Attached to this email</strong>' +
              '<span style="font-size:12px;color:#626775;line-height:1.6">1. Conditional Offer Letter (COL)<br>2. Copy of your submitted Admission Form</span>' +
            '</div>' +

            '<p style="margin:26px 0 0;font-size:13px;line-height:1.7;color:#555b6b">We are excited to have you begin this journey with us. Our team will guide you through each remaining admission step, and we look forward to welcoming you into the IUC postgraduate community.</p>' +
            supplementaryBlock +

            '<p style="margin:26px 0 0;font-size:13px;line-height:1.65;color:#555b6b">Warm regards,<br><strong style="color:#2d1d68">IPGS Admission Team</strong><br>Innovative University College</p>' +

            '<div style="margin-top:26px;padding-top:14px;border-top:1px solid #ececf0;color:#898d99;font-size:10px;line-height:1.55"><strong>Important:</strong> The attached Conditional Offer Letter is not the final Official Offer Letter / Letter of Admission. Final admission remains subject to the applicable verification and academic approval process.</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  const studentResult = v2NotificationSend_(
    'NEW_APPLICATION_STUDENT',
    [payload.email],
    studentSubject,
    studentText,
    studentHtml,
    {
      attachments:studentAttachments,
      inlineImages:{ipgsHeader:v2AdmissionEmailHeaderBlob_()},
      senderName:'IUC IPGS Admission',
      fromAlias:'ipgs.admission@innovative.edu.my',
      replyTo:'ipgs.admission@innovative.edu.my'
    }
  );

  const adminRecipients = v2NotificationAdminRecipients_();
  const agentLine = payload.partnerCode ? '<br><strong>Agent Code:</strong> '+v2Html_(payload.partnerCode) : '';
  const researchIntentAdminLine = researchIntentStatus
    ? '<br><strong>Research Intent:</strong> '+v2Html_(researchIntentStatus)
    : '';
  const adminSubject = '[IPGS Admission] New Application - ' + student + ' - ' + reference;
  const adminHtml = '<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">' +
    '<div style="background:#2d2363;color:white;padding:22px"><h2 style="margin:0">New Admission Application</h2></div>' +
    '<div style="padding:24px"><p>A new postgraduate application has been submitted and the student submission COL has been issued.</p>' +
    '<p><strong>Student:</strong> '+v2Html_(student)+'<br><strong>Programme:</strong> '+v2Html_(programme)+'<br><strong>Intake:</strong> '+v2Html_(intakeName)+'<br><strong>Reference:</strong> '+v2Html_(reference)+agentLine+researchIntentAdminLine+'</p>' +
    '<p>The Admission Form is attached. Please continue the document review and screening process in Admission V2.</p></div></div>';
  const adminResult = v2NotificationSend_(
    'NEW_APPLICATION_ADMIN', adminRecipients, adminSubject,
    'New application: ' + student + ' / ' + programme + ' / ' + reference,
    adminHtml,
    {attachments:admissionAttachment, senderName:'IUC IPGS Admission', replyTo:'ipgs.admission@innovative.edu.my'}
  );

  v2NotificationUpdateApplication_(reference, {
    'Application Student Email Status': studentResult.status,
    'Application Student Email Sent At': studentResult.sent ? now : '',
    'Application Admin Email Status': adminResult.status,
    'Application Admin Email Sent At': adminResult.sent ? now : '',
    'Email Status': 'STUDENT=' + studentResult.status + ';ADMIN=' + adminResult.status,
    'Last Updated': now
  });

  return {
    sent: studentResult.sent || adminResult.sent,
    status: 'STUDENT=' + studentResult.status + ';ADMIN=' + adminResult.status,
    student: studentResult,
    admin: adminResult
  };
}

function v2SendAgentNotificationCentral_(payload, reference, intake, pdf, agent, actionUrl, options) {
  v2NotificationEnsureHeaders_();

  payload = payload || {};
  agent = agent || {};

  const studentName = String(payload.fullName || 'Applicant').trim();
  const programme = String(payload.programme || '').trim();
  const agentName = String(agent.name || 'Academic Consultant').trim();
  const agentOrganisation = String(agent.organisation || '').trim();
  const intakeName = String(intake && intake.name || payload.intake || '').trim();
  const secureUrl = String(actionUrl || '').trim();
  const intendedEmail = String(agent.email || '').trim();

  if (!secureUrl) throw new Error('Agent Prospect / Fee Group action link is missing.');

  const isInternational = String(payload.applicantType || '').toLowerCase().indexOf('international') >= 0;
  const internationalText = isInternational ? 'Yes' : 'No';
  const idType = isInternational ? 'Passport' : 'MyKad';
  const safeAddress = v2Html_(payload.fullAddress || '').replace(/\r?\n/g, '<br>');

  const subject = '[IPGS Admission] New Referred Applicant - ' + studentName + ' - ' + reference;

  const textBody =
    'Dear ' + agentName + ',\n\n' +
    'Your referred applicant has submitted the IUC Admission Form.\n\n' +
    'ACTION REQUIRED:\n' +
    'Please create this applicant in SKYVIALING > Marketing > Prospect using the information below.\n\n' +
    'PERSONAL INFORMATION\n' +
    'International: ' + internationalText + '\n' +
    'ID Type: ' + idType + '\n' +
    'ID No: ' + String(payload.idPassport || '') + '\n' +
    'Name: ' + studentName + '\n' +
    'Gender: ' + String(payload.gender || '') + '\n' +
    'Email: ' + String(payload.email || '') + '\n' +
    'Phone: ' + String(payload.phoneNumber || '') + '\n' +
    'Nationality: ' + String(payload.nationality || '') + '\n' +
    'Race: ' + String(payload.race || '') + '\n' +
    'Religion: ' + String(payload.religion || '') + '\n' +
    'Place of Birth: ' + String(payload.placeOfBirth || '') + '\n\n' +
    'ADDRESS\n' +
    String(payload.fullAddress || '') + '\n\n' +
    'PROGRAMME\n' +
    'Intake: ' + intakeName + '\n' +
    'Programme: ' + programme + '\n' +
    'Study Mode: ' + String(payload.studyMode || '') + '\n' +
    'Level of Study: ' + String(payload.levelOfStudy || '') + '\n\n' +
    'Reference No: ' + reference + '\n' +
    'Assigned Agent: ' + agentName + '\n' +
    'Agent Organisation: ' + agentOrganisation + '\n\n' +
    'After you have successfully created the Prospect in SKYVIALING, return to this email and click the link below to confirm completion and select the Fee Group:\n' +
    secureUrl;

  const htmlBody =
    '<div style="font-family:Arial,sans-serif;max-width:720px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">' +
      '<div style="background:#2d2363;color:#fff;padding:22px"><h2 style="margin:0">New Referred Applicant</h2></div>' +
      '<div style="padding:24px">' +
        '<p>Dear <strong>'+v2Html_(agentName)+'</strong>,</p>' +
        '<p>Your referred applicant has submitted the IUC Admission Form.</p>' +

        '<div style="background:#fff7df;border:1px solid #f0d995;border-radius:12px;padding:14px 16px;margin:16px 0;color:#785816">' +
          '<strong>ACTION REQUIRED</strong><br>' +
          'Please create this applicant in <strong>SKYVIALING → Marketing → Prospect</strong> using the information below.' +
        '</div>' +

        '<div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#2d2363;margin:20px 0 8px">PERSONAL INFORMATION</div>' +
        '<table style="border-collapse:collapse;width:100%;font-size:13px">' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3;width:190px">International</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3;font-weight:700">'+v2Html_(internationalText)+'</td></tr>' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3">ID Type</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3;font-weight:700">'+v2Html_(idType)+'</td></tr>' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3">ID No.</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3;font-weight:700">'+v2Html_(payload.idPassport || '')+'</td></tr>' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3">Name</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3;font-weight:700">'+v2Html_(studentName)+'</td></tr>' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3">Gender</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3">'+v2Html_(payload.gender || '')+'</td></tr>' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3">Email</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3">'+v2Html_(payload.email || '')+'</td></tr>' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3">Phone</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3">'+v2Html_(payload.phoneNumber || '')+'</td></tr>' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3">Nationality</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3">'+v2Html_(payload.nationality || '')+'</td></tr>' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3">Race</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3">'+v2Html_(payload.race || '')+'</td></tr>' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3">Religion</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3">'+v2Html_(payload.religion || '')+'</td></tr>' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3">Place of Birth</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3">'+v2Html_(payload.placeOfBirth || '')+'</td></tr>' +
        '</table>' +

        '<div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#2d2363;margin:20px 0 8px">ADDRESS</div>' +
        '<div style="background:#fafbfc;border:1px solid #eceff3;border-radius:10px;padding:12px 14px;line-height:1.55">'+(safeAddress || '-')+'</div>' +

        '<div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#2d2363;margin:20px 0 8px">PROGRAMME</div>' +
        '<table style="border-collapse:collapse;width:100%;font-size:13px">' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3;width:190px">Intake</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3;font-weight:700">'+v2Html_(intakeName)+'</td></tr>' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3">Programme</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3;font-weight:700">'+v2Html_(programme)+'</td></tr>' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3">Study Mode</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3">'+v2Html_(payload.studyMode || '')+'</td></tr>' +
          '<tr><td style="padding:7px 8px;border-bottom:1px solid #eceff3">Level of Study</td><td style="padding:7px 8px;border-bottom:1px solid #eceff3">'+v2Html_(payload.levelOfStudy || '')+'</td></tr>' +
        '</table>' +

        '<div style="margin:20px 0 0;padding:13px 14px;background:#faf8ff;border:1px solid #e5def6;border-radius:10px;font-size:13px;line-height:1.6">' +
          '<strong>Reference No:</strong> '+v2Html_(reference)+
          '<br><strong>Assigned Agent:</strong> '+v2Html_(agentName)+
          (agentOrganisation ? '<br><strong>Agent Organisation:</strong> '+v2Html_(agentOrganisation) : '') +
        '</div>' +

        '<p style="margin-top:20px"><strong>After you have created and saved the Prospect in SKYVIALING:</strong> return to this email, click the button below, confirm Prospect completion and select the correct Fee Group.</p>' +

        '<p style="text-align:center;margin:24px 0"><a href="'+v2Html_(secureUrl)+'" style="display:inline-block;background:#2d2363;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">Prospect Done → Select Fee Group</a></p>' +

        '<p style="font-size:12px;color:#667085">The Admission Form is attached for reference. After your confirmation, Admission V2 will update the Prospect status and Fee Group automatically, and Registry will be notified to continue processing the application.</p>' +
        '<p>Regards,<br><strong>IPGS Registry</strong></p>' +
      '</div>' +
    '</div>';

  const opts = options || {};
  const result = v2NotificationSend_(
    'AGENT_NEW_APPLICATION', [intendedEmail], subject, textBody, htmlBody,
    {attachments:(pdf && pdf.blob ? [pdf.blob] : []), modeOverride:opts.modeOverride}
  );

  const now = new Date().toISOString();
  v2NotificationUpdateApplication_(reference, {
    'Agent Notification Status': result.status,
    'Agent Notification Sent At': result.sent ? now : '',
    'Last Updated': now
  });

  return result;
}

function v2SendOfferNotificationCentral_(referenceNo, acceptanceUrl, pdfFileId, options) {
  v2NotificationEnsureHeaders_();
  const reference = String(referenceNo || '').trim();
  const application = v2Find_('V2_APPLICATIONS','Reference No',reference);
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!application || !workflow) throw new Error('Application/workflow record not found.');
  if (String(workflow.record['Offer Letter Status'] || '') !== 'ISSUED') throw new Error('Offer email blocked: Offer Letter is not ISSUED.');
  if (!acceptanceUrl) throw new Error('Acceptance signing URL is missing.');

  const opts = options || {};
  const student = String(application.record['Student Name'] || 'Student');
  const programme = String(application.record['Programme'] || '');
  const intake = v2OfferDisplayIntake_(application.record['Intake'] || '');
  const recipient = String(application.record['Personal Email'] || '').trim();
  const subject = '[IUC IPGS] Congratulations! Your Official Offer Letter - ' + programme;
  const safeUrl = v2OfferHtmlEscape_(acceptanceUrl);
  const html = '<div style="margin:0;padding:24px;background:#f6f4fb;font-family:Arial,sans-serif;color:#172033"><div style="max-width:680px;margin:0 auto;background:#fff;border-radius:22px;overflow:hidden;border:1px solid #e8e3f3">' +
    '<div style="background:#2d2363;padding:30px;text-align:center;color:#fff"><div style="font-size:13px;letter-spacing:2px;font-weight:bold;color:#f5c451">CONGRATULATIONS!</div><div style="font-size:28px;font-weight:bold;margin-top:10px">Welcome to Innovative University College</div></div>' +
    '<div style="padding:30px"><p><strong>Dear '+v2OfferHtmlEscape_(student)+',</strong></p><p>Your Official Offer Letter is attached.</p>' +
    '<div style="background:#faf8ff;border:1px solid #e5def6;border-radius:14px;padding:18px"><strong>Programme:</strong> '+v2OfferHtmlEscape_(programme)+'<br><strong>Intake:</strong> '+v2OfferHtmlEscape_(intake)+'<br><strong>Reference:</strong> '+v2OfferHtmlEscape_(reference)+'</div>' +
    '<p style="margin-top:22px"><strong>Next step:</strong> review the Offer Letter and complete your electronic acceptance.</p>' +
    '<div style="text-align:center;margin:26px 0"><a href="'+safeUrl+'" style="display:inline-block;background:#2d2363;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:bold">Review &amp; Accept My Offer</a></div>' +
    '<p style="font-size:13px;color:#697386">If the button does not open, copy this secure link:<br><span style="word-break:break-all">'+safeUrl+'</span></p></div></div></div>';
  const attachment = DriveApp.getFileById(pdfFileId).getBlob();
  const result = v2NotificationSend_(
    'OFFER_ISSUED', [recipient], subject,
    'Your IUC Official Offer Letter is attached. Acceptance link: ' + acceptanceUrl,
    html,
    {attachments:[attachment], modeOverride:(opts.testMode === true ? 'TEST' : opts.modeOverride)}
  );
  const now = new Date().toISOString();
  v2NotificationUpdateWorkflow_(reference, {
    'Offer Email Status': result.status,
    'Offer Email Sent At': result.sent ? now : '',
    'Last Updated': now
  });
  if (typeof v2Audit_ === 'function') {
    v2Audit_(reference,'OFFER','SEND_OFFER_EMAIL',{}, {recipients:result.recipients,mode:result.mode,status:result.status}, 'Notification Engine', result.sent ? 'SUCCESS' : 'SKIPPED', '');
  }
  return result;
}

function v2NotificationBlobFromUrl_(url) {
  const id = v2OfferExtractDriveId_(String(url || ''));
  if (!id) return null;
  try { return DriveApp.getFileById(id).getBlob(); } catch (error) { return null; }
}

function v2SendAcceptanceConfirmationCentral_(referenceNo, signedDocumentUrls) {
  v2NotificationEnsureHeaders_();
  const reference = String(referenceNo || '').trim();
  const application = v2Find_('V2_APPLICATIONS','Reference No',reference);
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!application || !workflow) throw new Error('Application/workflow record not found for acceptance confirmation.');
  const student = String(application.record['Student Name'] || 'Student');
  const programme = String(application.record['Programme'] || '');
  const intake = v2OfferDisplayIntake_(application.record['Intake'] || '');
  const recipient = String(application.record['Personal Email'] || '').trim();
  const acceptedAt = String(workflow.record['Acceptance Received At'] || workflow.record['Acceptance Signed At'] || '');
  const handbookUrl = String(workflow.record['Student Handbook URL'] || '').trim();
  const urls = (signedDocumentUrls || []).filter(Boolean);
  if (urls.length !== 4) {
    throw new Error('Acceptance confirmation requires all 4 signed admission documents.');
  }
  const attachments = urls.map(v2NotificationBlobFromUrl_).filter(Boolean);
  if (attachments.length !== 4) {
    throw new Error('One or more signed acceptance documents could not be attached.');
  }

  const subject = '[IUC IPGS] Acceptance Successfully Received - ' + programme;
  const handbookLine = handbookUrl ? '<p>You may continue to access/download the <a href="'+v2Html_(handbookUrl)+'">Postgraduate Student Handbook here</a>.</p>' : '';
  const html = '<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden"><div style="background:#2d2363;color:#fff;padding:24px"><h2 style="margin:0">Acceptance Successfully Received</h2></div>' +
    '<div style="padding:24px"><p>Dear <strong>'+v2Html_(student)+'</strong>,</p><p>Thank you. Your acceptance of the IUC postgraduate offer has been successfully recorded.</p>' +
    '<p><strong>Reference:</strong> '+v2Html_(reference)+'<br><strong>Programme:</strong> '+v2Html_(programme)+'<br><strong>Intake:</strong> '+v2Html_(intake)+(acceptedAt ? '<br><strong>Recorded:</strong> '+v2Html_(acceptedAt) : '')+'</p>' +
    '<p>Your signed admission documents are attached for your record.</p>'+handbookLine+'<p>We will contact you regarding the next registration/orientation process.</p><p>Regards,<br><strong>IPGS Registry</strong><br>Innovative University College</p></div></div>';
  const result = v2NotificationSend_(
    'ACCEPTANCE_COMPLETED', [recipient], subject,
    'Your acceptance has been successfully received. Reference: ' + reference,
    html, {attachments:attachments}
  );
  const now = new Date().toISOString();
  v2NotificationUpdateWorkflow_(reference, {
    'Acceptance Confirmation Email Status': result.status,
    'Acceptance Confirmation Email Sent At': result.sent ? now : '',
    'Last Updated': now
  });
  if (typeof v2Audit_ === 'function') {
    v2Audit_(reference,'ACCEPTANCE','SEND_ACCEPTANCE_CONFIRMATION',{}, {recipients:result.recipients,attachmentCount:attachments.length,status:result.status}, 'Notification Engine', result.sent ? 'SUCCESS' : 'SKIPPED', '');
  }
  return result;
}

function v2ResendAcceptanceConfirmation_(data, actor) {
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
  return {
    ok:true,
    build:V2_NOTIFICATION_BUILD,
    mode:v2NotificationMode_(),
    testRecipient:v2NotificationTestRecipient_(),
    adminRecipients:v2NotificationAdminRecipients_(),
    events:['NEW_APPLICATION_STUDENT','NEW_APPLICATION_ADMIN','AGENT_NEW_APPLICATION','OFFER_ISSUED','ACCEPTANCE_COMPLETED'],
    v1Touched:false
  };
}
