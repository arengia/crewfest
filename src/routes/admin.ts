import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { html, raw } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { parse } from 'csv-parse/sync'
import { requireAuth, type AuthEnv } from '../middleware/auth.js'
import { crewTablePage } from '../views/dashboard.js'
import { crewDetailPage } from '../views/crew-detail.js'
import { shiftsPage } from '../views/shifts.js'
import { layout } from '../views/layout.js'
import { importPage, importPreviewPage } from '../views/admin-import.js'
import { importCsvRecords, buildHeaderMap, findMissingRequiredFields } from '../services/import.js'
import { generatePdf } from '../services/pdf.js'
import { shiftPlanHtml, type ShiftPlanData } from '../views/pdf-shift-plan.js'
import { checklistHtml, type ChecklistShift } from '../views/pdf-checklist.js'
import { selectionHtml, type SelectionShift } from '../views/pdf-selection.js'
import {
  getAllCrew, getCrewById, updateCrewAdmin, updateCrewPersonal, getCrewAssignments, getShiftsWithCapacity, getDistinctGroups,
  type CrewPersonalUpdate
} from '../services/crew.js'
import {
  getShiftsWithPositionFill, getAvailableCrewForSlot,
  assignCrewToShift, unassignCrew, getAssignedCrewForSlot,
  effectiveLevel,
  type AvailableCrewRow, type AssignedCrewRow
} from '../services/shifts.js'
import { getDb } from '../db/connection.js'
import {
  getAllShiftsWithPositions, getShiftForEdit, createShift, updateShift,
  duplicateShift, deleteShift, getShiftDeleteWarning,
  getAllPositions, getPositionById, createPosition, updatePosition,
  deletePosition, getPositionDeleteWarning,
  type ShiftInput, type PositionInput
} from '../services/settings.js'
import {
  settingsPage, shiftFormPage, shiftDeletePage,
  positionFormPage, positionDeletePage
} from '../views/settings.js'
import { generateExternalRegistrationCsv } from '../services/export.js'
import { getSuggestedCrew, type SuggestedCrewRow } from '../services/suggest.js'
import { readPhoto, photoMimeType } from '../services/uploads.js'
import { getBranding, updateBranding } from '../domain/branding.js'
import { shiftTypeLabel, CREW_STATUSES, type CrewStatus } from '../domain/labels.js'
import { t, resolveLang } from '../i18n.js'
import { weekdayName } from '../domain/dates.js'

// Phase 6: 5 MB cap on CSV upload — defensive hygiene (06-RESEARCH.md §Security Domain)
const MAX_CSV_UPLOAD_BYTES = 5 * 1024 * 1024

// Outer guard on the whole multipart body, checked before parseBody() reads it —
// headroom above MAX_CSV_UPLOAD_BYTES for multipart overhead, but still bounded.
const MAX_CSV_BODY_BYTES = 10 * 1024 * 1024

export const adminRoutes = new Hono<AuthEnv>()

// Apply auth middleware to all admin routes
adminRoutes.use('/*', requireAuth)

// GET / - Crew table (mounted at /admin)
adminRoutes.get('/', (c) => {
  const lang = resolveLang(c)
  const crew = getAllCrew()
  const shifts = getShiftsWithCapacity()
  const groups = getDistinctGroups()
  return c.html(crewTablePage(crew, shifts, groups, lang))
})

// GET /admin/crew/:id — crew detail page
adminRoutes.get('/crew/:id', (c) => {
  const lang = resolveLang(c)
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.notFound()
  const crew = getCrewById(id)
  if (!crew) return c.notFound()
  const assignments = getCrewAssignments(id)

  // Build availability text from crew_availability.
  // getShiftsWithCapacity() returns all shifts; filter by which ids are in crew.available_shift_ids.
  const allShifts = getShiftsWithCapacity()
  const availableIds = crew.available_shift_ids
    ? crew.available_shift_ids.split(',').map(Number)
    : []
  const availabilityText = allShifts
    .filter(s => availableIds.includes(s.id))
    .map(s => `${weekdayName(s.date, lang)} ${shiftTypeLabel(lang, s.type)}`)
    .join(', ') || '—'

  // Build shift list for Verschieben dropdown (D-15)
  const allShiftsForDropdown = allShifts.map(s => ({ id: s.id, date: s.date, type: s.type }))

  const saved = c.req.query('saved') ?? null
  const error = c.req.query('error') ?? null

  return c.html(crewDetailPage(crew, assignments, availabilityText, allShiftsForDropdown, saved, error, lang))
})

