(function(){
'use strict';

var AGENTS={
  human:{name:'Human Decision Desk',code:'HD',role:'Registrar Authority',x:50,y:5,authority:'Controlled approval / exception decision',tools:['Judgement','Approval record','Exception notes']},
  orchestrator:{name:'AI Orchestrator',code:'AI',role:'Operations Router',x:50,y:14,authority:'Route task to the correct specialist agent',tools:['Task routing','Priority queue','Agent state','Escalation']},

  application:{name:'Application Receiver',code:'AR',role:'Receive Submission',x:8,y:27,authority:'Capture new submission',tools:['Admission form','Timestamp','Reference number']},
  appPdf:{name:'Application PDF Agent',code:'AP',role:'Generate Application Pack',x:24.8,y:27,authority:'Generate submission PDF & next steps',tools:['Application PDF','Next Steps','Email pack']},
  document:{name:'Document Check Agent',code:'DC',role:'Document Completeness',x:41.6,y:27,authority:'Check required upload set',tools:['Checklist','Identity','Academic documents']},
  researchIntent:{name:'Research Intent Agent',code:'RI',role:'PhD Research Intent',x:58.4,y:27,authority:'Verify PhD research intent evidence',tools:['Preliminary Research Intent','PhD rule check']},
  folder:{name:'Student Folder Agent',code:'SF',role:'File & Folder Setup',x:75.2,y:27,authority:'Create and organise student file',tools:['Drive folder','Naming rules','Admission pack']},
  agentNotify:{name:'Agent Notification Agent',code:'AN',role:'Marketing Notification',x:92,y:27,authority:'Notify assigned marketing / agent',tools:['New application email','Applicant summary','Action link']},

  prospect:{name:'SkyVialing Prospect Agent',code:'SP',role:'Prospect Creation',x:8,y:41,authority:'Track prospect creation in SkyVialing',tools:['Prospect fields','Agent completion status']},
  feeGroup:{name:'Fee Group Agent',code:'FG',role:'Fee Assignment',x:24.8,y:41,authority:'Capture selected fee group',tools:['Fee Group Master','Agent submission']},
  registryQueue:{name:'Registry Queue Agent',code:'RQ',role:'Registry Intake',x:41.6,y:41,authority:'Open Registry processing case',tools:['Prospect confirmation','Fee group','Student folder']},
  qualification:{name:'Qualification Screening Agent',code:'QS',role:'Entry Qualification',x:58.4,y:41,authority:'Evaluate academic entry requirements',tools:['Programme rules','Field check','Experience check']},
  detailedReview:{name:'Admission Review Agent',code:'AE',role:'Detailed Evaluation',x:75.2,y:41,authority:'Review full admission evidence',tools:['Qualification','Documents','Programme requirement']},
  compliancePreSac:{name:'Pre-SAC Compliance Agent',code:'PC',role:'Control Check',x:92,y:41,authority:'Verify case is ready for SAC',tools:['Audit evidence','Checklist','Exception flag']},

  sacSession:{name:'SAC Session Agent',code:'SS',role:'Create SAC Session',x:8,y:55,authority:'Prepare SAC meeting / session',tools:['Session date','Committee','Candidate selection']},
  sacPack:{name:'SAC Case Pack Agent',code:'CP',role:'Prepare Candidate Pack',x:24.8,y:55,authority:'Prepare candidate list and Form-01',tools:['Candidate list','Form-01','Evidence pack']},
  sacOutcome:{name:'SAC Outcome Agent',code:'SO',role:'Record SAC Decision',x:41.6,y:55,authority:'Record formal SAC pathway',tools:['Direct Entry','IA','Prerequisite','Not Qualified']},
  iaInvite:{name:'IA Invitation Agent',code:'II',role:'Schedule Internal Assessment',x:58.4,y:55,authority:'Arrange IA activity',tools:['Interview schedule','Essay','Portfolio instructions']},
  iaAssessment:{name:'IA Assessment Agent',code:'IA',role:'Internal Assessment',x:75.2,y:55,authority:'Track panel evidence and assessment',tools:['Interview','Essay','Portfolio','Panel notes']},
  iaResult:{name:'IA Result Agent',code:'IR',role:'IA Result & Record',x:92,y:55,authority:'Finalise IA result document',tools:['IA result','Evidence record','Outcome routing']},

  prereqEnroll:{name:'Prerequisite Enrolment Agent',code:'PE',role:'Prerequisite Registration',x:8,y:69,authority:'Register student into prerequisite route',tools:['Course registration','Cohort','Start date']},
  prereqMoodle:{name:'Prerequisite Moodle Agent',code:'PM',role:'Course LMS Setup',x:24.8,y:69,authority:'Prepare prerequisite Moodle access',tools:['Moodle course','Materials','Assessment shell']},
  prereqClass:{name:'Prerequisite Class Agent',code:'CL',role:'4-Week Delivery',x:41.6,y:69,authority:'Track class completion',tools:['Google Meet','Attendance','Class plan']},
  prereqAssess:{name:'Prerequisite Assessment Agent',code:'PA',role:'Assessment & Marks',x:58.4,y:69,authority:'Track assessment completion and result',tools:['Assessment','Marks','Completion']},
  prereqDocs:{name:'Prerequisite Documents Agent',code:'PD',role:'Certificate & Transcript',x:75.2,y:69,authority:'Generate completion documents',tools:['Completion certificate','Transcript','Result record']},
  loa:{name:'LOA Agent',code:'LO',role:'Letter of Offer',x:92,y:69,authority:'Issue approved official offer',tools:['LOA template','Reference number','Offer email']},

  acceptance:{name:'Acceptance Agent',code:'AC',role:'Offer Acceptance',x:8,y:83,authority:'Record signed acceptance',tools:['Signature','Timestamp','Acceptance PDF']},
  orientationInvite:{name:'Orientation Invitation Agent',code:'OI',role:'Invite Student',x:24.8,y:83,authority:'Send orientation invitation',tools:['Session','Meet link','Reminder']},
  orientationAttendance:{name:'Orientation Attendance Agent',code:'OT',role:'Attendance & Feedback',x:41.6,y:83,authority:'Track attendance and feedback',tools:['Attendance','Feedback','Walk-in']},
  orientationFollowup:{name:'Orientation Follow-up Agent',code:'OF',role:'Recording & Community',x:58.4,y:83,authority:'Send recording and post-session information',tools:['Recording','Community links','Post-orientation email']},
  itAccount:{name:'IT Account Agent',code:'IT',role:'IUC Email',x:75.2,y:83,authority:'Track institutional email creation',tools:['IUC email','IT completion']},
  library:{name:'Library Agent',code:'LB',role:'e-Library Access',x:92,y:83,authority:'Track library account creation',tools:['e-Library','Library completion']},

  moodle:{name:'Moodle Account Agent',code:'MO',role:'Academic LMS Access',x:16.4,y:95,authority:'Track Moodle account / access',tools:['Moodle','Personal email','Completion']},
  handoverPrep:{name:'Handover Preparation Agent',code:'HP',role:'Readiness Check',x:33.2,y:95,authority:'Compile handover readiness',tools:['Acceptance','Orientation','Accounts','Student record']},
  academic:{name:'Academic Handover Agent',code:'AH',role:'Transfer to Academic',x:50,y:95,authority:'Create and verify Academic handover',tools:['Handover batch','Academic portal','Subject onboarding']},
  audit:{name:'Audit Trail Agent',code:'AT',role:'Compliance Record',x:66.8,y:95,authority:'Verify evidence and audit events',tools:['Audit log','Exception checks','Control trail']},
  reporting:{name:'Management Reporting Agent',code:'MR',role:'Operational Intelligence',x:83.6,y:95,authority:'Update operational reporting',tools:['Dashboard','Daily statistics','Bottleneck signals']}
};

var BASE_STATE={status:'IDLE',caseId:'—',task:'Waiting for event',event:'WAITING',lastAction:'No action yet',nextAction:'Wait for event',workload:0,waitingSince:'—'};
var state={};
Object.keys(AGENTS).forEach(function(k){state[k]=Object.assign({},BASE_STATE);});

function E(event,agent,task,action,verification,next,message,duration){
  return {kind:'event',event:event,agent:agent,task:task,action:action,verification:verification,next:next,message:message,duration:duration||520};
}
function H(event,from,to,task,message,next,duration){
  return {kind:'handoff',event:event,from:from,to:to,task:task,message:message,next:next,duration:duration||1050};
}
function X(event,from,recommendation,reason,next){
  return {kind:'human',event:event,from:from,to:'human',task:'Authority Review',recommendation:recommendation,reason:reason,next:next,message:'Human authority is required before the case can continue.',duration:1200};
}

function seq(caseId,label,items){return {caseId:caseId,label:label,steps:items};}

var COMMON_START=[
  E('APPLICATION_RECEIVED','application','Receive application','Create reference and register submission','Application registered','APPLICATION_PDF_REQUIRED','New application received.'),
  H('APPLICATION_PDF_REQUIRED','application','appPdf','Generate application pack','Application Receiver passes the case to Application PDF Agent.','APPLICATION_PACK_READY'),
  E('APPLICATION_PACK_READY','appPdf','Application PDF + Next Steps','Generate admission PDF and next-step guidance','Application pack generated','DOCUMENT_CHECK_REQUIRED','Application pack ready.'),
  H('DOCUMENT_CHECK_REQUIRED','appPdf','document','Check applicant documents','Application pack handed to Document Check Agent.','DOCUMENT_REVIEW'),
  E('DOCUMENT_REVIEW','document','Document completeness','Check identity, academic and programme-specific uploads','Required documents checked','RESEARCH_INTENT_CHECK','Document review completed.'),
  H('RESEARCH_INTENT_CHECK','document','researchIntent','PhD Research Intent check','Document Check passes programme-specific evidence review.','RESEARCH_INTENT_REVIEW'),
  E('RESEARCH_INTENT_REVIEW','researchIntent','Research Intent validation','Verify research intent when programme requires it','Programme-specific evidence verified','FOLDER_SETUP_REQUIRED','Research intent / programme evidence check completed.'),
  H('FOLDER_SETUP_REQUIRED','researchIntent','folder','Create student folder','Case handed to Student Folder Agent.','FOLDER_READY'),
  E('FOLDER_READY','folder','Student file setup','Create and organise admission folder','Student folder ready','AGENT_NOTIFICATION_REQUIRED','Student file created.'),
  H('AGENT_NOTIFICATION_REQUIRED','folder','agentNotify','Notify marketing / agent','Case passed to Agent Notification Agent.','AGENT_NOTIFIED'),
  E('AGENT_NOTIFIED','agentNotify','New application notification','Send applicant details and action requirement','Assigned agent notified','PROSPECT_REQUIRED','Marketing / agent notified.'),
  H('PROSPECT_REQUIRED','agentNotify','prospect','Create SkyVialing prospect','Application passed to SkyVialing Prospect Agent.','PROSPECT_IN_PROGRESS'),
  E('PROSPECT_IN_PROGRESS','prospect','SkyVialing prospect','Track prospect entry completion','Prospect created','FEE_GROUP_REQUIRED','Prospect created in SkyVialing.'),
  H('FEE_GROUP_REQUIRED','prospect','feeGroup','Assign fee group','Prospect handed to Fee Group Agent.','FEE_GROUP_IN_PROGRESS'),
  E('FEE_GROUP_IN_PROGRESS','feeGroup','Fee group assignment','Record fee group selected by marketing / agent','Fee group recorded','REGISTRY_QUEUE_REQUIRED','Fee group recorded.'),
  H('REGISTRY_QUEUE_REQUIRED','feeGroup','registryQueue','Open Registry case','Prospect and fee group passed to Registry Queue Agent.','REGISTRY_CASE_OPEN'),
  E('REGISTRY_CASE_OPEN','registryQueue','Registry intake','Verify prospect, fee group and case files are ready','Registry case opened','QUALIFICATION_REQUIRED','Registry case opened.'),
  H('QUALIFICATION_REQUIRED','registryQueue','qualification','Qualification screening','Case passed to Qualification Screening Agent.','QUALIFICATION_REVIEW'),
  E('QUALIFICATION_REVIEW','qualification','Entry qualification screening','Check academic field, level and experience rules','Qualification screening completed','DETAILED_REVIEW_REQUIRED','Qualification screening completed.'),
  H('DETAILED_REVIEW_REQUIRED','qualification','detailedReview','Detailed admission evaluation','Case passed to Admission Review Agent.','ADMISSION_REVIEW'),
  E('ADMISSION_REVIEW','detailedReview','Detailed admission review','Review complete admission evidence and pathway','Admission review completed','PRE_SAC_CONTROL_REQUIRED','Detailed admission review completed.'),
  H('PRE_SAC_CONTROL_REQUIRED','detailedReview','compliancePreSac','Pre-SAC control check','Case passed to Pre-SAC Compliance Agent.','PRE_SAC_CONTROL'),
  E('PRE_SAC_CONTROL','compliancePreSac','Pre-SAC compliance','Verify evidence and unresolved exceptions','SAC readiness verified','SAC_SESSION_REQUIRED','Case is ready for SAC.'),
  H('SAC_SESSION_REQUIRED','compliancePreSac','sacSession','Create / assign SAC session','Case passed to SAC Session Agent.','SAC_SESSION_READY'),
  E('SAC_SESSION_READY','sacSession','SAC session preparation','Assign candidate into SAC session','Session assigned','SAC_PACK_REQUIRED','SAC session prepared.'),
  H('SAC_PACK_REQUIRED','sacSession','sacPack','Prepare SAC case pack','Candidate passed to SAC Case Pack Agent.','SAC_PACK_READY'),
  E('SAC_PACK_READY','sacPack','Candidate pack + Form-01','Prepare candidate list, evidence and Form-01','SAC pack complete','SAC_OUTCOME_REQUIRED','SAC case pack prepared.'),
  H('SAC_OUTCOME_REQUIRED','sacPack','sacOutcome','Record SAC outcome','Prepared candidate handed to SAC Outcome Agent.','SAC_REVIEW')
];

var POST_OFFER=[
  H('ACCEPTANCE_REQUIRED','loa','acceptance','Capture offer acceptance','Issued LOA passed to Acceptance Agent.','ACCEPTANCE_PENDING'),
  E('ACCEPTANCE_PENDING','acceptance','Signed acceptance','Capture signature and timestamp','Acceptance PDF stored','ORIENTATION_INVITE_REQUIRED','Acceptance received.'),
  H('ORIENTATION_INVITE_REQUIRED','acceptance','orientationInvite','Send orientation invitation','Accepted student passed to Orientation Invitation Agent.','ORIENTATION_INVITE'),
  E('ORIENTATION_INVITE','orientationInvite','Orientation invitation','Send session details and reminder','Invitation logged','ORIENTATION_ATTENDANCE_REQUIRED','Orientation invitation sent.'),
  H('ORIENTATION_ATTENDANCE_REQUIRED','orientationInvite','orientationAttendance','Track attendance & feedback','Student passed to Orientation Attendance Agent.','ORIENTATION_SESSION'),
  E('ORIENTATION_SESSION','orientationAttendance','Attendance & feedback','Record attendance, feedback and walk-in details','Attendance status verified','ORIENTATION_FOLLOWUP_REQUIRED','Orientation attendance recorded.'),
  H('ORIENTATION_FOLLOWUP_REQUIRED','orientationAttendance','orientationFollowup','Send recording & community links','Completed session passed to Orientation Follow-up Agent.','ORIENTATION_FOLLOWUP'),
  E('ORIENTATION_FOLLOWUP','orientationFollowup','Post-orientation follow-up','Send recording and approved community information','Post-orientation communication logged','IT_ACCOUNT_REQUIRED','Orientation follow-up completed.'),
  H('IT_ACCOUNT_REQUIRED','orientationFollowup','itAccount','Create IUC email','Student passed to IT Account Agent.','IT_ACCOUNT_PROCESS'),
  E('IT_ACCOUNT_PROCESS','itAccount','IUC email provisioning','Track institutional email setup','IT account complete','LIBRARY_ACCOUNT_REQUIRED','IUC email completed.'),
  H('LIBRARY_ACCOUNT_REQUIRED','itAccount','library','Create e-Library access','Student passed to Library Agent.','LIBRARY_PROCESS'),
  E('LIBRARY_PROCESS','library','e-Library provisioning','Track e-Library account setup','Library account complete','MOODLE_ACCOUNT_REQUIRED','e-Library access completed.'),
  H('MOODLE_ACCOUNT_REQUIRED','library','moodle','Create Moodle access','Student passed to Moodle Account Agent.','MOODLE_PROCESS'),
  E('MOODLE_PROCESS','moodle','Moodle account provisioning','Track Moodle account creation','Moodle access complete','HANDOVER_PREP_REQUIRED','Moodle access completed.'),
  H('HANDOVER_PREP_REQUIRED','moodle','handoverPrep','Prepare Academic handover','Student passed to Handover Preparation Agent.','HANDOVER_PREP'),
  E('HANDOVER_PREP','handoverPrep','Readiness compilation','Verify acceptance, orientation and account statuses','Handover pack ready','ACADEMIC_HANDOVER_REQUIRED','Student is ready for Academic handover.'),
  H('ACADEMIC_HANDOVER_REQUIRED','handoverPrep','academic','Transfer to Academic','Ready student passed to Academic Handover Agent.','ACADEMIC_HANDOVER'),
  E('ACADEMIC_HANDOVER','academic','Academic handover','Create handover record and transfer student','Academic handover complete','AUDIT_REQUIRED','Student handed to Academic.'),
  H('AUDIT_REQUIRED','academic','audit','Verify audit trail','Completed lifecycle passed to Audit Trail Agent.','AUDIT_REVIEW'),
  E('AUDIT_REVIEW','audit','Lifecycle audit','Verify required evidence and events','Audit trail complete','REPORTING_REQUIRED','Audit trail verified.'),
  H('REPORTING_REQUIRED','audit','reporting','Update operational reporting','Completed case passed to Management Reporting Agent.','REPORTING_UPDATE'),
  E('REPORTING_UPDATE','reporting','Management reporting','Update dashboard and daily operational statistics','Reporting updated','JOURNEY_COMPLETE','Admission lifecycle completed.')
];

var DIRECT_ROUTE=[
  E('SAC_REVIEW','sacOutcome','SAC formal outcome','Record Direct Entry outcome','Direct Entry approved','LOA_REQUIRED','SAC outcome: Direct Entry.'),
  H('LOA_REQUIRED','sacOutcome','loa','Issue official LOA','Direct Entry case passed to LOA Agent.','LOA_PROCESS'),
  E('LOA_PROCESS','loa','Official Letter of Offer','Generate LOA reference, PDF and email','LOA issued','ACCEPTANCE_REQUIRED','Official offer issued.')
];

var IA_ROUTE=[
  E('SAC_REVIEW','sacOutcome','SAC formal outcome','Record IA pathway','IA required','IA_INVITE_REQUIRED','SAC outcome: Internal Assessment required.'),
  H('IA_INVITE_REQUIRED','sacOutcome','iaInvite','Arrange Internal Assessment','SAC outcome passed to IA Invitation Agent.','IA_INVITATION'),
  E('IA_INVITATION','iaInvite','IA scheduling & instruction','Arrange interview / essay / portfolio activity','IA session prepared','IA_ASSESSMENT_REQUIRED','IA invitation and instructions prepared.'),
  H('IA_ASSESSMENT_REQUIRED','iaInvite','iaAssessment','Conduct / track IA','IA case passed to IA Assessment Agent.','IA_ASSESSMENT'),
  E('IA_ASSESSMENT','iaAssessment','Internal Assessment','Track panel evidence, interview and assessment','IA evidence complete','IA_RESULT_REQUIRED','Internal Assessment completed.'),
  H('IA_RESULT_REQUIRED','iaAssessment','iaResult','Finalise IA result','Assessment evidence passed to IA Result Agent.','IA_RESULT'),
  E('IA_RESULT','iaResult','IA result document','Generate IA result and route outcome','IA result: sufficient','LOA_REQUIRED','IA result is sufficient.'),
  H('LOA_REQUIRED','iaResult','loa','Issue official LOA','Successful IA case passed to LOA Agent.','LOA_PROCESS'),
  E('LOA_PROCESS','loa','Official Letter of Offer','Generate LOA reference, PDF and email','LOA issued','ACCEPTANCE_REQUIRED','Official offer issued after IA.')
];

var PREREQ_ROUTE=[
  E('SAC_REVIEW','sacOutcome','SAC formal outcome','Record IA pathway','IA required','IA_INVITE_REQUIRED','SAC outcome: Internal Assessment required.'),
  H('IA_INVITE_REQUIRED','sacOutcome','iaInvite','Arrange Internal Assessment','SAC outcome passed to IA Invitation Agent.','IA_INVITATION'),
  E('IA_INVITATION','iaInvite','IA scheduling & instruction','Arrange IA activity','IA session prepared','IA_ASSESSMENT_REQUIRED','IA invitation prepared.'),
  H('IA_ASSESSMENT_REQUIRED','iaInvite','iaAssessment','Conduct / track IA','IA case passed to IA Assessment Agent.','IA_ASSESSMENT'),
  E('IA_ASSESSMENT','iaAssessment','Internal Assessment','Track panel evidence and assessment','IA evidence complete','IA_RESULT_REQUIRED','Internal Assessment completed.'),
  H('IA_RESULT_REQUIRED','iaAssessment','iaResult','Finalise IA result','Assessment evidence passed to IA Result Agent.','IA_RESULT'),
  E('IA_RESULT','iaResult','IA result document','Generate result and route outcome','IA result: prerequisite required','PREREQ_ENROL_REQUIRED','IA requires prerequisite course.'),
  H('PREREQ_ENROL_REQUIRED','iaResult','prereqEnroll','Register prerequisite course','IA result passed to Prerequisite Enrolment Agent.','PREREQ_ENROL'),
  E('PREREQ_ENROL','prereqEnroll','Prerequisite registration','Register student into approved prerequisite cohort','Prerequisite registration complete','PREREQ_MOODLE_REQUIRED','Prerequisite enrolment completed.'),
  H('PREREQ_MOODLE_REQUIRED','prereqEnroll','prereqMoodle','Prepare prerequisite Moodle','Student passed to Prerequisite Moodle Agent.','PREREQ_MOODLE'),
  E('PREREQ_MOODLE','prereqMoodle','Prerequisite LMS setup','Prepare course materials and assessment shell','Moodle course ready','PREREQ_CLASS_REQUIRED','Prerequisite Moodle prepared.'),
  H('PREREQ_CLASS_REQUIRED','prereqMoodle','prereqClass','Run 4-week classes','Student passed to Prerequisite Class Agent.','PREREQ_CLASSES'),
  E('PREREQ_CLASSES','prereqClass','4-week class delivery','Track Google Meet classes and attendance','Class requirement completed','PREREQ_ASSESS_REQUIRED','Prerequisite classes completed.',700),
  H('PREREQ_ASSESS_REQUIRED','prereqClass','prereqAssess','Complete prerequisite assessment','Student passed to Prerequisite Assessment Agent.','PREREQ_ASSESSMENT'),
  E('PREREQ_ASSESSMENT','prereqAssess','Prerequisite assessment','Track assessment and final marks','Pass result recorded','PREREQ_DOCS_REQUIRED','Prerequisite assessment completed.'),
  H('PREREQ_DOCS_REQUIRED','prereqAssess','prereqDocs','Generate completion documents','Completed result passed to Prerequisite Documents Agent.','PREREQ_DOCUMENTS'),
  E('PREREQ_DOCUMENTS','prereqDocs','Certificate + transcript','Generate completion certificate, result and transcript','Completion documents ready','LOA_REQUIRED','Prerequisite completion documents issued.'),
  H('LOA_REQUIRED','prereqDocs','loa','Issue official LOA','Completed prerequisite case passed directly to LOA Agent.','LOA_PROCESS'),
  E('LOA_PROCESS','loa','Official Letter of Offer','Generate LOA reference, PDF and email','LOA issued','ACCEPTANCE_REQUIRED','Official offer issued after prerequisite.')
];

var FLOWS={
  full:seq('PHD-DEMO-2026-001','Full Journey · IA + Prerequisite',COMMON_START.concat(PREREQ_ROUTE,POST_OFFER)),
  direct:seq('MBA-DEMO-2026-002','Direct Entry · Full Lifecycle',COMMON_START.concat(DIRECT_ROUTE,POST_OFFER)),
  ia:seq('MBA-DEMO-2026-003','IA Sufficient · Full Lifecycle',COMMON_START.concat(IA_ROUTE,POST_OFFER)),
  prerequisite:seq('PHD-DEMO-2026-004','IA → Prerequisite · Full Lifecycle',COMMON_START.concat(PREREQ_ROUTE,POST_OFFER)),
  exception:seq('PHD-DEMO-2026-005','Human Decision / Exception',[
    E('QUALIFICATION_EXCEPTION','qualification','Non-standard qualification','Analyse available entry evidence','Exception identified','HUMAN_DECISION_REQUIRED','Qualification agent found an ambiguous case.'),
    X('HUMAN_DECISION_REQUIRED','qualification','Refer applicant to IA','Qualification evidence is non-standard and needs Registrar authority before routing.','IA_INVITE_REQUIRED'),
    H('IA_INVITE_REQUIRED','orchestrator','iaInvite','Arrange Internal Assessment','Approved human decision routed to IA Invitation Agent.','IA_INVITATION'),
    E('IA_INVITATION','iaInvite','IA scheduling','Prepare authorised IA activity','IA task created','WORKFLOW_CONTINUES','Case resumed after human approval.')
  ])
};

var sim={running:false,paused:false,flow:'full',step:-1,token:0,currentAnimation:null,pendingHuman:null};
var refs={};

function $(id){return document.getElementById(id);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
function clock(){return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
function wait(ms,token){return new Promise(function(resolve){var elapsed=0;(function tick(){if(token!==sim.token){resolve();return;}if(sim.paused){setTimeout(tick,60);return;}var slice=Math.min(60,ms-elapsed);elapsed+=slice;if(elapsed>=ms){resolve();return;}setTimeout(tick,slice);})();});}

function mount(){
  refs.stage=$('officeStage');refs.feed=$('activityFeed');
  renderDesks();populateFlows();bind();reset(false);
}

function renderDesks(){
  Object.keys(AGENTS).forEach(function(k){
    var a=AGENTS[k],el=document.createElement('button');
    el.type='button';el.className='agent-desk';el.id='desk-'+k;el.dataset.agent=k;
    el.style.setProperty('--x',a.x+'%');el.style.setProperty('--y',a.y+'%');
    el.style.setProperty('--accent',k==='human'?'#ffc76a':(k==='orchestrator'?'#a17dff':'#57dcff'));
    el.innerHTML='<div class="desk-top"><div class="desk-avatar">'+esc(a.code)+'</div><div class="desk-copy"><b>'+esc(a.name)+'</b><small>'+esc(a.role)+'</small></div><span class="state-badge">IDLE</span></div><div class="desk-task">Waiting for structured event</div><div class="desk-case">No active case</div>';
    el.onclick=function(){openDrawer(k);};refs.stage.appendChild(el);
  });
}

function populateFlows(){
  var sel=$('scenarioSelect');
  Object.keys(FLOWS).forEach(function(k){var op=document.createElement('option');op.value=k;op.textContent=FLOWS[k].label;sel.appendChild(op);});
  sel.value=sim.flow;
}
function bind(){
  $('runBtn').onclick=run;$('pauseBtn').onclick=pause;$('resumeBtn').onclick=resume;$('resetBtn').onclick=function(){reset(true);};
  $('scenarioSelect').onchange=function(){sim.flow=this.value;reset(false);};
  $('connectBtn').onclick=connectLiveData;$('adminPassword').onkeydown=function(e){if(e.key==='Enter')connectLiveData();};
  $('drawerClose').onclick=closeDrawer;$('drawerBackdrop').onclick=closeDrawer;
}
function reset(logIt){
  sim.token++;sim.running=false;sim.paused=false;sim.step=-1;sim.pendingHuman=null;
  if(sim.currentAnimation){try{sim.currentAnimation.cancel();}catch(e){}sim.currentAnimation=null;}
  document.querySelectorAll('.avatar-runner').forEach(function(x){x.remove();});
  Object.keys(state).forEach(function(k){state[k]=Object.assign({},BASE_STATE);renderDesk(k);});
  updatePipeline(null);$('officeStateLabel').textContent='READY';$('activeCaseLabel').textContent='—';$('currentEventLabel').textContent='WAITING';updateButtons();
  if(logIt)addLog('SYSTEM','—','RESET','Office reset. No production record was changed.');
}
function setAgent(k,patch){state[k]=Object.assign({},state[k],patch||{});renderDesk(k);if($('agentDrawer').classList.contains('open')&&$('agentDrawer').dataset.agent===k)renderDrawer(k);}
function renderDesk(k){
  var el=$('desk-'+k),s=state[k];if(!el)return;
  el.className='agent-desk '+String(s.status||'idle').toLowerCase();
  el.querySelector('.state-badge').textContent=s.status||'IDLE';el.querySelector('.desk-task').textContent=s.task||'Waiting for event';
  el.querySelector('.desk-case').textContent=s.caseId&&s.caseId!=='—'?(s.caseId+' · '+s.event):'No active case';
}

async function run(){
  if(sim.running)return;reset(false);sim.running=true;sim.token++;
  var token=sim.token,flow=FLOWS[sim.flow];$('officeStateLabel').textContent='RUNNING';$('activeCaseLabel').textContent=flow.caseId;updateButtons();
  addLog('AI Orchestrator',flow.caseId,'JOURNEY START','Running '+flow.label+' with dedicated task agents.');
  for(var i=0;i<flow.steps.length;i++){
    if(token!==sim.token)return;sim.step=i;while(sim.paused&&token===sim.token){await new Promise(function(r){setTimeout(r,60);});}if(token!==sim.token)return;
    var step=flow.steps[i];updatePipeline(step);$('currentEventLabel').textContent=step.event;await execute(step,flow.caseId,token);if(token!==sim.token)return;
    if(step.kind==='human'){
      var decision=await waitHuman(token);if(token!==sim.token)return;
      if(decision!=='approve'){sim.running=false;sim.paused=false;$('officeStateLabel').textContent='CONTROLLED STOP';addLog('Human Decision Desk',flow.caseId,'WORKFLOW STOPPED',decision==='evidence'?'More evidence requested.':'Case returned for rework.');updateButtons();return;}
    }
    await wait(140,token);
  }
  if(token!==sim.token)return;sim.running=false;sim.paused=false;$('officeStateLabel').textContent='COMPLETE';$('currentEventLabel').textContent='JOURNEY_COMPLETE';
  addLog('Management Reporting Agent',flow.caseId,'JOURNEY COMPLETE','Dedicated-agent workflow simulation completed.');updateButtons();
}

async function execute(step,caseId,token){
  if(step.kind==='event'){
    setAgent(step.agent,{status:'WORKING',caseId:caseId,task:step.task,event:step.event,lastAction:step.action,nextAction:step.next,workload:1,waitingSince:'—'});
    toast(step.event,step.message);addLog(AGENTS[step.agent].name,caseId,step.event,step.message);await wait(step.duration||520,token);return;
  }
  if(step.kind==='handoff'){
    setAgent(step.from,{status:'HANDOVER',caseId:caseId,task:step.task,event:step.event,lastAction:'Handing task to '+AGENTS[step.to].name,nextAction:step.next});
    setAgent(step.to,{status:'RECEIVING',caseId:caseId,task:'Receiving '+step.task,event:step.event,lastAction:'Awaiting task',nextAction:step.next});
    toast(step.event,step.message);addLog(AGENTS[step.from].name+' → '+AGENTS[step.to].name,caseId,step.event,step.message);
    await animateHandoff(step.from,step.to,caseId,step.task,token,step.duration);
    setAgent(step.from,{status:'IDLE',caseId:'—',task:'Waiting for event',event:'WAITING',lastAction:'Task handed off',nextAction:'Wait for event',workload:0});
    setAgent(step.to,{status:'WORKING',caseId:caseId,task:step.task,event:step.event,lastAction:'Task accepted',nextAction:step.next,workload:1});return;
  }
  if(step.kind==='human'){
    setAgent(step.from,{status:'ESCALATION',caseId:caseId,task:step.task,event:step.event,lastAction:'Escalated to human authority',nextAction:'Wait for decision'});
    setAgent('human',{status:'RECEIVING',caseId:caseId,task:'Review recommendation',event:step.event,lastAction:'Case received',nextAction:'Approve / Return / Request Evidence',workload:1});
    toast(step.event,'Human authority required');addLog(AGENTS[step.from].name+' → Human Decision Desk',caseId,step.event,step.message);
    await animateHandoff(step.from,'human',caseId,'Authority Review',token,step.duration);
    setAgent(step.from,{status:'WAITING',waitingSince:clock(),nextAction:'Wait for human decision'});
    setAgent('human',{status:'WORKING',caseId:caseId,task:'Decision: '+step.recommendation,event:step.event,lastAction:step.reason,nextAction:'Record decision'});
    sim.paused=true;showHumanDecision(caseId,step);updateButtons();
  }
}

/* Obstacle-aware routing: avatar walks around desks, never through / over them. */
function localRect(el,stageRect,pad){
  var r=el.getBoundingClientRect();return {l:r.left-stageRect.left-pad,t:r.top-stageRect.top-pad,r:r.right-stageRect.left+pad,b:r.bottom-stageRect.top+pad};
}
function inside(p,o){return p.x>=o.l&&p.x<=o.r&&p.y>=o.t&&p.y<=o.b;}
function deskAccess(el,stageRect){
  var r=el.getBoundingClientRect(),cx=r.left-stageRect.left+r.width/2,cy=r.top-stageRect.top+r.height/2,m=38;
  return [
    {x:cx,y:r.top-stageRect.top-m},{x:cx,y:r.bottom-stageRect.top+m},
    {x:r.left-stageRect.left-m,y:cy},{x:r.right-stageRect.left+m,y:cy}
  ];
}
function shortestPath(stage,src,dst){
  var br=stage.getBoundingClientRect(),cell=16,w=Math.max(2,Math.floor(br.width/cell)),h=Math.max(2,Math.floor(br.height/cell));
  var obstacles=[].slice.call(stage.querySelectorAll('.agent-desk')).map(function(el){return localRect(el,br,24);});
  function validPoint(p){return p.x>8&&p.x<br.width-8&&p.y>8&&p.y<br.height-8&&!obstacles.some(function(o){return inside(p,o);});}
  var starts=deskAccess(src,br).filter(validPoint),goals=deskAccess(dst,br).filter(validPoint);
  function key(x,y){return x+','+y;}function toGrid(p){return {x:Math.max(0,Math.min(w-1,Math.round(p.x/cell))),y:Math.max(0,Math.min(h-1,Math.round(p.y/cell)))};}
  function toPixel(g){return {x:g.x*cell,y:g.y*cell};}
  var blocked={};for(var y=0;y<h;y++)for(var x=0;x<w;x++){var p=toPixel({x:x,y:y});if(obstacles.some(function(o){return inside(p,o);}))blocked[key(x,y)]=1;}
  function astar(sp,gp){
    var s=toGrid(sp),g=toGrid(gp),sk=key(s.x,s.y),gk=key(g.x,g.y);if(blocked[sk]||blocked[gk])return null;
    var open=[s],came={},gScore={};gScore[sk]=0;var seen={};
    while(open.length){
      var best=0,bestF=1e12;
      for(var i=0;i<open.length;i++){var n=open[i],nk=key(n.x,n.y),f=(gScore[nk]||0)+Math.abs(n.x-g.x)+Math.abs(n.y-g.y);if(f<bestF){bestF=f;best=i;}}
      var cur=open.splice(best,1)[0],ck=key(cur.x,cur.y);if(ck===gk){
        var arr=[cur];while(came[ck]){cur=came[ck];ck=key(cur.x,cur.y);arr.push(cur);}arr.reverse();return arr.map(toPixel);
      }
      seen[ck]=1;var ns=[[1,0],[-1,0],[0,1],[0,-1]];
      for(var j=0;j<ns.length;j++){var nx=cur.x+ns[j][0],ny=cur.y+ns[j][1],nk2=key(nx,ny);if(nx<0||ny<0||nx>=w||ny>=h||blocked[nk2]||seen[nk2])continue;var cand=(gScore[ck]||0)+1;if(gScore[nk2]===undefined||cand<gScore[nk2]){gScore[nk2]=cand;came[nk2]=cur;if(!open.some(function(q){return q.x===nx&&q.y===ny;}))open.push({x:nx,y:ny});}}
    }return null;
  }
  var bestPath=null,bestLen=1e12;
  starts.forEach(function(s){goals.forEach(function(g){var p=astar(s,g);if(p&&p.length<bestLen){bestLen=p.length;bestPath=[s].concat(p,[g]);}});});
  if(!bestPath){var s0=starts[0]||{x:20,y:20},g0=goals[0]||{x:br.width-20,y:br.height-20};bestPath=[s0,{x:s0.x,y:20},{x:g0.x,y:20},g0];}
  var simple=[];bestPath.forEach(function(p){if(!simple.length){simple.push(p);return;}if(simple.length<2){simple.push(p);return;}var a=simple[simple.length-2],b=simple[simple.length-1];if((a.x===b.x&&b.x===p.x)||(a.y===b.y&&b.y===p.y))simple[simple.length-1]=p;else simple.push(p);});
  return simple;
}
function animateHandoff(from,to,caseId,label,token,duration){
  return new Promise(function(resolve){
    var stage=refs.stage,src=$('desk-'+from),dst=$('desk-'+to);if(!stage||!src||!dst){resolve();return;}
    var path=shortestPath(stage,src,dst),runner=document.createElement('div');runner.className='avatar-runner';
    runner.innerHTML='<div class="avatar-bot"><div class="head"></div><div class="body" data-code="'+esc(AGENTS[from].code)+'"></div><div class="leg l"></div><div class="leg r"></div><div class="task-orb">◆</div></div><div class="runner-label">'+esc(AGENTS[from].name)+' · '+esc(label)+'</div>';
    stage.appendChild(runner);runner.style.left=path[0].x+'px';runner.style.top=path[0].y+'px';
    var total=0,lens=[];for(var i=1;i<path.length;i++){var d=Math.hypot(path[i].x-path[i-1].x,path[i].y-path[i-1].y);lens.push(d);total+=d;}
    var acc=0,frames=[{transform:'translate(-50%,-50%) translate(0px,0px)',offset:0}],origin=path[0];
    for(var j=1;j<path.length;j++){acc+=lens[j-1];frames.push({transform:'translate(-50%,-50%) translate('+(path[j].x-origin.x)+'px,'+(path[j].y-origin.y)+'px)',offset:total?acc/total:1});}
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){runner.remove();resolve();return;}
    var ms=Math.max(duration||1050,Math.min(2400,total*2.15)),anim=runner.animate(frames,{duration:ms,easing:'linear',fill:'forwards'});
    sim.currentAnimation=anim;if(sim.paused)anim.pause();anim.onfinish=function(){runner.remove();sim.currentAnimation=null;resolve();};anim.oncancel=function(){runner.remove();sim.currentAnimation=null;resolve();};
  });
}

function pause(){if(!sim.running||sim.paused)return;sim.paused=true;if(sim.currentAnimation)sim.currentAnimation.pause();$('officeStateLabel').textContent='PAUSED';updateButtons();}
function resume(){if(!sim.running||!sim.paused||sim.pendingHuman)return;sim.paused=false;if(sim.currentAnimation)sim.currentAnimation.play();$('officeStateLabel').textContent='RUNNING';updateButtons();}
function updateButtons(){$('runBtn').disabled=sim.running;$('pauseBtn').disabled=!sim.running||sim.paused;$('resumeBtn').disabled=!sim.running||!sim.paused||!!sim.pendingHuman;}
function waitHuman(token){return new Promise(function(resolve){if(token!==sim.token){resolve('cancelled');return;}sim.pendingHuman=resolve;updateButtons();});}
function showHumanDecision(caseId,step){
  openDrawer('human');$('drawerGrid').innerHTML='<div class="wide"><small>Case</small><b>'+esc(caseId)+'</b></div><div class="wide"><small>AI Recommendation</small><b>'+esc(step.recommendation)+'</b></div><div class="wide"><small>Reason</small><b>'+esc(step.reason)+'</b></div><div class="wide"><small>Authority Action</small><b><button class="primary-btn" id="hdApprove">Approve</button> <button class="control-btn" id="hdReturn">Return</button> <button class="control-btn" id="hdEvidence">Request Evidence</button></b></div>';
  $('hdApprove').onclick=function(){recordHuman('approve');};$('hdReturn').onclick=function(){recordHuman('return');};$('hdEvidence').onclick=function(){recordHuman('evidence');};
}
function recordHuman(decision){
  if(!sim.pendingHuman)return;var flow=FLOWS[sim.flow],labels={approve:'APPROVED',return:'RETURNED',evidence:'MORE EVIDENCE'};
  addLog('Human Decision Desk',flow.caseId,'HUMAN DECISION · '+labels[decision],decision==='approve'?'Approved AI recommendation.':decision==='return'?'Returned case for rework.':'Requested more evidence.');
  setAgent('human',{status:'IDLE',caseId:'—',task:'Waiting for escalation',event:'WAITING',workload:0,lastAction:labels[decision],nextAction:'Wait for escalation'});closeDrawer();
  var resolve=sim.pendingHuman;sim.pendingHuman=null;sim.paused=false;$('officeStateLabel').textContent=decision==='approve'?'RUNNING':'CONTROLLED STOP';updateButtons();resolve(decision);
}

function updatePipeline(step){
  var v=step?{event:step.event||'—',task:step.task||'—',agent:step.agent?AGENTS[step.agent].name:(step.from?AGENTS[step.from].name:'—'),action:step.action||(step.kind==='handoff'?'Walk task to '+AGENTS[step.to].name:'—'),verification:step.verification||(step.kind==='handoff'?'Receiving specialist accepts case':'—'),next:step.next||'—'}:{event:'Waiting',task:'—',agent:'—',action:'—',verification:'—',next:'—'};
  Object.keys(v).forEach(function(k){var el=document.querySelector('[data-pipe="'+k+'"]');if(el)el.textContent=v[k];});
}
function toast(event,message){var el=$('handoffToast');el.classList.remove('show');void el.offsetWidth;el.innerHTML='<small>'+esc(event)+'</small><b>'+esc(message)+'</b>';el.classList.add('show');setTimeout(function(){el.classList.remove('show');},1600);}
function addLog(actor,caseId,event,message){
  var empty=refs.feed.querySelector('.empty-feed');if(empty)empty.remove();var row=document.createElement('div');row.className='feed-row';
  row.innerHTML='<time>'+esc(clock())+'</time><div><b>'+esc(actor)+'</b><div class="feed-event">'+esc(event)+'</div></div><p>'+esc(caseId)+' · '+esc(message)+'</p>';refs.feed.prepend(row);while(refs.feed.children.length>60)refs.feed.lastElementChild.remove();
}
function openDrawer(k){$('agentDrawer').dataset.agent=k;$('agentDrawer').classList.add('open');$('agentDrawer').setAttribute('aria-hidden','false');$('drawerBackdrop').classList.add('open');renderDrawer(k);}
function closeDrawer(){$('agentDrawer').classList.remove('open');$('agentDrawer').setAttribute('aria-hidden','true');$('drawerBackdrop').classList.remove('open');}
function renderDrawer(k){
  var a=AGENTS[k],s=state[k];if(!a)return;$('drawerAvatar').textContent=a.code;$('drawerRole').textContent=a.role;$('drawerName').textContent=a.name;$('drawerStatus').textContent=s.status;
  $('drawerGrid').innerHTML=card('Current Case',s.caseId)+card('Current Task',s.task)+card('Current Event',s.event)+card('Workload',String(s.workload)+' queued')+card('Last Action',s.lastAction,'wide')+card('Next Action',s.nextAction,'wide')+card('Authority',a.authority,'wide')+card('Tools',a.tools.join(' · '),'wide');
}
function card(label,value,cls){return '<div class="'+(cls||'')+'"><small>'+esc(label)+'</small><b>'+esc(value||'—')+'</b></div>';}

function countRows(data,key){return Array.isArray(data&&data[key])?data[key].length:0;}
async function connectLiveData(){
  var password=$('adminPassword').value.trim();if(!password){toast('LIVE DATA','Enter the admin password first.');return;}var btn=$('connectBtn');btn.disabled=true;btn.textContent='Connecting…';
  try{
    var response=await fetch('/api/admin-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:password})}),payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.message||'Unable to connect');var d=payload.data||{};
    $('metricApplications').textContent=countRows(d,'V2_APPLICATIONS');$('metricWorkflow').textContent=countRows(d,'V2_WORKFLOW');$('metricSac').textContent=countRows(d,'V2_SAC_CANDIDATES');$('metricIa').textContent=countRows(d,'V2_ASSESSMENT_PROGRESS');$('metricOrientation').textContent=countRows(d,'V2_ORIENTATION_TRACKING');$('metricProvisioning').textContent=countRows(d,'V2_PROVISIONING');$('metricHandover').textContent=countRows(d,'V2_ACADEMIC_PORTAL');
    $('dataMode').innerHTML='<i></i> Live Admission Data Connected';toast('LIVE DATA CONNECTED','Operational counts loaded from Admission V2.');addLog('System','LIVE','DATA_CONNECTED','Admission V2 data connected. Movement remains simulation until event bus integration.');$('adminPassword').value='';
  }catch(err){toast('CONNECTION FAILED',err.message||'Unable to connect to live data.');}finally{btn.disabled=false;btn.textContent='Connect Live Data';}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();