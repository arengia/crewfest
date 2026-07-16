// CSV import for application-form exports.
//
// Covers header mapping, UPDATE-on-existing-email, and INFO -> admin_note on INSERT
// only. There is no shift-availability import here: the form has no shift picker, so
// crew mark their availability inside the app instead.

import { insertCrew, updateCrewFromImport, type CrewInput, type CrewImportUpdate } from './crew.js'
import { getDb } from '../db/connection.js'
import { experienceLevel } from '../domain/experience.js'

// ════════════════════════════════════════════════════════════════════════════
// IMPORT PROFILE — adapt this to YOUR application form
// ════════════════════════════════════════════════════════════════════════════
//
// The importer maps CSV columns to crew fields by matching a case-insensitive
// SUBSTRING of each column header. The profile below is the default, tuned for a
// German-language Google Forms export — it is a working example you can copy.
//
// To use your own form:
//   1. Export the responses to CSV (one header row, then one row per response).
//   2. For each entry in GFORMS_HEADER_MAP, set `substring` to a distinctive part
//      of YOUR column header. Keep it unique enough not to also match another
//      column; matching is case-insensitive.
//   3. `email` is the only required column — rows without an email are skipped.
//   4. Boolean columns (contact_person, group_signup) are read via isTruthy():
//      values starting with "ja"/"yes"/"true"/"1"/"x"/"checked" count as true.
//   5. The experience column maps free-text answers to a stable level; adjust
//      GFORMS_EXPERIENCE_ANSWERS below to your own answer options.
//
// NOTE for the German default: keep the diacritics (ü/ä/ß) — several substrings
// only match with them (see 06-RESEARCH.md §CSV Header Validation).

export const GFORMS_HEADER_MAP: Array<{ substring: string; field: string; required?: true }> = [
  { substring: 'E-Mail-Adresse',                      field: 'email', required: true }, // the only required column
  { substring: 'Vorname',                             field: 'first_name' },
  { substring: 'Nachname',                            field: 'last_name' },
  { substring: 'Telefon',                             field: 'phone' },
  { substring: 'Bar-Erfahrung',                       field: 'experience_text' },       // mapped to a level, see below
  { substring: 'bereits Bar Erfahrung hast',          field: 'experience_details' },
  { substring: 'schonmal mit uns gearbeitet',         field: 'previous_work' },
  { substring: 'Ansprechperson für Gäste',            field: 'contact_person' },        // BOOL — needs ü, ä
  { substring: 'würdest du am liebsten Arbeiten',     field: 'preferred_work' },        // needs ü
  { substring: 'Teil einer Gruppe',                   field: 'group_signup' },          // BOOL
  { substring: 'Namen für eure Gruppe',               field: 'group_name' },            // needs ü
  { substring: 'Nationalität',                        field: 'nationality' },           // needs ä
  { substring: 'erzähle uns kurz etwas über dich',    field: 'about_text' },            // needs ä, ü
  { substring: 'Dateianhang hochladen',               field: 'attachment_url' },
  { substring: 'INFO',                                field: 'admin_note' },            // INSERT-only (first import wins)
]

// ─── Experience answer → stable key mapping (German Google Forms profile) ────
// Maps the verbatim German answer text of the default Google Forms profile to the
// stable experience keys defined in ../domain/experience.ts. Substrings are matched
// case-insensitively against the real form export (7 buckets, verified against 175
// real CSV rows, 165/175 match). Level derivation then happens from the key via the
// central map. Unknown / free-text → stored verbatim, level 1 + import-report warning.
//
// To adapt this to a differently-worded form: change the substrings on the left to
// match your form's answer options; keep the keys on the right so the level mapping
// in ../domain/experience.ts still applies.

