import { html, raw } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { layout } from './layout.js'
import { getBranding } from '../domain/branding.js'
import type { CrewRow } from '../services/crew.js'
import { effectiveLevel } from '../services/shifts.js'
import { statusLabel, shiftTypeLabel, CREW_STATUSES } from '../domain/labels.js'
import { t, jsonScriptEscape, type Lang } from '../i18n.js'
import { weekdayName } from '../domain/dates.js'

export interface ShiftRow {
  id: number
  date: string
  type: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function renderStars(level: number): string {
  const n = Math.max(0, Math.min(5, Math.round(level)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

// Status colour mapping
function statusPillClasses(status: string): string {
  const map: Record<string, string> = {
    applied: 'bg-primary-fixed text-on-primary-fixed',
    shortlisted: 'bg-tertiary-fixed text-on-tertiary-fixed',
    shift_selection: 'bg-secondary-container text-on-secondary-container',
    confirmed: 'bg-secondary-container text-on-secondary-container',
    declined: 'bg-error-container text-on-error-container',
  }
  return map[status] ?? 'bg-surface-variant text-on-surface-variant'
}

function statusPillarClass(status: string): string {
  const map: Record<string, string> = {
    applied: 'bg-primary-fixed',
    shortlisted: 'bg-tertiary-fixed-dim',
    shift_selection: 'bg-secondary',
    confirmed: 'bg-secondary',
    declined: 'bg-error',
  }
  return map[status] ?? 'bg-surface-variant'
}

// ─── crewTablePage ────────────────────────────────────────────────────────────

export function crewTablePage(crew: CrewRow[], shifts: ShiftRow[], groups: string[], lang: Lang = 'de'): HtmlEscapedString {
  const branding = getBranding()
  const total = crew.length

  const rows = crew.map((row) => {
    const level = effectiveLevel(row)
    const assignCountBold = row.assignment_count >= 3
    const availableShiftIds = row.available_shift_ids ?? ''
    const pillarClass = statusPillarClass(row.status)
    const pillClasses = statusPillClasses(row.status)

    return html`<div
      class="grid grid-cols-12 gap-4 px-6 py-4 bg-surface-container-lowest rounded-xl items-center relative overflow-hidden group hover:bg-surface-bright transition-colors"
      data-name="${row.first_name.toLowerCase()} ${row.last_name.toLowerCase()}"
      data-status="${row.status}"
      data-available-shifts="${availableShiftIds}"
      data-assignment-count="${row.assignment_count}"
      data-group="${row.group_name ?? ''}">
      <div class="absolute left-0 top-0 bottom-0 w-1 ${pillarClass} rounded-r-full"></div>
      <div class="col-span-4">
        <a href="/admin/crew/${row.id}" class="font-body text-sm font-medium text-on-surface hover:text-primary transition-colors truncate block">${row.first_name} ${row.last_name}</a>
      </div>
      <div class="col-span-2">
        <span class="inline-flex items-center justify-center w-7 h-7 rounded bg-surface-variant text-on-surface-variant text-xs font-bold" title="${renderStars(level)}">${level}</span>
      </div>
      <div class="col-span-3">
        <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${pillClasses}">${statusLabel(lang, row.status)}</span>
      </div>
      <div class="col-span-2 text-right font-body text-sm text-on-surface-variant">
        ${assignCountBold ? html`<strong class="text-on-surface">${row.assignment_count}</strong>` : html`${row.assignment_count}`}
      </div>
      <div class="col-span-1 text-right flex justify-end">
        <a href="/admin/crew/${row.id}" class="text-on-surface-variant hover:text-primary p-2 rounded-full hover:bg-surface-variant transition-colors inline-flex"><span class="material-symbols-outlined text-[20px]">edit</span></a>
      </div>
    </div>`
  })

  const shiftOptions = shifts.map(
    (s) => html`<option value="${s.id}">${weekdayName(s.date, lang)} ${shiftTypeLabel(lang, s.type)}</option>`
  )

  // Kleines injiziertes I18N-Objekt für den Live-Filter-Zähler im Client-Script
  // (dasselbe Muster wie views/shifts.ts) — t() bleibt serverseitig, das Script
  // interpoliert nur noch die Zahlen in den vorübersetzten Template-String.
  const i18nScript = `window.I18N = ${jsonScriptEscape({ filterCountTemplate: t(lang, 'dashboard.filterCountTemplate') })};`

  const filterScript = `
    var total = ${total};
    function filterTable() {
      var nameVal = document.getElementById('filter-name').value.toLowerCase();
      var statusVal = document.getElementById('filter-status').value;
      var shiftVal = document.getElementById('filter-shift').value;
      var countVal = document.getElementById('filter-count').value;
      var groupVal = document.getElementById('filter-group').value;

      var visible = 0;
      document.querySelectorAll('#crew-tbody > div').forEach(function(row) {
        var nameMatch = !nameVal || row.dataset.name.includes(nameVal);
        var statusMatch = !statusVal || row.dataset.status === statusVal;
        var shiftMatch = !shiftVal || (row.dataset.availableShifts || '').split(',').includes(shiftVal);
        var count = parseInt(row.dataset.assignmentCount, 10);
        var countMatch = !countVal ||
          (countVal === '0' && count === 0) ||
          (countVal === '1-2' && count >= 1 && count <= 2) ||
          (countVal === '3' && count >= 3);
        var groupMatch = !groupVal || row.dataset.group === groupVal;

        var show = nameMatch && statusMatch && shiftMatch && countMatch && groupMatch;
        row.hidden = !show;
        if (show) visible++;
      });

      document.getElementById('filter-count-display').textContent = window.I18N.filterCountTemplate.replace('{visible}', visible).replace('{total}', total);
      var emptyState = document.getElementById('empty-state');
      if (emptyState) emptyState.hidden = visible > 0;

      // Show/hide group assign link
      var groupAssignLink = document.getElementById('group-assign-link');
      var groupAssignBtn = document.getElementById('group-assign-btn');
      var activeGroup = document.getElementById('filter-group').value;
      if (activeGroup) {
        groupAssignBtn.href = '/admin/groups/' + encodeURIComponent(activeGroup) + '/assign';
        groupAssignLink.hidden = false;
      } else {
        groupAssignLink.hidden = true;
      }
    }

    document.getElementById('filter-name').addEventListener('input', filterTable);
    document.getElementById('filter-status').addEventListener('change', filterTable);
    document.getElementById('filter-shift').addEventListener('change', filterTable);
    document.getElementById('filter-count').addEventListener('change', filterTable);
    document.getElementById('filter-group').addEventListener('change', filterTable);
  `

  const content = html`
    <div class="mb-8 flex justify-between items-end">
      <h2 class="font-headline text-3xl font-extrabold text-on-background tracking-tight">${t(lang, 'nav.crew')} — ${branding.event_name} <span class="text-on-surface-variant font-body text-xl font-normal">(${total})</span></h2>
      <a href="/admin/export/csv" class="bg-gradient-to-r from-primary to-primary-container text-on-primary px-5 py-2.5 rounded-full font-label text-sm font-semibold hover:opacity-90 transition-opacity">${t(lang, 'dashboard.exportCsv')}</a>
    </div>

    <div class="flex gap-3 items-center bg-surface-container-low p-3 rounded-xl mb-6 flex-wrap">
      <div class="relative flex-1 min-w-[180px]">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
        <input type="search" id="filter-name" placeholder="${t(lang, 'dashboard.searchPlaceholder')}" aria-label="${t(lang, 'dashboard.searchAriaLabel')}"
          class="w-full bg-surface-variant border-none rounded-lg py-2.5 pl-10 pr-4 text-sm font-body text-on-surface focus:ring-0 transition-colors placeholder:text-on-surface-variant">
      </div>
      <div class="relative">
        <select id="filter-status" aria-label="${t(lang, 'dashboard.statusAriaLabel')}"
          class="appearance-none bg-surface-variant border-none rounded-lg py-2.5 pl-4 pr-10 text-sm font-body text-on-surface focus:ring-0 transition-colors cursor-pointer">
          <option value="">${t(lang, 'dashboard.statusAll')}</option>
          ${CREW_STATUSES.map(s => html`<option value="${s}">${statusLabel(lang, s)}</option>`)}
        </select>
        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">expand_more</span>
      </div>
      <div class="relative">
        <select id="filter-shift" aria-label="${t(lang, 'dashboard.shiftAvailAriaLabel')}"
          class="appearance-none bg-surface-variant border-none rounded-lg py-2.5 pl-4 pr-10 text-sm font-body text-on-surface focus:ring-0 transition-colors cursor-pointer">
          <option value="">${t(lang, 'dashboard.shiftAvailPlaceholder')}</option>
          ${shiftOptions}
        </select>
        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">expand_more</span>
      </div>
      <div class="relative">
        <select id="filter-count" aria-label="${t(lang, 'dashboard.countAriaLabel')}"
          class="appearance-none bg-surface-variant border-none rounded-lg py-2.5 pl-4 pr-10 text-sm font-body text-on-surface focus:ring-0 transition-colors cursor-pointer">
          <option value="">${t(lang, 'dashboard.countAll')}</option>
          <option value="0">${t(lang, 'dashboard.count0')}</option>
          <option value="1-2">${t(lang, 'dashboard.count12')}</option>
          <option value="3">${t(lang, 'dashboard.count3')}</option>
        </select>
        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">expand_more</span>
      </div>
      <div class="relative">
        <select id="filter-group" aria-label="${t(lang, 'dashboard.groupAriaLabel')}"
          class="appearance-none bg-surface-variant border-none rounded-lg py-2.5 pl-4 pr-10 text-sm font-body text-on-surface focus:ring-0 transition-colors cursor-pointer">
          <option value="">${t(lang, 'dashboard.allGroups')}</option>
          ${groups.map(g => html`<option value="${g}">${g}</option>`)}
        </select>
        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-on-surface-variant text-[20px]">expand_more</span>
      </div>
      <div id="group-assign-link" hidden>
        <a id="group-assign-btn" href="#" class="bg-secondary-container text-on-secondary-container px-4 py-2 rounded-full text-sm font-semibold hover:opacity-80 transition-opacity">${t(lang, 'dashboard.groupAssign')}</a>
      </div>
    </div>

    <p id="filter-count-display" class="text-sm text-on-surface-variant mb-4">${t(lang, 'dashboard.filterCountTemplate', { visible: total, total })}</p>

    <div class="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-label font-semibold tracking-wider text-on-surface-variant uppercase bg-surface-container-low rounded-t-xl mb-2">
      <div class="col-span-4">${t(lang, 'common.name')}</div>
      <div class="col-span-2">${t(lang, 'common.level')}</div>
      <div class="col-span-3">${t(lang, 'common.status')}</div>
      <div class="col-span-2 text-right">${t(lang, 'dashboard.colShifts')}</div>
      <div class="col-span-1 text-right">${t(lang, 'common.actions')}</div>
    </div>

    <div id="crew-tbody" class="flex flex-col gap-2">
      ${rows}
      <div id="empty-state" hidden class="py-8 text-center text-on-surface-variant text-sm">${t(lang, 'dashboard.emptyState')}</div>
    </div>

    <script>${raw(i18nScript)}</script>
    <script>${raw(filterScript)}</script>
  ` as HtmlEscapedString

  return layout(t(lang, 'nav.crew'), content, { nav: true, lang, activePage: 'crew' })
}
