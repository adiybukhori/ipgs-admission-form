/**
 * IUC IPGS Admission V2 - SAC / IA Coordination Agent
 *
 * Administrative orchestration only.
 * Human / authorised academic bodies retain SAC, IA and prerequisite outcomes.
 */

function v2PrepareSacCoordination_(data,actor) {
  assertDevIdentity_();
  const input=data||{};
  const reference=v2Required_(input.referenceNo,'Reference No');
  const owner=String(actor||'SAC / IA Coordination Agent').trim();

  const wf=v2Find_('V2_WORKFLOW','Reference No',reference);
  if(!wf)throw new Error('V2 workflow record not found.');
  const stage=String(wf.record['Application Stage']||'').toUpperCase();
  if(['READY_FOR_SAC','SAC_REVIEW'].indexOf(stage)<0){
    return {ok:true,skipped:true,referenceNo:reference,stage:stage,message:'Case is not ready for SAC coordination.'};
  }

  let sessionId=String(input.sessionId||wf.record['SAC Session ID']||'').trim();
  let candidate=null;

  if(!sessionId){
    const existing=v2Rows_('V2_SAC_CANDIDATES').filter(function(row){
      return String(row['Reference No']||'')===reference &&
        String(row['Decision']||'PENDING').toUpperCase()==='PENDING';
    })[0];
    if(existing)sessionId=String(existing['SAC Session ID']||'').trim();
  }

  if(!sessionId){
    const selected=v2SacIaFindOpenSession_();
    if(selected)sessionId=String(selected['SAC Session ID']||'').trim();
  }

  if(!sessionId){
    const task=typeof v2CreateHumanTask_==='function'?v2CreateHumanTask_({
      referenceNo:reference,
      taskType:'SAC_SESSION_REQUIRED',
      title:'SAC session required',
      reason:'The applicant is ready for SAC but there is no suitable open upcoming SAC session. Create or select the authorised SAC session before the case can continue.',
      raisedByAgent:'SAC / IA Coordination Agent',
      agentId:'SAC_IA',
      relatedExecutionId:'SAC_SESSION:'+reference,
      priority:'NORMAL',
      assignedTo:'Registry / SAC Secretariat',
      resumeEvent:'HUMAN_TASK_COMPLETED',
      source:'N8N'
    },owner):null;

    if(typeof v2EmitAgentEvent_==='function'){
      v2EmitAgentEvent_({
        referenceNo:reference,
        eventType:'SAC_SESSION_REQUIRED',
        agentId:'SAC_IA',
        agentName:'SAC / IA Coordination Agent',
        action:'CREATE_OR_SELECT_SAC_SESSION',
        status:'WAITING_HUMAN',
        fromStage:stage,
        toStage:'READY_FOR_SAC',
        requiresHuman:true,
        executionId:String(input.executionId||''),
        source:'N8N',
        summary:'Applicant is ready for SAC but no suitable open session is available.'
      });
    }

    return {ok:true,referenceNo:reference,status:'WAITING_HUMAN',requiresHuman:true,task:task,nextAction:'SAC_SESSION_REQUIRED'};
  }

  const session=v2Find_('V2_SAC_SESSIONS','SAC Session ID',sessionId);
  if(!session)throw new Error('Selected SAC session not found: '+sessionId);
  const sessionStatus=String(session.record['Status']||'DRAFT').toUpperCase();
  if(/FINAL|CLOSED|CANCEL/.test(sessionStatus))throw new Error('Selected SAC session is not open.');

  candidate=v2FindComposite_('V2_SAC_CANDIDATES',['SAC Session ID','Reference No'],[sessionId,reference]);
  if(!candidate){
    v2AssignSacCandidate_({
      sessionId:sessionId,
      referenceNo:reference,
      priority:String(input.priority||'NORMAL')
    },owner);
    candidate=v2FindComposite_('V2_SAC_CANDIDATES',['SAC Session ID','Reference No'],[sessionId,reference]);
  }

  const pack=v2PrepareSacPack_({sessionId:sessionId},owner);
  const current=(pack.candidates||[]).filter(function(x){return String(x.referenceNo||'')===reference;})[0]||null;

  if(!current||current.complete!==true){
    const missing=current&&Array.isArray(current.missingDocuments)?current.missingDocuments:[];
    const reason='SAC pack is not complete'+(missing.length?': '+missing.map(function(x){return x.label||x.key;}).join(', '):'.');
    const task=typeof v2CreateHumanTask_==='function'?v2CreateHumanTask_({
      referenceNo:reference,
      taskType:'SAC_PACK_INCOMPLETE',
      title:'SAC pack requires attention',
      reason:reason,
      raisedByAgent:'SAC / IA Coordination Agent',
      agentId:'SAC_IA',
      relatedExecutionId:'SAC_PACK:'+sessionId+':'+reference,
      priority:'HIGH',
      assignedTo:'Registry / SAC Secretariat',
      resumeEvent:'HUMAN_TASK_COMPLETED',
      source:'N8N'
    },owner):null;

    return {
      ok:true,referenceNo:reference,sessionId:sessionId,status:'WAITING_HUMAN',
      requiresHuman:true,task:task,pack:current,nextAction:'COMPLETE_SAC_PACK'
    };
  }

  const decisionTask=typeof v2CreateHumanTask_==='function'?v2CreateHumanTask_({
    referenceNo:reference,
    taskType:'SAC_DECISION_REQUIRED',
    title:'SAC decision required',
    reason:'SAC pack is complete and the applicant is ready for the authorised SAC outcome. The AI agent does not make this academic decision.',
    raisedByAgent:'SAC / IA Coordination Agent',
    agentId:'SAC_IA',
    relatedExecutionId:'SAC_DECISION:'+sessionId+':'+reference,
    priority:String(input.priority||'NORMAL').toUpperCase(),
    assignedTo:'SAC / Authorised Decision Maker',
    resumeEvent:'HUMAN_TASK_COMPLETED',
    source:'N8N'
  },owner):null;

  if(typeof v2EmitAgentEvent_==='function'){
    v2EmitAgentEvent_({
      referenceNo:reference,
      eventType:'SAC_PACK_READY',
      agentId:'SAC_IA',
      agentName:'SAC / IA Coordination Agent',
      action:'AWAIT_SAC_DECISION',
      status:'WAITING_HUMAN',
      fromStage:'READY_FOR_SAC',
      toStage:'SAC_REVIEW',
      requiresHuman:true,
      executionId:String(input.executionId||''),
      source:'N8N',
      summary:'Candidate assigned to SAC and pack verified complete. Awaiting authorised SAC decision.',
      data:{sessionId:sessionId,packComplete:true}
    });
  }

  return {
    ok:true,
    referenceNo:reference,
    sessionId:sessionId,
    status:'WAITING_HUMAN',
    requiresHuman:true,
    candidate:candidate?candidate.record:null,
    pack:current,
    task:decisionTask,
    nextAction:'SAC_DECISION_REQUIRED'
  };
}

