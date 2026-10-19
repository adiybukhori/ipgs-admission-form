const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'campus-v9','AmbientLife.js'),'utf8')
 .replace(/^import \{BY_ID, STATIONS\} from '\.\/config\.js';\s*/,'')
 .replace('export class AmbientLife','class AmbientLife')
 +'\n globalThis.AmbientLife=AmbientLife;';
const room={id:'admission',label:'Admission',x:100,y:100,w:560,h:520};
const other={id:'sac',label:'SAC · Committee',x:750,y:100,w:560,h:520};
const ctx={BY_ID:{admission:room,sac:other},STATIONS:[room,other]};
vm.createContext(ctx);
vm.runInContext(source,ctx,{timeout:1000});
const Actor=(id,x,y,station='admission')=>({
 id,x,y,station,status:'WAITING_SAC_ASSIGNMENT',path:[],pose:'idle',
 say(msg,now,kind='workflow'){this.bubble=msg;this.bubbleKind=kind;this.bubbleUntil=now+4;},
 moveTo(dest,nav,cb){this.path=nav.path(this,dest);this.pose='walking';this.onArrive=cb;},
});
const scene=(people=[])=>({
 actors:people,staff:[],time:10,follow:false,
 nav:{nearest:p=>p,point:p=>p,path:(a,to)=>[to]},
 camera:{},focusCount:0,
 focus(a){this.selected=a;this.follow=true;this.focusCount++;},
 fullMap(){this.follow=false;this.restored=true;}
});
test('ambient chats never change workflow station or status',()=>{
 const people=Array.from({length:5},(_,i)=>Actor('s'+i,350+i*10,350));
 const s=scene(people),ambient=new ctx.AmbientLife(s),engine={apps:people,live:true,paused:false};
 ambient.chat(engine);
 assert.ok(people.some(a=>a.bubbleKind==='ambient'));
 assert.ok(people.filter(a=>a.bubbleUntil>s.time).length<=3);
 for(const a of people){assert.equal(a.station,'admission');assert.equal(a.status,'WAITING_SAC_ASSIGNMENT');}
});
test('no more than three bubbles if real workflow alert already exists',()=>{
 const people=Array.from({length:6},(_,i)=>Actor('s'+i,350+i*10,350));
 people[0].say('→ SAC',10,'workflow');people[1].say('→ Offer',10,'workflow');
 const s=scene(people),ambient=new ctx.AmbientLife(s);
 ambient.chat({apps:people,live:true,paused:false});
 assert.ok(people.filter(a=>a.bubbleUntil>s.time).length<=3);
 assert.equal(people[0].bubbleKind,'workflow');
});
test('real movements get workflow labels; camera only auto-follows if opted in',()=>{
 const actor=Actor('s1',350,350),s=scene([actor]),ambient=new ctx.AmbientLife(s);
 ambient.onMovements([{actor,from:'admission',to:'sac'}],{apps:[actor]},null);
 assert.equal(actor.bubbleKind,'workflow');assert.match(actor.bubble,/SAC/);
 assert.equal(s.follow,false);
 ambient.setAutoFollow(true);
 actor.bubbleUntil=0;
 ambient.onMovements([{actor,from:'admission',to:'sac'}],{apps:[actor]},null);
 assert.equal(s.follow,true);assert.equal(s.focusCount,1);
 s.time=22;ambient.update(.1,{apps:[actor],paused:false,live:true});
 assert.equal(s.follow,false);assert.equal(s.restored,true);
});
test('animation toggle clears ambient dialogue without clearing workflow alerts',()=>{
 const a=Actor('a',350,350),b=Actor('b',370,350);
 const s=scene([a,b]),ambient=new ctx.AmbientLife(s);
 a.say('Hi!',10,'ambient');b.say('→ SAC',10,'workflow');
 ambient.setEnabled(false,{apps:[a,b]});
 assert.equal(a.bubble,'');assert.equal(b.bubble,'→ SAC');
 const station=a.station;ambient.update(1,{apps:[a,b],paused:false,live:true});
 assert.equal(a.station,station);
});
test('ambient wandering is restricted to LIVE and never changes office',()=>{
 const a=Actor('s1',350,350),s=scene([a]),ambient=new ctx.AmbientLife(s);
 ambient.wander({apps:[a],live:false});
 assert.equal(a.path.length,0);
 ambient.wander({apps:[a],live:true});
 assert.equal(a.station,'admission');assert.equal(a.status,'WAITING_SAC_ASSIGNMENT');
 if(a.path.length){assert.ok(a.path.every(p=>p.x>room.x&&p.x<room.x+room.w&&p.y>room.y&&p.y<room.y+room.h));}
});
test('live adapter surfaces real movements for animations without changing stages',()=>{
 const code=fs.readFileSync(path.join(root,'campus-v9','WorkflowAdapter.js'),'utf8');
 assert.match(code,/movements\.push\(\{actor:a,from:/);
 assert.match(code,/return\{total:records\.length,counts,movements\}/);
 assert.match(fs.readFileSync(path.join(root,'campus-v9','main.js'),'utf8'),/life\.onMovements\(result\.movements/);
});
