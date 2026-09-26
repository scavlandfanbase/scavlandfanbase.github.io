# R1 — production persistence foundation

Status: implemented and tested locally; **NOT deployed**. No canonical editor is connected. No production data or existing persistence/security mechanism has changed.

## Architecture and scope

Editor → authenticated draft endpoint → private PostgreSQL immutable revisions → validated preview → explicitly confirmed Publish → version-checked GitHub commit.

One SQL store, RPC, endpoint and browser adapter serve all domains. Attachments use `domain: "items"` and the existing Item ID: classification does not create a parallel Attachment draft. Supported domains and existing permission requirements:

| Domain | Existing permission | Identity guidance for R2 |
|---|---|---|
| items (including Attachments) | items_edit | Stable canonical Item ID |
| ammo | ammunition_edit | Stable canonical Ammo ID |
| vendors | vendors_edit | Stable canonical Vendor ID |
| vendor-inventory | vendors_edit | Stable listing/aggregate ID; choose the existing editor's save unit in R2 |
| pages | content_edit | Stable page ID, independent of address/name |

Drafts are shared among authenticated users with that domain's existing permission. Owner access follows the existing helper. Reviewer/inactive/non-allowlisted accounts gain no new permission. A draft is not per-device or per-browser. No new role or permission vocabulary is introduced.

The R1 payload contract is a JSON object, preserving unknown fields, nulls, text expressions and numeric values without normalization. It permits existing editor aggregate shapes as well as individual records; R2 must select and document a consistent save unit for each editor. If a payload has an `id`, it must match `entityId`. No save changes source public data.

## Files and backend dependencies

- `supabase/proposals/r1-private-drafts.sql`: deployment proposal, not an applied migration. Creates only the new `scavland_drafts` private schema/table and two narrowly scoped functions.
- `supabase/functions/admin-drafts/handler.mjs`: shared load/save/preview/publish HTTP contract.
- `supabase/functions/admin-drafts/index.ts`: deployable entrypoint. **No domain publisher is registered.**
- `supabase/functions/admin-drafts/github-publisher.mjs`: shared allowlisted JSON publication adapter, using the existing Git tree/commit/non-force-ref pattern.
- `draft-persistence.js`: optional CommonJS/browser client (`ScavDraftPersistence`). No UI framework and no editor modifications.
- `scripts/test-draft-persistence.cjs`, `scripts/test-draft-publish.mjs`, `scripts/r1-test-runtime/*`: isolated tests and pinned PostgreSQL test dependency.

Runtime dependencies: existing Supabase Auth and `public.has_scavland_permission(text)`; new RPC `public.scavland_draft`; private PostgreSQL schema; Edge Function `admin-drafts`; `SUPABASE_URL` and `SUPABASE_ANON_KEY`. The caller JWT is forwarded to the RPC, so `auth.uid()` establishes the saver. No service-role key or browser-supplied actor is used. Existing security policies are untouched.

## SQL/security contract

Each immutable row stores `(domain, entity_id, version)`, `payload`, public `base` manifest, unique `request_id`, server `saved_at`, and `saved_by = auth.uid()`. A transaction-scoped advisory lock serializes first creation and later saves of the same draft. Save requires the exact current version (0 means absent); stale saves raise `PT409`. Payloads are bounded to 1 MiB; the public-base manifest to 16 KiB.

Immutable revision rows also serve as permanent save receipts. Retrying the same request ID/actor/expected version/payload/base returns the original saved revision, without creating another version. Reusing an ID with changed content conflicts. If another save has advanced the head, `currentVersion` reveals it and the client enters Conflict rather than silently adopting an older receipt as the latest state.

The private table has RLS enabled with no client policies, and no anon/authenticated table grants. No update/delete API exists. A definer function is confined to the **non-exposed private schema**, uses an empty search path and fully qualified relations, checks `auth.uid()` and the existing permission RPC on every call. It is the sole controlled writer. The public RPC is a thin **security-invoker** wrapper. Function execution is explicitly revoked from PUBLIC/anon and granted only to authenticated; private helper execution has the same authorization checks. Do not expose `scavland_drafts` through the Data API. Do not grant direct table writes, which would bypass the concurrency contract.

