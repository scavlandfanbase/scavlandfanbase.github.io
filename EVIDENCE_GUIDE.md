# SCAVLAND Screenshot Evidence Guide

This guide explains how to add a game screenshot to the website and make it appear on the right page. It is written for editing directly on GitHub in a browser. You do not need to use a terminal.

If this feels like too much, upload a batch of screenshots here instead. I can do the filing, record updates, checks and publishing for you.

## The short version

Every verified screenshot needs two things:

1. The **image file**, saved under `evidence-inbox/`.
2. A link to it in the item's record under `data/`.

The image file is the proof. The data record tells the website what that proof verifies. Both are needed before the card can show **In-game verified** and an image preview.

```text
Screenshot file in evidence-inbox/
                ↓
Matching record in data/*.json
                ↓
Card on Armour, Items, Weapons, Crafting, etc.
```

## Before you upload a screenshot

Use an in-game tooltip, recipe, vendor screen or other in-game screen that clearly shows the thing you are verifying.

For armour resistance values, only use screenshots showing **100 durability**. A damaged item can show lower protection, so it is not enough to verify the normal values.

The screenshot should show as many of these as are relevant:

- Exact item name
- Value/price, where shown
- Description
- Durability
- Stats, such as damage or resistances
- Repair class, calibre, max stack, rank or ingredients

Do not guess a value that is covered by the game interface, another item or a previous website entry. Leave it alone until a screenshot shows it.

## Where to upload each type of screenshot

Open the matching folder on GitHub, choose **Add file**, then **Upload files**.

| What the screenshot shows | Upload folder |
| --- | --- |
| Armour, helmets, masks, trousers, backpacks | `evidence-inbox/armour/` |
| General items, tools, food, medicine, materials | `evidence-inbox/items/` |
| Guns and melee weapons | `evidence-inbox/weapons/` |
| Ammunition | `evidence-inbox/ammo/` |
| Crafting recipes | `evidence-inbox/crafting/medical/`, `evidence-inbox/crafting/weapon/`, or `evidence-inbox/crafting/armour/` |
| Weapon attachments | `evidence-inbox/attachments/` and its closest subfolder |
| Faction or character pages | `evidence-inbox/factions/` |
| Map/area screens | `evidence-inbox/map/` |
| Vendor shop inventory screens | `evidence-inbox/vendors/` |
| You cannot identify it yet | `evidence-inbox/unresolved/` |

Do not put new proof screenshots in `images/`. That folder is for older display artwork and reusable assets. `evidence-inbox/` is the source of truth for verification.

## Screenshot names

Use lowercase names with hyphens. This makes files easy to find and stops different screenshots being confused.

Use this pattern:

```text
item-name__what-it-shows__YYYY-MM-DD.png
```

Examples:

```text
skull-mask__stats-100-durability__2026-09-20.png
stronghold-vest__stats-100-durability__2026-09-20.png
gun-lube__tooltip__2026-09-20.png
mikhail-47__stats__2026-09-20.png
stimpack__recipe__2026-09-20.png
grigory__shop-screen-part-1__2026-09-20.png
grigory__shop-screen-part-2__2026-09-20.png
```

Use `part-1`, `part-2`, and so on when one screenshot is a continuation of another. Keep the main vendor/character header in part 1 if possible.

## How to make an armour screenshot appear on the Armour page

### Example: add verified Skull Mask evidence

1. Upload the screenshot to:

   ```text
   evidence-inbox/armour/skull-mask__stats-100-durability__2026-09-20.png
   ```

2. Open `data/armour.json` and search for:

   ```json
   "id": "skull-mask"
   ```

3. Enter only the values visible in the tooltip. Use this shape inside that item's `{ ... }` block:

   ```json
   "price": 5000,
   "durability": 100,
   "ballistic": 3,
   "slash": 10,
   "radiation": 0,
   "repairClass": "Tattered",
   "image": "evidence-inbox/armour/skull-mask__stats-100-durability__2026-09-20.png",
   "stackable": false,
   "source": {
     "file": "evidence-inbox/armour/skull-mask__stats-100-durability__2026-09-20.png",
     "status": "screenshot-verified",
     "lastVerified": "2026-09-20",
     "note": "Direct in-game tooltip at 100% durability."
   }
   ```

4. If the screenshot shows a description, add it as one line:

   ```json
   "description": "The exact description shown in the game."
   ```

5. Open `data/items.json`, find the same ID, and link the same screenshot there too:

   ```json
   "image": "evidence-inbox/armour/skull-mask__stats-100-durability__2026-09-20.png",
   "source": {
     "file": "evidence-inbox/armour/skull-mask__stats-100-durability__2026-09-20.png",
     "status": "screenshot-verified",
     "note": "Verification synchronized from canonical Armour record"
   }
   ```

6. Commit your changes. The Armour card will show **In-game verified** and the screenshot. The Items page can also show the preview.

### Important armour rules

- Do not change `vendorRank` unless the screenshot actually shows a vendor rank.
- `"vendorRank": "-"` means no rank is currently documented. `null` also means unknown.
- `stackable` is `false` only when the tooltip says **Not Stackable**.
- Keep the spelling used by the game and the existing ID. For example, the current record is intentionally called `balistic-kask`, even though “ballistic” is usually spelled with two Ls.

