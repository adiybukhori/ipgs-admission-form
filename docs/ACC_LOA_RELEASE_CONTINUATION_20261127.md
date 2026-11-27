# ACC native LOA release continuation — 27 November 2026

## Tested changes
- Corrected stale VM test: Programme Coordinator seeds are lexical bindings, not global properties; MEDU is now an approved mapped programme.
- The native issuer no longer depends on legacy LOA preparation to create a token. It generates a random 256-bit token, stores the SHA-256 hash and personal signing URL through the existing workflow columns, and sets the offer PDF URL/status before Gmail sends.
- Added workflow row/column preflight and duplicate-row detection before any PDF generation or issuance claim. The existing issuance ledger still blocks duplicate sends and records uncertain sends as REVIEW_REQUIRED.
- Fixed old MIME validator requiring the legacy ordered list even though approved premium HTML uses service cards.
- Added fail-closed ACC_LOA_ACCEPTANCE_BACKEND_READY flag. The signing-only Apps Script patch preserves the existing portal and native SAC/IA/PR stage, requires four signed PDFs and retains the legacy stage gate for historical LOAs.
- The source-patching utility writes a separate staged output, never deploys Apps Script. Confirm source against the deployed version before applying.

## Evidence
All five native/current test scripts passed locally on authorised desktop, including mocked full native issuance with four PDF exports, Drive uploads, MIME, hash, no real Gmail send, missing-column preflight and duplicate/failure cases; mocked signing finalisation preserves SAC/IA/PR and consumes the token once. The retired test-loa-unified.mjs references deleted historical Apps Script parity files and is not a valid test of the native release. Real Google API, signed-PDF rendering, Gmail receipt and live Acceptance are not yet verified.

## Release gate (not approved by tests alone)
Vercel production project inspected 27 Nov: ACC_LOA_GOOGLE_CLIENT_ID, ACC_LOA_GOOGLE_CLIENT_SECRET, ACC_LOA_GOOGLE_REFRESH_TOKEN, ACC_LOA_SENDER_EMAIL, ACC_LOA_CC_ROUTING_JSON, ACC_LOA_NATIVE_READY, ACC_LOA_LEGACY_CREDENTIAL_TEXT_APPROVED and ACC_LOA_ACCEPTANCE_BACKEND_READY are absent. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY exist in production; values were not retrieved.
1. Configure authorised Registry sender OAuth in encrypted Vercel production env, with approved sender/CC and safe portal credential instructions.
2. Confirm correct Supabase project, apply and verify staged ledger and coordinator migrations.
3. Compare current deployed Apps Script source and stage, test and deploy only the compatible signing backend patch. Existing V2 other modules must not be disturbed.
4. Run controlled, non-student real Google API end-to-end issuance and acceptance including four signed PDFs; confirm downstream acceptance module handling and all live gates.
5. Only then promote reviewed release and retire legacy LOA initiation. Do not set readiness flags prematurely or issue real student letters.

No production data, deployed Apps Script, or production ACC was changed during these tests. No real LOA email sent.