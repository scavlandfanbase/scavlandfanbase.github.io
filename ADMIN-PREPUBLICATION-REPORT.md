# Admin prepublication report — 1 October 2026

## Decision

The current Attachment release is prepared and locally verified for review. Nothing has been merged, deployed, enabled or published by this preparation batch. This is not a claim that every planned Admin Hub tool is finished. The release remains draft PR #37 on feature/shared-attachment-review; main was freshly checked at 6f5d9dcdb75785118ee3879e25cfab4ad1fe00c1.

Andrew requested autonomous preparation and a report before publication. That boundary is the reason the live database/backend/frontend steps below have not been performed. No further coding prompt is needed for ordinary preparation; publication approval is a separate decision.

## Ready in this release

The Attachment category has prepared Hub navigation and permission checks, explicit candidate classification, private Add, approved-image controls, shared-detail edits, explicit Weapon compatibility, patch review, archive/restore, durable receipt-based saves, reload/retry recovery, preview and selected-item publication. IDs remain canonical. Unknown game facts stay Unknown; changes are not automatically marked Verified. Existing effects/modifiers are preserved; a new modifier-authoring system is not part of this release.

Publication changes only the selected shared master record in data/items.json. Existing Vendor references consume canonical shared information while Vendor price, stock and rank remain separate. No game-data file is changed by the code release. Legacy Items work remains accessible and protected from competing saved authority; no genuine pending drafts are discarded.

The release package now has a machine-readable dependency/hash inventory, checked cache versions, explicit migration order, read-only database readiness SQL, disabled activation defaults and non-destructive recovery instructions.

## Verified evidence

- Corrected a browser-test timing race: the lost-response test now waits for Retry to become enabled before recording the saved version. No application behaviour was changed for that fix.
- Complete Attachment release runner: request/contract/publication/storage/Hub/browser suites and existing Admin/invite checks pass. It now validates the package inventory before running tests.
- Independent PostgreSQL 17.11, READ COMMITTED: twelve real simultaneous-session cases pass with observed advisory-lock waits, conflict SQLSTATEs, exact-retry/rollback checks and final counts. Separate fixture database per run; fixture databases were dropped and the local server stopped. No production connection or Git write occurs in this suite.
- Shared catalogue, item contract/storage/API, legacy import and recovery checks pass; shared identity and independent Vendor values remain covered.
- Full Items editor, Vendor editor and Dashboard browser regression suites pass, including mobile/keyboard/retry checks. Existing non-fatal Node module-type warning remains.
- Fresh Git references show no new main changes requiring reconciliation. Release diff contains no data/ changes. Machine-readable inventory resolves 41 local dependencies with SHA256 hashes.
- Live read-only database inspection: all six prerequisites present; four Attachment tables, six RPCs and four guards absent. Existing seven private tables retain RLS; aggregate retained versions remain legacy 26/max 20 and shared 2/max 1. These totals are not verification counts.
- Live admin-drafts remains ACTIVE v13 with hash fbca9bf558c5ab9a43145593d5035ae56975f1b0b93dc2c27274028ed63b1a4a. No Attachment migrations or deployment have occurred.

Auth/Git in local browser acceptance are fixtures. Real local Postgres concurrency does not certify production authentication, server configuration, or deployed SQL/server-version settings.

## What still waits for the coordinated release

1. Review exact clean candidate commit, scope and the remaining publication limitation below. Confirm server configuration presence/access without printing secret values; management tools used here do not expose their actual values.
2. Approve the coordinated rollout. Apply the three reviewed Attachment SQL proposals in order and re-run the readiness inventory; preserve all old/shared drafts. Verify actual production server isolation and grants.
3. Deploy the complete backend with Attachment editing disabled. Confirm existing shared editors remain usable and disabled Attachment requests refuse. This requires live changes and was deliberately not done before this report.
4. Conduct real signed-in Owner and restricted-Admin acceptance, then coordinate backend enablement and frontend/cache release. Preview/save must remain private. Use only an explicitly intended real item for any publication check; never publish fixtures or verify invented game facts.
5. Verify completed Pages deployment and fresh assets. If acceptance fails, disable the new route/flag and retain all private versions/receipts; do not drop/reset retained state.

Git and Postgres do not share an atomic transaction. A private save can occur after the publisher's final version check and before the Git ref update. Non-force Git updates protect competing public commits, not this interval. This limitation is disclosed for release review; the concurrency suite does not remove it.

## Other Hub tools

| Area | State for this review |
| --- | --- |
| Existing Items, Vendors, Ammo, Armour, Weapons, patch/admin foundations | Already released foundations; relevant local regressions preserved. New live signed-in acceptance is not implied. |
| Attachments | Current prepared release described above; disabled live. |
| Page Builder | Independently reviewed local-only branch 3ce5f1a. Durable production storage/Auth, approval/publication/routes/recovery and Hub integration are still future work. Not merged into this release. |
| Blueprint editor, Crafting expansion, Evidence Centre, Image Manager, Navigation and Weapon Builder | Broader roadmap work; this PR does not implement or enable these tools. |

A release described as “every Hub tool available” would require those additional implementations and their acceptance. It must not be achieved by simply enabling placeholder buttons. ADMIN_WORK_PLAN.md remains the broader roadmap; current release gates are in ATTACHMENT-RELEASE-REVIEW.md and ATTACHMENT-DEPLOYMENT-MANIFEST.md.

## Saved artifacts

Repeatable scripts: scripts/test-attachment-concurrency.cjs, scripts/attachment-rollout-manifest.cjs and npm run test:attachments. SQL inventory: supabase/proposals/attachment-readiness.sql. Evidence/rollout instructions: ATTACHMENT-CONCURRENCY-REVIEW.md, ATTACHMENT-PRODUCTION-PREFLIGHT.md and ATTACHMENT-DEPLOYMENT-MANIFEST.md. NEXT_JOBS.md and RESUME-SHARED-ADMIN.md have current checkpoint entries above their historical records.
