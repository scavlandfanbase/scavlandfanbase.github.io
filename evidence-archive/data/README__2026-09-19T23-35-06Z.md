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

## Migration status

These files were initially populated from the existing live HTML/text data on 18 September 2026. The live pages have **not** been switched to JSON yet; this keeps the current site stable while the structured data is checked and expanded.


## Current site integration

As of 19 September 2026, the shared site appearance is controlled by `site-theme.css` and `site-shell.js`. The live HTML pages still use embedded page data; the JSON files in this directory are the structured migration layer and should be verified before each live page is converted to fetch JSON directly.

See `../NEXT_JOBS.md` for the active migration and evidence-processing backlog.
\n## 19 September 2026 safety note\n\n`crafting.html` and `data/crafting.json` currently contain migrated/legacy crafting information that is not fully aligned. Do not automatically copy missing ingredients from the HTML into the JSON. Process the original crafting screenshots first, record only the visible confirmed requirements, and attach their evidence paths.\n\n`items.html` now reads the structured JSON sources and displays a verification badge. Only records whose relevant specialist source is explicitly `screenshot-verified` are labelled **In-game verified**; other records are labelled **Needs verification**. This UI rule does not itself validate any underlying game values.\n