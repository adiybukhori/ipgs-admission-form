from pathlib import Path
import re

path = Path('admin.html')
text = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'Patch target not found: {label}')
    text = text.replace(old, new, 1)


def replace_regex(pattern, replacement, label):
    global text
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'Regex patch target not found/ambiguous: {label} ({count})')
    text = updated

replace_once(
    '<div class="side-footer"><div class="live"><i class="dot"></i><span>Live V2 data</span></div><button onclick="logout()">↪ <span>Logout</span></button></div>',
    '<div class="side-footer"><div class="live"><i class="dot"></i><span>V2 + V1 Legacy</span></div><button onclick="logout()">↪ <span>Logout</span></button></div>',
    'sidebar data label'
)

replace_once(
    '<div class="kpi"><div class="label">TOTAL APPLICATIONS</div><div id="kTotal" class="value">0</div><div class="meta">All V2 applications</div></div>',
    '<div class="kpi"><div class="label">ACTIVE V2 APPLICATIONS</div><div id="kTotal" class="value">0</div><div class="meta">Operational V2 workflow only</div></div>',
    'dashboard V2 total label'
)

replace_once(
    '<div class="hero"><div><h2>Applications</h2><p>Search, filter and open any applicant record without scanning the spreadsheet.</p></div></div>',
    '<div class="hero"><div><h2>Applications</h2><p>Search current V2 applications and read-only V1 legacy admission records in one place.</p></div></div>',
    'applications hero copy'
)

old_toolbar = '<div class="panel-body"><div class="toolbar"><input id="searchInput" class="searchbox" placeholder="Search name, reference, ID, email or programme" oninput="renderApplications()" /><select id="intakeFilter" class="compact" onchange="renderApplications()"><option value="">All intakes</option></select><select id="programmeFilter" class="compact" onchange="renderApplications()"><option value="">All programmes</option></select><select id="stageFilter" class="compact" onchange="renderApplications()"><option value="">All stages</option></select></div></div>'
new_toolbar = '<div class="panel-body"><div class="toolbar"><input id="searchInput" class="searchbox" placeholder="Search name, reference, ID, email or programme" oninput="renderApplications()" /><select id="sourceFilter" class="compact" onchange="renderApplications()"><option value="">All records</option><option value="V2">V2 Active</option><option value="V1">V1 Legacy</option></select><select id="intakeFilter" class="compact" onchange="renderApplications()"><option value="">All intakes</option></select><select id="programmeFilter" class="compact" onchange="renderApplications()"><option value="">All programmes</option></select><select id="stageFilter" class="compact" onchange="renderApplications()"><option value="">All stages</option></select></div></div>'
replace_once(old_toolbar, new_toolbar, 'applications source filter')

