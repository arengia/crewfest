# Security Policy

## Supported versions

Only the **latest released version** of Crewfest is supported with security fixes. There are no maintained older release branches — if you're running an older version, please update before reporting an issue, if practical.

## Reporting a vulnerability

Please report security vulnerabilities privately, not in a public issue. Use GitHub's built-in **"Report a vulnerability"** flow on this repository: **Security tab → Advisories → Report a vulnerability**. That creates a private advisory that only maintainers can see until it's resolved.

Please don't open a public issue or PR for a vulnerability before it's been triaged privately.

### What to expect

This project is maintained on a **best-effort basis** (see the maintenance note in [README.md](README.md)) — there's no SLA and no guaranteed response time. Reports will be looked at and acknowledged as time allows. If a report turns out to be a real vulnerability, a fix will be prioritized over other work; how fast that lands still depends on severity and available time.

## Known limitations

These are deliberate, documented trade-offs for a small, self-hosted tool — not oversights — but you should know about them before exposing an instance to the internet.

- **Rate limiting is in-memory and best-effort.** `src/middleware/rate-limit.ts` keeps a per-process map of recent requests per IP, applied to the application form, admin login, and crew login. It resets on every restart, keeps no shared state across multiple instances/replicas, and reads the client IP from `X-Forwarded-For` — which is trivially spoofable unless you're behind a proxy that sets that header correctly and strips any client-supplied value. This raises the bar against naive brute-force/spam; it is **not** a substitute for a real gateway/WAF rate limiter if you expect adversarial traffic.
- **The crew capacity view uses a single shared password**, not individual accounts (`CREW_PASSWORD`, checked via a signed cookie). This is intentional — it's a read-only occupancy view meant for a whole crew to glance at, and a shared password keeps that simple. It also means anyone with that password can see it, and there's no per-person audit trail or revocation short of rotating the password for everyone.
- **Session cookies:** admin sessions use a random 32-byte token, `HttpOnly`, `SameSite=Strict`, a 7-day expiry, and the `Secure` flag by default in production. If you serve over plain HTTP without a TLS-terminating reverse proxy, you must explicitly set `COOKIE_SECURE=false` (see README) — understand that this means session and crew cookies travel unencrypted in that setup. Don't do this on a network you don't trust.
- **Chromium runs with `--no-sandbox` in the container** (`src/services/pdf.ts`), which is what makes headless Chromium work reliably as a non-root container user without extra kernel privileges. This is only used to render this application's own server-generated HTML templates for PDF export (shift plans, selections, checklists) — never arbitrary or third-party HTML/URLs — and all applicant-supplied text going into those templates is auto-escaped by Hono's `html` tagged-template rendering, not inserted as raw markup. If you fork this project to render untrusted HTML through the same Puppeteer instance, re-evaluate this sandboxing decision first.
- **Passwords:** admin passwords are hashed with bcrypt (cost factor 12). The crew password and `SESSION_SECRET`/`ADMIN_PASSWORD` environment defaults ship as placeholders (`change-me`) — the app refuses to start in production if `SESSION_SECRET` or a set `ADMIN_PASSWORD`/`CREW_PASSWORD` is still a placeholder. Replace them for any real deployment.

## Other hardening in place

- **Security headers + CSP** on every response (`src/app.ts`, Hono's `secureHeaders()`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, and a `Content-Security-Policy` scoped to this app (`default-src 'self'`; `script-src`/`style-src` allow `'unsafe-inline'` for the inline `<script>`/style attributes the admin UI uses; `img-src` allows `self` and `data:` only — a `crew.attachment_url` from a CSV import is rendered as an `<img>` only if it's `https://`, otherwise as an escaped text link).
- **Body size limits** ahead of `parseBody()` on upload routes (`hono/body-limit`), so an oversized request body is rejected before being read into memory at all: 5 MB on `POST /apply`, 10 MB on the CSV import routes — both above the pre-existing per-file caps (3 MB attachment, 5 MB CSV) that still apply after parsing.
- **CSV export formula-injection neutralization** (`src/services/export.ts`): any cell starting with `=`, `+`, `-`, `@`, tab, or CR — e.g. a crew member's `first_name` submitted as `=SUM(1)` — gets a leading `'` prefixed before quoting, so spreadsheet apps (Excel/Sheets/LibreOffice) treat it as text instead of evaluating it as a formula.

### Recommendations for running an instance

- Put a TLS-terminating reverse proxy in front of Crewfest for any deployment reachable outside your own LAN, and keep `COOKIE_SECURE=true` behind it.
- Set a real `SESSION_SECRET` (`openssl rand -hex 32`) and a real `CREW_PASSWORD`/admin password before going live — see [README.md](README.md#configuration).
- If you expect hostile traffic (not just casual over-submission), put a real rate limiter/WAF in front rather than relying solely on the built-in one.
