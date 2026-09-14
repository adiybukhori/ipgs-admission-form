from pathlib import Path
import re


def must_replace(text, old, new, label, count=1):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'{label}: expected marker not found')
    return text.replace(old, new, count)

# -----------------------------------------------------------------------------
# 1) Acceptance page: signature pad must be initialised only after hidden view
#    becomes visible. Otherwise getBoundingClientRect().width is 0 and canvas
#    is effectively created at 1px wide. Keep pointer events for mouse + touch.
# -----------------------------------------------------------------------------
acc_path = Path('apps-script-v2/acceptance-v2.html')
acc = acc_path.read_text(encoding='utf-8')

acc = must_replace(
    acc,
    "window.addEventListener('load',()=>{setupSignatureCanvas();loadAcceptancePack()});",
    "window.addEventListener('load',()=>{loadAcceptancePack()});",
    'acceptance load handler'
)

old_show = "document.getElementById('acceptanceView').classList.remove('hidden');"
new_show = "document.getElementById('acceptanceView').classList.remove('hidden');requestAnimationFrame(()=>{setupSignatureCanvas();resizeCanvas()});"
acc = must_replace(acc, old_show, new_show, 'acceptance visible resize')

old_sig = """function setupSignatureCanvas(){signatureCanvas=document.getElementById('signatureCanvas');signatureContext=signatureCanvas.getContext('2d');resizeCanvas();window.addEventListener('resize',resizeCanvas);signatureCanvas.addEventListener('pointerdown',startDrawing);signatureCanvas.addEventListener('pointermove',draw);signatureCanvas.addEventListener('pointerup',stopDrawing);signatureCanvas.addEventListener('pointercancel',stopDrawing);signatureCanvas.addEventListener('pointerleave',stopDrawing)}
function resizeCanvas(){if(!signatureCanvas)return;const ratio=window.devicePixelRatio||1,rect=signatureCanvas.getBoundingClientRect(),height=window.innerWidth<=520?155:170,oldImage=signatureUsed?signatureCanvas.toDataURL():null;signatureCanvas.width=Math.max(1,Math.floor(rect.width*ratio));signatureCanvas.height=Math.floor(height*ratio);signatureContext=signatureCanvas.getContext('2d');signatureContext.setTransform(ratio,0,0,ratio,0,0);signatureContext.lineWidth=2.2;signatureContext.lineCap='round';signatureContext.lineJoin='round';signatureContext.strokeStyle='#20283b';if(oldImage){const img=new Image();img.onload=()=>signatureContext.drawImage(img,0,0,rect.width,height);img.src=oldImage}}
function pointerPosition(event){const rect=signatureCanvas.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top}}
function startDrawing(event){drawing=true;signatureUsed=true;signatureCanvas.setPointerCapture?.(event.pointerId);const p=pointerPosition(event);signatureContext.beginPath();signatureContext.moveTo(p.x,p.y)}
function draw(event){if(!drawing)return;const p=pointerPosition(event);signatureContext.lineTo(p.x,p.y);signatureContext.stroke()}
function stopDrawing(){drawing=false}
function clearSignature(){signatureContext.clearRect(0,0,signatureCanvas.width,signatureCanvas.height);signatureUsed=false}"""

