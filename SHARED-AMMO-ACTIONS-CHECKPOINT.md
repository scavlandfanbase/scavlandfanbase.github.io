# Connected Ammo actions batch — 30 September 2026

Prepared on top of draft PR #28. No production migration, deployment, genuine draft change or game-data publication.

## Completed in this batch

- Authenticated creation route assigns the permanent UUID on the server and recovers the exact identity through an actor/category/command-bound receipt. Add Ammo saves one shared identity and one Ammo facet privately, with unknown stats and pending-review provenance. It does not create vendor listings.
- Permission-filtered category draft listing makes unpublished new identities discoverable after reload or in another permitted session. Existing identities are reused by ID; no name matching or reclassification is performed.
- Missing Ammo details can be explicitly added to an already classified Ammo identity. Shared details are preserved, unknown specialist stats remain unknown, and the selected-item save/preview/publish path is reused.
- Archive/restore saves a private change to the shared identity's visibility. Preview clearly reports visibility; explicit publication hides/restores it through the existing public category and vendor joins. The underlying item, facet, history and stock references remain stored. Archived records remain discoverable in the editor and cannot be edited/reviewed until restored.

Two small implementation commits separate Add/listing from lifecycle/missing-facet controls. All work remains behind the existing unreleased feature gate and proposed SQL.

## Validation

Contract/Git fixture tests pass for paired creation, collisions, duplicate-free retries and subsequent editing. Real local SQL tests prove receipt ownership, immutable saves, another session's access and category-filtered listing. Headless Edge fixtures exercise Add → reload → enter stats → preview → publish, private archive → explicit publish → reload → restore → publish, and retained vendor values and Ammo stats. Public category/vendor join checks confirm an archived stocked item disappears and returns under its retained listing. Existing private review, conflict/legacy overlap, privacy, admin and invitation regression coverage remains passing.

## Remaining before rollout

- Preserve overlapping genuine old Items drafts through a reviewed import/reconciliation workflow; current overlap checks deliberately block affected identities. No genuine drafts have been imported or discarded.
- Review the combined migrations and backend/frontend gate activation, cache versioning and real Owner acceptance before releasing this stack. Independent Ammo PR #22 stays held.
- Extend shared category coverage to Armour, Weapons, Attachments and other required categories before removing the general Items route. Existing identity-only Add is for new Ammo; converting another category requires an explicit future migration.

The live Admin Hub remains unchanged by this batch.
