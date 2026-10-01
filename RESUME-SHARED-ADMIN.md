**Attachment controls — 1 October:** approved images, explicit current-patch review and archive/restore now prepared with contract/browser checks. No deployment. Remaining: Add-new/compatibility scope, Hub/cache integration and coordinated release review.

**Attachment recovery tests — 1 October:** lost-response/permission-denial retries preserve entries and avoid duplicate versions; explicit Review saved state reload is added and browser-tested. No deployment. Remaining controls/Hub integration and release review continue next.

**Attachment disabled routing — 1 October:** backend dispatch/pinned source reader now prepared; missing flag refuses without network. Focused routing/API/SQL tests and Admin npm tests pass. No deployment/activation. Copilot branch is absent locally, so its commits remain unreviewed here.

**Attachment interface batch — 1 October:** isolated review/classify/edit/preview/publish screen and post-publication baseline recovery are prepared. Edge fixture and local SQL/API tests pass. Not live; production source/routing integration, release review and remaining controls are documented in SHARED-ATTACHMENT-REVIEW-CHECKPOINT.md.

**Attachment preview/publish transport — 1 October:** saved-version preview intents and explicitly confirmed, flag-gated publication now connect through the transport. Focused fixture/local SQL tests pass. No live activation; UI, routing and post-publication recovery still pending.

**Attachment Git adapter — 1 October:** fixed-path non-force publication adapter now checks saved version/permission, public conflicts and exact stored preview output before writes. Fixture tests pass; transport/UI wiring and deployment remain pending.

**Attachment preview intents — 1 October:** private actor/version/output-bound expiring intents are proposed and local SQL-tested. Next: handler/Git publication connection and review UI. Nothing deployed.

**Attachment publication planning — 1 October:** selected master-only output and conflict/privacy protections are implemented/tested. Vendor data remains independent. Next: version-bound preview intent/Git publication and authenticated review UI; no live route or deployment.

**Attachment transport batch — 1 October:** proposed RPC wrappers and server Auth/permission/receipt transport pass combined real local SQL/API tests for classification and later edits. Activation defaults disabled; no production routing or deployment. Next: Attachment review UI and selected master-only preview/publication.

**Attachment batch — 1 October:** multiple immutable private revisions and the disabled request adapter are prepared/tested. SQL tests cover versions 1–3 and stale saves; adapter transport remains mocked. Next: real RPC transport/receipt lookup, combined tests and hosted UI. No deployment.

**Attachment edit preparation — 1 October:** subsequent shared-field/type edits now have version/permission/value validation and preserve baseline/history. Tests pass. Next: extend SQL receipt/version storage beyond version 1, then authenticated API. No deployment.

**Attachment reciprocal guard — 1 October:** storage proposal now blocks competing saved specialist/Attachment drafts in either insertion order using the shared item transaction lock. Local SQL tests pass; unapplied. Next: subsequent revisions and authenticated API integration.

**Attachment private storage — 1 October:** first-classification receipt storage proposal now passes real local SQL save/reload/retry and conflict tests. Not deployed. Reciprocal specialist overlap checks, subsequent edits and API integration remain required. See SHARED-ATTACHMENT-REVIEW-CHECKPOINT.md.

**Attachment preparation binding — 1 October:** stale revision/source/patch and private legacy overlap checks now pass fixture tests. Durable master-only receipt storage remains next; current production shared storage supports three specialist categories only. See SHARED-ATTACHMENT-REVIEW-CHECKPOINT.md.

**Attachment follow-up — 1 October:** explicit master-only classification preparation is implemented/tested under existing items_edit permission. Durable receipt saving/API remains next; no live activation or real reclassification. See SHARED-ATTACHMENT-REVIEW-CHECKPOINT.md.

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
