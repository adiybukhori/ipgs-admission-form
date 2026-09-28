from pathlib import Path

p = Path('admin.html')
s = p.read_text(encoding='utf-8')

old = """        const packIncomplete=sessionCandidates.filter(c=>String(c['Document Pack Status']||'').toUpperCase()==='INCOMPLETE').length;
        const packPrepared=packComplete+packIncomplete>0;
        const packMeta=packPrepared?`${packComplete} complete · ${packIncomplete} incomplete`:'Not prepared';
        const inviteAction=!isFinal&&cal!=='INVITED'?`<button class=\"ghost\" onclick=\"sendSacInvite('${esc(id)}')\">Send Invite</button>`:'';
        const detailAction=`<button class=\"primary\" onclick=\"openSacSessionDetail('${esc(id)}')\">Open SAC</button>`;
        const packAction=n>0?(PHASE2_BACKEND_READY?`<button class=\"ghost\" onclick=\"prepareSacPack('${esc(id)}')\">Generate & Print SAC Pack</button>`:'<button class=\"ghost\" disabled>SAC Pack · backend sync pending</button>'):'';"""
new = """        const packIncomplete=sessionCandidates.filter(c=>String(c['Document Pack Status']||'').toUpperCase()==='INCOMPLETE').length;
        const packPrepared=packComplete+packIncomplete>0;
        const sacPackUrl=String(s['SAC Pack URL']||'').trim();
        const sacFolderUrl=String(s['SAC Folder URL']||'').trim();
        const sacPackGeneratedAt=String(s['SAC Pack Generated At']||'').trim();
        const packMeta=sacPackUrl?`Generated${sacPackGeneratedAt?' · '+formatDate(sacPackGeneratedAt):''}`:(packPrepared?`${packComplete} complete · ${packIncomplete} incomplete`:'Not prepared');
        const inviteAction=!isFinal&&cal!=='INVITED'?`<button class=\"ghost\" onclick=\"sendSacInvite('${esc(id)}')\">Send Invite</button>`:'';
        const detailAction=`<button class=\"primary\" onclick=\"openSacSessionDetail('${esc(id)}')\">Open SAC</button>`;
        const packAction=n>0?(sacPackUrl?`<a class=\"ghost\" target=\"_blank\" rel=\"noopener\" href=\"${esc(sacPackUrl)}\">Open SAC Pack</a>${sacFolderUrl?`<a class=\"ghost\" target=\"_blank\" rel=\"noopener\" href=\"${esc(sacFolderUrl)}\">Open SAC Folder</a>`:''}`:(PHASE2_BACKEND_READY?`<button class=\"ghost\" onclick=\"prepareSacPack('${esc(id)}')\">Generate SAC Pack</button>`:'<button class=\"ghost\" disabled>SAC Pack · backend sync pending</button>')):'';"""
if old not in s:
    raise SystemExit('session row anchor not found')
s = s.replace(old, new, 1)

old2 = """        <section class=\"sac-session-section\"><h4>5. SAC Print Pack</h4><div class=\"hint\">Generate one merged PDF in the approved order: PG-ADM-01 → AI Screening Report → Admission Form → supporting documents.</div><div class=\"sac-workspace-actions\"><button class=\"primary\" type=\"button\" onclick=\"prepareSacPack('${esc(sacDetailSessionId)}')\" ${candidates.length&&PHASE2_BACKEND_READY?'':'disabled'}>Generate & Print SAC Pack</button><span class=\"badge ${candidates.length?'blue':'amber'}\">${candidates.length} candidate${candidates.length===1?'':'s'}</span></div></section>"""
new2 = """        <section class=\"sac-session-section\"><h4>5. SAC Print Pack</h4><div class=\"hint\">Generate one merged PDF in the approved order: PG-ADM-01 → AI Screening Report → Admission Form → supporting documents.</div><div class=\"sac-workspace-actions\">${String(session['SAC Pack URL']||'').trim()?`<a class=\"primary\" target=\"_blank\" rel=\"noopener\" href=\"${esc(session['SAC Pack URL'])}\">Open SAC Pack</a>${String(session['SAC Folder URL']||'').trim()?`<a class=\"ghost\" target=\"_blank\" rel=\"noopener\" href=\"${esc(session['SAC Folder URL'])}\">Open SAC Folder</a>`:''}<span class=\"badge green\">Generated</span>`:`<button class=\"primary\" type=\"button\" onclick=\"prepareSacPack('${esc(sacDetailSessionId)}')\" ${candidates.length&&PHASE2_BACKEND_READY?'':'disabled'}>Generate SAC Pack</button><span class=\"badge ${candidates.length?'blue':'amber'}\">${candidates.length} candidate${candidates.length===1?'':'s'}</span>`}</div></section>"""
if old2 not in s:
    raise SystemExit('session detail anchor not found')
