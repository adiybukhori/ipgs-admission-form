from pathlib import Path

p = Path('apps-script-v2/AiScreeningReportV2.js')
text = p.read_text(encoding='utf-8')
old = """  const screeningResult = String(qs['Screening Result'] || '').toUpperCase();
  // SAC-only hard-gate policy: once the deterministic screening route exists,
  // the official AI report may be finalised even when it carries unresolved flags.
  // Those flags are preserved for SAC review rather than creating a pre-SAC human block.
  const screeningResolved =
    !!screening &&
    !!recommendation &&
    /RULE_MATCHED|MANUAL_SCREENING_COMPLETED|COMPLETED|COMPLETED_WITH_FLAGS/.test(screeningResult);
"""
new = """  const screeningResult = String(qs['Screening Result'] || '').toUpperCase();
  const qualificationScreeningStatus = String(
    wf['Qualification Screening Status'] || ''
  ).toUpperCase();
  // SAC-only hard-gate policy: a deterministic route is resolved when either
  // the rule-engine result is conclusive OR the workflow has explicitly
  // completed screening with retained SAC flags. NO_MATCHING_RULE is therefore
  // a completed screening outcome, not a pre-SAC blocker.
  const screeningResolved =
    !!screening &&
    !!recommendation &&
    (
      /RULE_MATCHED|MANUAL_SCREENING_COMPLETED|COMPLETED|COMPLETED_WITH_FLAGS/.test(screeningResult) ||
      qualificationScreeningStatus === 'COMPLETED' ||
      qualificationScreeningStatus === 'COMPLETED_WITH_FLAGS'
    );
"""
if new in text:
    print('Screening report resolved-status policy already patched.')
elif old not in text:
    raise SystemExit('Screening report resolved-status anchor not found.')
else:
    text = text.replace(old, new, 1)
    p.write_text(text, encoding='utf-8')
    print('Screening report resolved-status policy patched.')
