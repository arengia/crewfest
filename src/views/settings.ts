import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { layout } from './layout.js'
import type { ShiftWithPositions, PositionRow } from '../services/settings.js'
import type { BrandingSettings } from '../domain/branding.js'
import { shiftTypeLabel } from '../domain/labels.js'
import { t, type Lang } from '../i18n.js'
import { weekdayName } from '../domain/dates.js'

export function settingsPage(
  shifts: ShiftWithPositions[],
  positions: PositionRow[],
  branding: BrandingSettings,
  lang: Lang = 'de'
): HtmlEscapedString {
  const shiftRows = shifts.map(s => {
    const typeLabel = shiftTypeLabel(lang, s.type)
    const caps = s.position_capacities.map(pc => `${pc.position_label}: ${pc.capacity}`).join(', ')
    return html`<tr>
      <td class="px-3 py-2 border-b border-outline-variant">${weekdayName(s.date, lang)} (${s.date})</td>
      <td class="px-3 py-2 border-b border-outline-variant">${typeLabel}</td>
      <td class="px-3 py-2 border-b border-outline-variant">${s.start_time}–${s.end_time}</td>
      <td class="px-3 py-2 border-b border-outline-variant"><small>${caps || '—'}</small></td>
      <td class="px-3 py-2 border-b border-outline-variant">
        <div class="flex flex-wrap gap-2">
          <a href="/admin/shifts/settings/${s.id}/edit" class="px-3 py-1.5 rounded-full border border-outline text-on-surface hover:bg-surface-container text-sm">${t(lang, 'common.edit')}</a>
          <form method="POST" action="/admin/shifts/settings/${s.id}/duplicate" style="display:inline">
            <button type="submit" class="px-3 py-1 rounded-full border border-outline text-on-surface hover:bg-surface-container text-sm">${t(lang, 'common.duplicate')}</button>
          </form>
          <a href="/admin/shifts/settings/${s.id}/delete" class="px-3 py-1.5 rounded-full border border-error/40 text-error hover:bg-error/10 text-sm">${t(lang, 'common.delete')}</a>
        </div>
      </td>
    </tr>`
  })

  const positionRows = positions.map(p => html`<tr>
    <td class="px-3 py-2 border-b border-outline-variant">${p.label}</td>
    <td class="px-3 py-2 border-b border-outline-variant">${p.name}</td>
    <td class="px-3 py-2 border-b border-outline-variant">${p.min_level}★</td>
    <td class="px-3 py-2 border-b border-outline-variant">${p.default_capacity}</td>
    <td class="px-3 py-2 border-b border-outline-variant">
      <div class="flex flex-wrap gap-2">
        <a href="/admin/shifts/settings/positions/${p.id}/edit" class="px-3 py-1.5 rounded-full border border-outline text-on-surface hover:bg-surface-container text-sm">${t(lang, 'common.edit')}</a>
        <a href="/admin/shifts/settings/positions/${p.id}/delete" class="px-3 py-1.5 rounded-full border border-error/40 text-error hover:bg-error/10 text-sm">${t(lang, 'common.delete')}</a>
      </div>
    </td>
  </tr>`)

  const content = html`
    <a href="/admin/shifts" class="text-on-surface-variant hover:text-on-surface text-sm inline-flex items-center gap-1 mb-4">&larr; ${t(lang, 'settings.backToShifts')}</a>
    <h2 class="font-headline text-2xl font-bold mb-6">${t(lang, 'settings.pageTitle')}</h2>

    <section class="bg-surface-container-lowest rounded-xl p-6 mb-6">
      <h3 class="font-headline text-lg font-bold mb-4">${t(lang, 'settings.branding.title')}</h3>
      <form method="POST" action="/admin/shifts/settings/branding">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <label class="block">
            <span class="block text-sm font-medium text-on-surface-variant mb-1">${t(lang, 'settings.branding.eventName')}</span>
            <input type="text" name="event_name" value="${branding.event_name}" required maxlength="80" class="block w-full border-b border-outline focus:border-primary outline-none py-2 bg-transparent">
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-on-surface-variant mb-1">${t(lang, 'settings.branding.orgName')} <small class="text-on-surface-variant">${t(lang, 'common.optional')}</small></span>
            <input type="text" name="org_name" value="${branding.org_name ?? ''}" maxlength="80" class="block w-full border-b border-outline focus:border-primary outline-none py-2 bg-transparent">
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-on-surface-variant mb-1">${t(lang, 'settings.branding.contactEmail')} <small class="text-on-surface-variant">${t(lang, 'common.optional')}</small></span>
            <input type="email" name="contact_email" value="${branding.contact_email ?? ''}" maxlength="120" class="block w-full border-b border-outline focus:border-primary outline-none py-2 bg-transparent">
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-on-surface-variant mb-1">${t(lang, 'settings.branding.language')} <small class="text-on-surface-variant">${t(lang, 'settings.branding.languageHint')}</small></span>
            <select name="default_language" class="block w-full border-b border-outline focus:border-primary outline-none py-2 bg-transparent">
              <option value="de" ${branding.default_language === 'de' ? 'selected' : ''}>${t(lang, 'settings.branding.german')}</option>
              <option value="en" ${branding.default_language === 'en' ? 'selected' : ''}>${t(lang, 'settings.branding.english')}</option>
            </select>
          </label>
        </div>
        <p class="text-xs text-on-surface-variant mb-4">${t(lang, 'settings.branding.hint')}</p>
        <button type="submit" class="bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline px-6 py-2 rounded-full hover:opacity-90">${t(lang, 'common.save')}</button>
      </form>
    </section>

    <section class="bg-surface-container-lowest rounded-xl p-6 mb-6">
      <h3 class="font-headline text-lg font-bold mb-4">${t(lang, 'settings.shifts.title')}</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-surface-container text-left text-on-surface-variant">
              <th class="px-3 py-2 border-b border-outline-variant">${t(lang, 'settings.col.day')}</th>
              <th class="px-3 py-2 border-b border-outline-variant">${t(lang, 'publicSchedule.col.type')}</th>
              <th class="px-3 py-2 border-b border-outline-variant">${t(lang, 'settings.col.time')}</th>
              <th class="px-3 py-2 border-b border-outline-variant">${t(lang, 'settings.col.capacities')}</th>
              <th class="px-3 py-2 border-b border-outline-variant">${t(lang, 'common.actions')}</th>
            </tr>
          </thead>
          <tbody>${shiftRows}</tbody>
        </table>
      </div>
      <a href="/admin/shifts/settings/new" class="inline-block mt-4 bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline px-4 py-2 rounded-full hover:opacity-90">${t(lang, 'settings.newShift')}</a>
    </section>

    <section class="bg-surface-container-lowest rounded-xl p-6 mb-6">
      <h3 class="font-headline text-lg font-bold mb-4">${t(lang, 'settings.positions.title')}</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr class="bg-surface-container text-left text-on-surface-variant">
              <th class="px-3 py-2 border-b border-outline-variant">Label</th>
              <th class="px-3 py-2 border-b border-outline-variant">${t(lang, 'common.name')}</th>
              <th class="px-3 py-2 border-b border-outline-variant">${t(lang, 'settings.col.minLevel')}</th>
              <th class="px-3 py-2 border-b border-outline-variant">${t(lang, 'settings.col.defaultCapacity')}</th>
              <th class="px-3 py-2 border-b border-outline-variant">${t(lang, 'common.actions')}</th>
            </tr>
          </thead>
          <tbody>${positionRows}</tbody>
        </table>
      </div>
      <a href="/admin/shifts/settings/positions/new" class="inline-block mt-4 bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline px-4 py-2 rounded-full hover:opacity-90">${t(lang, 'settings.newPosition')}</a>
    </section>
  ` as HtmlEscapedString
  return layout(t(lang, 'settings.pageTitle'), content, { nav: true, lang, activePage: 'shifts' })
}