The security-definer helper is intentional to keep all table access behind validated atomic operations; it does not grant authority from editable JWT metadata or client actor fields. Deployment review must preserve this boundary, function ownership, explicit grants and existing helper semantics.

## HTTP contract

POST the deployed Edge Function with `apikey`, `Authorization: Bearer <current user access token>` and JSON. The fixed CORS origin is the existing SCAVLAND website. OPTIONS is supported; all responses use `Cache-Control: no-store`.

Common keys: `action`, `domain`, `entityId`.

- `load`: returns `{draft: null, currentVersion: 0}` when absent, otherwise `{draft, currentVersion}`. Loading never creates a draft.
- `save`: also sends `expectedVersion`, UUID `requestId`, `payload`, `base`. Returns the committed `{draft, currentVersion}` only after the database transaction succeeds. SQL metadata uses `entity_id`, `request_id`, `saved_at`, `saved_by`.
- `preview`: sends `expectedVersion`. Loads the durable revision, checks it is still current, invokes the registered validator and read-only preview adapter. It never accepts an unsaved client payload for publication.
- `publish`: sends `expectedVersion` and `confirm: true`. Repeats durable-load/version/validation checks, requires a registered publisher and `DRAFT_PUBLISH_ENABLED=true`. Returns `{publishedVersion, publication}` only after the publisher acknowledges success.

Error responses: `{error}` with 400 invalid input/confirmation, 401/403 unauthorized, 404 missing publish draft, 409 conflict, 413 request limit, or 5xx unavailable/uncertain backend. Draft save errors are retryable with the same exact request ID/content. Conflict is not auto-merged or overwritten.

## Browser usage for R2

```js
const drafts = ScavDraftPersistence.create({
  endpoint: SUPABASE_URL + '/functions/v1/admin-drafts',
  apiKey: PUBLISHABLE_KEY,
  getToken: () => currentAccessToken,
  domain: 'items',
  entityId: record.id,
  onState: ({state, detail, pending}) => renderSaveState(state, detail)
});
const saved = await drafts.load();
await drafts.save(editedPayload, reviewedPublicBase);
// After a failed/uncertain save:
await drafts.retry();
// Read-only, validated durable snapshot:
const preview = await drafts.preview();
// Only after the user's separate Publish confirmation:
await drafts.publish({confirm: true});
```

Client save states: `saving` / “Saving…”, `saved` / “Saved”, `error` / “Couldn’t save — Retry”, `conflict` / “Conflict — newer version exists”. The client retains a cloned pending payload/request until acknowledged. It never shows Saved optimistically or stores authoritative data in localStorage. `getPending()` exposes a safe clone for copying/recovery UI. Another save is blocked until retry or an explicit `load({discardPending:true})`; a failed reload does not clear pending work. Non-JSON values (including NaN/Infinity/undefined/cycles) are rejected rather than silently converted to null/dropped.

Preview/publication use separate `previewing`, `publishing`, `published` states. They do not claim a draft Save. R2 must provide unsaved-change navigation guards, an explicit conflict-resolution UI, safe preview rendering, token-expiry/sign-in handling and optional temporary crash recovery. Pending memory does not survive a closed tab; committed backend drafts do. This foundation does not wire those UI flows or make existing local editors cloud-backed.

## Publish boundary and current-main safety

R2 registers a server-owned adapter for each enabled domain: `validate(draft)`, `preview(draft)`, `publish(draft)`. The generic GitHub adapter accepts only server-configured repository, branch, allowlisted `data/*.json` paths, validator and projection callback. Clients cannot choose a GitHub URL/branch/file path or publish arbitrary blobs. All paths in the base manifest must match the server configuration.

`draft.base` maps reviewed public file paths to blob SHAs. R2 must obtain those values when loading/rebasing the public source. The current JSON publisher requires existing files and rejects a mismatch before writing. New-page HTML generation/new public files are not implemented in R1 and require an explicit R2 adapter; the same draft store already supports Page Builder drafts.

