import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

let _db: Database.Database | null = null

export function initDatabase(dbPath: string): Database.Database {
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  _db = db
  return db
}

export function getDb(): Database.Database {
  if (!_db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return _db
}
