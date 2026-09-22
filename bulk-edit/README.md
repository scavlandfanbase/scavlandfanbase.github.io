# Bulk Edit Sheets

This folder holds spreadsheet copies of the site's real data (`data/*.json`) so a patch's
stat/price changes can be made in Excel or Google Sheets instead of editing JSON by hand
or clicking through the Admin Hub one item at a time.

**The files in `data/*.json` are still the real database.** These CSVs are a temporary
copy for editing convenience — they get read back in and turned into the real update.

## Workflow

1. Someone runs `node scripts/bulk-edit-export.cjs` to (re)generate the CSV files here from
   the current live data. Always do this right before you start editing, so you're working
   from up-to-date numbers.
2. Open the relevant `.csv` file(s) below in Excel or Google Sheets and edit values from the
   patch notes. **Never change the `id` column** — that's how the file matches your row back
   to the correct in-game item. Leave a cell blank if you don't know the value; don't guess.
3. Save/export the sheet back to the same `.csv` filename in this folder (keep it as CSV, not
   `.xlsx`).
4. Someone runs `node scripts/bulk-edit-import.cjs` first — this is a **dry run** that only
   prints what would change, nothing is saved yet. Check the list looks right.
5. Run `node scripts/bulk-edit-import.cjs --write` to actually save the changes into
   `data/*.json`.
6. Review the site locally/on a branch, then commit and push as normal.

Do this on a separate git branch (not `main`) while the patch numbers are still being filled
in, so the live site isn't showing half-old/half-new stats partway through.

## Adding a brand new item (new patch content)

To add something that doesn't exist yet:

1. Add a new row at the bottom of the relevant sheet(s).
2. **Leave the `id` column blank.** The import script generates a stable id from the item's
   name automatically (the same way the Admin Hub does), so you never need to invent one.
3. Fill in `name` plus whatever stats you know; leave anything unknown blank.
4. If the new thing should also show up on the general Items page (price, rank, stack size),
   add a matching row in `items.csv` too, **using the exact same `name` text** in both rows —
   matching names automatically link to the same item behind the scenes. Set its
   `classification` to the right tag (`weapon`, `armour`, `ammunition`, etc.) so it appears on
   the correct page.
5. Run the import (dry run first). New rows are reported as `NEW <id>: ...` in the output —
   check the generated id and fields look right before writing.
6. If two rows end up with a name that already exists, the row is skipped with a warning
   instead of silently creating a duplicate — edit the existing row (fill in its `id`) instead.

New records are always saved as `pending-review` (never `screenshot-verified`) until real
evidence is attached, same as adding through the Admin Hub.

## What each file covers

| File | Covers | Feeds into |
|---|---|---|
| `items.csv` | Every item's shared identity: name, price, rank, stack size, consumable effects | `items.html`, and shared name/image on every specialist page |
| `weapons.csv` | Weapon combat stats: damage, RPM, range, accuracy, recoil, handling, ergonomics, reload | `weapons.html` |
| `armour.csv` | Armour/gear stats: price, ballistic/slash/radiation resistance, durability, repair class | `armour.html` |
| `ammo.csv` | Ammunition stats: price, damage, penetration, stack size | `weapons.html` ammo cards |
| `crafting.csv` | Recipe ingredient lists (view-only for now — see note below) | `crafting.html` |

A weapon's stats (damage, recoil, etc.) live in `weapons.csv`, but its name/price/rank might
be shared from `items.csv` — if a patch changes a weapon's price, that's in `items.csv`, not
`weapons.csv`. If you're not sure which sheet a value is in, search for the item name in both.

## Column notes

- **Blank cell = unknown/not set.** Don't put a guess in just to fill the cell — leave it
  blank if the patch notes don't say.
- **`source_status`, `source_file`, `source_note`** describe the evidence backing a record
  (e.g. `screenshot-verified`). Leave these alone unless you have a new screenshot to attach.
  If you only change a stat/price and leave `source_status` as-is, the import script will
  automatically flip a previously `screenshot-verified` record to `pending-review` for you —
  this is intentional, so nothing shows as "verified" against old evidence.
- **`stackable`** columns use `TRUE`/`FALSE`.
- **`classification`** (items.csv) is a list separated by semicolons, e.g. `weapon;vendor-item`.
  This controls which pages the item appears on — don't remove a tag unless you mean to hide
  it from that page.

## Crafting recipes (`crafting.csv`)

Recipe ingredient lists are exported for reference (`Name xQty; Name xQty`) but are **not**
imported automatically yet, because matching edited ingredient names back to the correct
item IDs safely needs extra care. For now, make recipe/ingredient changes through the
Specialist admin editor in the Admin Hub. Everything else in this folder (items, weapons,
armour, ammo) is fully round-trip.
