// Check-in/Check-out-Checklisten-PDF (DATA-05): eine Seite je Schicht mit Crew-Liste
// + Unterschriftenspalten.
//
// i18n-Phase: PDF-Sprache = Instanz-Default (kein Query-Override, siehe getDefaultLang()).

import { formatShiftDate } from './format.js'
import { t, getDefaultLang, type Lang } from '../i18n.js'
import { shiftTypeLabel } from '../domain/labels.js'
import { weekdayName } from '../domain/dates.js'

export interface ChecklistShift {
  date: string
  type: 'day' | 'night'
  start_time: string
  end_time: string
  crew: Array<{
    first_name: string
    last_name: string
    position_label: string
  }>
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function checklistHtml(shifts: ChecklistShift[], lang: Lang = getDefaultLang()): string {
  const pages = shifts.map((shift, index) => {
    const typeLabel = shiftTypeLabel(lang, shift.type)
    const dayName = weekdayName(shift.date, lang)
    const formattedDate = escapeHtml(formatShiftDate(shift.date, lang))
    const shiftLabel = `${escapeHtml(dayName)} ${escapeHtml(typeLabel)} (${formattedDate}, ${escapeHtml(shift.start_time)}–${escapeHtml(shift.end_time)})`

    const crewRows = shift.crew.map((member, i) => {
      return `        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(member.first_name)} ${escapeHtml(member.last_name)}</td>
          <td>${escapeHtml(member.position_label)}</td>
          <td class="sig-cell"></td>
          <td class="sig-cell"></td>
        </tr>`
    }).join('\n')

    // shiftLabel-Bestandteile sind bereits escapeHtml()-behandelt (siehe oben) — hier
    // NICHT nochmal escapen, sonst werden die Entities doppelt escaped.
    return `  <div class="${index === 0 ? 'shift-page first' : 'shift-page'}">
    <h2>${t(lang, 'pdf.checklist.heading', { shift: shiftLabel })}</h2>
    <table>
      <thead>
        <tr>
          <th style="width:5%">${escapeHtml(t(lang, 'pdf.col.number'))}</th>
          <th style="width:25%">${escapeHtml(t(lang, 'pdf.col.name'))}</th>
          <th style="width:15%">${escapeHtml(t(lang, 'pdf.col.position'))}</th>
          <th style="width:25%">${escapeHtml(t(lang, 'pdf.col.checkin'))}</th>
          <th style="width:25%">${escapeHtml(t(lang, 'pdf.col.checkout'))}</th>
        </tr>
      </thead>
      <tbody>
${crewRows}
      </tbody>
    </table>
  </div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 15mm 10mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; margin: 0; color: #000; }
    h2 { font-size: 12pt; font-weight: 700; margin: 0 0 10px 0; line-height: 1.2; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #333; padding: 4px 6px; font-size: 10pt; font-weight: 400; line-height: 1.4; }
    th { background: #f0f0f0; font-weight: 700; font-size: 10pt; line-height: 1.4; }
    .shift-page { page-break-before: always; }
    .shift-page.first { page-break-before: auto; }
    .sig-cell { height: 30px; border-bottom: 1px solid #000; }
  </style>
</head>
<body>
${pages}
</body>
</html>`
}