new_sig = """let signatureResizeTimer=null;
function setupSignatureCanvas(){
  signatureCanvas=document.getElementById('signatureCanvas');
  if(!signatureCanvas)return;
  signatureContext=signatureCanvas.getContext('2d');
  if(signatureCanvas.dataset.signatureReady!=='1'){
    signatureCanvas.dataset.signatureReady='1';
    signatureCanvas.addEventListener('pointerdown',startDrawing,{passive:false});
    signatureCanvas.addEventListener('pointermove',draw,{passive:false});
    signatureCanvas.addEventListener('pointerup',stopDrawing,{passive:false});
    signatureCanvas.addEventListener('pointercancel',stopDrawing,{passive:false});
    signatureCanvas.addEventListener('pointerleave',stopDrawing,{passive:false});
    window.addEventListener('resize',()=>{clearTimeout(signatureResizeTimer);signatureResizeTimer=setTimeout(resizeCanvas,120)});
  }
  resizeCanvas();
}
function resizeCanvas(){
  if(!signatureCanvas)return;
  const rect=signatureCanvas.getBoundingClientRect();
  if(!rect.width||rect.width<20)return;
  const ratio=window.devicePixelRatio||1,height=window.innerWidth<=520?155:170,oldImage=signatureUsed?signatureCanvas.toDataURL():null;
  signatureCanvas.width=Math.max(1,Math.floor(rect.width*ratio));
  signatureCanvas.height=Math.floor(height*ratio);
  signatureContext=signatureCanvas.getContext('2d');
  signatureContext.setTransform(ratio,0,0,ratio,0,0);
  signatureContext.lineWidth=2.2;signatureContext.lineCap='round';signatureContext.lineJoin='round';signatureContext.strokeStyle='#20283b';
  if(oldImage){const img=new Image();img.onload=()=>signatureContext.drawImage(img,0,0,rect.width,height);img.src=oldImage}
}
function pointerPosition(event){const rect=signatureCanvas.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top}}
function startDrawing(event){if(!signatureContext)return;event.preventDefault();drawing=true;signatureUsed=true;try{signatureCanvas.setPointerCapture?.(event.pointerId)}catch(_){ }const p=pointerPosition(event);signatureContext.beginPath();signatureContext.moveTo(p.x,p.y);signatureContext.lineTo(p.x+.01,p.y+.01);signatureContext.stroke()}
function draw(event){if(!drawing||!signatureContext)return;event.preventDefault();const p=pointerPosition(event);signatureContext.lineTo(p.x,p.y);signatureContext.stroke()}
function stopDrawing(event){if(event)event.preventDefault();drawing=false}
function clearSignature(){if(!signatureContext||!signatureCanvas)return;signatureContext.clearRect(0,0,signatureCanvas.width,signatureCanvas.height);signatureUsed=false}"""

if 'let signatureResizeTimer=null;' not in acc:
    if old_sig not in acc:
        raise SystemExit('signature function block marker not found')
    acc = acc.replace(old_sig, new_sig, 1)

acc_path.write_text(acc, encoding='utf-8')

# -----------------------------------------------------------------------------
# 2-4) Offer Letter: normalise intake to Month YYYY everywhere visible,
#      remove Study Mode from generated official Offer Letter only,
#      and replace plain email with a celebratory welcome email.
# -----------------------------------------------------------------------------
offer_path = Path('apps-script-v2/OfferLetterV2.js')
offer = offer_path.read_text(encoding='utf-8')

helper = r'''
function v2OfferDisplayIntake_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, CONFIG.timezone || 'Asia/Kuala_Lumpur', 'MMMM yyyy');
  }

  const raw = String(value || '').trim();
  if (!raw) return '';

  const months = {
    jan:'January', january:'January', feb:'February', february:'February',
    mar:'March', march:'March', apr:'April', april:'April', may:'May',
    jun:'June', june:'June', jul:'July', july:'July', aug:'August', august:'August',
    sep:'September', sept:'September', september:'September', oct:'October', october:'October',
    nov:'November', november:'November', dec:'December', december:'December'
  };
  const monthMatch = raw.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i);
  const yearMatch = raw.match(/\b(20\d{2})\b/);
  if (monthMatch && yearMatch) {
    const key = monthMatch[1].toLowerCase();
    return (months[key] || months[key.slice(0,3)] || monthMatch[1]) + ' ' + yearMatch[1];
  }

  const isoMatch = raw.match(/\b(20\d{2})[-\/]([01]?\d)(?:[-\/]\d{1,2})?\b/);
  if (isoMatch) {
    const monthIndex = Number(isoMatch[2]) - 1;
    if (monthIndex >= 0 && monthIndex < 12) {
      return Utilities.formatDate(new Date(Number(isoMatch[1]), monthIndex, 1), CONFIG.timezone || 'Asia/Kuala_Lumpur', 'MMMM yyyy');
    }
  }

  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, CONFIG.timezone || 'Asia/Kuala_Lumpur', 'MMMM yyyy');
  }
  return raw;
}
'''

