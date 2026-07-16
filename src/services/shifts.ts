import { getDb } from '../db/connection.js'

export interface ShiftPositionRow {
  shift_id: number
  date: string
  type: 'day' | 'night'
  start_time: string
  end_time: string
  sort_order: number
  color: string
  position_id: number
  position_name: string
  position_label: string
  min_level: number
  capacity: number
  filled: number
}

export interface AvailableCrewRow {
  id: number
  first_name: string
  last_name: string
  status: string
  admin_level: number
  effective_level: number
}

export type AssignResult = 'ok' | 'full' | 'already_assigned'

// Returns all shifts with per-position fill counts (SHIFT-01)
export function getShiftsWithPositionFill(): ShiftPositionRow[] {
  const db = getDb()
  return db.prepare(`
    SELECT
      s.id AS shift_id,
      s.date,
      s.type,
      s.start_time,
      s.end_time,
      s.sort_order,
      s.color,
      p.id AS position_id,
      p.name AS position_name,
      p.label AS position_label,
      p.min_level,
      sp.capacity,
      COUNT(a.id) AS filled
    FROM shifts s
    JOIN shift_positions sp ON sp.shift_id = s.id
    JOIN positions p ON p.id = sp.position_id
    LEFT JOIN assignments a ON a.shift_id = s.id AND a.position_id = p.id
    GROUP BY s.id, p.id
    ORDER BY s.sort_order, p.sort_order
  `).all() as ShiftPositionRow[]
}

/**
 * Returns the authoritative level (1-5) for a crew member.
 * admin_level is the single level column: seeded from the applicant's declared
 * experience on insert, editable by admins afterwards. All authoritative level
 * READS in application code go through this helper; the equivalent SQL is a bare
 * `c.admin_level`. The `?? 1` guard is defensive only (column is NOT NULL).
 */
export function effectiveLevel(crew: { admin_level: number | null }): number {
  return crew.admin_level ?? 1
}

// Returns crew available for a specific shift + position slot (SHIFT-02)
// Filters: (a) has shift in crew_availability, (b) not already assigned to shift,
// (c) status != 'declined'. Sorted by effective_level DESC.
export function getAvailableCrewForSlot(shiftId: number, positionId: number): AvailableCrewRow[] {
  const db = getDb()
  // positionId is passed to the function but not used in the query — it is used
  // by the caller to render the level warning. The availability filter is per-shift
  // (crew marks which shifts they're available for, not which positions).
  void positionId
  return db.prepare(`
    SELECT
      c.id,
      c.first_name,
      c.last_name,
      c.status,
      c.admin_level,
      c.admin_level AS effective_level
    FROM crew c
    INNER JOIN crew_availability ca ON ca.crew_id = c.id AND ca.shift_id = ?
    LEFT JOIN assignments a ON a.crew_id = c.id AND a.shift_id = ?
    WHERE c.status != 'declined'
      AND a.id IS NULL
    ORDER BY effective_level DESC, c.last_name
  `).all(shiftId, shiftId) as AvailableCrewRow[]
}

// Assigns a crew member to a shift + position atomically (SHIFT-02, SHIFT-03, D-11)
// Returns 'ok', 'full' (capacity reached), or 'already_assigned' (UNIQUE constraint).
export function assignCrewToShift(
  crewId: number,
  shiftId: number,
  positionId: number,
  adminId: number
): AssignResult {
  const db = getDb()
  let result: AssignResult = 'ok'

  db.transaction(() => {
    // Capacity check (SHIFT-03 — must be inside transaction to prevent TOCTOU)
    const fill = db.prepare(`
      SELECT COUNT(*) AS count FROM assignments
      WHERE shift_id = ? AND position_id = ?
    `).get(shiftId, positionId) as { count: number }

    const cap = db.prepare(`
      SELECT capacity FROM shift_positions
      WHERE shift_id = ? AND position_id = ?
    `).get(shiftId, positionId) as { capacity: number } | undefined

    if (!cap || fill.count >= cap.capacity) {
      result = 'full'
      return
    }

    try {
      db.prepare(`
        INSERT INTO assignments (crew_id, shift_id, position_id, assigned_by)
        VALUES (?, ?, ?, ?)
      `).run(crewId, shiftId, positionId, adminId)

      // Status auto-advance (D-11): applied/shortlisted -> shift_selection
      db.prepare(`
        UPDATE crew
        SET status = 'shift_selection',
            updated_at = datetime('now')
        WHERE id = ?
          AND status IN ('applied', 'shortlisted')
      `).run(crewId)
    } catch (err: unknown) {
      // UNIQUE(crew_id, shift_id) — same crew already assigned to this shift in a different position
      if (err instanceof Error && err.message.includes('UNIQUE constraint failed: assignments.crew_id')) {
        result = 'already_assigned'
      } else {
        throw err
      }
    }
  })()

  return result
}

export interface AssignedCrewRow {
  assignment_id: number
  crew_id: number
  first_name: string
  last_name: string
  status: string
  admin_level: number
  effective_level: number
}

// Returns crew currently assigned to a specific shift + position slot (D-03, D-14)
export function getAssignedCrewForSlot(shiftId: number, positionId: number): AssignedCrewRow[] {
  const db = getDb()
  return db.prepare(`
    SELECT
      a.id AS assignment_id,
      c.id AS crew_id,
      c.first_name,
      c.last_name,
      c.status,
      c.admin_level,
      c.admin_level AS effective_level
    FROM assignments a
    JOIN crew c ON c.id = a.crew_id
    WHERE a.shift_id = ? AND a.position_id = ?
    ORDER BY c.last_name, c.first_name
  `).all(shiftId, positionId) as AssignedCrewRow[]
}

// Removes an assignment by assignment id (D-07 Unassign button on crew detail page)
export function unassignCrew(assignmentId: number): void {
  const db = getDb()
  db.prepare('DELETE FROM assignments WHERE id = ?').run(assignmentId)
}
