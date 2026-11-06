(function(){
'use strict';

const AGENTS={
  human:{name:'Human Decision Desk',code:'HD',role:'Registrar Authority',authority:'Controlled approval / exception decision',tools:['Judgement','Approval record','Exception notes']},
  orchestrator:{name:'AI Orchestrator',code:'AI',role:'Operations Router',authority:'Route task to the correct specialist agent',tools:['Task routing','Priority queue','Agent state','Escalation']},
  application:{name:'Application Receiver',code:'AR',role:'Receive Submission',authority:'Capture new submission',tools:['Admission form','Timestamp','Reference number']},
  appPdf:{name:'Application PDF Agent',code:'AP',role:'Application Pack',authority:'Generate admission PDF and next steps',tools:['Application PDF','Next Steps','Email pack']},
  folder:{name:'Student Folder Agent',code:'SF',role:'File & Folder Setup',authority:'Create and organise student file',tools:['Drive folder','Naming rules','Admission pack']},
  agentNotify:{name:'Agent Notification Agent',code:'AN',role:'Marketing Notification',authority:'Notify assigned marketing / agent',tools:['New application email','Applicant summary','Action link']},
  document:{name:'Document Check Agent',code:'DC',role:'Document Completeness',authority:'Check required upload set',tools:['Checklist','Identity','Academic documents']},
  researchIntent:{name:'Research Intent Agent',code:'RI',role:'PhD Research Intent',authority:'Verify programme-specific research intent',tools:['Preliminary Research Intent','PhD rule check']},
  prospect:{name:'SkyVialing Prospect Agent',code:'SP',role:'Prospect Creation',authority:'Track prospect creation',tools:['Prospect fields','Agent completion']},
  feeGroup:{name:'Fee Group Agent',code:'FG',role:'Fee Assignment',authority:'Capture selected fee group',tools:['Fee Group Master','Agent submission']},
  registryQueue:{name:'Registry Queue Agent',code:'RQ',role:'Registry Intake',authority:'Open Registry processing case',tools:['Prospect confirmation','Fee group','Student folder']},
  qualification:{name:'Qualification Screening Agent',code:'QS',role:'Entry Qualification',authority:'Evaluate entry requirements',tools:['Programme rules','Field check','Experience check']},
  detailedReview:{name:'Admission Review Agent',code:'AE',role:'Detailed Evaluation',authority:'Review full admission evidence',tools:['Qualification','Documents','Programme requirement']},
  compliancePreSac:{name:'Pre-SAC Compliance Agent',code:'PC',role:'Control Check',authority:'Verify case is ready for SAC',tools:['Audit evidence','Checklist','Exception flag']},
  sacSession:{name:'SAC Session Agent',code:'SS',role:'Create SAC Session',authority:'Prepare SAC session',tools:['Session date','Committee','Candidate selection']},
  sacPack:{name:'SAC Case Pack Agent',code:'CP',role:'Candidate Pack',authority:'Prepare candidate list and Form-01',tools:['Candidate list','Form-01','Evidence pack']},
  sacOutcome:{name:'SAC Outcome Agent',code:'SO',role:'Record SAC Decision',authority:'Record formal SAC pathway',tools:['Direct Entry','IA','Prerequisite','Not Qualified']},
  iaInvite:{name:'IA Invitation Agent',code:'II',role:'Schedule Internal Assessment',authority:'Arrange IA activity',tools:['Interview schedule','Essay','Portfolio instructions']},
  iaAssessment:{name:'IA Assessment Agent',code:'IA',role:'Internal Assessment',authority:'Track panel evidence and assessment',tools:['Interview','Essay','Portfolio','Panel notes']},
  iaResult:{name:'IA Result Agent',code:'IR',role:'IA Result & Record',authority:'Finalise IA result',tools:['IA result','Evidence record','Outcome routing']},
  prereqEnroll:{name:'Prerequisite Enrolment Agent',code:'PE',role:'Prerequisite Registration',authority:'Register prerequisite route',tools:['Course registration','Cohort','Start date']},
  prereqMoodle:{name:'Prerequisite Moodle Agent',code:'PM',role:'Course LMS Setup',authority:'Prepare prerequisite Moodle',tools:['Moodle course','Materials','Assessment shell']},
  prereqClass:{name:'Prerequisite Class Agent',code:'CL',role:'4-Week Delivery',authority:'Track class completion',tools:['Google Meet','Attendance','Class plan']},
  prereqAssess:{name:'Prerequisite Assessment Agent',code:'PA',role:'Assessment & Marks',authority:'Track assessment and result',tools:['Assessment','Marks','Completion']},
  prereqDocs:{name:'Prerequisite Documents Agent',code:'PD',role:'Certificate & Transcript',authority:'Generate completion documents',tools:['Completion certificate','Transcript','Result']},
  loa:{name:'LOA Agent',code:'LO',role:'Letter of Offer',authority:'Issue approved official offer',tools:['LOA template','Reference number','Offer email']},
  acceptance:{name:'Acceptance Agent',code:'AC',role:'Offer Acceptance',authority:'Record signed acceptance',tools:['Signature','Timestamp','Acceptance PDF']},
  orientationInvite:{name:'Orientation Invitation Agent',code:'OI',role:'Invite Student',authority:'Send orientation invitation',tools:['Session','Meet link','Reminder']},
  orientationAttendance:{name:'Orientation Attendance Agent',code:'OT',role:'Attendance & Feedback',authority:'Track attendance and feedback',tools:['Attendance','Feedback','Walk-in']},
  orientationFollowup:{name:'Orientation Follow-up Agent',code:'OF',role:'Recording & Community',authority:'Send post-session information',tools:['Recording','Community links','Post-orientation email']},
  itAccount:{name:'IT Account Agent',code:'IT',role:'IUC Email',authority:'Track institutional email creation',tools:['IUC email','IT completion']},
  library:{name:'Library Agent',code:'LB',role:'e-Library Access',authority:'Track library access',tools:['e-Library','Library completion']},
  moodle:{name:'Moodle Account Agent',code:'MO',role:'Academic LMS Access',authority:'Track Moodle access',tools:['Moodle','Personal email','Completion']},
  handoverPrep:{name:'Handover Preparation Agent',code:'HP',role:'Readiness Check',authority:'Compile handover readiness',tools:['Acceptance','Orientation','Accounts','Student record']},
  academic:{name:'Academic Handover Agent',code:'AH',role:'Transfer to Academic',authority:'Create and verify Academic handover',tools:['Handover batch','Academic portal','Subject onboarding']},
  audit:{name:'Audit Trail Agent',code:'AT',role:'Compliance Record',authority:'Verify evidence and audit events',tools:['Audit log','Exception checks','Control trail']},
  reporting:{name:'Management Reporting Agent',code:'MR',role:'Operational Intelligence',authority:'Update operational reporting',tools:['Dashboard','Daily statistics','Bottleneck signals']}
};

const STATIONS={
  admission:{num:1,title:'Admission',subtitle:'Application Intake',x:20,y:34,color:'#2f78d6',primary:'application',agents:['application','appPdf','folder','agentNotify']},
  document:{num:2,title:'Document Check',subtitle:'Evidence & Research Intent',x:36,y:34,color:'#1f9a78',primary:'document',agents:['document','researchIntent']},
  screening:{num:3,title:'Screening',subtitle:'Prospect · Registry · Qualification',x:52,y:34,color:'#e87832',primary:'qualification',agents:['prospect','feeGroup','registryQueue','qualification','detailedReview','compliancePreSac']},
  sac:{num:4,title:'SAC',subtitle:'Committee Processing',x:68,y:34,color:'#7054c8',primary:'sacOutcome',agents:['sacSession','sacPack','sacOutcome']},
  ia:{num:5,title:'IA',subtitle:'Internal Assessment',x:84,y:34,color:'#cf4f63',primary:'iaAssessment',agents:['iaInvite','iaAssessment','iaResult']},
  prerequisite:{num:6,title:'Prerequisite',subtitle:'4-Week Completion Route',x:20,y:73,color:'#168fa5',primary:'prereqClass',agents:['prereqEnroll','prereqMoodle','prereqClass','prereqAssess','prereqDocs']},
  offer:{num:7,title:'Offer & Acceptance',subtitle:'LOA & Signed Acceptance',x:36,y:73,color:'#d59a22',primary:'loa',agents:['loa','acceptance']},
  orientation:{num:8,title:'Orientation',subtitle:'Invitation · Attendance · Follow-up',x:52,y:73,color:'#326bc1',primary:'orientationAttendance',agents:['orientationInvite','orientationAttendance','orientationFollowup']},
  services:{num:9,title:'IT / Library / Moodle',subtitle:'Student Access',x:68,y:73,color:'#148a86',primary:'itAccount',agents:['itAccount','library','moodle']},
  handover:{num:10,title:'Handover',subtitle:'Academic Transfer & Audit',x:84,y:73,color:'#7656c5',primary:'academic',agents:['handoverPrep','academic','audit','reporting']}
};
const AGENT_STATION={human:'control',orchestrator:'control'};
Object.keys(STATIONS).forEach(k=>STATIONS[k].agents.forEach(a=>AGENT_STATION[a]=k));

const LOOKS=[
  {skin:'#f1c6a8',hair:'#2d201e',shirt:'#2f78d6',accent:'#f3c14b'},
  {skin:'#8f5b3e',hair:'#171717',shirt:'#1f9a78',accent:'#57b8ff'},
  {skin:'#d7a078',hair:'#5b342b',shirt:'#e87832',accent:'#8a63d2'},
  {skin:'#f0bd95',hair:'#1d1a19',shirt:'#7054c8',accent:'#e84b75'},
  {skin:'#a76c4d',hair:'#3d201b',shirt:'#cf4f63',accent:'#49a56d'},
  {skin:'#e8b891',hair:'#6a3d22',shirt:'#168fa5',accent:'#f39c44'},
  {skin:'#70442e',hair:'#141414',shirt:'#d59a22',accent:'#5866d8'},
  {skin:'#c98761',hair:'#402218',shirt:'#326bc1',accent:'#e35d73'},
  {skin:'#efc7a8',hair:'#6b4a2d',shirt:'#148a86',accent:'#8065c7'},
  {skin:'#925b42',hair:'#261714',shirt:'#7656c5',accent:'#e5a52c'}
];

const DEMO_APPS=[
  {id:'APP-260921-01',name:'Alya',look:0,status:'waiting',station:'queue'},
  {id:'APP-260921-02',name:'Hakim',look:1,status:'waiting',station:'queue'},
  {id:'APP-260921-03',name:'Sofia',look:2,status:'waiting',station:'queue'},
  {id:'APP-260921-04',name:'Daniel',look:3,status:'waiting',station:'queue'},
  {id:'APP-260921-05',name:'Nadia',look:4,status:'waiting',station:'queue'}
];

function E(event,agent,task,action,verification,next,message,duration=560){return{kind:'event',event,agent,task,action,verification,next,message,duration};}
function H(event,from,to,task,message,next,duration=900){return{kind:'handoff',event,from,to,task,message,next,duration};}
function X(event,from,recommendation,reason,next){return{kind:'human',event,from,to:'human',task:'Authority Review',recommendation,reason,next,message:'Human authority is required before the case can continue.',duration:1050};}

const COMMON_START=[
 E('APPLICATION_RECEIVED','application','Receive application','Register submission','Application registered','APPLICATION_PDF_REQUIRED','New application received.'),
 H('APPLICATION_PDF_REQUIRED','application','appPdf','Generate application pack','Application Receiver passes the case to Application PDF Agent.','APPLICATION_PACK_READY'),
 E('APPLICATION_PACK_READY','appPdf','Application PDF + Next Steps','Generate admission PDF and next-step guidance','Application pack generated','DOCUMENT_CHECK_REQUIRED','Application pack ready.'),
 H('DOCUMENT_CHECK_REQUIRED','appPdf','document','Check applicant documents','Applicant is escorted to Document Check.','DOCUMENT_REVIEW'),
 E('DOCUMENT_REVIEW','document','Document completeness','Check identity and academic uploads','Required documents checked','RESEARCH_INTENT_CHECK','Document review completed.'),
 H('RESEARCH_INTENT_CHECK','document','researchIntent','Programme evidence check','Document Check passes programme-specific evidence review.','RESEARCH_INTENT_REVIEW'),
 E('RESEARCH_INTENT_REVIEW','researchIntent','Research Intent validation','Verify programme-specific evidence','Evidence verified','FOLDER_SETUP_REQUIRED','Programme evidence check completed.'),
 H('FOLDER_SETUP_REQUIRED','researchIntent','folder','Create student folder','Case returns to Admission operations for folder setup.','FOLDER_READY'),
 E('FOLDER_READY','folder','Student file setup','Create and organise admission folder','Student folder ready','AGENT_NOTIFICATION_REQUIRED','Student file created.'),
 H('AGENT_NOTIFICATION_REQUIRED','folder','agentNotify','Notify marketing / agent','Case passed to Agent Notification Agent.','AGENT_NOTIFIED'),
 E('AGENT_NOTIFIED','agentNotify','New application notification','Send applicant details and action requirement','Assigned agent notified','PROSPECT_REQUIRED','Marketing / agent notified.'),
 H('PROSPECT_REQUIRED','agentNotify','prospect','Create SkyVialing prospect','Applicant is escorted to Screening operations.','PROSPECT_IN_PROGRESS'),
 E('PROSPECT_IN_PROGRESS','prospect','SkyVialing prospect','Track prospect entry completion','Prospect created','FEE_GROUP_REQUIRED','Prospect created in SkyVialing.'),
 H('FEE_GROUP_REQUIRED','prospect','feeGroup','Assign fee group','Prospect handed to Fee Group Agent.','FEE_GROUP_IN_PROGRESS'),
 E('FEE_GROUP_IN_PROGRESS','feeGroup','Fee group assignment','Record selected fee group','Fee group recorded','REGISTRY_QUEUE_REQUIRED','Fee group recorded.'),
 H('REGISTRY_QUEUE_REQUIRED','feeGroup','registryQueue','Open Registry case','Case passed to Registry Queue Agent.','REGISTRY_CASE_OPEN'),
 E('REGISTRY_CASE_OPEN','registryQueue','Registry intake','Verify prospect and files','Registry case opened','QUALIFICATION_REQUIRED','Registry case opened.'),
 H('QUALIFICATION_REQUIRED','registryQueue','qualification','Qualification screening','Case passed to Qualification Screening Agent.','QUALIFICATION_REVIEW'),
 E('QUALIFICATION_REVIEW','qualification','Entry qualification screening','Check field, level and experience rules','Qualification screening completed','DETAILED_REVIEW_REQUIRED','Qualification screening completed.'),
 H('DETAILED_REVIEW_REQUIRED','qualification','detailedReview','Detailed admission evaluation','Case passed to Admission Review Agent.','ADMISSION_REVIEW'),
 E('ADMISSION_REVIEW','detailedReview','Detailed admission review','Review complete admission evidence','Admission review completed','PRE_SAC_CONTROL_REQUIRED','Detailed admission review completed.'),
 H('PRE_SAC_CONTROL_REQUIRED','detailedReview','compliancePreSac','Pre-SAC control check','Case passed to Pre-SAC Compliance Agent.','PRE_SAC_CONTROL'),
 E('PRE_SAC_CONTROL','compliancePreSac','Pre-SAC compliance','Verify evidence and unresolved exceptions','SAC readiness verified','SAC_SESSION_REQUIRED','Case is ready for SAC.'),
 H('SAC_SESSION_REQUIRED','compliancePreSac','sacSession','Create / assign SAC session','Applicant is escorted to SAC.','SAC_SESSION_READY'),
 E('SAC_SESSION_READY','sacSession','SAC session preparation','Assign candidate into SAC session','Session assigned','SAC_PACK_REQUIRED','SAC session prepared.'),
 H('SAC_PACK_REQUIRED','sacSession','sacPack','Prepare SAC case pack','Candidate passed to SAC Case Pack Agent.','SAC_PACK_READY'),
 E('SAC_PACK_READY','sacPack','Candidate pack + Form-01','Prepare candidate evidence and Form-01','SAC pack complete','SAC_OUTCOME_REQUIRED','SAC case pack prepared.'),
 H('SAC_OUTCOME_REQUIRED','sacPack','sacOutcome','Record SAC outcome','Prepared candidate handed to SAC Outcome Agent.','SAC_REVIEW')
];

const DIRECT=[
 E('SAC_REVIEW','sacOutcome','SAC formal outcome','Record Direct Entry outcome','Direct Entry approved','LOA_REQUIRED','SAC outcome: Direct Entry.'),
 H('LOA_REQUIRED','sacOutcome','loa','Issue official LOA','Applicant is escorted to Offer & Acceptance.','LOA_PROCESS'),
 E('LOA_PROCESS','loa','Official Letter of Offer','Generate LOA reference, PDF and email','LOA issued','ACCEPTANCE_REQUIRED','Official offer issued.')
];
const IA=[
 E('SAC_REVIEW','sacOutcome','SAC formal outcome','Record IA pathway','IA required','IA_INVITE_REQUIRED','SAC outcome: Internal Assessment required.'),
 H('IA_INVITE_REQUIRED','sacOutcome','iaInvite','Arrange Internal Assessment','Applicant is escorted to IA.','IA_INVITATION'),
 E('IA_INVITATION','iaInvite','IA scheduling & instruction','Arrange interview / essay / portfolio','IA session prepared','IA_ASSESSMENT_REQUIRED','IA invitation prepared.'),
 H('IA_ASSESSMENT_REQUIRED','iaInvite','iaAssessment','Conduct / track IA','Case passed to IA Assessment Agent.','IA_ASSESSMENT'),
 E('IA_ASSESSMENT','iaAssessment','Internal Assessment','Track panel evidence and assessment','IA evidence complete','IA_RESULT_REQUIRED','Internal Assessment completed.'),
 H('IA_RESULT_REQUIRED','iaAssessment','iaResult','Finalise IA result','Assessment evidence passed to IA Result Agent.','IA_RESULT'),
 E('IA_RESULT','iaResult','IA result document','Generate IA result and route outcome','IA result sufficient','LOA_REQUIRED','IA result is sufficient.'),
 H('LOA_REQUIRED','iaResult','loa','Issue official LOA','Applicant is escorted to Offer & Acceptance.','LOA_PROCESS'),
 E('LOA_PROCESS','loa','Official Letter of Offer','Generate LOA reference, PDF and email','LOA issued','ACCEPTANCE_REQUIRED','Official offer issued after IA.')
];
const PREREQ=[
 E('SAC_REVIEW','sacOutcome','SAC formal outcome','Record IA pathway','IA required','IA_INVITE_REQUIRED','SAC outcome: Internal Assessment required.'),
 H('IA_INVITE_REQUIRED','sacOutcome','iaInvite','Arrange Internal Assessment','Applicant is escorted to IA.','IA_INVITATION'),
 E('IA_INVITATION','iaInvite','IA scheduling & instruction','Arrange IA activity','IA session prepared','IA_ASSESSMENT_REQUIRED','IA invitation prepared.'),
 H('IA_ASSESSMENT_REQUIRED','iaInvite','iaAssessment','Conduct / track IA','Case passed to IA Assessment Agent.','IA_ASSESSMENT'),
 E('IA_ASSESSMENT','iaAssessment','Internal Assessment','Track panel evidence and assessment','IA evidence complete','IA_RESULT_REQUIRED','Internal Assessment completed.'),
 H('IA_RESULT_REQUIRED','iaAssessment','iaResult','Finalise IA result','Assessment evidence passed to IA Result Agent.','IA_RESULT'),
 E('IA_RESULT','iaResult','IA result document','Generate result and route outcome','Prerequisite required','PREREQ_ENROL_REQUIRED','IA requires prerequisite course.'),
 H('PREREQ_ENROL_REQUIRED','iaResult','prereqEnroll','Register prerequisite course','Applicant is escorted to Prerequisite.','PREREQ_ENROL'),
 E('PREREQ_ENROL','prereqEnroll','Prerequisite registration','Register approved prerequisite cohort','Registration complete','PREREQ_MOODLE_REQUIRED','Prerequisite enrolment completed.'),
 H('PREREQ_MOODLE_REQUIRED','prereqEnroll','prereqMoodle','Prepare prerequisite Moodle','Case passed to Prerequisite Moodle Agent.','PREREQ_MOODLE'),
 E('PREREQ_MOODLE','prereqMoodle','Prerequisite LMS setup','Prepare course materials and assessment shell','Moodle course ready','PREREQ_CLASS_REQUIRED','Prerequisite Moodle prepared.'),
 H('PREREQ_CLASS_REQUIRED','prereqMoodle','prereqClass','Run 4-week classes','Student moves to Prerequisite Class Agent.','PREREQ_CLASSES'),
 E('PREREQ_CLASSES','prereqClass','4-week class delivery','Track Google Meet classes and attendance','Class requirement completed','PREREQ_ASSESS_REQUIRED','Prerequisite classes completed.',720),
 H('PREREQ_ASSESS_REQUIRED','prereqClass','prereqAssess','Complete prerequisite assessment','Case passed to Prerequisite Assessment Agent.','PREREQ_ASSESSMENT'),
 E('PREREQ_ASSESSMENT','prereqAssess','Prerequisite assessment','Track assessment and marks','Pass result recorded','PREREQ_DOCS_REQUIRED','Prerequisite assessment completed.'),
 H('PREREQ_DOCS_REQUIRED','prereqAssess','prereqDocs','Generate completion documents','Result passed to Prerequisite Documents Agent.','PREREQ_DOCUMENTS'),
 E('PREREQ_DOCUMENTS','prereqDocs','Certificate + transcript','Generate completion certificate and transcript','Documents ready','LOA_REQUIRED','Prerequisite completion documents issued.'),
 H('LOA_REQUIRED','prereqDocs','loa','Issue official LOA','Applicant is escorted to Offer & Acceptance.','LOA_PROCESS'),
 E('LOA_PROCESS','loa','Official Letter of Offer','Generate LOA reference, PDF and email','LOA issued','ACCEPTANCE_REQUIRED','Official offer issued after prerequisite.')
];
const POST=[
 H('ACCEPTANCE_REQUIRED','loa','acceptance','Capture offer acceptance','Offer handled by Acceptance Agent.','ACCEPTANCE_PENDING'),
 E('ACCEPTANCE_PENDING','acceptance','Signed acceptance','Capture signature and timestamp','Acceptance PDF stored','ORIENTATION_INVITE_REQUIRED','Acceptance received.'),
 H('ORIENTATION_INVITE_REQUIRED','acceptance','orientationInvite','Send orientation invitation','Applicant is escorted to Orientation.','ORIENTATION_INVITE'),
 E('ORIENTATION_INVITE','orientationInvite','Orientation invitation','Send session details and reminder','Invitation logged','ORIENTATION_ATTENDANCE_REQUIRED','Orientation invitation sent.'),
 H('ORIENTATION_ATTENDANCE_REQUIRED','orientationInvite','orientationAttendance','Track attendance & feedback','Student passed to Orientation Attendance Agent.','ORIENTATION_SESSION'),
 E('ORIENTATION_SESSION','orientationAttendance','Attendance & feedback','Record attendance and feedback','Attendance verified','ORIENTATION_FOLLOWUP_REQUIRED','Orientation attendance recorded.'),
 H('ORIENTATION_FOLLOWUP_REQUIRED','orientationAttendance','orientationFollowup','Send recording & community links','Case passed to Orientation Follow-up Agent.','ORIENTATION_FOLLOWUP'),
 E('ORIENTATION_FOLLOWUP','orientationFollowup','Post-orientation follow-up','Send recording and approved community information','Communication logged','IT_ACCOUNT_REQUIRED','Orientation follow-up completed.'),
 H('IT_ACCOUNT_REQUIRED','orientationFollowup','itAccount','Create IUC email','Student is escorted to IT / Library / Moodle.','IT_ACCOUNT_PROCESS'),
 E('IT_ACCOUNT_PROCESS','itAccount','IUC email provisioning','Track institutional email setup','IT account complete','LIBRARY_ACCOUNT_REQUIRED','IUC email completed.'),
 H('LIBRARY_ACCOUNT_REQUIRED','itAccount','library','Create e-Library access','Case passed to Library Agent.','LIBRARY_PROCESS'),
 E('LIBRARY_PROCESS','library','e-Library provisioning','Track library account setup','Library account complete','MOODLE_ACCOUNT_REQUIRED','e-Library access completed.'),
 H('MOODLE_ACCOUNT_REQUIRED','library','moodle','Create Moodle access','Case passed to Moodle Account Agent.','MOODLE_PROCESS'),
 E('MOODLE_PROCESS','moodle','Moodle account provisioning','Track Moodle account creation','Moodle access complete','HANDOVER_PREP_REQUIRED','Moodle access completed.'),
 H('HANDOVER_PREP_REQUIRED','moodle','handoverPrep','Prepare Academic handover','Student is escorted to Handover.','HANDOVER_PREP'),
 E('HANDOVER_PREP','handoverPrep','Readiness compilation','Verify acceptance, orientation and account statuses','Handover pack ready','ACADEMIC_HANDOVER_REQUIRED','Student is ready for Academic handover.'),
 H('ACADEMIC_HANDOVER_REQUIRED','handoverPrep','academic','Transfer to Academic','Ready student passed to Academic Handover Agent.','ACADEMIC_HANDOVER'),
 E('ACADEMIC_HANDOVER','academic','Academic handover','Create handover record and transfer student','Academic handover complete','AUDIT_REQUIRED','Student handed to Academic.'),
 H('AUDIT_REQUIRED','academic','audit','Verify audit trail','Completed lifecycle passed to Audit Trail Agent.','AUDIT_REVIEW'),
 E('AUDIT_REVIEW','audit','Lifecycle audit','Verify required evidence and events','Audit trail complete','REPORTING_REQUIRED','Audit trail verified.'),
 H('REPORTING_REQUIRED','audit','reporting','Update operational reporting','Completed case passed to Management Reporting Agent.','REPORTING_UPDATE'),
 E('REPORTING_UPDATE','reporting','Management reporting','Update dashboard and daily statistics','Reporting updated','JOURNEY_COMPLETE','Admission lifecycle completed.')
];

const FLOWS={
 direct:{label:'Direct Entry · Full Lifecycle',steps:COMMON_START.concat(DIRECT,POST)},
 ia:{label:'IA Sufficient · Full Lifecycle',steps:COMMON_START.concat(IA,POST)},
 prerequisite:{label:'IA → Prerequisite · Full Lifecycle',steps:COMMON_START.concat(PREREQ,POST)},
 exception:{label:'Human Decision / Exception',steps:[
   E('QUALIFICATION_EXCEPTION','qualification','Non-standard qualification','Analyse entry evidence','Exception identified','HUMAN_DECISION_REQUIRED','Qualification agent found an ambiguous case.'),
   X('HUMAN_DECISION_REQUIRED','qualification','Refer applicant to IA','Qualification evidence is non-standard and needs Registrar authority.','IA_INVITE_REQUIRED'),
   H('IA_INVITE_REQUIRED','orchestrator','iaInvite','Arrange Internal Assessment','Approved decision routes the applicant to IA.','IA_INVITATION'),
   E('IA_INVITATION','iaInvite','IA scheduling','Prepare authorised IA activity','IA task created','WORKFLOW_CONTINUES','Case resumed after human approval.')
 ]}
};

const state={};
Object.keys(AGENTS).forEach(k=>state[k]={status:'IDLE',caseId:'—',task:'Waiting for event',event:'WAITING',lastAction:'No action yet',nextAction:'Wait for event',workload:0,waitingSince:'—'});
let appState=[],currentApplicant=null;
const sim={running:false,paused:false,flow:'prerequisite',token:0,currentAnimation:null,pendingHuman:null};
const refs={};

function $(id){return document.getElementById(id);}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function clock(){return new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
function delay(ms,token){return new Promise(resolve=>{let elapsed=0;(function tick(){if(token!==sim.token){resolve();return;}if(sim.paused){setTimeout(tick,60);return;}const s=Math.min(60,ms-elapsed);elapsed+=s;if(elapsed>=ms){resolve();return;}setTimeout(tick,s);})();});}
function stationForAgent(agent){return AGENT_STATION[agent]||'admission';}
function primaryForStation(st){return STATIONS[st]?.primary||'application';}

function svgPerson(x,y,look,staff,scale=1){
 const p=LOOKS[look%LOOKS.length],lanyard=staff?'<rect x="-2" y="12" width="4" height="11" rx="1" fill="#fff"/><rect x="-4" y="21" width="8" height="6" rx="1.5" fill="#f4f6f8" stroke="#8492a0" stroke-width="1"/>':'<path d="M-14 14 Q-23 18 -18 36 H-7 V14Z" fill="'+p.accent+'" stroke="#23374d" stroke-width="1.5"/>';
 return '<g transform="translate('+x+' '+y+') scale('+scale+')">'+
   '<ellipse cx="0" cy="34" rx="18" ry="5" fill="rgba(43,56,67,.14)"/>'+
   '<rect x="-14" y="12" width="28" height="27" rx="9" fill="'+p.shirt+'" stroke="#25384b" stroke-width="2"/>'+
   '<rect x="-12" y="37" width="9" height="17" rx="4" fill="#34495f"/><rect x="3" y="37" width="9" height="17" rx="4" fill="#34495f"/>'+
   '<circle cx="0" cy="0" r="14" fill="'+p.skin+'" stroke="#4f342a" stroke-width="1.5"/>'+
   '<path d="M-14 -2 Q-10 -18 0 -18 Q13 -17 14 -2 L10 -5 Q5 -10 0 -8 Q-7 -11 -11 -5Z" fill="'+p.hair+'"/>'+
   '<circle cx="-5" cy="1" r="1.5" fill="#263341"/><circle cx="5" cy="1" r="1.5" fill="#263341"/><path d="M-4 7 Q0 10 4 7" fill="none" stroke="#8d4f4a" stroke-width="1.4" stroke-linecap="round"/>'+
   lanyard+'</g>';
}
function stationSvg(key){
 const s=STATIONS[key],x=s.x*16,y=s.y*9,top=y-102;
 const primary=Object.keys(STATIONS).indexOf(key)+1;
 return '<g class="scene-station" id="visual-'+key+'" data-station="'+key+'" transform="translate('+(x-105)+' '+top+')">'+
   '<rect x="0" y="0" width="210" height="178" rx="14" fill="#fff8eb" stroke="#d8c8ad" stroke-width="2"/>'+
   '<rect x="0" y="0" width="210" height="42" rx="14" fill="'+s.color+'"/><rect x="0" y="28" width="210" height="14" fill="'+s.color+'"/>'+
   '<circle cx="23" cy="21" r="14" fill="#fff"/><text x="23" y="26" text-anchor="middle" font-size="15" font-weight="900" fill="'+s.color+'">'+s.num+'</text>'+
   '<text x="46" y="20" font-size="14" font-weight="900" fill="#fff">'+esc(s.title)+'</text><text x="46" y="34" font-size="7.5" font-weight="700" fill="rgba(255,255,255,.82)">'+esc(s.subtitle)+'</text>'+
   '<rect x="12" y="52" width="186" height="70" rx="8" fill="#f0dfc5"/><rect x="18" y="59" width="174" height="8" rx="4" fill="#87a36d"/>'+
   '<rect x="24" y="73" width="32" height="39" rx="3" fill="#d9c7a7"/><rect x="154" y="73" width="32" height="39" rx="3" fill="#d9c7a7"/>'+
   '<rect x="30" y="78" width="20" height="4" fill="#617ba0"/><rect x="30" y="85" width="20" height="4" fill="#b65e55"/><rect x="30" y="92" width="20" height="4" fill="#d3a646"/>'+
   '<rect x="160" y="78" width="20" height="4" fill="#617ba0"/><rect x="160" y="85" width="20" height="4" fill="#6c9d72"/><rect x="160" y="92" width="20" height="4" fill="#8b6cad"/>'+
   svgPerson(105,86,primary,true,.78)+
   '<rect x="91" y="81" width="29" height="21" rx="3" fill="#334d67"/><rect x="94" y="84" width="23" height="14" rx="2" fill="#9ed8e6"/><rect x="101" y="102" width="9" height="7" fill="#596d7d"/>'+
   '<circle cx="13" cy="98" r="12" fill="#6ca45e"/><rect x="9" y="105" width="9" height="14" rx="2" fill="#c99960"/><circle cx="197" cy="98" r="12" fill="#78a866"/><rect x="193" y="105" width="9" height="14" rx="2" fill="#c99960"/>'+
   '<rect x="-4" y="118" width="218" height="46" rx="8" fill="url(#woodGrad)" stroke="#7d4f2e" stroke-width="2"/>'+
   '<rect x="14" y="124" width="45" height="17" rx="3" fill="#f4ead8"/><text id="specialist-'+key+'" x="36.5" y="135" text-anchor="middle" font-size="6.5" font-weight="900" fill="#765d47">'+esc(AGENTS[s.primary].code)+' · READY</text>'+
   '<text x="105" y="148" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">'+esc(s.title.toUpperCase())+'</text>'+
   '<rect x="18" y="160" width="8" height="15" fill="#70472c"/><rect x="184" y="160" width="8" height="15" fill="#70472c"/>'+
   '<ellipse cx="105" cy="190" rx="27" ry="8" fill="#b7a58c" opacity=".32"/><rect x="91" y="174" width="28" height="10" rx="5" fill="#5a738d"/><rect x="98" y="182" width="14" height="16" rx="4" fill="#435d77"/>'+
 '</g>';
}
function sceneSvg(){
 const stations=Object.keys(STATIONS).map(stationSvg).join('');
 const arrows=[
  [25,53,31],[41,53,47],[57,53,63],[73,53,79],
  [84,53,84],[79,53,73],[63,53,57],[47,53,41],[31,53,25]
 ].map(a=>'<path d="M '+(a[0]*16)+' '+(a[1]*9)+' H '+(a[2]*16)+'" stroke="#fff" stroke-width="6" stroke-linecap="round" marker-end="url(#arrow)" opacity=".78"/>').join('');
 return '<svg class="campus-scene" viewBox="0 0 1600 900" aria-label="IUC IPGS campus admissions operations floor">'+
 '<defs><linearGradient id="woodGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c98b52"/><stop offset="1" stop-color="#a76939"/></linearGradient>'+
 '<linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf7ee"/><stop offset="1" stop-color="#efe9db"/></linearGradient>'+
 '<marker id="arrow" markerWidth="9" markerHeight="9" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="#fff"/></marker>'+
 '<pattern id="tiles" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#d9d6cd" stroke-width="1"/></pattern>'+
 '<filter id="softShadow" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="7" stdDeviation="6" flood-color="#39536b" flood-opacity=".16"/></filter></defs>'+
 '<rect width="1600" height="900" fill="url(#floorGrad)"/><rect y="150" width="1600" height="750" fill="url(#tiles)" opacity=".7"/>'+
 '<rect x="0" y="0" width="1600" height="150" fill="#d9f0fb"/><rect x="0" y="142" width="1600" height="9" fill="#bb8652"/>'+
 '<path d="M0 0V150M220 0V150M440 0V150M800 0V150M1160 0V150M1380 0V150M1600 0V150" stroke="#7f9aaa" stroke-width="7" opacity=".42"/>'+
 '<g transform="translate(690 15)" filter="url(#softShadow)"><path d="M15 50 L110 5 L205 50 V135 H15Z" fill="#e6cfac" stroke="#c5a477" stroke-width="3"/><rect x="42" y="70" width="136" height="65" fill="#f3e2c6"/><rect x="96" y="82" width="28" height="53" fill="#365d7d"/><text x="110" y="61" text-anchor="middle" font-size="12" font-weight="900" fill="#6a523a">IUC CAMPUS</text></g>'+
 '<g fill="#5f9f58"><circle cx="360" cy="94" r="28"/><circle cx="390" cy="102" r="23"/><circle cx="1210" cy="96" r="28"/><circle cx="1242" cy="105" r="22"/><circle cx="515" cy="108" r="22"/><circle cx="1080" cy="108" r="22"/></g>'+
 '<g transform="translate(785 116)"><ellipse cx="15" cy="12" rx="37" ry="12" fill="#c8d7d6"/><ellipse cx="15" cy="10" rx="29" ry="8" fill="#76c9df"/><path d="M15 6 V-16" stroke="#77cbe3" stroke-width="5" stroke-linecap="round"/><circle cx="15" cy="-19" r="5" fill="#9edff0"/></g>'+
 '<g filter="url(#softShadow)"><path d="M35 0H245V105H35Z" fill="#173a69"/><text x="140" y="35" text-anchor="middle" font-size="17" font-weight="900" fill="#fff">IUC · IPGS</text><text x="140" y="58" text-anchor="middle" font-size="12" font-weight="800" fill="#e6c66d">PEOPLE · PURPOSE</text><text x="140" y="78" text-anchor="middle" font-size="9" font-weight="700" fill="#fff">BRIGHTER TOMORROWS</text>'+
 '<path d="M1320 0H1518V105H1320Z" fill="#205943"/><text x="1419" y="31" text-anchor="middle" font-size="13" font-weight="900" fill="#fff">LEARN</text><text x="1419" y="53" text-anchor="middle" font-size="13" font-weight="900" fill="#fff">BELONG</text><text x="1419" y="75" text-anchor="middle" font-size="13" font-weight="900" fill="#fff">ACHIEVE</text></g>'+
 '<g transform="translate(1420 118)" filter="url(#softShadow)"><rect width="155" height="95" rx="12" fill="#173a69"/><text x="16" y="22" font-size="9" font-weight="900" fill="#fff">TODAY AT IPGS</text><text x="16" y="44" font-size="8" fill="#dceafb">● New Applications  5</text><text x="16" y="61" font-size="8" fill="#dceafb">● In Progress       1</text><text x="16" y="78" font-size="8" fill="#dceafb">● Handover          0</text></g>'+
 '<g id="scene-arrows">'+arrows+'</g>'+
 '<g transform="translate(25 215)" filter="url(#softShadow)"><rect width="155" height="365" rx="18" fill="#fffefa" stroke="#d7d5cc" stroke-width="2"/><text x="77" y="28" text-anchor="middle" font-size="11" font-weight="900" fill="#173a69">NEW APPLICATIONS</text><rect x="38" y="40" width="79" height="24" rx="12" fill="#edf4fb"/><text id="svgQueueCount" x="77" y="56" text-anchor="middle" font-size="9" font-weight="900" fill="#2f78d6">5 waiting</text><path d="M21 85H134 M21 324H134" stroke="#173a69" stroke-width="5"/><path d="M21 85H134 M21 324H134" stroke="#e45454" stroke-width="5" stroke-dasharray="13 13"/></g>'+
 '<g transform="translate(641 421)" filter="url(#softShadow)"><ellipse cx="159" cy="79" rx="155" ry="73" fill="#204d82" stroke="#d8b45f" stroke-width="5"/><ellipse cx="159" cy="79" rx="145" ry="64" fill="none" stroke="#f6e4a5" stroke-width="2"/><text x="159" y="55" text-anchor="middle" font-size="11" letter-spacing="4" fill="#eed783">IUC · IPGS</text><text x="159" y="84" text-anchor="middle" font-size="21" font-weight="900" fill="#fff">ADMISSIONS HUB</text><text x="159" y="104" text-anchor="middle" font-size="8" font-weight="800" fill="#c6dbef">FROM APPLICATION TO ACADEMIC HANDOVER</text></g>'+
 '<g transform="translate(1370 430)" filter="url(#softShadow)"><rect width="185" height="115" rx="24" fill="#7998ad"/><rect x="12" y="12" width="75" height="71" rx="17" fill="#9fb4c2"/><rect x="98" y="12" width="75" height="71" rx="17" fill="#9fb4c2"/><circle cx="92" cy="24" r="17" fill="#76a56c"/><text x="92" y="102" text-anchor="middle" font-size="9" font-weight="900" fill="#fff">STUDENT LOUNGE</text></g>'+
 stations+
 '<g id="controlArea" transform="translate(625 155)" filter="url(#softShadow)"><rect width="350" height="56" rx="15" fill="#fffdf6" stroke="#d7cdbd" stroke-width="2"/>'+
 svgPerson(42,21,8,true,.58)+'<text x="70" y="22" font-size="9" font-weight="900" fill="#173a69">AI ORCHESTRATOR</text><text x="70" y="38" font-size="7" fill="#718294">routes every application</text>'+
 svgPerson(218,21,9,true,.58)+'<text x="246" y="22" font-size="9" font-weight="900" fill="#173a69">HUMAN DECISION</text><text x="246" y="38" font-size="7" fill="#718294">Registrar authority</text></g>'+
 '</svg>';
}

function applicantHtml(app){
 const p=LOOKS[app.look%LOOKS.length];
 return '<button class="student-actor '+app.status+'" id="student-'+app.id+'" data-app="'+app.id+'" style="--skin:'+p.skin+';--hair:'+p.hair+';--shirt:'+p.shirt+';--accent:'+p.accent+'">'+
   '<span class="avatar"><i class="hair"></i><i class="head"><em></em></i><i class="body"></i><i class="arm a"></i><i class="arm b"></i><i class="leg a"></i><i class="leg b"></i><i class="pack"></i></span>'+
   '<span class="student-label"><b>'+esc(app.name)+'</b><small>'+esc(app.id.replace('APP-260921-','APP-'))+'</small></span></button>';
}
function mount(){
 refs.stage=$('officeStage');refs.feed=$('activityFeed');
 renderScene();populateFlows();bind();reset(false);
}
function renderScene(){
 refs.stage.innerHTML=sceneSvg()+'<div id="stationOverlay"></div><div id="studentLayer"></div><div id="escortLayer"></div><div class="handoff-toast" id="handoffToast"></div>';
 const overlay=$('stationOverlay');
 Object.keys(STATIONS).forEach(st=>{
   const s=STATIONS[st],hit=document.createElement('button');
   hit.type='button';hit.className='station-hit';hit.id='hit-'+st;hit.style.left=s.x+'%';hit.style.top=s.y+'%';
   hit.setAttribute('aria-label',s.title+' counter');hit.onclick=()=>openDrawer(activeAgentForStation(st));overlay.appendChild(hit);
 });
 const control1=document.createElement('button');control1.className='control-hit orchestrator';control1.onclick=()=>openDrawer('orchestrator');overlay.appendChild(control1);
 const control2=document.createElement('button');control2.className='control-hit human';control2.onclick=()=>openDrawer('human');overlay.appendChild(control2);
}
function populateFlows(){
 const sel=$('scenarioSelect');sel.innerHTML='';
 Object.keys(FLOWS).forEach(k=>{const op=document.createElement('option');op.value=k;op.textContent=FLOWS[k].label;sel.appendChild(op);});
 sel.value=sim.flow;
}
function bind(){
 $('runBtn').onclick=run;$('pauseBtn').onclick=pause;$('resumeBtn').onclick=resume;$('resetBtn').onclick=()=>reset(true);
 $('scenarioSelect').onchange=function(){sim.flow=this.value;};
 $('connectBtn').onclick=connectLiveData;$('adminPassword').onkeydown=e=>{if(e.key==='Enter')connectLiveData();};
 $('drawerClose').onclick=closeDrawer;$('drawerBackdrop').onclick=closeDrawer;
}
function reset(logIt){
 sim.token++;sim.running=false;sim.paused=false;sim.pendingHuman=null;currentApplicant=null;
 if(sim.currentAnimation){try{sim.currentAnimation.cancel();}catch(_){}sim.currentAnimation=null;}
 Object.keys(state).forEach(k=>Object.assign(state[k],{status:'IDLE',caseId:'—',task:'Waiting for event',event:'WAITING',lastAction:'No action yet',nextAction:'Wait for event',workload:0,waitingSince:'—'}));
 appState=DEMO_APPS.map(a=>Object.assign({},a));
 document.querySelectorAll('.moving-pair').forEach(x=>x.remove());
 renderApplicants();clearStationActivity();updatePipeline(null);$('officeStateLabel').textContent='READY';$('activeCaseLabel').textContent='—';$('currentEventLabel').textContent='WAITING';updateButtons();updateCounts();
 if(logIt)addLog('SYSTEM','—','RESET','Campus office reset. Five applications returned to the Admission queue.');
}
function renderApplicants(){
 const layer=$('studentLayer');if(!layer)return;layer.innerHTML=appState.map(applicantHtml).join('');
 appState.forEach((app,i)=>{const el=$('student-'+app.id);el.onclick=()=>showApplicant(app.id);positionApplicant(app,i);});
}
function appPoint(app,idx){
 if(app.station==='queue')return{x:7.0,y:35.0+idx*5.7};
 const s=STATIONS[app.station];if(!s)return{x:50,y:53};
 return{x:s.x,y:s.y<50?53.5:54.7};
}
function positionApplicant(app,idx){
 const el=$('student-'+app.id);if(!el)return;const p=appPoint(app,idx);el.style.left=p.x+'%';el.style.top=p.y+'%';
}
function updateCounts(){
 const waiting=appState.filter(a=>a.status==='waiting').length;
 const q=$('svgQueueCount');if(q)q.textContent=waiting+' waiting';
 if(!sim.running)$('runBtn').textContent=waiting?'▶ Process Next Applicant ('+waiting+' waiting)':'✓ Demo Queue Complete';
 $('metricApplications').textContent=appState.length;
}
function nextApplicant(){return appState.find(a=>a.status==='waiting')||null;}
function showApplicant(id){
 const app=appState.find(a=>a.id===id);if(!app)return;const where=app.station==='queue'?'Admission Queue':(STATIONS[app.station]?.title||app.station);
 toast(app.id,app.name+' · '+app.status.toUpperCase()+' · '+where);
}
function activeAgentForStation(st){
 const active=STATIONS[st].agents.find(a=>['WORKING','RECEIVING','WAITING','HANDOVER','ESCALATION'].includes(state[a].status));
 return active||STATIONS[st].primary;
}
function clearStationActivity(){
 document.querySelectorAll('.scene-station').forEach(x=>x.classList.remove('station-active','station-receiving'));
 Object.keys(STATIONS).forEach(st=>{const t=$('specialist-'+st);if(t)t.textContent=AGENTS[STATIONS[st].primary].code+' · READY';});
}
function setAgent(agent,patch){
 Object.assign(state[agent],patch||{});
 const st=stationForAgent(agent);
 if(st!=='control'){
   const visual=$('visual-'+st),tag=$('specialist-'+st);
   if(visual){visual.classList.toggle('station-active',['WORKING','HANDOVER','ESCALATION'].includes(state[agent].status));visual.classList.toggle('station-receiving',state[agent].status==='RECEIVING');}
   if(tag&&state[agent].status!=='IDLE')tag.textContent=AGENTS[agent].code+' · '+state[agent].status;
 }
 if($('agentDrawer').classList.contains('open')&&$('agentDrawer').dataset.agent===agent)renderDrawer(agent);
}
async function run(){
 if(sim.running)return;const app=nextApplicant();if(!app){toast('QUEUE COMPLETE','All five demo applications have been processed. Press Reset to replay.');return;}
 sim.running=true;sim.token++;currentApplicant=app;app.status='active';const token=sim.token,flow=FLOWS[sim.flow],caseId=app.id;
 $('officeStateLabel').textContent='RUNNING';$('activeCaseLabel').textContent=caseId;renderApplicants();updateButtons();updateCounts();
 addLog('AI Orchestrator',caseId,'APPLICANT CALLED',app.name+' left the Admission queue.');
 for(const step of flow.steps){
   if(token!==sim.token)return;while(sim.paused&&token===sim.token)await new Promise(r=>setTimeout(r,60));if(token!==sim.token)return;
   updatePipeline(step);$('currentEventLabel').textContent=step.event;await execute(step,caseId,token,app);if(token!==sim.token)return;
   if(step.kind==='human'){const d=await waitHuman(token);if(token!==sim.token)return;if(d!=='approve'){sim.running=false;sim.paused=false;app.status='waiting';$('officeStateLabel').textContent='CONTROLLED STOP';renderApplicants();updateButtons();updateCounts();return;}}
   await delay(100,token);
 }
 if(token!==sim.token)return;sim.running=false;app.status='completed';app.station='handover';renderApplicants();$('officeStateLabel').textContent='COMPLETE';$('currentEventLabel').textContent='JOURNEY_COMPLETE';addLog('Management Reporting Agent',caseId,'JOURNEY COMPLETE',app.name+' reached Academic Handover.');updateButtons();updateCounts();
}
async function execute(step,caseId,token,app){
 const target=step.agent||step.to||step.from,targetStation=stationForAgent(target);
 if(step.kind==='event'){
   if(targetStation!=='control'&&app.station!==targetStation)await moveApplicant(app,targetStation,step.agent,token,false);
   setAgent(step.agent,{status:'WORKING',caseId,task:step.task,event:step.event,lastAction:step.action,nextAction:step.next,workload:1});
   toast(step.event,step.message);addLog(AGENTS[step.agent].name,caseId,step.event,step.message);await delay(step.duration,token);return;
 }
 if(step.kind==='handoff'){
   setAgent(step.from,{status:'HANDOVER',caseId,task:step.task,event:step.event,lastAction:'Handing applicant to '+AGENTS[step.to].name,nextAction:step.next});
   setAgent(step.to,{status:'RECEIVING',caseId,task:'Receiving '+step.task,event:step.event,lastAction:'Waiting for applicant',nextAction:step.next});
   const fs=stationForAgent(step.from),ts=stationForAgent(step.to);
   toast(step.event,step.message);addLog(AGENTS[step.from].name+' → '+AGENTS[step.to].name,caseId,step.event,step.message);
   if(ts!=='control'&&fs!==ts)await moveApplicant(app,ts,step.from,token,true);else await flashStation(ts,token);
   setAgent(step.from,{status:'IDLE',caseId:'—',task:'Waiting for event',event:'WAITING',lastAction:'Applicant handed over',nextAction:'Wait for event',workload:0});
   setAgent(step.to,{status:'WORKING',caseId,task:step.task,event:step.event,lastAction:'Applicant accepted',nextAction:step.next,workload:1});return;
 }
 if(step.kind==='human'){
   setAgent(step.from,{status:'ESCALATION',caseId,task:step.task,event:step.event,lastAction:'Escalated to Registrar',nextAction:'Wait for decision'});
   state.human={status:'WORKING',caseId,task:'Decision: '+step.recommendation,event:step.event,lastAction:step.reason,nextAction:'Record decision',workload:1,waitingSince:'—'};
   toast(step.event,'Human authority required');addLog(AGENTS[step.from].name+' → Human Decision Desk',caseId,step.event,step.message);
   sim.paused=true;showHumanDecision(caseId,step);updateButtons();
 }
}
function routePoints(from,to){
 const aisle=54.2,pts=[from];if(Math.abs(from.y-aisle)>1)pts.push({x:from.x,y:aisle});if(Math.abs(to.x-from.x)>1)pts.push({x:to.x,y:aisle});if(Math.abs(to.y-aisle)>1)pts.push(to);return pts;
}
function moveApplicant(app,toStation,escortAgent,token,escort){
 return new Promise(resolve=>{
   const original=$('student-'+app.id),from=appPoint(app,appState.indexOf(app)),s=STATIONS[toStation],to={x:s.x,y:s.y<50?53.5:54.7},pts=routePoints(from,to);
   const pair=document.createElement('div');pair.className='moving-pair';pair.style.left=from.x+'%';pair.style.top=from.y+'%';
   const p=LOOKS[app.look%LOOKS.length],sp=LOOKS[(Object.keys(AGENTS).indexOf(escortAgent)+7)%LOOKS.length];
   pair.innerHTML='<div class="moving-character student" style="--skin:'+p.skin+';--hair:'+p.hair+';--shirt:'+p.shirt+';--accent:'+p.accent+'">'+avatarHtml(app.name,true)+'</div>'+
     (escort&&escortAgent?'<div class="moving-character escort" style="--skin:'+sp.skin+';--hair:'+sp.hair+';--shirt:'+sp.shirt+';--accent:'+sp.accent+'">'+avatarHtml('Staff',false)+'<em>This way →</em></div>':'');
   $('escortLayer').appendChild(pair);if(original)original.style.opacity='0';
   let total=0,lens=[];for(let i=1;i<pts.length;i++){const d=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);lens.push(d);total+=d;}
   let acc=0,frames=[{left:from.x+'%',top:from.y+'%',offset:0}];for(let i=1;i<pts.length;i++){acc+=lens[i-1];frames.push({left:pts[i].x+'%',top:pts[i].y+'%',offset:total?acc/total:1});}
   const anim=pair.animate(frames,{duration:Math.max(850,Math.min(2000,total*40)),easing:'linear',fill:'forwards'});sim.currentAnimation=anim;if(sim.paused)anim.pause();
   const done=()=>{pair.remove();sim.currentAnimation=null;app.station=toStation;renderApplicants();resolve();};anim.onfinish=done;anim.oncancel=done;
 });
}
function avatarHtml(label,student){
 return '<span class="avatar"><i class="hair"></i><i class="head"><em></em></i><i class="body"></i><i class="arm a"></i><i class="arm b"></i><i class="leg a"></i><i class="leg b"></i>'+(student?'<i class="pack"></i>':'<i class="lanyard"></i>')+'</span><span>'+esc(label)+'</span>';
}
function flashStation(st,token){
 return new Promise(resolve=>{const el=$('visual-'+st);if(!el){resolve();return;}el.classList.add('station-pulse');setTimeout(()=>{el.classList.remove('station-pulse');resolve();},360);});
}
function pause(){if(!sim.running||sim.paused)return;sim.paused=true;if(sim.currentAnimation)sim.currentAnimation.pause();$('officeStateLabel').textContent='PAUSED';updateButtons();}
function resume(){if(!sim.running||!sim.paused||sim.pendingHuman)return;sim.paused=false;if(sim.currentAnimation)sim.currentAnimation.play();$('officeStateLabel').textContent='RUNNING';updateButtons();}
function updateButtons(){$('runBtn').disabled=sim.running||!nextApplicant();$('pauseBtn').disabled=!sim.running||sim.paused;$('resumeBtn').disabled=!sim.running||!sim.paused||!!sim.pendingHuman;if(!sim.running)updateCounts();}
function waitHuman(token){return new Promise(resolve=>{if(token!==sim.token){resolve('cancelled');return;}sim.pendingHuman=resolve;updateButtons();});}
function showHumanDecision(caseId,step){
 openDrawer('human');$('drawerGrid').innerHTML='<div class="wide"><small>Case</small><b>'+esc(caseId)+'</b></div><div class="wide"><small>AI Recommendation</small><b>'+esc(step.recommendation)+'</b></div><div class="wide"><small>Reason</small><b>'+esc(step.reason)+'</b></div><div class="wide"><small>Authority Action</small><b><button class="primary-btn" id="hdApprove">Approve</button> <button class="control-btn" id="hdReturn">Return</button> <button class="control-btn" id="hdEvidence">Request Evidence</button></b></div>';
 $('hdApprove').onclick=()=>recordHuman('approve');$('hdReturn').onclick=()=>recordHuman('return');$('hdEvidence').onclick=()=>recordHuman('evidence');
}
function recordHuman(decision){
 if(!sim.pendingHuman)return;const labels={approve:'APPROVED',return:'RETURNED',evidence:'MORE EVIDENCE'};addLog('Human Decision Desk',currentApplicant?.id||'CASE','HUMAN DECISION · '+labels[decision],decision==='approve'?'Approved AI recommendation.':decision==='return'?'Returned case for rework.':'Requested more evidence.');closeDrawer();const r=sim.pendingHuman;sim.pendingHuman=null;sim.paused=false;state.human.status='IDLE';$('officeStateLabel').textContent=decision==='approve'?'RUNNING':'CONTROLLED STOP';updateButtons();r(decision);
}
function updatePipeline(step){
 const v=step?{event:step.event||'—',task:step.task||'—',agent:step.agent?AGENTS[step.agent].name:(step.from?AGENTS[step.from].name:'—'),action:step.action||(step.kind==='handoff'?'Escort applicant to '+AGENTS[step.to].name:'—'),verification:step.verification||(step.kind==='handoff'?'Receiving specialist accepts applicant':'—'),next:step.next||'—'}:{event:'Waiting',task:'—',agent:'—',action:'—',verification:'—',next:'—'};
 Object.keys(v).forEach(k=>{const el=document.querySelector('[data-pipe="'+k+'"]');if(el)el.textContent=v[k];});
}
function toast(event,message){const el=$('handoffToast');if(!el)return;el.classList.remove('show');void el.offsetWidth;el.innerHTML='<small>'+esc(event)+'</small><b>'+esc(message)+'</b>';el.classList.add('show');setTimeout(()=>el.classList.remove('show'),1600);}
function addLog(actor,caseId,event,message){
 const empty=refs.feed.querySelector('.empty-feed');if(empty)empty.remove();const row=document.createElement('div');row.className='feed-row';row.innerHTML='<time>'+esc(clock())+'</time><div><b>'+esc(actor)+'</b><div class="feed-event">'+esc(event)+'</div></div><p>'+esc(caseId)+' · '+esc(message)+'</p>';refs.feed.prepend(row);while(refs.feed.children.length>60)refs.feed.lastElementChild.remove();
}
function openDrawer(agent){$('agentDrawer').dataset.agent=agent;$('agentDrawer').classList.add('open');$('agentDrawer').setAttribute('aria-hidden','false');$('drawerBackdrop').classList.add('open');renderDrawer(agent);}
function closeDrawer(){$('agentDrawer').classList.remove('open');$('agentDrawer').setAttribute('aria-hidden','true');$('drawerBackdrop').classList.remove('open');}
function renderDrawer(agent){
 const a=AGENTS[agent],s=state[agent];if(!a)return;$('drawerAvatar').textContent=a.code;$('drawerRole').textContent=a.role;$('drawerName').textContent=a.name;$('drawerStatus').textContent=s.status;
 $('drawerGrid').innerHTML=card('Current Case',s.caseId)+card('Current Task',s.task)+card('Current Event',s.event)+card('Workload',String(s.workload||0)+' queued')+card('Last Action',s.lastAction,'wide')+card('Next Action',s.nextAction,'wide')+card('Authority',a.authority,'wide')+card('Tools',a.tools.join(' · '),'wide');
}
function card(label,value,cls=''){return '<div class="'+cls+'"><small>'+esc(label)+'</small><b>'+esc(value||'—')+'</b></div>';}
function countRows(data,key){return Array.isArray(data&&data[key])?data[key].length:0;}
async function connectLiveData(){
 const password=$('adminPassword').value.trim();if(!password){toast('LIVE DATA','Enter the admin password first.');return;}const btn=$('connectBtn');btn.disabled=true;btn.textContent='Connecting…';
 try{const response=await fetch('/api/admin-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password})});const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.message||'Unable to connect');const d=payload.data||{};
 $('metricApplications').textContent=countRows(d,'V2_APPLICATIONS');$('metricWorkflow').textContent=countRows(d,'V2_WORKFLOW');$('metricSac').textContent=countRows(d,'V2_SAC_CANDIDATES');$('metricIa').textContent=countRows(d,'V2_ASSESSMENT_PROGRESS');$('metricOrientation').textContent=countRows(d,'V2_ORIENTATION_TRACKING');$('metricProvisioning').textContent=countRows(d,'V2_PROVISIONING');$('metricHandover').textContent=countRows(d,'V2_ACADEMIC_PORTAL');$('dataMode').innerHTML='<i></i> Live Admission Data Connected';toast('LIVE DATA CONNECTED','Operational counts loaded from Admission V2.');addLog('System','LIVE','DATA_CONNECTED','Admission V2 counts connected. Applicant movement remains simulation until live state mapping is enabled.');$('adminPassword').value='';
 }catch(err){toast('CONNECTION FAILED',err.message||'Unable to connect to live data.');}finally{btn.disabled=false;btn.textContent='Connect Live Data';}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();