/**
 * IUC IPGS Admission V2 - SAC Result Review / Dispatch
 * Phase 1: manual, admin-controlled communication only.
 *
 * Safety:
 * - No automatic email after SAC finalisation.
 * - Each candidate must be prepared/reviewed before sending.
 * - Email mode defaults to DISABLED.
 * - TEST mode sends only to V2_SAC_RESULT_TEST_EMAIL.
 * - LIVE mode must be explicitly enabled later.
 * - V1 is never touched.
 */

const V2_SAC_RESULT_BUILD = 'SAC_RESULT_DISPATCH_V2_20260913';
const V2_SAC_RESULT_HEADERS = [
  'Result Communication Type',
  'Result Document Status',
  'Result Document URL',
  'Result Prepared At',
  'Result Prepared By',
  'Result Email Status',
  'Result Email To',
  'Result Email Sent At',
  'Result Email Sent By',
  'Result Email Last Error'
];

function v2SacResultEnsureSchema_() {
  assertDevIdentity_();
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName('V2_SAC_CANDIDATES');
  if (!sheet) throw new Error('V2_SAC_CANDIDATES sheet not found.');
  v2EnsureHeaders_(sheet, (V2_HEADERS && V2_HEADERS.V2_SAC_CANDIDATES ? V2_HEADERS.V2_SAC_CANDIDATES : []).concat(V2_SAC_RESULT_HEADERS));
  return {ok:true};
}

function v2SacResultEmailMode_() {
  const mode = String(PropertiesService.getScriptProperties().getProperty('V2_SAC_RESULT_EMAIL_MODE') || 'DISABLED').trim().toUpperCase();
  return ['DISABLED','TEST','LIVE'].indexOf(mode) >= 0 ? mode : 'DISABLED';
}

function v2SacResultStatus_() {
  v2SacResultEnsureSchema_();
  return {
    ok:true,
    build:V2_SAC_RESULT_BUILD,
    emailMode:v2SacResultEmailMode_(),
    automaticSend:false,
    sendAll:false,
    individualSend:true,
    selectedSend:true,
    v1Touched:false
  };
}

function v2SacResultContext_(data) {
  const sessionId = v2Required_(data.sessionId, 'SAC Session ID');
  const reference = v2Required_(data.referenceNo, 'Reference No');
  const session = v2Find_('V2_SAC_SESSIONS', 'SAC Session ID', sessionId);
  if (!session) throw new Error('SAC session not found.');
  if (String(session.record['Status'] || '').toUpperCase() !== 'FINALIZED') {
    throw new Error('SAC result communication is only available after the session is FINALIZED.');
  }
  const candidate = v2FindComposite_('V2_SAC_CANDIDATES', ['SAC Session ID','Reference No'], [sessionId,reference]);
  if (!candidate) throw new Error('SAC candidate not found.');
  const decision = String(candidate.record['Decision'] || '').trim().toUpperCase();
  if (!decision || decision === 'PENDING') throw new Error('SAC decision is still pending.');
  if (['DIRECT_ENTRY','INTERNAL_ASSESSMENT','REJECTED'].indexOf(decision) < 0) {
    throw new Error('Unsupported Phase 1 SAC result.');
  }
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  if (!workflow) throw new Error('V2 workflow record not found.');
  if (!application) throw new Error('V2 application record not found.');
  return {sessionId:sessionId,reference:reference,session:session,candidate:candidate,workflow:workflow,application:application,decision:decision};
}

function v2SacResultCommunicationType_(decision) {
  if (decision === 'DIRECT_ENTRY') return 'OFFER_LETTER';
  if (decision === 'INTERNAL_ASSESSMENT') return 'CONDITIONAL_OFFER_IA';
  return 'REJECTION_NOTICE';
}

