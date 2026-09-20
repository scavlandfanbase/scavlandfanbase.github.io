# SCAVLAND Data Directory

This directory is the structured data layer for the SCAVLAND fan database.

## Editing rules

1. **Use stable IDs.** IDs are lowercase slugs such as `metal-scrap`. Other files reference these IDs.
2. **Do not guess missing values.** Use `null` or leave the information explicitly undocumented.\n3. **Screenshot confirmation is the canonical threshold.** Do not promote migrated HTML, legacy site data, community reports, or inferred values into the master/canonical dataset as confirmed unless an in-game screenshot (or another explicitly approved authoritative source) verifies it.\n4. **Status has meaning.** `screenshot-verified` may be shown as **In-game verified**. Other statuses must remain visibly unverified/review-needed until evidence is processed.
5. **Keep names exactly as shown in game/source evidence.** For example, `WG-40` and `Plier` are intentional.
6. **Preserve provenance.** The `source` field records where migrated information came from. New screenshot-derived facts should identify the screenshot path once uploaded.
7. **Images are references, not data.** Original evidence may be kept in the relevant category folder or `images/screenshots/`; reusable site assets should use descriptive filenames and records should retain the evidence path.
8. **Prices and percentages are not interchangeable.** Vendor selling modifiers must not be treated as an item's base value unless the game/developers explicitly establish that relationship.
9. **Update once, reuse everywhere.** The long-term goal is for the HTML pages to read these JSON files instead of embedding duplicate data.

## Files

- `items.json` — central registry of every currently referenced item name and stable ID.
- `weapons.json` — weapon-specific statistics.
- `armour.json` — armour/gear-specific statistics.
- `ammo.json` — ammunition statistics and descriptions.
- `vendors.json` — vendors, factions, locations and inventories.
- `vendor-selling-rates.json` — developer-provided vendor buy-rate information.
- `factions.json` — faction descriptions and image references.
- `crafting.json` — workbench recipes and ingredient relationships.

## Adding a new item from a screenshot

First add or confirm the item in `items.json`. Use its stable ID in any specialist file. Record only information visible in the screenshot or otherwise confirmed. Store the original screenshot in the appropriate image/evidence folder and set the record's source to that exact path. If a value cannot be read confidently, use `null`.

## Migration and verification status

As of 20 September 2026:

- `weapons.html` reads `data/weapons.json`; **38/39** canonical weapon records are screenshot-verified. Base `2HMG` remains unverified because only Short/Long screenshots are archived.
- `armour.html` reads `data/armour.json`; **3/30** records currently meet the screenshot-verification threshold. Armour resistance evidence requires a screenshot at **100% durability**.
- `ammo.json`: **13/13** screenshot-verified with exact organised evidence paths.
- `crafting.html` reads `data/crafting.json`; **22/22** recipes are screenshot-verified.
- `items.html` reads the structured JSON sources. `data/items.json` currently has **172/255** screenshot-verified records.
- Item verification badges require persisted `source.status: "screenshot-verified"`; matching another verified dataset at runtime is not sufficient.
- Evidence is organised under `evidence-inbox/` by category. Do not return to opaque timestamp-only filenames. Two genuinely unidentified screenshots remain deliberately under `evidence-inbox/unresolved/`.
- `MK Slotted Mount Handguard` has conflicting screenshot evidence and must remain unverified until that conflict is resolved.
- Direct screenshot evidence supersedes community/legacy values. Example: Svobodnik M4 is verified at 17 damage / 700 RPM / 19 range / 65 accuracy / 44 recoil / 22 handling / 18 ergonomics / 1.0 reload.

For the active backlog and cross-device handover, see `../NEXT_JOBS.md`.
