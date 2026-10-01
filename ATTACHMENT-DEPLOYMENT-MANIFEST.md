> Superseded preparation status: approved rollout is now deployed. Read ADMIN-ROLLOUT-20261001.md for live versions, migrations, preserved counts and remaining acceptance. The historical preparation evidence below is retained.

# Attachment deployment manifest — prepared 1 October 2026

This is a review checklist for draft PR #37, not deployment authorization. Attachments remain disabled. Page Builder is a separate branch and is excluded.

## Release contents

Deploy the complete `supabase/functions/admin-drafts` function from the reviewed commit, starting at `index.ts` and its `production.mjs` import graph. Include existing handler/core/shared-item modules and the Attachment modules: attachment-api.mjs, attachment-draft.mjs, attachment-publication.mjs, attachment-source.mjs, attachment-transport.mjs, attachment-compatibility.mjs and attachment-create.mjs. Include models.generated.mjs, item-draft.mjs, legacy-item-review.mjs and github-publisher.mjs; do not replace existing modules with a partial upload. Existing shared-function imports must remain available.

Web assets: admin.html, admin-dashboard.js, attachment-category.html, attachment-category.js, attachment-category.css and existing attachment-model.js. Frame, child script, model and stylesheet use `attachment-preparation-20261001-4`. Bump these together if the reviewed assets change. The frontend release switch is deliberately false. No game-data file is part of this code deployment; subsequent confirmed publication targets only data/items.json.

## Database order and preflight

Read current production state before executing anything: confirm the existing scavland_item_drafts and scavland_drafts schemas, their versions/prepared tables, auth.uid(), has_scavland_permission(text), and scavland_item_legacy RPC. Check whether any proposed Attachment objects already exist. The proposals use CREATE rather than an idempotent repair path; do not blindly rerun them.

Apply reviewed proposals in order: `supabase/proposals/attachment-classification-storage.sql`, then `supabase/proposals/attachment-preview.sql`, then `supabase/proposals/attachment-creation-allocation.sql` for the prepared Add flow. Each has its own transaction. If the second fails, leave the feature disabled and inspect the committed first migration before retrying. None of these proposals has been applied by this checkpoint.

Verify RLS, revoked direct table access, service-only preparation/receipt/preview functions, authenticated permission-gated draft/list functions and both reciprocal overlap triggers. Record counts of existing legacy/shared drafts before and after. Preserve receipts, versions, genuine history and all game records.

## Configuration and activation order

Existing server configuration: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY and GITHUB_TOKEN. Verify presence and intended access without printing values. GITHUB_TOKEN stays server-side. The fixed repository is scavlandfanbase/scavlandfanbase.github.io, branch main.

Deploy backend with SHARED_ATTACHMENT_ENABLED absent or false. Verify ordinary shared editors still work and Attachment requests refuse while disabled. After migrations and permission acceptance, reviewed activation sets SHARED_ATTACHMENT_ENABLED=true. Publishing additionally requires existing ADMIN_CORE_ENABLED=true and DRAFT_PUBLISH_ENABLED=true; do not toggle shared publication settings casually because other editors use them.

Enable frontend ATTACHMENT_RELEASE_ENABLED only in the coordinated reviewed release after backend acceptance. It grants the Attachment route to active authorized Owners or items_edit accounts, matching the existing server permission function. Retain general Items access for other categories and legacy work. Add-new and compatibility are included in this prepared screen.

Confirm Pages deployment completion and fresh frame/child asset versions. Signed-in acceptance must include permission refusal, private save/reload, preview and an explicitly intended real item publication. Never publish fixtures or mark genuine facts Verified merely to test a control.

## Recovery and unresolved acceptance

If acceptance fails, disable SHARED_ATTACHMENT_ENABLED and the frontend switch. Keep private SQL versions/receipts and existing shared editors. Do not drop tables, reset public data or remove overlap guards without a reviewed recovery plan: saved Attachment authority may already exist. Inspect Git main after an uncertain publish before retrying.

Git and Postgres are separate services: non-force ref updates and repeated permission/version checks do not create a cross-service transaction. Local two-page tests establish stale-preview refusal after another save, not truly simultaneous production transaction behavior. Fresh production inspection, concurrent-session review, release scope approval and signed-in Owner acceptance remain required.

## Repeatable local acceptance

Run `npm run test:attachments` from the reviewed checkout. It enables combined browser/SQL coverage and runs all Attachment suites plus existing Admin/invite regressions, stopping at the first failed suite. Passing does not replace live Auth, concurrent production sessions or release approval.

## Repeatable database inventory

Run supabase/proposals/attachment-readiness.sql read-only before migrations and again after all three. Before installation, all prerequisites must be present and Attachment objects absent; any partial installation requires inspection before rerunning CREATE proposals. Afterwards require all four tables with RLS and no direct SELECT/INSERT/UPDATE/DELETE for anon, authenticated or service_role; all six exact RPCs with no anon execution; authenticated execution only on draft/list, and service execution on preparation/receipt/preview/allocation. Require all four guards enabled (O). Inspect function settings against the reviewed proposals. This inventory is not a concurrency test or configuration/activation approval.

## Machine-readable package check

scripts/attachment-rollout-manifest.cjs walks the complete local backend import graph and relevant Hub/category assets, records SHA256/byte counts, verifies matching Attachment cache versions and disabled frontend activation, and refuses game-data changes in the release diff. It generates a review inventory only; readyForLiveActivation remains false until reviewed release acceptance. Generate a fresh inventory from the exact approved clean commit before deployment. The complete Attachment release runner now checks this inventory before its suites. PostgreSQL concurrency runs separately using npm run test:attachment-concurrency and a disposable local cluster.

Independent PostgreSQL concurrency acceptance now passes as documented in ATTACHMENT-CONCURRENCY-REVIEW.md. This supersedes the earlier local-concurrency limitation; live Supabase authentication/configuration and the cross-service publication limitation remain distinct gates.
