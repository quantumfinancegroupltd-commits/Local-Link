import path from 'path'
import { ensureUploadDir, getUploadDir, publicUrlForKey } from './storage/local.js'

async function tryImportSharp() {
  try {
    // Optional dependency (we keep this internal-only until you choose a cloud storage provider).
    const mod = await import('sharp')
    return mod.default || mod
  } catch {
    return null
  }
}

export async function maybeGenerateImageThumb({ storageKey, absolutePath }) {
  const enabled = String(process.env.IMAGE_PROCESSING_ENABLED || '').toLowerCase()
  if (!(enabled === 'true' || enabled === '1')) return null

  const sharp = await tryImportSharp()
  if (!sharp) return null

  if (!storageKey || !absolutePath) return null

  // thumb-<original>.webp (stored next to uploads for local driver)
  const thumbKey = `thumb-${storageKey}.webp`
  const outPath = path.join(getUploadDir(), thumbKey)

  await ensureUploadDir()
  await sharp(absolutePath).rotate().resize({ width: 900, withoutEnlargement: true }).webp({ quality: 80 }).toFile(outPath)

  return {
    thumb_key: thumbKey,
    thumb_url: publicUrlForKey(thumbKey),
  }
}


