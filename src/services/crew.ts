import { getDb } from '../db/connection.js'

export interface CrewInput {
  first_name: string
  last_name: string
  email: string
  phone: string | null
  nickname: string | null
  admin_level: number             // 1-5 — single authoritative level (seeded from experience, admin-editable)
  preferred_positions: string[]   // e.g. ['bar_front', 'bar_back']
  group_signup: boolean
  group_name: string | null
  festival_count: number | null
  note: string | null
  // Phase 5 SCHM-01 — Google Forms fields (TEXT nullable, booleans stored as 0/1)
  experience_text: string | null
  experience_details: string | null
  previous_work: string | null
  contact_person: boolean
  preferred_work: string | null
  nationality: string | null
  about_text: string | null
  attachment_url: string | null
  // Phase 6 SCHM-04 — INSERT-only admin_note feed from Google Forms INFO column.
  // Optional so existing callers (src/routes/apply.ts) compile without change.
  // Never added to any UPDATE statement (D-03 safety by construction).
  admin_note?: string | null
}

// Returns the new crew row id, or null if email already exists (UNIQUE constraint)
export function insertCrew(data: CrewInput): number | null {
  const db = getDb()
  try {
    const result = db.prepare(`
      INSERT INTO crew
        (first_name, last_name, email, phone, nickname, admin_level,
         preferred_positions, group_signup, group_name, festival_count, note,
         experience_text, experience_details, previous_work, contact_person,
         preferred_work, nationality, about_text, attachment_url, admin_note, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'direkt')
    `).run(
      data.first_name,
      data.last_name,
      data.email,
      data.phone,
      data.nickname,
      data.admin_level,
      JSON.stringify(data.preferred_positions),
      data.group_signup ? 1 : 0,
      data.group_name,
      data.festival_count,
      data.note,
      data.experience_text,
      data.experience_details,
      data.previous_work,
      data.contact_person ? 1 : 0,
      data.preferred_work,
      data.nationality,
      data.about_text,
      data.attachment_url,
      data.admin_note ?? null
    )
    return Number(result.lastInsertRowid)
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('UNIQUE constraint failed: crew.email')) {
      return null
    }
    throw err
  }
}

// Inserts one row per shiftId into crew_availability. Uses INSERT OR IGNORE to be idempotent.
export function insertCrewAvailability(crewId: number, shiftIds: number[]): void {
  if (shiftIds.length === 0) return
  const db = getDb()
  const stmt = db.prepare('INSERT OR IGNORE INTO crew_availability (crew_id, shift_id) VALUES (?, ?)')
  const insertAll = db.transaction((ids: number[]) => {
    for (const shiftId of ids) {
      stmt.run(crewId, shiftId)
    }
  })
  insertAll(shiftIds)
}

export interface ShiftCapacity {
  id: number
  date: string
  type: 'day' | 'night'
  start_time: string
  end_time: string
  sort_order: number
  total_capacity: number    // sum(shift_positions.capacity) for this shift
  assigned_count: number    // count of assignments for this shift
}

export function getShiftsWithCapacity(): ShiftCapacity[] {
  const db = getDb()
  return db.prepare(`
    SELECT
      s.id,
      s.date,
      s.type,
      s.start_time,
      s.end_time,
      s.sort_order,
      COALESCE(SUM(sp.capacity), 0) AS total_capacity,
      COUNT(DISTINCT a.id) AS assigned_count
    FROM shifts s
    LEFT JOIN shift_positions sp ON sp.shift_id = s.id
    LEFT JOIN assignments a ON a.shift_id = s.id
    GROUP BY s.id
    ORDER BY s.sort_order
  `).all() as ShiftCapacity[]
}

// ─── Phase 3 additions ────────────────────────────────────────────────────────

