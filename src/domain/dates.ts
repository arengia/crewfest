// Datums-Helfer rund um Schichten.

import type { Lang } from '../i18n.js'

/** BCP-47 Locale je Sprache, für Intl.DateTimeFormat. Re-exportiert von i18n.ts
 *  vermieden (Layering) — eigene Kopie hier, da domain/dates.ts von db/seed.ts und
 *  services/settings.ts unabhängig von i18n.ts nutzbar bleiben soll. */
export const DATE_LOCALE: Record<Lang, string> = {
  de: 'de-DE',
  en: 'en-GB',
}

/**
 * Leitet den Wochentagsnamen aus einem ISO-Datum (YYYY-MM-DD) ab, z. B.
 * '2026-06-26' -> 'Freitag' (de) / 'Friday' (en). Der Wochentag wird bewusst bei
 * JEDEM Request neu aus `date` berechnet und NIRGENDS in der DB gespeichert (kein
 * `day_name`-Feld in db/schema.ts) — sonst driftet ein einmalig persistierter
 * Wochentagsname von der jeweils angefragten Sprache auseinander (siehe Bugfix:
 * DE-Wochentag stand auf EN-Seiten). Aufrufer (Views, PDF-Builder, Routes) übergeben
 * immer das per resolveLang(c)/getDefaultLang() aufgelöste `lang` des aktuellen
 * Requests — nie ein zwischengespeichertes.
 *
 * Das Datum wird als lokales Datum konstruiert (nicht `new Date(iso)`, das als UTC
 * interpretiert würde und je nach Zeitzone einen Tag daneben liegen kann).
 *
 * `lang` default 'de' nur als defensiver Fallback für Aufrufer ohne Request-Kontext
 * (z. B. Skripte); reguläre Views/Routes übergeben `lang` immer explizit.
 */
export function weekdayName(isoDate: string, lang: Lang = 'de'): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(year, month - 1, day)
  return new Intl.DateTimeFormat(DATE_LOCALE[lang], { weekday: 'long' }).format(date)
}

/** ISO-Datum (YYYY-MM-DD) aus einem Date im lokalen Kalender. */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
