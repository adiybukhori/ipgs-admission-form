from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
OFFER = ROOT / 'apps-script-v2' / 'OfferLetterV2.js'
PACK = ROOT / 'apps-script-v2' / 'AcceptancePackV2.js'
HTML = ROOT / 'apps-script-v2' / 'acceptance-v2.html'
CODE = ROOT / 'apps-script-v2' / 'Code.js'


def must_replace(text, old, new, label, count=None):
    n = text.count(old)
    if n == 0:
        if new in text:
            return text
        raise SystemExit(f'{label}: source pattern not found')
    if count is not None and n != count:
        raise SystemExit(f'{label}: expected {count} occurrence(s), found {n}')
    return text.replace(old, new)


def regex_replace(text, pattern, repl, label, count=0, flags=re.S):
    out, n = re.subn(pattern, repl, text, count=count, flags=flags)
    if n == 0:
        # Allow idempotent re-runs when the intended marker is already present.
        if isinstance(repl, str):
            marker = repl.strip().split('\n', 1)[0].strip()
            if marker and marker in text:
                return text
        raise SystemExit(f'{label}: regex source pattern not found')
    return out


# ---------------------------------------------------------------------
# Code.js - use the controlled handbook copy stored under Admission V2.
# ---------------------------------------------------------------------
code = CODE.read_text(encoding='utf-8')
code = must_replace(
    code,
    "  studentHandbookFileId: '',",
    "  studentHandbookFileId: '15k9C77Zo85f6E-DzBDbQVEr1n_zXT6rz',",
    'student handbook config'
)
CODE.write_text(code, encoding='utf-8')


# ---------------------------------------------------------------------
# Offer Letter - minimum three logical address lines + Full/Part-Time.
# ---------------------------------------------------------------------
offer = OFFER.read_text(encoding='utf-8')

if 'function v2OfferDisplayStudyMode_' not in offer:
    helper = r'''

function v2OfferDisplayStudyMode_(value) {
  const raw = String(value || '').trim();
  if (!raw) return 'Full-Time';
  const upper = raw.toUpperCase().replace(/[_\s]+/g, '-');
  if (upper.indexOf('PART') > -1) return 'Part-Time';
  if (upper.indexOf('FULL') > -1) return 'Full-Time';
  return raw;
}

function v2OfferFormatAddress_(value) {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';

  const commaParts = raw.split(/\s*,\s*/).filter(Boolean);
  let lines = [];

  commaParts.forEach(function(part) {
    if (!part) return;
    if (part.length <= 42) {
      lines.push(part);
      return;
    }

    const words = part.split(/\s+/);
    let current = '';
    words.forEach(function(word) {
      const next = current ? current + ' ' + word : word;
      if (current && next.length > 42) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) lines.push(current);
  });

  if (lines.length < 3) {
    const words = raw.replace(/,/g, '').split(/\s+/).filter(Boolean);
    if (words.length >= 3) {
      lines = ['', '', ''];
      words.forEach(function(word) {
        const lengths = lines.map(function(line) { return line.length; });
        const idx = lengths.indexOf(Math.min.apply(Math, lengths));
        lines[idx] = lines[idx] ? lines[idx] + ' ' + word : word;
      });
    }
  }

  return lines.join('\n');
}
'''
    offer = must_replace(
        offer,
        '\n\n\nfunction v2OfferSetupFoundation()',
        helper + '\n\nfunction v2OfferSetupFoundation()',
        'offer helper insertion'
    )

offer = regex_replace(
    offer,
    r"const address\s*=\s*String\(\s*rawApplication\.fullAddress\s*\|\|\s*rawApplication\.address\s*\|\|\s*''\s*\)\.trim\(\);",
    "const address = v2OfferFormatAddress_(\n    rawApplication.fullAddress ||\n    rawApplication.address ||\n    ''\n  );",
    'offer address formatting'
)

