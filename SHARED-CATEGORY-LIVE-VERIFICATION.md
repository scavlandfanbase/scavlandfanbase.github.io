# Category release verification — 1 October 2026

PR #34 was explicitly approved by the user and merged as `739ba51127ede2be0371d0bc19de65962a72042f`. GitHub Pages deployment succeeded. Live admin.html contains both new category routes; armour-category.html and weapons-category.html return HTTP 200 with their correct category settings. admin-drafts v12 remains active. SHARED_ITEM_ENABLED was explicitly enabled; the absent-flag default remains disabled.

This supersedes the earlier blocked merge and pending frontend notes. Ammo, Armour and Weapons now have hosted shared editors with authenticated category access, private per-item receipts, explicit review, paired publication, creation and archive/restore. Their real signed-in acceptance is still pending: the current browser tab was signed out. No genuine item facts were changed, private work imported or public game data published during release verification. Existing Items v20 and Vendors v6 are intact; shared version count remains zero.

Repeated local Hub owner/restricted/denied navigation and selected-item publication contract checks pass. These are fixture checks. A real account should now sign in, open each category and confirm load/private save/reload before any deliberately intended public publication.

## Next Attachment checkpoint

Public Items contain zero explicitly recorded Attachments and 74 evidence candidates; there are also zero explicitly recorded Blueprints. Evidence paths are review aids, not authoritative classification. The existing attachment-model and Items classification/property/evidence controls are retained. A full shared Attachment editor needs a master-only category contract, category-aware storage access and explicit creation/classification/review controls before replacing the placeholder. Do not manufacture an Attachment facet file or silently convert the 74 candidates.

Use stable Items identity for Attachments and vendor references. Compatibility links must reference explicit recorded weapon IDs; unknown compatibility/modifiers remain unknown. Preserve legacy source, private history and unrelated pending Items work. Follow with Crafting/Blueprint identity links and remaining Admin tools listed in ADMIN-AVAILABILITY-RELEASE.md.
