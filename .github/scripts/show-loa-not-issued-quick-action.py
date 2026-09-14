from pathlib import Path

path = Path('admin.html')
text = path.read_text(encoding='utf-8')
old = "if(r.workflow?.['Offer Letter PDF URL'])a.push(`<a class=\"ghost\" target=\"_blank\" href=\"${esc(r.workflow['Offer Letter PDF URL'])}\">${r.source==='V1'?'Offer Letter / LOA':'Offer Letter'}</a>`);if(r.workflow?.['Acceptance PDF URL'])"
new = "if(r.workflow?.['Offer Letter PDF URL'])a.push(`<a class=\"ghost\" target=\"_blank\" href=\"${esc(r.workflow['Offer Letter PDF URL'])}\">${r.source==='V1'?'Offer Letter / LOA':'Offer Letter'}</a>`);else a.push(`<button class=\"ghost\" disabled title=\"Official Offer Letter / LOA has not been issued yet.\">${r.source==='V1'?'Offer Letter / LOA':'Offer Letter'} · Not Issued</button>`);if(r.workflow?.['Acceptance PDF URL'])"
if old not in text:
    if new in text:
        print('LOA Not Issued quick-action placeholder already applied.')
        raise SystemExit(0)
    raise SystemExit('Patch target not found: official offer quick action')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('Quick actions now always show the official offer action; disabled as Not Issued until the official document exists.')
