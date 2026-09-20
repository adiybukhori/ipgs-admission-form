(function guideTrainingV2(){
const L1='https://lh3.googleusercontent.com/d/135uWJ59t0Gs5fey1Ef7548V-HBWsOiCk=s1000',L2='https://lh3.googleusercontent.com/d/1iKsYwAVivYw9uRl2kLzt0LcKK7CAJPvd=s1000';
const steps=[
[1,'master','Application Submitted','Student','Applications','Submit Admission Form + documents','Application record + Reference No'],
[2,'master','SKY Prospect & Fee Group','Academic Consultant / Marketing','Prospect / Activation','Create SKY Prospect + select ACTIVE Fee Group','Prospect Done'],
[3,'admission','Document Review','Registry','Applications','Verify required documents','Document Review complete'],
[4,'admission','Qualification Screening','Registry','Applications','Review field / experience','Screening recommendation'],
[5,'admission','SAC Review','SAC / Registry','SAC','Record authorised admission outcome','Direct Entry · IA · Rejected'],
[6,'admission','IA / PREREQ','Registry / Academic','IA / PREREQ','IA first; PREREQ only when required','Assessment route complete'],
[7,'admission','Offer','Registry','Applications','Issue Official Offer Letter','Offer PDF + timestamp'],
[8,'admission','Electronic Acceptance','Student','Applications','Sign Acceptance electronically','Signed Acceptance'],
[9,'ops','SKY Activation','Registry','Prospect / Activation','Activate / register in SKY','Active in SKY Done'],
[10,'ops','Orientation Setup','Registry','Orientation','Create session → add students → send invitation','Orientation roster + invitation'],
[11,'ops','Attendance & Feedback','Registry / Student','Orientation','Open attendance → confirm → feedback','Attendance + feedback evidence'],
[12,'ops','Recording & Completion','Registry','Orientation','End session → recording → complete','Official Orientation report'],
[13,'handover','Academic Handover','Registry','Academic Handover','Create handover → add students → Handover Now','Academic / PIC handover'],
[14,'handover','Provisioning','IT / Moodle / e-Library','Academic Handover','Complete all required accounts','Provisioning complete'],
[15,'handover','Student Access','Registry','Academic Handover','Send final access communication','Operational onboarding complete']
];
const phases={master:['Master & Intake','purple','01–02'],admission:['Admission Decision','blue','03–08'],ops:['Operational Workstreams','amber','09–12'],handover:['Provisioning & Completion','green','13–15']};
const slides=[
['SYSTEM OVERVIEW','Admission Command Center','One operational workspace for the postgraduate admission journey',0,'overview','dashboard',['Move between operational modules from the sidebar.','Main pages monitor; detailed views process.','Refresh after actions when the latest status has not appeared.']],
['STUDENT JOURNEY','From Application to Active Student','See the student move across the full ACC journey',0,'journey','applications',['Formal admission decisions and operational workstreams are different layers.','Orientation and Academic Handover are separate workstreams; neither should be drawn as a child of the other.','Student Access closes the Academic Handover workstream.']],
['APPLICATIONS','Monitor New Applications','Search, filter and open the student record',1,'apps','applications',['Reference No is the primary internal identifier.','The list shows programme, intake and current stage.','Open the applicant to process the next action.']],
['APPLICATION DETAIL','Process the Applicant','Operational Action Center + progress tracker + controlled tabs',3,'appdetail','applications',['Operational Action Center tells staff what happens next.','Journey tracker shows completed/current stages.','Tabs keep all controlled evidence in one record.']],
['SAC','Formal Admission Decision','Create session, assign candidates and record the authorised outcome',5,'sac','sac',['Assign only eligible candidates.','Retain the controlled SAC pack.','Record Direct Entry, IA or Rejected / Not Qualified.']],
['IA / PREREQ','Assessment Route','IA first; prerequisite only where authorised',6,'assessment','assessment',['IA and PREREQ are monitored separately.','PREREQ follows IA where required.','Completion returns the candidate to the approved route.']],
['PROSPECT / ACTIVATION','SKY Prospect & Registry Activation','Marketing creates the Prospect; Registry records activation',9,'prospect','activation',['Consultant enters SKY Prospect ID.','Fee Group comes from ACTIVE Fee Structure Master.','Registry records SKY Student / Registration ID.']],
['ORIENTATION','Monitor Orientation Sessions','Main page = monitoring',10,'orilist','orientation',['Rows show students, stage and status.','Use View Session to process.','Create Session, Add Students and Send Invitation are separate actions.']],
['ORIENTATION · VIEW SESSION','Process the Orientation Session','Students · Communication · Attendance · Feedback · Recording · Completion',11,'oridetail','orientation',['Next action is displayed at the top.','Attendance and feedback stay in the same session context.','Completion locks the record and generates the official report.']],
['ACADEMIC HANDOVER','Monitor Handover Sessions','Main page = monitoring',13,'holist','handover',['Create the Handover Session first.','Student count and stage show where the batch is.','Use View Handover to process.']],
['ACADEMIC HANDOVER · DETAIL','Provisioning & Student Access','A separate operational module from Orientation',14,'hodetail','handover',['Handover Now sends controlled communication.','Monitor IT, Moodle and e-Library provisioning.','Send Student Access after provisioning is complete.']],
['MASTER DATA','Fee Structure Master','Single source for agent Fee Group selection',2,'fee','feeStructure',['Scope by Programme, Level, Study Mode and Intake.','Payment Schedule records the approved payment sequence.','Only ACTIVE structures with an accessible PDF appear to agents.']],
['AI OPERATIONS CENTER','Agentic Control Room','Live workload visibility today; autonomous execution later',0,'ai','ai',['Registrar Office Agent is the supervisory layer.','NOT ACTIVATED agents cannot execute autonomously.','Future focus: exceptions, approvals, communication and performance.']],
['OPERATING CONTROLS','Rules Staff Must Remember','Consistency and auditability depend on these controls',0,'rules','guide',['SAC remains the authorised admission decision.','Do not invent Fee Groups outside the master.','Add Students does not send an Orientation invitation.','Orientation and Handover remain separate records.','Use audit/revision controls for completed records.']],
['TRAINING SUMMARY','How Staff Should Use ACC','Monitor → Open → Act → Audit',15,'summary','dashboard',['Start with system status, not assumptions.','Use the Operational Action Center for the next step.','Use Activity / audit history to reconstruct a case.','Run controlled UAT after material system changes.']]
];
let mode='sop',idx=0;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const cnt=k=>Array.isArray(window.db&&db[k])?db[k].length:0;
const sn=()=> 'TRAINING STUDENT A', ref=()=> 'IUC-ADM-V2-TRAINING-001';
function side(a){return '<aside class="g2-side"><b>IUC · IPGS<br>ACC</b>'+[['dashboard','Dashboard'],['applications','Applications'],['sac','SAC'],['assessment','IA / PREREQ'],['activation','Prospect / Activation'],['orientation','Orientation'],['handover','Academic Handover'],['feeStructure','Fee Structure']].map(x=>'<span class="'+(x[0]===a?'on':'')+'">'+x[1]+'</span>').join('')+'</aside>'}
function hot(n,x,y,t){return '<i class="g2-hot" style="left:'+x+'%;top:'+y+'%" title="'+esc(t)+'">'+n+'</i>'}
function frame(a,b,h=''){return '<div class="g2-screen">'+side(a)+'<main><header><b>'+esc(a==='feeStructure'?'Fee Structure':a==='handover'?'Academic Handover':a==='orientation'?'Orientation':a==='activation'?'Prospect / Activation':a==='assessment'?'IA / PREREQ':a==='sac'?'SAC':a==='dashboard'?'Dashboard':'Applications')+'</b><span>Refresh</span></header><section>'+b+'</section></main>'+h+'</div>'}
function badge(t,c='purple'){return '<span class="g2-b '+c+'">'+esc(t)+'</span>'}
function modal(title,sub,inner){return '<div class="g2-modal"><div class="g2-mhead"><div><h4>'+esc(title)+'</h4><small>'+esc(sub)+'</small></div><button>Close</button></div>'+inner+'</div>'}
function oac(title,text,state='IN PROGRESS'){return '<div class="g2-oac"><div><small>Operational Action Center</small><b>'+esc(title)+'</b><span>'+esc(text)+'</span></div>'+badge(state,state==='IN PROGRESS'?'green':'purple')+'</div>'}
function stepper(items,active){return '<div class="g2-stepper">'+items.map((x,i)=>'<div class="'+(i<active?'done':i===active?'active':'')+'"><i>'+(i<active?'✓':i+1)+'</i><small>'+esc(x)+'</small></div>').join('')+'</div>'}
function preview(t){
if(t==='overview')return frame('dashboard','<div class="g2-kpis"><div><small>Total Applications</small><b>'+cnt('V2_APPLICATIONS')+'</b></div><div><small>Orientation Sessions</small><b>'+cnt('V2_ORIENTATION_SESSIONS')+'</b></div><div><small>Handover Sessions</small><b>'+cnt('V2_HANDOVER_BATCHES')+'</b></div></div><div class="g2-card"><b>Active Workload</b><p>New Applications <em>Review</em></p><p>Qualification / SAC <em>Process</em></p><p>Orientation <em>Monitor</em></p></div>',hot(1,10,34,'Sidebar')+hot(2,52,30,'KPIs')+hot(3,88,15,'Refresh'));
if(t==='journey')return '<div class="g2-journey">'+Object.keys(phases).map(k=>'<div class="'+phases[k][1]+'"><header><b>'+phases[k][0]+'</b><span>'+phases[k][2]+'</span></header><section>'+steps.filter(s=>s[1]===k).map(s=>'<article><em>'+s[0]+'</em><b>'+s[2]+'</b><small>'+s[3]+'</small></article>').join('<i>→</i>')+'</section></div>').join('<strong>↓</strong>')+'</div>';
if(t==='apps')return frame('applications','<div class="g2-tools"><input value="Search applicant..." readonly><button>Programme</button><button>Intake</button></div><div class="g2-table"><div class="head">Student | Programme | Intake | Stage |</div><div><b>'+sn()+'</b><small>'+ref()+'</small><span>PhD - Doctor of Philosophy in Management</span><span>January 2027</span>'+badge('OFFER ISSUED','amber')+'<button>Open</button></div><div><b>TRAINING STUDENT B</b><small>IUC-ADM-V2-TRAINING-002</small><span>MBA</span><span>September 2026</span>'+badge('SAC REVIEW')+'<button>Open</button></div></div>',hot(1,42,26,'Search/filter')+hot(2,70,52,'Current stage')+hot(3,90,52,'Open record'));
if(t==='appdetail')return frame('applications',modal(sn(),ref()+' · PhD · January 2027',oac('Offer has been issued','Monitor Acceptance status and signed PDF.','OFFER ISSUED')+stepper(['Application','Documents','Screening','SAC','IA / PREREQ','Offer Ready','Offer','Accepted'],6)+'<div class="g2-tabs">Overview · Documents · Screening · SAC / Assessment · Offer & Acceptance · Activity</div><div class="g2-two"><div><b>Application</b><small>'+ref()+'</small></div><div><b>Programme</b><small>PhD - Doctor of Philosophy in Management</small></div></div>'),hot(1,52,28,'Next action')+hot(2,52,47,'Progress')+hot(3,58,63,'Tabs'));
if(t==='sac')return frame('sac','<div class="g2-title"><div><b>SAC Sessions</b><small>Admissions decision control</small></div><button>+ Create SAC Session</button></div><div class="g2-table"><div class="head">Session | Candidates | Status | Pack |</div><div><b>SAC September-2-26</b><small>SAC-202609-02</small><span>6</span>'+badge('OPEN','blue')+'<span>PG-ADM-01 ready</span><button>View Session</button></div></div><div class="g2-decisions"><span>Direct Entry</span><span>Internal Assessment</span><span>Rejected / Not Qualified</span></div>',hot(1,80,22,'Create session')+hot(2,90,48,'View session')+hot(3,55,77,'Decision options'));
if(t==='assessment')return frame('assessment','<div class="g2-tabs">Internal Assessment · Prerequisite</div><div class="g2-table"><div class="head">Student | Route | Status | Outcome |</div><div><b>'+sn()+'</b><small>'+ref()+'</small><span>Internal Assessment</span>'+badge('IN PROGRESS','amber')+'<span>Pending panel outcome</span><button>Open</button></div><div><b>TRAINING STUDENT B</b><small>IUC-ADM-V2-TRAINING-002</small><span>Prerequisite</span>'+badge('ENROLLED')+'<span>2 subjects</span><button>Open</button></div></div><div class="g2-note">IA first. PREREQ only when the authorised IA route requires it.</div>',hot(1,31,25,'IA / PREREQ view')+hot(2,65,48,'Status')+hot(3,52,78,'Route reminder'));
if(t==='prospect')return frame('activation','<div class="g2-kpis"><div><small>Prospect Pending</small><b>4</b></div><div><small>Prospect Done</small><b>12</b></div><div><small>Active in SKY</small><b>8</b></div></div><div class="g2-table"><div class="head">Student | SKY Prospect | Fee Group | Activation</div><div><b>'+sn()+'</b><small>'+ref()+'</small>'+badge('DONE','green')+'<span>MBA-15000</span><button>Active in SKY Done</button></div></div>',hot(1,49,31,'Prospect')+hot(2,67,54,'Fee Group')+hot(3,88,54,'Registry action'));
if(t==='orilist')return frame('orientation','<div class="g2-title"><div><b>Orientation Sessions</b><small>Monitor session stage and status</small></div><button>+ Create Orientation Session</button></div><div class="g2-table"><div class="head">Session | Date | Students | Stage | Status |</div><div><b>Orientation Session | September 2026</b><small>ORI-20260926-TRAIN</small><span>26 Sep · 08:30</span><span>3 · 3 attended</span>'+badge('Attendance Review')+badge('ACTION REQUIRED','amber')+'<button>View Session</button></div></div>',hot(1,80,23,'Create session')+hot(2,68,52,'Current stage')+hot(3,91,52,'View Session'));
if(t==='oridetail')return frame('orientation',modal('Orientation Session | September 2026','ORI-20260926-TRAIN · Sep-2026 · MHUM & PhD',oac('Close attendance','Session ended but student self check-in is still open.')+stepper(['Setup','Students','Invitation','Session','Attendance','Recording','Complete'],4)+'<div class="g2-tabs">Overview · Students · Communication · Attendance & Feedback · Recording & Completion · Activity</div><div class="g2-two"><div><b>Session Summary</b><small>3 assigned · 3 invited · 3 attended</small></div><div><b>Feedback</b><small>3 submitted</small></div></div>'),hot(1,51,29,'Next action')+hot(2,52,48,'Journey')+hot(3,67,64,'Session tabs'));
if(t==='holist')return frame('handover','<div class="g2-title"><div><b>Academic Handover Sessions</b><small>Monitor each handover batch</small></div><button>+ Create Handover Session</button></div><div class="g2-table"><div class="head">Handover | Students | Stage | Status |</div><div><b>Academic Handover · Sep 2026 Batch 1</b><small>HO-202609-TRAIN</small><span>4 · 2 provisioned</span>'+badge('Provisioning')+badge('IN PROGRESS')+'<button>View Handover</button></div></div>',hot(1,80,23,'Create handover')+hot(2,63,52,'Current stage')+hot(3,90,52,'View Handover'));
if(t==='hodetail')return frame('handover',modal('Academic Handover · Sep 2026 Batch 1','HO-202609-TRAIN · September 2026',oac('Complete provisioning','2 of 4 students completed IT, Moodle and e-Library.')+stepper(['Setup','Students','Handover','Provisioning','Student Access','Complete'],3)+'<div class="g2-tabs">Overview · Students · Handover & Communication · Provisioning · Student Access · Activity</div><div class="g2-kpis"><div><small>IT</small><b>3 / 4</b></div><div><small>Moodle</small><b>2 / 4</b></div><div><small>e-Library</small><b>2 / 4</b></div></div>'),hot(1,51,29,'Next action')+hot(2,52,48,'Journey')+hot(3,60,65,'Provisioning'));
if(t==='fee')return frame('feeStructure','<div class="g2-kpis"><div><small>Total</small><b>'+cnt('FEE_GROUP_MASTER')+'</b></div><div><small>Active for Agent</small><b>4</b></div><div><small>PDF Ready</small><b>4</b></div></div><div class="g2-title"><div><b>Fee Structure Master</b><small>ACTIVE Fee Groups become selectable</small></div><button>+ Add Fee Structure</button></div><div class="g2-table"><div class="head">Fee Group | Scope | Total | Payment | Status |</div><div><b>MBA-15000</b><small>MBA Standard Fee 2026</small><span>MBA · Part-Time · September 2026</span><span>RM15,000</span><span>6 items</span>'+badge('ACTIVE','green')+'<button>View</button></div></div>',hot(1,80,38,'Add structure')+hot(2,64,64,'Payment')+hot(3,80,64,'Agent status'));
if(t==='ai')return frame('dashboard','<div class="g2-ai"><small>IPGS AGENTIC OPERATIONS</small><h4>🤖 AI Operations Center</h4><span>Monitoring & orchestration shell</span></div><div class="g2-org"><div><b>Registrar Office Agent</b><small>Supervisory · NOT ACTIVATED</small></div><i>↓</i><section><span>Admission Intake</span><span>Admission Evaluation</span><span>IA Agent</span><span>Prerequisite Agent</span><span>Orientation Agent</span></section></div>',hot(1,55,38,'Supervisory agent')+hot(2,55,63,'Operational agents'));
if(t==='rules')return '<div class="g2-rules">'+[['SAC','Authorised decision'],['IA / PREREQ','PREREQ follows IA'],['Fee Group','Use master only'],['Orientation','Add Students ≠ Send Invitation'],['Handover','Separate from Orientation'],['Completion','Use audit / revision']].map((x,i)=>'<div><em>0'+(i+1)+'</em><b>'+x[0]+'</b><span>'+x[1]+'</span></div>').join('')+'</div>';
return '<div class="g2-summary"><b>MONITOR</b><i>→</i><b>OPEN</b><i>→</i><b>ACT</b><i>→</i><b>AUDIT</b></div>';
}
function ribbon(n){const a=[[1,'Apply'],[3,'Review'],[5,'SAC'],[7,'Offer'],[8,'Accept'],[9,'SKY'],[10,'Orientation'],[13,'Handover'],[14,'Provision'],[15,'Access']];return '<div class="g2-ribbon">'+a.map((x,i)=>'<span class="'+(n>x[0]?'done':n===x[0]?'active':'')+'"><i>'+(n>x[0]?'✓':i+1)+'</i><b>'+x[1]+'</b></span>'+(i<a.length-1?'<em>→</em>':'')).join('')+'</div>'}
function moduleKey(s){const x=String(s).toLowerCase();if(x.includes('prospect'))return'activation';if(x.includes('orientation'))return'orientation';if(x.includes('handover'))return'handover';if(x.includes('fee'))return'feeStructure';if(x.includes('ia'))return'assessment';if(x==='sac')return'sac';return'applications'}
window.guideOpenModule=function(k){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});if(k==='ai'){location.href='/ai-operations-center.html';return}const b=document.querySelector('.nav button[data-section="'+k+'"]');if(k==='orientation'&&window.goOrientation)return goOrientation(b);if(k==='handover'&&window.goHandover)return goHandover(b);if(k==='activation'&&window.goActivation)return goActivation(b);if(window.go)return go(k,b)};
const flowV3={
  master:[
    {id:'consultants',no:'M1',title:'Academic Consultant Master',owner:'Admin',module:'Academic Consultants',trigger:'Before referral / application operations',action:'Maintain active consultant records and unique referral attribution.',output:'Valid consultant identity + referral link',next:'Application / Prospect operations',moduleKey:'applications'},
    {id:'fees',no:'M2',title:'Fee Structure Master',owner:'Registry / Bursary Control',module:'Fee Structure',trigger:'Before agent Fee Group selection',action:'Maintain Programme, Level, Study Mode, Intake, fee components, payment schedule and approved PDF.',output:'ACTIVE selectable Fee Groups',next:'Consultant Fee Group selection',moduleKey:'feeStructure'}
  ],
  intake:[
    {id:'application',no:'01',title:'Application Submitted',owner:'Student + System',module:'Applications',trigger:'Student submits online Admission Form',action:'Capture applicant data and required uploads. System creates Reference No, student folder, Admission Form PDF, workflow record and acknowledgement.',output:'Controlled application record',next:'Admission review + consultant Prospect task',moduleKey:'applications'},
    {id:'prospect',no:'P1',title:'Consultant Creates SKY Prospect',owner:'Academic Consultant / Marketing',module:'Prospect / Activation',trigger:'New-application notification received',action:'Create Prospect in SKY, return to the action page, enter SKY Prospect ID, select the applicable ACTIVE Fee Group and mark Prospect Done.',output:'Prospect Done + SKY Prospect ID + Fee Group',next:'Registry SKY Activation track',moduleKey:'activation'}
  ],
  admission:[
    {id:'documents',no:'02',title:'Document Review',owner:'Registry',module:'Applications → Documents',trigger:'Application available for Registry review',action:'Verify uploaded admission documents and controlled checklist evidence. Regenerate PG-ADM-01 only when a refreshed controlled copy is required.',output:'Document Review completed',next:'Qualification Screening',moduleKey:'applications'},
    {id:'screening',no:'03',title:'Qualification Screening',owner:'Registry',module:'Applications → Screening',trigger:'Document review completed / sufficient for screening',action:'Review academic field relationship and relevant experience where applicable. AI/document screening may assist, but does not make the authorised decision.',output:'Screening recommendation',next:'SAC',moduleKey:'applications'},
    {id:'sac',no:'04',title:'SAC Review',owner:'Registry + SAC',module:'SAC',trigger:'Candidate ready for formal decision',action:'Create/select SAC session, assign candidate, prepare controlled SAC pack and record the authorised result.',output:'Direct Entry · Internal Assessment · Rejected / Not Qualified',next:'Branch by SAC result',moduleKey:'sac'},
    {id:'ia',no:'05A',title:'Internal Assessment',owner:'Registry / Academic',module:'IA / PREREQ',trigger:'SAC result = Internal Assessment',action:'Run and record the approved IA process and outcome.',output:'IA sufficient OR prerequisite required',next:'Offer route or PREREQ',moduleKey:'assessment'},
    {id:'prereq',no:'05B',title:'Prerequisite Course',owner:'Registry / Academic',module:'IA / PREREQ',trigger:'Authorised IA outcome requires prerequisite',action:'Enrol, monitor and complete the approved prerequisite subjects. PREREQ is never selected directly as the SAC result.',output:'Prerequisite completion evidence',next:'Return to Offer eligibility',moduleKey:'assessment'},
    {id:'offer',no:'06',title:'Official Offer',owner:'Registry',module:'Applications → Offer & Acceptance',trigger:'Approved admission route completed and case eligible',action:'Generate and send the Official Offer Letter. Store issue status, PDF and timestamp.',output:'Offer issued',next:'Electronic Acceptance',moduleKey:'applications'},
    {id:'acceptance',no:'07',title:'Electronic Acceptance',owner:'Student + System',module:'Applications → Offer & Acceptance',trigger:'Offer issued',action:'Student opens the Acceptance link and signs electronically. System stores the signed record and timestamp.',output:'Acceptance received / admission confirmed',next:'Post-admission operational workstreams',moduleKey:'applications'},
    {id:'rejected',no:'X',title:'Rejected / Not Qualified',owner:'SAC / Registry',module:'Applications',trigger:'SAC result = Rejected / Not Qualified',action:'Record the authorised decision and close the admission route in accordance with the controlled process.',output:'Admission route closed',next:'No Offer',moduleKey:'applications'}
  ],
  activation:[
    {id:'activation',no:'A1',title:'Registry SKY Activation',owner:'Registry',module:'Prospect / Activation',trigger:'Consultant Prospect task is complete and Registry is ready to activate',action:'Confirm Prospect Done, activate/register the student in SKY and record Student ID / Registration No. when available.',output:'Active in SKY Done',next:'Operational SKY status complete',moduleKey:'activation'}
  ],
  orientation:[
    {id:'ori-session',no:'O1',title:'Create Session & Add Students',owner:'Registry',module:'Orientation',trigger:'Registry schedules an Orientation session',action:'Create session, open View Session and Add Students. Adding students does not send invitation automatically.',output:'Orientation roster prepared',next:'Send Invitation',moduleKey:'orientation'},
    {id:'ori-invite',no:'O2',title:'Invitation & Reminder',owner:'Registry / System',module:'Orientation → Communication',trigger:'Roster reviewed',action:'Explicitly Send Invitation. Reminders apply only to students whose invitation has been sent.',output:'Invitation communication recorded',next:'Run Session',moduleKey:'orientation'},
    {id:'ori-attendance',no:'O3',title:'Attendance & Feedback',owner:'Registry + Student',module:'Orientation → Attendance & Feedback',trigger:'During the Orientation session',action:'Registry opens attendance. Student confirms through personal link or QR and completes feedback. Staff closes attendance manually and may resolve exceptions.',output:'Attendance + feedback evidence',next:'Recording & Completion',moduleKey:'orientation'},
    {id:'ori-complete',no:'O4',title:'Recording, Completion & Report',owner:'Registry',module:'Orientation → Recording & Completion',trigger:'Session ended and completion checks ready',action:'Add recording, explicitly Send Recording, complete Orientation and generate the official PDF report. Completed records are locked; use revision controls for changes.',output:'Completed Orientation record + official report',next:'Orientation record complete',moduleKey:'orientation'}
  ],
  handover:[
    {id:'ho-session',no:'H1',title:'Create Handover & Add Students',owner:'Registry',module:'Academic Handover',trigger:'Registry determines student is operationally ready for handover',action:'Create Handover Session, open View Handover and add the student roster.',output:'Handover roster ready',next:'Handover Now',moduleKey:'handover'},
    {id:'ho-send',no:'H2',title:'Handover Now & Communication',owner:'Registry',module:'Academic Handover → Communication',trigger:'Handover roster ready',action:'Send Handover Now. Academic and configured IT / Moodle / e-Library PICs receive the operational information.',output:'Handover communication + PIC tasks',next:'Provisioning',moduleKey:'handover'},
    {id:'ho-provision',no:'H3',title:'Provisioning',owner:'IT / Moodle / e-Library + Registry',module:'Academic Handover → Provisioning',trigger:'PIC tasks issued',action:'Complete Innovative Email, Moodle and e-Library access while Registry monitors all service statuses.',output:'Required provisioning completed',next:'Student Access',moduleKey:'handover'},
    {id:'ho-access',no:'H4',title:'Student Access & Complete',owner:'Registry',module:'Academic Handover → Student Access',trigger:'Required provisioning complete',action:'Send final Student Access communication and complete the handover record.',output:'Access delivered + operational handover complete',next:'Academic ownership / active student operations',moduleKey:'handover'}
  ]
};

