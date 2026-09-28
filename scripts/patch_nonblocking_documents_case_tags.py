from pathlib import Path
import re

p=Path('admin.html')
s=p.read_text(encoding='utf-8')

# 1) Applications toolbar: add operational case-tag filter.
old_toolbar='<select id="stageFilter" class="compact" onchange="renderApplications()"><option value="">All stages</option></select>'
new_toolbar=old_toolbar+'<select id="caseTagFilter" class="compact" onchange="renderApplications()"><option value="">All case remarks</option><option value="SKY_ACTIVE_LOA_PENDING">SKY activated · LOA pending</option><option value="SKY_ACTIVE_ADMISSION_PENDING">SKY activated · admission pending</option><option value="SKY_ACTIVE_DOCUMENTS_PENDING">SKY activated · documents pending</option><option value="SKY_ACTIVE_SAC_PENDING">SKY activated · SAC pending</option><option value="SKY_ACTIVE_IA_PREREQ_PENDING">SKY activated · IA / prerequisite pending</option><option value="LOA_ISSUED_SKY_PENDING">LOA issued · SKY pending</option><option value="URGENT_MANAGEMENT">Urgent / management instruction</option><option value="BACKDATED_SPECIAL">Backdated / special case</option><option value="FOLLOW_UP_REQUIRED">Follow-up required</option></select>'
if 'id="caseTagFilter"' not in s and old_toolbar in s:
    s=s.replace(old_toolbar,new_toolbar,1)

# 2) Structured case-tag helpers + filter.
anchor='    function filteredApplications(){'
helpers='''    const CASE_TAG_LABELS={
      SKY_ACTIVE_LOA_PENDING:'SKY activated · LOA pending',
      SKY_ACTIVE_ADMISSION_PENDING:'SKY activated · admission pending',
      SKY_ACTIVE_DOCUMENTS_PENDING:'SKY activated · documents pending',
      SKY_ACTIVE_SAC_PENDING:'SKY activated · SAC pending',
      SKY_ACTIVE_IA_PREREQ_PENDING:'SKY activated · IA / prerequisite pending',
      LOA_ISSUED_SKY_PENDING:'LOA issued · SKY pending',
      URGENT_MANAGEMENT:'Urgent / management instruction',
      BACKDATED_SPECIAL:'Backdated / special case',
      FOLLOW_UP_REQUIRED:'Follow-up required'
    };
    function caseTagOfRemark(a){
      const raw=String(a?.['Remark']||a?.['Summary']||a?.['summary']||a?.['Details']||a?.['Message']||'');
      const m=raw.match(/^\\[CASE_TAG:([A-Z0-9_]+)\\]\\s*/i);return m?m[1].toUpperCase():'';
    }
    function cleanRemarkText(a){
      const raw=String(a?.['Remark']||a?.['Summary']||a?.['summary']||a?.['Details']||a?.['Message']||a?.['Note']||a?.['Description']||'');
      return raw.replace(/^\\[CASE_TAG:[A-Z0-9_]+\\]\\s*/i,'');
    }
    function latestCaseTag(r){
      const rows=internalRemarksFor(r).slice().sort((a,b)=>(Date.parse(b?.['Timestamp']||b?.['Created At']||'')||0)-(Date.parse(a?.['Timestamp']||a?.['Created At']||'')||0));
      for(const row of rows){const tag=caseTagOfRemark(row);if(tag)return tag}return '';
    }
'''
if 'const CASE_TAG_LABELS=' not in s and anchor in s:
    s=s.replace(anchor,helpers+anchor,1)

old_filter="function filteredApplications(){const q=document.getElementById('searchInput')?.value.toLowerCase().trim()||'',source=document.getElementById('sourceFilter')?.value||'',intake=document.getElementById('intakeFilter')?.value||'',programme=document.getElementById('programmeFilter')?.value||'',st=document.getElementById('stageFilter')?.value||'';return records.filter(r=>{if(String(r.workflow?.['Application Status']||r.app?.['Application Status']||'').toUpperCase()==='TEST')return false;const hay=[r.ref,r.app['Student Name'],r.app['ID / Passport No'],r.app['Personal Email'],r.app['Programme']].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!source||r.source===source)&&(!intake||r.app['Intake']===intake)&&(!programme||r.app['Programme']===programme)&&(!st||stage(r)===st)})}"
new_filter="function filteredApplications(){const q=document.getElementById('searchInput')?.value.toLowerCase().trim()||'',source=document.getElementById('sourceFilter')?.value||'',intake=document.getElementById('intakeFilter')?.value||'',programme=document.getElementById('programmeFilter')?.value||'',st=document.getElementById('stageFilter')?.value||'',caseTag=document.getElementById('caseTagFilter')?.value||'';return records.filter(r=>{if(String(r.workflow?.['Application Status']||r.app?.['Application Status']||'').toUpperCase()==='TEST')return false;const hay=[r.ref,r.app['Student Name'],r.app['ID / Passport No'],r.app['Personal Email'],r.app['Programme']].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!source||r.source===source)&&(!intake||r.app['Intake']===intake)&&(!programme||r.app['Programme']===programme)&&(!st||stage(r)===st)&&(!caseTag||latestCaseTag(r)===caseTag)})}"
if old_filter in s:
    s=s.replace(old_filter,new_filter,1)

