// Central configuration. Reads the environment ONCE, validates it at startup, and
// exposes a typed, frozen config object. Import this instead of touching process.env
// directly, so validation and defaults live in one place.

import dotenv from 'dotenv'
dotenv.config()

const NODE_ENV = process.env.NODE_ENV ?? 'development'
const isProduction = NODE_ENV === 'production'

// A value is an unsafe placeholder if it is empty or a shipped "change-me" default.
function isPlaceholder(v: string | undefined): boolean {
  return !v || v.startsWith('change-me')
}

const rawSessionSecret = process.env.SESSION_SECRET ?? ''
const adminUsername = process.env.ADMIN_USERNAME
const adminPassword = process.env.ADMIN_PASSWORD
const crewPassword = process.env.CREW_PASSWORD

// ─── Startup validation — refuse to boot insecurely in production ───────────────
const errors: string[] = []
if (isProduction) {
  if (isPlaceholder(rawSessionSecret)) {
    errors.push('SESSION_SECRET is missing or still set to a "change-me" placeholder')
  }
  if (adminPassword !== undefined && isPlaceholder(adminPassword)) {
    errors.push('ADMIN_PASSWORD is set to a "change-me" placeholder')
  }
  if (crewPassword !== undefined && isPlaceholder(crewPassword)) {
    errors.push('CREW_PASSWORD is set to a "change-me" placeholder')
  }
}
if (errors.length > 0) {
  console.error('Refusing to start in production with insecure configuration:')
  for (const e of errors) console.error('  - ' + e)
  console.error('Set strong values in your .env (see .env.example) and restart.')
  process.exit(1)
}

// Outside production, fall back to a fixed dev secret so signed cookies work in
// local/dev/smoke runs even without an .env. Never reached in production.
let sessionSecret = rawSessionSecret
if (!isProduction && !sessionSecret) {
  sessionSecret = 'dev-insecure-secret-change-me'
  console.warn('SESSION_SECRET not set — using an insecure development fallback. Do NOT use in production.')
}

// COOKIE_SECURE: default true in production, false otherwise; an explicit value wins.
// Set COOKIE_SECURE=false when serving over plain HTTP (e.g. Docker on http://host:3001),
// otherwise login cookies are dropped and users hit a login loop.
const cookieSecureEnv = process.env.COOKIE_SECURE
const cookieSecure = cookieSecureEnv != null ? cookieSecureEnv === 'true' : isProduction

export const config = {
  nodeEnv: NODE_ENV,
  isProduction,
  port: parseInt(process.env.PORT ?? '3001', 10),
  dbPath: process.env.DB_PATH ?? './data/crewfest.db',
  uploadsDir: process.env.UPLOADS_DIR ?? 'var/uploads',
  sessionSecret,
  crewPassword,
  adminUsername,
  adminPassword,
  cookieSecure,
} as const
