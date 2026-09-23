# IUC Campus Simulation - Admission V2 n8n Foundation

This folder contains the first isolated n8n workflows for the Campus Simulation Agent AI project.

## Workflows

- CS-ADM-V2 | 90 EVENT INGRESS
- CS-ADM-V2 | 91 ACTION GATEWAY
- CS-ADM-V2 | 00 ORCHESTRATOR
- CS-ADM-V2 | 01 COMPLIANCE
- CS-ADM-V2 | 02 ADMISSION INTELLIGENCE
- CS-ADM-V2 | 03 SAC-IA
- CS-ADM-V2 | 04 STUDENT CONCIERGE
- CS-ADM-V2 | 05 SYSTEMS OPERATOR
- CS-ADM-V2 | 06 ORIENTATION
- CS-ADM-V2 | 07 ACADEMIC HANDOVER
- CS-ADM-V2 | 08 MANAGEMENT INTELLIGENCE
- CS-ADM-V2 | 92 HUMAN TASK GATEWAY
- CS-ADM-V2 | 93 ERROR & RETRY

## Architecture

Admission V2 (Apps Script) -> 90 EVENT INGRESS -> 00 ORCHESTRATOR -> 02 ADMISSION INTELLIGENCE -> 91 ACTION GATEWAY -> Admission V2

Exception path:
Admission Intelligence -> durable V2_HUMAN_TASKS -> ACC Human Decision Desk -> authorised resolution -> FINAL screening report -> READY_FOR_SAC

Failure path:
Agent error -> 93 ERROR & RETRY -> retry within limit -> 92 HUMAN TASK GATEWAY when retry limit is exhausted

Admission V2 remains the source of truth and transaction engine.
n8n is the agentic orchestration layer.
ACC / Campus Simulation reads V2_AGENT_EVENTS and V2_AGENT_EXECUTIONS.

## Required configuration before activation

1. Import all thirteen JSON files into the dedicated n8n project:
   IUC | Campus Simulation | Admission V2
2. Replace REPLACE_WITH_N8N_EVENT_SHARED_SECRET in all workflows with one strong shared secret.
3. Replace REPLACE_WITH_V2_ADMIN_API_PASSWORD in the Action Gateway workflow with the protected V2 backend token, preferably via n8n credentials rather than plain text.
4. Activate in this order:
   - 91 ACTION GATEWAY
   - 92 HUMAN TASK GATEWAY
   - 93 ERROR & RETRY
   - 01 COMPLIANCE
   - 04 STUDENT CONCIERGE
   - 05 SYSTEMS OPERATOR
   - 02 ADMISSION INTELLIGENCE
   - 03 SAC-IA
   - 06 ORIENTATION
   - 07 ACADEMIC HANDOVER
   - 08 MANAGEMENT INTELLIGENCE
   - 00 ORCHESTRATOR
   - 90 EVENT INGRESS
5. In Apps Script properties set:
   - N8N_EVENT_WEBHOOK_URL = https://anasbukhori.app.n8n.cloud/webhook/cs-adm-v2-events
   - N8N_EVENT_SHARED_SECRET = same shared secret
   - N8N_AGENTIC_ENABLED = TRUE
6. Run a controlled application with Document Review = COMPLETE.

## First autonomous loop

DOCUMENT_COMPLETENESS_CONFIRMED
-> AI Orchestrator
-> Compliance & Records Agent
-> AI document-quality inspection
-> PASS: DOCUMENT_QUALITY_PASSED
-> Admission Intelligence Agent
-> read case state
-> verify document review complete
-> execute RUN_ADMISSION_INTELLIGENCE through the Action Gateway
-> AI reads certificate/transcript/CV
-> V2 rule engine evaluates the screened inputs
-> official AI screening report is generated
-> read case state again
-> verify result/report
-> READY_FOR_SAC or WAITING_HUMAN

## Safety

- Workflows are imported inactive.
- Existing unrelated n8n workflows must not be changed.
- Agent actions are idempotent using Execution ID.
- Apps Script validates stage and action ownership.
- If n8n is enabled but an event cannot be delivered, current Document Review logic falls back to the existing local auto-screening path instead of blocking the applicant.
- FINAL AI screening report is only allowed after the qualification rule engine is resolved.


## ACC live command-centre contract

The live portal now reads:
- V2_AGENT_EVENTS
- V2_AGENT_EXECUTIONS
- V2_HUMAN_TASKS

AI Office state is driven by these records. The frontend polls the live runtime approximately every 5 seconds. Simulation is retained only as fallback/demo when n8n is not active.

