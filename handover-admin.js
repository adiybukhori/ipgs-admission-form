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


  function closeHandoverCreateModal(){
    document.getElementById('handoverCreateModal')?.remove();
  }

  window.openHandoverCreateModal=function(){
    closeHandoverCreateModal();
    const overlay=document.createElement('div');
    overlay.id='handoverCreateModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.58);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
    overlay.innerHTML=[
      '<div style="width:min(820px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(0,0,0,.25);padding:22px">',
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:16px">',
          '<div><h3 style="margin:0 0 4px">Create Academic Handover Session</h3><div class="subline">Create the batch first. Students and operational actions are managed after the session is saved.</div></div>',
          '<button class="ghost" type="button" id="handoverCreateCloseBtn">Close</button>',
        '</div>',
        '<div class="detail-grid">',
          '<div class="field full"><label>Handover Session Name</label><input id="handoverName" placeholder="e.g. Academic Handover - October 2026 Batch 1" /></div>',
          '<div class="field"><label>Academic Recipient</label><input id="handoverAcademicEmail" type="email" value="academicIUC@innovative.edu.my" /></div>',
          '<div class="field"><label>IT PIC</label><input id="handoverItEmail" type="email" value="it@innovative.edu.my" /></div>',
          '<div class="field"><label>Moodle PIC</label><input id="handoverMoodleEmail" type="email" value="moodle@innovative.edu.my" /></div>',
          '<div class="field"><label>e-Library PIC</label><input id="handoverLibraryEmail" type="email" value="library@innovative.edu.my" /></div>',
        '</div>',
        '<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:18px">',
          '<button class="ghost" type="button" id="handoverCreateCancelBtn">Cancel</button>',
          '<button class="primary" type="button" id="handoverCreateSaveBtn">Create Session</button>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(overlay);
    document.getElementById('handoverCreateCloseBtn').onclick=closeHandoverCreateModal;
    document.getElementById('handoverCreateCancelBtn').onclick=closeHandoverCreateModal;
    document.getElementById('handoverCreateSaveBtn').onclick=createHandoverSession;
  };

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
    closeHandoverCreateModal();
    handoverMsg(`Handover Session ${result.batchId} created. Open the session and add students when ready.`,'ok');
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


  function handoverBatchMetrics(batch){
    const id=String(batch&&batch['Handover Batch ID']||'');
    const students=(db.V2_HANDOVER_STUDENTS||[]).filter(function(x){
      return String(x['Handover Batch ID']||'')===id;
    });
    const refs=new Set(students.map(function(x){return String(x['Reference No']||'');}));
    const provisioning=(db.V2_PROVISIONING||[]).filter(function(x){
      const bid=String(x['Handover Batch ID']||'');
      const ref=String(x['Reference No']||'');
      return bid===id || (!bid&&refs.has(ref));
    });
    const byRef=new Map();
    provisioning.forEach(function(x){byRef.set(String(x['Reference No']||''),x);});

    let provisioningComplete=0, accessSent=0, itComplete=0, moodleComplete=0, libraryComplete=0;
    students.forEach(function(s){
      const p=byRef.get(String(s['Reference No']||''))||{};
      const it=String(p['IT Email Status']||'PENDING').toUpperCase();
      const moodle=String(p['Moodle Status']||'PENDING').toUpperCase();
      const lib=String(p['E-Library Status']||'PENDING').toUpperCase();
      if(it==='COMPLETED')itComplete++;
      if(moodle==='COMPLETED')moodleComplete++;
      if(lib==='COMPLETED')libraryComplete++;
      if(it==='COMPLETED'&&moodle==='COMPLETED'&&lib==='COMPLETED')provisioningComplete++;
      if(String(p['Student Notification Status']||'').toUpperCase()==='SENT')accessSent++;
    });

    const status=String(batch&&batch['Status']||'DRAFT').toUpperCase();
    const handedOver=status==='HANDED_OVER'||status==='ACCEPTED';
    const completed=students.length>0&&handedOver&&accessSent===students.length;
    const academicEmail=String(batch&&batch['Academic Email Status']||'NOT_SENT').toUpperCase();
    return {
      id:id,students:students,provisioning:provisioning,byRef:byRef,status:status,handedOver:handedOver,completed:completed,
      provisioningComplete:provisioningComplete,accessSent:accessSent,itComplete:itComplete,moodleComplete:moodleComplete,
      libraryComplete:libraryComplete,academicEmail:academicEmail,pdf:String(batch&&batch['Handover PDF URL']||'').trim()
    };
  }

  function handoverCurrentStage(batch,m){
    if(m.completed)return 'Completed';
    if(m.status==='DRAFT'&&!m.students.length)return 'Student Setup';
    if(m.status==='DRAFT')return 'Ready to Handover';
    if(m.academicEmail!=='SENT')return 'Handover Communication';
    if(m.provisioningComplete<m.students.length)return 'Provisioning';
    if(m.accessSent<m.students.length)return 'Student Access';
    return 'Completed';
  }

  function handoverOperationalStatus(batch,m){
    if(m.completed)return {label:'Completed',cls:'green'};
    if(m.status==='DRAFT')return {label:m.students.length?'Ready':'Setup Required',cls:m.students.length?'blue':'amber'};
    if(m.academicEmail!=='SENT')return {label:'Action Required',cls:'amber'};
    if(m.provisioningComplete===m.students.length&&m.accessSent<m.students.length)return {label:'Action Required',cls:'amber'};
    return {label:'In Progress',cls:'purple'};
  }

  function handoverNextAction(batch,m){
    if(m.completed)return {
      title:'Academic Handover completed',
      text:'All students in this session have completed provisioning and received their student access details.',
      buttons:m.pdf?[['primary','Open Handover PDF','pdf']]:[]
    };
    if(m.status==='DRAFT'&&!m.students.length)return {
      title:'Add students to this handover session',
      text:'The session is ready, but no student has been assigned yet.',
      buttons:[['primary','Add Students','addStudents']]
    };
    if(m.status==='DRAFT')return {
      title:'Ready to hand over',
      text:m.students.length+' student(s) are in the roster. Review the list, then send the handover to Academic and service PICs.',
      buttons:[['primary','Handover Now','handover'],['ghost','Students','students']]
    };
    if(m.academicEmail!=='SENT')return {
      title:'Academic email requires attention',
      text:'The handover exists, but Academic email status is '+pretty(m.academicEmail)+'.',
      buttons:[['primary','Resend Academic','resendAcademic'],['ghost','Communication','communication']]
    };
    if(m.provisioningComplete<m.students.length)return {
      title:'Complete provisioning',
      text:m.provisioningComplete+' of '+m.students.length+' student(s) have completed IT, Moodle and e-Library setup.',
      buttons:[['primary','Review Provisioning','provisioning']]
    };
    if(m.accessSent<m.students.length)return {
      title:'Send student access',
      text:(m.students.length-m.accessSent)+' student(s) are ready to receive their access details.',
      buttons:[['primary','Review Student Access','access']]
    };
    return {title:'Academic Handover completed',text:'All operational actions are complete.',buttons:[]};
  }

  function handoverJourneyHtml(m){
    const steps=[
      ['Setup',true],
      ['Students',m.students.length>0],
      ['Handover',m.handedOver],
      ['Provisioning',m.students.length>0&&m.provisioningComplete===m.students.length],
      ['Student Access',m.students.length>0&&m.accessSent===m.students.length],
      ['Complete',m.completed]
    ];
    let firstPending=steps.findIndex(function(x){return !x[1];});
    if(firstPending<0)firstPending=steps.length-1;
    return '<div style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:16px 0 20px">'+
      steps.map(function(step,index){
        const done=step[1],active=!done&&index===firstPending;
        const bg=done?'#eaf8f3':active?'#f0edfb':'#f2f4f7';
        const fg=done?'#0b7a5a':active?'#392678':'#8b93a3';
        return '<div style="text-align:center"><div style="width:34px;height:34px;border-radius:50%;margin:0 auto 6px;display:grid;place-items:center;background:'+bg+';color:'+fg+';font-weight:900;border:1px solid '+(active?'#d8cff8':'transparent')+'">'+(done?'✓':String(index+1))+'</div><div style="font-size:10px;font-weight:800;color:'+fg+'">'+esc(step[0])+'</div></div>';
      }).join('')+'</div>';
  }

  function handoverDetailActionButtons(batch,m){
    const next=handoverNextAction(batch,m);
    return next.buttons.map(function(btn){
      return '<button class="'+btn[0]+'" type="button" onclick="handoverDetailDo(\''+esc(btn[2])+'\',\''+esc(m.id)+'\')">'+esc(btn[1])+'</button>';
    }).join('');
  }

  function handoverOverviewHtml(batch,m){
    return [
      '<div class="detail-grid">',
        '<div class="panel" style="box-shadow:none"><div class="panel-head"><h3>Handover Details</h3></div><div class="panel-body">',
          '<div class="detail-grid">',
            '<div><div class="subline">Batch ID</div><div class="student">'+esc(m.id)+'</div></div>',
            '<div><div class="subline">Intake Summary</div><div class="student">'+esc(batch['Intake Summary']||'-')+'</div></div>',
            '<div><div class="subline">Created At</div><div class="student">'+esc(batch['Created At']||'-')+'</div></div>',
            '<div><div class="subline">Created By</div><div class="student">'+esc(batch['Created By']||'-')+'</div></div>',
            '<div><div class="subline">Academic Email</div><div class="student">'+esc(pretty(batch['Academic Email Status']||'NOT_SENT'))+'</div></div>',
            '<div><div class="subline">Provisioning Tasks Sent</div><div class="student">'+esc(batch['Provisioning Tasks Sent At']||'-')+'</div></div>',
          '</div>',
        '</div></div>',
        '<div class="panel" style="box-shadow:none"><div class="panel-head"><h3>Session Summary</h3></div><div class="panel-body">',
          '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">',
            '<div class="kpi" style="padding:13px"><div class="label">STUDENTS</div><div class="value" style="font-size:24px">'+m.students.length+'</div></div>',
            '<div class="kpi" style="padding:13px"><div class="label">PROVISIONED</div><div class="value" style="font-size:24px">'+m.provisioningComplete+'</div></div>',
            '<div class="kpi" style="padding:13px"><div class="label">ACCESS SENT</div><div class="value" style="font-size:24px">'+m.accessSent+'</div></div>',
            '<div class="kpi" style="padding:13px"><div class="label">ACADEMIC EMAIL</div><div class="value" style="font-size:15px;padding-top:8px">'+esc(pretty(m.academicEmail))+'</div></div>',
          '</div>',
        '</div></div>',
      '</div>'
    ].join('');
  }

  function handoverStudentsHtml(batch,m){
    const draft=m.status==='DRAFT';
    return [
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap">',
        '<div><div class="student">Student Roster</div><div class="subline">'+m.students.length+' student(s) in this handover session</div></div>',
        (draft?'<button class="primary" onclick="handoverDetailDo(\'addStudents\',\''+esc(m.id)+'\')">Add Students</button>':''),
      '</div>',
      '<div class="table-wrap"><table style="min-width:900px"><thead><tr><th>Student</th><th>Programme</th><th>Intake</th><th>Handover</th><th>Provisioning</th><th>Student Access</th></tr></thead><tbody>',
      m.students.map(function(s){
        const p=m.byRef.get(String(s['Reference No']||''))||{};
        const access=String(p['Student Notification Status']||'NOT_READY').toUpperCase();
        return '<tr>'+
          '<td><div class="student">'+esc(s['Student Name']||'-')+'</div><div class="subline">'+esc(s['Reference No']||'')+'</div></td>'+
          '<td>'+esc(s['Programme']||'-')+'</td>'+
          '<td>'+esc(s['Intake']||'-')+'</td>'+
          '<td><span class="badge '+classifyBadge(s['Handover Status']||'DRAFT')+'">'+esc(pretty(s['Handover Status']||'DRAFT'))+'</span></td>'+
          '<td><span class="badge '+classifyBadge(s['Provisioning Status']||'NOT_STARTED')+'">'+esc(pretty(s['Provisioning Status']||'NOT_STARTED'))+'</span></td>'+
          '<td><span class="badge '+classifyBadge(access)+'">'+esc(pretty(access))+'</span></td>'+
        '</tr>';
      }).join('')+
      (m.students.length?'':'<tr><td colspan="6" class="empty">No students have been added to this handover session.</td></tr>')+
      '</tbody></table></div>'
    ].join('');
  }

  function handoverCommunicationHtml(batch,m){
    const pdf=m.pdf;
    return [
      '<div class="detail-grid">',
        '<div class="panel" style="box-shadow:none"><div class="panel-head"><h3>Academic Handover</h3><span>'+esc(pretty(m.academicEmail))+'</span></div><div class="panel-body">',
          '<div class="subline">Recipient</div><div class="student" style="margin:4px 0 10px">'+esc(batch['Academic Email']||'-')+'</div>',
          '<div class="subline">Sent At</div><div class="student" style="margin:4px 0 12px">'+esc(batch['Academic Email Sent At']||'-')+'</div>',
          '<div class="orientation-actions">',
            (m.status==='DRAFT'?'<button class="primary" onclick="handoverDetailDo(\'handover\',\''+esc(m.id)+'\')">Handover Now</button>':''),
            (m.status!=='DRAFT'?'<button class="ghost" onclick="handoverDetailDo(\'resendAcademic\',\''+esc(m.id)+'\')">Resend Academic</button>':''),
            (pdf?'<button class="ghost" onclick="handoverDetailDo(\'pdf\',\''+esc(m.id)+'\')">Open Handover PDF</button>':''),
          '</div>',
        '</div></div>',
        '<div class="panel" style="box-shadow:none"><div class="panel-head"><h3>Service PIC Tasks</h3><span>'+esc(batch['Provisioning Tasks Sent At']||'Not sent')+'</span></div><div class="panel-body">',
          '<div class="subline">IT PIC</div><div class="student" style="margin:4px 0 8px">'+esc(batch['IT PIC Email']||'-')+'</div>',
          '<div class="subline">Moodle PIC</div><div class="student" style="margin:4px 0 8px">'+esc(batch['Moodle PIC Email']||'-')+'</div>',
          '<div class="subline">e-Library PIC</div><div class="student" style="margin:4px 0 12px">'+esc(batch['E-Library PIC Email']||'-')+'</div>',
          (m.status!=='DRAFT'?'<button class="ghost" onclick="handoverDetailDo(\'resendTasks\',\''+esc(m.id)+'\')">Resend PIC Tasks</button>':''),
        '</div></div>',
      '</div>',
      ((batch['Accepted At']||batch['Accepted By'])?
        '<div class="message" style="display:block;background:var(--blueSoft);color:var(--blue);margin-top:14px">Academic acknowledgement record: '+esc(batch['Accepted By']||'-')+' · '+esc(batch['Accepted At']||'-')+'</div>':'')
    ].join('');
  }

  function handoverProvisioningHtml(batch,m){
    return [
      '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:14px">',
        '<div class="kpi" style="padding:13px"><div class="label">IT COMPLETE</div><div class="value" style="font-size:23px">'+m.itComplete+' / '+m.students.length+'</div></div>',
        '<div class="kpi" style="padding:13px"><div class="label">MOODLE COMPLETE</div><div class="value" style="font-size:23px">'+m.moodleComplete+' / '+m.students.length+'</div></div>',
        '<div class="kpi" style="padding:13px"><div class="label">E-LIBRARY COMPLETE</div><div class="value" style="font-size:23px">'+m.libraryComplete+' / '+m.students.length+'</div></div>',
      '</div>',
      '<div class="table-wrap"><table style="min-width:980px"><thead><tr><th>Student</th><th>Innovative Email / IT</th><th>Moodle</th><th>e-Library</th><th>Overall</th></tr></thead><tbody>',
      m.students.map(function(s){
        const ref=String(s['Reference No']||'');
        const p=m.byRef.get(ref)||{};
        const it=String(p['IT Email Status']||'PENDING').toUpperCase();
        const moodle=String(p['Moodle Status']||'PENDING').toUpperCase();
        const lib=String(p['E-Library Status']||'PENDING').toUpperCase();
        const complete=it==='COMPLETED'&&moodle==='COMPLETED'&&lib==='COMPLETED';
        return '<tr>'+
          '<td><div class="student">'+esc(s['Student Name']||'-')+'</div><div class="subline">'+esc(ref)+'</div></td>'+
          '<td><span class="badge '+classifyBadge(it)+'">'+esc(pretty(it))+'</span><div class="subline">'+esc(p['Innovative Email']||'')+'</div>'+(it!=='COMPLETED'?'<div style="margin-top:6px"><button class="ghost" onclick="handoverDetailDo(\'completeIT\',\''+esc(m.id)+'\',\''+esc(ref)+'\')">Complete IT</button></div>':'')+'</td>'+
          '<td><span class="badge '+classifyBadge(moodle)+'">'+esc(pretty(moodle))+'</span>'+(moodle!=='COMPLETED'?'<div style="margin-top:6px"><button class="ghost" onclick="handoverDetailDo(\'completeMoodle\',\''+esc(m.id)+'\',\''+esc(ref)+'\')">Complete Moodle</button></div>':'')+'</td>'+
          '<td><span class="badge '+classifyBadge(lib)+'">'+esc(pretty(lib))+'</span>'+(lib!=='COMPLETED'?'<div style="margin-top:6px"><button class="ghost" onclick="handoverDetailDo(\'completeLibrary\',\''+esc(m.id)+'\',\''+esc(ref)+'\')">Complete e-Library</button></div>':'')+'</td>'+
          '<td><span class="badge '+(complete?'green':'amber')+'">'+esc(complete?'Ready to Notify':'In Progress')+'</span></td>'+
        '</tr>';
      }).join('')+
      (m.students.length?'':'<tr><td colspan="5" class="empty">Provisioning tasks will appear after Handover Now.</td></tr>')+
      '</tbody></table></div>'
    ].join('');
  }

  function handoverAccessHtml(batch,m){
    return [
      '<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap"><div><div class="student">Student Access</div><div class="subline">'+m.accessSent+' of '+m.students.length+' student(s) have received access details</div></div></div>',
      '<div class="table-wrap"><table style="min-width:900px"><thead><tr><th>Student</th><th>Innovative Email</th><th>Provisioning</th><th>Access Status</th><th>Action</th></tr></thead><tbody>',
      m.students.map(function(s){
        const ref=String(s['Reference No']||'');
        const p=m.byRef.get(ref)||{};
        const it=String(p['IT Email Status']||'PENDING').toUpperCase();
        const moodle=String(p['Moodle Status']||'PENDING').toUpperCase();
        const lib=String(p['E-Library Status']||'PENDING').toUpperCase();
        const ready=it==='COMPLETED'&&moodle==='COMPLETED'&&lib==='COMPLETED';
        const sent=String(p['Student Notification Status']||'').toUpperCase()==='SENT';
        return '<tr>'+
          '<td><div class="student">'+esc(s['Student Name']||'-')+'</div><div class="subline">'+esc(ref)+'</div></td>'+
          '<td>'+esc(p['Innovative Email']||'-')+'</td>'+
          '<td><span class="badge '+(ready?'green':'amber')+'">'+esc(ready?'Complete':'In Progress')+'</span></td>'+
          '<td><span class="badge '+(sent?'green':ready?'purple':'amber')+'">'+esc(sent?'Access Sent':ready?'Ready to Notify':'Not Ready')+'</span><div class="subline">'+esc(p['Student Notified At']||'')+'</div></td>'+
          '<td>'+(ready&&!sent?'<button class="primary" onclick="handoverDetailDo(\'sendAccess\',\''+esc(m.id)+'\',\''+esc(ref)+'\')">Send Student Access</button>':sent?'<button class="ghost" onclick="handoverDetailDo(\'resendAccess\',\''+esc(m.id)+'\',\''+esc(ref)+'\')">Resend Access</button>':'<span class="subline">Complete provisioning first</span>')+'</td>'+
        '</tr>';
      }).join('')+
      (m.students.length?'':'<tr><td colspan="5" class="empty">No students in this handover session.</td></tr>')+
      '</tbody></table></div>'
    ].join('');
  }

  function handoverActivityHtml(batch,m){
    const refs=new Set(m.students.map(function(s){return String(s['Reference No']||'');}));
    const audit=(db.V2_AUDIT_LOG||[]).filter(function(row){
      try{
        const text=JSON.stringify(row);
        if(text.indexOf(m.id)>=0)return true;
        for(const ref of refs){if(ref&&text.indexOf(ref)>=0)return true;}
        return false;
      }catch(_){return false;}
    }).sort(function(a,b){
      return (Date.parse(String(b['Timestamp']||b['Created At']||''))||0)-(Date.parse(String(a['Timestamp']||a['Created At']||''))||0);
    }).slice(0,40);
    return '<div class="panel" style="box-shadow:none"><div class="panel-head"><h3>Handover Activity</h3><span>'+audit.length+' event(s)</span></div><div class="panel-body">'+
      (audit.length?audit.map(function(x){
        return '<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div class="student">'+esc(pretty(x['Action']||x['Event']||'Handover activity'))+'</div><div class="subline">'+esc([x['Timestamp']||x['Created At']||'',x['Reference No']||'',x['Actor']||x['Updated By']||'',x['Result']||''].filter(Boolean).join(' · '))+'</div></div>';
      }).join(''):'<div class="empty">No matching activity log found for this handover session.</div>')+
      '</div></div>';
  }

  function handoverDetailTabHtml(batch,m,tab){
    if(tab==='students')return handoverStudentsHtml(batch,m);
    if(tab==='communication')return handoverCommunicationHtml(batch,m);
    if(tab==='provisioning')return handoverProvisioningHtml(batch,m);
    if(tab==='access')return handoverAccessHtml(batch,m);
    if(tab==='activity')return handoverActivityHtml(batch,m);
    return handoverOverviewHtml(batch,m);
  }

  function closeHandoverDetail(){
    document.getElementById('handoverDetailModal')?.remove();
  }
  window.closeHandoverDetail=closeHandoverDetail;

  window.handoverDetailDo=function(action,batchId,referenceNo){
    const batch=(db.V2_HANDOVER_BATCHES||[]).find(function(b){return String(b['Handover Batch ID']||'')===String(batchId);});
    closeHandoverDetail();
    if(action==='addStudents'||action==='students')return openHandoverStudents(batchId);
    if(action==='handover')return sendHandoverSession(batchId);
    if(action==='resendAcademic')return resendAcademicHandoverEmail(batchId);
    if(action==='resendTasks')return resendProvisioningTasks(batchId);
    if(action==='completeIT')return completeProvisioningTask(referenceNo,'IT');
    if(action==='completeMoodle')return completeProvisioningTask(referenceNo,'MOODLE');
    if(action==='completeLibrary')return completeProvisioningTask(referenceNo,'ELIBRARY');
    if(action==='sendAccess')return sendStudentAccess(referenceNo,false);
    if(action==='resendAccess')return sendStudentAccess(referenceNo,true);
    if(action==='pdf'){
      const url=String(batch&&batch['Handover PDF URL']||'').trim();
      if(url)window.open(url,'_blank','noopener');
      else handoverMsg('Handover PDF is not available yet.','error');
      return;
    }
    if(action==='communication'||action==='provisioning'||action==='access'){
      return openHandoverDetail(batchId,action);
    }
  };

  window.openHandoverDetail=function(batchId,initialTab){
    const batch=(db.V2_HANDOVER_BATCHES||[]).find(function(b){return String(b['Handover Batch ID']||'')===String(batchId);});
    if(!batch)return handoverMsg('Academic Handover Session not found.','error');
    closeHandoverDetail();
    const m=handoverBatchMetrics(batch);
    const stage=handoverCurrentStage(batch,m);
    const opStatus=handoverOperationalStatus(batch,m);
    const next=handoverNextAction(batch,m);

    const overlay=document.createElement('div');
    overlay.id='handoverDetailModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.62);z-index:9998;display:flex;justify-content:center;align-items:flex-start;padding:20px;overflow:auto';
    overlay.innerHTML=[
      '<div style="width:min(1180px,98vw);background:#fff;border-radius:20px;box-shadow:0 30px 80px rgba(0,0,0,.28);overflow:hidden;margin:auto">',
        '<div style="padding:22px 26px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:flex-start;gap:14px;position:sticky;top:0;background:#fff;z-index:2">',
          '<div><h2 style="margin:0 0 6px">'+esc(batch['Handover Name']||batchId)+'</h2><div class="subline">'+esc(batchId)+' · '+esc(batch['Intake Summary']||'No intake summary yet')+'</div></div>',
          '<button class="ghost" type="button" id="handoverDetailCloseBtn">Close</button>',
        '</div>',
        '<div style="padding:24px 26px">',
          '<div style="border:1px solid #ddd8f2;background:#fbfaff;border-radius:18px;padding:18px;margin-bottom:14px">',
            '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">',
              '<div><div style="font-size:12px;font-weight:900;color:var(--purple);margin-bottom:5px">Operational Action Center</div><div style="font-size:18px;font-weight:900">'+esc(next.title)+'</div><div class="subline" style="margin-top:4px;max-width:720px">'+esc(next.text)+'</div></div>',
              '<div><span class="badge '+opStatus.cls+'">'+esc(opStatus.label)+'</span><div class="subline" style="margin-top:6px;text-align:right">Current Stage: '+esc(stage)+'</div></div>',
            '</div>',
            '<div class="orientation-actions" style="margin-top:14px">'+handoverDetailActionButtons(batch,m)+'</div>',
          '</div>',
          handoverJourneyHtml(m),
          '<div id="handoverDetailTabs" style="display:flex;gap:8px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:16px">',
            '<button class="ghost" data-handover-tab="overview">Overview</button>',
            '<button class="ghost" data-handover-tab="students">Students</button>',
            '<button class="ghost" data-handover-tab="communication">Handover & Communication</button>',
            '<button class="ghost" data-handover-tab="provisioning">Provisioning</button>',
            '<button class="ghost" data-handover-tab="access">Student Access</button>',
            '<button class="ghost" data-handover-tab="activity">Activity</button>',
          '</div>',
          '<div id="handoverDetailTabBody"></div>',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(overlay);
    document.getElementById('handoverDetailCloseBtn').onclick=closeHandoverDetail;
    const buttons=overlay.querySelectorAll('[data-handover-tab]');
    const selectTab=function(tab){
      buttons.forEach(function(b){b.classList.remove('primary');b.classList.add('ghost');});
      const active=overlay.querySelector('[data-handover-tab="'+tab+'"]')||overlay.querySelector('[data-handover-tab="overview"]');
      if(active){active.classList.remove('ghost');active.classList.add('primary');}
      const body=document.getElementById('handoverDetailTabBody');
      if(body)body.innerHTML=handoverDetailTabHtml(batch,m,tab);
    };
    buttons.forEach(function(btn){btn.onclick=function(){selectTab(String(btn.dataset.handoverTab||'overview'));};});
    selectTab(initialTab||'overview');
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