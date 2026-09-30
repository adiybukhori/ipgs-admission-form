from pathlib import Path

path = Path('admin.html')
text = path.read_text(encoding='utf-8')

old = """        const packAction=n>0?(sacPackUrl?`<a class=\"ghost\" target=\"_blank\" rel=\"noopener\" href=\"${esc(sacPackUrl)}\">Open SAC Pack</a>${sacFolderUrl?`<a class=\"ghost\" target=\"_blank\" rel=\"noopener\" href=\"${esc(sacFolderUrl)}\">Open SAC Folder</a>`:''}`:(PHASE2_BACKEND_READY?`<button class=\"ghost\" onclick=\"prepareSacPack('${esc(id)}')\">Generate SAC Pack</button>`:'<button class=\"ghost\" disabled>SAC Pack · backend sync pending</button>')):'';"""
new = """        const packAction=n>0?(sacPackUrl?`<a class=\"ghost\" target=\"_blank\" rel=\"noopener\" href=\"${esc(sacPackUrl)}\">Open SAC Pack</a>${sacFolderUrl?`<a class=\"ghost\" target=\"_blank\" rel=\"noopener\" href=\"${esc(sacFolderUrl)}\">Open SAC Folder</a>`:''}${PHASE2_BACKEND_READY?`<button class=\"ghost\" onclick=\"prepareSacPack('${esc(id)}')\">Regenerate SAC Pack</button>`:''}`:(PHASE2_BACKEND_READY?`<button class=\"ghost\" onclick=\"prepareSacPack('${esc(id)}')\">Generate SAC Pack</button>`:'<button class=\"ghost\" disabled>SAC Pack · backend sync pending</button>')):'';"""
if old not in text:
    raise SystemExit('packAction target not found')
text = text.replace(old, new, 1)

old2 = """        <section class=\"sac-session-section\"><h4>5. SAC Print Pack</h4><div class=\"hint\">Generate one merged PDF in the approved order: PG-ADM-01 → AI Screening Report → Admission Form → supporting documents.</div><div class=\"sac-workspace-actions\">${String(session['SAC Pack URL']||'').trim()?`<a class=\"primary\" target=\"_blank\" rel=\"noopener\" href=\"${esc(session['SAC Pack URL'])}\">Open SAC Pack</a>${String(session['SAC Folder URL']||'').trim()?`<a class=\"ghost\" target=\"_blank\" rel=\"noopener\" href=\"${esc(session['SAC Folder URL'])}\">Open SAC Folder</a>`:''}<span class=\"badge green\">Generated</span>`:`<button class=\"primary\" type=\"button\" onclick=\"prepareSacPack('${esc(sacDetailSessionId)}')\" ${candidates.length&&PHASE2_BACKEND_READY?'':'disabled'}>Generate SAC Pack</button><span class=\"badge ${candidates.length?'blue':'amber'}\">${candidates.length} candidate${candidates.length===1?'':'s'}</span>`}</div></section>"""
new2 = """        <section class=\"sac-session-section\"><h4>5. SAC Print Pack</h4><div class=\"hint\">Generate one merged PDF in the approved order: Admission Form → PG-ADM-01 → Certificate → Transcript → Resume / CV → Final AI Screening Report.</div><div class=\"sac-workspace-actions\">${String(session['SAC Pack URL']||'').trim()?`<a class=\"primary\" target=\"_blank\" rel=\"noopener\" href=\"${esc(session['SAC Pack URL'])}\">Open SAC Pack</a>${String(session['SAC Folder URL']||'').trim()?`<a class=\"ghost\" target=\"_blank\" rel=\"noopener\" href=\"${esc(session['SAC Folder URL'])}\">Open SAC Folder</a>`:''}<button class=\"ghost\" type=\"button\" onclick=\"prepareSacPack('${esc(sacDetailSessionId)}')\" ${candidates.length&&PHASE2_BACKEND_READY?'':'disabled'}>Regenerate SAC Pack</button><span class=\"badge green\">Generated</span>`:`<button class=\"primary\" type=\"button\" onclick=\"prepareSacPack('${esc(sacDetailSessionId)}')\" ${candidates.length&&PHASE2_BACKEND_READY?'':'disabled'}>Generate SAC Pack</button><span class=\"badge ${candidates.length?'blue':'amber'}\">${candidates.length} candidate${candidates.length===1?'':'s'}</span>`}</div></section>"""
if old2 not in text:
    raise SystemExit('SAC print pack detail target not found')
text = text.replace(old2, new2, 1)

path.write_text(text, encoding='utf-8')
print('SAC pack regenerate controls added.')
