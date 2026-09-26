/**
 * IUC IPGS Admission V2 - Compliance & Records AI
 *
 * Purpose:
 * - AI-assisted visual/document quality review AFTER deterministic completeness.
 * - Does NOT decide academic eligibility.
 * - Checks document type, readability, crop/cut-off, glare/blur, orientation,
 *   page completeness, passport-photo suitability, cross-document consistency
 *   and obvious evidence anomalies.
 * - Produces PASS / FOLLOW_UP_REQUIRED / HUMAN_REVIEW_REQUIRED.
 */

const V2_COMPLIANCE_REVIEW_HEADERS = [
  'AI Quality Status',
  'AI Quality Confidence',
  'AI Quality Findings JSON',
  'AI Quality Follow-up JSON',
  'AI Quality Flags JSON',
  'AI Quality Source Documents JSON',
  'AI Quality Provider',
  'AI Quality Model',
  'AI Quality Run ID',
  'AI Quality Reviewed At',
  'AI Quality Reviewed By',
  'Human Quality Decision',
  'Human Quality Notes',
  'Human Quality Reviewed At',
  'Human Quality Reviewed By'
];

function v2ComplianceEnsureFoundation_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const sheet = ss.getSheetByName(V2_DOCUMENT_REVIEW_SHEET);
  if (!sheet) throw new Error('V2_DOCUMENT_REVIEW sheet is missing.');
  v2EnsureHeaders_(sheet, V2_DOCUMENT_REVIEW_HEADERS.concat(V2_COMPLIANCE_REVIEW_HEADERS));

  const workflow = ss.getSheetByName('V2_WORKFLOW');
  if (workflow) {
    v2EnsureHeaders_(workflow, [
      'Document Quality Status',
      'Document Quality Confidence',
      'Document Quality Reviewed At',
      'Document Quality Reviewed By'
    ]);
  }
  return true;
}

