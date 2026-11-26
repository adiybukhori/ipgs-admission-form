# ACC LOA V1 Output Parity Contract — 26 November 2026

**Status:** Audited against source Google Sheet, four live Google Docs, original issued PDFs and sent Gmail messages. **Not yet deployed.** Do not release until the deployed Apps Script service passes all gates.

## Authoritative reference sources
- V1 Google Sheet (read-only): `1RqRfq9savLdoi_A640A4lS-FPcD1TqmQ8zBgS_MeQuI`, `SYSTEM_SETTING`, `MASTER_DATABASE`.
- V1 template IDs:
  - LOA: `1BXx6GK7XPIbw8tmF8gmeGr8KUL1opFfCmEoC1TXnxwA`
  - Acceptance EN: `1JuIwpkPXIebWohnJrBUyJLw5flbVi3nbX0IsOgYlzlg`
  - Surat Penerimaan: `1-fG3WrLOIpl3yl0Mqt4Geqiw1g6FNwGJ2DvXbtXmUB4`
  - Surat Akuan: `1dwVfTaHh5Zue_Ob2521ZoGHK-nwIC-WV7yK8p8m7pPc`
- Actual legacy email/PDF examples from 24–26 November 2026 (MBA, MBM, DBA, PhD). Do not copy student identity numbers or original email addresses into source control.
- V2 Apps Script project inspected by authorised read-only `clasp pull`: source `1MhvRLN2s336ndaFwLzQpGNSMEgafXxj_I5NIS8D9ZzyG3NGujHwXdih3`. The Vercel `V2_WEB_APP` references deployed Web App `AKfycbxasT_HgtRSvTbR_bsa8p17Cm-C2PKn20Ok1kU-AyJmxiKX8kX5EGOtRLwVwNlAL7JB`, version **131** (29 October 2026). Another HEAD deployment exists: DO NOT PUSH OR PROMOTE without explicit UAT/rollout checks.

## Exact observed V1 email contract
- Subject: `[Registry] Letter of Admission – ${programmeFullName}` (long dash).
- Opening: `Dear Candidate,` followed by `Warm greetings from Innovative University College (IUC).`
- Programme paragraph: congratulations on meeting requirements for the **full display programme title**.
- Four document descriptions: Official Offer Letter, Acceptance of Offer, Surat Akuan IUC and Surat Penerimaan Tawaran IUC.
- Student account section: Student Matrix No., student portal `https://innovative.vialing.com/sp/login`, username instructions, legacy initial-password instructions.
- Student WhatsApp group: existing V1 community link.
- Acceptance Submission: existing V1 Google Form submission link.
- Physical Student ID Card: existing V1 Google Form link.
- Closing: Registry Department, Innovative University College.
- Four **PDF attachments** attached to the **first** offer email, not only upon signing:
    1. `LOA_{CODE}_{ID}.pdf`
    2. `Acceptance_EN_{CODE}_{ID}.pdf`
    3. `Surat_Penerimaan_{CODE}_{ID}.pdf`
    4. `Surat_Akuan_{CODE}_{ID}.pdf`
- Observed sent-mail CC: registry@innovative.edu.my + fadhilhasif@innovative.edu.my; a sampled MBA message additionally CCs oissm@innovative.edu.my. The complete programme-specific CC routing is not proven from available examples; **do not hardcode universal extra CC**.
- Sender identity and alias must match V1 where permitted by Gmail. If alias unavailable, block and report rather than silently send from an unrelated sender.

## Template comparison
- V1 vs V2 Google Docs template **visible paragraph text is exactly equal** for all four documents, though each has a different Google Drive file ID. Exact binary/layout output **has not** been established; use V1 original template IDs or visual PDF regression before claiming parity.
- Both V1 and V2 LOA templates have a fixed `Study Mode: Full Time` sentence; V2 generator replaces it with the application’s study mode. The V1 PDF example still displays `Full Time`. Any correction for Part Time must be documented, not silently described as byte-for-byte parity.
- V1 PDF files inspected: all four were one-page A4-ish PDFs. Compare one-page visual layout as well as text and attachments. Do not include real students' PDFs in this repository.
- The legacy email's use of identity-number-based initial passwords is a security-sensitive inherited practice; it must undergo policy review before sending new credentials. Do not publish an actual student's ID/password.

