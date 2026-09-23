(function AI_AGENT_OFFICE(){
'use strict';

const OFFICE_AGENTS={
  human:{agent_id:'human-desk',name:'Registrar / Human Decision Desk',short:'HUMAN',role:'Authorised Decision Maker',desk:'human-desk',x:50,y:8,accent:'#ffc76a',authority:'H1 — Approve / Return / Request Evidence',tools:['Human judgement','Approval record','Escalation notes'],escalation:'Final authority for controlled decisions.'},
  orchestrator:{agent_id:'orchestrator',name:'AI Orchestrator',short:'AI',role:'Digital Operations Manager',desk:'orchestrator-desk',x:50,y:25,accent:'#9a7cff',authority:'A0 — Route / Coordinate',tools:['Event routing','Priority queue','Agent state','Escalation'],escalation:'Escalate when task authority exceeds agent limit.'},
  admission:{agent_id:'admission-agent',name:'Admission Intelligence',short:'AD',role:'Case Screening & Evaluation',desk:'admission-desk',x:16,y:45,accent:'#53d9ff',authority:'A1 — Analyse / Recommend',tools:['Application context','Document checklist','Qualification rules'],escalation:'Human review for ambiguous eligibility or policy exception.'},
  sac:{agent_id:'sac-agent',name:'SAC & IA Agent',short:'SA',role:'Academic Routing Support',desk:'sac-desk',x:50,y:45,accent:'#9a7cff',authority:'A1 — Prepare / Recommend',tools:['SAC case pack','IA routing','Assessment tracker'],escalation:'Human/SAC authority required for formal admission decision.'},
  systems:{agent_id:'systems-agent',name:'Systems Operator',short:'SY',role:'Controlled Systems Execution',desk:'systems-desk',x:84,y:45,accent:'#43e6b0',authority:'A1 — Execute Approved Task',tools:['ACC actions','SKY task queue','Provisioning queue'],escalation:'Stop when write action requires approval or system exception.'},
  concierge:{agent_id:'concierge-agent',name:'Student Concierge',short:'SC',role:'Student Communication',desk:'concierge-desk',x:16,y:65,accent:'#53d9ff',authority:'A1 — Communicate Approved Status',tools:['Email templates','Student updates','Follow-up queue'],escalation:'Escalate sensitive or non-standard communication.'},
  compliance:{agent_id:'compliance-agent',name:'Compliance & Quality',short:'CQ',role:'Continuous Assurance',desk:'compliance-desk',x:50,y:65,accent:'#ffc76a',authority:'A1 — Flag / Verify',tools:['Audit trail','Rule checks','Exception detection'],escalation:'Escalate unresolved control failure or missing evidence.'},
  orientation:{agent_id:'orientation-agent',name:'Orientation & Engagement',short:'OR',role:'Student Readiness',desk:'orientation-desk',x:84,y:65,accent:'#53d9ff',authority:'A1 — Operate Session',tools:['Session roster','Invitation','Attendance','Feedback','Recording'],escalation:'Escalate unresolved attendance or completion exception.'},
  handover:{agent_id:'handover-agent',name:'Academic Handover',short:'AH',role:'Provisioning & Student Access',desk:'handover-desk',x:34,y:84,accent:'#43e6b0',authority:'A1 — Coordinate / Verify',tools:['Handover batch','IT/Moodle/e-Library status','Student Access'],escalation:'Escalate incomplete provisioning or invalid handover state.'},
  management:{agent_id:'management-agent',name:'Management Intelligence',short:'MI',role:'Operational Insight',desk:'management-desk',x:66,y:84,accent:'#ffc76a',authority:'A0 — Observe / Explain',tools:['Dashboard metrics','Bottleneck signals','Performance summary'],escalation:'Escalate material operational risk to Registrar.'}
};

const DEFAULT_STATE={
  status:'IDLE',current_case:'—',current_task:'Waiting for event',location:'',target_location:'',handover_to:'',event:'—',
  authority_level:'',timestamp:'',last_action:'No action yet',next_action:'Wait for event',waiting_since:'—',workload:0
};

const officeState={};
Object.entries(OFFICE_AGENTS).forEach(([key,a])=>{
  officeState[key]={...DEFAULT_STATE,agent_id:a.agent_id,name:a.name,location:a.desk,authority_level:a.authority,tools:a.tools,escalation_rule:a.escalation};
});

const SCENARIOS={
  new_application:{
    label:'New Application',
    case:'PHD-2026-018',
    steps:[
      E('APPLICATION_RECEIVED','orchestrator','WORKING','Register new case','Create intake task','Application stored','TASK_ASSIGNED','New application arrived in ACC.'),
      E('TASK_ASSIGNED','admission','WORKING','Qualification Review','Analyse application and documents','Case context loaded','DOCUMENT_REVIEW_COMPLETE','Orchestrator assigned the case to Admission Intelligence.'),
      E('DOCUMENT_REVIEW_COMPLETE','admission','WORKING','Document Review','Complete controlled checklist','Documents verified','SAC_CASE_PREPARED','DOCUMENT REVIEW COMPLETE'),
      H('SAC_CASE_PREPARED','admission','sac','SAC REVIEW','Prepare SAC case','Handover accepted','TASK_ACCEPTED','Admission Intelligence is handing the case to SAC & IA Agent.'),
      E('TASK_ACCEPTED','sac','RECEIVING','SAC Case Preparation','Accept case and prepare routing','Case accepted','STUDENT_UPDATE_REQUIRED','TASK ACCEPTED'),
      E('STUDENT_UPDATE_REQUIRED','concierge','WORKING','Student Status Update','Send approved progress update','Communication logged','COMPLIANCE_CHECK','Student Concierge sent the student update.'),
      E('COMPLIANCE_CHECK','compliance','WORKING','Admission Control Check','Verify workflow evidence','Control check passed','NEXT_STATE_READY','Compliance & Quality checked the transition.'),
      E('NEXT_STATE_READY','orchestrator','WORKING','Route Next State','Record next event','Next workflow state prepared','SIMULATION_COMPLETE','Orchestrator marked the case ready for its next controlled event.')
    ]
  },
  missing_document:{
    label:'Missing Document',
    case:'MBA-2026-041',
    steps:[
      E('APPLICATION_RECEIVED','admission','WORKING','Document Review','Check required evidence','Missing item detected','MISSING_DOCUMENT','Application review started.'),
      E('MISSING_DOCUMENT','admission','WAITING','Document Review','Flag missing academic transcript','Exception recorded','STUDENT_UPDATE_REQUIRED','MISSING DOCUMENT detected.'),
      H('STUDENT_UPDATE_REQUIRED','admission','concierge','DOCUMENT REQUEST','Request missing document','Communication task accepted','WAITING_FOR_STUDENT','Case handed to Student Concierge.'),
      E('WAITING_FOR_STUDENT','concierge','WAITING','Document Follow-up','Send document request','Student notified','DOCUMENT_RECEIVED','Waiting for student document.'),
      E('DOCUMENT_RECEIVED','concierge','WORKING','Document Intake','Record new upload','Upload received','DOCUMENT_REVIEW_RESUME','Required document received.'),
      H('DOCUMENT_REVIEW_RESUME','concierge','admission','DOCUMENT READY','Return case for review','Admission queue updated','COMPLIANCE_CHECK','Student Concierge returned the case to Admission Intelligence.'),
      E('COMPLIANCE_CHECK','compliance','WORKING','Evidence Check','Verify restored evidence trail','Audit trail complete','SIMULATION_COMPLETE','Compliance verified the recovered document trail.')
    ]
  },
  sac_ia:{
    label:'SAC / IA Handover',
    case:'PHD-2026-023',
    steps:[
      E('SAC_CASE_PREPARED','sac','WORKING','SAC Preparation','Prepare candidate summary','SAC pack ready','IA_REQUIRED','SAC case prepared.'),
      E('IA_REQUIRED','sac','WORKING','IA Routing','Open Internal Assessment route','IA route created','STUDENT_UPDATE_REQUIRED','IA REQUIRED'),
      H('STUDENT_UPDATE_REQUIRED','sac','concierge','IA NOTICE','Send IA instruction','Communication accepted','IA_SCHEDULED','SAC & IA Agent handed student communication to Concierge.'),
      E('IA_SCHEDULED','concierge','WORKING','IA Communication','Send approved IA details','Student notified','IA_IN_PROGRESS','Student IA update sent.'),
      E('IA_IN_PROGRESS','sac','WORKING','Internal Assessment','Track evidence and panel outcome','Assessment tracked','COMPLIANCE_CHECK','IA case is being monitored.'),
      E('COMPLIANCE_CHECK','compliance','WORKING','IA Control Check','Verify required evidence','IA evidence complete','SIMULATION_COMPLETE','Compliance checked IA evidence.')
    ]
  },
  human_decision:{
    label:'Human Decision',
    case:'PHD-2026-018',
    steps:[
      E('SAC_CASE_PREPARED','sac','WORKING','Eligibility Routing','Assess available evidence','Recommendation prepared','HUMAN_DECISION_REQUIRED','SAC & IA Agent prepared a recommendation.'),
      X('HUMAN_DECISION_REQUIRED','sac','Refer applicant to IA','Non-field qualification with insufficient verified management evidence.'),
      E('HUMAN_DECISION_RECORDED','orchestrator','WORKING','Decision Routing','Record approved human outcome','Decision stored','IA_REQUIRED','Human decision recorded; Orchestrator resumes routing.'),
      H('IA_REQUIRED','orchestrator','sac','IA REQUIRED','Return case to SAC & IA Agent','Task accepted','STUDENT_UPDATE_REQUIRED','Case returned to SAC & IA Agent with human authority recorded.'),
      E('STUDENT_UPDATE_REQUIRED','concierge','WORKING','Student Update','Send approved IA instruction','Communication logged','SIMULATION_COMPLETE','Student Concierge sent the authorised update.')
    ]
  },
  orientation:{
    label:'Orientation',
    case:'MBA-2026-052',
    steps:[
      E('ORIENTATION_READY','orchestrator','WORKING','Orientation Routing','Assign student to Orientation workflow','Orientation task created','SESSION_PREPARED','Student is ready for Orientation.'),
      H('SESSION_PREPARED','orchestrator','orientation','ORIENTATION','Prepare session','Orientation Agent accepted case','INVITATION_REQUIRED','Case handed to Orientation & Engagement.'),
      E('INVITATION_REQUIRED','orientation','WORKING','Invitation','Prepare and send invitation','Invitation logged','ATTENDANCE_OPEN','Orientation invitation sent.'),
      E('ATTENDANCE_OPEN','orientation','WORKING','Attendance & Feedback','Open attendance during session','Attendance active','STUDENT_UPDATE_REQUIRED','Attendance window is active.'),
      E('STUDENT_UPDATE_REQUIRED','concierge','WORKING','Orientation Update','Send session communication','Student updated','ORIENTATION_COMPLETION_CHECK','Student Concierge sent session update.'),
      E('ORIENTATION_COMPLETION_CHECK','compliance','WORKING','Completion Control','Verify attendance, recording and report','Orientation control passed','HANDOVER_READY','Compliance verified Orientation completion.'),
      E('HANDOVER_READY','orchestrator','WORKING','Route to Handover','Create next event','Handover task ready','SIMULATION_COMPLETE','Orchestrator marked the student ready for Academic Handover.')
    ]
  },
  academic_handover:{
    label:'Academic Handover',
    case:'MBA-2026-052',
    steps:[
      E('HANDOVER_READY','handover','WORKING','Create Handover','Prepare student handover batch','Batch prepared','SYSTEM_PROVISIONING_REQUIRED','Academic Handover started.'),
      H('SYSTEM_PROVISIONING_REQUIRED','handover','systems','PROVISION','Request IT / Moodle / e-Library setup','Systems task accepted','PROVISIONING_IN_PROGRESS','Handover Agent passed provisioning tasks to Systems Operator.'),
      E('PROVISIONING_IN_PROGRESS','systems','WORKING','Provisioning','Track service setup','Accounts provisioned','PROVISIONING_VERIFIED','Systems Operator completed provisioning.'),
      H('PROVISIONING_VERIFIED','systems','handover','ACCESS READY','Return verified provisioning','Handover queue updated','STUDENT_ACCESS_REQUIRED','Provisioning returned to Academic Handover.'),
      E('STUDENT_ACCESS_REQUIRED','handover','WORKING','Student Access','Prepare final access communication','Access package ready','STUDENT_UPDATE_REQUIRED','Student Access package prepared.'),
      E('STUDENT_UPDATE_REQUIRED','concierge','WORKING','Access Communication','Send student credentials / access notice','Student notified','HANDOVER_COMPLETE','Student Concierge sent the final access communication.'),
      E('HANDOVER_COMPLETE','management','WORKING','Operational Insight','Record completion signal','Lifecycle completion visible','SIMULATION_COMPLETE','Management Intelligence received the completion signal.')
    ]
  }
};

function E(event,agent,status,task,action,verification,next,message){
  return{kind:'event',event,agent,status,task,action,verification,next,message,duration:950};
}
function H(event,from,to,label,task,verification,next,message){
  return{kind:'handover',event,from,to,label,task,action:'Transfer controlled case',verification,next,message,duration:1850};
}
function X(event,from,recommendation,reason){
  return{kind:'human',event,from,to:'human',label:'HUMAN DECISION',task:'Authority Review',action:'Escalate controlled decision',verification:'Human decision required',next:'HUMAN_DECISION_RECORDED',message:'Human authority is required before the workflow may continue.',recommendation,reason,duration:1900};
}

const simulation={
  running:false,paused:false,scenario:'new_application',step:-1,token:0,currentAnimation:null,pendingHuman:null,
  metrics:{events:0,handovers:0,humanDecisions:0,completed:0}
};

const LIVE_AGENT_MAP=Object.freeze({
  ORCHESTRATOR:'orchestrator',
  COMPLIANCE:'compliance',
  ADMISSION_INTELLIGENCE:'admission',
  SAC_IA:'sac',
  STUDENT_CONCIERGE:'concierge',
  SYSTEMS_OPERATOR:'systems',
  ORIENTATION:'orientation',
  ACADEMIC_HANDOVER:'handover',
  MANAGEMENT_INTELLIGENCE:'management'
});

const liveRuntime={
  mode:'SIMULATION_FALLBACK',
  bridgeReady:false,
  n8nLive:false,
  lastEventId:'',
  events:[],
  executions:[],
  summary:{running:0,failed:0,completed:0,humanWaiting:0,totalEvents:0,totalExecutions:0}
};

function nowIso(){return new Date().toISOString();}
function nowClock(){return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});}
function prefersReduced(){return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}