export interface CrewRow {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string | null
  admin_level: number           // 1-5 — single authoritative level
  preferred_positions: string   // raw JSON string — callers must JSON.parse()
  group_signup: number          // 0 or 1
  group_name: string | null
  festival_count: number | null
  note: string | null
  admin_note: string | null
  external_registration: number   // 0 or 1 — separately registered with the festival organiser
  // Phase 5 SCHM-01 — Google Forms fields (TEXT nullable, INTEGER booleans as 0/1)
  experience_text: string | null
  experience_details: string | null
  previous_work: string | null
  contact_person: number          // 0 or 1
  preferred_work: string | null
  nationality: string | null
  about_text: string | null
  attachment_url: string | null   // external URL from a form import (rendered as-is)
  photo_filename: string | null   // local upload, served via /admin/crew/:id/photo only
  nickname: string | null
  status: 'applied' | 'shortlisted' | 'shift_selection' | 'confirmed' | 'declined'
  source: string
  created_at: string
  updated_at: string
  assignment_count: number      // computed by LEFT JOIN
  available_shift_ids: string | null  // comma-separated shift ids from crew_availability (GROUP_CONCAT)
}

export interface CrewAssignment {
  id: number          // assignment.id (used for unassign POST)
  shift_id: number
  date: string
  type: string
  position_id: number
  position_label: string
}

// Returns all crew rows with assignment_count and available_shift_ids for the crew table (CREW-01, CREW-04)
export function getAllCrew(): CrewRow[] {
  const db = getDb()
  return db.prepare(`
    SELECT c.*,
           COUNT(DISTINCT a.id) AS assignment_count,
           GROUP_CONCAT(DISTINCT ca.shift_id) AS available_shift_ids
    FROM crew c
    LEFT JOIN assignments a ON a.crew_id = c.id
    LEFT JOIN crew_availability ca ON ca.crew_id = c.id
    GROUP BY c.id
    ORDER BY c.last_name, c.first_name
  `).all() as CrewRow[]
}

// Returns a single crew row with assignment_count and available_shift_ids, or null if not found (CREW-02, CREW-03, CREW-05)
export function getCrewById(id: number): CrewRow | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT c.*,
           COUNT(DISTINCT a.id) AS assignment_count,
           GROUP_CONCAT(DISTINCT ca.shift_id) AS available_shift_ids
    FROM crew c
    LEFT JOIN assignments a ON a.crew_id = c.id
    LEFT JOIN crew_availability ca ON ca.crew_id = c.id
    WHERE c.id = ?
    GROUP BY c.id
  `).get(id) as CrewRow | undefined
  return row ?? null
}

// Updates admin_level, status, admin_note, nickname, external_registration (CREW-02, CREW-03, CREW-05)
export function updateCrewAdmin(id: number, data: {
  admin_level: number
  status: string
  admin_note: string | null
  nickname: string | null
  external_registration: boolean
}): void {
  const db = getDb()
  db.prepare(`
    UPDATE crew
    SET admin_level = ?,
        status = ?,
        admin_note = ?,
        nickname = ?,
        external_registration = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(data.admin_level, data.status, data.admin_note, data.nickname, data.external_registration ? 1 : 0, id)
}

// Personal crew fields that admins can edit from the crew detail page.
// Does NOT include admin-curated fields (admin_level, status, admin_note, nickname,
// external_registration, attachment_url).
export interface CrewPersonalUpdate {
  first_name: string
  last_name: string
  email: string
  phone: string | null
  preferred_positions: string[]   // stored as JSON string
  group_signup: boolean
  group_name: string | null
  festival_count: number | null
  note: string | null
  experience_text: string | null
  experience_details: string | null
  previous_work: string | null
  contact_person: boolean
  preferred_work: string | null
  nationality: string | null
  about_text: string | null
}

/**
 * Updates the personal crew fields from the admin detail page edit form.
 * Throws Error('email_taken') if another crew row already holds the same email.
 * Admin-curated fields (admin_level, status, admin_note, nickname,
 * external_registration, attachment_url) are not touched.
 */