build_records = r'''    function legacyDateValue(value){const s=String(value||'').trim();if(!s)return 0;const direct=Date.parse(s);if(Number.isFinite(direct))return direct;const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);if(!m)return 0;return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),Number(m[4]||0),Number(m[5]||0),Number(m[6]||0)).getTime()}
    function buildRecords(){
      const apps=db.V2_APPLICATIONS||[],workflows=db.V2_WORKFLOW||[],docReviews=db.V2_DOCUMENT_REVIEW||[],screenings=db.V2_QUALIFICATION_SCREENING||[],aiScreenings=db.V2_AI_SCREENING||[],sacCandidates=db.V2_SAC_CANDIDATES||[],assessments=db.V2_ASSESSMENT_PROGRESS||[],audits=db.V2_AUDIT_LOG||[];
      const byRef=arr=>{const m={};arr.forEach(x=>{const ref=x['Reference No']||x['Reference']||'';if(ref)(m[ref]||=[]).push(x)});return m};
      const wfMap=byRef(workflows),docMap=byRef(docReviews),screenMap=byRef(screenings),aiMap=byRef(aiScreenings),sacMap=byRef(sacCandidates),assessMap=byRef(assessments),auditMap=byRef(audits);
      const v2Records=apps.map(app=>{const ref=app['Reference No']||'';let raw={};try{raw=JSON.parse(app['Raw Application JSON']||'{}')}catch(_){}let files=[];try{files=JSON.parse(app['Uploaded Files JSON']||'[]')}catch(_){}return{source:'V2',legacy:false,ref,app,raw,files,workflow:(wfMap[ref]||[]).slice(-1)[0]||{},doc:(docMap[ref]||[]).slice(-1)[0]||{},screening:(screenMap[ref]||[]).slice(-1)[0]||{},ai:(aiMap[ref]||[]).slice(-1)[0]||{},sac:(sacMap[ref]||[]).slice(-1)[0]||{},assessment:(assessMap[ref]||[]).slice(-1)[0]||{},audit:(auditMap[ref]||[]).slice().reverse()}});
      const legacyRows=db.V1_MASTER_DATABASE||[];
      const legacyRecords=legacyRows.map((row,index)=>{
        const ref=String(row['Ref No']||`V1-LEGACY-${index+1}`),acceptanceRaw=String(row['Acceptance Status']||'PENDING').toUpperCase(),accepted=/RECEIVED|ACCEPTED/.test(acceptanceRaw),intake=String(row['Intake']||[row['Session Month'],row['Session Year']].filter(Boolean).join(' ')||'');
        const app={'Reference No':ref,'Submitted At':row['Timestamp']||'','Student Name':row['Student Name']||'','ID / Passport No':row['IC']||'','Personal Email':row['Email']||'','Programme':row['Programme']||'','Study Mode':'','Intake':intake,'Student Folder URL':row['Folder URL']||'','Application Status':'LEGACY','Last Updated':row['Acceptance Received At']||row['Timestamp']||''};
        const workflow={'Reference No':ref,'Application Stage':accepted?'LEGACY_ACCEPTED':'LEGACY_PENDING','Application Status':'LEGACY','Acceptance Status':accepted?'ACCEPTED':acceptanceRaw||'PENDING','Acceptance Received At':row['Acceptance Received At']||'','Acceptance PDF URL':row['Acceptance Offer File']||'','Surat Akuan Signed PDF URL':row['Surat Akuan File']||'','Surat Penerimaan Signed PDF URL':row['Surat Penerimaan File']||'','Student Folder URL':row['Folder URL']||'','Last Updated':row['Acceptance Received At']||row['Timestamp']||'','Updated By':'Admission V1 Legacy'};
        const files=[];
        if(row['Acceptance Offer File'])files.push({field:'acceptanceOffer',fileName:'Acceptance of Offer',url:row['Acceptance Offer File'],mimeType:'application/pdf'});
        if(row['Surat Akuan File'])files.push({field:'suratAkuan',fileName:'Surat Akuan',url:row['Surat Akuan File'],mimeType:'application/pdf'});
        if(row['Surat Penerimaan File'])files.push({field:'suratPenerimaan',fileName:'Surat Penerimaan Tawaran',url:row['Surat Penerimaan File'],mimeType:'application/pdf'});
        return{source:'V1',legacy:true,ref,app,raw:{sourceSystem:'V1',remark:row['Remark']||''},files,workflow,doc:{},screening:{},ai:{},sac:{},assessment:{},audit:[],legacyRow:row};
      });
      records=[...v2Records,...legacyRecords].sort((a,b)=>legacyDateValue(b.app['Submitted At']||b.workflow?.['Last Updated'])-legacyDateValue(a.app['Submitted At']||a.workflow?.['Last Updated']));
    }
    function activeV2Records(){return records.filter(r=>r.source!=='V1')}
'''
replace_regex(r'    function buildRecords\(\)\{.*?\n    function val\(', build_records + '    function val(', 'combined V2/V1 record builder')

