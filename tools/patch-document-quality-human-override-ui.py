from pathlib import Path

p = Path('admin.html')
text = p.read_text(encoding='utf-8')

fn_start = text.find('    function documentQualityPanel(r){')
fn_end = text.find('\n    function ', fn_start + 10)
if fn_start < 0 or fn_end < 0:
    raise SystemExit('documentQualityPanel function not found')
segment = text[fn_start:fn_end]

run_line = "      const runButton=canRun?'<button class=\"ops-btn\" onclick=\"runComplianceQualityReview()\">'+(status==='NOT_RUN'?'Run AI Document Quality Review':'Re-run AI Document Quality Review')+'</button>':'';"
if run_line not in segment:
    raise SystemExit('Document-quality run button anchor not found')

override_lines = run_line + "\n" + "      const canOverride=canRun&&['HUMAN_REVIEW_REQUIRED','FOLLOW_UP_REQUIRED'].includes(status);\n      const overrideButton=canOverride?'<button class=\"ops-btn primary\" onclick=\"approveDocumentQualityHumanOverride()\">Human Override → Next Stage</button>':'';"
segment = segment.replace(run_line, override_lines, 1)

if 'overrideButton' not in segment:
    raise SystemExit('Override button definition was not inserted')
if 'runButton+overrideButton+' not in segment:
    if 'runButton+' not in segment:
        raise SystemExit('runButton render anchor not found')
    segment = segment.replace('runButton+', 'runButton+overrideButton+', 1)

text = text[:fn_start] + segment + text[fn_end:]

anchor = "    function runComplianceQualityReview(){if(!selected)return;runAdminAction('v2RunComplianceDocumentQuality',{referenceNo:selected.ref},`Run Compliance & Records AI document-quality inspection for ${selected.app['Student Name']||selected.ref}? This checks document usability and does not make an academic admission decision.`)}"
if anchor not in text:
    raise SystemExit('runComplianceQualityReview anchor not found')

new_fn = r'''
    async function approveDocumentQualityHumanOverride(){
      if(!selected)return;
      const ref=selected.ref;
      const name=selected.app?.['Student Name']||ref;
      const reasonRaw=prompt('Authorised Human Override\n\nEnter the reason this case may proceed despite the AI document-quality finding. The reason will be stored in the audit trail.');
      if(reasonRaw===null)return;
      const reason=String(reasonRaw||'').trim();
      if(reason.length<8)return opsMsg('Enter a clear override reason (minimum 8 characters).','error');
      if(!confirm(`AUTHORISE EXCEPTION for ${name}?\n\nThe original AI document-quality finding will remain recorded. Your decision, reason, date/time and reviewer will be audited. Deterministic required-document completeness cannot be bypassed.\n\nProceed to Academic Screening?`))return;

      const listed=await runAdminAction('v2ListOpenHumanTasks',{},'');
      if(!listed)return;
      let task=(listed.tasks||[]).find(t=>String(t['Reference No']||'')===String(ref)&&String(t['Task Type']||'').toUpperCase()==='DOCUMENT_QUALITY_REVIEW');

      if(!task){
        const created=await runAdminAction('v2CreateHumanTask',{
          referenceNo:ref,
          taskType:'DOCUMENT_QUALITY_REVIEW',
          title:'Authorised document-quality exception review',
          reason:'Admin requested a governed human exception after reviewing the AI document-quality finding.',
          raisedByAgent:'Admin Portal V2',
          agentId:'COMPLIANCE',
          priority:'NORMAL',
          assignedTo:'Registry / Authorised Reviewer',
          resumeEvent:'HUMAN_TASK_COMPLETED',
          source:'ADMIN_PORTAL_V2'
        },'');
        if(!created)return;
        task=created.task||null;
      }

      const taskId=task?.['Task ID']||task?.taskId||'';
      if(!taskId)return opsMsg('Unable to create or locate the human-review task. Refresh and try again.','error');

      const resolved=await runAdminAction('v2ResolveHumanTask',{
        taskId,
        decision:'APPROVE',
        notes:reason,
        resolution:{
          documentQualityDecision:'APPROVED_TO_PROCEED',
          qualityNotes:reason
        }
      },'');
      if(!resolved)return;
      opsMsg('Human override approved. AI finding preserved; case progressed to Academic Screening.','ok');
      await refreshSelectedApplicantTargeted(ref).catch(()=>null);
      renderSelectedApplicant();
    }'''

if 'async function approveDocumentQualityHumanOverride()' not in text:
    text = text.replace(anchor, anchor + new_fn, 1)

p.write_text(text, encoding='utf-8')
print('Patched document-quality governed human override UI.')
