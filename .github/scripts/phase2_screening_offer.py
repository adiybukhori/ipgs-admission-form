from pathlib import Path

# 1. Route new protected actions through the V2 dispatcher.
p = Path('apps-script-v2/WorkflowV2.js')
s = p.read_text(encoding='utf-8')
anchor = "  if (action === 'v2RecordAiScreeningResult') return v2RecordAiScreeningResult_(payload.data || {}, payload.updatedBy);"
routes = """  if (action === 'v2RunAutoAiScreening') return v2TryAutoAiScreening_((payload.data || {}).referenceNo, payload.updatedBy || 'Admin Portal V2');
  if (action === 'v2CompleteManualQualificationScreening') return v2CompleteManualQualificationScreening_(payload.data || {}, payload.updatedBy || 'Admin Portal V2');
  if (action === 'v2IssueOffer') return v2IssueOffer_((payload.data || {}).referenceNo, payload.updatedBy || 'Admin Portal V2', payload.data || {});
"""
if "v2CompleteManualQualificationScreening" not in s:
    if anchor not in s:
        raise SystemExit('Workflow route anchor not found')
    s = s.replace(anchor, routes + anchor, 1)
p.write_text(s, encoding='utf-8')

# 2. Automatically ATTEMPT AI after documents are complete.
p = Path('apps-script-v2/DocumentReviewV2.js')
s = p.read_text(encoding='utf-8')
marker = 'V2_AUTO_AI_AFTER_DOCUMENT_REVIEW_V1'
if marker not in s:
    anchor = "  const report = {\n    ok: true,\n    referenceNo: reference,\n    status: status,"
    replacement = """  // V2_AUTO_AI_AFTER_DOCUMENT_REVIEW_V1
  // AI gets the first automatic attempt. Any failure, missing API key or
  // low-confidence result is non-blocking: Registry can immediately use the
  // manual screening button as the second layer.
  let autoAiScreening = null;
  if (status === 'COMPLETE') {
    try {
      autoAiScreening = v2TryAutoAiScreening_(reference, 'Document Review Auto Trigger');
    } catch (autoAiError) {
      autoAiScreening = {
        ok: false,
        status: 'AUTO_FAILED',
        message: String(autoAiError && autoAiError.message || autoAiError),
        manualScreeningAvailable: true
      };
      Logger.log('V2 auto AI screening failed non-blocking: ' + autoAiScreening.message);
    }
  }

  const report = {
    ok: true,
    referenceNo: reference,
    status: status,"""
    if anchor not in s:
        raise SystemExit('Document review report anchor not found')
    s = s.replace(anchor, replacement, 1)
    old = "    applicationStage: 'DOCUMENT_REVIEW',\n\n    emailSent: false,"
    new = "    applicationStage: 'DOCUMENT_REVIEW',\n    autoAiScreening: autoAiScreening,\n    manualScreeningAvailable: status === 'COMPLETE',\n\n    emailSent: false,"
    if old not in s:
        raise SystemExit('Document review report fields anchor not found')
    s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

