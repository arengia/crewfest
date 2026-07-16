// Zentrale Definition der Bar-Erfahrungs-Frage.
//
// Diese Frage taucht an drei Stellen auf: im öffentlichen Bewerbungsformular
// (`views/apply-form.ts`), in der Admin-Detailbearbeitung (`views/crew-detail.ts`)
// und im CSV-Import (`services/import.ts`). Alle drei beziehen ihre Optionen aus
// dieser einen Quelle — dadurch kann das Level-Mapping nicht mehr auseinanderlaufen.
//
// WICHTIG:
//   • Der `key` ist ein stabiler, sprachneutraler Bezeichner und wird SO in der DB
//     (Spalte `crew.experience_text`) gespeichert. Aus ihm wird das Level abgeleitet.
//     Keys niemals ändern, sobald Daten existieren — sonst brechen bestehende Zeilen.
//   • `label` ist jetzt (i18n-Phase) pro Sprache getrennt — siehe experienceLabel(lang, key).
//   • `level` (1–5) ist die aus der Selbsteinschätzung abgeleitete Stufe.

import type { Lang } from '../i18n.js'

export interface ExperienceOption {
  /** Stabiler Bezeichner, wird in crew.experience_text gespeichert. */
  key: string
  /** Abgeleitetes Selbsteinschätzungs-Level 1–5. */
  level: number
  /** Anzeigetext je Sprache. */
  label: Record<Lang, string>
}

export const EXPERIENCE_OPTIONS: ReadonlyArray<ExperienceOption> = [
  {
    key: 'exp_none',
    level: 1,
    label: {
      de: 'Ich habe keine oder sehr wenig Barerfahrung und würde es gerne mal probieren.',
      en: 'I have little or no bar experience and would like to give it a try.',
    },
  },
  {
    key: 'exp_ticket_only',
    level: 1,
    label: {
      de: 'Eigentlich will ich nur ein Festival-Ticket.',
      en: 'Actually, I just want a festival ticket.',
    },
  },
  {
    key: 'exp_private',
    level: 2,
    label: {
      de: 'Gelegentlich mache ich bei privaten Feiern die Bar oder helfe in einer ruhigen Kneipe aus.',
      en: 'Occasionally I run the bar at private parties or help out in a quiet pub.',
    },
  },
  {
    key: 'exp_gastro_job',
    level: 3,
    label: {
      de: 'Gastronomie ist für mich ein Nebenjob zum Geldverdienen.',
      en: 'The catering industry is a side job for me to earn money.',
    },
  },
  {
    key: 'exp_bar_experienced',
    level: 4,
    label: {
      de: 'Ja, ich habe bereits in einer Bar gearbeitet oder arbeite derzeit dort.',
      en: 'Yes, I work or have worked at a bar.',
    },
  },
  {
    key: 'exp_bar_regular',
    level: 5,
    label: {
      de: 'Ich arbeite seit mehreren Jahren regelmäßig an einer Bar.',
      en: 'I have been working at a bar regularly for several years.',
    },
  },
  {
    key: 'exp_gastro_pro',
    level: 5,
    label: {
      de: 'Ich bin der Gastrobranche verfallen.',
      en: 'I am hooked on the catering industry.',
    },
  },
]

const OPTION_BY_KEY = new Map<string, ExperienceOption>(
  EXPERIENCE_OPTIONS.map((o) => [o.key, o]),
)

/** Menge aller gültigen Erfahrungs-Keys (für Server-seitige Validierung). */
export const EXPERIENCE_KEYS: ReadonlySet<string> = new Set(OPTION_BY_KEY.keys())

/** True, wenn `value` einer der definierten Erfahrungs-Keys ist. */
export function isExperienceKey(value: string | null | undefined): boolean {
  return value != null && OPTION_BY_KEY.has(value)
}

/**
 * Leitet das Level (1–5) aus einem Erfahrungs-Key ab. Unbekannte Werte → 1
 * (sicherer Default). Einzige Quelle der Level-Ableitung.
 */
export function experienceLevel(key: string | null | undefined): number {
  if (!key) return 1
  return OPTION_BY_KEY.get(key)?.level ?? 1
}

/**
 * Wandelt einen gespeicherten Wert in seinen Anzeigetext (Sprache `lang`) um. Ist
 * der Wert ein bekannter Key → dessen Label in `lang`. Andernfalls (unbekannter
 * Freitext aus einem Import) → der Wert unverändert (sprachneutral, es ist kein
 * Key). `null` → leerer String.
 */
export function experienceLabel(lang: Lang, value: string | null | undefined): string {
  if (!value) return ''
  return OPTION_BY_KEY.get(value)?.label[lang] ?? value
}
