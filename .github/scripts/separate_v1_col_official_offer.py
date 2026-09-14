from pathlib import Path

path = Path('admin.html')
text = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    if old not in text:
        if new in text:
            print(f'{label}: already applied')
            return
        raise SystemExit(f'Patch target not found: {label}')
    text = text.replace(old, new, 1)
    print(f'{label}: applied')

# V1 legacy application references (IUC-ADM-...) belong to the pre-admission/COL flow.
# Do not treat that document URL as the official Offer Letter / LOA.
replace_once(
    "const offerSent=/YES|SENT|ISSUED/.test(String(row['Email Sent']||'').toUpperCase()),offerUrl=row['Offer Letter File']||row['Offer Letter URL']||row['LOA File']||row['LOA URL']||'';",
    "const offerSent=/YES|SENT|ISSUED/.test(String(row['Email Sent']||'').toUpperCase()),legacyOfferUrl=row['Offer Letter File']||row['Offer Letter URL']||row['LOA File']||row['LOA URL']||'',isApplicationRef=/^IUC-ADM-/i.test(ref),colUrl=isApplicationRef?legacyOfferUrl:'',officialOfferUrl=isApplicationRef?'':legacyOfferUrl,officialOfferIssued=!isApplicationRef&&(offerSent||/^LOA\\//i.test(ref)||Boolean(officialOfferUrl));",
    'split legacy COL vs official offer source'
)

replace_once(
    "'Offer Letter Status':offerSent?'ISSUED':'NOT_CONFIRMED','Offer Letter PDF URL':offerUrl,'Legacy Email Sent':row['Email Sent']||'',",
    "'COL Status':(colUrl||(isApplicationRef&&offerSent))?'ISSUED':'NOT_CONFIRMED','COL PDF URL':colUrl,'Offer Letter Status':officialOfferIssued?'ISSUED':'NOT_CONFIRMED','Offer Letter PDF URL':officialOfferUrl,'Legacy Email Sent':row['Email Sent']||'',",
    'store separate legacy COL and official offer fields'
)

replace_once(
    "if(r.workflow?.['Offer Letter PDF URL'])a.push(`<a class=\"ghost\" target=\"_blank\" href=\"${esc(r.workflow['Offer Letter PDF URL'])}\">Offer Letter</a>`);",
    "if(r.workflow?.['COL PDF URL'])a.push(`<a class=\"ghost\" target=\"_blank\" href=\"${esc(r.workflow['COL PDF URL'])}\">COL</a>`);if(r.workflow?.['Offer Letter PDF URL'])a.push(`<a class=\"ghost\" target=\"_blank\" href=\"${esc(r.workflow['Offer Letter PDF URL'])}\">Official Offer Letter</a>`);",
    'label V1 quick actions correctly'
)

replace_once(
    "offerUrl=r.workflow?.['Offer Letter PDF URL']||'',offerStatus=String(r.workflow?.['Offer Letter Status']||'NOT_CONFIRMED').toUpperCase(),accepted=String(r.workflow?.['Acceptance Status']||'PENDING').toUpperCase(),isAccepted=/ACCEPTED|RECEIVED/.test(accepted),offerIssued=offerStatus==='ISSUED'||Boolean(offerUrl);",
    "colUrl=r.workflow?.['COL PDF URL']||'',colStatus=String(r.workflow?.['COL Status']||'NOT_CONFIRMED').toUpperCase(),colIssued=colStatus==='ISSUED'||Boolean(colUrl),offerUrl=r.workflow?.['Offer Letter PDF URL']||'',offerStatus=String(r.workflow?.['Offer Letter Status']||'NOT_CONFIRMED').toUpperCase(),accepted=String(r.workflow?.['Acceptance Status']||'PENDING').toUpperCase(),isAccepted=/ACCEPTED|RECEIVED/.test(accepted),offerIssued=offerStatus==='ISSUED';",
    'separate COL and official offer status in legacy detail'
)

replace_once(
    "document.getElementById('tab-offer').innerHTML=`<div class=\"offer-flow\"><div class=\"offer-stage-card\"><div class=\"offer-stage-head\"><strong>V1 Offer / LOA</strong>",
    "document.getElementById('tab-offer').innerHTML=`<div class=\"offer-flow\"><div class=\"offer-stage-card\"><div class=\"offer-stage-head\"><strong>V1 Conditional Offer (COL)</strong><span class=\"badge ${colIssued?'green':'blue'}\">${colIssued?'Issued':'Not confirmed'}</span></div><div class=\"offer-stage-meta\"><div class=\"offer-mini\"><span>Document type</span><b>Conditional Offer</b></div><div class=\"offer-mini\"><span>Source</span><b>Admission V1</b></div></div><div class=\"offer-links\">${colUrl?`<a class=\"ops-btn\" target=\"_blank\" href=\"${esc(colUrl)}\">Open COL</a>`:''}</div></div><div class=\"offer-stage-card\"><div class=\"offer-stage-head\"><strong>V1 Official Offer Letter / LOA</strong>",
    'add separate COL card before official offer card'
)

replace_once(
    "${offerUrl?`<a class=\"ops-btn\" target=\"_blank\" href=\"${esc(offerUrl)}\">Open Offer Letter</a>`:''}",
    "${offerUrl?`<a class=\"ops-btn\" target=\"_blank\" href=\"${esc(offerUrl)}\">Open Official Offer Letter</a>`:''}",
    'rename legacy official offer button'
)

replace_once(
    "Historical V1 flow: ${offerIssued?'Offer / LOA issued':'Offer / LOA status not confirmed'} → ${isAccepted?'Acceptance received':'Acceptance pending'}.",
    "Historical V1 flow: ${colIssued?'COL issued':'COL not confirmed'} → ${offerIssued?'Official Offer Letter / LOA issued':'Official Offer Letter / LOA not confirmed'} → ${isAccepted?'Acceptance received':'Acceptance pending'}.",
    'clarify legacy document flow note'
)

path.write_text(text, encoding='utf-8')
print('V1 COL and official Offer Letter are now separated in Admin.')