function v2SacIaFindOpenSession_(){
  const today=Utilities.formatDate(new Date(),CONFIG.timezone||'Asia/Kuala_Lumpur','yyyy-MM-dd');
  const rows=v2Rows_('V2_SAC_SESSIONS').filter(function(row){
    const status=String(row['Status']||'DRAFT').toUpperCase();
    const date=String(row['Meeting Date']||'').trim();
    return !/FINAL|CLOSED|CANCEL/.test(status) && !!date && date>=today;
  });
  rows.sort(function(a,b){
    const ad=String(a['Meeting Date']||'')+' '+String(a['Meeting Time']||'');
    const bd=String(b['Meeting Date']||'')+' '+String(b['Meeting Time']||'');
    return ad.localeCompare(bd);
  });
  return rows[0]||null;
}

function v2PrepareIaCoordination_(data,actor){
  assertDevIdentity_();
  const input=data||{};
  const reference=v2Required_(input.referenceNo,'Reference No');
  const owner=String(actor||'SAC / IA Coordination Agent').trim();
  const wf=v2Find_('V2_WORKFLOW','Reference No',reference);
  if(!wf)throw new Error('V2 workflow record not found.');
  const stage=String(wf.record['Application Stage']||'').toUpperCase();
  if(stage!=='INTERNAL_ASSESSMENT'){
    return {ok:true,skipped:true,referenceNo:reference,stage:stage,message:'Case is not at Internal Assessment stage.'};
  }

  const existing=v2Rows_('V2_ASSESSMENT_PROGRESS').filter(function(row){
    return String(row['Reference No']||'')===reference &&
      String(row['Assessment Type']||'').toUpperCase()==='INTERNAL_ASSESSMENT' &&
      Number(row['Sequence']||1)===1;
  })[0];

  if(!existing || String(existing['Status']||'').toUpperCase()!=='COMPLETED'){
    v2UpdateAssessment_({
      referenceNo:reference,
      assessmentType:'INTERNAL_ASSESSMENT',
      sequence:1,
      component:'OVERALL',
      status:'IN_PROGRESS',
      nextAction:'AWAIT_AUTHORISED_IA_RESULT'
    },owner);
  }

  const task=typeof v2CreateHumanTask_==='function'?v2CreateHumanTask_({
    referenceNo:reference,
    taskType:'IA_OUTCOME_REQUIRED',
    title:'Internal Assessment outcome required',
    reason:'The IA route is active. Record the authorised panel outcome only after the approved assessment process is complete.',
    raisedByAgent:'SAC / IA Coordination Agent',
    agentId:'SAC_IA',
    relatedExecutionId:'IA_OUTCOME:'+reference,
    priority:'NORMAL',
    assignedTo:'IA Panel / Authorised Academic Reviewer',
    resumeEvent:'HUMAN_TASK_COMPLETED',
    source:'N8N'
  },owner):null;

  if(typeof v2EmitAgentEvent_==='function'){
    v2EmitAgentEvent_({
      referenceNo:reference,eventType:'IA_COORDINATION_READY',agentId:'SAC_IA',
      agentName:'SAC / IA Coordination Agent',action:'AWAIT_IA_OUTCOME',status:'WAITING_HUMAN',
      fromStage:'INTERNAL_ASSESSMENT',toStage:'INTERNAL_ASSESSMENT',requiresHuman:true,
      executionId:String(input.executionId||''),source:'N8N',
      summary:'Internal Assessment tracking is ready. Awaiting authorised IA panel outcome.'
    });
  }

  return {ok:true,referenceNo:reference,status:'WAITING_HUMAN',requiresHuman:true,task:task,nextAction:'IA_OUTCOME_REQUIRED'};
}

