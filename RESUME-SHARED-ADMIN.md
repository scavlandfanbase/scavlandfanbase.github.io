# Resume shared Admin work — saved 30 September 2026

User stopped work for the night. Resume from this handoff and NEXT_JOBS.md; do not restart completed checkpoints or activate production from historical approvals.

## Saved state

Repository: scavlandfanbase/scavlandfanbase.github.io. Current preparation branch: `feature/shared-legacy-preservation`.

All implementation is committed and pushed in a stacked draft PR sequence:

- PR #23: read-only shared catalogue foundation.
- PR #24: per-item contract and trusted storage proposal.
- PR #25: authenticated API and version-bound publication preview.
- PR #26: connected Ammo screen, shared details/stats and vendor usage.
- PR #27: private Verified/Unverified review with retained history.
- PR #28: shared identity/facet creation contract.
- PR #29: Add, unpublished-item listing, missing facets, archive/restore and interrupted-creation recovery.
- PR #30: read-only selected-item legacy review, immutable private snapshot proposal and rollout manifest.

PR #22 remains held: its independent Ammo draft design is superseded. PRs above are preparation, not live completion. No merges, production migrations, deployments or genuine draft changes were made in these batches. The latest known live recovery release is `98d121a`; verify production again before any rollout because this is historical state.

Tests pass for contract/Git publication, local SQL permissions/receipts/history/snapshots, headless Edge flows and existing admin/invitation regressions. The latest batch tests include legacy conflict/private-context reports, stale/altered snapshot rejection and a blocked editor's read-only review dialog.

## First task tomorrow

Implement the explicit reviewed legacy import and acknowledgement path described in `SHARED-LEGACY-PRESERVATION-CHECKPOINT.md`. Bind intent to exact legacy version/digest, selected identity, current public baseline and per-item version. Preserve private notes/history and unsupported fields, reject newer drafts/conflicts, and use trusted receipts. Do not bypass the current overlap blocker until exact transferred work has durable proof. No automatic classification, verification or game-data guesses.

Then prepare coordinated rollout and real Owner acceptance. Keep the general Items route until all category coverage is complete. Armour/Weapons/Attachments and other categories still require shared editor coverage. Vendor commercial values and stock remain independent; new items are never automatically stocked.

## Documentation and artifacts

- `NEXT_JOBS.md`: newest entries override historical tasks below them.
- `SHARED-LEGACY-PRESERVATION-CHECKPOINT.md`: latest batch and exact pending import/rollout requirements.
- `SHARED-AMMO-ACTIONS-CHECKPOINT.md`: connected Ammo actions and validation.
- `SHARED-CATALOGUE-PLAN.md`: agreed one-identity category design.
- Local `outputs/SHARED-ROLLOUT-MANIFEST.json`: hashes and ordered proposals, explicitly not ready for live activation. Regenerate after source changes with `scripts/shared-rollout-manifest.cjs`; its commit reflects the generation time.

Continue small commits and documentation updates, batching related tasks when useful. Do not commit private draft snapshots or credentials to this public repository.