function v2RunComplianceDocumentQuality_(data, actor) {
  assertDevIdentity_();
  v2ComplianceEnsureFoundation_();

  const input = data || {};
  const reference = v2Required_(input.referenceNo, 'Reference No');
  const reviewedBy = String(actor || input.reviewedBy || 'Compliance & Records Agent').trim();

  const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  const review = v2Find_(V2_DOCUMENT_REVIEW_SHEET, 'Reference No', reference);
  if (!application || !workflow || !review) throw new Error('Application/workflow/document review record not found.');

  if (String(review.record['Review Status'] || '') !== 'COMPLETE') {
    throw new Error('AI quality review blocked: deterministic document completeness is not COMPLETE.');
  }

  const stage = String(workflow.record['Application Stage'] || '');
  if (stage !== 'DOCUMENT_REVIEW') {
    throw new Error('AI quality review is not available at current stage: ' + stage);
  }

  const ai = v2ComplianceCallN8nGateway_(application.record, reference);
  const normalized = v2ComplianceNormalizeResult_(ai.result, ai.sourceDocuments);

  const now = new Date().toISOString();
  const confidence = Number(normalized.confidence || 0);
  let status = 'PASS';

  const hasSourceError = (ai.sourceDocuments || []).some(function(x){ return !!x.error; });
  const hasHuman = normalized.documents.some(function(x){ return x.status === 'HUMAN_REVIEW'; }) ||
    normalized.flags.some(function(x){ return /^IDENTITY_|^POSSIBLE_TAMPERING|^CROSS_DOCUMENT_|^UNABLE_TO_VERIFY/.test(String(x || '')); });
  const hasReplace = normalized.documents.some(function(x){ return x.status === 'REPLACE_REQUIRED'; });

  if (hasSourceError || hasHuman || confidence < 0.65) status = 'HUMAN_REVIEW_REQUIRED';
  else if (hasReplace) status = 'FOLLOW_UP_REQUIRED';

  const followUp = normalized.documents.filter(function(x){ return x.status === 'REPLACE_REQUIRED'; }).map(function(x){
    return {
      field:x.field,
      label:x.label,
      issues:x.issues,
      instruction:x.replacementInstruction || 'Please upload a clearer and complete replacement document.'
    };
  });

  v2UpdateRow_(review.sheet, review.rowNumber, {
    'AI Quality Status':status,
    'AI Quality Confidence':confidence,
    'AI Quality Findings JSON':JSON.stringify(normalized.documents),
    'AI Quality Follow-up JSON':JSON.stringify(followUp),
    'AI Quality Flags JSON':JSON.stringify(normalized.flags),
    'AI Quality Source Documents JSON':JSON.stringify(ai.sourceDocuments || []),
    'AI Quality Provider':'N8N_GATEWAY',
    'AI Quality Model':ai.model || '',
    'AI Quality Run ID':ai.runId || '',
    'AI Quality Reviewed At':now,
    'AI Quality Reviewed By':reviewedBy,
    'Last Updated':now
  });

  const wf = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  v2UpdateRow_(wf.sheet, wf.rowNumber, {
    'Document Quality Status':status,
    'Document Quality Confidence':confidence,
    'Document Quality Reviewed At':now,
    'Document Quality Reviewed By':reviewedBy,
    'Last Updated':now,
    'Updated By':reviewedBy
  });

  v2Audit_(reference,'DOCUMENT_REVIEW','AI_DOCUMENT_QUALITY_REVIEW',{},{
    status:status,
    confidence:confidence,
    followUpCount:followUp.length,
    flags:normalized.flags,
    documents:normalized.documents
  },reviewedBy,'SUCCESS','AI-assisted document quality review completed.');

  let humanTask = null;
  if (status === 'HUMAN_REVIEW_REQUIRED' && typeof v2CreateHumanTask_ === 'function') {
    humanTask = v2CreateHumanTask_({
      referenceNo:reference,
      taskType:'DOCUMENT_QUALITY_REVIEW',
      title:'Document quality requires human review',
      reason:v2ComplianceHumanReason_(normalized, ai.sourceDocuments),
      raisedByAgent:'Compliance & Records Agent',
      agentId:'COMPLIANCE',
      executionId:String(input.executionId || ''),
      priority:'NORMAL',
      assignedTo:'Registry / Authorised Reviewer',
      resumeEvent:'HUMAN_TASK_COMPLETED',
      source:'N8N'
    }, reviewedBy);
  }

  v2InvalidateCache_();

  return {
    ok:true,
    referenceNo:reference,
    status:status,
    requiresHuman:status === 'HUMAN_REVIEW_REQUIRED',
    requiresStudentFollowUp:status === 'FOLLOW_UP_REQUIRED',
    confidence:confidence,
    findings:normalized.documents,
    followUpDocuments:followUp,
    flags:normalized.flags,
    humanTask:humanTask,
    nextAction:
      status === 'PASS' ? 'ADMISSION_INTELLIGENCE' :
      status === 'FOLLOW_UP_REQUIRED' ? 'STUDENT_DOCUMENT_REPLACEMENT' :
      'HUMAN_DOCUMENT_REVIEW'
  };
}

function v2ComplianceGatewayPost_(webhookUrl, secret, payload) {
  const response = UrlFetchApp.fetch(webhookUrl, {
    method:'post',
    contentType:'application/json',
    headers:{'X-IUC-Agent-Secret':secret},
    payload:JSON.stringify(payload || {}),
    muteHttpExceptions:true
  });
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('N8N_COMPLIANCE_AI_HTTP_' + code + ': ' + text.slice(0,600));
  }
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (_) { throw new Error('N8N_COMPLIANCE_AI_INVALID_JSON: ' + text.slice(0,300)); }
  if (!parsed || parsed.ok !== true) {
    throw new Error('N8N_COMPLIANCE_AI_INVALID_RESPONSE');
  }
  return parsed;
}

