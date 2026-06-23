# VisionPrime OS — API Conventions

## 1. Standard Success Response

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

- `data` holds the actual payload (object or array).
- `meta` holds non-payload information: pagination, counts, timestamps,
  request id. `meta` is always present, even if empty (`{}`).

## 2. Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

- `code` is a stable, machine-readable string (see naming rules below).
- `message` is safe to show to an end user (no stack traces, no SQL).
- `details` is optional structured context (e.g. field-level validation
  errors). It must never contain raw database/internal errors.
- Raw database errors, stack traces, or internal exception messages must
  **never** be exposed in any response.

## 3. Pagination Format

All list endpoints are paginated. Request query params:

```
?page=1&pageSize=20&sort=createdAt&order=desc
```

Response `meta` shape for paginated endpoints:

```json
{
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 134,
    "totalPages": 7
  }
}
```

- Default `pageSize` is 20; max `pageSize` is 100 (enforced server-side).
- `data` is always an array for paginated endpoints.

## 4. Error Code Naming

- Format: `UPPER_SNAKE_CASE`, domain-prefixed where helpful:
  `WALLET_INSUFFICIENT_BALANCE`, `ORDER_NOT_FOUND`,
  `VALIDATION_FAILED`, `AUTH_INVALID_TOKEN`, `PERMISSION_DENIED`.
- Generic cross-cutting codes (reused across modules):
  - `VALIDATION_FAILED`
  - `NOT_FOUND`
  - `PERMISSION_DENIED`
  - `AUTH_REQUIRED`
  - `AUTH_INVALID_TOKEN`
  - `RATE_LIMITED`
  - `INTERNAL_ERROR` (generic catch-all; never leaks internals)
- Codes are part of the API contract — once shipped, they are not renamed.

## 5. Validation Rules

- Every endpoint that accepts input validates it against a shared schema
  from `packages/validation` before touching business logic.
- Validation failures return `success: false`, `error.code:
  VALIDATION_FAILED`, with field errors in `error.details`, e.g.:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "One or more fields are invalid.",
    "details": { "email": "Must be a valid email address" }
  }
}
```

- Validation schemas are shared between frontend forms and backend
  endpoints — never duplicated/re-implemented per side.

## 6. Auth Rules

- Admin OS and Customer Club authenticate via session/JWT.
- The WordPress plugin authenticates server-to-server using a secret API
  key (never exposed to the browser) plus request signing/nonce on the
  WordPress side.
- Every endpoint declares its required auth context explicitly; there is
  no "implicitly public" endpoint.
- Unauthenticated access returns `AUTH_REQUIRED`; invalid/expired
  credentials return `AUTH_INVALID_TOKEN`.

## 7. Permission Rules

- Every endpoint declares the permission(s) required to call it.
- Permission checks happen in a server-side guard, before the handler body
  runs.
- Lacking permission returns `success: false`, `error.code:
  PERMISSION_DENIED`, HTTP 403.
- See `permissions.md` for the full permission model.

## 8. Example Endpoints

```
GET    /api/customers              (paginated list)
GET    /api/customers/:id          (Customer 360 detail)
GET    /api/customers/:id/wallet/ledger   (paginated ledger entries)
POST   /api/customers/:id/wallet/credit   (sensitive — audited)
POST   /api/customers/:id/wallet/debit    (sensitive — audited)
GET    /api/orders                 (paginated list)
GET    /api/orders/:id
POST   /api/loyalty/points/award   (sensitive — audited)
GET    /api/segments
POST   /api/segments
GET    /api/campaigns
POST   /api/webhooks/woocommerce   (signature-verified, deduplicated)
```

Example success response for `GET /api/customers?page=1&pageSize=20`:

```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Jane Doe", "email": "jane@example.com" }
  ],
  "meta": { "page": 1, "pageSize": 20, "totalItems": 1, "totalPages": 1 }
}
```
