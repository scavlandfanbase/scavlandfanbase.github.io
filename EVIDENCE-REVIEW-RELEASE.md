# Evidence Review release preparation

Prepared only. Draft PR 38 is separate from Attachment PR 37 and VS Page Builder. Both Evidence switches remain disabled; the history proposal is unapplied.

## Inventory and checks

Run node scripts/evidence-rollout-manifest.cjs with an optional output path outside the repository. The inventory recursively hashes backend relative imports and frontend JavaScript/CSS dependencies, checks matching frame/asset cache tags and the disabled frontend switch, rejects committed data/ changes relative to origin/main, and records the commit and working-tree status. It reports readyForLiveActivation=false. It does not inspect deployed configuration or prove readiness by itself. Current inventory has 27 dependencies.

The read-only supabase/proposals/evidence-review-readiness.sql inventories table RLS, RPC execution grants/search paths, direct table grants, existing submission policies and the queue index. It does not reveal submission text, screenshots or secrets. It executes against the local proposal fixture; production execution and comparison remain pending. Expected post-cutover: private reviews RLS enabled, no direct browser audit-table grants, authenticated-only RPC execution, empty definer search paths, and no browser UPDATE/DELETE grant on evidence_submissions. Preserve existing submission and read policies. Inspect column-level grants and inherited role memberships too before approving cutover; this inventory does not exhaust every privilege path.

## Coordinated integration

Reconcile admin.html and production.mjs changes from Evidence and Attachment explicitly, retaining both disabled routes, imports, session permission guards and cache tags. Re-run both feature suites and existing Admin/Items/Vendor checks on the combined commit. Page Builder remains local-only until its separately reviewed production plan is implemented.

Review deployed SUPABASE_URL/SUPABASE_ANON_KEY presence without printing values. Caller JWT remains the authority; no service-key review bypass. Verify live evidence_review permissions, Owner access, denied accounts and private evidence-submissions screenshot signing. Record aggregate submission counts/statuses before cutover without exporting private content.

Deploy the complete backend with Evidence disabled first. Arrange the frontend/database cutover together: the proposal revokes direct UPDATE/DELETE used by the old screen. Applying it independently causes old moderation controls to fail. Review schema/policies, apply the exact reviewed proposal, compare grants/retained counts, enable the new backend and frontend in the coordinated window, and perform signed-in reviewer/Owner and denied-account acceptance. Preserve audit history and submissions if disabling actions for recovery; do not delete history or casually restore unaudited write grants.

## Verified and outstanding

Local actual adapter/SQL acceptance, six independent PostgreSQL concurrency cases and browser retry/conflict/history/responsive checks pass. The browser currently uses a mocked endpoint; the adapter/SQL suite uses actual SQL with fixture identity. A complete browser-to-handler-to-database acceptance run remains pending, as do combined branch regression, deployed schema/configuration checks, explicit release approval and signed-in production acceptance. No production changes in this checkpoint.
