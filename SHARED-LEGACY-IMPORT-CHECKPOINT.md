# Reviewed legacy import contract — 1 October 2026

Resumed from the clean saved PR #30 branch. This checkpoint adds trusted preparation logic; no production calls, genuine draft changes, database migration or release occurred.

The selected-item review report now includes a stable digest of the current selected public identity, linked facets and patch settings. `prepareLegacyImport` requires explicit identity, per-item revision, legacy version/digest and public digest. It rejects stale review intent, conflicts, unsupported public-field changes, permission denial and competing saved edits. An unrelated pending note or specialist stat is retained. Deliberate shared imports propagate to applicable linked facets using the existing edit validation and review invalidation rules.

The resulting proposed state preserves the complete selected original/private legacy records, internal notes and exact historical verification metadata as private transfer context. Import actor/time is recorded separately from game verification. Historical decisions are not promoted into new attestations. The legacy source, input state and canonical documents are never mutated.

## Validation

Contract tests cover identity/revision/source/public binding, changes to another legacy item invalidating the whole snapshot digest, changed public specialist stats, forged actor fields, permissions, competing/disjoint per-item edits, shared propagation, exact historical context and public projection privacy. Existing legacy review, per-item creation/publication, SQL/API, admin and invitation regressions pass.

## Remaining implementation

This preparation function is not wired into a save endpoint or Import button yet. The existing overlap blocker still rejects publication even when proposed private transfer context is present; that context alone is not durable migration acknowledgement.

Next: authenticated import prepare/save with immutable snapshot validation, latest legacy/per-item checks and recoverable receipts; durable selected-item acknowledgement that the publication planner validates against the current trusted legacy version/digest; explicit UI confirmation and browser tests. Reject new legacy-only identities, classification/visibility moves and unsupported deletions until their separate reviewed paths exist. Keep all old versions intact.

Then regenerate the rollout manifest and coordinate release acceptance. General Items remains accessible and independent Ammo PR #22 stays held. The shared stack is still not live.
