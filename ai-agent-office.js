(function IPGS_AI_OFFICE_BOOTSTRAP(){
'use strict';

let campusFrame=null;
let campusSyncTimer=null;
let campusReady=false;

function addCampusStyles(){
  if(document.getElementById('campusLiveStyles'))return;
  const style=document.createElement('style');
  style.id='campusLiveStyles';
  style.textContent=`
    .campus-live-shell{border:1px solid var(--line);border-radius:18px;overflow:hidden;background:#0a1025;position:relative}
    .campus-live-frame{display:block;width:100%;height:760px;border:0;background:#ece6d9}
    .campus-live-note{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:11px 14px;border-top:1px solid var(--line);font-size:10px;color:#8f9ac3;background:rgba(7,9,20,.92)}
    .campus-live-note b{color:#bffbea}
    .campus-live-status{margin-left:auto;color:#bffbea;font-weight:800}
    @media(max-width:900px){.campus-live-frame{height:650px}}
    @media(max-width:620px){.campus-live-frame{height:590px}.campus-live-note{align-items:flex-start}.campus-live-status{margin-left:0;width:100%}}
  `;
  document.head.appendChild(style);
}

function campusDataPayload(){
  const s=window.AI_OPS_STATE||{};
  return {
    V2_APPLICATIONS:Array.isArray(s.apps)?s.apps:[],
    V2_WORKFLOW:Array.isArray(s.workflow)?s.workflow:[],
    V2_DOCUMENT_REVIEW:Array.isArray(s.docReview)?s.docReview:[],
    V2_AI_SCREENING:Array.isArray(s.aiScreening)?s.aiScreening:[],
    V2_QUALIFICATION_SCREENING:Array.isArray(s.qualification)?s.qualification:[],
    V2_SAC_CANDIDATES:Array.isArray(s.sacCandidates)?s.sacCandidates:[],
    V2_ASSESSMENT_PROGRESS:Array.isArray(s.assessment)?s.assessment:[],
    V2_ORIENTATION_TRACKING:Array.isArray(s.orientation)?s.orientation:[],
    V2_PROVISIONING:Array.isArray(s.provisioning)?s.provisioning:[],
    V2_HANDOVER_STUDENTS:Array.isArray(s.handover)?s.handover:[],
    V2_AGENT_EVENTS:Array.isArray(s.agentEvents)?s.agentEvents:[],
    V2_AGENT_EXECUTIONS:Array.isArray(s.agentExecutions)?s.agentExecutions:[],
    V2_HUMAN_TASKS:Array.isArray(s.humanTasks)?s.humanTasks:[]
  };
}

function setCampusStatus(text){
  const status=document.getElementById('campusLiveStatus');
  if(status)status.textContent=text;
}

function sendCampusData(){
  if(!campusFrame?.contentWindow||!campusReady)return false;
  const payload=campusDataPayload();
  if(!payload.V2_APPLICATIONS.length&&!payload.V2_WORKFLOW.length){
    setCampusStatus('Waiting for ACC data…');
    return false;
  }
  campusFrame.contentWindow.postMessage({type:'IPGS_CAMPUS_DATA',data:payload,loadedAt:new Date().toISOString()},location.origin);
  setCampusStatus(`Syncing ${payload.V2_APPLICATIONS.length||payload.V2_WORKFLOW.length} students…`);
  return true;
}

function scheduleCampusSync(){
  clearInterval(campusSyncTimer);
  campusSyncTimer=setInterval(()=>{
    if(sendCampusData()){
      clearInterval(campusSyncTimer);
      campusSyncTimer=setInterval(()=>sendCampusData(),30000);
    }
  },400);
}

function injectCampusView(){
  if(document.getElementById('opsCampusView'))return;
  const nav=document.querySelector('.ops-nav');
  const journeyButton=nav?.querySelector('[data-view="journey"]');
  if(!nav||!journeyButton)return;

  addCampusStyles();

  const button=document.createElement('button');
  button.type='button';
  button.dataset.view='campus';
  button.textContent='Campus View';
  button.addEventListener('click',()=>{
    window.switchOpsView?.('campus');
    setTimeout(()=>{if(!sendCampusData())scheduleCampusSync();},60);
  });
  nav.insertBefore(button,journeyButton);

  const journey=document.getElementById('opsJourneyView')||document.querySelector('.ops-view[data-view="journey"]');
  if(!journey)return;

  const section=document.createElement('section');
  section.className='ops-view';
  section.dataset.view='campus';
  section.id='opsCampusView';
  section.innerHTML=`
    <div class="tab-shell">
      <div class="tab-shell-head">
        <div>
          <div class="eyebrow">LIVE ADMISSION V2 · READ-ONLY VISUAL OPERATIONS</div>
          <h2>Campus View</h2>
          <p>Students are positioned by their current Admission V2 stage and move to the next operational area when the authoritative workflow state changes.</p>
        </div>
        <span class="tag green">LIVE · SHARED ACC DATA</span>
      </div>
      <div class="tab-shell-body">
        <div class="campus-live-shell">
          <iframe id="campusLiveFrame" class="campus-live-frame" src="/campus-rpg-v9.html?embedded=1" title="IPGS live admissions campus simulation" loading="lazy"></iframe>
          <div class="campus-live-note">
            <b>Admission V2 is authoritative.</b>
            <span>Campus View reuses data already loaded by this dashboard, so it does not call ACC a second time.</span>
            <span id="campusLiveStatus" class="campus-live-status">Starting…</span>
          </div>
        </div>
      </div>
    </div>`;
  journey.parentNode.insertBefore(section,journey);
  campusFrame=document.getElementById('campusLiveFrame');
  scheduleCampusSync();

  window.addEventListener('message',event=>{
    if(event.origin!==location.origin)return;
    if(event.data?.type==='IPGS_CAMPUS_READY'){
      campusReady=true;
      setCampusStatus('Campus ready · waiting for ACC data');
      if(!sendCampusData())scheduleCampusSync();
    }
    if(event.data?.type==='IPGS_CAMPUS_SYNCED')setCampusStatus(`Live · ${Number(event.data.total)||0} students`);
    if(event.data?.type==='IPGS_CAMPUS_ERROR')setCampusStatus('Campus sync error · dashboard remains active');
  });
}

function loadCore(){
  const core=document.createElement('script');
  core.src='/ai-agent-office-core.js';
  core.async=false;
  core.onload=()=>{
    injectCampusView();
    window.dispatchEvent(new CustomEvent('ipgs-campus-view-ready'));
  };
  core.onerror=()=>console.error('AI Office core could not be loaded.');
  document.body.appendChild(core);
}

loadCore();
})();
