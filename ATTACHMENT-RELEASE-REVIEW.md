# Attachment release review — 1 October 2026

Status: draft preparation; no rollout performed. Work is on feature/shared-attachment-review / PR #37. Live Ammo/Armour/Weapons remain independent of this release proposal. Page Builder remains separate and unmerged; its local checkpoint was independently reviewed.

## Verified preparation

- Server session/Items permission required; non-Items specialist permission is refused.
- Private service-only preparation and actor/command-bound receipt lookup; authenticated receipt-only saves.
- Immutable revisions, old-receipt retries, stale competing saves and legacy-version revocation verified in local PGlite.
- Reciprocal specialist/Attachment saved-authority guards share the item transaction lock.
- Fixed master-only output; vendor commercial data never rewritten.
- Explicit version/output/actor-bound expiring previews; fresh permission/version/conflict checks before non-force Git write.
- Approved images, explicit current-patch review, private archive/restore and preserved IDs/history.
- Browser fixtures cover classification, edit/reload, lost save responses, permission refusal, retry, confirmed reload, images/review/archive/restore, preview/publish and mobile widths.
- Pinned canonical source and disabled-default backend route verified. Existing Admin/invite suites passed after handler integration.
- Combined Edge browser/server-handler/PGlite test verifies a durable edit at revision 3 and authoritative reload in a second page. Auth and GitHub remain fixtures; no live data is used.

## Review fix

Repeated post-publication reconciliation could replace retained private verification history with the public summary. Fixed: identical public verification preserves private history on every refresh; changed public verification requires explicit review. Regression verifies retained history and no duplicated baselines. No genuine history was changed by this fix.

## Remaining release gates

1. Hub route/session/permission fixtures pass with a versioned Attachment frame. Frontend ATTACHMENT_RELEASE_ENABLED remains false. Coordinate its reviewed enablement and asset cache versions with backend/migrations; signed-in production acceptance remains required.
2. Combined browser/handler/local SQL classification, edit/reload and preview/publication checks pass. Two pages verify stale-preview refusal after a newer save, with no Git writes. Auth/Git remain simulated; genuinely simultaneous Postgres sessions and live Auth acceptance remain unverified.
3. Deployment manifest prepared in ATTACHMENT-DEPLOYMENT-MANIFEST.md; review it against fresh production state. Migrations in order: attachment-classification-storage.sql, attachment-preview.sql, attachment-creation-allocation.sql. None is applied in production.
4. Read-only schema/permission/draft/deployment snapshot recorded in ATTACHMENT-PRODUCTION-PREFLIGHT.md. Repeat at rollout; configuration/flag values and signed-in acceptance remain unverified. Preserve genuine old/shared drafts.
5. Review completed preparation scope: Add-new, existing-item edits, classification, images, compatibility, review, archive/restore and selected-item publication pass local acceptance. General Items access remains for other categories and legacy work. Live availability is not established.
6. Production deployment approval and subsequent signed-in Owner acceptance with an intended controlled item action. Do not publish fixture game data.

Publication checks span GitHub and Postgres; they do not provide one cross-service transaction. Non-force Git ref conflict protection remains; a private-state race after the final check is an acknowledged limitation requiring acceptance/mitigation review.

Copilot checkpoint 3ce5f1a now has independent local suite reproduction and focused source review recorded in VS-PAGE-BUILDER-REVIEW.md. It remains separate, local-only and unmerged.

## Release candidate metadata review — 1 October

PR #37 remains open/draft and mergeable at prepared head 4330671. Updated its title/body to describe the completed editor, creation, compatibility and selected-item publication rather than the early transport foundation. Fresh read-only live function source inspection confirms ACTIVE v13, hash fbca9bf558c5ab9a43145593d5035ae56975f1b0b93dc2c27274028ed63b1a4a, with nine existing modules and no Attachment route. Configuration secret/flag values are not available through this source inspection and remain unverified.

No deployment approval has been requested at this checkpoint: genuinely concurrent-session review and configuration acceptance remain unresolved. Local fixture success must not be described as live acceptance.

## Concurrent-save review checkpoint

Supported-path lock review and the exact six independent-connection acceptance scenarios are recorded in ATTACHMENT-CONCURRENCY-REVIEW.md. Static review is complete; simultaneous transaction evidence is still required. The existing PGlite/two-page tests do not satisfy that gate.

## Autonomous prepublication preparation — 1 October

The isolated simultaneous-session gate now passes on PostgreSQL 17.11 at READ COMMITTED with twelve observed-lock scenarios. This supersedes earlier statements that only sequential PGlite/two-page evidence was available. Production Auth and deployed server configuration are still separate acceptance gates. See ATTACHMENT-CONCURRENCY-REVIEW.md for exact results and remaining Git/database race limitation.
