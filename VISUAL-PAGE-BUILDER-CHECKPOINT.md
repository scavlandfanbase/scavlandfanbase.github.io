# SCAVLAND Visual Page Builder Canvas - Checkpoint

**Status:** Isolated, fixture-only demonstration. Not connected to any live save, revision
history or publication service. Nothing in this checkpoint is deployed, authenticated or
reviewed for production use.

**Branch:** `feature/visual-page-builder-canvas` (created from `main`)
**Date:** 2 October 2026

## Why a separate checkpoint

**Correction (2 October 2026):** an earlier version of this checkpoint described the existing
Page Builder as only having fixture-only/demonstration version history and publication. That was
outdated. Per [PAGE-BUILDER-BACKEND-CHECKPOINT.md](PAGE-BUILDER-BACKEND-CHECKPOINT.md), the
production Page Builder on `main` is now a live, backend-integrated feature: authenticated private
drafts, real retained revision history, saved-revision preview/review bound to an exact digest,
Owner publication, and at least one genuine published page (`/pages/guides/`) with a confirmed
GitHub commit and Pages build. That system has its own authentication, permissions, storage,
concurrency, preview/publication and Git/Pages integration already implemented and partially
activated, with further rollout gated as described in that document.

This canvas checkpoint is intentionally unrelated to that live system. It does not read, call,
extend or reuse the live Page Builder's draft service, revision storage, preview/publication
adapters, authentication or Supabase functions. It does not modify `page-model.js`,
`page-builder-model.js`, `page-builder-contract.js`, `scripts/page-builder-server.cjs`, or any
file under `supabase/`. It also does not build on the separate, older
`feature/page-builder-local-drafts` branch (see [PAGE-BUILDER-CHECKPOINT.md](PAGE-BUILDER-CHECKPOINT.md)),
which predates the live backend integration and is not touched by this work either. This
checkpoint starts a new, free-position visual canvas as a standalone set of files on top of
current `main`, exactly as scoped: isolated from live save, history and publication controls.
Nothing here is wired to, or a substitute for, the live Page Builder's save/history/publishing.

## What this adds

All files are new; no existing production file was modified except adding one `package.json`
test script entry.

- `visual-canvas-layout.js` - pure desktop-grid geometry helpers shared by the model and the
  editor: region/bounds checking (`x+w` and `y+h`, not just one or the other), pairwise overlap
  detection, and a free-space search used both to validate documents and to place new blocks.
- `visual-canvas-model.js` - pure, dependency-free validator for the proposed canvas data
  contract (see below). Requires trusted `approvedImages` context, enforces strict key
  allowlists, a 12-column-by-60-row desktop grid with both-axis bounds checking, a no-overlap
  invariant between desktop block regions, unique block/mobile-order identities, approved-image-
  only image references, and safe link rules reused from the existing page-builder link policy.
  Returns a clone; never trusts browser-supplied roles, identities or timestamps.
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
  of the model/renderer/layout plus a Playwright browser suite covering drag, resize, keyboard
  alternatives, selection, properties-panel edits (including focus/cursor preservation while
  typing), bounds and overlap rejection, adding blocks with and without free space, preview-size
  switching, unsaved-edit preservation, approved-image restriction, safe text rendering and a
  375px narrow-viewport overflow check.

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
2. This checkpoint now rejects any overlapping desktop block regions (on add, move, resize and
   drag) rather than merely flagging them. Backend owners should confirm this is the desired
   production policy, or whether a future design wants permitted-but-flagged overlap instead.
3. Final enumerated token lists for colour/spacing/padding should be reconciled with the actual
   site design tokens before any production use.
4. How `mobileOrder` interacts with hidden blocks/sections once this contract is merged with the
   existing hide/show model.

## Verified behaviour

- Visual canvas with a 12-column snapping grid, selection outline and resize handles
  (`visual-page-builder.css`/`.js`).
- Moving and resizing text, image and card blocks by pointer drag (move handle on the block body,
  resize handles on the corner/edges) and by keyboard (arrow keys move, Shift+arrow resizes) and
  by on-screen buttons (Move left/right/up/down, Wider/Narrower/Taller/Shorter) - all three paths
  go through the same bounds/overlap check and are covered by the automated test suite.
- Grid bounds are validated on both axes consistently (`x+w<=12` and `y+h<=60`), applied
  identically whether the change comes from a pointer drag, a keyboard shortcut or a toolbar
  button. A move/resize/drag that would cross either edge is rejected, the prior valid region is
  kept, and the status line explains why.
- Desktop blocks may never overlap. An overlapping move, resize, drag or new-block placement is
  rejected without losing content or altering the last valid layout; the status line explains the
  rejection. Mobile stacking order (`mobileOrder`) remains independently editable even when a
  desktop move/resize is blocked by overlap.
- Adding a new block searches for free, non-overlapping space within the grid (top-left first).
  If no space fits the new block's default size, the canvas is left completely unchanged and a
  clear message is shown instead of placing an invalid/overlapping block.
