# Shared Ammo rollout checkpoint — 1 October 2026

The connected Ammo editor and explicit private legacy import are prepared through draft PR #32. The release review corrected stale handoff/manifest tasks, clarified private import wording, and coordinated the Hub and Ammo script cache tag as `shared-ammo-20261001`.

## Fresh read-only production evidence

GitHub main remains `98d121a0c0e7fd3d4a806d7f9e95cc34def35a1e`. PRs #23–32 remain a draft stack with their expected bases; independent Ammo PR #22 remains held. Production admin-drafts is active version 10. Production has the existing scavland_drafts prepared/versions/patch_attempts tables, with Items catalogue version 20 and Vendors version 6. The new shared-item tables/functions are absent. No genuine payloads were exported, imported or changed. Environment flag values were not read and remain unverified.

## Validation

Admin/invitation regressions, per-item creation/publication contract, legacy review/import contract and real local SQL/API/headless Edge checks pass. These use fixture Auth/Git services and establish implementation behaviour, not real Owner production acceptance. The wording/cache adjustments were followed by a repeat browser/storage check. No broader unrelated audit was performed.

## Coordinated release order

1. Review final combined PR #32 tree against main. Earlier stacked proposals are historical revisions: use the final three proposals, not an older definition from an intermediate PR. Keep PR #22 excluded.
2. Privately review the genuine Items v20 work against fresh public data. Supported uncontested selected-item work can use explicit Import privately; conflicts, classification/visibility changes and unsupported fields require separate decisions. Preserve the complete source snapshot before any import.
3. Apply final shared-item-drafts.sql, shared-item-api.sql and shared-item-legacy-preservation.sql in that order. All three must exist before the new API is used: draft save refers to the preservation table. Verify grants, RLS and RPC signatures after application.
4. Deploy the complete admin-drafts dependency graph with SHARED_ITEM_ENABLED false. Confirm actual publishing flags without exporting secrets. Release the coordinated frontend only after backend/schema readiness; then explicitly enable the shared editor for acceptance.
5. Owner checks private save/reload, explicit import if appropriate, preview and a deliberately chosen one-item publication. Confirm its Git commit, public Ammo result and stocking vendor shared details; vendor price/rank/stock must remain independent. New items must remain unstocked.

Keep general Items available. Armour, Weapons, Attachments and remaining category coverage are subsequent tasks. This checkpoint does not certify the whole Admin Hub as complete.

If acceptance fails, disable SHARED_ITEM_ENABLED and retain all private drafts/snapshots. Do not drop tables or erase imported history. Published JSON would require a separate reviewed correction; disabling the editor does not undo publication.

No production migration, merge, deployment, flag change or publication was performed. Live release authorization and genuine Owner acceptance remain pending. The refreshed local manifest records exact file hashes and its source commit.