The Human Decision Desk supports the first production authority handler:
- ADMISSION_SCREENING_REVIEW
- AI Field Relationship and Relevant Work Experience are reused automatically.
- Human selects the authorised screening route.
- Human may record grade-equivalency / academic confirmation notes.
- Optional AI input override is available only when required.
- Successful confirmation completes the manual second layer, regenerates the FINAL AI Screening Report and moves the case to READY_FOR_SAC.

## Retry rule

Agent execution must follow:
REQUESTED -> EXECUTED -> VERIFIED -> COMPLETED

On failure:
FAILED -> retry through 93 ERROR & RETRY -> maximum configured attempts -> durable Human Task.

Do not create unbounded retry loops.


## Compliance & Records gate

The agentic route now separates two different checks:

1. Deterministic completeness — is the required file present?
2. AI document quality — is the submitted file administratively usable?

Compliance quality checks include document type, readability, material crop/cut-off, blur/glare, orientation, page completeness where assessable, passport-photo suitability, and cross-document consistency.

Outcomes:
- PASS -> Orchestrator routes to Admission Intelligence.
- FOLLOW_UP_REQUIRED -> academic screening is paused until replacement documents are received.
- HUMAN_REVIEW_REQUIRED -> a durable DOCUMENT_QUALITY_REVIEW task is created.

Admission Intelligence is blocked in agentic mode unless Document Quality Status = PASS.


## Student Concierge replacement loop

When Compliance returns FOLLOW_UP_REQUIRED:

DOCUMENT_REPLACEMENT_REQUIRED
-> AI Orchestrator
-> Student Concierge Agent
-> SEND_DOCUMENT_REPLACEMENT_REQUEST
-> secure tokenised applicant upload link
-> AWAITING_STUDENT
-> applicant uploads every requested replacement file
-> old files are retained and renamed as SUPERSEDED
-> new files become the current Uploaded Files JSON record
-> DOCUMENT_REPLACEMENT_RECEIVED
-> AI Orchestrator
-> Compliance & Records Agent re-runs quality inspection

The replacement portal reuses the same hashed-token approach used by the existing Research Intent upload flow.


## SAC / IA Coordination contract

The SAC / IA Agent is administrative. It never chooses an academic outcome.

READY_FOR_SAC
-> find nearest suitable open future SAC session
-> if none: durable SAC_SESSION_REQUIRED human task
-> assign candidate
-> prepare PG-ADM-01 + SAC pack
-> verify pack completeness
-> durable SAC_DECISION_REQUIRED human task

Authorised SAC outcomes:
- DIRECT_ENTRY -> ELIGIBLE_FOR_OFFER
- INTERNAL_ASSESSMENT -> IA coordination
- REJECTED -> REJECTED

INTERNAL_ASSESSMENT
-> create / verify IA progress
-> durable IA_OUTCOME_REQUIRED task
-> authorised panel outcome only:
   - QUALIFIED -> ELIGIBLE_FOR_OFFER
   - PREREQUISITE_REQUIRED -> PREREQUISITE
   - NOT_QUALIFIED -> REJECTED

PREREQUISITE
-> create / verify prerequisite progress
-> durable PREREQUISITE_OUTCOME_REQUIRED task
-> authorised result:
   - QUALIFIED -> ELIGIBLE_FOR_OFFER
   - NOT_QUALIFIED -> REJECTED

Direct SAC -> prerequisite remains prohibited.


## Orientation Management Agent — accepted student intake

ACCEPTANCE_COMPLETED
-> AI Orchestrator
-> Orientation Management Agent
-> find existing assignment or nearest suitable future session
-> if no suitable session: ORIENTATION_SESSION_REQUIRED Human Task
-> assign student
-> send invitation using existing OrientationV2 backend
-> verify Invitation Status = SENT
-> verify existing Apps Script reminder engine = ACTIVE
-> monitor session

Reminder scheduling is NOT duplicated in n8n. Existing OrientationV2 reminder automation is authoritative:
- every 15 minutes sweep
- D3 / D2 / D1 / H1 milestones
- reminders only for students whose invitation status is SENT

If invitation or reminder-trigger verification fails, the Orientation Agent creates a durable Human Task rather than silently continuing.


## Systems Operator — SKY contract

Marketing / Academic Consultant remains responsible for:
- creating the applicant in SKYVIALING -> Marketing -> Prospect
- copying the SKY Prospect ID
- selecting the approved Fee Group
- confirming Prospect completion through the secure agent page

The Marketing action page now requires SKY Prospect ID before submission.

PROSPECT_COMPLETED
-> AI Orchestrator
-> Systems Operator Agent
-> verify Prospect Status + SKY Prospect ID + Fee Group
-> WAIT_FOR_ACCEPTANCE

