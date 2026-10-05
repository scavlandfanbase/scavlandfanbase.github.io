# Vendor listing verification — local checkpoint, 5 October 2026

Branch: `feature/vendor-listing-verification`, based on released main `4c11d6a3e4978409146d5bd2d9e118b4cd639b20`.

## Behaviour

Active Vendor listings have a Verify action for reviewing that Vendor's price, rank and stock. The dialog explains that evidence is optional and the canonical entity/other Vendors are not verified by this decision. It defaults to Unverified; Verified requires a configured current patch. Existing private History remains accessible.

The review uses the existing authenticated prepare receipt and durable Save Draft flow. The server derives identity and timestamp and reads the authoritative patch. The command confirms the exact listing and patch; wrong ownership, stale revision, patch drift, unavailable/archived records and fabricated identity/history are rejected. No new persistence or publication route is introduced.

Commercial edits invalidate verification while preserving history. A changed current patch derives Patch Check Needed without rewriting listing history. Public projection retains only the existing decision/patch summary, with no reviewer identity, timestamps or private history. Save remains separate from Preview/Publish. Legacy inventory, migration audit and genuine source data are untouched.

## Validation

- Inventory model/storage and listing model: pass, including exact relationships, unknown/zero values, other-listing isolation, invalid commands, missing entity/patch, stale revision and source preservation.
- `test-admin01-core.cjs` with `SCAVLAND_BROWSER=1`: pass using isolated PGlite SQL/Auth/Git fixtures and real production handler/browser bridge. Includes server attribution, forged receipt rejection, lost-reply retry, separate session retrieval, reload, re-verification, commercial invalidation, privacy and zero publication by listing Save.
- `test-vendor-inventory-browser.cjs`: pass, including review cancellation, error/retry, persistence, history, keyboard focus and 280/375/1280px review dialogs; existing 320–1280px inventory controls and 44px targets pass. Desktop/mobile screenshots inspected.
- Vendor stock and shared verification regressions: pass.
- Older `test-vendor-ui-02b.cjs` cannot run: it references the absent pre-existing `vendor-migration-stage1.cjs`. No unrelated migration code was restored or changed. Current inventory browser and production bridge suites provide the layout checks above.

All writes in tests use temporary fixtures. No genuine private draft, public data, patch, feature flag or production backend was changed.

## Release steps requiring approval

1. Redeploy only `admin-drafts` with the updated generated model bundle, preserving its Auth configuration/secrets. No SQL, RLS, Auth, Storage or flag change is needed.
2. Integrate the tested feature onto current main preserving any newer commits, then publish `vendor-inventory.js` and the cache-versioned `vendor-builder.html` through the existing frontend release flow.
3. Check the signed-in hosted review dialog and, if authorized, use disposable private listing data to confirm durable review and cleanup. Do not publish genuine content merely to test this feature.

This checkpoint has not been pushed, deployed or published. Hosted authenticated acceptance remains a release check.
