# ACC-only LOA cutover — execution record (26 November 2026)

## Requested architecture
**ACC Applications is the only issuance owner and issuer.** No Apps Script LOA initiation, business rule, PDF generation or Gmail sending is used by the new ACC issuance command.

`Applications → Open student → Registry-confirm SKY Matric No. → Issue Official LOA → ACC Native Google APIs → Four PDFs → ACC Student Drive Folder → Gmail → ACC status/ledger`

The four original V1 Google Docs are the single source and remain in the existing IPGS Drive `TEMPLATES` folder. SAC/IA/Prerequisite processing is independent and must not be overwritten.

## Completed on testing branch only
- ACC client action renamed from `v2IssueOffer` to **`accIssueLoa`**.
- `api/admin-action.js` routes `accIssueLoa` directly to `lib/loa-native.js` (not through `callAppsScriptV2`).
- Removed the Apps Script-specific LOA service path and old V2 LOA diagnostics from the ACC action dispatch. The remaining Apps Script bridge serves other admission modules, not LOA.
- Native engine uses Google OAuth REST APIs for Docs templating, Drive PDF storage and Gmail MIME delivery.
- Email contract copied to `lib/loa-v1-email.js` and matches four observed original Registry email samples (MBA, MBM, DBA, PhD).
- Original Google Doc template IDs unchanged. Four PDFs are generated separately and the first LOA email must attach all four.
- Native code has Registry seven-digit matric verification, source folder validation, prevention of duplicate issuance, Supabase unique-claim ledger and no SAC/IA/PR mutation.
- Prevents an ACC agent gateway `ISSUE_OFFER` request from auto-issuing through the legacy script.
- Deleted staged Apps Script-side LOA policy/email files from this branch to avoid duplicate ownership.
- Preview is deliberately read-only; test script `scripts/test-acc-native-loa.mjs` contains offline non-student assertions.

## Pending prerequisites to make native ACC issuance live
1. Authorise a dedicated Google Workspace Registry sender and issue an OAuth refresh token scoped to Drive copy/export, Docs editing, Sheets update and Gmail send. Set credentials as **encrypted Vercel production environment secrets**, never paste them into code or chat.
2. Configure sender alias and verified CC routing using actual V1 mail routing evidence (programme-based when necessary).
3. Review the old V1 statement that the initial portal password equals the IC number. Explicitly approve its secure replacement or temporarily restrict issuance; `ACC_LOA_LEGACY_CREDENTIAL_TEXT_APPROVED` is a fail-closed release flag.
4. Apply the reviewed database ledger migration under a Supabase migration after UAT review: `docs/acc-native-loa-ledger-staged.sql`.
5. Run synthetic UAT with non-student address for all four PDFs, template visual layout, Drive saved files, Gmail sender+CC, original content, missing matric, duplicate click, error recovery and SAC/IA/PR preservation.
6. Only once complete, explicitly set `ACC_LOA_NATIVE_READY=true` and deploy the reviewed ACC branch.

## Legacy Apps Script retirement (production not yet performed)
- **DO NOT simply delete `v2IssueOffer_` in live Apps Script before ACC native is delivering successfully.** That function currently supports the legacy admission V2 production system. Deletion without replacement breaks existing routes.
- After successful native ACC cutover, revoke Apps Script `v2IssueOffer`/LOA service access and disable `AgenticBridgeV2.ISSUE_OFFER` and any scheduled/n8n triggers. Preserve other Apps Script admission modules, V1 historical files, and the one shared Drive template folder.
- Existing Apps Script v131 is unchanged because the authorised remote desktop is offline. This retirement task remains **pending**; no claim of live function deletion or live ACC delivery is permitted.

## Verification status
- Branch syntax checks: pass.
- ACC native validation tests: 7/7 basic scenarios pass.
- Vercel Preview: READY, but read-only and lacking Google OAuth env; this **does not prove PDF/email delivery**.
- Vercel environment has no `ACC_LOA_GOOGLE_*` or `ACC_LOA_NATIVE_READY` config.
- No real student email sent, no application record modified, production main unchanged.

## Rollback
Keep legacy V1 and V2 production flows available until ACC native UAT and initial production issuance have been verified. Maintain a controlled disable flag and log any partial delivery as REVIEW_REQUIRED, never automatically resend.


## 26 Nov 2026: synthetic format-preview evidence (NOT native ACC UAT)
- Authenticated IPGS Google Drive connector copied **all four original V1 Google Docs** to a dedicated **UAT-only** folder, leaving the original TEMPLATES unchanged. Synthetic student UAT TEST STUDENT, test matric 2699999, fictional ID TEST001; no real applicant or ACC workflow record involved.
- All placeholders were replaced. Four exported PDFs independently verified as **one A4 page each**, with synthetic student identity and no remaining `{{...}}` tokens.
- An explicitly labelled **[UAT PREVIEW – NOT OFFICIAL]** email with those four PDFs was **sent from IPGS Admission via connected Gmail** to the authorised Registry test inbox and was independently found in that inbox; sent/received message IDs were verified.
- This proves the V1 template visuals, mail example and attachments can be reviewed by Registry. **It does not demonstrate issuance from ACC-native API**, which remains blocked by missing OAuth secrets and ledger migration.
- No real LOA issued, no ACC applicant record modified and no live Apps Script action disabled. Do **not** retire Apps Script or promote ACC to production solely on this preview.
- Registry review/confirmation of email and PDF appearance is still pending.