function flowV3Card(s,extra=''){
  return '<button type="button" class="g3-node '+extra+'" onclick="openGuideFlowStepV3(\''+s.id+'\')">'+
    '<div class="g3-node-top"><em>'+esc(s.no)+'</em><span>'+esc(s.module)+'</span></div>'+
    '<b>'+esc(s.title)+'</b><small>'+esc(s.owner)+'</small>'+
    '<p>'+esc(s.action)+'</p>'+
    '<div class="g3-output"><strong>OUTPUT</strong><span>'+esc(s.output)+'</span></div>'+
  '</button>';
}

function flowV3Arrow(label=''){
  return '<div class="g3-arrow"><i>→</i>'+(label?'<span>'+esc(label)+'</span>':'')+'</div>';
}

function renderFlowV3(){
  const m=flowV3.master,i=flowV3.intake,a=flowV3.admission,act=flowV3.activation,o=flowV3.orientation,h=flowV3.handover;
  const byId=(arr,id)=>arr.find(x=>x.id===id);
  return '<div class="g3-map">'+
    '<section class="g3-foundation">'+
      '<div class="g3-section-head"><div><small>FOUNDATION CONTROLS</small><h4>Master data that feeds the operational journey</h4></div><span>Maintain before use</span></div>'+
      '<div class="g3-master-row">'+flowV3Card(m[0],'master')+flowV3Arrow('+')+flowV3Card(m[1],'master')+'</div>'+
    '</section>'+

    '<section class="g3-stage-block intake">'+
      '<div class="g3-section-head"><div><small>PHASE 1 · ENTRY & CAPTURE</small><h4>One application creates two operational tracks</h4></div><span>Application is the common trigger</span></div>'+
      '<div class="g3-entry">'+
        flowV3Card(i[0],'hero-node')+
        '<div class="g3-split"><span></span><b>Application creates work for both Registry and Consultant</b><span></span></div>'+
        '<div class="g3-entry-branches">'+
          '<div class="g3-branch-card"><label>ADMISSION REVIEW TRACK</label><div class="g3-branch-start">Registry begins controlled review when the case is operationally ready.</div></div>'+
          '<div class="g3-branch-card prospect"><label>SKY PROSPECT TRACK</label>'+flowV3Card(i[1],'compact')+'<div class="g3-branch-note">This track is recorded in Prospect / Activation and does not replace the admission decision process.</div></div>'+
        '</div>'+
      '</div>'+
    '</section>'+

    '<section class="g3-stage-block admission">'+
      '<div class="g3-section-head"><div><small>PHASE 2 · ADMISSION DECISION SPINE</small><h4>Registry review → formal SAC decision → approved admission route</h4></div><span>Formal decision path</span></div>'+
      '<div class="g3-linear">'+
        flowV3Card(byId(a,'documents'))+flowV3Arrow()+flowV3Card(byId(a,'screening'))+flowV3Arrow()+flowV3Card(byId(a,'sac'),'decision-node')+
      '</div>'+
      '<div class="g3-decision-title"><span>SAC DECISION</span><b>Choose the authorised route</b></div>'+
      '<div class="g3-sac-branches">'+
        '<div class="g3-route direct"><div class="g3-route-tag">DIRECT ENTRY</div><div class="g3-route-copy"><b>Eligible without IA</b><span>Proceed to Offer eligibility.</span></div></div>'+
        '<div class="g3-route ia"><div class="g3-route-tag">INTERNAL ASSESSMENT</div>'+flowV3Card(byId(a,'ia'),'compact')+
          '<div class="g3-ia-decision"><b>IA OUTCOME</b><div><span>✓ Sufficient → Offer route</span><span>↓ Prerequisite required</span></div></div>'+
          flowV3Card(byId(a,'prereq'),'compact')+
          '<div class="g3-return">↩ PREREQ complete → return to Offer eligibility</div>'+
        '</div>'+
        '<div class="g3-route rejected"><div class="g3-route-tag">REJECTED / NOT QUALIFIED</div>'+flowV3Card(byId(a,'rejected'),'compact')+'</div>'+
      '</div>'+
      '<div class="g3-merge"><span>DIRECT ENTRY</span><i>+</i><span>IA SUFFICIENT</span><i>+</i><span>PREREQ COMPLETED</span><b>↓</b><strong>ELIGIBLE FOR OFFER</strong></div>'+
      '<div class="g3-linear short">'+flowV3Card(byId(a,'offer'))+flowV3Arrow()+flowV3Card(byId(a,'acceptance'),'success-node')+'</div>'+
    '</section>'+

    '<section class="g3-stage-block operations">'+
      '<div class="g3-section-head"><div><small>PHASE 3 · OPERATIONAL WORKSTREAMS</small><h4>Different modules can progress on their own operational triggers</h4></div><span>No artificial cross-module gate</span></div>'+
      '<div class="g3-principle"><b>Important:</b> these are <strong>parallel operational workstreams</strong>, not one mandatory chain called “Standalone Operations”. Orientation does not have to complete before Academic Handover, and SKY Activation follows Prospect / Activation controls rather than an invented admission-stage gate.</div>'+
      '<div class="g3-workstreams">'+
        '<article class="g3-workstream activation"><header><div><small>WORKSTREAM A</small><h5>SKY Prospect / Activation</h5></div><span>Operational status</span></header>'+
          '<div class="g3-origin">From Consultant Prospect Done</div>'+flowV3Card(act[0],'compact')+
          '<div class="g3-workstream-end">✓ Active in SKY Done</div>'+
        '</article>'+
        '<article class="g3-workstream orientation"><header><div><small>WORKSTREAM B</small><h5>Orientation</h5></div><span>Session lifecycle</span></header>'+
          o.map((s,idx)=>flowV3Card(s,'compact')+(idx<o.length-1?'<div class="g3-down">↓</div>':'')).join('')+
          '<div class="g3-workstream-end">✓ Official Orientation record complete</div>'+
        '</article>'+
        '<article class="g3-workstream handover"><header><div><small>WORKSTREAM C</small><h5>Academic Handover</h5></div><span>Provisioning + access</span></header>'+
          h.map((s,idx)=>flowV3Card(s,'compact')+(idx<h.length-1?'<div class="g3-down">↓</div>':'')).join('')+
          '<div class="g3-workstream-end">✓ Operational handover complete</div>'+
        '</article>'+
      '</div>'+
    '</section>'+

    '<section class="g3-outcome">'+
      '<div class="g3-section-head"><div><small>OPERATIONAL OUTCOMES</small><h4>What ACC should make visible at the end</h4></div><span>Not one hidden status</span></div>'+
      '<div class="g3-outcome-grid">'+
        '<div><em>01</em><b>Admission Confirmed</b><span>Offer issued + Acceptance recorded</span></div>'+
        '<div><em>02</em><b>SKY Status Visible</b><span>Prospect / activation status and IDs recorded</span></div>'+
        '<div><em>03</em><b>Orientation Record Visible</b><span>Invitation, attendance, feedback, recording and report remain auditable</span></div>'+
        '<div><em>04</em><b>Academic Access Delivered</b><span>Provisioning completed + Student Access sent</span></div>'+
      '</div>'+
      '<div class="g3-final"><span>REGISTRY OPERATIONS</span><i>→</i><b>Academic Ownership / Active Student Operations</b></div>'+
    '</section>'+
  '</div>';
}

