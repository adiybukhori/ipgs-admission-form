(function(){
'use strict';

const ASSET='https://raw.githubusercontent.com/Two-Weeks-Team/openClawWorld/main/packages/client/public/assets/kenney/';
const CHAR_IMG=ASSET+'characters/characters_spritesheet_rgba.png';
const CHAR_JSON=ASSET+'characters/characters_spritesheet.json';
const INTERIOR=ASSET+'interior/interior_tilemap.png';
const CITY=ASSET+'tiles/city_tilemap.png';

const STATIONS=[
 {id:'admission',num:1,label:'Admission',color:0x2f78d6,x:305,y:245,staff:'npc-greeter'},
 {id:'document',num:2,label:'Document Check',color:0x1f9a78,x:555,y:245,staff:'npc-office-pm'},
 {id:'screening',num:3,label:'Screening',color:0xe87832,x:805,y:245,staff:'npc-meeting-host'},
 {id:'sac',num:4,label:'SAC',color:0x7054c8,x:1055,y:245,staff:'npc-office-pm'},
 {id:'ia',num:5,label:'IA',color:0xcf4f63,x:1305,y:245,staff:'npc-greeter'},
 {id:'prerequisite',num:6,label:'Prerequisite',color:0x168fa5,x:305,y:675,staff:'npc-office-pm'},
 {id:'offer',num:7,label:'Offer & Acceptance',color:0xd59a22,x:555,y:675,staff:'npc-greeter'},
 {id:'orientation',num:8,label:'Orientation',color:0x326bc1,x:805,y:675,staff:'npc-meeting-host'},
 {id:'services',num:9,label:'IT / Library / Moodle',color:0x148a86,x:1055,y:675,staff:'npc-it-help'},
 {id:'handover',num:10,label:'Handover',color:0x7656c5,x:1305,y:675,staff:'npc-office-pm'}
];
const STATION_MAP=Object.fromEntries(STATIONS.map(s=>[s.id,s]));
const QUEUE=[{x:115,y:290},{x:115,y:345},{x:115,y:400},{x:115,y:455},{x:115,y:510}];
const APPS=[
 {id:'APP-01',name:'Alya',tint:0x5a86d7,status:'waiting',station:'queue'},
 {id:'APP-02',name:'Hakim',tint:0x36a076,status:'waiting',station:'queue'},
 {id:'APP-03',name:'Sofia',tint:0xf18746,status:'waiting',station:'queue'},
 {id:'APP-04',name:'Daniel',tint:0x8a64ce,status:'waiting',station:'queue'},
 {id:'APP-05',name:'Nadia',tint:0xd85869,status:'waiting',station:'queue'}
];
let apps=[],gameScene=null,running=false,paused=false;

const ROUTES={
 direct:['admission','document','screening','sac','offer','orientation','services','handover'],
 ia:['admission','document','screening','sac','ia','offer','orientation','services','handover'],
 prerequisite:['admission','document','screening','sac','ia','prerequisite','offer','orientation','services','handover']
};

function interiorIndex(row,col){return row*27+col}
function cityIndex(row,col){return row*37+col}

class OfficeScene extends Phaser.Scene{
 constructor(){super('OfficeScene');this.students={};this.staff={};this.stationGlow={};this.speech=null;}
 preload(){
   this.load.setCORS('anonymous');
   this.load.atlas('chars',CHAR_IMG,CHAR_JSON);
   this.load.spritesheet('interior',INTERIOR,{frameWidth:16,frameHeight:16,spacing:1});
   this.load.spritesheet('city',CITY,{frameWidth:16,frameHeight:16});
 }
 create(){
   gameScene=this;
   this.cameras.main.setBackgroundColor('#f7f2e7');
   this.drawCampus();
   this.drawQueue();
   STATIONS.forEach((s,i)=>this.drawStation(s,i));
   this.drawCenterHub();
   this.drawLounge();
   this.drawWalkways();
   this.resetApplicants();
 }
 drawCampus(){
   const g=this.add.graphics();
   g.fillStyle(0xdaf2fb,1).fillRect(0,0,1600,145);
   g.fillStyle(0xb8834d,1).fillRect(0,137,1600,8);
   g.lineStyle(5,0x7899aa,.35);
   [210,430,800,1170,1390].forEach(x=>g.lineBetween(x,0,x,145));
   g.fillStyle(0xe4cda7,1).fillTriangle(700,62,800,10,900,62).fillRect(715,62,170,77);
   g.fillStyle(0xf2e0c1,1).fillRect(735,72,130,67);
   g.fillStyle(0x365c7c,1).fillRect(785,92,30,47);
   this.add.text(800,65,'IUC CAMPUS',{fontFamily:'Arial',fontSize:'12px',fontStyle:'bold',color:'#6d553d'}).setOrigin(.5);
   const fountain=this.add.sprite(800,124,'city',cityIndex(3,17)).setScale(3);
   fountain.setTint(0xb3e5f2);
   [[350,101],[410,112],[1190,101],[1250,112],[540,114],[1080,114]].forEach((p,i)=>{
     const plant=this.add.sprite(p[0],p[1],'city',cityIndex(8,17+(i%4))).setScale(2.5);
   });
   this.add.rectangle(140,54,190,105,0x173a69).setOrigin(.5);
   this.add.text(140,30,'IUC · IPGS',{fontFamily:'Arial',fontSize:'19px',fontStyle:'bold',color:'#ffffff'}).setOrigin(.5);
   this.add.text(140,55,'PEOPLE · PURPOSE',{fontFamily:'Arial',fontSize:'11px',fontStyle:'bold',color:'#f4d168'}).setOrigin(.5);
   this.add.text(140,76,'BRIGHTER TOMORROWS',{fontFamily:'Arial',fontSize:'8px',color:'#ffffff'}).setOrigin(.5);
   this.add.rectangle(1450,54,180,105,0x205943).setOrigin(.5);
   this.add.text(1450,28,'LEARN',{fontFamily:'Arial',fontSize:'13px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
   this.add.text(1450,53,'BELONG',{fontFamily:'Arial',fontSize:'13px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
   this.add.text(1450,78,'ACHIEVE',{fontFamily:'Arial',fontSize:'13px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
 }
 drawQueue(){
   const g=this.add.graphics();
   g.fillStyle(0xfffefa,1).fillRoundedRect(35,205,155,370,18);
   g.lineStyle(2,0xd6d9d5,1).strokeRoundedRect(35,205,155,370,18);
   this.add.text(112,230,'NEW APPLICATIONS',{fontFamily:'Arial',fontSize:'11px',fontStyle:'bold',color:'#173a69'}).setOrigin(.5);
   this.queueText=this.add.text(112,257,'5 waiting',{fontFamily:'Arial',fontSize:'9px',fontStyle:'bold',color:'#2f78d6',backgroundColor:'#edf4fb',padding:{x:9,y:5}}).setOrigin(.5);
   g.lineStyle(5,0x173a69,1).lineBetween(57,284,167,284).lineBetween(57,545,167,545);
   g.lineStyle(5,0xe85e55,1);for(let x=57;x<167;x+=26){g.lineBetween(x,284,Math.min(x+13,167),284);g.lineBetween(x,545,Math.min(x+13,167),545)}
 }
 drawStation(s,i){
   const top=s.y<450;
   const x=s.x-100,y=s.y-92;
   const g=this.add.graphics();
   g.fillStyle(0xfff8eb,1).fillRoundedRect(x,y,200,174,14);
   g.lineStyle(2,0xd8c8ad,1).strokeRoundedRect(x,y,200,174,14);
   g.fillStyle(s.color,1).fillRoundedRect(x,y,200,43,14).fillRect(x,y+29,200,14);
   g.fillStyle(0xffffff,1).fillCircle(x+23,y+22,14);
   this.add.text(x+23,y+22,String(s.num),{fontFamily:'Arial',fontSize:'15px',fontStyle:'bold',color:'#'+s.color.toString(16).padStart(6,'0')}).setOrigin(.5);
   this.add.text(x+47,y+13,s.label,{fontFamily:'Arial',fontSize:'13px',fontStyle:'bold',color:'#fff'});
   g.fillStyle(0xf0dfc5,1).fillRoundedRect(x+12,y+52,176,66,7);
   const shelfFrames=[interiorIndex(10,0),interiorIndex(10,1),interiorIndex(10,2),interiorIndex(10,3)];
   shelfFrames.forEach((frame,k)=>this.add.sprite(x+38+k*39,y+72,'interior',frame).setScale(2.1));
   const staff=this.add.sprite(s.x,y+94,'chars',s.staff).setScale(3.2);
   staff.setDepth(12);this.staff[s.id]=staff;
   this.add.sprite(s.x-32,y+100,'interior',interiorIndex(7,0)).setScale(2.2);
   this.add.sprite(s.x+34,y+100,'interior',interiorIndex(7,1)).setScale(2.2);
   this.add.sprite(x+24,y+103,'city',cityIndex(1,17)).setScale(2.0);
   this.add.sprite(x+176,y+103,'city',cityIndex(1,18)).setScale(2.0);
   g.fillStyle(0xb97840,1).fillRoundedRect(x-4,y+118,208,44,7);
   g.lineStyle(2,0x794b2c,1).strokeRoundedRect(x-4,y+118,208,44,7);
   this.add.text(s.x,y+140,s.label.toUpperCase(),{fontFamily:'Arial',fontSize:'9px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
   const chair=this.add.sprite(s.x,y+180,'interior',interiorIndex(7,2)).setScale(2.6);chair.setDepth(8);
   const glow=this.add.rectangle(s.x,y+136,216,182,0xffffff,0).setStrokeStyle(3,0x2ebd89,0).setDepth(20);
   this.stationGlow[s.id]=glow;
 }
 drawCenterHub(){
   const g=this.add.graphics();
   g.fillStyle(0x204d82,1).fillEllipse(800,490,310,135);
   g.lineStyle(5,0xd8b45f,1).strokeEllipse(800,490,310,135);
   this.add.text(800,466,'IUC · IPGS',{fontFamily:'Arial',fontSize:'10px',letterSpacing:4,color:'#eed783'}).setOrigin(.5);
   this.add.text(800,494,'ADMISSIONS HUB',{fontFamily:'Arial',fontSize:'22px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
   this.add.text(800,519,'FROM APPLICATION TO ACADEMIC HANDOVER',{fontFamily:'Arial',fontSize:'8px',fontStyle:'bold',color:'#c6dbef'}).setOrigin(.5);
 }
 drawLounge(){
   const g=this.add.graphics();
   g.fillStyle(0x7f9daf,1).fillRoundedRect(1378,428,175,118,24);
   g.fillStyle(0xa9bdc9,1).fillRoundedRect(1390,442,70,66,16).fillRoundedRect(1472,442,70,66,16);
   this.add.text(1465,527,'STUDENT LOUNGE',{fontFamily:'Arial',fontSize:'9px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
   this.add.sprite(1428,470,'interior',interiorIndex(2,9)).setScale(2.1);
   this.add.sprite(1505,470,'interior',interiorIndex(2,10)).setScale(2.1);
 }
 drawWalkways(){
   const g=this.add.graphics();
   g.lineStyle(5,0xffffff,.7);
   [430,680,930,1180].forEach(x=>{g.lineBetween(x,455,x+60,455);g.fillStyle(0xffffff,.7).fillTriangle(x+60,455,x+46,446,x+46,464)});
   [430,680,930,1180].forEach(x=>{g.lineBetween(x+60,550,x,550);g.fillStyle(0xffffff,.7).fillTriangle(x,550,x+14,541,x+14,559)});
   g.lineStyle(3,0xffffff,.45).lineBetween(205,550,1370,550);
 }
 resetApplicants(){
   Object.values(this.students).forEach(o=>o.destroy(true));this.students={};
   apps=APPS.map(a=>({...a}));
   apps.forEach((app,i)=>this.createApplicant(app,i));
   this.updateQueue();
 }
 createApplicant(app,i){
   const p=QUEUE[i],container=this.add.container(p.x,p.y).setDepth(30);
   const shadow=this.add.ellipse(0,15,32,10,0x31465a,.15);
   const sprite=this.add.sprite(0,0,'chars','player-human').setScale(3.2).setTint(app.tint);
   const tag=this.add.text(28,-4,app.name+'\n'+app.id,{fontFamily:'Arial',fontSize:'7px',fontStyle:'bold',color:'#173a69',backgroundColor:'#ffffff',padding:{x:5,y:3}}).setOrigin(0,.5);
   container.add([shadow,sprite,tag]);container.setSize(70,45);container.setInteractive(new Phaser.Geom.Rectangle(-25,-24,90,48),Phaser.Geom.Rectangle.Contains);
   container.on('pointerdown',()=>this.showBubble(container.x+20,container.y-35,app.name+' · '+app.id));
   this.students[app.id]=container;
 }
 updateQueue(){
   const waiting=apps.filter(a=>a.status==='waiting').length;if(this.queueText)this.queueText.setText(waiting+' waiting');
   document.getElementById('waitingCount').textContent=waiting;
 }
 showBubble(x,y,text){
   if(this.speech)this.speech.destroy(true);
   const c=this.add.container(x,y).setDepth(100);
   const bg=this.add.rectangle(0,0,140,32,0xffffff,1).setStrokeStyle(1,0xb7c7d6);
   const t=this.add.text(0,0,text,{fontFamily:'Arial',fontSize:'8px',fontStyle:'bold',color:'#2f5f93'}).setOrigin(.5);
   c.add([bg,t]);this.speech=c;this.time.delayedCall(1500,()=>{if(this.speech===c){c.destroy(true);this.speech=null}});
 }
 setStationState(id,active){
   Object.entries(this.stationGlow).forEach(([k,g])=>g.setStrokeStyle(3,k===id&&active?0x2ebd89:0x2ebd89,k===id&&active?1:0));
 }
 async moveStudent(app,toId,escort=true){
   const student=this.students[app.id],target=STATION_MAP[toId];if(!student||!target)return;
   const dest={x:target.x,y:target.y<450?410:565};
   const routeY=535;
   const points=[{x:student.x,y:student.y},{x:student.x,y:routeY},{x:dest.x,y:routeY},{x:dest.x,y:dest.y}];
   let escortObj=null;
   if(escort){
     escortObj=this.add.container(student.x-36,student.y).setDepth(29);
     const sp=this.add.sprite(0,0,'chars','npc-greeter').setScale(3.0);
     const label=this.add.text(0,-32,'This way →',{fontFamily:'Arial',fontSize:'7px',fontStyle:'bold',color:'#2f78d6',backgroundColor:'#fff',padding:{x:4,y:2}}).setOrigin(.5);
     escortObj.add([sp,label]);
   }
   for(let i=1;i<points.length;i++){
     await new Promise(resolve=>{
       const duration=Math.max(180,Phaser.Math.Distance.Between(points[i-1].x,points[i-1].y,points[i].x,points[i].y)*1.9);
       this.tweens.add({targets:[student].concat(escortObj?[escortObj]:[]),x:(t)=>points[i].x+(t===escortObj?-36:0),y:points[i].y,duration,ease:'Linear',onComplete:resolve});
     });
     while(paused)await new Promise(r=>setTimeout(r,80));
   }
   if(escortObj)escortObj.destroy(true);
   app.station=toId;
 }
}

const config={type:Phaser.AUTO,parent:'phaser-office',width:1600,height:900,backgroundColor:'#f7f2e7',pixelArt:true,antialias:false,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[OfficeScene]};
new Phaser.Game(config);

function log(actor,event,msg){
 const feed=document.getElementById('activityFeed');feed.querySelector('.empty')?.remove();
 const row=document.createElement('div');row.className='feed-row';row.innerHTML='<time>'+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})+'</time><b>'+actor+'</b><small>'+event+'</small><p>'+msg+'</p>';feed.prepend(row);
}
function eventUI(app,station,event,task,agent,action,next){
 document.getElementById('eventName').textContent=event;document.getElementById('eventApplicant').textContent=app?app.name+' · '+app.id:'—';document.getElementById('eventTask').textContent=task||'—';document.getElementById('eventAgent').textContent=agent||'—';document.getElementById('eventAction').textContent=action||'—';document.getElementById('eventNext').textContent=next||'—';document.getElementById('activeCase').textContent=app?app.id:'—';document.getElementById('activeStation').textContent=station||'—';
}
function nextWaiting(){return apps.find(a=>a.status==='waiting');}
async function processNext(){
 if(running||!gameScene)return;const app=nextWaiting();if(!app)return;
 running=true;app.status='active';gameScene.updateQueue();document.getElementById('processBtn').disabled=true;document.getElementById('pauseBtn').disabled=false;
 const route=ROUTES[document.getElementById('workflowSelect').value]||ROUTES.prerequisite;
 log('AI Orchestrator','APPLICANT_CALLED',app.name+' leaves the Admission queue.');
 for(let i=0;i<route.length;i++){
   while(paused)await new Promise(r=>setTimeout(r,80));
   const station=route[i],s=STATION_MAP[station];
   eventUI(app,s.label,'PROCESSING_'+station.toUpperCase(),'Process '+s.label,s.label+' Staff Agent','Escort and process applicant',route[i+1]?STATION_MAP[route[i+1]].label:'Journey complete');
   gameScene.setStationState(station,true);gameScene.showBubble(s.x,s.y<450?390:585,i===0?'Next please!':'Reviewing…');
   await gameScene.moveStudent(app,station,i>0);
   log(s.label+' Staff Agent','PROCESSING',app.name+' is being processed at '+s.label+'.');
   await new Promise(r=>setTimeout(r,600));
   gameScene.setStationState(station,false);
 }
 app.status='completed';running=false;document.getElementById('processBtn').disabled=!nextWaiting();document.getElementById('pauseBtn').disabled=true;gameScene.updateQueue();eventUI(app,'Handover','JOURNEY_COMPLETE','Completed admission journey','Management Reporting Agent','Update operational record','—');log('Management Reporting Agent','JOURNEY_COMPLETE',app.name+' reached Academic Handover.');
}
function resetAll(){
 if(!gameScene)return;running=false;paused=false;gameScene.resetApplicants();document.getElementById('processBtn').disabled=false;document.getElementById('pauseBtn').disabled=true;document.getElementById('pauseBtn').textContent='Pause';eventUI(null,'Admission Queue','Waiting','—','—','—','—');document.getElementById('activityFeed').innerHTML='<div class="empty">No activity yet.</div>';
}
async function connectLive(){
 const pass=document.getElementById('adminPassword').value.trim();if(!pass)return;
 const btn=document.getElementById('connectBtn');btn.disabled=true;btn.textContent='Connecting…';
 try{const r=await fetch('/api/admin-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pass})});const p=await r.json();if(!r.ok||!p.ok)throw new Error(p.message||'Unable to connect');const n=Array.isArray(p.data?.V2_APPLICATIONS)?p.data.V2_APPLICATIONS.length:0;document.querySelector('.mode-pill').innerHTML='<i></i> Live ACC connected · '+n+' applications';log('System','LIVE_DATA_CONNECTED','Admission V2 operational data connected read-only.');document.getElementById('adminPassword').value='';}catch(e){log('System','LIVE_DATA_FAILED',e.message||'Connection failed');}finally{btn.disabled=false;btn.textContent='Connect Live ACC';}
}
document.getElementById('processBtn').onclick=processNext;
document.getElementById('resetBtn').onclick=resetAll;
document.getElementById('pauseBtn').onclick=function(){paused=!paused;this.textContent=paused?'Resume':'Pause';};
document.getElementById('connectBtn').onclick=connectLive;
document.getElementById('adminPassword').onkeydown=e=>{if(e.key==='Enter')connectLive();};
})();