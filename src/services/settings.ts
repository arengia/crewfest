import { getDb } from '../db/connection.js'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ShiftWithPositions {
  id: number
  date: string
  type: 'day' | 'night'
  start_time: string
  end_time: string
  sort_order: number
  color: string
  position_capacities: { position_id: number; position_label: string; capacity: number }[]
}

export interface PositionRow {
  id: number
  name: string
  label: string
  min_level: number
  default_capacity: number
  sort_order: number
}

export interface ShiftInput {
  date: string
  type: 'day' | 'night'
  start_time: string
  end_time: string
  sort_order: number
  color: string
  capacities: Record<number, number>  // position_id -> capacity
}

export interface PositionInput {
  name: string
  label: string
  min_level: number
  default_capacity: number
  sort_order: number
}

// ─── Shift CRUD ──────────────────────────────────────────────────────────────

export function getAllShiftsWithPositions(): ShiftWithPositions[] {
  const db = getDb()
  const shifts = db.prepare(`
    SELECT id, date, type, start_time, end_time, sort_order, color
    FROM shifts ORDER BY sort_order
  `).all() as Omit<ShiftWithPositions, 'position_capacities'>[]

  const spRows = db.prepare(`
    SELECT sp.shift_id, sp.position_id, p.label AS position_label, sp.capacity
    FROM shift_positions sp
    JOIN positions p ON p.id = sp.position_id
    ORDER BY p.sort_order
  `).all() as { shift_id: number; position_id: number; position_label: string; capacity: number }[]

  return shifts.map(s => ({
    ...s,
    position_capacities: spRows.filter(sp => sp.shift_id === s.id)
  }))
}

export function getShiftForEdit(shiftId: number): ShiftWithPositions | null {
  const db = getDb()
  const shift = db.prepare(`
    SELECT id, date, type, start_time, end_time, sort_order, color
    FROM shifts WHERE id = ?
  `).get(shiftId) as Omit<ShiftWithPositions, 'position_capacities'> | undefined
  if (!shift) return null

  const caps = db.prepare(`
    SELECT sp.position_id, p.label AS position_label, sp.capacity
    FROM shift_positions sp
    JOIN positions p ON p.id = sp.position_id
    WHERE sp.shift_id = ?
    ORDER BY p.sort_order
  `).all(shiftId) as { position_id: number; position_label: string; capacity: number }[]

  return { ...shift, position_capacities: caps }
}

export function createShift(data: ShiftInput): number {
  const db = getDb()
  return db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO shifts (date, type, start_time, end_time, sort_order, color)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(data.date, data.type, data.start_time, data.end_time, data.sort_order, data.color)
    const shiftId = Number(result.lastInsertRowid)

    const insertSP = db.prepare('INSERT INTO shift_positions (shift_id, position_id, capacity) VALUES (?, ?, ?)')
    for (const [posId, cap] of Object.entries(data.capacities)) {
      if (Number(cap) > 0) insertSP.run(shiftId, Number(posId), Number(cap))
    }
    return shiftId
  })()
}

export function updateShift(shiftId: number, data: ShiftInput): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare(`
      UPDATE shifts SET date = ?, type = ?, start_time = ?, end_time = ?, sort_order = ?, color = ?
      WHERE id = ?
    `).run(data.date, data.type, data.start_time, data.end_time, data.sort_order, data.color, shiftId)

    // Replace shift_positions: delete all, re-insert
    db.prepare('DELETE FROM shift_positions WHERE shift_id = ?').run(shiftId)
    const insertSP = db.prepare('INSERT INTO shift_positions (shift_id, position_id, capacity) VALUES (?, ?, ?)')
    for (const [posId, cap] of Object.entries(data.capacities)) {
      if (Number(cap) > 0) insertSP.run(shiftId, Number(posId), Number(cap))
    }
  })()
}

export function duplicateShift(shiftId: number): number {
  const db = getDb()
  return db.transaction(() => {
    const original = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shiftId) as any
    if (!original) throw new Error('Shift not found')

    const result = db.prepare(`
      INSERT INTO shifts (date, type, start_time, end_time, sort_order, color)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(original.date, original.type, original.start_time, original.end_time, original.sort_order + 1, original.color)
    const newId = Number(result.lastInsertRowid)

    const caps = db.prepare('SELECT position_id, capacity FROM shift_positions WHERE shift_id = ?').all(shiftId) as { position_id: number; capacity: number }[]
    const insertSP = db.prepare('INSERT INTO shift_positions (shift_id, position_id, capacity) VALUES (?, ?, ?)')
    for (const cap of caps) {
      insertSP.run(newId, cap.position_id, cap.capacity)
    }
    return newId
  })()
}

export function getShiftDeleteWarning(shiftId: number): { assignmentCount: number; crewNames: string[] } {
  const db = getDb()
  const rows = db.prepare(`
    SELECT c.first_name, c.last_name
    FROM assignments a
    JOIN crew c ON c.id = a.crew_id
    WHERE a.shift_id = ?
  `).all(shiftId) as { first_name: string; last_name: string }[]
  return { assignmentCount: rows.length, crewNames: rows.map(r => `${r.first_name} ${r.last_name}`) }
}

export function deleteShift(shiftId: number): void {
  const db = getDb()
  db.prepare('DELETE FROM shifts WHERE id = ?').run(shiftId)
  // ON DELETE CASCADE handles shift_positions, assignments, crew_availability
}

// ─── Position CRUD ───────────────────────────────────────────────────────────

export function getAllPositions(): PositionRow[] {
  const db = getDb()
  return db.prepare('SELECT * FROM positions ORDER BY sort_order').all() as PositionRow[]
}

export function getPositionById(positionId: number): PositionRow | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM positions WHERE id = ?').get(positionId) as PositionRow | undefined
  return row ?? null
}

export function createPosition(data: PositionInput): number {
  const db = getDb()
  const result = db.prepare(`
    INSERT INTO positions (name, label, min_level, default_capacity, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(data.name, data.label, data.min_level, data.default_capacity, data.sort_order)
  return Number(result.lastInsertRowid)
}

export function updatePosition(positionId: number, data: PositionInput): void {
  const db = getDb()
  db.prepare(`
    UPDATE positions SET name = ?, label = ?, min_level = ?, default_capacity = ?, sort_order = ?
    WHERE id = ?
  `).run(data.name, data.label, data.min_level, data.default_capacity, data.sort_order, positionId)
}

export function getPositionDeleteWarning(positionId: number): { assignmentCount: number; shiftCount: number } {
  const db = getDb()
  const aCount = db.prepare('SELECT COUNT(*) AS c FROM assignments WHERE position_id = ?').get(positionId) as { c: number }
  const sCount = db.prepare('SELECT COUNT(*) AS c FROM shift_positions WHERE position_id = ?').get(positionId) as { c: number }
  return { assignmentCount: aCount.c, shiftCount: sCount.c }
}

export function deletePosition(positionId: number): void {
  const db = getDb()
  db.prepare('DELETE FROM positions WHERE id = ?').run(positionId)
  // ON DELETE CASCADE handles shift_positions and assignments
}
