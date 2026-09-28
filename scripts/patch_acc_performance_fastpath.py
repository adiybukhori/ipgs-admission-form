from pathlib import Path

p=Path('admin.html')
s=p.read_text(encoding='utf-8')
changed=False

# Remove duplicate targeted-refresh helper block left by earlier iterative patches.
marker='    // ADMIN_TARGETED_REFRESH_V1\n'
first=s.find(marker)
second=s.find(marker,first+len(marker)) if first!=-1 else -1
if first!=-1 and second!=-1:
    s=s[:first]+s[second:]
    changed=True

# Use a slightly longer background reconcile window so GViz has time to expose the committed row.
s=s.replace('function scheduleApplicantRefresh(referenceNo,delay=650){','function scheduleApplicantRefresh(referenceNo,delay=1200){')

# Base fast-path may already be installed. Add it only when absent.
if "let adminSessionId = sessionStorage.getItem('ipgsAdminSessionId')" not in s:
    old="""    let password = sessionStorage.getItem('ipgsAdminPassword') || '';
    let db = {}, records = [], selected = null, sacPackState = null;"""
    new="""    let password = sessionStorage.getItem('ipgsAdminPassword') || '';
    let adminSessionId = sessionStorage.getItem('ipgsAdminSessionId') || '';
    if(!adminSessionId){
      try{adminSessionId=crypto.randomUUID()}catch(_){adminSessionId='ACC-'+Date.now()+'-'+Math.random().toString(36).slice(2)}
      sessionStorage.setItem('ipgsAdminSessionId',adminSessionId);
    }
    let db = {}, records = [], selected = null, sacPackState = null;
    const recordRefreshTimers=new Map();
    function scheduleApplicantRefresh(referenceNo,delay=1200){
      const ref=String(referenceNo||'').trim();if(!ref)return;
      const oldTimer=recordRefreshTimers.get(ref);if(oldTimer)clearTimeout(oldTimer);
      const timer=setTimeout(()=>{recordRefreshTimers.delete(ref);refreshApplicantRecord(ref,'light').catch(()=>null)},delay);
      recordRefreshTimers.set(ref,timer);
    }"""
    if old not in s: raise SystemExit('base session anchor not found')
    s=s.replace(old,new,1);changed=True

# Add a lightweight, debounced SAC-only sync. This replaces 24-sheet reloads after SAC actions.
if 'function scheduleSacRefresh(' not in s:
    anchor='    const stageOrder = '
    idx=s.find(anchor)
    if idx==-1: raise SystemExit('stageOrder anchor not found')
    helper="""    let sacRefreshTimer=null;
    function mergeSacModuleData(delta){
      if(!delta||typeof delta!=='object')return;
      ['V2_SAC_SESSIONS','V2_SAC_CANDIDATES','SAC_COMMITTEE_MASTER'].forEach(name=>{if(Array.isArray(delta[name]))db[name]=delta[name]});
      buildRecords();
      renderSac();
      if(selected?.ref){selected=records.find(x=>x.ref===selected.ref)||selected;renderSelectedApplicant()}
    }
    async function refreshSacModule(force=true){
      const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,sessionId:adminSessionId,force,scope:'sac'})});
      const out=await res.json().catch(()=>({ok:false,message:'Invalid SAC refresh response.'}));
      if(!res.ok||!out.ok)throw new Error(out.message||'Unable to refresh SAC data.');
      mergeSacModuleData(out.data||{});
      return out;
    }
    function scheduleSacRefresh(delay=900){
      if(sacRefreshTimer)clearTimeout(sacRefreshTimer);
      sacRefreshTimer=setTimeout(()=>{sacRefreshTimer=null;refreshSacModule(true).catch(()=>null)},delay);
    }
"""
    s=s[:idx]+helper+s[idx:];changed=True

# Targeted applicant refresh: light mode for normal reconciliation.
if "async function refreshApplicantRecord(referenceNo,mode='light')" not in s:
    s=s.replace("async function refreshApplicantRecord(referenceNo){","async function refreshApplicantRecord(referenceNo,mode='light'){")
    changed=True
