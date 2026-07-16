import { createMiddleware } from 'hono/factory'
import { getSignedCookie } from 'hono/cookie'
import { config } from '../config.js'

export const requireCrewAuth = createMiddleware(async (c, next) => {
  const val = await getSignedCookie(c, config.sessionSecret, 'crew_session')
  if (val !== 'authenticated') {
    return c.redirect('/crew/login')
  }
  await next()
})