function mount(){
  renderDesks();
  bindControls();
  setAllIdle();
  renderPerformance();
  renderTabViews();
  installTabSyncObservers();
  updateSimButtons();
  window.switchOpsView=window.switchOpsView||switchOpsView;
}

function renderDesks(){
  const stage=document.getElementById('officeStage'); if(!stage)return;
  stage.innerHTML='<div class="office-label"><small>IPGS Digital Registrar Office</small><b>Structured Event Operations Floor</b></div>'+
    '<div class="office-corridor v"></div><div class="office-corridor vl"></div><div class="office-corridor vr"></div><div class="office-corridor h0"></div><div class="office-corridor h1"></div><div class="office-corridor h2"></div><div class="office-corridor h3"></div>'+
    '<div id="officeEventToast" class="office-event-toast"></div>';
  Object.entries(OFFICE_AGENTS).forEach(([key,a])=>{
    const el=document.createElement('button');
    el.type='button';el.className='office-desk';el.id=a.desk;el.dataset.agent=key;
    el.style.setProperty('--x',a.x+'%');el.style.setProperty('--y',a.y+'%');el.style.setProperty('--desk',a.accent);
    el.setAttribute('aria-label',a.name+' workstation');
    el.innerHTML='<div class="desk-head"><div class="desk-avatar">'+a.short+'</div><div class="desk-name"><b>'+a.name+'</b><small>'+a.role+'</small></div><span class="desk-state">IDLE</span></div>'+
      '<div class="desk-task"><span>Waiting for structured event</span><b>0 queued</b></div><div class="desk-case"><i></i><span>No active case</span></div>';
    el.onclick=()=>openOfficeAgent(key);
    stage.appendChild(el);
  });
}

