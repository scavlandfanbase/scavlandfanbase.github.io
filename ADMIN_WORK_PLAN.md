# Admin Hub working plan — 29 September 2026

Recovered from the saved 23 September SCAVLAND master plan (Core Char Meaning), local checkpoint branches and dated acceptance/publication reports. This is a roadmap reconciliation, not a claim that every planned tool is live.

## Intended system

A maintenance dashboard shows the current patch, verification progress and records needing review. Shared visual editors use ordinary fields, images, evidence, explicit verification and private Save Draft / Preview / Publish. Canonical Items feed Vendor listings and later tools; price/rank/stock stay independent for each Vendor. Preserve history, unknown values, stable IDs, privacy, mobile and keyboard access.

## Completed versus local work

- Admin 0.1 frontend, Items/Vendors/inventory, patch foundation and shared components are on main. Admin 0.2 usability and Vendor 0.2B layout are also on main.
- The dated 27 September authenticated acceptance report records 24 passing assertions using two real Owner sessions, durable drafts, server-controlled verification, privacy, stale/forgery rejection and patch reads. It did not use a separate non-Owner account, publish content or change the real patch. This resolves the earlier historical acceptance blocker; it is not a fresh certification of today's production workflow.
- The 28 September Stage 1 release report records approved Vendor draft v6 publication: 22 Vendors, 224 canonical listings and 255 retained legacy rows. The public duplicate-table issue was subsequently fixed on main (`864a479`). Current review still identifies 31 legacy classification-review rows.
- Ammo 10B is locally committed at `bcf5900` and Attachment 11A at `706a959` in the existing development checkout. The current Hub already contains an older Ammunition form wired to the retired legacy publisher; it displays damage but does not implement the private draft workflow. The prepared Ammo integration adapts 10B to trusted durable storage and replaces that Hub route. It is not live until the coordinated SQL/backend/frontend release is completed. Preserve the Attachment checkpoint rather than starting again.
- Original stale Items recovery commit `9cf3631` remained local. Current recovery review repairs its missing trusted preparation receipt and adds database/browser acceptance before any deployment.

## Next small checkpoints

1. Items stale-draft recovery is released through PRs #19–#21. Owner screenshots on 29 September confirm explicit Unverified review, successful saved refresh, and preview of the retained Special FMJ Ammo full-stop edit. This is refresh/preview acceptance, not evidence of Owner publication.
2. Ammo integration is prepared and tested: damage/penetration details, private receipt-backed actions, preserved history and Ammo-only preview/publication. Release requires the additive `ammo-trusted-drafts.sql` proposal, updated admin-drafts function and frontend together. Never rerun the original trusted-drafts migration. Keep Owner and restricted-Admin checks explicit; real Owner Ammo acceptance remains pending.
3. After Ammo release/acceptance, continue full Attachment 11B. Verify integration boundaries before starting each task.
4. Weapons, explicit compatibility and attachment modifiers; then public Weapon Builder/mobile/share.
5. Crafting, Blueprints, Evidence Centre, Image Manager and Navigation; broader Page Builder/site-wide publication and readable revision/history/rollback follow their reviewed foundations.

Public Content CMS Owner publication acceptance is a separate remaining check, not a replacement for the Admin editor roadmap. Genuine Vendor listing verification needs its own trusted backend action. Do not silently resolve the 31 classifications, infer game facts, overwrite other work or repeat completed Vendor foundations.

Use one small controlled task/commit at a time, update status after changes and distinguish local tests, real authenticated acceptance, publication and deployment. Production release approval remains separate from preparation/review.
