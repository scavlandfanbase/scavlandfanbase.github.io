# Shared Attachment review checkpoint — 1 October 2026

Read-only foundation implemented in shared-attachment-review.cjs. Uses the existing attachment-model and canonical Items IDs; no separate Attachment facet file is introduced. Explicit contentType or classification is distinguished from evidence candidates. Invalid or conflicting explicit classifications remain a review state. Names never establish membership. Hidden/archived records are excluded by default and can be included for review. Exact-ID active vendor listings retain their original commercial values. Missing Items references are reported. Inputs and returned views are isolated copies.

Current source snapshot: zero explicitly recorded Attachments, 74 evidence candidates, no orphan canonical vendor Item references. These are review counts, not 74 confirmed Attachments. Nothing is reclassified, saved, verified or published by this module. It is not yet a hosted editor or trusted save payload.

Validation: node scripts/test-shared-attachment-review.cjs and node scripts/test-shared-catalogue.cjs pass. Fixtures cover name-only exclusion, evidence-only candidates, malformed/conflicting classification, inactive records, exact-ID stock joins, independent price/rank/quantity, duplicate identities and mutation isolation. git diff --check passes.

Next implementation: master-only trusted Attachment draft contract; explicit classification/type decisions and creation; attachments_edit permission checked from the authoritative permission profile; category-aware receipt storage and legacy protection; then authenticated review/editor UI, preview and selected-item publication. Resolve permission naming against the current schema before implementation. Compatibility must use recorded Weapon IDs; unknown modifiers remain unknown. Existing Ammo/Armour/Weapons and general Items access remain available.

Production recovery acceptance: the read-only database check confirms Special FMJ Ammo shared draft v1, source Items v20, retained historical verification and a fresh Unverified Ammo decision. Rifle HP Ammo also has a preserved shared draft v1. No publication was performed by these checks.

Page Builder is being developed independently in Copilot. This checkpoint changes no Page Builder, shared CSS/dialogs, production services or public game-data files.
## Explicit classification contract — follow-up

attachment-draft.mjs now prepares a master-only classification decision using the existing authoritative items_edit permission (no attachments_edit permission exists in the current allowlist). Requires authenticated server actor, exact Item confirmation, explicit consent and an allowed Attachment Type, including Unknown. Keeps canonical ID, source, effects and other facts. Classification changes produce an Unverified server-attributed review and retain prior history through the existing Verification model. Repeat identical decisions do not add reviews. Existing Weapon/Armour/Ammo/Blueprint membership is refused until linked-category reconciliation is designed. Malformed classifications and archived records are refused.

This is a pure preparation contract, not durable saving, a hosted endpoint or permission rollout. No production changes. Next: bind this decision to source revision/digest, legacy-work protection and durable preparation/save receipts before exposing controls. Do not accept browser-supplied record/history as trusted input.

Validation: test-attachment-draft, test-shared-attachment-review and test-item-draft pass; git diff --check passes. Fixture tests cover permission/identity refusal, explicit consent, unknown types, immutable provenance, category collision, malformed classification, Unverified attribution and repeated-decision history preservation.

## Revision/source-bound preparation

prepareAttachmentDecision accepts only the explicit decision plus expectedVersion and sourceDigest. Trusted context supplies source, saved version, patch, server actor and existing private/legacy work. Preparation refuses stale saved versions, changed public facts/patch, unavailable legacy inspection, overlapping Items changes and existing shared drafts. Returned preparation binds source and full inspected legacy digest. Browser-supplied record/actor/history is rejected.

Tests passed: test-attachment-draft, test-legacy-item-review and diff whitespace check. This does not yet persist a receipt. The SQL store still accepts only Ammo/Armour/Weapons and requires a separately reviewed master-only payload/save contract. Saving must recheck these bindings transactionally; the production API must load authoritative context before preparation. No schema/backend/frontend deployment or genuine draft change.

## Private classification receipt storage proposal

attachment-classification-storage.sql adds RLS-protected private preparation and first-version storage within the existing private schema. Only service_role can prepare; authenticated save/load requires items_edit and saves the matching actor/item receipt. Saves share the Items catalogue/shared-item advisory locks, reject existing specialist private work, and revoke preparation when the legacy catalogue version changes. Successful response-loss retries return the original version. No public wrapper or live route is added.

Real local PGlite tests pass for save/reload, retry, permission/direct-table denial, missing preparation, competing preparation and changed legacy-version refusal. Attachment contract tests and git diff --check pass. SQL has not been applied to production.

Rollout blockers: add reciprocal Attachment-overlap checks to the existing specialist saver; bind API loading to the Attachment version store and authoritative source; add edit/update receipt support beyond first classification, source/public conflict checks and preview/publication integration. First-classification storage is intentionally limited to version 1. The database cannot independently read GitHub public facts; sourceDigest must be rechecked by the trusted API before preparation and later publication. No claim of cross-service atomicity. Test all combined paths before deploying.

## Reciprocal saved-authority guard

The storage proposal now guards INSERT on both specialist versions and Attachment versions under the existing shared-item advisory transaction lock. Either insertion order refuses a competing saved draft. This also covers future service adapters that insert directly, rather than relying solely on each API checking the other store. Preparation alone does not reserve an item indefinitely. Existing saved Attachment retries still succeed.

Local PGlite checks pass for Attachment-first specialist refusal, specialist-first Attachment refusal through both the save function and direct trusted insertion, and preservation of the first saved draft. These tests exercise both insertion orders sequentially; they are not a multi-connection production concurrency acceptance test. Contract checks and git diff --check pass. Proposal remains unapplied.

Next: subsequent Attachment revisions/edit contract, stable receipt binding and authenticated API integration. Existing specialist editor changes are not deployed by this checkpoint. Publication/legacy migration remain explicit, pending work.

## Subsequent Attachment edit preparation

prepareAttachmentEdit now accepts only recorded shared name/description/notes/image/reference price/max-stack and Attachment Type. It requires trusted Items permission, exact saved identity and expected saved version. Approved image library, nullable text/numbers and integer stack limits are validated. Existing IDs, classification, effects, provenance, original baseline and source/legacy bindings remain intact; changes record an Unverified review using server identity/time, while unchanged edits preserve history.

Fixture edit tests pass for preserved identity/baseline, immutable saved input, stale-version denial, protected ID refusal, image/number validation, permission denial and no-op review preservation. Attachment preparation/storage suites and diff check pass. This preparation does not yet save subsequent versions: the version-1 SQL proposal must be extended and tested before API/UI activation. No deployment.

## Later revisions and request adapter

Storage proposal now retains multiple immutable versions, binds expectedVersion, returns historical receipts without replacing the head, and rejects the second competing save. Real local SQL tests pass through version 3, historical retry and stale competing save.

attachment-api.mjs provides an unregistered, disabled-by-default request adapter for load/prepare/save. Trusted injected authentication must verify the actual session and permission; context loads authoritative source and private records. Browser payload/actor authority is refused. Saves accept a receipt only. Preparation checks public source/patch and legacy overlap before subsequent editing. Receipt lookup must enforce actor/item/command binding; storage adapters are trusted dependencies, not browser inputs.

Request-adapter tests pass with mocked authentication/transport. This is not a live Supabase transport or hosted API. Next: implement public RPC wrappers/transport and receipt lookup with combined SQL/API tests, then authenticated review UI and selected-item preview/publication. No production deployment. Page Builder work remains untouched.
