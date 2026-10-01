# Attachment concurrent-save review — 1 October 2026

Scope: supported RPC lock review plus independently connected, isolated PostgreSQL acceptance. No live mutation was performed. Local PGlite and two-browser interleaving remain separate evidence.

## Lock review

| Operation | Locks acquired in order | Check after waiting |
| --- | --- | --- |
| Attachment preparation | request, catalogue, item | Legacy version, no specialist saved authority, expected Attachment head |
| Attachment save | catalogue, item | Receipt actor/item, exact-retry lookup, legacy version, expected head, no specialist authority |
| Existing specialist preparation | request, item | Expected specialist head; allocation trigger reacquires its already-held request lock |
| Existing specialist save | catalogue, item | Receipt/category/actor/version; Attachment overlap trigger reacquires item lock |
| New Attachment allocation | request | Exact actor/command retry; request not already used by another action |
| Attachment preview | item | Current saved version and actor-bound intent |

Sources: attachment-classification-storage.sql, attachment-creation-allocation.sql, attachment-preview.sql and shared-item-drafts.sql. Supported paths contain no reverse acquisition of catalogue after item, or request after item unless that same preparation already holds the request lock. Saves do not need a request lock because the prepared receipt is immutable. All locks are transaction-scoped. Future adapters must preserve these orders; trigger-level item guards alone do not establish a universal lock order for arbitrary privileged multi-operation transactions.

Competing same-item Attachment saves serialize and recheck the head: one receipt based on the old head must receive PT409 after the other commits. Exact saved-receipt retries return the original revision. Specialist and Attachment saved authority are mutually exclusive through reciprocal triggers using the same item lock. Catalogue locking also coordinates the legacy-version check with existing supported legacy save paths. These are code conclusions, not measured simultaneous-session results.

## Required isolated Postgres acceptance

Use a disposable Postgres database with the reviewed schema and genuine role grants, fixture identities and fixture records. Never run fixture inserts/publication against production. Use two independent connections at READ COMMITTED, matching the deployed default; record server version and actual transaction isolation. Auth/Git may remain fixtures for this SQL test, with no Git writes.

1. Prepare two distinct receipts against Attachment revision N. Session A begins, saves receipt A and keeps its transaction open. Session B attempts receipt B. Verify B waits on A's advisory lock (observe pg_locks from a third connection), commit A, then require B to return PT409. Verify exactly one N+1 row and unchanged original receipt/history.
2. Repeat with receipt A in both sessions. B must wait, then return the same saved revision/request identity after A commits, with no duplicate row. Roll back A in a separate run and require B to save once successfully.
3. Prepare specialist and Attachment work for one fixture item without saved authority. Save specialist first while holding its transaction; Attachment must wait and then refuse after commit. Repeat in reverse. Require only one store to have saved authority. The setup permission fixture must grant the appropriate specialist permission as well as items_edit.
4. Hold a supported legacy catalogue save open, attempt Attachment save from an older legacy version, commit legacy save, then require Attachment PT409. Reverse the order and document which transaction completes first; no deadlock is acceptable on supported paths.
5. Call new allocation with one request/actor/command from both sessions. Keep A open; B waits and returns A's identity after commit. Changed actor/command must refuse; count exactly one allocation. Repeat A rollback and verify one surviving allocation.
6. Hold a newer Attachment save open while another session creates a preview of N. After the save commits, require a request for N to refuse and a request for the current revision to succeed. Existing version checks must still refuse an older intent during publication.

Use bounded statement_timeout and lock_timeout, capture SQLSTATEs and lock observations, and restore fixture transactions after each scenario. A timeout is not a passing conflict test. Retain a result table for each scenario: blocking observed, commit/rollback outcome, returned SQLSTATE, final row count/version. Do not claim success from sequential calls or Promise.all on a single PGlite connection.

## Remaining publication limit

GitHub and Postgres still have no shared atomic transaction. A database save can occur after the publisher's final private-version check but before Git ref update. Non-force Git updates protect competing public commits, not that private-state interval. SQL lock acceptance does not close this gap. Coordinated release must explicitly review this limit; do not hold a browser transaction open across a Git network call or claim exactly-once cross-service publication.

## Earlier checkpoint (superseded by isolated acceptance below)

Static supported-path review completed. No local psql, postgres or Docker executable was available through command discovery. Existing local suites cover stale interleaving and immutable retries, but the six independent-session scenarios remain unexecuted. No migrations, flags, deployment or real verification facts changed.

## Completed isolated PostgreSQL acceptance

Used portable PostgreSQL 17.11 from the official EDB binary distribution (https://www.enterprisedb.com/download-postgresql-binaries), downloaded outside the repository into ../postgres-test-runtime. Archive SHA256: 4b8db0930c38f6ef845db919551dedda3b6b845aeb0927b3d79a6e8e9e4537cf (locally computed, not independently signed). No system service was installed. The server listened only on 127.0.0.1:55437; its temporary fixture databases were dropped, absence checked, and server stopped after testing.

scripts/test-attachment-concurrency.cjs creates a uniquely named disposable database, applies reviewed proposals, uses two persistent psql connections and a third observer to require an actual advisory-lock wait, and bounds statement/lock waits. Host is fixed to loopback; inherited PG service/options variables are removed. Auth identity/permissions are SQL fixtures, not live Supabase sessions. Git is not called. Fixture setup leaves role definitions only within the disposable local cluster.

All twelve cases passed at READ COMMITTED: competing same-head saves (one success/one PT409), identical receipt retry, save rollback/retry, specialist-first and Attachment-first authority, legacy-first invalidation, Attachment-first then legacy ordering, allocation identity retry, changed allocation command, changed allocation actor, allocation rollback, and preview refusal after a newer committed save. Final counts/versions and same allocation/request identities are asserted. A current-version preview then succeeds. No timeout or deadlock was accepted as a pass.

Repeat with SCAVLAND_PSQL pointing to psql and SCAVLAND_PG_TEST_PORT pointing to a disposable local cluster port, then npm run test:attachment-concurrency. The test requires local create-database/role privileges; never point it at an operational cluster. No PostgreSQL binaries or cluster data are committed. Production server version/isolation, live Auth/permissions and post-deployment signed-in acceptance still need confirmation. Cross-service publication limitations above remain.
