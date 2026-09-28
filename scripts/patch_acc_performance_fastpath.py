from pathlib import Path

p=Path('admin.html')
s=p.read_text(encoding='utf-8')
changed=False

marker='    // ADMIN_TARGETED_REFRESH_V1\n'
first=s.find(marker);second=s.find(marker,first+len(marker)) if first!=-1 else -1
if first!=-1 and second!=-1:s=s[:first]+s[second:];changed=True
s=s.replace('function scheduleApplicantRefresh(referenceNo,delay=650){','function scheduleApplicantRefresh(referenceNo,delay=1200){')

old_targets="const targetSheets=['V2_APPLICATIONS','V2_WORKFLOW','V2_DOCUMENT_REVIEW','V2_AI_SCREENING','V2_QUALIFICATION_SCREENING','V2_SAC_CANDIDATES','V2_ASSESSMENT_PROGRESS','V2_AUDIT_LOG'];"
new_targets="const targetSheets=['V2_APPLICATIONS','V2_WORKFLOW','V2_DOCUMENT_REVIEW','V2_AI_SCREENING','V2_QUALIFICATION_SCREENING','V2_SAC_CANDIDATES','V2_ASSESSMENT_PROGRESS','V2_AUDIT_LOG','V2_AGENT_EVENTS'];"
if old_targets in s:s=s.replace(old_targets,new_targets,1);changed=True

# Targeted record API now shares the same bridge-authenticated session as all other ACC calls.
old_record_body="JSON.stringify({password,referenceNo:ref,mode})"
new_record_body="JSON.stringify({password,sessionId:adminSessionId,referenceNo:ref,mode})"
if old_record_body in s:s=s.replace(old_record_body,new_record_body,1);changed=True

if "let adminSessionId = sessionStorage.getItem('ipgsAdminSessionId')" not in s:
    old="""    let password = sessionStorage.getItem('ipgsAdminPassword') || '';
    let db = {}, records = [], selected = null, sacPackState = null;"""
    new="""    let password = sessionStorage.getItem('ipgsAdminPassword') || '';
    let adminSessionId = sessionStorage.getItem('ipgsAdminSessionId') || '';
    if(!adminSessionId){try{adminSessionId=crypto.randomUUID()}catch(_){adminSessionId='ACC-'+Date.now()+'-'+Math.random().toString(36).slice(2)}sessionStorage.setItem('ipgsAdminSessionId',adminSessionId)}
    let db = {}, records = [], selected = null, sacPackState = null;
    const recordRefreshTimers=new Map();
    function scheduleApplicantRefresh(referenceNo,delay=1200){const ref=String(referenceNo||'').trim();if(!ref)return;const oldTimer=recordRefreshTimers.get(ref);if(oldTimer)clearTimeout(oldTimer);const timer=setTimeout(()=>{recordRefreshTimers.delete(ref);refreshApplicantRecord(ref,'light').catch(()=>null)},delay);recordRefreshTimers.set(ref,timer)}"""
    if old not in s:raise SystemExit('base session anchor not found')
    s=s.replace(old,new,1);changed=True

if 'function scheduleSacRefresh(' not in s:
    anchor='    const stageOrder = ';idx=s.find(anchor)
    if idx==-1:raise SystemExit('stageOrder anchor not found')
    helper="""    let sacRefreshTimer=null;
    function mergeSacModuleData(delta){if(!delta||typeof delta!=='object')return;['V2_SAC_SESSIONS','V2_SAC_CANDIDATES','SAC_COMMITTEE_MASTER'].forEach(name=>{if(Array.isArray(delta[name]))db[name]=delta[name]});buildRecords();renderSac();if(selected?.ref){selected=records.find(x=>x.ref===selected.ref)||selected;renderSelectedApplicant()}if(document.getElementById('sacSessionModal')?.classList.contains('open')&&sacDetailSessionId)renderSacSessionDetail()}
    async function refreshSacModule(force=true){const res=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,sessionId:adminSessionId,force,scope:'sac'})});const out=await res.json().catch(()=>({ok:false,message:'Invalid SAC refresh response.'}));if(!res.ok||!out.ok)throw new Error(out.message||'Unable to refresh SAC data.');mergeSacModuleData(out.data||{});return out}
    function scheduleSacRefresh(delay=900){if(sacRefreshTimer)clearTimeout(sacRefreshTimer);sacRefreshTimer=setTimeout(()=>{sacRefreshTimer=null;refreshSacModule(true).catch(()=>null)},delay)}
"""
    s=s[:idx]+helper+s[idx:];changed=True
else:
    old="if(selected?.ref){selected=records.find(x=>x.ref===selected.ref)||selected;renderSelectedApplicant()}\n    }";new="if(selected?.ref){selected=records.find(x=>x.ref===selected.ref)||selected;renderSelectedApplicant()}if(document.getElementById('sacSessionModal')?.classList.contains('open')&&sacDetailSessionId)renderSacSessionDetail()\n    }"
    if old in s:s=s.replace(old,new,1);changed=True

