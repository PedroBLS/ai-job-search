import { SEARCH_URL, jsonFetch, parseJobList, workplaceParam, writeError, type JobCard } from "../helpers.js"

export interface SearchOpts {
  query: string
  location?: string // city
  state?: string
  remote?: string // "remote" | "hybrid" | "onsite"
  jobage?: number // days; filtered client-side (the API has no age parameter)
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

export const PAGE_SIZE = 20

export function buildUrl(opts: SearchOpts): string {
  const params = new URLSearchParams()
  params.set("jobName", opts.query)
  if (opts.location) params.set("city", opts.location)
  if (opts.state) params.set("state", opts.state)
  const wt = workplaceParam(opts.remote)
  if (wt) params.set("workplaceType", wt)
  params.set("sortBy", "publishedDate")
  params.set("sortOrder", "desc")
  params.set("limit", String(PAGE_SIZE))
  params.set("offset", String((opts.page - 1) * PAGE_SIZE))
  return `${SEARCH_URL}?${params.toString()}`
}

/** Keep cards published within `days` of `now`. Cards without a date are kept. */
export function filterByAge(cards: JobCard[], days: number, now = Date.now()): JobCard[] {
  const cutoff = now - days * 86400000
  return cards.filter((c) => !c.date || Date.parse(c.date) >= cutoff - 86400000)
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const header = "ID".padEnd(10) + " " + "TITLE".padEnd(42) + " " + "COMPANY".padEnd(26) + " " + "LOCATION".padEnd(24) + " " + "MODE".padEnd(8) + " DATE"
  const rows = cards.map(
    (c) =>
      `${c.id.padEnd(10)} ${c.title.slice(0, 42).padEnd(42)} ${(c.company || "—").slice(0, 26).padEnd(26)} ${(c.location || "—").slice(0, 24).padEnd(24)} ${(c.workplaceType || "—").slice(0, 8).padEnd(8)} ${c.date || "—"}`,
  )
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const { cards: all, total } = parseJobList(await jsonFetch(buildUrl(opts)))
    let cards = opts.jobage ? filterByAge(all, opts.jobage) : all
    if (opts.limit !== undefined) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map((c) => `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.workplaceType || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`)
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(JSON.stringify({ meta: { count: cards.length, page: opts.page, total }, results: cards }, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
