from pathlib import Path
p=Path('admin.html')
s=p.read_text(encoding='utf-8')
marker='PHASE2_SCREENING_OFFER_UI_V1'
if marker not in s:
    anchor="    function renderOperationalActions(r){\n"
    helper=r'''    // PHASE2_SCREENING_OFFER_UI_V1
    function screeningControls(r){
      const aiStatus=String(r.ai?.['Status']||'AUTO PENDING').toUpperCase();
      const field=String(r.ai?.['Human Field Classification']||r.workflow?.['Field Classification']||r.screening?.['Field Classification']||r.ai?.['Field Classification']||'');
      const exp=String(r.ai?.['Human Relevant Work Experience']||r.workflow?.['Relevant Work Experience']||r.screening?.['Relevant Work Experience']||r.ai?.['Relevant Work Experience']||'');
      const manualRequired=/YES|REQUIRED/.test(String(r.workflow?.['Manual Review Required']||'' ).toUpperCase())||/MANUAL_REVIEW_REQUIRED/.test(String(r.workflow?.['Qualification Screening Status']||'').toUpperCase());
      const aiClass=classifyBadge(aiStatus);
      const base=`<div style="width:100%;display:flex;flex-wrap:wrap;gap:8px;align-items:center"><span class="badge ${aiClass}">AI Auto: ${esc(pretty(aiStatus))}</span><button class="ops-btn" onclick="retryAutoAiScreening()">Retry AI Auto</button><select id="opsFieldClassification" class="ops-select"><option value="">Field relationship</option><option value="RELATED" ${field==='RELATED'?'selected':''}>Related</option><option value="PARTIALLY_RELATED" ${field==='PARTIALLY_RELATED'?'selected':''}>Partially Related</option><option value="NON_RELATED" ${field==='NON_RELATED'?'selected':''}>Non-Related</option></select><select id="opsWorkExperience" class="ops-select"><option value="">Relevant work experience</option><option value="YES" ${exp==='YES'?'selected':''}>Yes</option><option value="NO" ${exp==='NO'?'selected':''}>No</option></select><button class="ops-btn primary" onclick="runQualificationScreening()">Run Manual Screening</button></div>`;
      if(!manualRequired)return base;
      return base+`<div style="width:100%;margin-top:4px;padding-top:10px;border-top:1px solid #e7eaf0;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="badge amber">Manual decision required</span><select id="opsManualRecommendation" class="ops-select"><option value="">Manual recommendation</option><option value="DIRECT_ENTRY">Direct Entry</option><option value="NORMAL_ADMISSION_SCREENING">Normal Admission</option><option value="INTERNAL_ASSESSMENT">Internal Assessment</option><option value="NOT_ELIGIBLE_CONVENTIONAL">Not Eligible - Conventional</option></select><button class="ops-btn primary" onclick="completeManualScreening()">Complete Manual Review</button></div>`;
    }
'''
    if anchor not in s: raise SystemExit('renderOperationalActions anchor missing')
    s=s.replace(anchor,helper+anchor,1)

    old_doc="""          copy='Documents are complete. Set the academic field relationship and relevant work-experience status, then run qualification screening.';
          const field=String(r.ai?.['Human Field Classification']||r.workflow?.['Field Classification']||r.screening?.['Field Classification']||r.ai?.['Field Classification']||'');
          const exp=String(r.ai?.['Human Relevant Work Experience']||r.workflow?.['Relevant Work Experience']||r.screening?.['Relevant Work Experience']||r.ai?.['Relevant Work Experience']||'');
          actions=`<select id=\"opsFieldClassification\" class=\"ops-select\"><option value=\"\">Field relationship</option><option value=\"RELATED\" ${field==='RELATED'?'selected':''}>Related</option><option value=\"PARTIALLY_RELATED\" ${field==='PARTIALLY_RELATED'?'selected':''}>Partially Related</option><option value=\"NON_RELATED\" ${field==='NON_RELATED'?'selected':''}>Non-Related</option></select><select id=\"opsWorkExperience\" class=\"ops-select\"><option value=\"\">Relevant work experience</option><option value=\"YES\" ${exp==='YES'?'selected':''}>Yes</option><option value=\"NO\" ${exp==='NO'?'selected':''}>No</option></select><button class=\"ops-btn primary\" onclick=\"runQualificationScreening()\">Run Screening</button>`;"""
    new_doc="""          copy='Documents are complete. AI Auto gets the first attempt automatically. If AI is pending, unavailable or needs review, use Manual Screening as the second layer so the application is not blocked.';
          actions=screeningControls(r);"""
    if old_doc not in s: raise SystemExit('Document screening controls anchor missing')
    s=s.replace(old_doc,new_doc,1)

    old_qual="""        copy='Qualification Screening is active. AI suggestions may be prefilled when available; Registry must confirm field relationship and relevant work experience before running the V2 rule engine.';
        const field=String(r.ai?.['Human Field Classification']||r.workflow?.['Field Classification']||r.screening?.['Field Classification']||r.ai?.['Field Classification']||'');
        const exp=String(r.ai?.['Human Relevant Work Experience']||r.workflow?.['Relevant Work Experience']||r.screening?.['Relevant Work Experience']||r.ai?.['Relevant Work Experience']||'');
        actions=`<select id=\"opsFieldClassification\" class=\"ops-select\"><option value=\"\">Field relationship</option><option value=\"RELATED\" ${field==='RELATED'?'selected':''}>Related</option><option value=\"PARTIALLY_RELATED\" ${field==='PARTIALLY_RELATED'?'selected':''}>Partially Related</option><option value=\"NON_RELATED\" ${field==='NON_RELATED'?'selected':''}>Non-Related</option></select><select id=\"opsWorkExperience\" class=\"ops-select\"><option value=\"\">Relevant work experience</option><option value=\"YES\" ${exp==='YES'?'selected':''}>Yes</option><option value=\"NO\" ${exp==='NO'?'selected':''}>No</option></select><button class=\"ops-btn primary\" onclick=\"runQualificationScreening()\">Run Screening</button>`;"""
    new_qual="""        copy='Screening is pending. AI Auto and Manual Screening operate as parallel layers: whichever successfully completes screening first moves the case forward. Low-confidence or no-rule cases can be completed through Manual Review.';
        actions=screeningControls(r);"""
    if old_qual not in s: raise SystemExit('Qualification screening controls anchor missing')
    s=s.replace(old_qual,new_qual,1)

    old_offer="""      }else if(s==='ELIGIBLE_FOR_OFFER'){
        copy='All admission gates are complete. Offer generation remains governed by the protected Offer Letter V2 module.';
        actions='<button class=\"ops-btn\" disabled>Generate Offer — module route pending</button>';"""
    new_offer="""      }else if(s==='ELIGIBLE_FOR_OFFER'){
        copy='All admission gates are complete. Generate the official Offer Letter and send the secure e-sign Acceptance link to the student.';
        actions='<button class=\"ops-btn primary\" onclick=\"issueOffer()\">Generate & Send Offer</button>';"""
    if old_offer not in s: raise SystemExit('Offer action anchor missing')
    s=s.replace(old_offer,new_offer,1)

    old_fn="    function runQualificationScreening(){if(!selected)return;const field=document.getElementById('opsFieldClassification')?.value||'',exp=document.getElementById('opsWorkExperience')?.value||'';if(!field||!exp)return opsMsg('Select Field Relationship and Relevant Work Experience first.','error');runAdminAction('v2RunQualificationScreening',{referenceNo:selected.ref,fieldClassification:field,relevantWorkExperience:exp,remarks:''},`Run qualification screening for ${selected.app['Student Name']||selected.ref}?`)}\n"
    new_fn="""    function retryAutoAiScreening(){if(!selected)return;runAdminAction('v2RunAutoAiScreening',{referenceNo:selected.ref},`Retry AI Auto screening for ${selected.app['Student Name']||selected.ref}? Manual Screening remains available if AI cannot complete it.`)}
    function runQualificationScreening(){if(!selected)return;const field=document.getElementById('opsFieldClassification')?.value||'',exp=document.getElementById('opsWorkExperience')?.value||'';if(!field||!exp)return opsMsg('Select Field Relationship and Relevant Work Experience first.','error');runAdminAction('v2RunQualificationScreening',{referenceNo:selected.ref,fieldClassification:field,relevantWorkExperience:exp,remarks:'Manual second-layer screening from Admin Portal'},`Run MANUAL qualification screening for ${selected.app['Student Name']||selected.ref}? If AI has already completed screening, the resolved stage will be preserved.`)}
    function completeManualScreening(){if(!selected)return;const field=document.getElementById('opsFieldClassification')?.value||'',exp=document.getElementById('opsWorkExperience')?.value||'',route=document.getElementById('opsManualRecommendation')?.value||'';if(!field||!exp||!route)return opsMsg('Select Field Relationship, Work Experience and Manual Recommendation first.','error');runAdminAction('v2CompleteManualQualificationScreening',{referenceNo:selected.ref,fieldClassification:field,relevantWorkExperience:exp,recommendedRoute:route,remarks:'Registry manual second-layer resolution'},`Complete manual screening as ${pretty(route)}? This will move the case to Ready for SAC if screening is still pending.`)}
    function issueOffer(){if(!selected)return;runAdminAction('v2IssueOffer',{referenceNo:selected.ref,sendEmail:true,testMode:false},`Generate the official Offer Letter and SEND it to ${selected.app['Personal Email']||'the student'} with the secure Acceptance link?`)}
"""
    if old_fn not in s: raise SystemExit('Screening function anchor missing')
    s=s.replace(old_fn,new_fn,1)

    old_quick="if(r.workflow?.['Acceptance PDF URL'])a.push(`<a class=\"ghost\" target=\"_blank\" href=\"${esc(r.workflow['Acceptance PDF URL'])}\">Acceptance PDF</a>`);"
    new_quick="if(r.workflow?.['Acceptance PDF URL'])a.push(`<a class=\"ghost\" target=\"_blank\" href=\"${esc(r.workflow['Acceptance PDF URL'])}\">Acceptance PDF</a>`);if(r.workflow?.['Acceptance Signing URL'])a.push(`<a class=\"ghost\" target=\"_blank\" href=\"${esc(r.workflow['Acceptance Signing URL'])}\">Acceptance Link</a>`);"
    if old_quick not in s: raise SystemExit('Quick action acceptance anchor missing')
    s=s.replace(old_quick,new_quick,1)

    old_tab="[['Status','Acceptance Status'],['Received At','Acceptance Received At'],['Signed Name','Acceptance Signed Name'],['Signed At','Acceptance Signed At'],['Remarks','Acceptance Remarks'],['PDF URL','Acceptance PDF URL']]"
    new_tab="[['Status','Acceptance Status'],['Signing URL','Acceptance Signing URL'],['Received At','Acceptance Received At'],['Signed Name','Acceptance Signed Name'],['Signed At','Acceptance Signed At'],['Remarks','Acceptance Remarks'],['PDF URL','Acceptance PDF URL']]"
    if old_tab not in s: raise SystemExit('Acceptance detail anchor missing')
    s=s.replace(old_tab,new_tab,1)

p.write_text(s,encoding='utf-8')
