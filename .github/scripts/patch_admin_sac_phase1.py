from pathlib import Path

path = Path('admin.html')
text = path.read_text(encoding='utf-8')

# 1) Replace SAC section with manual Phase 1 controls.
start = text.find('        <section id="sac" class="section">')
end = text.find('        <section id="assessment" class="section">', start)
if start < 0 or end < 0:
    raise SystemExit('SAC section markers not found; stopping safely.')

sac_section = '''        <section id="sac" class="section">
          <div class="hero"><div><h2>SAC monitoring</h2><p>Phase 1: physical/manual SAC meeting with automated administration. SAC reviewer portal remains disabled.</p></div><span class="badge purple">MANUAL MEETING · PORTAL OFF</span></div>
          <div class="kpis"><div class="kpi"><div class="label">SESSIONS</div><div id="sacSessionsKpi" class="value">0</div><div class="meta">V2 SAC sessions</div></div><div class="kpi"><div class="label">CANDIDATES</div><div id="sacCandidatesKpi" class="value">0</div><div class="meta">Assigned candidates</div></div><div class="kpi"><div class="label">PENDING DECISION</div><div id="sacPendingKpi" class="value">0</div><div class="meta">Awaiting manual SAC result</div></div><div class="kpi"><div class="label">FINALISED</div><div id="sacFinalKpi" class="value">0</div><div class="meta">Completed candidate decisions</div></div></div>

          <div class="panel" style="margin-bottom:18px">
            <div class="panel-head"><h3>Create SAC Session</h3><span>Physical meeting · calendar invitation is safety-gated</span></div>
            <div class="panel-body">
              <div class="warning-banner">Current operating mode: <b>Manual / Physical SAC</b>. Committee portal and digital voting are not active. Admin will record the authorised result after the meeting. Prerequisite cannot be selected directly at SAC; it can only arise after IA.</div>
              <div class="detail-grid">
                <div class="field"><label>SAC Name</label><input id="sacCreateName" placeholder="e.g. SAC Sept Bil 2/26" /></div>
                <div class="field"><label>Meeting Date</label><input id="sacCreateDate" type="date" /></div>
                <div class="field"><label>Meeting Time</label><input id="sacCreateTime" type="time" value="10:00" /></div>
                <div class="field"><label>Chairperson</label><input id="sacCreateChair" placeholder="Chairperson / position" /></div>
                <div class="field full"><label>Physical Venue</label><input id="sacCreateVenue" placeholder="Meeting room / campus venue" /></div>
                <div class="field full"><label>SAC Committee Emails</label><textarea id="sacCommitteeEmails" rows="3" placeholder="committee1@innovative.edu.my, committee2@innovative.edu.my" style="width:100%;border:1px solid #d7dce6;border-radius:12px;padding:12px 13px;background:white;color:var(--ink);outline:none;resize:vertical"></textarea><div class="subline">Leave blank to use active default members from SAC_COMMITTEE_MASTER. Calendar invitation will only send when the backend invitation mode is explicitly enabled.</div></div>
              </div>
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:8px"><button class="primary" onclick="createSacSession()">Create SAC Session</button><span class="badge amber">Invitation safety gate active</span></div>
              <div id="sacCreateMessage" class="message" style="display:none"></div>
            </div>
          </div>

          <div class="panel"><div class="panel-head"><h3>SAC sessions</h3><span>Assign candidates → physical meeting → admin result → minutes & endorsement</span></div><div class="table-wrap"><table><thead><tr><th>Session</th><th>Date</th><th>Mode</th><th>Status</th><th>Chairperson</th><th>Candidates</th><th>Invitation</th><th>Documents</th><th>Action</th></tr></thead><tbody id="sacBody"></tbody></table></div></div>
        </section>

'''
text = text[:start] + sac_section + text[end:]

# 2) Replace renderSac with Phase 1 session rendering.
start = text.find('    function renderSac(){')
end = text.find('    function renderAssessment(){', start)
if start < 0 or end < 0:
    raise SystemExit('renderSac markers not found; stopping safely.')

