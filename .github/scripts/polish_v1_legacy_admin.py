from pathlib import Path
import re

admin_path = Path('admin.html')
api_path = Path('api/admin-data.js')
admin = admin_path.read_text(encoding='utf-8')
api = api_path.read_text(encoding='utf-8')


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'Patch target not found: {label}')
    return text.replace(old, new, 1)

# 1) Keep useful V1 offer/email metadata available to the read-only legacy view.
old_row = "const ref=String(row['Ref No']||`V1-LEGACY-${index+1}`),acceptanceRaw=String(row['Acceptance Status']||'PENDING').toUpperCase(),accepted=/RECEIVED|ACCEPTED/.test(acceptanceRaw),intake=String(row['Intake']||[row['Session Month'],row['Session Year']].filter(Boolean).join(' ')||'');"
new_row = "const ref=String(row['Ref No']||`V1-LEGACY-${index+1}`),acceptanceRaw=String(row['Acceptance Status']||'PENDING').toUpperCase(),accepted=/RECEIVED|ACCEPTED/.test(acceptanceRaw),intake=String(row['Intake']||[row['Session Month'],row['Session Year']].filter(Boolean).join(' ')||'');const offerSent=/YES|SENT|ISSUED/.test(String(row['Email Sent']||'').toUpperCase()),offerUrl=row['Offer Letter File']||row['Offer Letter URL']||row['LOA File']||row['LOA URL']||'';"
admin = replace_once(admin, old_row, new_row, 'legacy row offer metadata')

old_workflow = "const workflow={'Reference No':ref,'Application Stage':accepted?'LEGACY_ACCEPTED':'LEGACY_PENDING','Application Status':'LEGACY','Acceptance Status':accepted?'ACCEPTED':acceptanceRaw||'PENDING','Acceptance Received At':row['Acceptance Received At']||'','Acceptance PDF URL':row['Acceptance Offer File']||'','Surat Akuan Signed PDF URL':row['Surat Akuan File']||'','Surat Penerimaan Signed PDF URL':row['Surat Penerimaan File']||'','Student Folder URL':row['Folder URL']||'','Last Updated':row['Acceptance Received At']||row['Timestamp']||'','Updated By':'Admission V1 Legacy'};"
new_workflow = "const workflow={'Reference No':ref,'Application Stage':accepted?'LEGACY_ACCEPTED':'LEGACY_PENDING','Application Status':'LEGACY','Offer Letter Status':offerSent?'ISSUED':'NOT_CONFIRMED','Offer Letter PDF URL':offerUrl,'Legacy Email Sent':row['Email Sent']||'','Acceptance Status':accepted?'ACCEPTED':acceptanceRaw||'PENDING','Acceptance Received At':row['Acceptance Received At']||'','Acceptance PDF URL':row['Acceptance Offer File']||'','Surat Akuan Signed PDF URL':row['Surat Akuan File']||'','Surat Penerimaan Signed PDF URL':row['Surat Penerimaan File']||'','Student Folder URL':row['Folder URL']||'','Last Updated':row['Acceptance Received At']||row['Timestamp']||'','Updated By':'Admission V1 Legacy'};"
admin = replace_once(admin, old_workflow, new_workflow, 'legacy workflow offer metadata')

# 2) V1 gets its own neutral/read-only banner instead of the V2 operational warning.
open_pattern = re.compile(r"    function openRecord\(ref\)\{selected=records\.find\(r=>r\.ref===ref\);if\(!selected\)return;.*?document\.getElementById\('drawer'\)\.classList\.add\('open'\)\}", re.S)
open_replacement = r'''    function openRecord(ref){
      selected=records.find(r=>r.ref===ref);if(!selected)return;
      document.getElementById('drawerName').textContent=selected.app['Student Name']||'Applicant';
      const sourceLabel=selected.source==='V1'?'V1 Legacy':'V2';
      document.getElementById('drawerMeta').textContent=`${sourceLabel} · ${selected.ref} · ${selected.app['Programme']||'-'} · ${selected.app['Intake']||'-'}`;
      const banner=document.getElementById('opsSafetyBanner');
      if(banner){
        if(selected.source==='V1'){
          banner.textContent='V1 Legacy Record · Read-only historical admission data. No V2 workflow action will change this record unless it is intentionally migrated.';
          banner.style.background='var(--blueSoft)';banner.style.color='var(--blue)';banner.style.borderColor='#cfe3f7';
        }else{
          banner.textContent="Operational actions are protected by V2 admin authentication and workflow gates. Actions are shown only for the applicant's current stage.";
          banner.style.background='var(--amberSoft)';banner.style.color='#815400';banner.style.borderColor='#f3dfad';
        }
      }
      renderProgress(selected);renderQuickActions(selected);renderOperationalActions(selected);renderDetailTabs(selected);detailTab('overview',document.querySelector('.tabs button'));document.body.classList.add('drawer-open');document.getElementById('drawerBackdrop').classList.add('open');document.getElementById('drawer').classList.add('open')
    }'''
admin, count = open_pattern.subn(lambda m: open_replacement, admin, count=1)
if count != 1:
    raise SystemExit(f'Patch target not found/ambiguous: openRecord ({count})')

