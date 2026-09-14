from pathlib import Path
import re

p = Path('admin.html')
s = p.read_text(encoding='utf-8')

# Add the targeted applicant endpoint once.
if "const RECORD_API = '/api/admin-record';" not in s:
    marker = "    const ACTION_API = '/api/admin-action';\n"
    if marker not in s:
        raise SystemExit('ACTION_API marker not found')
    s = s.replace(marker, marker + "    const RECORD_API = '/api/admin-record';\n", 1)

# Full refresh may explicitly bypass server cache; ordinary loads may reuse it.
s = s.replace(
    "body:JSON.stringify({password})",
    "body:JSON.stringify({password,force})",
    1,
)

start = s.find('    async function runAdminAction(action,data,confirmText){')
end = s.find('    function runDocumentReview(){', start)
if start < 0 or end < 0:
    raise SystemExit('runAdminAction block markers not found')

replacement = r'''    // ADMIN_TARGETED_REFRESH_V1
    function renderSelectedApplicant(){
      if(!selected)return;
      renderProgress(selected);
      renderQuickActions(selected);
      renderOperationalActions(selected);
      renderDetailTabs(selected);
    }
    function applyOptimisticActionResult(action,data,result){
      if(!selected||selected.legacy)return;
      const r=result&&typeof result==='object'?result:{};
      selected.workflow={...(selected.workflow||{})};
      selected.sac={...(selected.sac||{})};
      selected.screening={...(selected.screening||{})};
      selected.ai={...(selected.ai||{})};
      selected.doc={...(selected.doc||{})};

      const stage=String(r.nextStage||r.applicationStage||'').trim();
      if(stage)selected.workflow['Application Stage']=stage;
      if(r.screeningStatus)selected.workflow['Qualification Screening Status']=r.screeningStatus;
      if(r.recommendedRoute){selected.workflow['Screening Recommendation']=r.recommendedRoute;selected.screening['Recommended Route']=r.recommendedRoute}
      if(r.offerStatus)selected.workflow['Offer Letter Status']=r.offerStatus;
      if(r.offerLetterPdfUrl)selected.workflow['Offer Letter PDF URL']=r.offerLetterPdfUrl;
      if(r.acceptanceSigningUrl)selected.workflow['Acceptance Signing URL']=r.acceptanceSigningUrl;
      if(r.acceptanceStatus)selected.workflow['Acceptance Status']=r.acceptanceStatus;

      if(action==='v2RecordSacDecisionManual'||action==='v2RecordSacDecision'){
        const decision=String(r.decision||data?.decision||'').toUpperCase();
        if(decision){selected.workflow['SAC Decision']=decision;selected.sac['Decision']=decision}
        if(!stage){
          if(decision==='DIRECT_ENTRY')selected.workflow['Application Stage']='ELIGIBLE_FOR_OFFER';
          else if(decision==='INTERNAL_ASSESSMENT')selected.workflow['Application Stage']='INTERNAL_ASSESSMENT';
          else if(decision==='REJECTED')selected.workflow['Application Stage']='REJECTED';
        }
      }
      if(action==='v2AssignSacCandidate'){
        selected.workflow['SAC Session ID']=data?.sessionId||selected.workflow['SAC Session ID']||'';
        selected.sac['SAC Session ID']=data?.sessionId||selected.sac['SAC Session ID']||'';
        if(!stage)selected.workflow['Application Stage']='SAC_REVIEW';
      }
      if(action==='v2CompleteManualQualificationScreening'){
        const route=String(r.recommendedRoute||data?.recommendedRoute||'');
        if(route){selected.workflow['Screening Recommendation']=route;selected.screening['Recommended Route']=route}
        selected.workflow['Qualification Screening Status']=r.screeningStatus||'COMPLETED_MANUAL';
        if(!stage)selected.workflow['Application Stage']='READY_FOR_SAC';
      }
      if(action==='v2RunAutoAiScreening'&&r.status)selected.ai['Status']=r.status;
      if(action==='v2RunDocumentReview'&&r.status)selected.workflow['Document Review Status']=r.status;
      if(action==='v2CompleteManualDocumentReview')selected.workflow['Document Review Status']=r.status||r.documentReviewStatus||'COMPLETE';

      renderSelectedApplicant();
    }
    function mergeTargetedApplicantData(referenceNo,delta){
      const ref=String(referenceNo||'').trim();
      if(!ref||!delta||typeof delta!=='object')return;
      const targetSheets=['V2_APPLICATIONS','V2_WORKFLOW','V2_DOCUMENT_REVIEW','V2_AI_SCREENING','V2_QUALIFICATION_SCREENING','V2_SAC_CANDIDATES','V2_ASSESSMENT_PROGRESS','V2_AUDIT_LOG'];
      targetSheets.forEach(name=>{
        if(!Array.isArray(delta[name]))return;
        const existing=Array.isArray(db[name])?db[name]:[];
        db[name]=existing.filter(row=>String(row?.['Reference No']||'').trim()!==ref).concat(delta[name]);
      });
      buildRecords();
      selected=records.find(x=>x.ref===ref)||selected;
      renderSelectedApplicant();
    }
    async function refreshApplicantRecord(referenceNo){
      const ref=String(referenceNo||'').trim();
      if(!ref)return null;
      const res=await fetch(RECORD_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,referenceNo:ref})});
      const out=await res.json().catch(()=>({ok:false,message:'Invalid targeted refresh response.'}));
      if(!res.ok||!out.ok)throw new Error(out.message||'Unable to refresh applicant.');
      mergeTargetedApplicantData(ref,out.data||{});
      return selected;
    }
    async function runAdminAction(action,data,confirmText){
      if(confirmText&&!confirm(confirmText))return null;
      opsMsg('Processing…','info');
      try{
        const res=await fetch(ACTION_API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password,action,data,updatedBy:'Admin Portal V2'})});
        const out=await res.json().catch(()=>({ok:false,message:'Invalid response from action service.'}));
        if(!res.ok||!out.ok)throw new Error(out.message||'Unable to complete action.');
        const result=out.result||out;
        const ref=selected?.ref||data?.referenceNo||'';
        applyOptimisticActionResult(action,data,result);
        opsMsg('Saved successfully. Syncing this applicant…','ok');
        if(ref){
          refreshApplicantRecord(ref)
            .then(()=>opsMsg('Saved successfully.','ok'))
            .catch(()=>opsMsg('Saved successfully. Use Refresh if you need to verify the latest backend data.','ok'));
        }else{
          opsMsg('Saved successfully.','ok');
        }
        return result;
      }catch(e){opsMsg(e.message||'Unable to complete action.','error');return null}
    }
'''

s = s[:start] + replacement + s[end:]

p.write_text(s, encoding='utf-8')
print('admin.html targeted refresh patch applied')
