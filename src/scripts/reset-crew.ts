// Phase 6 D-15 to D-18: one-time interactive crew wipe for pre-launch cleanup.
//
// Usage:
//   npx tsx src/scripts/reset-crew.ts
//   # or via the npm alias:
//   npm run db:reset-crew
//
// Effect:
//   - Reads DB_PATH from .env (mirrors src/db/seed.ts)
//   - Initializes schema (idempotent) to ensure PRAGMA foreign_keys = ON
//   - Counts crew + crew_availability + assignments rows
//   - Prompts the admin for 'yes' confirmation on stdin
//   - On confirmation: DELETE FROM crew (FK CASCADE wipes availability + assignments)
//                       + DELETE FROM sqlite_sequence WHERE name='crew' (reset autoincrement)
//   - shifts, positions, shift_positions, admins are NOT touched
//
// Intended as a one-off maintenance script (e.g. before importing a fresh
// applicant CSV for a new season).

import dotenv from 'dotenv'
dotenv.config()

import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { initDatabase } from '../db/connection.js'
import { initSchema } from '../db/schema.js'

const dbPath = process.env.DB_PATH || './data/crewfest.db'
const db = initDatabase(dbPath)
initSchema(db)   // idempotent — ensures schema exists even on a fresh DB

// Count what's about to be lost
const crewCount    = (db.prepare('SELECT COUNT(*) AS n FROM crew').get() as { n: number }).n
const availCount   = (db.prepare('SELECT COUNT(*) AS n FROM crew_availability').get() as { n: number }).n
const assignCount  = (db.prepare('SELECT COUNT(*) AS n FROM assignments').get() as { n: number }).n

console.log(`\nDatabase: ${dbPath}`)
console.log(`This will DELETE ${crewCount} crew rows, cascading to ${availCount} availability rows and ${assignCount} assignments.`)
console.log(`shifts, positions, shift_positions, and admins will NOT be touched.\n`)

const rl = createInterface({ input, output })
const answer = await rl.question(`Type 'yes' to proceed: `)
rl.close()

if (answer.trim().toLowerCase() !== 'yes') {
  console.log('Aborted. No changes made.')
  db.close()
  process.exit(0)
}

db.transaction(() => {
  db.exec('DELETE FROM crew')                              // FK CASCADE clears crew_availability + assignments
  db.exec(`DELETE FROM sqlite_sequence WHERE name='crew'`) // D-18: reset AUTOINCREMENT
})()

console.log(`\nDeleted ${crewCount} crew rows. Ready for fresh import.`)
db.close()
