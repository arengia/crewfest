import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { layout } from './layout.js'
import type { CrewRow, CrewAssignment } from '../services/crew.js'
import { effectiveLevel } from '../services/shifts.js'
import { EXPERIENCE_OPTIONS, experienceLabel } from '../domain/experience.js'
import { statusLabel, shiftTypeLabel, CREW_STATUSES } from '../domain/labels.js'
import { t, type Lang } from '../i18n.js'
import { weekdayName } from '../domain/dates.js'

// ─── Internal helpers ─────────────────────────────────────────────────────────

function renderStars(level: number): string {
  const n = Math.max(0, Math.min(5, Math.round(level)))
  return '★'.repeat(n) + '☆'.repeat(5 - n)
}

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

// ─── crewDetailPage ───────────────────────────────────────────────────────────

export function crewDetailPage(
  crew: CrewRow,
  assignments: CrewAssignment[],
  availabilityText: string,
  allShifts?: { id: number; date: string; type: string }[],
  saved?: string | null,
  error?: string | null,
  lang: Lang = 'de'
): HtmlEscapedString {
  const adminLevel = crew.admin_level
  const level = effectiveLevel(crew)

  // Parse preferred_positions JSON string safely
  let positionsList = '–'
  let preferredPositionsArray: string[] = []
  try {
    const parsed: string[] = JSON.parse(crew.preferred_positions)
    preferredPositionsArray = parsed
    positionsList = parsed.length > 0 ? parsed.join(', ') : '–'
  } catch {
    positionsList = crew.preferred_positions ?? '–'
  }

  // Flash banner
  const flashBanner = saved === 'personal'
    ? html`<div class="mb-4 px-4 py-3 rounded-xl bg-secondary-container text-on-secondary-container text-sm font-medium">${t(lang, 'crewDetail.flash.personalSaved')}</div>`
    : error === 'email_taken'
      ? html`<div class="mb-4 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm font-medium">${t(lang, 'crewDetail.flash.emailTaken')}</div>`
      : ''

  // Position checkboxes for personal edit form
  const knownPositions: Array<{ name: string; label: string }> = [
    { name: 'bar_front', label: t(lang, 'crewDetail.position.barFront') },
    { name: 'bar_back', label: t(lang, 'crewDetail.position.barBack') },
    { name: 'bar_float', label: t(lang, 'crewDetail.position.barFloat') },
    { name: 'bar_prep', label: t(lang, 'crewDetail.position.barPrep') },
    { name: 'cash', label: t(lang, 'crewDetail.position.cash') },
    { name: 'security', label: t(lang, 'crewDetail.position.security') },
    { name: 'tech', label: t(lang, 'crewDetail.position.tech') },
    { name: 'other', label: t(lang, 'crewDetail.position.other') },
  ]
  const positionCheckboxes = knownPositions.map(p => {
    const checked = preferredPositionsArray.includes(p.name) ? 'checked' : ''
    return html`<label class="inline-flex items-center gap-2 mr-4 mb-2 cursor-pointer">
      <input name="preferred_positions" type="checkbox" value="${p.name}" ${checked} class="mr-2 w-4 h-4 rounded border-outline text-primary focus:ring-primary">
      <span class="text-sm font-body text-on-surface">${p.label}</span>
    </label>`
  })

  // Level select options (1-5) — admin_level is the single authoritative level
  const levelOptions = [1, 2, 3, 4, 5].map((n) => {
    const selected = adminLevel === n ? 'selected' : ''
    return html`<option value="${n}" ${selected}>${n} ${'★'.repeat(n)}</option>`
  })

  // Experience select options — same source as the application form
  const experienceOptions = EXPERIENCE_OPTIONS.map((o) => {
    const selected = crew.experience_text === o.key ? 'selected' : ''
    return html`<option value="${o.key}" ${selected}>${experienceLabel(lang, o.key)}</option>`
  })

  // Status select options
  const statusOptions = CREW_STATUSES.map((value) => {
    const selected = crew.status === value ? 'selected' : ''
    return html`<option value="${value}" ${selected}>${statusLabel(lang, value)}</option>`
  })

  // Assignment rows
  const assignmentCards = assignments.map((a) => {
    const shiftOptions = (allShifts ?? []).filter(s => s.id !== a.shift_id).map(s =>
      html`<option value="${s.id}">${weekdayName(s.date, lang)} ${shiftTypeLabel(lang, s.type).charAt(0)}</option>`
    )
    return html`<div class="flex items-center justify-between bg-surface-container-lowest p-4 rounded-lg relative overflow-hidden mb-2 group hover:bg-surface-container-highest transition-colors">
      <div class="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full"></div>
      <div class="flex items-center gap-4 pl-3">
        <div class="bg-surface-variant p-2 rounded-lg">
          <span class="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">calendar_today</span>
        </div>
        <div>
          <a href="/admin/shifts?open=${a.shift_id}-${a.position_id}" class="text-sm font-headline font-bold text-on-surface hover:text-primary transition-colors">${weekdayName(a.date, lang)} ${shiftTypeLabel(lang, a.type)} (${a.date})</a>
          <span class="block text-xs text-on-surface-variant">${a.position_label}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <form method="POST" action="/admin/assignments/${a.id}/move" style="display:inline-flex;align-items:center;gap:0.25rem;">
          <select name="target_shift_id" required class="bg-surface-variant border-none rounded px-2 py-1 text-xs font-body text-on-surface focus:ring-0 cursor-pointer" style="width:auto;">
            <option value="">${t(lang, 'crewDetail.movePlaceholder')}</option>
            ${shiftOptions}
          </select>
          <button type="submit" class="text-xs px-2 py-1 rounded border border-outline text-on-surface-variant hover:bg-surface-variant transition-colors">OK</button>
        </form>
        <form method="POST" action="/admin/assignments/${a.id}/delete" style="display:inline">
          <input type="hidden" name="_method" value="DELETE">
          <button type="submit" aria-label="${t(lang, 'crewDetail.remove')}" class="text-on-surface-variant hover:text-error hover:bg-error-container p-2 rounded-full transition-colors">
            <span class="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </form>
      </div>
    </div>`
  })

  const content = html`
    <div class="flex gap-4 mb-8 items-center">
      <a href="/admin" class="flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary transition-colors"><span class="material-symbols-outlined text-[18px]">arrow_back</span> ${t(lang, 'crewDetail.backToList')}</a>
      <a href="/admin/shifts" class="flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary transition-colors">${t(lang, 'nav.shifts')} <span class="material-symbols-outlined text-[18px]">arrow_forward</span></a>
    </div>

    ${flashBanner}

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

      <!-- LEFT column -->
      <div class="lg:col-span-5 flex flex-col gap-6">

        <!-- Profile Identity Card -->
        <div class="relative bg-surface-container-lowest rounded-xl p-8 overflow-hidden shadow-sm">
          <div class="absolute left-0 top-8 bottom-8 w-1 ${statusPillarClass(crew.status)} rounded-r-full"></div>
          ${crew.photo_filename
            ? html`<img src="/admin/crew/${crew.id}/photo" alt="${crew.first_name} ${crew.last_name}" class="w-20 h-20 rounded-full object-cover mb-4">`
            : crew.attachment_url
              // attachment_url comes from CSV import and isn't validated. The CSP
              // (img-src 'self' data:) blocks external images anyway, so it is never
              // rendered as an <img>. http(s) URLs become a clickable link; any other
              // scheme (javascript:, data:, ...) is shown as escaped plain text —
              // nothing is requested automatically and nothing executable is linked.
              ? (/^https?:\/\//.test(crew.attachment_url)
                  ? html`<a href="${crew.attachment_url}" target="_blank" rel="noopener noreferrer" class="block text-sm text-primary underline break-all mb-4">${crew.attachment_url}</a>`
                  : html`<span class="block text-sm text-on-surface-variant break-all mb-4">${crew.attachment_url}</span>`)
              : ''}
          <h2 class="text-2xl font-headline font-bold text-on-surface">${crew.first_name} ${crew.last_name}</h2>
          <div class="flex flex-wrap gap-2 mt-2 mb-6">
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${statusPillClasses(crew.status)}">${statusLabel(lang, crew.status)}</span>
            <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-secondary-container text-on-secondary-container">${t(lang, 'common.level')} ${level}</span>
          </div>
          <div class="grid grid-cols-2 gap-y-5 gap-x-4 mt-4">
            <div class="flex flex-col gap-1">
              <span class="text-xs font-label text-on-surface-variant uppercase tracking-wider">${t(lang, 'apply.field.email')}</span>
              <span class="text-sm font-body font-medium text-on-surface">${crew.email}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-label text-on-surface-variant uppercase tracking-wider">${t(lang, 'apply.field.phone')}</span>
              <span class="text-sm font-body font-medium text-on-surface">${crew.phone ?? '–'}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-label text-on-surface-variant uppercase tracking-wider">${t(lang, 'apply.field.nickname')}</span>
              <span class="text-sm font-body font-medium text-on-surface">${crew.nickname ?? '–'}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-label text-on-surface-variant uppercase tracking-wider">${t(lang, 'common.level')}</span>
              <span class="text-sm font-body font-medium text-on-surface" aria-label="${t(lang, 'common.starsAriaLabel', { level })}">${renderStars(level)}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-label text-on-surface-variant uppercase tracking-wider">${t(lang, 'crewDetail.label.availability')}</span>
              <span class="text-sm font-body font-medium text-on-surface">${availabilityText || '–'}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-label text-on-surface-variant uppercase tracking-wider">${t(lang, 'crewDetail.label.preferredPositions')}</span>
              <span class="text-sm font-body font-medium text-on-surface">${positionsList}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-label text-on-surface-variant uppercase tracking-wider">${t(lang, 'crewDetail.label.group')}</span>
              <span class="text-sm font-body font-medium text-on-surface">${crew.group_signup ? (crew.group_name ?? t(lang, 'common.yes')) : t(lang, 'common.no')}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-label text-on-surface-variant uppercase tracking-wider">${t(lang, 'crewDetail.label.festivalCount')}</span>
              <span class="text-sm font-body font-medium text-on-surface">${crew.festival_count !== null ? crew.festival_count : '–'}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-label text-on-surface-variant uppercase tracking-wider">${t(lang, 'crewDetail.label.source')}</span>
              <span class="text-sm font-body font-medium text-on-surface">${crew.source}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-xs font-label text-on-surface-variant uppercase tracking-wider">${t(lang, 'crewDetail.label.appliedAt')}</span>
              <span class="text-sm font-body font-medium text-on-surface">${crew.created_at}</span>
            </div>
            ${crew.experience_text ? html`<div class="col-span-2 flex flex-col gap-1">
              <span class="text-xs font-label text-on-surface-variant uppercase tracking-wider">${t(lang, 'crewDetail.label.experience')}</span>
              <span class="text-sm font-body font-medium text-on-surface whitespace-pre-wrap">${experienceLabel(lang, crew.experience_text)}</span>
            </div>` : ''}
            ${crew.about_text ? html`<div class="col-span-2 flex flex-col gap-1">
              <span class="text-xs font-label text-on-surface-variant uppercase tracking-wider">${t(lang, 'apply.field.aboutText')}</span>
              <span class="text-sm font-body font-medium text-on-surface whitespace-pre-wrap">${crew.about_text}</span>
            </div>` : ''}
            ${crew.admin_note ? html`<div class="col-span-2 flex flex-col gap-1">
              <span class="text-xs font-label text-on-surface-variant uppercase tracking-wider">${t(lang, 'crewDetail.label.adminNote')}</span>
              <span class="text-sm font-body font-medium text-on-surface whitespace-pre-wrap">${crew.admin_note}</span>
            </div>` : ''}
          </div>
        </div>

        <!-- Admin Controls Card -->
        <div class="bg-surface-container-low rounded-xl p-6 flex flex-col gap-5">
          <h3 class="text-lg font-headline font-bold text-on-surface tracking-tight">${t(lang, 'crewDetail.section.management')}</h3>
          <form method="POST" action="/admin/crew/${crew.id}" class="space-y-4">
            <div>
              <label class="block text-sm font-label text-on-surface-variant mb-1" for="admin_level">${t(lang, 'common.level')}</label>
              <select id="admin_level" name="admin_level" class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-3 font-body text-sm">
                ${levelOptions}
              </select>
            </div>
            <div>
              <label class="block text-sm font-label text-on-surface-variant mb-1" for="status">${t(lang, 'common.status')}</label>
              <select id="status" name="status" class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-3 font-body text-sm">
                ${statusOptions}
              </select>
            </div>
            <div>
              <label class="block text-sm font-label text-on-surface-variant mb-1" for="admin_note">${t(lang, 'crewDetail.label.adminNote')}</label>
              <textarea id="admin_note" name="admin_note" rows="4" class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-3 font-body text-sm">${crew.admin_note ?? ''}</textarea>
            </div>
            <div>
              <label class="block text-sm font-label text-on-surface-variant mb-1" for="nickname">${t(lang, 'apply.field.nickname')}</label>
              <input id="nickname" name="nickname" type="text" value="${crew.nickname ?? ''}" class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-3 font-body text-sm">
            </div>
            <label class="inline-flex items-center gap-2 cursor-pointer">
              <input name="external_registration" type="checkbox" role="switch" ${crew.external_registration ? 'checked' : ''} class="mr-2 w-4 h-4 rounded border-outline text-primary focus:ring-primary">
              <span class="text-sm font-body text-on-surface">${t(lang, 'crewDetail.field.externalRegistration')}</span>
            </label>
            <button type="submit" class="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-xl font-body font-medium hover:opacity-90 transition-opacity">${t(lang, 'common.save')}</button>
          </form>
        </div>

      </div>

      <!-- RIGHT column -->
      <div class="lg:col-span-7 flex flex-col gap-6">

        <!-- Assigned Shifts Card -->
        <div class="bg-surface-container-low rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-xl font-headline font-bold text-on-surface">${t(lang, 'crewDetail.section.assignedShifts')}</h3>
            <span class="text-sm font-body text-on-surface-variant">${t(lang, 'crewDetail.assignmentsCount', { count: assignments.length })}</span>
          </div>
          ${assignments.length === 0
            ? html`<p class="text-on-surface-variant text-sm">${t(lang, 'crewDetail.noAssignments')}</p>`
            : assignmentCards}
        </div>

        <!-- Personendaten bearbeiten (collapsible) -->
        <div class="bg-surface-container-lowest rounded-xl p-6">
          <details class="group">
            <summary class="cursor-pointer font-headline font-semibold text-on-surface list-none flex items-center gap-2">
              <span class="material-symbols-outlined text-on-surface-variant group-open:rotate-90 transition-transform">chevron_right</span>
              ${t(lang, 'crewDetail.section.editPersonal')}
            </summary>
            <form method="POST" action="/admin/crew/${crew.id}/personal" class="mt-4">

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-label text-on-surface-variant mb-1 mt-4">${t(lang, 'apply.field.firstName')}</label>
                  <input name="first_name" type="text" value="${crew.first_name}" required class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2 font-body text-sm">
                </div>
                <div>
                  <label class="block text-sm font-label text-on-surface-variant mb-1 mt-4">${t(lang, 'apply.field.lastName')}</label>
                  <input name="last_name" type="text" value="${crew.last_name}" required class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2 font-body text-sm">
                </div>
              </div>

              <label class="block text-sm font-label text-on-surface-variant mb-1 mt-4">${t(lang, 'apply.field.email')}</label>
              <input name="email" type="email" value="${crew.email}" required class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2 font-body text-sm">

              <label class="block text-sm font-label text-on-surface-variant mb-1 mt-4">${t(lang, 'apply.field.phone')}</label>
              <input name="phone" type="text" value="${crew.phone ?? ''}" class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2 font-body text-sm">

              <label class="block text-sm font-label text-on-surface-variant mb-1 mt-4">${t(lang, 'crewDetail.label.preferredPositions')}</label>
              <div class="flex flex-wrap mt-1">
                ${positionCheckboxes}
              </div>

              <label class="inline-flex items-center gap-2 mt-4 cursor-pointer">
                <input name="group_signup" type="checkbox" role="switch" ${crew.group_signup ? 'checked' : ''} class="mr-2 w-4 h-4 rounded border-outline text-primary focus:ring-primary">
                <span class="text-sm font-body text-on-surface">${t(lang, 'crewDetail.field.groupSignup')}</span>
              </label>

              <label class="block text-sm font-label text-on-surface-variant mb-1 mt-4">${t(lang, 'apply.field.groupName')}</label>
              <input name="group_name" type="text" value="${crew.group_name ?? ''}" class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2 font-body text-sm">

              <label class="block text-sm font-label text-on-surface-variant mb-1 mt-4">${t(lang, 'crewDetail.label.festivalCount')}</label>
              <input name="festival_count" type="number" min="0" value="${crew.festival_count ?? ''}" class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2 font-body text-sm">

              <label class="block text-sm font-label text-on-surface-variant mb-1 mt-4">${t(lang, 'crewDetail.field.note')}</label>
              <textarea name="note" rows="3" class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2 font-body text-sm">${crew.note ?? ''}</textarea>

              <hr class="my-4 border-outline-variant">
              <p class="font-headline font-semibold text-sm text-on-surface mb-2">${t(lang, 'crewDetail.divider.googleForms')}</p>

              <label class="block text-sm font-label text-on-surface-variant mb-1 mt-4">${t(lang, 'crewDetail.label.experience')}</label>
              <select name="experience_text" class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2 font-body text-sm">
                <option value="">${t(lang, 'crewDetail.field.experienceNone')}</option>
                ${experienceOptions}
              </select>

              <label class="block text-sm font-label text-on-surface-variant mb-1 mt-4">${t(lang, 'crewDetail.field.experienceDetails')}</label>
              <textarea name="experience_details" rows="3" class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2 font-body text-sm">${crew.experience_details ?? ''}</textarea>

              <label class="block text-sm font-label text-on-surface-variant mb-1 mt-4">${t(lang, 'crewDetail.field.previousWork')}</label>
              <textarea name="previous_work" rows="3" class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2 font-body text-sm">${crew.previous_work ?? ''}</textarea>

              <label class="inline-flex items-center gap-2 mt-4 cursor-pointer">
                <input name="contact_person" type="checkbox" role="switch" ${crew.contact_person ? 'checked' : ''} class="mr-2 w-4 h-4 rounded border-outline text-primary focus:ring-primary">
                <span class="text-sm font-body text-on-surface">${t(lang, 'crewDetail.field.contactPerson')}</span>
              </label>

              <label class="block text-sm font-label text-on-surface-variant mb-1 mt-4">${t(lang, 'crewDetail.field.preferredWork')}</label>
              <textarea name="preferred_work" rows="2" class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2 font-body text-sm">${crew.preferred_work ?? ''}</textarea>

              <label class="block text-sm font-label text-on-surface-variant mb-1 mt-4">${t(lang, 'apply.field.nationality')}</label>
              <input name="nationality" type="text" value="${crew.nationality ?? ''}" class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2 font-body text-sm">

              <label class="block text-sm font-label text-on-surface-variant mb-1 mt-4">${t(lang, 'apply.field.aboutText')}</label>
              <textarea name="about_text" rows="4" class="w-full bg-surface-variant text-on-surface border-0 border-b-2 border-transparent focus:border-primary focus:ring-0 rounded-t-DEFAULT px-4 py-2 font-body text-sm">${crew.about_text ?? ''}</textarea>

              <button type="submit" class="w-full mt-6 bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-xl font-body font-medium hover:opacity-90 transition-opacity">${t(lang, 'crewDetail.savePersonal')}</button>
            </form>
          </details>
        </div>

      </div>
    </div>
  ` as HtmlEscapedString

  return layout(
    t(lang, 'crewDetail.pageTitle', { name: `${crew.first_name} ${crew.last_name}` }),
    content,
    { nav: true, lang, activePage: 'crew' }
  )
}
