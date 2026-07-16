// Applicant photo storage.
//
// SECURITY: uploaded photos are stored OUTSIDE the web root (public/) so they are
// never served statically and their ids cannot be enumerated. They are delivered
// only through the admin-authenticated route GET /admin/crew/:id/photo.

import { mkdirSync, existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { config } from '../config.js'

// Configurable via UPLOADS_DIR (see src/config.ts) so DB and uploads can share one
// volume in Docker (e.g. UPLOADS_DIR=/data/uploads alongside DB_PATH=/data/crewfest.db).
export const UPLOAD_DIR = path.resolve(config.uploadsDir)

export function ensureUploadDir(): void {
  mkdirSync(UPLOAD_DIR, { recursive: true })
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/** Random, unguessable filename (no sequential crew ids). ext ∈ 'jpg' | 'png' | 'webp'. */
export function randomPhotoFilename(ext: string): string {
  return `${randomBytes(16).toString('hex')}.${ext}`
}

/** MIME type for a stored photo filename, or null if the extension is unknown. */
export function photoMimeType(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? null
}

/**
 * Reads a stored photo. Guards against path traversal by rejecting any filename that
 * isn't a plain basename. Returns null if the file is missing or invalid.
 */
export async function readPhoto(filename: string): Promise<Buffer | null> {
  if (!filename || filename !== path.basename(filename)) return null
  const full = path.join(UPLOAD_DIR, filename)
  if (!existsSync(full)) return null
  try {
    return await readFile(full)
  } catch {
    return null
  }
}
