> Superseded preparation status: approved rollout is now deployed. Read ADMIN-ROLLOUT-20261001.md for live versions, migrations, preserved counts and remaining acceptance. The historical preparation evidence below is retained.

# Admin prepublication report — combined candidate, 1 October 2026

## Review decision

Combined Attachment and Evidence Review preparation is locally verified on feature/admin-release-integration, draft PR 39. Main remains 6f5d9dc; live admin-drafts remains ACTIVE v13. No live changes, main merge or activation were performed. Andrew requested a report before publication, so coordinated rollout remains a separate review decision. This release does not make every planned Hub tool available.

## Prepared scope

Attachments: gated Hub navigation, explicit classification, private Add/edit/images/Weapon compatibility, patch review, archive/restore, durable receipt/retry/reload, exact preview and selected master-record publication. Existing effects/modifiers are preserved; new modifier authoring is excluded. Canonical shared facts flow through existing references; Vendor price, stock and rank stay separate. No genuine game facts or data files changed.

Evidence Review: gated replacement screen, bounded queue pagination, retained source text/screenshots, private reviewer history with server identity/time, approve/reject/restore, exact retries, stale-review refusal and explicit recovery. No submission deletion, automatic item verification or content publishing. Owner Hub access now matches the server permission rule when enabled. Old direct moderation remains until the coordinated cutover; the proposal revokes its UPDATE/DELETE grants.

Includes reviewed standalone VS Items fixes: Active excludes hidden records, Hidden/Include archived retain access, and fixtures match current counts/technical details. Page Builder implementation remains on its separate VS branch; no production integration included.

## Final local acceptance

`npm run test:release` passed on the combined branch. It checks both dependency inventories, complete Attachment release/Admin browser/invitation suites, Evidence SQL/API/Hub/browser and actual browser-to-production-handler-to-SQL acceptance, shared catalogue/item contract/storage, legacy import/review recovery, Items shell/full editor, Vendor browser and Dashboard. Independent gate tests preserve feature permission separation. Existing non-fatal Node module-type warning persists.

Both independent PostgreSQL 17.11 / READ COMMITTED suites reran on this combined candidate: 12 Attachment and 6 Evidence scenarios passed with observed independent-session lock waits, conflicts, exact retries, rollback and consistent histories. Temporary databases were dropped and the server stopped. No production Auth/Storage/Git acceptance is implied; browser identity and publication remain fixtures.

Inventories resolve 42 Attachment and 34 Evidence dependencies and hash their content. Cache tags and disabled switches are checked; no data/ diff. Reports identify commit and dirty state. They do not inspect secrets or authorize activation.

## Live read-only baseline

Fresh preflight confirms Attachment prerequisites present, new Attachment/Evidence objects absent, and Evidence RLS enabled. Retained submissions: 3 pending, 12 approved, 11 rejected. Screenshot bucket is private, PNG/JPEG/WebP, 10 MiB. Existing active-admin Storage policy and permission function were inspected; actual signed-in signing remains pending. Authenticated submission UPDATE currently exists; DELETE is already ungranted. No explicit column ACL or role-membership bypass was found. Details: ADMIN-LIVE-PREFLIGHT-20261001.md.

## Required coordinated rollout

1. Review the exact candidate, scope and publication limitation. Verify required deployed configuration presence/access without exposing values.
2. Deploy complete combined backend with both new features disabled; verify existing editors.
3. Apply reviewed Attachment proposals in order: classification-storage, preview, creation-allocation. Stop and inspect partial installation before retrying.
4. Coordinate Evidence replacement UI/backend and evidence-review-history.sql cutover; old moderation stops when direct grants are revoked. Preserve submissions, policies and history.
5. Run both readiness inventories, compare grants/retained counts, approve specific flag/frontend activation and verify Pages completion/fresh assets.
6. Perform genuine Owner/permitted/denied account acceptance, screenshot signing and draft/retry/conflict/recovery checks. Any genuine item publication needs a deliberately chosen real change; never publish fixtures or invent verification.

Recovery disables new actions while retaining all drafts/receipts/history; no state deletion, force push or casual restoration of unaudited grants.

Git and PostgreSQL cannot share an atomic transaction. Attachment private work can change after the final version check and before the Git ref update; non-force Git protects competing public commits but not this interval. The tests do not remove that disclosed limitation. See ATTACHMENT-CONCURRENCY-REVIEW.md.

## Remaining roadmap

Page Builder's reviewed production plan is on VS branch 028054d; accessibility work is ongoing separately. Production permissions/storage/approval/publisher remain unimplemented. Blueprint/Crafting expansion, Image Manager, Navigation, Weapon Builder and other broader Hub tools still need their own implementations and acceptance. Existing category/editor foundations are preserved by this release; new live acceptance is not implied.

Current references: ADMIN-RELEASE-INTEGRATION.md, ADMIN-LIVE-PREFLIGHT-20261001.md, EVIDENCE-REVIEW-RELEASE.md, ATTACHMENT-DEPLOYMENT-MANIFEST.md and NEXT_JOBS.md. Repeatable full local check: npm run test:release; include real concurrency by supplying SCAVLAND_PSQL while the isolated loopback server runs.
