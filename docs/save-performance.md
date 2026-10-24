# Save performance investigation and verification

Measured on 2026-10-24 using Node 24.19.0, the installed Mongoose version, and isolated local MongoDB 8.2 processes. No application database or external billing/storage provider was modified. Existing uncommitted folder/column changes were preserved.

## Findings and changes

1. **Quota admission loaded the same subscription and plan limits twice.** Capability validation and numeric quota validation each traversed account → subscription → plan → plan features → populated features. Both now use one freshly resolved limits map inside the existing quota lock. This benefits capacity operations used by workspaces, folders, notes, members and media. There is no cross-request cache. Reservation idempotency, lease renewal, both authoritative usage checks, commit/release, usage persistence and audit persistence remain intact. Plan-feature reads now project only the fields consumed by these checks.
2. **Sticky-note HTTP mutations repeated authorization already performed by middleware.** Create, update and delete now accept the server-created authorization context through the controller, following the existing workspace-service pattern. Services verify actor/workspace identity, check workspace state, and still enforce operation-specific permissions against the fetched note. Direct service callers still resolve authorization. No client-supplied authorization or process-wide permission cache is introduced.
3. **Country creation performed four serial uniqueness reads.** A single projected `$or` query now checks the same four indexed fields. Conflict messages retain their original priority. Existing unique indexes protect concurrent creates; no index or schema changes were made.
4. **Role and legacy notes-workspace creation reread the inserted parent document.** These paths now populate the document already returned by `create()`. Save validation, hooks, defaults and timestamps still run. Tests compare the serialized result with a fresh populated read, including field selection and active-permission filtering.
5. **Hot-path debug logging printed plan-limit objects and authorization user IDs.** Those unconditional logs were removed. Opt-in sampled timing records replace them without logging user data.

## Measurements

Each row below uses ten operations against a temporary local database. The baseline source was copied to `tmp/save-baseline`; the original entitlement implementation was restored in that isolated copy. Country and note authorization code in that copy predates these optimizations. Both HTTP variants use the same timing instrumentation. Before and after runs were sequential, not concurrent.

| Operation | Before median | After median | Database calls before → after |
| --- | ---: | ---: | ---: |
| Note create, service flow | 48.40 ms | 41.77 ms | 51 → 46 |
| Note update, actual HTTP route | 27.34 ms | 21.46 ms | 18 → 16 |
| Country create, service flow | 5.53 ms | 2.07 ms | 5 → 2 |
| Note update, direct service caller | 13.83 ms | 12.77 ms | 15 → 15 |
| Two concurrent disjoint note updates | 20.70 ms | 14.89 ms | 30 → 30 |
| Note soft delete, direct service caller | 7.20 ms | 6.03 ms | 9 → 9 |

The targeted median reductions were approximately **13.7% for note creation, 21.5% for HTTP note updates, and 62.6% for country creation**. Unchanged-query rows are included for transparency, not as evidence of causal speedups. Local timings are noisy: note-create maximum latency was 59.19 ms before and 115.20 ms after. These are not production latency guarantees or statistically established tail-latency improvements. Service-flow counts use Mongoose debug callbacks; HTTP counts use completed MongoDB driver commands.

The measured HTTP update stages were:

| Stage | Before median | After median |
| --- | ---: | ---: |
| Field validation | 0.01 ms | 0.01 ms |
| Business service, including its awaited database/audit/response-enrichment work | 18.02 ms | 15.88 ms |
| Database command duration, summed across the request | 16.50 ms | 13.50 ms |
| JSON response handling | 0.37 ms | 0.29 ms |

Stages overlap and must not be added together. Database duration includes command/network time but excludes connection-pool checkout and Mongoose processing; parallel commands can make its sum exceed wall time. Request totals also include authentication, permission middleware and other processing outside the timed service.

## Module review coverage

The route/controller/service/repository/model inventory covered all 37 module directories. Runtime measurements concentrate on the proven shared bottlenecks above; this is not a claim that every endpoint was benchmarked.

