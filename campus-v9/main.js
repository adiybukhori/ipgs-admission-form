import{CampusScene}from'./CampusScene.js';
import{WorkflowEngine}from'./WorkflowEngine.js';
import{ActivityHUD}from'./ActivityHUD.js';
import{WorkflowAdapter}from'./WorkflowAdapter.js';

const params=new URLSearchParams(location.search);
const embedded=params.get('embedded')==='1';
if(embedded)document.documentElement.dataset.embedded='1';
const scene=new CampusScene(document.getElementById('campus'));
let engine,hud,liveLoaded=false,liveBusy=false,liveTimer=null,embeddedPassword='';

function reset(){
  scene.staff.forEach(a=>{a.path=[];a.onArrive=null;a.x=a.home.x;a.y=a.home.y;});
  engine=new WorkflowEngine(scene,e=>hud?.event(e));
  if(hud){hud.engine=engine;hud.select(engine.apps[0]||null);document.getElementById('activity').replaceChildren();}
  else hud=new ActivityHUD(engine,scene);
  engine.screen('NEXT ORIENTATION','Waiting for the cohort');
  document.getElementById('pause').textContent='Ⅱ Pause';
  document.getElementById('speed').value='1';scene.follow=false;window.campusV9={scene,engine,hud};
}

function clearDemoForLive(){
  engine.live=true;engine.paused=false;engine.apps=[];scene.actors=[];
  if(hud)hud.select(null);
  scene.selected=null;
  engine.screen('LIVE ADMISSION V2','Waiting for current ACC workflow data');
  document.getElementById('mode').textContent='Live ACC';
  document.getElementById('count').textContent='(0)';
}

function currentPassword(){
  return embeddedPassword||sessionStorage.getItem('ipgsAdminPassword')||'';
}

function postParent(type,payload={}){
  if(window.parent!==window)window.parent.postMessage({type,...payload},location.origin);
}

async function refreshLive({quiet=false}={}){
  if(liveBusy)return;
  const password=currentPassword();
  if(!password){
    const message='Waiting for authenticated ACC session…';
    document.getElementById('liveMessage').textContent=message;
    postParent('IPGS_CAMPUS_AUTH_REQUIRED');
    return;
  }
  liveBusy=true;
  try{
    const snapshot=await WorkflowAdapter.fetchSnapshot(password);
    const result=WorkflowAdapter.sync(engine,snapshot.records,{instant:!liveLoaded});
    liveLoaded=true;hud.select(engine.apps[0]||null);
    const summary=Object.entries(result.counts).map(([k,v])=>`${k}: ${v}`).join(' · ');
    const message=snapshot.records.length
      ?`${snapshot.records.length} live students · ${snapshot.loadedAt||'current snapshot'}${snapshot.warnings.length?' · source warning: '+snapshot.warnings.join('; '):''}`
      :'No active Admission V2 students returned by ACC.';
    document.getElementById('liveMessage').textContent=message;
    document.getElementById('mode').textContent='Live ACC';
    if(!quiet)hud.toast('Admission V2 live snapshot refreshed');
    postParent('IPGS_CAMPUS_SYNCED',{total:snapshot.records.length,counts:result.counts,summary});
  }catch(error){
    const message=error?.message||'Unable to load live Admission V2 data';
    document.getElementById('liveMessage').textContent=message;
    clearDemoForLive();
    if(!quiet)hud.toast('Live ACC refresh failed');
    postParent('IPGS_CAMPUS_ERROR',{message});
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
    clearDemoForLive();
    postParent('IPGS_CAMPUS_READY');
    await refreshLive({quiet:true});
    liveTimer=setInterval(()=>refreshLive({quiet:true}),30000);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLive({quiet:true});});
  }
}catch(error){document.getElementById('loading').textContent='Campus could not load: '+error.message;console.error(error);postParent('IPGS_CAMPUS_ERROR',{message:error.message});}

document.getElementById('reset').onclick=()=>{if(engine.live){refreshLive();return;}reset();hud.toast('Simulation reset');};
document.getElementById('demo').onclick=()=>{liveLoaded=false;embeddedPassword='';reset();document.getElementById('liveMessage').textContent='';document.getElementById('mode').textContent='Simulation';};
document.getElementById('liveForm').onsubmit=async event=>{event.preventDefault();const input=document.getElementById('password'),button=event.target.querySelector('button');button.disabled=true;try{sessionStorage.setItem('ipgsAdminPassword',input.value);embeddedPassword=input.value;clearDemoForLive();await refreshLive();}finally{input.value='';button.disabled=false;}};

window.addEventListener('message',event=>{
  if(event.origin!==location.origin)return;
  if(event.data?.type==='IPGS_CAMPUS_AUTH'){
    embeddedPassword=String(event.data.password||'');
    if(embeddedPassword){clearDemoForLive();refreshLive({quiet:true});}
    return;
  }
  if(event.data?.type==='IPGS_CAMPUS_REFRESH')refreshLive({quiet:true});
});
window.addEventListener('beforeunload',()=>{if(liveTimer)clearInterval(liveTimer);});