offer = regex_replace(
    offer,
    r"const studyMode\s*=\s*String\(\s*application\.record\[\s*'Study Mode'\s*\]\s*\|\|\s*''\s*\)\.trim\(\)\s*\|\|\s*'Full Time';",
    "const studyMode = v2OfferDisplayStudyMode_(\n    application.record['Study Mode'] ||\n    application.record['Mode of Study'] ||\n    ''\n  );",
    'offer study mode source'
)

offer = regex_replace(
    offer,
    r"\n\s*// Study Mode is intentionally omitted from the official Offer Letter\.\s*\n\s*body\.replaceText\(\s*'Study Mode\\\\s\*:\\\\s\*Full Time',\s*''\s*\);",
    "\n\n  // Keep academic enrolment mode (Full-Time / Part-Time) on the official offer.\n  body.replaceText(\n    'Study Mode\\\\s*:\\\\s*Full[ -]?Time',\n    'Mode of Study     : ' + studyMode\n  );",
    'offer study mode display'
)

OFFER.write_text(offer, encoding='utf-8')


# ---------------------------------------------------------------------
# Acceptance pack - exact handbook page, public handbook copy, 4th PDF.
# ---------------------------------------------------------------------
pack = PACK.read_text(encoding='utf-8')
pack = pack.replace(
    "studentHandbook: '1qXyo_oxIleMhTALZbl955G6XIR0VvbB1'",
    "studentHandbook: '15k9C77Zo85f6E-DzBDbQVEr1n_zXT6rz'"
)

# Remove the generated Google-Doc acknowledgement spec. Exact page is added below.
pack = re.sub(
    r",\s*\{\s*code:\s*'HANDBOOK_ACKNOWLEDGEMENT',[\s\S]*?signedPrefix:\s*'SIGNED_Student_Handbook_Acknowledgement_'\s*\}",
    '',
    pack,
    count=1
)

review_anchor = "  });\n\n  const ids = v2AcceptancePackTemplateIds_();"
if 'v2AcceptanceHandbookAckPublicUrl_()' not in pack.split('function v2AcceptancePackEnsureReviewDocs_',1)[1].split('function v2GetAcceptancePackForToken',1)[0]:
    pack = must_replace(
        pack,
        review_anchor,
        "  });\n\n  // Use the exact acknowledgement page from the approved Student Handbook.\n  documents.push({\n    code: 'HANDBOOK_ACKNOWLEDGEMENT',\n    label: 'Student Handbook Acknowledgement',\n    url: v2AcceptanceHandbookAckPublicUrl_(),\n    signRequired: true\n  });\n\n  const ids = v2AcceptancePackTemplateIds_();",
        'exact handbook review page',
        count=1
    )

pack = regex_replace(
    pack,
    r"let handbookUrl = String\(ctx\.workflow\.record\['Student Handbook URL'\] \|\| ''\)\.trim\(\);\s*if \(!handbookUrl && ids\.studentHandbook\) \{\s*handbookUrl = DriveApp\.getFileById\(ids\.studentHandbook\)\.getUrl\(\);\s*updates\['Student Handbook URL'\] = handbookUrl;\s*\}",
    "const handbookUrl = v2AcceptanceHandbookPublicUrl_();\n  if (String(ctx.workflow.record['Student Handbook URL'] || '').trim() !== handbookUrl) {\n    updates['Student Handbook URL'] = handbookUrl;\n  }",
    'public handbook URL'
)

# Student Handbook card should open the public controlled copy directly.
pack = regex_replace(
    pack,
    r"if \(pack\.handbookUrl\) \{\s*const handbookId = v2OfferExtractDriveId_\(pack\.handbookUrl\);\s*docs\.push\(\{\s*code: 'STUDENT_HANDBOOK',\s*label: 'Postgraduate Student Handbook',\s*url: handbookId\s*\? 'https://drive\.google\.com/uc\?export=download&id=' \+ encodeURIComponent\(handbookId\)\s*:\s*pack\.handbookUrl,\s*signRequired: false,\s*downloadOnly: true\s*\}\);\s*\}",
    "if (pack.handbookUrl) {\n    docs.push({\n      code: 'STUDENT_HANDBOOK',\n      label: 'Postgraduate Student Handbook',\n      url: pack.handbookUrl,\n      signRequired: false,\n      downloadOnly: true\n    });\n  }",
    'handbook card URL'
)

