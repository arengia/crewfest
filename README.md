<p align="right"><a href="README.md"><strong>English</strong></a> · <a href="README.de.md">Deutsch</a></p>

# Crewfest

**The lightweight alternative for festival crew scheduling.**

Crewfest is a small, self-hosted tool for running a festival crew from open call to check-in: a public application form, an admin dashboard to review and shortlist, a shift planner with capacities and auto-suggestions, and PDF/CSV exports for the ground. One SQLite file, no cloud, no account required to apply.

<table>
<tr>
<td width="33%"><img src="docs/screenshots/admin-shifts-en.png" alt="Shift plan with capacities and an assignment panel open"></td>
<td width="33%"><img src="docs/screenshots/apply-mobile-en.png" alt="Public application form on mobile"></td>
<td width="33%"><img src="docs/screenshots/public-schedule-en.png" alt="Public shift schedule, calendar view"></td>
</tr>
<tr>
<td>Admin shift plan — capacities, assignments, level warnings</td>
<td>Public application form — mobile-first, no account needed</td>
<td>Public shift schedule — list, calendar, or timeline view</td>
</tr>
</table>

More screenshots (admin dashboard, settings/branding) are in [`docs/screenshots/`](docs/screenshots/).

## What is Crewfest / who it's for

Crewfest covers the whole lifecycle of a volunteer crew for a single event: applicants apply through a public form, an admin sifts and levels them, assigns them to shifts and positions with capacity limits, and hands out PDF/CSV exports for the door, the bar, and the check-in table.

It's built for crews of roughly **20 to 100 people** — a bar crew, a stage crew, a volunteer team for a smaller festival or conference. If you already run (or are considering) [Engelsystem](https://github.com/engelsystem/engelsystem) — the shift-planning system built for and battle-tested at large Chaos Computer Club events — that's a genuinely good, mature, actively developed piece of software, and for congress-scale operations with hundreds of shifts and angel types it's very likely the better fit. Crewfest exists for the crews below that scale, where Engelsystem's depth (and setup) is more than you need and a single SQLite file you can understand end to end is worth more than a feature you'll never touch.

No cloud account, no SaaS subscription, no data leaving your own server. If you can run one Docker container, you can run Crewfest.

## Story

*This project is not affiliated with, endorsed by, or connected to Kulturkosmos e.V. or the Fusion Festival.*

*Crewfest was built in 2026 for a festival bar crew of around 100 volunteers, including a stint at the Fusion Festival, and ran a full festival there in production — real applications, real shift assignments, real PDF checklists at the bar. That's where the feature set comes from: it's shaped by what an actual crew of that size needed and nothing it didn't.*

## Features

- Public application form, no account required, mobile-first
- Self-assessed experience level (1–5), auto-derived from a short questionnaire
- Admin dashboard to review applications, assign levels, and move people through the status flow: `applied → shortlisted → shift_selection → confirmed → declined`
- Shift & position management with per-position capacities
- Assignment tools: individual assignment, group assignment, and auto-suggested candidates per open slot
- Shift plan views: cards (with the assignment flow), calendar, list, and timeline
- Public, read-only shift schedule (occupancy only, no crew names)
- PDF exports: full shift overview, a compact selection printout, and check-in/check-out checklists
- CSV import from Google Forms exports, and CSV exports (crew list, external registration list)
- Bilingual throughout (German/English) — instance default plus a per-visitor `?lang=` override
- Configurable branding: event name, organisation, contact email
- Runs fully offline — no external CDNs, fonts and icons are bundled
- Shared-password crew view for a read-only look at shift occupancy, no admin access

## Quickstart (Docker)

```bash
git clone https://github.com/arengia/crewfest.git
cd crewfest
docker compose up
```

Then open **http://localhost:3001/setup** to create your first admin account.

Before you go further than a quick local test, set a real `SESSION_SECRET` — generate one with:

```bash
openssl rand -hex 32
```

Put it in a `.env` file next to `docker-compose.yml` (copy `.env.example` to `.env` as a starting point) or export it before `docker compose up`. The app refuses to start in production without it.

