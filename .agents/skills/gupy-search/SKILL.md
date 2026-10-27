---
name: gupy-search
version: 1.0.0
description: >
  Use this skill whenever the user wants to search for jobs in Brazil on Gupy,
  the largest recruiting platform in the Brazilian market (used by companies such as
  GOL and Stefanini), or look up a specific
  Gupy job posting. Supports city/state and remote/hybrid/on-site filters.
  Trigger phrases: search jobs in Brazil, Gupy jobs, find a job in Brasília /
  São Paulo, vagas de emprego, buscar vagas, vagas na Gupy, oportunidades de
  emprego, vagas remotas, "tem vaga de X em <cidade>", processo seletivo.
context: fork
enabled: true  # set to false to keep this portal installed but have /scrape skip it
allowed-tools: Bash(bun run .agents/skills/gupy-search/cli/src/cli.ts *)
---

# Gupy Search Skill

Search live job listings from **Gupy** (portal.gupy.io), Brazil's largest recruiting
platform. Uses the public JSON API that Gupy's own job-search page calls: no
authentication, no API key, **zero runtime dependencies** (runs with just `bun`).

Access: `portal.gupy.io/robots.txt` allows all paths. Still, keep volume low: this is
for your own job search, not bulk collection.

## When to use this skill

- Search Brazilian job openings by title/keyword, optionally by city, state, or remote/hybrid/on-site
- Get the full description, deadline and contract type of a Gupy posting

## Commands

### Search job listings

```bash
bun run .agents/skills/gupy-search/cli/src/cli.ts search --query "<cargo>" [flags]
```

- `--query <text>` / `-q <text>`: **required.** Job title or keyword, in Portuguese (e.g. `"analista de suporte"`).
- `--location <city>` / `-l <city>`: city as Gupy writes it, with accents (`"Brasília"`, `"São Paulo"`).
- `--state <name>`: full state name (`"Distrito Federal"`, `"São Paulo"`).
- `--remote <mode>`: `remote`, `hybrid` or `onsite`.
- `--jobage <days>`: published within N days. **Client-side filter** (the API has no age parameter); results are sorted newest first, so the filter only trims the fetched page.
- `--page <n>`: 1-indexed page, 20 results per page, newest first.
- `--limit <n>` / `-n <n>`: cap results emitted.
- `--format json|table|plain`: default `json`.

### Fetch full job detail

```bash
bun run .agents/skills/gupy-search/cli/src/cli.ts detail <id|url> [--format json|plain]
```

Accepts the numeric id from `search`, a `<empresa>.gupy.io/job/<token>` URL, or a legacy
`<empresa>.gupy.io/jobs/<id>` URL.

## Usage examples

```bash
# Suporte em Brasília
bun run .agents/skills/gupy-search/cli/src/cli.ts search -q "analista de suporte" -l "Brasília" --format table

# Dados, remoto, últimos 14 dias
bun run .agents/skills/gupy-search/cli/src/cli.ts search -q "analista de dados" --remote remote --jobage 14 --format table

# Desenvolvedor no Distrito Federal (qualquer cidade do estado)
bun run .agents/skills/gupy-search/cli/src/cli.ts search -q "desenvolvedor" --state "Distrito Federal" --format table

# Segunda página de resultados
bun run .agents/skills/gupy-search/cli/src/cli.ts search -q "cientista de dados" --page 2 --format table

# Detalhe de uma vaga
bun run .agents/skills/gupy-search/cli/src/cli.ts detail 12594120 --format plain
```

## Output formats

| Format | Best for |
|--------|----------|
| `json` | Default: programmatic use, passing IDs to `detail` |
| `table` | Quick scanning (includes work mode) |
| `plain` | Reading one job's full detail |

Each search result has `id`, `title`, `company`, `location`, `date`, `url`, plus
`workplaceType`, `type` (e.g. `vacancy_type_effective` = CLT, `vacancy_type_internship` =
estágio, `vacancy_legal_entity` = PJ) and `deadline`. Missing values are `null`.

All errors go to **stderr** as `{ "error": "...", "code": "..." }` with exit code `1`.

## Notes

- The API is undocumented (it backs portal.gupy.io's own search page); if it changes, see `url-reference.md`.
- `meta.total` reports Gupy's total match count (capped by the API; it paginates at most a few hundred results).
- Descriptions come as plain text; Gupy sometimes concatenates paragraphs without a separator.
- Location values are exact-match strings with accents: `"Brasilia"` without the accent returns nothing.
- Applying requires a Gupy account on the company's page (`url`); the skill only searches.
