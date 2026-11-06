(function(){
'use strict';

const OFFICE_ASSET='https://raw.githubusercontent.com/ashawareb/the-office/master/web/public/assets/';
const CHAR_NAMES=['Adam','Alex','Amelia','Bob'];
const WORLD={w:2700,h:1540,corridorY:770};
const ROOM={w:410,h:300};
const TILE=32;
const FLOOR_COLS=14;

const STATIONS={
 admission:{num:1,label:'Admission',color:0x2f78d6,x:390,y:385,side:'top',floorRow:6,tasks:['Application Receiver','Application PDF Agent','Student Folder Agent','Agent Notification Agent']},
 document:{num:2,label:'Document Check',color:0x1f9a78,x:870,y:385,side:'top',floorRow:10,tasks:['Document Check Agent','Research Intent Agent']},
 screening:{num:3,label:'Screening',color:0xe87832,x:1350,y:385,side:'top',floorRow:0,tasks:['SkyVialing Prospect Agent','Fee Group Agent','Registry Queue Agent','Qualification Screening Agent','Admission Review Agent','Pre-SAC Compliance Agent']},
 sac:{num:4,label:'SAC',color:0x7054c8,x:1830,y:385,side:'top',floorRow:4,tasks:['SAC Session Agent','SAC Case Pack Agent','SAC Outcome Agent']},
 ia:{num:5,label:'IA',color:0xcf4f63,x:2310,y:385,side:'top',floorRow:12,tasks:['IA Invitation Agent','IA Assessment Agent','IA Result Agent']},
 prerequisite:{num:6,label:'Prerequisite',color:0x168fa5,x:390,y:1155,side:'bottom',floorRow:2,tasks:['Prerequisite Enrolment Agent','Prerequisite Moodle Agent','Prerequisite Class Agent','Prerequisite Assessment Agent','Prerequisite Documents Agent']},
 offer:{num:7,label:'Offer & Acceptance',color:0xd59a22,x:870,y:1155,side:'bottom',floorRow:6,tasks:['LOA Agent','Acceptance Agent']},
 orientation:{num:8,label:'Orientation',color:0x326bc1,x:1350,y:1155,side:'bottom',floorRow:10,tasks:['Orientation Invitation Agent','Orientation Attendance Agent','Orientation Follow-up Agent']},
 services:{num:9,label:'IT / Library / Moodle',color:0x148a86,x:1830,y:1155,side:'bottom',floorRow:12,tasks:['IT Account Agent','Library Agent','Moodle Account Agent']},
 handover:{num:10,label:'Academic Handover',color:0x7656c5,x:2310,y:1155,side:'bottom',floorRow:0,tasks:['Handover Preparation Agent','Academic Handover Agent','Audit Trail Agent','Management Reporting Agent']}
};

const ROUTES={
 direct:['admission','document','screening','sac','offer','orientation','services','handover'],
 ia:['admission','document','screening','sac','ia','offer','orientation','services','handover'],
 prerequisite:['admission','document','screening','sac','ia','prerequisite','offer','orientation','services','handover']
};

const QUEUE=[{x:150,y:635},{x:150,y:700},{x:150,y:765},{x:150,y:830},{x:150,y:895}];
const APPS=[
 {id:'APP-01',name:'Alya',base:'Amelia',tint:0xffffff},
 {id:'APP-02',name:'Hakim',base:'Adam',tint:0xd7f2df},
 {id:'APP-03',name:'Sofia',base:'Alex',tint:0xffe0cf},
 {id:'APP-04',name:'Daniel',base:'Bob',tint:0xdcd7ff},
 {id:'APP-05',name:'Nadia',base:'Amelia',tint:0xffd8e0}
];

const ORIENTATION_SEATS=[
 {x:1300,y:1215},{x:1350,y:1215},{x:1400,y:1215},{x:1325,y:1260},{x:1375,y:1260}
];
const GROUP_OFFSETS=[{x:-42,y:-20},{x:0,y:-20},{x:42,y:-20},{x:-22,y:20},{x:22,y:20}];

let sceneRef=null,apps=[],orientationQueue=[],running=false,paused=false,followActive=true,currentApp=null,audioCtx=null;

function dom(id){return document.getElementById(id)}
function wait(ms){return new Promise(r=>setTimeout(r,ms))}
function hex(n){return '#'+n.toString(16).padStart(6,'0')}
function floorFrame(row,col){return (row+(col%2))*FLOOR_COLS+(col%7)}

function chime(kind='call'){
 try{
   audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
   const now=audioCtx.currentTime;
   const seq=kind==='complete'?[523.25,659.25,783.99]:kind==='handoff'?[392,493.88]:[659.25,783.99];
   seq.forEach((f,i)=>{
     const o=audioCtx.createOscillator(),g=audioCtx.createGain();
     o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,now+i*.1);
     g.gain.exponentialRampToValueAtTime(.08,now+i*.1+.02);
     g.gain.exponentialRampToValueAtTime(.0001,now+i*.1+.18);
     o.connect(g).connect(audioCtx.destination);o.start(now+i*.1);o.stop(now+i*.1+.2);
   });
 }catch(_){}
}

class CampusScene extends Phaser.Scene{
 constructor(){
   super('CampusScene');
   this.students={};this.staffByStation={};this.staffHomes=new Map();this.tip=null;this.activeRing=null;this.ambient=[];this.dragging=false;this.dragStart=null;this.furn={};this.orientationSeatMarkers=[];this.batchBanner=null;
 }
 preload(){
   this.load.setCORS('anonymous');
   CHAR_NAMES.forEach(name=>{
     this.load.spritesheet(name+'-walk',OFFICE_ASSET+'characters/'+name+'_16x16.png',{frameWidth:16,frameHeight:32});
     this.load.spritesheet(name+'-idle',OFFICE_ASSET+'characters/'+name+'_idle_anim_16x16.png',{frameWidth:16,frameHeight:32});
     if(name!=='Bob')this.load.spritesheet(name+'-sit',OFFICE_ASSET+'characters/'+name+'_sit_16x16.png',{frameWidth:16,frameHeight:32});
   });
   this.load.spritesheet('floor',OFFICE_ASSET+'tiles/floorswalls_LRK.png',{frameWidth:16,frameHeight:16});
   this.load.image('furn-living',OFFICE_ASSET+'furniture/livingroom_LRK.png');
   this.load.image('furn-decor',OFFICE_ASSET+'furniture/decorations_LRK.png');
   this.load.image('furn-cabinets',OFFICE_ASSET+'furniture/cabinets_LRK.png');
 }
 create(){
   sceneRef=this;
   this.createAnimations();
   this.createFurnitureTextures();
   this.cameras.main.setBounds(0,0,WORLD.w,WORLD.h).setZoom(1.05).centerOn(720,770);
   this.drawCampusShell();
   this.drawEntrance();
   Object.entries(STATIONS).forEach(([id,s])=>this.drawRoom(id,s));
   this.drawOrientationWaitingArea();
   this.drawAtrium();
   this.drawLounge();
   this.drawCoffeeCorner();
   this.createApplicants();
   this.createAmbientStudents();
   this.createCameraControls();
   this.createMinimap();
 }
 createAnimations(){
   CHAR_NAMES.forEach(name=>{
     this.anims.create({key:name+'-idle-anim',frames:this.anims.generateFrameNumbers(name+'-idle',{start:0,end:3}),frameRate:3,repeat:-1,yoyo:true});
     this.anims.create({key:name+'-walk-anim',frames:this.anims.generateFrameNumbers(name+'-walk',{start:0,end:5}),frameRate:8,repeat:-1});
     if(name!=='Bob')this.anims.create({key:name+'-sit-anim',frames:[{key:name+'-sit',frame:0}],frameRate:1,repeat:0});
   });
 }
 createFurnitureTextures(){
   const crops=[
     ['bookshelf','furn-cabinets',0,0,48,64],
     ['plant','furn-decor',48,48,16,32],
     ['plant-small','furn-decor',32,48,16,32],
     ['floor-lamp','furn-decor',0,0,16,48],
     ['table-lamp','furn-decor',96,0,16,32],
     ['painting','furn-decor',96,48,48,32],
     ['clock','furn-decor',0,96,16,16],
     ['low-cabinet','furn-cabinets',688,0,48,32],
     ['sofa','furn-living',0,0,64,48]
   ];
   crops.forEach(([key,src,x,y,w,h])=>{
     if(this.textures.exists(key))return;
     const image=this.textures.get(src).getSourceImage();
     const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
     const ctx=canvas.getContext('2d');if(!ctx)return;
     ctx.drawImage(image,x,y,w,h,0,0,w,h);this.textures.addCanvas(key,canvas);
   });
 }
 placeFurniture(key,x,y,scale=2,depth=10){
   const img=this.add.image(x,y,key).setScale(scale).setDepth(depth);
   return img;
 }
 drawCampusShell(){
   const g=this.add.graphics().setDepth(0);
   g.fillStyle(0xdaf2fb,1).fillRect(0,0,WORLD.w,190);
   g.fillStyle(0xb57d48,1).fillRect(0,182,WORLD.w,10);
   g.fillStyle(0x6e90a2,.38);[220,520,820,1120,1420,1720,2020,2320,2560].forEach(x=>g.fillRect(x,0,6,190));
   g.fillStyle(0xe4cda8,1).fillTriangle(1190,145,1350,32,1510,145).fillRect(1220,145,260,37);
   g.fillStyle(0xf0dfc4,1).fillRect(1250,112,200,70);g.fillStyle(0x355d7c,1).fillRect(1330,128,40,54);
   this.add.text(1350,100,'IUC CAMPUS',{fontFamily:'Arial',fontSize:'18px',fontStyle:'bold',color:'#6a523b'}).setOrigin(.5).setDepth(2);
   this.add.ellipse(1350,166,78,24,0x91d6e8,1).setDepth(1);this.add.circle(1350,155,8,0xbcecf7).setDepth(2);
   this.tweens.add({targets:this.add.circle(1350,143,4,0xd9f8ff).setDepth(3),y:154,alpha:.2,duration:900,yoyo:true,repeat:-1});
   [420,545,720,1960,2110,2260].forEach((x,i)=>{const c=this.add.circle(x,147,26,0x5fa866).setDepth(1);this.add.rectangle(x,177,8,30,0x8b6844).setDepth(1);this.tweens.add({targets:c,scaleX:1.05,duration:1800+i*100,yoyo:true,repeat:-1});});
   g.fillStyle(0x173a69,1).fillRoundedRect(38,34,235,108,12);
   this.add.text(155,64,'IUC · IPGS',{fontFamily:'Arial',fontSize:'21px',fontStyle:'bold',color:'#fff'}).setOrigin(.5).setDepth(3);
   this.add.text(155,92,'PEOPLE · PURPOSE',{fontFamily:'Arial',fontSize:'12px',fontStyle:'bold',color:'#f0d16b'}).setOrigin(.5).setDepth(3);
   this.add.text(155,117,'BRIGHTER TOMORROWS',{fontFamily:'Arial',fontSize:'9px',color:'#fff'}).setOrigin(.5).setDepth(3);
   g.fillStyle(0x205943,1).fillRoundedRect(WORLD.w-273,34,235,108,12);
   ['LEARN','BELONG','ACHIEVE'].forEach((t,i)=>this.add.text(WORLD.w-155,61+i*27,t,{fontFamily:'Arial',fontSize:'14px',fontStyle:'bold',color:'#fff'}).setOrigin(.5).setDepth(3));
   this.drawCorridor();
 }
 drawCorridor(){
   const g=this.add.graphics().setDepth(2);
   g.fillStyle(0xe5ded2,1).fillRoundedRect(90,610,WORLD.w-180,320,18);
   for(let y=630;y<910;y+=TILE){
     for(let x=105;x<WORLD.w-105;x+=TILE){
       const frame=floorFrame(6,Math.floor(x/TILE)+Math.floor(y/TILE));
       this.add.sprite(x+16,y+16,'floor',frame).setScale(2).setDepth(2);
     }
   }
   g.lineStyle(4,0xcabda9,.9).strokeRoundedRect(90,610,WORLD.w-180,320,18);
   g.lineStyle(3,0xffffff,.72).lineBetween(135,WORLD.corridorY,WORLD.w-135,WORLD.corridorY);
   for(let x=310;x<WORLD.w-180;x+=240)g.fillStyle(0xffffff,.68).fillTriangle(x+32,WORLD.corridorY,x+15,WORLD.corridorY-9,x+15,WORLD.corridorY+9);
 }
 drawEntrance(){
   const g=this.add.graphics().setDepth(6);
   g.fillStyle(0xfffefa,1).fillRoundedRect(38,535,205,455,20);g.lineStyle(3,0xd7d7cf,1).strokeRoundedRect(38,535,205,455,20);
   this.add.text(140,565,'NEW APPLICATIONS',{fontFamily:'Arial',fontSize:'14px',fontStyle:'bold',color:'#173a69'}).setOrigin(.5).setDepth(7);
   this.queueText=this.add.text(140,596,'5 waiting',{fontFamily:'Arial',fontSize:'10px',fontStyle:'bold',color:'#2f78d6',backgroundColor:'#edf4fb',padding:{x:9,y:5}}).setOrigin(.5).setDepth(7);
   g.lineStyle(6,0x173a69,1).lineBetween(72,625,210,625).lineBetween(72,952,210,952);g.lineStyle(6,0xe45757,1);
   for(let x=72;x<210;x+=28){g.lineBetween(x,625,Math.min(x+14,210),625);g.lineBetween(x,952,Math.min(x+14,210),952);}
   this.placeFurniture('plant',82,930,2,9);this.placeFurniture('plant-small',205,930,2,9);
   this.add.text(140,973,'ADMISSION QUEUE',{fontFamily:'Arial',fontSize:'9px',fontStyle:'bold',color:'#8b7560'}).setOrigin(.5).setDepth(8);
 }
 roomRect(s){return{x:s.x-ROOM.w/2,y:s.y-ROOM.h/2,w:ROOM.w,h:ROOM.h}}
 servicePoint(s){return{x:s.x,y:s.side==='top'?605:935}}
 doorInside(s){return{x:s.x,y:s.side==='top'?520:1020}}
 staffAisle(s){return{x:s.x,y:s.y}}
 drawRoom(id,s){
   const r=this.roomRect(s);
   for(let yy=r.y+18;yy<r.y+r.h-18;yy+=TILE){
     for(let xx=r.x+18;xx<r.x+r.w-18;xx+=TILE){
       const frame=floorFrame(s.floorRow,Math.floor(xx/TILE)+Math.floor(yy/TILE));
       this.add.sprite(xx+16,yy+16,'floor',frame).setScale(2).setDepth(3);
     }
   }
   const g=this.add.graphics().setDepth(5);
   const wall=0x596872;g.fillStyle(wall,1).fillRect(r.x,r.y,ROOM.w,16).fillRect(r.x,r.y,16,ROOM.h).fillRect(r.x+ROOM.w-16,r.y,16,ROOM.h);
   const gap=90;
   if(s.side==='top')g.fillRect(r.x,r.y+ROOM.h-16,ROOM.w/2-gap/2,16).fillRect(s.x+gap/2,r.y+ROOM.h-16,ROOM.w/2-gap/2,16);
   else g.fillRect(r.x,r.y,ROOM.w/2-gap/2,16).fillRect(s.x+gap/2,r.y,ROOM.w/2-gap/2,16).fillRect(r.x,r.y+ROOM.h-16,ROOM.w,16);
   g.fillStyle(s.color,1).fillRoundedRect(r.x+22,r.y+24,ROOM.w-44,40,9);g.fillStyle(0xffffff,1).fillCircle(r.x+47,r.y+44,15);
   this.add.text(r.x+47,r.y+44,String(s.num),{fontFamily:'Arial',fontSize:'16px',fontStyle:'bold',color:hex(s.color)}).setOrigin(.5).setDepth(8);
   this.add.text(r.x+72,r.y+33,s.label,{fontFamily:'Arial',fontSize:'14px',fontStyle:'bold',color:'#fff'}).setDepth(8);
   this.add.text(r.x+72,r.y+50,s.tasks.length+' specialist agents',{fontFamily:'Arial',fontSize:'8px',color:'#edf4f7'}).setDepth(8);

   this.placeFurniture('bookshelf',r.x+54,r.y+104,1.15,9);this.placeFurniture('bookshelf',r.x+ROOM.w-54,r.y+104,1.15,9);
   this.placeFurniture('plant-small',r.x+92,r.y+104,1.7,9);this.placeFurniture('plant',r.x+ROOM.w-92,r.y+104,1.7,9);
   this.placeFurniture('painting',s.x,r.y+92,1.15,9);
   this.placeFurniture('clock',s.x+88,r.y+92,1.7,9);

   const staff=[];
   const n=s.tasks.length;
   const leftCount=Math.ceil(n/2);
   s.tasks.forEach((task,i)=>{
     const left=i<leftCount,idx=left?i:i-leftCount,count=left?leftCount:n-leftCount;
     const sx=s.x+(left?-105:105), sy=s.y-54+(count===1?54:idx*(108/(count-1)));
     this.drawDesk(sx,sy,s.color,i);
     const base=CHAR_NAMES[(s.num+i)%CHAR_NAMES.length];
     const key=base!=='Bob'?base+'-sit':base+'-idle';
     const frame=0;
     const spr=this.add.sprite(sx,sy-24,key,frame).setScale(2.7).setDepth(18).setInteractive({useHandCursor:true});
     spr.taskName=task;spr.stationId=id;spr.baseName=base;spr.home={x:sx,y:sy-24};spr.isSitting=base!=='Bob';
     spr.on('pointerover',()=>this.showTip(spr.x,spr.y-46,task));spr.on('pointerout',()=>this.hideTip());
     staff.push(spr);this.staffHomes.set(spr,{x:spr.x,y:spr.y});
   });
   this.staffByStation[id]=staff;
   const counterY=s.side==='top'?r.y+ROOM.h-57:r.y+73;
   g.fillStyle(0xb77740,1).fillRoundedRect(s.x-86,counterY-22,172,44,7);g.lineStyle(2,0x75492c,1).strokeRoundedRect(s.x-86,counterY-22,172,44,7);
   this.add.text(s.x,counterY,s.label.toUpperCase(),{fontFamily:'Arial',fontSize:'9px',fontStyle:'bold',color:'#fff'}).setOrigin(.5).setDepth(12);
   this.add.ellipse(this.servicePoint(s).x,this.servicePoint(s).y,70,22,0x8e7e69,.18).setDepth(4);
 }
 drawOrientationWaitingArea(){
   const s=STATIONS.orientation,r=this.roomRect(s);
   const g=this.add.graphics().setDepth(13);
   g.fillStyle(0x7656c5,.10).fillRoundedRect(s.x-92,r.y+178,184,96,12);
   g.lineStyle(2,0x7656c5,.42).strokeRoundedRect(s.x-92,r.y+178,184,96,12);
   this.add.text(s.x,r.y+190,'WAITING FOR NEXT ORIENTATION SESSION',{fontFamily:'Arial',fontSize:'8px',fontStyle:'bold',color:'#6045a7'}).setOrigin(.5).setDepth(14);
   ORIENTATION_SEATS.forEach((p,i)=>{
     const seat=this.add.rectangle(p.x,p.y+16,30,13,0x667e94).setStrokeStyle(1,0x42586e).setDepth(12);
     const dot=this.add.circle(p.x,p.y+27,4,0xd8b45f,.85).setDepth(13);
     this.orientationSeatMarkers.push(seat,dot);
   });
   this.add.text(s.x,r.y+264,'Students wait here together until the scheduled cohort session starts',{fontFamily:'Arial',fontSize:'7px',color:'#7a6a96'}).setOrigin(.5).setDepth(14);
 }
 drawDesk(x,y,color,i){
   const g=this.add.graphics().setDepth(11);
   g.fillStyle(0x8b6914,1).fillRoundedRect(x-34,y,68,17,3);g.fillStyle(0x5c4400,1).fillRect(x-27,y+15,5,13).fillRect(x+22,y+15,5,13);
   g.fillStyle(0x1a1f2b,1).fillRoundedRect(x-15,y-16,30,22,3);g.fillStyle(0x75b8d3,.82).fillRect(x-11,y-12,22,13);
   this.tweens.add({targets:g,alpha:.86,duration:900+i*110,yoyo:true,repeat:-1});
   this.add.rectangle(x,y+28,32,12,0x566f86).setDepth(10);
 }
 drawAtrium(){
   const g=this.add.graphics().setDepth(7);
   g.fillStyle(0x204d82,1).fillEllipse(1350,770,380,158);g.lineStyle(6,0xd8b45f,1).strokeEllipse(1350,770,380,158);g.lineStyle(2,0xf2e2a5,1).strokeEllipse(1350,770,355,137);
   this.add.text(1350,735,'IUC · IPGS',{fontFamily:'Arial',fontSize:'11px',letterSpacing:4,color:'#f0d87d'}).setOrigin(.5).setDepth(8);
   this.add.text(1350,767,'ADMISSIONS HUB',{fontFamily:'Arial',fontSize:'25px',fontStyle:'bold',color:'#fff'}).setOrigin(.5).setDepth(8);
   this.add.text(1350,800,'APPLICATION → ACADEMIC HANDOVER',{fontFamily:'Arial',fontSize:'9px',fontStyle:'bold',color:'#cce0ef'}).setOrigin(.5).setDepth(8);
   this.placeFurniture('plant',1120,770,2,9);this.placeFurniture('plant-small',1580,770,2,9);
 }
 drawLounge(){
   const g=this.add.graphics().setDepth(7);g.fillStyle(0x7b9aaf,1).fillRoundedRect(2260,660,300,200,26);g.fillStyle(0xa8bdca,1).fillRoundedRect(2280,690,112,78,18).fillRoundedRect(2410,690,112,78,18);
   this.placeFurniture('sofa',2335,727,1.15,9);this.placeFurniture('sofa',2460,727,1.15,9);
   this.placeFurniture('plant',2520,685,2,10);this.add.text(2410,825,'STUDENT LOUNGE',{fontFamily:'Arial',fontSize:'11px',fontStyle:'bold',color:'#fff'}).setOrigin(.5).setDepth(10);
 }
 drawCoffeeCorner(){
   const x=1780,y=770,g=this.add.graphics().setDepth(9);g.fillStyle(0x6b4226,1).fillRoundedRect(x-50,y-28,100,56,8);g.fillStyle(0x333333,1).fillRoundedRect(x-28,y-18,32,34,4);g.fillStyle(0xffffff,1).fillRoundedRect(x+16,y-5,18,18,3);
   this.add.text(x,y+42,'COFFEE POINT',{fontFamily:'Arial',fontSize:'8px',fontStyle:'bold',color:'#8d765e'}).setOrigin(.5).setDepth(10);
   for(let i=0;i<3;i++){const steam=this.add.circle(x-14+i*8,y-28,3,0xffffff,.4).setDepth(10);this.tweens.add({targets:steam,y:y-58,alpha:0,duration:1500,delay:i*420,repeat:-1});}
 }
 createApplicants(){
   orientationQueue=[];
   apps=APPS.map((a,i)=>({...a,status:'waiting',station:'queue',queueIndex:i}));
   apps.forEach((app,i)=>this.spawnApplicant(app,QUEUE[i]));this.updateQueueCount();
 }
 spawnApplicant(app,pos){
   const c=this.add.container(pos.x,pos.y).setDepth(40);
   const shadow=this.add.ellipse(0,20,38,11,0x263a4b,.18);
   const spr=this.add.sprite(0,0,app.base+'-idle',0).setScale(2.8).setTint(app.tint);spr.anims.stop();spr.setFrame(0);
   const tag=this.add.text(26,0,app.name,{fontFamily:'Arial',fontSize:'8px',fontStyle:'bold',color:'#173a69',backgroundColor:'#ffffffdd',padding:{x:5,y:3}}).setOrigin(0,.5).setAlpha(.78);
   c.add([shadow,spr,tag]);c.bodySprite=spr;c.app=app;c.setSize(94,58);c.setInteractive(new Phaser.Geom.Rectangle(-22,-28,115,56),Phaser.Geom.Rectangle.Contains,{useHandCursor:true});
   c.on('pointerover',()=>tag.setAlpha(1));c.on('pointerout',()=>tag.setAlpha(.78));c.on('pointerdown',()=>this.showTip(c.x+35,c.y-48,app.name+' · '+app.id+' · '+app.status.toUpperCase()));
   this.students[app.id]=c;
 }
 createAmbientStudents(){
   const configs=[
     {base:'Adam',tint:0xdff2ff,route:[{x:1020,y:770},{x:1640,y:770},{x:1020,y:770}]},
     {base:'Alex',tint:0xffe7d8,route:[{x:1940,y:850},{x:2190,y:850},{x:1940,y:850}]},
     {base:'Amelia',tint:0xf5e1ff,route:[{x:520,y:855},{x:850,y:855},{x:520,y:855}]}
   ];
   configs.forEach((cfg,i)=>{
     const c=this.add.container(cfg.route[0].x,cfg.route[0].y).setDepth(25);
     const spr=this.add.sprite(0,0,cfg.base+'-walk',0).setScale(2.3).setTint(cfg.tint);spr.play(cfg.base+'-walk-anim');c.add(spr);c.bodySprite=spr;this.ambient.push(c);
     this.loopAmbient(c,cfg.route,i*650);
   });
 }
 async loopAmbient(c,route,delay){await wait(delay);let idx=1;while(c.scene){const p=route[idx%route.length],flip=p.x<c.x;c.bodySprite.setFlipX(flip);await new Promise(res=>this.tweens.add({targets:c,x:p.x,y:p.y,duration:4200,ease:'Linear',onComplete:res}));idx++;await wait(700);}}
 updateQueueCount(){const n=apps.filter(a=>a.status==='waiting').length,o=apps.filter(a=>a.status==='orientation_waiting').length;if(this.queueText)this.queueText.setText(n+' waiting');dom('waitingCount').textContent=n;dom('orientationCount').textContent=o;updateControls()}
 showTip(x,y,text){
   this.hideTip();const c=this.add.container(x,y).setDepth(220),w=Math.max(130,Math.min(310,text.length*6.3+22));const bg=this.add.rectangle(0,0,w,36,0xffffff,1).setStrokeStyle(1,0xb7c8d6);const t=this.add.text(0,0,text,{fontFamily:'Arial',fontSize:'9px',fontStyle:'bold',color:'#2f5f93'}).setOrigin(.5);c.add([bg,t]);this.tip=c;
 }
 hideTip(){if(this.tip){this.tip.destroy(true);this.tip=null}}
 bubbleAt(x,y,text,duration=1100){this.showTip(x,y,text);this.time.delayedCall(duration,()=>this.hideTip())}
 setMovingSprite(sprite,moving,base,dirX=1){
   const key=moving?base+'-walk':base+'-idle';
   if(sprite.texture.key!==key){sprite.anims.stop();sprite.setTexture(key,0);}
   if(moving){
     if(sprite.anims.currentAnim?.key!==base+'-walk-anim'||!sprite.anims.isPlaying)sprite.play(base+'-walk-anim',true);
     sprite.setFlipX(dirX<0);
   }else{
     sprite.anims.stop();sprite.setFrame(0);sprite.setFlipX(false);
   }
 }
 async walkContainer(c,points,follow=false){
   const spr=c.bodySprite,base=c.app?.base||'Adam';this.setMovingSprite(spr,true,base,1);
   for(let i=1;i<points.length;i++){
     while(paused)await wait(70);
     const p=points[i],dx=p.x-c.x;this.setMovingSprite(spr,true,base,dx<0?-1:1);
     if(follow&&followActive)this.cameras.main.pan(p.x,p.y,520,'Sine.easeInOut');
     const d=Phaser.Math.Distance.Between(c.x,c.y,p.x,p.y);await new Promise(res=>this.tweens.add({targets:c,x:p.x,y:p.y,duration:Math.max(280,d*2.75),ease:'Linear',onComplete:res}));
   }
   this.setMovingSprite(spr,false,base,1);
 }
 standStaff(spr){
   if(spr.texture.key!==spr.baseName+'-idle'){spr.anims.stop();spr.setTexture(spr.baseName+'-idle',0);}
   spr.anims.stop();spr.setFrame(0);spr.setFlipX(false);spr.isSitting=false;
 }
 sitStaff(spr){
   spr.anims.stop();
   if(spr.baseName!=='Bob'){if(spr.texture.key!==spr.baseName+'-sit')spr.setTexture(spr.baseName+'-sit',0);spr.setFrame(0);spr.isSitting=true;}
   else{if(spr.texture.key!=='Bob-idle')spr.setTexture('Bob-idle',0);spr.setFrame(0);}
   spr.setFlipX(false);
 }
 async walkStaff(spr,points){
   if(spr.texture.key!==spr.baseName+'-walk'){spr.anims.stop();spr.setTexture(spr.baseName+'-walk',0);}
   spr.play(spr.baseName+'-walk-anim',true);spr.isSitting=false;
   for(let i=1;i<points.length;i++){
     while(paused)await wait(70);
     const p=points[i];spr.setFlipX(p.x<spr.x);const d=Phaser.Math.Distance.Between(spr.x,spr.y,p.x,p.y);await new Promise(res=>this.tweens.add({targets:spr,x:p.x,y:p.y,duration:Math.max(260,d*2.55),ease:'Linear',onComplete:res}));
   }
   this.standStaff(spr);
 }
 corridorRoute(from,to){return[{x:from.x,y:from.y},{x:from.x,y:WORLD.corridorY},{x:to.x,y:WORLD.corridorY},{x:to.x,y:to.y}]}
 staffExitPath(spr,s){
   const aisle=this.staffAisle(s),door=this.doorInside(s),service=this.servicePoint(s);
   return[{x:spr.x,y:spr.y},{x:s.x,y:spr.y},aisle,door,service];
 }
 async callFromQueue(app){
   const s=STATIONS.admission,student=this.students[app.id],staff=this.staffByStation.admission[0],home={...staff.home||this.staffHomes.get(staff)},service=this.servicePoint(s),approach={x:student.x+58,y:student.y};
   await this.walkStaff(staff,[{x:staff.x,y:staff.y},this.staffAisle(s),this.doorInside(s),service,{x:service.x,y:WORLD.corridorY},{x:approach.x,y:WORLD.corridorY},approach]);
   chime('call');this.bubbleAt(staff.x,staff.y-48,app.name+', next please!',1100);await wait(650);
   await Promise.all([
     this.walkStaff(staff,[approach,{x:approach.x,y:WORLD.corridorY},{x:service.x,y:WORLD.corridorY},service,this.doorInside(s),this.staffAisle(s),home]),
     this.walkContainer(student,[{x:student.x,y:student.y},{x:student.x,y:WORLD.corridorY},{x:service.x,y:WORLD.corridorY},service],true)
   ]);
   staff.setPosition(home.x,home.y);this.sitStaff(staff);app.station='admission';
 }
 async escort(app,fromId,toId){
   const from=STATIONS[fromId],to=STATIONS[toId],student=this.students[app.id],staff=this.staffByStation[fromId].slice(-1)[0],home={...staff.home||this.staffHomes.get(staff)},start=this.servicePoint(from),dest=this.servicePoint(to);
   await this.walkStaff(staff,[{x:staff.x,y:staff.y},{x:from.x,y:staff.y},this.staffAisle(from),this.doorInside(from),start]);
   chime('handoff');this.bubbleAt(staff.x,staff.y-48,'This way to '+to.label+' →',1000);await wait(430);
   const route=this.corridorRoute(start,dest);
   await Promise.all([this.walkStaff(staff,route),this.walkContainer(student,route,true)]);
   this.bubbleAt(dest.x,dest.y-54,'Welcome to '+to.label,750);
   const back=this.corridorRoute(dest,start).concat([this.doorInside(from),this.staffAisle(from),home]);
   await this.walkStaff(staff,back);staff.setPosition(home.x,home.y);this.sitStaff(staff);app.station=toId;
 }
 async queueAtOrientation(app){
   const s=STATIONS.orientation,student=this.students[app.id],service=this.servicePoint(s);
   await this.activateTask('orientation',0,app);
   const seat=ORIENTATION_SEATS[Math.min(orientationQueue.length,ORIENTATION_SEATS.length-1)];
   const path=[{x:student.x,y:student.y},this.doorInside(s),{x:s.x,y:1125},seat];
   this.bubbleAt(student.x,student.y-50,'Waiting for orientation session…',900);
   await this.walkContainer(student,path,true);
   app.status='orientation_waiting';app.station='orientation';app.orientationSeat=seat;orientationQueue.push(app.id);
   this.updateQueueCount();
   log('Orientation Invitation Agent','ORIENTATION_WAITING',app.name+' has joined the orientation waiting room.');
 }
 showBatchBanner(text,sub){
   if(this.batchBanner)this.batchBanner.destroy(true);
   const s=STATIONS.orientation,c=this.add.container(s.x,1000).setDepth(240);
   const bg=this.add.rectangle(0,0,310,66,0x173a69,.96).setStrokeStyle(2,0xd8b45f,1);
   const t=this.add.text(0,-10,text,{fontFamily:'Arial',fontSize:'13px',fontStyle:'bold',color:'#fff'}).setOrigin(.5);
   const st=this.add.text(0,13,sub||'',{fontFamily:'Arial',fontSize:'8px',color:'#dceafa'}).setOrigin(.5);
   c.add([bg,t,st]);this.batchBanner=c;
 }
 hideBatchBanner(){if(this.batchBanner){this.batchBanner.destroy(true);this.batchBanner=null;}}
 async activateBatchTask(stationId,index,participants,eventLabel){
   const s=STATIONS[stationId],staff=this.staffByStation[stationId][index],task=s.tasks[index];if(!staff)return;
   if(this.activeRing)this.activeRing.destroy();this.activeRing=this.add.ellipse(staff.x,staff.y+17,54,24,0x7656c5,.18).setStrokeStyle(3,0x7656c5,1).setDepth(15);
   this.standStaff(staff);this.bubbleAt(staff.x,staff.y-48,eventLabel||task.replace(' Agent',''),950);
   updateGroupEvent(participants,s.label,'COHORT_PROCESSING',task,task,'Process '+participants.length+' students together',index===s.tasks.length-1?'Ready for next stage':s.tasks[index+1]);
   log(task,'COHORT_PROCESSING',participants.length+' students are being processed together by '+task+'.');
   await wait(850);
   if(this.activeRing){this.activeRing.destroy();this.activeRing=null;}staff.setPosition(staff.home.x,staff.home.y);this.sitStaff(staff);
 }
 async runOrientationSession(participants){
   const s=STATIONS.orientation;
   if(followActive)this.cameras.main.pan(s.x,s.y,650,'Sine.easeInOut');
   participants.forEach(a=>a.status='orientation_session');
   this.showBatchBanner('ORIENTATION IN SESSION',participants.length+' students · one cohort');
   chime('call');
   await this.activateBatchTask('orientation',1,participants,'Attendance + session');
   updateGroupEvent(participants,'Orientation','ORIENTATION_SESSION','Orientation Attendance Agent','Cohort orientation','Run scheduled orientation for the whole group','Recording + community follow-up');
   log('Orientation Attendance Agent','ORIENTATION_SESSION',participants.map(a=>a.name).join(', ')+' are attending the same orientation session.');
   await wait(3200);
   this.showBatchBanner('ORIENTATION COMPLETED','Preparing recording + follow-up email');
   await this.activateBatchTask('orientation',2,participants,'Recording + follow-up');
   updateGroupEvent(participants,'Orientation','ORIENTATION_FOLLOW_UP','Orientation Follow-up Agent','Recording + community email','Send recording link, feedback and community information to the whole cohort','IT / Library / Moodle');
   log('Orientation Follow-up Agent','FOLLOW_UP_SENT','Recording and post-orientation information sent to all '+participants.length+' students.');
   await wait(1200);
   this.hideBatchBanner();
   await this.escortGroup(participants,'orientation','services');
   await this.processBatchStation(participants,'services');
   await this.escortGroup(participants,'services','handover');
   await this.processBatchStation(participants,'handover');
 }
 async escortGroup(participants,fromId,toId){
   const from=STATIONS[fromId],to=STATIONS[toId],staff=this.staffByStation[fromId].slice(-1)[0],home={...staff.home||this.staffHomes.get(staff)},start=this.servicePoint(from),dest=this.servicePoint(to);
   await this.walkStaff(staff,[{x:staff.x,y:staff.y},{x:from.x,y:staff.y},this.staffAisle(from),this.doorInside(from),start]);
   chime('handoff');this.bubbleAt(staff.x,staff.y-48,'Cohort, this way to '+to.label+' →',1200);
   const staffRoute=this.corridorRoute(start,dest);
   const walks=participants.map((app,i)=>{
     const c=this.students[app.id],off=GROUP_OFFSETS[i%GROUP_OFFSETS.length];
     const route=[
       {x:c.x,y:c.y},
       {x:from.x+off.x,y:from.side==='bottom'?1065:475},
       {x:start.x+off.x,y:start.y+off.y},
       {x:start.x+off.x,y:WORLD.corridorY+off.y},
       {x:dest.x+off.x,y:WORLD.corridorY+off.y},
       {x:dest.x+off.x,y:dest.y+off.y}
     ];
     return this.walkContainer(c,route,i===0);
   });
   await Promise.all([this.walkStaff(staff,staffRoute),...walks]);
   log(from.label+' Staff','COHORT_HANDOFF',participants.length+' students moved together to '+to.label+'.');
   const back=this.corridorRoute(dest,start).concat([this.doorInside(from),this.staffAisle(from),home]);
   await this.walkStaff(staff,back);staff.setPosition(home.x,home.y);this.sitStaff(staff);
   participants.forEach(a=>a.station=toId);
 }
 async processBatchStation(participants,id){
   const s=STATIONS[id];dom('activeStation').textContent=s.label;
   if(followActive)this.cameras.main.pan(this.servicePoint(s).x,this.servicePoint(s).y,560,'Sine.easeInOut');
   for(let i=0;i<s.tasks.length;i++){while(paused)await wait(70);await this.activateBatchTask(id,i,participants,s.tasks[i].replace(' Agent',''));}
 }
 async activateTask(stationId,index,app){
   const s=STATIONS[stationId],staff=this.staffByStation[stationId][index],task=s.tasks[index];if(!staff)return;
   if(this.activeRing)this.activeRing.destroy();this.activeRing=this.add.ellipse(staff.x,staff.y+17,50,22,0x2ebd89,.17).setStrokeStyle(3,0x2ebd89,1).setDepth(15);
   this.standStaff(staff);this.tweens.add({targets:staff,y:staff.home.y-7,duration:180,yoyo:true});
   this.bubbleAt(staff.x,staff.y-48,task.replace(' Agent',''),470);
   updateEvent(app,s.label,'TASK_PROCESSING',task,task,'Processing '+task,index===s.tasks.length-1?'Ready for next station':s.tasks[index+1]);
   log(task,'TASK_PROCESSING',app.name+' is being processed by '+task+'.');await wait(410);
   if(this.activeRing){this.activeRing.destroy();this.activeRing=null;}staff.setPosition(staff.home.x,staff.home.y);this.sitStaff(staff);
 }
 async processStation(app,id){
   const s=STATIONS[id];dom('activeStation').textContent=s.label;
   if(followActive)this.cameras.main.pan(this.servicePoint(s).x,this.servicePoint(s).y,460,'Sine.easeInOut');
   for(let i=0;i<s.tasks.length;i++){while(paused)await wait(70);await this.activateTask(id,i,app);}
 }
 createCameraControls(){
   const cam=this.cameras.main,keys=this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
   this.input.on('wheel',(p,o,dx,dy)=>cam.setZoom(Phaser.Math.Clamp(cam.zoom-dy*.0005,.52,1.55)));
   this.input.on('pointerdown',p=>{if(p.leftButtonDown()){this.dragging=true;this.dragStart={x:p.x,y:p.y,sx:cam.scrollX,sy:cam.scrollY};}});
   this.input.on('pointerup',()=>this.dragging=false);
   this.input.on('pointermove',p=>{if(this.dragging&&this.dragStart){cam.scrollX=this.dragStart.sx-(p.x-this.dragStart.x)/cam.zoom;cam.scrollY=this.dragStart.sy-(p.y-this.dragStart.y)/cam.zoom;}});
   this.events.on('update',()=>{const s=9/cam.zoom;if(keys.W.isDown||keys.UP.isDown)cam.scrollY-=s;if(keys.S.isDown||keys.DOWN.isDown)cam.scrollY+=s;if(keys.A.isDown||keys.LEFT.isDown)cam.scrollX-=s;if(keys.D.isDown||keys.RIGHT.isDown)cam.scrollX+=s;});
 }
 createMinimap(){const m=this.cameras.add(1330,18,250,138).setZoom(.091).setBackgroundColor('#162836').setAlpha(.93);m.centerOn(WORLD.w/2,WORLD.h/2);this.minimap=m}
 fullMap(){this.cameras.main.setZoom(.56).centerOn(WORLD.w/2,WORLD.h/2)}
 focus(app){const c=this.students[app.id];if(!c)return;const cam=this.cameras.main;cam.setZoom(Math.max(cam.zoom,.95));cam.pan(c.x,c.y,420,'Sine.easeInOut')}
 resetApplicants(){
   orientationQueue=[];
   Object.values(this.students).forEach(c=>c.destroy(true));this.students={};
   Object.values(this.staffByStation).flat().forEach(s=>{if(s.home){s.setPosition(s.home.x,s.home.y);this.sitStaff(s);}});
   this.createApplicants();
 }
}

/* Campus RPG V6: stable avatars + slower movement + cohort orientation */
new Phaser.Game({type:Phaser.AUTO,parent:'rpg-stage',width:1600,height:900,pixelArt:true,antialias:false,roundPixels:true,backgroundColor:'#111b24',scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[CampusScene]});

function updateEvent(app,station,event,agent,task,action,next){
 dom('eventName').textContent=event;dom('eventApplicant').textContent=app?app.name+' · '+app.id:'—';dom('eventAgent').textContent=agent||'—';dom('eventTask').textContent=task||'—';dom('eventAction').textContent=action||'—';dom('eventNext').textContent=next||'—';dom('activeCase').textContent=app?app.id:'—';dom('activeStation').textContent=station||'—';
}
function log(actor,event,msg){
 const feed=dom('activityFeed');feed.querySelector('.empty')?.remove();const row=document.createElement('div');row.className='feed-row';row.innerHTML='<time>'+new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})+'</time><b>'+actor+'</b><small>'+event+'</small><p>'+msg+'</p>';feed.prepend(row);while(feed.children.length>55)feed.lastElementChild.remove();
}
function nextWaiting(){return apps.find(a=>a.status==='waiting')}
function orientationWaitingApps(){return orientationQueue.map(id=>apps.find(a=>a.id===id)).filter(Boolean)}
function updateControls(){
 const waiting=apps.filter(a=>a.status==='waiting').length,ow=apps.filter(a=>a.status==='orientation_waiting').length;
 dom('processBtn').disabled=running||waiting===0;dom('processBtn').textContent=waiting?'▶ Call Next Applicant ('+waiting+')':'✓ No new applicants waiting';
 dom('orientationBtn').disabled=running||ow===0;dom('orientationBtn').textContent='▶ Run Orientation Batch ('+ow+')';
}
function updateGroupEvent(list,station,event,agent,task,action,next){
 dom('eventName').textContent=event;dom('eventApplicant').textContent=list.map(a=>a.name).join(', ');dom('eventAgent').textContent=agent||'—';dom('eventTask').textContent=task||'—';dom('eventAction').textContent=action||'—';dom('eventNext').textContent=next||'—';dom('activeCase').textContent=list.length+'-student cohort';dom('activeStation').textContent=station||'—';
}
async function processNext(){
 if(running||!sceneRef)return;const app=nextWaiting();if(!app)return;
 running=true;currentApp=app;app.status='active';sceneRef.updateQueueCount();dom('pauseBtn').disabled=false;dom('activeCase').textContent=app.id;updateControls();log('AI Orchestrator','APPLICANT_CALLED',app.name+' is called from the Admission queue.');sceneRef.focus(app);
 await sceneRef.callFromQueue(app);
 const route=ROUTES[dom('routeSelect').value]||ROUTES.prerequisite;
 const orientationIndex=route.indexOf('orientation');
 const individualRoute=orientationIndex>=0?route.slice(0,orientationIndex):route;
 await sceneRef.processStation(app,'admission');
 for(let i=1;i<individualRoute.length;i++){
   const from=individualRoute[i-1],to=individualRoute[i];
   updateEvent(app,STATIONS[from].label,'HANDOFF',STATIONS[from].tasks.slice(-1)[0],'Escort applicant','Walk through campus corridor',STATIONS[to].label);
   log(STATIONS[from].label+' Staff','HANDOFF',app.name+' is escorted to '+STATIONS[to].label+'.');
   await sceneRef.escort(app,from,to);await sceneRef.processStation(app,to);
 }
 const last=individualRoute[individualRoute.length-1];
 updateEvent(app,STATIONS[last].label,'ORIENTATION_QUEUE','Orientation Invitation Agent','Move to scheduled cohort','Escort applicant to Orientation waiting room','Wait for cohort session');
 log(STATIONS[last].label+' Staff','ORIENTATION_QUEUE',app.name+' is ready to wait for the next Orientation cohort.');
 await sceneRef.escort(app,last,'orientation');
 await sceneRef.queueAtOrientation(app);
 running=false;dom('pauseBtn').disabled=true;sceneRef.updateQueueCount();updateControls();
 updateEvent(app,'Orientation','WAITING_FOR_ORIENTATION','Orientation Invitation Agent','Wait for scheduled cohort','Applicant remains in Orientation waiting room','Run Orientation Batch');
}
async function runOrientationBatch(){
 if(running||!sceneRef)return;const participants=orientationWaitingApps();if(!participants.length)return;
 running=true;currentApp=participants[0];dom('pauseBtn').disabled=false;updateControls();
 participants.forEach(a=>a.status='orientation_session');sceneRef.updateQueueCount();
 log('Orientation Agent','COHORT_START',participants.length+' students are starting Orientation together.');
 await sceneRef.runOrientationSession(participants);
 participants.forEach(a=>{a.status='completed';a.station='handover';});
 orientationQueue=[];running=false;dom('pauseBtn').disabled=true;sceneRef.updateQueueCount();updateControls();
 updateGroupEvent(participants,'Academic Handover','COHORT_JOURNEY_COMPLETE','Management Reporting Agent','Complete cohort lifecycle','All participants handed to Academic','—');
 log('Management Reporting Agent','COHORT_COMPLETE',participants.length+' students completed Orientation, follow-up, Services and Handover together.');
 chime('complete');
 const lead=sceneRef.students[participants[0].id];if(lead)sceneRef.bubbleAt(lead.x,lead.y-58,'Cohort journey complete ✓',1800);
}
function resetAll(){
 running=false;paused=false;currentApp=null;orientationQueue=[];if(!sceneRef)return;sceneRef.tweens.resumeAll();sceneRef.resetApplicants();dom('pauseBtn').disabled=true;dom('pauseBtn').textContent='Pause';dom('activityFeed').innerHTML='<div class="empty">No activity yet.</div>';updateEvent(null,'Entrance','Waiting for applicant','—','—','—','—');sceneRef.cameras.main.setZoom(1.05).centerOn(720,770);sceneRef.updateQueueCount();updateControls();
}
function zoom(d){if(!sceneRef)return;const cam=sceneRef.cameras.main;cam.setZoom(Phaser.Math.Clamp(cam.zoom+d,.52,1.55))}
async function connectLive(){
 const pass=dom('adminPassword').value.trim();if(!pass)return;const btn=dom('connectBtn');btn.disabled=true;btn.textContent='Connecting…';
 try{const r=await fetch('/api/admin-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pass})});const p=await r.json();if(!r.ok||!p.ok)throw new Error(p.message||'Unable to connect');const n=Array.isArray(p.data?.V2_APPLICATIONS)?p.data.V2_APPLICATIONS.length:0;dom('modeBadge').textContent='LIVE ACC · '+n;document.querySelector('.status-pill').innerHTML='<i></i> Live ACC connected';log('System','LIVE_DATA_CONNECTED',n+' Admission V2 application records available read-only.');dom('adminPassword').value='';}catch(e){log('System','LIVE_DATA_FAILED',e.message||'Connection failed');}finally{btn.disabled=false;btn.textContent='Connect Live ACC';}
}

dom('processBtn').onclick=processNext;
dom('orientationBtn').onclick=runOrientationBatch;
dom('pauseBtn').onclick=function(){paused=!paused;this.textContent=paused?'Resume':'Pause';if(sceneRef){if(paused)sceneRef.tweens.pauseAll();else sceneRef.tweens.resumeAll();}};
dom('resetBtn').onclick=resetAll;
dom('followBtn').onclick=function(){followActive=!followActive;this.classList.toggle('active-toggle',followActive);this.textContent=followActive?'Follow Active':'Free Camera';if(followActive&&currentApp)sceneRef?.focus(currentApp)};
dom('fullMapBtn').onclick=()=>sceneRef?.fullMap();
dom('zoomInBtn').onclick=()=>zoom(.12);dom('zoomOutBtn').onclick=()=>zoom(-.12);
dom('hudBtn').onclick=function(){dom('gameLayout').classList.toggle('hud-hidden');this.textContent=dom('gameLayout').classList.contains('hud-hidden')?'Show HUD':'Hide HUD'};
dom('connectBtn').onclick=connectLive;dom('adminPassword').onkeydown=e=>{if(e.key==='Enter')connectLive()};
})();