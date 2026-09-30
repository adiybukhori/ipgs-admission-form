import{CampusScene}from'./CampusScene.js';
import{WorkflowEngine}from'./WorkflowEngine.js';
import{ActivityHUD}from'./ActivityHUD.js';
import{WorkflowAdapter}from'./WorkflowAdapter.js';

const params=new URLSearchParams(location.search);
const embedded=params.get('embedded')==='1';
if(embedded)document.documentElement.dataset.embedded='1';
const scene=new CampusScene(document.getElementById('campus'));
let engine,hud,liveLoaded=false,liveBusy=false,liveTimer=null;

function reset(){
  scene.staff.forEach(a=>{a.path=[];a.onArrive=null;a.x=a.home.x;a.y=a.home.y;});
  engine=new WorkflowEngine(scene,e=>hud?.event(e));
  if(hud){hud.engine=engine;hud.select(engine.apps[0]);document.getElementById('activity').replaceChildren();}
  else hud=new ActivityHUD(engine,scene);
  engine.screen('NEXT ORIENTATION','Waiting for the cohort');
  document.getElementById('pause').textContent='Ⅱ Pause';
  document.getElementById('speed').value='1';scene.follow=false;window.campusV9={scene,engine,hud};
}

function clearDemoForLive(){
  engine.live=true;engine.paused=false;engine.apps=[];scene.actors=[];
  engine.screen('LIVE ADMISSION V2','Waiting for current ACC workflow data');
  document.getElementById('mode').textContent='Live ACC';
}

async function refreshLive({quiet=false}={}){
  if(liveBusy)return;const password=sessionStorage.getItem('ipgsAdminPassword')||'';
  if(!password){if(!quiet)document.getElementById('liveMessage').textContent='Open Campus View from the authenticated AI Dashboard / ACC session.';return;}
  liveBusy=true;
  try{
    const snapshot=await WorkflowAdapter.fetchSnapshot(password);
    const result=WorkflowAdapter.sync(engine,snapshot.records,{instant:!liveLoaded});
    liveLoaded=true;hud.select(engine.apps[0]||null);
    const summary=Object.entries(result.counts).map(([k,v])=>`${k}: ${v}`).join(' · ');
    document.getElementById('liveMessage').textContent=`${snapshot.records.length} live students · ${snapshot.loadedAt||'current snapshot'}${snapshot.warnings.length?' · source warning: '+snapshot.warnings.join('; '):''}`;
    document.getElementById('mode').textContent='Live ACC';
    if(!quiet)hud.toast('Admission V2 live snapshot refreshed');
    if(window.parent!==window)window.parent.postMessage({type:'IPGS_CAMPUS_SYNCED',total:snapshot.records.length,counts:result.counts,summary},location.origin);
  }catch(error){
    document.getElementById('liveMessage').textContent=error.message;
    if(!quiet)hud.toast('Live ACC refresh failed');
  }finally{liveBusy=false;}
}

try{
  await scene.load();reset();document.getElementById('loading').hidden=true;
  let last=performance.now();
  function frame(now){
    let dt=Math.min((now-last)/1000,.1);last=now;
    if(engine.live){if(!engine.paused){engine.clock+=dt;for(const a of [...engine.apps,...scene.staff])a.update(dt);}}
    else engine.update(dt);
    scene.render(engine.paused?0:dt);hud.render();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if(embedded){
    clearDemoForLive();await refreshLive({quiet:true});
    liveTimer=setInterval(()=>refreshLive({quiet:true}),30000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLive({quiet:true});});
    window.parent?.postMessage({type:'IPGS_CAMPUS_READY'},location.origin);
  }
}catch(error){document.getElementById('loading').textContent='Campus could not load: '+error.message;console.error(error);}

document.getElementById('reset').onclick=()=>{if(engine.live){refreshLive();return;}reset();hud.toast('Simulation reset');};
document.getElementById('demo').onclick=()=>{liveLoaded=false;reset();document.getElementById('liveMessage').textContent='';document.getElementById('mode').textContent='Simulation';};
document.getElementById('liveForm').onsubmit=async event=>{event.preventDefault();const input=document.getElementById('password'),button=event.target.querySelector('button');button.disabled=true;try{sessionStorage.setItem('ipgsAdminPassword',input.value);clearDemoForLive();await refreshLive();}finally{input.value='';button.disabled=false;}};

window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.data?.type!=='IPGS_CAMPUS_REFRESH')return;
  refreshLive({quiet:true});
});
window.addEventListener('beforeunload',()=>{if(liveTimer)clearInterval(liveTimer);});
