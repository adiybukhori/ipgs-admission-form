/**
 * IUC IPGS Admission V2 - Secure Document Replacement
 *
 * Compliance & Records Agent -> Student Concierge -> Applicant upload ->
 * Compliance re-review. Uses hashed token links and preserves superseded files.
 */

const V2_DOC_REPLACEMENT_MAX_FILE_BYTES = 7 * 1024 * 1024;
const V2_DOC_REPLACEMENT_MAX_TOTAL_BYTES = 18 * 1024 * 1024;
const V2_DOC_REPLACEMENT_HEADERS = [
  'Replacement Request Type',
  'Replacement Request Status',
  'Replacement Token Hash',
  'Replacement Upload URL',
  'Replacement Requested JSON',
  'Replacement Requested At',
  'Replacement Notification Status',
  'Replacement Notification Sent At',
  'Replacement Received At',
  'Replacement Uploads JSON'
];

function v2DocumentReplacementEnsureHeaders_() {
  const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet=ss.getSheetByName(V2_DOCUMENT_REVIEW_SHEET);
  if(!sheet)throw new Error('V2_DOCUMENT_REVIEW sheet is missing.');
  v2EnsureHeaders_(sheet,V2_DOCUMENT_REVIEW_HEADERS.concat(typeof V2_COMPLIANCE_REVIEW_HEADERS !== 'undefined' ? V2_COMPLIANCE_REVIEW_HEADERS : []).concat(V2_DOC_REPLACEMENT_HEADERS));
  return sheet;
}

