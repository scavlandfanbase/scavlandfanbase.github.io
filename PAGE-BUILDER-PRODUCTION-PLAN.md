# SCAVLAND Page Builder Production Integration Plan

**Status:** Review proposal only. Nothing in this plan is implemented or approved for activation. Save Draft and Export remain local-only. The Page Builder is not available to live admins and has no publication path.

**Branch:** `feature/page-builder-local-drafts`
**Date:** 1 October 2026

## Verified Current Behavior

- The editor is served by `scripts/page-builder-server.cjs` on loopback (`127.0.0.1:4181`). Its session token is process-local; it is not user authentication.
- Drafts are stored as `pages.json` outside the public repository. Create, save and delete are local filesystem mutations. The service compares supplied revisions with its saved revision, generates revision increments/timestamps, and preserves the previous file on failed replacement.
- `page-builder-model.js` is a pure validator. It requires trusted approved-image, existing-page and current-page context; validates strict page/section/layout/per-block schemas and safe links/addresses; and returns a clone without normalizing valid values or identities. `page-builder-contract.js` supplies escaped preview/export rendering.
- The local service derives its image choices from `data/site-images.json` and files under `images/`, and derives existing custom-page identities/addresses from private saved drafts. A stored draft with an invalid/missing image can be opened for repair, but save, preview and export reject it.
- Hidden sections/blocks stay in drafts and are omitted from preview/export. Export downloads local HTML; it does not publish. There is no live Page Builder route, authenticated Page Builder screen, review workflow, or Page Builder publisher.
- `ADMIN-0.1-INTEGRATION.md` says no Page Builder screen was included. It documents other Admin permissions and disabled publishing paths, not Page Builder authorization or a Pages publication API. Do not infer a Page Builder permission or publisher from those components.

## Proposed User Flow

1. An authenticated administrator opens the Page Builder from an explicitly reviewed Admin entry point.
2. The server authorizes the requested operation and supplies an authoritative draft revision, approved-image inventory, and complete set of protected/current page addresses.
3. Editors create and revise private drafts. A reviewer previews an immutable snapshot of a specific saved revision. Approval binds to that exact page identity, revision, and rendered-content digest.
4. A separately authorized publisher explicitly publishes the approved revision. Publication is an audited server operation; editor input cannot approve or publish itself.
5. The public artifact is served only after the Pages source confirms the publication commit/build succeeded. Draft Save, preview and local Export never publish.

Roles, self-review policy, and the permission keys for these operations are unresolved; the flow above is a proposal, not a statement of existing permissions.

## Authentication and Permissions

All checks must be server-side and deny by default. Never accept a browser-supplied role, permission list, approval, reviewer identity, actor identity or timestamp as authority. Bind actor identity and event time to the authenticated server session.

| Operation | Proposed server decision | Unresolved decision |
| --- | --- | --- |
| List/view drafts | Require an authenticated page-view capability; filter records by the agreed audience/ownership policy. | Which Admin roles may view all private pages versus only assigned pages? |
| Create/edit/delete draft | Require a page-edit capability; enforce it on every API request, not just UI controls. | Map to an existing granular permission or define a new Pages capability; decide deletion/restore authority. |
| Review/approve | Require a separate review capability and record reviewer, revision, digest, decision and time server-side. | Whether authors may review their own pages, who can revoke approval, and required review evidence. |
| Publish/unpublish/rollback | Require a separate explicit publication capability and immutable audit event. | Which role can publish; whether unpublish/rollback are separate permissions; required confirmation/second-person approval. |

Coordinate the permission matrix and identity/session contract with the main Admin backend work before choosing API routes or adding an Admin Hub control. In particular, confirm whether existing `content_edit` or another capability is appropriate; do not map it by assumption. Confirm how this work relates to the currently disabled legacy publishing routes and current release flags before designing a publisher.

## Private Drafts, Revisions and Recovery

Replace the local JSON file as the live source of truth with a durable private store selected by the Admin backend owners. Define access control, encryption/secret handling, retention, backup, restore, audit and ownership before implementation. Draft bodies and private notes must not enter public assets, browser storage, Git history or logs.