// GET /admin/crew/:id/photo — serve the applicant photo (admin-auth only, not public)
adminRoutes.get('/crew/:id/photo', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.notFound()
  const crew = getCrewById(id)
  if (!crew || !crew.photo_filename) return c.notFound()
  const mime = photoMimeType(crew.photo_filename)
  const buf = mime ? await readPhoto(crew.photo_filename) : null
  if (!buf || !mime) return c.notFound()
  return new Response(new Uint8Array(buf), {
    headers: { 'Content-Type': mime, 'Cache-Control': 'private, no-store' },
  })
})

// POST /admin/crew/:id — save admin_level, status, admin_note (PRG pattern)
adminRoutes.post('/crew/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.notFound()
  const crew = getCrewById(id)
  if (!crew) return c.notFound()

  const body = await c.req.parseBody()
  // admin_level is the single level column (1-5). Keep the existing value on invalid input.
  const parsedLevel = parseInt(body['admin_level'] as string, 10)
  const admin_level = (!isNaN(parsedLevel) && parsedLevel >= 1 && parsedLevel <= 5) ? parsedLevel : crew.admin_level

  const statusRaw = body['status'] as string
  if (!CREW_STATUSES.includes(statusRaw as CrewStatus)) return c.notFound()
  const status: CrewStatus = statusRaw as CrewStatus

  const admin_note = (body['admin_note'] as string)?.trim() || null
  const nickname = (body['nickname'] as string)?.trim() || null
  const external_registration = body['external_registration'] === 'on' || body['external_registration'] === '1'

  updateCrewAdmin(id, { admin_level, status, admin_note, nickname, external_registration })
  return c.redirect(`/admin/crew/${id}`)
})

// POST /admin/crew/:id/personal — save personal crew fields (PRG pattern)
adminRoutes.post('/crew/:id/personal', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.notFound()
  const crew = getCrewById(id)
  if (!crew) return c.notFound()

  const body = await c.req.parseBody()

  // Parse preferred_positions — sent as repeated checkbox values or JSON string
  const rawPositions = body['preferred_positions']
  let preferred_positions: string[]
  if (Array.isArray(rawPositions)) {
    preferred_positions = rawPositions as string[]
  } else if (typeof rawPositions === 'string' && rawPositions.startsWith('[')) {
    try { preferred_positions = JSON.parse(rawPositions) } catch { preferred_positions = [] }
  } else if (typeof rawPositions === 'string' && rawPositions) {
    preferred_positions = [rawPositions]
  } else {
    preferred_positions = []
  }

  const data: CrewPersonalUpdate = {
    first_name: (body['first_name'] as string)?.trim() || crew.first_name,
    last_name: (body['last_name'] as string)?.trim() || crew.last_name,
    email: (body['email'] as string)?.trim().toLowerCase() || crew.email,
    phone: (body['phone'] as string)?.trim() || null,
    preferred_positions,
    group_signup: body['group_signup'] === 'on' || body['group_signup'] === '1',
    group_name: (body['group_name'] as string)?.trim() || null,
    festival_count: body['festival_count'] ? (parseInt(body['festival_count'] as string, 10) || null) : null,
    note: (body['note'] as string)?.trim() || null,
    experience_text: (body['experience_text'] as string)?.trim() || null,
    experience_details: (body['experience_details'] as string)?.trim() || null,
    previous_work: (body['previous_work'] as string)?.trim() || null,
    contact_person: body['contact_person'] === 'on' || body['contact_person'] === '1',
    preferred_work: (body['preferred_work'] as string)?.trim() || null,
    nationality: (body['nationality'] as string)?.trim() || null,
    about_text: (body['about_text'] as string)?.trim() || null,
  }

  try {
    updateCrewPersonal(id, data)
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'email_taken') {
      return c.redirect(`/admin/crew/${id}?error=email_taken`)
    }
    throw err
  }

  return c.redirect(`/admin/crew/${id}?saved=personal`)
})

// GET /admin/export/csv — external registration CSV export (DATA-03)
adminRoutes.get('/export/csv', (c) => {
  const csv = generateExternalRegistrationCsv()
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="crewfest-export.csv"',
    },
  })
})

// ─── PDF export routes ─────────────────────────────────────────────────────

