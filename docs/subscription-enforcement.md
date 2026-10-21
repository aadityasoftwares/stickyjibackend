# Subscription enforcement

The catalog has three personal plans. Pricing and billing activation continue to use the existing billing flow. The workspace owner pays for usage created by collaborators.

| Resource            |    Free | Individual |    Pro | Scope                 |
| ------------------- | ------: | ---------: | -----: | --------------------- |
| Owned workspaces    |       3 |          5 |     20 | Owner                 |
| Folders             |       5 |         10 |     30 | Each workspace        |
| Active sticky notes |     500 |      5,000 | 25,000 | All owned workspaces  |
| Storage             | 100 MiB |      1 GiB | 10 GiB | Owner                 |
| Single upload       |   5 MiB |     10 MiB | 25 MiB | Each file             |
| Billing seats       |       1 |          1 |      1 | Personal subscription |

Collaborators are not billing seats. The existing catalog enables all implemented capabilities on all three plans; paid plans increase capacity. Do not interpret `MAX_USERS` as a collaborator limit.

## Configuration

- `src/seeders/subscription/constants/default-limits.constants.ts` defines the managed quota values.
- `default-features.constants.ts` defines implemented capabilities. Reminders, export, note history, and the legacy advertising capability remain inactive.
- `PlanFeature` rows are the runtime authority for plan-specific enablement, limits, and unlimited flags. An inactive `Feature` disables its capability across plans.
- Missing required configuration fails closed with `CONFIGURATION_ERROR`; a database failure does not silently grant access or downgrade a paid account.
- Disabled quotas remain disabled even when `isUnlimited` is true.

Use `npm run seed:subscriptions:dry-run` to review catalog differences, `npm run seed:subscriptions:apply` to apply the managed catalog, and `npm run seed:subscriptions:verify` to verify it. Applying the managed catalog can replace administrator changes to managed rows; update the source configuration when those changes should survive reseeding. No production database changes are required merely to deploy the enforcement code against an already seeded catalog.

## Enforcement coverage

| Product module                                 | Capability and quota checks                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Workspaces                                     | `WORKSPACES`, `MAX_WORKSPACES`; restoring also reserves active descendant notes                                  |
| Folders                                        | `FOLDERS`, `MAX_FOLDERS_PER_WORKSPACE`; collaborator mutations also require `SHARED_FOLDERS`                     |
| Notes                                          | `NOTES`, `MAX_ACTIVE_STICKY_NOTES`; creation, restore, and unarchive reserve capacity                            |
| Labels, checklists, checklist items, favorites | `NOTES`; additions/reactivation and content edits check capabilities                                             |
| Kanban columns and note reordering             | `KANBAN`; existing per-folder column safety limit remains                                                        |
| Members and invitations                        | `MEMBERS`; membership role changes require `MEMBER_ROLES`; invitation acceptance rechecks the current owner plan |
| Assignments                                    | `SHARED_NOTES`; adding and restoring assignees rechecks capabilities                                             |
| Custom workspace roles                         | `MEMBER_ROLES`                                                                                                   |
| Media                                          | `ATTACHMENTS`, per-file and aggregate storage limits; changes of billing owner reserve destination capacity      |
| Note search                                    | `ADVANCED_SEARCH`                                                                                                |
| Personal activity log                          | `ACTIVITY_LOG`; authenticated users can read their own events                                                    |

Account settings, authentication, preferences, billing management, and administrator catalog/reference-data modules do not consume product quotas. Registration's internal personal-workspace/default-folder provisioning remains an internal bootstrap path. Existing checklist, assignee, and column safety limits remain separate from paid quotas.

Reading existing content and removing resources remain available above quota. A downgrade never deletes customer content. Archiving a note releases its active-note slot; archiving a workspace or folder does not release its quota slot. Trashing a workspace releases the workspace slot and its active-note contribution, but retained attachments continue to consume storage.

## Upload lifecycle

An unexpired pending media record consumes its declared bytes immediately. Completing it changes its state without charging it twice. Failed/expired pending uploads no longer consume capacity. Completion verifies object size against the declared bytes. Media creation or URL-generation failure releases the reservation. A file's destination must be accessible to the actor; collaborators cannot charge an unrelated owner's storage.

Changing the attachment association within one billing owner does not consume additional bytes. Moving a completed attachment to another billing owner requires that owner's available storage and per-file allowance.

## Quota admission

`SubscriptionEntitlementService` is the shared policy entry point. Authorization remains a separate prerequisite. Mutations reserve capacity before persistence, commit after success, and release on failure.

MongoDB admission locks serialize competing quota checks across backend instances, keyed by owner/resource (and workspace for folders). They use the automatic unique `_id` index, work on standalone MongoDB, expire after 60 seconds, and return retryable `SUBSCRIPTION_QUOTA_BUSY` (503) on lock contention/lease loss. Pending reservations are read before refreshed persisted usage to avoid losing a concurrently committed operation. Operations should complete within the five-minute reservation TTL; long-running jobs must use a durable resource record or a dedicated reservation-renewal workflow.

Operation IDs are bound to scope, resource, workspace, and quantity. Completed, expired, or mismatched operation IDs return `SUBSCRIPTION_OPERATION_CONFLICT` (409). These are internal reservation IDs, not a complete HTTP request-idempotency protocol.

## Frontend contract

- `GET /subscriptionentitlement/me` and `/summary`: personal plan, feature flags, resource limits, used/remaining values, and over-limit flags.
- `GET /subscriptionentitlement/workspace/:workspaceId`: authorized workspace owner's plan and feature flags, owner-wide usage, and that workspace's folder allowance.
- `GET /subscriptionentitlement/workspace/:workspaceId/folders`: workspace folder usage.
- `POST /subscriptionentitlement/check`: informational availability check; a successful preflight is not a reservation. Workspace checks require workspace access.

Use `features[code]` for capability availability and `resources[code]` for capacity. Unlimited summary limits/remaining values are explicitly `null` with `isUnlimited: true`. Handle `SUBSCRIPTION_FEATURE_DISABLED` and `SUBSCRIPTION_LIMIT_EXCEEDED` as 403 upgrade/capacity errors. Retain access to billing and cleanup actions. Retry 503 admission errors; do not present them as an upgrade requirement.

## Verification

`npm run test:subscriptions` runs subscription lifecycle, seed, usage, and entitlement integration tests against temporary MongoDB instances. The entitlement suite covers all three plans, concurrency, disabled capabilities, restoration, pending storage, failure cleanup, scope isolation, and operation-ID binding. It requires a local `mongod` or `MONGOD_BINARY`.
