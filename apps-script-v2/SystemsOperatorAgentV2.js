/**
 * IUC IPGS Admission V2 - Systems Operator Agent
 *
 * Current production authority:
 * - Marketing / Academic Consultant creates SKY Prospect and confirms Prospect ID + Fee Group.
 * - Registry performs real student activation/registration in SKY.
 * - This agent verifies readiness, creates a durable Registry task and verifies
 *   the Admission V2 activation record after authorised human completion.
 *
 * Future SKY API/browser automation may replace the human task without changing
 * the surrounding agent contract.
 */

function v2PrepareSkyActivation_(data,actor){
  assertDevIdentity_();
  const input=data||{};
  const reference=v2Required_(input.referenceNo,'Reference No');
  const owner=String(actor||'Systems Operator Agent').trim();

  const wf=v2Find_('V2_WORKFLOW','Reference No',reference);
  const app=v2Find_('V2_APPLICATIONS','Reference No',reference);
  if(!wf||!app)throw new Error('Application/workflow record not found.');

  const activationStatus=String(wf.record['SKY Activation Status']||app.record['SKY Activation Status']||'NOT_ACTIVATED').toUpperCase();
  if(activationStatus==='ACTIVATED'){
    return {
      ok:true,
      referenceNo:reference,
      status:'COMPLETED',
      alreadyActivated:true,
      skyProspectId:String(wf.record['SKY Prospect ID']||app.record['SKY Prospect ID']||''),
      skyStudentId:String(wf.record['SKY Student ID']||app.record['SKY Student ID']||''),
      requiresHuman:false,
      nextAction:'NONE'
    };
  }

  const prospectStatus=String(wf.record['Prospect Status']||app.record['Prospect Status']||'').toUpperCase();
  const skyProspectId=String(wf.record['SKY Prospect ID']||app.record['SKY Prospect ID']||'').trim();
  const feeGroup=String(wf.record['Fee Group']||app.record['Fee Group']||'').trim();

  const blockers=[];
  if(['PROSPECT_COMPLETED','PROSPECT_UPDATED'].indexOf(prospectStatus)<0)blockers.push('Marketing Prospect completion is not confirmed');
  if(!skyProspectId)blockers.push('SKY Prospect ID is missing');
  if(!feeGroup)blockers.push('Fee Group is missing');

  if(blockers.length){
    const task=typeof v2CreateHumanTask_==='function'?v2CreateHumanTask_({
      referenceNo:reference,
      taskType:'SKY_PROSPECT_DATA_REVIEW',
      title:'SKY Prospect data requires review',
      reason:blockers.join('; ')+'.',
      raisedByAgent:'Systems Operator Agent',
      agentId:'SYSTEMS_OPERATOR',
      relatedExecutionId:'SKY_PROSPECT_REVIEW:'+reference,
      priority:'HIGH',
      assignedTo:'Marketing / Registry',
      resumeEvent:'HUMAN_TASK_COMPLETED',
      source:'N8N'
    },owner):null;

    if(typeof v2EmitAgentEvent_==='function'){
      v2EmitAgentEvent_({
        referenceNo:reference,
        eventType:'SKY_PROSPECT_DATA_REVIEW',
        agentId:'SYSTEMS_OPERATOR',
        agentName:'Systems Operator Agent',
        action:'REVIEW_SKY_PROSPECT_DATA',
        status:'WAITING_HUMAN',
        requiresHuman:true,
        executionId:String(input.executionId||''),
        source:'N8N',
        summary:'SKY activation coordination is blocked because Prospect data is incomplete.',
        data:{blockers:blockers}
      });
    }

    return {
      ok:true,referenceNo:reference,status:'WAITING_HUMAN',requiresHuman:true,
      task:task,blockers:blockers,nextAction:'REVIEW_SKY_PROSPECT_DATA'
    };
  }

  const acceptanceStatus=String(wf.record['Acceptance Status']||app.record['Acceptance Status']||'').toUpperCase();
  const applicationStage=String(wf.record['Application Stage']||'').toUpperCase();
  const accepted=acceptanceStatus==='ACCEPTED' || applicationStage==='ACCEPTED' ||
    ['ORIENTATION','ACADEMIC_HANDOVER','ACTIVE_STUDENT'].indexOf(applicationStage)>=0;

  if(!accepted){
    if(typeof v2EmitAgentEvent_==='function'){
      v2EmitAgentEvent_({
        referenceNo:reference,
        eventType:'SKY_PROSPECT_VERIFIED',
        agentId:'SYSTEMS_OPERATOR',
        agentName:'Systems Operator Agent',
        action:'WAIT_FOR_ACCEPTANCE',
        status:'WAITING',
        requiresHuman:false,
        executionId:String(input.executionId||''),
        source:'N8N',
        summary:'SKY Prospect ID and Fee Group are verified. Student activation remains blocked until Acceptance is complete.',
        data:{skyProspectId:skyProspectId,feeGroup:feeGroup}
      });
    }

    return {
      ok:true,
      referenceNo:reference,
      status:'WAITING_ACCEPTANCE',
      requiresHuman:false,
      skyProspectId:skyProspectId,
      feeGroup:feeGroup,
      acceptanceStatus:acceptanceStatus,
      applicationStage:applicationStage,
      nextAction:'WAIT_FOR_ACCEPTANCE'
    };
  }

  // Current safe mode: Registry performs the actual SKY action.
  const task=typeof v2CreateHumanTask_==='function'?v2CreateHumanTask_({
    referenceNo:reference,
    taskType:'SKY_ACTIVATION_REQUIRED',
    title:'Activate student in SKY',
    reason:'Marketing has completed SKY Prospect '+skyProspectId+' and Fee Group '+feeGroup+'. Registry must now perform the real SKY student activation/registration and return the SKY Student / Registration ID.',
    raisedByAgent:'Systems Operator Agent',
    agentId:'SYSTEMS_OPERATOR',
    relatedExecutionId:'SKY_ACTIVATION:'+reference,
    priority:'NORMAL',
    assignedTo:'Registry',
    resumeEvent:'HUMAN_TASK_COMPLETED',
    source:'N8N'
  },owner):null;

  if(typeof v2EmitAgentEvent_==='function'){
    v2EmitAgentEvent_({
      referenceNo:reference,
      eventType:'SKY_ACTIVATION_REQUIRED',
      agentId:'SYSTEMS_OPERATOR',
      agentName:'Systems Operator Agent',
      action:'REGISTRY_ACTIVATE_IN_SKY',
      status:'WAITING_HUMAN',
      requiresHuman:true,
      executionId:String(input.executionId||''),
      source:'N8N',
      summary:'Prospect and Fee Group verified. Waiting for Registry to perform real SKY activation.',
      data:{skyProspectId:skyProspectId,feeGroup:feeGroup}
    });
  }

  return {
    ok:true,
    referenceNo:reference,
    status:'WAITING_HUMAN',
    requiresHuman:true,
    task:task,
    skyProspectId:skyProspectId,
    feeGroup:feeGroup,
    nextAction:'SKY_ACTIVATION_REQUIRED'
  };
}
