import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { loginPage } from '../views/login.js'
import { setupPage } from '../views/setup.js'
import { createSession, destroySession } from '../services/session.js'
import { createAdminIfNone, authenticateAdmin, getAdminCount } from '../services/admin.js'
import { config } from '../config.js'
import { rateLimit } from '../middleware/rate-limit.js'
import { t, resolveLang } from '../i18n.js'

export const authRoutes = new Hono()

// GET /admin/login - Show login page (redirect to /setup if no admins)
authRoutes.get('/admin/login', (c) => {
  const lang = resolveLang(c)
  const count = getAdminCount()
  if (count === 0) {
    return c.redirect('/setup')
  }
  // Flash-Code aus dem Redirect nach /setup (kein Freitext mehr, siehe POST /setup).
  const flashCode = c.req.query('flash')
  const flash = flashCode === 'account_created' ? t(lang, 'login.flash.accountCreated') : undefined
  return c.html(loginPage(lang, flash ? { flash } : undefined))
})

// POST /admin/login - Authenticate admin
// Rate limit: 10 attempts / 15 min / IP (best-effort, see middleware/rate-limit.ts)
authRoutes.post('/admin/login', rateLimit({ name: 'admin-login', limit: 10, windowMs: 15 * 60 * 1000 }), async (c) => {
  const lang = resolveLang(c)
  const body = await c.req.parseBody()
  const username = body.username as string
  const password = body.password as string

  const admin = await authenticateAdmin(username, password)
  if (!admin) {
    return c.html(loginPage(lang, { error: t(lang, 'login.error.invalidCredentials') }))
  }

  const sessionId = createSession(admin.id)
  setCookie(c, 'session', sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60,
    secure: config.cookieSecure,
  })

  // Only follow same-site, relative redirects (`/foo`) — never a scheme-relative
  // one (`//evil.example`, which browsers resolve as a protocol-relative absolute
  // URL to another host). Anything else falls back to /admin.
  const redirectParam = c.req.query('redirect') || '/admin'
  const redirect = redirectParam.startsWith('/') && !redirectParam.startsWith('//')
    ? redirectParam
    : '/admin'
  return c.redirect(redirect)
})

// GET /setup - First-run setup page (404 if admins exist)
authRoutes.get('/setup', (c) => {
  const lang = resolveLang(c)
  if (getAdminCount() > 0) {
    return c.notFound()
  }
  return c.html(setupPage(lang))
})

// POST /setup - Create first admin account
authRoutes.post('/setup', async (c) => {
  const lang = resolveLang(c)
  if (getAdminCount() > 0) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const username = body.username as string
  const password = body.password as string
  const confirm = body.confirm as string

  if (password !== confirm) {
    return c.html(setupPage(lang, { error: 'password_mismatch' }))
  }

  let adminId: number | null
  try {
    adminId = await createAdminIfNone(username, password)
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed')) {
      return c.html(setupPage(lang, { error: 'username_taken' }))
    }
    throw err
  }

  if (adminId === null) {
    // Lost the race against a concurrent /setup request — an admin now exists,
    // so this is no longer a valid first-run setup.
    return c.notFound()
  }

  // Flash-Code statt Freitext, damit /admin/login ihn sprachabhängig übersetzen kann.
  return c.redirect('/admin/login?flash=account_created')
})

// GET /admin/logout - Destroy session and redirect to login
authRoutes.get('/admin/logout', (c) => {
  const sessionId = getCookie(c, 'session')
  if (sessionId) {
    destroySession(sessionId)
  }
  deleteCookie(c, 'session', { path: '/' })
  return c.redirect('/admin/login')
})