function v2SendDocumentReplacementRequest_(data,actor) {
  assertDevIdentity_();
  v2DocumentReplacementEnsureHeaders_();

  const input=data||{};
  const reference=v2Required_(input.referenceNo,'Reference No');
  const requestedBy=String(actor||input.requestedBy||'Student Concierge Agent').trim();

  const app=v2Find_('V2_APPLICATIONS','Reference No',reference);
  const wf=v2Find_('V2_WORKFLOW','Reference No',reference);
  const doc=v2Find_(V2_DOCUMENT_REVIEW_SHEET,'Reference No',reference);
  if(!app||!wf||!doc)throw new Error('Application/workflow/document review record not found.');

  const qualityStatus=String(doc.record['AI Quality Status']||wf.record['Document Quality Status']||'').toUpperCase();
  if(qualityStatus!=='FOLLOW_UP_REQUIRED') {
    throw new Error('Document replacement request is only available when Document Quality Status is FOLLOW_UP_REQUIRED.');
  }

  let requested=[];
  try{requested=JSON.parse(String(doc.record['AI Quality Follow-up JSON']||'[]'));}catch(_){requested=[];}
  if(!Array.isArray(requested)||!requested.length)throw new Error('No replacement document instruction is available.');

  requested=requested.map(function(item){
    return {
      field:String(item&&item.field||'').trim(),
      label:String(item&&item.label||V2_DOCUMENT_LABELS[String(item&&item.field||'')]||'Document').trim(),
      issues:Array.isArray(item&&item.issues)?item.issues.map(String):[],
      instruction:String(item&&item.instruction||'Please upload a clear and complete replacement document.').trim()
    };
  }).filter(function(item){return !!item.field;});

  if(!requested.length)throw new Error('Replacement document fields are missing.');

  const now=new Date().toISOString();
  let uploadUrl=String(doc.record['Replacement Upload URL']||'').trim();
  let tokenHash=String(doc.record['Replacement Token Hash']||'').trim();
  const currentStatus=String(doc.record['Replacement Request Status']||'').toUpperCase();

  if(!uploadUrl||!tokenHash||currentStatus==='RECEIVED'||currentStatus==='CLOSED') {
    const rawToken=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
    tokenHash=v2OfferHashToken_(rawToken);
    const serviceUrl=String(ScriptApp.getService().getUrl()||'').trim();
    uploadUrl=serviceUrl?serviceUrl+'?page=document-replacement-v2&token='+encodeURIComponent(rawToken):'';
  }
  if(!uploadUrl)throw new Error('Secure document replacement upload URL could not be created.');

  const recipient=String(app.record['Personal Email']||'').trim();
  const student=String(app.record['Student Name']||'Applicant').trim();
  const programme=String(app.record['Programme']||'').trim();

  const requestHtml=requested.map(function(item){
    const issue=item.issues.length?'<div style="font-size:12px;color:#7b4350;margin-top:4px"><strong>Issue:</strong> '+v2Html_(item.issues.join('; '))+'</div>':'';
    return '<div style="border:1px solid #e6e2ef;border-radius:12px;padding:13px 14px;margin:10px 0;background:#fbfaff">'+
      '<strong>'+v2Html_(item.label)+'</strong>'+issue+
      '<div style="font-size:12px;color:#5f6572;margin-top:5px">'+v2Html_(item.instruction)+'</div>'+
    '</div>';
  }).join('');

  const subject='[IUC IPGS] Document Replacement Required - '+reference;
  const textBody=
    'Dear '+student+',\n\n'+
    'During the quality review of your admission documents, one or more files require replacement before academic screening can continue.\n\n'+
    requested.map(function(item){return '- '+item.label+': '+item.instruction;}).join('\n')+
    '\n\nSecure upload link:\n'+uploadUrl+
    '\n\nReference: '+reference+'\nProgramme: '+programme+'\n\nIPGS Registry\nInnovative University College';

  const htmlBody='<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">'+
    '<div style="background:#2d2363;color:#fff;padding:22px"><h2 style="margin:0">Document Replacement Required</h2></div>'+
    '<div style="padding:24px"><p>Dear <strong>'+v2Html_(student)+'</strong>,</p>'+
    '<p>During the quality review of your admission documents, one or more files need to be replaced before academic screening can continue.</p>'+
    requestHtml+
    '<div style="margin:20px 0"><a href="'+v2Html_(uploadUrl)+'" style="display:inline-block;background:#2d2363;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Upload Replacement Document(s)</a></div>'+
    '<p style="font-size:12px;color:#6f7581"><strong>Reference:</strong> '+v2Html_(reference)+'<br><strong>Programme:</strong> '+v2Html_(programme)+'</p>'+
    '<p>Regards,<br><strong>IPGS Registry</strong><br>Innovative University College</p></div></div>';

  let notification={sent:false,status:'UNAVAILABLE',mode:'UNAVAILABLE',recipients:[]};
  if(typeof v2NotificationSend_==='function') {
    notification=v2NotificationSend_('DOCUMENT_REPLACEMENT_REQUIRED',[recipient],subject,textBody,htmlBody,{});
  }

  v2UpdateRow_(doc.sheet,doc.rowNumber,{
    'Replacement Request Type':'QUALITY_REPLACEMENT',
    'Replacement Request Status':'AWAITING_STUDENT',
    'Replacement Token Hash':tokenHash,
    'Replacement Upload URL':uploadUrl,
    'Replacement Requested JSON':JSON.stringify(requested),
    'Replacement Requested At':now,
    'Replacement Notification Status':String(notification.status||''),
    'Replacement Notification Sent At':notification.sent?now:'',
    'Applicant Notification Status':String(notification.status||''),
    'Last Updated':now
  });

  let humanTask=null;
  if(!notification.sent&&typeof v2CreateHumanTask_==='function') {
    humanTask=v2CreateHumanTask_({
      referenceNo:reference,
      taskType:'STUDENT_COMMUNICATION_REQUIRED',
      title:'Document replacement request could not be delivered',
      reason:'Student Concierge prepared the replacement request, but the notification was not sent. Status: '+String(notification.status||'UNKNOWN'),
      raisedByAgent:'Student Concierge Agent',
      agentId:'STUDENT_CONCIERGE',
      executionId:String(input.executionId||''),
      priority:'HIGH',
      assignedTo:'Registry / Student Services',
      resumeEvent:'HUMAN_TASK_COMPLETED',
      source:'N8N'
    },requestedBy);
  }

  v2Audit_(reference,'STUDENT_CONCIERGE','DOCUMENT_REPLACEMENT_REQUEST_SENT',{},{
    requestedDocuments:requested,
    uploadUrlCreated:true,
    notificationStatus:notification.status,
    sent:notification.sent
  },requestedBy,notification.sent?'SUCCESS':'PARTIAL','Secure document replacement request prepared.');

  v2InvalidateCache_();
  return {
    ok:true,
    referenceNo:reference,
    status:'AWAITING_STUDENT',
    notification:notification,
    requiresHuman:!notification.sent,
    humanTask:humanTask,
    requestedDocuments:requested,
    uploadUrl:uploadUrl
  };
}

