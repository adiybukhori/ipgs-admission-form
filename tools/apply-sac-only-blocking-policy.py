from pathlib import Path


def replace_once(text, old, new, label):
    if new in text:
        print(f'{label}: already patched')
        return text
    if old not in text:
        raise SystemExit(f'{label}: anchor not found')
    return text.replace(old, new, 1)

# ------------------------------------------------------------
# 1) Qualification Screening: pending documents / unresolved AI
#    evidence may continue to READY_FOR_SAC. SAC is the hard gate.
# ------------------------------------------------------------
qpath = Path('apps-script-v2/QualificationScreeningV2.js')
q = qpath.read_text(encoding='utf-8')

q = replace_once(
    q,
    """  if (!application) throw new Error('V2 application record not found.');
  if (!workflow) throw new Error('V2 workflow record not found.');
  if (!documentReview || String(documentReview.record['Review Status'] || '') !== 'COMPLETE') {
    throw new Error('Qualification screening blocked: document review is not COMPLETE.');
  }
""",
    """  if (!application) throw new Error('V2 application record not found.');
  if (!workflow) throw new Error('V2 workflow record not found.');
  if (!documentReview) throw new Error('V2 document review record not found.');
  const documentReviewStatus = String(documentReview.record['Review Status'] || 'NOT_REVIEWED').toUpperCase();
  const documentQualityStatus = String(documentReview.record['AI Quality Status'] || 'NOT_REVIEWED').toUpperCase();
""",
    'qualification document gate'
)

q = replace_once(
    q,
    """  const programme = v2QualificationNormalizeProgramme_(application.record['Programme']);
  const qualificationLevel = v2QualificationResolveLevel_(application.record['Highest Qualification']);
  const fieldClassification = v2QualificationNormalizeField_(input.fieldClassification);
  const relevantWorkExperience = v2QualificationNormalizeWorkExperience_(input.relevantWorkExperience);
  const cgpa = v2QualificationParseCgpa_(application.record['Academic Result / CGPA / Grade']);

  if (!fieldClassification) {
    throw new Error('Field Classification is required: RELATED, PARTIALLY_RELATED or NON_RELATED.');
  }
  if (!relevantWorkExperience) {
    throw new Error('Relevant Work Experience is required: YES or NO.');
  }
  if (!qualificationLevel) {
    throw new Error('Qualification level could not be determined from Highest Qualification.');
  }
""",
    """  const programme = v2QualificationNormalizeProgramme_(application.record['Programme']);
  const qualificationLevel = v2QualificationResolveLevel_(application.record['Highest Qualification']) || 'UNKNOWN';
  const fieldClassification = v2QualificationNormalizeField_(input.fieldClassification) || 'UNKNOWN';
  const relevantWorkExperience = v2QualificationNormalizeWorkExperience_(input.relevantWorkExperience) || 'UNKNOWN';
  const cgpa = v2QualificationParseCgpa_(application.record['Academic Result / CGPA / Grade']);
""",
    'qualification unresolved input policy'
)

q = replace_once(
    q,
    """  const screeningStatus = manualReviewRequired ? 'MANUAL_REVIEW_REQUIRED' : 'COMPLETED';
  const nextStage = manualReviewRequired ? 'QUALIFICATION_SCREENING' : 'READY_FOR_SAC';
""",
    """  const screeningStatus = manualReviewRequired ? 'COMPLETED_WITH_FLAGS' : 'COMPLETED';
  // Operational policy: screening flags are carried forward. SAC is the only hard gate.
  const nextStage = 'READY_FOR_SAC';
""",
    'qualification next stage policy'
)

q = replace_once(
    q,
    """    'Screening Remarks': remarks,
""",
    """    'Screening Remarks': [
      remarks,
      documentReviewStatus !== 'COMPLETE' ? 'DOCUMENTS_PENDING_AT_SAC_GATE' : '',
      documentQualityStatus && documentQualityStatus !== 'PASS' ? ('DOCUMENT_QUALITY_' + documentQualityStatus) : ''
    ].filter(Boolean).join(' | '),
""",
    'qualification screening remarks'
)

q = replace_once(
    q,
    """    nextAction: manualReviewRequired ? 'MANUAL_ACADEMIC_REVIEW' : 'SAC_PREPARATION',
""",
    """    nextAction: 'SAC_PREPARATION',
    sacReviewRequired: manualReviewRequired || documentReviewStatus !== 'COMPLETE' || (documentQualityStatus && documentQualityStatus !== 'PASS'),
""",
    'qualification report next action'
)

q = replace_once(
    q,
    """    normal === 'RELATED' ||
    normal === 'PARTIALLY_RELATED' ||
    normal === 'NON_RELATED'
""",
    """    normal === 'RELATED' ||
    normal === 'PARTIALLY_RELATED' ||
    normal === 'NON_RELATED' ||
    normal === 'UNKNOWN'
""",
    'field normalization UNKNOWN'
)

