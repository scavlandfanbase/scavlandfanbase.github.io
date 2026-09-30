# Connected category editors — 30 September 2026

This supersedes the separate Ammo rollout in draft PR #22. That PR must not be deployed as the final category-editor design. No production migration, backend deployment or frontend merge from #22 has occurred.

## User behaviour

Category cards replace the general Items editing card: Weapons, Armour, Ammo, Attachments and ordinary-item categories. Each editor shows the same item's shared details plus its own specialist facts. Edit once, save a private item draft, preview where it is used, then publish that reviewed item. Every linked public category view and vendor listing resolves the same identity. New items are not automatically stocked by vendors.

Vendor price, unlock rank, quantity, display order and stock-review evidence remain vendor-specific. Estimated item price is a separate general reference value. Categories are views, not independent item copies. Classification uncertainty gets a review queue; evidence filenames and similar names cannot silently establish membership or links.

## Verified current starting point

Source snapshot: main `98d121a` (the existing recovery release).

- 285 Items; all 13 Ammo, 31 Armour and 39 Weapon records link to Items by exact ID.
- All 224 canonical Vendor listings reference existing Items. The retained legacy stock rows and 31 classification-review rows are not migrated by this checkpoint.
- Current public specialist resolver already reads the canonical name and an image fallback. Vendor canonical renderer resolves current Items by ID. This is partial linkage, not complete connected editing.
- Shared-field disagreements include two Ammo estimated prices: high-caliber AP (Items 500, Ammo 300), rifle AP (Items 400, Ammo 240); two Weapon names differ for the long PM 12-70 variants. Thirty Weapon image values differ. These are review findings, not authority to replace source values.
- Specialist descriptions or other fields absent from Items must be preserved. Null is an explicitly unknown value; an absent field is different. Public image fallbacks and existing evidence references must not be erased during migration.
- Trusted current drafts are whole catalogues, not per-item. Hiding Items in navigation alone cannot implement the requested publishing behaviour.

## Data ownership

Items identity is the master ID. Shared name/image/description/notes/general estimated price/stack fields/effects have one authoritative record after reviewed reconciliation. Specialist facets reference that same ID and retain type-specific stats, categories, provenance and review evidence. Existing public JSON files can remain generated outputs for compatibility; they must not remain competing editable authorities. Shared fields that do not apply to a specialist output must not be inserted merely to mirror other files.

The read-only `shared-catalogue.js` foundation reports exact links, shared-field omissions and disagreements without merging facts or modifying sources. Its output is not a trusted save payload and is not wired into production in this checkpoint. It keeps provenance/verification objects separate so inherited evidence never becomes a new verification decision.

## Controlled implementation checkpoints

1. **Prepared:** identity/resolver foundation, current links/conflicts verified, explicit ownership and publishing contract. No live data changes.
2. **Prepared/tested contract:** per-item trusted storage proposal and atomic linked publication planner are documented in `SHARED-ITEM-DRAFT-CHECKPOINT.md`. A category edit writes the master shared fields and appropriate specialist facet together. Unrelated item drafts remain untouched; conflicts stop publication. The next checkpoint must wire real authenticated API operations, current legacy-draft checks and preview/version intent before rollout. Existing draft migration remains explicit and pending. Changes to reviewed facts invalidate the appropriate attestation using server identity/time; vendor price/stock changes invalidate only vendor-stock review.
3. Integrate Ammo as the first category using that shared contract, including read/edit/add/reload, usage preview and per-item publication. Reuse the recovered 10B controls where useful, not its independent catalogue storage. Apply the same contract to Armour/Weapons and ordinary-item categories in separate checkpoints. Remove the general Items card when all its records have an accessible category/review route.
4. Reconcile duplicate shared values explicitly. Preserve unresolved alternatives as review context; do not pick game facts automatically. Keep public category/vendor output connected through exact IDs and verify existing legacy rendering separately.
5. Coordinate reviewed SQL/backend/frontend rollout, then real Owner acceptance. Confirm that an intended shared edit from a category reaches that public category and every stocking vendor, specialist stats remain intact, and vendor price/rank/quantity remain unchanged. Test concurrent edits, conflict recovery and unrelated drafts before rollout.

Permission checks remain server-side and category-aware. Access to Armour must not grant edits to unrelated Ammo/Weapons records. Shared fields edited through an allowed category require server validation of that item's membership. No client-supplied verification actor, history or arbitrary catalogue snapshots are accepted.

The next backend checkpoint must define migration of existing Items/Vendor drafts before activation; no genuine saved edits may be overwritten or silently published.
