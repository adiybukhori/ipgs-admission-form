(function handoverAdminFile(){
  const selected=new Set();

  function handoverMsg(text,type='info'){
    const el=document.getElementById('handoverMessage');if(!el)return;
    el.style.display='block';
    el.className='message '+(type==='error'?'error':'');
    el.style.background=type==='ok'?'var(--greenSoft)':type==='error'?'var(--redSoft)':'var(--blueSoft)';
    el.style.color=type==='ok'?'var(--green)':type==='error'?'var(--red)':'var(--blue)';
    el.textContent=text;
  }

  async function handoverAction(action,data,confirmText){
    if(confirmText&&!confirm(confirmText))return null;
    handoverMsg('Processing…','info');
    try{
      const res=await fetch(ACTION_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        password,action,data,updatedBy:'Admin Portal V2'
      })});
      const out=await res.json().catch(()=>({ok:false,message:'Invalid response from action service.'}));
      if(!res.ok||!out.ok)throw new Error(out.message||'Unable to complete Academic Handover action.');
      await loadData(true);
      return out.result||out;
    }catch(e){
      handoverMsg(e.message||'Unable to complete Academic Handover action.','error');
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

  function usedRefs(){
    const set=new Set();
    (db.V2_HANDOVER_STUDENTS||[]).forEach(x=>{
      const ref=String(x['Reference No']||'').trim();if(ref)set.add(ref);
    });
    return set;
  }

  function availableStudents(){
    const used=usedRefs();
    return applicationRecords().filter(r=>!used.has(String(r.ref||'')));
  }

  window.createHandoverSession=async function(){
    const name=document.getElementById('handoverName')?.value.trim()||'';
    const academicEmail=document.getElementById('handoverAcademicEmail')?.value.trim()||'';
    const itEmail=document.getElementById('handoverItEmail')?.value.trim()||'';
    const moodleEmail=document.getElementById('handoverMoodleEmail')?.value.trim()||'';
    const libraryEmail=document.getElementById('handoverLibraryEmail')?.value.trim()||'';
    if(!academicEmail||!itEmail||!moodleEmail||!libraryEmail)return handoverMsg('Enter all Academic / IT / Moodle / e-Library recipient emails.','error');

    const result=await handoverAction('v2CreateHandoverSession',{
      name,academicEmail,itEmail,moodleEmail,libraryEmail
    },'Create this Academic Handover Session?');
    if(!result)return;
    handoverMsg(`Handover Session ${result.batchId} created. Click Add Students to build the list before sending.`,'ok');
    const el=document.getElementById('handoverName');if(el)el.value='';
  };

  function closeModal(){document.getElementById('handoverStudentModal')?.remove();selected.clear()}

  window.toggleHandoverModalStudent=function(ref,checked){
    if(checked)selected.add(ref);else selected.delete(ref);
    const el=document.getElementById('handoverModalCount');if(el)el.textContent=selected.size+' selected';
  };

  window.openHandoverStudents=function(batchId){
    const batch=(db.V2_HANDOVER_BATCHES||[]).find(b=>String(b['Handover Batch ID']||'')===String(batchId));
    if(!batch)return handoverMsg('Handover Session not found.','error');
    if(String(batch['Status']||'').toUpperCase()!=='DRAFT')return handoverMsg('This Handover Session has already been sent.','error');

    selected.clear();
    const students=availableStudents();
    const overlay=document.createElement('div');
    overlay.id='handoverStudentModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
    overlay.innerHTML=`
      <div style="width:min(900px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(0,0,0,.25);padding:22px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px">
          <div><h3 style="margin:0 0 4px">Add Students to Handover</h3><div class="subline">${esc(batch['Handover Name']||batchId)} · ${esc(batchId)}</div></div>
          <button class="ghost" onclick="document.getElementById('handoverStudentModal')?.remove()">Close</button>
        </div>
        <div class="message" style="display:block;background:var(--blueSoft);color:var(--blue);margin-bottom:14px">
          This list comes directly from Applications. Admission status and Orientation do not block Handover. Students already included in any Handover Session are excluded.
        </div>
        <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
          <input id="handoverStudentSearch" placeholder="Search student / reference / programme" style="flex:1;min-width:260px" />
          <span class="badge purple" id="handoverModalCount">0 selected</span>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Select</th><th>Student</th><th>Programme</th><th>Intake</th><th>Reference</th></tr></thead><tbody id="handoverStudentModalBody"></tbody></table></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px">
          <button class="ghost" onclick="document.getElementById('handoverStudentModal')?.remove()">Cancel</button>
          <button class="primary" id="handoverAddStudentsBtn">Add Selected Students</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    function renderRows(){
      const q=String(document.getElementById('handoverStudentSearch')?.value||'').trim().toLowerCase();
      const body=document.getElementById('handoverStudentModalBody');
      const filtered=students.filter(r=>!q||[r.app?.['Student Name'],r.ref,r.app?.['Programme'],r.app?.['Intake']].join(' ').toLowerCase().includes(q));
      body.innerHTML=filtered.map(r=>`<tr>
        <td><input type="checkbox" ${selected.has(r.ref)?'checked':''} onchange="toggleHandoverModalStudent('${esc(r.ref)}',this.checked)"></td>
        <td><div class="student">${esc(r.app?.['Student Name']||'-')}</div></td>
        <td>${esc(r.app?.['Programme']||'-')}</td>
        <td>${esc(r.app?.['Intake']||'-')}</td>
        <td><div class="subline">${esc(r.ref)}</div></td>
      </tr>`).join('')||'<tr><td colspan="5" class="empty">No unassigned students available.</td></tr>';
    }
    document.getElementById('handoverStudentSearch').oninput=renderRows;
    renderRows();

    document.getElementById('handoverAddStudentsBtn').onclick=async()=>{
      const refs=[...selected];
      if(!refs.length)return handoverMsg('Select at least one student.','error');
      const result=await handoverAction('v2AddHandoverStudents',{batchId,referenceNos:refs},`Add ${refs.length} student${refs.length===1?'':'s'} to this Handover Session?`);
      if(!result)return;
      closeModal();
      handoverMsg(`Added ${result.addedCount||0} student(s). Session total: ${result.studentCount||0}.`,'ok');
    };
  };

  window.sendHandoverSession=async function(batchId){
    const result=await handoverAction(
      'v2SendHandoverSession',
      {batchId},
      'Handover this session now? Academic and the service PICs will receive the student list.'
    );
    if(result)handoverMsg(`Handover sent. Students: ${result.studentCount||0}. Academic email: ${pretty(result.academicEmailStatus||'processed')}.`,'ok');
  };

  window.resendAcademicHandoverEmail=async function(batchId){
    const result=await handoverAction('v2ResendAcademicHandoverEmail',{batchId},'Resend this Handover list to Academic?');
    if(result)handoverMsg(`Academic email status: ${pretty(result.status||'processed')}.`,'ok');
  };

  window.resendProvisioningTasks=async function(batchId){
    const result=await handoverAction('v2ResendProvisioningTaskEmails',{batchId},'Resend task notifications to IT, Moodle and e-Library PICs?');
    if(result)handoverMsg('Service PIC notifications processed.','ok');
  };

  window.completeProvisioningTask=async function(ref,task){
    const data={referenceNo:ref,task,status:'COMPLETED'};
    if(task==='IT'){
      const current=(db.V2_PROVISIONING||[]).find(x=>String(x['Reference No']||'')===String(ref))||{};
      const email=prompt('Enter the student Innovative email before completing the IT task:',current['Innovative Email']||'');
      if(email===null)return;
      if(!String(email).trim())return handoverMsg('Innovative email is required to complete the IT task.','error');
      data.innovativeEmail=String(email).trim();
    }
    const result=await handoverAction('v2UpdateProvisioningTask',data,`Mark ${task==='ELIBRARY'?'e-Library':task} provisioning as completed?`);
    if(result)handoverMsg(result.allProvisioningComplete?'All service setup tasks completed.':`${task==='ELIBRARY'?'e-Library':task} task completed.`,'ok');
  };

  function closeStudentAccessModal(){document.getElementById('studentAccessModal')?.remove()}

  window.sendStudentAccess=function(ref,resend=false){
    const current=(db.V2_PROVISIONING||[]).find(x=>String(x['Reference No']||'')===String(ref))||{};
    const student=current['Student Name']||ref;
    const innovative=current['Innovative Email']||'';
    const moodle=current['Moodle Login Email']||current['Personal Email']||'';
    closeStudentAccessModal();

    const overlay=document.createElement('div');
    overlay.id='studentAccessModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
    overlay.innerHTML=`
      <div style="width:min(620px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(0,0,0,.25);padding:22px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px">
          <div><h3 style="margin:0 0 4px">Send Student Access</h3><div class="subline">${esc(student)} · ${esc(ref)}</div></div>
          <button class="ghost" onclick="document.getElementById('studentAccessModal')?.remove()">Close</button>
        </div>
        <div class="message" style="display:block;background:var(--amberSoft);color:#7a5600;margin-bottom:16px">Temporary passwords are used only for this email and are not stored.</div>
        <div class="detail-grid">
          <div class="field full"><label>Innovative Email</label><input id="accessInnovativeLogin" value="${esc(innovative)}" readonly /></div>
          <div class="field full"><label>Innovative Email Temporary Password</label><input id="accessItPassword" type="password" autocomplete="new-password" /></div>
          <div class="field full"><label>Moodle Login</label><input id="accessMoodleLogin" value="${esc(moodle)}" /></div>
          <div class="field full"><label>Moodle Temporary Password</label><input id="accessMoodlePassword" type="password" autocomplete="new-password" /></div>
          <div class="field full"><label>e-Library Login</label><input id="accessLibraryLogin" value="${esc(innovative)}" /></div>
          <div class="field full"><label>e-Library Temporary Password</label><input id="accessLibraryPassword" type="password" autocomplete="new-password" /></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px"><button class="ghost" onclick="document.getElementById('studentAccessModal')?.remove()">Cancel</button><button class="primary" id="sendStudentAccessBtn">Send Access Email</button></div>
      </div>`;
    document.body.appendChild(overlay);

    document.getElementById('sendStudentAccessBtn').onclick=async()=>{
      const itTemporaryPassword=document.getElementById('accessItPassword')?.value||'';
      const moodleTemporaryPassword=document.getElementById('accessMoodlePassword')?.value||'';
      const eLibraryTemporaryPassword=document.getElementById('accessLibraryPassword')?.value||'';
      const moodleLogin=document.getElementById('accessMoodleLogin')?.value.trim()||'';
      const eLibraryLogin=document.getElementById('accessLibraryLogin')?.value.trim()||'';
      if(!itTemporaryPassword||!moodleTemporaryPassword||!eLibraryTemporaryPassword)return handoverMsg('Enter all three temporary passwords before sending.','error');
      const result=await handoverAction('v2SendStudentProvisioningAccess',{
        referenceNo:ref,resend:!!resend,moodleLogin,eLibraryLogin,
        itTemporaryPassword,moodleTemporaryPassword,eLibraryTemporaryPassword
      },resend?'Resend student access details?':'Send student access details?');
      if(result){closeStudentAccessModal();handoverMsg(result.sent?'Student access email sent.':`Student access email status: ${pretty(result.status||'not sent')}.`,result.sent?'ok':'error')}
    };
  };

  window.renderAcademicHandover=function(){
    const batches=db.V2_HANDOVER_BATCHES||[];
    const students=db.V2_HANDOVER_STUDENTS||[];
    const provisioning=db.V2_PROVISIONING||[];

    const drafts=batches.filter(x=>String(x['Status']||'').toUpperCase()==='DRAFT');
    const sent=batches.filter(x=>String(x['Status']||'').toUpperCase()==='HANDED_OVER');
    const available=availableStudents();

    const set=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n};
    set('handoverReadyKpi',available.length);
    set('handoverBatchesKpi',batches.length);
    set('handoverPendingKpi',drafts.length);
    set('handoverProvisioningKpi',provisioning.filter(x=>{
      const it=String(x['IT Email Status']||'').toUpperCase(),m=String(x['Moodle Status']||'').toUpperCase(),l=String(x['E-Library Status']||'').toUpperCase();
      return !(it==='COMPLETED'&&m==='COMPLETED'&&l==='COMPLETED');
    }).length);

    const body=document.getElementById('handoverEligibleBody');
    if(body){
      body.innerHTML=available.slice(0,12).map(r=>`<tr>
        <td><div class="student">${esc(r.app?.['Student Name']||'-')}</div><div class="subline">${esc(r.ref)}</div></td>
        <td>${esc(r.app?.['Programme']||'-')}</td>
        <td>${esc(r.app?.['Intake']||'-')}</td>
        <td><span class="badge green">Available</span></td>
      </tr>`).join('')||'<tr><td colspan="4" class="empty">No unassigned students available.</td></tr>';
    }

    const batchBody=document.getElementById('handoverBatchesBody');
    if(batchBody){
      batchBody.innerHTML=batches.slice().reverse().map(b=>{
        const id=b['Handover Batch ID']||'',status=String(b['Status']||'').toUpperCase();
        const count=students.filter(s=>String(s['Handover Batch ID']||'')===String(id)).length;
        const pdf=b['Handover PDF URL']||'';
        return `<tr>
          <td><div class="student">${esc(b['Handover Name']||id)}</div><div class="subline">${esc(id)}</div></td>
          <td>${count}<div class="subline">${esc(b['Intake Summary']||'')}</div></td>
          <td><span class="badge ${status==='HANDED_OVER'?'green':'amber'}">${esc(pretty(status||'-'))}</span></td>
          <td><span class="badge ${classifyBadge(b['Academic Email Status']||'NOT_SENT')}">${esc(pretty(b['Academic Email Status']||'NOT_SENT'))}</span></td>
          <td><div style="display:flex;gap:6px;flex-wrap:wrap">
            ${status==='DRAFT'?`<button class="primary" onclick="openHandoverStudents('${esc(id)}')">Add Students</button><button class="ghost" onclick="sendHandoverSession('${esc(id)}')">Handover Now</button>`:''}
            ${pdf?`<a class="ghost" target="_blank" href="${esc(pdf)}" style="text-decoration:none">Open PDF</a>`:''}
            ${status==='HANDED_OVER'?`<button class="ghost" onclick="resendAcademicHandoverEmail('${esc(id)}')">Resend Academic</button><button class="ghost" onclick="resendProvisioningTasks('${esc(id)}')">Resend PIC Tasks</button>`:''}
          </div></td>
        </tr>`;
      }).join('')||'<tr><td colspan="5" class="empty">No Handover Sessions yet.</td></tr>';
    }

    const provBody=document.getElementById('provisioningBody');
    if(provBody){
      provBody.innerHTML=provisioning.map(p=>{
        const ref=p['Reference No']||'';
        const it=String(p['IT Email Status']||'PENDING').toUpperCase();
        const moodle=String(p['Moodle Status']||'PENDING').toUpperCase();
        const lib=String(p['E-Library Status']||'PENDING').toUpperCase();
        const complete=it==='COMPLETED'&&moodle==='COMPLETED'&&lib==='COMPLETED';
        const accessSent=String(p['Student Notification Status']||'').toUpperCase()==='SENT';
        return `<tr>
          <td><div class="student">${esc(p['Student Name']||'-')}</div><div class="subline">${esc(ref)}</div></td>
          <td><span class="badge ${classifyBadge(it)}">${esc(pretty(it))}</span><div class="subline">${esc(p['Innovative Email']||'')}</div>${it!=='COMPLETED'?`<div style="margin-top:6px"><button class="ghost" onclick="completeProvisioningTask('${esc(ref)}','IT')">Complete IT</button></div>`:''}</td>
          <td><span class="badge ${classifyBadge(moodle)}">${esc(pretty(moodle))}</span>${moodle!=='COMPLETED'?`<div style="margin-top:6px"><button class="ghost" onclick="completeProvisioningTask('${esc(ref)}','MOODLE')">Complete Moodle</button></div>`:''}</td>
          <td><span class="badge ${classifyBadge(lib)}">${esc(pretty(lib))}</span>${lib!=='COMPLETED'?`<div style="margin-top:6px"><button class="ghost" onclick="completeProvisioningTask('${esc(ref)}','ELIBRARY')">Complete e-Library</button></div>`:''}</td>
          <td><span class="badge ${accessSent?'green':complete?'purple':'amber'}">${accessSent?'Access Sent':complete?'Ready to Notify':'In Progress'}</span>
          ${complete&&!accessSent?`<div style="margin-top:7px"><button class="primary" onclick="sendStudentAccess('${esc(ref)}',false)">Send Student Access</button></div>`:''}
          ${accessSent?`<div style="margin-top:6px"><button class="ghost" onclick="sendStudentAccess('${esc(ref)}',true)">Resend Access</button></div>`:''}</td>
        </tr>`;
      }).join('')||'<tr><td colspan="5" class="empty">Provisioning tasks appear after Handover Now.</td></tr>';
    }
  };

  window.goHandover=function(btn){
    go('handover',btn);
    const title=document.getElementById('topTitle');if(title)title.textContent='Academic Handover';
  };

  const baseRenderAll=window.renderAll;
  if(typeof baseRenderAll==='function'){
    window.renderAll=function(){baseRenderAll();renderAcademicHandover()};
  }
})();