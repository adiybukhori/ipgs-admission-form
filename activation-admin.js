(function activationAdminFile(){
  function liveActivationRecords(){
    return records.filter(r=>{
      if(!r||r.source==='V1') return false;
      const status=String(r.workflow?.['Application Status']||r.app?.['Application Status']||'').toUpperCase();
      return status!=='TEST';
    });
  }

  function activationMsg(text,type='info'){
    const el=document.getElementById('activationMessage');
    if(!el)return;
    el.style.display='block';
    el.className='message '+(type==='error'?'error':'');
    el.style.background=type==='ok'?'var(--greenSoft)':type==='error'?'var(--redSoft)':'var(--blueSoft)';
    el.style.color=type==='ok'?'var(--green)':type==='error'?'var(--red)':'var(--blue)';
    el.textContent=text;
  }

  async function activationAction(action,data,confirmText){
    if(confirmText&&!confirm(confirmText))return null;
    activationMsg('Processing…','info');
    try{
      const res=await fetch(ACTION_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        password,action,data,updatedBy:'Registry Admin Portal V2'
      })});
      const out=await res.json().catch(()=>({ok:false,message:'Invalid response from action service.'}));
      if(!res.ok||!out.ok)throw new Error(out.message||'Unable to complete Prospect / SKY action.');
      await loadData(true);
      return out.result||out;
    }catch(e){
      activationMsg(e.message||'Unable to complete Prospect / SKY action.','error');
      showActivationModalError(e.message||'Unable to complete Prospect / SKY action.');
      return null;
    }
  }

  function feeGroups(){
    const seen=new Set();
    return (db.FEE_GROUP_MASTER||[]).filter(r=>!['INACTIVE','FALSE','NO','0'].includes(String(r['Active']||'ACTIVE').trim().toUpperCase())).map(r=>String(r['Fee Group Code']||'').trim()).filter(code=>{
      if(!code||seen.has(code))return false;
      seen.add(code);return true;
    }).sort();
  }

  function closeActivationModal(){document.getElementById('activationModal')?.remove()}

  function showActivationModalError(message){
    const el=document.getElementById('activationModalFeedback');
    if(el){el.textContent=String(message||'Unable to save.');el.style.display='block';}
    else alert(message);
  }

  function modalShell(title,subtitle,body,primaryText){
    closeActivationModal();
    const overlay=document.createElement('div');
    overlay.id='activationModal';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(17,24,39,.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:18px';
    overlay.innerHTML=`
      <div style="width:min(650px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 25px 70px rgba(0,0,0,.25);padding:22px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;margin-bottom:14px">
          <div><h3 style="margin:0 0 4px">${esc(title)}</h3><div class="subline">${esc(subtitle)}</div></div>
          <button class="ghost" type="button" onclick="document.getElementById('activationModal')?.remove()">Close</button>
        </div>
        ${body}
        <div id="activationModalFeedback" role="alert" style="display:none;margin-top:12px;padding:10px 12px;border-radius:8px;background:var(--redSoft);color:var(--red);font-size:13px"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap">
          <button class="ghost" type="button" onclick="document.getElementById('activationModal')?.remove()">Cancel</button>
          <button class="primary" type="button" id="activationModalPrimary">${esc(primaryText)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeActivationModal()});
  }

  // Fee Structure and Fee Group refer to the SAME persisted fee-group code.
  // Keep the backend field/action names unchanged to preserve the SkyVialing workflow.
  window.openRegistryProspectModal=function(ref){
    const r=liveActivationRecords().find(x=>String(x.ref)===String(ref));
    if(!r)return alert('Application record not found.');
    const groups=feeGroups();
    const skySnapshotFee=String(r.appAdmin?.sky_snapshot_fee_structure||'').trim();
    const currentGroup=skySnapshotFee||String(r.workflow?.['Fee Group']||r.app?.['Fee Group']||'');
    const options=['<option value="">Select Fee Structure</option>'].concat(
      groups.map(g=>'<option value="'+esc(g)+'" '+(g===currentGroup?'selected':'')+'>'+esc(g)+'</option>')
    ).join('');
    const body=
      '<div class="message" style="display:block;background:var(--blueSoft);color:var(--blue);margin-bottom:16px">'+
        'Select the Fee Structure code exactly as recorded in SkyVialing. Fee Structure and Fee Group are the same code; actual charges and instalment terms remain in SkyVialing.'+
      '</div>'+
      (skySnapshotFee?'<div class="message" style="display:block;background:var(--blueSoft);color:var(--blue);margin-bottom:12px">SkyVialing Snapshot (08/10/2026): <strong>'+esc(skySnapshotFee)+'</strong>. This code / revision is the authoritative SkyVialing reference. Verify charges and payment schedule in SkyVialing; the fee amounts have not been imported into ACC.</div>':'')+
      '<div class="detail-grid">'+
        '<div class="field full"><label>Student</label><input value="'+esc(r.app['Student Name']||'-')+'" readonly></div>'+
        '<div class="field full"><label>Fee Structure</label><select id="registryFeeGroup">'+options+'</select></div>'+
        '<div class="field full"><label>Remarks</label><textarea id="registryProspectRemarks" rows="3" style="width:100%;border:1px solid #d7dce6;border-radius:12px;padding:12px 13px;resize:vertical" placeholder="Reason for Fee Structure selection or correction (optional)">'+esc(r.app?.['Prospect Remarks']||'')+'</textarea></div>'+
      '</div>';
    modalShell('Select / Edit Fee Structure',r.ref,body,'Save Fee Structure');
    document.getElementById('activationModalPrimary').onclick=async()=>{
      const feeGroup=document.getElementById('registryFeeGroup')?.value||'';
      const remarks=document.getElementById('registryProspectRemarks')?.value.trim()||'';
      if(!feeGroup){showActivationModalError('Please select a Fee Structure.');return;}
      const result=await activationAction(
        'v2RegistryUpsertProspect',
        {referenceNo:ref,feeGroup,remarks},
        'Save this Fee Structure for the applicant?'
      );
      if(result){
        closeActivationModal();
        alert('Fee Structure saved successfully.');
      }
    };
  };


  // ACC Application queue controls. Changes persist via authenticated API.
  window.openAccAgentModal=function(ref){
    const r=liveActivationRecords().find(x=>String(x.ref)===String(ref));
    if(!r)return alert('Application not found.');
    const currentCode=String(r.appAdmin?.agent_code||r.app?.['Agent Code']||'').trim();
    const choices=[{code:'DIRECT',name:'Direct / Registry'}].concat(
      (db.AGENT_MASTER||[]).map(a=>({code:String(a['Agent Code']||'').trim(),name:String(a['SkyVialing Student Category']||a['Agent Name']||'').trim()})).filter(a=>a.code&&a.name));
    if(currentCode&&!choices.some(a=>a.code===currentCode))choices.push({code:currentCode,name:String(r.appAdmin?.agent_name||r.app?.['Agent Name']||currentCode)});
    const options='<option value="">Select Agent</option>'+choices.map(a=>'<option value="'+esc(a.code)+'" '+(a.code===currentCode?'selected':'')+'>'+esc(a.name)+' ('+esc(a.code)+')</option>').join('');
    const body='<div class="message" style="display:block;background:var(--blueSoft);color:var(--blue);margin-bottom:14px">Select the agent that matches the Student Category in SkyVialing. This does not automatically update SkyVialing.</div>'+
      '<div class="field"><label>Student Category / Agent</label><select id="accAgentSelection">'+options+'</select></div>';
    modalShell('Student Category / Agent',String(r.app['Student Name']||'')+' · '+ref,body,'Save Agent');
    document.getElementById('activationModalPrimary').onclick=async()=>{
      const agentCode=String(document.getElementById('accAgentSelection')?.value||'');
      if(!agentCode)return alert('Please select an agent / student category.');
      const result=await activationAction('v2SetApplicationAgent',{referenceNo:ref,agentCode},'Update Student Category / Agent?');
      if(result){closeActivationModal();alert('Student Category / Agent saved.')}
    };
  };
  window.moveApplicationToActivated=async function(ref){
    const r=liveActivationRecords().find(x=>String(x.ref)===String(ref));
    if(!r)return alert('Application not found.');
    const active=String(r.workflow?.['SKY Activation Status']||r.app?.['SKY Activation Status']||'').toUpperCase()==='ACTIVATED';
    if(!active)return alert('Confirm activation in SkyVialing before moving this application.');
    if(r.appAdmin?.moved_to_activated===true)return alert('Already moved to Activated.');
    const result=await activationAction('v2MoveApplicationToActivated',{referenceNo:ref},
      'Move '+String(r.app['Student Name']||ref)+' out of Application and into Activated? SAC, acceptance and documents will remain unchanged.');
    if(result)alert('Moved to Activated. Student is no longer in the Application listing.');
  };

  window.openSkyActivationModal=function(ref){
    const r=liveActivationRecords().find(x=>String(x.ref)===String(ref));
    if(!r)return alert('Application record not found.');
    const w=r.workflow||{},a=r.app||{};
    const body=`
      <div class="message" style="display:block;background:var(--blueSoft);color:var(--blue);margin-bottom:16px">
        Confirm that the student is already ACTIVE in SkyVialing. This action only records SKY activation in ACC; the student stays in Applications until Move to Activated is clicked. SAC and Acceptance Form remain unchanged.
      </div>
      <div class="detail-grid">
        <div class="field full">
          <label>SKY Student ID / Registration No. <span class="subline">(optional)</span></label>
          <input id="activationSkyStudentId" maxlength="120" value="${esc(r.appAdmin?.sky_student_id||w['SKY Student ID']||a['SKY Student ID']||'')}" placeholder="Enter SKY Student ID if available">
        </div>
        <div class="field full">
          <label>Remarks (optional)</label>
          <textarea id="activationRemarks" maxlength="1500" rows="3" style="width:100%;border:1px solid #d7dce6;border-radius:12px;padding:12px 13px;resize:vertical" placeholder="Activation remarks, if any">${esc(r.appAdmin?.sky_activation_remarks||w['SKY Activation Remarks']||'')}</textarea>
        </div>
      </div>`;
    modalShell('Mark Activated in SkyVialing',`${a['Student Name']||'-'} · ${ref}`,body,'Confirm SKY Activation');
    document.getElementById('activationModalPrimary').onclick=async()=>{
      const skyStudentId=document.getElementById('activationSkyStudentId')?.value.trim()||'';
      const remarks=document.getElementById('activationRemarks')?.value.trim()||'';
      const result=await activationAction(
        'v2ConfirmSkyActivationInAcc',
        {referenceNo:ref,skyStudentId,remarks},
        'Confirm that this student has already been activated in SkyVialing? The student will remain in Applications until you click Move to Activated.'
      );
      if(result){
        closeActivationModal();
        alert('SKY activation confirmed in ACC. Student remains in Applications until Move to Activated is clicked.');
      }
    };
  };

  function activationState(r){
    const w=r.workflow||{},a=r.app||{};
    const prospect=String(w['Prospect Status']||a['Prospect Status']||'PENDING').toUpperCase();
    const activated=String(w['SKY Activation Status']||a['SKY Activation Status']||'').toUpperCase()==='ACTIVATED';
    const hasProspect=['PROSPECT_COMPLETED','PROSPECT_UPDATED'].includes(prospect)&&String(w['Fee Group']||a['Fee Group']||'').trim();
    if(activated)return'ACTIVE_IN_SKY_DONE';
    if(hasProspect)return'PROSPECT_DONE';
    return'PROSPECT_PENDING';
  }

  window.renderRegistryActivation=function(){
    const all=liveActivationRecords(),states=all.map(activationState);
    const list=all.filter(r=>activationState(r)!=='ACTIVE_IN_SKY_DONE');
    const set=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n};
    set('activationProspectPendingKpi',states.filter(x=>x==='PROSPECT_PENDING').length);
    set('activationProspectDoneKpi',states.filter(x=>x==='PROSPECT_DONE').length);
    set('activationDoneKpi',states.filter(x=>x==='ACTIVE_IN_SKY_DONE').length);

    const body=document.getElementById('activationBody');
    if(!body)return;
    body.innerHTML=list.map(r=>{
      const w=r.workflow||{},a=r.app||{},state=activationState(r);
      const prospectId=w['SKY Prospect ID']||a['SKY Prospect ID']||'';
      const feeGroup=w['Fee Group']||a['Fee Group']||'';
      const agent=[a['Agent Code'],a['Agent Name']].filter(Boolean).join(' - ')||'Direct / Registry';
      const activation=String(w['SKY Activation Status']||a['SKY Activation Status']||'NOT_ACTIVATED').toUpperCase();

      let action='';
      if(state==='PROSPECT_PENDING') action=`<span class="badge amber">Waiting Marketing / Agent</span>`;
      if(state==='PROSPECT_DONE') action=`<button class="primary" onclick="openSkyActivationModal('${esc(r.ref)}')">Active in SKY Done</button><button class="ghost" onclick="openRegistryProspectModal('${esc(r.ref)}')">Exception Edit</button>`;
      if(state==='ACTIVE_IN_SKY_DONE') action=`<span class="badge green">Completed</span>`;

      return `<tr>
        <td><div class="student">${esc(a['Student Name']||'-')}</div><div class="subline">${esc(r.ref)}</div><div class="subline">${esc(agent)}</div></td>
        <td><span class="badge ${state==='PROSPECT_PENDING'?'amber':'green'}">${state==='PROSPECT_PENDING'?'Pending':'Completed by Marketing'}</span><div class="subline">${esc(prospectId|| (state==='PROSPECT_DONE'?'Confirmed in SKYVIALING':'-'))}</div></td>
        <td><div class="student">${esc(feeGroup||'-')}</div></td>
        <td><span class="badge ${activation==='ACTIVATED'?'green':'amber'}">${activation==='ACTIVATED'?'Done':'Pending'}</span><div class="subline">${esc(w['SKY Student ID']||'')}</div></td>
        <td><span class="badge ${state==='ACTIVE_IN_SKY_DONE'?'green':state==='PROSPECT_DONE'?'purple':'amber'}">${esc(pretty(state))}</span></td>
        <td><div style="display:flex;gap:6px;flex-wrap:wrap">${action}</div></td>
      </tr>`;
    }).join('')||'<tr><td colspan="6" class="empty">No V2 applications.</td></tr>';
  };

  window.renderActivatedStudents=function(){
    const list=liveActivationRecords().filter(r=>r.appAdmin?.moved_to_activated===true && String(r.workflow?.['SKY Activation Status']||r.app?.['SKY Activation Status']||'').toUpperCase()==='ACTIVATED');
    const set=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n};
    const handed=list.filter(r=>['HANDED_OVER','COMPLETED'].includes(String(r.workflow?.['Academic Handover Status']||'').toUpperCase())).length;
    set('activatedTotalKpi',list.length);
    set('activatedOrientationKpi',list.filter(r=>String(r.workflow?.['Orientation Status']||'').toUpperCase()!=='COMPLETED').length);
    set('activatedHandoverKpi',Math.max(0,list.length-handed));
    set('activatedHandedOverKpi',handed);
    const body=document.getElementById('activatedBody');if(!body)return;
    body.innerHTML=list.map(r=>{
      const w=r.workflow||{},a=r.app||{};
      const folder=w['Student Folder URL']||a['Student Folder URL']||'';
      const orientation=String(w['Orientation Status']||'NOT_ASSIGNED').toUpperCase();
      const handover=String(w['Academic Handover Status']||'NOT_READY').toUpperCase();
      const skyId=w['SKY Student ID']||a['SKY Student ID']||'-';
      const activatedAt=w['SKY Activated At']||a['SKY Activated At']||'';
      return `<tr><td><div class="student">${esc(a['Student Name']||'-')}</div><div class="subline">${esc(r.ref)}</div></td><td>${esc(a['Programme']||'-')}<div class="subline">${esc(a['Intake']||w['Intake']||'-')}</div></td><td><div class="student">${esc(skyId)}</div></td><td><div class="student">${esc(a['Agent Name']||r.appAdmin?.agent_name||r.appAdmin?.sky_snapshot_category||'Not assigned')}</div><div class="subline">${esc(r.appAdmin?.sky_snapshot_fee_structure||w['Fee Group']||a['Fee Group']||'No fee structure')}</div>${r.appAdmin?.sky_snapshot_fee_structure?'<div class="subline">SkyVialing reference code</div>':''}</td><td>${esc(formatDate(activatedAt)||'-')}</td><td><span class="badge ${r.appAdmin?.moved_to_activated===true?'green':'amber'}">${r.appAdmin?.moved_to_activated===true?'Moved':'Still in Application'}</span></td><td><span class="badge ${orientation==='COMPLETED'?'green':'amber'}">${esc(pretty(orientation))}</span></td><td><span class="badge ${['HANDED_OVER','COMPLETED'].includes(handover)?'green':'purple'}">${esc(pretty(handover))}</span></td><td>${folder?`<a class="link" href="${esc(folder)}" target="_blank" rel="noopener">Open Folder</a>`:'-'}</td><td><button class="ghost" onclick="openRecord('${esc(r.ref)}')">Open</button></td></tr>`;
    }).join('')||'<tr><td colspan="10" class="empty">No SKY-activated students yet.</td></tr>';
  };

  window.goActivated=function(btn){go('activated',btn);const title=document.getElementById('topTitle');if(title)title.textContent='Activated Students';};

  window.goActivation=function(btn){
    go('activation',btn);
    const title=document.getElementById('topTitle');if(title)title.textContent='Prospect & SKY Activation';
  };

  const baseRenderAll=window.renderAll;
  if(typeof baseRenderAll==='function'){
    window.renderAll=function(){baseRenderAll();renderRegistryActivation();renderActivatedStudents()};
  }
})();