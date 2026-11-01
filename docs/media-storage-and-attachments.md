# Media storage and note attachments

## Audit and ownership decision

The existing application has User-owned Workspaces, WorkspaceMember roles, note OWN/ANY permissions, and personal subscription billing. There is no organization/account collection. Multiple workspaces share one subscription owner. For workspace files, `Media.tenantId` therefore references the persistent **workspace owner User**, while `workspaceId` references the actual workspace. It never means the uploader or a client-selected namespace. Account media such as avatars uses `accounts/{userId}/users/{userId}/...` and has no tenant/workspace fields. Ownership mismatches fail closed; changing workspace ownership requires a separate transfer workflow.

Reused components: Media model/repository/service, the singleton R2 client, subscription feature limits and distributed quota lock, existing membership/note permissions, Media cleanup scheduler, note and workspace retention/purge, ResponseUtil and authentication. The audit found uploader-only read/completion authorization, pending files counted as actual storage, missing note-purge cleanup, and failed physical deletions that could lose their retry metadata. These paths have been updated.

`stickynoteattachment` is a dedicated route/controller/service/repository boundary over Media. A file has exactly one note, represented by `resourceType=NOTE`, `resourceId`, `purpose=ATTACHMENT`. `attachmentId` equals `mediaId`. A second relationship collection would duplicate this relationship and introduce completion/purge consistency work. `sortOrder`, creation time and `_id` provide stable ordering; manual reorder is not currently exposed. Note duplication omits attachments; no shared-object references are created. Existing note updates already prohibit changing workspaces.

## Storage and verification

New immutable, version-2 keys use random UUIDs, validated ObjectId segments, canonical extensions and UTC year/month:

```
accounts/{userId}/users/{userId}/avatars/{yyyy}/{mm}/{uuid}.jpg
tenants/{ownerId}/workspaces/{workspaceId}/notes/{noteId}/attachments/{yyyy}/{mm}/{uuid}.png
tenants/{ownerId}/workspaces/{workspaceId}/assets/logos/{yyyy}/{mm}/{uuid}.png
```

Original filenames remain metadata. Existing stored bucket/key pairs remain readable; legacy paths are never inferred to grant authorization. `storageKeyVersion` defaults to 1 for legacy records. Tenant/workspace fields remain nullable during rollout. Added metadata includes a server-computed SHA-256 checksum, uploaded/verified timestamps, PUT expiry and optional hashed idempotency operation ID. `size` is authoritative after exact equality verification, so no duplicate verified-size field is needed.

PUT URLs expire in five minutes and sign `Content-Type` and `If-None-Match: *`. Clients must send both returned headers. The browser supplies Content-Length from the File body. Repeating the PUT returns 412 when the object exists; clients then call completion to verify it. Retrying initialization with the same idempotency key returns the same record without extending its PUT deadline. Complete an already uploaded object even after PUT expiry, within the one-hour pending window. An ACTIVE completion is idempotent and still checks current authorization.

Completion checks HEAD size/type, streams bytes to a temporary directory with a strict size bound, computes SHA-256, and validates content. Images are decoded with Sharp, with a pixel limit and no animation. Text must be valid UTF-8 without binary control characters. PDF requires a PDF signature; DOCX/XLSX require a bounded, unencrypted OOXML ZIP package without macros, ActiveX or embedded objects. Documents require a configured ClamAV executable; scanner errors, infection, missing executable and timeouts fail closed. Signature/package validation is not a malware guarantee. Scanner definitions must be maintained by operations.

Default types are JPEG, PNG, WebP, TXT and CSV. PDF, DOCX and XLSX become available only with `MEDIA_CLAMSCAN_PATH`. SVG, HTML, executables, legacy Office binary files, video, audio and arbitrary archives are not enabled for **new** uploads. Existing objects remain readable. The optional MIME allowlist can further restrict supported formats. Downloads use octet-stream and attachment disposition with an encoded filename; signed URLs are never persisted. Account avatar display URLs retain their existing image presentation behavior.

## Environment and R2 setup

Existing credentials and bucket name remain in the existing environment variables. No credentials are committed. Two configurations are supported:

