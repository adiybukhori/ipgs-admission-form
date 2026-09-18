(function handoverAdminFile(){
  const handoverSelected = new Set();

  function handoverEligibleRecords(){
    return records.filter(r=>{
      if(!r||r.source==='V1')return false;
      const orientation=String(r.workflow?.['Orientation Status']||'').toUpperCase();
      const handover=String(r.workflow?.['Academic Handover Status']||'').toUpperCase();
      const st=String(r.workflow?.['Application Stage']||'').toUpperCase();
      return orientation==='ATTENDED' && handover==='READY' && st==='ORIENTATION';
    });
  }

  function handoverMsg(text,type='info'){
    const el=document.getElementById('handoverMessage');
    if(!el)return;
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

  function updateHandoverSelectionCount(){
    const el=document.getElementById('handoverSelectionCount');
    if(el)el.textContent=handoverSelected.size+' selected';
  }

  window.toggleHandoverStudent=function(ref,checked){
    if(checked)handoverSelected.add(ref);else handoverSelected.delete(ref);
    updateHandoverSelectionCount();
  };

  window.createAcademicHandoverBatch=async function(){
    const refs=[...handoverSelected];
    const name=document.getElementById('handoverName')?.value.trim()||'';
    const academicEmail=document.getElementById('handoverAcademicEmail')?.value.trim()||'';
    const itEmail=document.getElementById('handoverItEmail')?.value.trim()||'';
    const moodleEmail=document.getElementById('handoverMoodleEmail')?.value.trim()||'';
    const libraryEmail=document.getElementById('handoverLibraryEmail')?.value.trim()||'';
    if(!refs.length)return handoverMsg('Select at least one student who is READY for Academic Handover.','error');
    if(!academicEmail||!itEmail||!moodleEmail||!libraryEmail)return handoverMsg('Enter all Academic / IT / Moodle / e-Library recipient emails.','error');
    const result=await handoverAction('v2CreateAcademicHandoverBatch',{
      name,referenceNos:refs,academicEmail,itEmail,moodleEmail,libraryEmail
    },`Create Academic Handover for ${refs.length} student${refs.length===1?'':'s'} and email Academic for acceptance?`);
    if(!result)return;
    handoverSelected.clear();
    handoverMsg(`Handover batch ${result.batchId} created. Academic email: ${pretty(result.academicEmailStatus||'sent')}.`,'ok');
  };

  window.resendAcademicHandoverEmail=async function(batchId){
    const result=await handoverAction('v2ResendAcademicHandoverEmail',{batchId},'Resend this handover document and Academic acceptance link?');
    if(result)handoverMsg(`Academic handover email status: ${pretty(result.status||'sent')}.`,'ok');
  };

  window.resendProvisioningTasks=async function(batchId){
    const result=await handoverAction('v2ResendProvisioningTaskEmails',{batchId},'Resend provisioning task notifications to IT, Moodle and e-Library PICs?');
    if(result)handoverMsg('Provisioning task notifications processed.','ok');
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
    if(result)handoverMsg(result.allProvisioningComplete?'All provisioning tasks completed. Enter the temporary access credentials and send them to the student to complete activation.':`${task==='ELIBRARY'?'e-Library':task} task completed.`,'ok');
  };

  function closeStudentAccessModal(){
    const modal=document.getElementById('studentAccessModal');
    if(modal)modal.remove();
  }

  window.sendStudentAccess=function(ref,resend=false){
    const current=(db.V2_PROVISIONING||[]).find(x=>String(x['Reference No']||'')===String(ref))||{};
    const student=current['Student Name']||ref;
    const innovative=current['Innovative Email']||'';
    const moodle=current['Moodle Login Email']||current['Personal Email']||'';
    const existing=document.getElementById('studentAccessModal');
    if(existing)existing.remove();

    const overlay=document.createElement('div');
    overlay.id='studentAccessModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
    overlay.innerHTML=`
      <div style="width:min(620px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(0,0,0,.25);padding:22px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px">
          <div><h3 style="margin:0 0 4px">Send Student Access</h3><div class="subline">${esc(student)} · ${esc(ref)}</div></div>
          <button class="ghost" type="button" onclick="document.getElementById('studentAccessModal')?.remove()">Close</button>
        </div>
        <div class="message" style="display:block;background:var(--amberSoft);color:#7a5600;margin-bottom:16px">
          Temporary passwords are used only for this email and are not stored in the admission spreadsheet or audit log.
        </div>
        <div class="detail-grid">
          <div class="field full"><label>Innovative Email</label><input id="accessInnovativeLogin" value="${esc(innovative)}" readonly /></div>
          <div class="field full"><label>Innovative Email Temporary Password</label><input id="accessItPassword" type="password" autocomplete="new-password" /></div>
          <div class="field full"><label>Moodle Login</label><input id="accessMoodleLogin" value="${esc(moodle)}" /></div>
          <div class="field full"><label>Moodle Temporary Password</label><input id="accessMoodlePassword" type="password" autocomplete="new-password" /></div>
          <div class="field full"><label>e-Library Login</label><input id="accessLibraryLogin" value="${esc(innovative)}" /></div>
          <div class="field full"><label>e-Library Temporary Password</label><input id="accessLibraryPassword" type="password" autocomplete="new-password" /></div>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap">
          <button class="ghost" type="button" onclick="document.getElementById('studentAccessModal')?.remove()">Cancel</button>
          <button class="primary" type="button" id="sendStudentAccessBtn">Send Access Email</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.addEventListener('click',e=>{if(e.target===overlay)closeStudentAccessModal();});
    const sendBtn=document.getElementById('sendStudentAccessBtn');
    sendBtn.onclick=async()=>{
      const itTemporaryPassword=document.getElementById('accessItPassword')?.value||'';
      const moodleTemporaryPassword=document.getElementById('accessMoodlePassword')?.value||'';
      const eLibraryTemporaryPassword=document.getElementById('accessLibraryPassword')?.value||'';
      const moodleLogin=document.getElementById('accessMoodleLogin')?.value.trim()||'';
      const eLibraryLogin=document.getElementById('accessLibraryLogin')?.value.trim()||'';
      if(!itTemporaryPassword||!moodleTemporaryPassword||!eLibraryTemporaryPassword){
        return handoverMsg('Enter all three temporary passwords before sending.','error');
      }
      sendBtn.disabled=true;
      sendBtn.textContent='Sending…';
      const result=await handoverAction('v2SendStudentProvisioningAccess',{
        referenceNo:ref,resend:!!resend,moodleLogin,eLibraryLogin,
        itTemporaryPassword,moodleTemporaryPassword,eLibraryTemporaryPassword
      },resend?'Resend student access details using these temporary credentials?':'Send these access details to the student and activate the student record?');
      if(result){
        closeStudentAccessModal();
        handoverMsg(result.sent?'Student access email sent. Student is now Active.':`Student access email status: ${pretty(result.status||'not sent')}.`,result.sent?'ok':'error');
      }else{
        sendBtn.disabled=false;
        sendBtn.textContent='Send Access Email';
      }
    };
  };

  window.renderAcademicHandover=function(){
    const eligible=handoverEligibleRecords();
    const batches=db.V2_HANDOVER_BATCHES||[];
    const provisioning=db.V2_PROVISIONING||[];

    const kReady=document.getElementById('handoverReadyKpi');
    const kBatches=document.getElementById('handoverBatchesKpi');
    const kPending=document.getElementById('handoverPendingKpi');
    const kProv=document.getElementById('handoverProvisioningKpi');
    if(kReady)kReady.textContent=eligible.length;
    if(kBatches)kBatches.textContent=batches.length;
    if(kPending)kPending.textContent=batches.filter(x=>String(x['Status']||'').toUpperCase()==='PENDING_ACADEMIC_ACCEPTANCE').length;
    if(kProv)kProv.textContent=provisioning.filter(x=>{
      const it=String(x['IT Email Status']||'').toUpperCase(),m=String(x['Moodle Status']||'').toUpperCase(),l=String(x['E-Library Status']||'').toUpperCase();
      const notified=String(x['Student Notification Status']||'').toUpperCase()==='SENT';
      return !(it==='COMPLETED'&&m==='COMPLETED'&&l==='COMPLETED'&&notified);
    }).length;

    const body=document.getElementById('handoverEligibleBody');
    if(body){
      body.innerHTML=eligible.map(r=>`<tr>
        <td><input type="checkbox" ${handoverSelected.has(r.ref)?'checked':''} onchange="toggleHandoverStudent('${esc(r.ref)}',this.checked)"></td>
        <td><div class="student">${esc(r.app['Student Name']||'-')}</div><div class="subline">${esc(r.ref)}</div></td>
        <td>${esc(r.app['Programme']||'-')}</td>
        <td>${esc(r.app['Intake']||r.workflow?.['Intake']||'-')}</td>
        <td><span class="badge green">Attended</span></td>
      </tr>`).join('')||'<tr><td colspan="5" class="empty">No students are READY for Academic Handover.</td></tr>';
    }
    updateHandoverSelectionCount();

    const batchBody=document.getElementById('handoverBatchesBody');
    if(batchBody){
      batchBody.innerHTML=batches.slice().reverse().map(b=>{
        const id=b['Handover Batch ID']||'';
        const status=String(b['Status']||'').toUpperCase();
        const pdf=b['Handover PDF URL']||'';
        const pending=status==='PENDING_ACADEMIC_ACCEPTANCE';
        const accepted=status==='ACCEPTED';
        return `<tr>
          <td><div class="student">${esc(b['Handover Name']||id)}</div><div class="subline">${esc(id)}</div></td>
          <td>${esc(String(b['Student Count']||0))}<div class="subline">${esc(b['Intake Summary']||'')}</div></td>
          <td><span class="badge ${classifyBadge(status)}">${esc(pretty(status||'-'))}</span></td>
          <td><span class="badge ${classifyBadge(b['Academic Email Status']||'PENDING')}">${esc(pretty(b['Academic Email Status']||'PENDING'))}</span></td>
          <td>${b['Accepted At']?esc(formatDate(b['Accepted At'])):'-'}<div class="subline">${esc(b['Accepted By']||'')}</div></td>
          <td><div style="display:flex;gap:6px;flex-wrap:wrap">
            ${pdf?`<a class="ghost" target="_blank" href="${esc(pdf)}" style="text-decoration:none">Open PDF</a>`:''}
            ${pending?`<button class="ghost" onclick="resendAcademicHandoverEmail('${esc(id)}')">Resend to Academic</button>`:''}
            ${accepted?`<button class="ghost" onclick="resendProvisioningTasks('${esc(id)}')">Resend PIC Tasks</button>`:''}
          </div></td>
        </tr>`;
      }).join('')||'<tr><td colspan="6" class="empty">No Academic Handover batches yet.</td></tr>';
    }

    const provBody=document.getElementById('provisioningBody');
    if(provBody){
      provBody.innerHTML=provisioning.map(p=>{
        const ref=p['Reference No']||'';
        const it=String(p['IT Email Status']||'PENDING').toUpperCase();
        const moodle=String(p['Moodle Status']||'PENDING').toUpperCase();
        const lib=String(p['E-Library Status']||'PENDING').toUpperCase();
        const complete=it==='COMPLETED'&&moodle==='COMPLETED'&&lib==='COMPLETED';
        const notification=String(p['Student Notification Status']||'NOT_READY').toUpperCase();
        const accessSent=notification==='SENT';
        return `<tr>
          <td><div class="student">${esc(p['Student Name']||'-')}</div><div class="subline">${esc(ref)}</div></td>
          <td><span class="badge ${classifyBadge(it)}">${esc(pretty(it))}</span><div class="subline">${esc(p['Innovative Email']||'')}</div>${it!=='COMPLETED'?`<div style="margin-top:6px"><button class="ghost" onclick="completeProvisioningTask('${esc(ref)}','IT')">Complete IT</button></div>`:''}</td>
          <td><span class="badge ${classifyBadge(moodle)}">${esc(pretty(moodle))}</span><div class="subline">${esc(p['Moodle Login Email']||p['Personal Email']||'')}</div>${moodle!=='COMPLETED'?`<div style="margin-top:6px"><button class="ghost" onclick="completeProvisioningTask('${esc(ref)}','MOODLE')">Complete Moodle</button></div>`:''}</td>
          <td><span class="badge ${classifyBadge(lib)}">${esc(pretty(lib))}</span>${lib!=='COMPLETED'?`<div style="margin-top:6px"><button class="ghost" onclick="completeProvisioningTask('${esc(ref)}','ELIBRARY')">Complete e-Library</button></div>`:''}</td>
          <td>
            <span class="badge ${accessSent?'green':complete?'purple':'amber'}">${accessSent?'Active · Access Sent':complete?'Ready to Notify':'In Progress'}</span>
            ${complete&&!accessSent?`<div style="margin-top:7px"><button class="primary" onclick="sendStudentAccess('${esc(ref)}',false)">Send Student Access</button></div>`:''}
            ${accessSent?`<div class="subline" style="margin-top:5px">${p['Student Notified At']?esc(formatDate(p['Student Notified At'])):''}</div><div style="margin-top:6px"><button class="ghost" onclick="sendStudentAccess('${esc(ref)}',true)">Resend Access</button></div>`:''}
          </td>
        </tr>`;
      }).join('')||'<tr><td colspan="5" class="empty">Provisioning tasks appear after Academic accepts a handover batch.</td></tr>';
    }
  };

  window.goHandover=function(btn){
    go('handover',btn);
    const title=document.getElementById('topTitle');
    if(title)title.textContent='Academic Handover';
  };

  const baseRenderAll=window.renderAll;
  if(typeof baseRenderAll==='function'){
    window.renderAll=function(){
      baseRenderAll();
      renderAcademicHandover();
    };
  }
})();