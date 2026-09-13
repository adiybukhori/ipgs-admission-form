from pathlib import Path

p = Path('admin.html')
s = p.read_text(encoding='utf-8')

marker = '// MANUAL_DOCUMENT_REVIEW_UI_V1'
if marker not in s:
    anchor = '    function renderOperationalActions(r){\n'
    helper = r'''    // MANUAL_DOCUMENT_REVIEW_UI_V1
    function requiredDocsForManual(r){
      const labels={identityDocument:'Identity Document / NRIC',passportPhoto:'Passport Size Photo',passportCopyInternational:'Passport Copy',transcript:'Highest Academic Transcript',certificate:'Highest Academic / Skills Certificate',apelCertificate:'APEL Certificate',cvResume:'Curriculum Vitae (CV) / Resume',otherSupportingDocument:'Professional / Other Supporting Document',completedAdmissionForm:'Completed International Admission Form',completedHealthDeclaration:'Completed Health Declaration Form',emgsPaymentReceipt:'EMGS / Visa Related Payment Receipt',preliminaryResearchIntent:'Preliminary Research Intent'};
      const out=[];const add=k=>{if(labels[k]&&!out.some(x=>x.key===k))out.push({key:k,label:labels[k]})};
      const applicant=String(r.app?.['Applicant Type']||'').toUpperCase(),entry=String(r.app?.['Entry Qualification Type']||'').toUpperCase(),programme=String(r.app?.['Programme']||'');
      const intl=applicant.includes('INTERNATIONAL')||applicant.includes('NON-MALAYSIAN');
      add('passportPhoto');
      if(intl){add('passportCopyInternational');add('completedAdmissionForm');add('completedHealthDeclaration');add('emgsPaymentReceipt')}else add('identityDocument');
      if(entry.includes('APEL')){add('apelCertificate');add('cvResume')}
      else if(entry.includes('SKM')||entry.includes('TVET')||entry.includes('SKILLS'))add('certificate');
      else if(entry.includes('PROFESSIONAL')||entry.includes('OTHER QUALIFICATION')){add('otherSupportingDocument');add('cvResume')}
      else{add('transcript');add('certificate')}
      if(/^PHD\b/i.test(programme)||/DOCTOR OF PHILOSOPHY/i.test(programme))add('preliminaryResearchIntent');
      return out;
    }
    function manualDocumentReviewPanel(r){
      const required=requiredDocsForManual(r),files=r.files||[];
      let saved={};try{const list=JSON.parse(r.doc?.['Manual Decisions JSON']||'[]');if(Array.isArray(list))list.forEach(x=>saved[x.key]=x)}catch(_){}
      const rows=required.map(d=>{const f=files.find(x=>String(x.field||'')===d.key),sv=saved[d.key]||{},value=String(sv.status||(f?'PENDING':'MISSING')).toUpperCase();const opts=f?`<option value="PENDING" ${value==='PENDING'?'selected':''}>Pending review</option><option value="VERIFIED" ${value==='VERIFIED'?'selected':''}>Verified</option><option value="NOT_ACCEPTABLE" ${value==='NOT_ACCEPTABLE'?'selected':''}>Not acceptable</option><option value="MISSING" ${value==='MISSING'?'selected':''}>Missing</option>`:`<option value="MISSING" selected>Missing</option>`;return `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 0;border-bottom:1px solid #eceef3"><div><div style="font-weight:800;color:#20283b">${esc(d.label)}</div><div class="subline">${f?esc(f.fileName||d.key):'No uploaded file recorded'}</div>${f?.url?`<a class="link" target="_blank" href="${esc(f.url)}">Open document</a>`:''}</div><select class="ops-select manual-doc-status" data-key="${esc(d.key)}" data-label="${esc(d.label)}" style="min-width:145px">${opts}</select></div>`}).join('');
      const requiredKeys=new Set(required.map(x=>x.key)),extras=files.filter(f=>!requiredKeys.has(String(f.field||''))).map(f=>`<div style="padding:6px 0"><span class="subline">Additional:</span> ${esc(f.fileName||f.field||'Document')} ${f.url?`· <a class="link" target="_blank" href="${esc(f.url)}">Open</a>`:''}</div>`).join('');
      const submit=PHASE2_BACKEND_READY?'<button class="ops-btn primary" onclick="completeManualDocumentReview()">Submit Manual Document Review</button>':'<button class="ops-btn" disabled>Submit Manual Document Review · backend sync pending</button>';
      return `<div id="manualDocReviewPanel" style="display:none;width:100%;margin-top:12px;padding:14px;border:1px solid #e3e5eb;border-radius:14px;background:#fff"><div style="font-weight:900;color:#282059;margin-bottom:4px">Manual Document Review</div><div class="subline" style="margin-bottom:10px">Open each document and mark it Verified, Missing or Not acceptable. All required documents must be Verified before Screening can proceed.</div>${rows}${extras?`<div style="margin-top:8px">${extras}</div>`:''}<textarea id="manualDocRemarks" class="ops-select" style="width:100%;min-height:76px;margin-top:12px" placeholder="Reviewer remarks (optional)"></textarea><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${submit}<button class="ops-btn" onclick="openManualDocumentReview()">Close Review</button></div></div>`;
    }
    function openManualDocumentReview(){const el=document.getElementById('manualDocReviewPanel');if(!el)return;el.style.display=el.style.display==='none'||!el.style.display?'block':'none'}
    function completeManualDocumentReview(){
      if(!selected)return;const controls=[...document.querySelectorAll('.manual-doc-status')];if(!controls.length)return opsMsg('No manual document checklist is available.','error');
      const pending=controls.filter(x=>!x.value||x.value==='PENDING');if(pending.length)return opsMsg('Review every required document before submitting.','error');
      const decisions=controls.map(x=>({key:x.dataset.key,label:x.dataset.label,status:x.value}));const remarks=document.getElementById('manualDocRemarks')?.value||'';
      runAdminAction('v2CompleteManualDocumentReview',{referenceNo:selected.ref,decisions,remarks},`Submit MANUAL document review for ${selected.app['Student Name']||selected.ref}? Documents not marked Verified will keep the case at Document Review.`)
    }
'''
    if anchor not in s:
        raise SystemExit('Operational action anchor not found')
    s = s.replace(anchor, helper + anchor, 1)

