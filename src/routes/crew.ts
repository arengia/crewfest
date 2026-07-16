import { Hono } from 'hono'
import { setSignedCookie } from 'hono/cookie'
import { requireCrewAuth } from '../middleware/crew-auth.js'
import { crewLoginPage } from '../views/crew-login.js'
import { crewCapacityPage } from '../views/crew-capacity.js'
import { getShiftsWithCapacity } from '../services/crew.js'
import { config } from '../config.js'
import { rateLimit } from '../middleware/rate-limit.js'
import { resolveLang } from '../i18n.js'

export const crewRoutes = new Hono()

// GET /crew/login — show password prompt (no auth required)
crewRoutes.get('/login', (c) => {
  const lang = resolveLang(c)
  return c.html(crewLoginPage(lang))
})

// POST /crew/login — validate password, set signed cookie
// Rate limit: 10 attempts / 15 min / IP (best-effort, see middleware/rate-limit.ts)
crewRoutes.post('/login', rateLimit({ name: 'crew-login', limit: 10, windowMs: 15 * 60 * 1000 }), async (c) => {
  const lang = resolveLang(c)
  const body = await c.req.parseBody()
  const password = (body['password'] as string) || ''

  if (password !== config.crewPassword) {
    return c.html(crewLoginPage(lang, { error: true }))
  }

  // Set signed crew session cookie — 24h TTL (per RESEARCH.md Pattern 3)
  await setSignedCookie(c, 'crew_session', 'authenticated', config.sessionSecret, {
    path: '/',
    httpOnly: true,
    sameSite: 'Strict',
    maxAge: 24 * 60 * 60,
    secure: config.cookieSecure,
  })

  return c.redirect('/crew')
})

// Protect all /crew routes beyond /login
// IMPORTANT: registered BEFORE GET / so the capacity page requires auth
// per RESEARCH.md Pitfall 3: middleware must be before GET handlers
crewRoutes.use('/*', requireCrewAuth)

// GET /crew — shift capacity display (requires valid crew_session cookie)
crewRoutes.get('/', (c) => {
  const lang = resolveLang(c)
  const shifts = getShiftsWithCapacity()
  return c.html(crewCapacityPage(shifts, lang))
})
