# API Contract — Routes, Frontend Patterns & Backend Infra

**Author:** backend-engineer · **Round:** routes-frontend-patterns-backend-infra · **Base URL:** `/api/v1`

This file was originally (and correctly) not created for this round: BI3 was deferred and BI1/BI2/BI4
changed no request or response shape. It exists now for **one** reason — the security round's HIGH finding
("The CDN cutover makes KYC identity documents and selfies publicly readable") required a new authenticated
endpoint, and the admin verification screen has to be pointed at it.

**Read §1 if you own the admin verification screen. Nothing else in the app is affected.**

---

## 0. What changed, in one table

| Endpoint | Change | Frontend action |
|---|---|---|
| `GET /uploads/kyc/:folder/:filename` | **New.** Admin-only. Streams a KYC document/selfie. | **Required** — the admin verification screen must fetch through this instead of putting the stored URL in `<img src>`. See §1. |
| `POST /uploads/document`, `POST /uploads/selfie` | Response `url` shape **unchanged** (`/uploads/documents/<file>`, `/uploads/selfies/<file>`). What changed is that nothing serves that path any more. | None to the upload call itself. |
| `GET /verification`, `GET /verification/:id`, `GET /verification/me` | Response shape **unchanged**. `documentFrontUrl` / `documentBackUrl` / `selfieUrl` still hold `/uploads/<folder>/<file>`. | Stop treating those three fields as image URLs. See §1.2. |
| `GET /uploads/avatars/…`, `portfolio`, `reviews`, `messages`, `job-attachments` | **Unchanged**, including `Cache-Control: public, max-age=31536000, immutable`. | None. `resolveMediaUrl()` keeps working exactly as today for all five. |
| `GET /uploads/documents/…`, `GET /uploads/selfies/…` | **No longer served.** Now a `404` with the standard JSON error envelope, in both local and S3 mode, whether or not the file exists on disk. | Anything relying on these rendering anonymously will break — that is the point. |

Nothing else in the API changed. No other endpoint, DTO, field or status code moved.

---

## 1. `GET /uploads/kyc/:folder/:filename` — read a KYC document or selfie

### 1.1 The endpoint

**Method / path:** `GET /api/v1/uploads/kyc/{folder}/{filename}`

**Auth:** bearer access token **and** role `ADMIN`. Enforced server-side by `JwtAuthGuard` + `RolesGuard`;
the frontend middleware role check is an independent second layer, not a substitute.

**Path parameters**

| Param | Type | Rules |
|---|---|---|
| `folder` | enum | `documents` \| `selfies` only. Any other value — including `avatars` or `portfolio` — is a `400`, so this endpoint can never be used as a general file proxy. |
| `filename` | string | The stored filename, e.g. `9f1c2b8e-….jpg`. Must match `^[A-Za-z0-9][A-Za-z0-9._-]*$` and contain no `..`. Anything else is a `400`. |

**Response `200` — raw bytes, NOT the JSON success envelope.** This is the one endpoint in the API that is
not wrapped by `ResponseInterceptor`. Do not `JSON.parse` it.

| Header | Value |
|---|---|
| `Content-Type` | the stored type — `image/jpeg`, `image/png`, `image/webp`, or `application/pdf` |
| `Content-Length` | byte length, when the store reports it |
| `Cache-Control` | `private, no-store` — deliberately the opposite of the public folders' year-long immutable caching. Do not cache these client-side. |
| `X-Content-Type-Options` | `nosniff` |
| `Content-Disposition` | `inline; filename="<filename>"` |

**Errors**

| Code | Meaning | What to render |
|---|---|---|
| `400` | Bad `folder` (not `documents`/`selfies`) or a `filename` that isn't a plain stored filename. | Treat as a bug in the caller — the path was built wrong. Log it, show the same "couldn't load" tile as `404`. |
| `401` | No/expired token. | The normal refresh-and-retry path in `lib/api.ts` handles this. Note: this is exactly what a bare `<img src>` gets, since a browser image request carries no `Authorization` header. |
| `403` | Authenticated but not an `ADMIN` — including the artisan who uploaded the file. | Should be unreachable from an admin-only screen; show the "couldn't load" tile. |
| `404` | No such object in either store. Also returned for a well-formed filename that simply does not exist, so existence is never confirmed. | "This file is no longer available." Do not retry. |
| `500` | Storage is unreachable/misconfigured (generic message — never bucket, region or credential detail). | Generic "couldn't load", retry is reasonable. |

