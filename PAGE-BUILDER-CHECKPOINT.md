# SCAVLAND Page Builder Checkpoint

**Status:** Local preview and private draft checkpoint only. This is not integrated with the live Admin Hub and does not publish or deploy pages.

**Date:** 1 October 2026  
**Branch:** `feature/page-builder-local-drafts`  
**Commits:** `77713bb` (draft-service foundation), `1b1ed58` (visual editor and acceptance tests)

## What Exists

The repository already contained a shared, escaped page renderer in `page-model.js`, a local loopback draft service, and a stylesheet. The actual Page Builder HTML and JavaScript entry points were missing, so the service root returned 404. The shared renderer is also packaged by the Admin model-generation script; it was left unchanged. Page Builder-specific layout validation and rendering now live in `page-builder-contract.js`.

The local editor supports page title, introduction and safe address; saved-draft listing/open/edit; section add/rename/reorder/hide/remove; block add/edit/reorder/duplicate/hide/remove; and heading, plain text, image, card, divider and link-button blocks. Section settings are limited to 1–3 columns, start/center alignment, compact/normal/spacious spacing, none/surface/subtle backgrounds and an optional border. Desktop and mobile previews and downloaded HTML use the same validated renderer. Hidden sections and blocks remain in the saved draft and are omitted from the preview/export.

`Save Draft` only saves to the local draft service. The service has no publish action and serves no `/pages/<address>` output. `Export HTML` downloads a local file; it is not a deployment. No live Admin Hub Page Builder button, public navigation or existing page was changed.

## Files Changed

- `page-builder.html` — standalone local editor shell and accessible labels/states.
- `page-builder.js` — draft workflow, sections/blocks, preview, local export, confirmations and conflict refresh.
- `page-builder.css` — Page Builder and exported-page styles are scoped to `.page-builder` and `.published-page`. A narrow `.builder:not(.page-builder)` control-height rule preserves the existing Admin editor baseline.
- `page-builder-contract.js` — Page Builder-only layout validation and escaped HTML output, built on the existing shared page model.
- `scripts/page-builder-server.cjs` — serves the local editor, filters approved images, checks draft revisions and permits only local draft create/save/delete. Existing loopback, host/origin/session protections and private storage remain in place.
- `scripts/test-page-builder.cjs` — fixture-only service and browser acceptance checks using temporary storage.
- `PAGE-BUILDER-CHECKPOINT.md` — this handoff.
- `NEXT_JOBS.md` — brief checkpoint reference only.

No game-data JSON, Admin authentication/permissions, Supabase schema/functions, production settings or publishing infrastructure were changed. `page-model.js` and the generated Admin model bundle were not changed.

## Start Locally

From the repository root:

```powershell
node scripts/page-builder-server.cjs
```

Open `http://127.0.0.1:4181/`. Stop the service with Ctrl+C. The default private draft file is resolved to `../../private-state/page-builder/pages.json` relative to the repository root, outside the website repository. `SCAVLAND_PRIVATE_PAGES` can override the storage directory, but it must also remain outside the repository. The service binds only to `127.0.0.1`; its session token is held in memory and draft content is not written to browser storage or logs.

The downloaded HTML embeds the trusted stylesheet. Image URLs remain rooted at `/images/`, so the export expects the existing site assets to be served from the site root; it is not a self-contained image package.

## Validation and Limits

The editor accepts plain text only. User text and attributes are escaped; there are no arbitrary HTML, JavaScript, CSS, embed or upload controls. Images must be present in the existing approved image inventory, resolve to an existing file under `images/`, and use a supported image extension. `evidence-inbox/`, traversal paths and unlisted assets are not selectable.

Links are restricted to HTTPS, a safe `.html` address, or `/pages/<safe-address>`; unsafe protocols and malformed values are rejected. Page addresses use lowercase letters, digits and hyphens, are limited to 80 characters, protect system names and must be unique among saved drafts.

Current content limits: 160 characters for page/block titles, 1,000 for the introduction, 160 for section titles, 10,000 for a text block, 300 for image alternative text, 500 for a link, 40 sections, 200 blocks per page, 100 saved pages and a 1 MiB request body. Section layout values are enums validated by the local service. Saves require the current revision; stale saves/deletes return a conflict without replacing the newer saved content. Writes use a temporary file and preserve the previous saved file if replacement fails.

The status area reports loading, unsaved, saving, saved and error states. In-app navigation warns before abandoning unsaved changes; browser navigation uses `beforeunload`; section/block/page deletion requires confirmation. A failed save leaves current edits on screen. On a stale revision, refresh the saved-draft list to inspect the newer copy before reopening it.

## Verification

Passed:

- `node scripts/test-page-builder.cjs` — create/save/reopen/edit; all block types; ordering, duplication, hiding and deletion; safe/duplicate/reserved addresses; unsafe links and image paths; malicious text escaping; empty pages, 10,000-character text and 200-block rendering; hidden-content omission; preview/export equality; save failure and stale-revision recovery; missing-image replacement; confirmation branches; contrast ratios; keyboard interaction and 320–1280px layouts.
- `node scripts/test-items-editor.cjs` — existing Items editor workflow and responsive checks.
- `node scripts/test-vendor-builder.cjs` — existing Vendor editor workflow and responsive checks.
- `npm test` — Admin core and Admin invitation/privacy suites.
- `git diff --check`, JavaScript syntax checks and VS Code diagnostics for changed code — passed.

Known unrelated test failure:

- `node scripts/test-items-builder.cjs` fails at its existing assertion expecting `/285 items/`; the current UI reports `285 total · 285 match current filters · showing 40`. No Items code or test was changed for this Page Builder checkpoint.

The repository Admin test run emitted its existing non-fatal Node `MODULE_TYPELESS_PACKAGE_JSON` warning. No production browser/authentication or deployment checks were attempted.

## Limitations and Next Tasks

This is a single-operator local service, not an authenticated or durable production draft system. There is no image upload/manager, rich-text/HTML input, live public route, Admin Hub integration, approval workflow or publication action. Existing image paths in an export require the site root as described above.

Before any live integration, complete a separate reviewed design and implementation for:

1. Durable private draft storage, retention, backup and recovery outside public assets.
2. Server-enforced Admin permissions and auditable access; the loopback session token is not production authentication.
3. Preview review/approval, approved asset governance and content projection for public output.
4. Stale-write conflict UX, recovery/restore and explicit handling of concurrent editors.
5. Explicit publication, rollback/unpublish, safe public routes and any separately approved navigation changes.
6. Authenticated end-to-end acceptance and a dedicated review of the Admin Hub integration before enabling any live Page Builder control.

Until those gates are reviewed and verified, do not describe this builder as available to live admins and do not treat local Save/Export as publication.