function v2PrepareSacResultDocument_(data, actor) {
  assertDevIdentity_();
  v2SacResultEnsureSchema_();
  const ctx = v2SacResultContext_(data || {});
  const type = v2SacResultCommunicationType_(ctx.decision);
  const existingUrl = String(ctx.candidate.record['Result Document URL'] || '').trim();
  let documentUrl = existingUrl;
  let documentStatus = existingUrl ? 'READY' : 'NOT_REQUIRED';
  let generated = false;

  if (ctx.decision === 'DIRECT_ENTRY') {
    documentUrl = String(ctx.workflow.record['Offer Letter PDF URL'] || '').trim();
    if (!documentUrl) {
      const offerStatus = String(ctx.workflow.record['Offer Letter Status'] || '').trim().toUpperCase();
      if (!offerStatus || offerStatus === 'NOT_ISSUED') {
        v2PrepareOffer_(ctx.reference, actor || 'SAC Result Review');
      }
      const refreshed = v2Find_('V2_WORKFLOW', 'Reference No', ctx.reference);
      const refreshedStatus = String(refreshed.record['Offer Letter Status'] || '').trim().toUpperCase();
      if (refreshedStatus === 'READY_TO_GENERATE') {
        const generatedOffer = v2GenerateOfferLetter_(ctx.reference, actor || 'SAC Result Review');
        documentUrl = String(generatedOffer.offerLetterPdfUrl || '').trim();
        generated = true;
      } else {
        documentUrl = String(refreshed.record['Offer Letter PDF URL'] || '').trim();
      }
    }
    if (!documentUrl) throw new Error('Offer Letter PDF could not be prepared.');
    documentStatus = 'READY';
  } else if (ctx.decision === 'INTERNAL_ASSESSMENT') {
    if (!documentUrl) {
      const col = v2GenerateConditionalOfferForSacResult_(ctx, actor || 'SAC Result Review');
      documentUrl = String(col.pdfUrl || '').trim();
      generated = true;
    }
    if (!documentUrl) throw new Error('Conditional Offer Letter PDF could not be prepared.');
    documentStatus = 'READY';
  } else {
    documentStatus = 'EMAIL_ONLY';
    documentUrl = '';
  }

  const now = new Date().toISOString();
  const updates = {
    'Result Communication Type':type,
    'Result Document Status':documentStatus,
    'Result Document URL':documentUrl,
    'Result Prepared At':now,
    'Result Prepared By':actor || 'Admin Portal V2',
    'Result Email Status':'READY_TO_SEND',
    'Result Email Last Error':''
  };
  v2UpdateRow_(ctx.candidate.sheet, ctx.candidate.rowNumber, updates);
  v2Audit_(ctx.reference,'SAC','PREPARE_RESULT_COMMUNICATION',ctx.candidate.record,updates,actor || 'Admin Portal V2','SUCCESS','Manual review required before send.');
  v2InvalidateCache_();

  const preview = v2BuildSacResultEmail_(ctx, documentUrl);
  return {
    ok:true,
    sessionId:ctx.sessionId,
    referenceNo:ctx.reference,
    decision:ctx.decision,
    communicationType:type,
    documentStatus:documentStatus,
    documentUrl:documentUrl,
    documentGenerated:generated,
    emailStatus:'READY_TO_SEND',
    emailMode:v2SacResultEmailMode_(),
    preview:preview,
    emailSent:false,
    v1Touched:false
  };
}

function v2PreviewSacResult_(data) {
  assertDevIdentity_();
  v2SacResultEnsureSchema_();
  const ctx = v2SacResultContext_(data || {});
  const documentUrl = String(ctx.candidate.record['Result Document URL'] || ctx.workflow.record['Offer Letter PDF URL'] || '').trim();
  return {
    ok:true,
    sessionId:ctx.sessionId,
    referenceNo:ctx.reference,
    decision:ctx.decision,
    documentUrl:documentUrl,
    emailMode:v2SacResultEmailMode_(),
    preview:v2BuildSacResultEmail_(ctx, documentUrl),
    emailSent:false,
    v1Touched:false
  };
}

