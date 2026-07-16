import bcrypt from 'bcryptjs'
import { getDb } from '../db/connection.js'

// Constant, pre-generated bcrypt hash (cost 12) used only to burn a compare()
// cycle when the username lookup misses in authenticateAdmin() below — see the
// comment there.
const DUMMY_PASSWORD_HASH = '$2b$12$8LFMRdbUfymlOtDXAVOJ1e6N7Tha/x5R9NaQeo4rKeJfXlvJBdjXK'

// Creates the first admin, but only if the admins table is still empty — checked
// and inserted inside one better-sqlite3 transaction so two concurrent POST
// /setup requests (an unauthenticated, public endpoint until the first admin
// exists) can't both succeed and create two accounts. better-sqlite3 transactions
// run synchronously and Node is single-threaded, so once the transaction starts
// there's no await point left for a second request to interleave through —
// unlike the previous getAdminCount() + INSERT sequence, which had an await
// (bcrypt.hash) sitting in the middle of that window.
// Returns the new admin's id, or null if an admin already existed (race lost).
export async function createAdminIfNone(username: string, password: string): Promise<number | null> {
  const db = getDb()
  const passwordHash = await bcrypt.hash(password, 12)
  const tx = db.transaction((): number | null => {
    const { count } = db.prepare('SELECT COUNT(*) as count FROM admins').get() as { count: number }
    if (count > 0) return null
    const info = db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)')
      .run(username, passwordHash)
    return Number(info.lastInsertRowid)
  })
  return tx()
}

export async function authenticateAdmin(username: string, password: string): Promise<{ id: number; username: string } | null> {
  const db = getDb()
  const row = db.prepare('SELECT id, username, password_hash FROM admins WHERE username = ?')
    .get(username) as { id: number; username: string; password_hash: string } | undefined

  if (!row) {
    // Burn a bcrypt.compare() against a constant hash so an unknown username
    // costs roughly the same wall-clock time as a known username with a wrong
    // password — otherwise the two cases are distinguishable by response time,
    // letting an attacker enumerate valid usernames.
    await bcrypt.compare(password, DUMMY_PASSWORD_HASH)
    return null
  }

  const valid = await bcrypt.compare(password, row.password_hash)
  if (!valid) return null

  return { id: row.id, username: row.username }
}

export function getAdminCount(): number {
  const db = getDb()
  const row = db.prepare('SELECT COUNT(*) as count FROM admins').get() as { count: number }
  return row.count
}

// Creates the admin if not exists, or resets their password if they already exist.
// Used on startup when ADMIN_USERNAME + ADMIN_PASSWORD are set in the environment.
export async function upsertAdmin(username: string, password: string): Promise<void> {
  const db = getDb()
  const passwordHash = await bcrypt.hash(password, 12)
  db.prepare(`
    INSERT INTO admins (username, password_hash) VALUES (?, ?)
    ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash
  `).run(username, passwordHash)
}
