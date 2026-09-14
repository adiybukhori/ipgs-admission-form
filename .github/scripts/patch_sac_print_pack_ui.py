from pathlib import Path

path = Path('admin.html')
text = path.read_text(encoding='utf-8')

# 1) CSS
css_marker = "    .drawer-backdrop{position:fixed;inset:0;background:rgba(18,24,38,.34);z-index:40;display:none}\n"
css_block = """    .sac-pack-modal{position:fixed;inset:0;z-index:80;background:rgba(18,24,38,.48);display:none;align-items:center;justify-content:center;padding:18px}\n    .sac-pack-modal.open{display:flex}\n    .sac-pack-card{width:min(760px,96vw);max-height:90dvh;overflow:auto;background:#fff;border-radius:20px;box-shadow:0 20px 70px rgba(18,24,38,.25);border:1px solid var(--line)}\n    .sac-pack-head{position:sticky;top:0;z-index:2;background:#fff;border-bottom:1px solid var(--line);padding:16px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:12px}\n    .sac-pack-head h3{margin:0;font-size:17px}.sac-pack-head p{margin:4px 0 0;color:var(--muted);font-size:11px}\n    .sac-pack-body{padding:16px 18px}.sac-pack-summary{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}\n    .sac-pack-candidates{display:grid;gap:10px}.sac-pack-candidate{border:1px solid var(--line);border-radius:13px;padding:12px;background:#fff}\n    .sac-pack-candidate-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.sac-pack-candidate-name{font-size:12px;font-weight:850}.sac-pack-candidate-meta{font-size:10px;color:var(--muted);margin-top:3px}\n    .sac-pack-missing{font-size:10px;color:var(--red);margin-top:8px;line-height:1.45}.sac-pack-choice{display:flex;flex-wrap:wrap;gap:12px;margin-top:9px;font-size:10px}.sac-pack-choice label{display:flex;align-items:center;gap:5px;font-weight:750}\n    .sac-pack-footer{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);padding:13px 18px;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}\n"""
if 'sac-pack-modal' not in text:
    if css_marker not in text:
        raise SystemExit('CSS marker not found')
    text = text.replace(css_marker, css_block + css_marker, 1)

# 2) Modal HTML
html_marker = '  <div id="drawerBackdrop" class="drawer-backdrop" onclick="closeDrawer()"></div>\n'
modal = """  <div id=\"sacPackModal\" class=\"sac-pack-modal\" onclick=\"if(event.target===this)closeSacPackModal()\">\n    <div class=\"sac-pack-card\">\n      <div class=\"sac-pack-head\"><div><h3 id=\"sacPackTitle\">SAC Print Pack</h3><p id=\"sacPackSubtitle\">Prepare physical SAC documents.</p></div><button class=\"ghost\" onclick=\"closeSacPackModal()\">Close</button></div>\n      <div class=\"sac-pack-body\"><div id=\"sacPackSummary\" class=\"sac-pack-summary\"></div><div id=\"sacPackCandidates\" class=\"sac-pack-candidates\"></div><div id=\"sacPackMessage\" class=\"message\" style=\"display:none\"></div></div>\n      <div class=\"sac-pack-footer\"><button class=\"ghost\" onclick=\"closeSacPackModal()\">Cancel</button><button id=\"sacPackGenerateBtn\" class=\"primary\" onclick=\"generateSacPack()\">Generate & Print SAC Pack</button></div>\n    </div>\n  </div>\n\n"""
if 'id="sacPackModal"' not in text:
    if html_marker not in text:
        raise SystemExit('Modal HTML marker not found')
    text = text.replace(html_marker, modal + html_marker, 1)

# 3) constants/state
api_marker = "    const ACTION_API = '/api/admin-action';\n"
if "const SAC_PACK_API = '/api/sac-pack';" not in text:
    if api_marker not in text:
        raise SystemExit('ACTION_API marker not found')
    text = text.replace(api_marker, api_marker + "    const SAC_PACK_API = '/api/sac-pack';\n", 1)

state_marker = "    let db = {}, records = [], selected = null;\n"
if 'sacPackState' not in text:
    if state_marker not in text:
        raise SystemExit('state marker not found')
    text = text.replace(state_marker, "    let db = {}, records = [], selected = null, sacPackState = null;\n", 1)

