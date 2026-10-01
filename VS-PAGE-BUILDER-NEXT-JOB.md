Continue on feature/page-builder-local-drafts. Prepare a reusable server-side Page Builder validation/public-output model for later production integration, keeping Save Draft/Export local-only.

Inspect PAGE-BUILDER-CHECKPOINT.md and branch status first. Preserve work; no reset, automatic main merge, deployment or live enablement.

Validate metadata, stable section/block identities, supported layouts/types, existing limits, unique safe addresses, approved images and safe links. Plain text only; reject unknown/protected/malformed fields. Preserve existing IDs/Unknown values. Pass approved images and existing addresses as trusted context. Browser roles, approval, reviewer identity/time and revision authority are not trusted fields.

Keep validation separate from filesystem storage, authentication and publication. Reuse it in the local service where appropriate. Preserve stale revisions, failed-save recovery, focus, hidden-content exclusion and preview/export parity. Test malformed input, duplicate IDs, unsafe links/images, absent trusted context, limits and unchanged valid drafts.

Touch only Page Builder model/service/tests and PAGE-BUILDER-CHECKPOINT.md. Do not edit admin.html, admin-dashboard.js, Supabase, item/category/vendor editors, game data, Attachment files or shared release docs. Run Page Builder and relevant regressions, make small commits, push this branch only, then report hashes/files/results and remaining production gates. Do not merge or publish.