# 3) Remark composer: add structured operational status dropdown.
old_box='<textarea id="internalRemarkText" class="internal-remark-textarea" placeholder="Add a private internal remark for this applicant..."></textarea><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:9px">'
new_box='<select id="internalRemarkTag" class="ops-select" style="width:100%;margin-bottom:9px"><option value="">General remark (no case status)</option><option value="SKY_ACTIVE_LOA_PENDING">SKY activated · LOA pending</option><option value="SKY_ACTIVE_ADMISSION_PENDING">SKY activated · admission pending</option><option value="SKY_ACTIVE_DOCUMENTS_PENDING">SKY activated · documents pending</option><option value="SKY_ACTIVE_SAC_PENDING">SKY activated · SAC pending</option><option value="SKY_ACTIVE_IA_PREREQ_PENDING">SKY activated · IA / prerequisite pending</option><option value="LOA_ISSUED_SKY_PENDING">LOA issued · SKY pending</option><option value="URGENT_MANAGEMENT">Urgent / management instruction</option><option value="BACKDATED_SPECIAL">Backdated / special case</option><option value="FOLLOW_UP_REQUIRED">Follow-up required</option></select><textarea id="internalRemarkText" class="internal-remark-textarea" placeholder="Add a private internal remark for this applicant..."></textarea><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:9px">'
if 'id="internalRemarkTag"' not in s and old_box in s:
    s=s.replace(old_box,new_box,1)

# Save structured tag by prefixing the persisted text; keep readable note body.
s=s.replace("const remark=String(input?.value||'').trim();\n      if(!remark)","const remark=String(input?.value||'').trim();\n      const caseTag=String(document.getElementById('internalRemarkTag')?.value||'').trim();\n      if(!remark&&!caseTag)",1)
s=s.replace("if(!remark){if(statusEl)statusEl.textContent='Enter a remark first.';return}","if(!remark&&!caseTag){if(statusEl)statusEl.textContent='Enter a remark or choose a case status first.';return}",1)
s=s.replace("const now=new Date().toISOString();\n        const payload={","const now=new Date().toISOString();\n        const tagPrefix=caseTag?`[CASE_TAG:${caseTag}] `:'';\n        const storedRemark=tagPrefix+(remark||CASE_TAG_LABELS[caseTag]||caseTag);\n        const payload={",1)
for old,new in [
    ("          remark,\n          note:remark,\n          message:remark,\n          details:remark,\n          summary:remark,\n          data:{remark},","          remark:storedRemark,\n          note:storedRemark,\n          message:storedRemark,\n          details:storedRemark,\n          summary:storedRemark,\n          data:{remark:storedRemark,caseTag},"),
    ("selected.audit.unshift({'Action':'INTERNAL_REMARK','Type':'INTERNAL_REMARK','Remark':remark,'Timestamp':now,'Updated By':'Admin Portal V2'});","selected.audit.unshift({'Action':'INTERNAL_REMARK','Type':'INTERNAL_REMARK','Remark':storedRemark,'Summary':storedRemark,'Case Tag':caseTag,'Timestamp':now,'Updated By':'Admin Portal V2'});")
]:
    if old in s:s=s.replace(old,new,1)

