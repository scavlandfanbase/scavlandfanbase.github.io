# Shared per-item draft contract — 30 September 2026

Prepared on top of the shared-catalogue foundation in PR #23. No production migration, function deployment, public catalogue change or Admin UI replacement occurred.

## Implemented and verified

- `item-draft.mjs` snapshots one exact master Item identity and its existing Ammo/Armour/Weapon facets. Category permission and actual membership are required. No links are inferred by name.
- Shared edits update that same identity and applicable linked output fields; specialist edits are limited to the selected facet. Existing conflicting fields remain untouched unless explicitly edited. Unknown/null values, provenance and unrelated properties remain preserved.
- Changed reviewed records become Unverified with trusted server actor/time while keeping private history. Public projections strip identity/history. Client verification fields are rejected.
- The planner merges only changed fields onto fresh canonical documents. Unrelated records and disjoint edits survive. Same-field conflicts and changed membership stop publication. Removing/creating specialist facets and adding identities require later explicit actions; this checkpoint supports existing-item editing only.
- Existing whole-Items-draft work on the selected item is detected and blocks a competing edit/publication plan. Unrelated old-draft work is retained. No genuine old draft has been migrated or modified.
- Publication uses one Git tree/commit and one non-force branch update for all affected files. Failed branch update changes no public files. Exact already-published values allow safe response-lost re-planning without dropping private history. Existing whole-catalogue publishers retain their strict base checks.
- `shared-item-drafts.sql` proposes a separate private immutable version store. Browser saves accept a receipt ID, never arbitrary snapshots. Authenticated permissions/category access, actor/request/item binding, original receipt recovery, stale-write rejection and independent item histories are tested in real local Postgres. Existing draft storage is untouched.

## Validation

`node scripts/test-item-draft.cjs`, `node scripts/test-item-draft-storage.cjs`, `node scripts/test-shared-catalogue.cjs`, existing `npm test` and whitespace checks pass. Public data, Auth identities and GitHub publication are fixture-only. Production flags/source versions and real Owner acceptance are not certified by these tests.

## Required next checkpoint before rollout

1. Build the authenticated API bridge: fetch canonical files from one pinned Git commit; verify real caller Auth and category permission on every operation; use the trusted model to generate preparation receipts; read current legacy draft blockers through a service-only reviewed access path. Neither this module nor its SQL proposal is a standalone deployed endpoint.
2. Check latest immutable item version again at preview/publication and bind the accepted preview to that version/intent. Re-read legacy blockers and membership at preparation/publication rather than relying on an earlier UI check. Reconcile exact own-publication responses and retain full private history.
3. Preserve/import old Items drafts through an explicit reviewed process. This checkpoint blocks overlaps; it does not silently split or discard old drafts. Vendor drafts remain independent commercial drafts.
4. Connect Ammo controls to this contract, then add/review/archive operations and other categories as controlled tasks. Include usage preview from real vendor references. Keep the existing live entry points until replacement routes cover all records.
5. Coordinate approved SQL/backend/frontend rollout, then real Owner acceptance of one intended edit reaching the category page and stocking vendors while unrelated drafts and vendor commercial values remain unchanged.

The proposed storage currently covers existing Ammo/Armour/Weapon item membership. Ordinary-item categories, explicit new facet creation and generic category permissions need their own reviewed extension. Do not deploy the schema merely to make a UI button appear.