# 4) renderSac calculations/action
old = """        const isFinal=/FINAL|CLOSED/.test(status);\n        const inviteAction=!isFinal&&cal!=='INVITED'?`<button class=\"ghost\" onclick=\"sendSacInvite('${esc(id)}')\">Send Invite</button>`:'';\n        const finalizeAction=!isFinal&&n>0&&pending===0?`<button class=\"primary\" onclick=\"finalizeSacSession('${esc(id)}')\">Finalize & Generate</button>`:(isFinal?'<a class=\"ghost\" href=\"/sac-results.html\">Review & Send Results</a>':pending?`<span class=\"badge amber\">${pending} pending</span>`:'<span class=\"badge blue\">Assign candidates</span>');\n        const documents=min||end?`${min?`<a class=\"link\" target=\"_blank\" href=\"${esc(min)}\">Minutes</a>`:''}${min&&end?' · ':''}${end?`<a class=\"link\" target=\"_blank\" href=\"${esc(end)}\">Endorsement</a>`:''}`:'-';\n        return {s,id,n,pending,mode,cal,inviteMode,status,inviteAction,finalizeAction,documents};\n"""
new = """        const isFinal=/FINAL|CLOSED/.test(status);\n        const packComplete=sessionCandidates.filter(c=>String(c['Document Pack Status']||'').toUpperCase()==='COMPLETE').length;\n        const packIncomplete=sessionCandidates.filter(c=>String(c['Document Pack Status']||'').toUpperCase()==='INCOMPLETE').length;\n        const packPrepared=packComplete+packIncomplete>0;\n        const packMeta=packPrepared?`${packComplete} complete · ${packIncomplete} incomplete`:'Not prepared';\n        const inviteAction=!isFinal&&cal!=='INVITED'?`<button class=\"ghost\" onclick=\"sendSacInvite('${esc(id)}')\">Send Invite</button>`:'';\n        const packAction=n>0?(PHASE2_BACKEND_READY?`<button class=\"ghost\" onclick=\"prepareSacPack('${esc(id)}')\">Generate & Print SAC Pack</button>`:'<button class=\"ghost\" disabled>SAC Pack · backend sync pending</button>'):'';\n        const finalizeAction=!isFinal&&n>0&&pending===0?`<button class=\"primary\" onclick=\"finalizeSacSession('${esc(id)}')\">Finalize & Generate</button>`:(isFinal?'<a class=\"ghost\" href=\"/sac-results.html\">Review & Send Results</a>':pending?`<span class=\"badge amber\">${pending} pending</span>`:'<span class=\"badge blue\">Assign candidates</span>');\n        const documents=min||end?`${min?`<a class=\"link\" target=\"_blank\" href=\"${esc(min)}\">Minutes</a>`:''}${min&&end?' · ':''}${end?`<a class=\"link\" target=\"_blank\" href=\"${esc(end)}\">Endorsement</a>`:''}`:'-';\n        return {s,id,n,pending,mode,cal,inviteMode,status,inviteAction,packAction,packMeta,finalizeAction,documents};\n"""
if 'packAction=n>0?' not in text:
    if old not in text:
        raise SystemExit('renderSac action block target not found')
    text = text.replace(old, new, 1)

old_table = '<td>${v.documents}</td><td>${v.finalizeAction}</td>'
new_table = '<td>${v.documents}<div class="subline">Print pack: ${esc(v.packMeta)}</div></td><td><div style="display:flex;gap:7px;flex-wrap:wrap">${v.packAction}${v.finalizeAction}</div></td>'
if new_table not in text:
    if old_table not in text:
        raise SystemExit('SAC table action cell target not found')
    text = text.replace(old_table, new_table, 1)

old_mobile = '<div class="sac-mobile-actions">${v.inviteAction}${v.finalizeAction}</div>'
new_mobile = '<div class="sac-mobile-actions">${v.inviteAction}${v.packAction}${v.finalizeAction}</div>'
if new_mobile not in text:
    if old_mobile not in text:
        raise SystemExit('SAC mobile action target not found')
    text = text.replace(old_mobile, new_mobile, 1)

