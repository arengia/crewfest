import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { validateSession } from '../services/session.js'

export type AuthEnv = {
  Variables: {
    adminId: number
    adminUsername: string
  }
}

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const sessionId = getCookie(c, 'session')
  if (!sessionId) {
    const redirect = encodeURIComponent(c.req.path)
    return c.redirect(`/admin/login?redirect=${redirect}`)
  }

  const session = validateSession(sessionId)
  if (!session) {
    const redirect = encodeURIComponent(c.req.path)
    return c.redirect(`/admin/login?redirect=${redirect}`)
  }

  c.set('adminId', session.adminId)
  c.set('adminUsername', session.username)
  await next()
})
