import{WORLD,STATIONS,BY_ID}from'./config.js';
import{NavigationManager}from'./NavigationManager.js';
import{StaffActor,ApplicantActor}from'./ApplicantActor.js';
import{round,text,ellipse,prop,drawActor,setFurnitureAtlas}from'./Art.js';
export class CampusScene{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.nav=new NavigationManager(WORLD.w,WORLD.h);this.props=[];this.staff=[];this.loungeSeats=[];this.orientationSeats=[];this.stationSeats={};this.actors=[];this.ambient=[];this.time=0;this.follow=false;this.camera={x:1630,y:1240,zoom:.55};this.build();this.resize();this.input();}
 async load(){this.characters=new Image();this.characters.src=new URL('./assets/characters.webp',import.meta.url);await this.characters.decode();this.furniture=new Image();this.furniture.src=new URL('./assets/furniture.webp',import.meta.url);await this.furniture.decode();setFurnitureAtlas(this.furniture);this.background=document.createElement('canvas');this.background.width=WORLD.w;this.background.height=WORLD.h;this.drawBackground(this.background.getContext('2d'));}
 add(type,x,y,w,h,extra={}){const p={type,x,y,w,h,...extra};this.props.push(p);if(type==='chair'){this.nav.block(x-w/2,y-30,w,12,8);return p;}if(extra.collide!==false&&!['screen','rug','lamp'].includes(type))this.nav.block(x-w/2,y-(type==='plant'?45:Math.min(h*.55,65)),w,type==='plant'?45:Math.min(h*.55,65));return p;}
 build(){
 this.nav.block(0,0,WORLD.w,385,0);this.nav.block(0,0,45,WORLD.h,0);this.nav.block(WORLD.w-45,0,45,WORLD.h,0);this.nav.block(0,WORLD.h-55,WORLD.w,55,0);
 for(const s of STATIONS){const{x,y,w,h}=s;this.nav.block(x,y,12,h);this.nav.block(x+w-12,y,12,h);if(y<1000){this.nav.block(x,y,w,12);this.nav.block(x,y+h-12,w/2-80,12);this.nav.block(x+w/2+80,y+h-12,w/2-80,12);}else{this.nav.block(x,y,w/2-90,12);this.nav.block(x+w/2+90,y,w/2-90,12);this.nav.block(x,y+h-12,w,12);}
 this.add('plant',x+53,y+h-48,65,80);this.add('plant',x+w-54,y+h-48,65,80);
 if(s.id!=='orientation'){this.add('shelf',x+72,y+235,105,128);this.add('screen',x+w/2,y+168,Math.min(w-250,250),90,{title:s.id==='prerequisite'?'Learn · Prepare · Progress':s.id==='offer'?'Your next chapter':s.id==='sac'?'SAC SESSION':'IUC · IPGS',sub:s.id==='sac'?'Review · Discuss · Decide':'PEOPLE · PURPOSE · PROGRESS',color:s.color});this.add('lamp',x+w-57,y+263,35,130,{collide:false});}
 if(['admission','document','screening','handover'].includes(s.id)){
 const yy=y+330;this.add(s.id==='admission'?'counter':'desk',x+w/2-30,yy,260,96);this.staff.push(new StaffActor(s.label+' officer',x+w/2-55,yy-125,s.num%2));s.point={x:x+w/2-30,y:yy+85};
 if(s.id==='screening'){this.add('desk',x+w-110,y+175,135,64);this.staff.push(new StaffActor('Qualification specialist',x+w-115,y+105,6));}
 if(s.id==='document'){this.add('shelf',x+w-95,y+225,115,126);this.add('table',x+95,y+365,90,65);this.add('screen',x+95,y+330,65,32,{title:'SCAN',sub:''});}
 if(s.id==='admission'){this.add('chair',x+90,y+425,63,55);this.add('chair',x+180,y+425,63,55);}
 }
 if(s.id==='sac'||s.id==='ia'){
 this.add('table',x+w/2,y+340,s.id==='sac'?275:210,115);this.staff.push(new StaffActor(s.id==='sac'?'SAC Chair':'IA Chair',x+w/2,y+195,7));this.staff.push(new StaffActor('Panel member',x+w/2-90,y+208,6));if(s.id==='sac')this.staff.push(new StaffActor('Committee member',x+w/2+85,y+208,1));
 for(let i=0;i<3;i++){this.add('chair',x+w/2-110+i*110,y+421,64,56,{collide:false});}
 this.stationSeats[s.id]=Array.from({length:s.capacity},(_,i)=>({x:x+165+i*70,y:y+453}));s.point={x:x+w/2,y:y+453};
 }
 if(s.id==='prerequisite'){
 this.staff.push(new StaffActor('Prerequisite lecturer',x+w/2,y+210,7));this.stationSeats[s.id]=[];for(let r=0;r<2;r++)for(let col=0;col<2;col++){const dx=x+170+col*190,dy=y+365+r*160;this.add('desk',dx,dy,105,62);this.add('chair',dx,dy+66,64,54,{collide:false});this.stationSeats[s.id].push({x:dx,y:dy+96});}s.point={x:x+w/2,y:y+285};
 }
 if(s.id==='offer'){
 this.add('rug',x+w/2,y+490,370,255,{collide:false});this.add('sofa',x+155,y+325,175,84);this.add('sofa',x+355,y+500,175,84);this.add('table',x+w/2,y+415,110,65);this.staff.push(new StaffActor('Offer adviser',x+150,y+300,0));this.staff.at(-1).sit();s.point={x:x+360,y:y+300};this.add('chair',s.point.x,s.point.y-30,66,57,{collide:false});
 }
 if(s.id==='orientation'){
 this.add('screen',x+w/2,y+285,510,165,{title:'NEXT ORIENTATION',sub:'Waiting for the cohort',color:'#204f73',dynamic:'orientation'});this.add('table',x+110,y+322,90,66);this.staff.push(new StaffActor('Orientation presenter',x+125,y+225,6));
 for(let r=0;r<5;r++)for(let col=0;col<6;col++){let dx=x+120+col*100+(col>2?60:0),dy=y+395+r*67;this.add('chair',dx,dy,58,48,{collide:false});this.orientationSeats.push({x:dx,y:dy+30});}
 // Seat rows are reached by aisle waypoints; chairs are reserved seating surfaces.
 s.point={x:x+w/2,y:y+325};
 }
 if(s.id==='services'){
 this.stationSeats.services=[];for(let i=0;i<3;i++){let dx=x+135+i*180;this.add('desk',dx,y+345,128,80);this.add('screen',dx,y+237,125,58,{title:['IT HELP','LIBRARY','MOODLE'][i],sub:'',color:'#2c7879'});this.staff.push(new StaffActor(['IT officer','Librarian','Moodle officer'][i],dx,y+242,i===1?7:1));this.stationSeats.services.push({x:dx,y:y+425});}
 this.add('shelf',x+w/2-70,y+585,105,120);this.add('shelf',x+w/2+70,y+585,105,120);s.point={x:x+w/2,y:y+425};
 }
 }
 // Wide circulation lanes on both sides of the functional lounge.
 for(let pod=0;pod<4;pod++){
 let x=710+pod*680;this.add('rug',x,1355,490,255,{collide:false,color:'#dfdac3'});this.add('sofa',x,1160,230,86);this.add('table',x,1285,130,66);this.add('plant',x-210,1260,70,100);this.add('lamp',x+200,1260,40,130,{collide:false});
 for(let j=0;j<2;j++){const sx=x-70+j*140;this.add('chair',sx,1365,70,60,{collide:false});this.loungeSeats.push({x:sx,y:1395});}for(let j=0;j<2;j++)this.loungeSeats.push({x:x-65+j*130,y:1200});
 }
 this.add('coffee',3380,1280,120,60);this.add('screen',3350,1145,175,110,{title:'TAKE A MOMENT',sub:'Your next step awaits',color:'#335c78'});
 for(let x=270;x<3560;x+=320)this.add('plant',x,393,70,90);
 for(let x=220;x<3500;x+=430){this.add('plant',x,2340,65,95);}
 // Queue ropes live beside the walkway, never across it.
 this.nav.block(70,610,10,340);this.nav.block(260,610,10,340);
 for(let i=0;i<3;i++){const a=new ApplicantActor({id:'campus-guest-'+i,name:['Visitor','Student','Campus ambassador'][i]},600+i*760,2290,[4,5,3][i]);a.dest={x:a.x+230,y:2290};a.origin={x:a.x,y:a.y};this.ambient.push(a);}
 for(const a of this.staff){let safe=this.nav.point(this.nav.nearest(a));a.x=safe.x;a.y=safe.y;a.home={...safe};}
 }
 drawBackground(c){
 c.fillStyle='#e9e3d4';c.fillRect(0,0,WORLD.w,WORLD.h);
 // Quiet large-format stone, with restrained seams and reflections.
 for(let y=380;y<WORLD.h;y+=100)for(let x=0;x<WORLD.w;x+=140){const n=((x*13+y*7)%19)/19;c.fillStyle=`rgb(${240-n*9},${234-n*9},${218-n*9})`;c.fillRect(x+1,y+1,138,98);c.strokeStyle='#fffaf173';c.strokeRect(x+2,y+2,136,96);}
 c.fillStyle='#c1cbb1';c.fillRect(0,0,WORLD.w,345);c.fillStyle='#d5e9e7';c.fillRect(0,0,WORLD.w,140);
 // Courtyard, historic campus facade, trees, fountain, and tall glass mullions.
 round(c,1350,85,900,230,4,'#e4cea0','#b49f74');round(c,1660,36,280,280,2,'#edd9ad','#c4ad7b');c.fillStyle='#caad73';c.beginPath();c.moveTo(1615,65);c.lineTo(1800,-15);c.lineTo(1985,65);c.fill();for(let x=1380;x<2230;x+=95){round(c,x,118,45,88,15,'#71959b','#baab83');round(c,x,235,45,66,15,'#577e86');}round(c,1750,206,100,110,40,'#547480','#baaa79');
 for(let i=0;i<21;i++){let x=80+i*177;round(c,x-5,180,10,116,3,'#8e8160');for(let j=0;j<5;j++)ellipse(c,x+Math.cos(j*2.4)*34,155+Math.sin(j*2.4)*30,85,90,['#769458','#8fa669','#5e855b'][j%3]);}
 ellipse(c,1800,319,540,84,'#bfb991');ellipse(c,1800,310,475,62,'#81bcc4');ellipse(c,1800,305,425,45,'#abdadd');round(c,1787,246,26,63,4,'#dbd4af');ellipse(c,1800,250,117,23,'#d8d3ae');
 c.fillStyle='#e7e5ce';c.fillRect(0,342,WORLD.w,42);for(let x=40;x<WORLD.w;x+=240){c.fillStyle='#506976';c.fillRect(x,0,8,355);c.fillStyle='#faf3dd';c.fillRect(x+8,0,5,355);c.fillStyle='#ffffff18';c.beginPath();c.moveTo(x+20,10);c.lineTo(x+180,10);c.lineTo(x+40,330);c.lineTo(x+20,330);c.fill();}c.fillStyle='#57707b';c.fillRect(0,155,WORLD.w,7);
 for(const x of [350,1110,2500,3250]){round(c,x-77,20,154,235,2,'#184469','#c9a85e');text(c,'IUC · IPGS',x,78,24,'#f7e2a7','center','Georgia');text(c,'PEOPLE',x,122,14,'#dae5dd');text(c,'PURPOSE',x,151,14,'#dae5dd');text(c,'BRIGHTER',x,190,14,'#dae5dd');text(c,'TOMORROWS',x,213,14,'#dae5dd');}
 for(const s of STATIONS){let{x,y,w,h}=s;c.shadowColor='#3c51402b';c.shadowBlur=15;c.shadowOffsetY=8;round(c,x,y,w,h,5,'#f7f0dd');c.shadowColor='transparent';c.shadowBlur=0;c.shadowOffsetY=0;const g=c.createLinearGradient(0,y,0,y+180);g.addColorStop(0,'#d9cfb7');g.addColorStop(1,'#f8f0dc');c.fillStyle=g;c.fillRect(x+12,y+12,w-24,172);
 c.fillStyle='#fff9e9';c.fillRect(x,y,12,h);c.fillRect(x+w-12,y,12,h);c.fillStyle='#c1b498';c.fillRect(x+10,y,5,h);c.fillRect(x+w-17,y,5,h);c.fillStyle='#b8aa8b';c.fillRect(x,y, w,10);
 let by=y<1000?y+h-14:y;c.fillStyle='#c9bc9f';c.fillRect(x,by,w/2-90,14);c.fillRect(x+w/2+90,by,w/2-90,14);if(y>1000)c.fillRect(x,y+h-12,w,12);
 // Department signs hang high on the rear wall instead of becoming dashboard cards.
 round(c,x+20,y+18,w-40,66,6,s.color,'#fff6d3');ellipse(c,x+54,y+50,42,42,'#fffbea');text(c,String(s.num),x+54,y+58,22,s.color);text(c,s.label,x+90,y+49,23,'#fffbed','left');text(c,s.processingMode==='batch'?'SESSION & COHORT':'STUDENT ADMISSIONS',x+91,y+70,10,'#e4e8d8','left');
 if(y>1000){c.fillStyle='#f2ecdc';c.fillRect(x+w/2-75,y-10,150,25);}else{c.fillStyle='#f2ecdc';c.fillRect(x+w/2-72,y+h-20,144,35);}
 }
 round(c,80,510,180,62,5,'#1c5273','#c9af70');text(c,'NEW',170,536,17,'#f8e9bd');text(c,'APPLICATIONS',170,559,16,'#f8e9bd');for(let yy=610;yy<950;yy+=85){for(let x of [70,270]){ellipse(c,x,yy+8,30,12,'#bdb6a2');round(c,x-4,yy-50,8,60,3,'#728d95');ellipse(c,x,yy-51,18,12,'#c7d3d1');}if(yy<865){c.strokeStyle='#95545b';c.lineWidth=4;c.beginPath();c.moveTo(70,yy-48);c.quadraticCurveTo(70,yy+5,70,yy+40);c.stroke();}}
 text(c,'WAITING LOUNGE',1840,1041,25,'#41647a','center','Georgia');text(c,'PENDING APPLICANTS · YOUR NEXT STEP AWAITS',1840,1064,11,'#7d8f8b');
 round(c,1470,2300,730,72,4,'#fffae9','#c9b68e');text(c,'IUC  ·  IPGS',1835,2342,32,'#285376','center','Georgia');
 }
 resize(){const r=this.canvas.getBoundingClientRect();this.width=r.width;this.height=r.height;this.dpr=Math.min(window.devicePixelRatio||1,2);this.canvas.width=r.width*this.dpr;this.canvas.height=r.height*this.dpr;}
 fullMap(){this.follow=false;this.camera={x:WORLD.w/2,y:WORLD.h/2,zoom:Math.min(this.width/WORLD.w,this.height/WORLD.h)*.95};}
 focus(a){this.selected=a;this.follow=true;this.camera.zoom=Math.max(this.camera.zoom,.65);}
 screenToWorld(x,y){return{x:(x-this.width/2)/this.camera.zoom+this.camera.x,y:(y-this.height/2)/this.camera.zoom+this.camera.y};}
 input(){window.addEventListener('resize',()=>this.resize());this.canvas.addEventListener('pointerdown',e=>{this.canvas.setPointerCapture(e.pointerId);this.drag={x:e.offsetX,y:e.offsetY,cx:this.camera.x,cy:this.camera.y,moved:false};});this.canvas.addEventListener('pointermove',e=>{if(!this.drag)return;let dx=e.offsetX-this.drag.x,dy=e.offsetY-this.drag.y;if(Math.hypot(dx,dy)>5){this.drag.moved=true;this.follow=false;this.camera.x=this.drag.cx-dx/this.camera.zoom;this.camera.y=this.drag.cy-dy/this.camera.zoom;}});this.canvas.addEventListener('pointerup',e=>{if(this.drag&&!this.drag.moved){const p=this.screenToWorld(e.offsetX,e.offsetY);const actor=[...this.actors,...this.staff].sort((a,b)=>b.y-a.y).find(a=>Math.abs(a.x-p.x)<45&&p.y<a.y+18&&p.y>a.y-120);if(actor)this.onSelect?.(actor);else{const room=STATIONS.find(s=>p.x>s.x&&p.x<s.x+s.w&&p.y>s.y&&p.y<s.y+s.h);if(room)this.onRoom?.(room);}}this.drag=null;});this.canvas.addEventListener('pointercancel',()=>this.drag=null);this.canvas.addEventListener('wheel',e=>{e.preventDefault();this.follow=false;const before=this.screenToWorld(e.offsetX,e.offsetY);this.camera.zoom=Math.max(.17,Math.min(1.65,this.camera.zoom*Math.exp(-e.deltaY*.001)));const after=this.screenToWorld(e.offsetX,e.offsetY);this.camera.x+=before.x-after.x;this.camera.y+=before.y-after.y;},{passive:false});this.canvas.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)){e.preventDefault();this.follow=false;this.camera.x+=['ArrowLeft','a'].includes(e.key)?-80:['ArrowRight','d'].includes(e.key)?80:0;this.camera.y+=['ArrowUp','w'].includes(e.key)?-80:['ArrowDown','s'].includes(e.key)?80:0;}});}
 render(dt){const c=this.ctx;this.time+=dt;for(const a of this.ambient){if(!a.path.length){const dest=a.x<a.origin.x+100?a.dest:a.origin;try{a.moveTo(dest,this.nav);}catch{}}a.update(dt*.45);}if(this.follow&&this.selected){const a=this.selected;const targetX=a.x+(this.width>850?180:0)/this.camera.zoom;this.camera.x+=(targetX-this.camera.x)*Math.min(1,dt*3);this.camera.y+=(a.y-100-this.camera.y)*Math.min(1,dt*3);}c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#d7ddcf';c.fillRect(0,0,this.width,this.height);c.translate(this.width/2,this.height/2);c.scale(this.camera.zoom,this.camera.zoom);c.translate(-this.camera.x,-this.camera.y);if(this.background)c.drawImage(this.background,0,0);
 const all=[...this.props.map(p=>({y:p.type==='rug'?-1:p.y,draw:()=>prop(c,p,this.time)})),...[...this.staff,...this.actors,...this.ambient].map(a=>({y:a.y,draw:()=>drawActor(c,a,this.characters,this.time)}))];all.sort((a,b)=>a.y-b.y);for(const o of all)o.draw();
 // Animated fountain jets remain in the courtyard layer.
 c.strokeStyle='#e3ffffaa';c.lineWidth=3;for(let i=0;i<9;i++){let q=i/8;c.beginPath();c.moveTo(1800,250);c.quadraticCurveTo(1730+q*140,185+Math.sin(this.time*2+i)*5,1690+q*220,310);c.stroke();}for(let i=0;i<3;i++){c.strokeStyle=`rgba(244,255,250,${.3-i*.07})`;c.beginPath();c.ellipse(1800,310,80+((this.time*25+i*35)%120),8+i*4,0,0,Math.PI*2);c.stroke();}
 c.setTransform(this.dpr,0,0,this.dpr,0,0);
 }
}
