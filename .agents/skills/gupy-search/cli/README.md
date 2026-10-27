# gupy-cli

Search Brazilian job listings on Gupy (portal.gupy.io) from the command line.
Zero runtime dependencies: `bun install` only pulls dev types for `typecheck`.

```bash
bun run src/cli.ts search -q "analista de suporte" -l "Brasília" --format table
bun run src/cli.ts detail 12594120 --format plain
bun run test        # offline parsing tests + a live smoke test
bun run typecheck
```

See `../SKILL.md` for all flags and `../url-reference.md` for the API endpoints.
