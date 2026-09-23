/**
 * IUC IPGS Admission V2 - Agentic Bridge
 *
 * Purpose:
 * - Apps Script remains Source of Truth + transaction engine.
 * - n8n becomes orchestration / AI staff layer.
 * - Every agent action is idempotent, stage-aware and auditable.
 * - Agent activity is written to V2_AGENT_EVENTS for ACC / Campus Simulation.
 */

const V2_AGENT_EVENTS_SHEET = 'V2_AGENT_EVENTS';
const V2_AGENT_EXECUTIONS_SHEET = 'V2_AGENT_EXECUTIONS';

const V2_AGENT_EVENTS_HEADERS = [
  'Event ID','Timestamp','Reference No','Student Name','Programme',
  'Event Type','Agent ID','Agent Name','Action','Status',
  'From Stage','To Stage','Summary','Requires Human',
  'Execution ID','Source','Payload JSON'
];

const V2_AGENT_EXECUTIONS_HEADERS = [
  'Execution ID','Reference No','Agent ID','Requested Action','Status',
  'Started At','Completed At','Result JSON','Error','Last Updated'
];

function v2AgenticEnsureFoundation_() {
  const ss = SpreadsheetApp.openById(CONFIG.spreadsheetId);
  let events = ss.getSheetByName(V2_AGENT_EVENTS_SHEET);
  if (!events) events = ss.insertSheet(V2_AGENT_EVENTS_SHEET);
  v2EnsureHeaders_(events, V2_AGENT_EVENTS_HEADERS);
  v2StyleHeader_(events, V2_AGENT_EVENTS_HEADERS.length);

  let executions = ss.getSheetByName(V2_AGENT_EXECUTIONS_SHEET);
  if (!executions) executions = ss.insertSheet(V2_AGENT_EXECUTIONS_SHEET);
  v2EnsureHeaders_(executions, V2_AGENT_EXECUTIONS_HEADERS);
  v2StyleHeader_(executions, V2_AGENT_EXECUTIONS_HEADERS.length);

  return {events:events, executions:executions};
}

function v2AgenticEnabled_() {
  return String(PropertiesService.getScriptProperties().getProperty('N8N_AGENTIC_ENABLED') || 'FALSE')
    .trim().toUpperCase() === 'TRUE';
}

function v2AgenticWebhookUrl_() {
  return String(PropertiesService.getScriptProperties().getProperty('N8N_EVENT_WEBHOOK_URL') || '').trim();
}

function v2AgenticWebhookSecret_() {
  return String(PropertiesService.getScriptProperties().getProperty('N8N_EVENT_SHARED_SECRET') || '').trim();
}

function v2AgenticStatus_() {
  assertDevIdentity_();
  v2AgenticEnsureFoundation_();
  return {
    ok:true,
    enabled:v2AgenticEnabled_(),
    webhookConfigured:!!v2AgenticWebhookUrl_(),
    secretConfigured:!!v2AgenticWebhookSecret_(),
    eventSheet:V2_AGENT_EVENTS_SHEET,
    executionSheet:V2_AGENT_EXECUTIONS_SHEET,
    mode:v2AgenticEnabled_() ? 'N8N_ORCHESTRATED' : 'LOCAL_FALLBACK'
  };
}

function v2GetAgentCaseState_(data) {
  assertDevIdentity_();
  const input = data || {};
  const reference = v2Required_(input.referenceNo, 'Reference No');

  const application = v2Find_('V2_APPLICATIONS', 'Reference No', reference);
  const workflow = v2Find_('V2_WORKFLOW', 'Reference No', reference);
  if (!application || !workflow) throw new Error('Application / workflow record not found.');

  const findRecord = function(sheet) {
    const found = v2Find_(sheet, 'Reference No', reference);
    return found ? found.record : null;
  };

  const recentEvents = v2Rows_(V2_AGENT_EVENTS_SHEET)
    .filter(function(row){ return String(row['Reference No'] || '') === reference; })
    .slice(-25);

  return {
    ok:true,
    referenceNo:reference,
    application:application.record,
    workflow:workflow.record,
    documentReview:findRecord('V2_DOCUMENT_REVIEW'),
    aiScreening:findRecord('V2_AI_SCREENING'),
    qualificationScreening:findRecord('V2_QUALIFICATION_SCREENING'),
    sacCandidate:findRecord('V2_SAC_CANDIDATES'),
    orientation:findRecord('V2_ORIENTATION_TRACKING'),
    provisioning:findRecord('V2_PROVISIONING'),
    agentEvents:recentEvents
  };
}