const GFORMS_EXPERIENCE_ANSWERS: Array<{ substring: string; key: string }> = [
  { substring: 'keine oder sehr wenig barerfahrung',      key: 'exp_none' },
  { substring: 'nur ein festival ticket',                 key: 'exp_ticket_only' },
  { substring: 'gelegentlich schmeiße ich',               key: 'exp_private' },
  { substring: 'gastro ist für mich ein nebenjob',        key: 'exp_gastro_job' },
  { substring: 'ja, ich habe bereits in einer bar',       key: 'exp_bar_experienced' },
  { substring: 'schon seit mehreren jahren an einer bar', key: 'exp_bar_regular' },
  { substring: 'gastrobranche verfallen',                 key: 'exp_gastro_pro' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Boolean check for Google Forms dropdown values. The real CSV uses bilingual
 * "Ja // Yes" / "Nein // No" plus one edge case "Nein aber ich würde gerne...".
 * All three start with either "ja" or "nein", so startsWith is sufficient.
 * Legacy compatibility (yes/true/1/x/checked) is preserved for the application
 * form tests and any dev fixtures.
 *
 * See 06-RESEARCH.md §Boolean Handling Report — Array.includes() was broken
 * for every real-CSV value.
 */
export function isTruthy(val: string | null | undefined): boolean {
  if (!val) return false
  const lower = val.trim().toLowerCase()
  if (lower.startsWith('nein')) return false
  if (lower.startsWith('ja')) return true
  return ['yes', 'true', '1', 'x', 'checked'].includes(lower)
}

/**
 * Build a csvHeader → dbField map for a given CSV header row.
 * For each GFORMS_HEADER_MAP entry, find the first CSV header whose lowercased
 * text contains the substring (also lowercased). Exported for Plan 02 preview use.
 */
export function buildHeaderMap(csvHeaders: string[]): Map<string, string> {
  const mapping = new Map<string, string>()
  for (const entry of GFORMS_HEADER_MAP) {
    const needle = entry.substring.toLowerCase()
    const match = csvHeaders.find(h => h.toLowerCase().includes(needle))
    if (match) mapping.set(match, entry.field)
  }
  return mapping
}

/**
 * Reverse lookup: dbField → csvHeader. Convenience for per-row value extraction.
 */
function invertHeaderMap(headerByCsv: Map<string, string>): Record<string, string> {
  const byField: Record<string, string> = {}
  for (const [csvHeader, field] of headerByCsv) {
    byField[field] = csvHeader
  }
  return byField
}

/**
 * Resolve a raw German experience answer to a stable experience key.
 * `known: false` (with `key: null`) marks unmatched free-text so the caller can
 * keep the original text and push it to the import report. Empty input is a valid
 * "no answer" (known, no warning).
 */
export function resolveGformsExperience(text: string | null): { key: string | null; known: boolean } {
  if (!text) return { key: null, known: true }  // empty is a valid "no answer" — no warning
  const lower = text.toLowerCase()
  for (const entry of GFORMS_EXPERIENCE_ANSWERS) {
    if (lower.includes(entry.substring)) return { key: entry.key, known: true }
  }
  return { key: null, known: false }
}

/**
 * Extract a cleaned string value from a record by dbField lookup.
 * Returns null for missing, empty, or whitespace-only cells (D-02).
 */
function getString(
  record: Record<string, string>,
  csvHeaderByField: Record<string, string>,
  field: string
): string | null {
  const csvHeader = csvHeaderByField[field]
  if (!csvHeader) return null
  const raw = record[csvHeader]
  if (!raw) return null
  const trimmed = raw.trim()
  return trimmed === '' ? null : trimmed
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ImportResult {
  inserted: number
  updated: number
  skipped: number                                     // empty email
  errors: number
  unknownExperiences: string[]                        // distinct free-text values → level 1 (D-24)
  rowErrors: Array<{ row: number; message: string }>  // row-level exceptions (D-23)
}

/**
 * Required-header check for the preview page. Returns the list of missing
 * required dbFields (empty = OK). Used by Plan 02's preview route.
 */
export function findMissingRequiredFields(headerByCsv: Map<string, string>): string[] {
  const presentFields = new Set(headerByCsv.values())
  return GFORMS_HEADER_MAP
    .filter(e => e.required && !presentFields.has(e.field))
    .map(e => e.field)
}

// ─── Main import entry point ──────────────────────────────────────────────────

export function importCsvRecords(records: Record<string, string>[]): ImportResult {
  const db = getDb()

  let inserted = 0
  let updated = 0
  let skipped = 0
  let errors = 0
  const unknownExperiencesSet = new Set<string>()
  const rowErrors: Array<{ row: number; message: string }> = []

  if (records.length === 0) {
    return { inserted, updated, skipped, errors, unknownExperiences: [], rowErrors }
  }

  // Build the header map once from the first row's keys.
  const csvHeaders = Object.keys(records[0])
  const headerByCsv = buildHeaderMap(csvHeaders)
  const csvHeaderByField = invertHeaderMap(headerByCsv)

  const findByEmail = db.prepare('SELECT id FROM crew WHERE email = ?')

  const runImport = db.transaction((rows: Record<string, string>[]) => {
    for (let i = 0; i < rows.length; i++) {
      const record = rows[i]

      try {
        // Email is the only required field (D-11)
        const rawEmail = getString(record, csvHeaderByField, 'email')
        if (!rawEmail) {
          skipped++
          continue
        }
        const email = rawEmail.toLowerCase()

        // Extract the 10 Google Forms fields
        // experience: resolve the raw German answer to a stable key. Unknown free-text
        // is kept verbatim (so admins can review it) and later flagged in the report.
        const experience_raw        = getString(record, csvHeaderByField, 'experience_text')
        const exp                   = resolveGformsExperience(experience_raw)
        const experience_text       = exp.key ?? experience_raw
        const experience_details    = getString(record, csvHeaderByField, 'experience_details')
        const previous_work         = getString(record, csvHeaderByField, 'previous_work')
        const contact_person_raw    = csvHeaderByField['contact_person'] ? record[csvHeaderByField['contact_person']] : undefined
        const preferred_work        = getString(record, csvHeaderByField, 'preferred_work')
        const nationality           = getString(record, csvHeaderByField, 'nationality')
        const about_text            = getString(record, csvHeaderByField, 'about_text')
        const attachment_url        = getString(record, csvHeaderByField, 'attachment_url')

        const importUpdate: CrewImportUpdate = {
          experience_text,
          experience_details,
          previous_work,
          contact_person: isTruthy(contact_person_raw),
          preferred_work,
          nationality,
          about_text,
          attachment_url,
        }

        const existing = findByEmail.get(email) as { id: number } | undefined
        if (existing) {
          // UPDATE path — only the 10 fields, admin columns untouched
          updateCrewFromImport(existing.id, importUpdate)
          updated++
        } else {
          // INSERT path — build full CrewInput from the record
          const first_name = getString(record, csvHeaderByField, 'first_name') ?? ''
          const last_name  = getString(record, csvHeaderByField, 'last_name') ?? ''
          const phone      = getString(record, csvHeaderByField, 'phone')
          const group_signup_raw = csvHeaderByField['group_signup'] ? record[csvHeaderByField['group_signup']] : undefined
          const group_name_raw   = getString(record, csvHeaderByField, 'group_name')
          const group_name = (group_name_raw === '-') ? null : group_name_raw   // §Empty-field Semantics
          const adminNoteFromInfo = getString(record, csvHeaderByField, 'admin_note')  // SCHM-04 INSERT-only

          // D-06: level derived from the experience key on INSERT only.
          // Unknown free-text answers → level 1 + import-report warning (D-21).
          if (experience_raw && !exp.known) {
            unknownExperiencesSet.add(experience_raw)
          }

          const crewInput: CrewInput = {
            first_name,
            last_name,
            email,
            phone,
            nickname: null,
            admin_level: exp.key ? experienceLevel(exp.key) : 1,
            preferred_positions: [],          // not in Google Forms — Phase 8 ADUI-03 removes this column
            group_signup: isTruthy(group_signup_raw),
            group_name,
            festival_count: null,             // not in Google Forms
            note: null,
            experience_text,
            experience_details,
            previous_work,
            contact_person: importUpdate.contact_person,
            preferred_work,
            nationality,
            about_text,
            attachment_url,
            admin_note: adminNoteFromInfo,    // SCHM-04 INSERT-only
          }

          const newId = insertCrew(crewInput)
          if (newId === null) {
            // UNIQUE violation — extremely rare because we SELECTed by email first,
            // but possible under race conditions. Treat as skipped.
            skipped++
          } else {
            inserted++
          }
        }
      } catch (err) {
        if (!db.inTransaction) throw err  // Pitfall 4: SQLite killed the tx — abort
        errors++
        rowErrors.push({
          row: i + 2,  // +2: header row is row 1, first data row is row 2
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }
  })

  runImport(records)

  return {
    inserted,
    updated,
    skipped,
    errors,
    unknownExperiences: Array.from(unknownExperiencesSet),
    rowErrors,
  }
}