function shiftColors(lang: Lang): Array<{ label: string; value: string }> {
  return [
    { label: 'Indigo', value: '#6366f1' },
    { label: 'Rose', value: '#f43f5e' },
    { label: 'Orange', value: '#f97316' },
    { label: 'Amber', value: '#eab308' },
    { label: t(lang, 'settings.color.green'), value: '#22c55e' },
    { label: 'Teal', value: '#14b8a6' },
    { label: 'Sky', value: '#0ea5e9' },
    { label: t(lang, 'settings.color.purple'), value: '#a855f7' },
    { label: 'Pink', value: '#ec4899' },
  ]
}

export function shiftFormPage(
  positions: PositionRow[],
  shift?: ShiftWithPositions | null,
  error?: string,
  lang: Lang = 'de'
): HtmlEscapedString {
  const isEdit = !!shift
  const title = isEdit ? t(lang, 'settings.shiftForm.titleEdit') : t(lang, 'settings.shiftForm.titleNew')
  const action = isEdit ? `/admin/shifts/settings/${shift!.id}/edit` : '/admin/shifts/settings/new'
  const currentColor = shift?.color ?? '#6366f1'

  // Build capacity map for pre-filling
  const capMap = new Map<number, number>()
  if (shift) {
    for (const pc of shift.position_capacities) {
      capMap.set(pc.position_id, pc.capacity)
    }
  }

  const colorSwatches = shiftColors(lang).map(c => html`<label class="cursor-pointer">
      <input type="radio" name="color" value="${c.value}" ${currentColor === c.value ? 'checked' : ''} class="sr-only peer">
      <span class="block w-8 h-8 rounded-full ring-2 ring-transparent ring-offset-2 peer-checked:ring-primary transition-all" style="background-color: ${c.value};" title="${c.label}"></span>
    </label>`)

  const positionInputs = positions.map(p => {
    const cap = capMap.get(p.id) ?? p.default_capacity
    return html`<label class="block">
      <span class="block text-sm font-medium text-on-surface-variant mb-1">${p.label}</span>
      <input type="number" name="cap_${p.id}" value="${cap}" min="0" max="20" class="w-20 border-b border-outline focus:border-primary outline-none py-1 bg-transparent text-center">
    </label>`
  })

  const content = html`
    <a href="/admin/shifts/settings" class="text-on-surface-variant hover:text-on-surface text-sm inline-flex items-center gap-1 mb-4">&larr; ${t(lang, 'common.back')}</a>
    <h2 class="font-headline text-2xl font-bold mb-6">${title}</h2>
    ${error ? html`<p class="text-error text-sm mb-4">${error}</p>` : ''}
    <section class="bg-surface-container-lowest rounded-xl p-6 mb-6">
      <form method="POST" action="${action}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <label class="block">
            <span class="block text-sm font-medium text-on-surface-variant mb-1">${t(lang, 'settings.shiftForm.date')}</span>
            <input type="date" name="date" value="${shift?.date ?? ''}" required class="block w-full border-b border-outline focus:border-primary outline-none py-2 bg-transparent">
            <span class="block text-xs text-on-surface-variant mt-1">${t(lang, 'settings.shiftForm.dateHint')}</span>
          </label>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <label class="block">
            <span class="block text-sm font-medium text-on-surface-variant mb-1">${t(lang, 'publicSchedule.col.type')}</span>
            <select name="type" required class="block w-full border-b border-outline focus:border-primary outline-none py-2 bg-transparent">
              <option value="day" ${shift?.type === 'day' ? 'selected' : ''}>${shiftTypeLabel(lang, 'day')}</option>
              <option value="night" ${shift?.type === 'night' ? 'selected' : ''}>${shiftTypeLabel(lang, 'night')}</option>
            </select>
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-on-surface-variant mb-1">${t(lang, 'settings.shiftForm.startTime')}</span>
            <input type="time" name="start_time" value="${shift?.start_time ?? ''}" required class="block w-full border-b border-outline focus:border-primary outline-none py-2 bg-transparent">
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-on-surface-variant mb-1">${t(lang, 'settings.shiftForm.endTime')}</span>
            <input type="time" name="end_time" value="${shift?.end_time ?? ''}" required class="block w-full border-b border-outline focus:border-primary outline-none py-2 bg-transparent">
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-on-surface-variant mb-1">${t(lang, 'settings.shiftForm.sortOrder')}</span>
            <input type="number" name="sort_order" value="${shift?.sort_order ?? 0}" min="0" class="block w-full border-b border-outline focus:border-primary outline-none py-2 bg-transparent">
          </label>
        </div>
        <div class="mb-4">
          <span class="block text-sm font-medium text-on-surface-variant mb-2">${t(lang, 'settings.shiftForm.color')}</span>
          <div class="flex flex-wrap gap-3">${colorSwatches}</div>
        </div>
        <fieldset class="border border-outline-variant rounded-xl p-4 mb-4">
          <legend class="px-2 font-headline text-sm font-semibold">${t(lang, 'settings.shiftForm.capacitiesLegend')}</legend>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            ${positionInputs}
          </div>
        </fieldset>
        <button type="submit" class="bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline px-6 py-2 rounded-full hover:opacity-90">${isEdit ? t(lang, 'common.save') : t(lang, 'common.create')}</button>
      </form>
    </section>
  ` as HtmlEscapedString
  return layout(title, content, { nav: true, lang, activePage: 'shifts' })
}

