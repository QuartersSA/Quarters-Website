# Quarters Website — Instructions for Claude

> **Architecture reference:** Before non-trivial work, read [.claude/architecture.md](.claude/architecture.md)
> for the full feature map, server/SSR architecture, auth flows, data layer, custom plugins, and project gotchas.

## Deployment context

This project is deployed on **Railway** and serves traffic from `quarters.sa`. Railway does **not** rebuild the project on its own — it serves the pre-built files directly from the `build/` directory in the repository.

## Critical rules

### 1. Always rebuild before pushing

Before any `git commit` or `git push` that touches application source code (anything in `src/`, `__create/`, `vite.config.ts`, `react-router.config.ts`, `package.json`, etc.), run:

```bash
bun run build
```

Then stage **both** the source changes and the resulting `build/` directory in the same commit. If you push source code without an updated `build/`, the live site will silently keep running the old version while GitHub shows the new code — debugging that mismatch wastes time.

### 2. Never add `build/` to `.gitignore`

The `build/` directory **must** be committed to the repository. Railway serves these files directly. Adding `build/` to `.gitignore` will break the production deploy: Railway will have nothing to serve and the domain will keep showing the old (or no) version.

If you see `build/` in `.gitignore`, remove it. Do not add it back under any circumstance.

### 3. Standard commit flow for code changes

```bash
# 1. Make your source code changes
# 2. Build
bun run build

# 3. Stage source + build together
git add <source files> build/

# 4. Commit
git commit -m "..."

# 5. Push
git push
```

### 4. Documentation-only or config-only changes

If a change does **not** affect compiled output (e.g., editing `README.md`, `.gitignore` itself, CI config, this file), you don't need to rebuild. Use judgment — when in doubt, rebuild.

## Common tasks

- **Dev server**: `bun run dev` (configured to read `PORT` from env, defaults to 4000)
- **Production server (local)**: `node --env-file=.env ./build/server/index.js` (requires `bun run build` first)
- **Build**: `bun run build`
- **Type check**: `bun run typecheck`

## Environment variables

`.env` is gitignored and contains secrets (`DATABASE_URL`, `AUTH_SECRET`, etc.). Never commit it. When running the production server locally, pass `--env-file=.env` to Node so it loads these.

## Caveman Mode

This project uses **caveman mode** by default for chat responses (set up via [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) hooks).

**Rules for chat replies:**
- Drop articles (a/an/the), filler (just/really/basically), pleasantries (sure/of course), hedging
- Fragments OK — `[thing] [action] [reason]. [next step].`
- Short synonyms preferred (big not extensive, fix not "implement a solution for")
- Technical terms exact, code blocks unchanged, errors quoted exact
- Caveman mode does **NOT** apply to: code/commits/PRs/security warnings/irreversible actions — those stay normal English/Arabic

Toggle: `stop caveman` / `normal mode` to disable for current session.
