from pathlib import Path

p=Path('admin.html')
s=p.read_text(encoding='utf-8')
changed=False

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
    function scheduleApplicantRefresh(referenceNo,delay=650){
      const ref=String(referenceNo||'').trim();if(!ref)return;
      const oldTimer=recordRefreshTimers.get(ref);if(oldTimer)clearTimeout(oldTimer);
      const timer=setTimeout(()=>{recordRefreshTimers.delete(ref);refreshApplicantRecord(ref,'light').catch(()=>null)},delay);
      recordRefreshTimers.set(ref,timer);
    }"""
    if old not in s: raise SystemExit('base session anchor not found')
    s=s.replace(old,new,1);changed=True

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

# SAC actions should not block on a whole-ACC reload.
old_sac="""        }else{await loadData(true);}
        return result;"""
new_sac="""        }else{
          loadData(true).catch(()=>null);
          showMsg('Saved successfully. Syncing latest SAC data…','ok');
        }
        return result;"""
if old_sac in s:
    s=s.replace(old_sac,new_sac,1);changed=True

# Deliberate exception verification remains full.
if "await refreshApplicantRecord(ref).catch(()=>null);" in s:
    s=s.replace("await refreshApplicantRecord(ref).catch(()=>null);","await refreshApplicantRecord(ref,'full').catch(()=>null);")
    changed=True

p.write_text(s,encoding='utf-8')
print('ACC_PERFORMANCE_FASTPATH_PATCHED' if changed else 'ACC_PERFORMANCE_FASTPATH_ALREADY_CURRENT')
