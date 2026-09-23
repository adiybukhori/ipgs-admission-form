/**
 * IUC IPGS Admission V2 - Human Task Gateway
 *
 * Human authority stays outside AI. This module gives AI/n8n a durable,
 * auditable way to pause a case, surface exactly what a human must decide,
 * record the authorised resolution, and resume orchestration afterwards.
 */

const V2_HUMAN_TASKS_SHEET='V2_HUMAN_TASKS';
const V2_HUMAN_TASKS_HEADERS=[
  'Task ID','Created At','Reference No','Student Name','Programme',
  'Task Type','Title','Reason','Raised By Agent','Related Execution ID',
  'Status','Priority','Assigned To','Decision','Resolution Notes',
  'Resolution JSON','Resolved By','Resolved At','Resume Event','Last Updated'
];

function v2HumanTaskEnsureFoundation_(){
  const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId);
  let sheet=ss.getSheetByName(V2_HUMAN_TASKS_SHEET);
  if(!sheet)sheet=ss.insertSheet(V2_HUMAN_TASKS_SHEET);
  v2EnsureHeaders_(sheet,V2_HUMAN_TASKS_HEADERS);
  v2StyleHeader_(sheet,V2_HUMAN_TASKS_HEADERS.length);
  return sheet;
}

function v2CreateHumanTask_(data,actor){
  assertDevIdentity_();
  const input=data||{};
  const reference=v2Required_(input.referenceNo,'Reference No');
  const taskType=v2Required_(input.taskType,'Task Type').toUpperCase();
  const relatedExecutionId=String(input.executionId||input.relatedExecutionId||'').trim();
  const app=v2Find_('V2_APPLICATIONS','Reference No',reference);
  if(!app)throw new Error('Application not found.');

  v2HumanTaskEnsureFoundation_();

  // Avoid duplicate open task for the same case/type/execution.
  const existing=v2Rows_(V2_HUMAN_TASKS_SHEET).find(function(row){
    return String(row['Reference No']||'')===reference &&
      String(row['Task Type']||'').toUpperCase()===taskType &&
      String(row['Related Execution ID']||'')===relatedExecutionId &&
      ['OPEN','WAITING_HUMAN','IN_REVIEW'].indexOf(String(row['Status']||'').toUpperCase())>-1;
  });
  if(existing)return {ok:true,idempotentReplay:true,task:existing};

  const taskId='HT-'+Utilities.getUuid().slice(0,12).toUpperCase();
  const now=new Date().toISOString();
  const raisedBy=String(input.raisedByAgent||actor||'AI Orchestrator').trim();
  const title=String(input.title||taskType.replace(/_/g,' ')).trim();
  const reason=String(input.reason||input.summary||'Human authority is required before the case may continue.').trim();
  const resumeEvent=String(input.resumeEvent||'HUMAN_TASK_COMPLETED').trim().toUpperCase();

  const row={
    'Task ID':taskId,
    'Created At':now,
    'Reference No':reference,
    'Student Name':String(app.record['Student Name']||''),
    'Programme':String(app.record['Programme']||''),
    'Task Type':taskType,
    'Title':title,
    'Reason':reason,
    'Raised By Agent':raisedBy,
    'Related Execution ID':relatedExecutionId,
    'Status':'WAITING_HUMAN',
    'Priority':String(input.priority||'NORMAL').toUpperCase(),
    'Assigned To':String(input.assignedTo||'Registrar / Authorised Decision Maker'),
    'Decision':'',
    'Resolution Notes':'',
    'Resolution JSON':'',
    'Resolved By':'',
    'Resolved At':'',
    'Resume Event':resumeEvent,
    'Last Updated':now
  };
  v2Append_(V2_HUMAN_TASKS_SHEET,row);

  if(typeof v2EmitAgentEvent_==='function'){
    v2EmitAgentEvent_({
      referenceNo:reference,
      eventType:'HUMAN_TASK_CREATED',
      agentId:String(input.agentId||'ORCHESTRATOR'),
      agentName:raisedBy,
      action:taskType,
      status:'WAITING_HUMAN',
      requiresHuman:true,
      executionId:relatedExecutionId,
      source:String(input.source||'ADMISSION_V2'),
      summary:title+': '+reason,
      data:{taskId:taskId,taskType:taskType,priority:row['Priority'],resumeEvent:resumeEvent}
    });
  }

  v2Audit_(reference,'HUMAN_TASK','CREATE_HUMAN_TASK',{},{
    taskId:taskId,taskType:taskType,title:title,raisedBy:raisedBy,executionId:relatedExecutionId
  },actor||raisedBy,'SUCCESS',reason);

  return {ok:true,task:row};
}

