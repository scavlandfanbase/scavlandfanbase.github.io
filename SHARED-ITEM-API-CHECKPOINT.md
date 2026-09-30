# Signed-in per-item API — 30 September 2026

Prepared on top of the contract in PR #24. No live migration, deployment, canonical publication or frontend change occurred.

## Prepared behaviour

The existing admin-drafts handler routes the `shared-item` domain to a new bridge only when `SHARED_ITEM_ENABLED=true`. The flag defaults to disabled. Existing Items/Vendors requests retain their existing path.

Each action validates caller Auth through the server, checks the real category permission RPC, and verifies current public item membership. Public files are fetched from one pinned Git commit. Read-only production inspection confirmed the existing permission RPC's parameter name is `required_permission`; the bridge uses that exact signature.

Load returns only the selected item draft. Prepare generates edits through the trusted contract; save accepts only the actor-bound prepared receipt. Lost preparation/save responses reuse the receipt rather than regenerate identity/history. Old whole-catalogue Items work on that identity blocks the new path. The private legacy reader is service-only and never exposes the whole old draft to the browser.

Preview stores a private expiring intent bound to administrator, item, category, saved version and public-output digest. Publication requires that intent and explicit confirmation, enabled publishing/core flags, fresh permissions/membership/legacy checks and a current saved version. Different public output since preview requires another preview. Both linked files publish with one non-force branch update. Responses identify the exact immutable version published; drafts and newer versions are never deleted or marked as published by inference.

## Storage proposals and release order

The proposed `shared-item-api.sql` adds private preview intents and a service-only old-draft reader, after `shared-item-drafts.sql`. Neither proposal is applied. Do not rerun the historical initial trusted-drafts migration. Do not enable the feature flag before reviewed source and SQL are coordinated.

No cross-service transaction can make Postgres and Git one transaction. The bridge checks the selected version just before Git writes; a later concurrent save remains an intact pending immutable version. Git rejects a branch-head race with a non-force update. Publication confirmation always names the saved version it used. UI must show a newer pending draft rather than claim every saved version was published.

## Validation

Real local Postgres tests exercise both proposals through the authenticated API with fixture Auth/GitHub transports: permissions, receipt actor binding/recovery, shared second-session reads, unpublished private saves, preview privacy, administrator-bound preview, changed-output rejection, explicit atomic linked publication, preserved unrelated public edits and protected old-draft overlap. Per-item publication-contract tests, existing `npm test` and whitespace checks pass.

The production handler's existing paths pass their regressions. No browser/category UI acceptance is claimed for this checkpoint.

## Next controlled task

**Follow-up prepared:** `SHARED-AMMO-SCREEN-CHECKPOINT.md` records the connected existing-item Ammo screen and full fixture browser acceptance. The remaining action extensions and reviewed old-draft preservation path below still block a complete live replacement.

Connect the recovered Ammo controls to `shared-item` requests, selecting canonical identities and showing shared details plus Ammo stats. Add/review/archive actions are still separate required extensions; this API presently supports editing existing items. Show usage preview using vendor references, preserve the general Items route until complete category coverage exists, and provide an explicit path to retain/import genuine overlapping old drafts.

Before enabling live use, complete real frontend acceptance, review concurrency/recovery behaviour, coordinate rollout and validate an intended Owner edit on category and vendor pages. Independent Ammo PR #22 remains held.