if 'handbookAcknowledgementBackgroundDataUrl:' not in pack:
    pack = must_replace(
        pack,
        "    studentName: ctx.studentName,\n    programme: ctx.programme,\n    intake: ctx.intake,",
        "    studentName: ctx.studentName,\n    idPassport: ctx.idPassport,\n    programme: ctx.programme,\n    intake: ctx.intake,\n    studyMode: v2OfferDisplayStudyMode_(ctx.studyMode),\n    handbookAcknowledgementBackgroundDataUrl: v2AcceptanceHandbookAckBackgroundDataUrl_(),",
        'acceptance client payload'
    )

signed_loop_pattern = r"(v2AcceptancePackSpecs_\(\)\.forEach\(function\(spec\) \{\s*const file = v2AcceptancePackCreatePdf_\(ctx, spec, \{\s*signatureBlob: signatureBlob,\s*signedDate: signedDate,\s*fileName: spec\.signedPrefix \+ safeName \+ '\\.pdf'\s*\}\);\s*createdFiles\.push\(file\);\s*updates\[spec\.signedField\] = file\.getUrl\(\);\s*\}\);)"
if "SIGNED_Student_Handbook_Acknowledgement_" not in pack.split('function v2AcceptancePackSubmitSigned',1)[1].split('function v2AcceptancePackControlledTest',1)[0]:
    pack = regex_replace(
        pack,
        signed_loop_pattern,
        r"\1\n\n      const handbookAckFile = v2AcceptanceCreateExactHandbookAckPdf_(\n        ctx,\n        form.handbookAcknowledgementImageDataUrl,\n        'SIGNED_Student_Handbook_Acknowledgement_' + safeName + '.pdf'\n      );\n      createdFiles.push(handbookAckFile);\n      updates['Student Handbook Acknowledgement Signed PDF URL'] = handbookAckFile.getUrl();",
        'exact signed handbook acknowledgement'
    )

if 'handbookAcknowledgementImageDataUrl:' not in pack.split('function v2AcceptancePackControlledTest',1)[1]:
    pack = must_replace(
        pack,
        "      signatureDataUrl: tinySignature,\n      declarationAccepted: true",
        "      signatureDataUrl: tinySignature,\n      handbookAcknowledgementImageDataUrl: v2AcceptanceHandbookAckBackgroundDataUrl_(),\n      declarationAccepted: true",
        'controlled handbook acknowledgement payload'
    )

PACK.write_text(pack, encoding='utf-8')


# ---------------------------------------------------------------------
# Acceptance page - exact acknowledgement composition + progress bar.
# ---------------------------------------------------------------------
html = HTML.read_text(encoding='utf-8')

if '.signing-progress{' not in html:
    html = must_replace(
        html,
        '    .loading{display:flex;align-items:center;gap:11px;font-size:13px;color:var(--muted)}',
        '    .signing-progress{margin-top:14px;padding:13px;border:1px solid #e2def3;background:#f7f5fd;border-radius:14px}.signing-progress-head{display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:11px;font-weight:800;color:#55489a;margin-bottom:8px}.signing-progress-track{height:9px;border-radius:999px;background:#e6e2f2;overflow:hidden}.signing-progress-bar{height:100%;width:0;background:linear-gradient(90deg,#2d2363,#7667bd);border-radius:999px;transition:width .45s ease}.signing-progress-note{font-size:10px;color:var(--muted);line-height:1.45;margin-top:7px}\n    .loading{display:flex;align-items:center;gap:11px;font-size:13px;color:var(--muted)}',
        'progress CSS'
    )

