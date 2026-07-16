// Übersichts-PDF (Ticket #397 Phase 3): Schichten in Zeilen, Positionen in Spalten.
// Jede Zelle zeigt nur `${filled}/${capacity}` (keine Crew-Namen) plus Uhrzeiten in der
// Schicht-Infospalte. Querformat-Entscheidung trifft der Daten-Builder (generatePdf-Option).
//
// i18n-Phase: PDF-Sprache = Instanz-Default (kein Query-Override, siehe getDefaultLang()) —
// `lang` ist optional und muss vom Aufrufer i.d.R. nicht gesetzt werden.

import { t, getDefaultLang, type Lang } from '../i18n.js'
import { shiftTypeLabel } from '../domain/labels.js'
import { DATE_LOCALE, weekdayName } from '../domain/dates.js'

export interface ShiftPlanData {
  // Spalten-Reihenfolge (position_label), sortiert nach position sort_order.
  positions: string[]
  rows: Array<{
    date: string
    type: 'day' | 'night'
    start_time: string
    end_time: string
    // Eine Zelle je Eintrag in `positions` (gleiche Reihenfolge).
    cells: Array<{ filled: number; capacity: number }>
  }>
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Kompaktes dd.mm. (ohne Jahr, Platzsparen in der Tabelle) über Intl statt fest
// verdrahteter Trennzeichen-Logik. Lokal konstruiertes Date wie domain/dates.ts.
function shortDate(isoDate: string, lang: Lang): string {
  const parts = isoDate.split('-')
  if (parts.length !== 3) return escapeHtml(isoDate)
  const [year, month, day] = parts.map(Number)
  if (!year || !month || !day) return escapeHtml(isoDate)
  const date = new Date(year, month - 1, day)
  return new Intl.DateTimeFormat(DATE_LOCALE[lang], { day: '2-digit', month: '2-digit' }).format(date)
}

export function shiftPlanHtml(data: ShiftPlanData, eventName: string, lang: Lang = getDefaultLang()): string {
  const positionHeaders = data.positions
    .map(label => `<th>${escapeHtml(label)}</th>`)
    .join('\n        ')

  const bodyRows = data.rows.map(row => {
    const formattedDate = shortDate(row.date, lang)
    const dayName = weekdayName(row.date, lang)
    const typeLabel = shiftTypeLabel(lang, row.type)
    const timeLabel = row.start_time && row.end_time
      ? `${escapeHtml(row.start_time)}–${escapeHtml(row.end_time)}`
      : '—'

    const cells = row.cells.map(cell => {
      if (cell.capacity === 0) {
        return `<td class="num">—</td>`
      }
      const hasGap = cell.filled < cell.capacity
      return `<td class="num${hasGap ? ' gap-cell' : ''}">${cell.filled}/${cell.capacity}</td>`
    }).join('\n          ')

    return `      <tr>
          <td>${formattedDate}</td>
          <td>${escapeHtml(dayName)}</td>
          <td>${timeLabel}</td>
          <td>${typeLabel}</td>
          ${cells}
        </tr>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 10mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; margin: 0; color: #000; }
    h1 { font-size: 14pt; font-weight: 700; margin: 0 0 8px 0; line-height: 1.2; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #333; padding: 3px 5px; vertical-align: top; font-size: 8pt; font-weight: 400; line-height: 1.3; }
    th { background: #f0f0f0; font-weight: 700; font-size: 8pt; line-height: 1.2; }
    td.num { text-align: center; white-space: nowrap; }
    .gap-cell { background: #fee2e2; color: #991b1b; font-weight: 700; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  </style>
</head>
<body>
  <h1>${escapeHtml(t(lang, 'pdf.shiftPlan.title', { event: eventName }))}</h1>
  <table>
    <thead>
      <tr>
        <th>${escapeHtml(t(lang, 'pdf.col.date'))}</th>
        <th>${escapeHtml(t(lang, 'pdf.col.weekday'))}</th>
        <th>${escapeHtml(t(lang, 'pdf.col.time'))}</th>
        <th>${escapeHtml(t(lang, 'pdf.col.type'))}</th>
        ${positionHeaders}
      </tr>
    </thead>
    <tbody>
${bodyRows}
    </tbody>
  </table>
</body>
</html>`
}