# 3. Provider-backed auto AI + race-safe manual completion.
p = Path('apps-script-v2/AIScreeningV2.js')
s = p.read_text(encoding='utf-8')
marker = 'V2_AI_AUTO_AND_MANUAL_SECOND_LAYER_V1'
if marker not in s:
    append = r'''

// V2_AI_AUTO_AND_MANUAL_SECOND_LAYER_V1
// AI auto screening is an accelerator only. The deterministic qualification
// rule engine remains the route engine. Manual screening can win the race at
// any time while the application is still in DOCUMENT_REVIEW or
// QUALIFICATION_SCREENING.

function v2TryAutoAiScreening_(referenceNo, actor) {
  assertDevIdentity_();
  const reference = String(referenceNo || '').trim();
  if (!reference) throw new Error('Reference No is required.');

  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  const documentReview = v2Find_('V2_DOCUMENT_REVIEW', 'Reference No', reference);
  if (!workflow || !application) throw new Error('V2 application/workflow record not found.');
  if (!documentReview || String(documentReview.record['Review Status'] || '') !== 'COMPLETE') {
    return {ok:false, status:'WAITING_FOR_DOCUMENTS', manualScreeningAvailable:false};
  }

  const startStage = String(workflow.record['Application Stage'] || '');
  if (['DOCUMENT_REVIEW','QUALIFICATION_SCREENING'].indexOf(startStage) < 0) {
    return {
      ok:true, skipped:true, status:'RACE_ALREADY_RESOLVED',
      winner:'MANUAL_OR_PRIOR_SCREENING', applicationStage:startStage,
      manualScreeningAvailable:false
    };
  }

  const properties = PropertiesService.getScriptProperties();
  const enabled = String(properties.getProperty('V2_AI_AUTO_ENABLED') || 'TRUE').toUpperCase() !== 'FALSE';
  if (!enabled) {
    v2AiSetAutoStatus_(reference, 'AUTO_DISABLED', ['AI_AUTO_DISABLED']);
    return {ok:true, status:'AUTO_DISABLED', manualScreeningAvailable:true};
  }

  const apiKey = String(properties.getProperty('OPENAI_API_KEY') || '').trim();
  if (!apiKey) {
    v2AiSetAutoStatus_(reference, 'AUTO_PENDING', ['OPENAI_API_KEY_MISSING']);
    return {
      ok:true, status:'AUTO_PENDING', reason:'OPENAI_API_KEY_MISSING',
      manualScreeningAvailable:true
    };
  }

  v2AiSetAutoStatus_(reference, 'AUTO_RUNNING', []);
  let aiResult;
  try {
    aiResult = v2CallOpenAiScreening_(application.record, apiKey);
  } catch (error) {
    v2AiSetAutoStatus_(reference, 'AUTO_FAILED', [String(error && error.message || error)]);
    return {
      ok:false, status:'AUTO_FAILED',
      message:String(error && error.message || error),
      manualScreeningAvailable:true
    };
  }

  const recorded = v2RecordAiScreeningResult_({
    referenceNo: reference,
    provider: 'OPENAI',
    model: aiResult.model,
    promptVersion: V2_AI_PROMPT_VERSION,
    sourceDocuments: aiResult.sourceDocuments,
    runId: aiResult.runId,
    result: aiResult.result,
    rawResult: aiResult.raw
  }, actor || 'AI Auto Screening');

  const normalized = recorded.normalized || {};
  const threshold = v2AiConfigNumber_('AI_CONFIDENCE_REVIEW_THRESHOLD', 0.80);
  const safeForRuleEngine =
    Number(normalized.confidence || 0) >= threshold &&
    Array.isArray(normalized.flags) && normalized.flags.length === 0 &&
    ['RELATED','PARTIALLY_RELATED','NON_RELATED'].indexOf(String(normalized.fieldClassification || '')) > -1 &&
    ['YES','NO'].indexOf(String(normalized.relevantWorkExperience || '')) > -1;

  if (!safeForRuleEngine) {
    const row = v2Find_(V2_AI_SCREENING_SHEET, 'Reference No', reference);
    if (row) v2UpdateRow_(row.sheet, row.rowNumber, {
      'Status':'REVIEW_REQUIRED',
      'Last Updated':new Date().toISOString()
    });
    return {
      ok:true, status:'REVIEW_REQUIRED', aiRecorded:true,
      confidence:Number(normalized.confidence || 0),
      manualScreeningAvailable:true
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const fresh = v2Find_('V2_WORKFLOW', 'Reference No', reference);
    const freshStage = fresh ? String(fresh.record['Application Stage'] || '') : '';
    if (['DOCUMENT_REVIEW','QUALIFICATION_SCREENING'].indexOf(freshStage) < 0) {
      const row = v2Find_(V2_AI_SCREENING_SHEET, 'Reference No', reference);
      if (row) v2UpdateRow_(row.sheet, row.rowNumber, {
        'Status':'MANUAL_WON',
        'Last Updated':new Date().toISOString()
      });
      return {
        ok:true, skipped:true, status:'MANUAL_WON', winner:'MANUAL',
        applicationStage:freshStage, manualScreeningAvailable:false
      };
    }

    const screening = v2RunQualificationScreening(reference, {
      fieldClassification: normalized.fieldClassification,
      relevantWorkExperience: normalized.relevantWorkExperience,
      screenedBy: actor || 'AI Auto + Rule Engine',
      remarks: 'Auto AI document classification accepted at confidence ' + normalized.confidence + '; deterministic V2 qualification rule engine executed.'
    });

    const aiRow = v2Find_(V2_AI_SCREENING_SHEET, 'Reference No', reference);
    if (aiRow) v2UpdateRow_(aiRow.sheet, aiRow.rowNumber, {
      'Status': screening.manualReviewRequired ? 'REVIEW_REQUIRED' : 'AUTO_COMPLETED',
      'Last Updated':new Date().toISOString()
    });

    return {
      ok:true,
      status:screening.manualReviewRequired ? 'REVIEW_REQUIRED' : 'AUTO_COMPLETED',
      winner:screening.manualReviewRequired ? '' : 'AI_AUTO',
      screening:screening,
      manualScreeningAvailable:!!screening.manualReviewRequired
    };
  } finally {
    lock.releaseLock();
  }
}

function v2CompleteManualQualificationScreening_(data, actor) {
  assertDevIdentity_();
  const input = data || {};
  const reference = v2Required_(input.referenceNo, 'Reference No');
  const reviewer = String(actor || input.screenedBy || 'Registry Manual Screening').trim();
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
    const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
    const documentReview = v2Find_('V2_DOCUMENT_REVIEW', 'Reference No', reference);
    if (!workflow || !application) throw new Error('V2 application/workflow record not found.');
    if (!documentReview || String(documentReview.record['Review Status'] || '') !== 'COMPLETE') {
      throw new Error('Manual screening blocked: document review is not COMPLETE.');
    }

    const currentStage = String(workflow.record['Application Stage'] || '');
    if (['DOCUMENT_REVIEW','QUALIFICATION_SCREENING'].indexOf(currentStage) < 0) {
      return {
        ok:true, skipped:true, winner:'AI_AUTO_OR_PRIOR',
        applicationStage:currentStage,
        message:'Screening was already resolved before the manual action.'
      };
    }

    const field = v2QualificationNormalizeField_(input.fieldClassification);
    const experience = v2QualificationNormalizeWorkExperience_(input.relevantWorkExperience);
    const recommendation = String(input.recommendedRoute || '').trim().toUpperCase();
    const allowed = ['DIRECT_ENTRY','NORMAL_ADMISSION_SCREENING','INTERNAL_ASSESSMENT','NOT_ELIGIBLE_CONVENTIONAL'];
    if (!field) throw new Error('Field Classification is required.');
    if (!experience) throw new Error('Relevant Work Experience is required.');
    if (allowed.indexOf(recommendation) < 0) {
      throw new Error('Select a valid manual screening recommendation.');
    }

    if (currentStage === 'DOCUMENT_REVIEW') {
      v2UpdateStage_({referenceNo:reference,stage:'QUALIFICATION_SCREENING',remarks:'Manual qualification screening started.'}, reviewer);
    }

    const now = new Date().toISOString();
    v2Upsert_(V2_QUALIFICATION_SCREENING_SHEET, 'Reference No', reference, {
      'Reference No':reference,
      'Student Name':application.record['Student Name'] || '',
      'Programme':application.record['Programme'] || '',
      'Highest Qualification':application.record['Highest Qualification'] || '',
      'Qualification Field':application.record['Field of Study'] || '',
      'Academic Result':application.record['Academic Result / CGPA / Grade'] || '',
      'Field Classification':field,
      'Relevant Work Experience':experience,
      'Screening Result':'MANUAL_SCREENING_COMPLETED',
      'Recommended Route':recommendation,
      'Rule Code':'MANUAL_SECOND_LAYER',
      'Screening Remarks':String(input.remarks || ''),
      'Screened At':now,
      'Screened By':reviewer,
      'Manual Review Required':'NO',
      'Last Updated':now
    });

    const refreshed = v2Find_('V2_WORKFLOW', 'Reference No', reference);
    v2UpdateRow_(refreshed.sheet, refreshed.rowNumber, {
      'Qualification Screening Status':'COMPLETED_MANUAL',
      'Field Classification':field,
      'Relevant Work Experience':experience,
      'Qualification Rule Code':'MANUAL_SECOND_LAYER',
      'Qualification Screened At':now,
      'Qualification Screened By':reviewer,
      'Manual Review Required':'NO',
      'Screening Recommendation':recommendation,
      'Last Updated':now,
      'Updated By':reviewer
    });

    v2UpdateStage_({
      referenceNo:reference,
      stage:'READY_FOR_SAC',
      remarks:'Manual second-layer screening completed. Recommendation: ' + recommendation
    }, reviewer);

    const aiRow = v2Find_(V2_AI_SCREENING_SHEET, 'Reference No', reference);
    if (aiRow && !/AUTO_COMPLETED/.test(String(aiRow.record['Status'] || ''))) {
      v2UpdateRow_(aiRow.sheet, aiRow.rowNumber, {
        'Status':'MANUAL_WON',
        'Last Updated':now
      });
    }

    v2Audit_(reference,'QUALIFICATION_SCREENING','MANUAL_SECOND_LAYER_COMPLETED',{}, {
      fieldClassification:field,
      relevantWorkExperience:experience,
      recommendedRoute:recommendation,
      winner:'MANUAL'
    }, reviewer, 'SUCCESS', String(input.remarks || ''));
    v2InvalidateCache_();

    return {
      ok:true, referenceNo:reference, winner:'MANUAL',
      screeningStatus:'COMPLETED_MANUAL', recommendedRoute:recommendation,
      applicationStage:'READY_FOR_SAC', nextAction:'SAC_PREPARATION'
    };
  } finally {
    lock.releaseLock();
  }
}

function v2AiSetAutoStatus_(reference, status, flags) {
  const now = new Date().toISOString();
  const existing = v2Find_(V2_AI_SCREENING_SHEET, 'Reference No', reference);
  const row = {
    'Reference No':reference,'Provider':'OPENAI','Model':'','Prompt Version':V2_AI_PROMPT_VERSION,
    'Schema Version':V2_AI_SCHEMA_VERSION,'Status':status,'Source Documents JSON':'[]',
    'Qualification':'','Institution':'','Field of Study':'','CGPA / Grade':'','Graduation Year':'',
    'Relevant Work Experience':'','Work Experience Summary':'','Field Classification':'','Confidence':'',
    'Evidence JSON':'[]','Flags JSON':JSON.stringify(flags || []),'Raw Result JSON':'{}','Normalized Result JSON':'{}',
    'AI Screened At':'','AI Run ID':'','Human Review Status':'PENDING','Human Reviewed At':'','Human Reviewed By':'',
    'Human Field Classification':'','Human Relevant Work Experience':'','Human Remarks':'','Confirmed For Rule Engine':'NO',
    'Last Updated':now
  };
  if (existing) {
    v2UpdateRow_(existing.sheet, existing.rowNumber, {'Status':status,'Flags JSON':row['Flags JSON'],'Last Updated':now});
  } else {
    v2Append_(V2_AI_SCREENING_SHEET, row);
  }
  v2InvalidateCache_();
}

function v2CallOpenAiScreening_(application, apiKey) {
  const properties = PropertiesService.getScriptProperties();
  const model = String(properties.getProperty('V2_AI_MODEL') || 'gpt-5.6-luna').trim();
  const uploaded = v2AiReadApplicationDocuments_(application);
  const content = [{
    type:'input_text',
    text:[
      'Screen this postgraduate admission application using ONLY the supplied application data and documents.',
      'Do not make the final admission decision. Extract evidence and classify only.',
      'Target programme: ' + String(application['Programme'] || ''),
      'Declared highest qualification: ' + String(application['Highest Qualification'] || ''),
      'Declared institution: ' + String(application['Institution / Awarding Body'] || ''),
      'Declared field: ' + String(application['Field of Study'] || ''),
      'Declared academic result: ' + String(application['Academic Result / CGPA / Grade'] || ''),
      'Field Classification means relationship of the qualification to the target programme.',
      'Relevant Work Experience means evidence of work experience relevant to the target programme.',
      'If evidence is insufficient, use UNKNOWN and add a flag.'
    ].join('\n')
  }];
  uploaded.items.forEach(function(item) { content.push(item); });
  const schema = {
    type:'object', additionalProperties:false,
    properties:{
      qualification:{type:'string'}, institution:{type:'string'}, fieldOfStudy:{type:'string'},
      cgpaGrade:{type:'string'}, graduationYear:{type:'string'},
      relevantWorkExperience:{type:'string',enum:['YES','NO','UNKNOWN']},
      workExperienceSummary:{type:'string'},
      fieldClassification:{type:'string',enum:['RELATED','PARTIALLY_RELATED','NON_RELATED','UNKNOWN']},
      confidence:{type:'number',minimum:0,maximum:1},evidence:{type:'array',items:{type:'string'}},flags:{type:'array',items:{type:'string'}}
    },
    required:['qualification','institution','fieldOfStudy','cgpaGrade','graduationYear','relevantWorkExperience','workExperienceSummary','fieldClassification','confidence','evidence','flags']
  };
  const request = {
    model:model,store:false,reasoning:{effort:'low'},
    instructions:'You are the IUC IPGS admission document screening assistant. Be conservative. Never invent qualification, CGPA, field relationship or work experience. Return only the required structured output.',
    input:[{role:'user',content:content}],
    text:{format:{type:'json_schema',name:'iuc_admission_screening',description:'Normalized admission document screening output',strict:true,schema:schema}}
  };
  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses', {
    method:'post',contentType:'application/json',headers:{Authorization:'Bearer ' + apiKey},
    payload:JSON.stringify(request),muteHttpExceptions:true
  });
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code < 200 || code >= 300) throw new Error('OPENAI_HTTP_' + code + ': ' + text.slice(0,600));
  const raw = JSON.parse(text);
  const outputText = v2AiExtractResponseText_(raw);
  if (!outputText) throw new Error('OpenAI response did not contain output_text.');
  return {model:model,runId:String(raw.id || ''),sourceDocuments:uploaded.sources,result:JSON.parse(outputText),raw:{id:raw.id || '',status:raw.status || '',model:raw.model || model}};
}

function v2AiReadApplicationDocuments_(application) {
  let files = [];
  try { files = JSON.parse(String(application['Uploaded Files JSON'] || '[]')); } catch (_) { files = []; }
  if (!Array.isArray(files)) files = [];
  const wanted = ['transcript','certificate','cvResume','preliminaryResearchIntent','otherSupportingDocument'];
  const selected = files.filter(function(file) { return wanted.indexOf(String(file && file.field || '')) > -1; });
  const items = [], sources = [];
  let totalBytes = 0;
  const maxTotal = 12 * 1024 * 1024;
  selected.some(function(meta) {
    const idMatch = String(meta.url || '').match(/[-\w]{20,}/);
    if (!idMatch) return false;
    try {
      const file = DriveApp.getFileById(idMatch[0]);
      const blob = file.getBlob();
      const bytes = blob.getBytes();
      if (totalBytes + bytes.length > maxTotal) return false;
      totalBytes += bytes.length;
      const mime = String(blob.getContentType() || meta.mimeType || 'application/pdf');
      const base64 = Utilities.base64Encode(bytes);
      if (/^image\/(png|jpeg)$/i.test(mime)) items.push({type:'input_image',image_url:'data:' + mime + ';base64,' + base64,detail:'auto'});
      else if (mime === 'application/pdf') items.push({type:'input_file',filename:String(meta.fileName || file.getName() || 'document.pdf'),file_data:base64});
      sources.push({field:String(meta.field || ''),fileName:String(meta.fileName || file.getName()),mimeType:mime,size:bytes.length});
    } catch (error) {
      sources.push({field:String(meta.field || ''),fileName:String(meta.fileName || ''),error:String(error && error.message || error)});
    }
    return totalBytes >= maxTotal;
  });
  return {items:items,sources:sources,totalBytes:totalBytes};
}

function v2AiExtractResponseText_(response) {
  if (response && typeof response.output_text === 'string' && response.output_text) return response.output_text;
  const output = response && Array.isArray(response.output) ? response.output : [];
  for (let i=0;i<output.length;i++) {
    const content = Array.isArray(output[i].content) ? output[i].content : [];
    for (let j=0;j<content.length;j++) {
      if (content[j] && content[j].type === 'output_text' && typeof content[j].text === 'string') return content[j].text;
    }
  }
  return '';
}

function v2ManualScreeningRaceControlledTest() {
  assertDevIdentity_();
  const stamp = Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'yyyyMMdd-HHmmss');
  const reference = 'V2-MANUAL-RACE-TEST-' + stamp;
  const now = new Date().toISOString();
  v2Append_('V2_APPLICATIONS', {'Reference No':reference,'Submitted At':now,'Applicant Type':'Local (Malaysian Citizen)','Student Name':'V2 MANUAL SCREEN TEST ' + stamp,'ID / Passport No':'TEST-' + stamp,'Personal Email':'NO-EMAIL-TEST','Programme':'MBA - Master of Business Administration','Level of Study':'Master','Study Mode':'Online','Intake':'September 2026','Entry Qualification Type':'Academic Qualification','Highest Qualification':'Bachelor Degree','Institution / Awarding Body':'IUC Test','Field of Study':'Business Administration','Academic Result / CGPA / Grade':'3.00','Uploaded Files JSON':'[]','Application Status':'TEST','Email Status':'DISABLED','Last Updated':now,'Version':'MANUAL_RACE_CONTROLLED_TEST'});
  v2Append_('V2_WORKFLOW', {'Reference No':reference,'Student Name':'V2 MANUAL SCREEN TEST ' + stamp,'Programme':'MBA - Master of Business Administration','Application Stage':'DOCUMENT_REVIEW','Application Status':'TEST','Document Review Status':'COMPLETE','Screening Recommendation':'PENDING_QUALIFICATION_SCREENING','Offer Letter Status':'NOT_ISSUED','Acceptance Status':'NOT_OPEN','Last Updated':now,'Updated By':'Controlled Test','Version':V2_BUILD});
  v2Append_(V2_DOCUMENT_REVIEW_SHEET, {'Reference No':reference,'Student Name':'V2 MANUAL SCREEN TEST ' + stamp,'Programme':'MBA - Master of Business Administration','Review Status':'COMPLETE','Required Documents JSON':'[]','Submitted Documents JSON':'[]','Missing Documents JSON':'[]','Reviewed At':now,'Reviewed By':'Controlled Test','Last Updated':now});
  const manual = v2CompleteManualQualificationScreening_({referenceNo:reference,fieldClassification:'RELATED',relevantWorkExperience:'YES',recommendedRoute:'DIRECT_ENTRY',remarks:'Controlled manual second-layer test.'}, 'Controlled Manual Screening Test');
  const autoAfter = v2TryAutoAiScreening_(reference, 'Controlled Auto After Manual');
  const finalWorkflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  const checks = {manualCompleted:manual && manual.ok === true && manual.winner === 'MANUAL',stageReadyForSac:String(finalWorkflow.record['Application Stage'] || '') === 'READY_FOR_SAC',autoDidNotOverwrite:autoAfter && autoAfter.skipped === true,recommendationPreserved:String(finalWorkflow.record['Screening Recommendation'] || '') === 'DIRECT_ENTRY'};
  const report = {ok:Object.keys(checks).every(function(k){return checks[k]===true;}),referenceNo:reference,checks:checks,manual:manual,autoAfter:autoAfter,v1Touched:false};
  Logger.log(JSON.stringify(report));
  return report;
}
'''
    s = s.rstrip() + append + '\n'