function v2SendMissingDocumentRequest_(data,actor) {
  assertDevIdentity_();
  v2DocumentReplacementEnsureHeaders_();

  const input=data||{};
  const reference=v2Required_(input.referenceNo,'Reference No');
  const requestedBy=String(actor||input.requestedBy||'Student Concierge Agent').trim();

  const app=v2Find_('V2_APPLICATIONS','Reference No',reference);
  const wf=v2Find_('V2_WORKFLOW','Reference No',reference);
  const doc=v2Find_(V2_DOCUMENT_REVIEW_SHEET,'Reference No',reference);
  if(!app||!wf||!doc)throw new Error('Application/workflow/document review record not found.');

  const reviewStatus=String(doc.record['Review Status']||wf.record['Document Review Status']||'').toUpperCase();
  if(reviewStatus!=='INCOMPLETE'){
    throw new Error('Missing-document request is only available when Document Review Status is INCOMPLETE.');
  }

  let missing=[];
  try{missing=JSON.parse(String(doc.record['Missing Documents JSON']||'[]'));}catch(_){missing=[];}
  if(!Array.isArray(missing)||!missing.length)throw new Error('No missing required documents are recorded.');

  const requested=missing.map(function(item){
    const field=String(item&& (item.key||item.field) ||'').trim();
    return {
      field:field,
      label:String(item&&item.label||V2_DOCUMENT_LABELS[field]||field||'Required Document'),
      issues:['Required document was not submitted.'],
      instruction:'Please upload this required admission document in a clear and complete file.'
    };
  }).filter(function(item){return !!item.field;});
  if(!requested.length)throw new Error('Missing document fields are unavailable.');

  const now=new Date().toISOString();
  const rawToken=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  const tokenHash=v2OfferHashToken_(rawToken);
  const serviceUrl=String(ScriptApp.getService().getUrl()||'').trim();
  const uploadUrl=serviceUrl?serviceUrl+'?page=document-replacement-v2&token='+encodeURIComponent(rawToken):'';
  if(!uploadUrl)throw new Error('Secure document upload URL could not be created.');

  const recipient=String(app.record['Personal Email']||'').trim();
  const student=String(app.record['Student Name']||'Applicant').trim();
  const programme=String(app.record['Programme']||'').trim();
  const requestHtml=requested.map(function(item){
    return '<div style="border:1px solid #e6e2ef;border-radius:12px;padding:13px 14px;margin:10px 0;background:#fbfaff">'+
      '<strong>'+v2Html_(item.label)+'</strong>'+
      '<div style="font-size:12px;color:#5f6572;margin-top:5px">'+v2Html_(item.instruction)+'</div>'+
    '</div>';
  }).join('');

  const subject='[IUC IPGS] Missing Admission Document(s) Required - '+reference;
  const textBody=
    'Dear '+student+',\n\n'+
    'Your admission application was received successfully. Before academic screening can continue, please provide the required document(s) listed below.\n\n'+
    requested.map(function(item){return '- '+item.label+': '+item.instruction;}).join('\n')+
    '\n\nSecure upload link:\n'+uploadUrl+
    '\n\nReference: '+reference+'\nProgramme: '+programme+'\n\nIPGS Registry\nInnovative University College';

  const htmlBody='<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden">'+
    '<div style="background:#2d2363;color:#fff;padding:22px"><h2 style="margin:0">Missing Admission Document(s)</h2></div>'+
    '<div style="padding:24px"><p>Dear <strong>'+v2Html_(student)+'</strong>,</p>'+
    '<p>Your application has been received. Before academic screening can continue, please provide the required document(s) below.</p>'+
    requestHtml+
    '<div style="margin:20px 0"><a href="'+v2Html_(uploadUrl)+'" style="display:inline-block;background:#2d2363;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Upload Required Document(s)</a></div>'+
    '<p style="font-size:12px;color:#6f7581"><strong>Reference:</strong> '+v2Html_(reference)+'<br><strong>Programme:</strong> '+v2Html_(programme)+'</p>'+
    '<p>Regards,<br><strong>IPGS Registry</strong><br>Innovative University College</p></div></div>';

  let notification={sent:false,status:'UNAVAILABLE',mode:'UNAVAILABLE',recipients:[]};
  if(typeof v2NotificationSend_==='function'){
    notification=v2NotificationSend_('MISSING_ADMISSION_DOCUMENTS',[recipient],subject,textBody,htmlBody,{});
  }

  v2UpdateRow_(doc.sheet,doc.rowNumber,{
    'Replacement Request Type':'MISSING_REQUIRED_DOCUMENT',
    'Replacement Request Status':'AWAITING_STUDENT',
    'Replacement Token Hash':tokenHash,
    'Replacement Upload URL':uploadUrl,
    'Replacement Requested JSON':JSON.stringify(requested),
    'Replacement Requested At':now,
    'Replacement Notification Status':String(notification.status||''),
    'Replacement Notification Sent At':notification.sent?now:'',
    'Applicant Notification Status':String(notification.status||''),
    'Last Updated':now
  });

  let humanTask=null;
  if(!notification.sent&&typeof v2CreateHumanTask_==='function'){
    humanTask=v2CreateHumanTask_({
      referenceNo:reference,
      taskType:'STUDENT_COMMUNICATION_REQUIRED',
      title:'Missing-document request could not be delivered',
      reason:'Student Concierge prepared the missing-document request, but the notification was not sent. Status: '+String(notification.status||'UNKNOWN'),
      raisedByAgent:'Student Concierge Agent',
      agentId:'STUDENT_CONCIERGE',
      executionId:String(input.executionId||''),
      priority:'HIGH',
      assignedTo:'Registry / Student Services',
      resumeEvent:'HUMAN_TASK_COMPLETED',
      source:'N8N'
    },requestedBy);
  }

  v2Audit_(reference,'STUDENT_CONCIERGE','MISSING_DOCUMENT_REQUEST_SENT',{},{
    requestedDocuments:requested,
    notificationStatus:notification.status,
    sent:notification.sent
  },requestedBy,notification.sent?'SUCCESS':'PARTIAL','Secure missing admission-document request prepared.');

  v2InvalidateCache_();
  return {
    ok:true,
    referenceNo:reference,
    requestType:'MISSING_REQUIRED_DOCUMENT',
    status:'AWAITING_STUDENT',
    notification:notification,
    requiresHuman:!notification.sent,
    humanTask:humanTask,
    requestedDocuments:requested,
    uploadUrl:uploadUrl
  };
}

