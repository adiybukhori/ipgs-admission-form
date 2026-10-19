const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'campus-v9','AmbientLife.js'),'utf8')
 .replace(/^import[^\n]*\n/gm,'')
 .replace('export class AmbientLife','class AmbientLife')
 +'\n globalThis.AmbientLife=AmbientLife;';
const context={BY_ID:{sac:{label:'SAC · Committee'}},publicWaitingArea:p=>p.x>=295&&p.x<=3485&&p.y>=970&&p.y<=1515};
vm.createContext(context);vm.runInContext(source,context,{timeout:1000});
function actor(id,x=710,y=1190,overflow=true){
 return {id,name:'Real student '+id,x,y,station:'sac',status:'WAITING_SAC_SESSION',
  overflow,pose:'idle',path:[],ambientNextAt:0,
  say(text,time,kind){this.bubble=text;this.bubbleUntil=time+4;this.bubbleKind=kind;}
 };
}
function scene(apps){
 return {
  actors:apps,staff:[],ambient:[],time:10,follow:false,
  loungeSeats:[{x:670,y:1395},{x:810,y:1395}],
  nav:{nearest:p=>p,point:p=>p,path:(a,p)=>[p]},
  focus(a){this.follow=true;this.selected=a;},
  fullMap(){this.follow=false;this.restored=true;}
 };
}
test('speech bubbles come from actual outside students, not fabricated NPCs',()=>{
 const a=actor('A'),b=actor('B',760,1200),inside=actor('C',760,1220,false);
 const s=scene([a,b,inside]),life=new context.AmbientLife(s),e={apps:[a,b,inside],live:true,paused:false};
 life.chat(e);
 assert.ok([a,b].some(x=>x.bubbleKind==='ambient'));
 assert.equal(inside.bubble,undefined);
 assert.equal(s.ambient.length,0);
 assert.equal(a.station,'sac');assert.equal(a.status,'WAITING_SAC_SESSION');
});
test('real workflow movement bubbles and opt-in auto camera remain available',()=>{
 const a=actor('A'),s=scene([a]),life=new context.AmbientLife(s),e={apps:[a],live:true,paused:false};
 life.onMovements([{actor:a,from:'admission',to:'sac'}],e,null);
 assert.equal(a.bubbleKind,'workflow');
 assert.equal(s.follow,false);
 life.setAutoFollow(true);a.bubbleUntil=0;
 life.onMovements([{actor:a,from:'admission',to:'sac'}],e,null);
 assert.equal(s.follow,true);
 s.time=25;life.update(.1,e);
 assert.equal(s.follow,false);
});
test('Life Off stops only decorative walking and leaves workflow intact',()=>{
 const a=actor('A'),inside=actor('inside',720,1200,false);
 const s=scene([a,inside]),life=new context.AmbientLife(s),e={apps:[a,inside],live:true,paused:false};
 a.ambientWalk=true;a.path=[{x:800,y:1200}];
 inside.workflowMove=true;inside.path=[{x:750,y:1200}];
 life.setEnabled(false,e);
 assert.equal(a.path.length,0);assert.equal(a.ambientWalk,false);
 assert.equal(inside.path.length,1);assert.equal(inside.workflowMove,true);
 assert.equal(inside.station,'sac');
});
test('no recreational movement for inside-office student',()=>{
 const inside=actor('inside',760,1200,false),s=scene([inside]);
 const life=new context.AmbientLife(s),e={apps:[inside],live:true,paused:false};
 assert.equal(life.beginTrip(inside,e),false);
 assert.equal(life.wander(e),false);
 assert.equal(inside.path.length,0);
});
test('the live adapter passes true ACC movements to display but never moves staff ambiently',()=>{
 const adapter=fs.readFileSync(path.join(root,'campus-v9','WorkflowAdapter.js'),'utf8');
 assert.match(adapter,/movements.push\(\{actor:a,from:/);
 assert.match(adapter,/assignedStation|physicalZone|overflow/);
 const main=fs.readFileSync(path.join(root,'campus-v9','main.js'),'utf8');
 assert.match(main,/life\.onMovements\(result\.movements/);
});
