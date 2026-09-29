# Admin 0.1 current-main integration and production status

**Reading order:** the 29 September reconciliation addendum at the end supersedes earlier snapshot claims about unpublished main/configuration, release blockers, function versions and pending dashboard work. Earlier sections remain historical acceptance evidence, not current production certification.

26 September 2026. Integration branch: release/admin-0.1-integration. Based directly on fetched main 0889115efa84b8bbc6d8b5bec8b520b72e114eb2. The reviewed core source was release/admin-0.1-core at 38bcfdff5813556738a9403c778ca980d1677b8c. This report supersedes the deployment-status statements in the historical ADMIN-0.1-DEPLOYMENT.md handoff.

## Integration and authoritative patch

All 128 main commits since the shared development ancestor 7c61104630929dd6c77ef8d7bfc67fbfd19905b2 are retained. Selected core changes applied cleanly with a three-way patch; main was not replaced or reset. Remote main was read back at the same SHA after testing. No GitHub push, merge or publication occurred.

Current patch is 0.7.2, taken exactly from commit 80a2b68d2d6023930df0ddc16a9450000ba7b287. CHECKPOINT-2.md in that history explicitly records Andrew's corrected Hotfix 0.7.2 screenshot as the authority. No patch, date or verification state was invented. The configuration is exactly:

```json
{"schemaVersion":1,"current_patch_id":"0.7.2"}
```

The only data-file change relative to current main is addition of data/verification-settings.json. Existing Items, Vendors, images, public content and specialist datasets retain current-main bytes, including its recent Item updates. 285 Items, 13 Ammo records, 74 Attachment candidates and 29 modifier-bearing records are preserved.

Included: existing authentication/access and Owner controls, core dashboard, Items editor, verification/evidence hooks, Patch Management, Vendor editor/inventory, canonical Item references, shared editor/dialog components, durable persistence, required backend/configuration and focused tests. Shared page-model/CSS dependencies are included because existing editor code requires them; no Page Builder screen is added. Deferred editor screens and unrelated homepage changes were not imported.

## Production backend

Confirmed project: Scavland-website / demtoqsafufzmnhvaykj. The two existing migrations (20260925171705_private_admin_drafts and 20260925171716_admin01_trusted_drafts) were verified, not rerun.

All five reviewed functions are deployed and ACTIVE. Final downloaded source matches the integration source (normalizing packaging paths/line endings):

| Function | Observed final version |
| --- | --- |
| admin-drafts | 2 |
| manage-patches | 2 |
| publish-item | 13 |
| publish-vendor | 13 |
| publish-specialist | 14 |

Existing custom authentication remains in each handler; legacy verify_jwt=false is retained and the new handlers validate caller credentials/permissions themselves. No service key was copied to the browser or repository. Existing GITHUB_TOKEN/default Supabase environment remains in place.

Flags saved in the dashboard with Andrew's assistance and verified by their displayed SHA256 digests:

- ADMIN_CORE_ENABLED=true
- DRAFT_PUBLISH_ENABLED=false
- PATCH_MANAGEMENT_ENABLED=false

The three old publisher routes are now intentionally unavailable. New public publication and patch writes remain disabled. This does not publish the new frontend; the currently deployed old editors cannot publish until the release transition is completed.

## Production acceptance evidence and limits

A transaction-isolated SQL check used the existing Owner/Admin identities internally, without outputting their IDs. It passed Owner versus Admin role checks, denied anonymous and non-Admin access, denied authenticated execution of trusted preparation/private audit RPCs, saved/read an approved isolated draft, retrieved it under a second authorized actor, replayed its idempotent receipt, rejected a stale write and rejected an unapproved forged verification snapshot. The entire fixture subtransaction rolled back; afterward versions/prepared/patch_attempts each had zero rows. This is database-role/RPC acceptance, not an assertion that two real HTTP login sessions were tested.