ACCEPTANCE_COMPLETED
-> SKY_ACTIVATION_READY
-> Systems Operator Agent
-> verify Acceptance is complete
-> durable SKY_ACTIVATION_REQUIRED task for Registry
-> Registry performs the real activation / registration in SKY
-> Registry records SKY Student / Registration ID in ACC Human Decision Desk
-> Admission V2 records SKY Activation Status = ACTIVATED
-> Systems Operator emits SKY_ACTIVATED

Important: v2ActivateStudentInSky records/validates the completed external action. It is not treated as an API call into SKY itself.


## Academic Handover Agent

Official Orientation completion is the gate for handover readiness.

For each attended student after the Orientation session is officially completed:
- Orientation Status = COMPLETED
- Academic Handover Status = READY
- ORIENTATION_COMPLETED event is emitted only after the whole cohort readiness state is committed.

The Academic Handover Agent aggregates READY students by Orientation Session ID.

Flow:
ORIENTATION_COMPLETED
-> Academic Handover Agent
-> if PIC configuration is missing: durable HANDOVER_CONFIGURATION_REQUIRED task
-> create / reuse one batch for the Orientation cohort
-> add all READY students not already assigned to another handover batch
-> send Academic handover + IT / Moodle / e-Library provisioning tasks using existing HandoverV2
-> verify Academic Handover Status = HANDED_OVER and Provisioning Status = IN_PROGRESS
-> monitor provisioning

When all three provisioning tasks become COMPLETED:
PROVISIONING_READY_TO_NOTIFY
-> Academic Handover Agent
-> durable STUDENT_ACCESS_CREDENTIALS_REQUIRED task
-> authorised staff enters temporary credentials once
-> existing v2SendStudentProvisioningAccess sends credentials directly to the student
-> temporary passwords are not stored in Human Task, spreadsheet audit or agent events
-> verify Student Notification = SENT
-> Academic Handover Status = COMPLETED
-> Application Stage = ACTIVE_STUDENT
-> ACADEMIC_HANDOVER_COMPLETE event


## Management Intelligence Agent

Runs cross-case operational intelligence without mutating student academic decisions.

Scheduled run:
- Daily at 8:30 AM
- Workflow timezone: Asia/Kuala_Lumpur

Manual refresh:
- POST to /webhook/cs-adm-v2-management-intelligence using the shared agent secret.

Snapshot includes:
- applications today / 7 days / 30 days
- open and high-priority human tasks
- human tasks older than 24 hours
- failed / running agent executions
- document-quality follow-up
- screening, SAC, IA and prerequisite queues
- SKY activation pending
- upcoming Orientation sessions
- Orientation waiting cases
- provisioning in progress
- handover-ready cases
- non-terminal cases unchanged for more than 24 hours
- ranked critical operational signals

Snapshots are written to V2_MANAGEMENT_INTELLIGENCE and surfaced in ACC.


## Management Intelligence daily brief

Workflow:
- `CS-ADM-V2 | 08 MANAGEMENT INTELLIGENCE`

Schedule:
- Daily at **8:30 AM Asia/Kuala_Lumpur**

Apps Script property required for email delivery:
- `V2_MANAGEMENT_REPORT_EMAILS`
- Use one or more recipient emails separated by comma or semicolon.

The daily run uses a date-based idempotency key, so the same 8:30 daily brief is not duplicated by an accidental replay.

Snapshot includes:
- applications yesterday / last 7 days / current calendar month
- open and high-priority human tasks
- failed / running agent executions
- document quality follow-up
- screening, SAC, IA and prerequisite queues
- SKY activation pending
- upcoming / waiting orientation
- academic handover and provisioning queues
- cases unchanged for more than 24 hours

The AI brief is narrative only; all counts are calculated deterministically from Admission V2.


## Automatic Offer issuance

Offer issuance is deterministic automation owned by the AI Orchestrator, not a separate AI decision-maker.

The academic / admission eligibility decision must already be authorised.

When one of these authorised outcomes moves the case to ELIGIBLE_FOR_OFFER:
- SAC Direct Entry
- IA = QUALIFIED
- Prerequisite = QUALIFIED

the Orchestrator calls the existing v2IssueOffer_ backend through the controlled Action Gateway.

Verification:
- case must be ELIGIBLE_FOR_OFFER before first issuance
- Offer Letter Status must become ISSUED
- Offer PDF + acceptance signing link are generated by existing V2 logic
- production Offer email is sent by the existing notification engine
- email delivery failure is escalated instead of treating the action as fully resolved
- acceptance remains a student action; successful acceptance emits Orientation + SKY activation-ready events
