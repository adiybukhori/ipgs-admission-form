from pathlib import Path

admin_path = Path('admin.html')
api_path = Path('api/sac-pack.js')

admin = admin_path.read_text(encoding='utf-8')
api = api_path.read_text(encoding='utf-8')

old_subtitle = "${result.candidateCount||0} candidate(s) · Essential 5 only. Missing student-uploaded documents will not block generation."
new_subtitle = "${result.candidateCount||0} candidate(s) · SAC pack order: Admission Form → PG-ADM-01 → Certificate → Transcript → Resume / CV → Final AI Screening Report. Missing student-uploaded documents will not block generation."
if old_subtitle not in admin and new_subtitle not in admin:
    raise SystemExit('SAC pack subtitle target not found in admin.html')
admin = admin.replace(old_subtitle, new_subtitle, 1)

old_docs = """  const DOCS=[
    {key:'pgAdm01',label:'PG-ADM-01',internal:true},
    {key:'aiScreeningReport',label:'AI Screening Report',internal:true},
    {key:'certificate',label:'Certificate'},
    {key:'transcript',label:'Transcript'},
    {key:'resume',label:'Resume / CV'}
  ];"""
new_docs = """  const DOCS=[
    {key:'admissionForm',label:'Admission Form',internal:true},
    {key:'pgAdm01',label:'PG-ADM-01',internal:true},
    {key:'certificate',label:'Certificate'},
    {key:'transcript',label:'Transcript'},
    {key:'resume',label:'Resume / CV'},
    {key:'aiScreeningReport',label:'Final AI Screening Report',internal:true}
  ];"""
if old_docs not in api and new_docs not in api:
    raise SystemExit('SAC DOCS target not found in api/sac-pack.js')
api = api.replace(old_docs, new_docs, 1)

admin_path.write_text(admin, encoding='utf-8')
api_path.write_text(api, encoding='utf-8')
print('SAC pack locked to six documents in the required order.')
