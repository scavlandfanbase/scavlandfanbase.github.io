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

## Supabase transport and combined SQL/API validation

attachment-transport.mjs verifies the session through Auth, checks authoritative items_edit permission, loads source and private/legacy context, and calls the proposed public RPC wrappers. Service-role keys are confined to trusted preparation/receipt calls; browser-authenticated save/load uses the actual session. Public specialist links block classification even when stored classification is incomplete. The separate SHARED_ATTACHMENT_ENABLED flag defaults disabled. No production routing is added.

SQL receipt lookup now binds actor, item and exact command. Public preparation/lookup wrappers are service-only; save/load wrapper is authenticated and rechecks permission. Combined PGlite/request/transport tests pass classification, private save/reload, changed-command receipt refusal and a subsequent edit/save; public source remains unchanged. Database execution is real local SQL, Auth/Git source are fixtures. Existing SQL conflict tests pass. No migration/deployment.

Next substantial checkpoint: authenticated Attachment review/editor UI, selected master-only preview/publication planning and compatibility with legacy/newly saved specialist work. Review transport/source integration and grants before wiring production routing. Real production concurrency/Owner acceptance remains pending. Existing receipt histories must be preserved; no manual candidate conversion without explicit administrator decision.

## Master-only publication planning

attachment-publication.mjs prepares exactly data/items.json for a saved Attachment decision. Checks Items permission, stable identity, patch/source baseline binding, legacy overlap and specialist links. Only approved changed fields can be applied. Three-way field comparison preserves disjoint concurrent public changes and refuses same-field conflicts. Visibility changes stop the plan. Public verification contains the existing reduced summary; actor/history remains private. Vendor JSON is not written. Identical already-public retries remain compatible.

Tests pass for selected output, unchanged inputs/unrelated Items, omitted private actor/history, disjoint edits, already-public retries, permission denial, category conflicts, specialist links and protected effect changes. Combined Attachment SQL/transport tests still pass. This is a preview/publication planner only; Git publication, version-bound preview intent and UI remain pending. No live publication/deployment.

## Saved-preview intent proposal

attachment-preview.sql adds private service-only preview intents bound to actor, selected Item, saved Attachment version and 64-character output digest. Intents expire after 30 minutes; stale saved versions stop lookup and creation. Browser roles cannot call preparation or read the table. The trusted publish handler must reauthenticate, recheck permissions, regenerate the plan and compare its digest before publishing; this proposal alone does not authorize Git writes.

Real local SQL tests pass valid lookup, wrong actor, stale version, malformed digest, browser denial and expired intent. Existing combined transport/storage and master-only publication-planner tests pass. No production migration or route activation. Next: connect these intents to preview/publish requests and trusted Git publication, then the category UI and coordinated release checks.

## Trusted Git publication adapter preparation

createAttachmentPublisher now reuses the existing non-force Git tree/commit/ref adapter with one fixed output path. It rechecks current saved version/payload and permission, plans against latest public Items, then checks fresh context and the stored preview output digest immediately before Git writes. Preview reads only. Missing/expired intents, stale versions and revoked permission refuse writes. No browser controls repository/path/token.

Fixture Git tests pass preview with zero writes, missing preview refusal, exact output publication via tree/commit/non-force ref, and stale/revoked refusal with zero writes. Real local SQL/transport/preview suites remain passing. No real Git publication occurs in tests. Cross-service changes after the final check are not transactionally locked; production integration must preserve existing race disclosure and conflict handling.

Remaining: wire preview/publish actions and service intent callbacks into the authenticated transport, add explicit publish flag/confirmation checks and UI; verify retries/recovery after publication, then coordinated migration/backend/frontend release review. Adapter is unregistered and no production services changed.

## Preview/publish request integration

Attachment API/transport now accept saved-version preview and explicit-confirmation publish. Publication requires ADMIN_CORE_ENABLED and DRAFT_PUBLISH_ENABLED, rechecked in fresh context along with Auth and items_edit permission. Preview stores the exact output digest in the private intent RPC; publishing looks up the bound intent and delegates to the fixed-path non-force adapter. Browser payloads cannot supply publication content or credentials.

Tests pass for API flag/confirmation refusal, allowed mocked handler dispatch, transport preview through real local SQL intent storage and fixture Git reads, existing SQL version/conflict cases and Git planner/adapter checks. Actual Git write integration remains fixture-only; no live publication. Production routing, source-reader integration, CORS/UI, post-publication recovery and release acceptance remain pending. Do not deploy this draft yet.

## Review interface and post-publication recovery batch

attachment-category.html/js/css now provide an isolated candidate list/search, explicit type/classification confirmation, private shared-field editing, receipt-preserving retries, saved preview and explicit publication confirmation. Session handoff accepts only same-origin parent messages and keeps the token in memory. Text uses textContent; styles are scoped to the Attachment editor. Dirty/pending work gets navigation protection. No Page Builder files or live Hub route changed.

