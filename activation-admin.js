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
      return null;
    }
  }

  function feeGroups(){
    const seen=new Set();
    return (db.FEE_GROUP_MASTER||[]).map(r=>String(r['Fee Group Code']||'').trim()).filter(code=>{
      if(!code||seen.has(code))return false;
      seen.add(code);return true;
    }).sort();
  }

  function closeActivationModal(){document.getElementById('activationModal')?.remove()}

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
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeActivationModal()});
  }

  window.openRegistryProspectModal=function(ref){
    const r=liveActivationRecords().find(x=>String(x.ref)===String(ref));
    if(!r)return activationMsg('Application record not found.','error');
    const groups=feeGroups();
    const currentGroup=String(r.workflow?.['Fee Group']||r.app?.['Fee Group']||'');
    const options=['<option value="">Select Fee Group</option>'].concat(
      groups.map(g=>'<option value="'+esc(g)+'" '+(g===currentGroup?'selected':'')+'>'+esc(g)+'</option>')
    ).join('');
    const body=
      '<div class="message" style="display:block;background:var(--blueSoft);color:var(--blue);margin-bottom:16px">'+
        'Use this only when Registry needs to correct the Fee Group selected by Marketing / Academic Consultant. Prospect completion remains owned by Marketing.'+
      '</div>'+
      '<div class="detail-grid">'+
        '<div class="field full"><label>Student</label><input value="'+esc(r.app['Student Name']||'-')+'" readonly></div>'+
        '<div class="field full"><label>Fee Structure / Fee Group</label><select id="registryFeeGroup">'+options+'</select></div>'+
        '<div class="field full"><label>Remarks</label><textarea id="registryProspectRemarks" rows="3" style="width:100%;border:1px solid #d7dce6;border-radius:12px;padding:12px 13px;resize:vertical" placeholder="Reason for Fee Group correction (optional)">'+esc(r.app?.['Prospect Remarks']||'')+'</textarea></div>'+
      '</div>';
    modalShell('Exception Edit - Fee Group',r.ref,body,'Update Fee Group');
    document.getElementById('activationModalPrimary').onclick=async()=>{
      const feeGroup=document.getElementById('registryFeeGroup')?.value||'';
      const remarks=document.getElementById('registryProspectRemarks')?.value.trim()||'';
      if(!feeGroup)return activationMsg('Fee Group is required.','error');
      const result=await activationAction(
        'v2RegistryUpsertProspect',
        {referenceNo:ref,feeGroup,remarks},
        'Update the Fee Group for this applicant?'
      );
      if(result){
        closeActivationModal();
        activationMsg('Fee Group updated successfully. Prospect remains completed by Marketing.','ok');
      }
    };
  };

  window.refreshFeeStructure=async function(ref){
    const result=await activationAction('v2RefreshFeeStructure',{referenceNo:ref},'Refresh the Fee Structure link from FEE_GROUP_MASTER?');
    if(result)activationMsg(`Fee Structure status: ${pretty(result.feeStructure?.status||'updated')}.`,result.feeStructure?.status==='READY'?'ok':'info');
  };


  window.openSkyActivationModal=function(ref){
    const r=liveActivationRecords().find(x=>String(x.ref)===String(ref));
    if(!r)return activationMsg('Application record not found.','error');
    const w=r.workflow||{};
    const body=`
      <div class="message" style="display:block;background:var(--greenSoft);color:var(--green);margin-bottom:16px">
        Prospect has been completed by Marketing / Consultant. After Registry activates the student in SKY, mark the operational task as done here.
      </div>
      <div class="detail-grid">
        <div class="field"><label>SKY Prospect ID</label><input value="${esc(w['SKY Prospect ID']||r.app?.['SKY Prospect ID']||'')}" readonly></div>
        <div class="field"><label>Fee Structure</label><input value="${esc(w['Fee Group']||r.app?.['Fee Group']||'')}" readonly></div>
        <div class="field full"><label>SKY Student ID / Registration No. <span class="subline">(optional)</span></label><input id="activationSkyStudentId" value="${esc(w['SKY Student ID']||'')}" placeholder="Optional"></div>
        <div class="field full"><label>Remarks</label><textarea id="activationRemarks" rows="3" style="width:100%;border:1px solid #d7dce6;border-radius:12px;padding:12px 13px;resize:vertical">${esc(w['SKY Activation Remarks']||'')}</textarea></div>
      </div>`;
    modalShell('Mark Active in SKY',`${r.app['Student Name']||'-'} · ${ref}`,body,'Active in SKY Done');
    document.getElementById('activationModalPrimary').onclick=async()=>{
      const skyStudentId=document.getElementById('activationSkyStudentId')?.value.trim()||'';
      const remarks=document.getElementById('activationRemarks')?.value.trim()||'';
      const result=await activationAction('v2ActivateStudentInSky',{referenceNo:ref,skyStudentId,remarks},'Confirm that this student is ACTIVE in SKY?');
      if(result){closeActivationModal();activationMsg('Active in SKY marked DONE.','ok')}
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
    const list=liveActivationRecords(),states=list.map(activationState);
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
      const feeStatus=String(w['Fee Structure Status']||a['Fee Structure Status']||'NOT_SYNCED').toUpperCase();
      const feeUrl=w['Fee Structure PDF URL']||a['Fee Structure PDF URL']||'';
      const agent=[a['Agent Code'],a['Agent Name']].filter(Boolean).join(' - ')||'Direct / Registry';
      const activation=String(w['SKY Activation Status']||a['SKY Activation Status']||'NOT_ACTIVATED').toUpperCase();

      let action='';
      if(state==='PROSPECT_PENDING') action=`<span class="badge amber">Waiting Marketing / Agent</span>`;
      if(state==='PROSPECT_DONE') action=`<button class="primary" onclick="openSkyActivationModal('${esc(r.ref)}')">Active in SKY Done</button><button class="ghost" onclick="openRegistryProspectModal('${esc(r.ref)}')">Exception Edit</button>`;
      if(state==='ACTIVE_IN_SKY_DONE') action=`<span class="badge green">Completed</span>`;

      return `<tr>
        <td><div class="student">${esc(a['Student Name']||'-')}</div><div class="subline">${esc(r.ref)}</div><div class="subline">${esc(agent)}</div></td>
        <td><span class="badge ${state==='PROSPECT_PENDING'?'amber':'green'}">${state==='PROSPECT_PENDING'?'Pending':'Completed by Marketing'}</span><div class="subline">${esc(prospectId|| (state==='PROSPECT_DONE'?'Confirmed in SKYVIALING':'-'))}</div></td>
        <td><div>${esc(feeGroup||'-')}</div><div style="margin-top:5px"><span class="badge ${feeStatus==='READY'?'green':'amber'}">${esc(pretty(feeStatus))}</span></div>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">${feeUrl?`<a class="ghost" target="_blank" href="${esc(feeUrl)}" style="text-decoration:none">Open Fee</a>`:''}${feeGroup?`<button class="ghost" onclick="refreshFeeStructure('${esc(r.ref)}')">Refresh</button>`:''}</div>
        </td>
        <td><span class="badge ${activation==='ACTIVATED'?'green':'amber'}">${activation==='ACTIVATED'?'Done':'Pending'}</span><div class="subline">${esc(w['SKY Student ID']||'')}</div></td>
        <td><span class="badge ${state==='ACTIVE_IN_SKY_DONE'?'green':state==='PROSPECT_DONE'?'purple':'amber'}">${esc(pretty(state))}</span></td>
        <td><div style="display:flex;gap:6px;flex-wrap:wrap">${action}</div></td>
      </tr>`;
    }).join('')||'<tr><td colspan="6" class="empty">No V2 applications.</td></tr>';
  };

  window.goActivation=function(btn){
    go('activation',btn);
    const title=document.getElementById('topTitle');if(title)title.textContent='Prospect & SKY Activation';
  };

  const baseRenderAll=window.renderAll;
  if(typeof baseRenderAll==='function'){
    window.renderAll=function(){baseRenderAll();renderRegistryActivation()};
  }
})();