- Properties-panel editing (text, title, link, image description, and the style dropdowns) updates
  the canvas and preview without rebuilding the properties panel itself, so the active field keeps
  focus, cursor position and text selection while typing - including inserting text in the middle
  of an existing sentence, not just appending at the end.
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
  both-axis grid-bounds rejection, desktop block-overlap rejection, unapproved-image rejection,
  unsafe-link rejection, invalid style-token rejection, XSS-safe render); a pure geometry suite
  for `visual-canvas-layout.js` (overlap symmetry and touching-edge non-overlap, exact-edge bounds
  vs. one unit past either edge, `canPlace` self-exclusion, free-region search on an empty grid,
  a single free gap and a fully-packed grid); plus a Playwright browser suite covering: click
  selection and `aria-selected` state; keyboard move (`ArrowRight`) and keyboard resize
  (`Shift+ArrowDown`) with correct focus retention across re-renders; the Move-left button
  reproducing the same effect as keyboard/drag; pointer drag-to-move; pointer drag-to-resize via
  the corner handle (previously broken by a CSS clipping bug - see below, now fixed and covered);
  pointer dragging stopping exactly at the grid edge instead of escaping it; keyboard/button moves
  and resizes stopping at the exact right/bottom edge and being rejected one step further with a
  clear message; overlapping move/resize/drag all rejected with the document left byte-for-byte
  unchanged and a clear message shown, while mobile stacking order remains independently
  editable; adding a block to a completely full grid leaving the document unchanged with a clear
  message; eight repeated additions each finding their own non-overlapping space, followed by
  continued additions until the grid fills and the next attempt is cleanly rejected; typing a
  multi-word sentence, inserting text in the middle of existing text/title/link/image-description
  fields and confirming the field keeps focus, keeps the correct cursor position and the document
  updates immediately; a properties-panel `<select>` edit changing the exact block's style;
  unsaved-edit preservation across selecting a different block; unsaved-edit preservation across
  switching the preview from desktop to mobile (full-document deep-equality check) and the mobile
  preview rendering a stacked layout; the image picker only offering the approved fixture images;
  typed HTML-looking text rendering as literal text with no injected `<img>`; and no horizontal
  page overflow at a 375px viewport.
- `npm test` (existing `test:admin` + `test:invites` suites) - PASS, unaffected by this isolated
  addition.

Bug found and fixed during this session: `.vcb-block{overflow:hidden}` clipped the resize handles
(which are positioned with a negative offset so they sit on the block's edge), making the corner
handle unclickable at its real screen position for roughly half its area. Pointer-based resize via
the handle was silently falling back to a "move" because the click landed on the block instead.
Fixed by moving `overflow:hidden` to an inner `.vcb-block-content` wrapper so the handles (direct
children of `.vcb-block`) are never clipped. A new browser regression now drags the corner handle
and asserts width and height actually grow, which would have caught this before.

Not run / out of scope for this checkpoint:

- No production/authenticated acceptance test, since there is no backend wiring to test, and this
  checkpoint intentionally does not touch the live Page Builder's authenticated draft/history/
  publication system described in
  [PAGE-BUILDER-BACKEND-CHECKPOINT.md](PAGE-BUILDER-BACKEND-CHECKPOINT.md).
- No screen-reader or full manual WCAG audit; only programmatic `aria-selected`/`aria-label`/
  focus-retention checks were automated.
- No cross-browser check beyond Chromium (Playwright default in this repo's existing suites).
- No check of the pre-existing `feature/page-builder-local-drafts` fixture history/publication UI
  or the live backend Page Builder - neither was touched or re-verified by this work.
- No visual/pixel regression check; only DOM state, computed overflow and rendered text content
  were asserted.

## Scope boundaries respected

- No change to `page-model.js`, `page-builder-model.js`, `page-builder-contract.js`,
  `scripts/page-builder-server.cjs`, any Supabase SQL/function, authentication, permissions or
  publishing workflow - including the live, backend-integrated Page Builder described in
  [PAGE-BUILDER-BACKEND-CHECKPOINT.md](PAGE-BUILDER-BACKEND-CHECKPOINT.md).
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
   designed and implemented by the owning backend workstream, reusing the already-live Page
   Builder backend's patterns (trusted model/context, optimistic-concurrency revisions,
   exact-revision preview/digest, separate publication authority) described in
   [PAGE-BUILDER-BACKEND-CHECKPOINT.md](PAGE-BUILDER-BACKEND-CHECKPOINT.md) rather than inventing a
   parallel system. This checkpoint intentionally implements none of that backend integration.
3. Reconcile the demonstration style-token lists and the fixture approved-image list with the
   real production design tokens and real approved-asset inventory.
4. This checkpoint now rejects desktop block overlap outright (see "Verified behaviour" above).
   Confirm that is the desired production policy, and decide how `mobileOrder` interacts with
   hidden content once this contract is merged with the existing hide/show model.
5. Full accessibility (real screen reader), cross-browser and authenticated end-to-end review
   before any Admin Hub entry point is added.
