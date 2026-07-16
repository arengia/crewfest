import { getDb } from '../db/connection.js'
import { t, getDefaultLang } from '../i18n.js'

// Cells starting with these characters are interpreted as formulas by Excel /
// Google Sheets / LibreOffice when the CSV is opened there — a crew member whose
// first/last name is e.g. `=SUM(1)` or `-2+3` (submitted via the public /apply
// form) can otherwise trigger formula execution ("CSV injection") in whoever
// opens this export. Prefixing a single quote forces the spreadsheet app to treat
// the cell as text while keeping the original value intact.
const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/

function csvEscape(value: string): string {
  const neutralized = FORMULA_PREFIX_RE.test(value) ? "'" + value : value
  if (neutralized.includes(',') || neutralized.includes('"') || neutralized.includes('\n')) {
    return '"' + neutralized.replace(/"/g, '""') + '"'
  }
  return neutralized
}

// CSV of all confirmed crew, for the external helper registration at the festival
// organiser (the "external registration" list). Header is rendered in the instance's
// default language (getDefaultLang(), Teil 1) — this export has no per-request UI
// language of its own, so it follows the same convention as the PDF exports.
export function generateExternalRegistrationCsv(): string {
  const db = getDb()
  const rows = db.prepare(`
    SELECT first_name, last_name, email, nickname, admin_note
    FROM crew
    WHERE status = 'confirmed'
    ORDER BY last_name, first_name
  `).all() as Array<{
    first_name: string
    last_name: string
    email: string
    nickname: string | null
    admin_note: string | null
  }>

  const lang = getDefaultLang()
  const header = [
    t(lang, 'apply.field.firstName'),
    t(lang, 'apply.field.lastName'),
    t(lang, 'export.csv.email'),
    t(lang, 'apply.field.nickname'),
    t(lang, 'export.csv.note'),
  ].join(',')
  const dataRows = rows.map(c =>
    [c.first_name, c.last_name, c.email, c.nickname ?? '', c.admin_note ?? '']
      .map(csvEscape)
      .join(',')
  )
  return header + '\n' + dataRows.join('\n') + '\n'
}