function v2ComplianceReadGatewayDocuments_(application) {
  let files = [];
  try { files = JSON.parse(String(application['Uploaded Files JSON'] || '[]')); } catch (_) { files = []; }
  if (!Array.isArray(files)) files = [];
  const wanted = [
    'identityDocument','passportPhoto','passportCopyInternational',
    'transcript','certificate','apelCertificate','cvResume',
    'otherSupportingDocument','completedAdmissionForm','completedHealthDeclaration',
    'emgsPaymentReceipt','preliminaryResearchIntent'
  ];
  const documents = [], sources = [];
  let totalBytes = 0;
  const maxTotal = 18 * 1024 * 1024;

  files.filter(function(meta){
    return wanted.indexOf(String(meta && meta.field || '')) > -1;
  }).some(function(meta){
    const idMatch = String(meta.url || '').match(/[-\w]{20,}/);
    const field = String(meta.field || '');
    const label = V2_DOCUMENT_LABELS[field] || field;
    if (!idMatch) {
      sources.push({field:field,label:label,fileName:String(meta.fileName || ''),error:'DRIVE_FILE_ID_NOT_FOUND'});
      return false;
    }
    try {
      const file = DriveApp.getFileById(idMatch[0]);
      const blob = file.getBlob();
      const bytes = blob.getBytes();
      const fileName = String(meta.fileName || file.getName());
      if (totalBytes + bytes.length > maxTotal) {
        sources.push({field:field,label:label,fileName:fileName,error:'SKIPPED_SIZE_LIMIT'});
        return false;
      }
      const mime = String(blob.getContentType() || meta.mimeType || 'application/pdf').toLowerCase();
      if (!/^image\/(png|jpeg|jpg|gif|webp)$/.test(mime) && mime !== 'application/pdf') {
        sources.push({field:field,label:label,fileName:fileName,mimeType:mime,error:'UNSUPPORTED_MIME_TYPE'});
        return false;
      }
      totalBytes += bytes.length;
      documents.push({
        field:field,
        label:label,
        fileName:fileName,
        mimeType:mime,
        base64:Utilities.base64Encode(bytes)
      });
      sources.push({
        field:field,
        label:label,
        fileName:fileName,
        mimeType:mime,
        size:bytes.length
      });
    } catch (error) {
      sources.push({field:field,label:label,fileName:String(meta.fileName || ''),error:String(error && error.message || error)});
    }
    return totalBytes >= maxTotal;
  });
  return {documents:documents,sources:sources,totalBytes:totalBytes};
}

function v2ComplianceCallN8nGateway_(application, referenceNo) {
  const properties = PropertiesService.getScriptProperties();
  const webhookUrl = String(
    properties.getProperty('N8N_COMPLIANCE_AI_WEBHOOK_URL') ||
    'https://anasbukhori.app.n8n.cloud/webhook/cs-adm-v2-09-compliance-ai-bridge-20260926'
  ).trim();
  const secret = String(properties.getProperty('N8N_EVENT_SHARED_SECRET') || '').trim();
  if (!webhookUrl) throw new Error('N8N_COMPLIANCE_AI_WEBHOOK_MISSING');
  if (!secret) throw new Error('N8N_EVENT_SHARED_SECRET_MISSING');

  const uploaded = v2ComplianceReadGatewayDocuments_(application);
  if (!uploaded.documents.length) {
    throw new Error('No supported uploaded files available for AI quality inspection.');
  }

  const applicantName = String(application['Student Name'] || '');
  const applicantId = String(application['ID / Passport No'] || '');
  const programme = String(application['Programme'] || '');
  const findings = [], flags = [], runIds = [], models = [], confidenceValues = [];
  uploaded.documents.forEach(function(doc){
    try {
      const response = v2ComplianceGatewayPost_(webhookUrl, secret, {
        mode:'DOCUMENT',
        referenceNo:String(referenceNo || ''),
        applicantName:applicantName,
        applicantId:applicantId,
        programme:programme,
        field:doc.field,
        label:doc.label,
        fileName:doc.fileName,
        mimeType:doc.mimeType,
        base64:doc.base64
      });
      const result = response.result || {};
      if (!result.document || typeof result.document !== 'object') {
        throw new Error('DOCUMENT_RESULT_MISSING');
      }
      findings.push(result.document);
      if (Array.isArray(result.flags)) result.flags.forEach(function(x){ flags.push(String(x)); });
      const c = Number(result.confidence != null ? result.confidence : result.document.confidence);
      if (isFinite(c)) confidenceValues.push(Math.max(0,Math.min(1,c)));
      if (response.runId) runIds.push(String(response.runId));
      if (response.model) models.push(String(response.model));
    } catch (error) {
      const source = uploaded.sources.filter(function(s){ return s.field === doc.field && !s.error; })[0];
      if (source) source.error = 'N8N_AI_GATEWAY: ' + String(error && error.message || error);
    }
  });

  let crossDocumentConsistency = 'NOT_ASSESSABLE';
  let crossDocumentNotes = [];
  if (findings.length) {
    try {
      const cross = v2ComplianceGatewayPost_(webhookUrl, secret, {
        mode:'CROSS',
        referenceNo:String(referenceNo || ''),
        applicantName:applicantName,
        applicantId:applicantId,
        programme:programme,
        documents:findings
      });
      const result = cross.result || {};
      crossDocumentConsistency = String(result.crossDocumentConsistency || 'NOT_ASSESSABLE').toUpperCase();
      crossDocumentNotes = Array.isArray(result.crossDocumentNotes) ? result.crossDocumentNotes.map(String) : [];
      if (Array.isArray(result.flags)) result.flags.forEach(function(x){ flags.push(String(x)); });
      const c = Number(result.confidence);
      if (isFinite(c)) confidenceValues.push(Math.max(0,Math.min(1,c)));
      if (cross.runId) runIds.push(String(cross.runId));
      if (cross.model) models.push(String(cross.model));
    } catch (error) {
      flags.push('UNABLE_TO_VERIFY_CROSS_DOCUMENT');
      crossDocumentNotes.push('Cross-document AI check failed: ' + String(error && error.message || error));
    }
  }

  const hasSourceError = uploaded.sources.some(function(x){ return !!x.error; });
  let confidence = confidenceValues.length ? Math.min.apply(null,confidenceValues) : 0;
  if (hasSourceError) confidence = 0;

  return {
    model:Array.from(new Set(models)).join(',') || 'gpt-5-mini',
    runId:Array.from(new Set(runIds)).join(','),
    sourceDocuments:uploaded.sources,
    result:{
      documents:findings,
      crossDocumentConsistency:crossDocumentConsistency,
      crossDocumentNotes:crossDocumentNotes,
      flags:Array.from(new Set(flags)),
      confidence:confidence
    }
  };
}

