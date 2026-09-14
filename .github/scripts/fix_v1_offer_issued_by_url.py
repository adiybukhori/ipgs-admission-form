from pathlib import Path

path = Path('admin.html')
text = path.read_text(encoding='utf-8')
old = "offerIssued=offerStatus==='ISSUED';document.getElementById('tab-offer')"
new = "offerIssued=offerStatus==='ISSUED'||Boolean(offerUrl);document.getElementById('tab-offer')"
if old not in text:
    if new in text:
        print('V1 offer URL status fix already applied.')
        raise SystemExit(0)
    raise SystemExit('Patch target not found: V1 offer status condition')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('V1 Offer / LOA now counts an existing Offer Letter URL as Issued.')
