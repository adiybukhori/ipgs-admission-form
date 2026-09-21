import assert from 'node:assert/strict';
import {CampusScene} from '../CampusScene.js';
import {WorkflowEngine} from '../WorkflowEngine.js';
import {WorkflowAdapter} from '../WorkflowAdapter.js';
global.window={devicePixelRatio:1,addEventListener(){}};
const canvas={getContext(){return{}},getBoundingClientRect(){return{width:1536,height:884}},addEventListener(){}};
const scene=new CampusScene(canvas),events=[];const engine=new WorkflowEngine(scene,e=>events.push({type:e.type,name:e.app?.name,station:e.app?.station}));
assert.equal(engine.apps.length,12);engine.paused=true;const clock=engine.clock;engine.update(20);assert.equal(engine.clock,clock);engine.paused=false;
const held=engine.apps[1];engine.hold(held);assert.equal(held.status,'WAITING_HUMAN_DECISION');engine.update(1);assert.equal(held.status,'WAITING_HUMAN_DECISION');engine.hold(held);assert.equal(held.held,false);
while(engine.apps.length<30)assert.ok(engine.add());assert.equal(engine.add(),false);
let maxConcurrent=0;for(let i=0;i<36000;i++){engine.update(.1);if(i%300===0)engine.orientation.start();maxConcurrent=Math.max(maxConcurrent,engine.apps.filter(a=>a.status==='PROCESSING').length);for(const s of Object.values(engine.stations))assert.ok(s.occupants.size<=s.capacity,s.id+' exceeds capacity');const reserved=engine.lounge.seats.map(s=>s.occupant).filter(Boolean);assert.equal(new Set(reserved).size,reserved.length);for(const a of engine.apps){assert.ok(!a.moveError,a.name+' '+a.moveError);if(a.path.length)assert.equal(scene.nav.blocked[scene.nav.index(a)],0,a.name+' entered an obstacle');}}
assert.ok(maxConcurrent>=3);assert.equal(engine.apps.filter(a=>a.status==='COMPLETED').length,30);
for(const a of engine.apps){const route=a.route;assert.equal(route.filter(s=>s==='sac').length,1);if(route.includes('prerequisite'))assert.equal(route[route.indexOf('prerequisite')+1],'offer');}
const live=WorkflowAdapter.normalize({V2_APPLICATIONS:[{'Reference No':'TEST-1','Student Name':'Test Name'}],V2_WORKFLOW:[{'Reference No':'TEST-1','Application Stage':'UNRECOGNIZED'}]});assert.equal(live[0].status,'WAITING_HUMAN_DECISION');
console.log('PASS: 30 complete journeys; capacities; reserved seats; padded navigation; pause; human hold; routes; unknown live states. Peak parallel processing: '+maxConcurrent);