function v2ComplianceCallOpenAi_(application, apiKey) {
  const properties = PropertiesService.getScriptProperties();
  const model = String(
    properties.getProperty('V2_COMPLIANCE_AI_MODEL') ||
    properties.getProperty('V2_AI_MODEL') ||
    'gpt-5.6-luna'
  ).trim();

  const uploaded = v2ComplianceReadDocuments_(application);
  if (!uploaded.items.length) throw new Error('No supported uploaded files available for AI quality inspection.');

  const required = v2GetRequiredDocuments_(application);
  const applicantName = String(application['Student Name'] || '');
  const applicantId = String(application['ID / Passport No'] || '');
  const programme = String(application['Programme'] || '');

  const schema = {
    type:'object',
    additionalProperties:false,
    properties:{
      documents:{
        type:'array',
        items:{
          type:'object',
          additionalProperties:false,
          properties:{
            field:{type:'string'},
            label:{type:'string'},
            detectedDocumentType:{type:'string'},
            correctDocumentType:{type:'string',enum:['YES','NO','UNCERTAIN']},
            readable:{type:'string',enum:['YES','NO','PARTIAL','UNCERTAIN']},
            cropStatus:{type:'string',enum:['OK','CROPPED','POSSIBLY_CROPPED','NOT_APPLICABLE','UNCERTAIN']},
            blurStatus:{type:'string',enum:['OK','BLURRY','POSSIBLY_BLURRY','NOT_APPLICABLE','UNCERTAIN']},
            glareStatus:{type:'string',enum:['OK','GLARE','POSSIBLE_GLARE','NOT_APPLICABLE','UNCERTAIN']},
            orientationStatus:{type:'string',enum:['OK','ROTATED','UPSIDE_DOWN','NOT_APPLICABLE','UNCERTAIN']},
            pageCompleteness:{type:'string',enum:['COMPLETE','POSSIBLY_INCOMPLETE','INCOMPLETE','NOT_ASSESSABLE']},
            passportPhotoSuitability:{type:'string',enum:['SUITABLE','UNSUITABLE','NOT_APPLICABLE','UNCERTAIN']},
            applicantIdentityConsistency:{type:'string',enum:['CONSISTENT','INCONSISTENT','NOT_ASSESSABLE','UNCERTAIN']},
            issues:{type:'array',items:{type:'string'}},
            evidence:{type:'array',items:{type:'string'}},
            replacementInstruction:{type:'string'},
            confidence:{type:'number',minimum:0,maximum:1},
            status:{type:'string',enum:['PASS','REPLACE_REQUIRED','HUMAN_REVIEW']}
          },
          required:[
            'field','label','detectedDocumentType','correctDocumentType','readable',
            'cropStatus','blurStatus','glareStatus','orientationStatus','pageCompleteness',
            'passportPhotoSuitability','applicantIdentityConsistency','issues','evidence',
            'replacementInstruction','confidence','status'
          ]
        }
      },
      crossDocumentConsistency:{type:'string',enum:['CONSISTENT','POTENTIAL_CONFLICT','CONFLICT','NOT_ASSESSABLE']},
      crossDocumentNotes:{type:'array',items:{type:'string'}},
      flags:{type:'array',items:{type:'string'}},
      confidence:{type:'number',minimum:0,maximum:1}
    },
    required:['documents','crossDocumentConsistency','crossDocumentNotes','flags','confidence']
  };

  const content = [{
    type:'input_text',
    text:[
      'Perform an official internal DOCUMENT QUALITY AND RECORDS COMPLIANCE review only.',
      'Do NOT decide academic eligibility, programme admission, CGPA equivalency or SAC outcome.',
      'Applicant: ' + applicantName,
      'Applicant ID/Passport: ' + applicantId,
      'Programme: ' + programme,
      'Required document fields: ' + JSON.stringify(required),
      'For each supplied file: verify it appears to be the intended document type; assess readability, obvious blur/glare, crop/cut-off, orientation, page completeness where assessable, and applicant identity consistency where visible.',
      'For passport-size photo: assess only basic administrative suitability (single person, clear face, professional/passport-style image, not obviously cropped/obstructed). Do not infer sensitive traits.',
      'For identity/passport documents: do not infer authenticity as a fact. If something appears inconsistent, altered or unverifiable, use HUMAN_REVIEW and a conservative flag.',
      'If a PDF page count/completeness cannot be confidently determined, say NOT_ASSESSABLE or UNCERTAIN rather than guessing.',
      'Use REPLACE_REQUIRED only when a replacement is clearly needed (e.g. unreadable, materially cropped, wrong document, unusable photo).',
      'Use HUMAN_REVIEW for ambiguous identity mismatch, possible alteration/tampering, conflicting names/details, or low-confidence concerns.',
      'Evidence should be short and specific, e.g. "Transcript page 2: lower edge cuts off final row".'
    ].join('\n')
  }].concat(uploaded.items);

  const request = {
    model:model,
    store:false,
    reasoning:{effort:'low'},
    instructions:'You are the IUC Compliance & Records Agent. Be conservative, evidence-led and administrative. Never invent missing pages, identity facts or academic decisions. Return only the required structured output.',
    input:[{role:'user',content:content}],
    text:{format:{type:'json_schema',name:'iuc_document_quality_review',description:'Administrative document quality and records compliance result',strict:true,schema:schema}}
  };

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/responses',{
    method:'post',
    contentType:'application/json',
    headers:{Authorization:'Bearer '+apiKey},
    payload:JSON.stringify(request),
    muteHttpExceptions:true
  });

  const code = response.getResponseCode();
  const responseText = response.getContentText();
  if (code < 200 || code >= 300) throw new Error('OPENAI_COMPLIANCE_HTTP_' + code + ': ' + responseText.slice(0,600));

  const raw = JSON.parse(responseText);
  const outputText = v2AiExtractResponseText_(raw);
  if (!outputText) throw new Error('OpenAI compliance response did not contain output_text.');

  return {
    model:model,
    runId:String(raw.id || ''),
    sourceDocuments:uploaded.sources,
    result:JSON.parse(outputText)
  };
}