old_app = "        copy='Run the V2 document completeness check. The system will compare submitted files against the required document set.';\n        actions='<button class=\"ops-btn primary\" onclick=\"runDocumentReview()\">Run Document Review</button>';"
new_app = "        copy='Choose Auto Document Check for a fast system completeness check, or Manual Document Review to open and verify each required document yourself.';\n        actions='<button class=\"ops-btn primary\" onclick=\"runDocumentReview()\">Auto Document Check</button><button class=\"ops-btn\" onclick=\"openManualDocumentReview()\">Manual Document Review</button>'+manualDocumentReviewPanel(r);"
if old_app in s:
    s = s.replace(old_app, new_app, 1)

old_incomplete = "          actions='<button class=\"ops-btn primary\" onclick=\"runDocumentReview()\">'+(docStatus==='INCOMPLETE'?'Re-run Document Review':'Run Document Review')+'</button>';"
new_incomplete = "          actions='<button class=\"ops-btn primary\" onclick=\"runDocumentReview()\">'+(docStatus==='INCOMPLETE'?'Re-run Auto Check':'Auto Document Check')+'</button><button class=\"ops-btn\" onclick=\"openManualDocumentReview()\">Manual Document Review</button>'+manualDocumentReviewPanel(r);"
if old_incomplete in s:
    s = s.replace(old_incomplete, new_incomplete, 1)

s = s.replace("<button class=\"ops-btn primary\" onclick=\"completeManualScreening()\">Complete Manual Review</button>", "<button class=\"ops-btn primary\" onclick=\"completeManualScreening()\">Submit Screening Decision</button>")
s = s.replace("<button class=\"ops-btn\" disabled>Manual Override · backend sync pending</button>", "<button class=\"ops-btn\" disabled>Submit Screening Decision · backend sync pending</button>")

p.write_text(s, encoding='utf-8')
