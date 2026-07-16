// Auswahl-Druck-PDF (Ticket #397 Phase 3): kompakte Blöcke je ausgewählter Schicht.
// Analog zu pdf-checklist.ts, aber ohne Unterschriftenspalten und ohne page-break je
// Block (Papier sparen). Zeigt je Position die zugewiesenen Crew-Namen + offene Slots.
//
// i18n-Phase: PDF-Sprache = Instanz-Default (kein Query-Override, siehe getDefaultLang()).

import { formatShiftDate } from './format.js'
import { t, getDefaultLang, type Lang } from '../i18n.js'
import { shiftTypeLabel } from '../domain/labels.js'
import { weekdayName } from '../domain/dates.js'

export interface SelectionShift {
  date: string
  type: 'day' | 'night'
  start_time: string
  end_time: string
  positions: Array<{
    label: string
    crew: string[]
    open: number
  }>
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function selectionHtml(shifts: SelectionShift[], eventName: string, lang: Lang = getDefaultLang()): string {
  const blocks = shifts.map(shift => {
    const typeLabel = shiftTypeLabel(lang, shift.type)
    const dayName = weekdayName(shift.date, lang)
    const formattedDate = escapeHtml(formatShiftDate(shift.date, lang))

    const positionRows = shift.positions.map(pos => {
      const names = pos.crew.length > 0
        ? pos.crew.map(escapeHtml).join(', ')
        : '<span class="muted">—</span>'
      const openTag = pos.open > 0
        ? ` <span class="open">${escapeHtml(t(lang, 'pdf.selection.openSlots', { count: pos.open }))}</span>`
        : ''
      return `      <div class="pos-row">
        <span class="pos-label">${escapeHtml(pos.label)}:</span> ${names}${openTag}
      </div>`
    }).join('\n')

    return `  <div class="shift-block">
    <h3>${escapeHtml(dayName)} ${escapeHtml(typeLabel)} (${formattedDate}, ${escapeHtml(shift.start_time)}–${escapeHtml(shift.end_time)})</h3>
${positionRows}
  </div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <style>
    @page { margin: 15mm 10mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; margin: 0; color: #000; }
    h1 { font-size: 14pt; font-weight: 700; margin: 0 0 12px 0; line-height: 1.2; }
    h3 { font-size: 11pt; font-weight: 700; margin: 0 0 4px 0; line-height: 1.2; }
    .shift-block { margin: 0 0 14px 0; padding: 0 0 10px 0; border-bottom: 1px solid #ccc; }
    .pos-row { font-size: 10pt; line-height: 1.45; padding: 1px 0; }
    .pos-label { font-weight: 700; }
    .muted { color: #777; }
    .open { background: #fee2e2; color: #991b1b; padding: 1px 4px; font-weight: 700; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  </style>
</head>
<body>
  <h1>${escapeHtml(t(lang, 'pdf.selection.title', { event: eventName }))}</h1>
${blocks}
</body>
</html>`
}
