import type Database from 'better-sqlite3'

export function initSchema(db: Database.Database): void {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        label TEXT NOT NULL,
        min_level INTEGER NOT NULL DEFAULT 1,
        default_capacity INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS shifts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('day', 'night')),
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        color TEXT NOT NULL DEFAULT '#6366f1'
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS shift_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
        capacity INTEGER NOT NULL DEFAULT 1,
        UNIQUE(shift_id, position_id)
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS crew (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        phone TEXT,
        admin_level INTEGER NOT NULL DEFAULT 1 CHECK (admin_level BETWEEN 1 AND 5),
        preferred_positions TEXT NOT NULL DEFAULT '[]',
        group_signup INTEGER NOT NULL DEFAULT 0,
        group_name TEXT,
        festival_count INTEGER DEFAULT 0,
        note TEXT,
        admin_note TEXT,
        nickname TEXT,
        status TEXT NOT NULL DEFAULT 'applied'
          CHECK (status IN ('applied', 'shortlisted', 'shift_selection', 'confirmed', 'declined')),
        source TEXT NOT NULL DEFAULT 'direkt'
          CHECK (source IN ('google_form', 'notion_import', 'direkt')),
        external_registration INTEGER NOT NULL DEFAULT 0,
        experience_text TEXT,
        experience_details TEXT,
        previous_work TEXT,
        contact_person INTEGER NOT NULL DEFAULT 0,
        preferred_work TEXT,
        nationality TEXT,
        about_text TEXT,
        attachment_url TEXT,
        photo_filename TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS crew_availability (
        crew_id INTEGER NOT NULL REFERENCES crew(id) ON DELETE CASCADE,
        shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        PRIMARY KEY (crew_id, shift_id)
      )
    `)

    db.exec(`
      CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crew_id INTEGER NOT NULL REFERENCES crew(id) ON DELETE CASCADE,
        shift_id INTEGER NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
        position_id INTEGER NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
        assigned_by INTEGER REFERENCES admins(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(crew_id, shift_id)
      )
    `)
  })()
}
