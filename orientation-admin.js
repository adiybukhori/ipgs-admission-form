(function orientationAdminFile(){
  const selectedRefs = new Set();

  function orientationEligibleRecord(r){
    if(!r || r.source==='V1') return false;
    const acceptance=String(r.workflow?.['Acceptance Status']||'').toUpperCase();
    const activation=String(r.workflow?.['SKY Activation Status']||'').toUpperCase();
    const st=String(r.workflow?.['Application Stage']||'').toUpperCase();
    return acceptance==='ACCEPTED' && activation==='ACTIVATED' && (st==='ACCEPTED' || st==='ORIENTATION');
  }

  function activeOrientationSessions(){
    return (db.V2_ORIENTATION_SESSIONS||[]).filter(s=>/SCHEDULED|OPEN|ACTIVE/i.test(String(s['Status']||'SCHEDULED')));
  }

  function ensureApplicationBulkBar(){
    const section=document.querySelector('#applications .panel-body');
    if(!section) return;
    let bar=document.getElementById('orientationBulkBar');
    if(!bar){
      bar=document.createElement('div');
      bar.id='orientationBulkBar';
      bar.style.cssText='margin-top:12px;padding-top:12px;border-top:1px solid var(--line);display:flex;gap:8px;align-items:center;flex-wrap:wrap';
      bar.innerHTML='<span class="badge purple">Orientation</span><span class="subline">Accepted + SKY Activated only</span><select id="orientationAssignSession" class="compact"><option value="">Select orientation session</option></select><button class="ghost" onclick="assignSelectedToOrientation()">Assign selected</button><span id="orientationSelectionCount" class="subline">0 selected</span><span id="orientationAssignMessage" class="subline"></span>';
      section.appendChild(bar);
    }
    const select=document.getElementById('orientationAssignSession');
    if(select){
      const current=select.value;
      const opts=activeOrientationSessions().map(s=>{
        const id=s['Orientation Session ID']||'';
        const name=s['Orientation Name']||id;
        const date=s['Session Date']||'';
        return '<option value="'+esc(id)+'">'+esc(name+(date?' · '+date:''))+'</option>';
      }).join('');
      select.innerHTML='<option value="">Select orientation session</option>'+opts;
      if([...select.options].some(o=>o.value===current)) select.value=current;
    }
    updateOrientationSelectionCount();
  }

  function enhanceApplicationsTable(){
    const head=document.querySelector('#applications table thead tr');
    const body=document.getElementById('applicationsBody');
    if(!head||!body) return;
    if(!head.querySelector('[data-orientation-select]')){
      const th=document.createElement('th');
      th.dataset.orientationSelect='1';
      th.textContent='Select';
      head.insertBefore(th,head.firstChild);
    }
    const list=filteredApplications();
    const rows=[...body.querySelectorAll('tr')];
    if(!list.length){
      const td=body.querySelector('td.empty');
      if(td) td.colSpan=9;
      ensureApplicationBulkBar();
      return;
    }
    rows.forEach((tr,i)=>{
      if(tr.querySelector('[data-orientation-cell]')) return;
      const r=list[i];
      const td=document.createElement('td');
      td.dataset.orientationCell='1';
      if(orientationEligibleRecord(r) && String(r.workflow?.['Application Stage']||'').toUpperCase()==='ACCEPTED'){
        const cb=document.createElement('input');
        cb.type='checkbox';
        cb.checked=selectedRefs.has(r.ref);
        cb.setAttribute('aria-label','Select '+(r.app['Student Name']||r.ref)+' for orientation');
        cb.onchange=()=>{
          if(cb.checked) selectedRefs.add(r.ref); else selectedRefs.delete(r.ref);
          updateOrientationSelectionCount();
        };
        td.appendChild(cb);
      }else{
        td.innerHTML='<span class="subline">—</span>';
      }
      tr.insertBefore(td,tr.firstChild);
    });
    ensureApplicationBulkBar();
  }

  function updateOrientationSelectionCount(){
    const el=document.getElementById('orientationSelectionCount');
    if(el) el.textContent=selectedRefs.size+' selected';
  }

  function orientationMessage(text,type='info'){
    const el=document.getElementById('orientationMessage');
    if(!el) return;
    el.style.display='block';
    el.className='message '+(type==='error'?'error':'');
    el.style.background=type==='ok'?'var(--greenSoft)':type==='error'?'var(--redSoft)':'var(--blueSoft)';
    el.style.color=type==='ok'?'var(--green)':type==='error'?'var(--red)':'var(--blue)';
    el.textContent=text;
  }

  async function orientationAction(action,data,confirmText){
    if(confirmText && !confirm(confirmText)) return null;
    orientationMessage('Processing…','info');
    try{
      const res=await fetch(ACTION_API,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({password,action,data,updatedBy:'Admin Portal V2'})
      });
      const out=await res.json().catch(()=>({ok:false,message:'Invalid response from action service.'}));
      if(!res.ok||!out.ok) throw new Error(out.message||'Unable to complete orientation action.');
      await loadData(true);
      return out.result||out;
    }catch(e){
      orientationMessage(e.message||'Unable to complete orientation action.','error');
      return null;
    }
  }

  window.createOrientationSession = async function(){
    const name=document.getElementById('oriName')?.value.trim()||'';
    const intakeId=document.getElementById('oriIntake')?.value||'';
    const sessionDate=document.getElementById('oriDate')?.value||'';
    const startTime=document.getElementById('oriStart')?.value||'08:30';
    const endTime=document.getElementById('oriEnd')?.value||'10:30';
    const mode=document.getElementById('oriMode')?.value||'ONLINE';
    const venue=document.getElementById('oriVenue')?.value.trim()||'';
    const meetingLink=document.getElementById('oriMeetingLink')?.value.trim()||'';
    const reminderDays=Number(document.getElementById('oriReminderDays')?.value||3);
    const programmeGroup=document.getElementById('oriProgrammeGroup')?.value.trim()||'ALL';
    if(!name||!intakeId||!sessionDate) return orientationMessage('Enter Orientation Name, Intake and Session Date first.','error');
    const result=await orientationAction('v2CreateOrientationSession',{
      name,intakeId,sessionDate,startTime,endTime,mode,venue,meetingLink,reminderDays,programmeGroup
    },`Create ${name} on ${sessionDate}?`);
    if(!result) return;
    const automation=result.reminderAutomation||{};
    orientationMessage(`Orientation session created. Reminder automation: ${pretty(automation.status||'configured')}.`,'ok');
    ['oriName','oriVenue','oriMeetingLink','oriProgrammeGroup'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  };

  window.assignSelectedToOrientation = async function(){
    const sessionId=document.getElementById('orientationAssignSession')?.value||'';
    const refs=[...selectedRefs];
    const msg=document.getElementById('orientationAssignMessage');
    if(!sessionId){if(msg)msg.textContent='Select an orientation session first.';return}
    if(!refs.length){if(msg)msg.textContent='Select at least one accepted and SKY-activated student.';return}
    if(!confirm(`Assign ${refs.length} selected student${refs.length===1?'':'s'} to this orientation session and send invitation email?`)) return;
    if(msg)msg.textContent='Assigning…';
    try{
      const res=await fetch(ACTION_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        password,action:'v2AssignOrientationBatch',data:{sessionId,referenceNos:refs},updatedBy:'Admin Portal V2'
      })});
      const out=await res.json().catch(()=>({ok:false,message:'Invalid response from action service.'}));
      if(!res.ok||!out.ok) throw new Error(out.message||'Unable to assign orientation.');
      const result=out.result||{};
      selectedRefs.clear();
      if(msg)msg.textContent=`Assigned ${result.assignedCount||0}. Invitation sent: ${result.invitationSentCount||0}${result.failed?.length?` · Failed: ${result.failed.length}`:''}.`;
      await loadData(true);
    }catch(e){if(msg)msg.textContent=e.message||'Unable to assign orientation.'}
  };

  window.sendOrientationReminderNow = async function(sessionId){
    const result=await orientationAction('v2SendOrientationReminderNow',{sessionId},'Send orientation reminder now to assigned students?');
    if(result) orientationMessage(`Reminder sent: ${result.sentCount||0}. Skipped: ${result.skippedCount||0}. Failed: ${result.failedCount||0}.`,'ok');
  };

  window.markOrientationAttendance = async function(sessionId,referenceNo,status){
    const result=await orientationAction('v2UpdateOrientationAttendance',{sessionId,referenceNo,attendanceStatus:status},`Mark this student as ${pretty(status)}?`);
    if(result) orientationMessage(`Attendance updated to ${pretty(status)}.`,'ok');
  };

  function populateOrientationIntakes(){
    const el=document.getElementById('oriIntake');
    if(!el) return;
    const current=el.value;
    const ids=new Map();
    (db.V2_INTAKE_MASTER||[]).forEach(x=>{
      const id=String(x['Intake ID']||'').trim();
      if(id) ids.set(id,String(x['Intake Name']||id));
    });
    (db.V2_APPLICATIONS||[]).forEach(x=>{
      const id=String(x['Intake ID']||'').trim();
      const name=String(x['Intake']||id);
      if(id&&!ids.has(id)) ids.set(id,name);
    });
    el.innerHTML='<option value="">Select intake</option>'+[...ids.entries()].map(([id,name])=>`<option value="${esc(id)}">${esc(name)} · ${esc(id)}</option>`).join('');
    if([...el.options].some(o=>o.value===current)) el.value=current;
  }

  window.renderOrientation = function(){
    const sessions=db.V2_ORIENTATION_SESSIONS||[];
    const tracking=db.V2_ORIENTATION_TRACKING||[];
    populateOrientationIntakes();

    const k1=document.getElementById('oriSessionsKpi'),k2=document.getElementById('oriAssignedKpi'),k3=document.getElementById('oriInvitedKpi'),k4=document.getElementById('oriAttendedKpi');
    if(k1)k1.textContent=sessions.length;
    if(k2)k2.textContent=tracking.length;
    if(k3)k3.textContent=tracking.filter(x=>String(x['Invitation Status']||'').toUpperCase()==='SENT').length;
    if(k4)k4.textContent=tracking.filter(x=>String(x['Attendance Status']||'').toUpperCase()==='ATTENDED').length;

    const body=document.getElementById('orientationSessionsBody');
    if(body){
      body.innerHTML=sessions.map(s=>{
        const id=s['Orientation Session ID']||'';
        const rows=tracking.filter(x=>String(x['Orientation Session ID']||'')===id);
        const invited=rows.filter(x=>String(x['Invitation Status']||'').toUpperCase()==='SENT').length;
        const reminded=rows.filter(x=>String(x['Reminder Status']||'').toUpperCase()==='SENT').length;
        const attended=rows.filter(x=>String(x['Attendance Status']||'').toUpperCase()==='ATTENDED').length;
        const name=s['Orientation Name']||id;
        const mode=s['Mode']||'ONLINE';
        const date=[s['Session Date'],[s['Start Time'],s['End Time']].filter(Boolean).join(' - ')].filter(Boolean).join(' · ');
        return `<tr>
          <td><div class="student">${esc(name)}</div><div class="subline">${esc(id)}</div></td>
          <td>${esc(s['Intake ID']||'-')}<div class="subline">${esc(s['Programme Group']||'ALL')}</div></td>
          <td>${esc(date||'-')}</td>
          <td><span class="badge blue">${esc(pretty(mode))}</span><div class="subline">${esc(s['Venue']||'')}</div></td>
          <td>${rows.length}<div class="subline">${invited} invited</div></td>
          <td>${reminded}<div class="subline">${esc(String(s['Reminder Days']||3))} day reminder</div></td>
          <td>${attended}<div class="subline">${rows.length-attended} not attended / pending</div></td>
          <td><button class="ghost" onclick="sendOrientationReminderNow('${esc(id)}')">Send Reminder Now</button></td>
        </tr>`;
      }).join('')||'<tr><td colspan="8" class="empty">No orientation session created yet.</td></tr>';
    }

    const trackBody=document.getElementById('orientationTrackingBody');
    if(trackBody){
      trackBody.innerHTML=tracking.map(x=>{
        const session=sessions.find(s=>String(s['Orientation Session ID']||'')===String(x['Orientation Session ID']||''));
        const attendance=String(x['Attendance Status']||'NOT_UPDATED').toUpperCase();
        return `<tr>
          <td><div class="student">${esc(x['Student Name']||'-')}</div><div class="subline">${esc(x['Reference No']||'')}</div></td>
          <td>${esc(x['Programme']||'-')}</td>
          <td>${esc(session?.['Orientation Name']||x['Orientation Session ID']||'-')}</td>
          <td><span class="badge ${classifyBadge(x['Invitation Status']||'PENDING')}">${esc(pretty(x['Invitation Status']||'PENDING'))}</span></td>
          <td><span class="badge ${classifyBadge(x['Reminder Status']||'NOT_SENT')}">${esc(pretty(x['Reminder Status']||'NOT_SENT'))}</span></td>
          <td><span class="badge ${classifyBadge(attendance)}">${esc(pretty(attendance))}</span></td>
          <td><div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="ghost" onclick="markOrientationAttendance('${esc(x['Orientation Session ID']||'')}','${esc(x['Reference No']||'')}','ATTENDED')">Attended</button>
            <button class="ghost" onclick="markOrientationAttendance('${esc(x['Orientation Session ID']||'')}','${esc(x['Reference No']||'')}','ABSENT')">Absent</button>
            <button class="ghost" onclick="markOrientationAttendance('${esc(x['Orientation Session ID']||'')}','${esc(x['Reference No']||'')}','EXCUSED')">Excused</button>
          </div></td>
        </tr>`;
      }).join('')||'<tr><td colspan="7" class="empty">No students assigned to orientation yet.</td></tr>';
    }
    ensureApplicationBulkBar();
  };

  window.goOrientation = function(btn){
    go('orientation',btn);
    const title=document.getElementById('topTitle');
    if(title) title.textContent='Orientation';
  };

  const baseRenderApplications=window.renderApplications;
  if(typeof baseRenderApplications==='function'){
    window.renderApplications=function(){
      baseRenderApplications();
      enhanceApplicationsTable();
    };
  }

  const baseRenderAll=window.renderAll;
  if(typeof baseRenderAll==='function'){
    window.renderAll=function(){
      baseRenderAll();
      renderOrientation();
      enhanceApplicationsTable();
    };
  }
})();