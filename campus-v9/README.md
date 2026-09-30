# Campus RPG V9 — high-detail campus build

Open `/campus-rpg-v9.html`. This is an isolated visual simulation page. The production Admission V2 API, pages, data, and the prior Phaser prototypes are unchanged.

## Implementation

V9 uses a dependency-free Canvas 2D renderer, with separate scene, actor, navigation, workflow, station, lounge, orientation-session, adapter and HUD modules. Generated transparent character and furniture atlases are local assets. Prior Phaser versions remain available; this build deliberately does not require a CDN to render.

- 3680 × 2400 campus with ten distinct departments, central lounge, courtyard and fountain.
- Concurrent per-applicant processing; station reservations; FIFO iteration; padded grid navigation shared by applicants/staff.
- Explicit waiting states and reserved lounge seats; selectable reason and waiting timestamp; simulated human hold/release.
- Mixed Direct / IA / IA→Prerequisite routes. Prerequisite completion goes straight to Offer, never back to SAC.
- SAC sessions open manually or on the simulation clock. Prerequisite configuration supports batch capacity but teaching tasks currently run per participant.
- Orientation has waiting, session, follow-up, group movement, provisioning and handover phases. New arrivals cannot join an ongoing session.
- Camera drag, zoom, follow, full map; collapsible operational HUD; simulation pause, speed and reset.
- Read-only `/api/admin-data` snapshot adapter joins `Reference No` to `V2_WORKFLOW`, uses explicit stage mappings, and parks unknown stages for human review. It does not mutate source records, send emails, create accounts, or execute AI calls. Credentials are not persisted. Snapshots require manual reload and are not a live event subscription.

## Limitations

This is a playable first milestone, not visual parity with the reference illustration. Character walking uses bob/lean motion and seated compositing from an eight-character atlas, not full directional animation frames. The navigation grid protects modeled floor footprints; characters do not avoid each other. The demo is capped at 30 applicants. Services are parallel cohort processing rather than real integrations. The formal outcome and communication actions are simulated.

## Validation

Automated deterministic simulation exercises all 12 seeded applicants across the three routes, station capacities, waiting seats and cohort completion. No blocked movement samples in the validated run. Browser checks are performed against the Vercel branch preview when available.

Art: newly generated character/furniture atlases for this build; campus architectural elements are renderer-owned. No altered official logo artwork is used; the header is a text IUC/IPGS identifier.