render_dashboard = r'''    function renderDashboard(){const live=activeV2Records(),total=live.length,attentionGroups=getAttentionGroups(),attention=attentionGroups.reduce((n,x)=>n+x.count,0),offer=live.filter(r=>/ELIGIBLE_FOR_OFFER|OFFER_ISSUED/.test(stage(r))||/READY|ISSUED/.test(String(r.workflow?.['Offer Letter Status']||''))).length,accepted=live.filter(r=>stage(r)==='ACCEPTED'||/ACCEPTED/.test(String(r.workflow?.['Acceptance Status']||''))).length;document.getElementById('kTotal').textContent=total;document.getElementById('kAttention').textContent=attention;document.getElementById('kOffer').textContent=offer;document.getElementById('kAccepted').textContent=accepted;document.getElementById('attentionList').innerHTML=attentionGroups.map(x=>`<div class="attention-item"><div><div class="name">${esc(x.name)}</div><div class="sub">${esc(x.sub)}</div></div><div class="count-pill">${x.count}</div></div>`).join('')||'<div class="empty">No pending cases.</div>';renderBars('programmeBars',countBy(live,r=>r.app['Programme']||'Unspecified'),7);renderBars('intakeBars',countBy(live,r=>r.app['Intake']||r.workflow?.['Intake']||'Unspecified'),7);renderFunnel('dashboardFunnel')}
'''
replace_regex(r'    function renderDashboard\(\)\{.*?\n    function getAttentionGroups\(', render_dashboard + '    function getAttentionGroups(', 'V2-only dashboard')

attention = r'''    function getAttentionGroups(){const live=activeV2Records(),newApps=live.filter(r=>stage(r)==='APPLICATION_RECEIVED').length,docs=live.filter(r=>{const s=String(r.workflow?.['Document Review Status']||r.doc?.['Review Status']||r.doc?.['Document Review Status']||'').toUpperCase();return stage(r)==='DOCUMENT_REVIEW'||/PENDING|INCOMPLETE/.test(s)}).length,screening=live.filter(r=>{const rec=String(r.workflow?.['Screening Recommendation']||'').toUpperCase();return stage(r)==='QUALIFICATION_SCREENING'||rec==='PENDING_QUALIFICATION_SCREENING'}).length,sac=live.filter(r=>/SAC_REVIEW|SAC/.test(stage(r))||(/SAC/.test(String(r.workflow?.['SAC Session ID']||''))&&!r.workflow?.['SAC Decision'])).length,assessment=live.filter(r=>/ASSESSMENT|IA|PREREQ/.test(stage(r))||/PENDING|IN_PROGRESS/.test(String(r.workflow?.['Assessment Status']||'').toUpperCase())).length,acceptance=live.filter(r=>stage(r)==='OFFER_ISSUED'&&!/ACCEPTED|DECLINED/.test(String(r.workflow?.['Acceptance Status']||'').toUpperCase())).length;return[{name:'New applications',sub:'Start document review',count:newApps},{name:'Document review',sub:'Pending or incomplete documents',count:docs},{name:'Qualification screening',sub:'Cases awaiting screening outcome',count:screening},{name:'SAC decisions',sub:'Candidates waiting for endorsement',count:sac},{name:'IA / Prerequisite',sub:'Assessment cases in progress',count:assessment},{name:'Acceptance follow-up',sub:'Offer issued but not yet accepted',count:acceptance}].filter(x=>x.count>0)}
'''
replace_regex(r'    function getAttentionGroups\(\)\{.*?\n    function countBy\(', attention + '    function countBy(', 'V2-only attention groups')

funnel = r'''    function funnelCounts(){const live=activeV2Records(),groups=[['Application received',r=>stage(r)==='APPLICATION_RECEIVED'],['Document review',r=>stage(r)==='DOCUMENT_REVIEW'],['Qualification screening',r=>stage(r)==='QUALIFICATION_SCREENING'||String(r.workflow?.['Screening Recommendation']||'')==='PENDING_QUALIFICATION_SCREENING'],['SAC',r=>/SAC_REVIEW|SAC/.test(stage(r))],['IA / Prerequisite',r=>/ASSESSMENT|IA|PREREQ/.test(stage(r))],['Eligible / Offer',r=>/ELIGIBLE_FOR_OFFER|OFFER_ISSUED/.test(stage(r))],['Accepted',r=>stage(r)==='ACCEPTED'||String(r.workflow?.['Acceptance Status']||'').toUpperCase()==='ACCEPTED']];return groups.map(([name,fn])=>[name,live.filter(fn).length])}
'''
replace_regex(r'    function funnelCounts\(\)\{.*?\n    function renderFunnel\(', funnel + '    function renderFunnel(', 'V2-only funnel')

