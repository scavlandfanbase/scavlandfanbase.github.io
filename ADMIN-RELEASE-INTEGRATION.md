> Superseded preparation status: approved rollout is now deployed. Read ADMIN-ROLLOUT-20261001.md for live versions, migrations, preserved counts and remaining acceptance. The historical preparation evidence below is retained.

# Combined admin release candidate — 1 October 2026

Separate feature/admin-release-integration combines Attachment checkpoint d78ca09 and Evidence checkpoint ad0770c. Original branches and VS worktree remain untouched. This is local release preparation; main is unchanged.

Resolved shared admin.html/production.mjs conflicts explicitly: both backend imports/handlers/routes remain, both frames register session handoff, both independent permission gates remain, Evidence keeps its gated replacement of legacy moderation, and Attachment stays release-pending. Both frontend switches are false and backend switches default disabled. NEXT_JOBS.md retains both branch histories under a new current checkpoint.

Included only the reviewed standalone VS Items changes from 2997a7f and 38cf7c7: current count/technical-detail fixtures and the real Active-items filter fix excluding hidden records. Hidden and Include archived retain access. Page Builder implementation is not merged. Items child/frame cache now admin-integration-20261001-1; unchanged persistence/backend assets retain their existing versions.

Verified together: complete Attachment release suite (including real SQL, combined browser/handler paths, browser Hub, Admin core browser and invitations), Evidence actual adapter/SQL/API/Hub and browser/production-handler/SQL acceptance, full Items shell/editor and Vendor browser suites. New integration test checks independent switches/permissions for both feature frames and both disabled backend domains making no network calls. Existing non-fatal Node module-type warning persists. Attachment session-list assertion now accepts other registered frames rather than requiring Attachment last.

Recursive inventories pass: Evidence 34 dependencies, Attachment 42. No game-data changes, production SQL application, merge to main, deployment or live activation. Six Evidence and twelve Attachment independent PostgreSQL concurrency scenarios passed on originating branches; they are not claimed rerun on this combined branch.

Remaining before activation: fresh deployed schema/grants/configuration/Storage review, final coordinated migration order and evidence moderation cutover, release-owner approval, disabled deployment and signed-in live permission/recovery acceptance. The Attachment Git/database publication race limitation remains disclosed in ATTACHMENT-CONCURRENCY-REVIEW.md; combined regression does not remove it. Page Builder remains local-only on its separate VS branch. This candidate does not make every planned Hub tool available.

## Fresh read-only preflight

See ADMIN-LIVE-PREFLIGHT-20261001.md for verified main/v13 baseline, absent new objects, 26 retained Evidence submissions, private Storage and actual grants. Owner Evidence navigation now matches server authorization behind the disabled release switch. Targeted combined gates, Attachment browser Hub and Evidence SQL checks pass. Configuration values and genuine signed-in acceptance remain unverified; no live changes.

## Final combined acceptance

New npm run test:release consolidates both inventories and all feature/category/editor/Dashboard suites. Full run passed, including both independent PostgreSQL concurrency suites (18 scenarios) on this combined branch; databases cleaned up and server stopped. This supersedes the earlier note that concurrency had not been rerun here. ADMIN-PREPUBLICATION-REPORT.md now describes combined PR 39 scope and remaining coordinated live gates.
