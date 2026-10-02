# SCAVLAND Visual Page Builder Canvas - Checkpoint

**Status:** Isolated, fixture-only demonstration. Not connected to any live save, revision
history or publication service. Nothing in this checkpoint is deployed, authenticated or
reviewed for production use.

**Branch:** `feature/visual-page-builder-canvas` (created from `main`)
**Date:** 2 October 2026

## Why a separate checkpoint

The existing `feature/page-builder-local-drafts` branch (see
[PAGE-BUILDER-CHECKPOINT.md](PAGE-BUILDER-CHECKPOINT.md)) holds a different, section/block
stacking editor with a real local private-draft service, fixture-only version history and a
fixture-only publication-status demonstration. This checkpoint does not build on that branch
and does not touch its files, its draft service, or `page-model.js`/`page-builder-model.js`. It
starts a new, free-position visual canvas as a standalone set of files on top of current `main`,
exactly as scoped: isolated from live save, history and publication controls.

## What this adds

All files are new; no existing file was modified except adding one `package.json` test script
entry.

- `visual-canvas-model.js` - pure, dependency-free validator for the proposed canvas data
  contract (see below). Requires trusted `approvedImages` context, enforces strict key
  allowlists, a 12-column desktop grid with bounds checking, unique block/mobile-order
  identities, approved-image-only image references, and safe link rules reused from the
  existing page-builder link policy. Returns a clone; never trusts browser-supplied roles,
  identities or timestamps.
- `visual-canvas-renderer.js` - safe preview/export renderer in the same escape-everything style
  as `page-builder-contract.js`. Produces desktop (CSS Grid, absolute column/row placement) or
  mobile (stacked by `mobileOrder`) markup from the same validated document.
- `visual-canvas-fixtures.js` - inert demonstration fixtures only: a small approved-image allow
  list (existing branding/banner/map files already in `images/`, chosen to avoid any game-data
  implication) and one sample canvas document exercising text, image and card blocks.
- `visual-page-builder.html` / `.css` / `.js` - the interactive canvas editor, scoped entirely
  under `.visual-canvas-app`/`.vcb-*` classes. A persistent banner states the demonstration-only
  boundary. The editor holds a single in-memory fixture document; there is no network call, no
  save, no history and no publish action anywhere in this file.
- `scripts/test-visual-page-builder.cjs` (`npm run test:visual-canvas`) - Node `assert` coverage
  of the model/renderer plus a Playwright browser suite covering drag, resize, keyboard
  alternatives, selection, properties-panel edits, preview-size switching, unsaved-edit
  preservation, approved-image restriction, safe text rendering and a 375px narrow-viewport
  overflow check.

## Proposed data contract (for backend review)

```jsonc
{
  "id": "fixture-landing",          // identity: letters/digits/_/- , <=80 chars
  "title": "Page title",            // plain text, <=160 chars
  "blocks": [
    {
      "id": "image-block",          // unique per document
      "type": "text|image|card",
      "desktop": { "x": 0, "y": 4, "w": 6, "h": 10 }, // 12-col grid, integer units, x+w<=12
      "mobileOrder": 2,              // unique integer; independent mobile stacking order
      "style": {
        "fontSize": "sm|md|lg|xl",
        "textColor": "default|ink|paper|accent|danger",
        "background": "none|surface|subtle",
        "border": "none|thin|thick",
        "padding": "none|sm|md|lg",
        "align": "left|center|right",
        "spacing": "tight|normal|loose"
      },
      "text": "...",                 // text/card only, plain text, <=4000 chars
      "title": "...",                // card only, plain text, <=160 chars
      "image": "images/....png",     // image: required approved path; card: optional/null
      "alt": "...",                  // image/card, plain text, <=300 chars
      "href": "items.html"           // card only; HTTPS or existing-site-relative .html only
    }
  ]
}
```

Key proposed properties for backend review:

- **Desktop position is explicit grid coordinates** (`x,y,w,h` in a 12-column grid), enabling
  true side-by-side placement and resizing, unlike the existing 1-3 "columns" stacking layout.
- **Mobile order is a separate, independent field** (`mobileOrder`), not derived from desktop
  position, so an admin can place two blocks side by side on desktop and choose which stacks
  first on mobile.
- **Style is a closed set of enumerated tokens**, not free CSS/HTML. This preserves the existing
  "no arbitrary HTML/JS/CSS" policy while still giving admins meaningful appearance control.
- **Image and link validation reuse the existing safe-asset/safe-link policy** proven in
  `page-builder-model.js` (`images/...` extension allowlist, no traversal, HTTPS-only or
  existing-page-relative links).
- This model intentionally has **no revision, approval, reviewer, timestamp or role fields** -
  those remain server-owned concerns for whichever service eventually persists canvas documents,
  exactly as `page-builder-model.js` already treats them for the stacking editor.

Open questions for the backend/production-plan owners (not decided here):

1. Whether canvas documents are a new content type alongside the existing section/block pages,
   or an alternate per-section layout mode.
2. Whether overlapping block regions should be rejected or merely flagged (this checkpoint
   currently allows overlap; `x+w<=12` is enforced, but no collision check between blocks).
3. Final enumerated token lists for colour/spacing/padding should be reconciled with the actual
   site design tokens before any production use.