# Add Mode of Study to the offer details.
if 'id="studyMode"' not in html:
    html = must_replace(
        html,
        '      <div class="info-box"><span>Intake</span><strong id="intake">-</strong></div>\n      <div class="info-box full"><span>Programme</span><strong id="programme">-</strong></div>',
        '      <div class="info-box"><span>Intake</span><strong id="intake">-</strong></div>\n      <div class="info-box full"><span>Programme</span><strong id="programme">-</strong></div>\n      <div class="info-box full"><span>Mode of Study</span><strong id="studyMode">-</strong></div>',
        'acceptance mode detail'
    )

if 'id="signingProgress"' not in html:
    html = must_replace(
        html,
        '      <div class="record"><div class="dot"></div><span>Your signed name, date and time will be recorded automatically when you submit.</span></div>\n      <button id="acceptButton" class="primary" type="button" onclick="submitAcceptance()">Submit Acceptance</button>',
        '      <div class="record"><div class="dot"></div><span>Your signed name, date and time will be recorded automatically when you submit.</span></div>\n      <div id="signingProgress" class="signing-progress hidden"><div class="signing-progress-head"><span id="signingProgressText">Preparing signed documents...</span><span id="signingProgressPct">0%</span></div><div class="signing-progress-track"><div id="signingProgressBar" class="signing-progress-bar"></div></div><div class="signing-progress-note">Please keep this page open while your signed PDFs are prepared and saved securely.</div></div>\n      <button id="acceptButton" class="primary" type="button" onclick="submitAcceptance()">Submit Acceptance</button>',
        'progress markup'
    )

html = html.replace(
    'let signatureCanvas,signatureContext,drawing=false,signatureUsed=false;',
    'let signatureCanvas,signatureContext,drawing=false,signatureUsed=false;\nlet acceptancePackData=null,signingProgressTimer=null,signingProgressValue=0;'
)

if 'acceptancePackData=result;' not in html:
    html = must_replace(
        html,
        "      document.getElementById('studentName').textContent=result.studentName||'-';",
        "      acceptancePackData=result;\n      document.getElementById('studentName').textContent=result.studentName||'-';",
        'cache acceptance payload'
    )

if "document.getElementById('studyMode').textContent" not in html:
    html = must_replace(
        html,
        "      document.getElementById('intake').textContent=result.intake||'-';",
        "      document.getElementById('intake').textContent=result.intake||'-';\n      document.getElementById('studyMode').textContent=result.studyMode||'-';",
        'render study mode'
    )

html = html.replace("const actionLabel=doc.downloadOnly?'Download Handbook':'Open';", "const actionLabel=doc.downloadOnly?'Open / Download Handbook':'Open';")

