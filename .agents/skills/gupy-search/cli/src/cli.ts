#!/usr/bin/env bun
// Self-contained CLI for searching jobs on Gupy (Brazil's largest recruiting
// platform) via its public job-search JSON API. Zero runtime dependencies:
// runs anywhere `bun` is available.

import { runSearch, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  const alias: Record<string, string> = { q: "query", l: "location", n: "limit" }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith("-")) {
      const key = alias[a.replace(/^-+/, "")] ?? a.replace(/^-+/, "")
      const next = argv[i + 1]
      if (next === undefined || next.startsWith("-")) {
        flags[key] = true
      } else {
        flags[key] = next
        i++
      }
    } else {
      ;(flags._ as string[]).push(a)
    }
  }
  return flags
}

const HELP = `gupy-cli — search jobs on Gupy (Brasil)

USAGE
  bun run src/cli.ts search --query "<cargo>" [flags]
  bun run src/cli.ts detail <id|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Job title / keyword. REQUIRED (e.g. "analista de suporte").
  --location, -l <city>   City, as Gupy writes it (e.g. "Brasília", "São Paulo").
  --state <state>         State name (e.g. "Distrito Federal", "São Paulo").
  --remote <mode>         remote | hybrid | onsite.
  --jobage <days>         Published within N days (client-side filter on the fetched page).
  --page <n>              1-indexed page (20 results/page, newest first). Default 1.
  --limit, -n <n>         Cap results emitted (client-side).
  --format <fmt>          json (default) | table | plain.

EXAMPLES
  bun run src/cli.ts search -q "analista de suporte" -l "Brasília" --format table
  bun run src/cli.ts search -q "analista de dados" --remote remote --jobage 14 --format table
  bun run src/cli.ts detail 12594120 --format plain
`

const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set(["query", "location", "state", "remote", "jobage", "page", "limit", "format", "help", "h"]),
  detail: new Set(["format", "help", "h"]),
}

function fail(error: string, code: string): number {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
  return 1
}

function intFlag(name: string, raw: string | boolean | string[]): number | null {
  const val = typeof raw === "string" ? Number(raw.trim()) : NaN
  return Number.isInteger(val) && val >= 1 ? val : null
}

async function main(): Promise<number> {
  const flags = parseFlags(process.argv.slice(2))
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  const known = KNOWN_FLAGS[cmd]
  if (!known) return fail(`Unknown command "${cmd}"`, "BAD_CMD")
  for (const key of Object.keys(flags)) {
    if (key !== "_" && !known.has(key)) {
      return fail(`unknown flag --${key} for '${cmd}' - flags are never silently ignored; see --help`, "UNKNOWN_FLAG")
    }
  }

  const str = (k: string) => (typeof flags[k] === "string" ? (flags[k] as string) : undefined)
  const fmt = str("format") || "json"

  if (cmd === "search") {
    const query = str("query")
    if (!query) return fail('the --query/-q flag is required (e.g. -q "analista de suporte")', "NO_QUERY")
    if (flags.remote !== undefined && !["remote", "hybrid", "onsite", "on-site"].includes(String(flags.remote))) {
      return fail(`--remote must be remote, hybrid or onsite, got "${flags.remote}"`, "BAD_ARG")
    }
    const nums: Record<string, number | undefined> = {}
    for (const k of ["jobage", "page", "limit"]) {
      if (flags[k] === undefined) continue
      const v = intFlag(k, flags[k])
      if (v === null) return fail(`--${k} must be a whole number of at least 1, got "${flags[k]}"`, "BAD_ARG")
      nums[k] = v
    }
    const opts: SearchOpts = {
      query,
      location: str("location"),
      state: str("state"),
      remote: str("remote"),
      jobage: nums.jobage,
      page: nums.page ?? 1,
      limit: nums.limit,
      format: (["json", "table", "plain"].includes(fmt) ? fmt : "json") as SearchOpts["format"],
    }
    return runSearch(opts)
  }

  const id = (flags._ as string[])[1]
  if (!id) return fail("detail requires an <id|url>", "NO_ID")
  const opts: DetailOpts = { id, format: fmt === "plain" ? "plain" : "json" }
  return runDetail(opts)
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    process.stderr.write(JSON.stringify({ error: e instanceof Error ? e.message : String(e), code: "INTERNAL_ERROR" }) + "\n")
    process.exit(1)
  })
