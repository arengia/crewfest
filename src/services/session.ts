import crypto from 'node:crypto'
import { getDb } from '../db/connection.js'

export function createSession(adminId: number): string {
  const db = getDb()
  const sessionId = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  db.prepare('INSERT INTO sessions (id, admin_id, expires_at) VALUES (?, ?, ?)')
    .run(sessionId, adminId, expiresAt)
  return sessionId
}

export function validateSession(sessionId: string): { adminId: number; username: string } | null {
  const db = getDb()
  const row = db.prepare(
    "SELECT admin_id FROM sessions WHERE id = ? AND expires_at > datetime('now')"
  ).get(sessionId) as { admin_id: number } | undefined
  if (!row) return null

  const admin = db.prepare('SELECT username FROM admins WHERE id = ?')
    .get(row.admin_id) as { username: string } | undefined
  if (!admin) return null

  return { adminId: row.admin_id, username: admin.username }
}

export function destroySession(sessionId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
}

export function cleanupExpiredSessions(): number {
  const db = getDb()
  const result = db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run()
  return result.changes
}