Live unauthenticated HTTP checks passed: admin-drafts load/prepare returned 401; manage-patches returned 403; all three legacy publishers returned 503 with their retirement message; draft and patch-history RPC calls returned 401/42501. No request wrote source content or published anything.

Full authenticated Edge Function workflow acceptance remains BLOCKED: the reviewed handlers read data/verification-settings.json from GitHub main. That file is authoritative and present in this local integration, but remains absent from published main. Under the explicit no-push/no-publication rule, it cannot yet be made available to those deployed handlers. No fallback was invented or added to the reviewed code. Therefore production patch reads, real authenticated browser draft/verify flows and a full live public-output preview have not been certified. Database checks and local end-to-end tests must not be mistaken for these missing production checks.

## Integrated release tests

All passed against this current-main integration:

- test-admin01-core.cjs with SCAVLAND_BROWSER=1: real Admin Hub UI with fixture Auth, durable database restart, second authenticated browser context, Item add/reload/verify without evidence/preview/separate publish, Vendor add/catalogue, canonical rename propagation with no duplicate and unchanged listing values, safe listing archive/removal, forged verifier/direct-RPC denial, multi-actor history, stale/offline/lost-reply handling, public privacy, Owner patch transition and re-verification.
- test-items-actions.cjs; test-items-foundation.cjs; test-verification.cjs; test-vendor-inventory.cjs; test-vendor-listings.cjs; test-item-catalog.cjs; test-patches.mjs; test-draft-persistence.cjs; test-draft-publish.mjs.
- test-items-editor.cjs; test-vendor-builder.cjs; test-vendor-inventory-browser.cjs; test-patch-browser.cjs; test-dashboard.cjs.
- Generated backend model consistency and git diff whitespace checks.

Responsive coverage: 280, 320, 390, 768 and 1280px; no horizontal overflow, core 44px controls, existing keyboard/focus/dialog/discard/retry behavior. Representative 320/1280px screenshots inspected in task outputs/admin01-integration-screenshots. Actual mobile hardware was not used.

Static hosting: browser acceptance serves the static files under the production HTTPS origin with intercepted backend calls; the hosted editor path uses Supabase rather than loopback/localStorage. Required core assets resolve. Existing local helper servers are test/development tools only. Public Items/Vendors and canonical consumer regressions passed with current-main datasets. Verification publishes a minimal public summary; identity/time/history and private listing notes remain private in tested projection output.

## Remaining release decision

The code is integrated and locally tested; the approved backend is deployed with public writes locked. The desired fully production-tested release-candidate claim is not yet justified because the current-patch file is not published. To complete live acceptance before publishing the frontend, a separate explicit approval is needed for publishing only the already-reviewed authoritative configuration, or another explicitly approved change to the release order. Do not automatically push the integration or change backend source to bypass this boundary.

After the configuration dependency is available, use real authorized HTTP sessions for final draft/verify/patch-read acceptance, then seek final website publication approval. Keep write flags false until that release gate is satisfied. No additional feature development is required or started.

Deferred: Ammo integration, Attachment 11B, Weapons/compatibility, Page Builder v2, advanced themes/styles and image-manager work. Evidence remains optional; identity is server-controlled; Item IDs remain canonical; vendor-specific values remain independent; Save Draft never publishes. No public content was rewritten, and no test data remains in production.

## 29 September 2026 — Admin privacy and validation hardening checkpoint

Branch: fix/admin-user-privacy.

Post-integration Admin hardening completed and pushed. Existing public Items/Vendors behaviour and canonical relationships were retained.

Completed work:

