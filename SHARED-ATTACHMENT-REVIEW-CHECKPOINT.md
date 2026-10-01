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