| Modules | Review disposition |
| --- | --- |
| workspace, workspaceFolders, workspaceMember, workspaceInvitations | Shared entitlement improvement; existing authorization, invitation batching, transactions, quotas and audit work retained. |
| stickynotes | Optimized HTTP create/update/delete authorization and shared quota checks; existing field-level updates, response enrichment, counters and lifecycle operations retained. |
| stickynotescolumns, stickynotelabels, stickynotesfavorites, stickynotesassignees, stickyNoteschecklist, stickynotechecklistitems | Existing atomic updates, no-change checks and assignee bulk operations retained. Rank/position synchronization is business behavior, not discarded as redundant. |
| subscriptionentitlement, subscriptionusage, usersubscription, subscriptionpayment, billing | Removed repeated limits resolution; kept fresh usage, locking, payment idempotency, reconciliation and audit outbox semantics. |
| roles, permissions, workspaceroles, workspacepermission | Removed parent reread from role create and permission debug logging; retained privilege and reference checks. Legacy repositories not mounted by `app.routes.ts` were also inventoried. |
| countries, currency, languages, timezones, localizations | Batched the measured four-read country create path; retained reference-data protections and existing partial-update behavior elsewhere. |
| feature, plan, planfeature, planprice, systemsettings | Existing targeted mutations and duplicate/business checks retained. No speculative index changes. |
| auth, user, userprofile, userpreference | Kept authentication/crypto, document save behavior, public projections, preference bulk updates and timestamp semantics. |
| media, auditlog, notesworkspace | Shared capacity improvement and legacy workspace parent-reread removal; required storage cleanup and awaited audit persistence retained. External-provider latency was not benchmarked. |

The server already establishes and reuses one Mongoose connection at startup. No evidence justified changing pool sizes or indexes. Bulk writes are already used for invitations, assignees, preferences and rank updates. Transactional writes were not parallelized. Identical note submissions still retain existing timestamp behavior; suppressing those writes would change the contract. Concurrent disjoint-field updates and successive same-field HTTP updates are verified; simultaneous edits to the same field retain existing last-write behavior, without introducing a new versioning API.

## Monitoring

Set these environment variables **before starting the server**, then restart it:

```dotenv
SAVE_PERFORMANCE_ENABLED=true
SAVE_PERFORMANCE_SAMPLE_RATE=0.01
SAVE_PERFORMANCE_SLOW_MS=250
```

Monitoring is disabled by default. When enabled, one percent of POST/PUT/PATCH/DELETE requests are sampled; only sampled requests taking at least 250 ms emit a single `[SavePerformance]` JSON record. POST-based read endpoints are also included. For a short local measurement, use sample rate `1` and threshold `0`.

Records contain a server-defined module label, route template, HTTP status, total duration, database command count/duration, slowest command type/duration and explicitly instrumented stages. They never include request URLs, IDs, bodies, headers, query filters, results, credentials or MongoDB URIs. Request state is isolated with AsyncLocalStorage. All mounted modules get request/database/JSON response timing; detailed validation timing currently covers the common Zod helper and note-update field validation, and business timing covers note updates. Missing stages mean uninstrumented, not zero cost. The exported stage helpers allow targeted follow-up instrumentation without changing API responses.

## Verification and reproduction

```sh
npm run build
npm test
node --import tsx --test --test-name-pattern="save performance|HTTP save timing" tests/subscriptionEntitlement.test.mjs
node --import tsx --test tests/savePerformance.test.mjs
```

`mongod` must be on PATH, or set `MONGOD_BINARY`. Tests create their own temporary databases. In this environment npm was absent from PATH, so its exact underlying build/test commands were executed using the available Node executable.

New tests verify real MongoDB persistence, note create/update/delete, successive HTTP writes, concurrent disjoint-field writes, single plan-limit resolution, reservation release, role/workspace response equivalence, country conflict priority and concurrent duplicate prevention, mismatched authorization rejection, and concurrent/privacy-safe timing records. Existing quota, transaction, permission and billing suites were also run.

The initial suite had **328 passes and 4 failures out of 332 tests**. The final suite has **335 passes and the same 4 failures out of 339 tests**; all seven added tests pass. The TypeScript build passes. The four pre-existing failures are three workspace-deletion/restore tests (account-not-found fixtures and a subsequent missing response) and the invitation query-budget test (14 queries versus an expectation of 8). These unrelated failures were not hidden or changed. The existing column-constants edit also has a trailing blank-line warning from `git diff --check`; it was preserved.

Raw local logs are in `tmp/baseline-tests.log`, `tmp/save-before-repeated.log`, `tmp/save-after-repeated.log`, `tmp/http-before.log`, `tmp/http-after.log`, `tmp/country-before.log`, `tmp/country-after.log` and `tmp/final-tests.log`. Temporary logs and baseline source are ignored by Git and are not part of the proposed change.
