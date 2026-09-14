from pathlib import Path

workflow = Path('apps-script-v2/WorkflowV2.js')
text = workflow.read_text(encoding='utf-8')

replacements = [
    ("""  const allowedVotes = [
    'DIRECT_ENTRY',
    'INTERNAL_ASSESSMENT',
    'PREREQUISITE',
    'REJECTED'
  ];""",
     """  const allowedVotes = [
    'DIRECT_ENTRY',
    'INTERNAL_ASSESSMENT',
    'REJECTED'
  ];"""),
    ("""      'DIRECT_ENTRY',
      'INTERNAL_ASSESSMENT',
      'PREREQUISITE',
      'REJECTED'""",
     """      'DIRECT_ENTRY',
      'INTERNAL_ASSESSMENT',
      'REJECTED'"""),
    ("""  const nextStage =
  decision === 'DIRECT_ENTRY'
    ? 'ELIGIBLE_FOR_OFFER'
    : decision === 'INTERNAL_ASSESSMENT'
      ? 'INTERNAL_ASSESSMENT'
      : decision === 'PREREQUISITE'
        ? 'PREREQUISITE'
        : 'REJECTED';""",
     """  const nextStage =
  decision === 'DIRECT_ENTRY'
    ? 'ELIGIBLE_FOR_OFFER'
    : decision === 'INTERNAL_ASSESSMENT'
      ? 'INTERNAL_ASSESSMENT'
      : 'REJECTED';"""),
    ("""const letterAction =
  decision === 'DIRECT_ENTRY'
    ? 'OFFER_READY'
    : decision === 'INTERNAL_ASSESSMENT'
      ? 'COL_IA_READY'
      : decision === 'PREREQUISITE'
        ? 'COL_PREREQUISITE_READY'
        : 'DECISION_NOTICE_READY';""",
     """const letterAction =
  decision === 'DIRECT_ENTRY'
    ? 'OFFER_READY'
    : decision === 'INTERNAL_ASSESSMENT'
      ? 'COL_IA_READY'
      : 'DECISION_NOTICE_READY';"""),
    ("""'Prerequisite Status':
  decision === 'PREREQUISITE'
    ? 'REQUIRED'
    : 'NOT_REQUIRED',""",
     """'Prerequisite Status':'NOT_REQUIRED',"""),
    ("""  if (
    decision === 'INTERNAL_ASSESSMENT' ||
    decision === 'PREREQUISITE'
  ) {
    v2CreateAssessmentAccount_(
      workflow.record,
      actor || 'SAC Reviewer'
    );
  }""",
     """  if (decision === 'INTERNAL_ASSESSMENT') {
    v2CreateAssessmentAccount_(
      workflow.record,
      actor || 'SAC Reviewer'
    );
  }"""),
    ("""    const prerequisiteFromIa =
      String(
        workflow.record['Assessment Status'] || ''
      ) === 'COMPLETED_PREREQUISITE_REQUIRED';

    const prerequisiteFromSac =
      String(
        workflow.record['SAC Decision'] || ''
      ) === 'PREREQUISITE';

    if (
      !prerequisiteFromIa &&
      !prerequisiteFromSac
    ) {
      throw new Error(
        'Prerequisite can only start after SAC endorsement or Internal Assessment panel confirmation.'
      );
    }""",
     """    const prerequisiteFromIa =
      String(
        workflow.record['Assessment Status'] || ''
      ) === 'COMPLETED_PREREQUISITE_REQUIRED';

    if (!prerequisiteFromIa) {
      throw new Error(
        'Prerequisite can only start after Internal Assessment panel confirmation.'
      );
    }""")
]

changed = False
for old, new in replacements:
    if old in text:
        text = text.replace(old, new, 1)
        changed = True

# Keep historic count fields readable, but block any new direct PREREQUISITE vote/decision.
policy_marker = "function v2RecordSacDecision_(data, actor) {"
policy_comment = "// SAC_POLICY_V2: Direct prerequisite is prohibited. Prerequisite may only arise after IA.\n"
if policy_comment not in text and policy_marker in text:
    text = text.replace(policy_marker, policy_comment + policy_marker, 1)
    changed = True

if not changed:
    raise SystemExit('No WorkflowV2 prerequisite policy targets changed.')
workflow.write_text(text, encoding='utf-8')

screening = Path('apps-script-v2/QualificationScreeningV2.js')
s = screening.read_text(encoding='utf-8')
old1 = "'Recommended Route': 'PREREQUISITE_OR_BRIDGING_REVIEW',"
new1 = "'Recommended Route': 'INTERNAL_ASSESSMENT',"
old2 = "'Regulatory verification required before imposing prerequisite. May become IUC readiness/bridging route.',"
new2 = "'Non-related Bachelor degree without verified relevant experience. Route to Internal Assessment first; prerequisite may only be required after the IA result.',"
old3 = "'Recommended Route': 'PREREQUISITE',"
new3 = "'Recommended Route': 'INTERNAL_ASSESSMENT',"
old4 = "'Non-related Master qualification without sufficient relevant experience.',"
new4 = "'Non-related Master qualification without sufficient relevant experience. Route to Internal Assessment first; prerequisite may only be required after the IA result.',"
for old, new in [(old1,new1),(old2,new2),(old3,new3),(old4,new4)]:
    if old in s:
        s = s.replace(old,new,1)

screening.write_text(s, encoding='utf-8')
print('Enforced prerequisite-after-IA policy across SAC and qualification screening.')
