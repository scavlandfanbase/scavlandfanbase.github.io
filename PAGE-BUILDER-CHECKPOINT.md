# SCAVLAND Page Builder Checkpoint

**Status:** Local preview and private draft checkpoint only. This is not integrated with the live Admin Hub and does not publish or deploy pages.

**Date:** 1 October 2026  
**Branch:** `feature/page-builder-local-drafts`  
**Commits:** `77713bb` (draft-service foundation), `1b1ed58` (visual editor and acceptance tests), `45f6426` (focus restoration), `2997a7f` (Items count-state assertions), `d1c1b4d` (keyboard-navigation checks), `38cf7c7` (hidden-item filter and fixture corrections), `d206ccb` (trusted validation model), `14ba115` (model trust-boundary tests), `ec714dd` (duplicate page identity protection), `c1d4afc` (required approved image blocks)

## What Exists

The repository already contained a local loopback draft service and a shared page model used by other Admin code. The actual Page Builder HTML and JavaScript entry points were missing, so the service root returned 404. The shared `page-model.js` and generated Admin model bundle remain unchanged. Reusable Page Builder validation now lives in the side-effect-free `page-builder-model.js`; `page-builder-contract.js` uses that model for escaped preview/export rendering.

The local editor supports page title, introduction and safe address; saved-draft listing/open/edit; section add/rename/reorder/hide/remove; block add/edit/reorder/duplicate/hide/remove; and heading, plain text, image, card, divider and link-button blocks. Section settings are limited to 1–3 columns, start/center alignment, compact/normal/spacious spacing, none/surface/subtle backgrounds and an optional border. Desktop and mobile previews and downloaded HTML use the same validated renderer. Hidden sections and blocks remain in the saved draft and are omitted from the preview/export.

`Save Draft` only saves to the local draft service. The service has no publish action and serves no `/pages/<address>` output. `Export HTML` downloads a local file; it is not a deployment. No live Admin Hub Page Builder button, public navigation or existing page was changed.

The proposed production-integration workflow, unresolved decisions and release gates are documented in [PAGE-BUILDER-PRODUCTION-PLAN.md](PAGE-BUILDER-PRODUCTION-PLAN.md). That document is a review plan only; none of its production work is implemented or enabled.

## Files Changed

- `page-builder.html` — standalone local editor shell and accessible labels/states.
- `page-builder.js` — draft workflow, sections/blocks, preview, local export, confirmations, conflict refresh and focus restoration; passes trusted image/address context to the model.
- `page-builder.css` — Page Builder and exported-page styles are scoped to `.page-builder` and `.published-page`. A narrow `.builder:not(.page-builder)` control-height rule preserves the existing Admin editor baseline.
- `page-builder-model.js` — reusable metadata/content validator; independent of filesystem, authentication and publication.
- `page-builder-contract.js` — escaped preview/export renderer using the reusable model.
- `scripts/page-builder-server.cjs` — validates create/save through the reusable model using image choices resolved from the existing inventory/filesystem and page identities/addresses derived from private saved drafts. Request envelopes reject unknown/protected fields. Existing loopback, host/origin/session protections and private storage remain in place.
- `items-builder.js` — Active items excludes hidden records; hidden records remain reachable through the explicit Hidden items and Include archived views. Public Items behavior is unchanged.
- `scripts/test-page-builder.cjs` — fixture-only service and browser acceptance checks using temporary storage.
- `scripts/test-items-builder.cjs` — updated stale count/empty-state expectations and verifies hidden-item filter state, stable identity, collapsed technical reference, and visible evidence link.
- `PAGE-BUILDER-CHECKPOINT.md` — this handoff.
- `NEXT_JOBS.md` — brief checkpoint reference only.

No game-data JSON, Attachment files, Admin authentication/permissions, Supabase schema/functions, production settings or publishing infrastructure were changed. `page-model.js` and the generated Admin model bundle were not changed.

## Start Locally

From the repository root:

```powershell
node scripts/page-builder-server.cjs
```

Open `http://127.0.0.1:4181/`. Stop the service with Ctrl+C. The default private draft file is resolved to `../../private-state/page-builder/pages.json` relative to the repository root, outside the website repository. `SCAVLAND_PRIVATE_PAGES` can override the storage directory, but it must also remain outside the repository. The service binds only to `127.0.0.1`; its session token is held in memory and draft content is not written to browser storage or logs.

The downloaded HTML embeds the trusted stylesheet. Image URLs remain rooted at `/images/`, so the export expects the existing site assets to be served from the site root; it is not a self-contained image package.

## Validation and Limits

The editor accepts plain text only. User text and attributes are escaped; there are no arbitrary HTML, JavaScript, CSS, embed or upload controls. An image block requires a nonempty path in the trusted approved image list. A card image is optional and may be `null` or omitted; any supplied card image must also be approved. Approved images must resolve to an existing file under `images/` and use a supported image extension. `evidence-inbox/`, traversal paths and unlisted assets are not selectable.