function setAllIdle(){
  Object.entries(officeState).forEach(([key,s])=>{
    Object.assign(s,{...DEFAULT_STATE,agent_id:s.agent_id,name:s.name,location:OFFICE_AGENTS[key].desk,authority_level:OFFICE_AGENTS[key].authority,tools:OFFICE_AGENTS[key].tools,escalation_rule:OFFICE_AGENTS[key].escalation,workload:key==='human'?0:Math.max(0,s.workload||0)});
    renderAgentDesk(key);
  });
  clearHumanDesk();
  updatePipeline(null);
}

function setAgent(key,patch){
  if(!officeState[key])return;
  Object.assign(officeState[key],patch,{timestamp:nowIso()});
  renderAgentDesk(key);
  if(document.getElementById('officeDetailDrawer')?.classList.contains('open')&&document.getElementById('officeDetailDrawer')?.dataset.agent===key)renderDrawer(key);
}

function renderAgentDesk(key){
  const s=officeState[key],a=OFFICE_AGENTS[key],el=document.getElementById(a.desk);if(!el)return;
  const status=String(s.status||'IDLE').toUpperCase();
  el.className='office-desk '+status.toLowerCase();
  el.style.setProperty('--desk',a.accent);
  const st=el.querySelector('.desk-state');st.textContent=status;st.className='desk-state '+status.toLowerCase();
  el.querySelector('.desk-task span').textContent=s.current_task||'Waiting for structured event';
  el.querySelector('.desk-task b').textContent=(s.workload||0)+' queued';
  el.querySelector('.desk-case span').textContent=s.current_case&&s.current_case!=='—'?(s.current_case+' · '+(s.event||status)):'No active case';
  el.setAttribute('aria-label',a.name+' · '+status+' · '+(s.current_task||'Waiting'));
}