4. How `mobileOrder` interacts with hidden blocks/sections once this contract is merged with the
   existing hide/show model.

## Verified behaviour

- Visual canvas with a 12-column snapping grid, selection outline and resize handles
  (`visual-page-builder.css`/`.js`).
- Moving and resizing text, image and card blocks by pointer drag (move handle on the block body,
  resize handles on the corner/edges) and by keyboard (arrow keys move, Shift+arrow resizes) and
  by on-screen buttons (Move left/right/up/down, Wider/Narrower/Taller/Shorter) - both pointer and
  non-pointer paths are covered by the automated test suite.
- Properties panel exposes only the approved enumerated values from `visual-canvas-model.js` for
  text size, text colour, background colour, border, padding, alignment and spacing, plus the
  type-specific content fields (text, card title/link, image/alt).
- Desktop layout uses explicit grid positions; mobile stacking order is a separate, explicitly
  editable field ("Move earlier"/"Move later" buttons) with its own responsive preview rendered
  through the same safe renderer used for desktop.
- Selecting a different block, or switching the responsive preview between desktop and mobile,
  never resets or discards the in-memory document - edits remain exactly as made (verified by the
  automated suite comparing the full document before/after each switch).
- The image picker only ever lists `visual-canvas-fixtures.js`'s approved images; the model
  rejects any other path (including traversal attempts) even if forced into the data structure
  directly. All text is rendered via `textContent`/escaped renderer output, never `innerHTML` of
  untrusted strings, so HTML-looking typed text renders as literal text.
- No arbitrary HTML, JavaScript, inline CSS or upload control exists anywhere in the new UI;
  appearance is controlled only through the enumerated style fields above.

## How to preview locally

This is a static, dependency-free page - no server/process is required:

```powershell
# From the repository root, after checking out feature/visual-page-builder-canvas
start visual-page-builder.html
```

Or serve it with any static file server if you prefer not to open `file://` directly, e.g.:

```powershell
npx http-server . -p 4199
# then open http://127.0.0.1:4199/visual-page-builder.html
```

## Verification

Passed:

- `npm run test:visual-canvas` (`node scripts/test-visual-page-builder.cjs`) - model/renderer
  fixture validation (protected-field rejection, duplicate identity/mobile-order rejection,
  grid-bounds rejection, unapproved-image rejection, unsafe-link rejection, invalid style-token
  rejection, XSS-safe render) plus a Playwright browser suite covering: click selection and
  `aria-selected` state; keyboard move (`ArrowRight`) and keyboard resize
  (`Shift+ArrowDown`) with correct focus retention across re-renders; the Move-left button
  reproducing the same effect as keyboard/drag; pointer drag-to-move; pointer drag-to-resize via
  the corner handle; a properties-panel `<select>` edit changing the exact block's style;
  unsaved-edit preservation across selecting a different block; unsaved-edit preservation across
  switching the preview from desktop to mobile (full-document deep-equality check) and the mobile
  preview rendering a stacked layout; the image picker only offering the approved fixture images;
  typed HTML-looking text rendering as literal text with no injected `<img>`; and no horizontal
  page overflow at a 375px viewport.
- `npm test` (existing `test:admin` + `test:invites` suites) - PASS, unaffected by this isolated
  addition.

Not run / out of scope for this checkpoint:

- No production/authenticated acceptance test, since there is no backend wiring to test.
- No screen-reader or full manual WCAG audit; only programmatic `aria-selected`/`aria-label`/
  focus-retention checks were automated.
- No cross-browser check beyond Chromium (Playwright default in this repo's existing suites).
- No check of the pre-existing `feature/page-builder-local-drafts` fixture history/publication UI
  - that branch and its files were not touched or re-verified by this work.
- No visual/pixel regression check; only DOM state, computed overflow and rendered text content
  were asserted.

## Scope boundaries respected

- No change to `page-model.js`, `page-builder-model.js`, `page-builder-contract.js`,
  `scripts/page-builder-server.cjs`, any Supabase SQL/function, authentication, permissions or
  publishing workflow.
- No change to any game-data JSON or editor (`data/items.json`, `data/armour.json`,
  `data/weapons.json`, `data/ammo.json`, `data/vendors.json`, attachment files/editors).
- No change to `NEXT_JOBS.md`.
- No arbitrary HTML/JavaScript/raw-CSS input anywhere in the new UI.
- No network, save, history or publish call anywhere in the new files.

## Remaining integration requirements before any production use

Mirrors the unresolved decisions already logged in
[PAGE-BUILDER-PRODUCTION-PLAN.md](PAGE-BUILDER-PRODUCTION-PLAN.md) for the stacking editor, plus
canvas-specific items:

1. Decide whether this free-position canvas contract replaces, extends or runs alongside the
   existing section/block stacking contract, and who owns that product decision.
2. Server-side storage, authentication, permissions, revision/concurrency and publication must be
   designed and implemented by the owning backend workstream - this checkpoint intentionally
   implements none of it.
3. Reconcile the demonstration style-token lists and the fixture approved-image list with the
   real production design tokens and real approved-asset inventory.
4. Decide on overlap/collision policy between desktop blocks and how `mobileOrder` interacts with
   hidden content once merged with the existing hide/show model.
5. Full accessibility (real screen reader), cross-browser and authenticated end-to-end review
   before any Admin Hub entry point is added.