export function shiftDeletePage(
  shift: ShiftWithPositions,
  warning: { assignmentCount: number; crewNames: string[] },
  lang: Lang = 'de'
): HtmlEscapedString {
  const typeLabel = shiftTypeLabel(lang, shift.type)
  const content = html`
    <a href="/admin/shifts/settings" class="text-on-surface-variant hover:text-on-surface text-sm inline-flex items-center gap-1 mb-4">&larr; ${t(lang, 'common.back')}</a>
    <h2 class="font-headline text-2xl font-bold mb-6">${t(lang, 'settings.shiftDelete.title')}</h2>
    <section class="bg-surface-container-lowest rounded-xl p-6 mb-6">
      <h3 class="font-headline text-lg font-bold text-error mb-3">${t(lang, 'common.warning')}</h3>
      <p class="mb-2">${t(lang, 'settings.shiftDelete.shiftLabel')} <strong>${weekdayName(shift.date, lang)} ${typeLabel} (${shift.date})</strong></p>
      ${warning.assignmentCount > 0
        ? html`<p class="text-error mb-2">${t(lang, 'settings.shiftDelete.hasAssignments', { count: warning.assignmentCount })}</p>
          <ul class="list-disc pl-6 mb-3 text-sm">${warning.crewNames.map(n => html`<li>${n}</li>`)}</ul>
          <p class="mb-3">${t(lang, 'settings.shiftDelete.willBeDeleted')}</p>`
        : html`<p class="mb-3">${t(lang, 'settings.shiftDelete.noAssignments')}</p>`}
      <form method="POST" action="/admin/shifts/settings/${shift.id}/delete" class="flex flex-wrap gap-2 items-center">
        <button type="submit" class="bg-error text-on-error font-headline px-4 py-2 rounded-full hover:opacity-90">${t(lang, 'settings.deletePermanently')}</button>
        <a href="/admin/shifts/settings" class="inline-block px-3 py-1.5 rounded-full border border-outline text-on-surface hover:bg-surface-container text-sm">${t(lang, 'common.cancel')}</a>
      </form>
    </section>
  ` as HtmlEscapedString
  return layout(t(lang, 'settings.shiftDelete.title'), content, { nav: true, lang, activePage: 'shifts' })
}