async function runSimulation(){
  if(simulation.running)return;
  resetSimulation(false);
  simulation.running=true;simulation.paused=false;simulation.token++;
  const token=simulation.token;
  const scenario=SCENARIOS[simulation.scenario];
  if(!scenario){simulation.running=false;return;}
  appendOfficeLog('SYSTEM','Simulation Engine',scenario.case,'SCENARIO START','Running '+scenario.label+' structured event sequence.');
  updateSimButtons();
  for(let i=0;i<scenario.steps.length;i++){
    if(token!==simulation.token)return;
    simulation.step=i;
    await waitWhilePaused(token);
    if(token!==simulation.token)return;
    const step=scenario.steps[i];
    updatePipeline(step);
    await executeStep(step,scenario.case,token);
    if(token!==simulation.token)return;
    if(step.kind==='human'){
      const humanOutcome=await waitForHuman(token);
      if(token!==simulation.token)return;
      if(humanOutcome!=='approve'){
        simulation.running=false;simulation.paused=false;
        showToast(humanOutcome==='evidence'?'MORE EVIDENCE REQUESTED':'CASE RETURNED','Workflow stopped at the recorded human decision.');
        appendOfficeLog(nowClock(),'Simulation Engine',scenario.case,'CONTROLLED STOP','Scenario stopped because the human decision did not approve the proposed route.');
        updateSimButtons();renderPerformance();
        return;
      }
    }
    await delay(500,token);
  }
  if(token!==simulation.token)return;
  simulation.running=false;simulation.paused=false;simulation.metrics.completed++;
  showToast('SIMULATION_COMPLETE','Structured scenario completed');
  appendOfficeLog(nowClock(),'AI Orchestrator',scenario.case,'SIMULATION COMPLETE',scenario.label+' completed without production write actions.');
  Object.keys(officeState).forEach(k=>{if(k!=='human')setAgent(k,{status:'IDLE',current_task:'Waiting for event',next_action:'Wait for event',target_location:'',handover_to:''})});
  updateSimButtons();renderPerformance();
}

async function executeStep(step,caseId,token){
  simulation.metrics.events++;
  if(step.kind==='event'){
    setAgent(step.agent,{
      status:step.status||'WORKING',current_case:caseId,current_task:step.task,event:step.event,last_action:step.action,
      next_action:step.next,waiting_since:(step.status==='WAITING'?nowClock():'—'),workload:Math.max(1,officeState[step.agent].workload||0)
    });
    showToast(step.event,step.message);
    appendOfficeLog(nowClock(),OFFICE_AGENTS[step.agent].name,caseId,step.event,step.message);
    mirrorActivity(OFFICE_AGENTS[step.agent].name,caseId,step.message);
    await delay(step.duration||900,token);
    return;
  }
  if(step.kind==='handover'){
    simulation.metrics.handovers++;
    setAgent(step.from,{status:'HANDOVER',current_case:caseId,current_task:step.task,event:step.event,target_location:OFFICE_AGENTS[step.to].desk,handover_to:step.to,last_action:step.action,next_action:step.next});
    setAgent(step.to,{status:'RECEIVING',current_case:caseId,current_task:'Receiving '+step.task,event:step.event,last_action:'Awaiting handover',next_action:step.next});
    showToast(step.event,step.message);
    appendOfficeLog(nowClock(),OFFICE_AGENTS[step.from].name+' → '+OFFICE_AGENTS[step.to].name,caseId,step.label||step.event,step.message);
    mirrorActivity(OFFICE_AGENTS[step.from].name+' → '+OFFICE_AGENTS[step.to].name,caseId,step.message);
    await animateHandover(step.from,step.to,caseId,step.label||step.event,token,step.duration);
    setAgent(step.from,{status:'IDLE',current_case:'—',current_task:'Waiting for event',target_location:'',handover_to:'',next_action:'Wait for event'});
    setAgent(step.to,{status:'RECEIVING',current_case:caseId,current_task:step.task,event:step.event,last_action:'Task accepted',next_action:step.next,workload:Math.max(1,officeState[step.to].workload||0)});
    showToast('TASK ACCEPTED',OFFICE_AGENTS[step.to].name+' accepted '+caseId);
    return;
  }
  if(step.kind==='human'){
    simulation.metrics.handovers++;simulation.metrics.humanDecisions++;
    setAgent(step.from,{status:'ESCALATION',current_case:caseId,current_task:step.task,event:step.event,target_location:OFFICE_AGENTS.human.desk,handover_to:'human',last_action:'Escalated to human authority',next_action:'Wait for recorded decision'});
    setAgent('human',{status:'RECEIVING',current_case:caseId,current_task:'Authority Review',event:step.event,last_action:'Case received',next_action:'Record human decision',workload:1});
    showToast(step.event,'Human authority required');
    appendOfficeLog(nowClock(),OFFICE_AGENTS[step.from].name+' → Human Decision Desk',caseId,step.event,step.message);
    mirrorActivity(OFFICE_AGENTS[step.from].name+' → Human Decision Desk',caseId,step.message);
    await animateHandover(step.from,'human',caseId,'HUMAN DECISION',token,step.duration);
    setAgent(step.from,{status:'WAITING',waiting_since:nowClock(),next_action:'Await human decision'});
    setAgent('human',{status:'WORKING',current_case:caseId,current_task:'Review AI recommendation',event:step.event,last_action:'Authority review opened',next_action:'Approve / Return / Request Evidence'});
    showHumanCase(caseId,step);
    simulation.paused=true;
    updateSimButtons();
  }
}

