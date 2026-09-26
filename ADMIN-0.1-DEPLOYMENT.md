# Admin 0.1 production approval handoff

Prepared 25 September 2026. Branch: `release/admin-0.1-core`, based on R2 `49b90db63b42517b7bb5803f61aa03a1d7b7f1b7` (R1 ancestor `be3c47b48e240c8a905817ce26ed54871329694c`). This is a local release candidate, not a deployed release. No production Supabase changes, main integration, push or publication have been performed.

## Core workflow

- Items: established add/edit, existing images/references, categories/properties, hide/show, archive/restore and evidence access are connected to private durable drafts. Evidence is optional, including for Verify. Stable IDs and unknown source values are preserved.
- Verification: authenticated backend actions supply the verifier, timestamp and current patch. Client-supplied attribution is rejected. An approved snapshot receipt is required by the database even for direct RPC saves. Private history survives subsequent edits by another Admin.
- Patch Management: Owner-only current-patch changes, private audit, optimistic concurrency and derived Patch Check Needed. No bulk record rewrites. Public patch output contains only schema version and current patch ID. Private patch history is read from the audit corresponding to the current public patch.
- Vendors and inventory: existing editing actions use durable drafts. New core listings reference canonical Items by ID. Price, quantity, rank, order and notes remain listing fields; notes remain private. Removing/archiving a listing does not remove its Item. Existing legacy inventory is retained.
- Publishing: preview and separate confirmation publish the saved version. Public verification is a minimal summary, without verifier identity, timestamps or history. Public consumers resolve canonical Item references on each load. Save Draft never publishes.
- Admin Hub: authenticated Items, Vendors, Patch Management and existing Admin access screens are connected. Unfinished editor navigation is disabled. Public Items/Vendors rendering is adapted for the new public summaries; repository source data is unchanged.

## Exact production changes awaiting approval

Target is the existing Supabase project `demtoqsafufzmnhvaykj`. These are reviewed SQL proposals, not executed migrations. After approval, create migration files with the Supabase CLI, preserve the proposal SQL, check deployment history and apply only missing changes in order. Do not run a proposal twice.

1. `supabase/proposals/r1-private-drafts.sql`: create private schema `scavland_drafts`, immutable `versions` table, `scavland_drafts.access` and public `scavland_draft` RPC wrapper. Authenticated callers receive function execution, not table access. Existing permission checks, request receipts and version locking govern load/save.
2. `supabase/proposals/admin01-trusted-drafts.sql`: add private `prepared` receipts and `patch_attempts` audit tables; enable RLS and revoke direct table access, including from service_role. Add `scavland_drafts.prepare`, `require_prepared`, `record_patch`, `patch_history`; add the BEFORE INSERT `require_prepared` trigger on versions. Add public invoker wrappers `scavland_prepare`, `scavland_patch_audit`, `scavland_patch_history`. These three wrappers and their helper functions are executable only by service_role. Security-definer helpers use an empty search path. No client table policies are added. The proposal fails safely if pre-existing Items/Vendors draft revisions need a separate trust review; it does not silently migrate them.
3. Deploy `admin-drafts`, including `production.mjs`, `core.mjs`, the generated model bundle and existing R1 handler/Git publisher. It accepts only Items/Vendors catalogue operations. Caller-JWT permission checks precede trusted preparation; normal saves repeat caller authorization.
4. Deploy updated `manage-patches`, which checks existing Admin/Owner authorization and writes private audit before updating the public patch file.
5. Redeploy `publish-item`, `publish-vendor`, `publish-specialist` with the updated shared records handler. This is mandatory: `ADMIN_CORE_ENABLED=true` disables these legacy publication routes so they cannot bypass trusted verification.
6. Configure the existing server environment: SUPABASE_URL, SUPABASE_ANON_KEY, backend-only SUPABASE_SERVICE_ROLE_KEY and the existing appropriately scoped GITHUB_TOKEN. Never expose the service key or GitHub token to the browser. Activate `ADMIN_CORE_ENABLED=true` only after the gated legacy functions are deployed. Keep `DRAFT_PUBLISH_ENABLED=false` and `PATCH_MANAGEMENT_ENABLED=false` until the integrated site and backend have passed staging acceptance. Enabling publication is a later deliberate release step.

No Storage buckets/policies, existing Auth roles or permission helpers, unrelated Supabase settings, or public database tables are changed. The private schema must not be added to exposed API schemas. The R1 public wrapper is the only authenticated draft entry point; trusted wrappers are server-only.

When eventually enabled, Items/Vendors publication writes only the corresponding `data/items.json` or `data/vendors.json`; patch management writes `data/verification-settings.json`. Atomic Git tree publication starts from current main, checks file base SHAs and does not force-update the branch. Unrelated files are preserved. No test data is to be deployed.