function v2ComplianceReadDocuments_(application) {
  let files = [];
  try { files = JSON.parse(String(application['Uploaded Files JSON'] || '[]')); } catch (_) { files = []; }
  if (!Array.isArray(files)) files = [];

  const wanted = [
    'identityDocument','passportPhoto','passportCopyInternational',
    'transcript','certificate','apelCertificate','cvResume',
    'otherSupportingDocument','completedAdmissionForm','completedHealthDeclaration',
    'emgsPaymentReceipt','preliminaryResearchIntent'
  ];

  const items = [], sources = [];
  let totalBytes = 0;
  const maxTotal = 18 * 1024 * 1024;

  files.filter(function(meta){
    return wanted.indexOf(String(meta && meta.field || '')) > -1;
  }).some(function(meta){
    const idMatch = String(meta.url || '').match(/[-\w]{20,}/);
    const field = String(meta.field || '');
    const label = V2_DOCUMENT_LABELS[field] || field;
    if (!idMatch) {
      sources.push({field:field,label:label,fileName:String(meta.fileName || ''),error:'DRIVE_FILE_ID_NOT_FOUND'});
      return false;
    }

    try {
      const file = DriveApp.getFileById(idMatch[0]);
      const blob = file.getBlob();
      const bytes = blob.getBytes();
      if (totalBytes + bytes.length > maxTotal) {
        sources.push({field:field,label:label,fileName:file.getName(),error:'SKIPPED_SIZE_LIMIT'});
        return false;
      }

      totalBytes += bytes.length;
      const mime = String(blob.getContentType() || meta.mimeType || 'application/pdf');
      const base64 = Utilities.base64Encode(bytes);

      items.push({
        type:'input_text',
        text:'DOCUMENT FIELD: '+field+' | EXPECTED: '+label+' | FILE: '+String(meta.fileName || file.getName())
      });

      if (/^image\/(png|jpeg)$/i.test(mime)) {
        items.push({type:'input_image',image_url:'data:'+mime+';base64,'+base64,detail:'high'});
      } else if (mime === 'application/pdf') {
        items.push({type:'input_file',filename:String(meta.fileName || file.getName() || 'document.pdf'),file_data:base64});
      } else {
        sources.push({field:field,label:label,fileName:file.getName(),mimeType:mime,error:'UNSUPPORTED_MIME_TYPE'});
        items.pop();
        return false;
      }

      sources.push({
        field:field,
        label:label,
        fileName:String(meta.fileName || file.getName()),
        mimeType:mime,
        size:bytes.length
      });
    } catch (error) {
      sources.push({field:field,label:label,fileName:String(meta.fileName || ''),error:String(error && error.message || error)});
    }

    return totalBytes >= maxTotal;
  });

  return {items:items,sources:sources,totalBytes:totalBytes};
}