function motionDisabled(){return prefersReduced()||document.body.classList.contains('office-motion-off');}
function animateHandover(from,to,caseId,label,token,duration){
  return new Promise(resolve=>{
    const stage=document.getElementById('officeStage'),src=document.getElementById(OFFICE_AGENTS[from].desk),dst=document.getElementById(OFFICE_AGENTS[to].desk);
    if(!stage||!src||!dst||motionDisabled()){resolve();return;}
    const sr=src.getBoundingClientRect(),dr=dst.getBoundingClientRect(),br=stage.getBoundingClientRect();
    const sx=sr.left-br.left+sr.width/2,sy=sr.top-br.top+sr.height/2,tx=dr.left-br.left+dr.width/2,ty=dr.top-br.top+dr.height/2;
    const fromCfg=OFFICE_AGENTS[from],toCfg=OFFICE_AGENTS[to];
    const corridorXPct=(fromCfg.x>50||toCfg.x>50)?67:33;
    let corridorYPct=35;
    const avgY=(fromCfg.y+toCfg.y)/2;
    if(avgY<20)corridorYPct=16;
    else if(avgY<55)corridorYPct=35;
    else if(avgY<75)corridorYPct=55;
    else corridorYPct=75;
    const cx=br.width*(corridorXPct/100),cy=br.height*(corridorYPct/100);
    const runner=document.createElement('div');runner.className='office-runner';
    runner.style.left=sx+'px';runner.style.top=sy+'px';
    runner.innerHTML='<div class="runner-core"><div class="runner-avatar">'+OFFICE_AGENTS[from].short+'</div><div class="runner-copy"><b>'+OFFICE_AGENTS[from].name+'</b><small>'+caseId+' · '+label+'</small></div><div class="case-orb">◆</div></div>';
    stage.appendChild(runner);
    const p1x=cx-sx,p1y=0,p2x=cx-sx,p2y=cy-sy,p3x=tx-sx,p3y=cy-sy,dx=tx-sx,dy=ty-sy;
    const frames=[
      {transform:'translate(-50%,-50%) translate(0px,0px)'},
      {transform:'translate(-50%,-50%) translate('+p1x+'px,'+p1y+'px)',offset:.2},
      {transform:'translate(-50%,-50%) translate('+p2x+'px,'+p2y+'px)',offset:.48},
      {transform:'translate(-50%,-50%) translate('+p3x+'px,'+p3y+'px)',offset:.78},
      {transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px)'}
    ];
    const anim=runner.animate(frames,{duration:duration||1850,easing:'cubic-bezier(.34,.02,.16,1)',fill:'forwards'});
    simulation.currentAnimation=anim;
    anim.onfinish=()=>{runner.remove();if(simulation.currentAnimation===anim)simulation.currentAnimation=null;resolve();};
    anim.oncancel=()=>{runner.remove();if(simulation.currentAnimation===anim)simulation.currentAnimation=null;resolve();};
    if(simulation.paused)anim.pause();
  });
}

function pauseSimulation(){
  if(!simulation.running||simulation.paused)return;
  simulation.paused=true;simulation.currentAnimation?.pause();updateSimButtons();
  appendOfficeLog(nowClock(),'Simulation Engine','—','PAUSED','Simulation paused by operator.');
}
function resumeSimulation(){
  if(!simulation.running||!simulation.paused||simulation.pendingHuman)return;
  simulation.paused=false;simulation.currentAnimation?.play();updateSimButtons();
  appendOfficeLog(nowClock(),'Simulation Engine','—','RESUMED','Simulation resumed by operator.');
}
function resetSimulation(log=true){
  simulation.token++;simulation.running=false;simulation.paused=false;simulation.step=-1;simulation.pendingHuman=null;
  if(simulation.currentAnimation){simulation.currentAnimation.cancel();simulation.currentAnimation=null;}
  document.querySelectorAll('.office-runner').forEach(x=>x.remove());
  setAllIdle();updateSimButtons();
  if(log)appendOfficeLog(nowClock(),'Simulation Engine','—','RESET','Simulation state reset. No production data changed.');
}
function waitForHuman(token){
  return new Promise(resolve=>{
    if(token!==simulation.token){resolve('cancelled');return;}
    simulation.pendingHuman=resolve;
    updateSimButtons();
  });
}
function recordHumanDecision(decision){
  if(!simulation.pendingHuman)return;
  const scenario=SCENARIOS[simulation.scenario],caseId=scenario?.case||'CASE';
  const labels={approve:'APPROVED',return:'RETURNED TO AGENT',evidence:'MORE EVIDENCE REQUESTED'};
  appendOfficeLog(nowClock(),'Registrar / Human Decision Desk',caseId,'HUMAN DECISION · '+labels[decision],decision==='approve'?'AI recommendation approved.':decision==='return'?'Case returned to agent for rework.':'Additional evidence requested before decision.');
  mirrorActivity('Human Decision Desk',caseId,'Human decision recorded: '+labels[decision]);
  setAgent('human',{status:'IDLE',current_case:'—',current_task:'Waiting for escalation',workload:0,last_action:labels[decision],next_action:'Wait for escalation'});
  const from=Object.keys(officeState).find(k=>officeState[k].status==='WAITING'&&officeState[k].current_case===caseId);
  if(from)setAgent(from,{status:'IDLE',current_case:'—',current_task:'Waiting for event',waiting_since:'—',last_action:'Human decision: '+labels[decision],next_action:'Wait for routed event'});
  clearHumanDesk();
  const resolve=simulation.pendingHuman;simulation.pendingHuman=null;simulation.paused=false;updateSimButtons();resolve(decision);
}

function showHumanCase(caseId,step){
  const host=document.getElementById('officeHumanCase');if(!host)return;
  host.className='human-case';
  host.innerHTML='<div class="hc-alert">HUMAN DECISION REQUIRED</div><h4>'+caseId+'</h4>'+
    '<div class="hc-meta"><div><small>AI Recommendation</small><b>'+escapeOffice(step.recommendation)+'</b></div><div><small>Authority</small><b>Human approval required</b></div></div>'+
    '<div class="recommendation"><b>Reason</b><br>'+escapeOffice(step.reason)+'</div>'+
    '<div class="decision-actions"><button class="approve" data-decision="approve">Approve</button><button class="return" data-decision="return">Return to Agent</button><button class="evidence" data-decision="evidence">Request More Evidence</button></div>';
  host.querySelectorAll('[data-decision]').forEach(btn=>btn.onclick=()=>recordHumanDecision(btn.dataset.decision));
}
function clearHumanDesk(){
  const host=document.getElementById('officeHumanCase');if(!host)return;
  host.className='human-case empty';host.innerHTML='No case is waiting for human authority. In simulation mode, a controlled escalation will appear here and the event chain will pause until a decision is recorded.';
}

