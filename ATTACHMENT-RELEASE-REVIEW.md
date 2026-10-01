# Attachment release review — 1 October 2026

Status: draft preparation; no rollout performed. Work is on feature/shared-attachment-review / PR #37. Live Ammo/Armour/Weapons remain independent of this release proposal. Page Builder branch remains separate and unreviewed in this checkout.

## Verified preparation

- Server session/Items permission required; non-Items specialist permission is refused.
- Private service-only preparation and actor/command-bound receipt lookup; authenticated receipt-only saves.
- Immutable revisions, old-receipt retries, stale competing saves and legacy-version revocation verified in local PGlite.
- Reciprocal specialist/Attachment saved-authority guards share the item transaction lock.
- Fixed master-only output; vendor commercial data never rewritten.
- Explicit version/output/actor-bound expiring previews; fresh permission/version/conflict checks before non-force Git write.
- Approved images, explicit current-patch review, private archive/restore and preserved IDs/history.
- Browser fixtures cover classification, edit/reload, lost save responses, permission refusal, retry, confirmed reload, images/review/archive/restore, preview/publish and mobile widths.
- Pinned canonical source and disabled-default backend route verified. Existing Admin/invite suites passed after handler integration.

## Review fix

Repeated post-publication reconciliation could replace retained private verification history with the public summary. Fixed: identical public verification preserves private history on every refresh; changed public verification requires explicit review. Regression verifies retained history and no duplicated baselines. No genuine history was changed by this fix.

## Remaining release gates

1. Full Hub permission/navigation and cache release coordination; current draft card remains Release pending.
2. Combined browser-to-real-local-SQL endpoint checks and realistic multi-session race acceptance; separate browser/API/SQL suites do not establish this alone.
3. Review full dependency deployment manifest and migrations in order: attachment-classification-storage.sql, attachment-preview.sql. Neither is applied in production.
4. Check current production schema/permissions/drafts and publication flags before deployment. Preserve genuine old/shared drafts.
5. Explicit review of release scope: current screen edits existing identities; Add-new and recorded Weapon-ID compatibility are still absent. General Items access must remain.
6. Production deployment approval and subsequent signed-in Owner acceptance with an intended controlled item action. Do not publish fixture game data.

Publication checks span GitHub and Postgres; they do not provide one cross-service transaction. Non-force Git ref conflict protection remains; a private-state race after the final check is an acknowledged limitation requiring acceptance/mitigation review.

Copilot reports Page Builder tests and one unresolved hidden-item fixture assertion. Its source/branch is unavailable locally; those claims are not independently certified by this review.