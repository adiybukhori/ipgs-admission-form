# Campus RPG V6 — Hybrid Individual + Cohort Operations

V6 keeps the production Admission V2 untouched and improves the simulation model.

## Changes from V5
- Avatar flicker fix: idle characters now use a stable static frame; textures are not repeatedly reset during each movement segment.
- Walking speed reduced substantially for easier visual tracking.
- Pre-orientation stages process applications individually.
- Each applicant reaches Orientation, receives the invitation task, then waits in a dedicated Orientation waiting area.
- Orientation is a cohort/batch stage: several students can wait together, then start one scheduled session together.
- After the session, the Orientation Follow-up Agent sends recording/community information to the whole cohort.
- The entire cohort then walks together to IT / Library / Moodle.
- Provisioning is represented as a batch/parallel stage for the cohort.
- The cohort then moves together to Academic Handover.
- Pause now pauses Phaser tweens as well as workflow progression.

## Foundation
- Phaser 3 — MIT
- Character and office sprite assets follow the same open/free asset foundation documented in Campus RPG V5.