filtered = r'''    function filteredApplications(){const q=document.getElementById('searchInput')?.value.toLowerCase().trim()||'',source=document.getElementById('sourceFilter')?.value||'',intake=document.getElementById('intakeFilter')?.value||'',programme=document.getElementById('programmeFilter')?.value||'',st=document.getElementById('stageFilter')?.value||'';return records.filter(r=>{const hay=[r.ref,r.app['Student Name'],r.app['ID / Passport No'],r.app['Personal Email'],r.app['Programme']].join(' ').toLowerCase();return(!q||hay.includes(q))&&(!source||r.source===source)&&(!intake||r.app['Intake']===intake)&&(!programme||r.app['Programme']===programme)&&(!st||stage(r)===st)})}
    function renderApplications(){const body=document.getElementById('applicationsBody');if(!body)return;const list=filteredApplications();body.innerHTML=list.map(r=>{const sourceBadge=r.source==='V1'?'<span class="badge">V1 Legacy</span>':'<span class="badge purple">V2</span>';return`<tr><td><div class="student">${esc(r.app['Student Name']||'-')} ${sourceBadge}</div><div class="subline">${esc(r.ref)}</div></td><td>${esc(r.app['Programme']||'-')}<div class="subline">${esc(r.app['Study Mode']||'')}</div></td><td>${esc(r.app['Intake']||'-')}</td><td><span class="badge ${classifyBadge(stage(r))}">${esc(pretty(stage(r)))}</span></td><td>${decision(r)?`<span class="badge ${classifyBadge(decision(r))}">${esc(pretty(decision(r)))}</span>`:'-'}</td><td><span class="badge ${classifyBadge(status(r))}">${esc(pretty(status(r)))}</span></td><td>${esc(formatDate(val(r,'Last Updated',r.app['Last Updated']||r.app['Submitted At']||'')))}</td><td><button class="ghost" onclick="openRecord('${esc(r.ref)}')">Open</button></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">No applications match the selected filters.</td></tr>'}
'''
replace_regex(r'    function filteredApplications\(\)\{.*?\n    function renderApplications\(\)\{.*?\n    function renderSac\(', filtered + '    function renderSac(', 'legacy applications filters/table')

replace_regex(
    r"    function renderReports\(\)\{.*?\n    function openRecord\(ref\)\{.*?\n    function closeDrawer\(\)",
    r'''    function renderReports(){const live=activeV2Records();renderFunnel('reportFunnel');renderBars('reportProgramme',countBy(live,r=>r.app['Programme']||'Unspecified'),12);renderBars('reportIntake',countBy(live,r=>r.app['Intake']||'Unspecified'),12);renderBars('reportSource',countBy(live,r=>r.raw.referralSource||r.app['Agent Name']||'Direct / Unspecified'),12)}
    function openRecord(ref){selected=records.find(r=>r.ref===ref);if(!selected)return;document.getElementById('drawerName').textContent=selected.app['Student Name']||'Applicant';const sourceLabel=selected.source==='V1'?'V1 Legacy':'V2';document.getElementById('drawerMeta').textContent=`${sourceLabel} · ${selected.ref} · ${selected.app['Programme']||'-'} · ${selected.app['Intake']||'-'}`;renderProgress(selected);renderQuickActions(selected);renderOperationalActions(selected);renderDetailTabs(selected);detailTab('overview',document.querySelector('.tabs button'));document.body.classList.add('drawer-open');document.getElementById('drawerBackdrop').classList.add('open');document.getElementById('drawer').classList.add('open')}
    function closeDrawer()''',
    'legacy-aware reports/open drawer'
)

replace_once(
    "      const el=document.getElementById('opsPanel');if(!el)return;\n      const s=stage(r),sessions=",
    "      const el=document.getElementById('opsPanel');if(!el)return;\n      if(r.source==='V1'){const accepted=/ACCEPTED|RECEIVED/.test(String(r.workflow?.['Acceptance Status']||'').toUpperCase());el.innerHTML=`<div class=\"ops-head\"><div class=\"title\">V1 Legacy Record</div><div class=\"state\">${accepted?'Accepted':'Read only'}</div></div><div class=\"ops-copy\">This record remains in the original Admission V1 history. You can review its folder and documents here without changing the V1 database.</div><div class=\"ops-actions\"><button class=\"ops-btn\" disabled>Continue in V2 · backend sync pending</button></div><div id=\"opsMessage\" class=\"ops-message\"></div>`;return;}\n      const s=stage(r),sessions=",
    'legacy read-only operational gate'
)

