# Local and self-hosted MongoDB

All 37 application modules share the application connection. The API and all six database maintenance entrypoints (initialization, initialization verification, subscription seeding, rank backfill, note-number backfill and pending-user backfill) use `mongoConnectionOptions.ts` to enforce `retryWrites: false`, including when the URI specifies otherwise. Existing script timeout and index-creation settings are preserved. Restart the backend after deploying these changes; normal server startup does not require editing the connection string.

The reported invitation bulk-write error wrapped MongoDB error 20: a transaction was started on a standalone server. Disabling retryable writes alone does not disable explicit transactions.

Workspaces, folders, notes, columns, invitations and subscription seeding now share `mongoTransaction.util.ts`. It checks the server's `hello` response before invoking business logic. Standalone servers execute the existing non-transactional path once, without an explicit session. Replica sets and mongos retain transactions. Discovery/network/authentication errors propagate instead of silently disabling transactions. Failed transactional callbacks are never rerun outside a transaction. Invitation duplicate-key retries remain bounded and transactional.

## Persistence guarantees

Standalone MongoDB provides atomic single-document updates and unique-index enforcement, but **not atomic multi-document transactions**. If a later audit or dependent write fails after an earlier standalone write succeeded, this helper cannot roll back that earlier write. Such errors are reported, not hidden or retried blindly.

For production workflows requiring all-or-nothing invitation acceptance, dependent deletion or audit persistence, use a self-hosted replica set. A single-node replica set can run on your own server; cloud hosting is not required. A single node supplies transaction support but does not provide high availability. No MongoDB service configuration or existing database was changed automatically.

## Verification

`node --import tsx --test tests/mongoDeployment.test.mjs` starts disposable standalone and single-node replica-set servers. It exercises all six transaction wrappers, invitation bulk upserts and duplicate prevention, create/update/delete persistence, standalone single execution, replica-set rollback, and failed capability discovery. It uses the application's connection function and verifies retryable writes are disabled.

References: [MongoDB retryable writes](https://www.mongodb.com/docs/v8.0/core/retryable-writes/) and [transactions](https://www.mongodb.com/docs/manual/core/transactions/).

Verification result: TypeScript build passes. Full suite: 340 passed, 3 failed out of 343. Both deployment tests and the shared connection-options regression test pass. The remaining failures are the previously identified workspace-deletion/restore fixture failures (account not found and the resulting missing response). Full output: `tmp/mongodb-all-modules-tests.log`.
