from pathlib import Path

p = Path('admin.html')
s = p.read_text(encoding='utf-8')

repls = [
    (
        "screenings=db.V2_QUALIFICATION_SCREENING||[],sacCandidates=",
        "screenings=db.V2_QUALIFICATION_SCREENING||[],aiScreenings=db.V2_AI_SCREENING||[],sacCandidates="
    ),
    (
        "screenMap=byRef(screenings),sacMap=",
        "screenMap=byRef(screenings),aiMap=byRef(aiScreenings),sacMap="
    ),
    (
        "screening:(screenMap[ref]||[]).slice(-1)[0]||{},sac:",
        "screening:(screenMap[ref]||[]).slice(-1)[0]||{},ai:(aiMap[ref]||[]).slice(-1)[0]||{},sac:"
    ),
    (
        "const field=String(r.workflow?.['Field Classification']||r.screening?.['Field Classification']||'');",
        "const field=String(r.ai?.['Human Field Classification']||r.workflow?.['Field Classification']||r.screening?.['Field Classification']||r.ai?.['Field Classification']||'');"
    ),
    (
        "const exp=String(r.workflow?.['Relevant Work Experience']||r.screening?.['Relevant Work Experience']||'');",
        "const exp=String(r.ai?.['Human Relevant Work Experience']||r.workflow?.['Relevant Work Experience']||r.screening?.['Relevant Work Experience']||r.ai?.['Relevant Work Experience']||'');"
    )
]

for old, new in repls:
    if old in s:
        s = s.replace(old, new)
    elif new not in s:
        raise SystemExit('Expected admin.html marker not found: ' + old[:90])

old_screen = "document.getElementById('tab-screening').innerHTML=`<div class=\"detail-grid\">${objectCard('Qualification screening',r.workflow,[['Status','Qualification Screening Status'],['Recommendation','Screening Recommendation'],['Field Classification','Field Classification'],['Work Experience','Relevant Work Experience'],['Rule Code','Qualification Rule Code'],['Screened At','Qualification Screened At'],['Screened By','Qualification Screened By'],['Manual Review','Manual Review Required']],true)}</div>`;"
new_screen = "document.getElementById('tab-screening').innerHTML=`<div class=\"detail-grid\">${r.ai&&Object.keys(r.ai).length?objectCard('AI document screening',r.ai,[['Provider','Provider'],['Model','Model'],['Status','Status'],['Qualification','Qualification'],['Institution','Institution'],['Field of Study','Field of Study'],['CGPA / Grade','CGPA / Grade'],['AI Work Experience','Relevant Work Experience'],['AI Field Classification','Field Classification'],['Confidence','Confidence'],['Human Review','Human Review Status'],['Human Field Classification','Human Field Classification'],['Human Work Experience','Human Relevant Work Experience'],['Confirmed for Rule Engine','Confirmed For Rule Engine']],true):card('AI document screening','<div class=\"empty\">No AI screening result yet. The formal rule engine still uses staff-confirmed values.</div>',true)}${objectCard('Qualification screening',r.workflow,[['Status','Qualification Screening Status'],['Recommendation','Screening Recommendation'],['Field Classification','Field Classification'],['Work Experience','Relevant Work Experience'],['Rule Code','Qualification Rule Code'],['Screened At','Qualification Screened At'],['Screened By','Qualification Screened By'],['Manual Review','Manual Review Required']],true)}</div>`;"

if old_screen in s:
    s = s.replace(old_screen, new_screen, 1)
elif "AI document screening" not in s:
    raise SystemExit('Screening tab marker not found; refusing to patch.')

s = s.replace(
    "Qualification Screening is active. Confirm field relationship and relevant work experience, then run the V2 rule engine.",
    "Qualification Screening is active. AI suggestions may be prefilled when available; Registry must confirm field relationship and relevant work experience before running the V2 rule engine."
)

p.write_text(s, encoding='utf-8')
print('Admin AI screening view patched successfully.')
