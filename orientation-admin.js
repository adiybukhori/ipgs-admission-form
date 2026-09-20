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

  function assignedOrientationRefs(){
    const set=new Set();
    (db.V2_ORIENTATION_TRACKING||[]).forEach(x=>{
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
    if(['ENDED','CANCELLED','CLOSED'].includes(status))return true;
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
    const link=String(session['Attendance Link']||('https://n-form.innovative.edu.my/orientation-attendance.html?s='+encodeURIComponent(sessionId)));
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

  function populateOrientationTrackingSessionFilter(sessions){
    const el=document.getElementById('orientationTrackingSessionFilter');
    if(!el)return;

    const current=el.value;
    const ordered=[...sessions].sort((a,b)=>{
      const ad=Date.parse(String(a['Session Date']||''))||0;
      const bd=Date.parse(String(b['Session Date']||''))||0;
      if(ad!==bd)return bd-ad;
      return String(b['Orientation Session ID']||'').localeCompare(String(a['Orientation Session ID']||''));
    });

    el.innerHTML='<option value="">All Orientation Sessions</option>'+
      ordered.map(s=>{
        const id=String(s['Orientation Session ID']||'').trim();
        const name=String(s['Orientation Name']||id).trim();
        return id?'<option value="'+esc(id)+'">'+esc(name)+'</option>':'';
      }).join('');

    if(current && [...el.options].some(o=>o.value===current)){
      el.value=current;
    }else if(!el.dataset.defaultApplied && ordered.length){
      el.value=String(ordered[0]['Orientation Session ID']||'');
      el.dataset.defaultApplied='1';
    }
  }

  window.renderOrientation=function(){
    const sessions=db.V2_ORIENTATION_SESSIONS||[],tracking=db.V2_ORIENTATION_TRACKING||[];
    populateOrientationIntakes();
    populateOrientationTrackingSessionFilter(sessions);

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
        const ended=orientationSessionEnded(s);
        const storedStatus=String(s['Status']||'SCHEDULED').toUpperCase();
        const effectiveStatus=ended?'ENDED':storedStatus;
        return `<tr>
          <td><div class="student">${esc(s['Orientation Name']||id)}</div><div class="subline">${esc(id)}</div><div style="margin-top:6px"><span class="badge ${ended?'amber':'green'}">${esc(pretty(effectiveStatus))}</span></div></td>
          <td>${esc(s['Intake ID']||'-')}<div class="subline">${esc(s['Programme Group']||'ALL')}</div></td>
          <td>${esc(date||'-')}</td>
          <td><span class="badge blue">${esc(pretty(s['Mode']||'ONLINE'))}</span><div class="subline">${esc(s['Venue']||'')}</div></td>
          <td>${rows.length}<div class="subline">${invited} invited</div></td>
          <td>${reminded}<div class="subline">3d · 2d · 1d · ~1h</div></td>
          <td>${attended}<div class="subline">${rows.length-attended} not attended / pending</div><div style="margin-top:6px"><span class="badge ${attendanceState==='OPEN'?'green':attendanceState==='CLOSED'?'amber':'blue'}">Attendance ${esc(pretty(attendanceState))}</span></div></td>
          <td><div class="orientation-actions">
            <button class="ghost" onclick="openOrientationEdit('${esc(id)}')">Edit</button>
            ${ended
              ? `<button class="ghost" onclick="openOrientationStudents('${esc(id)}')">Add Student Record</button>
                 <span class="badge amber">Session Ended</span>`
              : `<button class="primary" onclick="openOrientationStudents('${esc(id)}')">Add Students</button>
                 <button class="ghost" onclick="sendOrientationInvitation('${esc(id)}')">Send Invitation</button>
                 <button class="ghost" onclick="sendOrientationReminderNow('${esc(id)}')">Send Reminder</button>
                 <button class="ghost" onclick="endOrientationSession('${esc(id)}')">End Session</button>`
            }
            ${attendanceState==='OPEN'
              ? `<button class="ghost" onclick="showOrientationQr('${esc(id)}')">Show QR</button>
                 <button class="ghost" onclick="closeOrientationAttendance('${esc(id)}')">Close Attendance</button>`
              : `<button class="ghost" onclick="openOrientationAttendance('${esc(id)}')">Open Attendance</button>`
            }
            <button class="ghost" onclick="setOrientationRecording('${esc(id)}')">${recordingUrl?'Edit Recording':'Add Recording'}</button>
            ${recordingUrl?`<button class="ghost" onclick="sendOrientationRecording('${esc(id)}')">Send Recording</button>`:''}
          </div></td>
        </tr>`;
      }).join('')||'<tr><td colspan="8" class="empty">No orientation session created yet.</td></tr>';
    }

    const trackBody=document.getElementById('orientationTrackingBody');
    if(trackBody){
      const selectedSessionId=String(document.getElementById('orientationTrackingSessionFilter')?.value||'').trim();
      const filteredTracking=selectedSessionId
        ? tracking.filter(x=>String(x['Orientation Session ID']||'')===selectedSessionId)
        : tracking;

      trackBody.innerHTML=filteredTracking.map(x=>{
        const session=sessions.find(s=>String(s['Orientation Session ID']||'')===String(x['Orientation Session ID']||''));
        const attendance=String(x['Attendance Status']||'NOT_UPDATED').toUpperCase();
        return `<tr>
          <td><div class="student">${esc(x['Student Name']||'-')}</div><div class="subline">${esc(x['Reference No']||'')}</div></td>
          <td>${esc(x['Programme']||'-')}</td>
          <td>${esc(session?.['Orientation Name']||x['Orientation Session ID']||'-')}</td>
          <td><span class="badge ${classifyBadge(x['Invitation Status']||'PENDING')}">${esc(pretty(x['Invitation Status']||'PENDING'))}</span></td>
          <td><span class="badge ${classifyBadge(x['Reminder Status']||'NOT_SENT')}">${esc(pretty(x['Reminder Status']||'NOT_SENT'))}</span><div class="subline">${esc(pretty(x['Last Reminder Milestone']||''))}</div></td>
          <td><span class="badge ${classifyBadge(attendance)}">${esc(pretty(attendance))}</span><div class="subline">${esc(pretty(x['Attendance Source']||''))}</div></td>
          <td><div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="ghost" onclick="markOrientationAttendance('${esc(x['Orientation Session ID']||'')}','${esc(x['Reference No']||'')}','ATTENDED')">Attended</button>
            <button class="ghost" onclick="markOrientationAttendance('${esc(x['Orientation Session ID']||'')}','${esc(x['Reference No']||'')}','ABSENT')">Absent</button>
            <button class="ghost" onclick="markOrientationAttendance('${esc(x['Orientation Session ID']||'')}','${esc(x['Reference No']||'')}','EXCUSED')">Excused</button>
          </div></td>
        </tr>`;
      }).join('')||'<tr><td colspan="7" class="empty">No students found for this Orientation Session.</td></tr>';
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