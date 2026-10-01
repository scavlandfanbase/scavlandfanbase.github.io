# Independent Page Builder model review — 1 October 2026

Fetched exact origin/feature/page-builder-local-drafts head c5b19d171ef60a6c4442e90471f06dd723f60295 and exported it to an isolated review copy. No branch switch, merge or modification to VS work. Seven changed files since 3ce5f1a are Page Builder model/contract/editor/service/tests/checkpoint only; no game-data, Attachment, Admin Hub or Supabase change.

Independently passed Page Builder, Items shell, full Items editor, Vendor Builder and Admin/invite suites. Existing non-fatal Node module-type warning remains. Focused source review confirms trusted approved-image/address/identity context, strict per-block fields, server-owned revisions/timestamps, HTML escaping and local-only save/export. Production storage/Auth/approval/publication/recovery remain pending.

One reproduced validation/render gap remains: an image block with image:null and nonempty alt passes Model.validate with approvedImages:[], then renders <img src="/" ...>. Required image blocks should require an actual approved nonempty image reference before save/render/export. Optional card images can remain null and omitted; unrelated Unknown values must not be normalized away. Missing/invalid stored images should still be openable for repair, while save/output remain refused until corrected. This is a broken-output correctness gap, not evidence of arbitrary script execution.

VS follow-up: add focused model/service/renderer regressions for null/empty/missing required image, preserve card null behavior, then rerun the reported suites and update only PAGE-BUILDER-CHECKPOINT.md. Keep changes on its branch, not live. Do not treat passing existing suites as covering this missing case.
