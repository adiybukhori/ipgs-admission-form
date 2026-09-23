# CS-ADM-V2 Controlled Test Harness

Use these tests only after the required CS-ADM-V2 n8n workflows are imported, configured and activated.

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

`DOCUMENT_COMPLETENESS_CONFIRMED`
→ Orchestrator
→ Compliance & Records Agent
→ document quality PASS
→ `DOCUMENT_QUALITY_PASSED`
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


## Test E — Poor / cropped document

Use a controlled application where deterministic completeness is COMPLETE but one required file is clearly unusable, e.g. materially cropped transcript, unreadable scan or wrong document.

Expected:
- Compliance Agent runs before Admission Intelligence.
- AI Quality Status = FOLLOW_UP_REQUIRED.
- AI Quality Follow-up JSON identifies the affected document and reason.
- DOCUMENT_REPLACEMENT_REQUIRED is written to V2_AGENT_EVENTS.
- Admission Intelligence does NOT run.
- Student remains before qualification screening until replacement is supplied.

## Test F — Ambiguous document / identity inconsistency

Use a controlled case where a visible name/detail conflict or ambiguous document-quality concern exists.

Expected:
- AI Quality Status = HUMAN_REVIEW_REQUIRED.
- Durable V2_HUMAN_TASKS item with Task Type = DOCUMENT_QUALITY_REVIEW.
- Human Decision Desk displays the task.
- Admission Intelligence does NOT run until authorised resolution and PASS state are recorded.

## Test G — Compliance gate enforcement

Attempt to call RUN_ADMISSION_INTELLIGENCE for a case with deterministic Review Status COMPLETE but Document Quality Status not PASS.

Expected:
- Action Gateway rejects the action.
- No academic screening result is written.
- Failure is auditable.


## Test H — Student replacement loop

Start from a controlled case with AI Quality Status = FOLLOW_UP_REQUIRED.

Expected:
- Orchestrator assigns Student Concierge.
- Student Concierge creates a secure replacement token/link.
- Replacement Request Status = AWAITING_STUDENT.
- Notification status is recorded.
- Applicant upload page lists only the requested document fields and the AI quality instruction.
- Applicant must upload all requested replacements.
- Previous Drive files are renamed with SUPERSEDED_ timestamp and retained for audit.
- Uploaded Files JSON points to the new canonical files.
- Replacement Request Status = RECEIVED.
- Document Quality Status becomes PENDING_REVIEW.
- DOCUMENT_REPLACEMENT_RECEIVED routes back to Compliance.
- Admission Intelligence remains blocked until the new Compliance result is PASS.


## Test I — SAC Direct Entry

Use a controlled READY_FOR_SAC applicant with a complete SAC pack.

Expected:
- SAC / IA Agent assigns the applicant to an open SAC session.
- SAC pack is prepared and verified.
- SAC_DECISION_REQUIRED is created.
- No SAC decision is auto-selected.
- Human records DIRECT_ENTRY.
- Workflow moves to ELIGIBLE_FOR_OFFER.
- No IA or prerequisite task is created.

## Test J — SAC to IA, IA Qualified

Expected:
- Human SAC decision = INTERNAL_ASSESSMENT.
- Workflow moves to INTERNAL_ASSESSMENT.
- SAC / IA Agent creates / verifies IA progress.
- IA_OUTCOME_REQUIRED is created.
- Human IA outcome = QUALIFIED.
- Workflow moves to ELIGIBLE_FOR_OFFER.

## Test K — SAC to IA to Prerequisite

Expected:
- Human SAC decision = INTERNAL_ASSESSMENT.
- Human IA outcome = PREREQUISITE_REQUIRED.
- Workflow moves to PREREQUISITE.
- SAC / IA Agent creates / verifies prerequisite progress.
- PREREQUISITE_OUTCOME_REQUIRED is created.
- Human prerequisite result = QUALIFIED.
- Workflow moves to ELIGIBLE_FOR_OFFER.
- Verify no direct SAC -> prerequisite path exists.