export function positionFormPage(
  position?: PositionRow | null,
  error?: string,
  lang: Lang = 'de'
): HtmlEscapedString {
  const isEdit = !!position
  const title = isEdit ? t(lang, 'settings.positionForm.titleEdit') : t(lang, 'settings.positionForm.titleNew')
  const action = isEdit ? `/admin/shifts/settings/positions/${position!.id}/edit` : '/admin/shifts/settings/positions/new'

  const content = html`
    <a href="/admin/shifts/settings" class="text-on-surface-variant hover:text-on-surface text-sm inline-flex items-center gap-1 mb-4">&larr; ${t(lang, 'common.back')}</a>
    <h2 class="font-headline text-2xl font-bold mb-6">${title}</h2>
    ${error ? html`<p class="text-error text-sm mb-4">${error}</p>` : ''}
    <section class="bg-surface-container-lowest rounded-xl p-6 mb-6">
      <form method="POST" action="${action}">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <label class="block">
            <span class="block text-sm font-medium text-on-surface-variant mb-1">${t(lang, 'settings.positionForm.name')}</span>
            <input type="text" name="name" value="${position?.name ?? ''}" required placeholder="${t(lang, 'settings.positionForm.namePlaceholder')}" class="block w-full border-b border-outline focus:border-primary outline-none py-2 bg-transparent">
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-on-surface-variant mb-1">${t(lang, 'settings.positionForm.label')}</span>
            <input type="text" name="label" value="${position?.label ?? ''}" required placeholder="${t(lang, 'settings.positionForm.labelPlaceholder')}" class="block w-full border-b border-outline focus:border-primary outline-none py-2 bg-transparent">
          </label>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <label class="block">
            <span class="block text-sm font-medium text-on-surface-variant mb-1">${t(lang, 'settings.col.minLevel')}</span>
            <input type="number" name="min_level" value="${position?.min_level ?? 1}" min="1" max="5" required class="block w-full border-b border-outline focus:border-primary outline-none py-2 bg-transparent">
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-on-surface-variant mb-1">${t(lang, 'settings.col.defaultCapacity')}</span>
            <input type="number" name="default_capacity" value="${position?.default_capacity ?? 1}" min="0" max="20" required class="block w-full border-b border-outline focus:border-primary outline-none py-2 bg-transparent">
          </label>
          <label class="block">
            <span class="block text-sm font-medium text-on-surface-variant mb-1">${t(lang, 'settings.shiftForm.sortOrder')}</span>
            <input type="number" name="sort_order" value="${position?.sort_order ?? 0}" min="0" class="block w-full border-b border-outline focus:border-primary outline-none py-2 bg-transparent">
          </label>
        </div>
        <button type="submit" class="bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline px-6 py-2 rounded-full hover:opacity-90">${isEdit ? t(lang, 'common.save') : t(lang, 'common.create')}</button>
      </form>
    </section>
  ` as HtmlEscapedString
  return layout(title, content, { nav: true, lang, activePage: 'shifts' })
}

