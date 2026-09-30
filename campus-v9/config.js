export const WORLD={w:3680,h:2400};
const make=(id,label,num,x,y,w,h,color,tasks,mode='individual',capacity=1)=>({id,label,num,x,y,w,h,color,tasks,processingMode:mode,capacity,waitingPolicy:id==='orientation'?'inside-room':'central-lounge',door:{x:x+w/2,y:y+h},point:{x:x+w/2,y:y+h-100}});
export const STATIONS=[
make('admission','Admission',1,320,420,560,520,'#2468a4',['Application Receiver Agent','Application PDF Agent','Student Folder Agent','Agent Notification Agent']),
make('document','Document Check',2,960,420,560,520,'#278879',['Document Check Agent','Research Intent Agent']),
make('screening','Screening',3,1600,420,560,520,'#bf7b40',['SkyVialing Prospect Agent','Fee Group Agent','Registry Queue Agent','Qualification Screening Agent','Detailed Admission Review Agent','Pre-SAC Compliance Agent']),
make('sac','SAC · Committee',4,2240,420,560,520,'#73629f',['SAC Session Agent','SAC Case Pack / Form-01 Agent','SAC Outcome Agent'],'batch',4),
make('ia','Internal Assessment',5,2880,420,560,520,'#b86374',['IA Invitation Agent','IA Assessment Agent','IA Result Agent']),
make('prerequisite','Prerequisite',6,180,1550,560,650,'#258a96',['Prerequisite Enrolment Agent','Prerequisite Moodle Agent','Prerequisite Class Agent','Prerequisite Assessment Agent','Prerequisite Completion Document Agent'],'batch',4),
make('offer','Offer & Acceptance',7,820,1550,540,650,'#b69241',['LOA Agent','Acceptance Agent']),
make('orientation','Orientation Hall',8,1440,1480,800,760,'#356eaa',['Orientation Invitation Agent','Orientation Attendance Agent','Orientation Follow-up Agent'],'batch',30),
make('services','Student Services',9,2320,1550,640,650,'#25847c',['IT Account Agent','Library Agent','Moodle Account Agent'],'parallel',30),
make('handover','Academic Office',10,3040,1550,500,650,'#756498',['Handover Preparation Agent','Academic Handover Agent','Audit Agent','Management Reporting Agent'],'parallel',30)
];
for(const s of STATIONS)if(s.y>1000){s.door={x:s.x+s.w/2,y:s.y};s.point={x:s.x+s.w/2,y:s.y+140};}
export const BY_ID=Object.fromEntries(STATIONS.map(s=>[s.id,s]));
export const ROUTES={direct:['admission','document','screening','sac','offer','orientation','services','handover'],ia:['admission','document','screening','sac','ia','offer','orientation','services','handover'],prerequisite:['admission','document','screening','sac','ia','prerequisite','offer','orientation','services','handover']};
export const STATES=['WAITING_NEW_APPLICATION','PROCESSING','WAITING_NEXT_STATION','WAITING_HUMAN_DECISION','WAITING_SAC_SESSION','WAITING_IA','WAITING_PREREQUISITE','WAITING_ORIENTATION','ORIENTATION_IN_PROGRESS','FOLLOW_UP_PROCESSING','PROVISIONING','HANDOVER','COMPLETED'];
export const DEMO=[['Alya','ia'],['Hakim','direct'],['Sofia','prerequisite'],['Daniel','direct'],['Nadia','ia'],['Amir','direct'],['Mei','direct'],['Farah','prerequisite'],['Ryan','direct'],['Zara','ia'],['Adam','direct'],['Hana','direct']];
