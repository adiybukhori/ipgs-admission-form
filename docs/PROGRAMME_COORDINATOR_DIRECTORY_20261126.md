# ACC Programme & Coordinator Directory — Registry-approved mapping
Date: 26 November 2026
Status: **UAT branch only, not production**.

## Rules
- A student's Official LOA email shows **only one coordinator for the chosen programme** and the universal IPGS Registry & Admissions contact.
- `MBA + PhD` → MBA coordinator, `MBM + PhD` → MBM coordinator. No list of all coordinators.
- Legacy `DPLI` enrolments use the renamed PGDT coordinator.
- Programmes without confirmed coordinator → Registry only. Do not guess staff email addresses.
- Do not add **Diploma in Business Administration ODL / DBA ODL**; it is not currently under IPGS.
- `MEDU - Master in Education` is newly included in the **Master** level on the ACC Admission Form UAT branch. This is not yet a live programme change in production.
- BBA already exists in the ACC Admission Form and uses the same PIC as MBA.
- Coordinator emails were checked in institutional Google Contacts; programme assignments are based on the Registry's direct instruction.

## Approved mapping

| Programme code | Programme | PIC | Email |
|---|---|---|---|
| PGDT | Postgraduate Diploma in Teaching | Rushdina Arifah Rushdan | rushdina@innovative.edu.my |
| DPLI (legacy) | Renamed as PGDT | Rushdina Arifah Rushdan | rushdina@innovative.edu.my |
| MBA | Master of Business Administration | Muhammad Naqiyuddin Bin Mohd Jihat (Naqi) | naqiyuddin.ipgs@innovative.edu.my |
| MBM | Master in Business Management | Abuzar Bin Azizan | abuzar@innovative.edu.my |
| MHUM | Master in Hajj & Umrah Management | Muhammad Naqiyuddin Bin Mohd Jihat (Naqi) | naqiyuddin.ipgs@innovative.edu.my |
| MIS | Master in Islamic Studies | Aminah Binti Abdullah | aminah.abdullah@innovative.edu.my |
| PhD | Doctor of Philosophy in Management | Noorus Sarah | noorus.sarah@innovative.edu.my |
| DBA | Doctorate of Business Administration | Noorus Sarah | noorus.sarah@innovative.edu.my |
| MEDU | Master in Education | Muhammad Abu Huzaifah Bin Zulkifli | abu.huzaifah.ipgs@innovative.edu.my |
| BBA | Bachelor in Business Administration | Muhammad Naqiyuddin Bin Mohd Jihat (Naqi) | naqiyuddin.ipgs@innovative.edu.my |
| MBA + PhD package | Master + PhD | Inherit MBA / Naqi | naqiyuddin.ipgs@innovative.edu.my |
| MBM + PhD package | Master + PhD | Inherit MBM / Abuzar | abuzar@innovative.edu.my |

## Location and maintenance
- **Current implemented mapping:** `lib/loa-premium-email.js` → `IPGS_PROGRAMME_PIC`, `picForProgramme`.
- **Current Admission Form dropdown:** `index.html` → `PROGRAMME_OPTIONS`.
- **Native LOA programme parser:** `lib/loa-native.js` → `accNativeLoaReference`.
- **Email fallback subject:** `lib/loa-v1-email.js`.
- **Automated regression:** `scripts/test-programme-coordinators.mjs`.
- **Future self-service enhancement (NOT implemented):** `ACC → Settings → Programme & Coordinator Directory` with programme code, full approved title, level, coordinator, official email, active/inactive status and optional inherited-master mapping. It must use a durable authoritative database and feed both the Admission Form options and LOA renderer; until then, updates require a reviewed code change. Do not tell Registry that a self-service screen already exists.

## UAT evidence
- 12 programme/PIC and package scenarios passed in a local Node test on the authorised desktop on 26 Nov 2026.
- MEDU and BBA are accepted by the ACC-native LOA programme parser.
- No Diploma DBA ODL was inserted.
- No real student LOA was generated/sent and no production settings or deployed Apps Script were changed.
