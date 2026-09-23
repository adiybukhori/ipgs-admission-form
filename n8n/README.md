# IUC Campus Simulation - Admission V2 n8n Foundation

This folder contains the first isolated n8n workflows for the Campus Simulation Agent AI project.

## Workflows

- CS-ADM-V2 | 90 EVENT INGRESS
- CS-ADM-V2 | 91 ACTION GATEWAY
- CS-ADM-V2 | 00 ORCHESTRATOR
- CS-ADM-V2 | 02 ADMISSION INTELLIGENCE

## Architecture

Admission V2 (Apps Script) -> 90 EVENT INGRESS -> 00 ORCHESTRATOR -> 02 ADMISSION INTELLIGENCE -> 91 ACTION GATEWAY -> Admission V2

Admission V2 remains the source of truth and transaction engine.
n8n is the agentic orchestration layer.
ACC / Campus Simulation reads V2_AGENT_EVENTS and V2_AGENT_EXECUTIONS.

## Required configuration before activation

1. Import all four JSON files into the dedicated n8n project:
   IUC | Campus Simulation | Admission V2
2. Replace REPLACE_WITH_N8N_EVENT_SHARED_SECRET in all workflows with one strong shared secret.
3. Replace REPLACE_WITH_V2_ADMIN_API_PASSWORD in the Action Gateway workflow with the protected V2 backend token, preferably via n8n credentials rather than plain text.
4. Activate in this order:
   - 91 ACTION GATEWAY
   - 02 ADMISSION INTELLIGENCE
   - 00 ORCHESTRATOR
   - 90 EVENT INGRESS
5. In Apps Script properties set:
   - N8N_EVENT_WEBHOOK_URL = https://anasbukhori.app.n8n.cloud/webhook/cs-adm-v2-events
   - N8N_EVENT_SHARED_SECRET = same shared secret
   - N8N_AGENTIC_ENABLED = TRUE
6. Run a controlled application with Document Review = COMPLETE.

## First autonomous loop

DOCUMENT_REVIEW_COMPLETED
-> AI Orchestrator
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
