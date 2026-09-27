from pathlib import Path

p=Path('admin.html')
text=p.read_text(encoding='utf-8')

old_button='''<button class="primary" type="button" onclick="addSacParticipantFromDetail()" ${eligibleOptions?'':'disabled'}>+ Add Participant</button>'''
new_button='''<button class="primary" type="button" onclick="addSacParticipantFromDetail(false)" ${eligibleOptions?'':'disabled'}>+ Add Participant</button><button class="ghost" type="button" onclick="addSacParticipantFromDetail(true)" ${eligibleOptions?'':'disabled'}>Proceed with Pending Document</button>'''
if new_button not in text:
    if old_button not in text: raise SystemExit('SAC participant button anchor not found')
    text=text.replace(old_button,new_button,1)

old_fn='''    async function addSacParticipantFromDetail(){
      const referenceNo=document.getElementById('sacAddParticipant')?.value||'';
      if(!referenceNo)return sacDetailMsg('Select an applicant first.','error');
      const result=await runSacPageAction('v2AssignSacCandidate',{referenceNo,sessionId:sacDetailSessionId},'Add this applicant to the SAC session?');
      if(!result)return;sacDetailMsg('Participant added. Refreshing…','ok');setTimeout(()=>location.reload(),450);
    }'''
new_fn='''    async function addSacParticipantFromDetail(proceedWithPending=false){
      const referenceNo=document.getElementById('sacAddParticipant')?.value||'';
      if(!referenceNo)return sacDetailMsg('Select an applicant first.','error');
      const data={referenceNo,sessionId:sacDetailSessionId};
      let confirmText='Add this applicant to the SAC session?';
      if(proceedWithPending){
        data.proceedWithPendingDocuments=true;
        data.confirmed=true;
        data.overrideBy='Admin Portal V2';
        confirmText='AUTHORISE SAC EXCEPTION: proceed with this applicant even though document/compliance items may still be pending? This action is audited and the pending items remain visible for follow-up.';
      }
      const result=await runSacPageAction('v2AssignSacCandidate',data,confirmText);
      if(!result)return;
      sacDetailMsg(proceedWithPending?'Participant added with authorised pending-document exception. Refreshing…':'Participant added. Refreshing…','ok');
      setTimeout(()=>location.reload(),450);
    }'''
if new_fn not in text:
    if old_fn not in text: raise SystemExit('SAC participant function anchor not found')
    text=text.replace(old_fn,new_fn,1)

p.write_text(text,encoding='utf-8')
print('SAC pending-document override UI patched.')
