import { Hono } from 'hono'
import { getShiftsWithPositionFill } from '../services/shifts.js'
import { publicSchichtplanPage } from '../views/public-schichtplan.js'
import { resolveLang } from '../i18n.js'

// Öffentliche, read-only Schichtplan-Übersicht (Ticket #397 Phase 3, Teil D).
// KEINE requireAuth-Middleware — wird in app.ts unter /schichtplan gemountet,
// NICHT unter /admin. Zeigt nur Besetzungsstand, keine Crew-Namen.
export const publicRoutes = new Hono()

publicRoutes.get('/', (c) => {
  const lang = resolveLang(c)
  const rows = getShiftsWithPositionFill()
  return c.html(publicSchichtplanPage(rows, lang))
})
