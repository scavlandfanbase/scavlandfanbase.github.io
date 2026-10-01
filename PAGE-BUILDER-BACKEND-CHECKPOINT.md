# Page Builder backend foundation — 1 October 2026

Status: isolated preparation. No live route, database migration, deployment or Hub enablement. VS owns its local editor branch; this checkpoint does not modify those files.

## Verified repository boundary

The existing r1-private-drafts proposal maps domain pages to content_edit. Admin Hub maps content_edit to Public Content. Neither is a complete Page Builder integration: production.mjs currently routes shared-item, shared-attachment, evidence-review and the legacy Items/Vendors catalogue workflow only. The existing page draft RPC provides load/save revisions, but not page allocation, listing, archive, preview approval or publication. Do not expose it as a complete builder service.

## Implemented and tested

page-request.mjs defines a pure, unused request envelope for domain page-builder: list, load, create, save and archive. Mutations carry UUID request IDs. Saves/archives require positive safe integer expected versions; create has no client-assigned permanent ID. Saving requires payload identity to match pageId. Extra envelope keys, including forged actor/time/permissions/approval/public base, are refused. Results are cloned so the caller's editor buffer remains unchanged, including literal Unknown values.

This boundary does not authenticate callers, authorize access, validate page content, generate IDs, store data, deduplicate retries or publish anything. Those guarantees must be implemented and tested in the following checkpoints. Structured page validation remains the reviewed VS model's responsibility, with server-owned image/address context; an object passing this envelope is not a valid page by itself. Publish/approve/preview are deliberately not defined yet.

Independent verification: node scripts/test-page-request.cjs passes valid commands, every missing required field, protected/unknown envelope fields, unsupported actions, invalid IDs/versions, identity substitution and deep-copy preservation. git diff --check passes. No SQL or browser changes were made, so this checkpoint does not claim production or UI acceptance.

## Next implementation checkpoints

1. Private storage proposal and isolated database tests: immutable page versions, server-assigned allocation bound to actor/request/exact command, request receipts, active head/archive state and retained history. Check current DB content_edit permission for each action, deny direct table access, preserve exact retry results and reject changed-request replay. Define stable lock order for request/page/address reservations; test parallel allocation/save/archive and stale retries. Never repurpose or delete legacy pages drafts.
2. Server content validation: integrate the reviewed Page Builder model without modifying VS's branch. Supply approved asset paths and reserved/existing public addresses from trusted repository state. Creation injects its server ID before model validation. Validate both incoming writes and output; keep invalid historical drafts openable for repair without allowing output.
3. Caller-authenticated transport: separate gated page-builder domain, bounded request sizes, current caller authorization, generic errors, private no-store responses and tested disabled-route refusal. Mutation receipts bind actor and exact command, not user-editable metadata. No service credential in browser code.
4. Preview and publication contract: bind exact revision, rendered digest, approved assets and public Git baseline. Decide the publication authority separately from content_edit; start with Owner authority unless a reviewed granular permission is introduced. Describe self-review explicitly, rather than imposing an undocumented second-person requirement. Distinguish repository commit, pending Pages build and confirmed live publication. Git/database writes are not atomic; reconciliation and retry receipts must cover partial success.
5. Combined integration/release acceptance: preserve VS accessibility behavior, connect the Hub/session flow, test restricted users and disabled controls, then deploy through coordinated backend/database/frontend gates. Rollback disables routes while retaining private versions/history. No placeholder is marked usable before acceptance.

VS can continue its focused local accessibility fixes in parallel. Production permission/storage/publisher code stays in the main backend workstream to avoid conflicting edits.
