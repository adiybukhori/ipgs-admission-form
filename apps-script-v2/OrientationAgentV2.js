/**
 * IUC IPGS Admission V2 - Orientation Management Agent
 *
 * First production scope:
 * ACCEPTED applicant -> nearest suitable future Orientation session -> assign ->
 * send invitation -> verify tracking -> ensure existing D3/D2/D1/H1 reminder
 * automation is active.
 */

function v2PrepareOrientationForAccepted_(data,actor){
  assertDevIdentity_();
  const input=data||{};
  const reference=v2Required_(input.referenceNo,'Reference No');
  const owner=String(actor||'Orientation Management Agent').trim();

  const wf=v2Find_('V2_WORKFLOW','Reference No',reference);
  const app=v2Find_('V2_APPLICATIONS','Reference No',reference);
  if(!wf||!app)throw new Error('Application/workflow record not found.');

  const stage=String(wf.record['Application Stage']||'').toUpperCase();
  const acceptance=String(wf.record['Acceptance Status']||'').toUpperCase();
  if(stage!=='ACCEPTED' && acceptance!=='ACCEPTED'){
    return {ok:true,skipped:true,referenceNo:reference,stage:stage,acceptanceStatus:acceptance,message:'Applicant is not accepted yet.'};
  }

  let sessionId=String(input.sessionId||wf.record['Orientation Session ID']||'').trim();
  let tracking=null;

  if(sessionId){
    tracking=v2FindComposite_('V2_ORIENTATION_TRACKING',['Orientation Session ID','Reference No'],[sessionId,reference]);
  }

  if(!sessionId){
    const active=v2Rows_('V2_ORIENTATION_TRACKING').filter(function(row){
      return String(row['Reference No']||'')===reference &&
        (typeof v2OrientationAssignmentActive_!=='function'||v2OrientationAssignmentActive_(row));
    })[0];
    if(active){
      sessionId=String(active['Orientation Session ID']||'').trim();
      tracking=v2FindComposite_('V2_ORIENTATION_TRACKING',['Orientation Session ID','Reference No'],[sessionId,reference]);
    }
  }

  if(!sessionId){
    const selected=v2OrientationAgentFindUpcomingSession_(wf.record,app.record);
    if(selected)sessionId=String(selected['Orientation Session ID']||'').trim();
  }

  if(!sessionId){
    const task=typeof v2CreateHumanTask_==='function'?v2CreateHumanTask_({
      referenceNo:reference,
      taskType:'ORIENTATION_SESSION_REQUIRED',
      title:'Orientation session required',
      reason:'The accepted applicant is ready for orientation, but no suitable future Orientation Session is available.',
      raisedByAgent:'Orientation Management Agent',
      agentId:'ORIENTATION',
      relatedExecutionId:'ORIENTATION_SESSION:'+reference,
      priority:'NORMAL',
      assignedTo:'Registry / Orientation Coordinator',
      resumeEvent:'HUMAN_TASK_COMPLETED',
      source:'N8N'
    },owner):null;

    if(typeof v2EmitAgentEvent_==='function'){
      v2EmitAgentEvent_({
        referenceNo:reference,eventType:'ORIENTATION_SESSION_REQUIRED',agentId:'ORIENTATION',
        agentName:'Orientation Management Agent',action:'CREATE_OR_SELECT_ORIENTATION_SESSION',
        status:'WAITING_HUMAN',fromStage:'ACCEPTED',toStage:'ACCEPTED',requiresHuman:true,
        executionId:String(input.executionId||''),source:'N8N',
        summary:'Accepted applicant is ready for orientation but no suitable future session is available.'
      });
    }

    return {ok:true,referenceNo:reference,status:'WAITING_HUMAN',requiresHuman:true,task:task,nextAction:'ORIENTATION_SESSION_REQUIRED'};
  }

  const session=v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
  if(!session)throw new Error('Orientation session not found: '+sessionId);
  const sessionStatus=String(session.record['Status']||'SCHEDULED').toUpperCase();
  if(['ENDED','CANCELLED','CLOSED','COMPLETED'].indexOf(sessionStatus)>=0){
    throw new Error('Selected Orientation Session is not open for assignment.');
  }

  if(!tracking){
    const assigned=v2AssignOrientationBatch_({
      sessionId:sessionId,
      referenceNos:[reference],
      historicalOnly:false
    },owner);
    if(!assigned||(!assigned.assignedCount&&!assigned.skipped.length)){
      throw new Error('Orientation assignment did not complete.');
    }
    tracking=v2FindComposite_('V2_ORIENTATION_TRACKING',['Orientation Session ID','Reference No'],[sessionId,reference]);
  }

  if(!tracking)throw new Error('Orientation tracking record was not created.');

  const invitationBefore=String(tracking.record['Invitation Status']||'NOT_SENT').toUpperCase();
  let invitationResult=null;
  if(invitationBefore!=='SENT'){
    invitationResult=v2SendOrientationInvitation_({sessionId:sessionId},owner);
    tracking=v2FindComposite_('V2_ORIENTATION_TRACKING',['Orientation Session ID','Reference No'],[sessionId,reference]);
  }

  const invitationStatus=String(tracking&&tracking.record['Invitation Status']||'').toUpperCase();
  const reminderAutomation=typeof v2OrientationEnsureReminderTrigger_==='function'
    ? v2OrientationEnsureReminderTrigger_()
    : {ok:false,status:'UNAVAILABLE'};

  if(invitationStatus!=='SENT'){
    const task=typeof v2CreateHumanTask_==='function'?v2CreateHumanTask_({
      referenceNo:reference,
      taskType:'ORIENTATION_INVITATION_FAILURE',
      title:'Orientation invitation requires attention',
      reason:'The applicant was assigned to Orientation Session '+sessionId+' but invitation status is '+(invitationStatus||'UNKNOWN')+'.',
      raisedByAgent:'Orientation Management Agent',
      agentId:'ORIENTATION',
      relatedExecutionId:'ORIENTATION_INVITE:'+sessionId+':'+reference,
      priority:'HIGH',
      assignedTo:'Registry / Orientation Coordinator',
      resumeEvent:'HUMAN_TASK_COMPLETED',
      source:'N8N'
    },owner):null;

    return {
      ok:true,referenceNo:reference,sessionId:sessionId,status:'WAITING_HUMAN',
      requiresHuman:true,task:task,invitationStatus:invitationStatus,
      reminderAutomation:reminderAutomation,nextAction:'FIX_ORIENTATION_INVITATION'
    };
  }

  if(!reminderAutomation||reminderAutomation.status!=='ACTIVE'){
    const task=typeof v2CreateHumanTask_==='function'?v2CreateHumanTask_({
      referenceNo:reference,
      taskType:'ORIENTATION_REMINDER_AUTOMATION_FAILURE',
      title:'Orientation reminder automation requires attention',
      reason:'Invitation is sent, but the D3/D2/D1/H1 reminder trigger is not confirmed ACTIVE.',
      raisedByAgent:'Orientation Management Agent',
      agentId:'ORIENTATION',
      relatedExecutionId:'ORIENTATION_REMINDER:'+sessionId,
      priority:'HIGH',
      assignedTo:'System Administrator / Registry',
      resumeEvent:'HUMAN_TASK_COMPLETED',
      source:'N8N'
    },owner):null;

    return {
      ok:true,referenceNo:reference,sessionId:sessionId,status:'WAITING_HUMAN',
      requiresHuman:true,task:task,invitationStatus:invitationStatus,
      reminderAutomation:reminderAutomation,nextAction:'FIX_REMINDER_AUTOMATION'
    };
  }

  if(typeof v2EmitAgentEvent_==='function'){
    v2EmitAgentEvent_({
      referenceNo:reference,eventType:'ORIENTATION_ASSIGNED_AND_INVITED',agentId:'ORIENTATION',
      agentName:'Orientation Management Agent',action:'MONITOR_ORIENTATION_SESSION',
      status:'WAITING',fromStage:'ACCEPTED',toStage:'ORIENTATION',requiresHuman:false,
      executionId:String(input.executionId||''),source:'N8N',
      summary:'Applicant assigned to orientation, invitation verified SENT and reminder automation verified ACTIVE.',
      data:{sessionId:sessionId,invitationStatus:invitationStatus,reminderSchedule:'D3_D2_D1_H1'}
    });
  }

  return {
    ok:true,referenceNo:reference,sessionId:sessionId,status:'WAITING_SESSION',
    requiresHuman:false,invitationStatus:invitationStatus,
    reminderAutomation:reminderAutomation,
    nextAction:'MONITOR_ORIENTATION_SESSION'
  };
}

function v2OrientationAgentFindUpcomingSession_(workflow,application){
  const now=new Date();
  const candidates=v2Rows_('V2_ORIENTATION_SESSIONS').filter(function(row){
    const status=String(row['Status']||'SCHEDULED').toUpperCase();
    if(['SCHEDULED','OPEN','ACTIVE'].indexOf(status)<0)return false;
    const start=typeof v2OrientationSessionStart_==='function'?v2OrientationSessionStart_(row):null;
    if(!start||start.getTime()<=now.getTime())return false;

    const group=String(row['Programme Group']||'ALL').trim().toUpperCase();
    const programme=String(workflow['Programme']||application['Programme']||'').trim().toUpperCase();
    if(group&&group!=='ALL'&&programme&&programme.indexOf(group)<0&&group.indexOf(programme)<0)return false;
    return true;
  });

  candidates.sort(function(a,b){
    const at=v2OrientationSessionStart_(a);
    const bt=v2OrientationSessionStart_(b);
    return (at?at.getTime():Number.MAX_SAFE_INTEGER)-(bt?bt.getTime():Number.MAX_SAFE_INTEGER);
  });
  return candidates[0]||null;
}