export function updateCrewPersonal(id: number, data: CrewPersonalUpdate): void {
  const db = getDb()
  const conflict = db.prepare('SELECT id FROM crew WHERE email = ? AND id != ?').get(data.email, id)
  if (conflict) throw new Error('email_taken')
  db.prepare(`
    UPDATE crew
    SET first_name = ?,
        last_name = ?,
        email = ?,
        phone = ?,
        preferred_positions = ?,
        group_signup = ?,
        group_name = ?,
        festival_count = ?,
        note = ?,
        experience_text = ?,
        experience_details = ?,
        previous_work = ?,
        contact_person = ?,
        preferred_work = ?,
        nationality = ?,
        about_text = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    data.first_name,
    data.last_name,
    data.email,
    data.phone,
    JSON.stringify(data.preferred_positions),
    data.group_signup ? 1 : 0,
    data.group_name,
    data.festival_count,
    data.note,
    data.experience_text,
    data.experience_details,
    data.previous_work,
    data.contact_person ? 1 : 0,
    data.preferred_work,
    data.nationality,
    data.about_text,
    id
  )
}

// ─── Phase 6 import helpers ───────────────────────────────────────────────────

/**
 * Partial update input for the CSV import UPDATE path (IMPT-02 / D-01 / D-03).
 * Contains EXACTLY the imported Google Forms fields. Admin-curated fields
 * (admin_level, admin_note, nickname, status, external_registration) are
 * intentionally NOT included — safety by construction.
 */
export interface CrewImportUpdate {
  experience_text: string | null
  experience_details: string | null
  previous_work: string | null
  contact_person: boolean
  preferred_work: string | null
  nationality: string | null
  about_text: string | null
  attachment_url: string | null
}

/**
 * Updates ONLY the imported Google Forms fields for an existing crew row (IMPT-02).
 * Admin-curated fields (admin_level, admin_note, nickname, status, external_registration,
 * first_name, last_name, email, phone, group_signup, group_name, festival_count)
 * are intentionally absent from this statement per CONTEXT.md D-01 and D-03.
 * INFO column (SCHM-04) is handled INSERT-only; re-imports never overwrite admin_note.
 */
export function updateCrewFromImport(id: number, data: CrewImportUpdate): void {
  const db = getDb()
  db.prepare(`
    UPDATE crew
    SET experience_text = ?,
        experience_details = ?,
        previous_work = ?,
        contact_person = ?,
        preferred_work = ?,
        nationality = ?,
        about_text = ?,
        attachment_url = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(
    data.experience_text,
    data.experience_details,
    data.previous_work,
    data.contact_person ? 1 : 0,
    data.preferred_work,
    data.nationality,
    data.about_text,
    data.attachment_url,
    id
  )
}

/**
 * Persist the local photo filename for a crew row AFTER insertCrew() returned a real
 * id. Updates ONLY photo_filename + updated_at. Called from src/routes/apply.ts once
 * the upload has been written to the (non-public) upload directory.
 */
export function setCrewPhoto(id: number, filename: string): void {
  const db = getDb()
  db.prepare(`
    UPDATE crew
    SET photo_filename = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `).run(filename, id)
}

// Returns all assignments for a crew member with shift + position info (D-07)
export function getCrewAssignments(crewId: number): CrewAssignment[] {
  const db = getDb()
  return db.prepare(`
    SELECT a.id,
           a.shift_id,
           s.date,
           s.type,
           a.position_id,
           p.label AS position_label
    FROM assignments a
    JOIN shifts s ON s.id = a.shift_id
    JOIN positions p ON p.id = a.position_id
    WHERE a.crew_id = ?
    ORDER BY s.sort_order
  `).all(crewId) as CrewAssignment[]
}

// Returns distinct non-null group names for filter dropdown (D-17)
export function getDistinctGroups(): string[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT DISTINCT group_name
    FROM crew
    WHERE group_name IS NOT NULL AND group_name != ''
    ORDER BY group_name
  `).all() as { group_name: string }[]
  return rows.map(r => r.group_name)
}
