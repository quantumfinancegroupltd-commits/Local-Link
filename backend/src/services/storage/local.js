import { promises as fs } from 'fs'
import path from 'path'

const uploadDir = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(process.cwd(), 'uploads')

export async function ensureUploadDir() {
  await fs.mkdir(uploadDir, { recursive: true })
}

export function getUploadDir() {
  return uploadDir
}

export function publicUrlForKey(key) {
  // We serve local uploads via the API gateway: /api/uploads/<key>
  // Keep this relative so it works behind any domain/reverse proxy.
  return `/api/uploads/${encodeURIComponent(key)}`
}

export function describeMulterFile(f) {
  const key = f?.filename
  if (!key) return null
  return {
    storage: 'local',
    storage_key: key,
    url: publicUrlForKey(key),
  }
}

export async function uploadMulterFile(f) {
  return describeMulterFile(f)
}


