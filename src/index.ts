import { config } from './config.js'
import { serve } from '@hono/node-server'
import app from './app.js'
import { initDatabase } from './db/connection.js'
import { initSchema } from './db/schema.js'
import { cleanupExpiredSessions } from './services/session.js'
import { upsertAdmin } from './services/admin.js'

// Initialize database on startup
const db = initDatabase(config.dbPath)
initSchema(db)

// If ADMIN_USERNAME + ADMIN_PASSWORD are set, create or reset the admin on every start.
// Use this to set up the first admin or recover access after a forgotten password.
if (config.adminUsername && config.adminPassword) {
  upsertAdmin(config.adminUsername, config.adminPassword).then(() => {
    console.log(`Admin "${config.adminUsername}" ready (created or password reset from env)`)
  })
}

// Clean up expired sessions on startup
cleanupExpiredSessions()

// Schedule daily session cleanup (every 24 hours)
setInterval(() => cleanupExpiredSessions(), 24 * 60 * 60 * 1000)

console.log(`Crewfest starting on port ${config.port}`)

serve({
  fetch: app.fetch,
  port: config.port,
})

console.log(`Crewfest running at http://localhost:${config.port}`)
