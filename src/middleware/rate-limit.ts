import { createMiddleware } from 'hono/factory'
import type { Context } from 'hono'
import { t, resolveLang } from '../i18n.js'

// Best-effort in-memory rate limiter.
//
// Intentionally simple: a per-process Map of "bucket:ip" -> request timestamps,
// pruned on each access (sliding window). This is NOT a substitute for a real
// gateway/WAF rate limiter — it keeps no shared state across instances, resets on
// restart, and trusts x-forwarded-for (spoofable without a trusted proxy). It only
// raises the bar against naive brute-force/spam. See SECURITY.md.

interface RateLimitOptions {
  name: string      // bucket name — keeps different endpoints independent
  limit: number     // max requests per window per IP
  windowMs: number  // sliding-window length in ms
}

const hits = new Map<string, number[]>()

// Defensive bounds — both the "bucket:ip" keys and the timestamp arrays only ever
// grew before this fix. `hits` is keyed off X-Forwarded-For, which is spoofable
// (see comment above), so an attacker rotating it can otherwise grow this map
// without bound, and a key that's hit once and never revisited kept its stale
// array forever (pruning only happened lazily, on the next access to that exact
// key).
const MAX_ENTRIES = 50_000
const SWEEP_INTERVAL_MS = 10 * 60 * 1000

// Widest window across all buckets registered so far (rateLimit() factories run
// once per route at startup, not per request) — used by the sweep below to know
// when a timestamp is definitely stale, without the sweep needing to know which
// bucket a given Map entry belongs to (all buckets share this one Map).
let widestWindowMs = 0

// Periodic sweep: drop entries whose timestamps have all aged out, and shrink
// entries that are partially stale. unref() so this timer never keeps the
// process alive on its own.
const sweepTimer = setInterval(() => {
  if (widestWindowMs === 0) return
  const now = Date.now()
  for (const [key, timestamps] of hits) {
    const fresh = timestamps.filter((ts) => now - ts < widestWindowMs)
    if (fresh.length === 0) {
      hits.delete(key)
    } else if (fresh.length !== timestamps.length) {
      hits.set(key, fresh)
    }
  }
}, SWEEP_INTERVAL_MS)
sweepTimer.unref()

function clientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return c.req.header('x-real-ip') ?? 'unknown'
}

export function rateLimit(opts: RateLimitOptions) {
  widestWindowMs = Math.max(widestWindowMs, opts.windowMs)
  return createMiddleware(async (c, next) => {
    const key = `${opts.name}:${clientIp(c)}`
    const now = Date.now()
    const recent = (hits.get(key) ?? []).filter((t) => now - t < opts.windowMs)
    if (recent.length >= opts.limit) {
      c.header('Retry-After', String(Math.ceil(opts.windowMs / 1000)))
      const lang = resolveLang(c)
      return c.text(t(lang, 'common.rateLimited'), 429)
    }
    recent.push(now)

    // Cap total tracked keys: evict the oldest entry (Map preserves insertion
    // order) before adding a brand-new one once the cap is reached.
    if (!hits.has(key) && hits.size >= MAX_ENTRIES) {
      const oldestKey = hits.keys().next().value
      if (oldestKey !== undefined) hits.delete(oldestKey)
    }

    hits.set(key, recent)
    await next()
  })
}
