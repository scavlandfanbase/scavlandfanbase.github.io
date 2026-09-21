# Public Content Admin CMS Plan

## Goal

Allow an authorized SCAVLAND administrator to see the current public page content, edit it safely, preview the result, and publish the change to GitHub.

The intended flow is:

```text
Admin login
  -> current public content loads
  -> administrator edits text, images, sections, or layout settings
  -> live preview shows the unsaved result
  -> server validates the change
  -> Supabase Edge Function commits the approved JSON file to GitHub
  -> GitHub Pages updates the public site
```

## Current State

Stage 1 is complete and Stage 2 has started. `data/site-content.json` captures the current global navigation, footer, Home page hero, feature cards, latest-update section, Roadmap sections, and Factions descriptions, plus baseline title/intro values for the other public pages. The first `content-admin.html` editor and `publish-site-content` function now exist, and the public shell consumes the model through `site-shell.js` while retaining existing markup as fallback.

Already working:

- Admin Hub authentication and admin allowlist check.
- Evidence Review.
- Items editor and secure `publish-item` function.
- Vendors editor and secure `publish-vendor` function.
- Page Settings and secure `publish-site-settings` function.
- Weapons, Armour, Ammunition, and Crafting specialist editor.
- Secure `publish-specialist` function.
- Stable item IDs linking shared names and images across public pages.
- Item, specialist, vendor, and Page Settings previews.
- Local rollback archive in `backups/` before specialist editor expansion.

Still to build:

- A complete central public-content model for page text, sections, cards, navigation, footer, and image placements.
- Friendly editing controls for all page content instead of raw HTML or isolated hardcoded strings.
- Full page-by-page migration of public HTML to consume the central content model.
- Authenticated end-to-end tests for every editor and public preview.

## Content Model

Add a central file named `data/site-content.json` with stable page and section keys. It should contain only user-facing content and presentation references, not canonical game stats.

Suggested shape:

```json
{
  "schemaVersion": 1,
  "global": {
    "navigation": [
      { "page": "index.html", "label": "Home" }
    ],
    "footerText": "SCAVLAND Fan Database"
  },
  "pages": {
    "index.html": {
      "title": "Welcome to SCAVLAND",
      "intro": "Weapons, armour, vendors, crafting, items and more.",
      "sections": [
        {
          "id": "database-links",
          "title": "Database",
          "intro": "Explore the database.",
          "cards": [
            {
              "id": "vendors-card",
              "title": "Vendors",
              "description": "Discover traders and their stock.",
              "image": "images/example.png",
              "href": "vendors.html"
            }
          ]
        }
      ]
    }
  }
}
```

Rules:

- Stable content IDs must not change casually because previews and overrides use them.
- Image paths must be repository-relative `images/` or `evidence-inbox/` paths.
- No URL, absolute path, traversal path, or unsupported image extension.
- Game values remain in their existing specialist JSON files.
- Evidence provenance remains in the relevant source object.
- Blank optional values become `null`, not the string `"null"`.

## Implementation Stages

### Stage 1: Model and backup

- Create a dated rollback archive from a clean `main` commit.
- Inventory visible public headings, paragraphs, cards, images, navigation, and footer content.
- Create `data/site-content.json` without changing the public output.
- Add a schema/version note and validation script coverage.

### Stage 2: Secure publishing

- Add `supabase/functions/publish-site-content/index.ts`.
- Require a signed-in Supabase user and `is_scavland_admin()`.
- Allow only fixed target `data/site-content.json`.
- Allow only known page/content IDs and approved fields.
- Validate every image path and content length server-side.
- Fetch the current GitHub file, replace only the requested content record, and commit with a useful message.
- Never expose `GITHUB_TOKEN` to the browser.

### Stage 3: Public rendering adapter

- Add a shared loader in `site-shell.js` for `data/site-content.json`.
- Apply page titles, intros, navigation labels, footer text, section headings, and image paths.
- Keep legacy hardcoded markup as a fallback while each page is migrated.
- Do not remove fallback markup until the migrated page has passed public smoke tests.

### Stage 4: Admin Content Editor

- Add a dedicated `content-admin.html` view to the Admin Hub.
- Page selector on the left.
- Section/card tree below the page selector.
- Friendly form controls for titles, descriptions, links, image paths, and visibility.
- Existing image preview and drag/drop local preview.
- Before/after summary.
- Live preview panel.
- Full-page preview in a new tab using temporary browser storage.
- Clear temporary preview action.
- Publish disabled until validation passes.

### Stage 5: Page migration order

Migrate in this order:

1. Home/index page.
2. Roadmap.
3. Factions.
4. Areas.
5. Map page labels and intro.
6. Items page shared headings and explanatory text.
7. Vendors page shared headings and explanatory text.
8. Weapons and Armour shared headings and explanatory text.
9. Crafting shared headings and explanatory text.

Specialist record cards remain driven by their dedicated data editors. The content CMS controls surrounding page copy, section labels, card descriptions, images, and presentation text.

### Stage 6: Validation and rollout

For every migrated page:

- Signed-out page still loads without protected data.
- Existing public text and images match before migration.
- Admin editor loads the current values.
- Unsaved edits appear in the live preview.
- Invalid paths are rejected before publish.
- Anonymous and non-admin publish requests are rejected.
- A safe test edit changes only the intended content record.
- GitHub commit URL is returned after confirmation.
- Public page reflects the published edit after GitHub Pages deployment.
- Desktop and approximately 390px mobile layouts work.
- No duplicate IDs or console errors.
- Rollback archive remains available until the migrated page is accepted.

## Deliberate Boundaries

This project should not:

- Convert the static site to a framework.
- Put GitHub credentials in browser code.
- Make private evidence public.
- Change canonical game values without direct evidence.
- Replace stable item IDs.
- Allow arbitrary GitHub paths or arbitrary JSON commits.
- Migrate all pages in one untestable bulk edit.

## Acceptance Definition

The CMS migration is complete when an administrator can select any public page, see its current editable content, change a visible text/image/layout field, preview it in the real page context, publish it securely, and verify the resulting GitHub commit and public deployment without manually editing HTML.