window.openGuideFlowStepV3=function(id){
  const groups=Object.values(flowV3).flat();
  const s=groups.find(x=>x.id===id);if(!s)return;
  document.getElementById('g2FlowModal')?.remove();
  const d=document.createElement('div');d.id='g2FlowModal';d.className='g2-fmodal';
  d.innerHTML='<article class="g3-detail-modal"><header><div><small>'+esc(s.no)+' · '+esc(s.module)+'</small><h3>'+esc(s.title)+'</h3></div><button onclick="document.getElementById(\'g2FlowModal\').remove()">Close</button></header>'+
    '<div class="g3-detail-owner"><span>OWNER</span><b>'+esc(s.owner)+'</b></div>'+
    '<div class="g3-detail-grid">'+
      '<div><small>TRIGGER</small><b>'+esc(s.trigger)+'</b></div>'+
      '<div><small>ACTION</small><b>'+esc(s.action)+'</b></div>'+
      '<div><small>OUTPUT</small><b>'+esc(s.output)+'</b></div>'+
      '<div><small>NEXT / BRANCH</small><b>'+esc(s.next)+'</b></div>'+
    '</div>'+
    '<footer><button onclick="guideOpenModule(\''+esc(s.moduleKey||moduleKey(s.module))+'\')">Open Live Module</button></footer></article>';
  document.body.appendChild(d);
};

