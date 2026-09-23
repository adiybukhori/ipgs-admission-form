/**
 * IUC IPGS Admission V2 - Academic Handover Agent
 *
 * Agentic gate:
 * - Orientation must be officially COMPLETED for the student.
 * - Academic Handover Status must be READY.
 * - Cohort is aggregated by Orientation Session ID.
 * - Existing HandoverV2 deterministic functions create/send the batch.
 *
 * Academic / IT / Moodle / e-Library PIC addresses are configuration, not AI
 * guesses. If they are unavailable, a durable Human Task is created.
 */

function v2AcademicHandoverEnsureAgentHeaders_(){
  v2HandoverEnsureFoundation_();
  const ss=SpreadsheetApp.openById(CONFIG.spreadsheetId);
  const batch=ss.getSheetByName('V2_HANDOVER_BATCHES');
  if(batch)v2EnsureHeaders_(batch,['Source Orientation Session ID','Agentic Batch']);
  return true;
}

function v2PrepareAcademicHandover_(data,actor){
  assertDevIdentity_();
  v2AcademicHandoverEnsureAgentHeaders_();

  const input=data||{};
  const reference=v2Required_(input.referenceNo,'Reference No');
  const owner=String(actor||'Academic Handover Agent').trim();

  const wf=v2Find_('V2_WORKFLOW','Reference No',reference);
  if(!wf)throw new Error('Workflow record not found.');

  const currentHandover=String(wf.record['Academic Handover Status']||'NOT_READY').toUpperCase();
  const orientationStatus=String(wf.record['Orientation Status']||'').toUpperCase();
  const sessionId=String(wf.record['Orientation Session ID']||input.orientationSessionId||'').trim();

  if(['HANDED_OVER','COMPLETED'].indexOf(currentHandover)>=0){
    return {
      ok:true,referenceNo:reference,status:currentHandover,alreadyPrepared:true,
      requiresHuman:false,nextAction:currentHandover==='COMPLETED'?'NONE':'MONITOR_PROVISIONING'
    };
  }

  if(currentHandover!=='READY' || orientationStatus!=='COMPLETED'){
    return {
      ok:true,skipped:true,referenceNo:reference,
      academicHandoverStatus:currentHandover,orientationStatus:orientationStatus,
      message:'Agentic handover gate is not ready.'
    };
  }
  if(!sessionId)throw new Error('Orientation Session ID is required for cohort handover.');

  const used={};
  v2Rows_('V2_HANDOVER_STUDENTS').forEach(function(row){
    const ref=String(row['Reference No']||'').trim();
    if(ref)used[ref]=String(row['Handover Batch ID']||'');
  });

  const cohort=v2Rows_('V2_WORKFLOW').filter(function(row){
    return String(row['Orientation Session ID']||'')===sessionId &&
      String(row['Orientation Status']||'').toUpperCase()==='COMPLETED' &&
      String(row['Academic Handover Status']||'').toUpperCase()==='READY' &&
      !used[String(row['Reference No']||'').trim()];
  }).map(function(row){return String(row['Reference No']||'').trim();}).filter(Boolean);

  if(!cohort.length){
    const existingBatch=used[reference]||'';
    return {
      ok:true,referenceNo:reference,status:'NO_NEW_READY_STUDENTS',
      existingBatchId:existingBatch,requiresHuman:false,nextAction:'MONITOR_PROVISIONING'
    };
  }

  const cfg=v2AcademicHandoverResolveConfig_(input);
  let batchId=String(input.batchId||'').trim();

  if(!batchId && !cfg.ready){
    const task=typeof v2CreateHumanTask_==='function'?v2CreateHumanTask_({
      referenceNo:reference,
      taskType:'HANDOVER_CONFIGURATION_REQUIRED',
      title:'Academic Handover configuration required',
      reason:'Orientation '+sessionId+' has '+cohort.length+' attended student(s) ready for handover. Confirm the Academic, IT, Moodle and e-Library PIC email addresses before the batch is sent.',
      raisedByAgent:'Academic Handover Agent',
      agentId:'ACADEMIC_HANDOVER',
      relatedExecutionId:'HANDOVER_CONFIG:'+sessionId,
      priority:'NORMAL',
      assignedTo:'Registry / Academic Handover Coordinator',
      resumeEvent:'HUMAN_TASK_COMPLETED',
      source:'N8N'
    },owner):null;

    if(typeof v2EmitAgentEvent_==='function'){
      v2EmitAgentEvent_({
        referenceNo:reference,eventType:'HANDOVER_CONFIGURATION_REQUIRED',
        agentId:'ACADEMIC_HANDOVER',agentName:'Academic Handover Agent',
        action:'CONFIRM_HANDOVER_PICS',status:'WAITING_HUMAN',
        fromStage:'ORIENTATION',toStage:'ACADEMIC_HANDOVER',
        requiresHuman:true,executionId:String(input.executionId||''),source:'N8N',
        summary:'Attended orientation cohort is ready, but Handover PIC configuration requires human confirmation.',
        data:{orientationSessionId:sessionId,readyStudentCount:cohort.length}
      });
    }

    return {
      ok:true,referenceNo:reference,status:'WAITING_HUMAN',requiresHuman:true,
      task:task,orientationSessionId:sessionId,readyStudentCount:cohort.length,
      nextAction:'HANDOVER_CONFIGURATION_REQUIRED'
    };
  }

  const lock=LockService.getScriptLock();
  lock.waitLock(15000);
  try{
    if(!batchId){
      const existing=v2Rows_('V2_HANDOVER_BATCHES').filter(function(row){
        return String(row['Source Orientation Session ID']||'')===sessionId &&
          String(row['Status']||'').toUpperCase()==='DRAFT';
      })[0];

      if(existing){
        batchId=String(existing['Handover Batch ID']||'').trim();
      }else{
        const created=v2CreateHandoverSession_({
          name:String(input.name||('Academic Handover · '+sessionId)),
          academicEmail:cfg.academicEmail,
          itEmail:cfg.itEmail,
          moodleEmail:cfg.moodleEmail,
          libraryEmail:cfg.libraryEmail
        },owner);
        batchId=String(created.batchId||'').trim();
        const batch=v2Find_('V2_HANDOVER_BATCHES','Handover Batch ID',batchId);
        if(batch){
          v2UpdateRow_(batch.sheet,batch.rowNumber,{
            'Source Orientation Session ID':sessionId,
            'Agentic Batch':'YES',
            'Updated At':new Date().toISOString()
          });
        }
      }
    }

    const batch=v2Find_('V2_HANDOVER_BATCHES','Handover Batch ID',batchId);
    if(!batch)throw new Error('Academic Handover batch not found.');
    if(String(batch.record['Status']||'').toUpperCase()!=='DRAFT'){
      return {
        ok:true,referenceNo:reference,batchId:batchId,
        status:String(batch.record['Status']||''),requiresHuman:false,
        nextAction:'MONITOR_PROVISIONING'
      };
    }

    // If a human selected an existing batch, its existing PIC configuration is
    // authoritative. Otherwise input/config values were used at creation.
    const add=v2AddHandoverStudents_({
      batchId:batchId,
      referenceNos:cohort
    },owner);

    const sent=v2SendHandoverSession_({batchId:batchId},owner);

    const verification=cohort.map(function(ref){
      const row=v2Find_('V2_WORKFLOW','Reference No',ref);
      return {
        referenceNo:ref,
        academicHandoverStatus:String(row&&row.record['Academic Handover Status']||''),
        provisioningStatus:String(row&&row.record['Provisioning Status']||'')
      };
    });
    const failed=verification.filter(function(x){
      return String(x.academicHandoverStatus).toUpperCase()!=='HANDED_OVER' ||
        String(x.provisioningStatus).toUpperCase()!=='IN_PROGRESS';
    });
    if(failed.length)throw new Error('Academic Handover verification failed for '+failed.map(function(x){return x.referenceNo;}).join(', ')+'.');

    verification.forEach(function(x){
      if(typeof v2EmitAgentEvent_==='function'){
        try{
          v2EmitAgentEvent_({
            referenceNo:x.referenceNo,eventType:'ACADEMIC_HANDOVER_SENT',
            agentId:'ACADEMIC_HANDOVER',agentName:'Academic Handover Agent',
            action:'MONITOR_PROVISIONING',status:'WAITING',
            fromStage:'ACADEMIC_HANDOVER',toStage:'ACADEMIC_HANDOVER',
            requiresHuman:false,executionId:String(input.executionId||''),source:'N8N',
            summary:'Academic Handover and provisioning tasks were sent and verified.',
            data:{batchId:batchId,orientationSessionId:sessionId}
          });
        }catch(_){}
      }
    });

    return {
      ok:true,referenceNo:reference,batchId:batchId,status:'HANDED_OVER',
      requiresHuman:false,orientationSessionId:sessionId,
      readyStudentCount:cohort.length,added:add,sent:sent,verification:verification,
      nextAction:'MONITOR_PROVISIONING'
    };
  }finally{
    lock.releaseLock();
  }
}

