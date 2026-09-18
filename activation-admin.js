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
      if(!res.ok||!out.ok)throw new Error(out.message||'Unable to complete Registry Activation action.');
      await loadData(true);
      return out.result||out;
    }catch(e){
      activationMsg(e.message||'Unable to complete Registry Activation action.','error');
      return null;
    }
  }

  function feeGroups(){
    const rows=db.FEE_GROUP_MASTER||[];
    const seen=new Set();
    return rows.map(r=>String(r['Fee Group Code']||'').trim()).filter(code=>{
      if(!code||seen.has(code))return false;
      seen.add(code);return true;
    }).sort();
  }

  function closeActivationModal(){
    document.getElementById('activationModal')?.remove();
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
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap">
          <button class="ghost" type="button" onclick="document.getElementById('activationModal')?.remove()">Cancel</button>
          <button class="primary" type="button" id="activationModalPrimary">${esc(primaryText)}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeActivationModal();});
    return overlay;
  }

  window.openRegistryProspectModal=function(ref){
    const r=liveActivationRecords().find(x=>String(x.ref)===String(ref));
    if(!r)return activationMsg('Application record not found.','error');
    const groups=feeGroups();
    const currentGroup=String(r.workflow?.['Fee Group']||r.app?.['Fee Group']||'');
    const options=['<option value="">Select Fee Group</option>'].concat(groups.map(g=>`<option value="${esc(g)}" ${g===currentGroup?'selected':''}>${esc(g)}</option>`)).join('');
    const body=`
      <div class="message" style="display:block;background:var(--blueSoft);color:var(--blue);margin-bottom:16px">
        Use this for direct / Registry-handled applications, or to correct a consultant prospect record. Create or verify the Prospect in SKY first, then save the SKY Prospect ID and Fee Group here.
      </div>
      <div class="detail-grid">
        <div class="field full"><label>Student</label><input value="${esc(r.app['Student Name']||'-')}" readonly></div>
        <div class="field"><label>SKY Prospect ID</label><input id="registrySkyProspectId" value="${esc(r.workflow?.['SKY Prospect ID']||r.app?.['SKY Prospect ID']||'')}" placeholder="Enter SKY Prospect ID"></div>
        <div class="field"><label>Fee Group</label><select id="registryFeeGroup">${options}</select></div>
        <div class="field full"><label>Remarks</label><textarea id="registryProspectRemarks" rows="3" style="width:100%;border:1px solid #d7dce6;border-radius:12px;padding:12px 13px;resize:vertical">${esc(r.app?.['Prospect Remarks']||'')}</textarea></div>
      </div>`;
    modalShell('Update SKY Prospect & Fee Group',r.ref,body,'Save Prospect');
    document.getElementById('activationModalPrimary').onclick=async()=>{
      const skyProspectId=document.getElementById('registrySkyProspectId')?.value.trim()||'';
      const feeGroup=document.getElementById('registryFeeGroup')?.value||'';
      const remarks=document.getElementById('registryProspectRemarks')?.value.trim()||'';
      if(!skyProspectId||!feeGroup)return activationMsg('SKY Prospect ID and Fee Group are required.','error');
      const btn=document.getElementById('activationModalPrimary');btn.disabled=true;btn.textContent='Saving…';
      const result=await activationAction('v2RegistryUpsertProspect',{referenceNo:ref,skyProspectId,feeGroup,remarks,notifyRegistry:false},'Save this SKY Prospect ID and Fee Group?');
      if(result){closeActivationModal();activationMsg('Prospect and Fee Group saved. Activation remains locked until acceptance is completed.','ok');}
      else{btn.disabled=false;btn.textContent='Save Prospect';}
    };
  };

  window.refreshFeeStructure=async function(ref){
    const result=await activationAction('v2RefreshFeeStructure',{referenceNo:ref},'Refresh the Fee Structure link from FEE_GROUP_MASTER?');
    if(result)activationMsg(`Fee Structure status: ${pretty(result.feeStructure?.status||'updated')}.`,result.feeStructure?.status==='READY'?'ok':'info');
  };

  window.resendRegistryProspectNotification=async function(ref){
    const result=await activationAction('v2NotifyRegistryProspectReady',{referenceNo:ref},'Send the Prospect Ready notification to Registry?');
    if(result)activationMsg(`Registry notification: ${pretty(result.status||'processed')}.`,result.sent?'ok':'info');
  };

  window.openSkyActivationModal=function(ref){
    const r=liveActivationRecords().find(x=>String(x.ref)===String(ref));
    if(!r)return activationMsg('Application record not found.','error');
    const w=r.workflow||{};
    const body=`
      <div class="message" style="display:block;background:var(--greenSoft);color:var(--green);margin-bottom:16px">
        Acceptance is complete and the SKY Prospect / Fee Group are recorded. Complete the activation in SKY first, then confirm the resulting Student ID / Registration No. here.
      </div>
      <div class="detail-grid">
        <div class="field"><label>SKY Prospect ID</label><input value="${esc(w['SKY Prospect ID']||'')}" readonly></div>
        <div class="field"><label>Fee Group</label><input value="${esc(w['Fee Group']||'')}" readonly></div>
        <div class="field full"><label>SKY Student ID / Registration No.</label><input id="activationSkyStudentId" value="${esc(w['SKY Student ID']||'')}" placeholder="Enter activated Student ID / Registration No."></div>
        <div class="field full"><label>Activation Remarks</label><textarea id="activationRemarks" rows="3" style="width:100%;border:1px solid #d7dce6;border-radius:12px;padding:12px 13px;resize:vertical">${esc(w['SKY Activation Remarks']||'')}</textarea></div>
      </div>`;
    modalShell('Confirm SKY Activation',`${r.app['Student Name']||'-'} · ${ref}`,body,'Confirm Activation');
    document.getElementById('activationModalPrimary').onclick=async()=>{
      const skyStudentId=document.getElementById('activationSkyStudentId')?.value.trim()||'';
      const remarks=document.getElementById('activationRemarks')?.value.trim()||'';
      if(!skyStudentId)return activationMsg('SKY Student ID / Registration No. is required.','error');
      const btn=document.getElementById('activationModalPrimary');btn.disabled=true;btn.textContent='Activating…';
      const result=await activationAction('v2ActivateStudentInSky',{referenceNo:ref,skyStudentId,remarks},'Confirm that this student has been activated in SKY?');
      if(result){closeActivationModal();activationMsg('SKY activation recorded. Student is now eligible for Orientation.','ok');}
      else{btn.disabled=false;btn.textContent='Confirm Activation';}
    };
  };

  function activationState(r){
    const w=r.workflow||{};
    const prospect=String(w['Prospect Status']||r.app?.['Prospect Status']||'PENDING').toUpperCase();
    const acceptance=String(w['Acceptance Status']||'').toUpperCase();
    const activated=String(w['SKY Activation Status']||'').toUpperCase()==='ACTIVATED';
    const hasProspect=prospect==='PROSPECT_UPDATED'&&String(w['SKY Prospect ID']||r.app?.['SKY Prospect ID']||'').trim()&&String(w['Fee Group']||r.app?.['Fee Group']||'').trim();
    if(activated)return'ACTIVATED';
    if(!hasProspect)return'PROSPECT_PENDING';
    if(acceptance!=='ACCEPTED')return'WAITING_ACCEPTANCE';
    return'READY_TO_ACTIVATE';
  }

  window.renderRegistryActivation=function(){
    const list=liveActivationRecords();
    const states=list.map(r=>activationState(r));
    const set=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n;};
    set('activationProspectPendingKpi',states.filter(x=>x==='PROSPECT_PENDING').length);
    set('activationWaitingAcceptanceKpi',states.filter(x=>x==='WAITING_ACCEPTANCE').length);
    set('activationReadyKpi',states.filter(x=>x==='READY_TO_ACTIVATE').length);
    set('activationDoneKpi',states.filter(x=>x==='ACTIVATED').length);

    const body=document.getElementById('activationBody');
    if(!body)return;
    body.innerHTML=list.map(r=>{
      const w=r.workflow||{},a=r.app||{};
      const state=activationState(r);
      const prospectId=w['SKY Prospect ID']||a['SKY Prospect ID']||'';
      const feeGroup=w['Fee Group']||a['Fee Group']||'';
      const feeStatus=String(w['Fee Structure Status']||a['Fee Structure Status']||'NOT_SYNCED').toUpperCase();
      const feeUrl=w['Fee Structure PDF URL']||a['Fee Structure PDF URL']||'';
      const acceptance=String(w['Acceptance Status']||'NOT_OPEN').toUpperCase();
      const activation=String(w['SKY Activation Status']||'NOT_ACTIVATED').toUpperCase();
      const agent=[a['Agent Code'],a['Agent Name']].filter(Boolean).join(' - ')||'Direct / Registry';
      let action='';
      if(state==='PROSPECT_PENDING')action=`<button class="primary" onclick="openRegistryProspectModal('${esc(r.ref)}')">Set Prospect</button>`;
      if(state==='WAITING_ACCEPTANCE')action=`<button class="ghost" onclick="openRegistryProspectModal('${esc(r.ref)}')">Edit Prospect</button>`;
      if(state==='READY_TO_ACTIVATE')action=`<button class="primary" onclick="openSkyActivationModal('${esc(r.ref)}')">Activate in SKY</button>`;
      if(state==='ACTIVATED')action=`<span class="badge green">Completed</span>`;

      return `<tr>
        <td><div class="student">${esc(a['Student Name']||'-')}</div><div class="subline">${esc(r.ref)}</div><div class="subline">${esc(agent)}</div></td>
        <td><span class="badge ${classifyBadge(w['Prospect Status']||'PENDING')}">${esc(pretty(w['Prospect Status']||'PENDING'))}</span><div class="subline">${esc(prospectId||'-')}</div></td>
        <td><div>${esc(feeGroup||'-')}</div><div style="margin-top:5px"><span class="badge ${feeStatus==='READY'?'green':'amber'}">${esc(pretty(feeStatus))}</span></div>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${feeUrl?`<a class="ghost" target="_blank" href="${esc(feeUrl)}" style="text-decoration:none">Open Fee</a>`:''}${feeGroup?`<button class="ghost" onclick="refreshFeeStructure('${esc(r.ref)}')">Refresh</button>`:''}</div>
        </td>
        <td><span class="badge ${classifyBadge(acceptance)}">${esc(pretty(acceptance))}</span></td>
        <td><span class="badge ${activation==='ACTIVATED'?'green':'amber'}">${esc(pretty(activation||'NOT_ACTIVATED'))}</span><div class="subline">${esc(w['SKY Student ID']||'')}</div></td>
        <td><span class="badge ${state==='ACTIVATED'?'green':state==='READY_TO_ACTIVATE'?'purple':'amber'}">${esc(pretty(state))}</span></td>
        <td><div style="display:flex;gap:6px;flex-wrap:wrap">${action}${prospectId&&feeGroup?`<button class="ghost" onclick="resendRegistryProspectNotification('${esc(r.ref)}')">Notify Registry</button>`:''}</div></td>
      </tr>`;
    }).join('')||'<tr><td colspan="7" class="empty">No active V2 applications.</td></tr>';
  };

  window.goActivation=function(btn){
    go('activation',btn);
    const title=document.getElementById('topTitle');
    if(title)title.textContent='Prospect & SKY Activation';
  };

  function openActivationFromQuery(){
    const p=new URLSearchParams(location.search);
    if(p.get('section')!=='activation')return;
    const btn=document.querySelector('.nav button[data-section="activation"]');
    if(btn)goActivation(btn);
    const ref=p.get('ref');
    if(ref){
      setTimeout(()=>{
        const row=liveActivationRecords().find(r=>String(r.ref)===String(ref));
        if(row){
          const state=activationState(row);
          activationMsg(`Opened from Registry action link: ${row.app['Student Name']||ref} · ${pretty(state)}.`,'info');
        }
      },50);
    }
  }

  const baseRenderAll=window.renderAll;
  if(typeof baseRenderAll==='function'){
    window.renderAll=function(){
      baseRenderAll();
      renderRegistryActivation();
      openActivationFromQuery();
    };
  }
})();