// Geteilte Formatierungs-Helfer für Views/PDFs (Ticket #397, i18n-Phase).

import type { Lang } from '../i18n.js'
import { DATE_LOCALE } from '../domain/dates.js'

// Wandelt ein ISO-Datum (YYYY-MM-DD) über Intl.DateTimeFormat in ein lokalisiertes
// Datum (de: dd.mm.yyyy, en: dd/mm/yyyy — beide Tag-Monat-Jahr, nur Trennzeichen
// unterscheidet sich per Intl-Konvention). Fällt bei unerwartetem Format auf den
// Originalstring zurück. Lokal konstruiertes Date (nicht `new Date(iso)`), siehe
// domain/dates.ts.
export function formatShiftDate(isoDate: string, lang: Lang = 'de'): string {
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  const [year, month, day] = parts.map(Number)
  if (!year || !month || !day) return isoDate
  const date = new Date(year, month - 1, day)
  return new Intl.DateTimeFormat(DATE_LOCALE[lang], { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

// Leitet den Zeitraum-Text (min–max Datum, formatiert) aus einer Liste von ISO-Daten
// ab — ersetzt früher fest verdrahtete Festival-Daten. `null` bei leerer Liste, damit
// Aufrufer den Hinweis ganz weglassen können statt einen leeren Zeitraum anzuzeigen.
export function formatShiftDateRange(isoDates: string[], lang: Lang = 'de'): string | null {
  if (isoDates.length === 0) return null
  const sorted = [...isoDates].sort()
  const min = sorted[0]
  const max = sorted[sorted.length - 1]
  return min === max ? formatShiftDate(min, lang) : `${formatShiftDate(min, lang)} – ${formatShiftDate(max, lang)}`
}
