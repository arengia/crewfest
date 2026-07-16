// Seed-Skript für ein generisches Beispiel-Festival.
//
// ACHTUNG: löscht ALLE bestehenden Positionen und Schichten (inkl. Zuweisungen und
// Verfügbarkeiten über ON DELETE CASCADE) und legt Beispieldaten neu an. Läuft NUR
// als npm-Script (`npm run seed:shifts -- --force`), niemals beim Serverstart, und
// verlangt zur Sicherheit das Flag `--force`.

import dotenv from 'dotenv'
dotenv.config()

import { initDatabase } from './connection.js'
import { initSchema } from './schema.js'
import { toIsoDate } from '../domain/dates.js'

// ─── Sicherheitsabfrage ────────────────────────────────────────────────────────
const force = process.argv.includes('--force')
if (!force) {
  console.error(
    'Abbruch: seed löscht alle Positionen und Schichten (samt Zuweisungen).\n' +
    'Zum Ausführen mit Flag starten:  npm run seed:shifts -- --force',
  )
  process.exit(1)
}

const dbPath = process.env.DB_PATH || './data/crewfest.db'
const db = initDatabase(dbPath)
initSchema(db)

// ─── Beispiel-Positionen (generisch) ────────────────────────────────────────────
const POSITIONS = [
  { name: 'bar_front', label: 'Bar Front', min_level: 3, default_capacity: 2, sort_order: 1 },
  { name: 'bar_back',  label: 'Bar Back',  min_level: 1, default_capacity: 2, sort_order: 2 },
  { name: 'runner',    label: 'Runner',    min_level: 1, default_capacity: 1, sort_order: 3 },
  { name: 'cash',      label: 'Kasse',     min_level: 2, default_capacity: 1, sort_order: 4 },
  { name: 'logistics', label: 'Logistik',  min_level: 2, default_capacity: 1, sort_order: 5 },
]

// ─── Beispiel-Schichten mit relativen Daten ──────────────────────────────────────
// Startdatum = nächster Freitag ab heute, danach 3 Tage à 2 Schichten (Tag/Nacht).
// Der Wochentagsname wird NICHT gespeichert (siehe db/schema.ts) — Views leiten ihn
// bei jedem Request sprachabhängig aus `date` ab (domain/dates.ts weekdayName()).
function nextFriday(from = new Date()): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const daysUntilFriday = (5 - d.getDay() + 7) % 7 // 0 = heute ist bereits Freitag
  d.setDate(d.getDate() + daysUntilFriday)
  return d
}

const start = nextFriday()
const SHIFTS: Array<{
  date: string
  type: 'day' | 'night'
  start_time: string
  end_time: string
  sort_order: number
}> = []

for (let dayOffset = 0; dayOffset < 3; dayOffset++) {
  const date = new Date(start)
  date.setDate(start.getDate() + dayOffset)
  const iso = toIsoDate(date)
  SHIFTS.push({ date: iso, type: 'day',   start_time: '14:00', end_time: '22:00', sort_order: dayOffset * 2 + 1 })
  SHIFTS.push({ date: iso, type: 'night', start_time: '22:00', end_time: '06:00', sort_order: dayOffset * 2 + 2 })
}

db.transaction(() => {
  // Clear existing seed data (idempotent)
  db.exec('DELETE FROM shift_positions')
  db.exec('DELETE FROM shifts')
  db.exec('DELETE FROM positions')

  // Insert positions
  const insertPosition = db.prepare(
    'INSERT INTO positions (name, label, min_level, default_capacity, sort_order) VALUES (?, ?, ?, ?, ?)'
  )
  const positionIds: Record<string, number> = {}

  for (const pos of POSITIONS) {
    const result = insertPosition.run(pos.name, pos.label, pos.min_level, pos.default_capacity, pos.sort_order)
    positionIds[pos.name] = Number(result.lastInsertRowid)
  }

  // Insert shifts
  const insertShift = db.prepare(
    'INSERT INTO shifts (date, type, start_time, end_time, sort_order) VALUES (?, ?, ?, ?, ?)'
  )
  const shiftIds: number[] = []

  for (const shift of SHIFTS) {
    const result = insertShift.run(shift.date, shift.type, shift.start_time, shift.end_time, shift.sort_order)
    shiftIds.push(Number(result.lastInsertRowid))
  }

  // Insert shift_positions: for each shift, for each position with default_capacity > 0
  const insertShiftPosition = db.prepare(
    'INSERT INTO shift_positions (shift_id, position_id, capacity) VALUES (?, ?, ?)'
  )
  let shiftPositionCount = 0

  for (const shiftId of shiftIds) {
    for (const pos of POSITIONS) {
      if (pos.default_capacity > 0) {
        insertShiftPosition.run(shiftId, positionIds[pos.name], pos.default_capacity)
        shiftPositionCount++
      }
    }
  }

  console.log(`Seeded ${POSITIONS.length} positions, ${SHIFTS.length} shifts, ${shiftPositionCount} shift_positions rows`)
  console.log(`Festival dates: ${SHIFTS[0].date} – ${SHIFTS[SHIFTS.length - 1].date}`)
})()

db.close()