function renderFlow(){
  const r=document.getElementById('guideFlowView');if(!r)return;
  r.innerHTML='<div class="guide-training-intro"><div><div class="guide-training-kicker">DETAILED PROCESS ARCHITECTURE · V3</div><h3>ACC End-to-End Student Journey</h3><p>This view separates the formal admission decision spine from parallel operational workstreams. Click any stage to see its trigger, owner, action, output and next route.</p></div><button class="primary" onclick="openGuideSlides(1)">Present Student Journey</button></div>'+
    '<div class="g3-legend"><span><i class="student"></i>Student / External</span><span><i class="registry"></i>Registry</span><span><i class="decision"></i>Decision / Academic</span><span><i class="ops"></i>Operational Workstream</span></div>'+
    renderFlowV3();
}
function renderSlide(){const r=document.getElementById('guideSlideStage');if(!r)return;idx=Math.max(0,Math.min(slides.length-1,idx));const s=slides[idx];r.innerHTML='<article class="guide-slide g2-v2"><header><div class="guide-slide-logos"><img src="'+L1+'"><img src="'+L2+'"></div><small>'+(idx+1)+' / '+slides.length+'</small></header>'+ribbon(s[3])+'<div class="guide-slide-heading"><div class="guide-slide-kicker">'+s[0]+'</div><h2>'+s[1]+'</h2><p>'+s[2]+'</p></div><div class="g2-layout"><div><label>LIVE SYSTEM PREVIEW · TRAINING DATA</label>'+preview(s[4])+'</div><aside><header><b>Trainer Notes</b><button onclick="guideOpenModule(\''+s[5]+'\')">Open Live Module ↗</button></header>'+s[6].map((x,i)=>'<p><em>'+(i+1)+'</em><span>'+x+'</span></p>').join('')+'</aside></div><footer><span>IUC · IPGS Admission Command Center</span><span>System Training Guide · September 2026</span></footer></article>';const q=document.getElementById('guideSlideSelect');if(q)q.value=idx;const c=document.getElementById('guideSlideCounter');if(c)c.textContent=(idx+1)+' / '+slides.length;const b=document.getElementById('guideSlideProgressBar');if(b)b.style.width=((idx+1)/slides.length*100)+'%'}
function shell(){const r=document.getElementById('guideSlidesView');if(!r)return;r.innerHTML='<div class="guide-slide-toolbar"><div class="guide-slide-nav"><button class="ghost" onclick="guideSlideMove(-1)">← Previous</button><select id="guideSlideSelect" onchange="guideSlideJump(this.value)">'+slides.map((s,i)=>'<option value="'+i+'">'+String(i+1).padStart(2,'0')+' · '+s[1]+'</option>').join('')+'</select><button class="primary" onclick="guideSlideMove(1)">Next →</button></div><div class="guide-slide-nav"><span id="guideSlideCounter" class="badge purple"></span><button class="ghost" onclick="toggleGuideFullscreen()">⛶ Fullscreen</button></div></div><div class="guide-slide-progress"><span id="guideSlideProgressBar"></span></div><div id="guideSlideStage" class="guide-slide-stage"></div><div class="guide-slide-help">Click numbered hotspots. Use Open Live Module for a real demo. ← / → moves between slides.</div>';renderSlide()}
window.setGuideMode=function(m){mode=['sop','flow','slides'].includes(m)?m:'sop';[['sop','Sop'],['flow','Flow'],['slides','Slides']].forEach(x=>{const e=document.getElementById('guide'+x[1]+'View');if(e)e.style.display=x[0]===mode?'block':'none';const b=document.querySelector('[data-guide-mode="'+x[0]+'"]');if(b){b.classList.toggle('primary',x[0]===mode);b.classList.toggle('ghost',x[0]!==mode)}});if(mode==='flow')renderFlow();if(mode==='slides')shell()};
window.openGuideSlides=i=>{if(Number.isFinite(Number(i)))idx=Number(i);setGuideMode('slides')};window.guideSlideMove=d=>{idx=Math.max(0,Math.min(slides.length-1,idx+Number(d||0)));renderSlide()};window.guideSlideJump=i=>{idx=Number(i||0);renderSlide()};window.toggleGuideFullscreen=async()=>{const e=document.getElementById('guideSlidesView');try{if(!document.fullscreenElement)await e.requestFullscreen();else await document.exitFullscreen()}catch(_){}};
document.addEventListener('keydown',e=>{if(mode!=='slides')return;if(e.key==='ArrowRight')guideSlideMove(1);if(e.key==='ArrowLeft')guideSlideMove(-1)});
window.initSystemGuideTrainingV2=()=>{renderFlow();shell();setGuideMode('sop')};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initSystemGuideTrainingV2);else initSystemGuideTrainingV2();
})();