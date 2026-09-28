# Admin 0.2B — local Vendor UI checkpoint

Vendor-only host width is 90% up to1800px, with narrow-screen margins. A same-origin/source-checked presentation bridge grows only the Vendor iframe to its builder content, leaving main scrolling to the parent page. Dialog position/max-height follows the visible parent viewport. Other Admin workspaces retain their existing layout.

Desktop header uses two columns for selection/actions and Vendor identity/portrait/location/faction/status; mobile stacks. Inventory uses compact rows with available icons, authoritative Content Type, price/rank/stock and verification status. Mobile uses stacked cards. Actions are Edit, Status and More; More contains history, movement, archive and removal. Existing confirmations and save pathways remain unchanged. Help is grouped by concept rather than repeated beside every row action.

Important limitation: the existing trusted inventory backend has no listing-verification decision operation. This UI does not invent one. Status explains this limitation; Verification history is labelled explicitly under More. Implementing a genuine Verify action requires a separately approved backend task. No security/persistence code was changed.

Read-only Vendor dialogs opt into one Close button. Existing shared editing/destructive dialog behaviour is unchanged. Fully linked legacy groups collapse by default with counts. Groups with unresolved rows stay open and labelled for review. Original rows and technical source information remain available.

Validation passed: test-vendor-ui-02b (320,390,768,1280,1920,2560 widths; no overflow;44px targets; iframe/content sizing; compact rows; viewport-fitted dialogs; focus/keyboard; help; menus;224 linked/31 review; byte-identical fixture after read-only interactions), test-vendor-inventory-browser (including actual fixture edits/retry/conflict/reorder/archive/restore/remove), test-admin02-workflow (shared dialog regression), test-vendor-stock, test-vendor-shell and git diff --check. Desktop and narrow-mobile screenshots reviewed; screenshots stored outside repo. Embedded tests strip frame-denial headers only in the test fixture; server security headers remain unchanged.

Read-only production snapshots before/after were completely equal: Vendor revision6,22 genuine Vendors,224 listings,255 legacy rows,migration audit and selectedId grigory unchanged. Hosted Items/Vendors/verification settings match local source;patch0.7.2. No production writes, flags changes, backend deployment, public publication, migration or classification changes.

Changed files: admin.html; vendor-host.css; vendor-workspace.js; vendor-builder.html/.css/.js; vendor-inventory.js; editor-dialog.js; scripts/page-builder-server.cjs (local asset allowlist only); scripts/test-vendor-inventory-browser.cjs; scripts/test-vendor-ui-02b.cjs; this note.

Deployment is not authorized. Review this UI-only commit independently of earlier backend preparation commits on this branch. Genuine listing verification remains a separate decision; Status/History are honest read-only controls in this checkpoint.
