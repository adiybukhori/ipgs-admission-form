**ARCHITECTURE UPDATE (26 Nov 2026):** This is the historical test of Apps Script v131 and its failure modes. ACC now has its own native issuance path on the feature branch. Do not interpret older Apps Script policy file references below as active; those staged files were removed. Production Apps Script v131 remains unchanged. See `docs/ACC_NATIVE_LOA_CUTOVER_20261126.md`.

# LOA UAT Verification Run — 26 November 2026

## Decision
**NOT READY for live issuance.** The ACC feature branch is preview-ready, but Apps Script release v131 has incompatible eligibility, output and workflow transitions. No production Apps Script, ACC main, Google Sheets, or recipient emails were changed during this verification.

## Verified environments
- GitHub branch: `feature/loa-operations-20261126` (Draft PR #31).
- Deployed Apps Script source: project `1MhvRLN2s336ndaFwLzQpGNSMEgafXxj_I5NIS8D9ZzyG3NGujHwXdih3`, deployment v131. SHA-256 match on current HEAD and v131 source files OfferLetterV2, NotificationEngineV2, WorkflowV2, Code, AcceptancePackV2, AgenticBridgeV2.
- Vercel env: `V2_LOA_V1_PARITY_READY` is ABSENT; `V2_LOA_API_TOKEN` / Supabase credentials are scoped to production. The feature branch is fail-closed, and preview read-only.
- Original four Docs template IDs and folder are unchanged.

## Regression checks performed (read only)
| Test | Expected | Result |
|---|---|---|
| V1 email subject/body MBA (real sent email) | Exact match | **PASS** |
| V1 email subject/body MBM (real sent email) | Exact match | **PASS** |
| V1 email subject/body DBA (real sent email) | Exact match | **PASS** |
| V1 email subject/body PhD (real sent email) | Exact match | **PASS** |
| Four V1 PDF filenames for MBA, MBM, DBA, PhD | Match every real email's four attachments | **PASS** |
| Original V1 vs V2 Google Docs visible paragraph text for four documents | Exact | **PASS**, layout/binary not yet verified |
| Apps Script v131: SAC Pending + valid 7-digit SKY matric | Issue should be permitted | **FAIL**: `v2PrepareOffer_` rejects absent `ELIGIBLE_FOR_OFFER` |
| Apps Script v131: SAC eligible + missing matric | Must block | **FAIL**: v131 mocked issuer generated LOA without matric |
| Apps Script v131 initial email attachments | Four PDFs | **FAIL**: NotificationEngine attaches one PDF |
| v131 PDF matric number | Populate confirmed 7-digit number | **FAIL**: generator passes blank into MATRIX_NO |
| v131 SAC stage preservation | Do not overwrite early LOA stage | **FAIL**: generator writes `Application Stage=OFFER_ISSUED` |
| ACC preview live sending | Must be impossible | **PASS design check**: handler denies all mutations in preview |
| ACC feature production sending before UAT | Must be impossible | **PASS configuration check**: parity readiness env flag absent |

**Mock test scope:** used actual deployed v131 `v2IssueOffer_` function with mocked Drive, LockService, Sheets, notifications and preparation calls. It did not write records or send messages. This reproduces the old gate discrepancy; it is not a successful end-to-end delivery test.

## Pending actions before moving to live
1. Coordinate Apps Script changes to `OfferLetterV2.js` preparation, generation and issuance functions plus `AgenticBridgeV2.js`, so all paths use verified matric, preserve SAC/IA/PR and block non-ACC send.
2. Make `NotificationEngineV2.js` produce the exact four V1 PDFs and original Registry email contract with verified sender and correct CC; save files in the applicant's existing Drive folder.
3. Use isolated synthetic test records and an authorised test inbox only, not student addresses. Compare generated PDF text/layout to original output.
4. Re-run duplicate-send, missing matric, SAC pending, IA/PR pending, multiple programme and authorised sender checks.
5. After testing pin an Apps Script version, verify ACC points to it, then deliberately enable the ACC readiness flag and execute a controlled cutover. Keep V1 available for rollback.

**No LOA emails sent and no live student records modified in this run.**

## Additional dependent Acceptance finding
- `OfferLetterV2.js → v2AcceptOffer_` currently accepts only `OFFER_ISSUED` or `ACCEPTANCE_PENDING` stage and then overwrites `Application Stage` with `ACCEPTED`. If LOA issuance preserves `READY_FOR_SAC` as required, **Acceptance will fail until this gate is also changed**. Both LOA and Acceptance status must be independently tracked without mutating SAC/IA/Prerequisite stage.

## Single-policy clean-up staged (26 Nov, subsequent verification)
- Added `apps-script/LOA_V2_SINGLE_POLICY.js` (NOT installed in Apps Script): **one** Registry-confirmed seven-digit matric criterion, explicit ACC-Applications source, duplicate issue prevention, mismatched SKY ID protection and assertions that SAC/IA/Prerequisite status cannot change.
- Added `scripts/test-loa-v2-single-policy.mjs`. Deterministic test cases pass for Ready for SAC, IA Pending, Prerequisite Pending, Eligible for Offer, missing matric, non-ACC caller, duplicate LOA, SKY mismatch, stage preservation and exactly four PDFs.
- Updated the ACC server issue payload with explicit `source:'ACC_APPLICATIONS'` to agree with the staged Apps Script policy. The fail-closed parity readiness flag remains unset.
- Attempted to reopen the authorised Windows desktop with the deployed Apps Script source in order to apply the changes coherently. Remote Desktop Commander did not respond; a read operation timed out. **No Apps Script source or live deployment was changed.** Once connectivity is available, patch `OfferLetterV2.js`, `NotificationEngineV2.js`, `AcceptancePackV2.js`, `AgenticBridgeV2.js` and their call sites together, then run isolated synthetic integration tests before any deployment.