If you're serving over plain HTTP without a TLS-terminating reverse proxy (e.g. `http://your-host:3001` on a LAN), also set `COOKIE_SECURE=false` — otherwise the login cookie gets dropped by the browser and you'll hit a login loop. `docker-compose.yml` has a commented-out `COOKIE_SECURE: "false"` line for this — it's off by default (the secure default is the right choice unless you know you're on plain HTTP), so uncomment it yourself if this applies to you.

## Alternative: run with Node.js directly

```bash
npm ci
npm run build
npm start
```

This needs Node.js ≥ 20 and a system Chromium/Chrome available for PDF exports (see `CHROMIUM_PATH` below — the Docker image installs one for you; running outside Docker you'll need to point at your own). Copy `.env.example` to `.env` and fill in `SESSION_SECRET` at minimum.

For a long-running deployment outside Docker, a process manager like [pm2](https://pm2.keymetrics.io/) is a reasonable choice to keep Crewfest running and restart it on crashes or reboot:

```bash
npm install -g pm2
pm2 start dist/index.js --name crewfest
pm2 save
```

## Configuration

All configuration is environment variables (see `.env.example`).

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | HTTP port the app listens on |
| `NODE_ENV` | `development` | Set to `production` for a real deployment — enables the startup security checks below |
| `SESSION_SECRET` | — | **Required in production.** Long random string signing session cookies. Generate with `openssl rand -hex 32`. The app refuses to boot in production if this is missing or left as a placeholder |
| `DB_PATH` | `./data/crewfest.db` | Path to the SQLite database file |
| `UPLOADS_DIR` | `var/uploads` | Directory for uploaded applicant photos — stored outside `public/`, never served statically, delivered only through an admin-authenticated route |
| `COOKIE_SECURE` | `true` in production, `false` otherwise | Cookie `Secure` flag. Set to `false` when serving plain HTTP without a TLS-terminating proxy (e.g. Docker on `http://host:3001`), otherwise the login cookie is dropped and you get a login loop |
| `CREW_PASSWORD` | unset | Shared password for the read-only `/crew` capacity page. Leave unset to keep that page closed entirely |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | unset | On startup, creates the admin account if it doesn't exist, or **resets its password** if it does. Handy for first setup or recovering a forgotten password — remove both once the account is set up, to avoid accidental resets on every restart |
| `CHROMIUM_PATH` | unset (Puppeteer's own Chromium) | Path to a system Chromium/Chrome binary, used for PDF generation. The Docker image sets this to the Chromium it installs; only relevant if you're running outside Docker and want to reuse a system browser instead of Puppeteer's bundled one |

## Language support

Crewfest is bilingual (German/English) throughout — the public form, admin UI, PDF exports, and CSV headers. The active language is resolved in this order: an explicit `?lang=de` or `?lang=en` query parameter (which also sets a one-year cookie) → that cookie → the instance's configured default language (set under **Settings → Branding**) → German. There's a small DE/EN switcher in the footer of every public page and the admin sidebar.

## Data protection (GDPR)

Crewfest is self-hosted: **you are the data controller** for whatever instance you run, not us. The application form collects personal data — name, email, optionally phone number and a photo — and the admin area stores it until you remove it.

A few things worth doing if you're processing real applicant data:

- Put a TLS-terminating reverse proxy in front (see `COOKIE_SECURE` above) — applicant data, including photos, should never travel in plaintext.
- Delete crew data after the event once you no longer need it. Crewfest doesn't do this automatically; a fresh SQLite file per event (or a deliberate cleanup pass) is a reasonable pattern if you run multiple events.
- Restrict who has admin access — anyone with the admin login can see every applicant's contact details, photo, and free-text answers.

## Security

See [SECURITY.md](SECURITY.md) for the vulnerability reporting process, supported versions, and a list of known, intentional limitations (rate limiting, the shared crew password, and how PDF generation is sandboxed).

## Roadmap / ideas

Not promises, just things that seem worth doing if there's interest:

- Multi-admin account management (currently a single shared admin account model)
- Additional languages beyond German/English
- Configurable application form fields, instead of the current fixed set

## Contributing

Issues and PRs are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, the smoke test, and commit conventions.

## Maintenance

Crewfest is maintained on a best-effort basis by a festival organiser with a day job, not a company with an SLA. There are no support guarantees and no fixed response time — issues and PRs get looked at when time allows.

## License

[MIT](LICENSE) © 2026 Adrien Renauldon