## How to make a verified item screenshot appear on the Items page

1. Upload the proof to `evidence-inbox/items/`.
2. Open `data/items.json` and search for the exact existing `id`.
3. Add the screenshot path and verification source:

   ```json
   "image": "evidence-inbox/items/gun-lube__tooltip__2026-09-20.png",
   "source": {
     "file": "evidence-inbox/items/gun-lube__tooltip__2026-09-20.png",
     "status": "screenshot-verified",
     "lastVerified": "2026-09-20",
     "note": "Direct in-game tooltip."
   }
   ```

4. Only add `rank`, `estimatedPrice`, `maxStack`, or other fields if the screenshot visibly shows them.

The Items page reads the `image` first. If that is missing, it can use `source.file` when the source status is `screenshot-verified`.

## Weapons and ammunition

### Weapons

1. Upload to `evidence-inbox/weapons/`.
2. Update the matching record in `data/weapons.json`.
3. Give it an `image` and a verified `source`, just as in the item example.
4. Enter only the displayed weapon stats: damage, fire rate, range, accuracy, recoil, handling, ergonomics, reload, durability, repair class and calibre where visible.

Use a filename such as:

```text
mikhail-47__stats__2026-09-20.png
```

### Ammunition

1. Upload to `evidence-inbox/ammo/`.
2. Update the matching record in `data/ammo.json`.
3. Link the matching record in `data/items.json` if it already exists there.

Use a filename such as:

```text
rifle-fmj-ammo__stats__2026-09-20.png
```

## Crafting recipes

Crafting screenshots prove a recipe, not automatically every individual ingredient's item stats.

1. Upload the recipe screen to the correct `evidence-inbox/crafting/` subfolder.
2. Update the matching recipe in `data/crafting.json` with the exact screenshot path in its source.
3. Do not mark a separate item screenshot-verified only because it appears as an ingredient in a recipe.

Use a filename such as:

```text
stimpack__recipe__2026-09-20.png
```

## Vendor screenshots

Vendor screens can prove the vendor's identity and show visitors the shop layout. They do **not** prove the website's individual item names, prices, or unlock ranks unless those words and numbers are readable on the screen.

1. Upload to `evidence-inbox/vendors/`.
2. Name multi-image shops with `part-1`, `part-2`, and so on.
3. Add the image list in the vendor's record in `data/vendors.json` under `shopEvidence`.

Example:

```json
"shopEvidence": {
  "status": "reviewed",
  "reviewedAt": "2026-09-20",
  "screenshots": [
    {
      "file": "evidence-inbox/vendors/grigory__shop-screen-part-1__2026-09-20.png",
      "part": 1
    },
    {
      "file": "evidence-inbox/vendors/grigory__shop-screen-part-2__2026-09-20.png",
      "part": 2
    }
  ],
  "pricesVerified": false,
  "unlockRanksVerified": false
}
```

The Vendor page will show these in the vendor's popup gallery. Leave the existing inventory table unverified until readable labels, prices and ranks are shown.

## Faction, character, map and area screens

Use the folder from the table above and link the screenshot only to the record it directly proves:

- A character card can verify that a named vendor belongs to a faction.
- A faction page can verify that faction's text or identity.
- A map screen can support a location claim.

It does not prove unrelated item stats, vendor inventories or prices.

## The safest way to edit JSON on GitHub

JSON is fussy about commas. The easiest safe approach is:

1. Find the existing item by its `id`.
2. Change only the values that the screenshot proves.
3. Keep every comma that was already there.
4. Put a comma after a property if another property follows it.
5. Do not add a comma after the final property before `}`.
6. Use straight double quotation marks: `"like this"`.
7. Use forward slashes in paths: `evidence-inbox/armour/file.png`.

If GitHub says the JSON looks wrong, cancel the edit and send the screenshot here. A broken JSON file can stop a whole page from loading.

## What happens after you commit

1. GitHub Pages republishes the website. It normally takes a short time.
2. When a file changes under `evidence-inbox/`, the evidence index workflow scans it and updates `evidence-analysis.json` automatically.
3. Refresh the relevant page. The card should show **In-game verified** and a **Tap or click to enlarge** image preview.

Do not edit `evidence-analysis.json` by hand. It is generated from the evidence folder.

## Final checklist

Before committing, check:

- [ ] The screenshot is in the right `evidence-inbox/` folder.
- [ ] The file name describes the item and what it proves.
- [ ] The data record uses the exact same path.
- [ ] `source.status` is `screenshot-verified` only when the screenshot directly proves the values.
- [ ] Armour stat screenshots show 100 durability.
- [ ] I have not guessed a vendor rank, price, name or stat.
- [ ] The matching `items.json` record is linked when the item appears on Items too.

## Easiest option: send batches here

You can send batches of roughly 10–20 screenshots at once. Tell me only if a screenshot is a continuation of another or if there is anything unusual. I will organise the files, update the correct records, keep unproven facts unverified, test the pages and publish the batch.

