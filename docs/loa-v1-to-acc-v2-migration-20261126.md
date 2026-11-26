# LOA V1 → ACC V2 controlled migration audit
Date: 2026-11-26 (MYT)

## Objective
ACC must become the sole operational place to issue Official LOA to an applicant and track the resulting Acceptance pack. The same applicant's existing ACC Student Folder URL is the document destination. Do not create a second issuance mechanism.

## Verified sources
- Legacy Sheet: `ARCHIVE - Admission V1 - DO NOT USE - Migrated to Unified Admission 2026-09-19`. It is nevertheless still receiving LOA records on 26 Nov 2026.
- Legacy tabs: `MASTER_DATABASE`, `INPUT_PANEL`, `SYSTEM_SETTING`, `Form responses 1`.
- ACC V2: `V2_APPLICATIONS`, `V2_WORKFLOW`, Supabase `acc_application_admin`.
- Existing issuer: `api/admin-action.js` action `v2IssueOffer` routes to the scoped Apps Script LOA service and has duplicate-send suppression behavior in the UI.
- Existing acceptance: one signing flow with signed PDFs saved to the student's folder and the ACC status updated.

## Reconciliation snapshot (2026-11-26)
- 397 non-empty legacy `MASTER_DATABASE` LOA records.
- 214 have an **exact** Reference No. match in V2_APPLICATIONS; all 214 matched V2_WORKFLOW entries are marked `ISSUED`.
- 183 do **not** have an exact Reference No. match in V2_APPLICATIONS. This does not prove missing people: some may have been entered with a distinct V2 Application Reference.
- 169 legacy records dated from 19 Sep 2026 onwards; 167 of these do not have exact references in V2.
- Two legacy LOA records dated 26 Nov 2026 (11:25 and 11:51 AM MYT); each records `Email Sent = YES`.
- No historical migration or automated reissue was performed as part of the current feature branch.

## Mapping strategy
| Legacy | V2 destination | Notes |
|---|---|---|
| Ref No | Application Reference / legacy LOA reference crosswalk | NEVER overwrite new ACC Application Reference |
| IC | ID / Passport No | Identity matching only after normalisation and disambiguation |
| Email | Personal Email | Secondary evidence, never sole identifier |
| Programme, Intake | Programme, Intake | Normalize programme prefixes (e.g. `MBA -` and `PhD -`) |
| Folder URL | Student Folder URL | Reuse existing; do not create duplicates |
| Email Sent | Offer Email Status | Historical evidence, not a reason to resend |
| Acceptance Status / Received At | Acceptance Status / Received At | Preserve original historical timestamps |
| Acceptance Offer File | Acceptance PDF URL | Historical artifact, read-only |
| Surat Akuan File | Surat Akuan Signed PDF URL | Historical artifact, read-only |
| Surat Penerimaan File | Surat Penerimaan Signed PDF URL | Historical artifact, read-only |

## Safety rules for cutover
1. Do not disable the original Sheet/Apps Script until new ACC issuance and acceptance are tested with controlled non-student test data.
2. For unmatched legacy rows, attempt exact reference, then verified (identity + program + intake) matching. If ambiguous, queue for authorised Registry review; do not auto-create duplicate students.
3. Never regenerate historical LOAs or send emails during import; import is a **read-only historical state** migration.
4. The ACC LOA Centre introduced in this branch currently shows **only ACC V2** and uses the existing `v2IssueOffer` action. It does not read or mutate V1.
5. Issue Official LOA only at the `ELIGIBLE_FOR_OFFER` gate. COL is separate from Official LOA.
6. Every issuance must be idempotent by applicant reference, programme/intake and document version; preserve issuer audit and email status.
7. Preserve original Google Docs template layout where legally/operationally appropriate, but remove fixed `Full Time` literals and substitute the applicant's approved Study Mode. Confirm the old `MATRIX_NO` placeholder is optional before Sky activation; never fabricate a matric number.
8. Acceptance and signed document URLs must remain attached to the correct student folder and reference.
9. At switch-over, disable old **write/issue** functionality, but retain read-only history and recovery access.
10. Perform parallel verification of counts, unmatched rows, template output, email dedupe and Drive saves before release.

## Required remaining work before production cutover
- Read and verify the deployed legacy Apps Script trigger/handler and active LOA issuer to identify the real active writer.
- Reconcile the 183 unmatched legacy references, particularly the 167 written since 19 Sep 2026.
- Migrate historical evidence to a separate read-only crosswalk/audit table with access policies.
- Compare official V1 vs V2 LOA templates and all route/programme variations; perform approval/QA.
- Run controlled LOA, Acceptance link/signing, Drive saving and duplicate issue tests.
- Release ACC V2 as sole issuer only after reconciliation and staff cutover communication.

**No real student LOA or email should be issued during tests.**