## Deployment order and remaining gates

1. Obtain Andrew's approval for the exact backend changes above. Stop here until approved.
2. Check target migration state; prepare/apply the additive migrations and deploy functions with publication/patch writes disabled. Do not bypass the pre-existing-draft guard.
3. Integrate this release candidate onto CURRENT main, preserving the 69 newer commits identified by the prior audit and any subsequent commits. This development branch must never replace main. Resolve real conflicts and rerun affected regressions.
4. Deploy the integrated public readers and Admin screens together. Public readers must understand verification schema version 2 before any core publication is enabled.
5. Verify real hosted JWT/permission/RLS/PostgREST behavior in staging, function deployment/configuration and security advisors. Repeat the acceptance workflow with two real authenticated sessions and on actual PC/phone. This local run does not establish live configuration or real-device acceptance.
6. Enable publication and Owner patch changes only after that validation and the release approval. Keep the legacy publishers gated. If activation fails, disable the write flags; retain private drafts/audit rather than dropping tables or restoring legacy bypasses.

## Validation completed locally

All production-looking browser/HTTP traffic in these tests is intercepted with fixtures. Git publication and Auth are mocked; database assertions execute the actual two proposals using PGlite, including a disk-backed restart. No real account or production data was used.

Passed release suite: `scripts/test-admin01-core.cjs` with SCAVLAND_BROWSER=1. It covers the real Admin Hub login/access denial, Owner patch workflow, Item add/reload/verify/preview/explicit publish, second authenticated browser context, Vendor add/inventory load, trusted identity/current-patch rules, fabricated verifier/direct-RPC/tampered receipt rejection, multi-actor history, immutable durable drafts across database restart, stale saves, offline/lost-response retries, failed publication retaining drafts, canonical rename propagation without duplicates, independent listing values, safe archive/remove, public privacy, patch-needed then re-verify/publish to VERIFIED. Actual SQL denies direct private table access and client execution of trusted RPCs.

Previously completed focused suites remain valid and were not needlessly repeated: test-draft-persistence.cjs, test-draft-publish.mjs, test-items-actions.cjs, test-items-foundation.cjs, test-verification.cjs, test-vendor-inventory.cjs, test-vendor-listings.cjs, test-item-catalog.cjs, test-items-editor.cjs, test-vendor-builder.cjs, test-vendor-inventory-browser.cjs, test-patch-browser.cjs and test-dashboard.cjs. Updated test-patches.mjs passed after private patch-history changes. The generated bundle check and git diff whitespace check passed.

Browser tests cover 280, 320, 390, 768 and 1280px widths, no horizontal overflow, core touch targets and established dialog/keyboard behavior. Representative Items/Vendors screenshots at 320/1280px were inspected. Preview content scrolls inside the dialog so Close remains accessible in the Admin iframe. Screenshots are in the task outputs/admin01-screenshots directory. Actual hardware and hosted-service acceptance remain pending.

Existing test-admin-records.mjs has prior authorization-mock incompatibilities and was not part of this sprint's pass claim. The new suite tests the changed legacy retirement gate. Full unrelated suites were not run. A harmless Node module-type warning remains in the pre-existing shared records module environment.

## Scope and limitations

- All repository `data/` files remain unchanged. All 13 Ammo records, 74 Attachment candidates and 29 modifier-bearing records are preserved. No inferred classification, values or weapon compatibility.
- Ammo production integration is deferred. Attachment classification remains in the existing Items workflow; no new advanced attachment functionality. Weapons, advanced crafting, Page Builder, themes/styles, image-manager improvements and other Phase 2 tools are unavailable in the release navigation.
- Core new vendor references are Items only. Existing legacy inventory is preserved; no bulk migration or new specialist relationships.
- A genuine external canonical-file conflict requires review; there is no automatic merge UI. Only an exact match to this draft's previously published public projection is reconciled automatically.
- Failed pending actions remain recoverable in the current browser, with retry/download and unload protection. Only acknowledged Saved drafts are guaranteed durable across restart. There is no revision-history UI.
- Private patch audit records attempts; Git remains authoritative for the actual current patch. Failed publication does not advance public patch state. No claim is made that already-existing public Git history can be made private retroactively.
- Public image/evidence references use the existing architecture. This sprint adds no storage manager or upload infrastructure.

## Explicit release confirmations

Evidence is optional. Verification identity/time/current patch are server-controlled. Newly generated public payloads contain no Admin identity or internal verification audit. New patches derive Patch Check Needed. Item information stays canonical and listings reference IDs. Vendor-specific values remain separate. Save Draft does not publish. Production Supabase is unchanged. Main is unchanged and has not been merged or overwritten. Nothing has been pushed, published or deployed.
