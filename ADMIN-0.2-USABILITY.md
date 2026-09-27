# Admin 0.2 — Usability and Classification UX

Local review checkpoint, 27 September 2026. Branch: checkpoint/admin-0.2-usability. Base: 167328ea32b438a90d8c6a68ed38dedb44dd5688. Continues the 15 modified files and one new test preserved from the interrupted pass; none were discarded.

## Result

- Shared contextual help supports mouse hover, focus, click, mobile tap and Escape without closing the surrounding dialog. Named help buttons, descriptions, focus return and approximately 44px targets are retained. Long explanations have been shortened where contextual help replaces them.
- Content Type and Category are separate. Item, Weapon, Armour, Ammo, Attachment and Blueprint are recognised. Existing source classification tags are displayed explicitly; names, images and evidence do not establish type. Conflicts are visible and filterable, without rewriting Content Type. Moves into dedicated catalogues remain blocked in both UI and the model. Item categories include Not recorded, Food & Drink, Medical, Repair & Maintenance, Crafting Materials, Tools, Junk and Other. Existing custom categories remain intact.
- Rank, estimated price, maximum stack, stackable, notes and simple effects use named controls. Unchanged values retain their original representation (including numeric text), null, zero, false and intentional blank text. Complex properties/legacy structures retain the advanced editor. Permanent references, timestamps, raw image/evidence paths and legacy classifications are in technical disclosures.
- Edit/Image/Verify remain primary; Duplicate/Hide/Archive are under More actions. Missing facts are summarised instead of displaying rows of Not recorded. Counts distinguish total records from filtered matches.
- Image search starts with the edited record name, uses readable names/previews and offers Show all images. Evidence displays screenshots prominently with optional technical references. Evidence is not required for verification.
- Attention filters cover verification, older-patch review, missing images/information and classification conflicts. Source-classified Ammo/Armour/Weapons are identified in review lists without changing the stored record. Still correct uses an explicit verification confirmation. Save & Next and Skip/Next preserve the review sequence; Skip does not save. Edit & Verify saves first, then opens a separate verification confirmation; failed saves never advance or verify.
- Vendor stock links still reference existing canonical records. Vendor price/rank/stock/private notes stay on the listing. Existing legacy stock is shown alongside new listings, including its values and read-only matching proposals; it is not hidden or discarded.
- The authenticated source response exposes only a publish-capability boolean derived from the two existing activation flags. The UI shows Publishing disabled and fails closed if this capability is absent. Server publication authorization remains authoritative.

## Legacy stock and classification findings

Read-only analysis of the unchanged source found 22 Vendors and 255 legacy stock rows. All 255 have exactly one existing Item with the same stable reference and matching name, so the UI can propose these existing Item references without duplicating Items. No rows are currently unmatched or ambiguous by this strict rule. Fixtures additionally cover conflicting reference/name, ambiguous names, archived targets and missing matches.

Every legacy rank is stored as text and every quantity is absent. A later migration must explicitly preserve those distinctions, retain source details/provenance, handle existing or archived listings, and avoid representing shop evidence as a new verification decision. Exact identity matches are proposals, not approval to silently convert values. This checkpoint does not migrate or publish any of these rows.

84 Items-collection records have source classifications differing from the collection's default Item type: 40 Weapon, 31 Armour and 13 Ammo. They are surfaced for review; their stored records, IDs and relationships remain unchanged. Blueprint is recognised where explicitly recorded, but no dedicated Blueprint editor or inferred dataset was added.

## Validation

Passed:
- test-admin02-ux.cjs: classification boundary, dependent categories, attention filters, null/0/No/blank preservation, hover/focus/click/Escape/tap help, 280/320/390/768/1280px layouts and 44px targets.
- test-admin02-workflow.cjs: source-type conflicts, Blueprint recognition, safe legacy proposals, authenticated capability flags and disabled Publish UI, field-specific controls/effects, readable image search, evidence previews, Save & Next, Skip/end-of-queue without writes, Still correct and separate Edit & Verify.
- test-items-editor.cjs, test-vendor-inventory-browser.cjs, test-vendor-builder.cjs, test-dashboard.cjs, test-patch-browser.cjs.
- test-items-actions.cjs, test-items-foundation.cjs, test-verification.cjs, test-vendor-listings.cjs, test-vendor-inventory.cjs, test-item-catalog.cjs, test-draft-publish.mjs.
- test-admin01-core.cjs with SCAVLAND_BROWSER=1: local embedded PostgreSQL plus mocked Auth/GitHub/HTTP transport, including forgery rejection, optional evidence, trusted actor/time/patch, durable multi-session drafts, retry/conflicts, private/public separation, canonical rename propagation, independent Vendor values, patch transitions and hosted-editor browser regression. This did not rerun live production acceptance.
- Generated-model consistency and whitespace checks. No data/ files changed.

The inherited standalone test-editor-components.cjs references a preview-editor-components.cjs fixture absent from the released base. Shared components were instead exercised by the new focused tests and affected editor/hosted-bridge regressions. The documented PGlite 0.3.14 dependency was restored in an external test folder with install scripts disabled; it is not a production dependency.

Desktop and narrow-mobile screenshots were captured and inspected in the task's outputs/admin02-screenshots directory. Physical PC/phone and assistive-technology testing remains a manual review step.

## Boundaries and next decisions

No production calls, migrations, deployment, push or merge were made for this checkpoint. Genuine source Items/Vendors and public pages/data were not edited. Admin 0.1 flags remain unchanged: ADMIN_CORE_ENABLED=true, DRAFT_PUBLISH_ENABLED=false, PATCH_MANAGEMENT_ENABLED=false. No Visual Website Editor, Weapon Builder or other deferred editor was started.

This is not approved for publication. Review the UX first. A later deployment would need the reviewed admin-drafts source-capability response and regenerated classification model; if the frontend is reviewed against the current older backend, publishing remains safely disabled. Neither disabled flag needs to be enabled to review this checkpoint.

Separate decisions remain for a lossless legacy-stock migration and cross-catalogue record moves. No migration is implemented or silently scheduled. Verification identity/history controls and Item-to-Vendor relationships were not weakened.

## Exact checkpoint files

- ADMIN-0.2-USABILITY.md
- admin-dashboard.js
- admin.html
- attachment-model.js
- editor-components.css
- editor-components.js
- editor-dialog.js
- item-model.cjs
- items-builder.css
- items-builder.html
- items-builder.js
- patch-admin.html
- production-editor.js
- scripts/page-builder-server.cjs
- scripts/test-admin02-ux.cjs
- scripts/test-admin02-workflow.cjs
- scripts/test-dashboard.cjs
- scripts/test-items-editor.cjs
- scripts/test-items-foundation.cjs
- scripts/test-vendor-builder.cjs
- scripts/test-vendor-inventory-browser.cjs
- supabase/functions/admin-drafts/models.generated.mjs
- supabase/functions/admin-drafts/production.mjs
- vendor-builder.css
- vendor-builder.html
- vendor-builder.js
- vendor-inventory.js
- vendor-legacy-review.js
