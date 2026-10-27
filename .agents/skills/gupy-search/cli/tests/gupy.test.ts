import { describe, expect, test } from "bun:test"
import { runCLI, parseJSON } from "./helpers.js"
import { decodeEntities, normalizeId, parseJobList } from "../src/helpers.js"
import { filterByAge } from "../src/commands/search.js"

interface SearchOut {
  meta: { count: number; page: number }
  results: { id: string; title: string; url: string; company: string | null; date: string | null }[]
}

describe("offline parsing", () => {
  test("normalizeId accepts id, legacy URL and base64 job URL", () => {
    expect(normalizeId("12594120")).toBe("12594120")
    expect(normalizeId("https://x.gupy.io/jobs/123456?jobBoardSource=gupy_public_page")).toBe("123456")
    const tok = Buffer.from('{"jobId":12594120,"source":"gupy_portal"}').toString("base64url")
    expect(normalizeId(`https://stefanini.gupy.io/job/${tok}`)).toBe("12594120")
    expect(normalizeId("not-a-job")).toBeNull()
  })

  test("parseJobList skips malformed entries and fills nulls", () => {
    const { cards, total } = parseJobList({
      data: [{ id: 1, name: "Analista", city: "Brasília", state: "Distrito Federal", publishedDate: "2026-09-20T10:00:00Z" }, { name: "sem id" }, null],
      pagination: { total: 3 },
    })
    expect(total).toBe(3)
    expect(cards).toHaveLength(1)
    expect(cards[0]).toMatchObject({ id: "1", title: "Analista", company: null, location: "Brasília, Distrito Federal", date: "2026-09-20" })
  })

  test("decodeEntities decodes nbsp, amp and numeric references", () => {
    expect(decodeEntities("A&nbsp;B &amp; C &#233; &#x41;")).toBe("A B & C é A")
  })

  test("filterByAge keeps recent and undated cards", () => {
    const now = Date.parse("2026-09-25T00:00:00Z")
    const mk = (date: string | null) => ({ id: "1", title: "t", company: null, location: null, date, url: "u", workplaceType: null, type: null, deadline: null })
    const out = filterByAge([mk("2026-09-24"), mk("2026-08-01"), mk(null)], 7, now)
    expect(out.map((c) => c.date)).toEqual(["2026-09-24", null])
  })
})

describe("live smoke test", () => {
  test("search returns real results", async () => {
    const out = parseJSON<SearchOut>(await runCLI(["search", "-q", "analista de suporte", "--limit", "3"]))
    expect(out.results.length).toBeGreaterThan(0)
    for (const r of out.results) {
      expect(r.id).toBeTruthy()
      expect(r.title).toBeTruthy()
      expect(r.url).toMatch(/^https:\/\//)
    }
  })

  test("missing --query exits 1 with JSON error on stderr", async () => {
    const res = await runCLI(["search"])
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("NO_QUERY")
  })

  test("bogus flag exits 1 with UNKNOWN_FLAG", async () => {
    const res = await runCLI(["search", "-q", "x", "--bogus", "1"])
    expect(res.exitCode).toBe(1)
    expect(JSON.parse(res.stderr).code).toBe("UNKNOWN_FLAG")
  })
})