function v2DocumentReplacementFindByToken_(rawToken) {
  const token=String(rawToken||'').trim();
  if(!token)throw new Error('Document replacement upload token is required.');
  const hash=v2OfferHashToken_(token);
  const row=v2Rows_(V2_DOCUMENT_REVIEW_SHEET).filter(function(item){
    return String(item['Replacement Token Hash']||'')===hash;
  })[0];
  if(!row)throw new Error('This document replacement upload link is invalid or no longer available.');
  return row;
}

function v2GetDocumentReplacementForToken(rawToken) {
  assertDevIdentity_();
  v2DocumentReplacementEnsureHeaders_();
  const row=v2DocumentReplacementFindByToken_(rawToken);
  const reference=String(row['Reference No']||'');
  const app=v2Find_('V2_APPLICATIONS','Reference No',reference);
  if(!app)throw new Error('Application record not found.');

  let requested=[];
  try{requested=JSON.parse(String(row['Replacement Requested JSON']||'[]'));}catch(_){requested=[];}

  return {
    ok:true,
    referenceNo:reference,
    studentName:String(app.record['Student Name']||''),
    programme:String(app.record['Programme']||''),
    intake:String(app.record['Intake']||''),
    requestType:String(row['Replacement Request Type']||'QUALITY_REPLACEMENT'),
    status:String(row['Replacement Request Status']||'AWAITING_STUDENT'),
    requestedDocuments:Array.isArray(requested)?requested:[],
    receivedAt:String(row['Replacement Received At']||'')
  };
}