// GET /admin/export/pdf-shifts — Übersichts-PDF: Schichten in Zeilen, Positionen in Spalten (DATA-04, #397 Phase 3)
adminRoutes.get('/export/pdf-shifts', async (c) => {
  const lang = resolveLang(c)
  const rows = getShiftsWithPositionFill()

  // (a) Eindeutige Positions-Spalten (position_label), gefiltert auf capacity>0 irgendwo,
  //     in Query-Reihenfolge (= sortiert nach position sort_order).
  const positionLabels: string[] = []
  const positionLabelByName = new Map<string, string>() // position_name -> label
  for (const r of rows) {
    if (r.capacity > 0 && !positionLabelByName.has(r.position_name)) {
      positionLabelByName.set(r.position_name, r.position_label)
      positionLabels.push(r.position_label)
    }
  }
  const positionNames = Array.from(positionLabelByName.keys())

  // (b) Je eindeutiger Schicht (shift_id) eine row mit Schicht-Infos + cells je Spalte.
  const shiftMap = new Map<number, typeof rows>()
  for (const r of rows) {
    if (!shiftMap.has(r.shift_id)) shiftMap.set(r.shift_id, [])
    shiftMap.get(r.shift_id)!.push(r)
  }

  const data: ShiftPlanData = {
    positions: positionLabels,
    // Eine Zeile je Schicht, chronologisch sortiert (Datum -> Startzeit), nicht nach sort_order (#397).
    rows: Array.from(shiftMap.values())
      .sort((a, b) => a[0].date.localeCompare(b[0].date) || a[0].start_time.localeCompare(b[0].start_time))
      .map(positions => {
      const shift = positions[0]
      const cells = positionNames.map(posName => {
        const match = positions.find(p => p.position_name === posName)
        return match
          ? { filled: match.filled, capacity: match.capacity }
          : { filled: 0, capacity: 0 }
      })
      return {
        date: shift.date,
        type: shift.type,
        start_time: shift.start_time,
        end_time: shift.end_time,
        cells,
      }
    }),
  }

  // Auto-Orientierung: viele Positions-Spalten passen nur im Querformat lesbar (#397 Phase 3, Teil C).
  const landscape = positionLabels.length > 5

  try {
    const htmlStr = shiftPlanHtml(data, getBranding().event_name)
    const pdf = await generatePdf(htmlStr, { landscape })
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="crewfest-schichtplan.pdf"',
      },
    })
  } catch (err) {
    console.error('PDF generation failed:', err)
    return c.text(t(lang, 'admin.error.pdfGenerationFailed'), 500)
  }
})

// POST /admin/export/pdf-selection — kompaktes Listen-PDF der ausgewählten Schichten (#397 Phase 3, Teil B)
adminRoutes.post('/export/pdf-selection', async (c) => {
  const lang = resolveLang(c)
  const body = await c.req.parseBody({ all: true })
  const rawIds = Array.isArray(body['shift_ids']) ? body['shift_ids'] : [body['shift_ids']]
  const selectedIds = new Set(
    rawIds
      .map(v => Number(v))
      .filter(n => !Number.isNaN(n))
  )

  if (selectedIds.size === 0) {
    return c.text(t(lang, 'admin.error.noShiftsSelected'), 400)
  }

  const rows = getShiftsWithPositionFill()

  // Gruppieren nach shift_id, Reihenfolge nach sort_order (= Query-Reihenfolge).
  const shiftMap = new Map<number, typeof rows>()
  for (const r of rows) {
    if (!shiftMap.has(r.shift_id)) shiftMap.set(r.shift_id, [])
    shiftMap.get(r.shift_id)!.push(r)
  }

  const shifts: SelectionShift[] = []
  for (const [shiftId, positions] of shiftMap) {
    if (!selectedIds.has(shiftId)) continue
    const shift = positions[0]
    shifts.push({
      date: shift.date,
      type: shift.type,
      start_time: shift.start_time,
      end_time: shift.end_time,
      positions: positions
        .filter(pos => pos.capacity > 0)
        .map(pos => {
          const assigned = getAssignedCrewForSlot(pos.shift_id, pos.position_id)
          return {
            label: pos.position_label,
            crew: assigned.map(a => `${a.first_name} ${a.last_name[0]}.`),
            open: Math.max(0, pos.capacity - pos.filled),
          }
        }),
    })
  }

  if (shifts.length === 0) {
    return c.text(t(lang, 'admin.error.noShiftsSelected'), 400)
  }

  try {
    const htmlStr = selectionHtml(shifts, getBranding().event_name)
    const pdf = await generatePdf(htmlStr)
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="crewfest-auswahl.pdf"',
      },
    })
  } catch (err) {
    console.error('PDF generation failed:', err)
    return c.text(t(lang, 'admin.error.pdfGenerationFailed'), 500)
  }
})