q = replace_once(
    q,
    """  if (
    normal === 'NO' ||
    normal === 'N' ||
    normal === 'NOT RELEVANT'
  ) {
    return 'NO';
  }

  return '';
""",
    """  if (
    normal === 'NO' ||
    normal === 'N' ||
    normal === 'NOT RELEVANT'
  ) {
    return 'NO';
  }

  if (normal === 'UNKNOWN') return 'UNKNOWN';

  return '';
""",
    'experience normalization UNKNOWN'
)

qpath.write_text(q, encoding='utf-8')

# ------------------------------------------------------------
# 2) SAC assignment: this is the hard document/compliance gate.
#    Authorised exception may override, but remains auditable.
# ------------------------------------------------------------
wpath = Path('apps-script-v2/WorkflowV2.js')
w = wpath.read_text(encoding='utf-8')

w = replace_once(
    w,
    """  const w = workflow.record;

  // Preliminary Research Intent is tracked for PhD applications but is NON-BLOCKING.
""",
    """  const w = workflow.record;

  // SAC-ONLY HARD GATE POLICY:
  // Missing documents / quality follow-up may continue through screening,
  // but assignment into SAC is blocked until resolved or explicitly overridden.
  const documentReview = v2Find_('V2_DOCUMENT_REVIEW','Reference No',reference);
  const sacGateIssues = [];
  if (!documentReview) {
    sacGateIssues.push('DOCUMENT_REVIEW_NOT_FOUND');
  } else {
    const dr = documentReview.record || {};
    const reviewStatus = String(dr['Review Status'] || 'NOT_REVIEWED').toUpperCase();
    const qualityStatus = String(dr['AI Quality Status'] || 'NOT_REVIEWED').toUpperCase();
    const replacementStatus = String(dr['Replacement Request Status'] || '').toUpperCase();
    let missing = [];
    try { missing = JSON.parse(String(dr['Missing Documents JSON'] || '[]')); } catch (_) { missing = []; }
    if (reviewStatus !== 'COMPLETE' || (Array.isArray(missing) && missing.length)) {
      if (Array.isArray(missing) && missing.length) {
        missing.forEach(function(item){
          sacGateIssues.push('MISSING: ' + String((item && (item.label || item.key)) || 'Required Document'));
        });
      } else {
        sacGateIssues.push('DOCUMENT_REVIEW_' + reviewStatus);
      }
    }
    if (qualityStatus && qualityStatus !== 'PASS' && qualityStatus !== 'NOT_REVIEWED') {
      sacGateIssues.push('DOCUMENT_QUALITY_' + qualityStatus);
    }
    if (replacementStatus === 'AWAITING_STUDENT') {
      sacGateIssues.push('AWAITING_STUDENT_DOCUMENT');
    }
  }

  const overrideActor = String(data.overrideBy || actor || '').trim();
  const proceedWithPending = data.proceedWithPendingDocuments === true && data.confirmed === true && !!overrideActor;
  if (sacGateIssues.length && !proceedWithPending) {
    throw new Error('SAC gate blocked: ' + sacGateIssues.join(' | ') + '. Resolve pending documents or use authorised Proceed with Pending Document.');
  }
  const sacGateRemark = sacGateIssues.length
    ? ('SAC DOCUMENT EXCEPTION APPROVED by ' + overrideActor + ': ' + sacGateIssues.join(' | '))
    : '';

  // Preliminary Research Intent is tracked for PhD applications and is enforced at the SAC gate.
""",
    'SAC hard gate insertion'
)

w = replace_once(
    w,
    """      researchIntentRemark = 'Preliminary Research Intent: OUTSTANDING - follow up after SAC / during admission processing. Non-blocking.';
""",
    """      researchIntentRemark = 'Preliminary Research Intent: OUTSTANDING - SAC exception required to proceed.';
""",
    'research intent SAC wording'
)

w = replace_once(
    w,
    """    'Decision':'PENDING','Priority':data.priority || 'NORMAL','Reviewer Remarks':researchIntentRemark,'Decision At':'',
""",
    """    'Decision':'PENDING','Priority':data.priority || 'NORMAL','Reviewer Remarks':[researchIntentRemark,sacGateRemark].filter(Boolean).join(' | '),'Decision At':'',
""",
    'SAC candidate remarks'
)

w = replace_once(
    w,
    """  v2Audit_(reference,'SAC','ASSIGN_CANDIDATE',saved.previous,row,actor || 'Admin Portal','SUCCESS','');
""",
    """  v2Audit_(reference,'SAC','ASSIGN_CANDIDATE',saved.previous,row,actor || 'Admin Portal','SUCCESS',sacGateRemark);
""",
    'SAC assignment audit'
)

w = replace_once(
    w,
    """  return {ok:true, created:saved.created, candidate:row};
""",
    """  return {ok:true, created:saved.created, candidate:row, sacGateIssues:sacGateIssues, proceededWithPendingDocuments:proceedWithPending};
""",
    'SAC assignment response'
)

wpath.write_text(w, encoding='utf-8')

print('SAC-only blocking policy applied successfully.')