On Publish the adapter reads **current** branch HEAD, compares public file SHAs, validates and projects the saved payload into those current documents, builds a tree based on that current tree, creates a commit with that parent, and moves the ref **without force**. Unrelated current-main files are retained. A competing branch update fails instead of discarding it. R1 never integrates/replaces main or changes the existing production publishers.

Publish targets the exact immutable version named by the confirmation, not “whatever is newest at completion.” A save occurring after the publication snapshot creates a later private revision; it is not marked published. If the draft was newer at load time, Publish conflicts. Repeated publications from an old public base conflict; no blind retry with a fresh SHA.

There is no distributed transaction between PostgreSQL and GitHub. A lost Publish response can mean GitHub accepted the commit. The draft always remains intact; R2 must check the public commit/data and deliberately rebase/review before another Publish. Do not silently treat an uncertain response as success or reapply it with the latest SHA. R1 makes no automatic “published” database mutation that could delete or falsely certify a newer draft. Preview produces data, not trusted HTML; R2 must render it safely.

The shipped function has an empty publisher registry and no publishing enabled by default. The complete shared boundary/GitHub mechanism is exercised with injected test adapters, but **no production domain is publishable in R1**. Save is structurally validated; domain/game-data validation must be registered before that domain's preview/publish is enabled. This is a deliberate R2 integration requirement, not an implicit production-ready publisher.

## Deployment required, not performed

1. Review this additive SQL proposal and current helper/grant definitions in a staging Supabase project. Confirm the private schema remains non-exposed. No changes to old table/RLS policies are needed for draft storage.
2. Materialize the reviewed SQL through `supabase migration new private_admin_drafts` and the normal approved migration workflow. R1 provides a proposal instead of inventing migration history or applying live SQL. The Supabase CLI is not installed in the current environment.
3. Apply to staging, deploy `admin-drafts` with existing JWT gateway conventions (the RPC also enforces caller authorization), verify SQL privileges and real owner/admin/reviewer/inactive/visitor behaviour. Do not enable anonymous function/table access to make tests pass.
4. Verify save → hard reload → browser restart → second authenticated device with a private test draft. No public publication is necessary for these checks.
5. Back up/version the schema change and deploy only after approval. Register reviewed domain adapters in R2; keep `DRAFT_PUBLISH_ENABLED` disabled until separate release approval. Existing Homepage/legacy production publishers remain unchanged.

There is no production durability claim until the migration and function exist. No new storage bucket is needed; uploaded binaries remain outside this JSON-draft scope. Immutable revisions grow over time; define an approved retention/back-up process later, without deleting retry receipts during normal operation.

## Tests and limits

Install only the pinned test dependency: `npm ci --prefix scripts/r1-test-runtime --ignore-scripts`. Run from repository root:

```
node scripts/test-draft-persistence.cjs
node scripts/test-draft-publish.mjs
```

The first uses PGlite 0.3.14 (real embedded PostgreSQL), applies the exact SQL proposal to a temporary on-disk database, scaffolds the existing Auth/permission helper semantics, and tests SQL → endpoint → client end-to-end. It covers committed save, database close/reopen, separate user sessions, stable identity/source JSON, no direct table grants, anonymous/reviewer/inactive rejection, invalid payloads, stale/competing saves, failed network retry, lost-response replay, newer-head receipt conflict, no public write on Save/Preview, explicit publication and retained drafts on publication failure.

The second mocks GitHub only and tests validation, preview without writes, stale public SHA, competing-main rejection, atomic allowlisted tree, unchanged unrelated records, current-tree parentage, non-force ref update and lost-response reconciliation. No live GitHub write is made. No existing editor file, production publisher or public data file is modified by R1.

Limitations: PGlite is not a deployed Supabase/PostgREST gateway or a real multi-device network test. Hosting/JWT-gateway behaviour, deployed RPC exposure, real concurrent PostgreSQL connections and end-to-end staging permissions still require staging verification. The local restart/separate-session tests establish the implementation contract; **production deployment and real cross-device verification remain outstanding**.

References checked before implementation: [Supabase database functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), and [explicit Data API grants change](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically). Changelog reviewed; no GraphQL or self-hosted upgrade features are used.
