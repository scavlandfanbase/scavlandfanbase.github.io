# Reviewer draft preparation — 2 October 2026

Live through approved PR #48, merged at bfae657353a1b944567cc43f41343f7442c3d868.
GitHub Pages run 36977777276 completed successfully on 2 October 2026.

Reviewer defaults: evidence_review, items_edit, weapons_edit, armour_edit,
ammunition_edit and vendors_edit. These cover shared Items and category stats,
Attachments and vendor drafts. Owners can open the same immutable shared saved
versions and preview/publish; saved_by retains the original editor identity.
Existing Admin publishing is retained. Reviewer publishing is always denied,
even if publish_public is accidentally assigned. Disabled accounts remain denied.

Crafting's old editor has no connected private recipe workflow, so crafting_edit
is deliberately withheld from Reviewers until that workflow is implemented.
Site Settings, Public Content, Page Builder and account/patch management are not
expanded by this change. No game data or Page Builder source is changed.

Publication routes now require publish_public in addition to domain editing:
catalogue drafts, shared Items/category stats, Attachments, legacy item/vendor/
specialist publishers and public content/settings. Attachment and category UI
use server capability results; Items/Vendors already use server capabilities.

Verification: Reviewer SQL permissions and shared save/Owner read; accidental
publication permission still denied; disabled account denial; direct draft
publish creates zero writes; category API Reviewer denial; Attachment API and
browser private save/preview with Publish disabled; Admin core/invites/Hub;
real per-item SQL; complete Attachment release suite and legacy record tests.
All pass. Auth/Git remain fixtures; no actual Reviewer login is claimed.

Release order:
1. Apply reviewer-draft-permissions.sql (publication permission only; no editing
   expansion yet).
2. Deploy complete admin-drafts and the five legacy publishing functions
   publish-item, publish-vendor, publish-specialist, publish-site-content,
   publish-site-settings; retain existing JWT configuration and rollout flags.
3. Verify every deployed publisher contains the publication guard.
4. Apply reviewer-draft-activation.sql and deploy manage-admin-users defaults.
5. Release refreshed Hub/category/Attachment assets. Check live role defaults
   and Owner access; genuine Reviewer session acceptance remains separate.

Rollback: withdraw Reviewer editing permissions first, then revert application
code if necessary. Do not remove publication guards while expanded Reviewer
editing remains active. Do not change account roles, create invitees or publish
game facts as part of verification.

Production verification:
- Applied reviewer_publication_boundary, then deployed and read back all publication guards before applying reviewer_draft_activation.
- admin-drafts v19; publish-item v17; publish-vendor v17; publish-specialist v18; publish-site-content v18; publish-site-settings v12; manage-admin-users v10. All deployed source files exactly match the tested release. Existing JWT configuration and rollout flags were retained.
- Live SQL permission function matches the new role boundary. Existing active Owner/Admin retain items_edit and publish_public. No Reviewer accounts currently exist; no account was created or role changed for verification. Genuine Reviewer session acceptance is still outstanding.
- No game facts were published or changed during this release.