The server owns immutable page identity, revision numbers, timestamps and actors. Saves use optimistic concurrency against the exact base revision; stale saves return a conflict and never overwrite newer work. Establish an idempotency key/receipt contract so retrying an uncertain save cannot create duplicate pages or double-advance a revision. Preserve the submitted editor buffer after validation, network or storage failures; expose the last confirmed saved revision and provide a reviewed compare/reload/recovery flow. Decide whether recovery uses version history, soft-deleted drafts, snapshots, or all three.

Tests must cover simultaneous editors, stale update/delete, duplicate retry after a lost response, partial storage failure, restart/recovery, backup restore and preservation of the last good revision. Storage and concurrency APIs are not defined by this local checkpoint.

## Trusted Validation and Assets

Continue using `page-builder-model.js` as a pure schema/validation layer, but have only trusted server code assemble its context. Its production image inventory must come from the approved asset source selected by the Admin backend owners, not the request body. Validate inventory entries against allowed repository paths and existing files; reject traversal, external sources, stale/unapproved paths, malformed values and unsupported types. Decide how inventory changes interact with already-saved drafts; until an image is approved again, the draft may be repairable but cannot be preview-approved or published.

The model must validate incoming draft mutations and the exact revision selected for review/publication. Unknown/protected fields remain rejected. Preserve stable IDs and literal values such as `Unknown`. Keep plain text only; no arbitrary HTML, CSS, JavaScript, embeds or uploads are introduced by this plan.

## Preview, Addresses and Public Output

Preview the exact server-saved revision, not an unsaved browser object. The review response should identify the page ID, revision and digest of the exact content/rendered artifact. Publishing must require the same approved revision/digest; any subsequent edit invalidates approval and requires another preview/review. Preview and public output must use the same renderer, trusted image inventory and content projection. Compare their canonical rendered output or digest in tests.

Use server-derived existing page identities/addresses that include both protected static website routes and all custom pages, not only current private drafts. Preserve the current reserved-name checks, reject malformed/case/normalization collisions, and enforce uniqueness atomically at draft creation and publication. Never overwrite or shadow an existing public page. The public URL shape and storage path are undecided; choose them only after auditing current GitHub Pages routing, static paths, case behavior and build/source configuration.

A candidate publication path, subject to release-owner approval, is a trusted server-side publisher that renders the approved revision and creates a commit or reviewed change in the confirmed GitHub Pages source. No GitHub credential may reach the browser or repository. Confirm whether publication should be an automated commit, a pull request for human approval, or another established release mechanism; confirm the Pages source branch, generated-artifact directory, identity, token scope and build trigger before implementation.

Record publication attempts and successful publications separately from drafts: page ID/address, source revision, approved digest, authenticated actor/reviewer, server time, resulting commit/build identifier, and outcome. On failure, keep the approved draft and previous public artifact intact, mark the attempt failed, and support safe idempotent retry. Do not claim success until the resulting Pages commit/build is verified. Roll back with a new audited revert/restore operation; do not force-push or destroy publication history. Retention and public cache behavior need release-owner decisions.

## Hidden Content and Acceptance

Hidden sections and blocks must remain editable in private drafts and absent from reviewer-approved public output unless an explicitly approved design says otherwise. Test nested/empty hidden sections, hidden blocks, mixed visible/hidden content, and attempted forged visibility/projection fields. Verify public output contains no private draft metadata, reviewer identity, history, unpublished page, or hidden text.

Before activation, verify:

- Keyboard-only page creation/edit/reorder/hide/review/publish workflows; accessible names, focus restoration, dialogs and conflict announcements.
- Contrast, zoom/reflow, long text, empty content, many blocks and narrow/mobile/tablet/desktop layouts.
- Alternative text requirements and approved/missing image behavior.
- Escaping/XSS, unsafe URLs, traversal, unknown/protected fields, duplicate IDs/addresses and collisions with protected routes.
- Per-operation authorization for anonymous, unauthorized, editor, reviewer and publisher identities using real authenticated server requests.
- Preview and public artifact equality for the approved revision and hidden-content exclusion.
- Concurrent/stale writes, idempotent retry, failed save/publish, lost response, partial GitHub/build failure, recovery, rollback and publication-history integrity.
- Static Pages integration on a non-production target before any live activation.

