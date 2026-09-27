from pathlib import Path

p=Path('api/admin-action.js')
s=p.read_text()
old="'v2CreateSacSessionManual','v2UpdateSacSessionManual','v2SendSacCalendarInvitationManual'"
new="'v2CreateSacSessionManual','v2UpdateSacSessionManual','v2DeleteSacSessionManual','v2SendSacCalendarInvitationManual'"
if old in s:
    s=s.replace(old,new)
elif 'v2DeleteSacSessionManual' not in s:
    raise SystemExit('admin-action anchor not found')
p.write_text(s)

p=Path('admin.html')
s=p.read_text()
old='''${!isFinal?'<div style="margin-top:10px"><button class="ghost" type="button" onclick="saveSacSessionDetails()">Save SAC Details</button></div>':''}</section>'''
new='''${!isFinal?`<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="ghost" type="button" onclick="saveSacSessionDetails()">Save SAC Details</button>${candidates.length===0&&cal!=='INVITED'?'<button class="ghost" type="button" style="color:#b42318;border-color:#f0b8b3" onclick="deleteSacSession()">Delete Session</button>':''}</div>`:''}</section>'''
if old in s:
    s=s.replace(old,new)
elif 'onclick="deleteSacSession()"' not in s:
    raise SystemExit('SAC details UI anchor not found')

old='''<button class="primary" type="button" onclick="addSacParticipantFromDetail(false)" ${eligibleOptions?'':'disabled'}>+ Add Participant</button><button class="ghost" type="button" onclick="addSacParticipantFromDetail(true)" ${eligibleOptions?'':'disabled'}>Proceed with Pending Document</button>'''
new='''<button class="primary" type="button" onclick="addSacParticipantFromDetail(false)" ${eligibleOptions?'':'disabled'}>+ Add Participant</button><button class="ghost" type="button" onclick="confirmDocumentsAndAddSacParticipant()" ${eligibleOptions?'':'disabled'}>Confirm Documents Acceptable & Add</button>'''
if old in s:
    s=s.replace(old,new)
elif 'Confirm Documents Acceptable & Add' not in s:
    old2='''<button class="primary" type="button" onclick="addSacParticipantFromDetail(false)" ${eligibleOptions?'':'disabled'}>+ Add Participant</button>'''
    if old2 not in s:
        raise SystemExit('participant button anchor not found')
    s=s.replace(old2,old2+'''<button class="ghost" type="button" onclick="confirmDocumentsAndAddSacParticipant()" ${eligibleOptions?'':'disabled'}>Confirm Documents Acceptable & Add</button>''')

anchor='    async function sendSacInviteFromDetail(){\n'
if 'async function confirmDocumentsAndAddSacParticipant()' not in s:
    fn="""    async function confirmDocumentsAndAddSacParticipant(){
      const referenceNo=document.getElementById('sacAddParticipant')?.value||'';
      if(!referenceNo)return sacDetailMsg('Select an applicant first.','error');
      const applicant=records.find(r=>String(r.ref)===String(referenceNo));
      const name=applicant?.app?.['Student Name']||referenceNo;
      const reasonRaw=prompt('Human Document Confirmation\\n\\nAI has flagged a document issue. If you have checked the documents and they are acceptable for SAC, enter the reason / confirmation note. This will be audited.');
      if(reasonRaw===null)return;
      const reason=String(reasonRaw||'').trim();
      if(reason.length<8)return sacDetailMsg('Enter a clear confirmation reason (minimum 8 characters).','error');
      if(!confirm(`Confirm documents are acceptable for ${name} and add this applicant to SAC?\\n\\nThe original AI finding remains recorded. Human confirmation, reason, reviewer and timestamp will be audited.`))return;
      let listed=await runSacPageAction('v2ListOpenHumanTasks',{},null);
      if(!listed)return;
      let task=(listed.tasks||[]).find(t=>String(t['Reference No']||'')===String(referenceNo)&&String(t['Task Type']||'').toUpperCase()==='DOCUMENT_QUALITY_REVIEW');
      if(!task){
        const created=await runSacPageAction('v2CreateHumanTask',{referenceNo,taskType:'DOCUMENT_QUALITY_REVIEW',title:'Human confirmation of document acceptability for SAC',reason:'Registry reviewed the AI document-quality flag and is deciding whether the documents are acceptable for SAC.',raisedByAgent:'Admin Portal V2',agentId:'COMPLIANCE',priority:'NORMAL',assignedTo:'Registry / Authorised Reviewer',resumeEvent:'HUMAN_TASK_COMPLETED',source:'ADMIN_PORTAL_V2'},null);
        if(!created)return;
        task=created.task||null;
      }
      const taskId=task?.['Task ID']||task?.taskId||'';
      if(!taskId)return sacDetailMsg('Unable to create or locate the human review task.','error');
      const resolved=await runSacPageAction('v2ResolveHumanTask',{taskId,decision:'APPROVE',notes:reason,resolution:{documentQualityDecision:'APPROVED_TO_PROCEED',qualityNotes:reason}},null);
      if(!resolved)return;
      const added=await runSacPageAction('v2AssignSacCandidate',{referenceNo,sessionId:sacDetailSessionId},null);
      if(!added)return;
      sacDetailMsg('Documents confirmed acceptable by human review. Applicant added to SAC; original AI finding remains on record.','ok');
      setTimeout(()=>location.reload(),650);
    }

    async function deleteSacSession(){
      if(!sacDetailSessionId)return;
      if(!confirm('Delete this SAC session?\\n\\nOnly an empty, non-finalised session with no sent calendar invitation can be deleted. This action is audited.'))return;
      const result=await runSacPageAction('v2DeleteSacSessionManual',{sessionId:sacDetailSessionId},null);
      if(!result)return;
      closeSacSessionDetail();
      sacPageMsg('SAC session deleted.','ok');
      setTimeout(()=>location.reload(),450);
    }

"""
    if anchor not in s:
        raise SystemExit('function insertion anchor not found')
    s=s.replace(anchor,fn+anchor)
p.write_text(s)
print('SAC admin UI patch applied')