if 'function v2OfferDisplayIntake_' not in offer:
    marker = "const V2_OFFER_WORKFLOW_HEADERS = ["
    start = offer.find(marker)
    if start < 0:
        raise SystemExit('offer headers marker not found')
    end = offer.find('];', start)
    if end < 0:
        raise SystemExit('offer headers end marker not found')
    end += 2
    offer = offer[:end] + '\n\n' + helper + offer[end:]

# Prepare-offer payload intake.
offer = re.sub(
    r"intake:\s*application\.record\[\s*'Intake'\s*\]\s*\|\|\s*'',",
    "intake:\n      v2OfferDisplayIntake_(application.record['Intake'] || ''),",
    offer
)
# Token validation payload intake.
offer = re.sub(
    r"intake:\s*row\['Intake'\]\s*\|\|\s*'',",
    "intake:\n      v2OfferDisplayIntake_(row['Intake'] || ''),",
    offer
)
# Any display const intake read from the application.
offer = re.sub(
    r"const intake\s*=\s*String\(\s*application\.record\[\s*'Intake'\s*\]\s*\|\|\s*''\s*\)\.trim\(\);",
    "const intake = v2OfferDisplayIntake_(application.record['Intake'] || '');",
    offer
)
offer = re.sub(
    r"const intake\s*=\s*String\(application\.record\['Intake'\]\s*\|\|\s*''\);",
    "const intake = v2OfferDisplayIntake_(application.record['Intake'] || '');",
    offer
)
offer = re.sub(
    r"const intake\s*=\s*String\(\s*application\.record\[\s*'Intake'\s*\]\s*\|\|\s*''\s*\);",
    "const intake = v2OfferDisplayIntake_(application.record['Intake'] || '');",
    offer
)

# Remove Study Mode line from generated official Offer Letter only. Do not alter source template.
study_block = re.compile(
    r"\s*/\*\s*\* Existing IUC template currently has\s*\* \\\"Study Mode : Full Time\\\" hard-coded\.\s*\* Change ONLY the generated copy\.\s*\*/\s*body\.replaceText\(\s*'Study Mode\\\\s\*:\\\\s\*Full Time',\s*'Study Mode\s*: '\s*\+\s*studyMode\s*\);",
    re.S
)
if study_block.search(offer):
    offer = study_block.sub("\n\n  // Study Mode is intentionally omitted from the official Offer Letter.\n  body.replaceText('Study Mode\\\\s*:\\\\s*Full Time', '');", offer, count=1)
elif "Study Mode is intentionally omitted from the official Offer Letter" not in offer:
    # Fallback exact text from current source.
    old = """  /*
   * Existing IUC template currently has
   * \"Study Mode : Full Time\" hard-coded.
   * Change ONLY the generated copy.
   */
  body.replaceText(
    'Study Mode\\\\s*:\\\\s*Full Time',
    'Study Mode        : ' +
      studyMode
  );"""
    new = """  // Study Mode is intentionally omitted from the official Offer Letter.
  body.replaceText(
    'Study Mode\\\\s*:\\\\s*Full Time',
    ''
  );"""
    if old not in offer:
        raise SystemExit('offer Study Mode block not found')
    offer = offer.replace(old, new, 1)

