(function systemGuideTraining(){
  const IUC_LOGO='https://lh3.googleusercontent.com/d/135uWJ59t0Gs5fey1Ef7548V-HBWsOiCk=s1000';
  const IPGS_LOGO='https://lh3.googleusercontent.com/d/1iKsYwAVivYw9uRl2kLzt0LcKK7CAJPvd=s1000';

  const slides=[
    {
      kicker:'SYSTEM OVERVIEW',
      title:'Admission Command Center',
      subtitle:'One operational workspace for the postgraduate admission journey',
      type:'cover',
      points:[
        'Centralises admission processing, SKY operations, Orientation, Academic Handover and master data.',
        'Designed for monitoring on the main page and processing inside controlled operational views.',
        'Keeps module ownership clear while maintaining one auditable operating environment.'
      ]
    },
    {
      kicker:'HOW ACC IS ORGANISED',
      title:'The ACC Operating Model',
      subtitle:'Master Data · Admission Workflow · Standalone Operations · Final Access',
      type:'modules',
      modules:[
        ['Master Data','Academic Consultants','Fee Structure'],
        ['Admission','Applications','SAC','IA / PREREQ'],
        ['Operations','Prospect / Activation','Orientation','Academic Handover'],
        ['Control','Reports','System Guide','AI Operations Center']
      ],
      note:'Not every module is a hard gate for another. Use the control rules inside the module being processed.'
    },
    {
      kicker:'END-TO-END JOURNEY',
      title:'From Application to Active Student',
      subtitle:'15 operating stages across the ACC',
      type:'timeline',
      stages:[
        'Application','Consultant / SKY Prospect','Document Review','Screening','SAC',
        'IA / PREREQ','Offer','Acceptance','SKY Activation','Orientation Setup',
        'Attendance & Feedback','Recording & Completion','Academic Handover','Provisioning','Student Access'
      ],
      note:'The preferred journey is shown here. Standalone operational modules retain their own controls.'
    },
    {
      kicker:'ADMISSION WORKFLOW',
      title:'Application → Documents → Screening',
      subtitle:'Registry controls the admission record; Marketing does not process admission',
      type:'process',
      process:[
        ['1','Student Applies','Admission Form + required uploads'],
        ['2','System Creates Record','Reference No · folder · PDF · workflow record'],
        ['3','Registry Reviews Documents','Verify completeness and controlled documents'],
        ['4','Registry Screens Qualification','Field relationship + relevant experience where applicable']
      ],
      callout:'AI/document screening may assist review, but it does not replace the authorised SAC decision.'
    },
    {
      kicker:'DECISION WORKFLOW',
      title:'SAC → IA / PREREQ → Offer',
      subtitle:'The formal academic admission decision path',
      type:'decision',
      branches:[
        ['Direct Entry','Proceed to Offer readiness'],
        ['Internal Assessment','Complete IA → PREREQ only if the authorised IA outcome requires it'],
        ['Rejected / Not Qualified','Close the admission route']
      ],
      points:[
        'PREREQ is not selected directly as a SAC outcome.',
        'Offer is issued only after the approved admission route is complete.',
        'Student signs the Acceptance electronically; the system stores the signed record and timestamp.'
      ]
    },
    {
      kicker:'ACADEMIC CONSULTANT / MARKETING',
      title:'SKY Prospect & Fee Group',
      subtitle:'Consultant owns Prospect creation — Registry owns admission processing',
      type:'process',
      process:[
        ['1','Consultant Receives Application Notification','Applicant information is provided in the email/action page'],
        ['2','Create Prospect in SKY','Consultant enters applicant into SKY Prospect'],
        ['3','Return to ACC Action','Enter SKY Prospect ID'],
        ['4','Select Fee Group','Choose only from ACTIVE Fee Structure Master'],
        ['5','Prospect Done','ACC updates the operational record']
      ],
      callout:'Fee Group is selected from the master; do not invent a substitute code manually.'
    },
    {
      kicker:'PROSPECT / ACTIVATION',
      title:'Registry SKY Activation',
      subtitle:'Standalone operational tracking',
      type:'process',
      process:[
        ['1','Prospect Done','Consultant task completed'],
        ['2','Registry Activates / Registers','Process the student in SKY'],
        ['3','Record SKY ID','Store Student ID / Registration No. when available'],
        ['4','Active in SKY Done','Operational activation record completed']
      ],
      callout:'Do not create artificial cross-module gates that the Prospect / Activation module itself does not require.'
    },
    {
      kicker:'ORIENTATION',
      title:'Orientation Session Lifecycle',
      subtitle:'Main page = monitoring · View Session = processing',
      type:'journey',
      journey:['Create Session','Add Students','Send Invitation','Reminder','Open Attendance','Attendance + Feedback','End Session','Add / Send Recording','Complete Orientation','Official Report'],
      points:[
        'Adding students does not send invitation automatically.',
        'Attendance stays open until Registry closes it manually.',
        'Completion locks the official record and generates the Orientation PDF report.',
        'Completed sessions provide View Report, Download PDF and report revision controls.'
      ]
    },
    {
      kicker:'ACADEMIC HANDOVER',
      title:'Handover → Provisioning → Student Access',
      subtitle:'A separate module from Orientation',
      type:'journey',
      journey:['Create Handover','Add Students','Handover Now','Academic / PIC Communication','IT Email','Moodle','e-Library','Student Access','Complete'],
      points:[
        'Academic Handover is not embedded inside Orientation.',
        'Registry monitors IT, Moodle and e-Library provisioning from View Handover.',
        'Student Access is sent only after required provisioning is complete.',
        'Provisioning alone is not the final communication step.'
      ]
    },
    {
      kicker:'MASTER DATA',
      title:'Fee Structure Master',
      subtitle:'Single source for the Fee Group list used by consultants',
      type:'master',
      items:[
        ['Scope','Programme · Level · Study Mode · Intake'],
        ['Fee Components','Coursework · Research · Mixed-Mode · Registration · approved non-academic charges'],
        ['Payment Schedule','Approved payment sequence; not an invoice or payment collection'],
        ['Approved PDF','Drive reference mapped to the Fee Group'],
        ['Availability','ACTIVE = selectable by agent · INACTIVE = hidden from new selections']
      ],
      callout:'A Fee Structure cannot be activated without an accessible approved PDF.'
    },
    {
      kicker:'CONTROL & AUTOMATION',
      title:'AI Operations Center',
      subtitle:'The control room for the planned agentic Registrar Office',
      type:'agents',
      agents:[
        ['Registrar Office Agent','Supervisory layer'],
        ['Admission Intake Agent','New application intake'],
        ['Admission Evaluation Agent','Admission screening / evaluation'],
        ['IA Agent','Internal Assessment operations'],
        ['Prerequisite Agent','Prerequisite operations'],
        ['Orientation Agent','Orientation operations']
      ],
      callout:'NOT ACTIVATED means the agent is not yet authorised to execute operational actions autonomously.'
    },
    {
      kicker:'OPERATING CONTROLS',
      title:'Rules Staff Must Remember',
      subtitle:'The controls that protect consistency and auditability',
      type:'rules',
      rules:[
        ['SAC','Screening assists SAC; it does not replace the authorised decision.'],
        ['IA / PREREQ','PREREQ follows IA where required.'],
        ['Fee Structure','Only ACTIVE, valid master records are selectable by agents.'],
        ['Orientation','Add Students does not send invitation automatically.'],
        ['Academic Handover','Keep provisioning and Student Access inside the Handover module.'],
        ['Completion','Use revisions / audit controls instead of silent changes to completed records.']
      ]
    },
    {
      kicker:'TRAINING SUMMARY',
      title:'How Staff Should Use ACC',
      subtitle:'Monitor → Open the operational view → Complete the controlled next action',
      type:'summary',
      points:[
        'Use the main module page to understand workload, stage and status.',
        'Open the applicant/session/handover detail view to process actions.',
        'Follow the Operational Action Center and module-specific controls.',
        'Use master data instead of free-text substitutes.',
        'Refresh after actions when data has not yet reflected.',
        'Use the Activity / audit trail when reconstructing what happened.',
        'Run controlled UAT after material system changes.'
      ],
      closing:'ACC should reduce person-dependency: a trained staff member should be able to understand the next action from the system itself.'
    }
  ];

  const flowPhases=[
    {
      title:'A. Master Data & Application Intake',
      tone:'purple',
      nodes:[
        ['Academic Consultants','Maintain consultant identity and referral attribution'],
        ['Fee Structure Master','Maintain ACTIVE fee groups, scope, payment schedule and approved PDF'],
        ['Application Submitted','Student submits admission form and required documents'],
        ['Consultant / SKY Prospect','Consultant creates SKY Prospect, records Prospect ID and Fee Group']
      ]
    },
    {
      title:'B. Admission Evaluation & Decision',
      tone:'blue',
      nodes:[
        ['Document Review','Registry verifies required admission documents'],
        ['Qualification Screening','Registry confirms field relationship / experience where applicable'],
        ['SAC Review','Direct Entry · IA · Rejected / Not Qualified'],
        ['IA / PREREQ','IA first; prerequisite only where authorised after IA'],
        ['Offer & Acceptance','Registry issues offer → student signs electronically']
      ]
    },
    {
      title:'C. Standalone Operational Modules',
      tone:'amber',
      nodes:[
        ['Registry SKY Activation','Activate / register student in SKY and record SKY IDs'],
        ['Orientation','Create session → invite → attendance & feedback → recording → complete → report'],
        ['Academic Handover','Create handover → send → provisioning → Student Access']
      ]
    },
    {
      title:'D. Provisioning & Active Student',
      tone:'green',
      nodes:[
        ['IT','Innovative email / account setup'],
        ['Moodle','LMS access'],
        ['e-Library','Library access'],
        ['Student Access','Registry sends final access communication'],
        ['ACTIVE STUDENT','Operational onboarding journey completed']
      ]
    }
  ];

  let slideIndex=0;
  let mode='sop';

  function esc(v=''){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function logosHtml(){
    return '<div class="guide-slide-logos">'+
      '<img src="'+IUC_LOGO+'" alt="Innovative University College">'+
      '<img src="'+IPGS_LOGO+'" alt="Institute of Postgraduate Studies">'+
    '</div>';
  }

  function renderFlowchart(){
    const root=document.getElementById('guideFlowView');
    if(!root)return;
    root.innerHTML=
      '<div class="guide-training-intro">'+
        '<div><div class="guide-training-kicker">DETAILED PROCESS MAP</div><h3>ACC End-to-End Operating Flow</h3><p>Use this view when explaining how ownership moves from application intake to final Student Access. Module boundaries are shown explicitly so staff do not create artificial dependencies.</p></div>'+
        '<div class="guide-training-actions"><button class="ghost" onclick="openGuideSlides(2)">Open as Slides</button></div>'+
      '</div>'+
      '<div class="guide-flow-legend">'+
        '<span class="guide-flow-chip purple">Master / Control</span>'+
        '<span class="guide-flow-chip blue">Admission Decision</span>'+
        '<span class="guide-flow-chip amber">Standalone Operations</span>'+
        '<span class="guide-flow-chip green">Provisioning / Completion</span>'+
      '</div>'+
      '<div class="guide-visual-flow">'+
        flowPhases.map((phase,pIndex)=>{
          return '<section class="guide-visual-phase '+phase.tone+'">'+
            '<div class="guide-visual-phase-head"><span>'+String.fromCharCode(65+pIndex)+'</span><div><b>'+esc(phase.title)+'</b><small>'+phase.nodes.length+' operational stage'+(phase.nodes.length===1?'':'s')+'</small></div></div>'+
            '<div class="guide-visual-nodes">'+
              phase.nodes.map((node,i)=>
                '<div class="guide-visual-node">'+
                  '<div class="guide-visual-node-no">'+(i+1)+'</div>'+
                  '<div><strong>'+esc(node[0])+'</strong><p>'+esc(node[1])+'</p></div>'+
                '</div>'+
                (i<phase.nodes.length-1?'<div class="guide-visual-arrow">↓</div>':'')
              ).join('')+
            '</div>'+
          '</section>';
        }).join('<div class="guide-phase-arrow">↓</div>')+
      '</div>'+
      '<div class="guide-flow-boundaries">'+
        '<div><b>Important boundary</b><span>Prospect / Activation is standalone operational tracking. Use its own controls.</span></div>'+
        '<div><b>Important boundary</b><span>Orientation completes its own attendance, feedback, recording and report. It does not perform Academic Handover.</span></div>'+
        '<div><b>Important boundary</b><span>Academic Handover owns provisioning and final Student Access.</span></div>'+
      '</div>';
  }

  function listHtml(items){
    return '<ul class="guide-slide-list">'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';
  }

  function renderSlideBody(slide){
    if(slide.type==='cover'){
      return '<div class="guide-slide-cover">'+
        '<div class="guide-slide-cover-mark">ACC</div>'+
        '<div>'+listHtml(slide.points)+'</div>'+
      '</div>';
    }
    if(slide.type==='modules'){
      return '<div class="guide-slide-module-grid">'+slide.modules.map(group=>
        '<div class="guide-slide-module"><b>'+esc(group[0])+'</b>'+group.slice(1).map(x=>'<span>'+esc(x)+'</span>').join('')+'</div>'
      ).join('')+'</div><div class="guide-slide-callout">'+esc(slide.note)+'</div>';
    }
    if(slide.type==='timeline'){
      return '<div class="guide-slide-timeline">'+slide.stages.map((s,i)=>
        '<div class="guide-slide-timeline-item"><em>'+String(i+1).padStart(2,'0')+'</em><span>'+esc(s)+'</span></div>'
      ).join('')+'</div><div class="guide-slide-callout">'+esc(slide.note)+'</div>';
    }
    if(slide.type==='process'){
      return '<div class="guide-slide-process">'+slide.process.map((x,i)=>
        '<div class="guide-slide-process-step"><div class="guide-slide-process-no">'+esc(x[0])+'</div><div><b>'+esc(x[1])+'</b><span>'+esc(x[2])+'</span></div></div>'+
        (i<slide.process.length-1?'<div class="guide-slide-process-arrow">→</div>':'')
      ).join('')+'</div>'+(slide.callout?'<div class="guide-slide-callout">'+esc(slide.callout)+'</div>':'');
    }
    if(slide.type==='decision'){
      return '<div class="guide-slide-decision">'+slide.branches.map((x,i)=>
        '<div class="guide-slide-decision-card d'+i+'"><b>'+esc(x[0])+'</b><span>'+esc(x[1])+'</span></div>'
      ).join('')+'</div>'+listHtml(slide.points);
    }
    if(slide.type==='journey'){
      return '<div class="guide-slide-journey">'+slide.journey.map((x,i)=>
        '<div class="guide-slide-journey-step"><em>'+(i+1)+'</em><b>'+esc(x)+'</b></div>'
      ).join('')+'</div>'+listHtml(slide.points);
    }
    if(slide.type==='master'){
      return '<div class="guide-slide-master">'+slide.items.map(x=>
        '<div><b>'+esc(x[0])+'</b><span>'+esc(x[1])+'</span></div>'
      ).join('')+'</div><div class="guide-slide-callout">'+esc(slide.callout)+'</div>';
    }
    if(slide.type==='agents'){
      return '<div class="guide-slide-agent-org">'+
        '<div class="guide-slide-agent boss"><b>'+esc(slide.agents[0][0])+'</b><span>'+esc(slide.agents[0][1])+'</span></div>'+
        '<div class="guide-slide-agent-line"></div>'+
        '<div class="guide-slide-agent-grid">'+slide.agents.slice(1).map(x=>
          '<div class="guide-slide-agent"><b>'+esc(x[0])+'</b><span>'+esc(x[1])+'</span></div>'
        ).join('')+'</div>'+
      '</div><div class="guide-slide-callout">'+esc(slide.callout)+'</div>';
    }
    if(slide.type==='rules'){
      return '<div class="guide-slide-rules">'+slide.rules.map((x,i)=>
        '<div><em>'+String(i+1).padStart(2,'0')+'</em><b>'+esc(x[0])+'</b><span>'+esc(x[1])+'</span></div>'
      ).join('')+'</div>';
    }
    if(slide.type==='summary'){
      return listHtml(slide.points)+'<div class="guide-slide-closing">'+esc(slide.closing)+'</div>';
    }
    return '';
  }

  function renderSlide(){
    const root=document.getElementById('guideSlideStage');
    if(!root)return;
    slideIndex=Math.max(0,Math.min(slides.length-1,slideIndex));
    const slide=slides[slideIndex];
    root.innerHTML=
      '<article class="guide-slide">'+
        '<header>'+logosHtml()+'<div class="guide-slide-count">'+(slideIndex+1)+' / '+slides.length+'</div></header>'+
        '<div class="guide-slide-heading"><div class="guide-slide-kicker">'+esc(slide.kicker)+'</div><h2>'+esc(slide.title)+'</h2><p>'+esc(slide.subtitle||'')+'</p></div>'+
        '<div class="guide-slide-body">'+renderSlideBody(slide)+'</div>'+
        '<footer><span>IUC · IPGS Admission Command Center</span><span>System Training Guide · September 2026</span></footer>'+
      '</article>';
    const select=document.getElementById('guideSlideSelect');
    if(select)select.value=String(slideIndex);
    const counter=document.getElementById('guideSlideCounter');
    if(counter)counter.textContent=(slideIndex+1)+' / '+slides.length;
    const bar=document.getElementById('guideSlideProgressBar');
    if(bar)bar.style.width=(((slideIndex+1)/slides.length)*100)+'%';
    const prev=document.getElementById('guideSlidePrev');
    const next=document.getElementById('guideSlideNext');
    if(prev)prev.disabled=slideIndex===0;
    if(next)next.disabled=slideIndex===slides.length-1;
  }

  function renderSlidesShell(){
    const root=document.getElementById('guideSlidesView');
    if(!root)return;
    root.innerHTML=
      '<div class="guide-slide-toolbar">'+
        '<div class="guide-slide-nav">'+
          '<button id="guideSlidePrev" class="ghost" type="button" onclick="guideSlideMove(-1)">← Previous</button>'+
          '<select id="guideSlideSelect" onchange="guideSlideJump(this.value)">'+
            slides.map((s,i)=>'<option value="'+i+'">'+String(i+1).padStart(2,'0')+' · '+esc(s.title)+'</option>').join('')+
          '</select>'+
          '<button id="guideSlideNext" class="primary" type="button" onclick="guideSlideMove(1)">Next →</button>'+
        '</div>'+
        '<div class="guide-slide-nav">'+
          '<span id="guideSlideCounter" class="badge purple">1 / '+slides.length+'</span>'+
          '<button class="ghost" type="button" onclick="toggleGuideFullscreen()">⛶ Fullscreen</button>'+
        '</div>'+
      '</div>'+
      '<div class="guide-slide-progress"><span id="guideSlideProgressBar"></span></div>'+
      '<div id="guideSlideStage" class="guide-slide-stage"></div>'+
      '<div class="guide-slide-help">Tip: use ← / → arrow keys during training. Fullscreen hides normal page distractions.</div>';
    renderSlide();
  }

  window.setGuideMode=function(nextMode){
    mode=['sop','flow','slides'].includes(nextMode)?nextMode:'sop';
    ['sop','flow','slides'].forEach(x=>{
      const el=document.getElementById('guide'+(x==='sop'?'Sop':x==='flow'?'Flow':'Slides')+'View');
      if(el)el.style.display=x===mode?'block':'none';
      const btn=document.querySelector('[data-guide-mode="'+x+'"]');
      if(btn){
        btn.classList.toggle('primary',x===mode);
        btn.classList.toggle('ghost',x!==mode);
      }
    });
    if(mode==='flow')renderFlowchart();
    if(mode==='slides'){
      renderSlidesShell();
      setTimeout(()=>document.getElementById('guideSlideStage')?.scrollIntoView({behavior:'smooth',block:'start'}),50);
    }
  };

  window.openGuideSlides=function(index){
    if(Number.isFinite(Number(index)))slideIndex=Math.max(0,Math.min(slides.length-1,Number(index)));
    setGuideMode('slides');
  };
  window.guideSlideMove=function(delta){slideIndex+=Number(delta||0);renderSlide();};
  window.guideSlideJump=function(index){slideIndex=Number(index||0);renderSlide();};
  window.toggleGuideFullscreen=async function(){
    const shell=document.getElementById('guideSlidesView');
    if(!shell)return;
    try{
      if(!document.fullscreenElement)await shell.requestFullscreen();
      else await document.exitFullscreen();
    }catch(_){}
  };

  document.addEventListener('keydown',e=>{
    if(mode!=='slides')return;
    const guide=document.getElementById('guide');
    if(!guide||!guide.classList.contains('active'))return;
    if(e.key==='ArrowRight'){e.preventDefault();guideSlideMove(1);}
    if(e.key==='ArrowLeft'){e.preventDefault();guideSlideMove(-1);}
  });

  window.initSystemGuideTraining=function(){
    if(document.getElementById('guideFlowView'))renderFlowchart();
    if(document.getElementById('guideSlidesView'))renderSlidesShell();
    setGuideMode('sop');
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initSystemGuideTraining);
  else initSystemGuideTraining();
})();