## Test L — No SAC session available

Expected:
- Applicant remains READY_FOR_SAC.
- SAC_SESSION_REQUIRED appears in V2_HUMAN_TASKS / ACC Decision Desk.
- Human may select an existing session or create a controlled draft session from Decision Desk.
- After session confirmation, the agent assigns the candidate, prepares the pack and creates SAC_DECISION_REQUIRED.


## Test M — Accepted student to Orientation

Use a controlled student whose acceptance pack is fully signed and workflow status becomes ACCEPTED.

Expected:
- ACCEPTANCE_COMPLETED is emitted only after final acceptance succeeds.
- Orchestrator routes to Orientation Management Agent.
- Agent selects an existing suitable future Orientation Session when available.
- Student is assigned.
- Invitation Status becomes SENT.
- D3/D2/D1/H1 reminder automation reports ACTIVE.
- No duplicate n8n reminder scheduler is created.
- Agent event becomes ORIENTATION_ASSIGNED_AND_INVITED.

## Test N — No Orientation session available

Expected:
- Applicant remains accepted.
- ORIENTATION_SESSION_REQUIRED appears in V2_HUMAN_TASKS / ACC Decision Desk.
- Human may select an existing open session or create a new scheduled session in the Decision Desk.
- After confirmation, the agent resumes automatically, assigns the student, sends the invitation and verifies reminder automation.

## Test O — Orientation invitation failure

Expected:
- Student remains assigned to the selected Orientation Session.
- Invitation Status is not treated as success.
- ORIENTATION_INVITATION_FAILURE is created as a high-priority human task.
- Agent does not mark the orientation intake task complete.


## Test P — Marketing Prospect to Systems Operator

Use the secure Marketing / Academic Consultant action page.

Expected:
- Prospect cannot be submitted without SKY Prospect ID.
- Prospect cannot be submitted without an approved Fee Group.
- Successful submission persists Prospect Status = PROSPECT_COMPLETED, SKY Prospect ID and Fee Group.
- PROSPECT_COMPLETED event is emitted.
- Orchestrator routes to Systems Operator.
- Systems Operator verifies Prospect evidence and returns WAITING_ACCEPTANCE.
- No SKY_ACTIVATION_REQUIRED task exists before Acceptance.

## Test Q — Registry SKY activation

First complete the student's Acceptance Pack.

Expected:
- ACCEPTANCE_COMPLETED and SKY_ACTIVATION_READY are emitted.
- Systems Operator resumes after Acceptance.
- Human Decision Desk shows SKY Prospect ID + Fee Group as evidence.
- Registry performs the actual SKY activation outside Admission V2.
- Registry enters SKY Student / Registration ID.
- v2ActivateStudentInSky records SKY Activation Status = ACTIVATED.
- SKY_ACTIVATED event is emitted.
- Task closes only after activation status is verified.

## Test R — Missing SKY Prospect evidence

Expected:
- Systems Operator does not assume activation readiness.
- Missing Prospect ID / Fee Group / Prospect completion produces a review/escalation state.
- No SKY_ACTIVATED record is created.


## Test S — Orientation completion to Academic Handover

Use a controlled Orientation Session with at least two assigned students:
- Student A = ATTENDED
- Student B = ABSENT

Complete the official Orientation session/report.

Expected:
- Student A becomes Orientation Status = COMPLETED and Academic Handover Status = READY.
- Student B does not become handover-ready.
- ORIENTATION_COMPLETED is emitted only for Student A.
- Cohort readiness is committed before any handover event is emitted.
- Academic Handover Agent groups READY students from the same Orientation Session into one batch.

## Test T — Missing Handover PIC configuration