replace_regex(
    r'    function renderProgress\(r\)\{.*?\n    function renderQuickActions\(r\)\{.*?\n    function pair\(',
    r'''    function renderProgress(r){if(r.source==='V1'){document.getElementById('progress').innerHTML='<div style="grid-column:1/-1;border:1px solid var(--line);background:#fafbfc;border-radius:12px;padding:10px 12px;text-align:left;font-size:11px;color:var(--muted)"><b style="color:var(--ink)">V1 Legacy</b> · Read-only historical admission record. V2 workflow stages do not apply until the record is intentionally migrated.</div>';return}const current=stage(r);let currentIndex=stageOrder.findIndex(([key])=>key===current);if(currentIndex<0){if(/IA|PREREQ|ASSESS/.test(current))currentIndex=4;else if(/SAC/.test(current))currentIndex=3;else currentIndex=0}document.getElementById('progress').innerHTML=stageOrder.map(([key,label],i)=>{const cls=i<currentIndex?'done':i===currentIndex?'current':'';return`<div class="step ${cls}"><div class="circle">${i<currentIndex?'✓':i+1}</div><div class="txt">${esc(label)}</div></div>`}).join('')}
    function renderQuickActions(r){const a=[],folder=r.app['Student Folder URL'],pdf=r.app['Admission Form PDF URL'];if(folder)a.push(`<a class="ghost" target="_blank" href="${esc(folder)}">Open student folder</a>`);if(pdf)a.push(`<a class="ghost" target="_blank" href="${esc(pdf)}">Admission Form PDF</a>`);if(r.workflow?.['Offer Letter PDF URL'])a.push(`<a class="ghost" target="_blank" href="${esc(r.workflow['Offer Letter PDF URL'])}">Offer Letter</a>`);if(r.workflow?.['Acceptance PDF URL'])a.push(`<a class="ghost" target="_blank" href="${esc(r.workflow['Acceptance PDF URL'])}">${r.source==='V1'?'Acceptance':'Acceptance PDF'}</a>`);if(r.workflow?.['Surat Akuan Signed PDF URL'])a.push(`<a class="ghost" target="_blank" href="${esc(r.workflow['Surat Akuan Signed PDF URL'])}">Surat Akuan</a>`);if(r.workflow?.['Surat Penerimaan Signed PDF URL'])a.push(`<a class="ghost" target="_blank" href="${esc(r.workflow['Surat Penerimaan Signed PDF URL'])}">Surat Penerimaan</a>`);if(r.workflow?.['Acceptance Signing URL'])a.push(`<a class="ghost" target="_blank" href="${esc(r.workflow['Acceptance Signing URL'])}">Acceptance Link</a>`);a.push(`<button class="ghost" onclick="copyText('${esc(r.ref)}')">Copy reference</button>`);document.getElementById('quickActions').innerHTML=a.join('')}
    function pair(''',
    'legacy progress/quick actions'
)