function v2EmitAgentEvent_(event) {
  const input = event || {};
  v2AgenticEnsureFoundation_();

  const reference = String(input.referenceNo || '').trim();
  let application = null;
  let workflow = null;
  try { application = reference ? v2Find_('V2_APPLICATIONS','Reference No',reference) : null; } catch (_) {}
  try { workflow = reference ? v2Find_('V2_WORKFLOW','Reference No',reference) : null; } catch (_) {}

  const eventId = String(input.eventId || ('EVT-' + Utilities.getUuid().slice(0, 16).toUpperCase()));
  const timestamp = String(input.timestamp || new Date().toISOString());
  const eventType = String(input.eventType || input.event || 'AGENT_EVENT').trim().toUpperCase();
  const agentId = String(input.agentId || '').trim().toUpperCase();
  const status = String(input.status || 'QUEUED').trim().toUpperCase();

  const payload = {
    eventId:eventId,
    timestamp:timestamp,
    referenceNo:reference,
    studentName:String(input.studentName || application && application.record['Student Name'] || ''),
    programme:String(input.programme || application && application.record['Programme'] || ''),
    eventType:eventType,
    agentId:agentId,
    agentName:String(input.agentName || ''),
    action:String(input.action || ''),
    status:status,
    fromStage:String(input.fromStage || workflow && workflow.record['Application Stage'] || ''),
    toStage:String(input.toStage || ''),
    summary:String(input.summary || ''),
    requiresHuman:input.requiresHuman === true || String(input.requiresHuman || '').toUpperCase() === 'YES',
    executionId:String(input.executionId || ''),
    source:String(input.source || 'ADMISSION_V2'),
    data:input.data || {}
  };

  v2Append_(V2_AGENT_EVENTS_SHEET, {
    'Event ID':eventId,
    'Timestamp':timestamp,
    'Reference No':reference,
    'Student Name':payload.studentName,
    'Programme':payload.programme,
    'Event Type':eventType,
    'Agent ID':agentId,
    'Agent Name':payload.agentName,
    'Action':payload.action,
    'Status':status,
    'From Stage':payload.fromStage,
    'To Stage':payload.toStage,
    'Summary':payload.summary,
    'Requires Human':payload.requiresHuman ? 'YES' : 'NO',
    'Execution ID':payload.executionId,
    'Source':payload.source,
    'Payload JSON':JSON.stringify(payload)
  });

  const url = v2AgenticWebhookUrl_();
  if (!v2AgenticEnabled_() || !url) {
    return {ok:true,eventId:eventId,recorded:true,sent:false,reason:'N8N_NOT_ACTIVE'};
  }

  try {
    const headers = {'Content-Type':'application/json'};
    const secret = v2AgenticWebhookSecret_();
    if (secret) headers['X-IUC-Agent-Secret'] = secret;

    const response = UrlFetchApp.fetch(url, {
      method:'post',
      contentType:'application/json',
      headers:headers,
      payload:JSON.stringify(payload),
      muteHttpExceptions:true,
      followRedirects:true
    });

    const code = response.getResponseCode();
    const sent = code >= 200 && code < 300;

    v2Audit_(reference,'AGENTIC_BRIDGE','EMIT_AGENT_EVENT',{},{
      eventId:eventId,eventType:eventType,agentId:agentId,status:status,httpCode:code,sent:sent
    },'Agentic Bridge',sent?'SUCCESS':'FAILED',sent?'Event delivered to n8n.':'n8n webhook returned HTTP '+code);

    return {
      ok:sent,
      eventId:eventId,
      recorded:true,
      sent:sent,
      httpCode:code,
      response:String(response.getContentText() || '').slice(0,500)
    };
  } catch (error) {
    v2Audit_(reference,'AGENTIC_BRIDGE','EMIT_AGENT_EVENT',{},{
      eventId:eventId,eventType:eventType,agentId:agentId,sent:false,
      error:String(error && error.message || error)
    },'Agentic Bridge','FAILED','Event delivery failed; local transaction remains intact.');

    return {
      ok:false,eventId:eventId,recorded:true,sent:false,
      message:String(error && error.message || error)
    };
  }
}