export function positionDeletePage(
  position: PositionRow,
  warning: { assignmentCount: number; shiftCount: number },
  lang: Lang = 'de'
): HtmlEscapedString {
  const content = html`
    <a href="/admin/shifts/settings" class="text-on-surface-variant hover:text-on-surface text-sm inline-flex items-center gap-1 mb-4">&larr; ${t(lang, 'common.back')}</a>
    <h2 class="font-headline text-2xl font-bold mb-6">${t(lang, 'settings.positionDelete.title')}</h2>
    <section class="bg-surface-container-lowest rounded-xl p-6 mb-6">
      <h3 class="font-headline text-lg font-bold text-error mb-3">${t(lang, 'common.warning')}</h3>
      <p class="mb-2">${t(lang, 'settings.positionDelete.positionLabel')} <strong>${position.label} (${position.name})</strong></p>
      ${warning.assignmentCount > 0 || warning.shiftCount > 0
        ? html`<p class="text-error mb-3">${t(lang, 'settings.positionDelete.warning', { assignmentCount: warning.assignmentCount, shiftCount: warning.shiftCount })}</p>`
        : html`<p class="mb-3">${t(lang, 'settings.shiftDelete.noAssignments')}</p>`}
      <form method="POST" action="/admin/shifts/settings/positions/${position.id}/delete" class="flex flex-wrap gap-2 items-center">
        <button type="submit" class="bg-error text-on-error font-headline px-4 py-2 rounded-full hover:opacity-90">${t(lang, 'settings.deletePermanently')}</button>
        <a href="/admin/shifts/settings" class="inline-block px-3 py-1.5 rounded-full border border-outline text-on-surface hover:bg-surface-container text-sm">${t(lang, 'common.cancel')}</a>
      </form>
    </section>
  ` as HtmlEscapedString
  return layout(t(lang, 'settings.positionDelete.title'), content, { nav: true, lang, activePage: 'shifts' })
}
