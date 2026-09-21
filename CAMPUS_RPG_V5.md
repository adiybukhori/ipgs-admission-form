# Campus RPG V5 — polished prototype

This branch is a separate visual prototype. Production Admission V2 remains unchanged.

## Open-source / free visual foundation
- Phaser 3 — MIT
- Pixel-office reference implementation: https://github.com/ashawareb/the-office
- Character sprite sheets in the prototype are the Modern Interiors / Modern Exteriors character assets used by that project.
- Furniture sprites used by the reference project include Bitglow Pixel Interior assets.
- The source project documents the character/furniture asset provenance in web/public/assets/README.md and the furniture license in web/public/assets/furniture/bitglow_license.txt.

## V5 additions
- Real 16x32 animated character sheets
- Sit / idle / walk state switching for staff
- Multiple visible specialist NPCs per station
- Tile-based office floors and room walls
- Furniture sprites: bookshelves, plants, lamps, paintings, sofas
- Ambient students walking in the central corridor
- Animated monitor glow, coffee steam and fountain ambience
- Applicant call animation, staff escort, handoff chimes
- Camera pan, zoom, follow mode, minimap, HUD hide/show
- Direct Entry / IA / Prerequisite full routes
- Existing /api/admin-data connection stays read-only