render_sac = '''    function renderSac(){
      const sessions=db.V2_SAC_SESSIONS||[],candidates=db.V2_SAC_CANDIDATES||[];
      document.getElementById('sacSessionsKpi').textContent=sessions.length;
      document.getElementById('sacCandidatesKpi').textContent=candidates.length;
      const final=candidates.filter(x=>/DIRECT_ENTRY|INTERNAL_ASSESSMENT|REJECTED/.test(String(x['Decision']||x['Final Decision']||x['SAC Decision']||'').toUpperCase())).length;
      document.getElementById('sacFinalKpi').textContent=final;
      document.getElementById('sacPendingKpi').textContent=Math.max(0,candidates.length-final);
      document.getElementById('sacBody').innerHTML=sessions.map(s=>{
        const id=s['SAC Session ID']||s['Session ID']||'';
        const sessionCandidates=candidates.filter(c=>(c['SAC Session ID']||c['Session ID'])===id);
        const n=sessionCandidates.length;
        const pending=sessionCandidates.filter(c=>!String(c['Decision']||'').trim()||String(c['Decision']).toUpperCase()==='PENDING').length;
        const min=s['Minutes URL']||'',end=s['Endorsement URL']||'';
        const mode=s['Meeting Mode']||(/TEST/i.test(id)?'TEST':'MANUAL');
        const cal=String(s['Calendar Status']||'NOT_CREATED').toUpperCase();
        const inviteMode=String(s['Invitation Mode']||'DISABLED').toUpperCase();
        const status=String(s['Status']||'DRAFT').toUpperCase();
        const isFinal=/FINAL|CLOSED/.test(status);
        const inviteAction=!isFinal&&cal!=='INVITED'?`<button class="ghost" onclick="sendSacInvite('${esc(id)}')">Send Invite</button>`:'';
        const finalizeAction=!isFinal&&n>0&&pending===0?`<button class="primary" onclick="finalizeSacSession('${esc(id)}')">Finalize & Generate</button>`:(isFinal?'<span class="badge green">Finalized</span>':pending?`<span class="badge amber">${pending} pending</span>`:'<span class="badge blue">Assign candidates</span>');
        return`<tr><td><div class="student">${esc(s['SAC Name']||id||'-')}</div><div class="subline">${esc(id)}</div></td><td>${esc([s['Meeting Date'],s['Meeting Time']].filter(Boolean).join(' · ')||'-')}</td><td><span class="badge purple">${esc(pretty(mode))}</span><div class="subline">Portal OFF</div></td><td><span class="badge ${classifyBadge(status)}">${esc(pretty(status))}</span></td><td>${esc(s['Chairperson']||'-')}</td><td>${n}<div class="subline">${pending} pending</div></td><td><span class="badge ${cal==='INVITED'?'green':'amber'}">${esc(pretty(cal))}</span><div class="subline">Mode: ${esc(pretty(inviteMode))}</div>${inviteAction?`<div style="margin-top:7px">${inviteAction}</div>`:''}</td><td>${min?`<a class="link" target="_blank" href="${esc(min)}">Minutes</a>`:''}${min&&end?' · ':''}${end?`<a class="link" target="_blank" href="${esc(end)}">Endorsement</a>`:''||'-'}</td><td>${finalizeAction}</td></tr>`
      }).join('')||'<tr><td colspan="9" class="empty">No SAC sessions yet. Create the first Phase 1 manual SAC session above.</td></tr>'
    }
'''
text = text[:start] + render_sac + text[end:]

# 3) Hide controlled test sessions from the applicant assignment dropdown.
old_sessions = "const s=stage(r),sessions=(db.V2_SAC_SESSIONS||[]).filter(x=>!/FINAL|CLOSED/.test(String(x['Status']||'').toUpperCase()));"
new_sessions = "const s=stage(r),sessions=(db.V2_SAC_SESSIONS||[]).filter(x=>{const status=String(x['Status']||'').toUpperCase(),id=String(x['SAC Session ID']||''),name=String(x['SAC Name']||'');return !/FINAL|CLOSED/.test(status)&&!/TEST|CONTROLLED/i.test(id+' '+name)});"
if old_sessions not in text:
    raise SystemExit('Operational SAC session filter not found; stopping safely.')
text = text.replace(old_sessions, new_sessions, 1)

# 4) Update SAC_REVIEW explanatory copy.
old_copy = "copy='Record the authorised SAC outcome. Direct Entry proceeds to Offer eligibility; IA creates the assessment pathway.';"
new_copy = "copy='Phase 1 uses a physical/manual SAC meeting. After the meeting, Admin records the authorised final result here. Direct Entry proceeds to Offer eligibility; IA creates the assessment pathway. Prerequisite can only be required later by the IA panel.';"
if old_copy in text:
    text = text.replace(old_copy, new_copy, 1)

