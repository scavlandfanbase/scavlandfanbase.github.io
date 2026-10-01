# Read-only live preflight — 1 October 2026

Combined candidate remains on feature/admin-release-integration / draft PR 39. No production changes were performed. Results are a snapshot; recheck before activation.

## Verified baseline

Fresh fetch confirms origin/main 6f5d9dcdb75785118ee3879e25cfab4ad1fe00c1. Supabase admin-drafts remains ACTIVE version 13 with bundle SHA256 fbca9bf558c5ab9a43145593d5035ae56975f1b0b93dc2c27274028ed63b1a4a. Attachment versions/allocations and Evidence reviews/decision RPC are absent. Attachment prerequisite legacy/shared prepared/version tables and legacy RPC are present.

Evidence submission RLS is enabled. Aggregate counts: 3 pending, 12 approved, 11 rejected (26 total). No submission bodies, screenshot objects, user identities or secret values were inspected/exported. Authenticated users currently have table SELECT/INSERT/UPDATE; no DELETE grant. Anonymous role has INSERT only. No explicit column ACLs or granted-role memberships for anon/authenticated/service_role were found. Column privilege views reflect table UPDATE, not an additional explicit grant.

Submission policies restrict admin SELECT/UPDATE/DELETE by has_scavland_permission('evidence_review'); public INSERT requires pending status and null reviewed_at/review_notes. Preserve the submission/read policies during audited cutover. Existing delete policy does not itself confer the missing DELETE table privilege.

The evidence-submissions bucket is private, maximum 10 MiB, PNG/JPEG/WebP allowed. Storage SELECT policy requires bucket match and is_scavland_admin(); public upload requires the incoming folder. has_scavland_permission reads the active admin_users row by auth.uid and permits Owner or explicit permission. is_scavland_admin checks active membership. Storage policy is broader than the review permission, as an existing boundary; no policy change made. Genuine signed-in screenshot signing remains pending.

## Candidate correction and checks

Prepared Hub Evidence route now permits Owner without an explicit evidence_review entry only when EVIDENCE_REVIEW_RELEASE_ENABLED is true, matching the existing server Owner rule. With the switch off, current navigation is preserved. Combined tests verify Owner enabled/disabled session delivery, granular permissions and independent feature gates. Attachment browser Hub and Evidence actual SQL regressions pass. Readiness query additionally lists explicit column ACLs so a future preflight can detect grants surviving a table-level revoke.

## Coordinated release requirements

1. Review and approve the combined commit and configuration presence without printing secrets; deployed flag/key values are not verified by function metadata.
2. Deploy full combined backend with both new switches disabled and check existing editors.
3. Attachment proposals: classification-storage, preview, then creation-allocation. Stop on partial installation and inspect before retrying; do not rerun CREATE blindly.
4. Arrange Evidence replacement UI/backend cutover, then apply evidence-review-history.sql in that window. It revokes old direct browser UPDATE/DELETE; the old UI cannot moderate afterward.
5. Re-run both readiness queries, compare retained counts and grants, then enable only the reviewed features. Do not casually change shared publishing flags.
6. Verify Owner, permitted and denied accounts, actual screenshot signing, retained drafts/history, retry/conflict behaviour and existing-editor acceptance.

No SQL applied, backend deployed, Pages/main merged, feature enabled or genuine content published. Git/database publication race limitations and Page Builder production dependencies remain as documented.
