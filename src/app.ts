import { Hono } from 'hono'
import { csrf } from 'hono/csrf'
import { secureHeaders } from 'hono/secure-headers'
import { serveStatic } from '@hono/node-server/serve-static'
import { authRoutes } from './routes/auth.js'
import { adminRoutes } from './routes/admin.js'
import { applyRoutes } from './routes/apply.js'
import { crewRoutes } from './routes/crew.js'
import { publicRoutes } from './routes/public.js'

const app = new Hono()

// Security headers on every response, incl. a CSP tailored to this app: all
// scripts/styles are inline (no external JS/CSS beyond /public/assets/tailwind.css,
// which is same-origin -> 'self'), so script-src/style-src need 'unsafe-inline'
// rather than blocking inline entirely. Images: same-origin (photo uploads served
// via /admin/crew/:id/photo) plus data: (none currently emitted, kept for
// headroom). See SECURITY.md.
app.use(secureHeaders({
  xFrameOptions: 'DENY',
  contentSecurityPolicy: {
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:'],
    defaultSrc: ["'self'"],
  },
}))

// CSRF protection for all POST requests
app.use(csrf())

// Serve static files from public/
app.use('/public/*', serveStatic({ root: './' }))

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

// Public application form - no auth (D-06)
app.route('/apply', applyRoutes)

// Public read-only shift plan overview - no auth, no crew names (#397 Phase 3)
app.route('/schichtplan', publicRoutes)

// Crew capacity page - password gate is inside crewRoutes
app.route('/crew', crewRoutes)

// Auth routes (login, setup, logout) - no auth middleware
app.route('/', authRoutes)

// Protected admin routes - requireAuth middleware applied inside adminRoutes
app.route('/admin', adminRoutes)

export default app
