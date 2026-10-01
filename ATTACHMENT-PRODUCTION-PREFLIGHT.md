# Attachment production preflight — 1 October 2026

Read-only checks; no migrations, flags, deployments or public data changed. Snapshot must be repeated immediately before a release.

- Git main: 6f5d9dcdb75785118ee3879e25cfab4ad1fe00c1.
- Copilot branch: 3ce5f1aa4b0bf3fd35ebbe69c55acd5b7320d586; separate and not merged.
- admin-drafts: ACTIVE version 13, deployment hash fbca9bf558c5ab9a43145593d5035ae56975f1b0b93dc2c27274028ed63b1a4a.
- Existing private tables: scavland_drafts prepared/versions/patch_attempts and scavland_item_drafts prepared/versions/previews/legacy_snapshots. All inspected tables have RLS enabled.
- No Attachment tables or public Attachment RPCs were found. Both proposed migrations remain unapplied.
- Existing public has_scavland_permission(text) and scavland_item_legacy() are present. Permission implementation checks auth.uid(), active admin membership, then Owner role or explicit permission. Corrected the prepared Hub gate to match this Owner allowance.
- Aggregate retained draft baseline: legacy 26 version rows, maximum version 20; shared 2 version rows, maximum version 1. These are storage totals, not verification counts or per-item versions. No private record contents or account identities were exported.

Server secret values and feature/publication flag values were not inspected through these tools and are not verified by this snapshot. Signed-in live acceptance, truly concurrent transaction acceptance, final scope review and coordinated deployment approval remain outstanding. See ATTACHMENT-DEPLOYMENT-MANIFEST.md for release order and retained-data recovery.
