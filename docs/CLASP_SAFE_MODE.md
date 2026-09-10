# Admission V2 — clasp safe mode

Target Apps Script project: `IUC_ADMISSION_BACKEND_V2_DEV`

## Guardrails

1. V2 only. The configured Script ID is `1MhvRLN2s336ndaFwLzQpGNSMEgafXxj_I5NIS8D9ZzyG3NGujHwXdih3`.
2. Source directory is restricted to `apps-script-v2/` by `.clasp.json`.
3. First synchronization is pull-only: `clasp pull`.
4. Never use `clasp push --force`.
5. No automatic Apps Script deployment.
6. Review the Git diff before any future source push.
7. Keep V1 untouched.
8. Keep live email disabled until separately approved.
9. Run `node tools/verify-clasp-target.mjs` before any clasp operation.

The first pull establishes the current Apps Script project as the source-of-truth snapshot in Git before any editing begins.