# Show case tag badge and strip technical prefix from visible remark text.
old_audit="const audit=(r.audit||[]).map(a=>{const title=a['Action']||a['Event']||a['Activity']||'Workflow update';const note=a['Remark']||a['Details']||a['Message']||a['Note']||a['Description']||a['Summary']||a['summary']||'';const isRemark=String(title).toUpperCase().includes('INTERNAL_REMARK')||String(a['Type']||'').toUpperCase()==='INTERNAL_REMARK';return `<div class=\"audit-item${isRemark?' internal-remark-item':''}\"><div class=\"t\">${isRemark?'📝 Internal Remark':esc(title)}</div><div class=\"m\">${esc(formatDate(a['Timestamp']||a['Created At']||a['Updated At']||''))} ${esc(a['Updated By']||a['Actor']||a['Agent ID']||'')}</div>${note?`<div style=\"margin-top:6px;line-height:1.5;color:var(--ink)\">${esc(note)}</div>`:''}</div>`}).join('');"
new_audit="const audit=(r.audit||[]).map(a=>{const title=a['Action']||a['Event']||a['Activity']||'Workflow update';const note=cleanRemarkText(a);const tag=caseTagOfRemark(a);const isRemark=String(title).toUpperCase().includes('INTERNAL_REMARK')||String(a['Type']||'').toUpperCase()==='INTERNAL_REMARK';return `<div class=\"audit-item${isRemark?' internal-remark-item':''}\"><div class=\"t\">${isRemark?'📝 Internal Remark':esc(title)}${tag?` <span class=\"badge purple\" style=\"margin-left:6px\">${esc(CASE_TAG_LABELS[tag]||pretty(tag))}</span>`:''}</div><div class=\"m\">${esc(formatDate(a['Timestamp']||a['Created At']||a['Updated At']||''))} ${esc(a['Updated By']||a['Actor']||a['Agent ID']||'')}</div>${note?`<div style=\"margin-top:6px;line-height:1.5;color:var(--ink)\">${esc(note)}</div>`:''}</div>`}).join('');"
if old_audit in s:s=s.replace(old_audit,new_audit,1)

# 4) Manual document review becomes staff-simple: Verified or Missing only, and Missing is follow-up, not a blocker.
s=s.replace("if(f){opts=`<option value=\"PENDING\" ${value==='PENDING'?'selected':''}>Pending review</option><option value=\"VERIFIED\" ${value==='VERIFIED'?'selected':''}>Verified</option><option value=\"NOT_ACCEPTABLE\" ${value==='NOT_ACCEPTABLE'?'selected':''}>Not acceptable</option><option value=\"MISSING\" ${value==='MISSING'?'selected':''}>Missing</option>`}","if(f){opts=`<option value=\"VERIFIED\" ${value==='VERIFIED'?'selected':''}>Verified</option><option value=\"MISSING\" ${value!=='VERIFIED'?'selected':''}>Missing / request again</option>`}",1)
s=s.replace("else if(isIntent){opts=`<option value=\"OUTSTANDING\" ${value==='OUTSTANDING'?'selected':''}>Outstanding - submit later</option><option value=\"MISSING\" ${value==='MISSING'?'selected':''}>Missing / follow up</option>`}","else if(isIntent){opts=`<option value=\"VERIFIED\" ${value==='VERIFIED'?'selected':''}>Verified</option><option value=\"MISSING\" ${value!=='VERIFIED'?'selected':''}>Missing / request again</option>`}",1)
s=s.replace("<div class=\"screening-help\">Verify all available core documents. For PhD applications, Preliminary Research Intent may remain <strong>Outstanding</strong> and be provided later. It is tracked for follow-up and does not block SAC assignment or subsequent admission processing.</div>","<div class=\"screening-help\">Mark each item as <strong>Verified</strong> or <strong>Missing</strong>. Missing items are added to student follow-up reminders but do <strong>not</strong> block screening, SAC, offer or activation.</div>",1)
s=s.replace("function updateManualDocProgress(){const all=[...document.querySelectorAll('.manual-doc-status')],done=all.filter(x=>x.value==='VERIFIED'||(x.dataset.key==='preliminaryResearchIntent'&&x.value==='OUTSTANDING')).length,el=document.getElementById('manualDocProgress');if(el)el.textContent=`${done}/${all.length} resolved`}","function updateManualDocProgress(){const all=[...document.querySelectorAll('.manual-doc-status')],done=all.filter(x=>x.value==='VERIFIED'||x.value==='MISSING').length,missing=all.filter(x=>x.value==='MISSING').length,el=document.getElementById('manualDocProgress');if(el)el.textContent=`${done}/${all.length} reviewed · ${missing} follow-up`}",1)

