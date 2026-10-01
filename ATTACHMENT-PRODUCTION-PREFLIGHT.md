# Attachment production preflight — 1 October 2026

Read-only checks; no migrations, flags, deployments or public data changed. Snapshot must be repeated immediately before a release.

- Git main: 6f5d9dcdb75785118ee3879e25cfab4ad1fe00c1.
- Copilot branch: 3ce5f1aa4b0bf3fd35ebbe69c55acd5b7320d586; separate and not merged.
- admin-drafts: ACTIVE version 13, deployment hash fbca9bf558c5ab9a43145593d5035ae56975f1b0b93dc2c27274028ed63b1a4a.
- Existing private tables: scavland_drafts prepared/versions/patch_attempts and scavland_item_drafts prepared/versions/previews/legacy_snapshots. All inspected tables have RLS enabled.
- No Attachment tables or public Attachment RPCs were found. All three proposed migrations remain unapplied.
- Existing public has_scavland_permission(text) and scavland_item_legacy() are present. Permission implementation checks auth.uid(), active admin membership, then Owner role or explicit permission. Corrected the prepared Hub gate to match this Owner allowance.
- Aggregate retained draft baseline: legacy 26 version rows, maximum version 20; shared 2 version rows, maximum version 1. These are storage totals, not verification counts or per-item versions. No private record contents or account identities were exported.

Server secret values and feature/publication flag values were not inspected through these tools and are not verified by this snapshot. Signed-in live acceptance, truly concurrent transaction acceptance, final scope review and coordinated deployment approval remain outstanding. See ATTACHMENT-DEPLOYMENT-MANIFEST.md for release order and retained-data recovery.

## 2026-10-01 — Repeatable Attachment database readiness

Added read-only supabase/proposals/attachment-readiness.sql. It reports exact prerequisite identities, four expected private tables and their RLS/direct access, six RPC signatures and role execution rights, and four overlap/allocation triggers. It returns no private draft contents, account identities or secrets. Missing objects are reported safely; the inventory does not authorize activation.

Executed against production: all six prerequisites present; all four Attachment tables, six RPCs and four triggers absent. Existing seven private tables retain RLS. Aggregate versions remain legacy 26/max 20 and shared 2/max 1. admin-drafts remains ACTIVE v13 with the previously recorded hash. Configuration values, real concurrency and signed-in acceptance remain outstanding.

Verified the same SQL against the local installed proposal fixture with the storage suite: table access restrictions, RLS, RPC role grants and trigger activation pass. The fixture mocks rather than installs scavland_item_legacy; the inventory correctly reports that missing dependency. No migrations, deployment, flags or game data changed.