## 26 Nov 2026 — Gmail HTML parity correction
- Registry pointed out the first synthetic preview was plain text, unlike the actual V1 HTML message (bold programme/university, four-item numbered list, bold labels, clickable links). Its plain-text content and attachment filenames matched, **but its visual email presentation did not**. This was an error in the first UAT claim.
- Retrieved original Registry V1 MIME `text/html` part from an actual sent November 2026 LOA, decoded the quoted-printable body, replaced actual applicant details with placeholders, and staged `lib/loa-v1-html.js`.
- HTML regression check: original source HTML and HTML rendered with the same original MBA programme/matric are **character-for-character identical after MIME decoding and trimming**.
- `lib/loa-native.js` now constructs `multipart/mixed` containing `multipart/alternative` (plain text and the exact V1 HTML), plus exactly four PDFs, retaining the Registry sender display name.
- UAT preview #2 sent through the connected **IPGS Admission** account to the user's authorised Registry test inbox, with four synthetic PDFs and correct HTML. Both sent and received message records were read back and confirmed `text/html`, `text/plain` and all four PDF attachments.
- **Difference remaining:** V1 sent from `"Registry Department, IUC" <registry@innovative.edu.my>`; the synthetic preview was sent by `IPGS Admission <ipgs.admission@innovative.edu.my>`. Production ACC must use an authorised Registry Gmail account/verified send-as alias, not spoof the From address.
- The UAT preview also has an intentional warning banner and UAT subject prefix; neither should appear in live LOAs.
- **This is a connected Gmail/Drive format-preview test, not a successful native ACC Gmail OAuth end-to-end issuance.** ACC production remains blocked pending OAuth, sender verification, DB ledger and approval.


## 26 Nov 2026 — premium HTML email & online Acceptance
- User requested a new more attractive HTML layout while retaining substantive Registry email context and the four original PDF attachments; source contains a real token-based electronic Acceptance portal.
- **Verified in deployed Apps Script V2 source:** `Code.js doGet` serves `page=acceptance-v2` through `v2RenderAcceptancePage_`. `OfferLetterV2.js v2PrepareOffer_` generates a one-time token, hashes it in `V2_WORKFLOW`, stores `Acceptance Signing URL`, and constructs `<deployed web app>?page=acceptance-v2&token=<unique secret>`. The student page `acceptance-v2.html` lets the student review documents and sign once. A generic Acceptance Google Form is *not* needed for this digital route.
- **Important remaining dependency:** current Apps Script `v2PrepareOffer_` gates token generation on `ELIGIBLE_FOR_OFFER`. ACC-only issuance cannot depend on this. A new ACC-owned token/verification+acceptance integration is required before replacing this service in production; this is NOT completed.
- Implemented `lib/loa-premium-email.js` as a responsive table-based branded HTML with IUC logo, admission summary, a primary **Complete Online Acceptance** button and secondary buttons for **Student Portal**, **Official WhatsApp Community**, **Physical Student ID Card**. Manual Acceptance Google Form link removed; substantive Registry email and four PDFs retained.
- `renderPremiumLoaHtml` and `renderPremiumLoaText` require an individual trusted HTTPS Acceptance URL with a valid 32–256-character token in production. Preview only allows the ACC acceptance-demo page. The native issuer now **fails before the Google/Drive work or ledger claim** when there is no secure `Acceptance Signing URL`.
- A synthetic UAT email `[UAT DESIGN PREVIEW #3] IUC Letter of Admission – Premium HTML + Online Acceptance` was sent from connected IPGS Admission to the authorised Registry test inbox with four PDFs. Sent and received Gmail messages were read back and independently verified; this was a design-preview send, **not a native ACC issuance**.
- A synthetic preview page `loa-email-premium-preview.html` was committed on feature branch.
- Offline executable Node regression suite `scripts/test-acc-native-loa.mjs` was run on authorised user's online desktop: **PASS** (four SAC/IA/PR cases, invalid matric, duplicate issue, absent env fail closed, V1 four PDFs, premium buttons, no manual acceptance form, token gating, preview-only banner). No student records or production services changed.
- User visual design approval for preview #3 is pending.

## 26 Nov 2026 — detailed onboarding cards #4
- Registry review reported the three adjacent service buttons were visually weak, lacked explanation, and separated student portal credentials from the portal action. Original V1 email had specific WhatsApp and Physical ID instructions that must not be lost.
- `lib/loa-premium-email.js` now renders three **individual full-width mobile-friendly service cards** (numbered 01/02/03), each with an explanation and a full-width CTA, preserving the original portal username/initial-password instructions and programme matric display.
- WhatsApp card restores the V1 explanation covering announcements, orientation updates, class information and Registry communication. Optional Physical ID card restores V1 request wording about students requiring a physical card completing an application form.
- Retains secure electronic Acceptance as the first primary action; all three service URLs remain the original verified V1 targets. Manual Acceptance Form is not linked.
- Updated the static `loa-email-premium-preview.html` and regression tests to assert three card structures, original explanatory copy and all four buttons. Node test suite run on user's authorised desktop: **PASS**.
- UAT email `[UAT DESIGN PREVIEW #4] IUC LOA – Redesigned Student Onboarding` sent from connected IPGS Admission account to authorised Registry inbox with four synthetic PDFs. Independent sent+received records verified (HTML + 4 attachments). **This is design preview only, not production ACC issuance.**
- Pending: user design approval; integrate Registry sender and ACC-specific electronic Acceptance token with the signing backend before any live email. Existing Apps Script v131 and ACC production remain untouched.