function v2SendSacResultEmail_(data, actor) {
  assertDevIdentity_();
  v2SacResultEnsureSchema_();
  const ctx = v2SacResultContext_(data || {});
  const preparedStatus = String(ctx.candidate.record['Result Email Status'] || '').trim().toUpperCase();
  const resultType = String(ctx.candidate.record['Result Communication Type'] || '').trim();
  if (!resultType || !/READY_TO_SEND|TEST_SENT|SENT/.test(preparedStatus)) {
    throw new Error('Prepare and review this SAC result before sending.');
  }
  if (preparedStatus === 'SENT' && data.force !== true) {
    return {ok:true,sent:false,duplicate:true,reason:'ALREADY_SENT',referenceNo:ctx.reference,emailStatus:'SENT',v1Touched:false};
  }

  const mode = v2SacResultEmailMode_();
  const intendedEmail = String(ctx.application.record['Personal Email'] || ctx.workflow.record['Personal Email'] || '').trim();
  if (!intendedEmail) throw new Error('Student email is missing.');
  if (mode === 'DISABLED') {
    v2UpdateRow_(ctx.candidate.sheet,ctx.candidate.rowNumber,{
      'Result Email Status':'DISABLED',
      'Result Email To':'',
      'Result Email Last Error':'V2_SAC_RESULT_EMAIL_MODE is DISABLED'
    });
    return {ok:true,sent:false,mode:mode,reason:'EMAIL_MODE_DISABLED',referenceNo:ctx.reference,v1Touched:false};
  }

  let recipient = intendedEmail;
  if (mode === 'TEST') {
    recipient = String(PropertiesService.getScriptProperties().getProperty('V2_SAC_RESULT_TEST_EMAIL') || '').trim();
    if (!recipient) {
      v2UpdateRow_(ctx.candidate.sheet,ctx.candidate.rowNumber,{
        'Result Email Status':'TEST_EMAIL_NOT_CONFIGURED',
        'Result Email Last Error':'V2_SAC_RESULT_TEST_EMAIL is not configured'
      });
      return {ok:true,sent:false,mode:mode,reason:'TEST_EMAIL_NOT_CONFIGURED',referenceNo:ctx.reference,v1Touched:false};
    }
  }

  const documentUrl = String(ctx.candidate.record['Result Document URL'] || ctx.workflow.record['Offer Letter PDF URL'] || '').trim();
  const email = v2BuildSacResultEmail_(ctx, documentUrl);
  const subject = (mode === 'TEST' ? '[TEST] ' : '') + email.subject;
  const options = {htmlBody:email.htmlBody,name:'IPGS Admission'};
  if (documentUrl) {
    const fileId = v2SacResultExtractDriveId_(documentUrl);
    if (fileId) options.attachments = [DriveApp.getFileById(fileId).getBlob()];
  }

  try {
    GmailApp.sendEmail(recipient, subject, email.textBody, options);
  } catch (error) {
    const message = String(error && error.message || error);
    v2UpdateRow_(ctx.candidate.sheet,ctx.candidate.rowNumber,{
      'Result Email Status':'FAILED',
      'Result Email To':recipient,
      'Result Email Last Error':message
    });
    v2Audit_(ctx.reference,'SAC','SEND_RESULT_EMAIL',{}, {mode:mode,recipient:recipient}, actor || 'Admin Portal V2','FAILED',message);
    throw error;
  }

  const now = new Date().toISOString();
  const sentStatus = mode === 'TEST' ? 'TEST_SENT' : 'SENT';
  v2UpdateRow_(ctx.candidate.sheet,ctx.candidate.rowNumber,{
    'Result Email Status':sentStatus,
    'Result Email To':recipient,
    'Result Email Sent At':now,
    'Result Email Sent By':actor || 'Admin Portal V2',
    'Result Email Last Error':''
  });
  v2Audit_(ctx.reference,'SAC','SEND_RESULT_EMAIL',{}, {mode:mode,recipient:recipient,status:sentStatus}, actor || 'Admin Portal V2','SUCCESS','Admin-controlled individual/selected send.');
  v2InvalidateCache_();
  return {ok:true,sent:true,mode:mode,referenceNo:ctx.reference,emailStatus:sentStatus,recipient:recipient,sentAt:now,v1Touched:false};
}