# 5) Replace SAC decision action with manual Phase 1 route and add SAC page actions.
start = text.find('    function recordSacDecision(decision){')
end = text.find('    function recordAssessmentResult(panelResult){', start)
if start < 0 or end < 0:
    raise SystemExit('recordSacDecision markers not found; stopping safely.')

manual_actions = '''    function recordSacDecision(decision){if(!selected)return;const sessionId=currentSacSession(selected);if(!sessionId)return opsMsg('SAC Session ID is missing for this applicant.','error');runAdminAction('v2RecordSacDecisionManual',{referenceNo:selected.ref,sessionId,decision,confirmed:true,remarks:''},`Confirm authorised manual SAC decision: ${pretty(decision)}? This changes the admission route and cannot use Prerequisite directly.`)}
    function sacPageMsg(text,type='info'){const el=document.getElementById('sacCreateMessage');if(!el)return;el.style.display='block';el.className='message '+(type==='error'?'error':'');el.style.background=type==='ok'?'var(--greenSoft)':type==='error'?'var(--redSoft)':'var(--blueSoft)';el.style.color=type==='ok'?'var(--green)':type==='error'?'var(--red)':'var(--blue)';el.textContent=text}
    async function runSacPageAction(action,data,confirmText){
      if(confirmText&&!confirm(confirmText))return null;
      sacPageMsg('Processing…','info');
      try{
        const res=await fetch(ACTION_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,action,data,updatedBy:'Admin Portal V2'})});
        const out=await res.json().catch(()=>({ok:false,message:'Invalid response from action service.'}));
        if(!res.ok||!out.ok)throw new Error(out.message||'Unable to complete SAC action.');
        await loadData(true);
        return out.result||out;
      }catch(e){sacPageMsg(e.message||'Unable to complete SAC action.','error');return null}
    }
    async function createSacSession(){
      const name=document.getElementById('sacCreateName')?.value.trim()||'',meetingDate=document.getElementById('sacCreateDate')?.value||'',meetingTime=document.getElementById('sacCreateTime')?.value||'10:00',chairperson=document.getElementById('sacCreateChair')?.value.trim()||'',venue=document.getElementById('sacCreateVenue')?.value.trim()||'',committeeEmails=document.getElementById('sacCommitteeEmails')?.value.trim()||'';
      if(!name||!meetingDate)return sacPageMsg('Enter SAC Name and Meeting Date first.','error');
      const result=await runSacPageAction('v2CreateSacSessionManual',{name,meetingDate,meetingTime,chairperson,venueLink:venue,committeeEmails,sendInvitation:true},`Create ${name} for ${meetingDate} ${meetingTime}?`);
      if(!result)return;
      const inv=result.invitation||{};
      const invText=inv.sent?'Calendar invitation sent.':`Calendar invitation not sent (${pretty(inv.reason||inv.mode||'safety gate')}).`;
      sacPageMsg(`SAC session created. ${invText}`,'ok');
      ['sacCreateName','sacCreateChair','sacCreateVenue','sacCommitteeEmails'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''});
    }
    async function sendSacInvite(sessionId){
      const result=await runSacPageAction('v2SendSacCalendarInvitationManual',{sessionId},'Send the calendar invitation for this SAC session?');
      if(!result)return;
      sacPageMsg(result.sent?`Calendar invitation sent to ${result.guestCount||0} guest(s).`:`Invitation not sent: ${pretty(result.reason||result.mode||'safety gate')}.`,result.sent?'ok':'info');
    }
    async function finalizeSacSession(sessionId){
      const result=await runSacPageAction('v2FinalizeSacSessionManual',{sessionId,confirmed:true,generateDocuments:true},'Finalize this SAC session and generate the official Minutes / Endorsement? All candidate decisions must already be entered.');
      if(!result)return;
      sacPageMsg('SAC session finalized. Minutes and endorsement generated successfully.','ok');
    }
'''
text = text[:start] + manual_actions + text[end:]

path.write_text(text, encoding='utf-8')
print('Patched admin.html for manual SAC Phase 1.')
