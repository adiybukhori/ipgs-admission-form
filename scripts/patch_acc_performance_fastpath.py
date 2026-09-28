from pathlib import Path

p=Path('admin.html')
s=p.read_text(encoding='utf-8')

# Session id used by the n8n bridge to reuse a validated admin session for 20 minutes.
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
    function scheduleApplicantRefresh(referenceNo,delay=650){
      const ref=String(referenceNo||'').trim();if(!ref)return;
      const oldTimer=recordRefreshTimers.get(ref);if(oldTimer)clearTimeout(oldTimer);
      const timer=setTimeout(()=>{
        recordRefreshTimers.delete(ref);
        refreshApplicantRecord(ref,'light').catch(()=>null);
      },delay);
      recordRefreshTimers.set(ref,timer);
    }"""
if old not in s:
    raise SystemExit('session anchor not found')
s=s.replace(old,new,1)

# Light targeted refresh by default for post-save reconciliation.
s=s.replace("async function refreshApplicantRecord(referenceNo){", "async function refreshApplicantRecord(referenceNo,mode='light'){")
s=s.replace("body:JSON.stringify({password,referenceNo:ref})", "body:JSON.stringify({password,referenceNo:ref,mode})")

# Pass reusable session id through every normal admin action.
s=s.replace("body:JSON.stringify({password,action,data,updatedBy:'Admin Portal V2'})", "body:JSON.stringify({password,sessionId:adminSessionId,action,data,updatedBy:'Admin Portal V2'})")

# Normal applicant saves: reconcile in the background and collapse rapid sequential actions into one refresh.
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
if old_refresh not in s:
    raise SystemExit('admin refresh anchor not found')
s=s.replace(old_refresh,new_refresh,1)

# SAC actions should never wait for a full ACC reload after the backend has already confirmed success.
old_sac="""        }else{await loadData(true);}
        return result;"""
new_sac="""        }else{
          loadData(true).catch(()=>null);
          showMsg('Saved successfully. Syncing latest SAC data…','ok');
        }
        return result;"""
if old_sac not in s:
    raise SystemExit('SAC full refresh anchor not found')
s=s.replace(old_sac,new_sac,1)

# Ensure any other ACTION_API call with the same compact payload shape receives the session id.
s=s.replace("JSON.stringify({password,action,data,updatedBy:'Admin Portal V2'})", "JSON.stringify({password,sessionId:adminSessionId,action,data,updatedBy:'Admin Portal V2'})")

# Slow explicit override flow only needs one deliberate final refresh; ask for full state then.
s=s.replace("await refreshApplicantRecord(ref).catch(()=>null);", "await refreshApplicantRecord(ref,'full').catch(()=>null);")

p.write_text(s,encoding='utf-8')
print('ACC_PERFORMANCE_FASTPATH_PATCHED')
