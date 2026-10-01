(function latestGuideTrainingPatch(){
  if(window.__ipgsLatestGuideTrainingPatchLoaded)return;
  window.__ipgsLatestGuideTrainingPatchLoaded=true;

  const VERSION='2026-10-02';
  const LABEL='LATEST ARRANGEMENT · 2 OCT 2026';

  function addStyles(){
    if(document.getElementById('ipgsLatestGuideTrainingStyles'))return;
    const style=document.createElement('style');
    style.id='ipgsLatestGuideTrainingStyles';
    style.textContent=`
      .guide-latest-arrangement{border:1px solid #d8cdfd;background:linear-gradient(135deg,#f8f5ff,#f5faff);border-radius:16px;padding:16px 18px;margin:0 0 18px;box-shadow:0 8px 24px rgba(58,34,120,.06)}
      .guide-latest-arrangement .latest-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
      .guide-latest-arrangement .latest-head small{display:block;font-size:10px;font-weight:900;letter-spacing:.09em;color:#6c4ccf;margin-bottom:4px}
      .guide-latest-arrangement .latest-head h3{margin:0;font-size:17px;color:#20283b}
      .guide-latest-arrangement .latest-head p{margin:5px 0 0;font-size:12px;line-height:1.55;color:#6f7685;max-width:780px}
      .guide-latest-arrangement .latest-badge{display:inline-flex;align-items:center;border-radius:999px;padding:7px 10px;background:#ece6ff;color:#5b3bbb;font-size:10px;font-weight:900;letter-spacing:.04em;white-space:nowrap}
      .guide-latest-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .guide-latest-item{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid #e7e8ef;border-radius:12px;padding:11px 12px}
      .guide-latest-item em{font-style:normal;display:flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:8px;background:#f0ecff;color:#5b3bbb;font-size:10px;font-weight:900;flex:none}
      .guide-latest-item b{display:block;font-size:12px;color:#242a3a;margin-bottom:3px}
      .guide-latest-item span{display:block;font-size:11px;line-height:1.5;color:#6f7685}
      .guide-latest-note{border:1px solid #d8cdfd;background:#faf8ff;border-radius:12px;padding:10px 12px;margin:12px 0;font-size:11px;line-height:1.55;color:#4b4268}
      .guide-latest-note b{color:#4d32a8}
      .guide-latest-slide-note{border:1px solid #d8cdfd;background:#faf8ff;border-radius:10px;padding:9px 10px;margin-top:10px;font-size:11px;line-height:1.45;color:#4b4268}
      .guide-latest-slide-note b{color:#4d32a8}
      @media(max-width:800px){.guide-latest-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function latestPanelHtml(){
    return `<div id="guideLatestArrangement" class="guide-latest-arrangement" data-guide-version="${VERSION}">
      <div class="latest-head">
        <div><small>${LABEL}</small><h3>Current Admission V2 Arrangement</h3><p>This control note overrides older training wording wherever there is a conflict. It reflects the live arrangement after the latest Admission Form fixes.</p></div>
        <span class="latest-badge">CURRENT CONTROL</span>
      </div>
      <div class="guide-latest-grid">
        <div class="guide-latest-item"><em>01</em><div><b>Submission = COL + Admission Form PDF</b><span>A valid submission automatically creates the application record, Reference No, student folder and Admission Form PDF, then sends the student the approved corporate welcome email with the Conditional Offer Letter (COL) and Admission Form PDF.</span></div></div>
        <div class="guide-latest-item"><em>02</em><div><b>Admission Team Notification</b><span>The new application must also generate the internal New Application notification for the Admission team. Consultant / Marketing notification applies where the referral / Prospect workflow is relevant.</span></div></div>
        <div class="guide-latest-item"><em>03</em><div><b>Four Core Initial Documents</b><span>Initial admission processing uses IC / Passport, Academic Transcript, Academic Certificate and CV / Resume. Programme- or applicant-specific items are follow-up controls and must not silently create a new initial gate.</span></div></div>
        <div class="guide-latest-item"><em>04</em><div><b>Missing / Imperfect Documents Are Follow-up, Not a Dead End</b><span>Document quality or missing-item issues may be resolved through Manual Document Review / authorised human progression. Record the exception and continue to Screening when permitted; outstanding items stay on follow-up.</span></div></div>
        <div class="guide-latest-item"><em>05</em><div><b>Official AI Screening Report</b><span>AI reviews the academic certificate, transcript and CV / resume, supplies the screening inputs and generates the official Screening Report PDF. SAC remains the authorised decision-maker.</span></div></div>
        <div class="guide-latest-item"><em>06</em><div><b>SAC Pack Order</b><span>Generate available documents in this order: Admission Form → PG-ADM-01 → Certificate → Transcript → Resume / CV → Final AI Screening Report. Missing student-uploaded documents do not block the whole pack.</span></div></div>
        <div class="guide-latest-item"><em>07</em><div><b>SAC Route</b><span>SAC records Direct Entry, Internal Assessment, or Rejected / Not Qualified. PREREQ is not selected directly at SAC; it follows IA only when the authorised IA outcome requires it.</span></div></div>
        <div class="guide-latest-item"><em>08</em><div><b>IA / PREREQ Uses Email — No Second COL</b><span>IA and prerequisite communication uses the relevant email and attachments only. After the approved route is completed, proceed to the Official Offer Letter / LOA without issuing another COL and without routine re-SAC.</span></div></div>
      </div>
    </div>`;
  }

  function ensureLatestPanel(){
    const sop=document.getElementById('guideSopView');
    if(!sop)return;
    const existing=document.getElementById('guideLatestArrangement');
    if(existing && existing.dataset.guideVersion===VERSION)return;
    if(existing)existing.remove();
    sop.insertAdjacentHTML('afterbegin',latestPanelHtml());
  }

  function setFlowAction(stageTitle,html){
    const rows=[...document.querySelectorAll('#guideSopView .guide-flow-row')];
    const row=rows.find(r=>r.querySelector('.guide-flow-stage')?.textContent.trim()===stageTitle);
    const action=row?.querySelector('.guide-flow-action');
    if(action)action.innerHTML=html;
  }

  function patchSopFlow(){
    setFlowAction('Application Submitted','<span class="guide-role">Student / System</span> Student completes the Admission Form and provides the four core initial documents: <b>IC / Passport, Academic Transcript, Academic Certificate and CV / Resume</b>. <b>System:</b> creates the application record, Reference No, student folder, Admission Form PDF and workflow record. Programme- or applicant-specific items remain controlled follow-up items unless an explicit policy gate applies.');
    setFlowAction('COL + Welcome Email','<span class="guide-role">System / IPGS Admission</span> Automatically generates <b>one Conditional Offer Letter (COL)</b>, saves it in the student folder and sends the approved corporate welcome email with the <b>COL + Admission Form PDF</b>. At the same submission event, the system must also send the internal <b>New Application</b> notification to the Admission team. The COL is conditional and is <b>not</b> the final Official Offer Letter / LOA.');
    setFlowAction('Document Review','<span class="guide-role">Registry</span> Open <b>Applications → Open → Documents</b>. Review existence, readability, completeness, orientation/cropping and document-type match. Missing or imperfect items are recorded for follow-up and must not automatically trap the student at Document Review. Use <b>Manual Document Review / authorised human progression</b> for legitimate exception cases, with remarks and audit trail preserved.');
    setFlowAction('Qualification Screening','<span class="guide-role">Registry + AI Admission Intelligence</span> AI reviews the <b>certificate, transcript and CV / resume</b>, supplies field-relationship and relevant-experience inputs, and generates the <b>Official AI Screening Report PDF</b> in the student folder. Registry may resolve exceptions with authorised human input. AI assists the evaluation; <b>SAC remains the authorised admission decision</b>.');
    setFlowAction('SAC Review','<span class="guide-role">Registry / SAC</span> Create/select the SAC session and assign eligible candidates. The SAC pack should collect available documents in this order: <b>Admission Form → PG-ADM-01 → Certificate → Transcript → Resume / CV → Final AI Screening Report</b>. Missing student-uploaded items do not block generation of the whole pack. Record the authorised SAC outcome: <b>Direct Entry</b>, <b>Internal Assessment</b>, or <b>Rejected / Not Qualified</b>. PREREQ is not selected directly at SAC.');
    setFlowAction('IA / PREREQ (if required)','<span class="guide-role">Registry / Academic</span> Candidates routed to IA receive the <b>IA email and relevant attachments</b> and complete Internal Assessment. If the authorised IA outcome requires prerequisite study, send the <b>prerequisite email and relevant attachments</b> and complete PREREQ after IA. <b>No second COL is issued.</b> Once the approved IA / PREREQ route is completed, proceed to Official Offer / LOA readiness <b>without routine re-SAC</b>.');
    setFlowAction('Offer','<span class="guide-role">Registry</span> Once the authorised admission route is complete, generate and send the <b>Official Offer Letter / LOA</b>. This is the formal post-decision offer and is separate from the submission COL. The system records issue status, PDF and timestamp.');
  }

  function patchGuideHeader(){
    const guide=document.getElementById('guide');if(!guide)return;
    const badge=[...guide.querySelectorAll('.badge')].find(x=>/CURRENT OPERATING GUIDE/i.test(x.textContent||''));
    if(badge)badge.textContent='CURRENT OPERATING GUIDE · OCT 2026';
    const heroP=guide.querySelector('.hero p');
    if(heroP)heroP.textContent='Current operating guide for the IPGS Admission Command Center — aligned to the latest Admission V2 submission, document, screening, SAC, IA / prerequisite, SKY, Orientation and Academic Handover controls.';
  }

  function ensureFlowLatestNote(){
    const flow=document.getElementById('guideFlowView');if(!flow||flow.style.display==='none')return;
    if(flow.querySelector('.guide-latest-flow-note'))return;
    const intro=flow.querySelector('.guide-training-intro');
    const note=document.createElement('div');
    note.className='guide-latest-note guide-latest-flow-note';
    note.innerHTML='<b>Latest admission controls:</b> Submission sends COL + Admission Form PDF and internal New Application notification; four core initial documents are IC / Passport, Transcript, Certificate and CV / Resume; document exceptions are non-blocking when authorised; SAC pack order is Admission Form → PG-ADM-01 → Certificate → Transcript → Resume / CV → Final AI Screening Report; IA / prerequisite does not trigger a second COL.';
    (intro||flow).insertAdjacentElement(intro?'afterend':'afterbegin',note);
  }

  function currentSlideTitle(){
    return document.querySelector('#guideSlideStage .guide-slide-heading h2')?.textContent.trim()||'';
  }

  function slideLatestText(title){
    if(/From Application to Active Student/i.test(title))return '<b>Latest:</b> the journey begins with the submission COL + Admission Form PDF and internal team notification. The COL is conditional; formal admission still continues through Document Review → Screening → SAC → IA / PREREQ where required → Official Offer / LOA → Acceptance.';
    if(/Monitor New Applications/i.test(title))return '<b>Latest:</b> every valid submission should show evidence of both outward communication (COL + Admission Form PDF to student) and inward communication (New Application notification to Admission team).';
    if(/Process the Applicant/i.test(title))return '<b>Latest:</b> document issues are follow-up controls, not an automatic dead end. Use Manual Document Review / authorised human progression for legitimate exception cases and preserve the audit trail.';
    if(/^SAC$/i.test(title))return '<b>Latest SAC pack:</b> Admission Form → PG-ADM-01 → Certificate → Transcript → Resume / CV → Final AI Screening Report. Missing student-uploaded items do not block the entire pack.';
    if(/IA \/ PREREQ/i.test(title))return '<b>Latest:</b> IA first; PREREQ only if IA requires it. Send the relevant email/attachments only, issue no second COL, and move to Official Offer / LOA readiness after completion without routine re-SAC.';
    if(/Rules Staff Must Remember|Operating Controls/i.test(title))return '<b>Current controls:</b> COL on submission; Admission team notification; four core initial documents; non-blocking document exceptions when authorised; SAC pack completeness; no second COL for IA / PREREQ.';
    return '';
  }

  function patchSlides(){
    const slides=document.getElementById('guideSlidesView');if(!slides||slides.style.display==='none')return;
    if(!slides.querySelector('.guide-latest-slides-note')){
      const toolbar=slides.querySelector('.guide-slide-toolbar');
      const note=document.createElement('div');
      note.className='guide-latest-note guide-latest-slides-note';
      note.innerHTML='<b>Training baseline · 2 Oct 2026:</b> use the latest Admission V2 controls in this deck. Where an older screenshot or wording differs, the live module and the Current Admission V2 Arrangement in SOP Guide take precedence.';
      (toolbar||slides).insertAdjacentElement(toolbar?'afterend':'afterbegin',note);
    }
    const stage=document.getElementById('guideSlideStage');
    if(!stage)return;
    const slide=stage.querySelector('.guide-slide');if(!slide)return;
    slide.querySelectorAll('footer span').forEach(x=>{if(/System Training Guide/i.test(x.textContent||''))x.textContent='System Training Guide · October 2026'});
    const aside=slide.querySelector('.g2-layout aside');
    const msg=slideLatestText(currentSlideTitle());
    const old=slide.querySelector('.guide-latest-slide-note');
    if(!msg){if(old)old.remove();return;}
    if(old){old.innerHTML=msg;return;}
    if(aside){const note=document.createElement('div');note.className='guide-latest-slide-note';note.innerHTML=msg;aside.appendChild(note)}
  }

  function patchStaticDates(){
    document.querySelectorAll('#guide footer span').forEach(x=>{
      if(/System Training Guide · September 2026/i.test(x.textContent||''))x.textContent='System Training Guide · October 2026';
    });
  }

  let scheduled=false;
  function applyAll(){
    scheduled=false;
    addStyles();
    patchGuideHeader();
    ensureLatestPanel();
    patchSopFlow();
    ensureFlowLatestNote();
    patchSlides();
    patchStaticDates();
  }
  function scheduleApply(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(applyAll);
  }

  function init(){
    applyAll();
    const guide=document.getElementById('guide');
    if(guide){
      const observer=new MutationObserver(scheduleApply);
      observer.observe(guide,{subtree:true,childList:true,characterData:false});
    }
    ['setGuideMode','openGuideSlides','guideSlideMove','guideSlideJump'].forEach(name=>{
      const original=window[name];
      if(typeof original!=='function'||original.__latestWrapped)return;
      const wrapped=function(){const out=original.apply(this,arguments);scheduleApply();setTimeout(scheduleApply,0);return out};
      wrapped.__latestWrapped=true;
      window[name]=wrapped;
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
