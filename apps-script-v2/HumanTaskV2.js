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
      data:{taskId:taskId,decision:decision,resolution:resolution,resolvedBy:resolvedBy}
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
    resolution:resolution
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
