import { html, raw } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { layout } from './layout.js'
import { formatShiftDate, formatShiftDateRange } from './format.js'
import { getBranding } from '../domain/branding.js'
import type { ShiftPositionRow } from '../services/shifts.js'
import { t, langSwitcherHtml, type Lang } from '../i18n.js'
import { shiftTypeLabel } from '../domain/labels.js'
import { weekdayName } from '../domain/dates.js'

// Öffentliche, read-only Schichtplan-Übersicht (Ticket #397 Phase 3, Teil D).
// Bewusst schlanke, eigenständige View (KEINE Wiederverwendung von shiftsPage), damit
// per Konstruktion KEINE Crew-Namen geladen/gerendert werden und keine Admin-Aktionen
// (assign/move/settings/export) durchsickern. Zeigt ausschließlich Besetzungsstand
// (filled/capacity) je Schicht und je Position + Uhrzeiten.

interface PublicPositionSummary {
  label: string
  filled: number
  capacity: number
}

interface PublicShiftSummary {
  shift_id: number
  date: string
  dateLabel: string
  day_name: string
  type: 'day' | 'night'
  typeLabel: string
  start_time: string
  end_time: string
  sort_order: number
  color: string
  totalFilled: number
  totalCapacity: number
  open: number
  fillState: 'empty' | 'partial' | 'full'
  positions: PublicPositionSummary[]
}

