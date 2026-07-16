import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Buffer } from 'node:buffer'
import { applyFormPage } from '../views/apply-form.js'
import { applySuccessPage } from '../views/apply-success.js'
import { insertCrew, setCrewPhoto } from '../services/crew.js'
import { isTruthy } from '../services/import.js'
import { isExperienceKey, experienceLevel } from '../domain/experience.js'
import { UPLOAD_DIR, ensureUploadDir, randomPhotoFilename } from '../services/uploads.js'
import { rateLimit } from '../middleware/rate-limit.js'
import { getBranding } from '../domain/branding.js'
import { t, resolveLang } from '../i18n.js'

// D-16 — 3 MB upload cap (the attachment file itself, checked after parseBody)
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024

// Outer guard on the whole multipart body, checked before parseBody() reads it —
// headroom above the 3 MB attachment cap for the other form fields + multipart
// overhead, but still bounded so an oversized request can't be parsed into memory
// at all.
const MAX_APPLY_BODY_BYTES = 5 * 1024 * 1024

type ImageExt = 'jpg' | 'png' | 'webp'

/**
 * 12-byte magic-byte detector for JPEG / PNG / WebP (D-17).
 */
function detectImageExt(buf: Buffer): ImageExt | null {
  if (buf.length < 12) return null
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return 'png'
  // WebP: "RIFF" .... "WEBP"
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return 'webp'
  return null
}

export const applyRoutes = new Hono()

// GET /apply — render the application form in the resolved language
applyRoutes.get('/', (c) => {
  const lang = resolveLang(c)
  return c.html(applyFormPage(lang))
})

// POST /apply — parse multipart, validate, insertCrew, optionally write image, redirect
// Rate limit: 10 submissions / hour / IP (best-effort, see middleware/rate-limit.ts)
applyRoutes.post('/',
  rateLimit({ name: 'apply', limit: 10, windowMs: 60 * 60 * 1000 }),
  bodyLimit({ maxSize: MAX_APPLY_BODY_BYTES }),
  async (c) => {
  const lang = resolveLang(c)
  const body = await c.req.parseBody({ all: true })

  // ─── Required text fields ─────────────────────────────────────────────────
  const firstName = (body['first_name'] as string)?.trim() || ''
  const lastName  = (body['last_name']  as string)?.trim() || ''
  const email     = (body['email']      as string)?.trim().toLowerCase() || ''

  if (!firstName || !lastName || !email) {
    return c.html(applyFormPage(lang, {
      error: t(lang, 'apply.error.requiredFields'),
    }))
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.html(applyFormPage(lang, {
      error: t(lang, 'apply.error.invalidEmail'),
    }))
  }

  // ─── Experience + derived level (D-04, D-05) ──────────────────────────────
  // The form submits a stable experience key (see src/domain/experience.ts).
  const experienceText = (body['experience_text'] as string)?.trim() || null

  if (!experienceText || !isExperienceKey(experienceText)) {
    return c.html(applyFormPage(lang, {
      error: t(lang, 'apply.error.experienceRequired'),
    }))
  }

  const derivedLevel = experienceLevel(experienceText)

  // ─── Optional text fields ─────────────────────────────────────────────────
  const phone             = (body['phone']              as string)?.trim() || null
  const nickname          = (body['nickname']           as string)?.trim() || null
  const experienceDetails = (body['experience_details'] as string)?.trim() || null
  const preferredWork     = (body['preferred_work']     as string)?.trim() || null
  const nationality       = (body['nationality']        as string)?.trim() || null
  const aboutText         = (body['about_text']         as string)?.trim() || null
  const note              = (body['note']               as string)?.trim() || null

  // ─── previous_work (D-09: radio yes/no + optional text → one concatenated string) ─
  const prevYN    = (body['previous_work_yn']    as string)?.trim() || ''
  const prevWhere = (body['previous_work_where'] as string)?.trim() || ''
  let previousWork: string | null = null
  if (prevYN === 'no') {
    previousWork = 'Nein // No'
  } else if (prevYN === 'yes') {
    previousWork = prevWhere ? `Ja // Yes: ${prevWhere}` : 'Ja // Yes'
  }

  // ─── Booleans via isTruthy() (D-03) ───────────────────────────────────────
  const contactPerson      = isTruthy(body['contact_person']      as string)

  // ─── Group signup (checkbox value="1") ────────────────────────────────────
  const groupSignup = (body['group_signup'] as string) === '1'
  const groupName   = (body['group_name'] as string)?.trim() || null

  // ─── festival_count (NaN-safe per Pitfall 6) ──────────────────────────────
  const festivalCountRaw = body['festival_count'] as string
  const festivalCount = festivalCountRaw ? (parseInt(festivalCountRaw) || null) : null

  // ─── File field pre-check (Pitfall 2: empty file vs missing file) ─────────
  const fileField = body['attachment']
  const hasFile =
    fileField !== undefined && fileField !== null &&
    typeof fileField !== 'string' &&
    (fileField as File).size > 0

  let fileInvalidBeforeInsert = false
  if (hasFile) {
    const f = fileField as File
    if (f.size > MAX_ATTACHMENT_BYTES) {
      fileInvalidBeforeInsert = true
    }
  }

  // ─── Insert crew row ──────────────────────────────────────────────────────
  const crewId = insertCrew({
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
    nickname,
    admin_level: derivedLevel,            // single level column, seeded from experience
    preferred_positions: [],              // D-11 — form no longer sets this
    group_signup: groupSignup,
    group_name: groupName,
    festival_count: festivalCount,
    note,
    experience_text: experienceText,
    experience_details: experienceDetails,
    previous_work: previousWork,
    contact_person: contactPerson,
    preferred_work: preferredWork,
    nationality,
    about_text: aboutText,
    attachment_url: null,                 // set via setCrewAttachment after fs.writeFile
  })

  if (crewId === null) {
    const contactEmail = getBranding().contact_email
    const contact = contactEmail
      ? t(lang, 'apply.error.contactWithEmail', { email: contactEmail })
      : t(lang, 'apply.error.contactFallback')
    return c.html(applyFormPage(lang, {
      error: t(lang, 'apply.error.duplicateEmail', { contact }),
    }))
  }

  // ─── Optional image upload (D-19 write-order steps 3-5) ───────────────────
  let uploadWarning = fileInvalidBeforeInsert
  if (hasFile && !fileInvalidBeforeInsert) {
    const f = fileField as File
    try {
      const buf = Buffer.from(await f.arrayBuffer())
      const ext = detectImageExt(buf)
      if (!ext) {
        uploadWarning = true
      } else {
        // Store outside public/ with a random, unguessable filename (see services/uploads.ts).
        ensureUploadDir()
        const filename = randomPhotoFilename(ext)
        await fs.writeFile(path.join(UPLOAD_DIR, filename), buf)
        setCrewPhoto(crewId, filename)
      }
    } catch (err) {
      console.error('[apply] upload failed for crew', crewId, err)
      uploadWarning = true
    }
  }

  // ─── Redirect to success page ─────────────────────────────────────────────
  const redirectUrl =
    '/apply/success?name=' + encodeURIComponent(firstName) +
    (uploadWarning ? '&upload_warning=1' : '')
  return c.redirect(redirectUrl)
})

// GET /apply/success — personalized confirmation in the resolved language, with
// optional upload warning
applyRoutes.get('/success', (c) => {
  const lang = resolveLang(c)
  const firstName     = c.req.query('name') || 'Crew'
  const uploadWarning = c.req.query('upload_warning') === '1'
  return c.html(applySuccessPage(lang, firstName, uploadWarning))
})
