import { getDb } from '../db/connection.js'

export interface SuggestedCrewRow {
  id: number
  first_name: string
  last_name: string
  effective_level: number
  assignment_count: number
}

export function getSuggestedCrew(shiftId: number, positionId: number): SuggestedCrewRow[] {
  const db = getDb()
  // Authoritative level = c.admin_level (single level column; mirrors effectiveLevel() in shifts.ts).
  // LEFT JOIN semantics (D-09): crew with explicit availability for this shift (ca.crew_id IS NOT NULL)
  // OR crew with NO availability entries at all (NOT EXISTS) are both included.
  // Crew with availability entries for OTHER shifts only are excluded.
  // JOIN shift_positions to filter by min_level so under-qualified crew are excluded (CR-02).
  return db.prepare(`
    SELECT
      c.id,
      c.first_name,
      c.last_name,
      c.admin_level AS effective_level,
      (SELECT COUNT(*) FROM assignments a2 WHERE a2.crew_id = c.id) AS assignment_count
    FROM crew c
    LEFT JOIN crew_availability ca ON ca.crew_id = c.id AND ca.shift_id = ?
    LEFT JOIN assignments a ON a.crew_id = c.id AND a.shift_id = ?
    JOIN shift_positions sp ON sp.shift_id = ? AND sp.position_id = ?
    JOIN positions pos ON pos.id = sp.position_id
    WHERE c.status != 'declined'
      AND a.id IS NULL
      AND (SELECT COUNT(*) FROM assignments a3 WHERE a3.crew_id = c.id) < 3
      AND c.admin_level >= pos.min_level
      AND (
        ca.crew_id IS NOT NULL
        OR NOT EXISTS (
          SELECT 1 FROM crew_availability ca2 WHERE ca2.crew_id = c.id
        )
      )
    ORDER BY
      assignment_count ASC,
      effective_level DESC,
      c.last_name ASC
    LIMIT 10
  `).all(shiftId, shiftId, shiftId, positionId) as SuggestedCrewRow[]
}
