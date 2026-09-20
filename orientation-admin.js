(function orientationAdminFile(){
  const orientationSelected = new Set();

  function orientationMessage(text,type='info'){
    const el=document.getElementById('orientationMessage');
    if(!el)return;
    el.style.display='block';
    el.className='message '+(type==='error'?'error':'');
    el.style.background=type==='ok'?'var(--greenSoft)':type==='error'?'var(--redSoft)':'var(--blueSoft)';
    el.style.color=type==='ok'?'var(--green)':type==='error'?'var(--red)':'var(--blue)';
    el.textContent=text;
  }

  async function orientationAction(action,data,confirmText){
    if(confirmText&& !confirm(confirmText))return null;
    orientationMessage('Processing…','info');
    try{
      const res=await fetch(ACTION_API,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({password,action,data,updatedBy:'Admin Portal V2'})
      });
      const out=await res.json().catch(()=>({ok:false,message:'Invalid response from action service.'}));
      if(!res.ok||!out.ok)throw new Error(out.message||'Unable to complete Orientation action.');
      await loadData(true);
      return out.result||out;
    }catch(e){
      orientationMessage(e.message||'Unable to complete Orientation action.','error');
      return null;
    }
  }

  function applicationRecords(){
    return records.filter(r=>{
      if(!r||r.source==='V1')return false;
      const status=String(r.workflow?.['Application Status']||r.app?.['Application Status']||'').toUpperCase();
      return status!=='TEST';
    });
  }

  function orientationAssignmentActive(row){
    const status=String(row?.['Assignment Status']||'').trim().toUpperCase();
    return !status||status==='ACTIVE';
  }

  function assignedOrientationRefs(){
    const set=new Set();
    (db.V2_ORIENTATION_TRACKING||[]).forEach(x=>{
      if(!orientationAssignmentActive(x))return;
      const ref=String(x['Reference No']||'').trim();
      if(ref)set.add(ref);
    });
    return set;
  }

  function availableOrientationStudents(){
    const assigned=assignedOrientationRefs();
    return applicationRecords().filter(r=>!assigned.has(String(r.ref||'')));
  }

  function orientationSessionEndDate(session){
    let date=String(session?.['Session Date']||'').trim();
    if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(date)){
      const p=date.split('/');
      date=p[2]+'-'+String(p[1]).padStart(2,'0')+'-'+String(p[0]).padStart(2,'0');
    }
    const end=String(session?.['End Time']||session?.['Start Time']||'10:30').trim().slice(0,5);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^\d{2}:\d{2}$/.test(end))return null;
    const parsed=new Date(date+'T'+end+':00');
    return Number.isNaN(parsed.getTime())?null:parsed;
  }

  function orientationSessionEnded(session){
    const status=String(session?.['Status']||'').trim().toUpperCase();
    if(['ENDED','CANCELLED','CLOSED','COMPLETED'].includes(status))return true;
    const end=orientationSessionEndDate(session);
    return !!(end&&end.getTime()<=Date.now());
  }

  function orientationDateInputValue(value){
    const raw=String(value||'').trim();
    if(/^\d{4}-\d{2}-\d{2}/.test(raw))return raw.slice(0,10);
    if(/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)){
      const p=raw.split('/');
      return p[2]+'-'+String(p[1]).padStart(2,'0')+'-'+String(p[0]).padStart(2,'0');
    }
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return'';
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }

  function orientationIntakeOptions(current){
    const ids=new Map();
    (db.V2_INTAKE_MASTER||[]).forEach(x=>{
      const id=String(x['Intake ID']||'').trim();
      if(id)ids.set(id,String(x['Intake Name']||id));
    });
    applicationRecords().forEach(r=>{
      const id=String(r.app?.['Intake ID']||'').trim();
      const name=String(r.app?.['Intake']||id).trim();
      if(id&&!ids.has(id))ids.set(id,name);
    });
    if(current&&!ids.has(current))ids.set(current,current);
    return [...ids.entries()].map(([id,name])=>`<option value="${esc(id)}" ${id===current?'selected':''}>${esc(name)} · ${esc(id)}</option>`).join('');
  }

  function closeOrientationEditModal(){
    document.getElementById('orientationEditModal')?.remove();
  }

  window.openOrientationEdit=function(sessionId){
    const session=(db.V2_ORIENTATION_SESSIONS||[]).find(s=>String(s['Orientation Session ID']||'')===String(sessionId));
    if(!session)return orientationMessage('Orientation session not found.','error');
    closeOrientationEditModal();

    const overlay=document.createElement('div');
    overlay.id='orientationEditModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
    overlay.innerHTML=`
      <div style="width:min(760px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(0,0,0,.25);padding:22px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px">
          <div>
            <h3 style="margin:0 0 4px">Edit Orientation Session</h3>
            <div class="subline">${esc(session['Orientation Name']||sessionId)} · ${esc(sessionId)}</div>
          </div>
          <button class="ghost" type="button" id="orientationEditCloseBtn">Close</button>
        </div>
        <div class="message" style="display:block;background:var(--blueSoft);color:var(--blue);margin-bottom:16px">
          Session ID will remain unchanged. If an ended session has its date/time corrected to a future schedule, it will reopen automatically.
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
          <div class="field" style="grid-column:1/-1"><label>Orientation Name</label><input id="oriEditName" /></div>
          <div class="field"><label>Intake</label><select id="oriEditIntake">${orientationIntakeOptions(String(session['Intake ID']||''))}</select></div>
          <div class="field"><label>Programme Group</label><input id="oriEditProgrammeGroup" /></div>
          <div class="field"><label>Session Date</label><input id="oriEditDate" type="date" /></div>
          <div class="field"><label>Mode</label><select id="oriEditMode"><option value="ONLINE">Online</option><option value="PHYSICAL">Physical</option><option value="HYBRID">Hybrid</option></select></div>
          <div class="field"><label>Start Time</label><input id="oriEditStart" type="time" /></div>
          <div class="field"><label>End Time</label><input id="oriEditEnd" type="time" /></div>
          <div class="field" style="grid-column:1/-1"><label>Venue</label><input id="oriEditVenue" /></div>
          <div class="field" style="grid-column:1/-1"><label>Google Meet / Meeting Link</label><input id="oriEditMeetingLink" /></div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">
          <button class="ghost" type="button" id="orientationEditCancelBtn">Cancel</button>
          <button class="primary" type="button" id="orientationEditSaveBtn">Save Changes</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('oriEditName').value=String(session['Orientation Name']||'');
    document.getElementById('oriEditProgrammeGroup').value=String(session['Programme Group']||'ALL');
    document.getElementById('oriEditDate').value=orientationDateInputValue(session['Session Date']);
    document.getElementById('oriEditStart').value=String(session['Start Time']||'08:30').slice(0,5);
    document.getElementById('oriEditEnd').value=String(session['End Time']||'10:30').slice(0,5);
    document.getElementById('oriEditMode').value=String(session['Mode']||'ONLINE').toUpperCase();
    document.getElementById('oriEditVenue').value=String(session['Venue']||'');
    document.getElementById('oriEditMeetingLink').value=String(session['Meeting Link']||'');

    document.getElementById('orientationEditCloseBtn').onclick=closeOrientationEditModal;
    document.getElementById('orientationEditCancelBtn').onclick=closeOrientationEditModal;
    document.getElementById('orientationEditSaveBtn').onclick=async function(){
      const data={
        sessionId,
        name:document.getElementById('oriEditName')?.value.trim()||'',
        intakeId:document.getElementById('oriEditIntake')?.value||'',
        programmeGroup:document.getElementById('oriEditProgrammeGroup')?.value.trim()||'ALL',
        sessionDate:document.getElementById('oriEditDate')?.value||'',
        startTime:document.getElementById('oriEditStart')?.value||'08:30',
        endTime:document.getElementById('oriEditEnd')?.value||'10:30',
        mode:document.getElementById('oriEditMode')?.value||'ONLINE',
        venue:document.getElementById('oriEditVenue')?.value.trim()||'',
        meetingLink:document.getElementById('oriEditMeetingLink')?.value.trim()||''
      };
      if(!data.name||!data.intakeId||!data.sessionDate)return orientationMessage('Orientation Name, Intake and Session Date are required.','error');
      const result=await orientationAction(
        'v2EditOrientationSession',
        data,
        'Save these changes? The Orientation Session ID will remain unchanged.'
      );
      if(!result)return;
      closeOrientationEditModal();
      orientationMessage(
        result.reopened
          ? 'Orientation session updated and reopened because the corrected date/time is in the future.'
          : 'Orientation session updated successfully.',
        'ok'
      );
    };
  };

  function closeOrientationStudentModal(){
    document.getElementById('orientationStudentModal')?.remove();
    orientationSelected.clear();
  }

  window.openOrientationStudents=function(sessionId){
    const session=(db.V2_ORIENTATION_SESSIONS||[]).find(s=>String(s['Orientation Session ID']||'')===String(sessionId));
    if(!session)return orientationMessage('Orientation session not found.','error');
    const ended=orientationSessionEnded(session);
    orientationSelected.clear();
    const students=availableOrientationStudents();

    const overlay=document.createElement('div');
    overlay.id='orientationStudentModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
    overlay.innerHTML=`
      <div style="width:min(900px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(0,0,0,.25);padding:22px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px">
          <div>
            <h3 style="margin:0 0 4px">${ended?'Add Missed Student Record':'Add Students to Orientation'}</h3>
            <div class="subline">${esc(session['Orientation Name']||sessionId)} · ${esc(sessionId)}</div>
          </div>
          <button class="ghost" onclick="document.getElementById('orientationStudentModal')?.remove()">Close</button>
        </div>
        <div class="message" style="display:block;background:var(--blueSoft);color:var(--blue);margin-bottom:14px">
          ${ended
            ? 'This session has ended. Students added here are recorded for historical/attendance purposes only. No invitation or reminder email will be sent.'
            : 'This list comes from Applications only. Admission status, documents, SAC, Offer, Acceptance and SKY status do not block Orientation. Students already assigned to any Orientation Session are automatically excluded.'}
        </div>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap;position:sticky;top:0;z-index:5;background:#fff;padding:8px 0">
          <input id="orientationStudentSearch" placeholder="Search student / reference / programme" style="flex:1;min-width:260px" />
          <span class="badge purple" id="orientationModalCount">0 selected</span>
          <button class="primary" id="orientationAddStudentsTopBtn" type="button">${ended?'Add Student Record':'Add Selected Students'} (0)</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Select</th><th>Student</th><th>Programme</th><th>Intake</th><th>Application Ref</th></tr></thead>
            <tbody id="orientationStudentModalBody"></tbody>
          </table>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
          <button class="ghost" onclick="document.getElementById('orientationStudentModal')?.remove()">Cancel</button>
          <button class="primary" id="orientationAddStudentsBtn">${ended?'Add Student Record':'Add Selected Students'}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    function renderModalRows(){
      const q=String(document.getElementById('orientationStudentSearch')?.value||'').trim().toLowerCase();
      const body=document.getElementById('orientationStudentModalBody');
      const filtered=students.filter(r=>{
        const hay=[r.app?.['Student Name'],r.ref,r.app?.['Programme'],r.app?.['Intake']].join(' ').toLowerCase();
        return !q||hay.includes(q);
      });
      body.innerHTML=filtered.map(r=>`<tr>
        <td><input type="checkbox" ${orientationSelected.has(r.ref)?'checked':''} onchange="toggleOrientationModalStudent('${esc(r.ref)}',this.checked)"></td>
        <td><div class="student">${esc(r.app?.['Student Name']||'-')}</div></td>
        <td>${esc(r.app?.['Programme']||'-')}</td>
        <td>${esc(r.app?.['Intake']||'-')}</td>
        <td><div class="subline">${esc(r.ref)}</div></td>
      </tr>`).join('')||'<tr><td colspan="5" class="empty">No unassigned students available.</td></tr>';
    }

    function updateOrientationSelectedUi(){
      const count=orientationSelected.size;
      const el=document.getElementById('orientationModalCount');
      if(el)el.textContent=count+' selected';
      const topBtn=document.getElementById('orientationAddStudentsTopBtn');
      if(topBtn){
        topBtn.textContent=(ended?'Add Student Record':'Add Selected Students')+' ('+count+')';
        topBtn.disabled=count===0;
      }
      const bottomBtn=document.getElementById('orientationAddStudentsBtn');
      if(bottomBtn)bottomBtn.disabled=count===0;
    }

    window.toggleOrientationModalStudent=function(ref,checked){
      if(checked)orientationSelected.add(ref);else orientationSelected.delete(ref);
      updateOrientationSelectedUi();
    };
    document.getElementById('orientationStudentSearch').oninput=renderModalRows;
    renderModalRows();

    async function submitSelectedOrientationStudents(){
      const refs=[...orientationSelected];
      if(!refs.length)return orientationMessage('Select at least one student.','error');
      const result=await orientationAction(
        'v2AssignOrientationBatch',
        {sessionId,referenceNos:refs,historicalOnly:ended},
        ended
          ? `Add ${refs.length} student${refs.length===1?'':'s'} to this ended Orientation Session as historical record only? No email will be sent.`
          : `Add ${refs.length} student${refs.length===1?'':'s'} to this Orientation Session? No invitation email will be sent yet.`
      );
      if(!result)return;
      closeOrientationStudentModal();
      orientationMessage(
        ended
          ? `Historical record added: ${result.assignedCount||0}. No invitation email sent. ${result.skipped?.length?`Skipped: ${result.skipped.length}.`:''}`
          : `Added ${result.assignedCount||0}. Invitation not sent yet. Click Send Invitation when ready. ${result.skipped?.length?`Skipped: ${result.skipped.length}.`:''}`,
        'ok'
      );
    }

    const topAddBtn=document.getElementById('orientationAddStudentsTopBtn');
    const bottomAddBtn=document.getElementById('orientationAddStudentsBtn');
    if(topAddBtn)topAddBtn.onclick=submitSelectedOrientationStudents;
    if(bottomAddBtn)bottomAddBtn.onclick=submitSelectedOrientationStudents;
    updateOrientationSelectedUi();
  };

  function closeOrientationManageModal(){
    document.getElementById('orientationManageModal')?.remove();
  }

  function orientationMoveTargets(currentSessionId){
    return (db.V2_ORIENTATION_SESSIONS||[])
      .filter(s=>String(s['Orientation Session ID']||'')!==String(currentSessionId))
      .filter(s=>!orientationSessionEnded(s))
      .sort((a,b)=>(Date.parse(String(a['Session Date']||''))||0)-(Date.parse(String(b['Session Date']||''))||0));
  }

  window.openOrientationManageStudents=function(sessionId){
    const session=(db.V2_ORIENTATION_SESSIONS||[]).find(s=>String(s['Orientation Session ID']||'')===String(sessionId));
    if(!session)return orientationMessage('Orientation session not found.','error');
    closeOrientationManageModal();
    const completed=String(session['Status']||'').toUpperCase()==='COMPLETED';

    const rows=(db.V2_ORIENTATION_TRACKING||[])
      .filter(x=>String(x['Orientation Session ID']||'')===String(sessionId)&&orientationAssignmentActive(x))
      .sort((a,b)=>String(a['Student Name']||'').localeCompare(String(b['Student Name']||'')));
    const targets=orientationMoveTargets(sessionId);
    const targetOptions='<option value="">Move to session…</option>'+targets.map(s=>{
      const id=String(s['Orientation Session ID']||'');
      const label=[s['Orientation Name']||id,s['Session Date']||''].filter(Boolean).join(' · ');
      return '<option value="'+esc(id)+'">'+esc(label)+'</option>';
    }).join('');

    const overlay=document.createElement('div');
    overlay.id='orientationManageModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.58);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
    overlay.innerHTML=`
      <div style="width:min(1020px,97vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(0,0,0,.25);padding:22px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px">
          <div>
            <h3 style="margin:0 0 4px">Students in Orientation Session</h3>
            <div class="subline">${esc(session['Orientation Name']||sessionId)} · ${esc(sessionId)}</div>
          </div>
          <button class="ghost" type="button" id="orientationManageCloseBtn">Close</button>
        </div>
        <div class="message" style="display:block;background:var(--blueSoft);color:var(--blue);margin-bottom:14px">
          ${completed
            ? rows.length+' student'+(rows.length===1?'':'s')+' in the completed Orientation record. This record is locked; student movement and removal are disabled.'
            : rows.length+' active student'+(rows.length===1?'':'s')+' assigned. Moving a student keeps the old session in the audit history, creates a new active assignment in the selected session, and does not send an email automatically.'}
        </div>
        <div class="table-wrap">
          <table style="min-width:900px">
            <thead><tr><th>Student</th><th>Programme</th><th>Invitation</th><th>Attendance</th><th>Feedback</th><th>Recording</th><th>Move Session</th><th>Action</th></tr></thead>
            <tbody>
              ${rows.map((x,index)=>`
                <tr>
                  <td><div class="student">${esc(x['Student Name']||'-')}</div><div class="subline">${esc(x['Reference No']||'')}</div></td>
                  <td>${esc(x['Programme']||'-')}</td>
                  <td><span class="badge ${classifyBadge(x['Invitation Status']||'NOT_SENT')}">${esc(pretty(x['Invitation Status']||'NOT_SENT'))}</span></td>
                  <td><span class="badge ${classifyBadge(x['Attendance Status']||'NOT_UPDATED')}">${esc(pretty(x['Attendance Status']||'NOT_UPDATED'))}</span></td>
                  <td><span class="badge ${classifyBadge(x['Feedback Status']||'NOT_SUBMITTED')}">${esc(pretty(x['Feedback Status']||'NOT_SUBMITTED'))}</span></td>
                  <td><span class="badge ${classifyBadge(x['Recording Email Status']||'NOT_SENT')}">${esc(pretty(x['Recording Email Status']||'NOT_SENT'))}</span></td>
                  <td>${completed?'<span class="subline">Locked</span>':'<select class="compact" id="oriMoveTarget_'+index+'" style="min-width:210px">'+targetOptions+'</select>'}</td>
                  <td>${completed
                    ? '<span class="badge purple">Record Locked</span>'
                    : '<div class="orientation-actions"><button class="ghost" type="button" data-move-index="'+index+'">Move</button><button class="ghost" type="button" data-remove-index="'+index+'">Remove</button></div>'}</td>
                </tr>`).join('')||'<tr><td colspan="8" class="empty">No active students are assigned to this session.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById('orientationManageCloseBtn').onclick=closeOrientationManageModal;

    overlay.querySelectorAll('[data-remove-index]').forEach(btn=>{
      btn.onclick=async()=>{
        const index=Number(btn.dataset.removeIndex);
        const row=rows[index];if(!row)return;
        const ref=String(row['Reference No']||'');
        const result=await orientationAction(
          'v2RemoveOrientationStudent',
          {sessionId,referenceNo:ref,reason:'Removed from session through ACC'},
          'Remove '+String(row['Student Name']||ref)+' from this Orientation Session? The historical record will be retained and no email will be sent.'
        );
        if(!result)return;
        closeOrientationManageModal();
        orientationMessage('Student removed from this Orientation Session.','ok');
        openOrientationManageStudents(sessionId);
      };
    });

    overlay.querySelectorAll('[data-move-index]').forEach(btn=>{
      btn.onclick=async()=>{
        const index=Number(btn.dataset.moveIndex);
        const row=rows[index];if(!row)return;
        const select=document.getElementById('oriMoveTarget_'+index);
        const targetSessionId=String(select?.value||'');
        if(!targetSessionId)return orientationMessage('Select the target Orientation Session first.','error');
        const target=(db.V2_ORIENTATION_SESSIONS||[]).find(s=>String(s['Orientation Session ID']||'')===targetSessionId);
        const result=await orientationAction(
          'v2MoveOrientationStudent',
          {sourceSessionId:sessionId,targetSessionId,referenceNo:String(row['Reference No']||'')},
          'Move '+String(row['Student Name']||row['Reference No']||'this student')+' to '+String(target?.['Orientation Name']||targetSessionId)+'? No invitation email will be sent automatically.'
        );
        if(!result)return;
        closeOrientationManageModal();
        orientationMessage('Student moved successfully. Invitation in the new session is NOT SENT until Registry clicks Send Invitation.','ok');
        openOrientationManageStudents(sessionId);
      };
    });
  };


  function closeOrientationCreateModal(){
    document.getElementById('orientationCreateModal')?.remove();
  }

  window.openOrientationCreateModal=function(){
    closeOrientationCreateModal();
    const overlay=document.createElement('div');
    overlay.id='orientationCreateModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.58);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
    overlay.innerHTML=[
      '<div style="width:min(900px,97vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(0,0,0,.25);padding:22px">',
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px">',
          '<div><h3 style="margin:0 0 4px">Create Orientation Session</h3><div class="subline">Create the session first. Students and invitation emails are managed after the session is saved.</div></div>',
          '<button class="ghost" type="button" id="orientationCreateCloseBtn">Close</button>',
        '</div>',
        '<div class="detail-grid">',
          '<div class="field"><label>Orientation Name</label><input id="oriName" placeholder="e.g. Orientation October 2026" /></div>',
          '<div class="field"><label>Intake</label><select id="oriIntake"><option value="">Select intake</option></select></div>',
          '<div class="field"><label>Session Date</label><input id="oriDate" type="date" /></div>',
          '<div class="field"><label>Programme Group</label><input id="oriProgrammeGroup" placeholder="ALL" value="ALL" /></div>',
          '<div class="field"><label>Start Time</label><input id="oriStart" type="time" value="08:30" /></div>',
          '<div class="field"><label>End Time</label><input id="oriEnd" type="time" value="10:30" /></div>',
          '<div class="field"><label>Mode</label><select id="oriMode"><option value="ONLINE">Online</option><option value="PHYSICAL">Physical</option><option value="HYBRID">Hybrid</option></select></div>',
          '<div class="field"><label>Automatic Reminders</label><input value="3 days · 2 days · 1 day · ~1 hour before" readonly /></div>',
          '<div class="field"><label>Venue</label><input id="oriVenue" placeholder="Physical venue, if applicable" /></div>',
          '<div class="field"><label>Meeting Link</label><input id="oriMeetingLink" placeholder="Google Meet / online link" /></div>',
        '</div>',
        '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">',
          '<button class="ghost" type="button" id="orientationCreateCancelBtn">Cancel</button>',
          '<button class="primary" type="button" id="orientationCreateSaveBtn">Create Session</button>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(overlay);
    populateOrientationIntakes();
    document.getElementById('orientationCreateCloseBtn').onclick=closeOrientationCreateModal;
    document.getElementById('orientationCreateCancelBtn').onclick=closeOrientationCreateModal;
    document.getElementById('orientationCreateSaveBtn').onclick=createOrientationSession;
  };

  window.createOrientationSession=async function(){
    const name=document.getElementById('oriName')?.value.trim()||'';
    const intakeId=document.getElementById('oriIntake')?.value||'';
    const sessionDate=document.getElementById('oriDate')?.value||'';
    const startTime=document.getElementById('oriStart')?.value||'08:30';
    const endTime=document.getElementById('oriEnd')?.value||'10:30';
    const mode=document.getElementById('oriMode')?.value||'ONLINE';
    const venue=document.getElementById('oriVenue')?.value.trim()||'';
    const meetingLink=document.getElementById('oriMeetingLink')?.value.trim()||'';
    const programmeGroup=document.getElementById('oriProgrammeGroup')?.value.trim()||'ALL';
    if(!name||!intakeId||!sessionDate)return orientationMessage('Enter Orientation Name, Intake and Session Date first.','error');

    const result=await orientationAction('v2CreateOrientationSession',{
      name,intakeId,sessionDate,startTime,endTime,mode,venue,meetingLink,programmeGroup
    },`Create ${name} on ${sessionDate}?`);
    if(!result)return;
    closeOrientationCreateModal();

    const automation=result.reminderAutomation||{};
    if(String(automation.status||'').toUpperCase()==='ACTIVE'){
      orientationMessage('Orientation session created. Add students first, then click Send Invitation when ready. Automatic reminders run only for students whose invitation was sent.','ok');
    }else{
      orientationMessage('Orientation session created. Add students first, then click Send Invitation when ready. Automatic reminder scheduler is not active yet; manual reminder remains available after invitation is sent.','info');
    }
    ['oriName','oriVenue','oriMeetingLink','oriProgrammeGroup'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
  };

  window.sendOrientationInvitation=async function(sessionId){
    const result=await orientationAction(
      'v2SendOrientationInvitation',
      {sessionId},
      'Send Orientation invitation now? Only students whose invitation has not been sent will receive the email.'
    );
    if(result)orientationMessage(`Invitation sent: ${result.sentCount||0}. Skipped: ${result.skippedCount||0}. Failed: ${result.failedCount||0}.`,'ok');
  };

  window.sendOrientationReminderNow=async function(sessionId){
    const result=await orientationAction('v2SendOrientationReminderNow',{sessionId},'Send an Orientation reminder now to assigned students?');
    if(result)orientationMessage(`Reminder sent: ${result.sentCount||0}. Skipped: ${result.skippedCount||0}. Failed: ${result.failedCount||0}.`,'ok');
  };

  window.openOrientationAttendance=async function(sessionId){
    const result=await orientationAction('v2OpenOrientationAttendance',{sessionId},'Open attendance now? Assigned students will receive their personalised attendance link by email. The session QR/link will also become active.');
    if(result)orientationMessage('Attendance opened. Personal links sent: '+(result.sentCount||0)+'. Failed: '+(result.failedCount||0)+'. No email: '+(result.skippedCount||0)+'.','ok');
  };

  window.closeOrientationAttendance=async function(sessionId){
    const result=await orientationAction('v2CloseOrientationAttendance',{sessionId},'Close student self check-in for this session? Manual attendance in ACC will remain available.');
    if(result)orientationMessage('Attendance closed. Manual attendance can still be updated in ACC.','ok');
  };

  window.showOrientationQr=function(sessionId){
    const session=(db.V2_ORIENTATION_SESSIONS||[]).find(s=>String(s['Orientation Session ID']||'')===String(sessionId));
    if(!session)return orientationMessage('Orientation session not found.','error');
    const status=String(session['Attendance Status']||'').toUpperCase();
    if(status!=='OPEN')return orientationMessage('Open Attendance first before showing the session QR.','error');
    const storedLink=String(session['Attendance Link']||'').trim();
    const fallbackLink='https://ipgs-admission-form.innovative.edu.my/orientation-attendance.html?s='+encodeURIComponent(sessionId);
    const link=storedLink && !/n-form\.innovative\.edu\.my/i.test(storedLink) ? storedLink : fallbackLink;
    document.getElementById('orientationQrModal')?.remove();
    const overlay=document.createElement('div');
    overlay.id='orientationQrModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.62);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
    const qr='https://quickchart.io/qr?size=300&margin=2&text='+encodeURIComponent(link);
    overlay.innerHTML='<div style="width:min(480px,94vw);background:#fff;border-radius:22px;padding:24px;text-align:center;box-shadow:0 28px 80px rgba(0,0,0,.3)">'+
      '<div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:var(--purple);text-transform:uppercase">Orientation Attendance</div>'+
      '<h2 style="margin:8px 0 4px">'+esc(session['Orientation Name']||sessionId)+'</h2>'+
      '<div class="subline" style="margin-bottom:16px">Students without the personalised email link may scan this QR.</div>'+
      '<img src="'+qr+'" alt="Orientation attendance QR" style="width:280px;max-width:100%;border-radius:14px;border:1px solid var(--line);padding:8px;background:#fff" />'+
      '<div style="font-size:11px;color:var(--muted);word-break:break-all;margin:14px 0">'+esc(link)+'</div>'+
      '<div style="display:flex;gap:10px"><button class="ghost" style="flex:1" id="orientationQrCopyBtn">Copy Link</button><button class="primary" style="flex:1" id="orientationQrDoneBtn">Done</button></div></div>';
    document.body.appendChild(overlay);
    document.getElementById('orientationQrCopyBtn').onclick=async()=>{await copyText(link);orientationMessage('Attendance link copied.','ok')};
    document.getElementById('orientationQrDoneBtn').onclick=()=>overlay.remove();
  };

  window.setOrientationRecording=async function(sessionId){
    const session=(db.V2_ORIENTATION_SESSIONS||[]).find(s=>String(s['Orientation Session ID']||'')===String(sessionId));
    const current=String(session?.['Recording URL']||'');
    const url=prompt('Paste the orientation recording link:',current);
    if(url===null)return;
    if(!/^https?:\/\//i.test(String(url).trim()))return orientationMessage('Enter a valid recording URL beginning with http:// or https://','error');
    const result=await orientationAction('v2SetOrientationRecording',{sessionId,recordingUrl:String(url).trim()});
    if(result)orientationMessage('Recording link saved. Send Recording is now ready.','ok');
  };

  window.sendOrientationRecording=async function(sessionId){
    const result=await orientationAction('v2SendOrientationRecording',{sessionId},'Send the saved orientation recording to all students assigned to this session?');
    if(result)orientationMessage('Recording sent: '+(result.sentCount||0)+'. Failed: '+(result.failedCount||0)+'. No email: '+(result.skippedCount||0)+'.','ok');
  };
  window.endOrientationSession=async function(sessionId){
    const result=await orientationAction(
      'v2EndOrientationSession',
      {sessionId},
      'End this Orientation Session now? New students, invitation emails and reminders will be disabled. Attendance can still be updated.'
    );
    if(result)orientationMessage('Orientation Session ended. Invitation and reminder actions are now closed.','ok');
  };


  function closeOrientationCompletionModal(){
    document.getElementById('orientationCompletionModal')?.remove();
  }

  window.openOrientationCompletion=async function(sessionId){
    const assessment=await orientationAction('v2OrientationCompletionAssessment',{sessionId});
    if(!assessment)return;
    closeOrientationCompletionModal();

    const blockers=assessment.blockers||[];
    const warnings=assessment.warnings||[];
    const m=assessment.metrics||{};
    const overlay=document.createElement('div');
    overlay.id='orientationCompletionModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.60);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';

    const blockerHtml=blockers.length
      ? '<div class="message" style="display:block;background:#fff0f0;color:#9d2424;margin-bottom:12px"><b>Action required before completion</b><br>'+blockers.map(function(x){return '• '+esc(x);}).join('<br>')+'</div>'
      : '<div class="message" style="display:block;background:#eef8f4;color:#176847;margin-bottom:12px"><b>Ready to complete.</b> ACC will lock the completion snapshot and generate the official PDF report.</div>';
    const warningHtml=warnings.length
      ? '<div class="message" style="display:block;background:#fff8e8;color:#8a5b00;margin-bottom:12px"><b>Warnings</b><br>'+warnings.map(function(x){return '• '+esc(x);}).join('<br>')+'</div>'
      : '';

    overlay.innerHTML=[
      '<div style="width:min(760px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(0,0,0,.25);padding:22px">',
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px">',
          '<div><h3 style="margin:0 0 4px">Complete Orientation & Generate Report</h3><div class="subline">'+esc(sessionId)+'</div></div>',
          '<button class="ghost" type="button" id="orientationCompletionCloseBtn">Close</button>',
        '</div>',
        '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:16px">',
          '<div class="kpi" style="padding:14px"><div class="label">ASSIGNED</div><div class="value" style="font-size:24px">'+Number(m.assigned||0)+'</div></div>',
          '<div class="kpi" style="padding:14px"><div class="label">ATTENDED</div><div class="value" style="font-size:24px">'+Number(m.attended||0)+'</div></div>',
          '<div class="kpi" style="padding:14px"><div class="label">FEEDBACK</div><div class="value" style="font-size:24px">'+Number(m.feedbackSubmitted||0)+'</div></div>',
        '</div>',
        blockerHtml,
        warningHtml,
        '<div class="field"><label>Completion Remarks <span class="subline">(optional)</span></label><textarea id="orientationCompletionRemarks" placeholder="Add any final note or exception reference, if required."></textarea></div>',
        '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">',
          '<button class="ghost" type="button" id="orientationCompletionCancelBtn">Cancel</button>',
          '<button class="primary" type="button" id="orientationCompletionConfirmBtn" '+(blockers.length?'disabled':'')+'>Complete & Generate Report</button>',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(overlay);
    document.getElementById('orientationCompletionCloseBtn').onclick=closeOrientationCompletionModal;
    document.getElementById('orientationCompletionCancelBtn').onclick=closeOrientationCompletionModal;
    const confirmBtn=document.getElementById('orientationCompletionConfirmBtn');
    if(confirmBtn){
      confirmBtn.onclick=async function(){
        const remarks=String(document.getElementById('orientationCompletionRemarks')?.value||'').trim();
        const result=await orientationAction(
          'v2CompleteOrientationAndGenerateReport',
          {sessionId,completionRemarks:remarks},
          'Complete this Orientation Session and generate the official report?'
        );
        if(!result)return;
        closeOrientationCompletionModal();
        orientationMessage('Orientation completed. Official report v'+(result.reportVersion||1)+' generated successfully.','ok');
      };
    }
  };


  function orientationReportBlob_(result){
    const binary=atob(String(result&&result.base64||''));
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return new Blob([bytes],{type:String(result&&result.mimeType||'application/pdf')});
  }

  window.viewOrientationReport=async function(sessionId){
    const result=await orientationAction('v2GetOrientationReportFile',{sessionId});
    if(!result)return;
    const blob=orientationReportBlob_(result);
    const objectUrl=URL.createObjectURL(blob);
    document.getElementById('orientationReportViewer')?.remove();
    const overlay=document.createElement('div');
    overlay.id='orientationReportViewer';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.72);z-index:10000;display:flex;flex-direction:column;padding:18px';
    overlay.innerHTML=[
      '<div style="background:#fff;border-radius:16px 16px 0 0;padding:12px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px">',
        '<div><b>Official Orientation Report</b><div class="subline">'+esc(result.reportReference||'')+' · v'+Number(result.reportVersion||1)+'</div></div>',
        '<button class="ghost" type="button" id="orientationReportViewerClose">Close</button>',
      '</div>',
      '<iframe title="Official Orientation Report" style="width:100%;flex:1;border:0;background:#fff;border-radius:0 0 16px 16px" src="'+objectUrl+'"></iframe>'
    ].join('');
    document.body.appendChild(overlay);
    document.getElementById('orientationReportViewerClose').onclick=function(){
      overlay.remove();
      URL.revokeObjectURL(objectUrl);
    };
  };

  window.downloadOrientationReport=async function(sessionId){
    const result=await orientationAction('v2GetOrientationReportFile',{sessionId});
    if(!result)return;
    const blob=orientationReportBlob_(result);
    const objectUrl=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=objectUrl;
    a.download=String(result.fileName||'Orientation-Session-Report.pdf');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){URL.revokeObjectURL(objectUrl);},1000);
  };

  window.regenerateOrientationReport=async function(sessionId){
    const result=await orientationAction(
      'v2RegenerateOrientationReport',
      {sessionId},
      'Generate a new official report revision? The previous PDF remains retained for audit history.'
    );
    if(result)orientationMessage('Orientation report revision v'+(result.reportVersion||'')+' generated successfully.','ok');
  };

  window.markOrientationAttendance=async function(sessionId,referenceNo,status){
    const result=await orientationAction('v2UpdateOrientationAttendance',{sessionId,referenceNo,attendanceStatus:status},`Mark this student as ${pretty(status)}?`);
    if(result)orientationMessage(`Attendance updated to ${pretty(status)}.`,'ok');
  };

  function populateOrientationIntakes(){
    const el=document.getElementById('oriIntake');if(!el)return;
    const current=el.value;
    const ids=new Map();
    (db.V2_INTAKE_MASTER||[]).forEach(x=>{
      const id=String(x['Intake ID']||'').trim();if(id)ids.set(id,String(x['Intake Name']||id));
    });
    applicationRecords().forEach(r=>{
      const id=String(r.app?.['Intake ID']||'').trim();
      const name=String(r.app?.['Intake']||id);if(id&&!ids.has(id))ids.set(id,name);
    });
    el.innerHTML='<option value="">Select intake</option>'+[...ids.entries()].map(([id,name])=>`<option value="${esc(id)}">${esc(name)} · ${esc(id)}</option>`).join('');
    if([...el.options].some(o=>o.value===current))el.value=current;
  }

  function orientationSessionActionHtml(session,id,rows,attendanceState,recordingUrl,completed,ended){
    const safeId=esc(id);
    let html='<div class="orientation-actions">';
    html+='<button class="ghost" onclick="openOrientationManageStudents(\''+safeId+'\')">Students ('+rows.length+')</button>';

    if(completed){
      const version=Number(session['Report Version']||1);
      html+='<button class="primary" onclick="viewOrientationReport(\''+safeId+'\')">View Report</button>';
      html+='<button class="ghost" onclick="downloadOrientationReport(\''+safeId+'\')">Download PDF</button>';
      html+='<button class="ghost" onclick="regenerateOrientationReport(\''+safeId+'\')">New Revision</button>';
      html+='<span class="badge purple">Report v'+version+'</span>';
      return html+'</div>';
    }

    if(ended){
      html+='<button class="ghost" onclick="openOrientationStudents(\''+safeId+'\')">Add Student Record</button>';
      if(attendanceState==='OPEN'){
        html+='<button class="ghost" onclick="showOrientationQr(\''+safeId+'\')">Show QR</button>';
        html+='<button class="ghost" onclick="closeOrientationAttendance(\''+safeId+'\')">Close Attendance</button>';
      }
      html+='<button class="ghost" onclick="setOrientationRecording(\''+safeId+'\')">'+(recordingUrl?'Edit Recording':'Add Recording')+'</button>';
      if(recordingUrl)html+='<button class="ghost" onclick="sendOrientationRecording(\''+safeId+'\')">Send Recording</button>';
      html+='<button class="primary" onclick="openOrientationCompletion(\''+safeId+'\')">Complete Orientation</button>';
      return html+'</div>';
    }

    html+='<button class="ghost" onclick="openOrientationEdit(\''+safeId+'\')">Edit</button>';
    html+='<button class="primary" onclick="openOrientationStudents(\''+safeId+'\')">Add Students</button>';
    html+='<button class="ghost" onclick="sendOrientationInvitation(\''+safeId+'\')">Send Invitation</button>';
    html+='<button class="ghost" onclick="sendOrientationReminderNow(\''+safeId+'\')">Send Reminder</button>';
    html+='<button class="ghost" onclick="endOrientationSession(\''+safeId+'\')">End Session</button>';
    if(attendanceState==='OPEN'){
      html+='<button class="ghost" onclick="showOrientationQr(\''+safeId+'\')">Show QR</button>';
      html+='<button class="ghost" onclick="closeOrientationAttendance(\''+safeId+'\')">Close Attendance</button>';
    }else{
      html+='<button class="ghost" onclick="openOrientationAttendance(\''+safeId+'\')">Open Attendance</button>';
    }
    html+='<button class="ghost" onclick="setOrientationRecording(\''+safeId+'\')">'+(recordingUrl?'Edit Recording':'Add Recording')+'</button>';
    if(recordingUrl)html+='<button class="ghost" onclick="sendOrientationRecording(\''+safeId+'\')">Send Recording</button>';
    return html+'</div>';
  }

  window.renderOrientation=function(){
    const sessions=db.V2_ORIENTATION_SESSIONS||[],tracking=(db.V2_ORIENTATION_TRACKING||[]).filter(orientationAssignmentActive);
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
        const reminded=rows.reduce((n,x)=>{
          let h={};try{h=JSON.parse(String(x['Reminder History JSON']||'{}'))||{}}catch(_){}
          let count=['D3','D2','D1','H1'].filter(k=>h[k]).length;
          if(Array.isArray(h.MANUAL))count+=h.MANUAL.length;
          if(!count&&String(x['Reminder Status']||'').toUpperCase()==='SENT')count=1;
          return n+count;
        },0);
        const attended=rows.filter(x=>String(x['Attendance Status']||'').toUpperCase()==='ATTENDED').length;
        const attendanceState=String(s['Attendance Status']||'NOT_OPEN').toUpperCase();
        const recordingUrl=String(s['Recording URL']||'').trim();
        const date=[s['Session Date'],[s['Start Time'],s['End Time']].filter(Boolean).join(' - ')].filter(Boolean).join(' · ');
        const storedStatus=String(s['Status']||'SCHEDULED').toUpperCase();
        const completed=storedStatus==='COMPLETED';
        const ended=!completed&&orientationSessionEnded(s);
        const effectiveStatus=completed?'COMPLETED':(ended?'ENDED':storedStatus);
        const feedbackSubmitted=rows.filter(x=>String(x['Feedback Status']||'').toUpperCase()==='SUBMITTED').length;
        const recordingSent=rows.filter(x=>String(x['Recording Email Status']||'').toUpperCase()==='SENT').length;
        return `<tr>
          <td><div class="student">${esc(s['Orientation Name']||id)}</div><div class="subline">${esc(id)}</div><div style="margin-top:6px"><span class="badge ${completed?'purple':ended?'amber':'green'}">${esc(pretty(effectiveStatus))}</span></div></td>
          <td>${esc(s['Intake ID']||'-')}<div class="subline">${esc(s['Programme Group']||'ALL')}</div></td>
          <td>${esc(date||'-')}</td>
          <td><span class="badge blue">${esc(pretty(s['Mode']||'ONLINE'))}</span><div class="subline">${esc(s['Venue']||'')}</div></td>
          <td>${rows.length}<div class="subline">${invited} invited · ${feedbackSubmitted} feedback</div></td>
          <td>${reminded}<div class="subline">3d · 2d · 1d · ~1h</div></td>
          <td>${attended}<div class="subline">${rows.length-attended} absent / pending · ${recordingSent} recording sent</div><div style="margin-top:6px"><span class="badge ${attendanceState==='OPEN'?'green':attendanceState==='CLOSED'?'amber':'blue'}">Attendance ${esc(pretty(attendanceState))}</span></div></td>
          <td>${orientationSessionActionHtml(s,id,rows,attendanceState,recordingUrl,completed,ended)}</td>
        </tr>`;
      }).join('')||'<tr><td colspan="8" class="empty">No orientation session created yet.</td></tr>';
    }


  };

  window.goOrientation=function(btn){
    go('orientation',btn);
    const title=document.getElementById('topTitle');if(title)title.textContent='Orientation';
  };

  const baseRenderAll=window.renderAll;
  if(typeof baseRenderAll==='function'){
    window.renderAll=function(){baseRenderAll();renderOrientation()};
  }
})();