1. **One private bucket**, as confirmed for this development environment: set `CLOUDFLARE_R2_BUCKET_IS_PRIVATE=true`. Both public r2.dev access and public custom domains must actually be disabled in Cloudflare. `CLOUDFLARE_R2_PRIVATE_BUCKET_NAME` can be omitted. PUBLIC_URL is optional and ignored for this bucket's downloads.
2. **Public avatar bucket plus private media bucket**: leave `CLOUDFLARE_R2_BUCKET_IS_PRIVATE=false`, retain the existing public bucket/URL, and set `CLOUDFLARE_R2_PRIVATE_BUCKET_NAME` to a separate private bucket. Public URLs must not expose that private bucket.

The flag declares an operational fact; setting it does not change Cloudflare permissions. Never use it to label a publicly accessible bucket private. Backend credentials must have object read/write access only to the configured environment buckets. Use separate staging and production buckets and credentials. Private metadata does not make objects in a public bucket private. Legacy private files in a formerly public bucket need a separately reviewed privacy migration and cache purge.

Additional optional variables:

```
MEDIA_MAX_FILE_BYTES=26214400
MEDIA_ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp,text/plain,text/csv
MEDIA_CLAMSCAN_PATH=/usr/bin/clamscan
```

The server cap is also bounded by existing purpose/type limits and the subscription's `MAX_UPLOAD_BYTES`; the smallest applies. Do not add a fake scanner path to enable documents. The scanner receives a temporary filename with no shell interpolation. Allow temporary disk space and CPU for verification and cap concurrent completion traffic at the ingress.

Apply bucket CORS with the exact approved frontend origins, for example (replace example domains):

```json
[
    {
        "AllowedOrigins": ["https://app.example.com", "https://staging.example.com"],
        "AllowedMethods": ["PUT", "GET", "HEAD"],
        "AllowedHeaders": ["Content-Type", "If-None-Match"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 300
    }
]
```