function showToast(event,message){
  const el=document.getElementById('officeEventToast');if(!el)return;
  el.classList.remove('show');void el.offsetWidth;
  el.innerHTML='<small>'+escapeOffice(event)+'</small><b>'+escapeOffice(message)+'</b>';el.classList.add('show');
}
function updatePipeline(step){
  const values=step?{
    event:step.event||'—',task:step.task||'—',agent:step.agent?OFFICE_AGENTS[step.agent]?.name:(step.from?OFFICE_AGENTS[step.from]?.name:'—'),
    action:step.action||'—',verification:step.verification||'—',next:step.next||'—'
  }:{event:'Waiting',task:'—',agent:'—',action:'—',verification:'—',next:'—'};
  ['event','task','agent','action','verification','next'].forEach(k=>{
    const el=document.querySelector('[data-pipeline="'+k+'"]');if(el){el.textContent=values[k];el.parentElement.classList.toggle('active',k==='event'&&!!step);}
  });
}

function appendOfficeLog(time,actor,caseId,event,message){
  const host=document.getElementById('officeActivityFeed');if(!host)return;
  const row=document.createElement('div');row.className='office-feed-item';
  row.innerHTML='<time>'+escapeOffice(time||nowClock())+'</time><b>'+escapeOffice(actor)+'</b><p><span class="flow-arrow">'+escapeOffice(event)+'</span><br>'+escapeOffice(caseId)+' · '+escapeOffice(message)+'</p>';
  host.prepend(row);
  while(host.children.length>30)host.lastElementChild.remove();
  renderPerformance();
}
function mirrorActivity(actor,caseId,message){
  const host=document.getElementById('activityFeed');if(!host)return;
  const row=document.createElement('div');row.className='feed-item simulation-feed';
  row.innerHTML='<div class="time">'+escapeOffice(nowClock())+'</div><div class="feed-copy"><b>'+escapeOffice(actor)+'</b> · '+escapeOffice(caseId)+' · '+escapeOffice(message)+'</div>';
  host.prepend(row);
}

function openOfficeAgent(key){
  if(!OFFICE_AGENTS[key])return;
  const drawer=document.getElementById('officeDetailDrawer');if(!drawer)return;
  drawer.dataset.agent=key;renderDrawer(key);drawer.classList.add('open');
}
function closeOfficeAgent(){document.getElementById('officeDetailDrawer')?.classList.remove('open');}
function renderDrawer(key){
  const a=OFFICE_AGENTS[key],s=officeState[key],body=document.getElementById('officeDrawerBody'),title=document.getElementById('officeDrawerTitle'),sub=document.getElementById('officeDrawerSub');
  if(!a||!body)return;
  title.textContent=a.name;sub.textContent=a.role;
  body.innerHTML='<div class="drawer-status"><div><small>Status</small><b>'+escapeOffice(s.status)+'</b></div><span class="desk-state '+String(s.status).toLowerCase()+'">'+escapeOffice(s.status)+'</span></div>'+
    '<div class="drawer-grid">'+
      card('Current Case',s.current_case)+card('Current Task',s.current_task)+card('Workload',(s.workload||0)+' queued')+card('Last Action',s.last_action)+card('Next Action',s.next_action)+
      card('Authority Level',s.authority_level)+card('Waiting Since',s.waiting_since)+card('Current Event',s.event)+card('Tools Available',(s.tools||[]).join(' · '),'drawer-wide')+
      card('Escalation Rule',s.escalation_rule,'drawer-wide')+
    '</div>';
}
function card(label,value,cls=''){return '<div class="'+cls+'"><small>'+escapeOffice(label)+'</small><b>'+escapeOffice(value||'—')+'</b></div>';}

function bindControls(){
  const scenario=document.getElementById('officeScenario');if(scenario){scenario.innerHTML=Object.entries(SCENARIOS).map(([k,v])=>'<option value="'+k+'">'+escapeOffice(v.label)+'</option>').join('');scenario.value=simulation.scenario;scenario.onchange=()=>{simulation.scenario=scenario.value;resetSimulation(false);};}
  document.getElementById('officeRun')?.addEventListener('click',runSimulation);
  document.getElementById('officePause')?.addEventListener('click',pauseSimulation);
  document.getElementById('officeResume')?.addEventListener('click',resumeSimulation);
  document.getElementById('officeReset')?.addEventListener('click',()=>resetSimulation(true));
  document.getElementById('officeDrawerClose')?.addEventListener('click',closeOfficeAgent);
  document.getElementById('officeMotionToggle')?.addEventListener('click',()=>{
    document.body.classList.toggle('office-motion-off');
    const on=document.body.classList.contains('office-motion-off');
    document.getElementById('officeMotionToggle').textContent=on?'Motion Off':'Motion On';
  });
}
function updateSimButtons(){
  const run=document.getElementById('officeRun'),pause=document.getElementById('officePause'),resume=document.getElementById('officeResume'),stateEl=document.getElementById('officeSimState');
  if(run)run.disabled=simulation.running;
  if(pause)pause.disabled=!simulation.running||simulation.paused;
  if(resume)resume.disabled=!simulation.running||!simulation.paused||!!simulation.pendingHuman;
  if(stateEl){stateEl.className='sim-state '+(simulation.running?(simulation.paused?'paused':'running'):'');stateEl.innerHTML='<i></i>'+(simulation.running?(simulation.paused?(simulation.pendingHuman?'Waiting for Human':'Paused'):'Running'):'Ready');}
}

async function waitWhilePaused(token){
  while(simulation.paused&&token===simulation.token){await new Promise(r=>setTimeout(r,100));}
}
async function delay(ms,token){
  const start=Date.now();
  while(Date.now()-start<ms&&token===simulation.token){
    if(simulation.paused){await new Promise(r=>setTimeout(r,100));continue;}
    await new Promise(r=>setTimeout(r,Math.min(100,ms-(Date.now()-start))));
  }
}

