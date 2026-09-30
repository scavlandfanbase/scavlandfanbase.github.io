# Legacy preservation and rollout preparation batch — 30 September 2026

Prepared on top of draft PR #29. No genuine draft read/write, migration, merge, deployment or publication occurred in this batch.

## Implemented and verified

The connected Ammo screen now offers a read-only **Review existing Items work** report, including when an overlap blocks normal loading. The trusted API validates current category membership and permission before reading the old draft. Only the selected identity's original/current/saved values and complete private record are returned. Its source version and stable digest bind the report to the entire trusted snapshot. The report identifies uncontested shared edits, already-public changes, same-field conflicts and changes requiring manual review. It never guesses classifications, copies facts by name, imports a verification decision or changes a draft.

A third SQL proposal adds immutable private snapshots of an explicitly selected current Items draft version. The snapshot is copied directly from trusted legacy storage, including its whole payload, metadata, history and notes; there is no browser-supplied archive payload. The preservation function is service-only; tables are not directly readable/writable by browser or service roles. Retries return the same snapshot and stale versions or changed snapshot contents are rejected. The old draft stays intact. This proposal has been exercised against local SQL fixtures only.

`scripts/shared-rollout-manifest.cjs` generates a local SHA-256 manifest of the connected Hub/Ammo frontend, actual backend import graph and all three ordered SQL proposals. It verifies the Hub route and feature gate and reports any working-tree changes. It does not inspect secrets or contact production. The manifest explicitly says live activation is not ready.

Tests cover selected-item privacy, category permission, exact IDs, retained private notes, stable digests, three-way conflicts, already-public edits and manual visibility review. SQL/browser tests cover immutable snapshots, denied direct access, stale versions and the blocked editor's review dialog. Existing Ammo Add/retry/review/archive/restore/publication fixtures and admin/invitation regressions remain passing.

## Required import checkpoint — still pending

Preservation is not migration completion. An explicit import needs a reviewed selected-item intent bound to source version/digest and current public baseline. It must reject newer legacy/per-item versions, preserve unsupported fields as private context, retain historical actors/times without inventing new verification, and save through trusted receipts. It must record which exact selected-item changes were transferred before permitting the overlap blocker to accept them. The old catalogue must remain immutable/readable; later legacy writes need fresh conflict checks. New legacy-only identities, classification/visibility changes and deletion conflicts require explicit separate handling.

The existing overlap blocker is unchanged. A ready report is a candidate for reviewed import, not permission to publish. No genuine edits have been imported, overwritten, discarded or silently published.

## Coordinated rollout sequence

1. Complete and fixture-test the version-bound import/acknowledgement path. Review selected genuine work and preserve its exact latest version privately at rollout; do not commit private snapshots to this public repository.
2. Refresh production state and flags. Review the combined PR stack; keep independent Ammo PR #22 held.
3. Apply the three reviewed proposals in manifest order. Deploy the matching backend with `SHARED_ITEM_ENABLED=false`; verify existing Items/Vendor operations remain usable.
4. Merge matching frontend/backend source and set coordinated cache versions in the Hub iframe and Ammo script. After preservation/import acceptance, enable the shared gate. Existing publishing flags remain separately required.
5. Real Owner acceptance: intended private edit, reload, reviewed preview, explicit one-item publication; verify Ammo and stocking vendor output, unchanged vendor price/rank/quantity and unaffected unrelated drafts. Keep general Items accessible until all category coverage is complete.

Rollback: disable the shared gate first, retain all old/new private versions and snapshots, and revert frontend routing if required. Backend disablement or UI rollback does not reverse an already published intended game-data commit; review a separate corrective publication for that case. Do not drop the new schema as rollback.