function v2BuildSacResultEmail_(ctx, documentUrl) {
  const studentName = String(ctx.application.record['Student Name'] || ctx.workflow.record['Student Name'] || 'Student').trim();
  const programme = String(ctx.application.record['Programme'] || ctx.workflow.record['Programme'] || '').trim();
  const intake = String(ctx.application.record['Intake'] || ctx.workflow.record['Intake'] || '').trim();
  const reference = ctx.reference;
  let title = 'Admission Result';
  let paragraphs = [];

  if (ctx.decision === 'DIRECT_ENTRY') {
    title = 'Offer of Admission – Innovative University College';
    paragraphs = [
      'We are pleased to inform you that your application has been endorsed for Direct Entry.',
      'Your Offer Letter is attached for your review. Please follow the acceptance instructions stated in the offer communication.'
    ];
  } else if (ctx.decision === 'INTERNAL_ASSESSMENT') {
    title = 'Conditional Offer of Admission – Internal Assessment';
    paragraphs = [
      'Your application has been endorsed to proceed through Internal Assessment.',
      'Your Conditional Offer Letter is attached. Further assessment instructions will be provided through the approved IPGS process.'
    ];
  } else {
    title = 'Admission Application Result – Innovative University College';
    paragraphs = [
      'Following the Student Admission Committee review, we regret to inform you that your application was not approved for the current admission route.',
      'Please contact IPGS / Registry if you require clarification on the decision.'
    ];
  }

  const textBody = [
    'Dear ' + studentName + ',',
    '',
    paragraphs[0],
    paragraphs[1],
    '',
    'Programme: ' + (programme || '-'),
    'Intake: ' + (intake || '-'),
    'Reference No: ' + reference,
    '',
    'Best regards,',
    'Registry Department',
    'Innovative University College'
  ].join('\n');

  const htmlBody = '<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">' +
    '<div style="background:#2d2363;color:#fff;padding:22px"><h2 style="margin:0">'+v2SacResultHtml_(title)+'</h2></div>' +
    '<div style="padding:24px"><p>Dear '+v2SacResultHtml_(studentName)+',</p>' +
    '<p>'+v2SacResultHtml_(paragraphs[0])+'</p><p>'+v2SacResultHtml_(paragraphs[1])+'</p>' +
    '<p><strong>Programme:</strong> '+v2SacResultHtml_(programme||'-')+'<br><strong>Intake:</strong> '+v2SacResultHtml_(intake||'-')+'<br><strong>Reference No:</strong> '+v2SacResultHtml_(reference)+'</p>' +
    (documentUrl ? '<p>The relevant admission document is attached to this email.</p>' : '') +
    '<p>Best regards,<br><strong>Registry Department</strong><br>Innovative University College</p></div></div>';

  return {subject:title,textBody:textBody,htmlBody:htmlBody,documentUrl:documentUrl || ''};
}