## Actual V2 gaps confirmed from Apps Script source
1. `OfferLetterV2.js → v2PrepareOffer_` blocks when `Application Stage != ELIGIBLE_FOR_OFFER`, then calls `v2AssertStageGate_`.
2. `OfferLetterV2.js → v2GenerateOfferLetter_` blocks for the same SAC-dependent stage.
3. `v2GenerateOfferLetter_` inserts a **blank** `{{MATRIX_NO}}`; it also rewrites `Application Stage` to `OFFER_ISSUED`. That would interrupt SAC tracking when LOA is issued before SAC.
4. `AgenticBridgeV2.js → ISSUE_OFFER` independently checks `ELIGIBLE_FOR_OFFER` and can bypass ACC. Disable this issuance path or route it through the same verified Registry matric policy; retain SAC tracking.
5. `NotificationEngineV2.js → v2SendOfferNotificationCentral_` sends `[IUC IPGS] Congratulations! Your Official Offer Letter - ...`, uses a different HTML email and attaches **only one LOA PDF**. This is not V1 parity.
6. V2 has a separate 4-document *signed acceptance confirmation* process. It is not the same as the four **unsigned** initial offer attachments in V1.
7. `WorkflowV2.js → handleV2Post_` forwards `payload.data` to `v2IssueOffer_`; that is the correct single entry point for the Vercel server's Registry-confirmed matric assertion.
8. V2 CONFIG template IDs differ from V1 IDs although all four visible paragraph texts are exactly equal.

## Single issuer and data integrity rules
- Staff initiate LOA only from **ACC Applications > Open student**. No standalone LOA menu.
- Gate: Registry-confirmed **seven-digit** SKY student ID, validated from `acc_application_admin` in Supabase by Vercel before sending to Apps Script. This is a manually confirmed ID, not live Sky verification.
- SAC/IA/Prerequisite stages do **not** gate LOA; do not overwrite their stage/status, decision or tracking on early LOA issuance.
- The Vercel issuer remains the only authorised downstream caller; legacy orchestration `ISSUE_OFFER` must not provide another unaudited send route.
- Do not regenerate or resend when a LOA or delivery record already exists. Retain locking/idempotency in the Apps Script.
- Store the four initial PDFs in the **existing ACC Student Folder URL**, plus PDF links, email delivery status and issued timestamp in the applicant's V2 workflow.
- Keep existing V1 Sheet and production Apps Script untouched until a non-student synthetic UAT verifies subject, text, 4 PDFs, Drive folder, matric, sender/CC, stage preservation and duplicate prevention.
- Never test with a real student email; use the authorised synthetic Registry test recipient.

## Rollout gate
- [x] Source email and four original attachment formats identified.
- [x] V1 and V2 Docs visible text compared: exact equality.
- [x] Deployed Apps Script project and pinned version identified.
- [x] Current mismatches located in source code.
- [x] ACC Vercel code gated by V2_LOA_V1_PARITY_READY (absent => fail-closed).
- [ ] Stage/deploy Apps Script UAT copy with one Registry matric rule at every former stage gate.
- [ ] Confirm all four PDFs (not only one) and original V1 email body, aliases, CC.
- [ ] Confirm 7-digit student number renders in LOA PDF and email.
- [ ] Confirm SAC decision/stage unchanged before and after issue.
- [ ] Confirm duplicate click delivers one email and one set of PDFs.
- [ ] Compare rendered PDFs against actual legacy outputs (text+layout).
- [ ] Record approved security handling for inherited login credentials.
- [ ] Activate server flag only after successful UAT, coordinated Apps Script deployment and version verification.
