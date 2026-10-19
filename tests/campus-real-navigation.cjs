// Integration tests against actual Campus V9 offices, furniture and navigation.
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
load('config.js',['WORLD','STATIONS','BY_ID','ROUTES']);
load('NavigationManager.js',['NavigationManager']);
load('ApplicantActor.js',['ApplicantActor','StaffActor']);
load('CampusScene.js',['CampusScene']);
load('CampusOccupancy.js',['CampusOccupancy','OFFICE_DISPLAY_CAPACITY','publicWaitingArea']);
load('AmbientLife.js',['AmbientLife']);
load('WorkflowAdapter.js',['WorkflowAdapter']);
function world(){
 const s=Object.create(sandbox.CampusScene.prototype);
 s.nav=new sandbox.NavigationManager(sandbox.WORLD.w,sandbox.WORLD.h);
 s.props=[];s.staff=[];s.loungeSeats=[];s.orientationSeats=[];s.stationSeats={};
 s.actors=[];s.ambient=[];s.time=0;s.build();return s;
}
function engine(scene){
 return {scene,apps:[],screen(){},emit(){},live:false,paused:false};
}
function records(count,station,prefix){
 return Array.from({length:count},(_,i)=>({
  id:(prefix||station)+'/'+String(i+1).padStart(4,'0'),
  name:'Applicant '+i,station,status:'WAITING_SAC_SESSION',
  programme:'MBA',next:station,route:['admission','sac','offer'],
  reason:'Waiting',profile:i%8,live:true
 }));
}
test('real ACC applicants alone fill public lounge when offices reach visual capacity',()=>{
 const scene=world(),e=engine(scene);
 const arr=[...records(83,'admission'),...records(68,'sac'),...records(55,'offer')];
 assert.equal(scene.ambient.length,0,'zero fabricated NPC avatars');
 const out=sandbox.WorkflowAdapter.sync(e,arr,{instant:true});
 assert.equal(out.total,206);
 assert.equal(e.apps.length,206);
 assert.equal(out.overflow,206-(10+12+12));
 const ids=new Set(e.apps.map(a=>a.id));
 assert.equal(ids.size,e.apps.length,'one avatar per real applicant');
 const outdoor=e.apps.filter(a=>a.overflow);
 assert.equal(outdoor.length,172);
 const navIndex=new Set();
 for(const a of outdoor){
  assert.ok(sandbox.publicWaitingArea(a),'overflow outside office');
  assert.equal(scene.nav.blocked[scene.nav.index(a)],0,'waiting spot walkable');
  assert.ok(!navIndex.has(scene.nav.index(a)),'unique corridor spot');
  navIndex.add(scene.nav.index(a));
  assert.ok(['admission','sac','offer'].includes(a.station),'ACC stage preserved');
  assert.equal(a.physicalZone,'waiting-lounge');
 }
 for(const a of e.apps.filter(a=>!a.overflow)){
  const room=sandbox.BY_ID[a.station];
  assert.ok(a.x>room.x&&a.x<room.x+room.w&&a.y>room.y&&a.y<room.y+room.h,
    'within assigned office '+a.id);
  assert.equal(a.physicalZone,'office');
 }
 const staff=scene.staff.map(a=>({a,x:a.x,y:a.y}));
 const life=new sandbox.AmbientLife(scene);
 scene.time=12;
 for(let i=0;i<18;i++)life.wander(e);
 assert.ok(outdoor.filter(a=>a.ambientWalk).length>=2,'several real overflow applicants walk');
 assert.equal(e.apps.filter(a=>!a.overflow&&a.ambientWalk).length,0,'inside office never ambient-walks');
 const walkers=outdoor.filter(a=>a.ambientWalk);
 for(const a of walkers){
  assert.ok(a.path.every(p=>sandbox.publicWaitingArea(p)),'route never crosses office');
  assert.ok(a.path.every(p=>!scene.nav.blocked[scene.nav.index(p)]),'path avoids walls');
  const last=a.path.at(-1),before={x:a.x,y:a.y};
  a.update(.8);
  assert.ok(Math.hypot(a.x-before.x,a.y-before.y)>6,'applicant physically moves');
  assert.ok(sandbox.publicWaitingArea(last),'destination in corridor');
  assert.equal(a.status,'WAITING_SAC_SESSION','never alters ACC status');
 }
 for(const p of staff){assert.equal(p.a.x,p.x);assert.equal(p.a.y,p.y);}
});

test('refresh retains real student identities and avoids shuffling position',()=>{
 const s=world(),e=engine(s),arr=[...records(28,'admission'),...records(18,'sac')];
 sandbox.WorkflowAdapter.sync(e,arr,{instant:true});
 const before=new Map(e.apps.map(a=>[a.id,{x:a.x,y:a.y,stage:a.station,overflow:a.overflow}]));
 sandbox.WorkflowAdapter.sync(e,arr.slice().reverse());
 for(const a of e.apps){
  const b=before.get(a.id);
  assert.equal(a.x,b.x);assert.equal(a.y,b.y);
  assert.equal(a.station,b.stage);assert.equal(a.overflow,b.overflow);
 }
});

test('student outside goes inside when a room place becomes available without new ACC stage',()=>{
 const s=world(),e=engine(s),arr=records(13,'sac');
 sandbox.WorkflowAdapter.sync(e,arr,{instant:true});
 const overflow=e.apps.find(a=>a.overflow);
 assert.ok(overflow,'SAC has actual student waiting outside');
 // Remove the first of twelve inside by ID, creating a room vacancy.
 const next=arr.filter(a=>a.id!==arr[0].id);
 sandbox.WorkflowAdapter.sync(e,next);
 const moved=e.apps.find(a=>a.id===overflow.id);
 assert.equal(moved.station,'sac');
 assert.equal(moved.status,'WAITING_SAC_SESSION');
 assert.equal(moved.overflow,false);
 assert.equal(moved.workflowMove,true);
 assert.ok(moved.path.length,'visual admission to office triggered');
 assert.ok(!moved.ambientWalk);
});

test('real overflow sit and converse, with unique lounge seats',()=>{
 const s=world(),e=engine(s),arr=[...records(45,'admission'),...records(30,'sac')];
 sandbox.WorkflowAdapter.sync(e,arr,{instant:true});
 const life=new sandbox.AmbientLife(s);
 let maxSeated=0;
 for(let t=0;t<1100;t++){
  s.time+=.1;
  for(const a of e.apps)a.update(.1);
  life.update(.1,e);
  const reserved=e.apps.filter(a=>a.overflow&&a.ambientSeatIndex!=null).map(a=>a.ambientSeatIndex);
  assert.equal(new Set(reserved).size,reserved.length,'single student per seat');
  maxSeated=Math.max(maxSeated,e.apps.filter(a=>a.overflow&&a.sitting).length);
 }
 assert.ok(life.totalAmbientWalks>3,'repeated walking by real applicants');
 assert.ok(maxSeated>0,'real student sits in lounge');
 assert.ok(e.apps.some(a=>a.overflow&&a.bubbleKind==='ambient'),'real students converse');
 assert.equal(s.ambient.length,0);
});
