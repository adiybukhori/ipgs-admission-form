from pathlib import Path

p=Path('admin.html')
s=p.read_text(encoding='utf-8')

old="""      const apps=db.V2_APPLICATIONS||[],workflows=db.V2_WORKFLOW||[],docReviews=db.V2_DOCUMENT_REVIEW||[],screenings=db.V2_QUALIFICATION_SCREENING||[],aiScreenings=db.V2_AI_SCREENING||[],sacCandidates=db.V2_SAC_CANDIDATES||[],assessments=db.V2_ASSESSMENT_PROGRESS||[],audits=db.V2_AUDIT_LOG||[];
      const byRef=arr=>{const m={};arr.forEach(x=>{const ref=x['Reference No']||x['Reference']||'';if(ref)(m[ref]||=[]).push(x)});return m};
      const wfMap=byRef(workflows),docMap=byRef(docReviews),screenMap=byRef(screenings),aiMap=byRef(aiScreenings),sacMap=byRef(sacCandidates),assessMap=byRef(assessments),auditMap=byRef(audits);"""
new="""      const apps=db.V2_APPLICATIONS||[],workflows=db.V2_WORKFLOW||[],docReviews=db.V2_DOCUMENT_REVIEW||[],screenings=db.V2_QUALIFICATION_SCREENING||[],aiScreenings=db.V2_AI_SCREENING||[],sacCandidates=db.V2_SAC_CANDIDATES||[],assessments=db.V2_ASSESSMENT_PROGRESS||[],audits=db.V2_AUDIT_LOG||[],agentEvents=db.V2_AGENT_EVENTS||[];
      const byRef=arr=>{const m={};arr.forEach(x=>{const ref=x['Reference No']||x['Reference']||x['referenceNo']||'';if(ref)(m[ref]||=[]).push(x)});return m};
      const remarkEvents=agentEvents.filter(x=>{const action=String(x['Action']||x['Event']||x['Activity']||x['Type']||'').toUpperCase();return action.includes('INTERNAL_REMARK')});
      const normalizedRemarkEvents=remarkEvents.map(x=>({...x,'Action':'INTERNAL_REMARK','Type':'INTERNAL_REMARK','Remark':x['Remark']||x['Details']||x['Message']||x['Note']||x['Description']||x['remark']||x['details']||x['message']||x['note']||'','Timestamp':x['Timestamp']||x['Created At']||x['Updated At']||x['timestamp']||x['createdAt']||x['updatedAt']||'','Updated By':x['Updated By']||x['Actor']||x['Agent ID']||x['updatedBy']||x['agentId']||'Admin Portal V2'}));
      const wfMap=byRef(workflows),docMap=byRef(docReviews),screenMap=byRef(screenings),aiMap=byRef(aiScreenings),sacMap=byRef(sacCandidates),assessMap=byRef(assessments),auditMap=byRef([...audits,...normalizedRemarkEvents]);"""

if 'normalizedRemarkEvents' in s:
    print('REMARK_PERSISTENCE_ALREADY_PATCHED')
elif old not in s:
    raise SystemExit('buildRecords anchor not found')
else:
    s=s.replace(old,new,1)
    p.write_text(s,encoding='utf-8')
    print('REMARK_PERSISTENCE_PATCHED')