Authenticated list RPC exposes the latest private Attachment rows only to items_edit; transport combines their names with explicit/candidate public records without inferring membership. Existing specialist links remain blocked. The screen is not usable in production until shared-attachment routing/source integration and the proposed migrations are released.

reconcileAttachment now adopts confirmed public fields before a later edit, keeps prior baselines privately and retains private verification history. Disjoint public changes are retained; conflicting changes or patch shifts refuse the next edit. Tests cover a second edit after publication.

Validation: real Edge browser with fixture endpoint passes parent token handoff, candidate Scope choice, private classification/save/reload, shared rename, preview and explicit publish, plus 390/1280px widths and no page errors. Separate real local SQL tests and classification/API/publication suites pass. Browser transport/Auth/Git publication remain fixtures. No production publication/migration/deployment occurred.

Remaining release work: integrate pinned Git source reading and production routing with feature flags disabled; add cache/Hub permission routing, CORS and mixed-editor checks; expand browser error/retry/permission cases; review schema/transport and migration order; refresh production state and perform controlled Owner acceptance. Add-new, images, verification decisions, archive/restore and compatibility are not implemented in this initial Attachment screen. Keep the old Items route available. Do not claim full Attachment coverage or deploy draft PR #37 yet.

## Disabled production routing and pinned source preparation

production.mjs now dispatches shared-attachment requests to its dedicated transport. Missing/false SHARED_ATTACHMENT_ENABLED refuses the route before Auth/RPC/Git requests. attachment-source.mjs loads Items, specialist links, Vendors, patch and approved images from one pinned main commit; no browser-supplied source path/branch is accepted. Attachment responses include the existing site CORS origin; outer OPTIONS handling remains shared.

test-attachment-routing passes pinned source/file count, approved images, disabled-default zero-network refusal and CORS. Attachment API and real local SQL suites pass; npm test (Admin/invites) passes after the shared production-handler change. No production deployment or flag changes. Earlier unregistered-route descriptions are historical.

Copilot Page Builder branch/commits are not available in this local repository's branch list. Its reported completion remains unverified here; do not merge or alter its work based on the pasted report. Attachment changes touch no Page Builder files.

Next: complete Hub/cache integration in preparation, broader browser failure/retry and permission acceptance, schema/receipt review and release manifest. Remaining Add/image/review/archive controls must stay accurately documented; no release yet.

## Browser failure/recovery checks

Browser fixture tests now save a version then simulate a lost response; Retry reuses the original receipt with no duplicate version or extra preparation. Permission-denied saves preserve form entries and disable publication until a permitted retry succeeds. Review saved state now explicitly confirms discarding local unsaved/retry entries, reloads the authoritative saved version and leaves server history intact. Browser checks pass those paths along with existing classification/edit/preview/publish and mobile layout fixtures; diff whitespace check passes. No production calls.

Next: remaining Attachment image/review/lifecycle controls and Hub/cache integration, then schema/security and coordinated release review. Page Builder unchanged. Still preparation only.

## Image, review and lifecycle controls

Attachment controls now expose approved-library image selection, explicit Verified/Unverified decisions for the current patch, and private archive/restore. Trusted actions require items_edit, exact identity and current saved version. Review retains server-attributed history; archived items refuse edit/review until restored. Image updates use the validated library; unchanged historical images need not be resubmitted. Archived explicit/private Attachments remain reachable in the review list for restoration. Master-only publication supports the explicit archive field while retaining conflict checks and vendor references.

Focused contract tests pass current-patch review, wrong-patch/identity denial and archive/restore fact preservation. Edge fixtures pass image save/reload, explicit verification, archived editing disabled, restoration and existing retry/preview/publication flows. SQL/storage and publication suites pass; whitespace checks pass. No production changes. Add-new/compatibility, Hub/cache integration and full release review remain outstanding.

## Hub status and parallel Page Builder handoff

Draft Hub card now accurately marks Attachments as prepared with Release pending disabled; no new navigable editor route is enabled. Admin npm tests and whitespace checks pass. This is preparation status only, not availability.

Copilot reports Page Builder commits 45f6426, 2997a7f, d1c1b4d and 014cee1 on feature/page-builder-local-drafts, with local preview at port 4181 and broader browser checks passing. Its reported Items count assertion update passes, but a hidden-item fixture assertion remains failing. These are reported results, not independently verified here: branch is absent locally. Do not treat that remaining suite as fully passing or weaken visibility protection to satisfy the fixture. Page Builder files were not changed by this checkpoint.

Next: review complete Attachment schema/receipt/publication paths and remaining Add/compatibility scope before enabling Hub navigation. Coordinate actual Page Builder branch integration only when its commits are available. No deployment.


## Release review fix
Repeated public reconciliation now preserves private verification history; divergent public verification requires review. Regression and restricted-permission tests pass. See ATTACHMENT-RELEASE-REVIEW.md for verified evidence and remaining release gates. No deployment.