No production/authenticated Page Builder acceptance test has been run in this local checkpoint.

## Proposed Deployment Order and Rollback

1. Coordinate and approve the authentication, permission matrix, storage/revision contract, asset source, preview approval contract, publication actor/route and GitHub Pages release mechanism with the main Admin backend and site release owners.
2. Implement private server APIs and migrations/configuration only in the approved backend workstream; add model/service tests and authorization/integration tests. Keep all Page Builder production routes unavailable by default.
3. Implement authenticated editor wiring and exact-revision preview. Test against fixtures and an isolated non-production Pages target; verify recovery, audit and rollback.
4. Deploy backend components with the Page Builder activation switch off. Confirm monitoring, private storage, backup/restore and the publisher's least-privilege credential before making the UI discoverable.
5. Complete role-by-role authenticated acceptance, security review, accessibility/responsive checks and Pages failure/recovery tests. Obtain explicit release approval for the selected Pages target and URL strategy.
6. Enable viewing/editing/review/publishing only through separate approved switches, staged independently. Keep publication disabled until preview/review and publisher acceptance pass.
7. Roll back by disabling Page Builder routes/UI and publication first; retain drafts and audit history. Restore public output through an audited revert to the last verified artifact. Do not delete drafts or rewrite Git history during rollback.

Switch names, ownership, storage configuration and rollout environments are not defined here. Do not add/enable switches until their owners and fail-closed behavior are agreed.

## Likely Components and Dependencies

- `page-builder-model.js` — retain and extend only as needed for production-specific server-owned status/projection validation; keep filesystem/auth/publication out of the model.
- `page-builder-contract.js` — share the renderer used by preview and public output; define a deterministic render/digest contract.
- `page-builder.js` and `page-builder.html` — replace the local session/draft API adapter with authenticated server operations; preserve explicit local-only wording/export until the reviewed live flow exists.
- `scripts/page-builder-server.cjs` — remains the local-only utility. Do not turn its loopback token or filesystem store into production auth/storage. A separate production service/handler is likely; its exact owner/path is unresolved.
- `scripts/test-page-builder.cjs` — retain fixture tests; add isolated authenticated backend and publisher/Pages integration suites in the chosen owning workstream.
- `data/site-images.json` and `images/` — current local approved-image source only. Production source-of-truth and inventory refresh ownership require approval.
- Admin Hub entry point files — only after permission/UX review; the exact entry and capability are undecided and are not changed by this plan.
- Main Admin backend — required coordination for authenticated sessions, permission checks, durable private records, review/audit identity, deployment configuration/secrets, activation switches, and any publisher interface. Existing integrations do not prove these interfaces are suitable for Page Builder.
- GitHub Pages publisher/source — required coordination for branch/source, commit or pull-request mechanism, artifact path, credential scope, build confirmation and rollback. No Page Builder publisher currently exists.

## Decisions Required Before Implementation

1. Which team/service owns Page Builder authentication, endpoints, private draft storage, migrations, backups and audit history?
2. Which exact permission capabilities authorize viewing, editing/deleting, reviewing/approving, publishing, unpublishing and rollback? Is author self-review prohibited?
3. What is the authoritative approved-image inventory for live requests, and how are removed/replaced images handled in saved drafts?
4. Which protected public routes and case/normalization rules define address conflicts? What is the public URL shape and generated-file location?
5. Does publication create a direct commit, a pull request or use another approved GitHub Pages pipeline? Which branch/source and least-privilege identity are sanctioned?
6. What defines the immutable preview snapshot/digest, approval lifetime, invalidation policy and exact public-renderer equality check?
7. What are the required retry/idempotency, revision history, retention, restore and rollback service-level expectations?
8. Which activation switches, owners, monitoring signals and release approvals are required, and what is the recovery procedure if the GitHub commit succeeds but the Pages build fails?

Resolve these decisions with the main Admin backend and GitHub Pages release owners before implementation. This document proposes no permission assignment, schema, endpoint, secret, deployment target or completed production test.