function v2GenerateConditionalOfferForSacResult_(ctx, actor) {
  const application = ctx.application.record;
  const workflow = ctx.workflow.record;
  const applicantType = String(application['Applicant Type'] || '').trim();
  const isInternational = /INTERNATIONAL|NON-MALAYSIAN/i.test(applicantType);
  const templateId = String(isInternational ? CONFIG.internationalColTemplateId : CONFIG.colTemplateId || '').trim();
  if (!templateId) throw new Error('Conditional Offer Letter template is not configured.');

  const folderUrl = String(application['Student Folder URL'] || workflow['Student Folder URL'] || '').trim();
  const folderId = v2SacResultExtractDriveId_(folderUrl);
  if (!folderId) throw new Error('Student Folder URL is missing or invalid.');
  const folder = DriveApp.getFolderById(folderId);

  let raw = {};
  try { raw = JSON.parse(String(application['Raw Application JSON'] || '{}')); } catch (_) { raw = {}; }
  const studentName = String(application['Student Name'] || '').trim();
  const safeName = studentName.replace(/[^A-Za-z0-9 _-]/g,'').replace(/\s+/g,'_');
  const copyName = 'COL_' + safeName + '_' + ctx.reference;
  const existing = folder.getFilesByName(copyName + '.pdf');
  if (existing.hasNext()) {
    const file = existing.next();
    return {ok:true,duplicate:true,pdfUrl:file.getUrl(),pdfFileId:file.getId()};
  }

  const template = DriveApp.getFileById(templateId);
  const docCopy = template.makeCopy(copyName, folder);
  const doc = DocumentApp.openById(docCopy.getId());
  const body = doc.getBody();
  const dateText = Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'dd/MM/yyyy');
  const address = v2SacResultFormatAddress_(raw.fullAddress || raw.address || '');
  const programme = v2SacResultProgrammeName_(application['Programme'] || '');
  const intake = String(application['Intake'] || workflow['Intake'] || '').trim();
  const studyMode = String(application['Study Mode'] || raw.studyMode || '').trim();
  const country = String(raw.country || raw.nationality || '').trim();
  const duration = String(raw.durationStudy || raw.studyDuration || '').trim();

  body.replaceText('{{REF_NO}}', v2SacResultSafeReplace_(ctx.reference));
  body.replaceText('{{DATE}}', v2SacResultSafeReplace_(dateText));
  body.replaceText('{{STUDENT_NAME}}', v2SacResultSafeReplace_(studentName.toUpperCase()));
  body.replaceText('{{STUDENT_ADDRESS}}', v2SacResultSafeReplace_(address));
  body.replaceText('{{PROGRAMME_NAME}}', v2SacResultSafeReplace_(programme));
  body.replaceText('{{MODE_OF_STUDY}}', v2SacResultSafeReplace_(studyMode));
  body.replaceText('{{INTAKE}}', v2SacResultSafeReplace_(intake));
  body.replaceText('{{COUNTRY}}', v2SacResultSafeReplace_(country));
  body.replaceText('{{DURATION_STUDY}}', v2SacResultSafeReplace_(duration));
  doc.saveAndClose();

  const pdfBlob = DriveApp.getFileById(docCopy.getId()).getAs(MimeType.PDF).setName(copyName + '.pdf');
  const pdf = folder.createFile(pdfBlob);
  v2Audit_(ctx.reference,'SAC','GENERATE_CONDITIONAL_OFFER',{}, {sessionId:ctx.sessionId,pdfUrl:pdf.getUrl()}, actor || 'SAC Result Review','SUCCESS','IA Conditional Offer generated from existing IUC template.');
  return {ok:true,duplicate:false,pdfUrl:pdf.getUrl(),pdfFileId:pdf.getId(),docUrl:docCopy.getUrl()};
}

function v2SacResultExtractDriveId_(url) {
  const value = String(url || '').trim();
  const match = value.match(/[-\w]{20,}/);
  return match ? match[0] : '';
}

function v2SacResultProgrammeName_(programme) {
  const value = String(programme || '').trim();
  if (!value) return '';
  const parts = value.split(' - ');
  return parts.length > 1 ? parts.slice(1).join(' - ').trim() : value;
}

function v2SacResultTitleCase_(value) {
  return String(value || '').toLowerCase().split(/\s+/).map(function(word){
    return word ? word.charAt(0).toUpperCase() + word.slice(1) : '';
  }).join(' ').trim();
}

function v2SacResultFormatAddress_(address) {
  return String(address || '').split(',').map(function(part){ return v2SacResultTitleCase_(part.trim()); }).filter(Boolean).join('\n');
}

function v2SacResultSafeReplace_(value) {
  return String(value || '').replace(/\\/g,'\\\\').replace(/\$/g,'$$$$');
}

function v2SacResultHtml_(value) {
  return String(value || '').replace(/[&<>"']/g,function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
}

function v2SacResultControlledTest() {
  assertDevIdentity_();
  const status = v2SacResultStatus_();
  const checks = {
    emailDisabled: status.emailMode === 'DISABLED',
    automaticSendDisabled: status.automaticSend === false,
    sendAllDisabled: status.sendAll === false,
    individualSendEnabled: status.individualSend === true,
    selectedSendEnabled: status.selectedSend === true
  };
  const report = {
    ok:Object.keys(checks).every(function(k){return checks[k] === true;}),
    checks:checks,
    emailSent:false,
    v1Touched:false
  };
  Logger.log(JSON.stringify(report));
  return report;
}