function v2ComplianceNormalizeResult_(result, sources) {
  const input = result && typeof result === 'object' ? result : {};
  const sourceMap = {};
  (sources || []).forEach(function(s){ if (s && s.field) sourceMap[String(s.field)] = s; });

  const docs = Array.isArray(input.documents) ? input.documents.map(function(d){
    const field = String(d && d.field || '');
    const src = sourceMap[field] || {};
    const confidence = Number(d && d.confidence);
    let status = String(d && d.status || 'HUMAN_REVIEW').toUpperCase();
    if (['PASS','REPLACE_REQUIRED','HUMAN_REVIEW'].indexOf(status) < 0) status = 'HUMAN_REVIEW';
    if (!isFinite(confidence) || confidence < 0.55) status = 'HUMAN_REVIEW';

    return {
      field:field,
      label:String(d && d.label || src.label || V2_DOCUMENT_LABELS[field] || field),
      fileName:String(src.fileName || ''),
      detectedDocumentType:String(d && d.detectedDocumentType || ''),
      correctDocumentType:String(d && d.correctDocumentType || 'UNCERTAIN'),
      readable:String(d && d.readable || 'UNCERTAIN'),
      cropStatus:String(d && d.cropStatus || 'UNCERTAIN'),
      blurStatus:String(d && d.blurStatus || 'UNCERTAIN'),
      glareStatus:String(d && d.glareStatus || 'UNCERTAIN'),
      orientationStatus:String(d && d.orientationStatus || 'UNCERTAIN'),
      pageCompleteness:String(d && d.pageCompleteness || 'NOT_ASSESSABLE'),
      passportPhotoSuitability:String(d && d.passportPhotoSuitability || 'NOT_APPLICABLE'),
      applicantIdentityConsistency:String(d && d.applicantIdentityConsistency || 'NOT_ASSESSABLE'),
      issues:Array.isArray(d && d.issues) ? d.issues.map(String) : [],
      evidence:Array.isArray(d && d.evidence) ? d.evidence.map(String) : [],
      replacementInstruction:String(d && d.replacementInstruction || ''),
      confidence:isFinite(confidence) ? Math.max(0,Math.min(1,confidence)) : 0,
      status:status
    };
  }) : [];

  const sourceErrors = (sources || []).filter(function(s){ return s && s.error; });
  sourceErrors.forEach(function(s){
    if (!docs.some(function(d){ return d.field === s.field; })) {
      docs.push({
        field:String(s.field || ''),
        label:String(s.label || V2_DOCUMENT_LABELS[s.field] || s.field || 'Document'),
        fileName:String(s.fileName || ''),
        detectedDocumentType:'',
        correctDocumentType:'UNCERTAIN',
        readable:'UNCERTAIN',
        cropStatus:'UNCERTAIN',
        blurStatus:'UNCERTAIN',
        glareStatus:'UNCERTAIN',
        orientationStatus:'UNCERTAIN',
        pageCompleteness:'NOT_ASSESSABLE',
        passportPhotoSuitability:'NOT_APPLICABLE',
        applicantIdentityConsistency:'NOT_ASSESSABLE',
        issues:['Technical inspection issue: '+String(s.error)],
        evidence:[],
        replacementInstruction:'',
        confidence:0,
        status:'HUMAN_REVIEW'
      });
    }
  });

  const conf = Number(input.confidence);
  const flags = Array.isArray(input.flags) ? input.flags.map(String) : [];
  if (String(input.crossDocumentConsistency || '').toUpperCase() === 'CONFLICT') flags.push('CROSS_DOCUMENT_CONFLICT');
  if (String(input.crossDocumentConsistency || '').toUpperCase() === 'POTENTIAL_CONFLICT') flags.push('CROSS_DOCUMENT_POTENTIAL_CONFLICT');

  return {
    documents:docs,
    crossDocumentConsistency:String(input.crossDocumentConsistency || 'NOT_ASSESSABLE').toUpperCase(),
    crossDocumentNotes:Array.isArray(input.crossDocumentNotes) ? input.crossDocumentNotes.map(String) : [],
    flags:Array.from(new Set(flags)),
    confidence:isFinite(conf) ? Math.max(0,Math.min(1,conf)) : 0
  };
}