function v2SubmitDocumentReplacementUpload(rawToken,filesInput) {
  assertDevIdentity_();
  v2DocumentReplacementEnsureHeaders_();

  const tokenRow=v2DocumentReplacementFindByToken_(rawToken);
  const reference=String(tokenRow['Reference No']||'').trim();
  const app=v2Find_('V2_APPLICATIONS','Reference No',reference);
  const wf=v2Find_('V2_WORKFLOW','Reference No',reference);
  const doc=v2Find_(V2_DOCUMENT_REVIEW_SHEET,'Reference No',reference);
  if(!app||!wf||!doc)throw new Error('Application/workflow/document review record not found.');

  if(String(doc.record['Replacement Request Status']||'').toUpperCase()==='RECEIVED') {
    return {ok:true,alreadyReceived:true,referenceNo:reference,status:'RECEIVED'};
  }

  const requestType=String(doc.record['Replacement Request Type']||'QUALITY_REPLACEMENT').toUpperCase();
  let requested=[];
  try{requested=JSON.parse(String(doc.record['Replacement Requested JSON']||'[]'));}catch(_){requested=[];}
  if(!Array.isArray(requested)||!requested.length)throw new Error('Replacement request details are unavailable.');

  const requestedFields=requested.map(function(x){return String(x&&x.field||'');}).filter(Boolean);
  const files=Array.isArray(filesInput)?filesInput:[];
  if(!files.length)throw new Error('Please select the requested replacement document(s).');

  const byField={};
  files.forEach(function(file){
    const field=String(file&&file.field||'').trim();
    if(field)byField[field]=file;
  });

  requestedFields.forEach(function(field){
    if(!byField[field])throw new Error('Replacement file is required for '+String(V2_DOCUMENT_LABELS[field]||field)+'.');
  });

  const allowed=[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];

  let totalBytes=0;
  requestedFields.forEach(function(field){
    const file=byField[field];
    const mime=String(file.mimeType||'').trim();
    const size=Number(file.size||0);
    if(allowed.indexOf(mime)<0)throw new Error('Unsupported file type for '+String(V2_DOCUMENT_LABELS[field]||field)+'.');
    if(size<1||size>V2_DOC_REPLACEMENT_MAX_FILE_BYTES)throw new Error(String(V2_DOCUMENT_LABELS[field]||field)+' must be 7MB or smaller.');
    if(!String(file.base64||'').trim())throw new Error('File content is missing for '+String(V2_DOCUMENT_LABELS[field]||field)+'.');
    totalBytes+=size;
  });
  if(totalBytes>V2_DOC_REPLACEMENT_MAX_TOTAL_BYTES)throw new Error('Total replacement upload must be 18MB or smaller.');

  const folderId=v2OfferExtractDriveId_(String(app.record['Student Folder URL']||wf.record['Student Folder URL']||''));
  if(!folderId)throw new Error('Student folder could not be identified.');
  const folder=DriveApp.getFolderById(folderId);
  const studentToken=v2SafeName_(String(app.record['Student Name']||'STUDENT')).toUpperCase();
  const stamp=Utilities.formatDate(new Date(),CONFIG.timezone||'Asia/Kuala_Lumpur','yyyyMMdd-HHmmss');

  let uploaded=[];
  try{uploaded=JSON.parse(String(app.record['Uploaded Files JSON']||'[]'));}catch(_){uploaded=[];}
  if(!Array.isArray(uploaded))uploaded=[];

  const replacementRecords=[];
  requestedFields.forEach(function(field){
    const file=byField[field];
    const previous=uploaded.filter(function(item){return String(item&&item.field||'')===field;});

    previous.forEach(function(item){
      const idMatch=String(item&&item.url||'').match(/[-\w]{20,}/);
      if(!idMatch)return;
      try{
        const oldFile=DriveApp.getFileById(idMatch[0]);
        if(oldFile&&!/^SUPERSEDED_/i.test(oldFile.getName()))oldFile.setName('SUPERSEDED_'+stamp+'_'+oldFile.getName());
      }catch(_){}
    });

    uploaded=uploaded.filter(function(item){return String(item&&item.field||'')!==field;});

    const mime=String(file.mimeType||'');
    const extension=v2DocumentReplacementExtension_(mime,String(file.fileName||''));
    const prefix=v2DocumentReplacementPrefix_(field);
    const canonicalName=prefix+'_'+studentToken+extension;
    const blob=Utilities.newBlob(Utilities.base64Decode(String(file.base64||'')),mime,canonicalName);
    const saved=folder.createFile(blob);

    const record={
      field:field,
      fileName:saved.getName(),
      url:saved.getUrl(),
      mimeType:mime,
      size:Number(file.size||0),
      replacementReceivedAt:new Date().toISOString()
    };
    uploaded.push(record);
    replacementRecords.push(record);
  });

  const now=new Date().toISOString();
  v2UpdateRow_(app.sheet,app.rowNumber,{
    'Uploaded Files JSON':JSON.stringify(uploaded),
    'Last Updated':now
  });

  v2UpdateRow_(doc.sheet,doc.rowNumber,{
    'Replacement Request Status':'RECEIVED',
    'Replacement Received At':now,
    'Replacement Uploads JSON':JSON.stringify(replacementRecords),
    'Last Updated':now
  });

  let handoff=null;
  let localFallback=null;
  let completenessResult=null;

  if(requestType==='MISSING_REQUIRED_DOCUMENT'){
    v2Audit_(reference,'DOCUMENT_REVIEW','MISSING_DOCUMENT_RECEIVED',{},{
      fields:requestedFields,
      files:replacementRecords
    },'Applicant','SUCCESS','Requested missing admission document(s) uploaded through secure link.');

    completenessResult=v2RunDocumentReview(
      reference,
      'Student Concierge Upload Recheck',
      'Automatic deterministic completeness re-check after missing document upload.'
    );

    if(String(completenessResult.status||'').toUpperCase()==='INCOMPLETE' &&
       typeof v2AgenticEnabled_==='function'&&v2AgenticEnabled_()&&typeof v2EmitAgentEvent_==='function'){
      handoff=v2EmitAgentEvent_({
        referenceNo:reference,
        eventType:'DOCUMENT_MISSING_REQUIRED',
        agentId:'ORCHESTRATOR',
        agentName:'AI Orchestrator',
        action:'ROUTE_STUDENT_CONCIERGE',
        status:'QUEUED',
        fromStage:'DOCUMENT_REVIEW',
        toStage:'DOCUMENT_REVIEW',
        source:'APPLICANT_UPLOAD',
        summary:'Missing-document upload was received, but deterministic completeness still shows required document(s) outstanding.',
        data:{
          fields:requestedFields,
          missingDocuments:completenessResult.missingDocuments||[],
          missingCount:Number(completenessResult.missingCount||0)
        }
      });
    }
  }else{
    v2UpdateRow_(doc.sheet,doc.rowNumber,{
      'AI Quality Status':'PENDING_REVIEW',
      'AI Quality Confidence':'',
      'Last Updated':now
    });

    v2UpdateRow_(wf.sheet,wf.rowNumber,{
      'Document Quality Status':'PENDING_REVIEW',
      'Document Quality Confidence':'',
      'Last Updated':now,
      'Updated By':'Student Document Replacement Upload'
    });

    v2Audit_(reference,'DOCUMENT_REVIEW','DOCUMENT_REPLACEMENT_RECEIVED',{},{
      fields:requestedFields,
      files:replacementRecords
    },'Applicant','SUCCESS','Requested replacement document(s) uploaded through secure link.');

    if(typeof v2AgenticEnabled_==='function'&&v2AgenticEnabled_()&&typeof v2EmitAgentEvent_==='function') {
      handoff=v2EmitAgentEvent_({
        referenceNo:reference,
        eventType:'DOCUMENT_REPLACEMENT_RECEIVED',
        agentId:'ORCHESTRATOR',
        agentName:'AI Orchestrator',
        action:'ROUTE_COMPLIANCE',
        status:'QUEUED',
        fromStage:'DOCUMENT_REVIEW',
        toStage:'DOCUMENT_REVIEW',
        source:'APPLICANT_UPLOAD',
        summary:'Requested quality replacement document(s) received. Route back to Compliance & Records Agent.',
        data:{fields:requestedFields}
      });
    }

    if(!handoff||!handoff.sent) {
      try {
        localFallback=v2RunComplianceDocumentQuality_({referenceNo:reference},'Replacement Upload Local Compliance Fallback');
        if(localFallback&&localFallback.status==='PASS') {
          localFallback.admissionIntelligence=v2TryAutoAiScreening_(reference,'Replacement Upload Local Admission Intelligence Fallback');
        }
      } catch(error) {
        localFallback={ok:false,message:String(error&&error.message||error)};
      }
    }
  }

  try{
    if(typeof v2NotificationSend_==='function'){
      const recipient=String(app.record['Personal Email']||'').trim();
      const html='<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto"><h2 style="color:#2d2363">Replacement Document Received</h2><p>Dear <strong>'+v2Html_(app.record['Student Name']||'Applicant')+'</strong>,</p><p>Your requested replacement document(s) have been received successfully and added to your admission record.</p><p><strong>Reference:</strong> '+v2Html_(reference)+'</p><p>Your document review will continue automatically.</p></div>';
      v2NotificationSend_('DOCUMENT_REPLACEMENT_RECEIVED',[recipient],'[IUC IPGS] Replacement Document Received - '+reference,'Your replacement document(s) have been received. Reference: '+reference,html,{});
    }
  }catch(emailError){
    Logger.log('Replacement confirmation email failed non-blocking: '+String(emailError&&emailError.message||emailError));
  }

  v2InvalidateCache_();
  return {
    ok:true,
    referenceNo:reference,
    status:'RECEIVED',
    requestType:requestType,
    receivedAt:now,
    files:replacementRecords,
    completenessResult:completenessResult,
    agenticHandoff:handoff,
    localFallback:localFallback
  };
}

