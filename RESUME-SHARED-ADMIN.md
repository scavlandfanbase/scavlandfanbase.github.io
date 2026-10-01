**1 October next checkpoint:** Special FMJ Ammo recovery confirmed saved privately with history retained and Ammo Unverified. Read-only Attachment review foundation is implemented/tested: zero explicit Attachments, 74 candidates, exact vendor IDs and preserved commercial values. See SHARED-ATTACHMENT-REVIEW-CHECKPOINT.md. Next is the master-only trusted Attachment contract and permission/storage integration; no hosted Attachment editor or deployment yet. Page Builder work belongs to Copilot.

**Verified live — 1 October 2026:** PR #36 merged at e4b243d2c8855ddbdb9aa1df777190f8ea60c56e. Pages run 36834183922 succeeded; live Admin and all three category pages return 200 with shared-category-20261001-3, and the live script contains the explicit historical-review decision. admin-drafts v13 is ACTIVE. Ammo, Armour and Weapons releases are live. This supersedes preparation/approval-pending entries below. No genuine item import or game-data publication was performed during deployment. Next: administrator reviews Special FMJ Ammo, chooses Keep history and mark Unverified, and uses Preserve history and import; then reviews the private result before any explicit publication.
**1 October recovery fix:** explicit preservation of historical verification into private context with a new Unverified category review is prepared/tested. See LEGACY-REVIEW-RECOVERY.md. No genuine draft changed; deployment and administrator opt-in remain pending.

**Deployment update — 1 October:** admin-drafts v12 is active. PR #34 is ready for review but its frontend merge was rejected by automatic approval review pending explicit approval of the Armour/Weapons production rollout. Main/Pages remain cd460b2 (Ammo release). Items v20, Vendors v6 and zero shared versions are unchanged. No genuine game-data publication occurred.

**1 October category release:** Ammo activated explicitly after PR #33; Armour/Weapons shared screen, creation and receipt integration now fixture-tested. See SHARED-CATEGORY-RELEASE.md. Current live Admin tab is signed out; genuine acceptance remains pending.

Current handoff: ADMIN-AVAILABILITY-RELEASE.md. Shared storage/backend are now deployed; feature activation and frontend release remain pending. Earlier preparation-only statements below are historical.

# Resume shared Admin work — saved 30 September 2026

1 October follow-up: the reviewed import contract and authenticated save/acknowledgement UI are complete in PRs #31–32. See `SHARED-ROLLOUT-CHECKPOINT.md` for current release checks and rollout order. The historical overnight handoff below remains useful context; no shared-editor rollout has happened.

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

## Historical first task (completed by PR #32)

Implement the explicit reviewed legacy import and acknowledgement path described in `SHARED-LEGACY-PRESERVATION-CHECKPOINT.md`. Bind intent to exact legacy version/digest, selected identity, current public baseline and per-item version. Preserve private notes/history and unsupported fields, reject newer drafts/conflicts, and use trusted receipts. Do not bypass the current overlap blocker until exact transferred work has durable proof. No automatic classification, verification or game-data guesses.

Then prepare coordinated rollout and real Owner acceptance. Keep the general Items route until all category coverage is complete. Armour/Weapons/Attachments and other categories still require shared editor coverage. Vendor commercial values and stock remain independent; new items are never automatically stocked.

## Documentation and artifacts

- `NEXT_JOBS.md`: newest entries override historical tasks below them.
- `SHARED-LEGACY-PRESERVATION-CHECKPOINT.md`: latest batch and exact pending import/rollout requirements.
- `SHARED-AMMO-ACTIONS-CHECKPOINT.md`: connected Ammo actions and validation.
- `SHARED-CATALOGUE-PLAN.md`: agreed one-identity category design.
- Local `outputs/SHARED-ROLLOUT-MANIFEST.json`: hashes and ordered proposals, explicitly not ready for live activation. Regenerate after source changes with `scripts/shared-rollout-manifest.cjs`; its commit reflects the generation time.

Continue small commits and documentation updates, batching related tasks when useful. Do not commit private draft snapshots or credentials to this public repository.
