// i18n-Infrastruktur (DE/EN). Zentrale Übersetzungs-Wörterbücher + Sprachauflösung.
//
// Konventionen für neue Keys:
//   - Flache Keys mit Punkt-Namespace, z.B. "apply.title", "common.save".
//   - Jeder Key MUSS in de UND en existieren. Fehlt ein Key nur in einer Sprache,
//     fällt t() auf DE zurück und loggt einmalig eine console.warn (nicht pro Request).
//   - Interpolation: `{name}` im Wörterbuch-Wert, Wert via params-Objekt übergeben.
//
// `common.*` ist bewusst schlank gehalten (nur was Teil 1 — Infrastruktur + öffentliche
// Flächen + PDFs — tatsächlich braucht). Teil 2 (Admin-Flächen) ergänzt eigene
// Namespaces/Keys nach demselben Muster, wenn die Admin-UI übersetzt wird.

import type { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { getBranding } from './domain/branding.js'
import { config } from './config.js'

export type Lang = 'de' | 'en'

/** BCP-47 Locale je Sprache, für Intl.* (Datumsformate etc.). */
export const LOCALE: Record<Lang, string> = {
  de: 'de-DE',
  en: 'en-GB',
}

// ─── Wörterbücher ──────────────────────────────────────────────────────────────

const de = {
  // common — generische, wiederverwendbare Strings
  'common.yes': 'Ja',
  'common.no': 'Nein',
  'common.optional': '(optional)',
  'common.continue': 'Weiter',
  'common.username': 'Benutzername',
  'common.password': 'Passwort',
  'common.save': 'Speichern',
  'common.cancel': 'Abbrechen',
  'common.back': 'Zurück',
  'common.rateLimited': 'Zu viele Anfragen. Bitte versuche es später erneut.',

  // apply — öffentliches Bewerbungsformular (views/apply-form.ts, routes/apply.ts)
  'apply.pageTitle': 'Crew-Bewerbung',
  'apply.title': 'Crew-Bewerbung',
  'apply.subtitle': 'Bewirb dich jetzt für {event}.',
  'apply.section.contact': 'Kontakt',
  'apply.field.firstName': 'Vorname',
  'apply.field.lastName': 'Nachname',
  'apply.field.email': 'E-Mail',
  'apply.field.phone': 'Telefon',
  'apply.field.nickname': 'Rufname',
  'apply.section.experience': 'Erfahrung',
  'apply.field.experience': 'Bar-Erfahrung',
  'apply.field.pleaseSelect': 'Bitte wählen',
  'apply.field.experienceDetails': 'Wie und wo?',
  'apply.field.previousWork': 'Schon mal mit uns gearbeitet?',
  'apply.field.previousWorkWhere': 'Wo?',
  'apply.field.contactPerson': 'Ansprechperson für Gäste?',
  'apply.section.preferredWork': 'Wunscharbeit',
  'apply.field.preferredWork': 'Wo möchtest du am liebsten arbeiten?',
  'apply.field.preferredWorkHint': '(Leer lassen für keine Präferenz)',
  'apply.field.noPreference': 'Keine Präferenz',
  'apply.preferredWork.barFront': 'Am Tresen arbeiten',
  'apply.preferredWork.logistics': 'In der Logistik',
  'apply.preferredWork.support': 'Der Bar zuarbeiten (Runner, Spüler etc.)',
  'apply.section.group': 'Gruppe',
  'apply.field.groupSignup': 'Ich melde mich als Gruppe an',
  'apply.field.groupName': 'Gruppenname',
  'apply.section.aboutYou': 'Über dich',
  'apply.field.nationality': 'Nationalität',
  'apply.field.festivalCount': 'Wie oft warst du schon bei diesem Festival?',
  'apply.field.festivalCountHint': '(Zahl)',
  'apply.field.aboutText': 'Über dich',
  'apply.field.notes': 'Anmerkungen',
  'apply.field.image': 'Bild',
  'apply.field.imageHint': '(optional, max. 3 MB, JPEG/PNG/WebP)',
  'apply.submit': 'Jetzt bewerben',
  'apply.error.requiredFields': 'Bitte fülle die Pflichtfelder (Vorname, Nachname, E-Mail) aus.',
  'apply.error.invalidEmail': 'Bitte eine gültige E-Mail-Adresse eingeben.',
  'apply.error.experienceRequired': 'Bitte wähle eine Erfahrungsstufe aus der Liste.',
  'apply.error.duplicateEmail': 'Diese E-Mail ist bereits registriert. Bei Fragen {contact}.',
  'apply.error.contactWithEmail': 'wende dich an {email}',
  'apply.error.contactFallback': 'wende dich an das Orga-Team',

  'apply.success.pageTitle': 'Bewerbung eingegangen',
  'apply.success.title': 'Danke, {name}!',
  'apply.success.body': 'Deine Bewerbung ist angekommen. Wir melden uns, sobald die Schichtplanung beginnt.',
  'apply.success.uploadWarning': 'Dein Bild konnte nicht gespeichert werden — schreib uns bitte per Mail mit dem Bild im Anhang.',

  // login — Admin-Login (views/login.ts, routes/auth.ts)
  'login.pageTitle': 'Admin Login',
  'login.heading': 'Admin Console',
  'login.subheading': 'Anmeldung für Admins',
  'login.usernamePlaceholder': 'Benutzername eingeben',
  'login.passwordPlaceholder': 'Passwort eingeben',
  'login.submit': 'Anmelden',
  'login.backToApply': 'Zur Bewerbung',
  'login.error.invalidCredentials': 'Falscher Benutzername oder falsches Passwort.',
  'login.flash.accountCreated': 'Konto erstellt. Bitte anmelden.',

  // setup — Ersteinrichtung (views/setup.ts, routes/auth.ts)
  'setup.pageTitle': 'Crewfest — Setup',
  'setup.heading': 'Admin-Konto erstellen',
  'setup.subheading': 'Erstelle dein Admin-Konto, um loszulegen.',
  'setup.usernamePlaceholder': 'Benutzername eingeben',
  'setup.passwordPlaceholder': 'Mindestens 12 Zeichen',
  'setup.confirmPassword': 'Passwort bestätigen',
  'setup.confirmPasswordPlaceholder': 'Passwort wiederholen',
  'setup.submit': 'Konto erstellen',
  'setup.error.passwordMismatch': 'Passwörter stimmen nicht überein.',
  'setup.error.usernameTaken': 'Dieser Benutzername ist bereits vergeben.',

  // crewLogin — Crew-Passwortgate (views/crew-login.ts)
  'crewLogin.pageTitle': 'Crew-Bereich',
  'crewLogin.subheading': 'Passwort eingeben, um die Schichtbelegung zu sehen.',
  'crewLogin.passwordPlaceholder': 'Passwort eingeben',
  'crewLogin.error.wrongPassword': 'Falsches Passwort.',

  // crewCapacity — Schichtbelegung für Crew (views/crew-capacity.ts)
  'crewCapacity.title': 'Schichtbelegung',
  'crewCapacity.seatsFree': '{filled} / {total} Plätze frei',

  // publicSchedule — öffentlicher Schichtplan (views/public-schichtplan.ts)
  'publicSchedule.pageTitle': 'Schichtplan',
  'publicSchedule.title': 'Schichtplan — {event}',
  'publicSchedule.subtitle': 'Öffentliche Übersicht zum Besetzungsstand.',
  'publicSchedule.seatsFilled': 'Plätze besetzt',
  'publicSchedule.viewSwitcherLabel': 'Ansicht wählen',
  'publicSchedule.view.list': 'Liste',
  'publicSchedule.view.calendar': 'Kalender',
  'publicSchedule.view.timeline': 'Zeitstrahl',
  'publicSchedule.shiftCount': '{count} Schichten',
  'publicSchedule.col.date': 'Datum',
  'publicSchedule.col.weekday': 'Wochentag',
  'publicSchedule.col.time': 'Uhrzeit',
  'publicSchedule.col.type': 'Typ',
  'publicSchedule.col.fill': 'Besetzung',
  'publicSchedule.col.positions': 'Positionen',

  // pdf — geteilte Spalten-Header + Titel der 3 PDF-Templates
  'pdf.col.date': 'Datum',
  'pdf.col.weekday': 'Tag',
  'pdf.col.time': 'Uhrzeit',
  'pdf.col.type': 'Typ',
  'pdf.col.number': '#',
  'pdf.col.name': 'Name',
  'pdf.col.position': 'Position',
  'pdf.col.checkin': 'Check-in',
  'pdf.col.checkout': 'Check-out',
  'pdf.shiftPlan.title': '{event} — Schichtplan',
  'pdf.selection.title': '{event} — Schicht-Auswahl',
  'pdf.selection.openSlots': 'OFFEN x {count}',
  'pdf.checklist.heading': 'Check-in / Check-out: {shift}',

  // common — Teil 2 (Admin) Ergänzungen: generische, wiederverwendbare Admin-Strings
  'common.edit': 'Bearbeiten',
  'common.delete': 'Löschen',
  'common.duplicate': 'Duplizieren',
  'common.create': 'Erstellen',
  'common.name': 'Name',
  'common.level': 'Level',
  'common.status': 'Status',
  'common.action': 'Aktion',
  'common.actions': 'Aktionen',
  'common.position': 'Position',
  'common.warning': 'Warnung',
  'common.starsAriaLabel': '{level} von 5 Sternen',

  // nav — Admin-Sidebar (views/layout.ts)
  'nav.crew': 'Crew',
  'nav.shifts': 'Schichten',
  'nav.import': 'Import',
  'nav.logout': 'Abmelden',

  // admin — Flash-/Fehlertexte aus routes/admin.ts + die dort inline gerenderte
  // Gruppen-Zuweisungs-Seite (kein eigenes views/-File)
  'admin.error.positionFull': 'Position voll — keine weiteren Zuweisungen möglich.',
  'admin.error.alreadyAssignedOtherPosition': 'Diese Person ist bereits einer anderen Position in dieser Schicht zugewiesen.',
  'admin.error.targetPositionMissing': 'Position existiert nicht in der Zielschicht.',
  'admin.error.targetPositionFull': 'Position in Zielschicht ist voll.',
  'admin.error.alreadyInTargetShift': 'Crew ist bereits in der Zielschicht zugewiesen.',
  'admin.error.pdfGenerationFailed': 'PDF konnte nicht erstellt werden. Bitte versuche es erneut.',
  'admin.error.noShiftsSelected': 'Keine Schichten ausgewählt.',
  'admin.error.noCrewAssigned': 'Keine Crew zugewiesen. Weise zuerst Crew-Mitglieder zu Schichten zu.',
  'admin.groupAssign.pageTitle': 'Gruppe zuweisen',
  'admin.groupAssign.backToList': 'Zurück zur Crew-Liste',
  'admin.groupAssign.heading': 'Gruppe "{group}" zuweisen',
  'admin.groupAssign.shiftLabel': 'Schicht',
  'admin.groupAssign.selectShiftPlaceholder': 'Schicht wählen...',
  'admin.groupAssign.assignAll': 'Alle zuweisen',

  // dashboard — Crew-Übersicht (views/dashboard.ts)
  'dashboard.exportCsv': 'CSV exportieren',
  'dashboard.searchPlaceholder': 'Name suchen…',
  'dashboard.searchAriaLabel': 'Name filtern',
  'dashboard.statusAriaLabel': 'Status filtern',
  'dashboard.statusAll': 'Status: Alle',
  'dashboard.shiftAvailAriaLabel': 'Schicht-Verfügbarkeit filtern',
  'dashboard.shiftAvailPlaceholder': 'Verfügbar für Schicht',
  'dashboard.countAriaLabel': 'Schichtzahl filtern',
  'dashboard.countAll': 'Schichtzahl: Alle',
  'dashboard.count0': '0 Schichten',
  'dashboard.count12': '1–2 Schichten',
  'dashboard.count3': '3+ Schichten',
  'dashboard.groupAriaLabel': 'Gruppe filtern',
  'dashboard.allGroups': 'Alle Gruppen',
  'dashboard.groupAssign': 'Gruppe zuweisen',
  'dashboard.colShifts': 'Schichten',
  'dashboard.filterCountTemplate': '{visible} von {total} Personen',
  'dashboard.emptyState': 'Keine Einträge gefunden — Filter anpassen oder Bewerbungen unter Import importieren.',

  // crewDetail — Crew-Detailseite (views/crew-detail.ts)
  'crewDetail.backToList': 'Crew-Liste',
  'crewDetail.flash.personalSaved': 'Personendaten gespeichert.',
  'crewDetail.flash.emailTaken': 'Diese E-Mail-Adresse wird bereits von einer anderen Person verwendet.',
  'crewDetail.position.barFront': 'Bar Front',
  'crewDetail.position.barBack': 'Bar Back',
  'crewDetail.position.barFloat': 'Bar Float',
  'crewDetail.position.barPrep': 'Bar Prep',
  'crewDetail.position.cash': 'Kasse',
  'crewDetail.position.security': 'Security',
  'crewDetail.position.tech': 'Technik',
  'crewDetail.position.other': 'Sonstiges',
  'crewDetail.label.availability': 'Verfügbarkeit',
  'crewDetail.label.preferredPositions': 'Bevorzugte Positionen',
  'crewDetail.label.group': 'Gruppe',
  'crewDetail.label.festivalCount': 'Festival-Teilnahmen',
  'crewDetail.label.source': 'Quelle',
  'crewDetail.label.appliedAt': 'Beworben am',
  'crewDetail.label.experience': 'Erfahrung',
  'crewDetail.label.adminNote': 'Admin-Notiz',
  'crewDetail.section.management': 'Verwaltung',
  'crewDetail.field.externalRegistration': 'Extern registriert',
  'crewDetail.section.assignedShifts': 'Zugewiesene Schichten',
  'crewDetail.assignmentsCount': '{count} Einsätze',
  'crewDetail.noAssignments': 'Noch keine Schichten zugewiesen.',
  'crewDetail.movePlaceholder': 'Verschieben...',
  'crewDetail.remove': 'Entfernen',
  'crewDetail.section.editPersonal': 'Personendaten bearbeiten',
  'crewDetail.field.groupSignup': 'Gruppenanmeldung',
  'crewDetail.field.note': 'Notiz (von Bewerber:in)',
  'crewDetail.divider.googleForms': 'Google-Forms-Felder',
  'crewDetail.field.experienceNone': '– nicht angegeben –',
  'crewDetail.field.experienceDetails': 'Erfahrung Details',
  'crewDetail.field.previousWork': 'Früheres Arbeiten bei uns',
  'crewDetail.field.contactPerson': 'Ansprechperson',
  'crewDetail.field.preferredWork': 'Bevorzugter Arbeitsbereich',
  'crewDetail.savePersonal': 'Personendaten speichern',
  'crewDetail.pageTitle': 'Crew — {name}',

  // shifts — Schichtplan-Admin (views/shifts.ts) — der größte Namespace
  'shifts.levelTooLow': 'Level zu niedrig (min. {min}★)',
  'shifts.move': 'Verschieben',
  'shifts.chipTitleSuggest': '{label} — min. Level {min}★ — Vorschläge anzeigen',
  'shifts.chipTitleDefault': '{label} — min. Level {min}★',
  'shifts.assignedCrew': 'Zugewiesene Crew',
  'shifts.suggestions': 'Vorschläge',
  'shifts.allAvailableCrew': 'Alle verfügbare Crew',
  'shifts.assign': 'Zuweisen',
  'shifts.noCandidates': 'Keine Kandidaten',
  'shifts.noCandidatesHint': 'Keine verfügbaren Crew-Mitglieder für diese Schicht. Alle passenden Personen haben bereits 3 Schichten oder keine Eintragung.',
  'shifts.noCrewAvailable': 'Keine verfügbare Crew für diese Schicht und Position.',
  'shifts.levelWarningTitle': 'Empfohlenes Level: {min}★',
  'shifts.levelWarningBadge': 'Level {level} < min. {min}',
  'shifts.panelHeaderFull': 'Zugewiesen: {day} {type} — {position} ({filled}/{capacity})',
  'shifts.panelHeaderAvailable': 'Verfügbare Crew: {day} {type} — {position} ({filled}/{capacity})',
  'shifts.pageHeading': 'Schichtplan — {event}',
  'shifts.pdfShiftPlan': 'PDF Schichtplan',
  'shifts.pdfChecklist': 'PDF Checkliste',
  'shifts.view.cards': 'Karten',
  'shifts.searchPlaceholder': 'Schicht suchen…',
  'shifts.searchAriaLabel': 'Schicht filtern',
  'shifts.dateFilterAriaLabel': 'Tag filtern',
  'shifts.dateFilterAll': 'Tag: Alle',
  'shifts.typeFilterAriaLabel': 'Typ filtern',
  'shifts.typeFilterAll': 'Typ: Alle',
  'shifts.positionFilterAriaLabel': 'Position filtern',
  'shifts.positionFilterAll': 'Position: Alle',
  'shifts.fillFilterAriaLabel': 'Besetzung filtern',
  'shifts.fillFilterAll': 'Besetzung: Alle',
  'shifts.fillOpen': 'Offen',
  'shifts.fillFull': 'Voll besetzt',
  'shifts.crewFilterPlaceholder': 'Crew-Name…',
  'shifts.crewFilterAriaLabel': 'Crew-Name filtern',
  'shifts.filterCountTemplate': '{visible} von {total} Schichten',
  'shifts.emptyState': 'Keine Schichten gefunden — Filter anpassen.',
  'shifts.selectedSuffix': 'ausgewählt',
  'shifts.printSelected': 'Ausgewählte drucken',
  'shifts.selectAllAriaLabel': 'Alle auswählen',
  'shifts.selectRowAriaLabel': '{day} {type} auswählen',
  'shifts.openInCards': 'In Karten öffnen',
  'shifts.total': 'Gesamt',

  // settings — Einstellungen: Branding, Schichten, Positionen (views/settings.ts)
  'settings.pageTitle': 'Einstellungen',
  'settings.backToShifts': 'Zurück zur Schicht-Übersicht',
  'settings.branding.title': 'Branding',
  'settings.branding.eventName': 'Name der Veranstaltung',
  'settings.branding.orgName': 'Organisation',
  'settings.branding.contactEmail': 'Kontakt-E-Mail',
  'settings.branding.language': 'Sprache (Standard)',
  'settings.branding.languageHint': '(öffentliche Seiten & PDFs, bis jemand ?lang= wählt)',
  'settings.branding.german': 'Deutsch',
  'settings.branding.english': 'English',
  'settings.branding.hint': 'Erscheint im Seitentitel, in der Navigation, im Bewerbungsformular und auf den PDF-Exporten. Die Kontakt-E-Mail wird bei doppelten Bewerbungen angezeigt.',
  'settings.shifts.title': 'Schichten verwalten',
  'settings.col.day': 'Tag',
  'settings.col.time': 'Zeit',
  'settings.col.capacities': 'Kapazitäten',
  'settings.newShift': '+ Neue Schicht',
  'settings.positions.title': 'Positionen verwalten',
  'settings.col.minLevel': 'Min. Level',
  'settings.col.defaultCapacity': 'Std. Kapazität',
  'settings.newPosition': '+ Neue Position',
  'settings.color.green': 'Grün',
  'settings.color.purple': 'Lila',
  'settings.shiftForm.titleEdit': 'Schicht bearbeiten',
  'settings.shiftForm.titleNew': 'Neue Schicht',
  'settings.shiftForm.date': 'Datum',
  'settings.shiftForm.dateHint': 'Der Wochentag wird automatisch aus dem Datum abgeleitet.',
  'settings.shiftForm.startTime': 'Startzeit',
  'settings.shiftForm.endTime': 'Endzeit',
  'settings.shiftForm.sortOrder': 'Sortierung',
  'settings.shiftForm.color': 'Farbe',
  'settings.shiftForm.capacitiesLegend': 'Kapazitäten pro Position',
  'settings.shiftDelete.title': 'Schicht löschen',
  'settings.shiftDelete.shiftLabel': 'Schicht:',
  'settings.shiftDelete.hasAssignments': 'Diese Schicht hat {count} Zuweisung(en). Betroffene Crew:',
  'settings.shiftDelete.willBeDeleted': 'Alle Zuweisungen werden unwiderruflich gelöscht.',
  'settings.shiftDelete.noAssignments': 'Keine Zuweisungen betroffen.',
  'settings.deletePermanently': 'Endgültig löschen',
  'settings.positionForm.titleEdit': 'Position bearbeiten',
  'settings.positionForm.titleNew': 'Neue Position',
  'settings.positionForm.name': 'Name (intern)',
  'settings.positionForm.namePlaceholder': 'z.B. bar_front',
  'settings.positionForm.label': 'Label (Anzeige)',
  'settings.positionForm.labelPlaceholder': 'z.B. Bar Front',
  'settings.positionDelete.title': 'Position löschen',
  'settings.positionDelete.positionLabel': 'Position:',
  'settings.positionDelete.warning': 'Betroffen: {assignmentCount} Zuweisung(en) in {shiftCount} Schicht(en). Alles wird unwiderruflich gelöscht.',

  // adminImport — CSV-Import-Admin (views/admin-import.ts)
  'adminImport.pageTitle': 'CSV Import',
  'adminImport.intro': 'Lade hier die Google Forms CSV-Datei hoch (Spalten mit bilingualen Headern). Nach dem Upload siehst du eine Vorschau der erkannten Felder, bevor der Import startet. Maximale Dateigröße: 5 MB.',
  'adminImport.howto.summary': 'Woher kommt die CSV? — Anleitung & Beispieldatei',
  'adminImport.howto.introLabel': 'So exportierst du die Bewerbungen aus Google Forms:',
  'adminImport.howto.step1': 'Google Forms öffnen → Tab Antworten',
  'adminImport.howto.step2': 'Oben rechts auf das Google-Sheets-Symbol klicken (Tabelle erstellen)',
  'adminImport.howto.step3': 'In Google Sheets: Datei → Herunterladen → Kommagetrennte Werte (.csv)',
  'adminImport.howto.step4': 'Die heruntergeladene .csv-Datei hier hochladen',
  'adminImport.howto.whatLabel': 'Was wird importiert?',
  'adminImport.howto.item1': 'Name, E-Mail, Telefon',
  'adminImport.howto.item2': 'Bar-Erfahrung (wird automatisch in Level 1–5 umgewandelt)',
  'adminImport.howto.item3': 'Frühere Zusammenarbeit, Ansprechperson, Wunschbereich',
  'adminImport.howto.item4': 'Gruppe, Nationalität',
  'adminImport.howto.item5': 'Freitext über sich & Anhang-URL',
  'adminImport.howto.item6': 'Admin-Notiz (Spalte INFO — nur beim ersten Import)',
  'adminImport.howto.note': 'Bereits vorhandene Einträge (gleiche E-Mail) werden aktualisiert, nicht doppelt angelegt.',
  'adminImport.downloadSample': 'Beispiel-CSV herunterladen',
  'adminImport.downloadSampleHint': 'Die Beispieldatei zeigt das erwartete Format mit 2 Beispielzeilen.',
  'adminImport.fileLabel': 'CSV-Datei',
  'adminImport.error.noFile': 'Bitte wähle eine CSV-Datei aus.',
  'adminImport.error.parseError': 'Die CSV-Datei konnte nicht gelesen werden. Bitte prüfe, ob sie UTF-8-kodiert ist und Kommas als Trennzeichen verwendet.',
  'adminImport.error.zeroRows': 'Die CSV enthält keine Datenzeilen. Bitte prüfe die Datei auf gültige Header und mindestens eine Zeile.',
  'adminImport.error.fileTooLarge': 'Die Datei ist zu groß (Limit: 5 MB). Bitte lade eine kleinere CSV hoch.',
  'adminImport.error.missingRequired': 'In der CSV fehlt die Pflichtspalte E-Mail-Adresse. Der Import kann ohne diese Spalte nicht gestartet werden.',
  'adminImport.continueToPreview': 'Weiter zur Vorschau',
  'adminImport.report.title': 'Import-Ergebnis',
  'adminImport.report.inserted': 'Eingefügt',
  'adminImport.report.updated': 'Aktualisiert',
  'adminImport.report.skipped': 'Übersprungen',
  'adminImport.report.errors': 'Fehler',
  'adminImport.report.unknownExperiences': 'Unbekannte Erfahrungs-Werte ({count})',
  'adminImport.report.unknownExperiencesHint': 'Diese Freitext-Antworten konnten keinem Level zugeordnet werden und wurden auf Level 1 gesetzt. Admins können das Level in der Crew-Detail-Ansicht manuell korrigieren.',
  'adminImport.report.rowErrors': 'Zeilen-Fehler ({count})',
  'adminImport.report.rowLabel': 'Zeile {row}:',
  'adminImport.preview.pageTitle': 'CSV Import — Vorschau',
  'adminImport.preview.rowsDetectedSuffix': 'Datenzeilen erkannt,',
  'adminImport.preview.columnsMappedSuffix': 'Spalten gemappt,',
  'adminImport.preview.unknownColumnsSuffix': 'unbekannte Spalten (werden ignoriert).',
  'adminImport.preview.missingRequiredLabel': 'Fehlende Pflichtspalten:',
  'adminImport.preview.missingRequiredHint': 'Der Import kann ohne diese Spalten nicht gestartet werden. Bitte prüfe die CSV-Datei.',
  'adminImport.preview.colCsvHeader': 'CSV-Header',
  'adminImport.preview.colDbField': 'DB-Feld',
  'adminImport.preview.statusMapped': 'Gemappt',
  'adminImport.preview.statusUnknown': 'Unbekannt (ignoriert)',
  'adminImport.preview.confirmHintBefore': 'Prüfe die Zuordnung oben. Wenn alles stimmt, lade die gleiche CSV-Datei erneut hoch und klicke auf',
  'adminImport.preview.confirmButton': 'Import bestätigen',
  'adminImport.preview.reuploadLabel': 'CSV-Datei erneut hochladen',
  'adminImport.preview.backToUpload': 'Zurück zum Upload',

  // export — CSV-Header für den externen Registrierungs-Export (services/export.ts)
  'export.csv.email': 'E-Mail Adresse',
  'export.csv.note': 'Hinweis',
} as const

type Key = keyof typeof de

const en: Record<Key, string> = {
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.optional': '(optional)',
  'common.continue': 'Continue',
  'common.username': 'Username',
  'common.password': 'Password',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.back': 'Back',
  'common.rateLimited': 'Too many requests. Please try again later.',

  'apply.pageTitle': 'Crew Application',
  'apply.title': 'Crew Application',
  'apply.subtitle': 'Apply now for {event}.',
  'apply.section.contact': 'Contact',
  'apply.field.firstName': 'First name',
  'apply.field.lastName': 'Last name',
  'apply.field.email': 'Email',
  'apply.field.phone': 'Phone',
  'apply.field.nickname': 'Nickname',
  'apply.section.experience': 'Experience',
  'apply.field.experience': 'Bar experience',
  'apply.field.pleaseSelect': 'Please select',
  'apply.field.experienceDetails': 'How and where?',
  'apply.field.previousWork': 'Worked with us before?',
  'apply.field.previousWorkWhere': 'Where?',
  'apply.field.contactPerson': 'Contact person for guests?',
  'apply.section.preferredWork': 'Preferred work',
  'apply.field.preferredWork': 'Where would you like to work?',
  'apply.field.preferredWorkHint': '(Leave empty for no preference)',
  'apply.field.noPreference': 'No preference',
  'apply.preferredWork.barFront': 'At the bar front',
  'apply.preferredWork.logistics': 'In logistics',
  'apply.preferredWork.support': 'Supporting the bar (runner, dishwasher, etc.)',
  'apply.section.group': 'Group',
  'apply.field.groupSignup': "I'm signing up as a group",
  'apply.field.groupName': 'Group name',
  'apply.section.aboutYou': 'About you',
  'apply.field.nationality': 'Nationality',
  'apply.field.festivalCount': 'How many times have you attended this festival before?',
  'apply.field.festivalCountHint': '(number)',
  'apply.field.aboutText': 'About you',
  'apply.field.notes': 'Notes',
  'apply.field.image': 'Image',
  'apply.field.imageHint': '(optional, max 3 MB, JPEG/PNG/WebP)',
  'apply.submit': 'Apply now',
  'apply.error.requiredFields': 'Please fill in the required fields (first name, last name, email).',
  'apply.error.invalidEmail': 'Please enter a valid email address.',
  'apply.error.experienceRequired': 'Please select an experience level from the list.',
  'apply.error.duplicateEmail': 'This email is already registered. If you have questions, {contact}.',
  'apply.error.contactWithEmail': 'please contact {email}',
  'apply.error.contactFallback': 'please contact the organiser team',

  'apply.success.pageTitle': 'Application received',
  'apply.success.title': 'Thanks, {name}!',
  'apply.success.body': "Your application has been received. We'll be in touch once shift planning begins.",
  'apply.success.uploadWarning': 'Your image could not be saved — please email it to us as an attachment.',

  'login.pageTitle': 'Admin Login',
  'login.heading': 'Admin Console',
  'login.subheading': 'Sign in for admins',
  'login.usernamePlaceholder': 'Enter username',
  'login.passwordPlaceholder': 'Enter password',
  'login.submit': 'Sign in',
  'login.backToApply': 'Go to application',
  'login.error.invalidCredentials': 'Incorrect username or password.',
  'login.flash.accountCreated': 'Account created. Sign in.',

  'setup.pageTitle': 'Crewfest — Setup',
  'setup.heading': 'Create Admin Account',
  'setup.subheading': 'Create your admin account to get started.',
  'setup.usernamePlaceholder': 'Enter username',
  'setup.passwordPlaceholder': 'At least 12 characters',
  'setup.confirmPassword': 'Confirm password',
  'setup.confirmPasswordPlaceholder': 'Repeat password',
  'setup.submit': 'Create account',
  'setup.error.passwordMismatch': 'Passwords do not match.',
  'setup.error.usernameTaken': 'That username is already taken.',

  'crewLogin.pageTitle': 'Crew Area',
  'crewLogin.subheading': 'Enter the password to see the shift occupancy.',
  'crewLogin.passwordPlaceholder': 'Enter password',
  'crewLogin.error.wrongPassword': 'Wrong password.',

  'crewCapacity.title': 'Shift Occupancy',
  'crewCapacity.seatsFree': '{filled} / {total} spots free',

  'publicSchedule.pageTitle': 'Shift Schedule',
  'publicSchedule.title': 'Shift Schedule — {event}',
  'publicSchedule.subtitle': 'Public overview of the shift occupancy.',
  'publicSchedule.seatsFilled': 'spots filled',
  'publicSchedule.viewSwitcherLabel': 'Choose view',
  'publicSchedule.view.list': 'List',
  'publicSchedule.view.calendar': 'Calendar',
  'publicSchedule.view.timeline': 'Timeline',
  'publicSchedule.shiftCount': '{count} shifts',
  'publicSchedule.col.date': 'Date',
  'publicSchedule.col.weekday': 'Weekday',
  'publicSchedule.col.time': 'Time',
  'publicSchedule.col.type': 'Type',
  'publicSchedule.col.fill': 'Filled',
  'publicSchedule.col.positions': 'Positions',

  'pdf.col.date': 'Date',
  'pdf.col.weekday': 'Day',
  'pdf.col.time': 'Time',
  'pdf.col.type': 'Type',
  'pdf.col.number': '#',
  'pdf.col.name': 'Name',
  'pdf.col.position': 'Position',
  'pdf.col.checkin': 'Check-in',
  'pdf.col.checkout': 'Check-out',
  'pdf.shiftPlan.title': '{event} — Shift Schedule',
  'pdf.selection.title': '{event} — Shift Selection',
  'pdf.selection.openSlots': 'OPEN x {count}',
  'pdf.checklist.heading': 'Check-in / Check-out: {shift}',

  // common — Teil 2 (Admin) additions
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.duplicate': 'Duplicate',
  'common.create': 'Create',
  'common.name': 'Name',
  'common.level': 'Level',
  'common.status': 'Status',
  'common.action': 'Action',
  'common.actions': 'Actions',
  'common.position': 'Position',
  'common.warning': 'Warning',
  'common.starsAriaLabel': '{level} out of 5 stars',

  // nav
  'nav.crew': 'Crew',
  'nav.shifts': 'Shifts',
  'nav.import': 'Import',
  'nav.logout': 'Sign out',

  // admin
  'admin.error.positionFull': 'Position full — no further assignments possible.',
  'admin.error.alreadyAssignedOtherPosition': 'This person is already assigned to another position in this shift.',
  'admin.error.targetPositionMissing': 'Position does not exist in the target shift.',
  'admin.error.targetPositionFull': 'Position in the target shift is full.',
  'admin.error.alreadyInTargetShift': 'Crew is already assigned to the target shift.',
  'admin.error.pdfGenerationFailed': 'PDF could not be created. Please try again.',
  'admin.error.noShiftsSelected': 'No shifts selected.',
  'admin.error.noCrewAssigned': 'No crew assigned. Assign crew members to shifts first.',
  'admin.groupAssign.pageTitle': 'Assign group',
  'admin.groupAssign.backToList': 'Back to crew list',
  'admin.groupAssign.heading': 'Assign group "{group}"',
  'admin.groupAssign.shiftLabel': 'Shift',
  'admin.groupAssign.selectShiftPlaceholder': 'Select shift...',
  'admin.groupAssign.assignAll': 'Assign all',

  // dashboard
  'dashboard.exportCsv': 'Export CSV',
  'dashboard.searchPlaceholder': 'Search name…',
  'dashboard.searchAriaLabel': 'Filter by name',
  'dashboard.statusAriaLabel': 'Filter by status',
  'dashboard.statusAll': 'Status: All',
  'dashboard.shiftAvailAriaLabel': 'Filter by shift availability',
  'dashboard.shiftAvailPlaceholder': 'Available for shift',
  'dashboard.countAriaLabel': 'Filter by shift count',
  'dashboard.countAll': 'Shift count: All',
  'dashboard.count0': '0 shifts',
  'dashboard.count12': '1–2 shifts',
  'dashboard.count3': '3+ shifts',
  'dashboard.groupAriaLabel': 'Filter by group',
  'dashboard.allGroups': 'All groups',
  'dashboard.groupAssign': 'Assign group',
  'dashboard.colShifts': 'Shifts',
  'dashboard.filterCountTemplate': '{visible} of {total} people',
  'dashboard.emptyState': 'No entries found — adjust filters or import applications under Import.',

  // crewDetail
  'crewDetail.backToList': 'Crew list',
  'crewDetail.flash.personalSaved': 'Personal data saved.',
  'crewDetail.flash.emailTaken': 'This email address is already used by someone else.',
  'crewDetail.position.barFront': 'Bar Front',
  'crewDetail.position.barBack': 'Bar Back',
  'crewDetail.position.barFloat': 'Bar Float',
  'crewDetail.position.barPrep': 'Bar Prep',
  'crewDetail.position.cash': 'Cash',
  'crewDetail.position.security': 'Security',
  'crewDetail.position.tech': 'Tech',
  'crewDetail.position.other': 'Other',
  'crewDetail.label.availability': 'Availability',
  'crewDetail.label.preferredPositions': 'Preferred positions',
  'crewDetail.label.group': 'Group',
  'crewDetail.label.festivalCount': 'Festival participations',
  'crewDetail.label.source': 'Source',
  'crewDetail.label.appliedAt': 'Applied on',
  'crewDetail.label.experience': 'Experience',
  'crewDetail.label.adminNote': 'Admin note',
  'crewDetail.section.management': 'Management',
  'crewDetail.field.externalRegistration': 'Registered externally',
  'crewDetail.section.assignedShifts': 'Assigned shifts',
  'crewDetail.assignmentsCount': '{count} assignments',
  'crewDetail.noAssignments': 'No shifts assigned yet.',
  'crewDetail.movePlaceholder': 'Move...',
  'crewDetail.remove': 'Remove',
  'crewDetail.section.editPersonal': 'Edit personal data',
  'crewDetail.field.groupSignup': 'Group signup',
  'crewDetail.field.note': 'Note (from applicant)',
  'crewDetail.divider.googleForms': 'Google Forms fields',
  'crewDetail.field.experienceNone': '– not specified –',
  'crewDetail.field.experienceDetails': 'Experience details',
  'crewDetail.field.previousWork': 'Previous work with us',
  'crewDetail.field.contactPerson': 'Contact person',
  'crewDetail.field.preferredWork': 'Preferred work area',
  'crewDetail.savePersonal': 'Save personal data',
  'crewDetail.pageTitle': 'Crew — {name}',

  // shifts
  'shifts.levelTooLow': 'Level too low (min. {min}★)',
  'shifts.move': 'Move',
  'shifts.chipTitleSuggest': '{label} — min. level {min}★ — show suggestions',
  'shifts.chipTitleDefault': '{label} — min. level {min}★',
  'shifts.assignedCrew': 'Assigned crew',
  'shifts.suggestions': 'Suggestions',
  'shifts.allAvailableCrew': 'All available crew',
  'shifts.assign': 'Assign',
  'shifts.noCandidates': 'No candidates',
  'shifts.noCandidatesHint': 'No available crew members for this shift. All matching people already have 3 shifts or no availability entered.',
  'shifts.noCrewAvailable': 'No available crew for this shift and position.',
  'shifts.levelWarningTitle': 'Recommended level: {min}★',
  'shifts.levelWarningBadge': 'Level {level} < min. {min}',
  'shifts.panelHeaderFull': 'Assigned: {day} {type} — {position} ({filled}/{capacity})',
  'shifts.panelHeaderAvailable': 'Available crew: {day} {type} — {position} ({filled}/{capacity})',
  'shifts.pageHeading': 'Shift schedule — {event}',
  'shifts.pdfShiftPlan': 'PDF Shift Schedule',
  'shifts.pdfChecklist': 'PDF Checklist',
  'shifts.view.cards': 'Cards',
  'shifts.searchPlaceholder': 'Search shift…',
  'shifts.searchAriaLabel': 'Filter shift',
  'shifts.dateFilterAriaLabel': 'Filter day',
  'shifts.dateFilterAll': 'Day: All',
  'shifts.typeFilterAriaLabel': 'Filter type',
  'shifts.typeFilterAll': 'Type: All',
  'shifts.positionFilterAriaLabel': 'Filter position',
  'shifts.positionFilterAll': 'Position: All',
  'shifts.fillFilterAriaLabel': 'Filter occupancy',
  'shifts.fillFilterAll': 'Occupancy: All',
  'shifts.fillOpen': 'Open',
  'shifts.fillFull': 'Full',
  'shifts.crewFilterPlaceholder': 'Crew name…',
  'shifts.crewFilterAriaLabel': 'Filter crew name',
  'shifts.filterCountTemplate': '{visible} of {total} shifts',
  'shifts.emptyState': 'No shifts found — adjust filters.',
  'shifts.selectedSuffix': 'selected',
  'shifts.printSelected': 'Print selected',
  'shifts.selectAllAriaLabel': 'Select all',
  'shifts.selectRowAriaLabel': 'Select {day} {type}',
  'shifts.openInCards': 'Open in cards',
  'shifts.total': 'Total',

  // settings
  'settings.pageTitle': 'Settings',
  'settings.backToShifts': 'Back to shift overview',
  'settings.branding.title': 'Branding',
  'settings.branding.eventName': 'Event name',
  'settings.branding.orgName': 'Organisation',
  'settings.branding.contactEmail': 'Contact email',
  'settings.branding.language': 'Language (default)',
  'settings.branding.languageHint': '(public pages & PDFs, until someone picks ?lang=)',
  'settings.branding.german': 'German',
  'settings.branding.english': 'English',
  'settings.branding.hint': 'Appears in the page title, navigation, application form, and PDF exports. The contact email is shown for duplicate applications.',
  'settings.shifts.title': 'Manage shifts',
  'settings.col.day': 'Day',
  'settings.col.time': 'Time',
  'settings.col.capacities': 'Capacities',
  'settings.newShift': '+ New shift',
  'settings.positions.title': 'Manage positions',
  'settings.col.minLevel': 'Min. level',
  'settings.col.defaultCapacity': 'Default capacity',
  'settings.newPosition': '+ New position',
  'settings.color.green': 'Green',
  'settings.color.purple': 'Purple',
  'settings.shiftForm.titleEdit': 'Edit shift',
  'settings.shiftForm.titleNew': 'New shift',
  'settings.shiftForm.date': 'Date',
  'settings.shiftForm.dateHint': 'The weekday is derived automatically from the date.',
  'settings.shiftForm.startTime': 'Start time',
  'settings.shiftForm.endTime': 'End time',
  'settings.shiftForm.sortOrder': 'Sort order',
  'settings.shiftForm.color': 'Colour',
  'settings.shiftForm.capacitiesLegend': 'Capacities per position',
  'settings.shiftDelete.title': 'Delete shift',
  'settings.shiftDelete.shiftLabel': 'Shift:',
  'settings.shiftDelete.hasAssignments': 'This shift has {count} assignment(s). Affected crew:',
  'settings.shiftDelete.willBeDeleted': 'All assignments will be permanently deleted.',
  'settings.shiftDelete.noAssignments': 'No assignments affected.',
  'settings.deletePermanently': 'Delete permanently',
  'settings.positionForm.titleEdit': 'Edit position',
  'settings.positionForm.titleNew': 'New position',
  'settings.positionForm.name': 'Name (internal)',
  'settings.positionForm.namePlaceholder': 'e.g. bar_front',
  'settings.positionForm.label': 'Label (display)',
  'settings.positionForm.labelPlaceholder': 'e.g. Bar Front',
  'settings.positionDelete.title': 'Delete position',
  'settings.positionDelete.positionLabel': 'Position:',
  'settings.positionDelete.warning': 'Affected: {assignmentCount} assignment(s) in {shiftCount} shift(s). Everything will be permanently deleted.',

  // adminImport
  'adminImport.pageTitle': 'CSV Import',
  'adminImport.intro': "Upload the Google Forms CSV file here (columns with bilingual headers). After uploading you'll see a preview of the detected fields before the import starts. Maximum file size: 5 MB.",
  'adminImport.howto.summary': 'Where does the CSV come from? — Instructions & sample file',
  'adminImport.howto.introLabel': 'How to export the applications from Google Forms:',
  'adminImport.howto.step1': 'Open Google Forms → tab Responses',
  'adminImport.howto.step2': 'Click the Google Sheets icon top right (create spreadsheet)',
  'adminImport.howto.step3': 'In Google Sheets: File → Download → Comma-separated values (.csv)',
  'adminImport.howto.step4': 'Upload the downloaded .csv file here',
  'adminImport.howto.whatLabel': 'What gets imported?',
  'adminImport.howto.item1': 'Name, email, phone',
  'adminImport.howto.item2': 'Bar experience (automatically converted to level 1–5)',
  'adminImport.howto.item3': 'Previous collaboration, contact person, preferred area',
  'adminImport.howto.item4': 'Group, nationality',
  'adminImport.howto.item5': 'Free text about themselves & attachment URL',
  'adminImport.howto.item6': 'Admin note (column INFO — first import only)',
  'adminImport.howto.note': 'Existing entries (same email) are updated, not duplicated.',
  'adminImport.downloadSample': 'Download sample CSV',
  'adminImport.downloadSampleHint': 'The sample file shows the expected format with 2 example rows.',
  'adminImport.fileLabel': 'CSV file',
  'adminImport.error.noFile': 'Please select a CSV file.',
  'adminImport.error.parseError': 'The CSV file could not be read. Please check that it is UTF-8 encoded and uses commas as separators.',
  'adminImport.error.zeroRows': 'The CSV contains no data rows. Please check the file for valid headers and at least one row.',
  'adminImport.error.fileTooLarge': 'The file is too large (limit: 5 MB). Please upload a smaller CSV.',
  'adminImport.error.missingRequired': 'The CSV is missing the required column Email address. The import cannot start without this column.',
  'adminImport.continueToPreview': 'Continue to preview',
  'adminImport.report.title': 'Import result',
  'adminImport.report.inserted': 'Inserted',
  'adminImport.report.updated': 'Updated',
  'adminImport.report.skipped': 'Skipped',
  'adminImport.report.errors': 'Errors',
  'adminImport.report.unknownExperiences': 'Unknown experience values ({count})',
  'adminImport.report.unknownExperiencesHint': 'These free-text answers could not be matched to a level and were set to level 1. Admins can correct the level manually in the crew detail view.',
  'adminImport.report.rowErrors': 'Row errors ({count})',
  'adminImport.report.rowLabel': 'Row {row}:',
  'adminImport.preview.pageTitle': 'CSV Import — Preview',
  'adminImport.preview.rowsDetectedSuffix': 'data rows detected,',
  'adminImport.preview.columnsMappedSuffix': 'columns mapped,',
  'adminImport.preview.unknownColumnsSuffix': 'unknown columns (ignored).',
  'adminImport.preview.missingRequiredLabel': 'Missing required columns:',
  'adminImport.preview.missingRequiredHint': 'The import cannot start without these columns. Please check the CSV file.',
  'adminImport.preview.colCsvHeader': 'CSV header',
  'adminImport.preview.colDbField': 'DB field',
  'adminImport.preview.statusMapped': 'Mapped',
  'adminImport.preview.statusUnknown': 'Unknown (ignored)',
  'adminImport.preview.confirmHintBefore': 'Check the mapping above. If everything looks right, upload the same CSV file again and click',
  'adminImport.preview.confirmButton': 'Confirm import',
  'adminImport.preview.reuploadLabel': 'Re-upload CSV file',
  'adminImport.preview.backToUpload': 'Back to upload',

  // export
  'export.csv.email': 'Email address',
  'export.csv.note': 'Note',
}

const DICTS: Record<Lang, Record<Key, string>> = { de, en }

// Nur einmal pro (lang,key)-Kombination warnen, nicht pro Request.
const warnedMissingKeys = new Set<string>()

/**
 * Übersetzt `key` in `lang`, mit optionaler `{param}`-Interpolation.
 * Fehlt der Key in `lang` (kann bei inkonsistent gepflegten Wörterbüchern
 * passieren) → Fallback auf DE + einmalige console.warn. Fehlt der Key auch
 * dort, wird der rohe Key zurückgegeben (nie ein Crash).
 */
export function t(lang: Lang, key: Key, params?: Record<string, string | number>): string {
  let value: string | undefined = DICTS[lang]?.[key]
  if (value === undefined) {
    const warnKey = `${lang}:${key}`
    if (!warnedMissingKeys.has(warnKey)) {
      console.warn(`[i18n] missing key "${key}" for lang "${lang}" — falling back to de`)
      warnedMissingKeys.add(warnKey)
    }
    value = DICTS.de[key]
  }
  if (value === undefined) return key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.split(`{${k}}`).join(String(v))
    }
  }
  return value
}