function v2ComplianceHumanReason_(normalized, sources) {
  const reasons = [];
  (normalized.documents || []).filter(function(d){ return d.status === 'HUMAN_REVIEW'; }).forEach(function(d){
    reasons.push((d.label || d.field || 'Document') + ': ' + ((d.issues || []).join('; ') || 'Human verification required.'));
  });
  (normalized.flags || []).forEach(function(flag){ reasons.push(String(flag)); });
  (sources || []).filter(function(s){ return s && s.error; }).forEach(function(s){
    reasons.push((s.label || s.field || 'Document') + ': ' + s.error);
  });
  return reasons.slice(0,8).join(' | ') || 'Document quality could not be confidently resolved by AI.';
}


function testV2ComplianceDependencies() {
  const checks = {
    assertDevIdentity_: typeof assertDevIdentity_ === 'function',
    v2EnsureHeaders_: typeof v2EnsureHeaders_ === 'function',
    v2Required_: typeof v2Required_ === 'function',
    v2Find_: typeof v2Find_ === 'function',
    v2UpdateRow_: typeof v2UpdateRow_ === 'function',
    v2Audit_: typeof v2Audit_ === 'function',
    v2InvalidateCache_: typeof v2InvalidateCache_ === 'function',
    v2GetRequiredDocuments_: typeof v2GetRequiredDocuments_ === 'function',
    v2AiExtractResponseText_: typeof v2AiExtractResponseText_ === 'function',
    V2_DOCUMENT_REVIEW_SHEET: typeof V2_DOCUMENT_REVIEW_SHEET !== 'undefined',
    V2_DOCUMENT_REVIEW_HEADERS: typeof V2_DOCUMENT_REVIEW_HEADERS !== 'undefined',
    V2_DOCUMENT_LABELS: typeof V2_DOCUMENT_LABELS !== 'undefined',
    OPENAI_API_KEY: !!String(PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY') || '').trim()
  };
  Logger.log(JSON.stringify(checks, null, 2));
  const missing = Object.keys(checks).filter(function(key) { return checks[key] !== true; });
  if (missing.length) throw new Error('COMPLIANCE_DEPENDENCY_MISSING: ' + missing.join(', '));
  Logger.log('COMPLIANCE DEPENDENCIES READY');
  return checks;
}
