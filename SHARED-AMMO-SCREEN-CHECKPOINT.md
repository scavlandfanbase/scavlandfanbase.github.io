# Connected Ammo screen — 30 September 2026

Prepared on top of PR #25. No production deployment or data publication occurred.

The Hub's Ammunition route now targets `ammo-category.html` in this branch. It lists only Ammo identities, loads one shared per-item draft and shows shared name/image/description/notes/reference price/stack values alongside Ammo type, damage and penetration. Vendor connections display their independent price/rank/quantity. Existing differing shared values are visible and are reconciled only when that field is deliberately changed.

Save is private. Preview and explicit Publish operate on the selected saved identity; unreviewed form changes disable publication. Same-origin signed-in parent handoff supplies the token in memory only. Failed/lost saves retain form entries and receipt IDs for retry. An old Items-draft overlap leaves the record listed with editing disabled and a readable reason; it is not dropped, overwritten or published.

The API's category list and vendor-usage read use the same pinned public commit. Load reports whether unpublished changes remain. Exact already-public changed fields are reconciled into the server-side baseline while preserving private verification history, so a second edit after publication does not conflict with its own earlier publication.

## Verified

Real local SQL plus mocked Auth/GitHub and headless Edge exercise the screen: signed-in handoff, protected legacy work, damage/negative penetration display, vendor usage, private edit/save/reload, selected-item preview and explicit connected publication, unchanged vendor commercial data, another saved edit after publication, no page errors and 320–1280px layouts. Existing per-item contract and `npm test` regressions pass. Desktop screenshot inspected.

## Remaining before release

- This screen supports existing-item editing. Add/new facet, explicit verification review, archive/restore and other item actions still require shared-contract extensions. No old independent Ammo action is substituted to fake these capabilities.
- Preserve/import overlapping genuine old Items drafts through a reviewed path; the current screen blocks them.
- Complete preview usage/acceptance and category coverage before removing the general Items route.
- Review and coordinate the two proposed SQL migrations, backend source and frontend/feature flag together. Keep PR #22 held. Then verify a real intended Owner edit on public Ammo and stocking vendor pages.

Tests use local fixtures only; genuine drafts, game facts, vendor stock and public pages have not been changed by this checkpoint.
