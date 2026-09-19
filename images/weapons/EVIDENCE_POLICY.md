# Scavland evidence and versioning policy

Scavland is Early Access. Game values, recipes, items, maps, equipment and mechanics may change between builds. The repository therefore preserves superseded evidence rather than deleting it.

## Authority

Evidence precedence for all categories:

1. Newest verified in-game screenshot or other direct in-game evidence.
2. Older verified in-game evidence.
3. Existing master/site data only where newer direct evidence is unavailable.

A newer verified screenshot overrides older website, JSON, HTML, notes and screenshots when they conflict.

## Scope

This policy applies to weapons, ammunition, armour, medical items, general items, crafting benches and recipes, map/location evidence, and future Scavland categories stored under `images/`, `screenshots/` or `data/`.

## Automatic archive

When an existing file under `images/`, `screenshots/` or `data/` is replaced, GitHub Actions preserves the previous version under `evidence-archive/`, retaining its original directory structure and adding a UTC timestamp to the filename.

The newly committed file remains at its normal path and is the current candidate evidence. Existing website paths therefore remain stable.

## Verification before factual publication

A new upload does not automatically rewrite factual site values. Direct evidence must be checked first. Once verified, the relevant master dataset and website output are synchronized and the source should be marked as verified where the schema supports it.

For weapon screenshots specifically, beige/yellow values are base stats; green/red attachment or equipment modifiers are excluded, and durability is excluded from the weapon master stats.

## Historical data

Files in `evidence-archive/` are historical evidence only. They must not override a newer verified current file. They are retained so changes across Early Access builds can be audited or reconstructed later.
