from pathlib import Path

# Protected admin action allowlist
api = Path('api/admin-action.js')
s = api.read_text(encoding='utf-8')
if "'v2UpdateSacSessionManual'" not in s:
    old = "'v2CreateSacSessionManual','v2SendSacCalendarInvitationManual'"
    new = "'v2CreateSacSessionManual','v2UpdateSacSessionManual','v2SendSacCalendarInvitationManual'"
    if old not in s:
        raise SystemExit('admin-action SAC allowlist anchor not found')
    s = s.replace(old, new, 1)
    api.write_text(s, encoding='utf-8')

p = Path('admin.html')
s = p.read_text(encoding='utf-8')

# Session workspace styling
if '.sac-session-modal{' not in s:
    anchor = '    .sac-pack-modal{'
    if anchor not in s:
        raise SystemExit('SAC pack CSS anchor not found')
    css = r'''    .sac-session-modal{position:fixed;inset:0;z-index:78;background:rgba(18,24,38,.48);display:none;align-items:center;justify-content:center;padding:18px}
    .sac-session-modal.open{display:flex}
    .sac-session-card{width:min(980px,97vw);max-height:92dvh;overflow:auto;background:#fff;border-radius:20px;box-shadow:0 20px 70px rgba(18,24,38,.25);border:1px solid var(--line)}
    .sac-session-head{position:sticky;top:0;z-index:3;background:#fff;border-bottom:1px solid var(--line);padding:16px 18px;display:flex;justify-content:space-between;gap:14px;align-items:flex-start}
    .sac-session-head h3{margin:0;font-size:18px}.sac-session-head p{margin:4px 0 0;color:var(--muted);font-size:11px}
    .sac-session-body{padding:18px;display:grid;gap:14px}.sac-session-section{border:1px solid var(--line);border-radius:15px;padding:14px;background:#fff}
    .sac-session-section h4{margin:0 0 10px;font-size:13px}.sac-session-section .hint{font-size:10px;color:var(--muted);margin-top:-5px;margin-bottom:10px;line-height:1.45}
    .sac-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sac-detail-grid .full{grid-column:1/-1}
    .sac-panel-list,.sac-participant-list{display:grid;gap:8px}.sac-panel-item,.sac-participant-item{border:1px solid #eef0f4;border-radius:11px;padding:10px 11px;display:flex;justify-content:space-between;gap:12px;align-items:center;background:#fafbfc}
    .sac-panel-item .name,.sac-participant-item .name{font-size:11px;font-weight:850}.sac-panel-item .meta,.sac-participant-item .meta{font-size:10px;color:var(--muted);margin-top:2px;line-height:1.4}
    .sac-workspace-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.sac-workspace-actions select{min-width:260px;max-width:100%}
    .sac-session-footer{position:sticky;bottom:0;background:#fff;border-top:1px solid var(--line);padding:13px 18px;display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}
    @media(max-width:720px){.sac-detail-grid{grid-template-columns:1fr}.sac-detail-grid .full{grid-column:auto}.sac-session-modal{padding:0}.sac-session-card{width:100vw;max-height:100dvh;border-radius:0}}
'''
    s = s.replace(anchor, css + anchor, 1)

# Workspace modal
if 'id="sacSessionModal"' not in s:
    anchor = '  <div id="sacPackModal"'
    if anchor not in s:
        raise SystemExit('SAC pack modal anchor not found')
    modal = r'''  <div id="sacSessionModal" class="sac-session-modal" onclick="if(event.target===this)closeSacSessionDetail()">
    <div class="sac-session-card">
      <div class="sac-session-head">
        <div><h3 id="sacSessionTitle">SAC Session</h3><p id="sacSessionSubtitle">Session workspace</p></div>
        <button class="ghost" type="button" onclick="closeSacSessionDetail()">Close</button>
      </div>
      <div id="sacSessionBody" class="sac-session-body"></div>
      <div class="sac-session-footer"><button class="ghost" type="button" onclick="closeSacSessionDetail()">Close</button></div>
    </div>
  </div>

'''
    s = s.replace(anchor, modal + anchor, 1)

# Creating a SAC does not auto-invite. Staff explicitly sends invitation after checking panel.
s = s.replace('committeeEmails,sendInvitation:true}', 'committeeEmails,sendInvitation:false}')

