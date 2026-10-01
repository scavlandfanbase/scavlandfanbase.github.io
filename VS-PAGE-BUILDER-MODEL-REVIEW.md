# Independent Page Builder model review — 1 October 2026

Fetched exact origin/feature/page-builder-local-drafts head c5b19d171ef60a6c4442e90471f06dd723f60295 and exported it to an isolated review copy. No branch switch, merge or modification to VS work. Seven changed files since 3ce5f1a are Page Builder model/contract/editor/service/tests/checkpoint only; no game-data, Attachment, Admin Hub or Supabase change.

Independently passed Page Builder, Items shell, full Items editor, Vendor Builder and Admin/invite suites. Existing non-fatal Node module-type warning remains. Focused source review confirms trusted approved-image/address/identity context, strict per-block fields, server-owned revisions/timestamps, HTML escaping and local-only save/export. Production storage/Auth/approval/publication/recovery remain pending.

One reproduced validation/render gap remains: an image block with image:null and nonempty alt passes Model.validate with approvedImages:[], then renders <img src="/" ...>. Required image blocks should require an actual approved nonempty image reference before save/render/export. Optional card images can remain null and omitted; unrelated Unknown values must not be normalized away. Missing/invalid stored images should still be openable for repair, while save/output remain refused until corrected. This is a broken-output correctness gap, not evidence of arbitrary script execution.

VS follow-up: add focused model/service/renderer regressions for null/empty/missing required image, preserve card null behavior, then rerun the reported suites and update only PAGE-BUILDER-CHECKPOINT.md. Keep changes on its branch, not live. Do not treat passing existing suites as covering this missing case.

## Follow-up verified — ec7bc4e

Independently fetched and reviewed c1d4afc/ec7bc4e against c5b19d1. Only page-builder-model.js, scripts/test-page-builder.cjs and PAGE-BUILDER-CHECKPOINT.md changed. Required image blocks now reject null, empty, omitted and unapproved paths; optional card images still allow null/omission. No Admin, Evidence, Attachment or game-data changes.

The full Page Builder suite passed independently in an isolated archive of ec7bc4e, including model/render/export refusal, service create/save refusal without revision mutation, stored invalid drafts opening for repair, blocked preview/save/export, and successful approved-image repair. The previously reproduced broken root-image defect is resolved. Other regression suites in the VS handoff were reported by VS; this follow-up independently reran the Page Builder suite only. Local-only scope remains; production permissions/storage/publication and combined release acceptance are still pending. No merge or deployment.

## Production plan reviewed — 028054d

Independently fetched and compared the exact checkpoint to ec7bc4e: only PAGE-BUILDER-PRODUCTION-PLAN.md and its checkpoint reference changed. NEXT_JOBS.md and implementation files are unchanged. The proposal correctly keeps local behaviour separate from proposed private storage, permissions, exact-revision approval, publication history, protected addresses and coordinated activation. No new tests were required for this documentation-only checkpoint.

Suitable as a planning foundation, not implementation or activation approval. Before delegating production implementation, align its proposed permission/storage/publication contracts with the existing Admin backend. Avoid treating a pending Pages build as an immediate successful publication; retain separate committed/build-confirmed outcomes and recovery. Do not imply Git and private database state can be updated atomically. Current Attachment publication race limitations must also be considered if a shared publisher is reused.

Main workstream remains combined Attachment/Evidence release integration and regression checks. Page Builder live work waits for a concrete reviewed contract; VS should not choose production permissions, credentials or migrate local drafts independently.

## Accessibility and local CSP review — 052d175

Independently fetched origin/feature/page-builder-local-drafts at 052d1752268496031d090f93a6a70718b4f2083c and compared it with 028054d. Exactly four files changed: page-builder.js, scripts/page-builder-server.cjs, scripts/test-page-builder.cjs and PAGE-BUILDER-CHECKPOINT.md. No Admin Hub, Supabase, game data, Attachment or NEXT_JOBS changes.