- Vendor production data was brought into compliance with the existing numeric rank validator by converting 220 digit-only rank strings to numbers. No validator was weakened.
- Admin core integration coverage was corrected to locate newly appended vendor listings by stable vendor/entity/listing identity rather than assuming the new listing occupied array index 0.
- Reproducible local Admin test tooling was added through npm with PGlite and Playwright.
- Admin Users privacy regression coverage was strengthened in commit 6d6d65d. A denied non-Owner request is verified to perform no Admin-user read, return 403, perform no writes, and expose neither Owner nor invited-user email addresses.
- Owner-only Admin Users management remains enforced by the backend and frontend access controls.
- Admin draft validation error handling was hardened in commit 5986547. Top-level post-mutation catalogue validation now executes inside the existing error-normalisation boundary so ordinary validation failures are classified as client validation errors rather than unclassified server failures.
- Generated model inspection confirmed Items and Vendors validate mutation results internally. Vendor inventory/listing operations also validate their listing collection. The core change is therefore recorded as defensive boundary hardening rather than as a reproduced production 503 defect.
- No `"type": "module"` package change was made merely to suppress Node's MODULE_TYPELESS_PACKAGE_JSON warning; the repository contains mixed module formats and the warning is non-fatal.

Validation completed after the hardening:

- `npm test` PASS.
- Admin 0.1 core integration PASS.
- Admin invite/privacy regression PASS: retry saves existing invite without email; Owner protected; non-Owner rejected.
- Production browser bridge PASS, including parent-origin authentication, durable Item workflow, second authenticated browser context, Vendor catalogue workflow, responsive layouts, public Items/Vendors rendering and identity privacy.
- `git diff --check` PASS.
- Final working tree clean after push.

Relevant commits in this hardening sequence include:

- 75368b3 — Fix vendor listing data and Admin integration test
- 348c7a5 — Add reproducible Admin test tooling
- 6d6d65d — Strengthen Admin email privacy regression test
- 5986547 — Harden Admin draft validation error handling

This checkpoint does not supersede the production release gates recorded above. It records subsequent Admin security, privacy, data-validation and test-hardening work only.

### Granular publish permissions — 29 September 2026

Additional authorization review found two legacy publishing endpoints still using the broad `is_scavland_admin()` check:

- `publish-site-content`
- `publish-site-settings`

These were hardened to use the existing granular permission model:

- `publish-site-content` requires `content_edit`
- `publish-site-settings` requires `settings_edit`

This aligns them with the existing Admin editor/draft publishing system, which already uses `has_scavland_permission(...)`.

The change prevents an authenticated Reviewer with only `evidence_review` from using these publishing endpoints while preserving Owner access through the existing Owner permission override.

Verification after the change:

- `npm test` — PASS
- Admin 0.1 core/browser integration — PASS
- Admin invite/privacy regression — PASS
- `scripts/test-admin-password.cjs` — PASS
- `git diff --check` — PASS
- Working tree clean after commit/push

Commit:

- `17c3c24 Enforce granular Admin publish permissions`

The Node `MODULE_TYPELESS_PACKAGE_JSON` message remains a non-fatal development warning. No `"type": "module"` change was made because the repository uses mixed module formats.

### Granular Evidence Review permissions — 29 September 2026

Production Evidence Review authorization was audited against the live Supabase RLS policies.

Verified production state:
- `evidence_submissions` has RLS policies for SELECT, UPDATE, DELETE and public INSERT.
- The previous Admin moderation policies used the broad `is_scavland_admin()` check.
- SELECT, UPDATE and DELETE now require `has_scavland_permission('evidence_review')`.
- UPDATE applies the permission to both `USING` and `WITH CHECK`.
- The existing public evidence-submission INSERT policy was left unchanged.
- `has_scavland_permission(text)` was verified in production: the account must be active and either be the Owner or hold the requested permission.
- Owner access is therefore preserved.
- The deployed Evidence policy state is represented in `supabase/evidence-review-permissions.sql`.
- Production policies were re-read after the change and confirmed correct.
- Repository commit: `ffe3eeb` (`Enforce granular Evidence Review permissions`).

This closes the Evidence RLS permission audit. Dashboard visibility/navigation still needs to be aligned with the granular Admin permission profile.

### Permission-aware Admin Hub ? 29 September 2026

The Admin Hub navigation is now aligned with the live granular Admin permission profile.

Implemented behaviour:

- Evidence Review requires `evidence_review`.
- Items requires `items_edit`.
- Weapons requires `weapons_edit`.
- Armour requires `armour_edit`.
- Crafting requires `crafting_edit`.
- Ammunition requires `ammunition_edit`.
- Vendors requires `vendors_edit`.
- Page Settings requires `settings_edit`.
- Public Content requires `content_edit`.
- Admin Users remains Owner-only.
- Patch Management remains available under its existing authorization model; starting a new patch remains Owner-gated.
- The previous hard-coded Admin 0.1 UI allowlist was removed.
- Navigation itself checks the resolved permission set, rather than relying only on disabled buttons.

Regression coverage was updated to use the verified production Admin profile contract: `role`, `display_name`, `is_active` and `permissions`.

Browser coverage now includes:

- Owner with the full permission set: permitted editor controls are enabled.
- Restricted authenticated Admin with only `evidence_review` and `vendors_edit`: Evidence and Vendors are enabled while Items, Weapons, Ammunition, Settings and Public Content are denied; Admin Users is absent.
- Unauthorized account: Admin Hub access remains rejected.

Verification:

- `npm test` ? PASS.
- Admin 0.1 core/browser integration ? PASS.
- Admin invite/privacy regression ? PASS.
- `node scripts/test-admin-password.cjs` ? PASS.
- `git diff --check` ? PASS apart from expected Windows LF/CRLF conversion warnings.

This closes the dashboard visibility/navigation follow-up recorded under the Granular Evidence Review checkpoint.

## 29 September 2026 — Verified main and production reconciliation

Read-only reconfirmation baseline: main `9c0d3815fb686c93b151515f0c609f7dc7f9d6bb`. No code, canonical data, production flags, policies or functions were changed by reconfirmation.

### Completed and present