s = s.replace(old2, new2, 1)

old3 = "function sacPackModalMsg(text,type='info'){const el=document.getElementById('sacPackMessage');if(!el)return;el.style.display='block';el.className='message '+(type==='error'?'error':'');el.style.background=type==='ok'?'var(--greenSoft)':type==='error'?'var(--redSoft)':'var(--blueSoft)';el.style.color=type==='ok'?'var(--green)':type==='error'?'var(--red)':'var(--blue)';el.textContent=text}"
new3 = "function sacPackModalMsg(text,type='info',allowHtml=false){const el=document.getElementById('sacPackMessage');if(!el)return;el.style.display='block';el.className='message '+(type==='error'?'error':'');el.style.background=type==='ok'?'var(--greenSoft)':type==='error'?'var(--redSoft)':'var(--blueSoft)';el.style.color=type==='ok'?'var(--green)':type==='error'?'var(--red)':'var(--blue)';if(allowHtml)el.innerHTML=text;else el.textContent=text}"
if old3 not in s:
    raise SystemExit('modal message anchor not found')
s = s.replace(old3, new3, 1)

old4 = """        const links=[packUrl?`<a class=\"link\" target=\"_blank\" href=\"${esc(packUrl)}\">Open saved SAC Pack</a>`:'',folderUrl?`<a class=\"link\" target=\"_blank\" href=\"${esc(folderUrl)}\">Open SAC Folder</a>`:''].filter(Boolean).join(' · ');
        sacPackModalMsg(`Merged SAC Pack generated and saved to Drive.${links?' '+links:''}`,'ok');
        setTimeout(()=>{try{if(w&&!w.closed){w.focus();w.print()}}catch(_){}},1400);
        setTimeout(()=>URL.revokeObjectURL(url),120000);
      }catch(e){if(progressTimer){clearInterval(progressTimer);progressTimer=null} sacPackModalMsg(e.message||'Unable to generate SAC pack.','error')}
      finally{if(btn){btn.disabled=false;btn.textContent='Generate & Print SAC Pack'}}"""
new4 = """        const links=[packUrl?`<a class=\"ghost\" target=\"_blank\" rel=\"noopener\" href=\"${esc(packUrl)}\">Open SAC Pack</a>`:'',folderUrl?`<a class=\"ghost\" target=\"_blank\" rel=\"noopener\" href=\"${esc(folderUrl)}\">Open SAC Folder</a>`:''].filter(Boolean).join(' ');
        sacPackModalMsg(`<div style=\"display:flex;align-items:center;gap:8px;flex-wrap:wrap\"><strong>SAC Pack generated and saved.</strong>${links}</div>`,'ok',true);
        const currentSession=(db.V2_SAC_SESSIONS||[]).find(x=>String(x['SAC Session ID']||'').trim()===String(sacPackState.sessionId||'').trim());
        if(currentSession){if(packUrl)currentSession['SAC Pack URL']=packUrl;if(folderUrl)currentSession['SAC Folder URL']=folderUrl;currentSession['SAC Pack Generated At']=new Date().toISOString();}
        renderSac();if(sacDetailSessionId===sacPackState.sessionId)renderSacSessionDetail();
        if(btn&&packUrl){btn.disabled=false;btn.textContent='Open SAC Pack';btn.onclick=()=>window.open(packUrl,'_blank');}
        setTimeout(()=>URL.revokeObjectURL(url),120000);
      }catch(e){if(progressTimer){clearInterval(progressTimer);progressTimer=null} sacPackModalMsg(e.message||'Unable to generate SAC pack.','error')}
      finally{if(btn&&btn.textContent!=='Open SAC Pack'){btn.disabled=false;btn.textContent='Generate SAC Pack';btn.onclick=generateSacPack}}"""
if old4 not in s:
    raise SystemExit('generation success anchor not found')
s = s.replace(old4, new4, 1)

p.write_text(s, encoding='utf-8')
print('SAC_PACK_OPEN_ACTIONS_PATCHED')
# trigger 2026-09-28
