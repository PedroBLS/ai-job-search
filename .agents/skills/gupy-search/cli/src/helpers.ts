// Data source: Gupy's public job-search JSON API (the one portal.gupy.io's own
// search page calls). No authentication required. portal.gupy.io/robots.txt
// allows everything (`Disallow:` empty); employability-portal.gupy.io has no
// robots.txt (404). See ../../url-reference.md.

export const SEARCH_URL = "https://portal.gupy.io/api/job-search/jobs"
export const DETAIL_URL = "https://employability-portal.gupy.io/api/v1/jobs"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "Mozilla/5.0 (compatible; gupy-cli/1.0)"

/** Fetch JSON with exponential backoff + jitter on 429/5xx. Returns null on 404. */
export async function jsonFetch(url: string): Promise<unknown | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      await new Promise((r) => setTimeout(r, delay + Math.floor(Math.random() * 500)))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    return response.json()
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  workplaceType: string | null
  type: string | null
  deadline: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  companyUrl: string | null
  pwd: boolean
}

type Raw = Record<string, unknown>
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)

/** Gupy descriptions are "plain text" but still carry HTML entities (&nbsp;, &amp;, &#39;). */
export function decodeEntities(s: string): string {
  const cp = (n: number) => (n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "")
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => cp(parseInt(d, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => cp(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
}

function location(r: Raw): string | null {
  const parts = [str(r.city), str(r.state)].filter(Boolean)
  if (parts.length) return parts.join(", ")
  return r.workplaceType === "remote" ? "Remoto" : null
}

/** Map one API job object. Returns null for a malformed entry so it cannot break the rest. */
export function toCard(r: Raw): JobCard | null {
  const id = r.id == null ? null : String(r.id)
  const title = str(r.name)
  if (!id || !title) return null
  return {
    id,
    title,
    company: str(r.careerPageName),
    location: location(r),
    date: str(r.publishedDate)?.slice(0, 10) ?? null,
    url: str(r.jobUrl) ?? `https://portal.gupy.io/job/${id}`,
    workplaceType: str(r.workplaceType),
    type: str(r.type),
    deadline: str(r.applicationDeadline)?.slice(0, 10) ?? null,
  }
}

export function parseJobList(body: unknown): { cards: JobCard[]; total: number | null } {
  const b = (body ?? {}) as Raw
  const data = Array.isArray(b.data) ? (b.data as Raw[]) : []
  const cards: JobCard[] = []
  for (const r of data) {
    try {
      const c = toCard(r)
      if (c) cards.push(c)
    } catch {
      // skip malformed entry
    }
  }
  const p = (b.pagination ?? {}) as Raw
  return { cards, total: typeof p.total === "number" ? p.total : null }
}

export function parseJobDetail(body: unknown): JobDetail | null {
  const r = (body ?? {}) as Raw
  const card = toCard(r)
  if (!card) return null
  const badges = (r.badges ?? {}) as Raw
  return {
    ...card,
    description: str(r.description) ? decodeEntities(str(r.description)!).replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n") : null,
    companyUrl: str(r.careerPageUrl),
    pwd: badges.isPWD === true || r.disabilities === true,
  }
}

/** --remote remote|hybrid|onsite -> Gupy workplaceType value. */
export function workplaceParam(mode: string | undefined): string | null {
  switch ((mode || "").toLowerCase()) {
    case "remote":
      return "remote"
    case "hybrid":
      return "hybrid"
    case "onsite":
    case "on-site":
      return "on-site"
    default:
      return null
  }
}

/**
 * Accept a numeric job id, a legacy `<company>.gupy.io/jobs/<id>` URL, or a
 * current `<company>.gupy.io/job/<base64url>` URL whose token is JSON like
 * {"jobId":12594120,"source":"gupy_portal"}.
 */
export function normalizeId(input: string): string | null {
  const s = input.trim()
  if (/^\d{4,}$/.test(s)) return s
  const legacy = s.match(/\/jobs\/(\d{4,})/)
  if (legacy) return legacy[1]
  const tok = s.match(/\/job\/([A-Za-z0-9_-]+)/)
  if (tok) {
    try {
      const json = Buffer.from(tok[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")
      const m = json.match(/"jobId"\s*:\s*(\d+)/)
      if (m) return m[1]
    } catch {
      // fall through
    }
  }
  return null
}
