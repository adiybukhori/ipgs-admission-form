from pathlib import Path

path = Path('admin.html')
text = path.read_text(encoding='utf-8')
old = "if(r.workflow?.['COL PDF URL'])a.push(`<a class=\"ghost\" target=\"_blank\" href=\"${esc(r.workflow['COL PDF URL'])}\">COL</a>`);if(r.workflow?.['Offer Letter PDF URL'])a.push(`<a class=\"ghost\" target=\"_blank\" href=\"${esc(r.workflow['Offer Letter PDF URL'])}\">Official Offer Letter</a>`);"
new = "if(r.workflow?.['Offer Letter PDF URL'])a.push(`<a class=\"ghost\" target=\"_blank\" href=\"${esc(r.workflow['Offer Letter PDF URL'])}\">${r.source==='V1'?'Offer Letter / LOA':'Offer Letter'}</a>`);"
if old not in text:
    if new in text:
        print('Quick-action COL removal already applied.')
        raise SystemExit(0)
    raise SystemExit('Patch target not found: quick-action COL / offer buttons')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('Removed COL from quick actions; official Offer Letter / LOA remains when available.')
