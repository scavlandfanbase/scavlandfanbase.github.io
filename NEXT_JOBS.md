# SCAVLAND Website — Next Jobs

Last reviewed: 19 September 2026

This is the active project backlog. Work from the top unless a new game-data update or site bug takes priority.\n\n## Permanent cross-device documentation rule

**This rule applies to every future repository change, regardless of device or chat session.**

Whenever any website code, structured data, assets, navigation, UI, database content, verification status, or project configuration is changed:

1. Update the project documentation **in the same work session** before considering the task complete.
2. Record what changed and which files/areas were affected.
3. Record whether game data involved is screenshot-verified, unverified, community-sourced, or otherwise pending evidence.
4. Record important decisions or rules that a future session must preserve.
5. Record the relevant commit SHA/reference when useful.
6. Update completed/remaining jobs so the next session knows exactly where to resume.
7. Never leave a repo change undocumented simply because it was small.
8. If a change is reverted, abandoned, or deliberately not made, document that too when it affects the expected project state.

**Purpose:** a new ChatGPT session on phone, PC, or another device must be able to inspect the repository documentation and continue the SCAVLAND project without relying on the previous chat transcript.

## Handover — 19 September 2026\n\n- Repository: `scavlandfanbase/scavlandfanbase.github.io`, branch `main`.\n- **Strict evidence rule:** do not promote a value into canonical/master data unless it is confirmed by an in-game screenshot or another explicitly approved authoritative source. Existing HTML or migrated JSON is not proof by itself.\n- `source.status: screenshot-verified` means the record may be presented as **In-game verified**. Legacy statuses such as `existing-site-data`, `community-reported-correction`, or migration-derived data must not be silently treated as screenshot-confirmed.\n- If evidence is missing, conflicting or unreadable, leave the value unverified/`null` and flag it for review. Never fill gaps by inference.\n- Crafting: `crafting.html` currently contains 22 embedded recipes and `data/crafting.json` contains a migrated copy. They do not fully match. **Do not reconcile or promote the extra HTML ingredients until the crafting screenshots are processed.** A proposed reconciliation was deliberately stopped before any repository write.\n- Items navigation is already immediately after Map in `site-shell.js`.\n- `items.html` is already JSON-driven and now displays verification badges. It shows **✓ In-game verified** only when linked specialist records are explicitly `screenshot-verified`; otherwise it shows **Needs verification**. No game values were changed for this UI update.\n- Verification-badge commit: `a7ee0c7fb2de0b37543d357de5f936d2eb678a38`.\n- Continue safe UI/site functionality work when screenshots are unavailable; do not use that as a reason to alter unverified game data.\n- Documentation audit completed 19 September 2026: `MASTER_DATABASE.md` was found to be a legacy generated snapshot containing stale/unverified values. It is now explicitly marked non-canonical until regenerated from verified JSON. `.github` contains the weapon screenshot archival workflow; `evidence-archive/` contains historical snapshots and is evidence/history, not current canonical data.\n

## Priority 1 — Process screenshot evidence

- [ ] Re-verify all weapon stats against current game data; community report on 18 September 2026 identified multiple outdated damage values. Corrections already applied: 63 Dragoon 36, M4 Svodbonik 19, Mikhail 47/MK47 20.

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

- [x] Build a dedicated Items database/search page from `data/items.json`.\n- [x] Add verification badges to Items so screenshot-verified records are visually distinct from records still needing verification.
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
