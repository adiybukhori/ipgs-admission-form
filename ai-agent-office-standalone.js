(function(){
'use strict';

var AGENTS={
  human:{name:'Human Decision Desk',code:'HD',role:'Registrar Authority',x:50,y:10,authority:'Approve, return or request evidence',tools:['Judgement','Controlled approval','Exception decision']},
  orchestrator:{name:'AI Orchestrator',code:'AI',role:'Operations Router',x:50,y:22,authority:'Route and coordinate cases',tools:['Task routing','Agent state','Priority queue','Escalation']},
  intake:{name:'Admission Intake Agent',code:'IN',role:'Application Intake',x:12,y:39,authority:'Capture and validate submission',tools:['Application form','Document checklist','Applicant record']},
  marketing:{name:'Prospect & Fee Group Agent',code:'PF',role:'Marketing / SkyVialing Handoff',x:35,y:39,authority:'Track prospect creation and fee group',tools:['Agent notification','SkyVialing prospect','Fee group']},
  registry:{name:'Admission Evaluation Agent',code:'AE',role:'Registry Processing',x:65,y:39,authority:'Review qualification and documents',tools:['Eligibility rules','Document review','Application record']},
  sac:{name:'SAC Agent',code:'SA',role:'Student Admission Committee',x:88,y:39,authority:'Prepare SAC and route outcome',tools:['SAC session','Candidate list','Form-01','Outcome routing']},
  ia:{name:'Internal Assessment Agent',code:'IA',role:'Internal Assessment',x:12,y:61,authority:'Coordinate IA evidence and outcome',tools:['Interview','Essay','Portfolio','IA result']},
  prerequisite:{name:'Prerequisite Agent',code:'PR',role:'Prerequisite Course',x:35,y:61,authority:'Coordinate prerequisite completion',tools:['Class plan','Moodle','Attendance','Result','Transcript']},
  offer:{name:'Offer & Acceptance Agent',code:'OA',role:'LOA / Acceptance',x:65,y:61,authority:'Issue approved offer and track acceptance',tools:['LOA','Acceptance signature','Student folder']},
  orientation:{name:'Orientation Agent',code:'OR',role:'Student Orientation',x:88,y:61,authority:'Invite, track attendance and follow-up',tools:['Invitation','Attendance','Feedback','Recording']},
  systems:{name:'Provisioning Agent',code:'SY',role:'IT / Library / Moodle',x:35,y:83,authority:'Coordinate student access setup',tools:['IUC email','e-Library','Moodle','Credential status']},
  handover:{name:'Academic Handover Agent',code:'AH',role:'Academic Handover',x:65,y:83,authority:'Verify readiness and transfer to Academic',tools:['Handover batch','Academic portal','Subject onboarding']}
};

var BASE_STATE={status:'IDLE',caseId:'—',task:'Waiting for event',event:'WAITING',lastAction:'No action yet',nextAction:'Wait for event',workload:0,waitingSince:'—'};
var state={};
Object.keys(AGENTS).forEach(function(k){state[k]=Object.assign({},BASE_STATE);});

function E(event,agent,task,action,verification,next,message,duration){
  return {kind:'event',event:event,agent:agent,task:task,action:action,verification:verification,next:next,message:message,duration:duration||900};
}
function H(event,from,to,task,message,next,duration){
  return {kind:'handoff',event:event,from:from,to:to,task:task,message:message,next:next,duration:duration||1800};
}
function X(event,from,recommendation,reason,next){
  return {kind:'human',event:event,from:from,to:'human',task:'Authority Review',recommendation:recommendation,reason:reason,next:next,message:'Human authority is required before the case can continue.',duration:1900};
}

var FLOWS={
  full:{
    label:'Full Admission Journey · IA + Prerequisite',
    caseId:'PHD-DEMO-2026-001',
    steps:[
      E('APPLICATION_RECEIVED','intake','Create applicant case','Validate submission and uploaded documents','Application record created','PROSPECT_ENTRY_REQUIRED','New application received.'),
      H('PROSPECT_ENTRY_REQUIRED','intake','marketing','Create SkyVialing Prospect','Application passed to the prospect and fee group stage.','PROSPECT_CREATED'),
      E('PROSPECT_CREATED','marketing','SkyVialing prospect & fee group','Track prospect entry and selected fee group','Prospect and fee group recorded','REGISTRY_REVIEW_REQUIRED','Marketing / agent stage completed.'),
      H('REGISTRY_REVIEW_REQUIRED','marketing','registry','Registry Processing','Prospect data and fee group handed to Registry.','APPLICATION_REVIEW'),
      E('APPLICATION_REVIEW','registry','Admission evaluation','Review qualification, documents and programme requirements','Registry review completed','SAC_REQUIRED','Application ready for SAC.'),
      H('SAC_REQUIRED','registry','sac','Prepare SAC Candidate','Registry handed the reviewed application to SAC.','SAC_REVIEW'),
      E('SAC_REVIEW','sac','SAC review','Prepare candidate list, evidence and proposed pathway','SAC outcome recorded: IA required','IA_REQUIRED','SAC routed the applicant to Internal Assessment.'),
      H('IA_REQUIRED','sac','ia','Internal Assessment','SAC outcome passed to IA Agent.','IA_IN_PROGRESS'),
      E('IA_IN_PROGRESS','ia','Internal Assessment','Coordinate interview / evidence and record result','IA result recorded: prerequisite required','PREREQUISITE_REQUIRED','IA completed and prerequisite is required.'),
      H('PREREQUISITE_REQUIRED','ia','prerequisite','Prerequisite Course','IA result handed to Prerequisite Agent.','PREREQUISITE_IN_PROGRESS'),
      E('PREREQUISITE_IN_PROGRESS','prerequisite','4-week prerequisite completion','Track classes, Moodle, attendance and assessment','Completion result and transcript ready','OFFER_READY','Prerequisite completed successfully.',1300),
      H('OFFER_READY','prerequisite','offer','Issue LOA','Completed prerequisite case passed to Offer & Acceptance.','LOA_ISSUE'),
      E('LOA_ISSUE','offer','Letter of Offer','Generate approved LOA and send to applicant','LOA issued and logged','ACCEPTANCE_PENDING','Offer issued.'),
      E('ACCEPTANCE_RECEIVED','offer','Acceptance processing','Record signed acceptance and timestamp','Acceptance PDF stored','ORIENTATION_READY','Applicant accepted the offer.',1100),
      H('ORIENTATION_READY','offer','orientation','Orientation','Accepted student handed to Orientation Agent.','ORIENTATION_PROCESS'),
      E('ORIENTATION_PROCESS','orientation','Orientation completion','Invite student, track attendance, feedback and recording','Orientation completion verified','PROVISIONING_REQUIRED','Orientation completed.',1300),
      H('PROVISIONING_REQUIRED','orientation','systems','Create Student Access','Orientation-complete student handed to Provisioning Agent.','PROVISIONING_IN_PROGRESS'),
      E('PROVISIONING_IN_PROGRESS','systems','IT / Library / Moodle provisioning','Coordinate IUC email, e-Library and Moodle access','Required access completed','ACADEMIC_HANDOVER_READY','Student access verified.',1300),
      H('ACADEMIC_HANDOVER_READY','systems','handover','Academic Handover','Provisioned student passed to Academic Handover.','HANDOVER_IN_PROGRESS'),
      E('HANDOVER_IN_PROGRESS','handover','Handover to Academic','Verify records and send student to Academic portal','Academic handover completed','JOURNEY_COMPLETE','Admission lifecycle completed.',1200)
    ]
  },
  direct:{
    label:'Direct Entry Route',
    caseId:'MBA-DEMO-2026-002',
    steps:[
      E('APPLICATION_RECEIVED','intake','Create applicant case','Validate submission','Application stored','PROSPECT_ENTRY_REQUIRED','New application received.'),
      H('PROSPECT_ENTRY_REQUIRED','intake','marketing','Create SkyVialing Prospect','Application passed to prospect entry.','PROSPECT_CREATED'),
      E('PROSPECT_CREATED','marketing','Prospect & fee group','Confirm prospect entry and fee group','Prospect stage complete','REGISTRY_REVIEW_REQUIRED','Prospect and fee group recorded.'),
      H('REGISTRY_REVIEW_REQUIRED','marketing','registry','Registry Processing','Case handed to Registry.','APPLICATION_REVIEW'),
      E('APPLICATION_REVIEW','registry','Admission evaluation','Verify qualification and documents','Review complete','SAC_REQUIRED','Case ready for SAC.'),
      H('SAC_REQUIRED','registry','sac','SAC Candidate','Reviewed case handed to SAC.','SAC_REVIEW'),
      E('SAC_REVIEW','sac','SAC review','Record formal outcome','Direct Entry approved','OFFER_READY','SAC outcome: Direct Entry.'),
      H('OFFER_READY','sac','offer','Issue LOA','Direct Entry case handed to Offer & Acceptance.','LOA_ISSUE'),
      E('LOA_ISSUE','offer','Letter of Offer','Issue approved LOA','LOA logged','ACCEPTANCE_PENDING','Offer issued.'),
      E('ACCEPTANCE_RECEIVED','offer','Acceptance processing','Store signed acceptance','Acceptance stored','ORIENTATION_READY','Acceptance received.'),
      H('ORIENTATION_READY','offer','orientation','Orientation','Accepted student handed to Orientation.','ORIENTATION_PROCESS'),
      E('ORIENTATION_PROCESS','orientation','Orientation completion','Complete attendance and follow-up','Orientation complete','PROVISIONING_REQUIRED','Orientation completed.'),
      H('PROVISIONING_REQUIRED','orientation','systems','Student Access','Send account setup tasks.','PROVISIONING_IN_PROGRESS'),
      E('PROVISIONING_IN_PROGRESS','systems','Provisioning','Complete IUC email, Library and Moodle','Access verified','ACADEMIC_HANDOVER_READY','Provisioning completed.'),
      H('ACADEMIC_HANDOVER_READY','systems','handover','Academic Handover','Pass ready student to Academic.','HANDOVER_IN_PROGRESS'),
      E('HANDOVER_IN_PROGRESS','handover','Academic handover','Verify and complete handover','Handover logged','JOURNEY_COMPLETE','Student handed to Academic.')
    ]
  },
  ia:{
    label:'IA Route · IA Sufficient',
    caseId:'MBA-DEMO-2026-003',
    steps:[
      E('SAC_REVIEW','sac','SAC review','Record IA pathway','IA required','IA_REQUIRED','SAC routed applicant to IA.'),
      H('IA_REQUIRED','sac','ia','Internal Assessment','IA case handed to IA Agent.','IA_IN_PROGRESS'),
      E('IA_IN_PROGRESS','ia','Internal Assessment','Complete evidence review and panel result','IA sufficient','OFFER_READY','IA outcome is sufficient.'),
      H('OFFER_READY','ia','offer','Issue LOA','Successful IA case passed to Offer & Acceptance.','LOA_ISSUE'),
      E('LOA_ISSUE','offer','Letter of Offer','Issue approved offer','LOA logged','ACCEPTANCE_PENDING','Offer issued after IA.')
    ]
  },
  prerequisite:{
    label:'IA → Prerequisite Route',
    caseId:'PHD-DEMO-2026-004',
    steps:[
      E('IA_IN_PROGRESS','ia','Internal Assessment','Complete IA and evaluate evidence','IA insufficient for direct progression','PREREQUISITE_REQUIRED','IA indicates prerequisite is required.'),
      H('PREREQUISITE_REQUIRED','ia','prerequisite','Prerequisite Course','IA case handed to Prerequisite Agent.','PREREQUISITE_IN_PROGRESS'),
      E('PREREQUISITE_IN_PROGRESS','prerequisite','Prerequisite completion','Track 4-week learning, assessment and results','Completion certificate and transcript ready','OFFER_READY','Prerequisite completed.'),
      H('OFFER_READY','prerequisite','offer','Issue LOA','Completed prerequisite case passed directly to offer stage.','LOA_ISSUE'),
      E('LOA_ISSUE','offer','Letter of Offer','Issue approved LOA','LOA issued','ACCEPTANCE_PENDING','Offer issued without returning to SAC.')
    ]
  },
  exception:{
    label:'Human Decision / Exception',
    caseId:'PHD-DEMO-2026-005',
    steps:[
      E('APPLICATION_REVIEW','registry','Eligibility review','Assess an ambiguous admission case','Evidence reviewed','HUMAN_DECISION_REQUIRED','Registry found a case requiring controlled judgement.'),
      X('HUMAN_DECISION_REQUIRED','registry','Refer applicant to IA','Qualification evidence is non-standard and requires Registrar authority before routing.','IA_REQUIRED'),
      H('IA_REQUIRED','orchestrator','ia','Internal Assessment','Approved human decision routed to IA Agent.','IA_IN_PROGRESS'),
      E('IA_IN_PROGRESS','ia','Internal Assessment','Continue the authorised IA route','IA task opened','WORKFLOW_CONTINUES','Case resumed after human approval.')
    ]
  }
};

var sim={running:false,paused:false,flow:'full',step:-1,token:0,currentAnimation:null,pendingHuman:null,metrics:{events:0,handovers:0}};
var refs={};

function $(id){return document.getElementById(id);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c];});}
function clock(){return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
function sleep(ms,token){
  return new Promise(function(resolve){
    var elapsed=0;
    function tick(){
      if(token!==sim.token){resolve();return;}
      if(sim.paused){setTimeout(tick,80);return;}
      var slice=Math.min(80,ms-elapsed);elapsed+=slice;
      if(elapsed>=ms){resolve();return;}
      setTimeout(tick,slice);
    }
    tick();
  });
}

function mount(){
  refs.stage=$('officeStage');refs.feed=$('activityFeed');
  renderDesks();
  populateFlows();
  bind();
  reset(false);
}

function renderDesks(){
  Object.keys(AGENTS).forEach(function(k){
    var a=AGENTS[k];
    var el=document.createElement('button');
    el.type='button';el.className='agent-desk';el.id='desk-'+k;el.dataset.agent=k;
    el.style.setProperty('--x',a.x+'%');el.style.setProperty('--y',a.y+'%');el.style.setProperty('--accent',k==='human'?'#ffc76a':(k==='orchestrator'?'#a17dff':'#57dcff'));
    el.innerHTML='<div class="desk-top"><div class="desk-avatar">'+esc(a.code)+'</div><div class="desk-copy"><b>'+esc(a.name)+'</b><small>'+esc(a.role)+'</small></div><span class="state-badge">IDLE</span></div><div class="desk-task">Waiting for structured event</div><div class="desk-case">No active case</div>';
    el.addEventListener('click',function(){openDrawer(k);});
    refs.stage.appendChild(el);
  });
}

function populateFlows(){
  var sel=$('scenarioSelect');
  Object.keys(FLOWS).forEach(function(k){
    var op=document.createElement('option');op.value=k;op.textContent=FLOWS[k].label;sel.appendChild(op);
  });
  sel.value=sim.flow;
}

function bind(){
  $('runBtn').addEventListener('click',run);
  $('pauseBtn').addEventListener('click',pause);
  $('resumeBtn').addEventListener('click',resume);
  $('resetBtn').addEventListener('click',function(){reset(true);});
  $('scenarioSelect').addEventListener('change',function(){sim.flow=this.value;reset(false);});
  $('connectBtn').addEventListener('click',connectLiveData);
  $('adminPassword').addEventListener('keydown',function(e){if(e.key==='Enter')connectLiveData();});
  $('drawerClose').addEventListener('click',closeDrawer);
  $('drawerBackdrop').addEventListener('click',closeDrawer);
}

function reset(logIt){
  sim.token++;sim.running=false;sim.paused=false;sim.step=-1;sim.pendingHuman=null;
  if(sim.currentAnimation){try{sim.currentAnimation.cancel();}catch(e){}sim.currentAnimation=null;}
  document.querySelectorAll('.avatar-runner').forEach(function(x){x.remove();});
  Object.keys(state).forEach(function(k){state[k]=Object.assign({},BASE_STATE);renderDesk(k);});
  updatePipeline(null);
  $('officeStateLabel').textContent='READY';$('activeCaseLabel').textContent='—';$('currentEventLabel').textContent='WAITING';
  $('runBtn').disabled=false;$('pauseBtn').disabled=true;$('resumeBtn').disabled=true;
  if(logIt)addLog('SYSTEM','—','RESET','Office state reset. No admission record was changed.');
}

function setAgent(k,patch){
  state[k]=Object.assign({},state[k],patch||{});
  renderDesk(k);
  if($('agentDrawer').classList.contains('open') && $('agentDrawer').dataset.agent===k)renderDrawer(k);
}
function renderDesk(k){
  var el=$('desk-'+k),s=state[k];if(!el)return;
  el.className='agent-desk '+String(s.status||'idle').toLowerCase();
  el.querySelector('.state-badge').textContent=s.status||'IDLE';
  el.querySelector('.desk-task').textContent=s.task||'Waiting for structured event';
  el.querySelector('.desk-case').textContent=s.caseId&&s.caseId!=='—'?(s.caseId+' · '+s.event):'No active case';
}

async function run(){
  if(sim.running)return;
  reset(false);
  sim.running=true;sim.token++;
  var token=sim.token,flow=FLOWS[sim.flow];
  $('officeStateLabel').textContent='RUNNING';$('activeCaseLabel').textContent=flow.caseId;
  $('runBtn').disabled=true;$('pauseBtn').disabled=false;
  addLog('AI Orchestrator',flow.caseId,'JOURNEY START','Running '+flow.label+'.');
  for(var i=0;i<flow.steps.length;i++){
    if(token!==sim.token)return;
    sim.step=i;
    while(sim.paused && token===sim.token){await new Promise(function(r){setTimeout(r,80);});}
    if(token!==sim.token)return;
    var step=flow.steps[i];
    updatePipeline(step);$('currentEventLabel').textContent=step.event;
    await execute(step,flow.caseId,token);
    if(token!==sim.token)return;
    if(step.kind==='human'){
      var decision=await waitHuman(token);
      if(token!==sim.token)return;
      if(decision!=='approve'){
        sim.running=false;sim.paused=false;$('officeStateLabel').textContent='CONTROLLED STOP';
        addLog('Human Decision Desk',flow.caseId,'WORKFLOW STOPPED',decision==='evidence'?'More evidence requested.':'Case returned for rework.');
        updateButtons();return;
      }
    }
    await sleep(360,token);
  }
  if(token!==sim.token)return;
  sim.running=false;sim.paused=false;$('officeStateLabel').textContent='COMPLETE';$('currentEventLabel').textContent='JOURNEY_COMPLETE';
  addLog('AI Orchestrator',flow.caseId,'JOURNEY COMPLETE','Workflow simulation completed.');
  Object.keys(state).forEach(function(k){if(k!=='human')setAgent(k,{status:'IDLE',task:'Waiting for event',nextAction:'Wait for event'});});
  updateButtons();
}

async function execute(step,caseId,token){
  sim.metrics.events++;
  if(step.kind==='event'){
    setAgent(step.agent,{status:'WORKING',caseId:caseId,task:step.task,event:step.event,lastAction:step.action,nextAction:step.next,workload:1,waitingSince:'—'});
    toast(step.event,step.message);addLog(AGENTS[step.agent].name,caseId,step.event,step.message);
    await sleep(step.duration||900,token);return;
  }
  if(step.kind==='handoff'){
    sim.metrics.handovers++;
    setAgent(step.from,{status:'HANDOVER',caseId:caseId,task:step.task,event:step.event,lastAction:'Handing task to '+AGENTS[step.to].name,nextAction:step.next});
    setAgent(step.to,{status:'RECEIVING',caseId:caseId,task:'Receiving '+step.task,event:step.event,lastAction:'Awaiting task handoff',nextAction:step.next});
    toast(step.event,step.message);addLog(AGENTS[step.from].name+' → '+AGENTS[step.to].name,caseId,step.event,step.message);
    await animateHandoff(step.from,step.to,caseId,step.task,token,step.duration);
    setAgent(step.from,{status:'IDLE',caseId:'—',task:'Waiting for event',event:'WAITING',lastAction:'Task handed off',nextAction:'Wait for event',workload:0});
    setAgent(step.to,{status:'WORKING',caseId:caseId,task:step.task,event:step.event,lastAction:'Task accepted',nextAction:step.next,workload:1});
    toast('TASK ACCEPTED',AGENTS[step.to].name+' accepted '+caseId);return;
  }
  if(step.kind==='human'){
    sim.metrics.handovers++;
    setAgent(step.from,{status:'ESCALATION',caseId:caseId,task:step.task,event:step.event,lastAction:'Escalated for human authority',nextAction:'Wait for decision'});
    setAgent('human',{status:'RECEIVING',caseId:caseId,task:'Review AI recommendation',event:step.event,lastAction:'Case received',nextAction:'Approve / Return / Request Evidence',workload:1});
    toast(step.event,'Human authority required');addLog(AGENTS[step.from].name+' → Human Decision Desk',caseId,step.event,step.message);
    await animateHandoff(step.from,'human',caseId,'Authority Review',token,step.duration);
    setAgent(step.from,{status:'WAITING',waitingSince:clock(),nextAction:'Wait for human decision'});
    setAgent('human',{status:'WORKING',caseId:caseId,task:'Decision: '+step.recommendation,event:step.event,lastAction:step.reason,nextAction:'Record decision'});
    sim.paused=true;showHumanDecision(caseId,step);updateButtons();
  }
}

function animateHandoff(from,to,caseId,label,token,duration){
  return new Promise(function(resolve){
    var stage=refs.stage,src=$('desk-'+from),dst=$('desk-'+to);
    if(!stage||!src||!dst||window.matchMedia('(prefers-reduced-motion: reduce)').matches){resolve();return;}
    var sr=src.getBoundingClientRect(),dr=dst.getBoundingClientRect(),br=stage.getBoundingClientRect();
    var sx=sr.left-br.left+sr.width/2,sy=sr.top-br.top+sr.height/2,tx=dr.left-br.left+dr.width/2,ty=dr.top-br.top+dr.height/2;
    var centerX=br.width*.5;
    var runner=document.createElement('div');runner.className='avatar-runner';runner.style.left=sx+'px';runner.style.top=sy+'px';
    runner.innerHTML='<div class="avatar-bot"><div class="head"></div><div class="body" data-code="'+esc(AGENTS[from].code)+'"></div><div class="leg l"></div><div class="leg r"></div><div class="task-orb">◆</div></div><div class="runner-label">'+esc(caseId)+' · '+esc(label)+'</div>';
    stage.appendChild(runner);
    var dx=tx-sx,dy=ty-sy,cx=centerX-sx;
    var frames=[
      {transform:'translate(-50%,-50%) translate(0px,0px)'},
      {transform:'translate(-50%,-50%) translate('+cx+'px,0px)',offset:.32},
      {transform:'translate(-50%,-50%) translate('+cx+'px,'+dy+'px)',offset:.68},
      {transform:'translate(-50%,-50%) translate('+dx+'px,'+dy+'px)'}
    ];
    var anim=runner.animate(frames,{duration:duration||1800,easing:'cubic-bezier(.35,.05,.17,1)',fill:'forwards'});
    sim.currentAnimation=anim;if(sim.paused)anim.pause();
    anim.onfinish=function(){runner.remove();sim.currentAnimation=null;resolve();};
    anim.oncancel=function(){runner.remove();sim.currentAnimation=null;resolve();};
  });
}

function pause(){if(!sim.running||sim.paused)return;sim.paused=true;if(sim.currentAnimation)sim.currentAnimation.pause();$('officeStateLabel').textContent='PAUSED';updateButtons();}
function resume(){if(!sim.running||!sim.paused||sim.pendingHuman)return;sim.paused=false;if(sim.currentAnimation)sim.currentAnimation.play();$('officeStateLabel').textContent='RUNNING';updateButtons();}
function updateButtons(){
  $('runBtn').disabled=sim.running;
  $('pauseBtn').disabled=!sim.running||sim.paused;
  $('resumeBtn').disabled=!sim.running||!sim.paused||!!sim.pendingHuman;
}

function waitHuman(token){
  return new Promise(function(resolve){
    if(token!==sim.token){resolve('cancelled');return;}
    sim.pendingHuman=resolve;updateButtons();
  });
}
function showHumanDecision(caseId,step){
  openDrawer('human');
  var grid=$('drawerGrid');
  grid.innerHTML='<div class="wide"><small>Case</small><b>'+esc(caseId)+'</b></div>'+
    '<div class="wide"><small>AI Recommendation</small><b>'+esc(step.recommendation)+'</b></div>'+
    '<div class="wide"><small>Reason</small><b>'+esc(step.reason)+'</b></div>'+
    '<div class="wide"><small>Authority Action</small><b><button class="primary-btn" id="hdApprove">Approve</button> <button class="control-btn" id="hdReturn">Return</button> <button class="control-btn" id="hdEvidence">Request Evidence</button></b></div>';
  $('hdApprove').onclick=function(){recordHuman('approve');};
  $('hdReturn').onclick=function(){recordHuman('return');};
  $('hdEvidence').onclick=function(){recordHuman('evidence');};
}
function recordHuman(decision){
  if(!sim.pendingHuman)return;
  var flow=FLOWS[sim.flow],labels={approve:'APPROVED',return:'RETURNED',evidence:'MORE EVIDENCE'};
  addLog('Human Decision Desk',flow.caseId,'HUMAN DECISION · '+labels[decision],decision==='approve'?'Approved AI recommendation.':decision==='return'?'Returned case for rework.':'Requested more evidence.');
  setAgent('human',{status:'IDLE',caseId:'—',task:'Waiting for escalation',event:'WAITING',workload:0,lastAction:labels[decision],nextAction:'Wait for escalation'});
  closeDrawer();
  var resolve=sim.pendingHuman;sim.pendingHuman=null;sim.paused=false;$('officeStateLabel').textContent=decision==='approve'?'RUNNING':'CONTROLLED STOP';updateButtons();resolve(decision);
}

function updatePipeline(step){
  var values=step?{
    event:step.event||'—',
    task:step.task||'—',
    agent:step.agent?AGENTS[step.agent].name:(step.from?AGENTS[step.from].name:'—'),
    action:step.action||(step.kind==='handoff'?'Transfer task to '+AGENTS[step.to].name:'—'),
    verification:step.verification||(step.kind==='handoff'?'Receiving agent accepts task':'—'),
    next:step.next||'—'
  }:{event:'Waiting',task:'—',agent:'—',action:'—',verification:'—',next:'—'};
  Object.keys(values).forEach(function(k){var el=document.querySelector('[data-pipe="'+k+'"]');if(el)el.textContent=values[k];});
}

function toast(event,message){
  var el=$('handoffToast');el.classList.remove('show');void el.offsetWidth;
  el.innerHTML='<small>'+esc(event)+'</small><b>'+esc(message)+'</b>';el.classList.add('show');
  setTimeout(function(){el.classList.remove('show');},1900);
}
function addLog(actor,caseId,event,message){
  var empty=refs.feed.querySelector('.empty-feed');if(empty)empty.remove();
  var row=document.createElement('div');row.className='feed-row';
  row.innerHTML='<time>'+esc(clock())+'</time><div><b>'+esc(actor)+'</b><div class="feed-event">'+esc(event)+'</div></div><p>'+esc(caseId)+' · '+esc(message)+'</p>';
  refs.feed.prepend(row);while(refs.feed.children.length>40)refs.feed.lastElementChild.remove();
}

function openDrawer(k){
  $('agentDrawer').dataset.agent=k;$('agentDrawer').classList.add('open');$('agentDrawer').setAttribute('aria-hidden','false');$('drawerBackdrop').classList.add('open');renderDrawer(k);
}
function closeDrawer(){
  $('agentDrawer').classList.remove('open');$('agentDrawer').setAttribute('aria-hidden','true');$('drawerBackdrop').classList.remove('open');
}
function renderDrawer(k){
  var a=AGENTS[k],s=state[k];if(!a)return;
  $('drawerAvatar').textContent=a.code;$('drawerRole').textContent=a.role;$('drawerName').textContent=a.name;$('drawerStatus').textContent=s.status;
  $('drawerGrid').innerHTML=
    drawerCard('Current Case',s.caseId)+drawerCard('Current Task',s.task)+drawerCard('Current Event',s.event)+drawerCard('Workload',String(s.workload)+' queued')+
    drawerCard('Last Action',s.lastAction,'wide')+drawerCard('Next Action',s.nextAction,'wide')+drawerCard('Authority',a.authority,'wide')+drawerCard('Tools',a.tools.join(' · '),'wide');
}
function drawerCard(label,value,cls){
  return '<div class="'+(cls||'')+'"><small>'+esc(label)+'</small><b>'+esc(value||'—')+'</b></div>';
}

function countRows(data,key){return Array.isArray(data&&data[key])?data[key].length:0;}
async function connectLiveData(){
  var password=$('adminPassword').value.trim();if(!password){toast('LIVE DATA','Enter the admin password first.');return;}
  var btn=$('connectBtn');btn.disabled=true;btn.textContent='Connecting…';
  try{
    var response=await fetch('/api/admin-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:password})});
    var payload=await response.json();
    if(!response.ok||!payload.ok)throw new Error(payload.message||'Unable to connect');
    var d=payload.data||{};
    $('metricApplications').textContent=countRows(d,'V2_APPLICATIONS');
    $('metricWorkflow').textContent=countRows(d,'V2_WORKFLOW');
    $('metricSac').textContent=countRows(d,'V2_SAC_CANDIDATES');
    $('metricIa').textContent=countRows(d,'V2_ASSESSMENT_PROGRESS');
    $('metricOrientation').textContent=countRows(d,'V2_ORIENTATION_TRACKING');
    $('metricProvisioning').textContent=countRows(d,'V2_PROVISIONING');
    $('metricHandover').textContent=countRows(d,'V2_ACADEMIC_PORTAL');
    $('dataMode').innerHTML='<i></i> Live Admission Data Connected';
    toast('LIVE DATA CONNECTED','Operational counts loaded from Admission V2.');
    addLog('System','LIVE','DATA_CONNECTED','Admission V2 operational data connected. Visual handoffs remain controlled simulations until the event bus is connected.');
    $('adminPassword').value='';
  }catch(err){
    toast('CONNECTION FAILED',err.message||'Unable to connect to live data.');
  }finally{
    btn.disabled=false;btn.textContent='Connect Live Data';
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();