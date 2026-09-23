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

  const skyActivation=String(
    wf.record['SKY Activation Status'] ||
    app.record['SKY Activation Status'] || 'NOT_ACTIVATED'
  ).toUpperCase();
  if(skyActivation!=='ACTIVATED'){
    return {
      ok:true,
      skipped:true,
      referenceNo:reference,
      status:'WAITING_SKY_ACTIVATION',
      acceptanceStatus:acceptance,
      skyActivationStatus:skyActivation,
      message:'Orientation Agent blocked until SKY activation is verified.'
    };
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


function v2RunOrientationSessionSupervisor_(data,actor){
  assertDevIdentity_();
  v2OrientationEnsureHeaders_();
  const input=data||{};
  const owner=String(actor||'Orientation Management Agent').trim();
  const now=new Date();
  const graceMinutes=Math.max(0,Number(input.closeGraceMinutes||30));
  const targetSessionId=String(input.sessionId||'').trim();

  const sessions=v2Rows_('V2_ORIENTATION_SESSIONS').filter(function(row){
    if(targetSessionId && String(row['Orientation Session ID']||'')!==targetSessionId)return false;
    const status=String(row['Status']||'SCHEDULED').toUpperCase();
    return ['CANCELLED','COMPLETED','CLOSED'].indexOf(status)<0;
  });

  const results=[];
  sessions.forEach(function(row){
    const sessionId=String(row['Orientation Session ID']||'').trim();
    if(!sessionId)return;
    const start=typeof v2OrientationSessionStart_==='function'?v2OrientationSessionStart_(row):null;
    const end=typeof v2OrientationSessionEnd_==='function'?v2OrientationSessionEnd_(row):null;
    if(!start||!end){
      results.push({sessionId:sessionId,status:'SKIPPED_INVALID_SCHEDULE'});
      return;
    }

    const assigned=v2Rows_('V2_ORIENTATION_TRACKING').filter(function(x){
      return String(x['Orientation Session ID']||'')===sessionId &&
        (typeof v2OrientationAssignmentActive_!=='function'||v2OrientationAssignmentActive_(x));
    });
    if(!assigned.length){
      results.push({sessionId:sessionId,status:'WAITING_STUDENTS'});
      return;
    }

    let current=v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
    let attendanceStatus=String(current.record['Attendance Status']||'NOT_OPEN').toUpperCase();

    if(now.getTime()>=start.getTime() && now.getTime()<end.getTime()+graceMinutes*60000 &&
       ['OPEN','CLOSED'].indexOf(attendanceStatus)<0){
      try{
        v2OpenOrientationAttendance_({sessionId:sessionId},owner);
        current=v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
        attendanceStatus=String(current.record['Attendance Status']||'').toUpperCase();
      }catch(openError){
        results.push({sessionId:sessionId,status:'OPEN_ATTENDANCE_FAILED',error:String(openError&&openError.message||openError)});
        return;
      }
    }

    if(now.getTime()<end.getTime()+graceMinutes*60000){
      results.push({
        sessionId:sessionId,
        status:attendanceStatus==='OPEN'?'ATTENDANCE_OPEN':'WAITING_SESSION_END',
        attendanceStatus:attendanceStatus
      });
      return;
    }

    if(attendanceStatus!=='CLOSED'){
      try{
        v2CloseOrientationAttendance_({sessionId:sessionId},owner);
      }catch(closeError){
        results.push({sessionId:sessionId,status:'CLOSE_ATTENDANCE_FAILED',error:String(closeError&&closeError.message||closeError)});
        return;
      }
    }

    current=v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
    const currentStatus=String(current.record['Status']||'').toUpperCase();
    if(currentStatus!=='ENDED'){
      try{
        v2EndOrientationSession_({sessionId:sessionId},owner);
      }catch(endError){
        results.push({sessionId:sessionId,status:'END_SESSION_FAILED',error:String(endError&&endError.message||endError)});
        return;
      }
    }

    const activeRows=v2Rows_('V2_ORIENTATION_TRACKING').filter(function(x){
      return String(x['Orientation Session ID']||'')===sessionId &&
        (typeof v2OrientationAssignmentActive_!=='function'||v2OrientationAssignmentActive_(x));
    });
    const pending=activeRows.filter(function(x){
      return ['ATTENDED','ABSENT','EXCUSED'].indexOf(String(x['Attendance Status']||'NOT_UPDATED').toUpperCase())<0;
    });

    if(pending.length){
      pending.forEach(function(x){
        const reference=String(x['Reference No']||'').trim();
        if(!reference||typeof v2CreateHumanTask_!=='function')return;
        v2CreateHumanTask_({
          referenceNo:reference,
          taskType:'ORIENTATION_ATTENDANCE_REVIEW_REQUIRED',
          title:'Orientation attendance requires review',
          reason:'Orientation Session '+sessionId+' has ended, but attendance for this student is still unresolved. Record ATTENDED, ABSENT or EXCUSED.',
          raisedByAgent:'Orientation Management Agent',
          agentId:'ORIENTATION',
          relatedExecutionId:'ORI_ATTENDANCE:'+sessionId+':'+reference,
          priority:'NORMAL',
          assignedTo:'Registry / Orientation Coordinator',
          resumeEvent:'HUMAN_TASK_COMPLETED',
          source:'N8N'
        },owner);
      });
      results.push({sessionId:sessionId,status:'WAITING_HUMAN_ATTENDANCE',pendingAttendance:pending.length});
      return;
    }

    current=v2Find_('V2_ORIENTATION_SESSIONS','Orientation Session ID',sessionId);
    const recordingUrl=String(current.record['Recording URL']||'').trim();
    if(!recordingUrl){
      const reference=String((activeRows[0]&&activeRows[0]['Reference No'])||'').trim();
      if(reference&&typeof v2CreateHumanTask_==='function'){
        v2CreateHumanTask_({
          referenceNo:reference,
          taskType:'ORIENTATION_RECORDING_URL_REQUIRED',
          title:'Orientation recording URL required',
          reason:'Attendance is fully resolved for Orientation Session '+sessionId+'. Add the recording URL so the agent can distribute it and complete the official report.',
          raisedByAgent:'Orientation Management Agent',
          agentId:'ORIENTATION',
          relatedExecutionId:'ORI_RECORDING:'+sessionId,
          priority:'NORMAL',
          assignedTo:'Registry / Orientation Coordinator',
          resumeEvent:'HUMAN_TASK_COMPLETED',
          source:'N8N'
        },owner);
      }
      results.push({sessionId:sessionId,status:'WAITING_HUMAN_RECORDING'});
      return;
    }

    const unsent=activeRows.filter(function(x){
      const email=String(x['Student Email']||'').trim();
      const status=String(x['Recording Email Status']||'NOT_SENT').toUpperCase();
      return email.indexOf('@')>0&&status!=='SENT';
    });
    if(unsent.length){
      const send=v2SendOrientationRecording_({sessionId:sessionId},owner);
      if(Number(send.failedCount||0)>0){
        const reference=String((activeRows[0]&&activeRows[0]['Reference No'])||'').trim();
        if(reference&&typeof v2CreateHumanTask_==='function'){
          v2CreateHumanTask_({
            referenceNo:reference,
            taskType:'ORIENTATION_RECORDING_DELIVERY_FAILURE',
            title:'Orientation recording delivery requires attention',
            reason:String(send.failedCount||0)+' recording email(s) failed for Orientation Session '+sessionId+'.',
            raisedByAgent:'Orientation Management Agent',
            agentId:'ORIENTATION',
            relatedExecutionId:'ORI_RECORDING_DELIVERY:'+sessionId,
            priority:'HIGH',
            assignedTo:'Registry / Orientation Coordinator',
            resumeEvent:'HUMAN_TASK_COMPLETED',
            source:'N8N'
          },owner);
        }
        results.push({sessionId:sessionId,status:'WAITING_HUMAN_RECORDING_DELIVERY',delivery:send});
        return;
      }
    }

    const assessment=v2OrientationCompletionAssessment_(sessionId);
    if(!assessment.canComplete){
      const reference=String((activeRows[0]&&activeRows[0]['Reference No'])||'').trim();
      if(reference&&typeof v2CreateHumanTask_==='function'){
        v2CreateHumanTask_({
          referenceNo:reference,
          taskType:'ORIENTATION_COMPLETION_REVIEW',
          title:'Orientation completion requires review',
          reason:assessment.blockers.join(' '),
          raisedByAgent:'Orientation Management Agent',
          agentId:'ORIENTATION',
          relatedExecutionId:'ORI_COMPLETE:'+sessionId,
          priority:'HIGH',
          assignedTo:'Registry / Orientation Coordinator',
          resumeEvent:'HUMAN_TASK_COMPLETED',
          source:'N8N'
        },owner);
      }
      results.push({sessionId:sessionId,status:'WAITING_HUMAN_COMPLETION',blockers:assessment.blockers,warnings:assessment.warnings});
      return;
    }

    const completed=v2CompleteOrientationAndGenerateReport_({
      sessionId:sessionId,
      completionRemarks:'Completed automatically by Orientation Management Agent after verified attendance and recording distribution.'
    },owner);

    results.push({
      sessionId:sessionId,
      status:'COMPLETED',
      reportPdfUrl:String(completed.reportPdfUrl||''),
      studentReadiness:completed.studentReadiness||{},
      warnings:completed.warnings||[]
    });
  });

  return {
    ok:true,
    checked:sessions.length,
    results:results,
    waitingHuman:results.filter(function(x){return /^WAITING_HUMAN/.test(String(x.status||''));}).length,
    completed:results.filter(function(x){return String(x.status||'')==='COMPLETED';}).length
  };
}