// GET /admin/export/pdf-checklist — PDF check-in/check-out checklists (DATA-05)
adminRoutes.get('/export/pdf-checklist', async (c) => {
  const lang = resolveLang(c)
  const rows = getShiftsWithPositionFill()

  // Group rows by shift_id to get unique shifts
  const shiftMap = new Map<number, typeof rows>()
  for (const r of rows) {
    if (!shiftMap.has(r.shift_id)) shiftMap.set(r.shift_id, [])
    shiftMap.get(r.shift_id)!.push(r)
  }

  // Build checklist data: one ChecklistShift per shift, only shifts with assignments
  const shifts: ChecklistShift[] = []
  for (const [shiftId, positions] of shiftMap) {
    const shift = positions[0]
    const crew: ChecklistShift['crew'] = []

    for (const pos of positions) {
      const assigned = getAssignedCrewForSlot(shiftId, pos.position_id)
      for (const a of assigned) {
        crew.push({
          first_name: a.first_name,
          last_name: a.last_name,
          position_label: pos.position_label,
        })
      }
    }

    // Sort by position_label per D-13
    crew.sort((a, b) => a.position_label.localeCompare(b.position_label))

    // Only include shifts with at least one assigned crew member
    if (crew.length > 0) {
      shifts.push({
        date: shift.date,
        type: shift.type,
        start_time: shift.start_time,
        end_time: shift.end_time,
        crew,
      })
    }
  }

  if (shifts.length === 0) {
    return c.text(t(lang, 'admin.error.noCrewAssigned'), 400)
  }

  try {
    const htmlStr = checklistHtml(shifts)
    const pdf = await generatePdf(htmlStr)
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="crewfest-checkliste.pdf"',
      },
    })
  } catch (err) {
    console.error('PDF generation failed:', err)
    return c.text(t(lang, 'admin.error.pdfGenerationFailed'), 500)
  }
})

// ─── Settings routes (sub-page of shifts per D-07) ──────────────────────────

// GET /admin/shifts/settings — main settings page
adminRoutes.get('/shifts/settings', (c) => {
  const lang = resolveLang(c)
  const shifts = getAllShiftsWithPositions()
  const positions = getAllPositions()
  const branding = getBranding()
  return c.html(settingsPage(shifts, positions, branding, lang))
})

// POST /admin/shifts/settings/branding — save instance branding
adminRoutes.post('/shifts/settings/branding', async (c) => {
  const body = await c.req.parseBody()
  const defaultLanguageRaw = body['default_language'] as string
  updateBranding({
    event_name: (body['event_name'] as string) ?? '',
    org_name: (body['org_name'] as string)?.trim() || null,
    contact_email: (body['contact_email'] as string)?.trim() || null,
    default_language: defaultLanguageRaw === 'en' ? 'en' : 'de',
  })
  return c.redirect('/admin/shifts/settings')
})

// GET /admin/shifts/settings/new — new shift form
adminRoutes.get('/shifts/settings/new', (c) => {
  const lang = resolveLang(c)
  const positions = getAllPositions()
  return c.html(shiftFormPage(positions, undefined, undefined, lang))
})

// POST /admin/shifts/settings/new — create shift
adminRoutes.post('/shifts/settings/new', async (c) => {
  const body = await c.req.parseBody()
  const positions = getAllPositions()
  const capacities: Record<number, number> = {}
  for (const p of positions) {
    const val = parseInt(body[`cap_${p.id}`] as string, 10)
    if (!isNaN(val) && val > 0) capacities[p.id] = val
  }
  const data: ShiftInput = {
    date: body['date'] as string,
    type: body['type'] as 'day' | 'night',
    start_time: body['start_time'] as string,
    end_time: body['end_time'] as string,
    sort_order: parseInt(body['sort_order'] as string, 10) || 0,
    color: (body['color'] as string) || '#6366f1',
    capacities,
  }
  createShift(data)
  return c.redirect('/admin/shifts/settings')
})

// GET /admin/shifts/settings/:id/edit — edit shift form
adminRoutes.get('/shifts/settings/:id/edit', (c) => {
  const lang = resolveLang(c)
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.notFound()
  const shift = getShiftForEdit(id)
  if (!shift) return c.notFound()
  const positions = getAllPositions()
  return c.html(shiftFormPage(positions, shift, undefined, lang))
})

// POST /admin/shifts/settings/:id/edit — update shift
adminRoutes.post('/shifts/settings/:id/edit', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.notFound()
  const body = await c.req.parseBody()
  const positions = getAllPositions()
  const capacities: Record<number, number> = {}
  for (const p of positions) {
    const val = parseInt(body[`cap_${p.id}`] as string, 10)
    if (!isNaN(val) && val > 0) capacities[p.id] = val
  }
  const data: ShiftInput = {
    date: body['date'] as string,
    type: body['type'] as 'day' | 'night',
    start_time: body['start_time'] as string,
    end_time: body['end_time'] as string,
    sort_order: parseInt(body['sort_order'] as string, 10) || 0,
    color: (body['color'] as string) || '#6366f1',
    capacities,
  }
  updateShift(id, data)
  return c.redirect('/admin/shifts/settings')
})

// POST /admin/shifts/settings/:id/duplicate — duplicate shift
adminRoutes.post('/shifts/settings/:id/duplicate', (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.notFound()
  const newId = duplicateShift(id)
  return c.redirect(`/admin/shifts/settings/${newId}/edit`)
})

