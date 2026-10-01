# Connected Ammo verification review — 30 September 2026

Prepared on top of draft PR #26. No deployment, migration, genuine draft write or game-data change.

The selected Ammo item now offers Review verification. It reviews saved category facts only: unsaved form changes must be saved first. The decision defaults to Unverified. Explicit Verified/Unverified review saves through the existing trusted receipt path and retains private actor/time/history. The server checks category permission, item identity, draft revision and current patch; browser-supplied actor or verification metadata is rejected.

Review does not attest unrelated category facets or the general Items verification record. Shared detail edits still propagate and invalidate affected reviews. Preview now shows verification summaries alongside saved facts. A new review clears any previous preview; explicit selected-item publication is required. Public output contains only the decision and patch summary, while private dated review history remains stored.

## Validation

Contract tests cover wrong identity, stale patch, forged fields, permission denial, retained review history, public privacy and edit-after-review invalidation. Real local SQL and headless Edge fixtures cover private Verified save/reload, Unverified review retaining history, invalidated preview, explicit publication of a public summary and unchanged vendor values. Existing admin and invitation regressions pass. Fixtures make no production calls.

## Next checkpoint

Add new shared identity/category facet creation, followed by archive/restore with connected public visibility and retained vendor references. Preserve overlapping existing Items drafts through a reviewed path before rollout. Complete other categories before removing the general Items route. Keep PR #22 held; coordinated SQL/backend/frontend activation remains pending.
