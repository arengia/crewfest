# Contributing to Crewfest

Thanks for taking a look. This is a small, best-effort project (see the maintenance note in [README.md](README.md)) — issues and PRs are welcome, but please read the note at the bottom before expecting a fast turnaround.

## Dev setup

Requires Node.js ≥ 20.

```bash
npm ci
cp .env.example .env   # fill in at least SESSION_SECRET for anything beyond a quick smoke run
npm run dev
```

`npm run dev` runs the server with `tsx watch` against `src/index.ts` — it restarts on file changes but does **not** rebuild the Tailwind CSS bundle on its own. If you're touching styles, run `npm run build:css` (or rerun it after changes) to regenerate `public/assets/tailwind.css`.

Other useful scripts:

- `npm run seed:shifts -- --force` — wipes and reseeds example positions/shifts (destructive, see the warning printed by the script itself; never run this against real data)
- `npm run db:reset-crew` — resets crew data for a fresh test run

## Build

```bash
npm run build
```

Runs `build:css` (Tailwind) followed by `tsc`, producing `dist/`. `npm start` runs the built output (`node dist/index.js`).

## Smoke test

`scripts/smoke-e2e.sh` is an end-to-end script that exercises the running app: health check → first-run setup or login → create a position + shift → submit a public application (DE + EN) → confirm it shows up in `/admin` → PDF export → CSV export. It's what CI runs on every push (see `.github/workflows/ci.yml`), against both a bare Node process and the built Docker image.

To run it locally against a server you've already started:

```bash
BASE_URL=http://localhost:3001 ADMIN_USERNAME=admin ADMIN_PASSWORD=your-test-password \
  ./scripts/smoke-e2e.sh
```

It doesn't start the server for you — start it first (`npm run dev`, `npm start`, or `docker compose up`), pointed at a database you're fine with the script writing test data into.

## Commit conventions

Please use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, …) for commit messages — it keeps the history scannable and makes changelogs easier to generate later.

## Opening a PR

- Keep PRs focused — one change, one PR, where reasonably possible.
- Run `npm run build` and the smoke test locally before opening the PR; CI will run both anyway, but catching failures early saves a round trip.
- If you're changing user-facing text, remember this app is bilingual (`src/i18n.ts`) — both the `de` and `en` dictionaries need the key, or `t()` will fall back to German and log a warning.
- Briefly explain the *why*, not just the *what*, in the PR description — especially for anything touching auth, sessions, or the CSV import mapping, where the reasoning tends to matter more than the diff.

## A note on response time

This is maintained by one person around a day job and actual festival seasons, not a team with an SLA (see [README.md](README.md#maintenance) and [SECURITY.md](SECURITY.md)). Issues and PRs will get a response, but not necessarily a fast one — thanks for your patience.