// GET /admin/shifts/settings/:id/delete — delete confirmation page
adminRoutes.get('/shifts/settings/:id/delete', (c) => {
  const lang = resolveLang(c)
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.notFound()
  const shift = getShiftForEdit(id)
  if (!shift) return c.notFound()
  const warning = getShiftDeleteWarning(id)
  return c.html(shiftDeletePage(shift, warning, lang))
})

// POST /admin/shifts/settings/:id/delete — execute shift deletion
adminRoutes.post('/shifts/settings/:id/delete', (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.notFound()
  deleteShift(id)
  return c.redirect('/admin/shifts/settings')
})

// ─── Position CRUD routes ────────────────────────────────────────────────────

adminRoutes.get('/shifts/settings/positions/new', (c) => {
  const lang = resolveLang(c)
  return c.html(positionFormPage(undefined, undefined, lang))
})

adminRoutes.post('/shifts/settings/positions/new', async (c) => {
  const body = await c.req.parseBody()
  const data: PositionInput = {
    name: (body['name'] as string).trim(),
    label: (body['label'] as string).trim(),
    min_level: parseInt(body['min_level'] as string, 10) || 1,
    default_capacity: parseInt(body['default_capacity'] as string, 10) || 1,
    sort_order: parseInt(body['sort_order'] as string, 10) || 0,
  }
  createPosition(data)
  return c.redirect('/admin/shifts/settings')
})

adminRoutes.get('/shifts/settings/positions/:id/edit', (c) => {
  const lang = resolveLang(c)
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.notFound()
  const position = getPositionById(id)
  if (!position) return c.notFound()
  return c.html(positionFormPage(position, undefined, lang))
})

adminRoutes.post('/shifts/settings/positions/:id/edit', async (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.notFound()
  const body = await c.req.parseBody()
  const data: PositionInput = {
    name: (body['name'] as string).trim(),
    label: (body['label'] as string).trim(),
    min_level: parseInt(body['min_level'] as string, 10) || 1,
    default_capacity: parseInt(body['default_capacity'] as string, 10) || 1,
    sort_order: parseInt(body['sort_order'] as string, 10) || 0,
  }
  updatePosition(id, data)
  return c.redirect('/admin/shifts/settings')
})

adminRoutes.get('/shifts/settings/positions/:id/delete', (c) => {
  const lang = resolveLang(c)
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.notFound()
  const position = getPositionById(id)
  if (!position) return c.notFound()
  const warning = getPositionDeleteWarning(id)
  return c.html(positionDeletePage(position, warning, lang))
})

adminRoutes.post('/shifts/settings/positions/:id/delete', (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (isNaN(id)) return c.notFound()
  deletePosition(id)
  return c.redirect('/admin/shifts/settings')
})

// GET /admin/shifts — shifts overview with pre-populated sub-panels
adminRoutes.get('/shifts', (c) => {
  const lang = resolveLang(c)
  const rows = getShiftsWithPositionFill()

  // Build slotPanels map: key "{shift_id}-{pos_id}" -> available crew
  const slotPanels = new Map<string, AvailableCrewRow[]>()
  for (const row of rows) {
    const key = `${row.shift_id}-${row.position_id}`
    if (!slotPanels.has(key)) {
      slotPanels.set(key, getAvailableCrewForSlot(row.shift_id, row.position_id))
    }
  }

  // Build assignedPanels map: key "{shift_id}-{pos_id}" -> assigned crew (D-03, D-14)
  const assignedPanels = new Map<string, AssignedCrewRow[]>()
  for (const row of rows) {
    const key = `${row.shift_id}-${row.position_id}`
    if (!assignedPanels.has(key)) {
      assignedPanels.set(key, getAssignedCrewForSlot(row.shift_id, row.position_id))
    }
  }

  const openParam = c.req.query('open') ?? null

  // Build unique shift list for Verschieben dropdown (D-15)
  const allShifts = rows.filter((r, i, arr) => arr.findIndex(x => x.shift_id === r.shift_id) === i)
    .map(r => ({ id: r.shift_id, date: r.date, type: r.type }))

  // Build suggest panels for unfilled slots (SHIFT-05)
  const suggestPanels = new Map<string, SuggestedCrewRow[]>()
  for (const r of rows) {
    if (r.filled < r.capacity) {
      const key = `${r.shift_id}-${r.position_id}`
      const suggestions = getSuggestedCrew(r.shift_id, r.position_id)
      suggestPanels.set(key, suggestions)
    }
  }

  return c.html(shiftsPage(rows, slotPanels, undefined, assignedPanels, openParam, allShifts, suggestPanels, lang))
})