- `1d042c9` published the authoritative `data/verification-settings.json`; main and the public site now serve patch `0.7.2`. The historical missing-configuration blocker above is resolved.
- `167328e` published the Admin 0.1 frontend; `a610005` added Admin 0.2 usability/classification review; `2a71990` added the Vendor workspace/layout checkpoint. These are present on main despite their original review notes describing an unpublished local checkpoint.
- Canonical Vendor inventory is already implemented. `0a33c79` published Vendor catalogue draft v6. Current repository data has 22 Vendors, 285 Items, 224 canonical listings and 255 retained legacy stock rows. Running the existing `vendor-legacy-review.js` helper against current data yields 224 already-linked and 31 classification-review rows. This does not approve the remaining rows or verify their facts.
- `c851108` completed permission-aware Admin navigation; merge `9c0d381` is on main. GitHub Pages run [36636496385](https://github.com/scavlandfanbase/scavlandfanbase.github.io/actions/runs/36636496385) succeeded for that merge. The live Admin page returned HTTP 200, contains `allowedAdminViews()` and no longer contains the old "Not available in Admin 0.1" text.
- Downloaded deployed source confirms `publish-site-content` requires `content_edit` and `publish-site-settings` requires `settings_edit`. Production Evidence Review SELECT/UPDATE/DELETE policies require `evidence_review`, including UPDATE WITH CHECK; public INSERT remains unchanged.
- Observed ACTIVE production versions: admin-drafts 8, manage-patches 4, publish-item 15, publish-vendor 15, publish-specialist 16, publish-site-content 16, publish-site-settings 10 and manage-admin-users 8. Version listing alone is not a claim that every deployed file matches main.

### Fresh validation and limits

- Locked npm dependencies installed successfully in a temporary checkout; package.json and package-lock.json are already tracked. No new npm setup is needed in the repository.
- `SCAVLAND_BROWSER=1 npm test` passed: Admin core SQL/persistence, hosted browser bridge, Owner/restricted-Admin/unauthorized access coverage and invite/privacy regression. `node scripts/test-admin-password.cjs` and `git diff --check` also passed. The mixed-module Node warning remains non-fatal.
- Browser acceptance uses fixture authentication and intercepted backend/GitHub operations. It does not establish a real Owner content-publishing acceptance result or current production flag values.
- The available "Core Char Meaning" chat slice confirms the earlier missing npm dependencies discussion; subsequent commits resolve that setup. The chat reader provided no cursor for older history, so this check does not claim to have reviewed the full conversation.

### Exact outstanding work

1. Complete the real authenticated Owner Public Content CMS acceptance described in NEXT_JOBS.md, using a controlled intended edit and verifying its commit/deployed output. No fabricated production record is needed.
2. Reconfirm production publishing/patch flags before any flag-dependent workflow. Do not infer current values from the historical false flags above or from a prior publication commit.
3. Continue the existing Vendor editor checkpoint with the 31 unresolved legacy classification-review rows preserved. Do not restart 7A/7B or repeat the inventory foundation. Genuine listing verification is a separate backend decision because the existing inventory operations do not implement it.

The resolved configuration/frontend blockers do not automatically certify all previously outstanding real-session draft, verification and patch acceptance. Keep those distinctions explicit. Broader editor features, classification moves, themes and evidence cleanup remain deferred; use small controlled tasks with documentation and individual checkpoint commits.

## Recovered acceptance evidence and Items recovery preparation

Subsequent review of saved local release artifacts recovered the 27 September `admin01-live-acceptance/ACCEPTANCE-RESULT.md`: 24 assertions passed using two real Owner Auth sessions, including durable cross-session drafts, trusted verification, identity privacy, stale/forgery rejection and patch read/write-lock behavior. A separate non-Owner account, confirmed publication and a real patch write were not tested. The 28 September `ADMIN-02B-STAGE1-RELEASE-RESULT.md` also records the approved Vendor v6 publication and then-current flags all true. These dated observations supersede the earlier claim that no real-session acceptance evidence was available; current flags still require a fresh check before use.

Items recovery is prepared on `fix/items-draft-recovery`, based on current main, adapting original local commit `9cf3631`. The original client attempted a direct rebase save without the trusted preparation receipt required by SQL; the repaired flow uses authenticated prepare with `refresh-public`, followed by the normal versioned/idempotent save. Private-only edits remain; public-only edits are adopted; same-field conflicts, conflicting removals and changed verified private records stop for review. No refresh publishes or changes SQL/RLS/flags.

Hosted review follow-up: the production Items UI previously offered only Verify although its trusted backend supports both decisions. The review dialog now explicitly offers Unverified and Verified for current patch, defaults to Unverified, and records a private review while preserving history. Browser acceptance exercises a verified Item whose public image changes: refresh stops, an explicit Unverified review retains the prior history, and refresh then adopts the image without publishing. Refresh also uses the existing exact-publication reconciliation context before merging, so a confirmed publication can become the draft's recorded baseline. Focused merge and full Admin SQL/browser/invite regression tests pass. No genuine draft, data, SQL/RLS or flags are changed by these tests.

Focused merge tests, real local SQL integration, trusted receipt/retry/authorization/conflict checks, hosted browser refresh preserving a private-only Item, responsive Admin bridge and invitation regression pass. Dashboard tests now use the current production profile shape and confirm Owner editor access. These are fixture tests, not an assertion that the recovery backend is deployed or a genuine private draft has been refreshed. Deployment requires the reviewed admin-drafts source and frontend together, followed by real Owner acceptance. ADMIN_WORK_PLAN.md records the recovered roadmap and existing local Ammo/Attachment checkpoints.
## 29 September follow-up status

Items recovery/review/cache fixes are released through PRs #19–#21 (`98d121a` frontend, admin-drafts v10). Owner screenshots confirm saved refresh and retained private edit in preview. Ammo integration is prepared and tested, with coordinated SQL/backend/frontend release still pending; see `AMMO-INTEGRATION.md` and the current queue in `NEXT_JOBS.md`. The dated initial deployment report below remains historical.