if "JSON.stringify({password,referenceNo:ref,mode})" not in s:
    s=s.replace("JSON.stringify({password,referenceNo:ref})","JSON.stringify({password,referenceNo:ref,mode})")
    changed=True

# Reusable bridge session for admin actions.
if "sessionId:adminSessionId,action,data" not in s:
    s=s.replace("JSON.stringify({password,action,data,updatedBy:'Admin Portal V2'})","JSON.stringify({password,sessionId:adminSessionId,action,data,updatedBy:'Admin Portal V2'})")
    changed=True

# Full data loads also pass sessionId, allowing authoritative SAC reads to use the same session.
old_load="body:JSON.stringify({password,force})"
new_load="body:JSON.stringify({password,sessionId:adminSessionId,force})"
if old_load in s:
    s=s.replace(old_load,new_load,1);changed=True

# Logout must invalidate the browser-side session key too.
old_logout="function logout(){sessionStorage.removeItem('ipgsAdminPassword');password='';"
new_logout="function logout(){sessionStorage.removeItem('ipgsAdminPassword');sessionStorage.removeItem('ipgsAdminSessionId');adminSessionId='';password='';"
if old_logout in s:
    s=s.replace(old_logout,new_logout,1);changed=True

# Normal applicant saves: UI returns immediately; one debounced reconciliation follows.
old_refresh="""        if(ref){
          refreshApplicantRecord(ref)
            .then(()=>opsMsg('Saved successfully.','ok'))
            .catch(()=>opsMsg('Saved successfully. Use Refresh if you need to verify the latest backend data.','ok'));
        }else{
          opsMsg('Saved successfully.','ok');
        }"""
new_refresh="""        if(ref){
          scheduleApplicantRefresh(ref);
          opsMsg('Saved successfully.','ok');
        }else{
          opsMsg('Saved successfully.','ok');
        }"""
if old_refresh in s:
    s=s.replace(old_refresh,new_refresh,1);changed=True

# Add a quiet keepalive action helper for secondary/audit writes that should not block the user.
if 'async function runAdminActionBackground(' not in s:
    anchor='    function runDocumentReview(){'
    idx=s.find(anchor)
    if idx==-1: raise SystemExit('runDocumentReview anchor not found')
    helper="""    async function runAdminActionBackground(action,data){
      try{
        const res=await fetch(ACTION_API,{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({password,sessionId:adminSessionId,action,data,updatedBy:'Admin Portal V2'})});
        const out=await res.json().catch(()=>({ok:false,message:'Invalid background action response.'}));
        if(!res.ok||!out.ok)throw new Error(out.message||'Background save failed.');
        const ref=data?.referenceNo||'';if(ref)scheduleApplicantRefresh(ref,1600);
        return out.result||out;
      }catch(e){
        console.warn('ACC background action failed',action,e);
        if(selected?.ref&&selected.ref===data?.referenceNo)opsMsg('Main save completed, but a background follow-up sync needs retry. Use Refresh if the status does not update.','error');
        return null;
      }
    }
"""
    s=s[:idx]+helper+s[idx:];changed=True

# Document review: wait only for the primary checklist save. Audit + stage follow-up run concurrently in background.
old_doc="""    async function completeManualDocumentReview(){
      if(!selected)return;const controls=[...document.querySelectorAll('.manual-doc-status')];if(!controls.length)return opsMsg('No manual document checklist is available.','error');
      const decisions=controls.map(x=>({key:x.dataset.key,label:x.dataset.label,status:x.value==='VERIFIED'?'VERIFIED':'MISSING'}));const remarks=document.getElementById('manualDocRemarks')?.value||'';
      const missing=decisions.filter(x=>x.status==='MISSING');
      const result=await runAdminAction('v2CompleteManualDocumentReview',{referenceNo:selected.ref,decisions,remarks,nonBlocking:true,proceedWithPendingDocuments:true,missingForReminder:missing},`Save document review for ${selected.app['Student Name']||selected.ref}? Missing items will be followed up, but admission processing will continue.`);
      if(!result)return;
      if(missing.length) await runAdminAction('v2RecordAgentActivity',{referenceNo:selected.ref,agentId:'ADMIN_PORTAL',executionId:'DOC-FOLLOWUP-'+Date.now(),action:'DOCUMENT_FOLLOW_UP_NON_BLOCKING',status:'FOLLOW_UP_ONLY',summary:'Missing documents for weekly reminder: '+missing.map(x=>x.label).join(', '),data:{missingDocuments:missing,nonBlocking:true},timestamp:new Date().toISOString(),updatedBy:'Admin Portal V2'});
      await runAdminAction('v2UpdateStage',{referenceNo:selected.ref,stage:'QUALIFICATION_SCREENING',remarks:'Document review completed as non-blocking. Missing items remain on weekly follow-up list.'});
      opsMsg(missing.length?`Review saved. ${missing.length} missing document(s) moved to follow-up; screening may continue.`:'Review saved. All documents verified; screening may continue.','ok');
    }"""