// POST /admin/shifts/:id/assign — assign crew to a shift position
adminRoutes.post('/shifts/:id/assign', async (c) => {
  const lang = resolveLang(c)
  const shiftId = parseInt(c.req.param('id'), 10)
  if (isNaN(shiftId)) return c.notFound()

  const body = await c.req.parseBody()
  const crewId = parseInt(body['crew_id'] as string, 10)
  const positionId = parseInt(body['position_id'] as string, 10)
  const adminId = c.get('adminId')

  if (isNaN(crewId) || isNaN(positionId)) return c.notFound()

  const result = assignCrewToShift(crewId, shiftId, positionId, adminId)

  if (result === 'ok') {
    return c.redirect(`/admin/shifts?open=${shiftId}-${positionId}`)
  }

  // Error case: re-render shifts page with error context (no redirect per RESEARCH.md Open Question 1)
  const rows = getShiftsWithPositionFill()
  const slotPanels = new Map<string, AvailableCrewRow[]>()
  for (const row of rows) {
    const key = `${row.shift_id}-${row.position_id}`
    if (!slotPanels.has(key)) {
      slotPanels.set(key, getAvailableCrewForSlot(row.shift_id, row.position_id))
    }
  }

  // Also build assignedPanels for error re-render (D-03, D-14)
  const assignedPanels = new Map<string, AssignedCrewRow[]>()
  for (const row of rows) {
    const key = `${row.shift_id}-${row.position_id}`
    if (!assignedPanels.has(key)) {
      assignedPanels.set(key, getAssignedCrewForSlot(row.shift_id, row.position_id))
    }
  }

  const errorMessage = result === 'full'
    ? t(lang, 'admin.error.positionFull')
    : t(lang, 'admin.error.alreadyAssignedOtherPosition')

  // Build allShifts for error re-render dropdown (D-15)
  const allShiftsErr = rows.filter((r, i, arr) => arr.findIndex(x => x.shift_id === r.shift_id) === i)
    .map(r => ({ id: r.shift_id, date: r.date, type: r.type }))

  // Build suggest panels for error re-render (SHIFT-05)
  const suggestPanelsErr = new Map<string, SuggestedCrewRow[]>()
  for (const r of rows) {
    if (r.filled < r.capacity) {
      const key = `${r.shift_id}-${r.position_id}`
      suggestPanelsErr.set(key, getSuggestedCrew(r.shift_id, r.position_id))
    }
  }

  return c.html(shiftsPage(rows, slotPanels, {
    shift_id: shiftId,
    position_id: positionId,
    message: errorMessage,
  }, assignedPanels, undefined, allShiftsErr, suggestPanelsErr, lang))
})

// POST /admin/assignments/:id/move — reassign crew to a different shift (D-15)
adminRoutes.post('/assignments/:id/move', async (c) => {
  const lang = resolveLang(c)
  const assignmentId = parseInt(c.req.param('id'), 10)
  if (isNaN(assignmentId)) return c.notFound()

  const body = await c.req.parseBody()
  const targetShiftId = parseInt(body['target_shift_id'] as string, 10)
  const redirectUrl = body['redirect'] as string
  if (isNaN(targetShiftId)) return c.notFound()

  const db = getDb()
  const existing = db.prepare('SELECT crew_id, shift_id, position_id FROM assignments WHERE id = ?').get(assignmentId) as {
    crew_id: number; shift_id: number; position_id: number
  } | undefined
  if (!existing) return c.redirect('/admin/shifts')

  const adminId = c.get('adminId')
  let error: string | null = null

  db.transaction(() => {
    // Check capacity on target
    const fill = db.prepare('SELECT COUNT(*) AS count FROM assignments WHERE shift_id = ? AND position_id = ?')
      .get(targetShiftId, existing.position_id) as { count: number }
    const cap = db.prepare('SELECT capacity FROM shift_positions WHERE shift_id = ? AND position_id = ?')
      .get(targetShiftId, existing.position_id) as { capacity: number } | undefined

    if (!cap) {
      error = t(lang, 'admin.error.targetPositionMissing')
      return
    }
    if (fill.count >= cap.capacity) {
      error = t(lang, 'admin.error.targetPositionFull')
      return
    }

    // Check not already assigned to target shift
    const dup = db.prepare('SELECT id FROM assignments WHERE crew_id = ? AND shift_id = ?')
      .get(existing.crew_id, targetShiftId) as { id: number } | undefined
    if (dup) {
      error = t(lang, 'admin.error.alreadyInTargetShift')
      return
    }

    db.prepare('DELETE FROM assignments WHERE id = ?').run(assignmentId)
    db.prepare('INSERT INTO assignments (crew_id, shift_id, position_id, assigned_by) VALUES (?, ?, ?, ?)')
      .run(existing.crew_id, targetShiftId, existing.position_id, adminId)
  })()

  if (error) {
    const base = redirectUrl?.startsWith('/admin/') ? redirectUrl : `/admin/crew/${existing.crew_id}`
    return c.redirect(`${base}?moveError=${encodeURIComponent(error)}`)
  }

  if (redirectUrl && redirectUrl.startsWith('/admin/')) {
    return c.redirect(redirectUrl)
  }
  return c.redirect(`/admin/crew/${existing.crew_id}`)
})