// ─── Sprachauflösung ─────────────────────────────────────────────────────────

function isLang(value: string | undefined | null): value is Lang {
  return value === 'de' || value === 'en'
}

/**
 * Löst die aktive Sprache für einen Request auf.
 * Priorität: `?lang=de|en` (setzt zugleich Cookie `lang`, 1 Jahr) → Cookie `lang`
 * → Instanz-Setting `default_language` (branding, Fallback 'de') → 'de'.
 */
export function resolveLang(c: Context): Lang {
  const queryLang = c.req.query('lang')
  if (isLang(queryLang)) {
    setCookie(c, 'lang', queryLang, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 Jahr
      sameSite: 'Lax',
      secure: config.cookieSecure,
    })
    return queryLang
  }

  const cookieLang = getCookie(c, 'lang')
  if (isLang(cookieLang)) return cookieLang

  return getBranding().default_language
}

/**
 * Sprache ohne Request-Kontext (z.B. PDF-Generierung, die serverseitig ohne
 * Browser-Anfrage läuft). Nutzt ausschließlich das Instanz-Setting.
 */
export function getDefaultLang(): Lang {
  return getBranding().default_language
}

/**
 * JSON.stringify() output embedded inside an inline `<script>` tag (e.g.
 * `window.I18N = ${...}`) can be broken out of by a literal `</script>`
 * substring inside a string value — the HTML parser closes the script element
 * there regardless of JS string-escaping, since it doesn't parse JS. Escaping
 * `<` as `<` neutralizes that (valid inside a JS string, parses to the
 * same value) without changing anything else about the JSON. Use this instead
 * of a bare JSON.stringify() for any value interpolated into an inline
 * `<script>` block. See views/shifts.ts / views/dashboard.ts.
 */
export function jsonScriptEscape(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

/**
 * Dezenter DE/EN-Sprachumschalter für den Footer öffentlicher Seiten.
 * Relative `?lang=`-Links — wirken auf den aktuellen Pfad, kein Context nötig.
 */
export function langSwitcherHtml(lang: Lang): HtmlEscapedString {
  const activeClass = 'font-semibold text-on-surface'
  const inactiveClass = 'text-on-surface-variant hover:text-primary transition-colors'
  return html`<a href="?lang=de" class="${lang === 'de' ? activeClass : inactiveClass}">DE</a><span class="mx-1 text-on-surface-variant">/</span><a href="?lang=en" class="${lang === 'en' ? activeClass : inactiveClass}">EN</a>` as HtmlEscapedString
}
