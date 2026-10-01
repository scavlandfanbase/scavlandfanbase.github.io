# Connected category release — 1 October 2026

PR #33 merged as cd460b2 and GitHub Pages deployment succeeded. SHARED_ITEM_ENABLED=true was explicitly saved in the project dashboard; missing flags still default to disabled. Unsigned live shared requests now return 401, proving the activated route enforces sign-in. Existing publishing/patch flag digests match the explicit true value; no credentials were read or exported. Current Admin tab is signed out, so real Owner/Admin acceptance is pending.

This batch adapts the shared screen and trusted creation/missing-facet actions to Armour and Weapons. Each category edits its own recorded specialist fields and shared item details. New records get one server-assigned permanent ID, unknown optional facts and pending-review status; no vendor stock is added. Category permissions, draft/review history, old-draft blockers, explicit preview, archive/restore and selected-item paired Git publication remain enforced.

Armour includes type, repair class, ballistic/slash/radiation and durability; review requires evidence at 100% durability. Weapons includes type, tier, existing recorded ammunition label, damage, rate of fire, range, accuracy, recoil, handling, ergonomics and reload. This does not implement attachment compatibility, ammunition identity migration or modifier calculations.

Real local SQL/API fixtures prove Armour and Weapons creation/save/preview/paired publication with denied cross-category callers and unchanged Ammo/vendor data. Headless Edge renders both category forms and proves private stat edits survive reload while public facts stay unchanged. Existing Ammo creation/import/review/archive and Admin regression checks pass. These tests use fixture services, not genuine game facts or production publications.

Backend must precede the coordinated frontend. No new schema migration is required: deployed private storage already supports all three categories. Use the final current dependency graph; retain the explicit shared feature flag and general Items. Genuine legacy verification conflicts stay blocked for review; no automatic import or attestation.

Next batches: attachments and stable compatibility links; Crafting/Blueprint references; genuine Vendor listing review; evidence/images and remaining website tools. Keep live release evidence current and do not describe all Hub sections as finished.
