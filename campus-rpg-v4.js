(function(){
'use strict';

const ASSET='https://raw.githubusercontent.com/Two-Weeks-Team/openClawWorld/main/packages/client/public/assets/kenney/';
const CHAR_IMG=ASSET+'characters/characters_spritesheet_rgba.png';
const CHAR_JSON=ASSET+'characters/characters_spritesheet.json';
const INTERIOR=ASSET+'interior/interior_tilemap.png';
const CITY=ASSET+'tiles/city_tilemap.png';

const WORLD={w:2600,h:1500,corridorY:760};
const ROOM={w:400,h:300};
const STAFF_FRAMES=['npc-greeter','npc-office-pm','npc-it-help','npc-meeting-host','npc-barista','npc-security','npc-ranger','npc-fountain-keeper','player-agent'];
const APPLICANT_FRAMES=['player-human','npc-greeter','npc-office-pm','npc-meeting-host','npc-barista'];

const STATIONS={
 admission:{num:1,label:'Admission',color:0x2f78d6,x:380,y:385,side:'top',tasks:['Application Receiver','Application PDF Agent','Student Folder Agent','Agent Notification Agent']},
 document:{num:2,label:'Document Check',color:0x1f9a78,x:850,y:385,side:'top',tasks:['Document Check Agent','Research Intent Agent']},
 screening:{num:3,label:'Screening',color:0xe87832,x:1320,y:385,side:'top',tasks:['SkyVialing Prospect Agent','Fee Group Agent','Registry Queue Agent','Qualification Screening Agent','Admission Review Agent','Pre-SAC Compliance Agent']},
 sac:{num:4,label:'SAC',color:0x7054c8,x:1790,y:385,side:'top',tasks:['SAC Session Agent','SAC Case Pack Agent','SAC Outcome Agent']},
 ia:{num:5,label:'IA',color:0xcf4f63,x:2260,y:385,side:'top',tasks:['IA Invitation Agent','IA Assessment Agent','IA Result Agent']},
 prerequisite:{num:6,label:'Prerequisite',color:0x168fa5,x:380,y:1115,side:'bottom',tasks:['Prerequisite Enrolment Agent','Prerequisite Moodle Agent','Prerequisite Class Agent','Prerequisite Assessment Agent','Prerequisite Documents Agent']},
 offer:{num:7,label:'Offer & Acceptance',color:0xd59a22,x:850,y:1115,side:'bottom',tasks:['LOA Agent','Acceptance Agent']},
 orientation:{num:8,label:'Orientation',color:0x326bc1,x:1320,y:1115,side:'bottom',tasks:['Orientation Invitation Agent','Orientation Attendance Agent','Orientation Follow-up Agent']},
 services:{num:9,label:'IT / Library / Moodle',color:0x148a86,x:1790,y:1115,side:'bottom',tasks:['IT Account Agent','Library Agent','Moodle Account Agent']},
 handover:{num:10,label:'Academic Handover',color:0x7656c5,x:2260,y:1115,side:'bottom',tasks:['Handover Preparation Agent','Academic Handover Agent','Audit Trail Agent','Management Reporting Agent']}
};

const ROUTES={
 direct:['admission','document','screening','sac','offer','orientation','services','handover'],
 ia:['admission','document','screening','sac','ia','offer','orientation','services','handover'],
 prerequisite:['admission','document','screening','sac','ia','prerequisite','offer','orientation','services','handover']
};

const QUEUE=[
 {x:160,y:650},{x:160,y:705},{x:160,y:760},{x:160,y:815},{x:160,y:870}
];

const APP_TEMPLATE=[
 {id:'APP-01',name:'Alya',frame:'player-human',tint:0x7297e5},
 {id:'APP-02',name:'Hakim',frame:'npc-greeter',tint:0x55a77d},
 {id:'APP-03',name:'Sofia',frame:'npc-office-pm',tint:0xe99459},
 {id:'APP-04',name:'Daniel',frame:'npc-meeting-host',tint:0x9a79da},
 {id:'APP-05',name:'Nadia',frame:'npc-barista',tint:0xdc7180}
];

let sceneRef=null,apps=[],running=false,paused=false,followActive=true,currentApp=null;

function cityIndex(r,c){return r*37+c}
function interiorIndex(r,c){return r*27+c}
function hex(n){return '#'+n.toString(16).padStart(6,'0')}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
function dom(id){return document.getElementById(id)}

class CampusScene extends Phaser.Scene{
 constructor(){super('CampusScene');this.students={};this.staffByStation={};this.homeBySprite=new Map();this.activeRing=null;this.tip=null;this.dragging=false;this.dragStart=null;this.minimap=null;}
 preload(){
   this.load.setCORS('anonymous');
   this.load.atlas('chars',CHAR_IMG,CHAR_JSON);
   this.load.spritesheet('interior',INTERIOR,{frameWidth:16,frameHeight:16,spacing:1});
   this.load.spritesheet('city',CITY,{frameWidth:16,frameHeight:16,spacing:1});
 }
 create(){
   sceneRef=this;
   this.cameras.main.setBounds(0,0,WORLD.w,WORLD.h).setZoom(1.04).centerOn(650,760);
   this.drawWorld();
   this.drawEntrance();
   Object.entries(STATIONS).forEach(([id,s])=>this.drawRoom(id,s));
   this.drawAtrium();
   this.drawLounge();
   this.createApplicants();
   this.createCameraControls();
   this.createMinimap();
   this.updateDepths();
 }
 drawWorld(){
   this.add.tileSprite(WORLD.w/2,WORLD.h/2,WORLD.w,WORLD.h,'city',cityIndex(0,8)).setTileScale(2,2).setDepth(0);
   const g=this.add.graphics().setDepth(1);
   g.fillStyle(0xdaf2fb,1).fillRect(0,0,WORLD.w,190);
   g.fillStyle(0x7a9aac,.4);
   [220,520,820,1120,1420,1720,2020,2320].forEach(x=>g.fillRect(x,0,6,190));
   g.fillStyle(0xb77f49,1).fillRect(0,182,WORLD.w,10);
   g.fillStyle(0xe5cfaa,1).fillTriangle(1130,142,1300,28,1470,142).fillRect(1160,142,280,40);
   g.fillStyle(0xf1dfc1,1).fillRect(1192,112,216,70);
   g.fillStyle(0x355d7c,1).fillRect(1280,128,40,54);
   this.add.text(1300,100,'IUC CAMPUS',{fontFamily:'Arial',fontSize:'18px',fontStyle:'bold',color:'#6a523b'}).setOrigin(.5).setDepth(2);
   this.add.sprite(1300,169,'city',cityIndex(3,17)).setScale(3.2).setTint(0xaee5f2).setDepth(2);
   [450,560,750,1850,2040,2160].forEach((x,i)=>this.add.sprite(x,150,'city',cityIndex(8,17+(i%4))).setScale(2.7).setDepth(2));
   g.fillStyle(0x173a69,1).fillRoundedRect(40,35,230,105,12);
   this.add.text(155,63,'IUC · IPGS',{fontFamily:'Arial',fontSize:'21px',fontStyle:'bold',color:'#fff'}).setOrigin(.5).setDepth(3);
   this.add.text(155,92,'PEOPLE · PURPOSE',{fontFamily:'Arial',fontSize:'12px',fontStyle:'bold',color:'#efd06d'}).setOrigin(.5).setDepth(3);
   this.add.text(155,116,'BRIGHTER TOMORROWS',{fontFamily:'Arial',fontSize:'9px',color:'#fff'}).setOrigin(.5).setDepth(3);
   g.fillStyle(0x205943,1).fillRoundedRect(WORLD.w-270,35,230,105,12);
   this.add.text(WORLD.w-155,61,'LEARN',{fontFamily:'Arial',fontSize:'14px',fontStyle:'bold',color:'#fff'}).setOrigin(.5).setDepth(3);
   this.add.text(WORLD.w-155,88,'BELONG',{fontFamily:'Arial',fontSize:'14px',fontStyle:'bold',color:'#fff'}).setOrigin(.5).setDepth(3);
   this.add.text(WORLD.w-155,115,'ACHIEVE',{fontFamily:'Arial',fontSize:'14px',fontStyle:'bold',color:'#fff'}).setOrigin(.5).setDepth(3);

   g.fillStyle(0xe5ded2,1).fillRect(100,610,WORLD.w-200,300);
   g.fillStyle(0xf6f1e8,1).fillRect(100,630,WORLD.w-200,260);
   g.lineStyle(3,0xd2c9bb,1).strokeRect(100,630,WORLD.w-200,260);
   g.lineStyle(3,0xffffff,.72).lineBetween(140,WORLD.corridorY,2460,WORLD.corridorY);
   for(let x=300;x<2400;x+=235){
     g.fillStyle(0xffffff,.68).fillTriangle(x+34,WORLD.corridorY,x+18,WORLD.corridorY-9,x+18,WORLD.corridorY+9);
   }
 }
 drawEntrance(){
   const g=this.add.graphics().setDepth(5);
   g.fillStyle(0xfffefa,1).fillRoundedRect(45,540,190,430,20);
   g.lineStyle(3,0xd7d7cf,1).strokeRoundedRect(45,540,190,430,20);
   this.add.text(140,570,'NEW APPLICATIONS',{fontFamily:'Arial',fontSize:'14px',fontStyle:'bold',color:'#173a69'}).setOrigin(.5).setDepth(6);
   this.queueText=this.add.text(140,600,'5 waiting',{fontFamily:'Arial',fontSize:'10px',fontStyle:'bold',color:'#2f78d6',backgroundColor:'#edf4fb',padding:{x:9,y:5}}).setOrigin(.5).setDepth(6);
   g.lineStyle(6,0x173a69,1).lineBetween(72,628,208,628).lineBetween(72,935,208,935);
   g.lineStyle(6,0xe45757,1);
   for(let x=72;x<208;x+=28){g.lineBetween(x,628,Math.min(x+14,208),628);g.lineBetween(x,935,Math.min(x+14,208),935);}
   this.add.text(140,955,'ADMISSION QUEUE',{fontFamily:'Arial',fontSize:'9px',fontStyle:'bold',color:'#8b7560'}).setOrigin(.5).setDepth(6);
   this.add.sprite(95,915,'city',cityIndex(1,17)).setScale(2.4).setDepth(6);
   this.add.sprite(188,915,'city',cityIndex(1,18)).setScale(2.4).setDepth(6);
 }
 roomRect(s){
   return{x:s.x-ROOM.w/2,y:s.y-ROOM.h/2,w:ROOM.w,h:ROOM.h};
 }
 servicePoint(s){
   return{x:s.x,y:s.side==='top'?610:910};
 }
 primaryHome(s){
   return{x:s.x,y:s.side==='top'?525:995};
 }
 drawRoom(id,s){
   const r=this.roomRect(s);
   const floorFrame=s.side==='top'?cityIndex(0,8):cityIndex(0,12);
   this.add.tileSprite(s.x,s.y,ROOM.w-18,ROOM.h-18,'city',floorFrame).setTileScale(2,2).setDepth(3);
   const g=this.add.graphics().setDepth(4);
   g.fillStyle(0x6d7d86,1).fillRect(r.x,r.y,ROOM.w,18);
   g.fillStyle(0x6d7d86,1).fillRect(r.x,r.y,18,ROOM.h);
   g.fillStyle(0x6d7d86,1).fillRect(r.x+ROOM.w-18,r.y,18,ROOM.h);
   if(s.side==='top'){
     g.fillStyle(0x6d7d86,1).fillRect(r.x,r.y+ROOM.h-18,ROOM.w/2-48,18).fillRect(s.x+48,r.y+ROOM.h-18,ROOM.w/2-48,18);
   }else{
     g.fillStyle(0x6d7d86,1).fillRect(r.x,r.y,ROOM.w/2-48,18).fillRect(s.x+48,r.y,ROOM.w/2-48,18);
     g.fillStyle(0x6d7d86,1).fillRect(r.x,r.y+ROOM.h-18,ROOM.w,18);
   }
   g.fillStyle(s.color,1).fillRoundedRect(r.x+22,r.y+24,ROOM.w-44,40,9);
   g.fillStyle(0xffffff,1).fillCircle(r.x+47,r.y+44,15);
   this.add.text(r.x+47,r.y+44,String(s.num),{fontFamily:'Arial',fontSize:'16px',fontStyle:'bold',color:hex(s.color)}).setOrigin(.5).setDepth(7);
   this.add.text(r.x+72,r.y+33,s.label,{fontFamily:'Arial',fontSize:'14px',fontStyle:'bold',color:'#fff'}).setDepth(7);
   this.add.text(r.x+72,r.y+50,s.tasks.length+' specialist agents',{fontFamily:'Arial',fontSize:'8px',color:'#f2f5f7'}).setDepth(7);

   this.add.sprite(r.x+42,r.y+90,'city',cityIndex(1,17)).setScale(2.4).setDepth(8);
   this.add.sprite(r.x+ROOM.w-42,r.y+90,'city',cityIndex(1,18)).setScale(2.4).setDepth(8);

   const staffList=[];
   const cols=Math.min(3,Math.max(2,Math.ceil(s.tasks.length/2)));
   const rows=Math.ceil(s.tasks.length/cols);
   const startX=s.x-(cols-1)*58;
   const startY=s.y-18-(rows-1)*48;
   s.tasks.forEach((task,i)=>{
     const col=i%cols,row=Math.floor(i/cols);
     const deskX=startX+col*116, deskY=startY+row*96;
     const desk=this.add.sprite(deskX,deskY+18,'interior',interiorIndex(0,i%4)).setScale(2.6).setDepth(8);
     const chair=this.add.sprite(deskX,deskY+46,'interior',interiorIndex(7,i%4)).setScale(2.2).setDepth(8);
     const frame=STAFF_FRAMES[(s.num+i)%STAFF_FRAMES.length];
     const npc=this.add.sprite(deskX,deskY-4,'chars',frame).setScale(3.3).setDepth(10).setInteractive({useHandCursor:true});
     npc.setTint(Phaser.Display.Color.Interpolate.ColorWithColor({r:255,g:255,b:255},{r:(s.color>>16)&255,g:(s.color>>8)&255,b:s.color&255},100,18).color);
     npc.taskName=task;npc.stationId=id;npc.home={x:deskX,y:deskY-4};
     npc.on('pointerover',()=>this.showTip(npc.x,npc.y-42,task));
     npc.on('pointerout',()=>this.hideTip());
     this.homeBySprite.set(npc,{x:npc.x,y:npc.y});
     staffList.push(npc);
   });
   this.staffByStation[id]=staffList;

   const p=this.primaryHome(s);
   const counterY=s.side==='top'?r.y+ROOM.h-58:r.y+74;
   g.fillStyle(0xb77740,1).fillRoundedRect(s.x-80,counterY-22,160,44,7);
   g.lineStyle(2,0x75492c,1).strokeRoundedRect(s.x-80,counterY-22,160,44,7);
   this.add.text(s.x,counterY,s.label.toUpperCase(),{fontFamily:'Arial',fontSize:'9px',fontStyle:'bold',color:'#fff'}).setOrigin(.5).setDepth(9);
   const consultation=this.add.sprite(s.x,s.side==='top'?counterY+42:counterY-42,'interior',interiorIndex(7,2)).setScale(2.5).setDepth(8);
   const sp=this.servicePoint(s);
   this.add.ellipse(sp.x,sp.y,62,20,0x9b8c78,.18).setDepth(5);
   this.add.text(sp.x,sp.y+18,'SERVICE POINT',{fontFamily:'Arial',fontSize:'7px',fontStyle:'bold',color:'#9a8a76'}).setOrigin(.5).setDepth(6);
 }
 drawAtrium(){
   const g=this.add.graphics().setDepth(5);
   g.fillStyle(0x204d82,1).fillEllipse(1320,760,360,150);
   g.lineStyle(6,0xd8b45f,1).strokeEllipse(1320,760,360,150);
   g.lineStyle(2,0xf2e2a5,1).strokeEllipse(1320,760,340,132);
   this.add.text(1320,728,'IUC · IPGS',{fontFamily:'Arial',fontSize:'11px',letterSpacing:4,color:'#f0d87d'}).setOrigin(.5).setDepth(6);
   this.add.text(1320,758,'ADMISSIONS HUB',{fontFamily:'Arial',fontSize:'24px',fontStyle:'bold',color:'#fff'}).setOrigin(.5).setDepth(6);
   this.add.text(1320,787,'APPLICATION → ACADEMIC HANDOVER',{fontFamily:'Arial',fontSize:'9px',fontStyle:'bold',color:'#cce0ef'}).setOrigin(.5).setDepth(6);
   this.add.sprite(1105,755,'city',cityIndex(1,17)).setScale(2.6).setDepth(6);
   this.add.sprite(1535,755,'city',cityIndex(1,18)).setScale(2.6).setDepth(6);
 }
 drawLounge(){
   const g=this.add.graphics().setDepth(5);
   g.fillStyle(0x7b9aaf,1).fillRoundedRect(2210,650,270,205,25);
   g.fillStyle(0xa7bbc8,1).fillRoundedRect(2232,680,100,86,18).fillRoundedRect(2350,680,100,86,18);
   this.add.text(2345,820,'STUDENT LOUNGE',{fontFamily:'Arial',fontSize:'11px',fontStyle:'bold',color:'#fff'}).setOrigin(.5).setDepth(8);
   this.add.sprite(2285,722,'interior',interiorIndex(2,9)).setScale(2.5).setDepth(8);
   this.add.sprite(2398,722,'interior',interiorIndex(2,10)).setScale(2.5).setDepth(8);
   this.add.sprite(2340,670,'city',cityIndex(1,17)).setScale(2.5).setDepth(8);
 }
 createApplicants(){
   apps=APP_TEMPLATE.map((a,i)=>({...a,status:'waiting',station:'queue',queueIndex:i}));
   apps.forEach((app,i)=>this.spawnApplicant(app,QUEUE[i]));
   this.updateQueueCount();
 }
 spawnApplicant(app,pos){
   const c=this.add.container(pos.x,pos.y).setDepth(30);
   const shadow=this.add.ellipse(0,17,38,12,0x2d4051,.18);
   const sprite=this.add.sprite(0,0,'chars',app.frame).setScale(3.6).setTint(app.tint);
   const tag=this.add.text(29,-3,app.name+'\n'+app.id,{fontFamily:'Arial',fontSize:'8px',fontStyle:'bold',color:'#173a69',backgroundColor:'#ffffff',padding:{x:5,y:3}}).setOrigin(0,.5);
   c.add([shadow,sprite,tag]);c.bodySprite=sprite;c.setSize(100,56);c.setInteractive(new Phaser.Geom.Rectangle(-24,-28,120,56),Phaser.Geom.Rectangle.Contains,{useHandCursor:true});
   c.on('pointerdown',()=>this.showTip(c.x+35,c.y-46,app.name+' · '+app.id+' · '+app.status.toUpperCase()));
   this.students[app.id]=c;
 }
 showTip(x,y,text){
   this.hideTip();
   const c=this.add.container(x,y).setDepth(200);
   const w=Math.max(130,Math.min(270,text.length*6.2+22));
   const bg=this.add.rectangle(0,0,w,36,0xffffff,1).setStrokeStyle(1,0xb7c8d6);
   const t=this.add.text(0,0,text,{fontFamily:'Arial',fontSize:'9px',fontStyle:'bold',color:'#2f5f93'}).setOrigin(.5);
   c.add([bg,t]);this.tip=c;
 }
 hideTip(){if(this.tip){this.tip.destroy(true);this.tip=null;}}
 bubbleAt(x,y,text,duration=1200){
   this.showTip(x,y,text);
   this.time.delayedCall(duration,()=>this.hideTip());
 }
 updateQueueCount(){
   const n=apps.filter(a=>a.status==='waiting').length;
   if(this.queueText)this.queueText.setText(n+' waiting');
   dom('waitingCount').textContent=n;
 }
 async walkContainer(c,points,follow=false){
   if(!c)return;
   const spr=c.bodySprite||c.list?.find(o=>o.texture);
   const bob=spr?this.tweens.add({targets:spr,y:-4,duration:120,yoyo:true,repeat:-1,ease:'Sine.easeInOut'}):null;
   for(let i=1;i<points.length;i++){
     while(paused)await wait(70);
     if(follow&&followActive)this.cameras.main.pan(points[i].x,points[i].y,420,'Sine.easeInOut');
     const d=Phaser.Math.Distance.Between(c.x,c.y,points[i].x,points[i].y);
     await new Promise(resolve=>this.tweens.add({targets:c,x:points[i].x,y:points[i].y,duration:Math.max(180,d*1.7),ease:'Linear',onComplete:resolve}));
   }
   if(bob)bob.stop();if(spr)spr.y=0;
 }
 async walkSprite(spr,points){
   if(!spr)return;
   const bob=this.tweens.add({targets:spr,scaleY:3.55,duration:120,yoyo:true,repeat:-1,ease:'Sine.easeInOut'});
   for(let i=1;i<points.length;i++){
     while(paused)await wait(70);
     const d=Phaser.Math.Distance.Between(spr.x,spr.y,points[i].x,points[i].y);
     await new Promise(resolve=>this.tweens.add({targets:spr,x:points[i].x,y:points[i].y,duration:Math.max(160,d*1.6),ease:'Linear',onComplete:resolve}));
   }
   bob.stop();spr.setScale(3.3);
 }
 corridorRoute(from,to){
   return[{x:from.x,y:from.y},{x:from.x,y:WORLD.corridorY},{x:to.x,y:WORLD.corridorY},{x:to.x,y:to.y}];
 }
 async callFromQueue(app){
   const admission=STATIONS.admission,student=this.students[app.id],staff=this.staffByStation.admission[0],service=this.servicePoint(admission);
   const home={...staff.home};
   const approach={x:student.x+55,y:student.y};
   await this.walkSprite(staff,[home,{x:admission.x,y:610},{x:admission.x,y:WORLD.corridorY},{x:approach.x,y:WORLD.corridorY},approach]);
   this.bubbleAt(staff.x,staff.y-48,app.name+', next please!',1050);
   await wait(700);
   await Promise.all([
     this.walkSprite(staff,[approach,{x:approach.x,y:WORLD.corridorY},{x:admission.x,y:WORLD.corridorY},{x:admission.x,y:610},home]),
     this.walkContainer(student,[{x:student.x,y:student.y},{x:student.x,y:WORLD.corridorY},{x:admission.x,y:WORLD.corridorY},service],true)
   ]);
   app.station='admission';
 }
 async escort(app,fromId,toId){
   const from=STATIONS[fromId],to=STATIONS[toId],student=this.students[app.id];
   const staffList=this.staffByStation[fromId],staff=staffList[staffList.length-1]||staffList[0],home={...staff.home};
   const start=this.servicePoint(from),dest=this.servicePoint(to);
   await this.walkSprite(staff,[home,start]);
   this.bubbleAt(staff.x,staff.y-48,'Let\'s go to '+to.label+' →',1050);
   await wait(500);
   const route=this.corridorRoute(start,dest);
   await Promise.all([this.walkSprite(staff,route),this.walkContainer(student,route,true)]);
   this.bubbleAt(dest.x,dest.y-58,'Welcome to '+to.label,850);
   const back=this.corridorRoute(dest,start).concat([home]);
   await this.walkSprite(staff,back);
   app.station=toId;
 }
 async activateTask(stationId,index,app){
   const s=STATIONS[stationId],staff=this.staffByStation[stationId][index],task=s.tasks[index];
   if(!staff)return;
   if(this.activeRing)this.activeRing.destroy();
   this.activeRing=this.add.ellipse(staff.x,staff.y+15,48,22,0x2ebd89,.18).setStrokeStyle(3,0x2ebd89,1).setDepth(9);
   staff.setDepth(40);
   this.bubbleAt(staff.x,staff.y-48,task.replace(' Agent',''),520);
   updateEvent(app,s.label,'TASK_PROCESSING',task,task,'Processing '+task, index===s.tasks.length-1?'Ready for next station':s.tasks[index+1]);
   log(task,'TASK_PROCESSING',app.name+' is being processed by '+task+'.');
   await wait(430);
   staff.setDepth(10);if(this.activeRing){this.activeRing.destroy();this.activeRing=null;}
 }
 async processStation(app,id){
   const s=STATIONS[id];
   dom('activeStation').textContent=s.label;
   if(followActive)this.cameras.main.pan(this.servicePoint(s).x,this.servicePoint(s).y,500,'Sine.easeInOut');
   for(let i=0;i<s.tasks.length;i++){while(paused)await wait(70);await this.activateTask(id,i,app);}
 }
 createCameraControls(){
   const cam=this.cameras.main,keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
   this.input.on('wheel',(pointer,objects,dx,dy)=>{
     const z=Phaser.Math.Clamp(cam.zoom-dy*0.0005,.55,1.55);cam.setZoom(z);
   });
   this.input.on('pointerdown',p=>{if(p.leftButtonDown()){this.dragging=true;this.dragStart={x:p.x,y:p.y,sx:cam.scrollX,sy:cam.scrollY};}});
   this.input.on('pointerup',()=>{this.dragging=false;});
   this.input.on('pointermove',p=>{if(this.dragging&&this.dragStart){cam.scrollX=this.dragStart.sx-(p.x-this.dragStart.x)/cam.zoom;cam.scrollY=this.dragStart.sy-(p.y-this.dragStart.y)/cam.zoom;}});
   this.events.on('update',()=>{
     const speed=9/cam.zoom;
     if(keys.W.isDown||keys.UP.isDown)cam.scrollY-=speed;
     if(keys.S.isDown||keys.DOWN.isDown)cam.scrollY+=speed;
     if(keys.A.isDown||keys.LEFT.isDown)cam.scrollX-=speed;
     if(keys.D.isDown||keys.RIGHT.isDown)cam.scrollX+=speed;
     this.updateDepths();
   });
 }
 updateDepths(){
   Object.values(this.students).forEach(c=>c.setDepth(30+c.y/100));
   Object.values(this.staffByStation).flat().forEach(s=>s.setDepth(10+s.y/100));
 }
 createMinimap(){
   const mini=this.cameras.add(1335,18,245,135).setZoom(.095).setBackgroundColor('#152638').setName('minimap');
   mini.centerOn(WORLD.w/2,WORLD.h/2);mini.setAlpha(.92);this.minimap=mini;
 }
 fullMap(){const cam=this.cameras.main;cam.setZoom(.58);cam.centerOn(WORLD.w/2,WORLD.h/2);}
 focus(app){
   const c=this.students[app.id];if(!c)return;const cam=this.cameras.main;cam.setZoom(Math.max(cam.zoom,.94));cam.pan(c.x,c.y,450,'Sine.easeInOut');
 }
 resetApplicants(){
   Object.values(this.students).forEach(c=>c.destroy(true));this.students={};
   this.staffByStation&&Object.values(this.staffByStation).flat().forEach(s=>{const h=this.homeBySprite.get(s);if(h){s.setPosition(h.x,h.y);s.setScale(3.3);}});
   this.createApplicants();
 }
}

new Phaser.Game({
 type:Phaser.AUTO,parent:'rpg-stage',width:1600,height:900,pixelArt:true,antialias:false,roundPixels:true,
 backgroundColor:'#111b24',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
 scene:[CampusScene]
});

function updateEvent(app,station,event,agent,task,action,next){
 dom('eventName').textContent=event;dom('eventApplicant').textContent=app?app.name+' · '+app.id:'—';dom('eventAgent').textContent=agent||'—';dom('eventTask').textContent=task||'—';dom('eventAction').textContent=action||'—';dom('eventNext').textContent=next||'—';dom('activeCase').textContent=app?app.id:'—';dom('activeStation').textContent=station||'—';
}
function log(actor,event,msg){
 const feed=dom('activityFeed');feed.querySelector('.empty')?.remove();const row=document.createElement('div');row.className='feed-row';row.innerHTML='<time>'+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})+'</time><b>'+actor+'</b><small>'+event+'</small><p>'+msg+'</p>';feed.prepend(row);while(feed.children.length>55)feed.lastElementChild.remove();
}
function nextWaiting(){return apps.find(a=>a.status==='waiting');}
async function processNext(){
 if(running||!sceneRef)return;const app=nextWaiting();if(!app)return;
 running=true;currentApp=app;app.status='active';sceneRef.updateQueueCount();dom('processBtn').disabled=true;dom('pauseBtn').disabled=false;dom('activeCase').textContent=app.id;log('AI Orchestrator','APPLICANT_CALLED',app.name+' is called from the Admission queue.');
 sceneRef.focus(app);
 await sceneRef.callFromQueue(app);
 const route=ROUTES[dom('routeSelect').value]||ROUTES.prerequisite;
 await sceneRef.processStation(app,'admission');
 for(let i=1;i<route.length;i++){
   const from=route[i-1],to=route[i];
   updateEvent(app,STATIONS[from].label,'HANDOFF',STATIONS[from].tasks.slice(-1)[0],'Escort applicant','Walk through campus corridor',STATIONS[to].label);
   log(STATIONS[from].label+' Staff','HANDOFF',app.name+' is escorted to '+STATIONS[to].label+'.');
   await sceneRef.escort(app,from,to);
   await sceneRef.processStation(app,to);
 }
 app.status='completed';running=false;sceneRef.updateQueueCount();dom('processBtn').disabled=!nextWaiting();dom('pauseBtn').disabled=true;updateEvent(app,'Academic Handover','JOURNEY_COMPLETE','Management Reporting Agent','Complete lifecycle','Applicant handed to Academic','—');log('Management Reporting Agent','JOURNEY_COMPLETE',app.name+' completed the admission journey.');sceneRef.bubbleAt(sceneRef.students[app.id].x,sceneRef.students[app.id].y-55,'Journey complete ✓',1600);
}
function resetAll(){
 running=false;paused=false;currentApp=null;if(!sceneRef)return;sceneRef.resetApplicants();dom('processBtn').disabled=false;dom('pauseBtn').disabled=true;dom('pauseBtn').textContent='Pause';dom('activityFeed').innerHTML='<div class="empty">No activity yet.</div>';updateEvent(null,'Entrance','Waiting for applicant','—','—','—','—');sceneRef.cameras.main.setZoom(1.04).centerOn(650,760);
}
function zoom(delta){if(!sceneRef)return;const cam=sceneRef.cameras.main;cam.setZoom(Phaser.Math.Clamp(cam.zoom+delta,.55,1.55));}
async function connectLive(){
 const pass=dom('adminPassword').value.trim();if(!pass)return;const btn=dom('connectBtn');btn.disabled=true;btn.textContent='Connecting…';
 try{const r=await fetch('/api/admin-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pass})});const p=await r.json();if(!r.ok||!p.ok)throw new Error(p.message||'Unable to connect');const n=Array.isArray(p.data?.V2_APPLICATIONS)?p.data.V2_APPLICATIONS.length:0;dom('modeBadge').textContent='LIVE ACC · '+n;document.querySelector('.status-pill').innerHTML='<i></i> Live ACC connected';log('System','LIVE_DATA_CONNECTED',n+' Admission V2 application records available read-only.');dom('adminPassword').value='';}catch(e){log('System','LIVE_DATA_FAILED',e.message||'Connection failed');}finally{btn.disabled=false;btn.textContent='Connect Live ACC';}
}

dom('processBtn').onclick=processNext;
dom('pauseBtn').onclick=function(){paused=!paused;this.textContent=paused?'Resume':'Pause';};
dom('resetBtn').onclick=resetAll;
dom('followBtn').onclick=function(){followActive=!followActive;this.classList.toggle('active-toggle',followActive);this.textContent=followActive?'Follow Active':'Free Camera';if(followActive&&currentApp)sceneRef?.focus(currentApp);};
dom('fullMapBtn').onclick=()=>sceneRef?.fullMap();
dom('zoomInBtn').onclick=()=>zoom(.12);
dom('zoomOutBtn').onclick=()=>zoom(-.12);
dom('connectBtn').onclick=connectLive;
dom('adminPassword').onkeydown=e=>{if(e.key==='Enter')connectLive();};
})();