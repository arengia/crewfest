// Geteilte, bilinguale Anzeige-Labels für die stabilen internen crew.status- und
// shifts.type-Werte (i18n-Phase, siehe db/schema.ts). Ersetzt drei praktisch
// identische, aber leicht auseinandergelaufene `statusLabel()`-Kopien
// (views/dashboard.ts, views/crew-detail.ts, views/shifts.ts) sowie die verstreuten
// `type === 'day' ? 'Tag' : 'Nacht'`-Ternaries.
//
// Admin-Views (Teil 2, abgeschlossen) rufen diese Funktionen mit dem über
// resolveLang(c) aufgelösten `lang` auf — nicht mehr hart mit 'de'.

import type { Lang } from '../i18n.js'

export type CrewStatus = 'applied' | 'shortlisted' | 'shift_selection' | 'confirmed' | 'declined'
export type ShiftType = 'day' | 'night'

const STATUS_LABELS: Record<Lang, Record<CrewStatus, string>> = {
  de: {
    applied: 'Beworben',
    shortlisted: 'Vorauswahl',
    shift_selection: 'Schicht-Auswahl',
    confirmed: 'Bestätigt',
    declined: 'Absage',
  },
  en: {
    applied: 'Applied',
    shortlisted: 'Shortlisted',
    shift_selection: 'Shift Selection',
    confirmed: 'Confirmed',
    declined: 'Declined',
  },
}

const SHIFT_TYPE_LABELS: Record<Lang, Record<ShiftType, string>> = {
  de: {
    day: 'Tag',
    night: 'Nacht',
  },
  en: {
    day: 'Day',
    night: 'Night',
  },
}

/** Alle gültigen Status-Werte, für <select>-Optionslisten etc. */
export const CREW_STATUSES: readonly CrewStatus[] = ['applied', 'shortlisted', 'shift_selection', 'confirmed', 'declined']

/** Alle gültigen Schicht-Typen, für <select>-Optionslisten etc. */
export const SHIFT_TYPES: readonly ShiftType[] = ['day', 'night']

/** Anzeigetext für einen crew.status-Wert. Unbekannter Wert → unverändert zurück. */
export function statusLabel(lang: Lang, status: string): string {
  return (STATUS_LABELS[lang] as Record<string, string>)[status] ?? status
}

/** Anzeigetext für einen shifts.type-Wert. Unbekannter Wert → unverändert zurück. */
export function shiftTypeLabel(lang: Lang, type: string): string {
  return (SHIFT_TYPE_LABELS[lang] as Record<string, string>)[type] ?? type
}