# Add Open SAC action while preserving the existing row actions.
if 'const detailAction=`<button class="primary" onclick="openSacSessionDetail' not in s:
    old = "        const inviteAction=!isFinal&&cal!=='INVITED'?`<button class=\"ghost\" onclick=\"sendSacInvite('${esc(id)}')\">Send Invite</button>`:'';"
    new = old + "\n        const detailAction=`<button class=\"primary\" onclick=\"openSacSessionDetail('${esc(id)}')\">Open SAC</button>`;"
    if old not in s:
        raise SystemExit('SAC invite action anchor not found')
    s = s.replace(old, new, 1)

    old = 'return {s,id,n,pending,mode,cal,inviteMode,status,inviteAction,packAction,packMeta,finalizeAction,documents};'
    new = 'return {s,id,n,pending,mode,cal,inviteMode,status,detailAction,inviteAction,packAction,packMeta,finalizeAction,documents};'
    if old not in s:
        raise SystemExit('SAC view return anchor not found')
    s = s.replace(old, new, 1)

    old = '${v.packAction}${v.finalizeAction}</div></td></tr>`).join(\'\')'
    new = '${v.detailAction}${v.packAction}${v.finalizeAction}</div></td></tr>`).join(\'\')'
    if old not in s:
        raise SystemExit('SAC desktop actions anchor not found')
    s = s.replace(old, new, 1)

    old = '<div class="sac-mobile-actions">${v.inviteAction}${v.packAction}${v.finalizeAction}</div>'
    new = '<div class="sac-mobile-actions">${v.detailAction}${v.inviteAction}${v.packAction}${v.finalizeAction}</div>'
    if old not in s:
        raise SystemExit('SAC mobile actions anchor not found')
    s = s.replace(old, new, 1)

