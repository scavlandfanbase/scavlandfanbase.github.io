# Evidence Review backend checkpoint — 1 October 2026

Branch feature/evidence-review-backend is an isolated worktree based on main 6f5d9dc. Attachment PR #37 and the VS Page Builder branch are untouched. This is preparation, not live availability.

Read-only production inspection confirms evidence_submissions has UUID identity, pending/approved/rejected status, reviewed_at/review_notes and retained submission text/screenshot fields. The current browser moderates with direct PATCH and offers permanent rejected-row deletion. Existing evidence_review permission policies remain the live foundation.

Prepared evidence-review-history.sql adds private immutable review revisions, server auth.uid()/clock_timestamp identity/time, retained previous review timestamps/notes, caller permission checks, request-bound exact retries, revision+status conflicts (including status returning to pending), restore-to-pending, and consistent locked state/history reads. It preserves submission facts/images and never marks a game item Verified or publishes content. No deletion action exists. Direct browser UPDATE/DELETE is revoked by the unapplied proposal, so this requires coordinated replacement UI/backend rollout. Public submission/read policies are preserved. Privileged service writes remain an operational boundary, not an assertion of universal audit enforcement.

Prepared evidence-api.mjs accepts load/decide only, passes the actual caller JWT to the permission-enforcing RPCs using the anon key, rejects browser actor/time/roles/payload, returns generic errors, and remains gated by EVIDENCE_REVIEW_ENABLED. It is deliberately not registered in production.mjs yet.

Passed: test-evidence-review-storage.cjs with actual PGlite SQL proposals, and test-evidence-review-api.cjs. They cover permission denial, revoked direct write/delete/table access, trusted actor/time, retained source evidence, retry after later reviews, changed request, stale status/revision, restore, limits, protected input and permission/conflict/lost-response responses. These are local tests; actual simultaneous Postgres and live signed-in acceptance remain future checks.

Next: combined adapter/SQL acceptance, paginated permission-gated listing, isolated review UI with recoverable same-request retry and visible history, disabled Hub route and deployment/readiness review. Preserve existing read/submission behavior. Do not apply the SQL before replacing the old UI; do not remove submissions, upload fixtures, alter game facts or enable the live feature.

Current Supabase functions guidance was consulted: https://supabase.com/docs/guides/database/functions. Changelog markdown fetch was unsupported; HTML https://supabase.com/changelog was reviewed. No relevant changes require a new dependency for these ordinary SQL RPCs.
