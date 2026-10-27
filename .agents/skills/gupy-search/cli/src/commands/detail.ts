import { DETAIL_URL, jsonFetch, normalizeId, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse a Gupy job ID from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const body = await jsonFetch(`${DETAIL_URL}/${id}`)
    const job = body ? parseJobDetail(body) : null
    if (!job) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"} · ${job.workplaceType || "—"}`,
        `Publicada: ${job.date || "—"} · Prazo: ${job.deadline || "—"} · Tipo: ${job.type || "—"}${job.pwd ? " · PcD" : ""}`,
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
      ]
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