# 3) Only pending V1 cases show the migration placeholder. Completed legacy cases show a completion badge instead.
legacy_ops_pattern = re.compile(r"      if\(r\.source==='V1'\)\{const accepted=/ACCEPTED\|RECEIVED/\.test\(String\(r\.workflow\?\.\['Acceptance Status'\]\|\|''\)\.toUpperCase\(\)\);el\.innerHTML=`.*?`;return;\}", re.S)
legacy_ops_replacement = r'''      if(r.source==='V1'){
        const accepted=/ACCEPTED|RECEIVED/.test(String(r.workflow?.['Acceptance Status']||'').toUpperCase());
        const legacyAction=accepted?'<span class="badge green">Legacy admission complete</span>':'<button class="ops-btn" disabled>Continue in V2 · backend sync pending</button>';
        el.innerHTML=`<div class="ops-head"><div class="title">V1 Legacy Record</div><div class="state">${accepted?'Accepted':'Read only'}</div></div><div class="ops-copy">This record remains in the original Admission V1 history. You can review its folder, offer / LOA history and acceptance documents here without changing the V1 database.</div><div class="ops-actions">${legacyAction}</div><div id="opsMessage" class="ops-message"></div>`;return;
      }'''
admin, count = legacy_ops_pattern.subn(lambda m: legacy_ops_replacement, admin, count=1)
if count != 1:
    raise SystemExit(f'Patch target not found/ambiguous: legacy operational actions ({count})')

# 4) Make the V1 Offer & Acceptance tab read like a historical timeline.
offer_pattern = re.compile(r"const acceptance=r\.workflow\?\.\['Acceptance PDF URL'\]\|\|'',akuan=r\.workflow\?\.\['Surat Akuan Signed PDF URL'\]\|\|'',penerimaan=r\.workflow\?\.\['Surat Penerimaan Signed PDF URL'\]\|\|'',accepted=String\(r\.workflow\?\.\['Acceptance Status'\]\|\|'PENDING'\);document\.getElementById\('tab-offer'\)\.innerHTML=`.*?`;document\.getElementById\('tab-activity'\)\.innerHTML=", re.S)
offer_replacement = r'''const acceptance=r.workflow?.['Acceptance PDF URL']||'',akuan=r.workflow?.['Surat Akuan Signed PDF URL']||'',penerimaan=r.workflow?.['Surat Penerimaan Signed PDF URL']||'',offerUrl=r.workflow?.['Offer Letter PDF URL']||'',offerStatus=String(r.workflow?.['Offer Letter Status']||'NOT_CONFIRMED').toUpperCase(),accepted=String(r.workflow?.['Acceptance Status']||'PENDING').toUpperCase(),isAccepted=/ACCEPTED|RECEIVED/.test(accepted),offerIssued=offerStatus==='ISSUED';document.getElementById('tab-offer').innerHTML=`<div class="offer-flow"><div class="offer-stage-card"><div class="offer-stage-head"><strong>V1 Offer / LOA</strong><span class="badge ${offerIssued?'green':'blue'}">${offerIssued?'Issued':'Not confirmed'}</span></div><div class="offer-stage-meta"><div class="offer-mini"><span>Email sent</span><b>${esc(r.workflow?.['Legacy Email Sent']||'-')}</b></div><div class="offer-mini"><span>Source</span><b>Admission V1</b></div></div><div class="offer-links">${offerUrl?`<a class="ops-btn" target="_blank" href="${esc(offerUrl)}">Open Offer Letter</a>`:''}</div></div><div class="offer-stage-card"><div class="offer-stage-head"><strong>V1 Acceptance</strong><span class="badge ${isAccepted?'green':'amber'}">${isAccepted?'Accepted':'Pending Acceptance'}</span></div><div class="offer-stage-meta"><div class="offer-mini"><span>Acceptance received</span><b>${esc(formatDate(r.workflow?.['Acceptance Received At']||''))}</b></div><div class="offer-mini"><span>Status</span><b>${esc(pretty(accepted))}</b></div></div><div class="offer-links">${acceptance?`<a class="ops-btn" target="_blank" href="${esc(acceptance)}">Acceptance</a>`:''}${akuan?`<a class="ops-btn" target="_blank" href="${esc(akuan)}">Surat Akuan</a>`:''}${penerimaan?`<a class="ops-btn" target="_blank" href="${esc(penerimaan)}">Surat Penerimaan</a>`:''}</div><div class="offer-note">Historical V1 flow: ${offerIssued?'Offer / LOA issued':'Offer / LOA status not confirmed'} → ${isAccepted?'Acceptance received':'Acceptance pending'}. No V2 offer or acceptance action is performed from this view.</div></div></div>`;document.getElementById('tab-activity').innerHTML='''
admin, count = offer_pattern.subn(lambda m: offer_replacement, admin, count=1)
if count != 1:
    raise SystemExit(f'Patch target not found/ambiguous: legacy offer/acceptance timeline ({count})')

# Normalise common V1 legacy fields in the Vercel data bridge.
old_api = "    'Folder URL': firstValue(source, ['Folder URL', 'Student Folder URL', 'folderUrl', 'studentFolderUrl']),\n    'Acceptance Status': firstValue(source, ['Acceptance Status', 'acceptanceStatus', 'Status']),"
new_api = "    'Folder URL': firstValue(source, ['Folder URL', 'Student Folder URL', 'folderUrl', 'studentFolderUrl']),\n    'Email Sent': firstValue(source, ['Email Sent', 'Offer Email Sent', 'LOA Email Sent', 'emailSent']),\n    'Offer Letter File': firstValue(source, ['Offer Letter File', 'Offer Letter PDF URL', 'Offer Letter URL', 'LOA File', 'LOA URL', 'offerLetterUrl']),\n    'Acceptance Status': firstValue(source, ['Acceptance Status', 'acceptanceStatus', 'Status']),"
api = replace_once(api, old_api, new_api, 'legacy API offer fields')

admin_path.write_text(admin, encoding='utf-8')
api_path.write_text(api, encoding='utf-8')
print('V1 legacy admin polish applied.')
