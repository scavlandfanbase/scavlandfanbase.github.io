# Visual canvas integration — 2 October 2026

Status: canvas validation, rendering and editing controls connected to the
existing editor locally. Live activation remains disabled.
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

The initial plan was source-reviewed. The following implementation checkpoint
has since been verified locally; no database migration, deployment, live saved
draft or public page changed.

Browser/backend models accept layout.mode='canvas' on sections and block.canvas
containing desktop:{x,y,w,h}, mobileOrder and closed style tokens. Bounds are
12 columns by 60 minimum-size rows; overlap includes hidden blocks. Legacy
sections reject canvas metadata and retain their exact payload. All six existing
block types and /pages/ links remain supported.

Browser/backend renderers use the same validated payload. DOM order follows
mobileOrder; numeric grid positions determine desktop placement. Grid rows grow
for long content. Scoped trusted CSS applies only to canvas sections. Both
validation and renderer source fingerprints were updated to the matching browser
source. The main stylesheet and backend trusted stylesheet contain the same
canvas CSS fragment (page-canvas.css).

Passed: test-page-canvas-model.cjs (legacy preservation, six block types, bounds,
hidden overlap, unsafe assets/links, protected fields and model parity);
test-page-canvas-render.cjs (renderer parity, hidden exclusion, escaping, long
content, independent stacking and non-overlap at 320/375/800/1440px);
existing Page Builder browser suite; page API/storage/preview/publication/
publication-storage/control API/live-adapter suites; syntax and whitespace.

Remaining: review VS fixes; connect editor controls to this page contract and
trusted asset source; test genuine canvas save/reopen/history through the private
API; complete authenticated UI and release/recovery acceptance. Do not deploy
this partial checkpoint or claim production canvas support.

## Private persistence and editing commands checkpoint

The real page API against the local PostgreSQL schema now also verifies canvas
save, response-loss replay, reopen, stale-save refusal, invalid-overlap refusal
and archive retention. Exactly three saved revisions remain after the replay;
the earlier legacy payload is unchanged. This is local SQL acceptance, not a
live canvas draft or signed-in browser acceptance.

Saved canvas publication preview tests verify exact server bytes and hidden
exclusion. Moving a box or changing a style invalidates the previous publication
review, using the existing digest boundary rather than a new publishing path.

page-canvas-operations.js provides pure commands for existing page payloads:
new canvas section, first-free-space block addition, position/size updates, closed
appearance updates, independent mobile reordering and safe duplication. Every
command returns a detached validated page; refused operations leave the input
unchanged. Hidden boxes reserve space. No storage or network calls are present.
All existing content types remain under the main page validator.

Passed: test-page-api.cjs with new real SQL cases; test-page-preview.cjs with
canvas review invalidation; test-page-canvas-operations.cjs with hidden collision,
failure atomicity, full-canvas refusal and duplicate/mobile-order retention;
syntax/whitespace checks. These changes do not expose live canvas UI controls.
VS's fix commits were not yet present on its remote branch when checked.

## Connected editor checkpoint

VS's dcfb703 branch was subsequently fetched, reviewed and merged into the
integration branch at cc58786. Its complete visual-canvas suite and existing
Admin/invite tests pass. The isolated demonstration is retained separately.

page-canvas-panel.js now mounts a drag/resize canvas inside existing canvas
sections in page-builder.js. It edits the same active page used by Save Draft,
the live bridge, preview, history and publication. Text/content fields remain
the existing labeled forms, preserving typing focus. Canvas style selectors use
the main closed-token contract; images come only from the trusted approved-image
context. All six existing block types remain editable in the main form. Hidden
boxes retain their space and mobile order. Duplicating a canvas box allocates a
new region instead of duplicating overlapping coordinates.

New canvas sections remain opt-in for local review: /?canvas=1 on the loopback
builder. The explicit SCAV_CANVAS_ENABLED switch is false by default and is not
set in the production page. No live Hub enablement or deployment is included.
Existing sections are never automatically converted or rewritten.

Public grid coordinates now use fixed trusted CSS classes rather than inline
style attributes. This preserves the strict stylesheet-hash CSP inherited by
the preview iframe. Local browser acceptance verifies actual computed grid
placement under that policy, not only generated HTML text.

Passed: test-page-canvas-browser.cjs (connected opt-in section, typed content and
focus, keyboard position/resize, pointer drag, private save/reopen/style revisions,
375px layout, preview CSP grid placement, and publication-lock refusal);
test-page-canvas-render.cjs; existing complete test-page-builder.cjs;
test-page-api.cjs with real SQL canvas retention/retry cases;
test-page-preview.cjs; model/operation checks; syntax and whitespace.

Remaining before release: connected authenticated acceptance with actual saved
history and Owner review, rollout capability/versioning and cache updates,
complete backend bundle readback, and genuine publication only for chosen content.
No live draft, public page, role, database or deployment changed in this checkpoint.

## Release preparation and session bridge checks

PAGE_CANVAS_ENABLED is a separate source/backend emergency-stop gate. Canvas
create/save is refused while disabled; saved history and preview remain readable.
The live adapter exposes the trusted source capability, and the editor reveals
Add canvas section only when that capability is enabled. Local ?canvas=1 remains
a loopback review convenience and cannot override the backend save gate.

Connected session-bridge browser tests now cover saved canvas history and Owner
review: opening archived history preserves unsaved canvas coordinates; saved
publication preview uses the original saved position; pending publication blocks
keyboard movement; reload/recovery retains the existing lock boundary. Auth and
Git are fixtures in this acceptance. No real signed-in canvas acceptance claimed.

The complete test-admin-release.cjs suite passes, including all canvas tests and
Items, Vendors, Attachment/Evidence storage/browser tests and publication/recovery.
Independent PostgreSQL concurrency was not rerun (SCAVLAND_PSQL unset); local
PGlite schema tests passed. Final section background/border preservation and
canvas form/preview regressions also passed. Asset cache tags are refreshed to
page-builder-integration-20261002-canvas-1. Real signed-in save/reopen/history
and publication review remain the post-deployment acceptance gate.
