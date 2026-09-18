# SCAVLAND Website — Next Jobs

Last reviewed: 18 September 2026

This is the active project backlog. Work from the top unless a new game-data update or site bug takes priority.

## Priority 1 — Process screenshot evidence

- [ ] Identify the screenshots in `images/items/` and rename them to descriptive item-based filenames.
- [ ] Extract only confirmed visible item data and update `data/items.json`.
- [ ] Identify and rename screenshots in `images/weapons/`; compare their stats against `data/weapons.json`.
- [ ] Identify and rename screenshots in `images/armour/`; compare their stats against `data/armour.json`.
- [ ] Process the 22 crafting screenshots/recipes and attach evidence paths to `data/crafting.json`.
- [ ] Review faction screenshots and decide whether they add evidence beyond the existing faction icons/data.
- [ ] Connect the normalized ammo icons/detail screenshots in `images/ammo/` to the 13 records in `data/ammo.json`.
- [ ] Flag unreadable or conflicting screenshot values instead of guessing.

## Priority 2 — Clean repository assets

- [ ] Check remaining `- Copy` timestamp files in item/weapon folders; delete only confirmed byte-identical or visually duplicate files.
- [ ] Review duplicated weapon/item screenshot SHAs that appear in both `images/items/` and `images/weapons/` and retain one canonical evidence location where appropriate.
- [ ] Review root `Antatoly.png` against `images/vendors/anatoly.png`; remove the root file if confirmed obsolete.
- [ ] Decide whether the legacy root `ammo` documentation file can be retired after ammo JSON/evidence is fully verified.
- [ ] Review old `images/scavland-banner.jpg.png` now that the official logo is used in the shared header.
- [ ] Keep `images/branding/Scavland_Logo_2025.png` as the shared header logo.

## Priority 3 — Make JSON the live source

Migrate incrementally and test after every page:

1. [ ] Weapons + Ammo → `data/weapons.json` and `data/ammo.json`
2. [ ] Armour → `data/armour.json`
3. [ ] Crafting → `data/crafting.json`
4. [ ] Vendors → `data/vendors.json` + `data/vendor-selling-rates.json`
5. [ ] Factions → `data/factions.json`

Do not remove embedded HTML/JavaScript data until the equivalent JSON-powered page has been tested.

## Priority 4 — Database/site features

- [ ] Build a dedicated Items database/search page from `data/items.json`.
- [ ] Add item images/icons to cards and detail views where verified assets exist.
- [ ] Add cross-links: vendor item → item record; crafting ingredient → item; weapon → ammo; faction → vendors.
- [ ] Improve Areas page; it is currently under construction.
- [ ] Consider vendor portraits on directory cards.
- [ ] Add accessible keyboard/focus handling to vendor modal.
- [ ] Test map pan/zoom on desktop, phone and tablet.

## Priority 5 — Maintenance/QA

- [ ] After JSON migration, generate `MASTER_DATABASE.md` from the canonical JSON rather than maintaining duplicated tables manually.
- [ ] Check internal links and navigation after major changes.
- [ ] Check responsive layouts at phone, 1080p, 1440p and 4K widths.
- [ ] Keep developer-provided vendor percentage wording exact.
- [ ] Never infer undocumented game values.

## Current confirmed baseline

- 257 indexed item identities
- 40 weapons
- 29 armour/gear records
- 13 ammo records
- 22 vendors
- 9 factions
- 22 crafting recipes
- Shared header/navigation: `site-shell.js`
- Shared visual theme: `site-theme.css`
- Interactive map: `map.html`
- Official header logo: `images/branding/Scavland_Logo_2025.png`
