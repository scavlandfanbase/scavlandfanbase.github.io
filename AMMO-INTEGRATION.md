# Ammo private editor integration — 29 September 2026

Prepared from main `98d121a`, using the existing full Ammo checkpoint `bcf5900`. The Hub's older Ammunition form already displays damage fields, but its legacy Save and publish endpoint is retired under the active trusted core. General Items are a separate catalogue and do not show specialist damage fields.

## Result

The Ammunition Hub route opens the recovered visual Ammo editor. It displays damage and penetration, supports add/edit/image/duplicate/hide/archive/restore/evidence/review, and uses durable private drafts with Preview, explicit Publish and conflict-safe Refresh from public. Ammo uses the existing `ammunition_edit` permission. Server Auth supplies verification identity/time/current patch. Fact/image edits invalidate verification while retaining private history. Unknown values, zero, negative penetration, damage text and existing provenance/extra fields remain intact.

Ammo drafts and publication use `data/ammo.json` only. This task does not combine specialist records with Items or infer identity/classification links. Existing public item-catalog relationships remain intact. The original local-only API fallback remains historical; this integration tests the authenticated Hub path.

## Coordinated release

1. Read-only preflight: no existing Ammo draft versions; verify the prepared-domain constraint and existing trusted functions. Observed before release: Items v20, Vendors v6, no Ammo versions. No draft contents changed by this task.
2. Apply `supabase/proposals/ammo-trusted-drafts.sql` once. It extends trusted preparation/trigger checks to Ammo and preserves all Items/Vendor versions and receipts. It refuses activation if untrusted Ammo drafts already exist. Do not rerun `admin01-trusted-drafts.sql`.
3. Deploy the reviewed `admin-drafts` package with the generated Ammo model, preserving existing Auth configuration and flags. Retired legacy publishers stay retired.
4. Merge frontend/backend source checkpoint and verify GitHub Pages serves the versioned Ammo iframe/scripts.
5. Owner acceptance: open Ammunition, confirm known recorded damage/penetration; make an intended edit, confirm private save/reload, review preview and explicitly publish only when intended. Confirm returned publication/deployed result separately. Do not publish test fixtures or the entire Items draft to validate Ammo.

## Validation

- `node scripts/test-ammo-actions.cjs`: recovered model actions, source fact/absent-field preservation, unknown/zero/text values and retained history.
- `SCAVLAND_BROWSER=1 npm test`: real local Postgres receipt migration, permission/forgery denial, server review identity, private preview and explicit mocked Ammo-only publication; real Hub same-origin session handoff, damage 46 and penetration -25 displayed, preview stats, enabled publication after preview, 320–1280px Ammo layouts, restricted Admin navigation; existing Items/Vendors/invite regressions pass.
- `node scripts/test-items-rebase.cjs`, `node scripts/test-dashboard.cjs`, generated-model check and whitespace checks pass.

Auth/GitHub transports are fixtures. No genuine Ammo/Items data was edited or published by these tests. Production migration/function/frontend release and real Owner Ammo acceptance remain pending in this prepared checkpoint.

## Previous checkpoint acceptance

Owner screenshots show the new explicit Unverified review dialog, successful Items refresh (`Saved · private draft refreshed from public data`) and retained `Special FMJ Ammo.` in preview. This establishes recovery and preview, not publication acceptance. Later screenshots show the name without a full stop; no inference about later private edits or publication is made here.