function switchOpsView(view){
  const target=view||'overview';
  document.querySelectorAll('.ops-view').forEach(el=>el.classList.toggle('active',el.dataset.view===target));
  document.querySelectorAll('.ops-nav button').forEach(btn=>btn.classList.toggle('active',btn.dataset.view===target));
  if(target==='decisions')syncDecisionTab();
  if(target==='exceptions')syncExceptionTab();
  if(target==='activity')syncActivityTab();
  if(target==='performance')renderPerformance();
  window.scrollTo({top:0,behavior:prefersReduced()?'auto':'smooth'});
}
function installTabSyncObservers(){
  const pairs=[
    ['decisionList',syncDecisionTab],
    ['exceptionList',syncExceptionTab],
    ['activityFeed',syncActivityTab]
  ];
  pairs.forEach(([id,fn])=>{
    const el=document.getElementById(id);if(!el||el.dataset.officeObserved==='1')return;
    el.dataset.officeObserved='1';
    new MutationObserver(()=>fn()).observe(el,{childList:true,subtree:true,characterData:true});
  });
}
function renderTabViews(){
  syncDecisionTab();syncExceptionTab();syncActivityTab();renderPerformance();
}
function syncDecisionTab(){
  const target=document.getElementById('decisionTabList'),source=document.getElementById('decisionList');if(target&&source)target.innerHTML=source.innerHTML;
}
function syncExceptionTab(){
  const target=document.getElementById('exceptionTabList'),source=document.getElementById('exceptionList');if(target&&source)target.innerHTML=source.innerHTML;
}
function syncActivityTab(){
  const target=document.getElementById('activityTabFeed'),source=document.getElementById('activityFeed');if(target&&source)target.innerHTML=source.innerHTML;
}
function renderPerformance(){
  const host=document.getElementById('performanceGrid');if(!host)return;
  const working=Object.values(officeState).filter(x=>x.status==='WORKING').length;
  const waiting=Object.values(officeState).filter(x=>['WAITING','ESCALATION'].includes(x.status)).length;
  if(liveRuntime.bridgeReady){
    host.innerHTML=
      perf('Backend Events',liveRuntime.summary.totalEvents||0,'V2_AGENT_EVENTS received')+
      perf('Agent Executions',liveRuntime.summary.totalExecutions||0,'Idempotent execution records')+
      perf('Running Now',liveRuntime.summary.running||0,'Actions currently RUNNING')+
      perf('Human Waiting',liveRuntime.summary.humanWaiting||0,'Cases requiring authority')+
      perf('Completed',liveRuntime.summary.completed||0,'Verified completed executions')+
      perf('Failed',liveRuntime.summary.failed||0,'Requires retry / investigation')+
      perf('Agents Working',working,'Current live visual state')+
      perf('Runtime',liveRuntime.n8nLive?'n8n LIVE':'BRIDGE READY',liveRuntime.n8nLive?'Recent n8n event detected':'Awaiting n8n activation / event');
    return;
  }
  host.innerHTML=
    perf('Simulation Events',simulation.metrics.events,'Structured events processed')+
    perf('Handovers',simulation.metrics.handovers,'Visual + auditable transfers')+
    perf('Human Decisions',simulation.metrics.humanDecisions,'Authority gates reached')+
    perf('Scenarios Completed',simulation.metrics.completed,'Frontend-only simulations')+
    perf('Agents Working',working,'Current visual state')+
    perf('Waiting / Escalated',waiting,'Requires input or authority')+
    perf('Production Writes',0,'n8n is not active yet')+
    perf('Architecture','Event → Task','Agent → Action → Verification → Next Event');
}
function perf(label,value,meta){return '<div class="perf-card"><small>'+escapeOffice(label)+'</small><b>'+escapeOffice(value)+'</b><span>'+escapeOffice(meta)+'</span></div>';}


function liveEventTime(row){
  const raw=String(row?.['Timestamp']||row?.['Last Updated']||'');
  const d=new Date(raw);
  return isNaN(d)?0:d.getTime();
}
function liveEventStatus(row){
  const raw=String(row?.['Status']||'IDLE').toUpperCase();
  if(raw==='WORKING'||raw==='RUNNING')return 'WORKING';
  if(raw==='WAITING_HUMAN'||raw==='WAITING')return 'WAITING';
  if(raw==='FAILED'||raw==='ERROR'||raw==='NEEDS_INVESTIGATION')return 'ESCALATION';
  if(raw==='QUEUED'||raw==='REQUESTED')return 'RECEIVING';
  if(raw==='HANDOVER')return 'HANDOVER';
  return 'IDLE';
}
function liveEventAgentKey(row){
  return LIVE_AGENT_MAP[String(row?.['Agent ID']||'').toUpperCase()]||'';
}
function applyLiveRuntime(snapshot){
  const data=snapshot||{};
  liveRuntime.bridgeReady=!!data.bridgeReady;
  liveRuntime.n8nLive=!!data.n8nLive;
  liveRuntime.events=Array.isArray(data.events)?data.events.slice():[];
  liveRuntime.executions=Array.isArray(data.executions)?data.executions.slice():[];
  liveRuntime.summary={...liveRuntime.summary,...(data.summary||{})};
  liveRuntime.mode=liveRuntime.n8nLive?'LIVE_N8N':(liveRuntime.bridgeReady?'BRIDGE_READY':'SIMULATION_FALLBACK');

  if(!liveRuntime.bridgeReady){
    renderPerformance();
    return;
  }

  const latestByAgent={};
  liveRuntime.events.slice().sort((a,b)=>liveEventTime(a)-liveEventTime(b)).forEach(row=>{
    const key=liveEventAgentKey(row);
    if(key)latestByAgent[key]=row;
  });

  Object.entries(LIVE_AGENT_MAP).forEach(([agentId,key])=>{
    const row=latestByAgent[key];
    const running=liveRuntime.executions.filter(x=>
      String(x['Agent ID']||'').toUpperCase()===agentId &&
      String(x['Status']||'').toUpperCase()==='RUNNING'
    ).length;
    if(!row){
      setAgent(key,{status:'IDLE',current_case:'—',current_task:'Waiting for backend event',event:'—',last_action:'No live action yet',next_action:'Wait for event',waiting_since:'—',workload:running});
      return;
    }
    const status=liveEventStatus(row);
    setAgent(key,{
      status,
      current_case:String(row['Reference No']||'—'),
      current_task:String(row['Action']||row['Event Type']||'Backend event'),
      event:String(row['Event Type']||status),
      last_action:String(row['Summary']||row['Action']||'Event recorded'),
      next_action:status==='WAITING'?'Await human authority':status==='ESCALATION'?'Investigate / retry':'Wait for next verified event',
      waiting_since:status==='WAITING'?shortLiveClock(row['Timestamp']):'—',
      workload:running
    });
  });

  const events=liveRuntime.events.slice().sort((a,b)=>liveEventTime(a)-liveEventTime(b));
  const latest=events[events.length-1];
  if(latest){
    updatePipelineFromLive(latest);
    const newestId=String(latest['Event ID']||'');
    if(liveRuntime.lastEventId && newestId && newestId!==liveRuntime.lastEventId){
      const sameCase=events.filter(x=>String(x['Reference No']||'')===String(latest['Reference No']||''));
      const prev=sameCase.length>1?sameCase[sameCase.length-2]:null;
      const fromKey=prev?liveEventAgentKey(prev):'';
      const toKey=liveEventAgentKey(latest);
      if(fromKey&&toKey&&fromKey!==toKey&&!simulation.running){
        animateHandover(fromKey,toKey,String(latest['Reference No']||'CASE'),String(latest['Event Type']||'HANDOFF'),simulation.token,1200);
      }
      showToast(String(latest['Event Type']||'AGENT EVENT'),String(latest['Summary']||latest['Action']||'Backend event recorded.'));
    }
    liveRuntime.lastEventId=newestId||liveRuntime.lastEventId;
  }

  renderLiveFeed(events);
  renderLiveHumanDesk(events);
  setLiveToolbar();
  renderPerformance();
}