new_submit = r'''function malaysiaDateText(){
  try{return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'long',year:'numeric'}).format(new Date())}
  catch(_){return new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}
}
function loadCanvasImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Unable to prepare the Student Handbook acknowledgement page.'));img.src=src})}
function drawFittedText(ctx,text,x,y,maxWidth,startSize){
  const value=String(text||'').trim();if(!value)return;
  let size=startSize||23;ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.fillStyle='#111';
  while(size>14){ctx.font=`${size}px "Times New Roman", Times, serif`;if(ctx.measureText(value).width<=maxWidth)break;size-=1}
  ctx.fillText(value,x,y,maxWidth);
}
async function buildHandbookAcknowledgementImage(signatureDataUrl){
  if(!acceptancePackData||!acceptancePackData.handbookAcknowledgementBackgroundDataUrl)throw new Error('Student Handbook acknowledgement template is unavailable.');
  const background=await loadCanvasImage(acceptancePackData.handbookAcknowledgementBackgroundDataUrl);
  const signature=await loadCanvasImage(signatureDataUrl);
  const canvas=document.createElement('canvas');canvas.width=background.naturalWidth||1242;canvas.height=background.naturalHeight||1755;
  const ctx=canvas.getContext('2d');ctx.drawImage(background,0,0,canvas.width,canvas.height);
  drawFittedText(ctx,acceptancePackData.studentName,376,694,345,23);
  drawFittedText(ctx,acceptancePackData.idPassport,841,694,325,23);
  const box={x:215,y:782,w:320,h:72};const ratio=Math.min(box.w/signature.width,box.h/signature.height);const sw=signature.width*ratio,sh=signature.height*ratio;
  ctx.drawImage(signature,box.x+(box.w-sw)/2,box.y+(box.h-sh)/2,sw,sh);
  drawFittedText(ctx,malaysiaDateText(),841,848,325,23);
  return canvas.toDataURL('image/png');
}
function updateSigningProgress(value,text){
  signingProgressValue=Math.max(signingProgressValue,Math.min(100,Math.round(value||0)));
  const bar=document.getElementById('signingProgressBar'),pct=document.getElementById('signingProgressPct'),label=document.getElementById('signingProgressText');
  if(bar)bar.style.width=signingProgressValue+'%';if(pct)pct.textContent=signingProgressValue+'%';if(label&&text)label.textContent=text;
}
function startSigningProgress(){
  document.getElementById('signingProgress').classList.remove('hidden');signingProgressValue=8;updateSigningProgress(8,'Recording your acceptance...');
  clearInterval(signingProgressTimer);signingProgressTimer=setInterval(()=>{if(signingProgressValue>=92)return;const step=signingProgressValue<55?4:signingProgressValue<80?2:1;const next=Math.min(92,signingProgressValue+step);let text='Preparing signed documents...';if(next>=35)text='Applying your signature...';if(next>=62)text='Generating signed PDFs...';if(next>=82)text='Saving documents securely...';updateSigningProgress(next,text)},850);
}
function stopSigningProgress(hide){clearInterval(signingProgressTimer);signingProgressTimer=null;if(hide)document.getElementById('signingProgress').classList.add('hidden')}
async function submitAcceptance(){
  const signedName=document.getElementById('signedName').value.trim(),declarationAccepted=document.getElementById('declaration').checked;
  if(!signedName){showMessage('Student name is missing from the admission record.');return}
  if(!signatureUsed){showMessage('Please provide your electronic signature.');return}
  if(!declarationAccepted){showMessage('Please confirm the admission document declaration before submitting.');return}
  const button=document.getElementById('acceptButton');button.disabled=true;button.textContent='Processing acceptance...';startSigningProgress();
  try{
    const signatureDataUrl=signatureCanvas.toDataURL('image/png');
    updateSigningProgress(18,'Preparing Student Handbook acknowledgement...');
    const handbookAcknowledgementImageDataUrl=await buildHandbookAcknowledgementImage(signatureDataUrl);
    updateSigningProgress(28,'Applying your signature...');
    google.script.run
      .withSuccessHandler(()=>{stopSigningProgress(false);updateSigningProgress(100,'Signed documents completed');button.textContent='Completed';setTimeout(()=>{document.getElementById('acceptanceView').classList.add('hidden');document.getElementById('completedView').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'})},450)})
      .withFailureHandler(error=>{stopSigningProgress(true);button.disabled=false;button.textContent='Submit Acceptance';showMessage(error.message||'Unable to submit acceptance. Please try again.')})
      .v2AcceptancePackSubmitSigned(ACCEPTANCE_TOKEN,{signedName,signatureDataUrl,handbookAcknowledgementImageDataUrl,declarationAccepted:true});
  }catch(error){stopSigningProgress(true);button.disabled=false;button.textContent='Submit Acceptance';showMessage(error.message||'Unable to prepare the signed handbook acknowledgement. Please try again.')}
}
'''

html, n = re.subn(r"function submitAcceptance\(\)\{[\s\S]*?\n\}\n(?=function showMessage)", new_submit, html, count=1)
if n == 0 and 'buildHandbookAcknowledgementImage' not in html:
    raise SystemExit('submitAcceptance replacement failed')

HTML.write_text(html, encoding='utf-8')

print('REFINE_OFFER_HANDBOOK_ACCEPTANCE_OK')
