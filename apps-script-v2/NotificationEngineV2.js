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
    'ipgs.admission@innovative.edu.my',
    'adiybukhori.ipgs@innovative.edu.my',
    'abu.huzaifah.ipgs@innovative.edu.my'
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
        throw new Error('Required sender alias is not authorised for this Apps Script user: ' + requestedFrom);
      }
    } catch (senderError) {
      throw new Error('Unable to use required V2 notification sender ' + requestedFrom + ': ' + String(senderError && senderError.message || senderError));
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

function v2AdmissionEmailLogoBlob_() {
  try {
    return DriveApp.getFileById(CONFIG.iucLogoFileId).getBlob().setName('IUC_Logo.png');
  } catch (error) {
    Logger.log('Unable to load IUC email logo: ' + String(error && error.message || error));
    return null;
  }
}

function v2AdmissionEmailHeaderHtml_(withLogo) {
  const logo = withLogo
    ? '<img src="cid:iucLogo" alt="Innovative University College" width="164" style="display:block;width:164px;max-width:100%;height:auto;border:0">'
    : '<div style="font-size:20px;line-height:1.2;font-weight:800;color:#34206f">Innovative University College</div>';

  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">' +
    '<tr><td style="padding:20px 22px 16px;background:#ffffff;border-bottom:4px solid #d9a428">' +
      logo +
      '<div style="margin-top:8px;font-size:11px;line-height:1.4;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6f6489">Institute of Postgraduate Studies (IPGS)</div>' +
    '</td></tr></table>';
}

function v2ApplicantFriendlyName_(fullName) {
  const raw = String(fullName || '').trim();
  if (!raw) return 'there';
  const beforeRelation = raw.split(/\s+(?:BIN|BINTI|A\/L|A\/P)\s+/i)[0].trim();
  const words = (beforeRelation || raw).split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map(function(word){
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

function v2SendApplicationNotifications_(payload, reference, intake, pdf, col) {
  v2NotificationEnsureHeaders_();
  const now = new Date().toISOString();
  const student = String(payload.fullName || 'Applicant').trim();
  const friendlyName = v2ApplicantFriendlyName_(student);
  const programmeRaw = String(payload.programme || '').trim();
  const programme = programmeRaw.indexOf(' - ') >= 0 ? programmeRaw.split(' - ').slice(1).join(' - ').trim() : programmeRaw;
  const intakeName = String(intake && intake.name || payload.intake || '').trim();
  const admissionAttachment = pdf && pdf.blob ? [pdf.blob] : [];
  const studentAttachments = [];
  if (col && col.blob) studentAttachments.push(col.blob);
  if (pdf && pdf.blob) studentAttachments.push(pdf.blob);

  const applicationRow = v2Find_('V2_APPLICATIONS','Reference No',reference);
  const researchIntentStatus = applicationRow ? String(applicationRow.record['Research Intent Status'] || '') : '';
  const researchIntentUrl = applicationRow ? String(applicationRow.record['Research Intent Upload URL'] || '') : '';
  const researchIntentPending = researchIntentStatus === 'PENDING' && !!researchIntentUrl;

  const logoBlob = v2AdmissionEmailLogoBlob_();
  const inlineImages = logoBlob ? {iucLogo:logoBlob} : null;

  const supplementaryBlock = researchIntentPending
    ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-collapse:separate"><tr><td style="padding:16px 17px;background:#fffaf0;border:1px solid #ead9a2;border-radius:12px">' +
        '<div style="font-size:13px;font-weight:800;color:#72551b;margin-bottom:6px">One more item to complete</div>' +
        '<div style="font-size:13px;line-height:1.65;color:#65562f">For your PhD application, please upload your Preliminary Research Intent (2-3 pages). Your Conditional Offer Letter has already been issued; this item is needed for the academic review stage.</div>' +
        '<div style="margin-top:14px"><a href="'+v2Html_(researchIntentUrl)+'" style="display:inline-block;background:#34206f;color:#ffffff;text-decoration:none;font-size:13px;font-weight:800;padding:11px 16px;border-radius:8px">Upload Research Intent</a></div>' +
      '</td></tr></table>'
    : '';

  const studentSubject = 'Congratulations, ' + friendlyName + ' - Your IUC Conditional Offer Letter';
  const studentText =
    'Dear ' + friendlyName + ',\n\n' +
    'Congratulations. We are delighted that you have chosen Innovative University College for the next step in your postgraduate journey.\n\n' +
    'Your application for ' + programme + ' has been received, and we are pleased to issue your Conditional Offer Letter for the ' + intakeName + ' intake.\n\n' +
    'Programme: ' + programme + '\nIntake: ' + intakeName + '\nReference: ' + reference + '\n\n' +
    'What happens next: Our admission team will review your submitted documents and academic eligibility. If anything further is needed, we will contact you. Once the applicable requirements are completed and approved, the final Official Offer Letter / Letter of Admission will be issued.\n\n' +
    'Attached: Conditional Offer Letter and your submitted Admission Form.\n\n' +
    (researchIntentPending ? 'One more item: Please upload your Preliminary Research Intent (2-3 pages): ' + researchIntentUrl + '\n\n' : '') +
    'We are glad to have you begin this journey with us, and our team will guide you through the remaining steps.\n\n' +
    'Warm regards,\nIPGS Admission Team\nInnovative University College';

  const studentHtml =
    '<div style="margin:0;padding:0;background:#f5f5f3;font-family:Arial,Helvetica,sans-serif;color:#272633">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f5f5f3"><tr><td align="center" style="padding:18px 10px">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:separate;background:#ffffff;border:1px solid #e6e4ea;border-radius:14px;overflow:hidden">' +
          '<tr><td>'+v2AdmissionEmailHeaderHtml_(!!logoBlob)+'</td></tr>' +
          '<tr><td style="padding:28px 22px 26px">' +
            '<div style="font-size:11px;line-height:1.4;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#9a7622">Postgraduate Admission</div>' +
            '<h1 style="margin:10px 0 12px;font-size:28px;line-height:1.16;font-weight:800;color:#34206f">Congratulations, '+v2Html_(friendlyName)+'!</h1>' +
            '<p style="margin:0;font-size:16px;line-height:1.65;color:#555866">We are delighted that you have chosen <strong style="color:#34206f">Innovative University College</strong> for the next step in your postgraduate journey.</p>' +
            '<p style="margin:16px 0 0;font-size:15px;line-height:1.65;color:#555866">Your application has been received, and we are pleased to issue your <strong style="color:#34206f">Conditional Offer Letter</strong> for the '+v2Html_(intakeName)+' intake.</p>' +

            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;width:100%;border-collapse:separate;background:#f7f5fb;border:1px solid #e7e1f1;border-radius:12px">' +
              '<tr><td style="padding:16px 17px">' +
                '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:#8a7c9f">Your programme</div>' +
                '<div style="margin-top:5px;font-size:17px;line-height:1.45;font-weight:800;color:#34206f">'+v2Html_(programme)+'</div>' +
                '<div style="margin-top:11px;font-size:13px;line-height:1.6;color:#555866"><strong>Intake:</strong> '+v2Html_(intakeName)+'<br><strong>Application reference:</strong> '+v2Html_(reference)+'</div>' +
              '</td></tr>' +
            '</table>' +

            '<div style="margin-top:24px;font-size:15px;font-weight:800;color:#34206f">What happens next</div>' +
            '<p style="margin:8px 0 0;font-size:14px;line-height:1.7;color:#555866">Our admission team will review your submitted documents and academic eligibility. If we need anything further, we will contact you. Once the applicable requirements are completed and approved, we will issue your final Official Offer Letter / Letter of Admission.</p>' +

            '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;border-collapse:separate"><tr><td style="padding:15px 17px;background:#fafafa;border:1px solid #e8e8eb;border-radius:12px">' +
              '<div style="font-size:13px;font-weight:800;color:#34206f;margin-bottom:7px">Included with this email</div>' +
              '<div style="font-size:13px;line-height:1.65;color:#555866">Conditional Offer Letter (COL)<br>Copy of your submitted Admission Form</div>' +
            '</td></tr></table>' +

            supplementaryBlock +

            '<p style="margin:24px 0 0;font-size:14px;line-height:1.7;color:#555866">We are glad to have you begin this journey with us. Our team will guide you through each remaining admission step, and we look forward to welcoming you into the IUC postgraduate community.</p>' +
            '<p style="margin:22px 0 0;font-size:14px;line-height:1.65;color:#555866">Warm regards,<br><strong style="color:#34206f">IPGS Admission Team</strong><br>Innovative University College</p>' +
            '<div style="margin-top:22px;padding-top:14px;border-top:1px solid #ececf0;font-size:11px;line-height:1.55;color:#858793">This Conditional Offer Letter is not the final Official Offer Letter / Letter of Admission. Final admission remains subject to the applicable verification and academic approval process.</div>' +
          '</td></tr>' +
        '</table>' +
      '</td></tr></table>' +
    '</div>';

  let studentResult;
  try {
    studentResult = v2NotificationSend_(
      'NEW_APPLICATION_STUDENT',
      [payload.email],
      studentSubject,
      studentText,
      studentHtml,
      {
        attachments:studentAttachments,
        inlineImages:inlineImages,
        senderName:'IUC IPGS Admission',
        fromAlias:'ipgs.admission@innovative.edu.my',
        replyTo:'ipgs.admission@innovative.edu.my'
      }
    );
  } catch (studentError) {
    studentResult = {
      sent:false,
      status:'FAILED: ' + String(studentError && studentError.message || studentError),
      mode:v2NotificationMode_(),
      event:'NEW_APPLICATION_STUDENT',
      recipients:[String(payload.email || '').trim()]
    };
    Logger.log('V2 student application email failed: ' + studentResult.status);
  }

  const adminRecipients = v2NotificationAdminRecipients_();
  const agentLine = payload.partnerCode ? '<br><strong>Agent Code:</strong> '+v2Html_(payload.partnerCode) : '';
  const researchIntentAdminLine = researchIntentStatus ? '<br><strong>Research Intent:</strong> '+v2Html_(researchIntentStatus) : '';
  const adminSubject = '[IPGS Admission] New Application - ' + student + ' - ' + reference;
  const adminHtml = '<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">' +
    '<div style="background:#34206f;color:white;padding:20px"><h2 style="margin:0;font-size:20px">New Admission Application</h2></div>' +
    '<div style="padding:22px"><p>A new postgraduate application has been submitted and the student Conditional Offer Letter has been issued.</p>' +
    '<p><strong>Student:</strong> '+v2Html_(student)+'<br><strong>Programme:</strong> '+v2Html_(programme)+'<br><strong>Intake:</strong> '+v2Html_(intakeName)+'<br><strong>Reference:</strong> '+v2Html_(reference)+agentLine+researchIntentAdminLine+'</p>' +
    '<p>The Admission Form is attached. Please continue the document review and screening process in Admission V2.</p></div></div>';

  let adminResult;
  try {
    adminResult = v2NotificationSend_(
      'NEW_APPLICATION_ADMIN', adminRecipients, adminSubject,
      'New application: ' + student + ' / ' + programme + ' / ' + reference,
      adminHtml,
      {
        attachments:admissionAttachment,
        senderName:'IUC IPGS Admission',
        fromAlias:'ipgs.admission@innovative.edu.my',
        replyTo:'ipgs.admission@innovative.edu.my'
      }
    );
  } catch (adminError) {
    adminResult = {
      sent:false,
      status:'FAILED: ' + String(adminError && adminError.message || adminError),
      mode:v2NotificationMode_(),
      event:'NEW_APPLICATION_ADMIN',
      recipients:adminRecipients
    };
    Logger.log('V2 admin application email failed: ' + adminResult.status);
  }

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