function shortLiveClock(value){
  const d=new Date(String(value||''));
  return isNaN(d)?'—':d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}
function updatePipelineFromLive(row){
  const key=liveEventAgentKey(row);
  const agent=key?OFFICE_AGENTS[key]?.name:String(row['Agent Name']||'—');
  const status=String(row['Status']||'—');
  const values={
    event:String(row['Event Type']||'—'),
    task:String(row['Action']||'—'),
    agent:agent||'—',
    action:String(row['Summary']||row['Action']||'—'),
    verification:status==='COMPLETED'?'Verified complete':status==='WAITING_HUMAN'?'Human authority required':status,
    next:String(row['To Stage']||'Await next event')
  };
  ['event','task','agent','action','verification','next'].forEach(k=>{
    const el=document.querySelector('[data-pipeline="'+k+'"]');
    if(el){el.textContent=values[k];el.parentElement.classList.toggle('active',k==='event');}
  });
}
function renderLiveFeed(events){
  const host=document.getElementById('officeActivityFeed');if(!host)return;
  const recent=events.slice(-30).reverse();
  if(!recent.length){
    host.innerHTML='<div class="office-feed-item"><time>SYSTEM</time><b>Agentic Bridge</b><p>Bridge ready. Waiting for the first backend / n8n agent event.</p></div>';
    return;
  }
  host.innerHTML=recent.map(row=>{
    const key=liveEventAgentKey(row);
    const actor=key?OFFICE_AGENTS[key].name:String(row['Agent Name']||row['Agent ID']||'Agentic Bridge');
    return '<div class="office-feed-item"><time>'+escapeOffice(shortLiveClock(row['Timestamp']))+'</time><b>'+escapeOffice(actor)+'</b><p><span class="flow-arrow">'+escapeOffice(row['Event Type']||row['Status']||'EVENT')+'</span><br>'+escapeOffice(row['Reference No']||'—')+' · '+escapeOffice(row['Summary']||row['Action']||'Backend event recorded')+'</p></div>';
  }).join('');
}
function renderLiveHumanDesk(events){
  const host=document.getElementById('officeHumanCase');if(!host)return;
  const latestByRef={};
  events.forEach(row=>{const ref=String(row['Reference No']||'');if(ref)latestByRef[ref]=row;});
  const waiting=Object.values(latestByRef).filter(row=>
    String(row['Status']||'').toUpperCase()==='WAITING_HUMAN' ||
    (String(row['Requires Human']||'').toUpperCase()==='YES' && String(row['Status']||'').toUpperCase()!=='COMPLETED')
  );
  if(!waiting.length){
    setAgent('human',{status:'IDLE',current_case:'—',current_task:'Waiting for escalation',workload:0,event:'—',last_action:'No live human task',next_action:'Wait for escalation'});
    host.className='human-case empty';
    host.innerHTML='No live case is currently waiting for human authority.';
    return;
  }
  const row=waiting[waiting.length-1];
  setAgent('human',{status:'ESCALATION',current_case:String(row['Reference No']||'—'),current_task:String(row['Action']||row['Event Type']||'Human review'),workload:waiting.length,event:String(row['Event Type']||'HUMAN_TASK_CREATED'),last_action:String(row['Summary']||'Human authority required'),next_action:'Authorised human resolution required',waiting_since:shortLiveClock(row['Timestamp'])});
  host.className='human-case';
  host.innerHTML='<div class="hc-alert">LIVE HUMAN DECISION REQUIRED</div><h4>'+escapeOffice(row['Student Name']||row['Reference No']||'Case')+'</h4>'+
    '<div class="hc-meta"><div><small>Reference</small><b>'+escapeOffice(row['Reference No']||'—')+'</b></div><div><small>Raised By</small><b>'+escapeOffice(row['Agent Name']||row['Agent ID']||'AI Agent')+'</b></div></div>'+
    '<div class="recommendation"><b>Reason / Task</b><br>'+escapeOffice(row['Summary']||row['Action']||'Human confirmation required.')+'</div>'+
    '<div style="margin-top:9px;font-size:9px;color:#8792ba">Read-only live queue. Human resolution action will be connected through the controlled Human Task Gateway.</div>';
}
function setLiveToolbar(){
  const stateEl=document.getElementById('officeSimState');
  if(stateEl){
    stateEl.className='sim-state '+(liveRuntime.n8nLive?'running':'');
    stateEl.innerHTML='<i></i>'+(liveRuntime.n8nLive?'LIVE n8n':'Bridge Ready');
  }
  const run=document.getElementById('officeRun');
  if(run)run.textContent=liveRuntime.n8nLive?'Simulation Disabled While Live':'▶ Run Simulation Fallback';
}

function escapeOffice(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}

window.AI_AGENT_OFFICE={officeState,simulation,liveRuntime,SCENARIOS,runSimulation,pauseSimulation,resumeSimulation,resetSimulation,setAgent,recordHumanDecision,switchOpsView,applyLiveRuntime};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();