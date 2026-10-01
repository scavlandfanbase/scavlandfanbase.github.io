# Attachment and Evidence rollout — 1 October 2026

Andrew explicitly approved main merge, database/backend deployment and feature enablement. PR 39 merged as cc6607c7128d874d970f4a8e0cdf67a0a5c121e6. Pages run 36883290018 completed successfully. Live Admin and Attachment/Evidence child assets return HTTP 200; both frontend switches are enabled.

## Backend and database

Complete backend first deployed v14 with both new routes disabled and confirmed 503 refusal. Three Attachment proposals then applied in order: admin_attachment_classification_storage, admin_attachment_preview, admin_attachment_creation_allocation. All four tables have RLS and no direct anon/authenticated/service access; six RPC grants and four enabled guards match readiness.

Evidence history migration admin_evidence_review_history applied in the coordinated cutover. Existing direct UPDATE/DELETE now denied; private audit RLS enabled, authenticated RPC execution allowed and anonymous execution denied. Backend v15 ACTIVE, SHA256 5ffdaee5c2841fd68dd068551f6b6493813815685d550eae6647c80229d0c34a, has both routes enabled. Unauthenticated live requests return 401, not disabled/configuration failures.

Source release-config.mjs now controls the two release gates. An explicit corresponding server environment value 'false' remains an emergency stop; credentials and other environment settings pass through unchanged. No secret values printed or checked into source. Recovery can disable source gates and redeploy, or use the explicit server false. Retain database history/drafts; do not drop new tables to roll back.

## Preservation and live acceptance

Post-cutover retained evidence: 3 pending, 12 approved, 11 rejected. Legacy versions remain 26, shared versions 2; Attachment versions and Evidence review revisions remain zero. No real submission decision, item classification/save/publication or invented verification was performed.

After Andrew signed in, live Evidence queue loaded all three pending records, selected detail loaded at revision zero, and private screenshot signing/display succeeded. Live Attachment screen loaded 74 candidates through its authenticated source route. No credentials/session tokens were read/exported. Restricted authenticated-account write acceptance remains pending; fixture permission refusal and real unauthenticated refusal are verified. Genuine save/review/publication checks require an intended real change, not test content.

## Live-discovered Hub corrections

Found misleading Permission required labels retained after profile authorization, CSS-visible legacy Evidence tabs, and Owner navigation narrower than the existing server Owner permission rule. Prepared fixes restore allowed labels, hide old Evidence children with the existing enforced hidden class, and permit Owner navigation to the existing permission-mapped views. Server authorization is unchanged; other Admin roles still require granular permissions. Attachment description now reflects the released workflow. Targeted Hub/Dashboard/browser tests and new focused regression test pass. This correction is being published as a separate checkpoint.

## Remaining scope

This release enables Attachments and audited Evidence Review while preserving existing editors. It does not finish every Hub tool. Page Builder remains local-only on VS branch with reviewed production plan and ongoing accessibility work. Blueprint/Crafting expansion, Image Manager, Navigation and other roadmap tools remain separate tasks. Git/database publication race limitation remains disclosed in ATTACHMENT-CONCURRENCY-REVIEW.md.

Current local repeatable acceptance: npm run test:release. Full combined checks and all 18 independent PostgreSQL concurrency cases passed before activation. Targeted activation and Hub correction checks passed afterward. Production deployment is verified; comprehensive role-by-role live write/recovery acceptance is not claimed.

## Final Hub deployment and advisor review

Hub correction PR 40 merged as 29b5cc17fe0dbb29fc9829758ab22912a13d9fce; Pages run 36884317133 succeeded. Fresh HTTP 200 Admin source contains label restoration, Owner view alignment and enforced legacy-control hiding. Signed-in acceptance occurred on the prior release; corrected UI behaviour is covered by targeted tests and deployed-source verification, not a second complete signed-in run.

Post-DDL security advisor review reports expected private-table RLS-without-policy INFO notices: direct access is revoked and trusted RPCs own access. It also warns about authenticated execution of definer list/state/queue functions. Reviewed functions have internal current-permission checks, empty search paths and revoked anonymous execution; this intentional RPC boundary remains security-sensitive and should be re-reviewed when changed. No new anonymous execution was enabled. See [RLS advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [database function security guidance](https://supabase.com/docs/guides/database/functions). Other pre-existing advisories were not broadened into an unrelated audit.

Release inventories now record actual source gate booleans rather than historical initial false values. Source gates are enabled; explicit server false can still stop actions. An inventory does not independently approve activation or verify environment values.
