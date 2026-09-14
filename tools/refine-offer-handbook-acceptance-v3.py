from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
OFFER = ROOT / 'apps-script-v2' / 'OfferLetterV2.js'
PACK = ROOT / 'apps-script-v2' / 'AcceptancePackV2.js'
HTML = ROOT / 'apps-script-v2' / 'acceptance-v2.html'
CODE = ROOT / 'apps-script-v2' / 'Code.js'


def replace_once(text, old, new, label):
    if new in text:
        return text
    if old not in text:
        raise SystemExit(f'{label}: source pattern not found')
    return text.replace(old, new, 1)


def replace_all_required(text, old, new, label):
    if old not in text:
        if new in text:
            return text
        raise SystemExit(f'{label}: source pattern not found')
    return text.replace(old, new)


# ------------------------------------------------------------------
# Controlled full handbook copy stored under Admission V2/TEMPLATES.
# ------------------------------------------------------------------
code = CODE.read_text(encoding='utf-8')
code = replace_once(
    code,
    "  studentHandbookFileId: '',",
    "  studentHandbookFileId: '15k9C77Zo85f6E-DzBDbQVEr1n_zXT6rz',",
    'student handbook config'
)
CODE.write_text(code, encoding='utf-8')


# ------------------------------------------------------------------
# Official Offer Letter: 3-line address + Full-Time / Part-Time mode.
# ------------------------------------------------------------------
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

  let lines = raw.split(/\s*,\s*/).filter(Boolean);

  // If comma-separated data already gives 3+ components, preserve them.
  // Otherwise rebalance words into at least three readable address lines.
  if (lines.length < 3) {
    const words = raw.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    if (words.length >= 3) {
      const target = Math.ceil(words.length / 3);
      lines = [
        words.slice(0, target).join(' '),
        words.slice(target, target * 2).join(' '),
        words.slice(target * 2).join(' ')
      ].filter(Boolean);
    }
  }

  const wrapped = [];
  lines.forEach(function(line) {
    if (line.length <= 45) {
      wrapped.push(line);
      return;
    }
    const words = line.split(/\s+/);
    let current = '';
    words.forEach(function(word) {
      const next = current ? current + ' ' + word : word;
      if (current && next.length > 45) {
        wrapped.push(current);
        current = word;
      } else {
        current = next;
      }
    });
    if (current) wrapped.push(current);
  });

  return wrapped.join('\n');
}
'''
    anchor = '\n\n\nfunction v2OfferSetupFoundation()'
    if anchor not in offer:
        raise SystemExit('offer helper insertion: anchor not found')
    offer = offer.replace(anchor, helper + '\n\nfunction v2OfferSetupFoundation()', 1)

# Both duplicated generator sections, if present, are intentionally patched.
offer, n = re.subn(
    r"const address\s*=\s*String\(\s*rawApplication\.fullAddress\s*\|\|\s*rawApplication\.address\s*\|\|\s*''\s*\)\.trim\(\);",
    "const address = v2OfferFormatAddress_(\n    rawApplication.fullAddress ||\n    rawApplication.address ||\n    ''\n  );",
    offer,
    flags=re.S
)
if n == 0 and 'const address = v2OfferFormatAddress_(' not in offer:
    raise SystemExit('offer address formatting: source pattern not found')

offer, n = re.subn(
    r"const studyMode\s*=\s*String\(\s*application\.record\[\s*'Study Mode'\s*\]\s*\|\|\s*''\s*\)\.trim\(\)\s*\|\|\s*'Full Time';",
    "const studyMode = v2OfferDisplayStudyMode_(\n    application.record['Study Mode'] ||\n    application.record['Mode of Study'] ||\n    ''\n  );",
    offer,
    flags=re.S
)
if n == 0 and 'const studyMode = v2OfferDisplayStudyMode_(' not in offer:
    raise SystemExit('offer study mode source: source pattern not found')

offer, n = re.subn(
    r"\n\s*// Study Mode is intentionally omitted from the official Offer Letter\.\s*\n\s*body\.replaceText\(\s*'Study Mode\\\\s\*:\\\\s\*Full Time',\s*''\s*\);",
    "\n\n  // Academic enrolment mode is required on the official Offer Letter.\n  body.replaceText(\n    'Study Mode\\\\s*:\\\\s*Full[ -]?Time',\n    'Mode of Study     : ' + studyMode\n  );",
    offer,
    flags=re.S
)
if n == 0 and 'Academic enrolment mode is required on the official Offer Letter.' not in offer:
    raise SystemExit('offer mode display: source pattern not found')

OFFER.write_text(offer, encoding='utf-8')


# ------------------------------------------------------------------
# Acceptance pack: exact handbook acknowledgement + public handbook.
# ------------------------------------------------------------------
pack = PACK.read_text(encoding='utf-8')
pack = pack.replace(
    "studentHandbook: '1qXyo_oxIleMhTALZbl955G6XIR0VvbB1'",
    "studentHandbook: '15k9C77Zo85f6E-DzBDbQVEr1n_zXT6rz'"
)

old_ack_spec = """    },
    {
      code: 'HANDBOOK_ACKNOWLEDGEMENT',
      label: 'Student Handbook Acknowledgement',
      templateId: ids.handbookAcknowledgement,
      reviewField: 'Student Handbook Acknowledgement Review PDF URL',
      signedField: 'Student Handbook Acknowledgement Signed PDF URL',
      reviewPrefix: 'REVIEW_Student_Handbook_Acknowledgement_',
      signedPrefix: 'SIGNED_Student_Handbook_Acknowledgement_'
    }
"""
new_ack_spec = """    }
"""
if old_ack_spec in pack:
    pack = pack.replace(old_ack_spec, new_ack_spec, 1)
elif "code: 'HANDBOOK_ACKNOWLEDGEMENT'" in pack.split('function v2AcceptancePackSpecs_',1)[1].split('function v2AcceptancePackEnsureReviewDocs_',1)[0]:
    raise SystemExit('remove generated handbook acknowledgement spec: unexpected layout')

review_old = """  });

  const ids = v2AcceptancePackTemplateIds_();
  let handbookUrl = String(ctx.workflow.record['Student Handbook URL'] || '').trim();
  if (!handbookUrl && ids.studentHandbook) {
    handbookUrl = DriveApp.getFileById(ids.studentHandbook).getUrl();
    updates['Student Handbook URL'] = handbookUrl;
  }
"""
review_new = """  });

  // Review the exact acknowledgement page from the approved Student Handbook.
  documents.push({
    code: 'HANDBOOK_ACKNOWLEDGEMENT',
    label: 'Student Handbook Acknowledgement',
    url: v2AcceptanceHandbookAckPublicUrl_(),
    signRequired: true
  });

  const ids = v2AcceptancePackTemplateIds_();
  const handbookUrl = v2AcceptanceHandbookPublicUrl_();
  if (String(ctx.workflow.record['Student Handbook URL'] || '').trim() !== handbookUrl) {
    updates['Student Handbook URL'] = handbookUrl;
  }
"""
pack = replace_once(pack, review_old, review_new, 'exact handbook review and public URL')

old_handbook_card = """  if (pack.handbookUrl) {
    const handbookId = v2OfferExtractDriveId_(pack.handbookUrl);
    docs.push({
      code: 'STUDENT_HANDBOOK',
      label: 'Postgraduate Student Handbook',
      url: handbookId
        ? 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(handbookId)
        : pack.handbookUrl,
      signRequired: false,
      downloadOnly: true
    });
  }
"""
new_handbook_card = """  if (pack.handbookUrl) {
    docs.push({
      code: 'STUDENT_HANDBOOK',
      label: 'Postgraduate Student Handbook',
      url: pack.handbookUrl,
      signRequired: false,
      downloadOnly: true
    });
  }
"""
pack = replace_once(pack, old_handbook_card, new_handbook_card, 'public handbook card')

old_payload = """    studentName: ctx.studentName,
    programme: ctx.programme,
    intake: ctx.intake,
    acceptanceStatus: acceptanceStatus,
"""
new_payload = """    studentName: ctx.studentName,
    idPassport: ctx.idPassport,
    programme: ctx.programme,
    intake: ctx.intake,
    studyMode: v2OfferDisplayStudyMode_(ctx.studyMode),
    handbookAcknowledgementBackgroundDataUrl: v2AcceptanceHandbookAckBackgroundDataUrl_(),
    acceptanceStatus: acceptanceStatus,
"""
pack = replace_once(pack, old_payload, new_payload, 'acceptance client payload')

old_signed_loop = """      v2AcceptancePackSpecs_().forEach(function(spec) {
        const file = v2AcceptancePackCreatePdf_(ctx, spec, {
          signatureBlob: signatureBlob,
          signedDate: signedDate,
          fileName: spec.signedPrefix + safeName + '.pdf'
        });
        createdFiles.push(file);
        updates[spec.signedField] = file.getUrl();
      });
"""
new_signed_loop = old_signed_loop + """

      // The Student Handbook acknowledgement must preserve the exact handbook
      // page layout. The browser composes that approved page with student data
      // and the same e-signature, then the backend stores only that signed page.
      const handbookAckFile = v2AcceptanceCreateExactHandbookAckPdf_(
        ctx,
        form.handbookAcknowledgementImageDataUrl,
        'SIGNED_Student_Handbook_Acknowledgement_' + safeName + '.pdf'
      );
      createdFiles.push(handbookAckFile);
      updates['Student Handbook Acknowledgement Signed PDF URL'] = handbookAckFile.getUrl();
"""
pack = replace_once(pack, old_signed_loop, new_signed_loop, 'exact signed handbook acknowledgement')

old_test_payload = """      signedName: 'V2 ACCEPTANCE PACK TEST ' + stamp,
      signatureDataUrl: tinySignature,
      declarationAccepted: true
"""
new_test_payload = """      signedName: 'V2 ACCEPTANCE PACK TEST ' + stamp,
      signatureDataUrl: tinySignature,
      handbookAcknowledgementImageDataUrl: v2AcceptanceHandbookAckBackgroundDataUrl_(),
      declarationAccepted: true
"""
pack = replace_once(pack, old_test_payload, new_test_payload, 'controlled exact acknowledgement payload')

PACK.write_text(pack, encoding='utf-8')


# ------------------------------------------------------------------
# Acceptance UI: show mode + real progress feedback + exact page merge.
# ------------------------------------------------------------------
html = HTML.read_text(encoding='utf-8')
if '.signing-progress{' not in html:
    html = replace_once(
        html,
        '    .loading{display:flex;align-items:center;gap:11px;font-size:13px;color:var(--muted)}',
        '    .signing-progress{margin-top:14px;padding:13px;border:1px solid #e2def3;background:#f7f5fd;border-radius:14px}.signing-progress-head{display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:11px;font-weight:800;color:#55489a;margin-bottom:8px}.signing-progress-track{height:9px;border-radius:999px;background:#e6e2f2;overflow:hidden}.signing-progress-bar{height:100%;width:0;background:linear-gradient(90deg,#2d2363,#7667bd);border-radius:999px;transition:width .45s ease}.signing-progress-note{font-size:10px;color:var(--muted);line-height:1.45;margin-top:7px}\n    .loading{display:flex;align-items:center;gap:11px;font-size:13px;color:var(--muted)}',
        'progress css'
    )

if 'id="studyMode"' not in html:
    html = replace_once(
        html,
        '      <div class="info-box full"><span>Programme</span><strong id="programme">-</strong></div>\n      <div class="info-box full"><span>Reference no.</span><strong id="referenceNo">-</strong></div>',
        '      <div class="info-box full"><span>Programme</span><strong id="programme">-</strong></div>\n      <div class="info-box full"><span>Mode of Study</span><strong id="studyMode">-</strong></div>\n      <div class="info-box full"><span>Reference no.</span><strong id="referenceNo">-</strong></div>',
        'acceptance mode detail'
    )

if 'id="signingProgress"' not in html:
    html = replace_once(
        html,
        '      <div class="record"><div class="dot"></div><span>Your signed name, date and time will be recorded automatically when you submit.</span></div>\n      <button id="acceptButton" class="primary" type="button" onclick="submitAcceptance()">Submit Acceptance</button><div id="formMessage" class="message"></div>',
        '      <div class="record"><div class="dot"></div><span>Your signed name, date and time will be recorded automatically when you submit.</span></div>\n      <div id="signingProgress" class="signing-progress hidden"><div class="signing-progress-head"><span id="signingProgressText">Preparing signed documents...</span><span id="signingProgressPct">0%</span></div><div class="signing-progress-track"><div id="signingProgressBar" class="signing-progress-bar"></div></div><div class="signing-progress-note">Please keep this page open while your signed PDFs are prepared and saved securely.</div></div>\n      <button id="acceptButton" class="primary" type="button" onclick="submitAcceptance()">Submit Acceptance</button><div id="formMessage" class="message"></div>',
        'progress markup'
    )

html = replace_once(
    html,
    'let signatureCanvas,signatureContext,drawing=false,signatureUsed=false;',
    'let signatureCanvas,signatureContext,drawing=false,signatureUsed=false;\nlet acceptancePackData=null,signingProgressTimer=null,signingProgressValue=0;',
    'acceptance state'
)

html = replace_once(
    html,
    "      document.getElementById('studentName').textContent=result.studentName||'-';",
    "      acceptancePackData=result;\n      document.getElementById('studentName').textContent=result.studentName||'-';",
    'cache acceptance payload'
)

html = replace_once(
    html,
    "      document.getElementById('intake').textContent=result.intake||'-';",
    "      document.getElementById('intake').textContent=result.intake||'-';\n      document.getElementById('studyMode').textContent=result.studyMode||'-';",
    'render acceptance study mode'
)
html = html.replace("const actionLabel=doc.downloadOnly?'Download Handbook':'Open';", "const actionLabel=doc.downloadOnly?'Open / Download Handbook':'Open';")

start = html.find('function submitAcceptance(){')
end = html.find('function showMessage', start)
if start < 0 or end < 0:
    if 'function buildHandbookAcknowledgementImage' not in html:
        raise SystemExit('submitAcceptance function boundaries not found')
else:
    replacement = r'''function malaysiaDateText(){
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
    html = html[:start] + replacement + html[end:]

HTML.write_text(html, encoding='utf-8')
print('REFINE_OFFER_HANDBOOK_ACCEPTANCE_V3_OK')