export function publicSchichtplanPage(rows: ShiftPositionRow[], lang: Lang = 'de'): HtmlEscapedString {
  const branding = getBranding()
  const dateRange = formatShiftDateRange(rows.map(r => r.date), lang)

  // Gruppieren nach shift_id (rows sind bereits nach sort_order/position sort_order geordnet)
  const shiftMap = new Map<number, ShiftPositionRow[]>()
  for (const row of rows) {
    if (!shiftMap.has(row.shift_id)) shiftMap.set(row.shift_id, [])
    shiftMap.get(row.shift_id)!.push(row)
  }

  const summaries: PublicShiftSummary[] = Array.from(shiftMap.values()).map(positions => {
    const shift = positions[0]
    // Nur Positionen mit Bedarf (capacity > 0) anzeigen.
    const relevant = positions.filter(p => p.capacity > 0)
    const totalFilled = relevant.reduce((sum, p) => sum + p.filled, 0)
    const totalCapacity = relevant.reduce((sum, p) => sum + p.capacity, 0)
    const fillState: 'empty' | 'partial' | 'full' = totalFilled === 0 ? 'empty'
      : totalFilled >= totalCapacity ? 'full'
      : 'partial'
    return {
      shift_id: shift.shift_id,
      date: shift.date,
      dateLabel: formatShiftDate(shift.date, lang),
      day_name: weekdayName(shift.date, lang),
      type: shift.type,
      typeLabel: shiftTypeLabel(lang, shift.type),
      start_time: shift.start_time,
      end_time: shift.end_time,
      sort_order: shift.sort_order,
      color: shift.color ?? '#6366f1',
      totalFilled,
      totalCapacity,
      open: Math.max(0, totalCapacity - totalFilled),
      fillState,
      positions: relevant.map(p => ({ label: p.position_label, filled: p.filled, capacity: p.capacity })),
    }
  })

  const fillTextClass = (state: 'empty' | 'partial' | 'full') =>
    state === 'full' ? 'text-primary-fixed-dim'
      : state === 'partial' ? 'text-tertiary-fixed-dim'
      : 'text-error'
  const fillBarClass = (state: 'empty' | 'partial' | 'full') =>
    state === 'full' ? 'bg-primary-fixed-dim'
      : state === 'partial' ? 'bg-tertiary-fixed-dim'
      : 'bg-error'

  // Positions-Detail je Schicht (label + filled/capacity, OHNE Namen)
  const positionDetail = (s: PublicShiftSummary) => {
    if (s.positions.length === 0) return '' as unknown as HtmlEscapedString
    const chips = s.positions.map(p => {
      const posState: 'empty' | 'partial' | 'full' = p.filled === 0 ? 'empty'
        : p.filled >= p.capacity ? 'full'
        : 'partial'
      return html`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-label bg-surface-container">
        <span class="text-on-surface-variant">${p.label}</span>
        <span class="font-semibold ${fillTextClass(posState)}">${p.filled}/${p.capacity}</span>
      </span>` as HtmlEscapedString
    })
    return html`<div class="flex flex-wrap gap-1.5 mt-2">${chips}</div>` as HtmlEscapedString
  }

  // (a) Liste — read-only Tabelle.
  // data-shift-id ist hier bewusst reserviert für eine spätere Filter-/Sortier-Funktion
  // (die öffentliche Seite hat aktuell kein solches Script) und wird derzeit nicht ausgewertet.
  const listRows = summaries.map(s => html`<tr
    data-shift-id="${s.shift_id}"
    class="border-b border-outline-variant align-top hover:bg-surface-container-low transition-colors">
    <td class="py-3 px-3 text-on-surface">
      <span class="inline-flex items-center gap-2">
        <span class="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${s.color}"></span>
        ${s.dateLabel}
      </span>
    </td>
    <td class="py-3 px-3 text-on-surface">${s.day_name}</td>
    <td class="py-3 px-3 text-on-surface-variant">${s.start_time}–${s.end_time}</td>
    <td class="py-3 px-3 text-on-surface">${s.typeLabel}</td>
    <td class="py-3 px-3 font-semibold ${fillTextClass(s.fillState)}">${s.totalFilled}/${s.totalCapacity}</td>
    <td class="py-3 px-3">${positionDetail(s)}</td>
  </tr>` as HtmlEscapedString)

  // Kalender-/Zeitstrahl-Gruppierung nach distinct Tag (geordnet nach sort_order/Datum)
  const dayMap = new Map<string, PublicShiftSummary[]>()
  for (const s of summaries) {
    if (!dayMap.has(s.date)) dayMap.set(s.date, [])
    dayMap.get(s.date)!.push(s)
  }
  const days = Array.from(dayMap.entries())
    .sort((a, b) => (a[1][0].sort_order - b[1][0].sort_order) || a[0].localeCompare(b[0]))

  // (b) Kalender — eine Spalte je Tag
  const calendarColumns = days.map(([, daySummaries]) => {
    const head = daySummaries[0]
    const blocks = daySummaries.map(s => html`<div
      class="block rounded-xl bg-surface-container-lowest p-3 border-l-4"
      style="border-left-color: ${s.color}">
      <div class="flex items-center justify-between gap-2">
        <span class="font-headline font-bold text-sm text-on-surface">${s.typeLabel}</span>
        <span class="font-headline font-bold text-xs ${fillTextClass(s.fillState)}">${s.totalFilled}/${s.totalCapacity}</span>
      </div>
      <div class="text-xs text-on-surface-variant mt-1">${s.start_time}–${s.end_time}</div>
      <div class="h-1.5 w-full bg-surface-variant rounded-full overflow-hidden mt-2">
        <div class="h-full ${fillBarClass(s.fillState)} rounded-full" style="width: ${s.totalCapacity > 0 ? Math.round((s.totalFilled / s.totalCapacity) * 100) : 0}%"></div>
      </div>
    </div>` as HtmlEscapedString)
    return html`<div class="flex flex-col gap-3 min-w-[160px] flex-1">
      <div class="font-headline font-semibold text-sm text-on-surface-variant text-center pb-2 border-b border-outline-variant">
        ${head.day_name}<br><span class="text-xs font-normal">${head.dateLabel}</span>
      </div>
      <div class="flex flex-col gap-2">${blocks}</div>
    </div>` as HtmlEscapedString
  })

  // (c) Zeitstrahl — horizontale Leiste je Tag
  const timelineRows = days.map(([, daySummaries]) => {
    const head = daySummaries[0]
    const blocks = daySummaries.map(s => html`<div
      class="flex-1 min-w-[120px] rounded-lg p-3 border-t-4 bg-surface-container-lowest"
      style="border-top-color: ${s.color}">
      <div class="font-headline font-semibold text-sm text-on-surface">${s.typeLabel}</div>
      <div class="text-xs text-on-surface-variant">${s.start_time}–${s.end_time}</div>
      <div class="text-xs font-semibold mt-1 ${fillTextClass(s.fillState)}">${s.totalFilled}/${s.totalCapacity}</div>
    </div>` as HtmlEscapedString)
    return html`<div class="flex items-stretch gap-3 py-2">
      <div class="w-28 flex-shrink-0 flex flex-col justify-center">
        <span class="font-headline font-semibold text-sm text-on-surface">${head.day_name}</span>
        <span class="text-xs text-on-surface-variant">${head.dateLabel}</span>
      </div>
      <div class="flex-1 flex flex-wrap gap-2">${blocks}</div>
    </div>` as HtmlEscapedString
  })

  // Gesamt-Aggregat für die Kopf-Zusammenfassung
  const grandFilled = summaries.reduce((sum, s) => sum + s.totalFilled, 0)
  const grandCapacity = summaries.reduce((sum, s) => sum + s.totalCapacity, 0)
  const grandPct = grandCapacity > 0 ? Math.round((grandFilled / grandCapacity) * 100) : 0

  // Read-only Ansichts-Umschalter (Liste default), rein clientseitig.
  const viewScript = `
    var VIEWS = ['liste','kalender','zeitstrahl'];
    function applyView(view) {
      if (VIEWS.indexOf(view) === -1) view = 'liste';
      VIEWS.forEach(function(v) {
        var c = document.getElementById('view-' + v);
        if (c) c.hidden = (v !== view);
      });
      document.querySelectorAll('#view-switcher .view-btn').forEach(function(btn) {
        var active = btn.dataset.view === view;
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.classList.toggle('bg-primary', active);
        btn.classList.toggle('text-on-primary', active);
        btn.classList.toggle('border-primary', active);
        btn.classList.toggle('text-on-surface-variant', !active);
        btn.classList.toggle('border-outline-variant', !active);
      });
    }
    var hashMatch = (window.location.hash || '').match(/view=([a-z]+)/);
    applyView(hashMatch && VIEWS.indexOf(hashMatch[1]) !== -1 ? hashMatch[1] : 'liste');
    document.querySelectorAll('#view-switcher .view-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        applyView(btn.dataset.view);
        if (history.replaceState) history.replaceState(null, '', '#view=' + btn.dataset.view);
      });
    });
  `

  const totalShifts = summaries.length

  const content = html`
<div class="max-w-5xl mx-auto px-4 py-8">
  <div class="flex flex-col gap-1 mb-6">
    <h1 class="font-headline font-extrabold text-3xl text-primary-container tracking-tight">${t(lang, 'publicSchedule.title', { event: branding.event_name })}</h1>
    <p class="text-sm text-on-surface-variant">${t(lang, 'publicSchedule.subtitle')}${dateRange ? ` ${dateRange}.` : ''}</p>
  </div>

  <div class="bg-surface-container-low rounded-xl p-5 mb-8 flex flex-wrap items-center gap-4">
    <div class="flex flex-col">
      <span class="font-headline font-bold text-2xl text-on-surface">${grandFilled}/${grandCapacity}</span>
      <span class="text-xs text-on-surface-variant">${t(lang, 'publicSchedule.seatsFilled')}</span>
    </div>
    <div class="flex-1 min-w-[160px]">
      <div class="h-2 w-full bg-surface-variant rounded-full overflow-hidden">
        <div class="h-full bg-primary-fixed-dim rounded-full" style="width: ${grandPct}%"></div>
      </div>
    </div>
    <span class="font-headline font-bold text-xl text-primary-container">${grandPct}%</span>
  </div>

  <div class="flex flex-wrap gap-2 mb-6" id="view-switcher" role="group" aria-label="${t(lang, 'publicSchedule.viewSwitcherLabel')}">
    <button type="button" data-view="liste" aria-pressed="false"
      class="view-btn flex items-center gap-1.5 px-4 py-2 rounded-xl font-label text-sm font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors">
      <span class="material-symbols-outlined text-[18px]">view_list</span>${t(lang, 'publicSchedule.view.list')}
    </button>
    <button type="button" data-view="kalender" aria-pressed="false"
      class="view-btn flex items-center gap-1.5 px-4 py-2 rounded-xl font-label text-sm font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors">
      <span class="material-symbols-outlined text-[18px]">calendar_month</span>${t(lang, 'publicSchedule.view.calendar')}
    </button>
    <button type="button" data-view="zeitstrahl" aria-pressed="false"
      class="view-btn flex items-center gap-1.5 px-4 py-2 rounded-xl font-label text-sm font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors">
      <span class="material-symbols-outlined text-[18px]">timeline</span>${t(lang, 'publicSchedule.view.timeline')}
    </button>
  </div>

  <p class="text-sm text-on-surface-variant mb-4">${t(lang, 'publicSchedule.shiftCount', { count: totalShifts })}</p>

  <!-- Listen-Ansicht (read-only) -->
  <div id="view-liste" hidden>
    <div class="overflow-x-auto bg-surface-container-low rounded-xl">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-outline">
            <th class="text-left font-semibold text-on-surface-variant py-2.5 px-3">${t(lang, 'publicSchedule.col.date')}</th>
            <th class="text-left font-semibold text-on-surface-variant py-2.5 px-3">${t(lang, 'publicSchedule.col.weekday')}</th>
            <th class="text-left font-semibold text-on-surface-variant py-2.5 px-3">${t(lang, 'publicSchedule.col.time')}</th>
            <th class="text-left font-semibold text-on-surface-variant py-2.5 px-3">${t(lang, 'publicSchedule.col.type')}</th>
            <th class="text-left font-semibold text-on-surface-variant py-2.5 px-3">${t(lang, 'publicSchedule.col.fill')}</th>
            <th class="text-left font-semibold text-on-surface-variant py-2.5 px-3">${t(lang, 'publicSchedule.col.positions')}</th>
          </tr>
        </thead>
        <tbody>
          ${listRows}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Kalender-Ansicht (read-only) -->
  <div id="view-kalender" hidden>
    <div class="flex flex-wrap gap-4 items-start">
      ${calendarColumns}
    </div>
  </div>

  <!-- Zeitstrahl-Ansicht (read-only) -->
  <div id="view-zeitstrahl" hidden>
    <div class="flex flex-col gap-2 bg-surface-container-low rounded-xl p-4 divide-y divide-outline-variant">
      ${timelineRows}
    </div>
  </div>

  <footer class="mt-10 text-xs">${langSwitcherHtml(lang)}</footer>
</div>

<script>${raw(viewScript)}</script>
` as HtmlEscapedString

  // fullWidth: ohne Nav, aber volle Breite — die Seite bringt ihr eigenes max-w-5xl mit,
  // sonst würde der zentrierte max-w-2xl-Container Kalender/Zeitstrahl stauchen.
  return layout(t(lang, 'publicSchedule.pageTitle'), content, { lang, fullWidth: true })
}