new_doc="""    async function completeManualDocumentReview(){
      if(!selected)return;const controls=[...document.querySelectorAll('.manual-doc-status')];if(!controls.length)return opsMsg('No manual document checklist is available.','error');
      const ref=selected.ref;const decisions=controls.map(x=>({key:x.dataset.key,label:x.dataset.label,status:x.value==='VERIFIED'?'VERIFIED':'MISSING'}));const remarks=document.getElementById('manualDocRemarks')?.value||'';
      const missing=decisions.filter(x=>x.status==='MISSING');
      const result=await runAdminAction('v2CompleteManualDocumentReview',{referenceNo:ref,decisions,remarks,nonBlocking:true,proceedWithPendingDocuments:true,missingForReminder:missing},`Save document review for ${selected.app['Student Name']||ref}? Missing items will be followed up, but admission processing will continue.`);
      if(!result)return;
      selected.workflow={...(selected.workflow||{}),'Application Stage':'QUALIFICATION_SCREENING','Document Review Status':'COMPLETE'};renderSelectedApplicant();
      const jobs=[runAdminActionBackground('v2UpdateStage',{referenceNo:ref,stage:'QUALIFICATION_SCREENING',remarks:'Document review completed as non-blocking. Missing items remain on weekly follow-up list.'})];
      if(missing.length)jobs.push(runAdminActionBackground('v2RecordAgentActivity',{referenceNo:ref,agentId:'ADMIN_PORTAL',executionId:'DOC-FOLLOWUP-'+Date.now(),action:'DOCUMENT_FOLLOW_UP_NON_BLOCKING',status:'FOLLOW_UP_ONLY',summary:'Missing documents for weekly reminder: '+missing.map(x=>x.label).join(', '),data:{missingDocuments:missing,nonBlocking:true},timestamp:new Date().toISOString(),updatedBy:'Admin Portal V2'}));
      Promise.allSettled(jobs).then(()=>scheduleApplicantRefresh(ref,1800));
      opsMsg(missing.length?`Review saved. ${missing.length} missing document(s) moved to follow-up; screening may continue.`:'Review saved. All documents verified; screening may continue.','ok');
    }"""
if old_doc in s:
    s=s.replace(old_doc,new_doc,1);changed=True

# Replace any background full SAC reload from the first performance pass with SAC-only refresh.
old_bg="""        }else{
          loadData(true).catch(()=>null);
          showMsg('Saved successfully. Syncing latest SAC data…','ok');
        }
        return result;"""
new_bg="""        }else{
          scheduleSacRefresh();
          showMsg('Saved successfully. Syncing latest SAC data…','ok');
        }
        return result;"""
if old_bg in s:
    s=s.replace(old_bg,new_bg,1);changed=True
old_sac="""        }else{await loadData(true);}
        return result;"""
if old_sac in s:
    s=s.replace(old_sac,new_bg,1);changed=True

# Deliberate exception verification remains full.
if "await refreshApplicantRecord(ref).catch(()=>null);" in s:
    s=s.replace("await refreshApplicantRecord(ref).catch(()=>null);","await refreshApplicantRecord(ref,'full').catch(()=>null);")
    changed=True

p.write_text(s,encoding='utf-8')
print('ACC_PERFORMANCE_FASTPATH_PATCHED' if changed else 'ACC_PERFORMANCE_FASTPATH_ALREADY_CURRENT')