function v2ResolveHumanTask_(data,actor){
  assertDevIdentity_();
  const input=data||{};
  const taskId=v2Required_(input.taskId,'Task ID');
  const decision=v2Required_(input.decision,'Decision').toUpperCase();
  const resolvedBy=String(input.resolvedBy||actor||'Authorised Human').trim();
  const now=new Date().toISOString();

  const allowed=['APPROVE','CONFIRM','RETURN','REQUEST_EVIDENCE','REJECT','RESOLVED'];
  if(allowed.indexOf(decision)<0)throw new Error('Unsupported human decision: '+decision);

  const found=v2Find_(V2_HUMAN_TASKS_SHEET,'Task ID',taskId);
  if(!found)throw new Error('Human task not found.');
  const current=String(found.record['Status']||'').toUpperCase();
  if(current==='RESOLVED'){
    return {ok:true,idempotentReplay:true,task:found.record};
  }

  const reference=String(found.record['Reference No']||'');
  const resolution=input.resolution&&typeof input.resolution==='object'?input.resolution:{};
  const resumeEvent=String(found.record['Resume Event']||'HUMAN_TASK_COMPLETED').toUpperCase();
  const taskType=String(found.record['Task Type']||'').toUpperCase();

  // Screening exceptions: human resolves the authority question, not the full case.
  // AI-extracted Field Relationship + Relevant Work Experience are reused unless
  // the authorised reviewer explicitly overrides them.
  let screeningResolution=null;
  let documentQualityResolution=null;
  let sacDecisionResolution=null;
  let iaOutcomeResolution=null;
  let prerequisiteOutcomeResolution=null;
  if (taskType==='DOCUMENT_QUALITY_REVIEW' && ['APPROVE','CONFIRM','RESOLVED','REQUEST_EVIDENCE','RETURN'].indexOf(decision)>-1) {
    const doc=v2Find_('V2_DOCUMENT_REVIEW','Reference No',reference);
    const wf=v2Find_('V2_WORKFLOW','Reference No',reference);
    if (!doc || !wf) throw new Error('Document review/workflow record not found for human quality resolution.');

    const qualityDecision=String(
      resolution.documentQualityDecision ||
      (['APPROVE','CONFIRM','RESOLVED'].indexOf(decision)>-1 ? 'PASS' : 'FOLLOW_UP_REQUIRED')
    ).toUpperCase();

    if (['PASS','FOLLOW_UP_REQUIRED'].indexOf(qualityDecision)<0) {
      throw new Error('Document quality resolution must be PASS or FOLLOW_UP_REQUIRED.');
    }

    const qualityNotes=String(
      resolution.replacementInstruction ||
      resolution.qualityNotes ||
      input.notes ||
      input.resolutionNotes || ''
    ).trim();

    v2UpdateRow_(doc.sheet,doc.rowNumber,{
      'AI Quality Status':qualityDecision,
      'Human Quality Decision':qualityDecision,
      'Human Quality Notes':qualityNotes,
      'Human Quality Reviewed At':now,
      'Human Quality Reviewed By':resolvedBy,
      'Last Updated':now
    });
    v2UpdateRow_(wf.sheet,wf.rowNumber,{
      'Document Quality Status':qualityDecision,
      'Document Quality Reviewed At':now,
      'Document Quality Reviewed By':resolvedBy,
      'Last Updated':now,
      'Updated By':resolvedBy
    });

    documentQualityResolution={
      status:qualityDecision,
      notes:qualityNotes,
      nextAction:qualityDecision==='PASS' ? 'ADMISSION_INTELLIGENCE' : 'STUDENT_DOCUMENT_REPLACEMENT'
    };

    if (typeof v2EmitAgentEvent_==='function') {
      v2EmitAgentEvent_({
        referenceNo:reference,
        eventType:qualityDecision==='PASS' ? 'DOCUMENT_QUALITY_PASSED' : 'DOCUMENT_REPLACEMENT_REQUIRED',
        agentId:'COMPLIANCE',
        agentName:'Compliance & Records Agent',
        action:qualityDecision==='PASS' ? 'ROUTE_ADMISSION_INTELLIGENCE' : 'STUDENT_DOCUMENT_REPLACEMENT',
        status:qualityDecision==='PASS' ? 'COMPLETED' : 'WAITING',
        fromStage:'DOCUMENT_REVIEW',
        toStage:qualityDecision==='PASS' ? 'QUALIFICATION_SCREENING' : 'DOCUMENT_REVIEW',
        requiresHuman:false,
        executionId:String(found.record['Related Execution ID']||''),
        source:'HUMAN_DECISION_DESK',
        summary:qualityDecision==='PASS'
          ? 'Authorised human review confirmed document quality. Route to Admission Intelligence.'
          : 'Authorised human review requires replacement document(s) before academic screening.',
        data:{taskId:taskId,decision:decision,qualityDecision:qualityDecision,notes:qualityNotes}
      });
    }
  }

  if (taskType==='ADMISSION_SCREENING_REVIEW' && ['APPROVE','CONFIRM','RESOLVED'].indexOf(decision)>-1) {
    const ai=v2Find_('V2_AI_SCREENING','Reference No',reference);
    const qs=v2Find_('V2_QUALIFICATION_SCREENING','Reference No',reference);
    const field=String(
      resolution.fieldClassification ||
      ai && (ai.record['Field Classification'] || ai.record['Human Field Classification']) ||
      qs && qs.record['Field Classification'] || ''
    ).trim().toUpperCase();
    const experience=String(
      resolution.relevantWorkExperience ||
      ai && (ai.record['Relevant Work Experience'] || ai.record['Human Relevant Work Experience']) ||
      qs && qs.record['Relevant Work Experience'] || ''
    ).trim().toUpperCase();
    const recommendation=String(
      resolution.recommendedRoute ||
      qs && qs.record['Recommended Route'] || ''
    ).trim().toUpperCase();

    if (!field) throw new Error('Human screening resolution requires Field Classification or a reusable AI classification.');
    if (!experience) throw new Error('Human screening resolution requires Relevant Work Experience or a reusable AI result.');
    if (!recommendation) throw new Error('Human screening resolution requires an authorised screening recommendation.');

    const equivalencyNote=String(resolution.gradeEquivalencyNote || resolution.equivalencyNote || '').trim();
    const reviewRemarks=[
      String(input.notes||input.resolutionNotes||'').trim(),
      equivalencyNote ? ('Grade equivalency / academic confirmation: '+equivalencyNote) : ''
    ].filter(Boolean).join(' | ');

    if (ai) {
      v2UpdateRow_(ai.sheet,ai.rowNumber,{
        'Human Review Status':'CONFIRMED',
        'Human Reviewed At':now,
        'Human Reviewed By':resolvedBy,
        'Human Field Classification':field,
        'Human Relevant Work Experience':experience,
        'Human Remarks':reviewRemarks,
        'Confirmed For Rule Engine':'YES',
        'Rule Engine Input Source':'HUMAN_CONFIRMED_AI',
        'Last Updated':now
      });
    }

    screeningResolution=v2CompleteManualQualificationScreening_({
      referenceNo:reference,
      fieldClassification:field,
      relevantWorkExperience:experience,
      recommendedRoute:recommendation,
      remarks:reviewRemarks || ('Human task '+taskId+' confirmed the AI-assisted screening exception.')
    },resolvedBy);

    if (screeningResolution && String(screeningResolution.applicationStage||'').toUpperCase()==='READY_FOR_SAC' && typeof v2EmitAgentEvent_==='function') {
      v2EmitAgentEvent_({
        referenceNo:reference,
        eventType:'SCREENING_READY_FOR_SAC',
        agentId:'ADMISSION_INTELLIGENCE',
        agentName:'Admission Intelligence Agent',
        action:'ROUTE_SAC_IA',
        status:'COMPLETED',
        fromStage:'QUALIFICATION_SCREENING',
        toStage:'READY_FOR_SAC',
        requiresHuman:false,
        executionId:String(found.record['Related Execution ID']||''),
        source:'HUMAN_DECISION_DESK',
        summary:'Authorised screening exception resolved. Applicant is ready for SAC coordination.'
      });
    }
  }

  if (taskType==='SAC_DECISION_REQUIRED' && ['APPROVE','CONFIRM','RESOLVED'].indexOf(decision)>-1) {
    const wf=v2Find_('V2_WORKFLOW','Reference No',reference);
    if(!wf)throw new Error('Workflow record not found for SAC decision.');
    const sessionId=String(resolution.sessionId||wf.record['SAC Session ID']||'').trim();
    const sacDecision=String(resolution.sacDecision||'').trim().toUpperCase();
    if(!sessionId)throw new Error('SAC Session ID is required.');
    if(['DIRECT_ENTRY','INTERNAL_ASSESSMENT','REJECTED'].indexOf(sacDecision)<0){
      throw new Error('SAC decision must be DIRECT_ENTRY, INTERNAL_ASSESSMENT or REJECTED.');
    }

    sacDecisionResolution=v2RecordSacDecisionManual_({
      sessionId:sessionId,
      referenceNo:reference,
      decision:sacDecision,
      remarks:String(input.notes||input.resolutionNotes||resolution.remarks||''),
      priority:String(resolution.priority||'NORMAL'),
      confirmed:true
    },resolvedBy);

    if(typeof v2EmitAgentEvent_==='function'){
      v2EmitAgentEvent_({
        referenceNo:reference,
        eventType:'SAC_DECISION_RECORDED',
        agentId:'SAC_IA',
        agentName:'SAC / IA Coordination Agent',
        action:sacDecision==='INTERNAL_ASSESSMENT'?'ROUTE_IA':'SAC_OUTCOME_RECORDED',
        status:'COMPLETED',
        fromStage:'SAC_REVIEW',
        toStage:String(sacDecisionResolution.nextStage||''),
        requiresHuman:false,
        executionId:String(found.record['Related Execution ID']||''),
        source:'HUMAN_DECISION_DESK',
        summary:'Authorised SAC decision recorded: '+sacDecision+'.',
        data:{sessionId:sessionId,sacDecision:sacDecision,nextStage:sacDecisionResolution.nextStage||''}
      });
    }
  }

  if (taskType==='IA_OUTCOME_REQUIRED' && ['APPROVE','CONFIRM','RESOLVED'].indexOf(decision)>-1) {
    const panelResult=String(resolution.panelResult||resolution.iaOutcome||'').trim().toUpperCase();
    if(['QUALIFIED','PREREQUISITE_REQUIRED','NOT_QUALIFIED'].indexOf(panelResult)<0){
      throw new Error('IA outcome must be QUALIFIED, PREREQUISITE_REQUIRED or NOT_QUALIFIED.');
    }
    iaOutcomeResolution=v2UpdateAssessment_({
      referenceNo:reference,
      assessmentType:'INTERNAL_ASSESSMENT',
      sequence:1,
      component:'OVERALL',
      status:'COMPLETED',
      panelResult:panelResult,
      panelRemarks:String(input.notes||input.resolutionNotes||resolution.remarks||''),
      nextAction:panelResult==='PREREQUISITE_REQUIRED'?'PREPARE_PREREQUISITE_COORDINATION':(panelResult==='QUALIFIED'?'OFFER_READY':'CLOSE_ADMISSION')
    },resolvedBy);

    const toStage=String(iaOutcomeResolution.workflowUpdates&&iaOutcomeResolution.workflowUpdates['Application Stage']||'');
    if(typeof v2EmitAgentEvent_==='function'){
      v2EmitAgentEvent_({
        referenceNo:reference,
        eventType:'IA_OUTCOME_RECORDED',
        agentId:'SAC_IA',
        agentName:'SAC / IA Coordination Agent',
        action:panelResult==='PREREQUISITE_REQUIRED'?'ROUTE_PREREQUISITE':'IA_OUTCOME_RECORDED',
        status:'COMPLETED',
        fromStage:'INTERNAL_ASSESSMENT',
        toStage:toStage,
        requiresHuman:false,
        executionId:String(found.record['Related Execution ID']||''),
        source:'HUMAN_DECISION_DESK',
        summary:'Authorised Internal Assessment outcome recorded: '+panelResult+'.',
        data:{panelResult:panelResult,nextStage:toStage}
      });
    }
  }

  if (taskType==='PREREQUISITE_OUTCOME_REQUIRED' && ['APPROVE','CONFIRM','RESOLVED'].indexOf(decision)>-1) {
    const panelResult=String(resolution.panelResult||resolution.prerequisiteOutcome||'').trim().toUpperCase();
    if(['QUALIFIED','NOT_QUALIFIED'].indexOf(panelResult)<0){
      throw new Error('Prerequisite outcome must be QUALIFIED or NOT_QUALIFIED.');
    }
    prerequisiteOutcomeResolution=v2UpdateAssessment_({
      referenceNo:reference,
      assessmentType:'PREREQUISITE',
      sequence:1,
      component:'OVERALL',
      status:'COMPLETED',
      panelResult:panelResult,
      panelRemarks:String(input.notes||input.resolutionNotes||resolution.remarks||''),
      nextAction:panelResult==='QUALIFIED'?'OFFER_READY':'CLOSE_ADMISSION'
    },resolvedBy);

    const toStage=String(prerequisiteOutcomeResolution.workflowUpdates&&prerequisiteOutcomeResolution.workflowUpdates['Application Stage']||'');
    if(typeof v2EmitAgentEvent_==='function'){
      v2EmitAgentEvent_({
        referenceNo:reference,
        eventType:'PREREQUISITE_OUTCOME_RECORDED',
        agentId:'SAC_IA',
        agentName:'SAC / IA Coordination Agent',
        action:'PREREQUISITE_OUTCOME_RECORDED',
        status:'COMPLETED',
        fromStage:'PREREQUISITE',
        toStage:toStage,
        requiresHuman:false,
        executionId:String(found.record['Related Execution ID']||''),
        source:'HUMAN_DECISION_DESK',
        summary:'Authorised prerequisite outcome recorded: '+panelResult+'.',
        data:{panelResult:panelResult,nextStage:toStage}
      });
    }
  }

  const updates={
    'Status':'RESOLVED',
    'Decision':decision,
    'Resolution Notes':String(input.notes||input.resolutionNotes||''),
    'Resolution JSON':JSON.stringify(resolution),
    'Resolved By':resolvedBy,
    'Resolved At':now,
    'Last Updated':now
  };
  v2UpdateRow_(found.sheet,found.rowNumber,updates);

  if(typeof v2EmitAgentEvent_==='function'){
    v2EmitAgentEvent_({
      referenceNo:reference,
      eventType:resumeEvent,
      agentId:'ORCHESTRATOR',
      agentName:'AI Orchestrator',
      action:String(found.record['Task Type']||'HUMAN_RESOLUTION'),
      status:'COMPLETED',
      requiresHuman:false,
      executionId:String(found.record['Related Execution ID']||''),
      source:'HUMAN_DECISION_DESK',
      summary:'Human task '+taskId+' resolved: '+decision+'.',
      data:{taskId:taskId,decision:decision,resolution:resolution,resolvedBy:resolvedBy,screeningResolution:screeningResolution,documentQualityResolution:documentQualityResolution,sacDecisionResolution:sacDecisionResolution,iaOutcomeResolution:iaOutcomeResolution,prerequisiteOutcomeResolution:prerequisiteOutcomeResolution}
    });
  }

  v2Audit_(reference,'HUMAN_TASK','RESOLVE_HUMAN_TASK',found.record,updates,resolvedBy,'SUCCESS',
    String(input.notes||('Human decision recorded: '+decision)));

  v2InvalidateCache_();
  return {
    ok:true,
    taskId:taskId,
    referenceNo:reference,
    decision:decision,
    resumeEvent:resumeEvent,
    resolvedBy:resolvedBy,
    resolvedAt:now,
    resolution:resolution,
    screeningResolution:screeningResolution,
    documentQualityResolution:documentQualityResolution,
    sacDecisionResolution:sacDecisionResolution,
    iaOutcomeResolution:iaOutcomeResolution,
    prerequisiteOutcomeResolution:prerequisiteOutcomeResolution
  };
}

function v2ListOpenHumanTasks_(){
  assertDevIdentity_();
  v2HumanTaskEnsureFoundation_();
  const tasks=v2Rows_(V2_HUMAN_TASKS_SHEET)
    .filter(function(row){return ['OPEN','WAITING_HUMAN','IN_REVIEW'].indexOf(String(row['Status']||'').toUpperCase())>-1;})
    .sort(function(a,b){return String(b['Created At']||'').localeCompare(String(a['Created At']||''));});
  return {ok:true,tasks:tasks,count:tasks.length};
}
