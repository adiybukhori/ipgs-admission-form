# CS-ADM-V2 Controlled Test Harness

Use these tests only after the four n8n workflows are imported, configured and activated.

## Preconditions

- Dedicated n8n project: `IUC | Campus Simulation | Admission V2`
- Active workflows:
  - `CS-ADM-V2 | 91 ACTION GATEWAY`
  - `CS-ADM-V2 | 02 ADMISSION INTELLIGENCE`
  - `CS-ADM-V2 | 00 ORCHESTRATOR`
  - `CS-ADM-V2 | 90 EVENT INGRESS`
- Apps Script properties:
  - `N8N_EVENT_WEBHOOK_URL`
  - `N8N_EVENT_SHARED_SECRET`
  - `N8N_AGENTIC_ENABLED=TRUE`
- Test application has `Document Review Status = COMPLETE`.
- Use a controlled/test application first. Do not start with a high-risk live case.

## Test A — Clean academic case

Expected path:

`DOCUMENT_REVIEW_COMPLETED`
→ Orchestrator
→ Admission Intelligence
→ Read State Before
→ verify document review COMPLETE
→ `RUN_ADMISSION_INTELLIGENCE`
→ AI reviews certificate + transcript + CV/resume
→ rule engine applies approved route
→ official AI screening PDF generated
→ Read State After
→ verification succeeds
→ `READY_FOR_SAC`

Expected evidence:

- `V2_AGENT_EVENTS`
  - DOCUMENT_REVIEW_COMPLETED
  - AGENT_TASK_STARTED
  - AGENT_TASK_COMPLETED
- `V2_AGENT_EXECUTIONS`
  - one execution with status COMPLETED
- `V2_AI_SCREENING`
  - Field Classification populated
  - Relevant Work Experience populated
  - Report Status = FINAL
  - Report PDF URL / File ID present
- Student folder contains correctly named FINAL PDF.
- Screening Module displays AI result and Open Official PDF.
- SAC pack manifest contains `aiScreeningReport`.
- AI Operations Center reflects Admission Intelligence activity.

## Test B — Foreign grade / human confirmation

Use a controlled applicant whose transcript uses percentage, division or another foreign grading format without an approved IUC equivalency.

Expected path:

`DOCUMENT_REVIEW_COMPLETED`
→ Admission Intelligence
→ AI extracts exact academic result
→ `gradeEquivalencyStatus=PENDING_IUC_CONFIRMATION`
→ rule engine is NOT allowed to silently interpret percentage as CGPA
→ agent result = REVIEW_REQUIRED
→ HUMAN_TASK_CREATED
→ AI report remains `PENDING_HUMAN_REVIEW`
→ Human Decision Desk shows the case

Expected evidence:

- No percentage such as 71.20% is parsed as CGPA 71.20 or 3.xx.
- No FINAL report before authorised resolution.
- ACC AI Office shows Admission Intelligence = WAITING.
- Human desk shows the same student/reference and reason.
- SAC print pack reports Final AI Admission Screening Report as missing until finalised.

## Test C — Idempotency

Replay the exact same Action Gateway payload with the same `executionId`.

Expected:

- no duplicate AI action
- no duplicate email/action side effects
- gateway returns `idempotentReplay=true`
- existing result is returned from `V2_AGENT_EXECUTIONS`

## Test D — n8n unavailable

Temporarily make the n8n event URL unavailable while agentic mode is enabled, then run controlled Document Review.

Expected:

- event delivery records failure
- application does not become stuck
- existing local AI auto-screening fallback executes
- audit records the handoff failure
- no unrelated workflow is modified

## Verification rule

A task is not complete merely because an HTTP call returned success.

Production definition:

`REQUESTED → EXECUTED → VERIFIED → COMPLETED`

If verification fails:

`NEEDS_INVESTIGATION / WAITING_HUMAN → retry or authorised resolution → verify again`.