old_complete="""    function completeManualDocumentReview(){
      if(!selected)return;const controls=[...document.querySelectorAll('.manual-doc-status')];if(!controls.length)return opsMsg('No manual document checklist is available.','error');
      const pending=controls.filter(x=>!x.value||x.value==='PENDING');if(pending.length)return opsMsg('Review every required document before submitting.','error');
      const decisions=controls.map(x=>({key:x.dataset.key,label:x.dataset.label,status:x.value}));const remarks=document.getElementById('manualDocRemarks')?.value||'';
      runAdminAction('v2CompleteManualDocumentReview',{referenceNo:selected.ref,decisions,remarks},`Submit MANUAL document review for ${selected.app['Student Name']||selected.ref}? Documents not marked Verified will keep the case at Document Review.`)
    }"""
new_complete="""    async function completeManualDocumentReview(){
      if(!selected)return;const controls=[...document.querySelectorAll('.manual-doc-status')];if(!controls.length)return opsMsg('No manual document checklist is available.','error');
      const decisions=controls.map(x=>({key:x.dataset.key,label:x.dataset.label,status:x.value==='VERIFIED'?'VERIFIED':'MISSING'}));const remarks=document.getElementById('manualDocRemarks')?.value||'';
      const missing=decisions.filter(x=>x.status==='MISSING');
      const result=await runAdminAction('v2CompleteManualDocumentReview',{referenceNo:selected.ref,decisions,remarks,nonBlocking:true,proceedWithPendingDocuments:true,missingForReminder:missing},`Save document review for ${selected.app['Student Name']||selected.ref}? Missing items will be followed up, but admission processing will continue.`);
      if(!result)return;
      if(missing.length) await runAdminAction('v2RecordAgentActivity',{referenceNo:selected.ref,agentId:'ADMIN_PORTAL',executionId:'DOC-FOLLOWUP-'+Date.now(),action:'DOCUMENT_FOLLOW_UP_NON_BLOCKING',status:'FOLLOW_UP_ONLY',summary:'Missing documents for weekly reminder: '+missing.map(x=>x.label).join(', '),data:{missingDocuments:missing,nonBlocking:true},timestamp:new Date().toISOString(),updatedBy:'Admin Portal V2'});
      await runAdminAction('v2UpdateStage',{referenceNo:selected.ref,stage:'QUALIFICATION_SCREENING',remarks:'Document review completed as non-blocking. Missing items remain on weekly follow-up list.'});
      opsMsg(missing.length?`Review saved. ${missing.length} missing document(s) moved to follow-up; screening may continue.`:'Review saved. All documents verified; screening may continue.','ok');
    }"""
if old_complete in s:s=s.replace(old_complete,new_complete,1)

# 5) SAC assignment never blocks on pending documents.
s=s.replace("runAdminAction('v2AssignSacCandidate',{referenceNo:selected.ref,sessionId},`Assign ${selected.app['Student Name']||selected.ref} to the selected SAC session?`)","runAdminAction('v2AssignSacCandidate',{referenceNo:selected.ref,sessionId,proceedWithPendingDocuments:true,confirmed:true,overrideBy:'Admin Portal V2 - nonblocking document policy'},`Assign ${selected.app['Student Name']||selected.ref} to the selected SAC session? Pending documents remain follow-up only.`)",1)

# Simplify SAC detail add: always nonblocking, audited; no separate human approval just for document status.
pattern=re.compile(r"    async function addSacParticipantFromDetail\(proceedWithPending=false\)\{.*?\n    \}\n    async function smartAddSacParticipant\(\)\{.*?\n    \}\n",re.S)
replacement="""    async function addSacParticipantFromDetail(){
      const referenceNo=document.getElementById('sacAddParticipant')?.value||'';
      if(!referenceNo)return sacDetailMsg('Select an applicant first.','error');
      const result=await runSacPageAction('v2AssignSacCandidate',{referenceNo,sessionId:sacDetailSessionId,proceedWithPendingDocuments:true,confirmed:true,overrideBy:'Admin Portal V2 - nonblocking document policy'},'Add this applicant to the SAC session? Pending documents remain on follow-up and will not block SAC.');
      if(!result)return;sacDetailMsg('Participant added. Pending documents, if any, remain follow-up only.','ok');
    }
    async function smartAddSacParticipant(){return addSacParticipantFromDetail()}
"""
if 'Admin Portal V2 - nonblocking document policy' not in s:
    s,n=pattern.subn(replacement,s,count=1)

p.write_text(s,encoding='utf-8')
print('NONBLOCKING_DOCUMENTS_CASE_TAGS_PATCHED')