p.write_text(s, encoding='utf-8')

# 4. Reliable acceptance URL + atomic issue-offer orchestration.
p = Path('apps-script-v2/OfferLetterV2.js')
s = p.read_text(encoding='utf-8')
if 'V2_OFFER_ACCEPTANCE_E2E_V1' not in s:
    old = """  const baseUrl =
    String(
      CONFIG.acceptanceSigningBaseUrl ||
      ''
    ).trim();

  const acceptanceUrl =
    baseUrl
      ? baseUrl +
        (baseUrl.indexOf('?') > -1
          ? '&'
          : '?') +
        'token=' +
        encodeURIComponent(rawToken)
      : '';"""
    new = """  // Prefer the deployed Apps Script service itself so the e-sign page is
  // always on the same backend version that validates the token.
  const serviceUrl = String(ScriptApp.getService().getUrl() || '').trim();
  const configuredBaseUrl = String(CONFIG.acceptanceSigningBaseUrl || '').trim();
  const baseUrl = serviceUrl ? serviceUrl + '?page=acceptance-v2' : configuredBaseUrl;

  const acceptanceUrl = baseUrl
    ? baseUrl + (baseUrl.indexOf('?') > -1 ? '&' : '?') + 'token=' + encodeURIComponent(rawToken)
    : '';"""
    if old not in s:
        raise SystemExit('Offer acceptance URL anchor not found')
    s = s.replace(old, new, 1)
    append = r'''

// V2_OFFER_ACCEPTANCE_E2E_V1
function v2IssueOffer_(referenceNo, actor, options) {
  assertDevIdentity_();
  const reference = String(referenceNo || '').trim();
  if (!reference) throw new Error('Reference No is required.');
  const opts = options || {};
  const prepared = v2PrepareOffer_(reference, actor || 'Offer Issuance');
  const generated = v2GenerateOfferLetter_(reference, actor || 'Offer Issuance');
  let email = {sent:false,mode:'NOT_REQUESTED'};
  if (opts.sendEmail === true) {
    email = v2SendOfferEmail_(reference, prepared.acceptanceSigningUrl, generated.pdfFileId, {testMode:opts.testMode === true,testRecipient:String(opts.testRecipient || '')});
  }
  return {ok:true,referenceNo:reference,offerLetterStatus:generated.offerLetterStatus,applicationStage:generated.applicationStage,offerLetterPdfUrl:generated.offerLetterPdfUrl,acceptanceSigningUrl:prepared.acceptanceSigningUrl,emailSent:!!email.sent,emailMode:email.mode || '',emailRecipient:email.recipient || '',v1Touched:false};
}

function v2SendOfferEmail_(referenceNo, acceptanceUrl, pdfFileId, options) {
  const reference = String(referenceNo || '').trim();
  const application = v2Find_('V2_APPLICATIONS','Reference No',reference);
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!application || !workflow) throw new Error('Application/workflow record not found.');
  if (String(workflow.record['Offer Letter Status'] || '') !== 'ISSUED') throw new Error('Offer email blocked: Offer Letter is not ISSUED.');
  const opts = options || {};
  const actualRecipient = String(application.record['Personal Email'] || '').trim();
  const testRecipient = String(opts.testRecipient || PropertiesService.getScriptProperties().getProperty('V2_TEST_EMAIL') || 'adiybukhori@innovative.edu.my').trim();
  const recipient = opts.testMode === true ? testRecipient : actualRecipient;
  if (!recipient) throw new Error('Offer email recipient is missing.');
  if (!acceptanceUrl) throw new Error('Acceptance signing URL is missing.');
  const student = String(application.record['Student Name'] || 'Student');
  const programme = String(application.record['Programme'] || '');
  const intake = String(application.record['Intake'] || '');
  const subject = '[IUC IPGS] Offer Letter - ' + programme + ' - ' + reference;
  const html = '<div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden"><div style="background:#2d2363;color:white;padding:24px"><h2 style="margin:0">Offer of Admission</h2></div><div style="padding:24px"><p>Dear ' + v2Html_(student) + ',</p><p>We are pleased to issue your Offer Letter for <strong>' + v2Html_(programme) + '</strong>.</p><p><strong>Reference:</strong> ' + v2Html_(reference) + '<br><strong>Intake:</strong> ' + v2Html_(intake) + '</p><p>Please review the attached Offer Letter. To accept the offer, complete your electronic acceptance using the secure link below:</p><p style="margin:24px 0"><a href="' + v2Html_(acceptanceUrl) + '" style="background:#2d2363;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:bold">Accept Offer</a></p><p>If the button does not open, copy this link into your browser:<br>' + v2Html_(acceptanceUrl) + '</p></div></div>';
  const attachment = DriveApp.getFileById(pdfFileId).getBlob();
  GmailApp.sendEmail(recipient, subject, 'Your IUC Offer Letter is attached. Acceptance link: ' + acceptanceUrl, {htmlBody:html,attachments:[attachment],name:'IUC IPGS Admission'});
  v2Audit_(reference,'OFFER','SEND_OFFER_EMAIL',{}, {recipient:recipient,testMode:opts.testMode === true}, 'Offer Email', 'SUCCESS', '');
  return {sent:true,mode:opts.testMode === true ? 'TEST' : 'LIVE',recipient:recipient};
}

function v2OfferAcceptanceEndToEndControlledTest() {
  assertDevIdentity_();
  const stamp = Utilities.formatDate(new Date(), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'yyyyMMdd-HHmmss');
  const now = new Date().toISOString();
  const reference = 'V2-OFFER-E2E-' + stamp;
  const root = DriveApp.getFolderById(CONFIG.rootFolderId);
  const testRoot = v2GetOrCreateFolder_(root, 'V2_TEST_OUTPUT');
  const studentFolder = v2GetOrCreateFolder_(testRoot, 'OFFER_E2E_' + stamp);
  v2Append_('V2_APPLICATIONS', {'Reference No':reference,'Submitted At':now,'Student Name':'V2 OFFER E2E TEST ' + stamp,'ID / Passport No':'E2E-' + stamp,'Personal Email':'NO-EMAIL-TEST','Programme':'MBA - Master of Business Administration','Level of Study':'Master','Study Mode':'Part Time','Intake':'September 2026','Student Folder URL':studentFolder.getUrl(),'Raw Application JSON':JSON.stringify({fullAddress:'TEST ADDRESS ONLY'}),'Application Status':'TEST','Email Status':'DISABLED','Last Updated':now,'Version':'CONTROLLED_OFFER_E2E_TEST'});
  v2Append_('V2_WORKFLOW', {'Reference No':reference,'Student Name':'V2 OFFER E2E TEST ' + stamp,'ID / Passport No':'E2E-' + stamp,'Personal Email':'NO-EMAIL-TEST','Programme':'MBA - Master of Business Administration','Level of Study':'Master','Intake':'September 2026','Application Stage':'ELIGIBLE_FOR_OFFER','Application Status':'TEST','SAC Decision':'DIRECT_ENTRY','Assessment Status':'NOT_REQUIRED','Prerequisite Status':'NOT_REQUIRED','Offer Letter Status':'NOT_ISSUED','Acceptance Status':'PENDING','Student Folder URL':studentFolder.getUrl(),'Last Updated':now,'Updated By':'Controlled Offer E2E Test','Version':V2_BUILD});
  const issued = v2IssueOffer_(reference, 'Controlled Offer E2E Test', {sendEmail:false});
  const tinySignature = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const tokenMatch = String(issued.acceptanceSigningUrl || '').match(/[?&]token=([^&]+)/);
  if (!tokenMatch) throw new Error('Controlled test could not recover acceptance token from signing URL.');
  const token = decodeURIComponent(tokenMatch[1]);
  const accepted = v2SubmitSignedAcceptance(token, {signedName:'V2 TEST STUDENT',signatureDataUrl:tinySignature,declarationAccepted:true});
  const finalWorkflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  const offerFile = DriveApp.getFileById(v2OfferExtractDriveId_(issued.offerLetterPdfUrl));
  const acceptanceFile = DriveApp.getFileById(v2OfferExtractDriveId_(accepted.acceptancePdfUrl));
  const checks = {offerIssued:issued && issued.ok === true && issued.offerLetterStatus === 'ISSUED',offerPdfExists:!!offerFile && offerFile.getMimeType() === MimeType.PDF,acceptanceUrlConfigured:!!issued.acceptanceSigningUrl,acceptanceRecorded:accepted && accepted.ok === true,acceptancePdfExists:!!acceptanceFile && acceptanceFile.getMimeType() === MimeType.PDF,finalStageAccepted:String(finalWorkflow.record['Application Stage'] || '') === 'ACCEPTED',acceptanceStatusAccepted:String(finalWorkflow.record['Acceptance Status'] || '') === 'ACCEPTED',tokenConsumed:String(finalWorkflow.record['Acceptance Token Hash'] || '') === ''};
  const report = {ok:Object.keys(checks).every(function(k){return checks[k]===true;}),referenceNo:reference,checks:checks,offerLetterPdfUrl:issued.offerLetterPdfUrl,acceptancePdfUrl:accepted.acceptancePdfUrl,emailSent:false,v1Touched:false};
  Logger.log(JSON.stringify(report));
  return report;
}
'''
    s = s.rstrip() + append + '\n'
p.write_text(s, encoding='utf-8')