if "async function refreshApplicantRecord(referenceNo,mode='light')" not in s:s=s.replace("async function refreshApplicantRecord(referenceNo){","async function refreshApplicantRecord(referenceNo,mode='light'){");changed=True
if "JSON.stringify({password,referenceNo:ref})" in s:s=s.replace("JSON.stringify({password,referenceNo:ref})",new_record_body,1);changed=True
if "sessionId:adminSessionId,action,data" not in s:s=s.replace("JSON.stringify({password,action,data,updatedBy:'Admin Portal V2'})","JSON.stringify({password,sessionId:adminSessionId,action,data,updatedBy:'Admin Portal V2'})");changed=True
if "body:JSON.stringify({password,force})" in s:s=s.replace("body:JSON.stringify({password,force})","body:JSON.stringify({password,sessionId:adminSessionId,force})",1);changed=True
if "function logout(){sessionStorage.removeItem('ipgsAdminPassword');password='';" in s:s=s.replace("function logout(){sessionStorage.removeItem('ipgsAdminPassword');password='';","function logout(){sessionStorage.removeItem('ipgsAdminPassword');sessionStorage.removeItem('ipgsAdminSessionId');adminSessionId='';password='';",1);changed=True

old_refresh="""        if(ref){
          refreshApplicantRecord(ref)
            .then(()=>opsMsg('Saved successfully.','ok'))
            .catch(()=>opsMsg('Saved successfully. Use Refresh if you need to verify the latest backend data.','ok'));
        }else{
          opsMsg('Saved successfully.','ok');
        }""";new_refresh="""        if(ref){scheduleApplicantRefresh(ref);opsMsg('Saved successfully.','ok')}else{opsMsg('Saved successfully.','ok')}"""
if old_refresh in s:s=s.replace(old_refresh,new_refresh,1);changed=True

if 'async function runAdminActionBackground(' not in s:
    anchor='    function runDocumentReview(){';idx=s.find(anchor)
    if idx==-1:raise SystemExit('runDocumentReview anchor not found')
    helper="""    async function runAdminActionBackground(action,data){try{const res=await fetch(ACTION_API,{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({password,sessionId:adminSessionId,action,data,updatedBy:'Admin Portal V2'})});const out=await res.json().catch(()=>({ok:false,message:'Invalid background action response.'}));if(!res.ok||!out.ok)throw new Error(out.message||'Background save failed.');const ref=data?.referenceNo||'';if(ref)scheduleApplicantRefresh(ref,1600);return out.result||out}catch(e){console.warn('ACC background action failed',action,e);if(selected?.ref&&selected.ref===data?.referenceNo)opsMsg('Main save completed, but a background follow-up sync needs retry. Use Refresh if the status does not update.','error');return null}}
"""
    s=s[:idx]+helper+s[idx:];changed=True

old_bg="""        }else{
          loadData(true).catch(()=>null);
          showMsg('Saved successfully. Syncing latest SAC data…','ok');
        }
        return result;""";new_bg="""        }else{scheduleSacRefresh();showMsg('Saved successfully. Syncing latest SAC data…','ok')}
        return result;"""
if old_bg in s:s=s.replace(old_bg,new_bg,1);changed=True
if "        }else{await loadData(true);}\n        return result;" in s:s=s.replace("        }else{await loadData(true);}\n        return result;",new_bg,1);changed=True

replacements={
"if(!result)return;sacDetailMsg('SAC details saved. Refreshing…','ok');setTimeout(()=>location.reload(),450);":"if(!result)return;sacDetailMsg('SAC details saved.','ok');scheduleSacRefresh(250);",
"if(!result)return;sacDetailMsg('Panel list saved. Refreshing…','ok');setTimeout(()=>location.reload(),450);":"if(!result)return;sacDetailMsg('Panel list saved.','ok');scheduleSacRefresh(250);",
"sacPageMsg('SAC session deleted.','ok');\n      setTimeout(()=>location.reload(),450);":"sacPageMsg('SAC session deleted.','ok');\n      scheduleSacRefresh(250);",
"if(result.sent){sacDetailMsg(`Invitation sent to ${result.guestCount||0} panel member(s).`,'ok');setTimeout(()=>location.reload(),650)}":"if(result.sent){sacDetailMsg(`Invitation sent to ${result.guestCount||0} panel member(s).`,'ok');scheduleSacRefresh(350)}"
}
for old,new in replacements.items():
    if old in s:s=s.replace(old,new,1);changed=True
if "await refreshApplicantRecord(ref).catch(()=>null);" in s:s=s.replace("await refreshApplicantRecord(ref).catch(()=>null);","await refreshApplicantRecord(ref,'full').catch(()=>null);");changed=True

p.write_text(s,encoding='utf-8')
print('ACC_PERFORMANCE_FASTPATH_PATCHED' if changed else 'ACC_PERFORMANCE_FASTPATH_ALREADY_CURRENT')