legacy_tabs = r'''    function renderLegacyDetailTabs(r){const row=r.legacyRow||{},docs=(r.files||[]).map(f=>`<div class="doc"><div><div class="name">${esc(f.fileName||'Legacy document')}</div><div class="type">Admission V1 · ${esc(f.mimeType||'')}</div></div>${f.url?`<a class="link" target="_blank" href="${esc(f.url)}">Open</a>`:''}</div>`).join('');document.getElementById('tab-overview').innerHTML=`<div class="detail-grid">${card('V1 Legacy Record','<div class="kv">'+[pair('Source','Admission V1'),pair('Reference',r.ref),pair('Submitted',row['Timestamp']),pair('Status',row['Acceptance Status']||'PENDING')].join('')+'</div>')}${card('Student','<div class="kv">'+[pair('Name',row['Student Name']),pair('ID / Passport',row['IC']),pair('Email',row['Email'])].join('')+'</div>')}${card('Programme','<div class="kv">'+[pair('Programme',row['Programme']),pair('Intake',r.app['Intake'])].join('')+'</div>')}${card('Legacy note','<div class="kv">'+[pair('Remark',row['Remark']||'-'),pair('Migration','Not migrated to V2')].join('')+'</div>',true)}</div>`;document.getElementById('tab-documents').innerHTML=`<div class="detail-grid">${card('V1 stored documents',`<div class="docs">${docs||'<div class="empty">No document links are recorded in V1 MASTER_DATABASE.</div>'}</div>`,true)}</div>`;document.getElementById('tab-screening').innerHTML=card('Screening','<div class="empty">V1 legacy record is read-only. V2 screening data is not applied to this record.</div>',true);document.getElementById('tab-sacdetail').innerHTML=card('SAC / Assessment','<div class="empty">No V2 SAC / assessment workflow is attached to this legacy record.</div>',true);const acceptance=r.workflow?.['Acceptance PDF URL']||'',akuan=r.workflow?.['Surat Akuan Signed PDF URL']||'',penerimaan=r.workflow?.['Surat Penerimaan Signed PDF URL']||'',accepted=String(r.workflow?.['Acceptance Status']||'PENDING');document.getElementById('tab-offer').innerHTML=`<div class="offer-flow"><div class="offer-stage-card"><div class="offer-stage-head"><strong>V1 Offer & Acceptance History</strong><span class="badge ${classifyBadge(accepted)}">${esc(pretty(accepted))}</span></div><div class="offer-stage-meta"><div class="offer-mini"><span>Acceptance received</span><b>${esc(formatDate(r.workflow?.['Acceptance Received At']||''))}</b></div><div class="offer-mini"><span>Source</span><b>Admission V1</b></div></div><div class="offer-links">${acceptance?`<a class="ops-btn" target="_blank" href="${esc(acceptance)}">Acceptance</a>`:''}${akuan?`<a class="ops-btn" target="_blank" href="${esc(akuan)}">Surat Akuan</a>`:''}${penerimaan?`<a class="ops-btn" target="_blank" href="${esc(penerimaan)}">Surat Penerimaan</a>`:''}</div><div class="offer-note">This is the original V1 record. No V2 offer or acceptance action is performed from this view.</div></div></div>`;document.getElementById('tab-activity').innerHTML=`<div class="audit"><div class="audit-item"><div class="t">Imported as read-only V1 legacy view</div><div class="m">Original timestamp: ${esc(row['Timestamp']||'-')}</div></div>${row['Remark']?`<div class="audit-item"><div class="t">Legacy remark</div><div class="m">${esc(row['Remark'])}</div></div>`:''}</div>`}
'''
replace_regex(r'    function renderDetailTabs\(r\)\{', legacy_tabs + "    function renderDetailTabs(r){if(r.source==='V1'){renderLegacyDetailTabs(r);return}", 'legacy detail tabs')

replace_regex(
    r"    function exportApplicationsCsv\(\)\{const list=filteredApplications\(\),rows=\[\['Reference','Student Name','ID / Passport','Email','Programme','Intake','Stage','Decision','Status','Last Updated'\]\];list\.forEach\(r=>rows\.push\(\[r\.ref,r\.app\['Student Name'\],r\.app\['ID / Passport No'\],r\.app\['Personal Email'\],r\.app\['Programme'\],r\.app\['Intake'\],stage\(r\),decision\(r\),status\(r\),val\(r,'Last Updated',r\.app\['Last Updated'\]\)\]\)\);",
    "    function exportApplicationsCsv(){const list=filteredApplications(),rows=[['Source','Reference','Student Name','ID / Passport','Email','Programme','Intake','Stage','Decision','Status','Last Updated']];list.forEach(r=>rows.push([r.source==='V1'?'V1 Legacy':'V2',r.ref,r.app['Student Name'],r.app['ID / Passport No'],r.app['Personal Email'],r.app['Programme'],r.app['Intake'],stage(r),decision(r),status(r),val(r,'Last Updated',r.app['Last Updated'])]));",
    'CSV source column'
)

path.write_text(text, encoding='utf-8')
print('V1 legacy admin patch applied successfully')