// POST /admin/assignments/:id/delete — unassign crew member (D-14: supports redirect field)
adminRoutes.post('/assignments/:id/delete', async (c) => {
  const assignmentId = parseInt(c.req.param('id'), 10)
  if (isNaN(assignmentId)) return c.notFound()

  // Read crew_id before deleting so we can redirect back to crew detail page
  const row = getDb().prepare('SELECT crew_id FROM assignments WHERE id = ?').get(assignmentId) as { crew_id: number } | undefined
  if (!row) return c.redirect('/admin')

  unassignCrew(assignmentId)

  // Support redirect field from shift sub-panel unassign forms (D-14)
  const body = await c.req.parseBody()
  const redirectUrl = body['redirect'] as string
  if (redirectUrl && redirectUrl.startsWith('/admin/')) {
    return c.redirect(redirectUrl)
  }
  return c.redirect(`/admin/crew/${row.crew_id}`)
})

// ─── Group bulk assign routes (D-18) ────────────────────────────────────────

// GET /admin/groups/:name/assign — show group members with shift+position selection
adminRoutes.get('/groups/:name/assign', (c) => {
  const lang = resolveLang(c)
  const groupName = decodeURIComponent(c.req.param('name'))
  const allCrew = getAllCrew()
  const members = allCrew.filter(m => m.group_name === groupName)
  if (members.length === 0) return c.notFound()

  const shifts = getShiftsWithPositionFill()
  const positions = getAllPositions()

  // Unique shifts for dropdown
  const uniqueShifts = new Map<number, { id: number; date: string; type: string }>()
  for (const r of shifts) {
    if (!uniqueShifts.has(r.shift_id)) {
      uniqueShifts.set(r.shift_id, { id: r.shift_id, date: r.date, type: r.type })
    }
  }

  const shiftOptions = Array.from(uniqueShifts.values()).map(s =>
    html`<option value="${s.id}">${weekdayName(s.date, lang)} ${shiftTypeLabel(lang, s.type)}</option>`
  )

  const positionOptions = positions.map(p =>
    html`<option value="${p.id}">${p.label}</option>`
  )

  const memberRows = members.map(m => {
    const level = effectiveLevel(m)
    return html`<tr>
      <td>${m.first_name} ${m.last_name}</td>
      <td>${'\u2605'.repeat(Math.max(0, Math.min(5, level)))}${'\u2606'.repeat(5 - Math.max(0, Math.min(5, level)))}</td>
      <td>
        <input type="hidden" name="crew_ids" value="${m.id}">
        <select name="position_${m.id}" required>${positionOptions}</select>
      </td>
    </tr>`
  })

  const content = html`
    <a href="/admin">&larr; ${t(lang, 'admin.groupAssign.backToList')}</a>
    <h2>${t(lang, 'admin.groupAssign.heading', { group: groupName })}</h2>
    <article>
      <form method="POST" action="/admin/groups/assign">
        <input type="hidden" name="group_name" value="${groupName}">
        <label>${t(lang, 'admin.groupAssign.shiftLabel')}
          <select name="shift_id" required>
            <option value="">${t(lang, 'admin.groupAssign.selectShiftPlaceholder')}</option>
            ${shiftOptions}
          </select>
        </label>
        <div class="table-wrap">
        <table>
          <thead><tr><th>${t(lang, 'common.name')}</th><th>${t(lang, 'common.level')}</th><th>${t(lang, 'common.position')}</th></tr></thead>
          <tbody>${memberRows}</tbody>
        </table>
        </div>
        <button type="submit">${t(lang, 'admin.groupAssign.assignAll')}</button>
      </form>
    </article>
  ` as HtmlEscapedString
  return c.html(layout(t(lang, 'admin.groupAssign.pageTitle'), content, { nav: true, lang, activePage: 'crew' }))
})

