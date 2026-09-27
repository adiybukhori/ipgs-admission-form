from pathlib import Path

path = Path('apps-script-v2/HumanTaskV2.js')
text = path.read_text(encoding='utf-8')
start_marker = "  if (taskType==='DOCUMENT_QUALITY_REVIEW' && ['APPROVE','CONFIRM','RESOLVED','REQUEST_EVIDENCE','RETURN'].indexOf(decision)>-1) {"
end_marker = "\n\n  if (taskType==='ADMISSION_SCREENING_REVIEW'"
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('Document quality human-resolution block not found')

new_block = r'''  if (taskType==='DOCUMENT_QUALITY_REVIEW' && ['APPROVE','CONFIRM','RESOLVED','REQUEST_EVIDENCE','RETURN'].indexOf(decision)>-1) {
    const doc=v2Find_('V2_DOCUMENT_REVIEW','Reference No',reference);
    const wf=v2Find_('V2_WORKFLOW','Reference No',reference);
    if (!doc || !wf) throw new Error('Document review/workflow record not found for human quality resolution.');

    let qualityDecision=String(
      resolution.documentQualityDecision ||
      (['APPROVE','CONFIRM','RESOLVED'].indexOf(decision)>-1 ? 'APPROVED_TO_PROCEED' : 'FOLLOW_UP_REQUIRED')
    ).toUpperCase();
    // Backward compatibility for older callers that used PASS as the human decision.
    if (qualityDecision==='PASS') qualityDecision='APPROVED_TO_PROCEED';
    if (['APPROVED_TO_PROCEED','FOLLOW_UP_REQUIRED'].indexOf(qualityDecision)<0) {
      throw new Error('Document quality human resolution must be APPROVED_TO_PROCEED or FOLLOW_UP_REQUIRED.');
    }

    const qualityNotes=String(
      resolution.replacementInstruction ||
      resolution.qualityNotes ||
      input.notes ||
      input.resolutionNotes || ''
    ).trim();
    if (!qualityNotes) throw new Error('Human document-quality resolution requires a reason / note.');

    const originalAiStatus=String(doc.record['AI Quality Status']||'NOT_RUN').toUpperCase();
    const currentStage=String(wf.record['Application Stage']||'').toUpperCase();
    const reviewStatus=String(doc.record['Review Status']||wf.record['Document Review Status']||'').toUpperCase();
    const approved=qualityDecision==='APPROVED_TO_PROCEED';

    if (approved) {
      if (reviewStatus!=='COMPLETE') {
        throw new Error('Human quality override cannot bypass deterministic document completeness. Complete the required document review first.');
      }
      if (currentStage==='DOCUMENT_REVIEW') {
        // Preflight the governed transition before writing any resolution fields.
        v2AssertStageGate_(reference,'QUALIFICATION_SCREENING');
      }
    }

    const workflowQualityStatus=approved ? 'HUMAN_OVERRIDE_APPROVED' : 'FOLLOW_UP_REQUIRED';
    v2UpdateRow_(doc.sheet,doc.rowNumber,{
      // Preserve AI Quality Status as the original AI finding. Human authority is recorded separately.
      'Human Quality Decision':qualityDecision,
      'Human Quality Notes':qualityNotes,
      'Human Quality Reviewed At':now,
      'Human Quality Reviewed By':resolvedBy,
      'Last Updated':now
    });
    v2UpdateRow_(wf.sheet,wf.rowNumber,{
      'Document Quality Status':workflowQualityStatus,
      'Document Quality Reviewed At':now,
      'Document Quality Reviewed By':resolvedBy,
      'Last Updated':now,
      'Updated By':resolvedBy
    });

    let stageTransition=null;
    if (approved && currentStage==='DOCUMENT_REVIEW') {
      stageTransition=v2UpdateStage_({
        referenceNo:reference,
        stage:'QUALIFICATION_SCREENING',
        remarks:'Authorised human document-quality exception. AI finding preserved; human reason: '+qualityNotes
      },resolvedBy);
    }

    documentQualityResolution={
      status:workflowQualityStatus,
      humanDecision:qualityDecision,
      aiStatus:originalAiStatus,
      notes:qualityNotes,
      stageTransition:stageTransition,
      nextAction:approved ? 'ADMISSION_INTELLIGENCE' : 'STUDENT_DOCUMENT_REPLACEMENT'
    };

    if (typeof v2EmitAgentEvent_==='function') {
      v2EmitAgentEvent_({
        referenceNo:reference,
        eventType:approved ? 'DOCUMENT_QUALITY_HUMAN_OVERRIDE_APPROVED' : 'DOCUMENT_REPLACEMENT_REQUIRED',
        agentId:'COMPLIANCE',
        agentName:'Compliance & Records Agent',
        action:approved ? 'ROUTE_ADMISSION_INTELLIGENCE' : 'STUDENT_DOCUMENT_REPLACEMENT',
        status:approved ? 'COMPLETED' : 'WAITING',
        fromStage:'DOCUMENT_REVIEW',
        toStage:approved ? 'QUALIFICATION_SCREENING' : 'DOCUMENT_REVIEW',
        requiresHuman:false,
        executionId:String(found.record['Related Execution ID']||''),
        source:'HUMAN_DECISION_DESK',
        summary:approved
          ? 'Authorised human exception approved progression to academic screening while preserving the AI document-quality finding.'
          : 'Authorised human review requires replacement document(s) before academic screening.',
        data:{taskId:taskId,decision:decision,qualityDecision:qualityDecision,aiStatus:originalAiStatus,notes:qualityNotes}
      });
    }
  }'''

patched = text[:start] + new_block + text[end:]
if patched == text:
    raise SystemExit('No changes made')
path.write_text(patched, encoding='utf-8')
print('Patched governed document-quality human override.')
