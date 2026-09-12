from pathlib import Path

p = Path('admin.html')
s = p.read_text(encoding='utf-8')

old = '''      if(s==='APPLICATION_RECEIVED'){
        copy='Start the formal document-review stage for this applicant.';
        actions='<button class="ops-btn primary" onclick="startDocumentReview()">Start Document Review</button>';
      }else if(s==='DOCUMENT_REVIEW'){
        copy='Document Review is active. Complete / Incomplete verification remains governed by the dedicated Document Review module.';
        actions='<button class="ops-btn" disabled>Complete Review — module route pending</button>';
      }else if(s==='QUALIFICATION_SCREENING'){
        copy='Qualification Screening is active. The rule-engine result must be recorded before SAC preparation.';
        actions='<button class="ops-btn" disabled>Run Screening — module route pending</button>';
'''
new = '''      if(s==='APPLICATION_RECEIVED'){
        copy='Run the V2 document completeness check. The system will compare submitted files against the required document set.';
        actions='<button class="ops-btn primary" onclick="runDocumentReview()">Run Document Review</button>';
      }else if(s==='DOCUMENT_REVIEW'){
        const docStatus=String(r.workflow?.['Document Review Status']||r.doc?.['Review Status']||'PENDING').toUpperCase();
        if(docStatus==='COMPLETE'){
          copy='Documents are complete. Set the academic field relationship and relevant work-experience status, then run qualification screening.';
          const field=String(r.workflow?.['Field Classification']||r.screening?.['Field Classification']||'');
          const exp=String(r.workflow?.['Relevant Work Experience']||r.screening?.['Relevant Work Experience']||'');
          actions=`<select id="opsFieldClassification" class="ops-select"><option value="">Field relationship</option><option value="RELATED" ${field==='RELATED'?'selected':''}>Related</option><option value="PARTIALLY_RELATED" ${field==='PARTIALLY_RELATED'?'selected':''}>Partially Related</option><option value="NON_RELATED" ${field==='NON_RELATED'?'selected':''}>Non-Related</option></select><select id="opsWorkExperience" class="ops-select"><option value="">Relevant work experience</option><option value="YES" ${exp==='YES'?'selected':''}>Yes</option><option value="NO" ${exp==='NO'?'selected':''}>No</option></select><button class="ops-btn primary" onclick="runQualificationScreening()">Run Screening</button>`;
        }else{
          let missing=[];try{missing=JSON.parse(r.doc?.['Missing Documents JSON']||'[]')}catch(_){}const labels=Array.isArray(missing)?missing.map(x=>x?.label||x?.key||x).filter(Boolean):[];
          copy=docStatus==='INCOMPLETE'?(labels.length?`Documents incomplete: ${labels.join(', ')}. Upload the missing document(s) to the student folder/application record, then re-run the check.`:'Documents are incomplete. Upload the missing document(s), then re-run the check.'):'Document Review is ready to run.';
          actions='<button class="ops-btn primary" onclick="runDocumentReview()">'+(docStatus==='INCOMPLETE'?'Re-run Document Review':'Run Document Review')+'</button>';
        }
      }else if(s==='QUALIFICATION_SCREENING'){
        copy='Qualification Screening is active. Confirm field relationship and relevant work experience, then run the V2 rule engine.';
        const field=String(r.workflow?.['Field Classification']||r.screening?.['Field Classification']||'');
        const exp=String(r.workflow?.['Relevant Work Experience']||r.screening?.['Relevant Work Experience']||'');
        actions=`<select id="opsFieldClassification" class="ops-select"><option value="">Field relationship</option><option value="RELATED" ${field==='RELATED'?'selected':''}>Related</option><option value="PARTIALLY_RELATED" ${field==='PARTIALLY_RELATED'?'selected':''}>Partially Related</option><option value="NON_RELATED" ${field==='NON_RELATED'?'selected':''}>Non-Related</option></select><select id="opsWorkExperience" class="ops-select"><option value="">Relevant work experience</option><option value="YES" ${exp==='YES'?'selected':''}>Yes</option><option value="NO" ${exp==='NO'?'selected':''}>No</option></select><button class="ops-btn primary" onclick="runQualificationScreening()">Run Screening</button>`;
'''
if old not in s:
    raise SystemExit('Operational stage block marker not found')
s = s.replace(old, new, 1)

old_fn = "    function startDocumentReview(){if(!selected)return;runAdminAction('v2UpdateStage',{referenceNo:selected.ref,stage:'DOCUMENT_REVIEW'},`Start Document Review for ${selected.app['Student Name']||selected.ref}?`)}\n"
new_fn = "    function runDocumentReview(){if(!selected)return;runAdminAction('v2RunDocumentReview',{referenceNo:selected.ref,remarks:''},`Run document review for ${selected.app['Student Name']||selected.ref}?`)}\n    function runQualificationScreening(){if(!selected)return;const field=document.getElementById('opsFieldClassification')?.value||'',exp=document.getElementById('opsWorkExperience')?.value||'';if(!field||!exp)return opsMsg('Select Field Relationship and Relevant Work Experience first.','error');runAdminAction('v2RunQualificationScreening',{referenceNo:selected.ref,fieldClassification:field,relevantWorkExperience:exp,remarks:''},`Run qualification screening for ${selected.app['Student Name']||selected.ref}?`)}\n"
if old_fn not in s:
    raise SystemExit('startDocumentReview marker not found')
s = s.replace(old_fn, new_fn, 1)

old_guide = '<div class="guide-callout amber" style="margin-top:10px"><b>Operational actions:</b> workflow-changing buttons such as document review completion, screening, SAC finalisation, IA/PREREQ result updates and offer generation will be activated only after the protected V2 action routes are safely connected.</div>'
new_guide = '<div class="guide-callout green" style="margin-top:10px"><b>Operational actions:</b> protected V2 actions are connected for Document Review, Qualification Screening, SAC routing/decision and IA/PREREQ result updates. Offer generation remains separately gated until its final production activation.</div>'
if old_guide in s:
    s = s.replace(old_guide, new_guide, 1)

s = s.replace("['SAC',r=>stage(r)==='SAC']", "['SAC',r=>/SAC_REVIEW|SAC/.test(stage(r))]", 1)
s = s.replace("stage(r)==='SAC'||(/SAC/.test(String(r.workflow?.['SAC Session ID']||''))&&!r.workflow?.['SAC Decision'])", "/SAC_REVIEW|SAC/.test(stage(r))||(/SAC/.test(String(r.workflow?.['SAC Session ID']||''))&&!r.workflow?.['SAC Decision'])", 1)

p.write_text(s, encoding='utf-8')
print('Admin V2 live operations UI patched.')