Use a separate development rule for the actual localhost frontend origin. Never send API Authorization headers or cookies to R2. CORS does not replace bucket privacy. Official references: [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [conditional writes](https://developers.cloudflare.com/r2/api/s3/extensions/), [public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).

### Local development CORS

The API and R2 are separate CORS boundaries. A successful `request-upload` followed by a browser CORS error on the signed R2 PUT requires checking the **bucket** policy; changing Express CORS alone cannot fix it.

The API permits `http://localhost:4200` and `http://127.0.0.1:4200` when `NODE_ENV` is unset, `development`, or `test`. It also accepts exact origins in `CLIENT_URL` and the comma-separated `CORS_ALLOWED_ORIGINS`. Production and other environments receive only explicitly configured origins. For another frontend port, add it explicitly, for example:

```dotenv
NODE_ENV=development
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Restart the backend after changing `.env`. Configure the bucket using the same environment:

```sh
npm run storage:cors -- --print  # Print the rule without calling R2
npm run storage:cors            # Read existing rules and preview the merged policy
npm run storage:cors -- --apply # Apply and read back the policy
```

The command handles both configured media buckets, deduplicates a shared bucket, and preserves rules other than its own environment-specific rule. It does not run on server startup. Use bucket administration credentials for setup; normal object read/write credentials may return `AccessDenied`.

For dashboard setup, open **Cloudflare > R2 > the upload bucket > Settings > CORS Policy**. Add the rule from [`deploy/r2-cors.local.json`](../deploy/r2-cors.local.json) to the existing policy array, preserving existing production rules. If there is no policy, paste the complete array. Repeat for a separate private bucket, if configured. Use `--print` instead of the static file when extra origins are configured.

Retry with a newly requested upload URL and the returned `Content-Type` and `If-None-Match` headers. Do not attach API authorization or credentials to the storage PUT. In DevTools, the preflight must allow the frontend origin, `PUT`, `content-type`, and `if-none-match`. Expired signed URLs can also appear as CORS failures. See [Cloudflare's CORS troubleshooting](https://developers.cloudflare.com/r2/buckets/cors/).

## API and frontend

Routes are mounted under the existing `/stickynotes` API base:

```
POST   /api/v1/stickynotes/:noteId/attachments/request-upload
POST   /api/v1/stickynotes/:noteId/attachments/:attachmentId/complete
GET    /api/v1/stickynotes/:noteId/attachments?page=1&limit=20
GET    /api/v1/stickynotes/:noteId/attachments/:attachmentId/download
DELETE /api/v1/stickynotes/:noteId/attachments/:attachmentId
```

Request example:

```json
{ "fileName": "notes.txt", "mimeType": "text/plain", "size": 2048, "idempotencyKey": "client-generated-uuid" }
```

Initialization returns the standard success envelope containing safe attachment metadata plus `uploadUrl`, `expiresAt`, and `requiredHeaders`. Complete returns:

```json
{
    "success": true,
    "message": "Attachment uploaded successfully",
    "data": {
        "attachmentId": "...",
        "mediaId": "...",
        "fileName": "notes.txt",
        "mimeType": "text/plain",
        "size": 2048,
        "status": "ACTIVE",
        "addedBy": "...",
        "sortOrder": 0,
        "uploadedAt": "...",
        "createdAt": "..."
    }
}
```

Listings use the existing top-level `meta` pagination envelope. Dedicated attachment responses omit bucket, key and provider data. Existing generic Media/avatar API response fields are retained for compatibility, including legacy storage-key fields; clients should treat those fields as deprecated and never persist or trust them. Generic Media operations now require the same resource permissions, limit unscoped lists to account files, and prohibit resource/purpose/visibility reassignment. Existing endpoint names remain unchanged. Any client previously moving media by PUT must use a future explicit transfer flow instead.

Sticky note `getall` (GET and POST), `get/:id`, overdue notes, nested favorite notes, and mutations returning a note now include an `attachments` array with the same safe metadata shown above. Notes without attachments return `[]`. These arrays contain all active attachments for the returned notes, ordered by `sortOrder`, `createdAt`, and ID; pending/deleted uploads and attachments on trashed notes are excluded. Loading is batched across each page. Frontends can display `fileName`, `mimeType`, and `size` directly, and use `attachmentId` with the existing authorized `/:noteId/attachments/:attachmentId/download` endpoint to obtain a temporary URL when opening or downloading a file.

Read/download requires note READ; upload, completion, rename and removal require note UPDATE. Neither upload ownership nor a key prefix grants access. Tenant/workspace IDs in attachment bodies are rejected. Archived notes retain access; trashed notes hide their attachments until restored. Removing membership removes API access. An already issued download URL remains a bearer credential until expiry (five minutes); API revocation cannot immediately revoke it.

The Angular repository was located at `C:/Aaditya/AngularProjetcs/stickyji_webapp` (currently Angular 22). Its existing editor attachment block is integrated with the attachment API and a shared DirectUploadService used by avatars. That transport bypasses API interceptors, supports upload progress/cancellation, and sends create-once headers. It fetches download URLs only on explicit actions. Frontend work may continue independently in that repository; its pre-existing edits were preserved.

## Quotas and lifecycle

Existing ATTACHMENTS, MAX_UPLOAD_BYTES and MAX_STORAGE_BYTES entitlements remain authoritative. The additive MAX_ATTACHMENTS_PER_NOTE catalog quota defaults to 20 on all plans; pre-seed accounts use a compatibility default of 20. Configuration remains in the entitlement/catalog layer. A per-note distributed admission lock serializes count checks; the existing account storage lock serializes byte reservations across different notes/workspaces. No new quota collection or external queue was added.

Admission counts ACTIVE files, durable PENDING media and short-lived reservations. Once a pending Media row exists, the reservation is committed as a handoff to that row. Actual `storageBytesUsed` counts ACTIVE files only. A crash can conservatively double-count a reservation briefly until expiry; it cannot admit extra bytes. Failed/deleted media releases logical quota; physical deletion remains retryable. Trashed/archived resources retain their file bytes and quota. Completion/delete refresh usage; the existing subscription reconciliation job repairs cached totals after partial failures.

Expired PENDING uploads become FAILED tombstones. Verification failures also retain cleanup metadata. Pending and failed records cannot be downloaded. Note permanent purge tombstones attached Media in the existing database transaction; workspace purge delegates storage removal to the shared Media cleanup service. MongoDB transactions never span R2 requests. On standalone MongoDB, the existing transaction helper retains its nontransactional fallback; use replica sets for atomic purge guarantees.

New PUT objects are not physically removed until at least one hour after the signed URL expires, reducing the risk of a late in-flight upload recreating an abandoned key. Keep the cleanup scheduler enabled and monitor FAILED/deletion-pending backlogs. This grace interval is an operational bound, not immediate revocation of a provider request already in flight. Staging must verify provider request timeouts; increase the grace if ingress/provider upload bounds require it. No R2 object-list scan is required in routine API paths.

## Migration, deployment and rollback

1. Configure staging privacy/CORS/credentials and optional scanner; do not change production object keys.
2. Deploy API and frontend together so new signed PUT headers are sent. Restart the backend after environment changes.
3. Apply the additive subscription seed after its dry run: `npm run seed:subscriptions -- --dry-run`, then `--apply`. Existing catalog values remain preserved by the normal seeder policy.
4. Audit ownership: `npm run migrate:media -- --dry-run`. Resolve every orphan/ownership conflict. Migration uses trusted User → Workspace → Note records; it never infers tenant IDs from paths.
5. Backfill metadata: `npm run migrate:media -- --apply --journal=media-ownership.jsonl`. Resume with `--after=<last-reviewed-object-id>`. Re-running is idempotent. The cursor is batched and sorted. Journals contain internal keys/IDs, so store them as operational records outside source control.
6. Create the additive Media indexes (tenant/workspace/resource/status/order, tenant/status/time, and sparse unique uploadOperationId) through your normal reviewed database-index rollout. Do not run `syncIndexes` blindly against production. The unique operation index and existing quota-lock `_id` index are required before concurrent traffic.
7. Run staging PUT/complete/download/cleanup scenarios, then repeat configuration, dry run, seed and index rollout for production. Monitor 4xx authorization errors, quota denial rates, verification failures and cleanup backlog.

Metadata rollback: `npm run migrate:media -- --rollback=media-ownership.jsonl` previews; append `--apply` to apply. Rollback compares current key and ownership metadata before restoring the previous values, so concurrent changes are not overwritten. Null/default legacy metadata is restored rather than removing all schema fields. Legacy object bytes and keys are untouched throughout this migration.

An **optional, operator-only, one-object-at-a-time** key migration is separate:

```
npm run migrate:media-key -- --media-id=<id> --journal=media-key.json --dry-run
npm run migrate:media-key -- --media-id=<id> --journal=media-key.json --apply
npm run migrate:media-key -- --journal=media-key.json --rollback --dry-run
npm run migrate:media-key -- --journal=media-key.json --rollback --apply
npm run migrate:media-key -- --journal=media-key.json --cleanup --apply
```

It validates source content, conditionally copies using source ETag, verifies the destination SHA-256, switches the database reference with compare-and-set, and retains the source for at least seven days. Resuming with the same journal reuses the generated destination. Cleanup verifies the target and absence of source references before removal. Rollback verifies the retained source before changing the pointer. The normal model's immutable-key guard is bypassed only by these explicit guarded operator scripts. A partial copy/DB failure retains both the source and journal; investigate an unreferenced target through that journal. Do not migrate merely for prettier paths. Pause traffic for the selected object during optional key migration; this is not a concurrent transfer API.

Rollback application code without deleting new schema fields/indexes or objects. Deploying an old client against new PUT signatures will fail unless it sends If-None-Match. Rolling back to the old server also restores its authorization weaknesses, so prefer rolling forward with a fix. Roll back metadata separately only if necessary.

## Validation

Automated tests cover centralized keys, legacy avatar retrieval, real image/text content validation, scanner fail-closed behavior, signed PUT headers, download disposition, attachment initialization/completion/list/delete, cross-resource and cross-tenant attacks, read-only/removed members, concurrent count and storage admission, duplicate completion, trash/restore/purge, failed deletion retry, ownership resolution and orphan detection. Existing lifecycle tests mock R2 network and scanner IO; the content-security suite executes the real streaming/Sharp validation.

The tests do not exercise a real Cloudflare bucket or installed ClamAV. Staging acceptance must verify: approved/disallowed CORS origins; missing/wrong signed headers; second PUT returns 412; overwritten object remains impossible after completion; size/type mismatch quarantine; real PNG/JPEG/WebP/text and scanner document fixtures; deleted/member-revoked requests; bucket mismatch rejection; interrupted PUT and delayed cleanup; real copy/verify/rollback/cleanup using a disposable object. Migrations were not run against production or the development database.
