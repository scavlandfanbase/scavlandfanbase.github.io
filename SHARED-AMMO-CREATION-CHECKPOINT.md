# Shared Ammo creation contract — 30 September 2026

Prepared on top of draft PR #27. This is the trusted creation/publication foundation; no Add button, API creation route or production deployment is enabled by this checkpoint.

New Ammo uses one permanent server-supplied UUID identity in both the shared Items record and Ammo facet. Only allowlisted recorded fields are accepted. New records begin with unknown optional values and pending-review provenance; no game facts, verification or vendor stock are inferred. Category permission and authenticated actor checks use the existing trusted edit context.

Creation intent survives private storage as part of the selected-item draft. Publication inserts both records in one Git commit. A concurrent different record under that ID stops publication. Exact response-lost publication retries do not duplicate records. Once the exact records are public, baseline reconciliation clears creation intent so later edits use the ordinary conflict-protected path. An explicitly classified existing Ammo identity can also receive a missing facet without copying or changing its shared identity; arbitrary reclassification is not supported.

## Verified

Contract/Git fixture tests cover permissions, protected fields, required name, server ID format, unknown values, cross-category identity collisions, concurrent creation conflicts, atomic paired insertion, failed reference update preserving public data, duplicate-free publication retries, subsequent editing and missing-facet creation. Real local SQL verifies saved creation intent is visible to another permitted session and retries retain one version. Existing API/storage, admin and invitation regressions pass. No production calls.

## Next

Batch follow-up: the creation API and Add dialog are now connected in preparation. The server generates the UUID and recovers it by actor-bound receipt after an uncertain response. Category lists include permitted unpublished identities. Browser fixtures verify Add, private save, reload, stats entry and paired publication without stocking vendors. The historical next steps below describe the original PR #28 checkpoint.

Wire server UUID assignment and receipt recovery into an authenticated creation route; include unpublished new identities in the category list; connect the Add dialog and retry flow, then browser-test save/reload/preview/publication. Existing API still accepts existing public identities only. Its change detection and membership checks must explicitly handle creation intent before activation. Then add archive/restore and reviewed old-draft preservation before coordinated rollout. No general Items route removal or PR #22 rollout.
