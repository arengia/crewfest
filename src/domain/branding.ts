// Instanz-Branding: pro Deployment konfigurierbare Namen/Kontaktdaten, DB-gestützt
// über die generische `settings`-Key-Value-Tabelle (siehe db/schema.ts). Bewusst kein
// eigenes CRUD-Modul — nur zwei kleine Funktionen, die Views/Routen direkt nutzen.
//
// Kein Caching: better-sqlite3 ist synchron und lokal, ein SELECT über 3 Keys ist
// billig genug, um pro Request neu zu lesen (kein Stale-Risiko nach dem Speichern).

import { getDb } from '../db/connection.js'
import type { Lang } from '../i18n.js'

export interface BrandingSettings {
  /** Name der Veranstaltung, z. B. "Sommerfestival 2026". Nie leer — fällt auf DEFAULT_BRANDING.event_name zurück. */
  event_name: string
  /** Name der Organisation/des Vereins dahinter. Optional. */
  org_name: string | null
  /** Kontakt-E-Mail für Rückfragen (z. B. bei doppelten Bewerbungen). Optional. */
  contact_email: string | null
  /** Standard-Sprache der Instanz (i18n-Phase). Greift, wenn weder ?lang= noch das
   *  lang-Cookie gesetzt sind — u.a. für PDF-Exporte (kein Query-Override möglich). */
  default_language: Lang
}

export const DEFAULT_BRANDING: BrandingSettings = {
  event_name: 'Mein Festival',
  org_name: null,
  contact_email: null,
  default_language: 'de',
}

const KEYS = {
  event_name: 'branding.event_name',
  org_name: 'branding.org_name',
  contact_email: 'branding.contact_email',
  default_language: 'branding.default_language',
} as const

export function getBranding(): BrandingSettings {
  const db = getDb()
  const rows = db.prepare(
    `SELECT key, value FROM settings WHERE key IN (?, ?, ?, ?)`
  ).all(KEYS.event_name, KEYS.org_name, KEYS.contact_email, KEYS.default_language) as { key: string; value: string }[]

  const map = new Map(rows.map(r => [r.key, r.value]))
  const eventName = map.get(KEYS.event_name)?.trim()
  const orgName = map.get(KEYS.org_name)?.trim()
  const contactEmail = map.get(KEYS.contact_email)?.trim()
  const defaultLanguageRaw = map.get(KEYS.default_language)?.trim()

  return {
    event_name: eventName || DEFAULT_BRANDING.event_name,
    org_name: orgName || null,
    contact_email: contactEmail || null,
    default_language: defaultLanguageRaw === 'en' ? 'en' : 'de',
  }
}

export interface BrandingInput {
  event_name: string
  org_name: string | null
  contact_email: string | null
  default_language: Lang
}

export function updateBranding(data: BrandingInput): void {
  const db = getDb()
  const upsert = db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `)
  db.transaction(() => {
    upsert.run(KEYS.event_name, data.event_name.trim() || DEFAULT_BRANDING.event_name)
    upsert.run(KEYS.org_name, (data.org_name ?? '').trim())
    upsert.run(KEYS.contact_email, (data.contact_email ?? '').trim())
    upsert.run(KEYS.default_language, data.default_language === 'en' ? 'en' : 'de')
  })()
}