The full Page Builder suite passed independently in an isolated archive. Browser launch required the normal sandbox escalation; the rerun passed. Reviewed the trusted stylesheet hash: it is computed from server-owned page-builder.css with normalized newlines, enabled only in Page Builder mode, and does not allow unsafe-inline. Validation repair focus and failed-save recovery have regression coverage. Other suites in this handoff are VS-reported, not independently rerun for this isolated four-file change.

Two remaining accessibility consistency cases should receive focused follow-up: the local duplicate-draft address branch focuses the address but bypasses aria-invalid/describedby setup; automatic preview validation uses its own preview-error path, so it does not establish the same repair-field association. Automatic preview updates should not steal focus while typing. These do not prevent local model validation or make live publication available. No screen-reader audit, actual browser zoom certification, merge, deployment or production activation is claimed.

Next production work remains a reviewed contract for granular page permissions, private revision storage, approved assets and publication receipts. Do not enable the local filesystem service for live admins.

## Accessibility follow-up independently verified — e8ad5a6

Fetched exact pushed head e8ad5a68298cd2adf9e12d8ea20548d7d4095cde and compared with 052d175. Only page-builder.js, scripts/test-page-builder.cjs and PAGE-BUILDER-CHECKPOINT.md changed. The full Page Builder suite passed independently in an isolated archive, including duplicate-address association/correction, preserved original descriptions, automatic preview error association without focus movement, unchanged-error deduplication, repair and explicit Save/Export repair focus. The two previously recorded consistency gaps are resolved by this checkpoint. No full assistive-technology audit or production acceptance is claimed.

Use e8ad5a6 as the reviewed editor checkpoint for backend integration. The pure model was unchanged by this follow-up; main workstream retains ownership of private storage, authenticated transport, approved source context and publication recovery. No VS branch edits, merge, migration, deployment or live activation performed during this review. Independent private page storage preparation remains recorded in PAGE-BUILDER-BACKEND-CHECKPOINT.md.

## Documentation-only follow-up — 33e0950

Fetched 33e0950588ae3ca6beb73651d3c505cc5f2b9d04 and compared with independently tested e8ad5a6. Only six lines of PAGE-BUILDER-CHECKPOINT.md differ, clarifying editor-owned ARIA cleanup and test descriptions. No implementation or test changes; no rerun was needed. The e8ad5a6 independent Page Builder result remains applicable. Version-history demonstration work is not included in this checkpoint and is still VS's next assigned task. Backend integration remains on the separate main workstream.

## Fixture history review — b54e181

Independently fetched exact origin/feature/page-builder-local-drafts head b54e18143797fce72bca3d34204df20963ae884b and compared with 33e0950. Five files changed: Page Builder HTML/JS/CSS, its browser tests and checkpoint. No local storage/service/model, Admin Hub, Supabase, game data or NEXT_JOBS edits. Full Page Builder suite passed independently in an isolated archive, including history fixtures, loading/empty/failure/retry, unsaved-buffer preservation, selected revisions, keyboard/focus and narrow layout. No live integration occurred.

One reproduced correctness gap remains: historyValidationContext overwrites the cloned historical page id and slug with generated demonstration values before model validation/rendering. A malformed identity (../invalid) and reserved address (admin) are refused by the original model, but pass after this replacement. This can mask invalid saved metadata and means the inspected revision is not validated intact. Unsafe links and unapproved images still refuse as reported; no arbitrary-script execution was demonstrated.

VS follow-up should preserve original historical identity/address, use a separate fixture validation context without mixing active-draft collisions, and avoid treating historic address reuse as new allocation. Malformed/protected historical metadata must remain blocked with repair messaging. Add targeted regressions for invalid identity/reserved address and for historical slug differing from the active draft while preserving the editor buffer. Existing model/service/backend files remain outside VS scope. Backend reviewed renderer/model snapshots are unchanged by this UI-only work; history will not be connected live until corrected and reverified.