function v2PreparePrerequisiteCoordination_(data,actor){
  assertDevIdentity_();
  const input=data||{};
  const reference=v2Required_(input.referenceNo,'Reference No');
  const owner=String(actor||'SAC / IA Coordination Agent').trim();
  const wf=v2Find_('V2_WORKFLOW','Reference No',reference);
  if(!wf)throw new Error('V2 workflow record not found.');
  const stage=String(wf.record['Application Stage']||'').toUpperCase();
  if(stage!=='PREREQUISITE'){
    return {ok:true,skipped:true,referenceNo:reference,stage:stage,message:'Case is not at Prerequisite stage.'};
  }

  v2UpdateAssessment_({
    referenceNo:reference,
    assessmentType:'PREREQUISITE',
    sequence:1,
    component:'OVERALL',
    status:'IN_PROGRESS',
    nextAction:'AWAIT_AUTHORISED_PREREQUISITE_RESULT'
  },owner);

  const task=typeof v2CreateHumanTask_==='function'?v2CreateHumanTask_({
    referenceNo:reference,
    taskType:'PREREQUISITE_OUTCOME_REQUIRED',
    title:'Prerequisite course outcome required',
    reason:'The prerequisite route was authorised after IA. Record the final approved prerequisite result after course completion.',
    raisedByAgent:'SAC / IA Coordination Agent',
    agentId:'SAC_IA',
    relatedExecutionId:'PREREQUISITE_OUTCOME:'+reference,
    priority:'NORMAL',
    assignedTo:'Academic / Authorised Reviewer',
    resumeEvent:'HUMAN_TASK_COMPLETED',
    source:'N8N'
  },owner):null;

  if(typeof v2EmitAgentEvent_==='function'){
    v2EmitAgentEvent_({
      referenceNo:reference,eventType:'PREREQUISITE_COORDINATION_READY',agentId:'SAC_IA',
      agentName:'SAC / IA Coordination Agent',action:'AWAIT_PREREQUISITE_OUTCOME',status:'WAITING_HUMAN',
      fromStage:'PREREQUISITE',toStage:'PREREQUISITE',requiresHuman:true,
      executionId:String(input.executionId||''),source:'N8N',
      summary:'Prerequisite tracking is ready. Awaiting authorised completion result.'
    });
  }

  return {ok:true,referenceNo:reference,status:'WAITING_HUMAN',requiresHuman:true,task:task,nextAction:'PREREQUISITE_OUTCOME_REQUIRED'};
}
