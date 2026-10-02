# Visual canvas integration — 2 October 2026

Status: source-reviewed implementation plan; no model or live behavior changed.
VS owns isolated canvas fixes on feature/visual-page-builder-canvas. The main
workstream owns connection to the existing live Page Builder.

## Existing production boundary

The current Page Builder already has authenticated private save, immutable
versions, history, archive, saved-revision review and Owner publication. See
PAGE-BUILDER-BACKEND-CHECKPOINT.md. Do not introduce another storage service,
replace page identities, or use the demonstration's fixtures in production.

Source inspection confirms page-builder-storage.sql stores validated JSON page
payloads and checks server-issued identity/address and request ownership.
page-api.mjs validates payloads before preparation/commit. page-preview.mjs
renders the exact saved version on the server and hashes both HTML and trusted
stylesheet; publication regenerates those bytes and verifies the review receipt.
The frontend and backend models currently allow only id/title/slug/intro/sections.
The isolated canvas document therefore cannot be saved directly.

## Implementation direction

Extend existing sections with an optional canvas layout mode. Sections without
that mode retain their current validation and rendering. Keep page identity,
slug, intro, section identities, block identities and hidden flags. Add validated
desktop region, mobile order and closed style tokens only to canvas blocks.
Keep content fields and safe links under the existing page model, including
/pages/ links. Preserve all six existing block types; never silently discard
headings, dividers or buttons because the demonstration supports only three.

Start with explicit new canvas sections. Do not automatically convert Guides or
other saved pages. A later opt-in conversion must preview proposed positions,
preserve every block and hidden flag, and save a new revision only after the
user accepts. Historical revisions remain immutable and independently renderable.

Reject overlapping desktop regions and out-of-bounds additions/moves/resizes.
Apply collision rules to hidden blocks too, so showing a block cannot introduce
an overlap. Mobile order is independent, unique within a section and retained
for hidden blocks; public output filters hidden content before rendering.
Use content-driven minimum height to prevent long text being clipped; verify
that expanded content cannot cover adjacent blocks at narrower desktop widths.
Do not ship fixed-height clipping as a solution.

Use the existing trusted approved-image inventory from page-source.mjs, not
fixture paths or browser-submitted approval lists. Reconcile style tokens with
the site's palette and test readable combinations. Position CSS can contain only
validated numeric grid values; all other appearance uses trusted token classes.
The server renderer and frontend preview must produce equivalent content.

## Controlled implementation checkpoints

1. Review VS focus/bounds/collision fixes and rerun its isolated suite.
2. Extend frontend/backend page validation together; add legacy-page byte-parity,
   canvas validation, hidden-content and protected-field regressions. Keep live
   entry points unchanged while the extension is under test.
3. Extend server/frontend renderers and trusted stylesheet. Test desktop/mobile
   behavior, long content, approved assets, escaping and preview/export parity.
4. Adapt canvas editing to the existing page document and live adapter. Keep
   existing revision, retry, stale-version, unsaved-edit and publication locks.
5. Run page storage/API/preview/publication/recovery suites and connected-browser
   regressions, including legacy saved history and permission denial.
6. Deploy backward-compatible backend first, read back its complete bundle,
   then release the authenticated UI. Verify private canvas save/reopen/history
   before any genuine publication. Never publish a fixture or acceptance page.

## Release and recovery constraints

No new editing role or publication permission is implied by this feature.
Retain the current Page Builder authorization rules. Reviewer item preparation
does not grant Page Builder publication.

Preview/style changes invalidate older publication reviews. Require fresh
saved-revision review rather than bypassing digest checks. Pending publication
must still block editing and reconcile the exact request/commit/build evidence.

Once canvas revisions exist, rollback may hide the canvas editor but must retain
backend validation/rendering for those saved revisions. Reverting to a validator
that rejects canvas payloads is not a safe rollback. No automatic rewrite of old
versions, reset of private storage or change to game data is permitted.

## Verification scope

This plan is based on source inspection, not new runtime acceptance. No code,
database migration, deployment, saved draft or public page was changed while
preparing it. The exact canvas extension still requires implementation and the
checks above; the standalone demonstration's passing tests do not establish
production readiness.
