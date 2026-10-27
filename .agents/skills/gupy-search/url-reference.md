# Gupy — endpoint reference

Investigated 2026-09-24. Undocumented public JSON API used by portal.gupy.io's own
job-search page (found in its Next.js chunks: `"/api/job-search/jobs"` and `"/api/v1/jobs"`).

## Access

- `https://portal.gupy.io/robots.txt` → `User-agent: *` / `Disallow:` (empty = everything allowed).
- `https://employability-portal.gupy.io/robots.txt` → 404 (no restrictions published).
- No login, no API key. Honest UA `Mozilla/5.0 (compatible; gupy-cli/1.0)` works (no bot wall).

## Search

`GET https://portal.gupy.io/api/job-search/jobs`

| Param | Meaning |
|-------|---------|
| `jobName` | Keyword / title (required by us) |
| `city` | Exact city string with accents, e.g. `Brasília` |
| `state` | Exact state name, e.g. `Distrito Federal` |
| `workplaceType` | `remote` \| `hybrid` \| `on-site` |
| `type` | Contract type, e.g. `vacancy_type_effective` (not exposed as a flag) |
| `isPWD` | PcD-only filter (not exposed) |
| `careerPageName` | Company filter (not exposed) |
| `sortBy` / `sortOrder` | We use `publishedDate` / `desc` |
| `limit` / `offset` | Pagination (we use 20 per page) |

No posting-age parameter exists: `--jobage` filters client-side on `publishedDate`.

Response: `{ "data": [ ... ], "pagination": { "total", "limit", "offset" } }`.
Per item: `id` (number), `name`, `description` (plain text), `careerPageName`,
`careerPageLogo`, `careerPageUrl`, `type`, `publishedDate` (ISO), `applicationDeadline`
(ISO), `workplaceType`, `city`, `state`, `jobUrl`, `badges{friendlyBadge,isPWD}`, `disabilities`.

Equivalent host: `https://employability-portal.gupy.io/api/v1/jobs` (same params, also returns `companyId`).

## Detail

`GET https://employability-portal.gupy.io/api/v1/jobs/<id>` → single job object with the
fields above plus `companyId`, `careerPageId`, `country`, `isRemoteWork`,
`isConfidentialCareerPage`, `skills`. Unknown id → HTTP 404.

(`portal.gupy.io/api/job-search/jobs/<id>` does NOT exist: it returns the HTML app shell.)

## Job URLs

`jobUrl` looks like `https://<empresa>.gupy.io/job/<base64url>` where the token decodes to
`{"jobId":12594120,"source":"gupy_portal"}`. Legacy form: `https://<empresa>.gupy.io/jobs/<id>`.
`normalizeId()` in `cli/src/helpers.ts` handles both.
