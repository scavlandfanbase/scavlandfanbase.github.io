# Admin availability release — 1 October 2026

This is the current handoff and supersedes preparation-only production statements in earlier checkpoints. User requested progressing toward all Admin Hub tools being usable and connected.

## Completed this release batch

Applied final production migrations shared_item_private_drafts (20261001072556), shared_item_preview_api (20261001072619), and shared_item_legacy_preservation (20261001072626). All four new private tables have RLS enabled; anon/authenticated have no direct read/write grants. Preparation, preview, legacy reading and preservation RPCs are service-only; authenticated item access performs its own caller/category checks.

Deployed the complete admin-drafts dependency graph as active version 11. Kept SHARED_ITEM_ENABLED disabled by default. Unsigned live smoke checks return 503 for gated shared editing and 401 for existing Items source. Items v20 and Vendors v6 remain unchanged; zero shared versions/snapshots exist. No game data was published, genuine draft imported or frontend merged.

Local browser, Admin/invitation regression, shared SQL/API and dashboard checks pass. Fixtures prove permission denial, save/reload, paired publication, independent vendor values, retries/history and mobile layout; real signed-in acceptance remains pending.

Privately reviewed genuine Items v20 against current local public records pinned to unchanged main. Two Ammo identities contain manual verification differences; Armour has two affected identities, including one supported image change alongside verification. Weapons have no pending differences in the review. Historical decisions are not new attestations and remain protected. Private values were not checked into Git; temporary input was removed.

## Activation awaiting explicit approval

Automatic approval review rejected changing a missing feature flag to an enabled default. No such change was made. Keep the fail-closed default. The concrete next action is enabling SHARED_ITEM_ENABLED=true explicitly in the deployed environment and publishing the coordinated frontend release, followed by real Owner/Admin private save/reload acceptance. Existing publication flags must be checked through the signed-in capability response; they were not exposed or altered. No automatic publication of genuine drafts is part of activation.

If activation fails, explicitly disable SHARED_ITEM_ENABLED; keep all snapshots/drafts and general Items. Do not apply the old independent Ammo PR #22. Final shared schemas were already applied: do not rerun their CREATE statements.

## Remaining batches toward usable Admin Hub

| Area | Current boundary | Next delivery |
| --- | --- | --- |
| Ammo | Connected shared editor prepared; backend/storage deployed, feature gate off | Activate frontend/flag, signed-in acceptance; keep conflicting records protected |
| Items / Vendors | Existing trusted editors retained | Verify real admin publication capability and shared-name propagation; implement genuine listing review |
| Armour / Weapons | Existing specialist routes; shared contract groundwork only | Adapt category fields and receipts to one shared ID; verify public category and vendor joins |
| Attachments | Existing local checkpoint, no full shared Hub integration | Recover reviewed checkpoint, add shared editor/type and compatibility controls |
| Crafting / Blueprints | Existing foundations; Blueprints no separate Hub editor | Connect stable ingredient/output IDs and trusted receipts/publication |
| Evidence / Images | Existing evidence and settings routes; dedicated manager unfinished | Verify granular access, integrate history/evidence; implement dedicated image management |
| Website content / settings | Existing routes; live CMS Owner acceptance outstanding | Check capabilities, private preview and explicit intended publication |
| Page Builder / navigation | Page Builder local review only | Complete trusted hosted persistence/publication before enabling |
| Patch / Admin Users | Existing routes; New Patch remains flag/Owner controlled | Verify current flags and restricted-role behaviour without starting a real patch or sending invitations |

Security advisor shows no new shared-function public-execution warnings. No-policy INFO on the new private tables is intentional: access uses narrowly granted functions. Existing analytics/auth advisories are not resolved by this focused release and must not be represented as a clean project-wide security audit.
