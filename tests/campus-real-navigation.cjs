// Integration test on the actual campus grid and seating layout.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sandbox={};vm.createContext(sandbox);
function load(file,exports){
 let s=fs.readFileSync(path.join(root,'campus-v9',file),'utf8');
 s=s.replace(/^import[^\n]*\n/gm,'').replace(/export (const|class|function)/g,'$1');
 s=s.replaceAll('import.meta.url',"'file:///campus-v9/'");
 s+='\n'+exports.map(n=>'globalThis.'+n+'='+n+';').join('\n');
 vm.runInContext(s,sandbox,{timeout:4000,filename:file});
}
load('config.js',['WORLD','STATIONS','BY_ID']);
load('NavigationManager.js',['NavigationManager']);
load('ApplicantActor.js',['ApplicantActor','StaffActor']);
load('CampusScene.js',['CampusScene']);
load('AmbientLife.js',['AmbientLife']);
function makeWorld(){
 const s=Object.create(sandbox.CampusScene.prototype);
 s.nav=new sandbox.NavigationManager(sandbox.WORLD.w,sandbox.WORLD.h);
 s.props=[];s.staff=[];s.loungeSeats=[];s.orientationSeats=[];
 s.stationSeats={};s.actors=[];s.ambient=[];s.time=0;
 s.build();return s;
}
function addApplicant(scene,station,i){
 const s=sandbox.BY_ID[station];
 const candidate={x:s.point.x+(i%5-2)*54,y:s.point.y+(Math.floor(i/5)-1)*44};
 const p=scene.nav.point(scene.nav.nearest(candidate));
 return new sandbox.ApplicantActor({id:station+'-'+i,name:'Test '+i,station,status:'WAITING_SAC_ASSIGNMENT'},p.x,p.y,i%8);
}
const outside=p=>p.x>275&&p.x<3510&&p.y>970&&p.y<1455
 &&!sandbox.STATIONS.some(s=>p.x>s.x&&p.x<s.x+s.w&&p.y>s.y&&p.y<s.y+s.h);

test('inside offices remain static while outdoor visitors visibly walk',()=>{
 const scene=makeWorld();
 const students=['admission','sac','offer'].flatMap(s=>Array.from({length:8},(_,i)=>addApplicant(scene,s,i)));
 scene.actors=students;
 const before=students.map(a=>({x:a.x,y:a.y,station:a.station,status:a.status}));
 const staffBefore=scene.staff.map(a=>({x:a.x,y:a.y,status:a.status}));
 assert.equal(scene.ambient.length,12,'12 outdoor NPCs');
 assert.equal(scene.ambient.filter(a=>a.sitting).length,4,'four visitors already sitting in lounge');
 const life=new sandbox.AmbientLife(scene),engine={apps:students,live:true,paused:false};
 scene.time=10;
 for(let i=0;i<15;i++)life.wander(engine);
 const walking=scene.ambient.filter(a=>a.ambientWalk);
 assert.ok(walking.length>=2,'visible exterior paths available for several visitors: '+walking.length);
 assert.ok(walking.length<=5,'crowd cap');
 for(const a of walking){
   assert.equal(a.status,'VISITOR');
   assert.ok(a.path.length>0);
   assert.ok(a.path.every(outside),'all visible waypoints stay outside rooms');
   assert.ok(a.path.every(p=>scene.nav.blocked[scene.nav.index(p)]===0),'no furniture intersections');
 }
 let moveDistance=0;
 const walkers=walking.map(a=>({a,x:a.x,y:a.y}));
 scene.time+=.5;life.update(.5,engine);
 for(const {a,x,y} of walkers)moveDistance+=Math.hypot(a.x-x,a.y-y);
 assert.ok(moveDistance>25,'actual on-screen visitor displacement');
 for(let i=0;i<students.length;i++){
   const a=students[i],b=before[i];
   assert.equal(a.x,b.x);assert.equal(a.y,b.y);
   assert.equal(a.station,b.station);assert.equal(a.status,b.status);
   assert.equal(Boolean(a.ambientWalk),false);
 }
 for(let i=0;i<scene.staff.length;i++){
   const a=scene.staff[i],b=staffBefore[i];
   assert.equal(a.x,b.x);assert.equal(a.y,b.y);assert.equal(a.status,b.status);
   assert.equal(Boolean(a.ambientWalk),false);
 }
});

test('visitors can lounge, chat and take unique seats without changing ACC students',()=>{
 const scene=makeWorld();
 const student=addApplicant(scene,'sac',0);
 scene.actors=[student];
 const life=new sandbox.AmbientLife(scene),engine={apps:[student],live:true,paused:false};
 const first=scene.ambient[0],initialSeated=first.ambientSeatIndex;
 assert.ok(first.sitting&&initialSeated!=null);
 for(let t=0;t<1000;t++){
   scene.time+=.1;
   life.update(.1,engine);
   const reserved=scene.ambient.map(a=>a.ambientSeatIndex).filter(x=>x!=null);
   assert.equal(new Set(reserved).size,reserved.length,'seat never double booked');
 }
 assert.ok(life.totalAmbientWalks>3,'visitors repeatedly walk');
 assert.ok(scene.ambient.some(a=>a.sitting),'some visitors sit during lounge cycle');
 for(const a of scene.ambient)assert.ok(outside(a),'no NPC wandered into office');
 assert.equal(student.station,'sac');assert.equal(student.status,'WAITING_SAC_ASSIGNMENT');
 assert.ok(scene.ambient.some(a=>a.bubbleKind==='ambient'),'visitor conversation triggered');
});

test('Life Off disables visitor motion but keeps office actors still',()=>{
 const scene=makeWorld(),student=addApplicant(scene,'offer',0),engine={apps:[student],live:true,paused:false};
 scene.actors=[student];const life=new sandbox.AmbientLife(scene);
 scene.time=10;life.wander(engine);
 life.setEnabled(false,engine);
 const positions=scene.ambient.map(a=>[a.x,a.y]);
 for(let i=0;i<100;i++){scene.time+=.1;life.update(.1,engine);}
 scene.ambient.forEach((a,i)=>{assert.equal(a.x,positions[i][0]);assert.equal(a.y,positions[i][1]);assert.equal(a.path.length,0);});
 assert.equal(student.ambientWalk,undefined);
});