Expected:
- HANDOVER_CONFIGURATION_REQUIRED appears in Human Decision Desk.
- Human enters Academic, IT, Moodle and e-Library PIC email addresses.
- Agent creates/reuses the cohort batch, adds READY students and sends it.
- Each included student becomes Academic Handover Status = HANDED_OVER.
- Provisioning Status = IN_PROGRESS.

## Test U — Provisioning complete to student access

Mark IT, Moodle and e-Library provisioning COMPLETED for a controlled handed-over student.

Expected:
- PROVISIONING_READY_TO_NOTIFY is emitted.
- Academic Handover Agent creates STUDENT_ACCESS_CREDENTIALS_REQUIRED.
- Human Decision Desk accepts temporary credentials.
- Passwords are sent directly through v2SendStudentProvisioningAccess and cleared from the browser fields.
- Passwords do not appear in V2_HUMAN_TASKS, V2_AUDIT_LOG or V2_AGENT_EVENTS.
- Student Notification Status = SENT.
- Academic Handover Status = COMPLETED.
- Application Stage = ACTIVE_STUDENT.
- ACADEMIC_HANDOVER_COMPLETE is emitted.

## Test V — Handover idempotency / batch aggregation

Trigger ORIENTATION_COMPLETED twice for the same controlled student / session.

Expected:
- no duplicate handover student row
- no duplicate cohort batch for the same Orientation Session while the batch is still DRAFT
- already HANDED_OVER / COMPLETED students are not re-added
- Action Gateway Execution ID prevents duplicate side effects


## Test W — Management Intelligence daily scan

Run the Management Intelligence webhook manually, then validate the scheduled workflow separately.

Expected:
- V2_MANAGEMENT_INTELLIGENCE receives one snapshot row.
- Snapshot contains applications today / 7D / 30D.
- Open Human Task, failed execution and stuck-case counts match source tables.
- Critical Signals JSON prioritises HIGH signals before MEDIUM signals.
- ACC Management Intelligence card / Exception Center uses the latest snapshot when present.
- No student stage is changed by the Management Intelligence run.
- Replaying the same daily execution ID on the same date is idempotent.
- Scheduled workflow timezone is Asia/Kuala_Lumpur and cron is 08:30 daily.


## Test X — Authorised eligibility to automatic Offer

Use three controlled cases separately:
1. SAC Direct Entry
2. IA = QUALIFIED
3. Prerequisite = QUALIFIED

Expected for each:
- authorised human outcome moves workflow to ELIGIBLE_FOR_OFFER
- event returns to Orchestrator
- Orchestrator resolves target = OFFER_AUTOMATION
- ISSUE_OFFER runs through the Action Gateway
- Offer Letter Status becomes ISSUED
- Offer PDF URL exists
- Acceptance Signing URL exists
- no second academic decision is invented by AI
- Acceptance remains pending student action
- retrying same execution ID does not generate duplicate Offer side effects

Negative check:
- ISSUE_OFFER against a case that is not ELIGIBLE_FOR_OFFER is rejected unless the Offer is already ISSUED (idempotent existing-state response).


## Test X — Orientation lifecycle supervisor

Use a controlled Orientation Session with assigned/invited students and a valid start/end time.

Expected:
- The n8n Orientation lifecycle supervisor runs every 15 minutes.
- At/after session start, attendance opens automatically if not already open.
- Existing Attendance Link email logic is reused.
- Existing D3/D2/D1/H1 reminder scheduler remains authoritative; n8n does not duplicate reminders.
- Attendance remains open through the configured 30-minute post-session grace period.
- After grace period, attendance closes and the session is marked ENDED.

## Test Y — Unresolved attendance after session

Expected:
- Any active student with attendance not ATTENDED / ABSENT / EXCUSED receives a durable ORIENTATION_ATTENDANCE_REVIEW_REQUIRED task.
- Human Decision Desk shows Session ID and current attendance.
- Human selects ATTENDED, ABSENT or EXCUSED.
- After resolution, the Orientation supervisor re-runs automatically for that session.
- The student is not made Academic Handover READY merely because attendance is recorded; official Orientation completion is still required.