function v2AcademicHandoverResolveConfig_(input){
  const props=PropertiesService.getScriptProperties();
  const data=input||{};
  const value=function(inputKey,propertyKey){
    return String(data[inputKey]||props.getProperty(propertyKey)||'').trim();
  };
  const out={
    academicEmail:value('academicEmail','V2_HANDOVER_ACADEMIC_EMAIL'),
    itEmail:value('itEmail','V2_HANDOVER_IT_EMAIL'),
    moodleEmail:value('moodleEmail','V2_HANDOVER_MOODLE_EMAIL'),
    libraryEmail:value('libraryEmail','V2_HANDOVER_LIBRARY_EMAIL')
  };
  out.ready=!!(out.academicEmail&&out.itEmail&&out.moodleEmail&&out.libraryEmail);
  return out;
}

function v2PrepareStudentAccessDelivery_(data,actor){
  assertDevIdentity_();
  const input=data||{};
  const reference=v2Required_(input.referenceNo,'Reference No');
  const owner=String(actor||'Academic Handover Agent').trim();

  const provisioning=v2Find_('V2_PROVISIONING','Reference No',reference);
  const wf=v2Find_('V2_WORKFLOW','Reference No',reference);
  if(!provisioning||!wf)throw new Error('Provisioning/workflow record not found.');

  const row=provisioning.record;
  const complete=
    String(row['IT Email Status']||'').toUpperCase()==='COMPLETED' &&
    String(row['Moodle Status']||'').toUpperCase()==='COMPLETED' &&
    String(row['E-Library Status']||'').toUpperCase()==='COMPLETED';

  if(!complete){
    return {
      ok:true,skipped:true,referenceNo:reference,
      provisioningStatus:String(wf.record['Provisioning Status']||''),
      message:'Provisioning tasks are not complete yet.'
    };
  }

  if(String(row['Student Notification Status']||'').toUpperCase()==='SENT' ||
     String(wf.record['Academic Handover Status']||'').toUpperCase()==='COMPLETED'){
    return {ok:true,referenceNo:reference,status:'COMPLETED',alreadySent:true,requiresHuman:false,nextAction:'NONE'};
  }

  const task=typeof v2CreateHumanTask_==='function'?v2CreateHumanTask_({
    referenceNo:reference,
    taskType:'STUDENT_ACCESS_CREDENTIALS_REQUIRED',
    title:'Student access credentials ready to send',
    reason:'IT, Moodle and e-Library provisioning are complete. Enter the temporary credentials for one-time delivery to the student. Passwords must not be stored in the Human Task or audit log.',
    raisedByAgent:'Academic Handover Agent',
    agentId:'ACADEMIC_HANDOVER',
    relatedExecutionId:'ACCESS_DELIVERY:'+reference,
    priority:'NORMAL',
    assignedTo:'Registry / Authorised Staff',
    resumeEvent:'HUMAN_TASK_COMPLETED',
    source:'N8N'
  },owner):null;

  if(typeof v2EmitAgentEvent_==='function'){
    v2EmitAgentEvent_({
      referenceNo:reference,eventType:'STUDENT_ACCESS_CREDENTIALS_REQUIRED',
      agentId:'ACADEMIC_HANDOVER',agentName:'Academic Handover Agent',
      action:'SEND_STUDENT_ACCESS',status:'WAITING_HUMAN',
      fromStage:'ACADEMIC_HANDOVER',toStage:'ACADEMIC_HANDOVER',
      requiresHuman:true,executionId:String(input.executionId||''),source:'N8N',
      summary:'Provisioning is complete. Temporary credentials are required for secure one-time student delivery.'
    });
  }

  return {ok:true,referenceNo:reference,status:'WAITING_HUMAN',requiresHuman:true,task:task,nextAction:'STUDENT_ACCESS_CREDENTIALS_REQUIRED'};
}