// POST /admin/groups/assign — bulk assign group members
adminRoutes.post('/groups/assign', async (c) => {
  const body = await c.req.parseBody({ all: true })
  const shiftId = parseInt(body['shift_id'] as string, 10)
  const groupName = body['group_name'] as string
  const crewIds = (Array.isArray(body['crew_ids']) ? body['crew_ids'] : [body['crew_ids']]).map(Number)
  const adminId = c.get('adminId')

  if (isNaN(shiftId) || crewIds.length === 0) return c.redirect('/admin')

  const db = getDb()

  db.transaction(() => {
    for (const crewId of crewIds) {
      const positionId = parseInt(body[`position_${crewId}`] as string, 10)
      if (isNaN(positionId)) continue

      // Check capacity
      const fill = db.prepare('SELECT COUNT(*) AS count FROM assignments WHERE shift_id = ? AND position_id = ?')
        .get(shiftId, positionId) as { count: number }
      const cap = db.prepare('SELECT capacity FROM shift_positions WHERE shift_id = ? AND position_id = ?')
        .get(shiftId, positionId) as { capacity: number } | undefined

      if (!cap || fill.count >= cap.capacity) continue

      // Check not already assigned
      const dup = db.prepare('SELECT id FROM assignments WHERE crew_id = ? AND shift_id = ?')
        .get(crewId, shiftId)
      if (dup) continue

      db.prepare('INSERT INTO assignments (crew_id, shift_id, position_id, assigned_by) VALUES (?, ?, ?, ?)')
        .run(crewId, shiftId, positionId, adminId)

      // Auto-advance status
      db.prepare(`UPDATE crew SET status = 'shift_selection', updated_at = datetime('now')
        WHERE id = ? AND status IN ('applied', 'shortlisted')`).run(crewId)
    }
  })()

  return c.redirect('/admin')
})

// GET /admin/import — show CSV upload form
adminRoutes.get('/import', (c) => {
  const lang = resolveLang(c)
  return c.html(importPage({ lang }))
})

// POST /admin/import — parse CSV, run header mapping, return preview page (D-10)
// Does NOT import data — confirm step is /admin/import/confirm.
adminRoutes.post('/import', bodyLimit({ maxSize: MAX_CSV_BODY_BYTES }), async (c) => {
  const lang = resolveLang(c)
  const body = await c.req.parseBody()
  const file = body['csv_file']

  if (!file || typeof file === 'string') {
    return c.html(importPage({ error: 'no_file', lang }))
  }

  // 5 MB cap (D-13 preserves csv-parse options, new defensive check)
  if ((file as File).size > MAX_CSV_UPLOAD_BYTES) {
    return c.html(importPage({ error: 'file_too_large', lang }))
  }

  let text: string
  try {
    text = await (file as File).text()
  } catch {
    return c.html(importPage({ error: 'parse_error', lang }))
  }

  let records: Record<string, string>[]
  try {
    records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      bom: true,                     // D-13: preserve from Phase 2
      trim: true,                    // D-13: preserve from Phase 2
    }) as Record<string, string>[]
  } catch {
    return c.html(importPage({ error: 'parse_error', lang }))
  }

  if (records.length === 0) {
    return c.html(importPage({ error: 'zero_rows', lang }))
  }

  // Build header mapping from first row's keys (csv-parse with columns:true uses them)
  const csvHeaders = Object.keys(records[0])
  const headerByCsv = buildHeaderMap(csvHeaders)
  const missingRequired = findMissingRequiredFields(headerByCsv)

  // Build preview rows: one entry per CSV header, green = mapped, yellow = unknown
  const rows = csvHeaders.map(csvHeader => {
    const dbField = headerByCsv.get(csvHeader) ?? null
    return {
      csvHeader,
      dbField,
      status: (dbField ? 'mapped' : 'unknown') as 'mapped' | 'unknown',
    }
  })

  return c.html(importPreviewPage({
    rows,
    missingRequired,
    csvRowCount: records.length,
    lang,
  }))
})

// POST /admin/import/confirm — run the actual import (IMPT-02 entry point)
// Re-accepts the file upload per §Pre-flight Preview Data Flow option (a).
adminRoutes.post('/import/confirm', bodyLimit({ maxSize: MAX_CSV_BODY_BYTES }), async (c) => {
  const lang = resolveLang(c)
  const body = await c.req.parseBody()
  const file = body['csv_file']

  if (!file || typeof file === 'string') {
    return c.html(importPage({ error: 'no_file', lang }))
  }

  if ((file as File).size > MAX_CSV_UPLOAD_BYTES) {
    return c.html(importPage({ error: 'file_too_large', lang }))
  }

  let text: string
  try {
    text = await (file as File).text()
  } catch {
    return c.html(importPage({ error: 'parse_error', lang }))
  }

  let records: Record<string, string>[]
  try {
    records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
    }) as Record<string, string>[]
  } catch {
    return c.html(importPage({ error: 'parse_error', lang }))
  }

  if (records.length === 0) {
    return c.html(importPage({ error: 'zero_rows', lang }))
  }

  // Defensive server-side check: even if preview was bypassed, we MUST reject
  // uploads without the required email header (D-11).
  const csvHeaders = Object.keys(records[0])
  const headerByCsv = buildHeaderMap(csvHeaders)
  const missingRequired = findMissingRequiredFields(headerByCsv)
  if (missingRequired.length > 0) {
    return c.html(importPage({ error: 'missing_required', lang }))
  }

  const result = importCsvRecords(records)
  return c.html(importPage({ result, lang }))
})