# Celebratory official-offer email.
email_pattern = re.compile(
    r"  const subject = '\[IUC IPGS\] Offer Letter - ' \+ programme \+ ' - ' \+ reference;\n"
    r"  const html = .*?;\n"
    r"  const attachment = DriveApp\.getFileById\(pdfFileId\)\.getBlob\(\);",
    re.S
)
email_replacement = r'''  const subject = '[IUC IPGS] Congratulations! Your Official Offer Letter - ' + programme;
  const safeStudent = v2OfferHtmlEscape_(student);
  const safeProgramme = v2OfferHtmlEscape_(programme);
  const safeIntake = v2OfferHtmlEscape_(intake);
  const safeReference = v2OfferHtmlEscape_(reference);
  const safeAcceptanceUrl = v2OfferHtmlEscape_(acceptanceUrl);
  const html = [
    '<div style="margin:0;padding:24px;background:#f6f4fb;font-family:Arial,sans-serif;color:#172033">',
      '<div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:22px;overflow:hidden;border:1px solid #e8e3f3;box-shadow:0 10px 30px rgba(45,35,99,.08)">',
        '<div style="background:#2d2363;padding:30px 30px 26px;text-align:center;color:#ffffff">',
          '<div style="font-size:13px;letter-spacing:2px;font-weight:bold;color:#f5c451;margin-bottom:10px">CONGRATULATIONS!</div>',
          '<div style="font-size:30px;line-height:1.2;font-weight:bold">Welcome to Innovative University College</div>',
          '<div style="margin-top:10px;font-size:15px;line-height:1.6;color:#e9e4fb">Your postgraduate journey with IUC is about to begin.</div>',
        '</div>',
        '<div style="padding:30px">',
          '<p style="font-size:18px;margin:0 0 16px"><strong>Dear ' + safeStudent + ',</strong></p>',
          '<p style="font-size:15px;line-height:1.75;margin:0 0 18px">We are delighted to congratulate you on reaching this important milestone. It is our pleasure to officially welcome you to the <strong>Institute of Postgraduate Studies, Innovative University College</strong>.</p>',
          '<p style="font-size:15px;line-height:1.75;margin:0 0 22px">Your <strong>Official Offer Letter</strong> is attached to this email. We are excited to have you join our postgraduate community and look forward to supporting you throughout your academic journey.</p>',
          '<div style="background:#faf8ff;border:1px solid #e5def6;border-radius:14px;padding:18px;margin:0 0 22px">',
            '<div style="font-size:12px;color:#746a94;font-weight:bold;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Your Offer</div>',
            '<div style="font-size:14px;line-height:1.8"><strong>Programme:</strong> ' + safeProgramme + '<br><strong>Intake:</strong> ' + safeIntake + '<br><strong>Reference:</strong> ' + safeReference + '</div>',
          '</div>',
          '<div style="font-size:15px;line-height:1.7;margin-bottom:10px"><strong>Next step:</strong> Please review your Official Offer Letter and complete your secure electronic acceptance.</div>',
          '<div style="text-align:center;margin:26px 0 24px"><a href="' + safeAcceptanceUrl + '" style="display:inline-block;background:#2d2363;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:bold">Review &amp; Accept My Offer</a></div>',
          '<div style="background:#fff8e6;border-left:4px solid #f5c451;padding:14px 16px;border-radius:8px;font-size:14px;line-height:1.65">This is the start of an exciting new chapter. <strong>Welcome to IUC — we are truly pleased to have you with us.</strong></div>',
          '<p style="font-size:13px;color:#697386;line-height:1.65;margin:24px 0 0">If the button above does not open, copy this secure link into your browser:<br><span style="word-break:break-all;color:#4b35a2">' + safeAcceptanceUrl + '</span></p>',
        '</div>',
        '<div style="padding:18px 30px;background:#f3f0fa;text-align:center;font-size:12px;line-height:1.6;color:#746a94">Institute of Postgraduate Studies · Innovative University College<br>We look forward to welcoming you to the IUC community.</div>',
      '</div>',
    '</div>'
  ].join('');
  const attachment = DriveApp.getFileById(pdfFileId).getBlob();'''

if 'Congratulations! Your Official Offer Letter' not in offer:
    if not email_pattern.search(offer):
        raise SystemExit('offer email block not found')
    offer = email_pattern.sub(email_replacement, offer, count=1)

offer_path.write_text(offer, encoding='utf-8')

# -----------------------------------------------------------------------------
# 5) Acceptance module uses the same Month YYYY intake presentation.
# -----------------------------------------------------------------------------
pack_path = Path('apps-script-v2/AcceptancePackV2.js')
pack = pack_path.read_text(encoding='utf-8')
pack = re.sub(
    r"intake:\s*String\(app\['Intake'\]\s*\|\|\s*''\)\.trim\(\),",
    "intake: v2OfferDisplayIntake_(app['Intake'] || ''),",
    pack,
    count=1
)
if "intake: v2OfferDisplayIntake_(app['Intake'] || '')," not in pack:
    raise SystemExit('AcceptancePack intake normalization marker not applied')
pack_path.write_text(pack, encoding='utf-8')

print('Acceptance signature, offer presentation, and intake fixes applied.')
