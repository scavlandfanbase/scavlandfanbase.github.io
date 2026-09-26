# Admin 0.1 current-main integration and production status

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