## Test Z — Recording and official completion

Expected:
- Once all attendance is resolved, missing recording URL creates ORIENTATION_RECORDING_URL_REQUIRED.
- Human enters the recording URL in Decision Desk.
- Orientation Agent sends the existing recording email to assigned students.
- Recording delivery is verified.
- Completion Assessment has no blockers.
- Official Orientation report is generated.
- Session Status becomes COMPLETED.
- ATTENDED students receive Orientation Status = COMPLETED and Academic Handover Status = READY.
- ORIENTATION_COMPLETED events route those students to Academic Handover Agent.
- ABSENT / EXCUSED students are not routed as handover-ready by the completion action.


## Test Y — New application automatic document start

Submit a controlled application while agentic mode is enabled.

Expected:
- application remains valid regardless of agentic delivery status
- APPLICATION_SUBMITTED is emitted
- Orchestrator runs deterministic RUN_DOCUMENT_COMPLETENESS
- Application Stage moves to DOCUMENT_REVIEW
- no academic AI screening runs before completeness and Compliance gates.

## Test Z — Missing required document loop

Submit a controlled application missing one hard-required document such as the academic certificate.

Expected:
- deterministic Document Review = INCOMPLETE
- DOCUMENT_MISSING_REQUIRED routes to Student Concierge
- secure request type = MISSING_REQUIRED_DOCUMENT
- applicant email lists only the missing required document(s)
- secure portal accepts the requested file(s)
- upload updates Uploaded Files JSON
- deterministic Document Review reruns automatically
- if still incomplete, another DOCUMENT_MISSING_REQUIRED event is emitted
- if complete, DOCUMENT_COMPLETENESS_CONFIRMED routes to Compliance
- no direct jump from missing upload to Admission Intelligence.

## Test AA — Agentic event delivery failure after completeness

Enable agentic mode and intentionally make the event webhook unavailable for a controlled COMPLETE document case.

Expected:
- local fallback runs Compliance & Records AI first
- Admission Intelligence runs locally only when Compliance status = PASS
- FOLLOW_UP_REQUIRED / HUMAN_REVIEW_REQUIRED does not get bypassed
- case does not get stuck solely because n8n is unavailable.


## Test AA — Missing required document loop

Use a controlled application submitted without one mandatory admission document.

Expected:
- APPLICATION_SUBMITTED routes to deterministic document completeness.
- Review Status = INCOMPLETE.
- DOCUMENT_MISSING_REQUIRED routes to Student Concierge.
- Student Concierge uses SEND_MISSING_DOCUMENT_REQUEST, not the quality-replacement action.
- V2_DOCUMENT_REVIEW records Replacement Request Type = MISSING_REQUIRED_DOCUMENT.
- Secure upload page says the document is required/missing, not that it failed a quality review.
- Applicant receives a secure upload link for the missing field(s) only.
- Applicant must upload every requested missing field.
- Uploaded Files JSON is updated with the canonical new file.
- Deterministic document completeness is re-run after upload.

If completeness becomes COMPLETE:
- DOCUMENT_COMPLETENESS_CONFIRMED is emitted.
- Orchestrator routes to Compliance & Records Agent.
- Academic screening does not run before Compliance PASS.

If completeness remains INCOMPLETE:
- DOCUMENT_MISSING_REQUIRED is emitted again with the current missing list.
- Student Concierge prepares a new secure missing-document request.
- The case remains at DOCUMENT_REVIEW.

## Test AB — Missing vs quality request separation

Expected:
- Initial missing file uses Request Type MISSING_REQUIRED_DOCUMENT.
- A later blurry/cropped file uses Request Type QUALITY_REPLACEMENT.
- Missing-document receipt email refers to required admission documents.
- Quality-replacement receipt email refers to replacement / quality review.
- Both flows use the same secure upload infrastructure without mixing their next-step logic.
