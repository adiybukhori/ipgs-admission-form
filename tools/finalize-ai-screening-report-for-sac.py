from pathlib import Path

p = Path('apps-script-v2/AiScreeningReportV2.js')
text = p.read_text(encoding='utf-8')

def repl(old, new, label):
    global text
    if new in text:
        print(label + ': already patched')
        return
    if old not in text:
        raise SystemExit(label + ': anchor not found')
    text = text.replace(old, new, 1)

repl(
"""  const screeningResolved =
    !!screening &&
    !!recommendation &&
    !manualRequired &&
    /RULE_MATCHED|MANUAL_SCREENING_COMPLETED|COMPLETED/.test(screeningResult);

  // A PDF may be generated at any point for review, but FINAL is reserved for
  // a case whose deterministic qualification screening route is already resolved.
  const finalised = requestedFinal && screeningResolved;
  const reportStatus = finalised
    ? 'FINAL'
    : (manualRequired ? 'PENDING_HUMAN_REVIEW' : (!screeningResolved ? 'PENDING_RULE_ENGINE' : 'SCREENED'));
""",
"""  // SAC-only hard-gate policy: once the deterministic screening route exists,
  // the official AI report may be finalised even when it carries unresolved flags.
  // Those flags are preserved for SAC review rather than creating a pre-SAC human block.
  const screeningResolved =
    !!screening &&
    !!recommendation &&
    /RULE_MATCHED|MANUAL_SCREENING_COMPLETED|COMPLETED|COMPLETED_WITH_FLAGS/.test(screeningResult);

  const finalised = requestedFinal && screeningResolved;
  const reportHasFlags = manualRequired || unresolvedFlags.length > 0;
  const reportStatus = finalised
    ? (reportHasFlags ? 'FINAL_WITH_FLAGS' : 'FINAL')
    : (!screeningResolved ? 'PENDING_RULE_ENGINE' : 'SCREENED');
""",
'report finalisation policy')

repl(
"""  if (manualRequired || unresolvedFlags.length) {
    v2AiReportSection_(body, '6. Human Confirmation / Exception');
    const humanRows = [['ITEM', 'STATUS / ACTION']];
    if (unresolvedFlags.length) {
      unresolvedFlags.forEach(function(flag) {
        humanRows.push([String(flag), 'Human confirmation or additional evidence required before the screening route is finalised.']);
      });
    }
    if (String(qs['Manual Review Required'] || wf['Manual Review Required'] || '').toUpperCase() === 'YES') {
      humanRows.push(['Qualification rule exception', 'Authorised manual academic review is required.']);
    }
    const humanTable = body.appendTable(humanRows);
    v2AiReportStyleGrid_(humanTable, [0]);
  }

  v2AiReportSection_(body, manualRequired ? '7. AI Screening Declaration' : '6. AI Screening Declaration');
""",
"""  if (manualRequired || unresolvedFlags.length) {
    v2AiReportSection_(body, '6. SAC Review Flags / Exceptions');
    const humanRows = [['ITEM', 'STATUS / ACTION']];
    if (unresolvedFlags.length) {
      unresolvedFlags.forEach(function(flag) {
        humanRows.push([String(flag), 'Flag retained for SAC review. Student follow-up may continue in parallel.']);
      });
    }
    if (String(qs['Manual Review Required'] || wf['Manual Review Required'] || '').toUpperCase() === 'YES') {
      humanRows.push(['Qualification rule exception', 'Flag retained for authorised SAC consideration; screening progression is not blocked.']);
    }
    const humanTable = body.appendTable(humanRows);
    v2AiReportStyleGrid_(humanTable, [0]);
  }

  v2AiReportSection_(body, (manualRequired || unresolvedFlags.length) ? '7. AI Screening Declaration' : '6. AI Screening Declaration');
""",
'SAC review flags section')

repl(
"""      reportStatus: reportStatus,
      reportVersion: version,
      fileName: fileName,
""",
"""      reportStatus: reportStatus,
      reportVersion: version,
      sacReviewRequired: reportHasFlags,
      fileName: fileName,
""",
'audit SAC review flag')

repl(
"""    reportStatus: reportStatus,
    reportVersion: version,
    finalised: finalised,
""",
"""    reportStatus: reportStatus,
    reportVersion: version,
    finalised: finalised,
    sacReviewRequired: reportHasFlags,
""",
'return SAC review flag')

p.write_text(text, encoding='utf-8')
print('AI Screening Report updated for SAC-only blocking policy.')
