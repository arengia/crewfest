import { html, raw } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { layout } from './layout.js'
import { getBranding } from '../domain/branding.js'
import type { ShiftPositionRow, AvailableCrewRow, AssignedCrewRow } from '../services/shifts.js'
import type { SuggestedCrewRow } from '../services/suggest.js'
import { statusLabel, shiftTypeLabel } from '../domain/labels.js'
import { t, jsonScriptEscape, type Lang } from '../i18n.js'
import { weekdayName } from '../domain/dates.js'

// File-internal helpers — not exported

function renderStars(level: number): string {
  const n = Math.max(0, Math.min(5, Math.round(level)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

// Render assigned crew table with Entfernen + Verschieben (D-14, D-15)
function renderAssignedTable(
  assigned: AssignedCrewRow[],
  pos: ShiftPositionRow,
  allShifts: { id: number; date: string; type: string }[] | undefined,
  lang: Lang
): HtmlEscapedString {
  const assignedRows = assigned.map(member => {
    const levelWarningClass = member.effective_level < pos.min_level ? ' class="bg-tertiary-fixed/30"' : ''
    const levelWarningTip = member.effective_level < pos.min_level
      ? html`<small title="${t(lang, 'shifts.levelTooLow', { min: pos.min_level })}">⚠</small>` as HtmlEscapedString
      : ('' as unknown as HtmlEscapedString)
    const shiftOptions = (allShifts ?? []).filter(s => s.id !== pos.shift_id).map(s =>
      html`<option value="${s.id}">${weekdayName(s.date, lang)} ${shiftTypeLabel(lang, s.type).charAt(0)}</option>` as HtmlEscapedString
    )
    return html`<tr${raw(levelWarningClass)}>
      <td class="py-2 px-3 text-on-surface"><a href="/admin/crew/${member.crew_id}" class="hover:text-primary transition-colors">${member.first_name} ${member.last_name}</a></td>
      <td class="py-2 px-3 text-on-surface"><span class="level-stars" aria-label="${t(lang, 'common.starsAriaLabel', { level: member.effective_level })}">${renderStars(member.effective_level)}</span> ${levelWarningTip}</td>
      <td class="py-2 px-3">
        <form method="POST" action="/admin/assignments/${member.assignment_id}/delete" style="display:inline">
          <input type="hidden" name="redirect" value="/admin/shifts?open=${pos.shift_id}-${pos.position_id}">
          <button type="submit" class="px-3 py-1 text-xs rounded-lg border border-error text-error hover:bg-error-container transition-colors">${t(lang, 'crewDetail.remove')}</button>
        </form>
        <form method="POST" action="/admin/assignments/${member.assignment_id}/move" style="display:inline;margin-left:0.3rem;">
          <input type="hidden" name="redirect" value="/admin/shifts?open=${pos.shift_id}-${pos.position_id}">
          <select name="target_shift_id" required class="bg-surface-variant border-none rounded px-2 py-1 text-xs font-body text-on-surface focus:ring-0 cursor-pointer" style="display:inline;width:auto;">
            <option value="">${t(lang, 'crewDetail.movePlaceholder')}</option>
            ${shiftOptions}
          </select>
          <button type="submit" class="px-3 py-1 text-xs rounded-lg border border-outline text-on-surface-variant hover:bg-surface-variant transition-colors">${t(lang, 'shifts.move')}</button>
        </form>
      </td>
    </tr>` as HtmlEscapedString
  })
  return html`<table class="w-full text-sm">
    <thead><tr>
      <th class="text-left font-semibold text-on-surface-variant py-2 px-3">${t(lang, 'common.name')}</th>
      <th class="text-left font-semibold text-on-surface-variant py-2 px-3">${t(lang, 'common.level')}</th>
      <th class="text-left font-semibold text-on-surface-variant py-2 px-3">${t(lang, 'common.action')}</th>
    </tr></thead>
    <tbody>${assignedRows}</tbody>
  </table>` as HtmlEscapedString
}

export function shiftsPage(
  rows: ShiftPositionRow[],
  slotPanels: Map<string, AvailableCrewRow[]>,
  errorContext?: { shift_id: number; position_id: number; message: string },
  assignedPanels?: Map<string, AssignedCrewRow[]>,
  openParam?: string | null,
  allShifts?: { id: number; date: string; type: string }[],
  suggestPanels?: Map<string, SuggestedCrewRow[]>,
  lang: Lang = 'de'
): HtmlEscapedString {
  const branding = getBranding()

  // Group rows by shift_id (rows are already ordered by sort_order from the query)
  const shiftMap = new Map<number, ShiftPositionRow[]>()
  for (const row of rows) {
    if (!shiftMap.has(row.shift_id)) shiftMap.set(row.shift_id, [])
    shiftMap.get(row.shift_id)!.push(row)
  }

  // Build shift cards
  const shiftCards = Array.from(shiftMap.values()).map(positions => {
    const shift = positions[0]
    const typeLabel = shiftTypeLabel(lang, shift.type)
    const dayName = weekdayName(shift.date, lang)

    // Calculate fill state for pillar colour
    const totalFilled = positions.reduce((sum, p) => sum + p.filled, 0)
    const totalCapacity = positions.reduce((sum, p) => sum + p.capacity, 0)
    const shiftFillState = totalFilled === 0 ? 'empty'
      : totalFilled >= totalCapacity ? 'full'
      : 'partial'
    const pillarColor = shiftFillState === 'full' ? 'bg-primary-fixed'
      : shiftFillState === 'partial' ? 'bg-tertiary-fixed-dim'
      : 'bg-error'

    // Slot chips row — ALL chips are clickable, never disabled (D-03)
    const chips = positions.map(pos => {
      const fillState = pos.filled === 0 ? 'empty'
        : pos.filled >= pos.capacity ? 'full'
        : 'partial'

      const chipFillClasses = fillState === 'empty'
        ? 'bg-tertiary-fixed text-on-tertiary-fixed border-tertiary-fixed-dim'
        : fillState === 'partial'
          ? 'bg-secondary-container text-on-secondary-container border-secondary-fixed-dim'
          : 'bg-primary-fixed text-on-primary-fixed border-primary-fixed cursor-default'

      const suggestIcon = fillState !== 'full' ? ' 💡' : ''
      const chipTitle = fillState !== 'full'
        ? t(lang, 'shifts.chipTitleSuggest', { label: pos.position_label, min: pos.min_level })
        : t(lang, 'shifts.chipTitleDefault', { label: pos.position_label, min: pos.min_level })

      return html`<button
        class="slot-chip px-3 py-1.5 rounded-full text-xs font-label font-semibold border transition-colors cursor-pointer ${chipFillClasses}"
        data-shift-id="${pos.shift_id}"
        data-position-id="${pos.position_id}"
        data-fill-state="${fillState}"
        title="${chipTitle}"
        aria-expanded="false"
        aria-controls="panel-${pos.shift_id}-${pos.position_id}"
      >▾ ${pos.position_label} ${pos.filled}/${pos.capacity}${suggestIcon}</button>` as HtmlEscapedString
    })

    // Sub-panels
    const panels = positions.map(pos => {
      const panelId = `panel-${pos.shift_id}-${pos.position_id}`
      const isErrorSlot =
        errorContext &&
        errorContext.shift_id === pos.shift_id &&
        errorContext.position_id === pos.position_id
      const crew = slotPanels.get(`${pos.shift_id}-${pos.position_id}`) ?? []
      const assigned = assignedPanels?.get(`${pos.shift_id}-${pos.position_id}`) ?? []
      const isFull = pos.filled >= pos.capacity

      const errorBlock = isErrorSlot
        ? html`<p class="text-sm text-error mb-3">${errorContext!.message}</p>` as HtmlEscapedString
        : ('' as unknown as HtmlEscapedString)

      let panelContent: HtmlEscapedString

      if (isFull && assigned.length > 0) {
        // Full slot: show assigned crew with unassign + Verschieben buttons (D-03, D-14, D-15)
        panelContent = html`<h6 class="font-headline font-semibold text-sm text-on-surface mb-3">${t(lang, 'shifts.assignedCrew')}</h6>
          ${renderAssignedTable(assigned, pos, allShifts, lang)}` as HtmlEscapedString
      } else {
        // Suggest section (SHIFT-05, D-16)
        const suggestKey = `${pos.shift_id}-${pos.position_id}`
        const suggestions = suggestPanels?.get(suggestKey) ?? []

        let suggestSection: HtmlEscapedString
        if (suggestions.length > 0) {
          const suggestRows = suggestions.map(s => {
            const stars = renderStars(s.effective_level)
            const countBold = s.assignment_count >= 2
            return html`<tr>
              <td class="py-2 px-3 text-on-surface"><a href="/admin/crew/${s.id}" class="hover:text-primary transition-colors">${s.first_name} ${s.last_name}</a></td>
              <td class="py-2 px-3 text-on-surface"><span class="level-stars" aria-label="${t(lang, 'common.starsAriaLabel', { level: s.effective_level })}">${stars}</span></td>
              <td class="py-2 px-3 text-on-surface">${countBold ? html`<strong>${s.assignment_count}</strong>` : html`${s.assignment_count}`}</td>
              <td class="py-2 px-3">
                <form method="POST" action="/admin/shifts/${pos.shift_id}/assign" style="display:inline">
                  <input type="hidden" name="crew_id" value="${s.id}">
                  <input type="hidden" name="position_id" value="${pos.position_id}">
                  <button type="submit" class="assign-btn bg-gradient-to-r from-primary to-primary-container text-on-primary px-4 py-1.5 rounded-lg font-label text-xs font-semibold hover:opacity-90 transition-opacity">${t(lang, 'shifts.assign')}</button>
                </form>
              </td>
            </tr>` as HtmlEscapedString
          })
          suggestSection = html`<h6 class="font-headline font-semibold text-sm text-on-surface mb-2">${t(lang, 'shifts.suggestions')}</h6>
            <table class="w-full text-sm mb-4">
              <thead><tr>
                <th class="text-left font-semibold text-on-surface-variant py-2 px-3">${t(lang, 'common.name')}</th>
                <th class="text-left font-semibold text-on-surface-variant py-2 px-3">${t(lang, 'common.level')}</th>
                <th class="text-left font-semibold text-on-surface-variant py-2 px-3">${t(lang, 'dashboard.colShifts')}</th>
                <th class="text-left font-semibold text-on-surface-variant py-2 px-3">${t(lang, 'common.action')}</th>
              </tr></thead>
              <tbody>${suggestRows}</tbody>
            </table>
            <hr class="border-outline-variant mb-4">` as HtmlEscapedString
        } else {
          suggestSection = html`<h6 class="font-headline font-semibold text-sm text-on-surface mb-2">${t(lang, 'shifts.suggestions')}</h6>
            <p class="text-sm text-on-surface mb-1"><strong>${t(lang, 'shifts.noCandidates')}</strong></p>
            <p class="text-xs text-on-surface-variant mb-4">${t(lang, 'shifts.noCandidatesHint')}</p>
            <hr class="border-outline-variant mb-4">` as HtmlEscapedString
        }

        // Not full: show available crew with assign buttons + level warning (D-04)
        let crewContent: HtmlEscapedString
        if (crew.length === 0) {
          crewContent = html`<p class="text-sm text-on-surface-variant">${t(lang, 'shifts.noCrewAvailable')}</p>` as HtmlEscapedString
        } else {
          const crewRows = crew.map(member => {
            const levelWarningClass = member.effective_level < pos.min_level ? ' class="bg-tertiary-fixed/30"' : ''
            const levelWarningBadge = member.effective_level < pos.min_level
              ? html`<small title="${t(lang, 'shifts.levelWarningTitle', { min: pos.min_level })}">⚠ ${t(lang, 'shifts.levelWarningBadge', { level: member.effective_level, min: pos.min_level })}</small>` as HtmlEscapedString
              : ('' as unknown as HtmlEscapedString)
            return html`<tr${raw(levelWarningClass)}>
              <td class="py-2 px-3 text-on-surface">${member.first_name} ${member.last_name}</td>
              <td class="py-2 px-3 text-on-surface"><span class="level-stars" aria-label="${t(lang, 'common.starsAriaLabel', { level: member.effective_level })}">${renderStars(member.effective_level)}</span></td>
              <td class="py-2 px-3"><span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-variant text-on-surface-variant">${statusLabel(lang, member.status)}</span></td>
              <td class="py-2 px-3">
                ${levelWarningBadge}
                <form method="POST" action="/admin/shifts/${pos.shift_id}/assign" style="display:inline">
                  <input type="hidden" name="crew_id" value="${member.id}">
                  <input type="hidden" name="position_id" value="${pos.position_id}">
                  <button type="submit" class="assign-btn bg-gradient-to-r from-primary to-primary-container text-on-primary px-4 py-1.5 rounded-lg font-label text-xs font-semibold hover:opacity-90 transition-opacity">${t(lang, 'shifts.assign')}</button>
                </form>
              </td>
            </tr>` as HtmlEscapedString
          })
          crewContent = html`<table class="w-full text-sm">
            <thead><tr>
              <th class="text-left font-semibold text-on-surface-variant py-2 px-3">${t(lang, 'common.name')}</th>
              <th class="text-left font-semibold text-on-surface-variant py-2 px-3">${t(lang, 'common.level')}</th>
              <th class="text-left font-semibold text-on-surface-variant py-2 px-3">${t(lang, 'common.status')}</th>
              <th class="text-left font-semibold text-on-surface-variant py-2 px-3">${t(lang, 'common.action')}</th>
            </tr></thead>
            <tbody>${crewRows}</tbody>
          </table>` as HtmlEscapedString
        }

        // Also show assigned crew below available crew if any exist (D-14, D-15)
        const assignedSection = assigned.length > 0
          ? html`<h6 class="font-headline font-semibold text-sm text-on-surface mt-4 mb-2">${t(lang, 'shifts.assignedCrew')}</h6>
            ${renderAssignedTable(assigned, pos, allShifts, lang)}` as HtmlEscapedString
          : ('' as unknown as HtmlEscapedString)

        panelContent = html`${suggestSection}<h6 class="font-headline font-semibold text-sm text-on-surface mb-2">${t(lang, 'shifts.allAvailableCrew')}</h6>${crewContent}${assignedSection}` as HtmlEscapedString
      }

      const panelHeader = isFull
        ? t(lang, 'shifts.panelHeaderFull', { day: dayName, type: typeLabel, position: pos.position_label, filled: pos.filled, capacity: pos.capacity })
        : t(lang, 'shifts.panelHeaderAvailable', { day: dayName, type: typeLabel, position: pos.position_label, filled: pos.filled, capacity: pos.capacity })

      if (isErrorSlot) {
        return html`<div
          id="${panelId}"
          data-error-panel="${panelId}"
          hidden
          class="mt-3 rounded-xl overflow-hidden bg-surface-container-low"
        >
          <div class="px-6 py-3 bg-surface-container font-headline font-semibold text-sm text-on-surface">${panelHeader}</div>
          <div class="p-6">
            ${errorBlock}
            ${panelContent}
          </div>
        </div>` as HtmlEscapedString
      }
      return html`<div
        id="${panelId}"
        hidden
        class="mt-3 rounded-xl overflow-hidden bg-surface-container-low"
      >
        <div class="px-6 py-3 bg-surface-container font-headline font-semibold text-sm text-on-surface">${panelHeader}</div>
        <div class="p-6">
          ${panelContent}
        </div>
      </div>` as HtmlEscapedString
    })

    const shiftColor = shift.color ?? '#6366f1'

    // Aggregate filter metadata for this card (Ticket #397 filter bar)
    const positionLabels = positions.map(p => p.position_label.toLowerCase())
    const crewNames = positions.flatMap(pos => {
      const assigned = assignedPanels?.get(`${pos.shift_id}-${pos.position_id}`) ?? []
      return assigned.map(m => `${m.first_name} ${m.last_name}`.toLowerCase())
    })
    const dataPositions = positionLabels.join('|')
    const dataCrewNames = crewNames.join(', ')
    const dataSearch = [dayName, typeLabel, positionLabels.join(' '), dataCrewNames]
      .join(' ')
      .toLowerCase()

    return html`<div class="bg-surface-container-lowest rounded-xl flex items-start pl-4 pr-6 py-5 relative flex-col border-t-4" style="border-top-color: ${shiftColor}"
      data-shift-id="${shift.shift_id}"
      data-date="${shift.date}"
      data-type="${shift.type}"
      data-positions="${dataPositions}"
      data-crew-names="${dataCrewNames}"
      data-fill-state="${shiftFillState}"
      data-search="${dataSearch}">
      <div class="absolute left-0 top-3 bottom-3 w-1 ${pillarColor} rounded-r-full"></div>
      <div class="flex-1 flex items-center justify-between ml-4 w-full">
        <div class="flex flex-col gap-1 w-1/3">
          <h3 class="font-headline font-bold text-on-surface text-lg flex items-center gap-2">
            <span class="inline-block w-3 h-3 rounded-full flex-shrink-0" style="background-color: ${shiftColor}"></span>
            ${dayName} ${typeLabel}
          </h3>
          <div class="flex items-center gap-2 text-on-surface-variant font-label text-sm">
            <span class="material-symbols-outlined text-[18px]">schedule</span>
            <span>${shift.date} ${shift.start_time}–${shift.end_time}</span>
          </div>
        </div>
        <div class="flex-1 flex flex-wrap gap-2 px-6">
          ${chips}
        </div>
      </div>
      ${panels}
    </div>` as HtmlEscapedString
  })

  // ── Phase 2 (#397): zusätzliche read-only Ansichten aus derselben shiftMap ──
  // Pro Schicht ein kompaktes Aggregat-Objekt, das alle drei neuen Ansichten teilen.
  interface ShiftSummary {
    shift_id: number
    date: string
    day_name: string
    type: 'day' | 'night'
    typeLabel: string
    start_time: string
    end_time: string
    sort_order: number
    color: string
    positionCount: number
    totalFilled: number
    totalCapacity: number
    fillState: 'empty' | 'partial' | 'full'
  }

  const shiftSummaries: ShiftSummary[] = Array.from(shiftMap.values()).map(positions => {
    const shift = positions[0]
    const totalFilled = positions.reduce((sum, p) => sum + p.filled, 0)
    const totalCapacity = positions.reduce((sum, p) => sum + p.capacity, 0)
    const fillState: 'empty' | 'partial' | 'full' = totalFilled === 0 ? 'empty'
      : totalFilled >= totalCapacity ? 'full'
      : 'partial'
    return {
      shift_id: shift.shift_id,
      date: shift.date,
      day_name: weekdayName(shift.date, lang),
      type: shift.type,
      typeLabel: shiftTypeLabel(lang, shift.type),
      start_time: shift.start_time,
      end_time: shift.end_time,
      sort_order: shift.sort_order,
      color: shift.color ?? '#6366f1',
      positionCount: positions.length,
      totalFilled,
      totalCapacity,
      fillState,
    }
  })

  // Farb-Helfer pro Füllgrad (read-only Ansichten teilen sich diese Klassen)
  const fillTextClass = (state: 'empty' | 'partial' | 'full') =>
    state === 'full' ? 'text-primary-fixed-dim'
      : state === 'partial' ? 'text-tertiary-fixed-dim'
      : 'text-error'

  // "In Karten öffnen" — schaltet auf Karten-Ansicht und öffnet erste Position der Schicht.
  // role=link + data-open-card greift im viewScript; href ist Fallback ohne JS.
  const openCardLink = (s: ShiftSummary) =>
    html`<a href="#view=karten" data-open-card="${s.shift_id}" class="open-card-link text-xs text-primary hover:underline font-label inline-flex items-center gap-1">
      <span class="material-symbols-outlined text-[14px]">grid_view</span>${t(lang, 'shifts.openInCards')}
    </a>` as HtmlEscapedString

  // (a) Kalender — eine Spalte je distinct Tag, geordnet nach sort_order/Datum
  const calendarDayMap = new Map<string, ShiftSummary[]>()
  for (const s of shiftSummaries) {
    if (!calendarDayMap.has(s.date)) calendarDayMap.set(s.date, [])
    calendarDayMap.get(s.date)!.push(s)
  }
  const calendarDays = Array.from(calendarDayMap.entries())
    .sort((a, b) => (a[1][0].sort_order - b[1][0].sort_order) || a[0].localeCompare(b[0]))
  const calendarColumns = calendarDays.map(([date, daySummaries]) => {
    const head = daySummaries[0]
    const blocks = daySummaries.map(s => html`<a
      href="#view=karten"
      data-open-card="${s.shift_id}"
      data-shift-id="${s.shift_id}"
      class="open-card-link block rounded-xl bg-surface-container-lowest p-3 border-l-4 hover:bg-surface-container transition-colors cursor-pointer"
      style="border-left-color: ${s.color}">
      <div class="flex items-center justify-between gap-2">
        <span class="font-headline font-bold text-sm text-on-surface">${s.typeLabel}</span>
        <span class="font-headline font-bold text-xs ${fillTextClass(s.fillState)}">${s.totalFilled}/${s.totalCapacity}</span>
      </div>
      <div class="text-xs text-on-surface-variant mt-1">${s.start_time}–${s.end_time}</div>
    </a>` as HtmlEscapedString)
    return html`<div class="flex flex-col gap-3 min-w-[160px] flex-1" data-day="${date}">
      <div class="font-headline font-semibold text-sm text-on-surface-variant text-center pb-2 border-b border-outline-variant">
        ${head.day_name}<br><span class="text-xs font-normal">${date}</span>
      </div>
      <div class="flex flex-col gap-2">${blocks}</div>
    </div>` as HtmlEscapedString
  })

  // (b) Liste — sortierbare Tabelle (Header-Klick nach Datum/Zeit)
  const listRows = shiftSummaries.map(s => html`<tr
    data-shift-id="${s.shift_id}"
    data-sort-order="${s.sort_order}"
    data-date="${s.date}"
    data-time="${s.start_time}"
    class="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
    <td class="py-2.5 px-3">
      <input type="checkbox" name="shift_ids" value="${s.shift_id}" aria-label="${t(lang, 'shifts.selectRowAriaLabel', { day: s.day_name, type: s.typeLabel })}"
        class="shift-select rounded border-outline-variant text-primary focus:ring-primary cursor-pointer">
    </td>
    <td class="py-2.5 px-3 text-on-surface">
      <span class="inline-flex items-center gap-2">
        <span class="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0" style="background-color: ${s.color}"></span>
        ${s.date}
      </span>
    </td>
    <td class="py-2.5 px-3 text-on-surface">${s.day_name}</td>
    <td class="py-2.5 px-3 text-on-surface-variant">${s.start_time}–${s.end_time}</td>
    <td class="py-2.5 px-3 text-on-surface">${s.typeLabel}</td>
    <td class="py-2.5 px-3 text-on-surface-variant">${s.positionCount}</td>
    <td class="py-2.5 px-3 font-semibold ${fillTextClass(s.fillState)}">${s.totalFilled}/${s.totalCapacity}</td>
    <td class="py-2.5 px-3">${openCardLink(s)}</td>
  </tr>` as HtmlEscapedString)

  // (c) Zeitstrahl — horizontale Leiste je Tag mit Schicht-Blöcken
  const timelineRows = calendarDays.map(([date, daySummaries]) => {
    const head = daySummaries[0]
    const blocks = daySummaries.map(s => html`<a
      href="#view=karten"
      data-open-card="${s.shift_id}"
      data-shift-id="${s.shift_id}"
      class="open-card-link flex-1 min-w-[120px] rounded-lg p-3 border-t-4 bg-surface-container-lowest hover:bg-surface-container transition-colors cursor-pointer"
      style="border-top-color: ${s.color}">
      <div class="font-headline font-semibold text-sm text-on-surface">${s.typeLabel}</div>
      <div class="text-xs text-on-surface-variant">${s.start_time}–${s.end_time}</div>
      <div class="text-xs font-semibold mt-1 ${fillTextClass(s.fillState)}">${s.totalFilled}/${s.totalCapacity}</div>
    </a>` as HtmlEscapedString)
    return html`<div class="flex items-stretch gap-3 py-2" data-day="${date}">
      <div class="w-28 flex-shrink-0 flex flex-col justify-center">
        <span class="font-headline font-semibold text-sm text-on-surface">${head.day_name}</span>
        <span class="text-xs text-on-surface-variant">${date}</span>
      </div>
      <div class="flex-1 flex flex-wrap gap-2">${blocks}</div>
    </div>` as HtmlEscapedString
  })

  // Filter option lists (Ticket #397) — unique dates + position labels across all shifts
  const dateMap = new Map<string, string>() // date -> "day_name date"
  for (const positions of shiftMap.values()) {
    const shift = positions[0]
    if (!dateMap.has(shift.date)) dateMap.set(shift.date, `${weekdayName(shift.date, lang)} ${shift.date}`)
  }
  const dateOptions = Array.from(dateMap.entries()).map(
    ([date, label]) => html`<option value="${date}">${label}</option>`
  )

  const positionLabelSet = new Set<string>()
  for (const row of rows) positionLabelSet.add(row.position_label)
  const positionOptions = Array.from(positionLabelSet).map(
    (label) => html`<option value="${label.toLowerCase()}">${label}</option>`
  )

  const totalShifts = shiftMap.size

  // Kleines injiziertes I18N-Objekt (Server → Client) für dynamische Strings im Inline-JS
  // unten — t() bleibt serverseitig, das Script interpoliert nur noch die Zahlen.
  const i18nScript = `window.I18N = ${jsonScriptEscape({ filterCountTemplate: t(lang, 'shifts.filterCountTemplate') })};`

  // Ansichts-Umschalter (#397 Phase 2). Läuft VOR filter-/toggleScript, damit bei ?open=
  // zuerst auf Karten umgeschaltet wird und das Slot-Panel danach sichtbar geöffnet werden kann.
  const viewScript = `
    var VIEWS = ['karten','kalender','liste','zeitstrahl'];
    var STORAGE_KEY = 'crewfest-view';

    function applyView(view) {
      if (VIEWS.indexOf(view) === -1) view = 'liste';
      VIEWS.forEach(function(v) {
        var container = document.getElementById('view-' + v);
        if (container) container.hidden = (v !== view);
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
      return view;
    }

    function persistView(view) {
      try { localStorage.setItem(STORAGE_KEY, view); } catch (e) {}
      if (history.replaceState) {
        history.replaceState(null, '', '#view=' + view);
      } else {
        location.hash = 'view=' + view;
      }
    }

    // Initiale Ansicht: ?open= erzwingt Karten; sonst Hash, sonst localStorage, sonst Liste.
    var params = new URLSearchParams(window.location.search);
    var initial = null;
    if (params.get('open')) {
      initial = 'karten';
    } else {
      var hashMatch = (window.location.hash || '').match(/view=([a-z]+)/);
      if (hashMatch && VIEWS.indexOf(hashMatch[1]) !== -1) {
        initial = hashMatch[1];
      } else {
        try {
          var stored = localStorage.getItem(STORAGE_KEY);
          if (stored && VIEWS.indexOf(stored) !== -1) initial = stored;
        } catch (e) {}
      }
    }
    if (!initial) initial = 'liste';
    applyView(initial);

    document.querySelectorAll('#view-switcher .view-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var view = applyView(btn.dataset.view);
        persistView(view);
      });
    });

    // "In Karten öffnen" / Block-Klick -> auf Karten umschalten und Karte ins Bild scrollen
    document.querySelectorAll('.open-card-link').forEach(function(link) {
      link.addEventListener('click', function(ev) {
        ev.preventDefault();
        var id = link.dataset.openCard;
        applyView('karten');
        persistView('karten');
        var card = document.querySelector('#shift-cards > div[data-shift-id="' + id + '"]');
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          var chip = card.querySelector('.slot-chip');
          if (chip) chip.click();
        }
      });
    });
  `

  // Toggle JS for slot chips (sub-panel expand/collapse, RESEARCH.md Pattern 6)
  const toggleScript = `
document.querySelectorAll('.slot-chip').forEach(function(chip) {
  chip.addEventListener('click', function() {
    var panelId = chip.getAttribute('aria-controls');
    var panel = document.getElementById(panelId);
    var isExpanded = chip.getAttribute('aria-expanded') === 'true';

    // Close all panels and reset chevrons
    document.querySelectorAll('[id^="panel-"]').forEach(function(p) { p.hidden = true; });
    document.querySelectorAll('.slot-chip').forEach(function(c) {
      c.setAttribute('aria-expanded', 'false');
      c.classList.remove('ring-2', 'ring-primary', 'ring-offset-1');
      if (c.textContent && c.textContent.charAt(0) === '\\u25B4') {
        c.textContent = '\\u25BE' + c.textContent.slice(1);
      }
    });

    // Open this one unless it was already open (toggle)
    if (!isExpanded) {
      panel.hidden = false;
      chip.setAttribute('aria-expanded', 'true');
      chip.classList.add('ring-2', 'ring-primary', 'ring-offset-1');
      if (chip.textContent && chip.textContent.charAt(0) === '\\u25BE') {
        chip.textContent = '\\u25B4' + chip.textContent.slice(1);
      }
    }
  });
});

// Auto-open error panel if present (server-rendered data attribute)
var errorPanel = document.querySelector('[data-error-panel]');
if (errorPanel) {
  errorPanel.hidden = false;
  var chipId = errorPanel.getAttribute('data-error-panel');
  var chip = document.querySelector('[aria-controls="' + chipId + '"]');
  if (chip) {
    chip.setAttribute('aria-expanded', 'true');
    chip.classList.add('ring-2', 'ring-primary', 'ring-offset-1');
    if (chip.textContent && chip.textContent.charAt(0) === '\\u25BE') {
      chip.textContent = '\\u25B4' + chip.textContent.slice(1);
    }
  }
}

// Auto-open panel from query parameter (D-02: keep panel open after assign)
var openParam = new URLSearchParams(window.location.search).get('open');
if (openParam) {
  var panel = document.getElementById('panel-' + openParam);
  if (panel) {
    panel.hidden = false;
    var chip = document.querySelector('[aria-controls="panel-' + openParam + '"]');
    if (chip) {
      chip.setAttribute('aria-expanded', 'true');
      chip.classList.add('ring-2', 'ring-primary', 'ring-offset-1');
      if (chip.textContent && chip.textContent.charAt(0) === '\\u25BE') {
        chip.textContent = '\\u25B4' + chip.textContent.slice(1);
      }
    }
  }
  // ?open= erzwang Karten-Ansicht (viewScript) — Hash erhalten, nur ?open= entfernen
  history.replaceState(null, '', '/admin/shifts#view=karten');
}
`

  // Auswahl-Druck-Script (#397 Phase 3, Teil B) — Select-all + Live-Zähler für die Listen-Ansicht.
  const selectionScript = `
    var selectAll = document.getElementById('select-all-shifts');
    var countEl = document.getElementById('selection-count');
    var printBtn = document.getElementById('print-selection-btn');
    function shiftCheckboxes() {
      return Array.prototype.slice.call(document.querySelectorAll('.shift-select'));
    }
    function updateSelectionCount() {
      var checked = shiftCheckboxes().filter(function(cb) { return cb.checked; });
      if (countEl) countEl.textContent = checked.length;
      // Druck-Button erst aktivieren, wenn mindestens eine Schicht ausgewählt ist
      // (leerer POST würde sonst nur eine 400-Fehlerseite liefern).
      if (printBtn) printBtn.disabled = checked.length === 0;
    }
    if (selectAll) {
      selectAll.addEventListener('change', function() {
        shiftCheckboxes().forEach(function(cb) {
          // nur sichtbare Zeilen (Filter) umschalten
          if (cb.closest('tr') && !cb.closest('tr').hidden) cb.checked = selectAll.checked;
        });
        updateSelectionCount();
      });
    }
    shiftCheckboxes().forEach(function(cb) {
      cb.addEventListener('change', updateSelectionCount);
    });
    updateSelectionCount();
  `

  // Filter/search script (Ticket #397) — shift_id-basiertes Sichtbarkeitsmodell.
  // Match-Logik weiter aus den Karten-data-*; Ergebnis als Set sichtbarer shift_ids,
  // das ALLE [data-shift-id]-Elemente in allen Ansichten konsistent ein-/ausblenden.
  const filterScript = `
    var totalShifts = ${totalShifts};
    function filterShifts() {
      var searchVal = document.getElementById('filter-search').value.toLowerCase().trim();
      var dateVal = document.getElementById('filter-date').value;
      var typeVal = document.getElementById('filter-type').value;
      var positionVal = document.getElementById('filter-position').value;
      var fillVal = document.getElementById('filter-fill').value;
      var crewVal = document.getElementById('filter-crew').value.toLowerCase().trim();

      // Karten sind alleinige Quelle der 6 Filterdimensionen -> sichtbare shift_ids berechnen
      var visibleIds = {};
      var visible = 0;
      document.querySelectorAll('#shift-cards > div[data-shift-id]').forEach(function(card) {
        var searchMatch = !searchVal || (card.dataset.search || '').includes(searchVal);
        var dateMatch = !dateVal || card.dataset.date === dateVal;
        var typeMatch = !typeVal || card.dataset.type === typeVal;
        var positionMatch = !positionVal ||
          (card.dataset.positions || '').split('|').indexOf(positionVal) !== -1;
        var fill = card.dataset.fillState;
        var fillMatch = !fillVal ||
          (fillVal === 'offen' && fill !== 'full') ||
          (fillVal === 'voll' && fill === 'full');
        var crewMatch = !crewVal || (card.dataset.crewNames || '').includes(crewVal);

        var show = searchMatch && dateMatch && typeMatch && positionMatch && fillMatch && crewMatch;
        if (show) { visibleIds[card.dataset.shiftId] = true; visible++; }
      });

      // Schicht-Elemente über alle Ansichten gleich ein-/ausblenden.
      // Selektor eng gefasst: Karten-Wrapper, Listen-Zeilen und die read-only Block-Links
      // — NICHT die .slot-chip-Buttons in den Karten, die ebenfalls data-shift-id tragen.
      document.querySelectorAll('#shift-cards > div[data-shift-id], #view-liste tr[data-shift-id], .open-card-link[data-shift-id]').forEach(function(el) {
        var hide = !visibleIds[el.dataset.shiftId];
        el.hidden = hide;
        // Ausgeblendete Listen-Zeilen abwählen, damit der Auswahl-Druck nur sichtbare
        // Schichten enthält. change-Event hält den Auswahl-Zähler synchron.
        if (hide) {
          var cb = el.querySelector ? el.querySelector('.shift-select') : null;
          if (cb && cb.checked) {
            cb.checked = false;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });

      // Geister-Tagescontainer vermeiden: Kalender-Spalte/Zeitstrahl-Zeile nur zeigen,
      // wenn sie noch mindestens einen nicht-versteckten Schicht-Block enthält.
      document.querySelectorAll('[data-day]').forEach(function(day) {
        var hasVisible = day.querySelector('.open-card-link[data-shift-id]:not([hidden])');
        day.hidden = !hasVisible;
      });

      document.getElementById('filter-count-display').textContent = window.I18N.filterCountTemplate.replace('{visible}', visible).replace('{total}', totalShifts);

      // Empty-State pro Ansicht (nur die sichtbare zeigt ihn überhaupt an)
      ['shifts-empty-state','kalender-empty-state','liste-empty-state','zeitstrahl-empty-state'].forEach(function(id) {
        var es = document.getElementById(id);
        if (es) es.hidden = visible > 0;
      });
    }

    document.getElementById('filter-search').addEventListener('input', filterShifts);
    document.getElementById('filter-date').addEventListener('change', filterShifts);
    document.getElementById('filter-type').addEventListener('change', filterShifts);
    document.getElementById('filter-position').addEventListener('change', filterShifts);
    document.getElementById('filter-fill').addEventListener('change', filterShifts);
    document.getElementById('filter-crew').addEventListener('input', filterShifts);

    // Listen-Sortierung (Header-Klick nach Datum/Zeit), togglet auf-/absteigend
    (function() {
      var listBody = document.getElementById('shift-list-body');
      if (!listBody) return;
      var sortDir = {};
      document.querySelectorAll('#shift-list-table .sort-header').forEach(function(th) {
        th.addEventListener('click', function() {
          var key = th.dataset.sort; // 'date' | 'time'
          var dir = sortDir[key] === 'asc' ? 'desc' : 'asc';
          sortDir = {}; sortDir[key] = dir;
          var rows = Array.prototype.slice.call(listBody.querySelectorAll('tr[data-shift-id]'));
          rows.sort(function(a, b) {
            var av, bv;
            if (key === 'time') { av = a.dataset.time; bv = b.dataset.time; }
            else { av = a.dataset.date; bv = b.dataset.date; }
            // Bei Gleichstand stabil über sort-order
            var cmp = av < bv ? -1 : av > bv ? 1 : (Number(a.dataset.sortOrder) - Number(b.dataset.sortOrder));
            return dir === 'asc' ? cmp : -cmp;
          });
          rows.forEach(function(r) { listBody.appendChild(r); });
        });
      });
    })();
  `

  // Kompakter Summary-Strip (#397 Phase 2): EIN Gesamtblock + umbrechende Chips.
  // flex-wrap statt overflow-x — nichts läuft mehr horizontal über den Viewport.
  const grandFilled = shiftSummaries.reduce((sum, s) => sum + s.totalFilled, 0)
  const grandCapacity = shiftSummaries.reduce((sum, s) => sum + s.totalCapacity, 0)
  const grandPct = grandCapacity > 0 ? Math.round((grandFilled / grandCapacity) * 100) : 0

  const summaryTotalCell = html`<div class="bg-surface-container rounded-xl px-4 py-2.5 flex items-center gap-3 border-l-4 border-primary">
    <span class="font-label text-xs text-on-surface-variant font-semibold uppercase tracking-wide">${t(lang, 'shifts.total')}</span>
    <span class="font-headline font-extrabold text-lg text-primary-container">${grandPct}%</span>
    <span class="text-xs text-on-surface-variant">${grandFilled}/${grandCapacity}</span>
  </div>` as HtmlEscapedString

  const summaryCells = shiftSummaries.map(s => {
    const pct = s.totalCapacity > 0 ? Math.round((s.totalFilled / s.totalCapacity) * 100) : 0
    const abbr = s.day_name.slice(0, 2)
    return html`<div class="bg-surface-container-low rounded-full px-3 py-1.5 flex items-center gap-2 border-l-4" style="border-left-color: ${s.color}">
      <span class="font-label text-xs text-on-surface-variant font-semibold flex items-center gap-1.5">
        <span class="inline-block w-2 h-2 rounded-full flex-shrink-0" style="background-color: ${s.color}"></span>
        ${abbr} ${s.typeLabel}
      </span>
      <span class="font-headline font-bold text-sm ${fillTextClass(s.fillState)}">${pct}%</span>
      <span class="text-xs text-on-surface-variant">${s.totalFilled}/${s.totalCapacity}</span>
    </div>` as HtmlEscapedString
  })

  const content = html`
<div class="sticky top-0 bg-surface-container-low/85 backdrop-blur-xl px-0 py-6 flex justify-between items-center mb-6 z-10">
  <h2 class="font-headline font-extrabold text-2xl text-primary-container tracking-tight">${t(lang, 'shifts.pageHeading', { event: branding.event_name })}</h2>
  <div class="flex items-center gap-3">
    <a href="/admin/shifts/settings" aria-label="${t(lang, 'settings.pageTitle')}" class="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-full transition-colors"><span class="material-symbols-outlined">settings</span></a>
    <a href="/admin/export/pdf-shifts" class="bg-gradient-to-r from-primary to-primary-container text-on-primary px-4 py-2 rounded-xl font-label text-sm font-semibold hover:opacity-90 transition-opacity">${t(lang, 'shifts.pdfShiftPlan')}</a>
    <a href="/admin/export/pdf-checklist" class="bg-gradient-to-r from-primary to-primary-container text-on-primary px-4 py-2 rounded-xl font-label text-sm font-semibold hover:opacity-90 transition-opacity">${t(lang, 'shifts.pdfChecklist')}</a>
  </div>
</div>

<div class="flex flex-wrap gap-2 mb-8 items-center">
  ${summaryTotalCell}
  ${summaryCells}
</div>

<div class="flex flex-wrap gap-2 mb-6" id="view-switcher" role="group" aria-label="${t(lang, 'publicSchedule.viewSwitcherLabel')}">
  <button type="button" data-view="karten" aria-pressed="false"
    class="view-btn flex items-center gap-1.5 px-4 py-2 rounded-xl font-label text-sm font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors">
    <span class="material-symbols-outlined text-[18px]">grid_view</span>${t(lang, 'shifts.view.cards')}
  </button>
  <button type="button" data-view="kalender" aria-pressed="false"
    class="view-btn flex items-center gap-1.5 px-4 py-2 rounded-xl font-label text-sm font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors">
    <span class="material-symbols-outlined text-[18px]">calendar_month</span>${t(lang, 'publicSchedule.view.calendar')}
  </button>
  <button type="button" data-view="liste" aria-pressed="false"
    class="view-btn flex items-center gap-1.5 px-4 py-2 rounded-xl font-label text-sm font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors">
    <span class="material-symbols-outlined text-[18px]">view_list</span>${t(lang, 'publicSchedule.view.list')}
  </button>
  <button type="button" data-view="zeitstrahl" aria-pressed="false"
    class="view-btn flex items-center gap-1.5 px-4 py-2 rounded-xl font-label text-sm font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors">
    <span class="material-symbols-outlined text-[18px]">timeline</span>${t(lang, 'publicSchedule.view.timeline')}
  </button>
</div>

<div class="flex gap-3 items-center bg-surface-container-low p-3 rounded-xl mb-6 flex-wrap">
  <div class="relative flex-1 min-w-[180px]">
    <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
    <input type="search" id="filter-search" placeholder="${t(lang, 'shifts.searchPlaceholder')}" aria-label="${t(lang, 'shifts.searchAriaLabel')}"
      class="w-full bg-surface-variant border-none rounded-lg py-2.5 pl-10 pr-4 text-sm font-body text-on-surface focus:ring-0 transition-colors placeholder:text-on-surface-variant">
  </div>
  <div class="relative">
    <select id="filter-date" aria-label="${t(lang, 'shifts.dateFilterAriaLabel')}"
      class="appearance-none bg-surface-variant border-none rounded-lg py-2.5 pl-4 pr-10 text-sm font-body text-on-surface focus:ring-0 transition-colors cursor-pointer">
      <option value="">${t(lang, 'shifts.dateFilterAll')}</option>
      ${dateOptions}
    </select>
    <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">expand_more</span>
  </div>
  <div class="relative">
    <select id="filter-type" aria-label="${t(lang, 'shifts.typeFilterAriaLabel')}"
      class="appearance-none bg-surface-variant border-none rounded-lg py-2.5 pl-4 pr-10 text-sm font-body text-on-surface focus:ring-0 transition-colors cursor-pointer">
      <option value="">${t(lang, 'shifts.typeFilterAll')}</option>
      <option value="day">${shiftTypeLabel(lang, 'day')}</option>
      <option value="night">${shiftTypeLabel(lang, 'night')}</option>
    </select>
    <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">expand_more</span>
  </div>
  <div class="relative">
    <select id="filter-position" aria-label="${t(lang, 'shifts.positionFilterAriaLabel')}"
      class="appearance-none bg-surface-variant border-none rounded-lg py-2.5 pl-4 pr-10 text-sm font-body text-on-surface focus:ring-0 transition-colors cursor-pointer">
      <option value="">${t(lang, 'shifts.positionFilterAll')}</option>
      ${positionOptions}
    </select>
    <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">expand_more</span>
  </div>
  <div class="relative">
    <select id="filter-fill" aria-label="${t(lang, 'shifts.fillFilterAriaLabel')}"
      class="appearance-none bg-surface-variant border-none rounded-lg py-2.5 pl-4 pr-10 text-sm font-body text-on-surface focus:ring-0 transition-colors cursor-pointer">
      <option value="">${t(lang, 'shifts.fillFilterAll')}</option>
      <option value="offen">${t(lang, 'shifts.fillOpen')}</option>
      <option value="voll">${t(lang, 'shifts.fillFull')}</option>
    </select>
    <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">expand_more</span>
  </div>
  <div class="relative min-w-[160px]">
    <input type="search" id="filter-crew" placeholder="${t(lang, 'shifts.crewFilterPlaceholder')}" aria-label="${t(lang, 'shifts.crewFilterAriaLabel')}"
      class="w-full bg-surface-variant border-none rounded-lg py-2.5 px-4 text-sm font-body text-on-surface focus:ring-0 transition-colors placeholder:text-on-surface-variant">
  </div>
</div>

<p id="filter-count-display" class="text-sm text-on-surface-variant mb-4">${t(lang, 'shifts.filterCountTemplate', { visible: totalShifts, total: totalShifts })}</p>

<!-- Karten-Ansicht (mit Zuweisungs-Flow) -->
<div id="view-karten" hidden>
  <div class="flex flex-col gap-6" id="shift-cards">
    ${shiftCards}
  </div>
  <div id="shifts-empty-state" hidden class="py-8 text-center text-on-surface-variant text-sm">${t(lang, 'shifts.emptyState')}</div>
</div>

<!-- Kalender-Ansicht (read-only) -->
<div id="view-kalender" hidden>
  <div class="flex flex-wrap gap-4 items-start">
    ${calendarColumns}
  </div>
  <div id="kalender-empty-state" hidden class="py-8 text-center text-on-surface-variant text-sm">${t(lang, 'shifts.emptyState')}</div>
</div>

<!-- Listen-Ansicht (read-only, sortierbar) + Auswahl-Druck (#397 Phase 3, Teil B) -->
<div id="view-liste" hidden>
  <form method="POST" action="/admin/export/pdf-selection">
    <div class="sticky top-[88px] z-[5] flex items-center justify-between gap-3 bg-surface-container-low/90 backdrop-blur-xl px-3 py-2 rounded-xl mb-3">
      <span class="text-xs text-on-surface-variant"><span id="selection-count">0</span> ${t(lang, 'shifts.selectedSuffix')}</span>
      <button type="submit" id="print-selection-btn" disabled
        class="bg-gradient-to-r from-primary to-primary-container text-on-primary px-4 py-2 rounded-xl font-label text-sm font-semibold hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none">
        <span class="material-symbols-outlined text-[18px]">print</span>${t(lang, 'shifts.printSelected')}
      </button>
    </div>
    <div class="overflow-x-auto bg-surface-container-low rounded-xl">
      <table class="w-full text-sm" id="shift-list-table">
        <thead>
          <tr class="border-b border-outline">
            <th class="text-left font-semibold text-on-surface-variant py-2.5 px-3 w-10">
              <input type="checkbox" id="select-all-shifts" aria-label="${t(lang, 'shifts.selectAllAriaLabel')}"
                class="rounded border-outline-variant text-primary focus:ring-primary cursor-pointer">
            </th>
            <th data-sort="date" class="sort-header text-left font-semibold text-on-surface-variant py-2.5 px-3 cursor-pointer select-none hover:text-on-surface">${t(lang, 'publicSchedule.col.date')} <span class="material-symbols-outlined text-[14px] align-middle">unfold_more</span></th>
            <th class="text-left font-semibold text-on-surface-variant py-2.5 px-3">${t(lang, 'publicSchedule.col.weekday')}</th>
            <th data-sort="time" class="sort-header text-left font-semibold text-on-surface-variant py-2.5 px-3 cursor-pointer select-none hover:text-on-surface">${t(lang, 'publicSchedule.col.time')} <span class="material-symbols-outlined text-[14px] align-middle">unfold_more</span></th>
            <th class="text-left font-semibold text-on-surface-variant py-2.5 px-3">${t(lang, 'publicSchedule.col.type')}</th>
            <th class="text-left font-semibold text-on-surface-variant py-2.5 px-3">${t(lang, 'publicSchedule.col.positions')}</th>
            <th class="text-left font-semibold text-on-surface-variant py-2.5 px-3">${t(lang, 'publicSchedule.col.fill')}</th>
            <th class="text-left font-semibold text-on-surface-variant py-2.5 px-3"></th>
          </tr>
        </thead>
        <tbody id="shift-list-body">
          ${listRows}
        </tbody>
      </table>
    </div>
  </form>
  <div id="liste-empty-state" hidden class="py-8 text-center text-on-surface-variant text-sm">${t(lang, 'shifts.emptyState')}</div>
</div>

<!-- Zeitstrahl-Ansicht (read-only) -->
<div id="view-zeitstrahl" hidden>
  <div class="flex flex-col gap-2 bg-surface-container-low rounded-xl p-4 divide-y divide-outline-variant">
    ${timelineRows}
  </div>
  <div id="zeitstrahl-empty-state" hidden class="py-8 text-center text-on-surface-variant text-sm">${t(lang, 'shifts.emptyState')}</div>
</div>

<script>${raw(i18nScript)}</script>
<script>${raw(viewScript)}</script>
<script>${raw(filterScript)}</script>
<script>${raw(toggleScript)}</script>
<script>${raw(selectionScript)}</script>
` as HtmlEscapedString

  return layout(t(lang, 'nav.shifts'), content, { nav: true, lang, activePage: 'shifts' })
}
