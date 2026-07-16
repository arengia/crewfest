import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { layout } from './layout.js'
import { getBranding } from '../domain/branding.js'
import type { ShiftCapacity } from '../services/crew.js'
import { t, langSwitcherHtml, type Lang } from '../i18n.js'
import { shiftTypeLabel } from '../domain/labels.js'
import { weekdayName } from '../domain/dates.js'

export function crewCapacityPage(shifts: ShiftCapacity[], lang: Lang = 'de'): HtmlEscapedString {
  const branding = getBranding()
  // Built via the html`` tagged template (auto-escaping) instead of a plain
  // string joined and inserted with raw() — keeps this safe by construction even
  // though today's inputs (shift date/type, translated strings) aren't
  // user-controlled.
  const rows = shifts.map(s => {
    const typeLabel = shiftTypeLabel(lang, s.type)
    const dayName = weekdayName(s.date, lang)
    const free = Math.max(0, s.total_capacity - s.assigned_count)
    const seats = t(lang, 'crewCapacity.seatsFree', { filled: free, total: s.total_capacity })
    return html`<p><strong>${dayName} ${typeLabel}</strong> — ${seats}</p>`
  })

  const content = html`
    <hgroup>
      <h2>${t(lang, 'crewCapacity.title')}</h2>
      <p>${branding.event_name}${branding.org_name ? html` — ${branding.org_name}` : ''}</p>
    </hgroup>
    ${rows}
    <footer class="mt-6 text-xs">${langSwitcherHtml(lang)}</footer>
  ` as HtmlEscapedString

  return layout(t(lang, 'crewCapacity.title'), content, { lang })
}