# 5) JS functions for pack preparation and printing
function_marker = """    function recordAssessmentResult(panelResult){if(!selected)return;runAdminAction('v2UpdateAssessment',{referenceNo:selected.ref,assessmentType:'INTERNAL_ASSESSMENT',sequence:1,component:'OVERALL',status:'COMPLETED',panelResult},`Confirm IA panel result: ${pretty(panelResult)}?`)}\n"""
functions = r'''    async function prepareSacPack(sessionId){
      if(!PHASE2_BACKEND_READY)return sacPageMsg('SAC Pack backend is waiting for Apps Script sync. The UI is ready, but printing remains safety-gated until deployment tests pass.','info');
      const result=await runSacPageAction('v2PrepareSacPack',{sessionId},null);
      if(!result)return;
      sacPackState=result;
      const modal=document.getElementById('sacPackModal'),title=document.getElementById('sacPackTitle'),sub=document.getElementById('sacPackSubtitle'),summary=document.getElementById('sacPackSummary'),list=document.getElementById('sacPackCandidates'),msg=document.getElementById('sacPackMessage');
      title.textContent=result.sessionName||result.sessionId||'SAC Print Pack';
      sub.textContent=`${result.candidateCount||0} candidate(s) · PG-ADM-01 is the first document for each candidate and acts as the separator.`;
      summary.innerHTML=`<span class="badge purple">${result.candidateCount||0} candidates</span><span class="badge green">${result.completeCount||0} complete</span><span class="badge ${result.incompleteCount?'amber':'green'}">${result.incompleteCount||0} incomplete</span>`;
      const candidates=Array.isArray(result.candidates)?result.candidates:[];
      list.innerHTML=candidates.map(c=>{
        const missing=Array.isArray(c.missingDocuments)?c.missingDocuments:[];
        const missingText=missing.map(x=>x.label||x.key||x).filter(Boolean).join(', ');
        const ref=String(c.referenceNo||'');
        const status=c.complete?'<span class="badge green">Complete · Included</span>':'<span class="badge amber">Missing file(s)</span>';
        const choice=c.complete?'':`<div class="sac-pack-choice"><label><input type="radio" name="sacPackChoice_${esc(ref)}" value="PROCEED"> Proceed with available documents</label><label><input type="radio" name="sacPackChoice_${esc(ref)}" value="SKIP" checked> Skip this candidate</label></div>`;
        return `<div class="sac-pack-candidate" data-reference="${esc(ref)}" data-complete="${c.complete?'YES':'NO'}"><div class="sac-pack-candidate-head"><div><div class="sac-pack-candidate-name">${esc(c.studentName||ref)}</div><div class="sac-pack-candidate-meta">${esc(c.programme||'-')} · ${esc(ref)} · ${c.documentCount||0} document(s)</div></div>${status}</div>${c.complete?'':`<div class="sac-pack-missing">Missing: ${esc(missingText||'Required document')}</div>${choice}`}</div>`;
      }).join('')||'<div class="empty">No candidates assigned to this session.</div>';
      if(msg){msg.style.display='none';msg.textContent=''}
      if(modal)modal.classList.add('open');
    }
    function closeSacPackModal(){const modal=document.getElementById('sacPackModal');if(modal)modal.classList.remove('open')}
    function sacPackModalMsg(text,type='info'){const el=document.getElementById('sacPackMessage');if(!el)return;el.style.display='block';el.className='message '+(type==='error'?'error':'');el.style.background=type==='ok'?'var(--greenSoft)':type==='error'?'var(--redSoft)':'var(--blueSoft)';el.style.color=type==='ok'?'var(--green)':type==='error'?'var(--red)':'var(--blue)';el.textContent=text}
    async function generateSacPack(){
      if(!sacPackState)return sacPackModalMsg('Prepare the SAC pack first.','error');
      const candidates=Array.isArray(sacPackState.candidates)?sacPackState.candidates:[];
      const choices=candidates.filter(c=>!c.complete).map(c=>{const ref=String(c.referenceNo||''),checked=document.querySelector(`input[name="sacPackChoice_${CSS.escape(ref)}"]:checked`);return{referenceNo:ref,action:checked?checked.value:'SKIP'}});
      const selectedCount=candidates.filter(c=>c.complete).length+choices.filter(x=>x.action==='PROCEED').length;
      if(!selectedCount)return sacPackModalMsg('No candidates selected for printing. Choose Proceed for at least one incomplete candidate or include a complete candidate.','error');
      const btn=document.getElementById('sacPackGenerateBtn');if(btn){btn.disabled=true;btn.textContent='Generating merged PDF…'}
      sacPackModalMsg(`Preparing one merged PDF for ${selectedCount} candidate(s)…`,'info');
      try{
        const res=await fetch(SAC_PACK_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,sessionId:sacPackState.sessionId,choices})});
        if(!res.ok){const err=await res.json().catch(()=>({message:'Unable to generate SAC pack.'}));throw new Error(err.message||'Unable to generate SAC pack.')}
        const blob=await res.blob(),url=URL.createObjectURL(blob);let w=null;try{w=window.open(url,'_blank')}catch(_){}
        if(!w){const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.click()}
        sacPackModalMsg('Merged SAC Pack generated. The PDF has opened for printing.','ok');
        setTimeout(()=>{try{if(w&&!w.closed){w.focus();w.print()}}catch(_){}},1400);
        setTimeout(()=>URL.revokeObjectURL(url),120000);
      }catch(e){sacPackModalMsg(e.message||'Unable to generate SAC pack.','error')}
      finally{if(btn){btn.disabled=false;btn.textContent='Generate & Print SAC Pack'}}
    }
'''
if 'async function prepareSacPack(sessionId)' not in text:
    if function_marker not in text:
        raise SystemExit('Function insertion marker not found')
    text = text.replace(function_marker, functions + function_marker, 1)

path.write_text(text, encoding='utf-8')
print('SAC print pack UI added. Backend-dependent controls remain gated by PHASE2_BACKEND_READY.')
