import{CampusScene}from'./CampusScene.js';
import{WorkflowEngine}from'./WorkflowEngine.js';
import{ActivityHUD}from'./ActivityHUD.js';
import{WorkflowAdapter}from'./WorkflowAdapter.js';

const params=new URLSearchParams(location.search);
const embedded=params.get('embedded')==='1';
if(embedded)document.documentElement.dataset.embedded='1';
const scene=new CampusScene(document.getElementById('campus'));
let engine,hud,liveLoaded=false,liveBusy=false,embeddedPassword='';

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

function postParent(type,payload={}){
  if(window.parent!==window)window.parent.postMessage({type,...payload},location.origin);
}

function applySharedSnapshot(message){
  const records=WorkflowAdapter.normalize(message.data||{});
  const result=WorkflowAdapter.sync(engine,records,{instant:!liveLoaded});
  liveLoaded=true;hud.select(engine.apps[0]||null);
  document.getElementById('liveMessage').textContent=`${records.length} live students · shared from AI Operations Center`;
  document.getElementById('mode').textContent='Live ACC';
  postParent('IPGS_CAMPUS_SYNCED',{total:records.length,counts:result.counts});
}

async function refreshStandalone({quiet=false}={}){
  if(embedded||liveBusy)return;
  const password=embeddedPassword||sessionStorage.getItem('ipgsAdminPassword')||'';
  if(!password){if(!quiet)document.getElementById('liveMessage').textContent='Open Campus View from an authenticated ACC session.';return;}
  liveBusy=true;
  try{
    const snapshot=await WorkflowAdapter.fetchSnapshot(password);
    applySharedSnapshot({data:snapshot.raw||{},loadedAt:snapshot.loadedAt});
    if(!quiet)hud.toast('Admission V2 live snapshot refreshed');
  }catch(error){
    document.getElementById('liveMessage').textContent=error?.message||'Unable to load live Admission V2 data';
    if(!quiet)hud.toast('Live ACC refresh failed');
  }finally{liveBusy=false;}
}

try{
  await scene.load();reset();document.getElementById('loading').hidden=true;
  let last=performance.now(),lastPaint=0;
  function frame(now){
    if(embedded&&now-lastPaint<33){requestAnimationFrame(frame);return;}
    let dt=Math.min((now-last)/1000,.1);last=now;lastPaint=now;
    if(engine.live){if(!engine.paused){engine.clock+=dt;for(const a of [...engine.apps,...scene.staff])a.update(dt);}}
    else engine.update(dt);
    scene.render(engine.paused?0:dt);hud.render();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if(embedded){
    clearDemoForLive();
    document.getElementById('liveMessage').textContent='Waiting for data already loaded by AI Operations Center…';
    postParent('IPGS_CAMPUS_READY');
  }
}catch(error){document.getElementById('loading').textContent='Campus could not load: '+error.message;console.error(error);postParent('IPGS_CAMPUS_ERROR',{message:error.message});}

document.getElementById('reset').onclick=()=>{if(engine.live){if(!embedded)refreshStandalone();return;}reset();hud.toast('Simulation reset');};
document.getElementById('demo').onclick=()=>{if(embedded)return;liveLoaded=false;embeddedPassword='';reset();document.getElementById('liveMessage').textContent='';document.getElementById('mode').textContent='Simulation';};
document.getElementById('liveForm').onsubmit=async event=>{event.preventDefault();if(embedded)return;const input=document.getElementById('password'),button=event.target.querySelector('button');button.disabled=true;try{sessionStorage.setItem('ipgsAdminPassword',input.value);embeddedPassword=input.value;clearDemoForLive();await refreshStandalone();}finally{input.value='';button.disabled=false;}};

window.addEventListener('message',event=>{
  if(event.origin!==location.origin)return;
  if(event.data?.type==='IPGS_CAMPUS_DATA'){
    try{applySharedSnapshot(event.data);}catch(error){
      document.getElementById('liveMessage').textContent='Campus sync error: '+error.message;
      postParent('IPGS_CAMPUS_ERROR',{message:error.message});
      console.error(error);
    }
    return;
  }
  if(event.data?.type==='IPGS_CAMPUS_AUTH'){
    embeddedPassword=String(event.data.password||'');
    if(!embedded&&embeddedPassword){clearDemoForLive();refreshStandalone({quiet:true});}
    return;
  }
  if(event.data?.type==='IPGS_CAMPUS_REFRESH'&&!embedded)refreshStandalone({quiet:true});
});