Every successful read is logged server-side with the acting admin's id and the object key, so KYC access is
attributable.

### 1.2 How to build the path from what the API gives you

The verification response still returns the **stored reference**, unchanged:

```json
{
  "documentFrontUrl": "/uploads/documents/9f1c2b8e-1111-4000-8000-aaaaaaaaaaaa.jpg",
  "documentBackUrl":  "/uploads/documents/9f1c2b8e-2222-4000-8000-bbbbbbbbbbbb.jpg",
  "selfieUrl":        "/uploads/selfies/9f1c2b8e-3333-4000-8000-cccccccccccc.jpg"
}
```

That value is a **reference, not a URL** — nothing serves it, in either storage mode. Do **not** pass it
through `resolveMediaUrl()`; that produces `http://localhost:8000/uploads/documents/…`, which now `404`s by
design.

The mapping is one rule, and it is the same for rows written before the S3 cutover and after it:

```
stored:   /uploads/{folder}/{filename}
request:  GET {API_BASE}/uploads/kyc/{folder}/{filename}
```

i.e. insert `kyc/` after `/uploads/`, and send it through the authenticated fetch helper (so it picks up
`/api/v1` and the bearer token) rather than the media-origin helper. Concretely: strip the leading
`/uploads/` and request `uploads/kyc/${rest}`.

### 1.3 Why it streams instead of returning a presigned URL

The security finding's remediation offered either a short-lived presigned GET URL or a direct stream. This
streams, for three reasons:

1. It behaves identically in local-disk and S3 mode, so the admin screen has one code path rather than two
   that diverge at cutover time.
2. **No anonymously-fetchable URL for a KYC object ever exists.** A presigned URL is a bearer credential in
   a query string: it can be copied out of devtools, forwarded, logged by an intermediary, or leak via a
   referrer. Since the failure being fixed is precisely "an anonymously-readable URL to an identity
   document", not minting one at all is the stronger answer.
3. It needs no new dependency (`@aws-sdk/s3-request-presigner` isn't installed) and no signing secret.

The cost: these bytes pass through the app server, which PRD §9 asks media not to do. That is an accepted,
documented deviation scoped to this one prefix — KYC review is admin-only, low-volume, and capped at 10MB
per object by the upload validators. It does not apply to any public folder.

### 1.4 Frontend consequence you need to know about

Because the auth header is not sendable by an `<img>` tag, the admin verification tiles cannot keep using
`<img src={documentFrontUrl}>`. Fetch the response as a blob through the existing authenticated helper and
render `URL.createObjectURL(blob)`, revoking the object URL on unmount. PDFs need the same treatment (the
document upload accepts `application/pdf`), so branch on the response's `Content-Type` rather than assuming
an image.

**Not covered, and deliberately so:** an artisan viewing their *own* submitted document. The guard is
`ADMIN`-only, per the finding's remediation, so `GET /verification/me` returns references the artisan cannot
resolve. If the artisan-facing verification screen needs to show a thumbnail of what they uploaded, that is
a scope question for the product-manager, not something to widen the guard for silently — flag it rather
than working around it.

---

## 2. Storage/serving behaviour, for anyone debugging a broken image

| Folder | S3 mode object key | Stored value | Served by |
|---|---|---|---|
| `avatars`, `portfolio`, `reviews`, `messages`, `job-attachments` | `<folder>/<uuid>.<ext>` | absolute CDN URL (S3) or `/uploads/<folder>/<file>` (local) | public CDN, or the app's static mount for legacy rows — `resolveMediaUrl()` as today |
| `documents`, `selfies` | `private/<folder>/<uuid>.<ext>` | `/uploads/<folder>/<file>` in **both** modes | `GET /uploads/kyc/:folder/:filename` only |

Two operator notes that affect what you'll see locally:

- The public static mount is now an allow-list of the five public folders (one handler each), not the whole
  `uploads` tree. `/uploads/documents/anything` therefore returns Nest's clean JSON `404` even when the file
  is sitting on disk.
- `AWS_S3_PUBLIC_URL_BASE` must not be configured to front the `private/` key prefix. The prefix is not the
  access control — the admin guard is — but it keeps a public-bucket default from exposing a KYC object
  through the same URL shape the frontend knows for avatars.
