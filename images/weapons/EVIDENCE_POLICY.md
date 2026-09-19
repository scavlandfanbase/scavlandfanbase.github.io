# Weapon screenshot evidence policy

## Authority rule

The newest verified in-game screenshot for a weapon is the authoritative evidence for that weapon.

Evidence precedence:

1. Newest verified in-game screenshot.
2. Older verified in-game screenshot.
3. Existing master/site data only when no screenshot evidence is available.

For weapon statistics, use the beige/yellow base values shown by the game. Green/red equipment or attachment modifiers are excluded. Durability is not part of the weapon master stats.

## Screenshot storage

Current authoritative screenshots remain at `images/weapons/<weapon name>.png`.

When an existing screenshot at the same path is replaced, the GitHub Action `archive-weapon-screenshots.yml` saves the previous version under `images/weapons/archive/<weapon name>/<UTC timestamp>.png`.

This preserves old evidence without changing the image paths used by the website.

## Data verification

Uploading a new screenshot makes it the newest evidence image, but does **not** automatically rewrite numerical weapon data. The screenshot must first be visually verified. After verification, update `data/weapons.json`, mark it `screenshot-verified`, and sync the corresponding website data.
