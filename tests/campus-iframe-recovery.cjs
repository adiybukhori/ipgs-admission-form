const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const campusSource=fs.readFileSync(path.join(root,'campus-v9','CampusScene.js'),'utf8')
 .replace(/^import[^\n]*\n/gm,'')
 .replaceAll('import.meta.url',"'file:///campus-v9/'")
 .replace('export class CampusScene','class CampusScene')
 + '\n globalThis.CampusScene=CampusScene;';
const calls=[];
const c=new Proxy({},{
 get(_,key){
  if(['fillStyle','strokeStyle','lineWidth'].includes(key))return undefined;
  return (...args)=>{calls.push([String(key),...args]);};
 },set(){return true;}
});
const sandbox={WORLD:{w:3680,h:2400},STATIONS:[],window:{devicePixelRatio:1},round(){},ellipse(){},text(){},prop(){},drawActor(){}};
vm.createContext(sandbox);
vm.runInContext(campusSource,sandbox,{timeout:1500});
function scene(width=620,height=590){
 const s=Object.create(sandbox.CampusScene.prototype);
 s.canvas={width:0,height:0,getBoundingClientRect:()=>({width,height})};
 s.ctx=c;s.time=0;s.cameraFitted=false;s.camera={x:1630,y:1240,zoom:.55};
 s.follow=false;s.props=[];s.actors=[];s.staff=[];s.ambient=[];s.background={};
 s.resize();return s;
}
test('mobile campus canvas fits whole map rather than opening at oversized zoom',()=>{
 const s=scene(620,590);
 assert.equal(s.cameraFitted,true);
 assert.equal(s.camera.x,1840);assert.equal(s.camera.y,1200);
 assert.ok(s.camera.zoom<.18 && s.camera.zoom>.10,'fit scale for phone viewport');
 assert.equal(s.canvas.width,620);assert.equal(s.canvas.height,590);
});
test('scene.render executes coordinate transform and background drawing every frame',()=>{
 const s=scene();calls.length=0;
 s.render(.016);
 const transforms=calls.filter(a=>a[0]==='setTransform');
 const backgrounds=calls.filter(a=>a[0]==='drawImage');
 assert.ok(transforms.length>=2,'reset transform at beginning and end of frame');
 assert.ok(backgrounds.length>=1,'background is actually painted');
 assert.ok(calls.some(a=>a[0]==='scale'),'world scaling executes');
 assert.equal(s.time,.016);
});
test('zero-size hidden iframe can refit on first visible resize',()=>{
 const s=scene(0,0);
 assert.equal(s.cameraFitted,false);
 s.canvas.getBoundingClientRect=()=>({width:550,height:590});
 s.resize();
 assert.equal(s.cameraFitted,true);
 assert.ok(s.camera.zoom<.15);
});
test('campus parent reports unavailable ACC data and provides retry, never fake zero applicants',()=>{
 const ops=fs.readFileSync(path.join(root,'ai-operations-center.html'),'utf8');
 const bridge=fs.readFileSync(path.join(root,'ai-agent-office.js'),'utf8');
 assert.match(ops,/window\.AI_OPS_DATA_STATE='unavailable'/);
 assert.match(ops,/opsLoadRetryTimer=setTimeout/);
 assert.match(ops,/window\.dispatchEvent\(new CustomEvent\('ipgs-acc-data-updated'\)\)/);
 assert.match(bridge,/campusRetryData/);
 assert.match(bridge,/window\.addEventListener\('ipgs-acc-data-updated'/);
 assert.match(bridge,/campusFrame\.contentWindow\.postMessage\(\{type:'IPGS_CAMPUS_DATA'/);
});
