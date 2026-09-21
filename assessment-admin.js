/* IA / PREREQUISITE WORKSPACE V2
 * Front-end operational layer for Admission V2.
 * Rule: Prerequisite is never selected directly at SAC. It can only be assigned after IA.
 * Uses the existing safety-gated v2UpdateAssessment backend action.
 */
(function(){
  'use strict';

  const IA_TYPE='INTERNAL_ASSESSMENT';
  const PREREQ_TYPE='PREREQUISITE';

  function assessmentType(row){
    return String(row?.['Assessment Type']||row?.['Route']||row?.['Assessment Route']||'').toUpperCase().trim();
  }
  function assessmentResult(row){
    return String(row?.['Panel Result']||row?.['Result']||row?.['Final Result']||row?.['Assessment Result']||'').toUpperCase().trim();
  }
  function assessmentStatus(row){
    return String(row?.['Status']||row?.['Assessment Status']||'PENDING').toUpperCase().trim();
  }
  function assessmentComponent(row){
    return String(row?.['Component']||row?.['Current Step']||row?.['Assessment Component']||'OVERALL').toUpperCase().trim();
  }
  function updatedValue(row){
    return row?.['Last Updated']||row?.['Updated At']||row?.['Created At']||'';
  }
  function latestRouteRows(rows){
    const grouped=new Map();
    (rows||[]).forEach((row,index)=>{
      const ref=String(row?.['Reference No']||'').trim();
      const type=assessmentType(row)||'UNSPECIFIED';
      if(!ref)return;
      const key=ref+'::'+type;
      const ts=Date.parse(updatedValue(row)||'')||index;
      const prev=grouped.get(key);
      if(!prev||ts>=prev.ts)grouped.set(key,{row,ts});
    });
    return Array.from(grouped.values()).map(x=>x.row);
  }
  function isCompleted(row){
    const s=assessmentStatus(row),r=assessmentResult(row);
    return /COMPLETED|CLOSED|QUALIFIED|PASS|NOT_QUALIFIED|REJECT/.test(s+' '+r);
  }
  function routeLabel(type){
    if(type===IA_TYPE)return 'Internal Assessment';
    if(type===PREREQ_TYPE)return 'Prerequisite';
    return pretty(type||'Assessment');
  }
  function pageMsg(text,type='info'){
    const el=document.getElementById('assessmentPageMessage');
    if(!el)return;
    el.style.display='block';
    el.className='message '+(type==='error'?'error':'');
    el.style.background=type==='ok'?'var(--greenSoft)':type==='error'?'var(--redSoft)':'var(--blueSoft)';
    el.style.color=type==='ok'?'var(--green)':type==='error'?'var(--red)':'var(--blue)';
    el.textContent=text;
  }

  function enhancedRenderAssessment(){
    const raw=Array.isArray(db?.V2_ASSESSMENT_PROGRESS)?db.V2_ASSESSMENT_PROGRESS:[];
    const rows=latestRouteRows(raw);
    const ia=rows.filter(x=>assessmentType(x)===IA_TYPE);
    const prereq=rows.filter(x=>assessmentType(x)===PREREQ_TYPE);
    const iaPending=ia.filter(x=>!isCompleted(x)).length;
    const iaDone=ia.filter(isCompleted).length;
    const prereqPending=prereq.filter(x=>!isCompleted(x)).length;
    const complete=rows.filter(x=>/QUALIFIED|PASS/.test(assessmentResult(x))).length;

    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
    set('iaPendingKpi',iaPending);
    set('iaCompletedKpi',iaDone);
    set('prereqPendingKpi',prereqPending);
    set('assessmentClearedKpi',complete);

    const filter=String(document.getElementById('assessmentRouteFilter')?.value||'ALL').toUpperCase();
    const filtered=rows.filter(x=>filter==='ALL'||assessmentType(x)===filter);
    const body=document.getElementById('assessmentBody');
    if(!body)return;

    body.innerHTML=filtered.map(x=>{
      const ref=String(x['Reference No']||'').trim();
      const r=records.find(z=>z.ref===ref);
      const name=x['Student Name']||r?.app?.['Student Name']||'-';
      const programme=r?.app?.['Programme']||x['Programme']||'-';
      const type=assessmentType(x);
      const stat=assessmentStatus(x);
      const comp=assessmentComponent(x);
      const interview=[x['Interview Date'],x['Interview Time']].filter(Boolean).join(' · ');
      const delivery=[x['Course Title']||x['Assigned Course(s)'],x['Delivery Mode']].filter(Boolean).join(' · ');
      const result=assessmentResult(x)||'-';
      const score=x['Score']||x['Final Score']||x['Overall Score']||'';
      return '<tr>'+
        '<td><div class="student">'+esc(name)+'</div><div class="subline">'+esc(ref)+'</div></td>'+
        '<td><div>'+esc(programme)+'</div><div class="subline">'+esc(routeLabel(type))+'</div></td>'+
        '<td><span class="badge '+classifyBadge(stat)+'">'+esc(pretty(stat))+'</span><div class="subline">'+esc(pretty(comp))+'</div></td>'+
        '<td>'+esc(interview||delivery||'-')+'</td>'+
        '<td><span class="badge '+classifyBadge(result)+'">'+esc(pretty(result))+'</span>'+(score?'<div class="subline">Score: '+esc(score)+'</div>':'')+'</td>'+
        '<td>'+esc(formatDate(updatedValue(x)))+'</td>'+
        '<td><button class="ghost" type="button" onclick="openRecord(\''+esc(ref)+'\')">Open Applicant</button></td>'+
      '</tr>';
    }).join('')||'<tr><td colspan="7" class="empty">No IA / Prerequisite cases match this view.</td></tr>';
  }

  function assessmentCall(payload,confirmText){
    if(!selected||selected.source==='V1')return Promise.resolve(null);
    return runAdminAction('v2UpdateAssessment',{
      referenceNo:selected.ref,
      sequence:1,
      ...payload
    },confirmText);
  }

  function read(id){return document.getElementById(id)?.value?.trim()||''}

  window.iaMarkComponent=function(component,status){
    if(!selected)return;
    assessmentCall({
      assessmentType:IA_TYPE,
      component,
      status,
      remarks:read('iaWorkingRemarks')
    },'Save '+pretty(component)+' as '+pretty(status)+' for '+(selected.app['Student Name']||selected.ref)+'?');
  };

  window.iaScheduleInterview=function(){
    if(!selected)return;
    const interviewDate=read('iaInterviewDate'),interviewTime=read('iaInterviewTime');
    if(!interviewDate)return opsMsg('Select the IA interview date first.','error');
    assessmentCall({
      assessmentType:IA_TYPE,
      component:'STRUCTURED_INTERVIEW',
      status:'SCHEDULED',
      interviewDate,
      interviewTime,
      remarks:read('iaWorkingRemarks')
    },'Schedule the IA interview for '+(selected.app['Student Name']||selected.ref)+'?');
  };

  window.iaCompleteInterview=function(){
    if(!selected)return;
    assessmentCall({
      assessmentType:IA_TYPE,
      component:'STRUCTURED_INTERVIEW',
      status:'COMPLETED',
      interviewDate:read('iaInterviewDate'),
      interviewTime:read('iaInterviewTime'),
      remarks:read('iaWorkingRemarks')
    },'Mark the structured IA interview as completed?');
  };

  window.iaFinalDecision=function(panelResult){
    if(!selected)return;
    const score=read('iaFinalScore'),remarks=read('iaFinalRemarks');
    const label=pretty(panelResult);
    let warning='Confirm authorised IA panel result: '+label+'?';
    if(panelResult==='PREREQUISITE_REQUIRED')warning+=' This is the only route that may open the Prerequisite stage.';
    assessmentCall({
      assessmentType:IA_TYPE,
      component:'OVERALL',
      status:panelResult==='REASSESS_ONCE'?'REASSESSMENT_REQUIRED':'COMPLETED',
      panelResult,
      score,
      remarks
    },warning);
  };

  window.prereqSavePlan=function(){
    if(!selected)return;
    const courseTitle=read('prereqCourses');
    if(!courseTitle)return opsMsg('Enter the approved prerequisite course(s) first.','error');
    assessmentCall({
      assessmentType:PREREQ_TYPE,
      component:'COURSE_ASSIGNMENT',
      status:'ASSIGNED',
      courseTitle,
      deliveryMode:read('prereqDeliveryMode'),
      startDate:read('prereqStartDate'),
      endDate:read('prereqEndDate'),
      remarks:read('prereqRemarks')
    },'Save the approved prerequisite course plan?');
  };

  window.prereqUpdateStep=function(component,status){
    if(!selected)return;
    assessmentCall({
      assessmentType:PREREQ_TYPE,
      component,
      status,
      courseTitle:read('prereqCourses'),
      deliveryMode:read('prereqDeliveryMode'),
      remarks:read('prereqRemarks')
    },'Update prerequisite step to '+pretty(status)+'?');
  };

  window.prereqFinalDecision=function(panelResult){
    if(!selected)return;
    assessmentCall({
      assessmentType:PREREQ_TYPE,
      component:'OVERALL',
      status:panelResult==='REASSESS_ONCE'?'REASSESSMENT_REQUIRED':'COMPLETED',
      panelResult,
      score:read('prereqFinalScore'),
      courseTitle:read('prereqCourses'),
      remarks:read('prereqRemarks')
    },'Confirm the endorsed prerequisite result: '+pretty(panelResult)+'?');
  };

  function iaWorkspace(r){
    const a=r.assessment||{};
    return '<div class="assessment-workspace">'+
      '<div class="assessment-rule"><b>Controlled route:</b> IA is completed first. Prerequisite cannot be assigned directly by SAC; it becomes available only when the authorised IA result is <b>Prerequisite Required</b>.</div>'+
      '<div class="assessment-grid">'+
        '<section class="assessment-card"><h4>1 · Evidence & Portfolio</h4><p>Verify the required IA evidence for the programme. For PhD this may include research intent, academic/professional portfolio and diagnostic evidence.</p><div class="assessment-actions"><button class="ops-btn" onclick="iaMarkComponent(\'EVIDENCE_PORTFOLIO\',\'COMPLETED\')">Mark Evidence Complete</button><button class="ops-btn" onclick="iaMarkComponent(\'DIAGNOSTIC_ASSESSMENT\',\'COMPLETED\')">Mark Diagnostic Complete</button></div></section>'+
        '<section class="assessment-card"><h4>2 · Panel Interview</h4><p>Schedule and record the structured panel interview/presentation.</p><div class="assessment-fields"><input id="iaInterviewDate" class="ops-select" type="date"><input id="iaInterviewTime" class="ops-select" type="time"></div><div class="assessment-actions"><button class="ops-btn" onclick="iaScheduleInterview()">Save Interview</button><button class="ops-btn" onclick="iaCompleteInterview()">Mark Interview Complete</button></div></section>'+
        '<section class="assessment-card"><h4>3 · Working Remarks</h4><p>Internal notes stay with the assessment audit trail.</p><textarea id="iaWorkingRemarks" class="ops-select assessment-textarea" placeholder="Evidence checked, panel preparation, gaps or follow-up..."></textarea></section>'+
        '<section class="assessment-card assessment-final"><h4>4 · Authorised IA Result</h4><p>Record the final panel decision only after the required IA components have been assessed.</p><div class="assessment-fields"><input id="iaFinalScore" class="ops-select" inputmode="decimal" placeholder="Overall score (optional)"><input id="iaFinalRemarks" class="ops-select" placeholder="Panel rationale / conditions"></div><div class="assessment-actions"><button class="ops-btn success" onclick="iaFinalDecision(\'QUALIFIED\')">IA Qualified</button><button class="ops-btn" onclick="iaFinalDecision(\'PREREQUISITE_REQUIRED\')">Prerequisite Required</button><button class="ops-btn" onclick="iaFinalDecision(\'REASSESS_ONCE\')">Reassess Once</button><button class="ops-btn danger" onclick="iaFinalDecision(\'NOT_QUALIFIED\')">Not Qualified</button></div></section>'+
      '</div>'+
      '<div class="assessment-output-note"><b>Controlled outputs:</b> IA assessment record + panel recommendation/result. A successful IA continues to Offer eligibility; a Prerequisite Required decision opens the Prerequisite workspace.</div>'+
    '</div>';
  }

  function prereqWorkspace(r){
    return '<div class="assessment-workspace">'+
      '<div class="assessment-rule"><b>Prerequisite route:</b> this workspace is available only after IA has formally determined that prerequisite study is required.</div>'+
      '<div class="assessment-grid">'+
        '<section class="assessment-card assessment-final"><h4>1 · Approved Course Plan</h4><p>Record the course(s), delivery mode and completion window. The course must follow the approved curriculum, assessment and moderation controls.</p><textarea id="prereqCourses" class="ops-select assessment-textarea" placeholder="Approved prerequisite course(s)"></textarea><div class="assessment-fields"><select id="prereqDeliveryMode" class="ops-select"><option value="">Delivery mode</option><option value="ONLINE_GMEET_MOODLE">Online · Google Meet + Moodle</option><option value="BLENDED">Blended</option><option value="OTHER_APPROVED_MODE">Other approved mode</option></select><input id="prereqStartDate" class="ops-select" type="date"><input id="prereqEndDate" class="ops-select" type="date"></div><div class="assessment-actions"><button class="ops-btn primary" onclick="prereqSavePlan()">Save Course Plan</button></div></section>'+
        '<section class="assessment-card"><h4>2 · Delivery & Assessment</h4><p>Track enrolment, learning activities, assessment and moderation/result endorsement.</p><div class="assessment-actions"><button class="ops-btn" onclick="prereqUpdateStep(\'DELIVERY\',\'IN_PROGRESS\')">Start Delivery</button><button class="ops-btn" onclick="prereqUpdateStep(\'ASSESSMENT\',\'COMPLETED\')">Assessment Complete</button><button class="ops-btn" onclick="prereqUpdateStep(\'RESULT_ENDORSEMENT\',\'COMPLETED\')">Result Endorsed</button></div></section>'+
        '<section class="assessment-card"><h4>3 · Result & Remarks</h4><p>Keep the endorsed result and any reassessment/repeat instruction in the audit trail.</p><input id="prereqFinalScore" class="ops-select" inputmode="decimal" placeholder="Final mark / result (optional)"><textarea id="prereqRemarks" class="ops-select assessment-textarea" placeholder="Course, assessment, moderation, endorsement and remarks..."></textarea></section>'+
        '<section class="assessment-card assessment-final"><h4>4 · Final Prerequisite Outcome</h4><p>Only an endorsed successful result releases the admission progression gate.</p><div class="assessment-actions"><button class="ops-btn success" onclick="prereqFinalDecision(\'QUALIFIED\')">Prerequisite Qualified</button><button class="ops-btn" onclick="prereqFinalDecision(\'REASSESS_ONCE\')">Reassess / Repeat</button><button class="ops-btn danger" onclick="prereqFinalDecision(\'NOT_QUALIFIED\')">Not Qualified</button></div></section>'+
      '</div>'+
      '<div class="assessment-output-note"><b>Completion outputs:</b> endorsed prerequisite result, formal completion confirmation and academic record/transcript where applicable. Progression is released only after the prerequisite condition is fulfilled.</div>'+
    '</div>';
  }

  const originalOperational=window.renderOperationalActions;
  if(typeof originalOperational==='function'){
    window.renderOperationalActions=function(r){
      originalOperational(r);
      const s=stage(r);
      if(s!=='INTERNAL_ASSESSMENT'&&s!=='PREREQUISITE')return;
      const panel=document.getElementById('opsPanel');
      const actions=panel?.querySelector('.ops-actions');
      const copy=panel?.querySelector('.ops-copy');
      if(actions)actions.innerHTML=pgAdm01Control(r)+'<span class="badge purple">Use controlled workspace below</span>';
      if(copy)copy.textContent=s==='INTERNAL_ASSESSMENT'
        ?'Complete and document the IA evidence, diagnostic assessment and structured panel interview before recording the authorised outcome.'
        :'Complete the approved prerequisite course, assessment, moderation and result endorsement before releasing progression.';
      const msg=document.getElementById('opsMessage');
      if(!msg)return;
      msg.insertAdjacentHTML('beforebegin',s==='INTERNAL_ASSESSMENT'?iaWorkspace(r):prereqWorkspace(r));
    };
  }

  window.renderAssessment=enhancedRenderAssessment;

  const style=document.createElement('style');
  style.textContent='.assessment-workspace{width:100%;margin-top:14px;border-top:1px solid var(--line);padding-top:14px}.assessment-rule{border:1px solid #dfd7f5;background:#f8f5ff;color:#3a2d68;border-radius:12px;padding:11px 12px;font-size:11px;line-height:1.5;margin-bottom:12px}.assessment-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.assessment-card{border:1px solid var(--line);border-radius:13px;background:#fff;padding:12px}.assessment-card h4{margin:0 0 5px;font-size:12px;color:#282059}.assessment-card p{margin:0 0 10px;color:var(--muted);font-size:10px;line-height:1.45}.assessment-card.assessment-final{grid-column:1/-1}.assessment-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.assessment-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:9px}.assessment-textarea{width:100%;min-height:74px;resize:vertical}.assessment-output-note{margin-top:10px;border:1px solid #dce9df;background:#f5fbf7;border-radius:12px;padding:10px 12px;font-size:10px;line-height:1.5;color:#356348}@media(max-width:700px){.assessment-grid,.assessment-fields{grid-template-columns:1fr}.assessment-card.assessment-final{grid-column:auto}.assessment-actions .ops-btn{flex:1 1 100%}}';
  document.head.appendChild(style);

  document.addEventListener('change',function(e){
    if(e.target?.id==='assessmentRouteFilter')enhancedRenderAssessment();
  });

  try{enhancedRenderAssessment()}catch(_){}
})();