Links are restricted to HTTPS, a safe `.html` address, or `/pages/<safe-address>`; unsafe protocols and malformed values are rejected. Page addresses use lowercase letters, digits and hyphens, are limited to 80 characters, protect system names and must be unique among saved drafts.

`page-builder-model.js` requires trusted context (`approvedImages`, `existingPages`, `currentPageId`) and rejects missing/malformed context. It checks strict key allowlists for page metadata, sections, layouts and each block type; protects the system address list; checks unique page addresses and page/section/block identities; validates approved image references, safe links, plain-text values and the content limits below. It returns a clone without normalizing a valid draft, so existing IDs, omitted optional layout defaults, and literal values such as `Unknown` remain unchanged. Browser-supplied roles, approval/reviewer metadata, timestamps and page revision fields are rejected. The service accepts a revision only as an optimistic-concurrency precondition, compares it with its stored revision, and generates revision increments and timestamps itself.

Current content limits: 160 characters for page/block titles, 1,000 for the introduction, 160 for section titles, 10,000 for a text block, 300 for image alternative text, 500 for a link, 40 sections, 200 blocks per page, 100 saved pages and a 1 MiB request body. Section layout values are enums. Stale saves/deletes return a conflict without replacing newer saved content. Writes use a temporary file and preserve the previous saved file if replacement fails. Stored drafts with null, empty, omitted or no-longer-approved image-block paths remain loadable for repair, but preview, save and export reject them until an approved image is selected. Optional null/omitted card images remain valid.

The status area reports loading, unsaved, saving, saved and error states. In-app navigation warns before abandoning unsaved changes; browser navigation uses `beforeunload`; section/block/page deletion requires confirmation. Focus moves to a useful surviving control after confirmed section/block/page deletion and block/section reordering or duplication. A failed save leaves current edits on screen. On a stale revision, refresh the saved-draft list to inspect the newer copy before reopening it.

## Verification

Passed:

- `node scripts/test-page-builder.cjs` — create/save/reopen/edit; all block types; ordering, duplication, hiding and deletion; exact preservation of valid drafts and `Unknown` values; missing trusted context; unknown/protected fields; duplicate stable identities, page IDs and addresses; reserved addresses; null, empty, omitted, unapproved and traversal image cases; optional null/omitted card images; unsafe/malformed links; layout/type/content limits; malicious text escaping; empty pages, 10,000-character text and 200-block rendering; hidden-content omission; preview/export equality and safe hrefs; strict request authority fields; save failure, single-save retry and stale-revision recovery; invalid stored-image repair with preview/save/export refusal until corrected; unsaved-change warnings; focus after cancel/confirm, reorder and delete actions; keyboard activation and 320–1280px layouts.
- `node scripts/test-items-builder.cjs` — PASS. Exact populated/zero count states, 40/80 pagination, search, hidden excluded from Active and available under Hidden, archived filtering, hidden status, stable ID through the list and collapsed technical details, evidence link, missing image, keyboard/dialog focus and public hidden-item filtering.
- `node scripts/test-items-editor.cjs` — existing Items editor workflow and responsive checks.
- `node scripts/test-vendor-builder.cjs` — existing Vendor editor workflow and responsive checks.
- `npm test` — Admin core and Admin invitation/privacy suites.
- `git diff --check`, JavaScript syntax checks and VS Code diagnostics for changed code — passed.

The fixture expected hidden item ID `two` in visible facts, but permanent references are intentionally inside a collapsed technical-details disclosure. The test now checks the stable list identity and opens that disclosure before checking the reference. Investigation also found and fixed a separate visibility-filter bug: Active items had included hidden records; hidden records now appear only under Hidden items, Include archived, or other explicitly matching filters. The public Items page already omitted hidden records and remains unchanged.

The browser suite replaces `window.confirm` with a deterministic fixture to exercise accept/cancel paths; application focus restoration after those paths is asserted, but native browser-chrome dialog focus itself is not automated. The repository Admin test run emitted its existing non-fatal Node `MODULE_TYPELESS_PACKAGE_JSON` warning. No production browser/authentication or deployment checks were attempted.

## Limitations and Next Tasks

This is a single-operator local service, not an authenticated or durable production draft system. There is no image upload/manager, rich-text/HTML input, live public route, Admin Hub integration, approval workflow or publication action. Existing image paths in an export require the site root as described above.

Exact next tasks before considering live integration:

1. Durable private draft storage, retention, backup and recovery outside public assets.
2. Server-enforced Admin permissions and auditable access; the loopback session token is not production authentication.
3. Preview review/approval, approved asset governance and content projection for public output.
4. Stale-write conflict UX, recovery/restore and explicit handling of concurrent editors.
5. Explicit publication, rollback/unpublish, safe public routes and any separately approved navigation changes.
6. Authenticated end-to-end acceptance and a dedicated review of the Admin Hub integration before enabling any live Page Builder control.

Until those gates are reviewed and verified, do not describe this builder as available to live admins and do not treat local Save/Export as publication.