function v2RecordAgentActivity_(data, actor) {
  assertDevIdentity_();
  const input = data || {};
  return v2EmitAgentEvent_({
    referenceNo:input.referenceNo,
    eventType:input.eventType || 'AGENT_ACTIVITY',
    agentId:input.agentId,
    agentName:input.agentName,
    action:input.action,
    status:input.status,
    fromStage:input.fromStage,
    toStage:input.toStage,
    summary:input.summary,
    requiresHuman:input.requiresHuman,
    executionId:input.executionId,
    source:input.source || 'N8N',
    data:input.data || {},
    timestamp:input.timestamp || new Date().toISOString()
  });
}

function v2AgentActionGateway_(data, actor) {
  assertDevIdentity_();
  v2AgenticEnsureFoundation_();

  const input = data || {};
  const executionId = v2Required_(input.executionId, 'Execution ID');
  const reference = v2Required_(input.referenceNo, 'Reference No');
  const agentId = v2Required_(input.agentId, 'Agent ID').toUpperCase();
  const requestedAction = v2Required_(input.requestedAction, 'Requested Action').toUpperCase();
  const now = new Date().toISOString();

  const existing = v2Find_(V2_AGENT_EXECUTIONS_SHEET,'Execution ID',executionId);
  if (existing) {
    const status = String(existing.record['Status'] || '');
    if (status === 'COMPLETED') {
      return {
        ok:true,
        idempotentReplay:true,
        executionId:executionId,
        referenceNo:reference,
        requestedAction:requestedAction,
        result:v2AgentParseJson_(existing.record['Result JSON'],{})
      };
    }
    if (status === 'RUNNING') {
      return {ok:false,status:'ALREADY_RUNNING',executionId:executionId};
    }
  }

  const application = v2Find_('V2_APPLICATIONS','Reference No',reference);
  const workflow = v2Find_('V2_WORKFLOW','Reference No',reference);
  if (!application || !workflow) throw new Error('Application / workflow record not found.');

  const currentStage = String(workflow.record['Application Stage'] || '').trim();
  const doc = v2Find_('V2_DOCUMENT_REVIEW','Reference No',reference);

  v2Upsert_(V2_AGENT_EXECUTIONS_SHEET,'Execution ID',executionId,{
    'Execution ID':executionId,
    'Reference No':reference,
    'Agent ID':agentId,
    'Requested Action':requestedAction,
    'Status':'RUNNING',
    'Started At':now,
    'Completed At':'',
    'Result JSON':'',
    'Error':'',
    'Last Updated':now
  });

  v2EmitAgentEvent_({
    referenceNo:reference,
    eventType:'AGENT_TASK_STARTED',
    agentId:agentId,
    agentName:v2AgentDisplayName_(agentId),
    action:requestedAction,
    status:'WORKING',
    fromStage:currentStage,
    executionId:executionId,
    source:'N8N',
    summary:v2AgentDisplayName_(agentId) + ' started ' + requestedAction + '.'
  });

  try {
    let result;

    if (requestedAction === 'RUN_COMPLIANCE_DOCUMENT_QUALITY') {
      if (agentId !== 'COMPLIANCE') {
        throw new Error('RUN_COMPLIANCE_DOCUMENT_QUALITY is restricted to COMPLIANCE.');
      }
      if (!doc || String(doc.record['Review Status'] || '') !== 'COMPLETE') {
        throw new Error('Compliance review blocked: deterministic document completeness is not COMPLETE.');
      }
      if (currentStage !== 'DOCUMENT_REVIEW') {
        throw new Error('Compliance review is not available at current stage: ' + currentStage);
      }
      result = v2RunComplianceDocumentQuality_({
        referenceNo:reference,
        executionId:executionId
      }, 'Compliance & Records Agent via n8n');
    } else if (requestedAction === 'RUN_ADMISSION_INTELLIGENCE') {
      if (agentId !== 'ADMISSION_INTELLIGENCE') {
        throw new Error('RUN_ADMISSION_INTELLIGENCE is restricted to ADMISSION_INTELLIGENCE.');
      }
      if (!doc || String(doc.record['Review Status'] || '') !== 'COMPLETE') {
        throw new Error('Admission Intelligence blocked: document review is not COMPLETE.');
      }
      if (v2AgenticEnabled_()) {
        const qualityStatus = String(
          doc.record['AI Quality Status'] ||
          workflow.record['Document Quality Status'] || ''
        ).toUpperCase();
        if (qualityStatus !== 'PASS') {
          throw new Error('Admission Intelligence blocked: Compliance & Records quality status is not PASS.');
        }
      }
      if (['DOCUMENT_REVIEW','QUALIFICATION_SCREENING'].indexOf(currentStage) < 0) {
        throw new Error('Admission Intelligence is not available at current stage: ' + currentStage);
      }
      result = v2TryAutoAiScreening_(reference, 'Admission Intelligence Agent via n8n');
    } else if (requestedAction === 'GENERATE_AI_SCREENING_REPORT') {
      if (['ADMISSION_INTELLIGENCE','ORCHESTRATOR'].indexOf(agentId) < 0) {
        throw new Error('Report generation is restricted to Admission Intelligence / Orchestrator.');
      }
      result = v2GenerateAiScreeningReport_({
        referenceNo:reference,
        finalize:input.finalize === true
      }, v2AgentDisplayName_(agentId) + ' via n8n');
    } else if (requestedAction === 'SEND_DOCUMENT_REPLACEMENT_REQUEST') {
      if (agentId !== 'STUDENT_CONCIERGE') {
        throw new Error('SEND_DOCUMENT_REPLACEMENT_REQUEST is restricted to STUDENT_CONCIERGE.');
      }
      const qualityStatus = String(
        doc && doc.record['AI Quality Status'] ||
        workflow.record['Document Quality Status'] || ''
      ).toUpperCase();
      if (qualityStatus !== 'FOLLOW_UP_REQUIRED') {
        throw new Error('Student document replacement request blocked: Document Quality Status is not FOLLOW_UP_REQUIRED.');
      }
      result = v2SendDocumentReplacementRequest_({
        referenceNo:reference,
        executionId:executionId
      }, 'Student Concierge Agent via n8n');
    } else {
      throw new Error('Unsupported agent gateway action: ' + requestedAction);
    }

    const completedAt = new Date().toISOString();
    const row = v2Find_(V2_AGENT_EXECUTIONS_SHEET,'Execution ID',executionId);
    if (row) v2UpdateRow_(row.sheet,row.rowNumber,{
      'Status':'COMPLETED',
      'Completed At':completedAt,
      'Result JSON':JSON.stringify(result || {}),
      'Error':'',
      'Last Updated':completedAt
    });

    const fresh = v2Find_('V2_WORKFLOW','Reference No',reference);
    const toStage = fresh ? String(fresh.record['Application Stage'] || '') : currentStage;
    const requiresHuman = !!(
      result && (
        String(result.status || '').toUpperCase() === 'REVIEW_REQUIRED' ||
        String(result.status || '').toUpperCase() === 'HUMAN_REVIEW_REQUIRED' ||
        result.requiresHuman === true ||
        result.manualScreeningAvailable === true ||
        result.screening && result.screening.manualReviewRequired === true
      )
    );

    let humanTask = result && result.humanTask ? result.humanTask : null;
    if (requiresHuman && !humanTask && typeof v2CreateHumanTask_ === 'function') {
      const isAdmissionScreening = requestedAction === 'RUN_ADMISSION_INTELLIGENCE';
      const isCompliance = requestedAction === 'RUN_COMPLIANCE_DOCUMENT_QUALITY';
      humanTask = v2CreateHumanTask_({
        referenceNo:reference,
        taskType:isAdmissionScreening
          ? 'ADMISSION_SCREENING_REVIEW'
          : (isCompliance ? 'DOCUMENT_QUALITY_REVIEW' : 'AGENT_REVIEW_REQUIRED'),
        title:isAdmissionScreening
          ? 'Admission screening requires human confirmation'
          : (isCompliance ? 'Document quality requires human review' : 'Agent action requires human confirmation'),
        reason:isCompliance
          ? 'Compliance & Records Agent could not confidently resolve the document quality issue.'
          : 'Agent completed the automated step but the case cannot be finalised without authorised human confirmation.',
        raisedByAgent:v2AgentDisplayName_(agentId),
        agentId:agentId,
        executionId:executionId,
        priority:'NORMAL',
        assignedTo:isCompliance ? 'Registry / Authorised Reviewer' : 'Registrar / Authorised Decision Maker',
        resumeEvent:'HUMAN_TASK_COMPLETED',
        source:'N8N'
      }, v2AgentDisplayName_(agentId));
    }

    v2EmitAgentEvent_({
      referenceNo:reference,
      eventType:'AGENT_TASK_COMPLETED',
      agentId:agentId,
      agentName:v2AgentDisplayName_(agentId),
      action:requestedAction,
      status:requiresHuman ? 'WAITING_HUMAN' : 'COMPLETED',
      fromStage:currentStage,
      toStage:toStage,
      requiresHuman:requiresHuman,
      executionId:executionId,
      source:'N8N',
      summary:requiresHuman
        ? 'Automated work completed; durable human task created before the case may continue.'
        : 'Agent completed and verified the requested action.',
      data:{result:result || {}, humanTask:humanTask && humanTask.task ? humanTask.task : null}
    });

    return {
      ok:true,
      executionId:executionId,
      referenceNo:reference,
      requestedAction:requestedAction,
      currentStage:toStage,
      requiresHuman:requiresHuman,
      humanTask:humanTask,
      result:result
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const row = v2Find_(V2_AGENT_EXECUTIONS_SHEET,'Execution ID',executionId);
    if (row) v2UpdateRow_(row.sheet,row.rowNumber,{
      'Status':'FAILED',
      'Completed At':failedAt,
      'Error':String(error && error.message || error),
      'Last Updated':failedAt
    });

    const errorMessage=String(error && error.message || error);
    let failureTask=null;
    if (typeof v2CreateHumanTask_ === 'function') {
      try {
        failureTask=v2CreateHumanTask_({
          referenceNo:reference,
          taskType:'AGENT_EXECUTION_FAILURE',
          title:v2AgentDisplayName_(agentId)+' execution needs investigation',
          reason:errorMessage,
          raisedByAgent:v2AgentDisplayName_(agentId),
          agentId:agentId,
          executionId:executionId,
          priority:'HIGH',
          assignedTo:'Registrar / System Administrator',
          resumeEvent:'HUMAN_TASK_COMPLETED',
          source:'N8N'
        }, v2AgentDisplayName_(agentId));
      } catch (_) {}
    }

    v2EmitAgentEvent_({
      referenceNo:reference,
      eventType:'AGENT_TASK_FAILED',
      agentId:agentId,
      agentName:v2AgentDisplayName_(agentId),
      action:requestedAction,
      status:'FAILED',
      fromStage:currentStage,
      requiresHuman:true,
      executionId:executionId,
      source:'N8N',
      summary:errorMessage,
      data:{humanTask:failureTask && failureTask.task ? failureTask.task : null}
    });
    throw error;
  }
}

function v2AgentDisplayName_(agentId) {
  const map = {
    ORCHESTRATOR:'AI Orchestrator',
    COMPLIANCE:'Compliance & Records Agent',
    ADMISSION_INTELLIGENCE:'Admission Intelligence Agent',
    SAC_IA:'SAC / IA Coordination Agent',
    STUDENT_CONCIERGE:'Student Concierge Agent',
    SYSTEMS_OPERATOR:'Systems Operator Agent',
    ORIENTATION:'Orientation Management Agent',
    ACADEMIC_HANDOVER:'Academic Handover Agent',
    MANAGEMENT_INTELLIGENCE:'Management Intelligence Agent'
  };
  return map[String(agentId || '').toUpperCase()] || String(agentId || 'AI Agent');
}

function v2AgentParseJson_(value, fallback) {
  try {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'object') return value;
    return JSON.parse(String(value));
  } catch (_) {
    return fallback;
  }
}
