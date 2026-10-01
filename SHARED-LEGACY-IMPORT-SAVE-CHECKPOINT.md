# Private legacy import bridge — 1 October 2026

Prepared on top of draft PR #31. No production calls, genuine draft imports, migrations, merges or deployment occurred.

The existing Items-work report now offers explicit **Import privately** for uncontested supported work. Review intent binds selected identity/revision, immutable source version/digest, current public identity/facets/patch digest and per-item saved version. Trusted preparation preserves the complete legacy snapshot before creating an actor-bound receipt. Save validates that receipt and the current public baseline; SQL requires the preserved snapshot to match the exact latest legacy row. Save and preservation use the same `items:catalogue` advisory lock as legacy writes. Idempotent retries return the existing immutable version.

Durable acknowledgement is the server-prepared `legacyTransfer` context in the saved per-item version. The API accepts that acknowledgement only when its version and full trusted legacy digest match the latest legacy source. The planner receives no legacy exclusion for other identities. A newer legacy version restores overlap protection. Fresh legacy checks are repeated before Git publication. Browser commands cannot supply a transfer payload or alter historical records.

Import saves privately and clears prior publication preview. Ordinary per-item preview and explicit Publish remain required. Historical review metadata and internal context are retained privately, never promoted to a new verification or emitted in public JSON. Unsupported public-field changes and conflicts stay blocked and require separate review. The old catalogue and unrelated item drafts stay intact.

## Validation

Real local SQL/API fixtures cover preparation, private save, immutable snapshot validation, actor-bound receipt retry, saved acknowledgement, revocation by a newer legacy version, explicit preview/publication of both linked records and unchanged vendor data. Headless Edge verifies Import privately from the blocked editor into the ordinary edit form. Existing Add/reload/retry, private review, archive/restore, public visibility, privacy, contract and admin/invitation regressions pass. All Auth/Git transports are fixtures; no real game facts or genuine drafts were modified.

## Next

Review the complete migration and PR stack, regenerate the rollout manifest, inspect fresh production schema/flags and the genuine latest draft privately, and prepare a concrete coordinated rollout. Manual/conflicting fields still require explicit decisions; no automatic conversion of legacy-only identities or classification/visibility changes. Keep general Items available and PR #22 held. Live Owner import/publication acceptance remains pending.

Git and database changes are separate transactions. Save is private and version-protected; publication rechecks current saved/legacy versions before the Git write. An external change after that check cannot be made atomic across the two services and requires subsequent review; do not describe this as a cross-service transaction.
