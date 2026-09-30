(function IPGS_AI_OFFICE_BOOTSTRAP(){
'use strict';

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
    .campus-live-status.error{color:#ff9aaa}
    @media(max-width:900px){.campus-live-frame{height:650px}}
    @media(max-width:620px){.campus-live-frame{height:590px}.campus-live-note{align-items:flex-start}.campus-live-status{margin-left:0;width:100%}}
  `;
  document.head.appendChild(style);
}

function sendCampusAuth(){
  const frame=document.getElementById('campusLiveFrame');
  const password=sessionStorage.getItem('ipgsAdminPassword')||'';
  if(!frame?.contentWindow||!password)return false;
  frame.contentWindow.postMessage({type:'IPGS_CAMPUS_AUTH',password},location.origin);
  return true;
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
  button.addEventListener('click',()=>{window.switchOpsView?.('campus');setTimeout(sendCampusAuth,80);});
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
        <span class="tag green">LIVE · 30 SEC REFRESH</span>
      </div>
      <div class="tab-shell-body">
        <div class="campus-live-shell">
          <iframe id="campusLiveFrame" class="campus-live-frame" src="/campus-rpg-v9.html?embedded=1" title="IPGS live admissions campus simulation" loading="lazy"></iframe>
          <div class="campus-live-note">
            <b>Admission V2 is authoritative.</b>
            <span>This view only reads workflow data; it does not write, approve, route, email or change student records.</span>
            <span id="campusLiveStatus" class="campus-live-status">Connecting…</span>
          </div>
        </div>
      </div>
    </div>`;
  journey.parentNode.insertBefore(section,journey);

  const frame=document.getElementById('campusLiveFrame');
  frame?.addEventListener('load',()=>setTimeout(sendCampusAuth,60));

  window.addEventListener('message',event=>{
    if(event.origin!==location.origin)return;
    const status=document.getElementById('campusLiveStatus');
    if(!status)return;
    if(event.data?.type==='IPGS_CAMPUS_READY'){
      status.classList.remove('error');
      status.textContent='Connected · loading students';
      sendCampusAuth();
    }
    if(event.data?.type==='IPGS_CAMPUS_AUTH_REQUIRED'){
      status.classList.remove('error');
      status.textContent='Authenticating ACC…';
      sendCampusAuth();
    }
    if(event.data?.type==='IPGS_CAMPUS_SYNCED'){
      status.classList.remove('error');
      const total=Number(event.data.total)||0;
      status.textContent=total?`Live · ${total} students`:'Live · no active students returned';
    }
    if(event.data?.type==='IPGS_CAMPUS_ERROR'){
      status.classList.add('error');
      status.textContent=`Campus data error · ${event.data.message||'refresh failed'}`;
    }
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