function v2DocumentReplacementPrefix_(field) {
  const map={
    identityDocument:'IDENTITYDOCUMENT',
    passportPhoto:'PASSPORTPHOTO',
    passportCopyInternational:'PASSPORTCOPY',
    transcript:'TRANSCRIPT',
    certificate:'CERTIFICATE',
    apelCertificate:'APELCERTIFICATE',
    cvResume:'CVRESUME',
    otherSupportingDocument:'SUPPORTINGDOCUMENT',
    completedAdmissionForm:'INTERNATIONAL_ADMISSION_FORM',
    completedHealthDeclaration:'HEALTH_DECLARATION',
    emgsPaymentReceipt:'EMGS_PAYMENT_RECEIPT',
    preliminaryResearchIntent:'PRELIMINARY_RESEARCH_INTENT'
  };
  return map[String(field||'')]||String(field||'DOCUMENT').replace(/[^A-Za-z0-9]+/g,'_').toUpperCase();
}

function v2DocumentReplacementExtension_(mime,fileName) {
  if(mime==='application/pdf')return '.pdf';
  if(mime==='image/jpeg')return '.jpg';
  if(mime==='image/png')return '.png';
  if(mime==='application/msword')return '.doc';
  if(mime==='application/vnd.openxmlformats-officedocument.wordprocessingml.document')return '.docx';
  const match=String(fileName||'').match(/\.[A-Za-z0-9]+$/);
  return match?match[0].toLowerCase():'';
}

function v2RenderDocumentReplacementPage_(params) {
  assertDevIdentity_();
  const template=HtmlService.createTemplateFromFile('document-replacement-v2');
  template.token=String(params&&(params.token||params.t)||'');
  return template.evaluate().setTitle('IUC Admission Document Replacement');
}
