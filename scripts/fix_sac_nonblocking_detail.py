from pathlib import Path
import re
p=Path('admin.html')
s=p.read_text(encoding='utf-8')
pattern=re.compile(r"    async function addSacParticipantFromDetail\(proceedWithPending=false\)\{.*?\n    \}\n    async function smartAddSacParticipant\(\)\{.*?\n    \}\n",re.S)
replacement="""    async function addSacParticipantFromDetail(){
      const referenceNo=document.getElementById('sacAddParticipant')?.value||'';
      if(!referenceNo)return sacDetailMsg('Select an applicant first.','error');
      const result=await runSacPageAction('v2AssignSacCandidate',{referenceNo,sessionId:sacDetailSessionId,proceedWithPendingDocuments:true,confirmed:true,overrideBy:'Admin Portal V2 - nonblocking document policy'},'Add this applicant to the SAC session? Pending documents remain follow-up only.');
      if(!result)return;
      sacDetailMsg('Participant added. Pending documents, if any, remain follow-up only.','ok');
    }
    async function smartAddSacParticipant(){return addSacParticipantFromDetail()}
"""
if 'async function smartAddSacParticipant(){return addSacParticipantFromDetail()}' in s:
    print('SAC_DETAIL_ALREADY_NONBLOCKING')
else:
    s,n=pattern.subn(replacement,s,count=1)
    if n!=1: raise SystemExit('SAC participant function block not found')
    p.write_text(s,encoding='utf-8')
    print('SAC_DETAIL_NONBLOCKING_PATCHED')