# Full SAC session workspace logic
if 'function openSacSessionDetail(sessionId)' not in s:
    anchor = '    function renderAssessment(){'
    if anchor not in s:
        raise SystemExit('renderAssessment anchor not found')
    js = r'''    let sacDetailSessionId='';
    function sacDetailCandidates(sessionId){
      const id=String(sessionId||'');
      return (db.V2_SAC_CANDIDATES||[]).filter(c=>String(c['SAC Session ID']||c['Session ID']||'')===id);
    }
    function sacDetailPanel(session){
      const emails=String(session?.['Committee Emails']||'').split(/[;,\n]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);
      const master=db.SAC_COMMITTEE_MASTER||[];
      return emails.map(email=>{
        const m=master.find(x=>String(x['Email']||'').trim().toLowerCase()===email)||{};
        return {email,name:m['Name']||email,role:m['Role']||'Panel Member',active:String(m['Active']||'YES').toUpperCase()!=='NO'};
      });
    }
    function sacDetailMsg(text,type='info'){
      const el=document.getElementById('sacSessionMessage');if(!el)return;
      el.style.display='block';el.className='message'+(type==='error'?' error':'');
      el.style.background=type==='ok'?'var(--greenSoft)':type==='error'?'var(--redSoft)':'var(--blueSoft)';
      el.style.color=type==='ok'?'var(--green)':type==='error'?'var(--red)':'var(--blue)';
      el.textContent=text;
    }
    function openSacSessionDetail(sessionId){
      sacDetailSessionId=String(sessionId||'');
      renderSacSessionDetail();
      document.getElementById('sacSessionModal')?.classList.add('open');
    }
    function closeSacSessionDetail(){
      document.getElementById('sacSessionModal')?.classList.remove('open');
      sacDetailSessionId='';
    }
    function renderSacSessionDetail(){
      const session=(db.V2_SAC_SESSIONS||[]).find(x=>String(x['SAC Session ID']||x['Session ID']||'')===sacDetailSessionId);
      if(!session)return;
      const candidates=sacDetailCandidates(sacDetailSessionId);
      const panel=sacDetailPanel(session);
      const status=String(session['Status']||'DRAFT').toUpperCase();
      const cal=String(session['Calendar Status']||'NOT_CREATED').toUpperCase();
      const inviteMode=String(session['Invitation Mode']||'DISABLED').toUpperCase();
      const isFinal=status==='FINALISED'||!!session['Finalised At'];
      const pending=candidates.filter(c=>!String(c['Decision']||'').trim()||String(c['Decision']||'').toUpperCase()==='PENDING').length;
      const eligible=records.filter(r=>r.source==='V2'&&stage(r)==='READY_FOR_SAC').filter(r=>!candidates.some(c=>String(c['Reference No']||'')===r.ref));

      document.getElementById('sacSessionTitle').textContent=session['SAC Name']||sacDetailSessionId;
      document.getElementById('sacSessionSubtitle').textContent=`${sacDetailSessionId} · ${pretty(status)} · Manual physical SAC`;

      const panelHtml=panel.length?panel.map(m=>`<div class="sac-panel-item"><div><div class="name">${esc(m.name)}</div><div class="meta">${esc(m.role)} · ${esc(m.email)}</div></div><span class="badge ${m.active?'green':'amber'}">${m.active?'Active':'Inactive'}</span></div>`).join(''):'<div class="empty" style="padding:16px!important">No panel members configured yet.</div>';
      const participantHtml=candidates.length?candidates.map(c=>{const ref=c['Reference No']||'',decision=c['Decision']||'PENDING';return`<div class="sac-participant-item"><div><div class="name">${esc(c['Student Name']||ref)}</div><div class="meta">${esc(c['Programme']||'')} · ${esc(ref)}</div></div><div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap"><span class="badge ${classifyBadge(decision)}">${esc(pretty(decision))}</span><button class="ghost" type="button" onclick="closeSacSessionDetail();openRecord('${esc(ref)}')">Open Applicant</button></div></div>`}).join(''):'<div class="empty" style="padding:16px!important">No candidates assigned yet.</div>';
      const eligibleOptions=eligible.map(r=>`<option value="${esc(r.ref)}">${esc(r.app['Student Name']||r.ref)} · ${esc(r.app['Programme']||'')}</option>`).join('');

      document.getElementById('sacSessionBody').innerHTML=`
        <div id="sacSessionMessage" class="message" style="display:none"></div>
        <section class="sac-session-section"><h4>1. SAC Details</h4><div class="sac-detail-grid">
          <div class="field"><label>SAC Name</label><input id="sacDetailName" value="${esc(session['SAC Name']||'')}" ${isFinal?'disabled':''}></div>
          <div class="field"><label>Status</label><input value="${esc(pretty(status))}" disabled></div>
          <div class="field"><label>Meeting Date</label><input id="sacDetailDate" type="date" value="${esc(String(session['Meeting Date']||'').slice(0,10))}" ${isFinal?'disabled':''}></div>
          <div class="field"><label>Meeting Time</label><input id="sacDetailTime" type="time" value="${esc(session['Meeting Time']||'10:00')}" ${isFinal?'disabled':''}></div>
          <div class="field"><label>Chairperson</label><input id="sacDetailChair" value="${esc(session['Chairperson']||'')}" ${isFinal?'disabled':''}></div>
          <div class="field"><label>Venue / Meeting Link</label><input id="sacDetailVenue" value="${esc(session['Venue / Meeting Link']||'')}" ${isFinal?'disabled':''}></div>
        </div>${!isFinal?'<div style="margin-top:10px"><button class="ghost" type="button" onclick="saveSacSessionDetails()">Save SAC Details</button></div>':''}</section>

        <section class="sac-session-section"><h4>2. Panel / Committee</h4><div class="hint">Panel names and roles are matched against SAC_COMMITTEE_MASTER. Update the panel list before sending invitation.</div><div class="sac-panel-list">${panelHtml}</div>${!isFinal?`<div class="field" style="margin-top:10px"><label>Panel / Committee Emails</label><textarea id="sacDetailCommittee" rows="3" style="width:100%;border:1px solid #d7dce6;border-radius:12px;padding:12px 13px;resize:vertical">${esc(session['Committee Emails']||'')}</textarea></div><button class="ghost" type="button" onclick="saveSacSessionPanel()">Save Panel</button>`:''}</section>

        <section class="sac-session-section"><h4>3. Participants</h4><div class="hint">Candidate count is derived from the actual V2_SAC_CANDIDATES records for this session.</div><div class="sac-participant-list">${participantHtml}</div>${!isFinal?`<div class="sac-workspace-actions" style="margin-top:10px"><select id="sacAddParticipant" class="compact"><option value="">Select Ready for SAC applicant</option>${eligibleOptions}</select><button class="primary" type="button" onclick="addSacParticipantFromDetail()" ${eligibleOptions?'':'disabled'}>+ Add Participant</button></div>`:''}</section>

        <section class="sac-session-section"><h4>4. Invitation</h4><div class="sac-detail-grid"><div><span class="badge ${cal==='INVITED'?'green':'amber'}">${esc(pretty(cal))}</span><div class="subline">Invitation mode: ${esc(pretty(inviteMode))}</div></div><div class="subline">Sent at: ${esc(formatDate(session['Invitation Sent At']||'')||'-')}</div></div><div class="sac-workspace-actions" style="margin-top:10px"><button class="ghost" type="button" onclick="sendSacInviteFromDetail()" ${cal==='INVITED'||isFinal?'disabled':''}>Send SAC Invitation</button>${inviteMode==='DISABLED'?'<span class="badge amber">Invite engine currently DISABLED</span>':''}</div></section>

        <section class="sac-session-section"><h4>5. SAC Print Pack</h4><div class="hint">Generate one merged PDF in the approved order: PG-ADM-01 → AI Screening Report → Admission Form → supporting documents.</div><div class="sac-workspace-actions"><button class="primary" type="button" onclick="prepareSacPack('${esc(sacDetailSessionId)}')" ${candidates.length&&PHASE2_BACKEND_READY?'':'disabled'}>Generate & Print SAC Pack</button><span class="badge ${candidates.length?'blue':'amber'}">${candidates.length} candidate${candidates.length===1?'':'s'}</span></div></section>

        <section class="sac-session-section"><h4>6. Decision / Finalisation</h4><div class="hint">Open each applicant to record the SAC decision. Finalise the session only when all participant decisions are complete.</div><div class="sac-workspace-actions"><span class="badge ${pending?'amber':'green'}">${pending} pending decision${pending===1?'':'s'}</span>${!isFinal&&candidates.length&&pending===0?`<button class="primary" type="button" onclick="finalizeSacSession('${esc(sacDetailSessionId)}')">Finalize SAC Session</button>`:''}${isFinal?'<span class="badge green">Finalised</span>':''}</div></section>`;
    }
    async function saveSacSessionDetails(){
      const data={sessionId:sacDetailSessionId,name:document.getElementById('sacDetailName')?.value.trim()||'',meetingDate:document.getElementById('sacDetailDate')?.value||'',meetingTime:document.getElementById('sacDetailTime')?.value||'10:00',chairperson:document.getElementById('sacDetailChair')?.value.trim()||'',venueLink:document.getElementById('sacDetailVenue')?.value.trim()||''};
      const result=await runSacPageAction('v2UpdateSacSessionManual',data,'Save changes to this SAC session?');
      if(!result)return;sacDetailMsg('SAC details saved. Refreshing…','ok');setTimeout(()=>location.reload(),450);
    }
    async function saveSacSessionPanel(){
      const committeeEmails=document.getElementById('sacDetailCommittee')?.value||'';
      const result=await runSacPageAction('v2UpdateSacSessionManual',{sessionId:sacDetailSessionId,committeeEmails},'Save this SAC panel / committee list?');
      if(!result)return;sacDetailMsg('Panel list saved. Refreshing…','ok');setTimeout(()=>location.reload(),450);
    }
    async function addSacParticipantFromDetail(){
      const referenceNo=document.getElementById('sacAddParticipant')?.value||'';
      if(!referenceNo)return sacDetailMsg('Select an applicant first.','error');
      const result=await runSacPageAction('v2AssignSacCandidate',{referenceNo,sessionId:sacDetailSessionId},'Add this applicant to the SAC session?');
      if(!result)return;sacDetailMsg('Participant added. Refreshing…','ok');setTimeout(()=>location.reload(),450);
    }
    async function sendSacInviteFromDetail(){
      const result=await runSacPageAction('v2SendSacCalendarInvitationManual',{sessionId:sacDetailSessionId},'Send the SAC calendar invitation to the configured panel members?');
      if(!result)return;
      if(result.sent){sacDetailMsg(`Invitation sent to ${result.guestCount||0} panel member(s).`,'ok');setTimeout(()=>location.reload(),650)}
      else{sacDetailMsg(`Invitation not sent: ${pretty(result.reason||result.mode||'safety gate')}.`,'info')}
    }

'''
    s = s.replace(anchor, js + anchor, 1)

p.write_text(s, encoding='utf-8')
print('SAC workspace UI patch ready')
