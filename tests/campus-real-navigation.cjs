// Test the actual campus layout/navigation geometry, not a fake unobstructed office.
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
  s=s.replaceAll('import.meta.url',"'file:///campus-v9/'"); // load() is never invoked; VM only exercises build()
  s+='\n'+exports.map(name=>'globalThis.'+name+'='+name+';').join('\n');
  vm.runInContext(s,sandbox,{timeout:4000,filename:file});
}
load('config.js',['WORLD','STATIONS','BY_ID']);
load('NavigationManager.js',['NavigationManager']);
load('ApplicantActor.js',['ApplicantActor','StaffActor']);
load('CampusScene.js',['CampusScene']);
load('AmbientLife.js',['AmbientLife']);

function makeWorld(){
  const world=Object.create(sandbox.CampusScene.prototype);
  world.nav=new sandbox.NavigationManager(sandbox.WORLD.w,sandbox.WORLD.h);
  world.props=[];world.staff=[];world.loungeSeats=[];world.orientationSeats=[];
  world.stationSeats={};world.actors=[];world.ambient=[];world.time=10;
  world.build();
  return world;
}
function addApplicant(scene,station,i){
  const s=sandbox.BY_ID[station],col=i%6,row=Math.floor(i/6)%5;
  const p={x:s.point.x+(col-2.5)*54,y:s.point.y+(row-1.5)*48};
  const good=scene.nav.point(scene.nav.nearest(p));
  const a=new sandbox.ApplicantActor({id:station+'-'+i,name:'Test '+i,station,status:'WAITING_SAC_ASSIGNMENT'},good.x,good.y,i%8);
  return a;
}

test('visible walk paths exist within actual Admission/SAC/Offer offices',()=>{
  const scene=makeWorld();
  const apps=[...Array.from({length:18},(_,i)=>addApplicant(scene,'admission',i)),
    ...Array.from({length:12},(_,i)=>addApplicant(scene,'sac',i)),
    ...Array.from({length:12},(_,i)=>addApplicant(scene,'offer',i))];
  scene.actors=apps;
  const life=new sandbox.AmbientLife(scene),engine={live:true,paused:false,apps};
  let succeeded=0;
  for(let i=0;i<25;i++){if(life.wander(engine))succeeded++;}
  assert.ok(succeeded>=4,'Four or more actual office-contained walks expected, got '+succeeded);
  assert.ok(apps.filter(a=>a.ambientWalk).length<=8,'Movement concurrency cap');
  for(const a of apps){
    assert.equal(a.status,'WAITING_SAC_ASSIGNMENT');
    if(!a.ambientWalk)continue;
    const room=sandbox.BY_ID[a.station];
    assert.ok(a.path.length,'Actor has route');
    for(const p of a.path){
      assert.ok(p.x>room.x+30&&p.x<room.x+room.w-30,'Within office x '+a.id+' '+p.x);
      assert.ok(p.y>room.y+35&&p.y<room.y+room.h-30,'Within office y '+a.id+' '+p.y);
      assert.equal(scene.nav.blocked[scene.nav.index(p)],0,'Collision-free waypoint');
    }
    const goal=a.path.at(-1);
    assert.ok(Math.hypot(goal.x-a.x,goal.y-a.y)>=55,'Sufficient visible displacement');
    const origin={x:a.x,y:a.y};a.update(.65);
    assert.ok(Math.hypot(a.x-origin.x,a.y-origin.y)>8,'Actually moving after animation frame');
    assert.equal(a.station,a.id.split('-')[0],'Admission stage preserved');
  }
});

test('staff can move around real office furniture without changing workflow',()=>{
  const scene=makeWorld(),apps=[addApplicant(scene,'admission',0)];
  scene.actors=apps;
  const life=new sandbox.AmbientLife(scene),engine={live:true,paused:false,apps};
  let successes=0;
  for(let i=0;i<15;i++)if(life.wander(engine,true))successes++;
  assert.ok(successes>=1,'At least one real staff member can safely walk');
  for(const a of scene.staff){
    assert.ok(!a.ambientWalk||a.path.length>0);
    if(a.ambientWalk)assert.equal(a.status,'WORKING');
  }
});
