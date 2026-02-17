import express, { Router } from 'express'
import { promises as fs } from 'fs'
import path from 'path'
import crypto from 'crypto'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { storage } from '../services/storage/index.js'
import { maybeGenerateImageThumb } from '../services/mediaProcessing.js'
import { env } from '../config.js'
import { pool } from '../db/pool.js'

export const uploadsRouter = Router()

const uploadDir = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(process.cwd(), 'uploads')
const privateUploadDir = path.join(uploadDir, 'private')
const st = storage()

async function ensureUploadDir() {
  await fs.mkdir(uploadDir, { recursive: true })
}

async function ensurePrivateUploadDir() {
  await fs.mkdir(privateUploadDir, { recursive: true })
}

function extensionFromMime(mime) {
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/avif') return 'avif'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/heic') return 'jpg' // converted to JPEG
  if (mime === 'video/mp4') return 'mp4'
  if (mime === 'video/webm') return 'webm'
  if (mime === 'video/quicktime') return 'mov'
  return null
}

function kindFromMime(mime) {
  if (String(mime || '').startsWith('image/')) return 'image'
  if (String(mime || '').startsWith('video/')) return 'video'
  return 'other'
}

async function sniffImageMimeFromFile(filepath) {
  // Reads minimal bytes to validate image content. Returns best-effort mime or null.
  try {
    const fh = await fs.open(filepath, 'r')
    try {
      const buf = Buffer.alloc(64)
      const { bytesRead } = await fh.read(buf, 0, buf.length, 0)
      const b = buf.subarray(0, bytesRead)

      // JPEG: FF D8 FF
      if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
      // PNG: 89 50 4E 47 0D 0A 1A 0A
      if (
        b.length >= 8 &&
        b[0] === 0x89 &&
        b[1] === 0x50 &&
        b[2] === 0x4e &&
        b[3] === 0x47 &&
        b[4] === 0x0d &&
        b[5] === 0x0a &&
        b[6] === 0x1a &&
        b[7] === 0x0a
      )
        return 'image/png'
      // GIF: "GIF87a" or "GIF89a"
      if (b.length >= 6) {
        const sig6 = b.subarray(0, 6).toString('ascii')
        if (sig6 === 'GIF87a' || sig6 === 'GIF89a') return 'image/gif'
      }
      // WEBP: "RIFF" .... "WEBP"
      if (b.length >= 12) {
        const riff = b.subarray(0, 4).toString('ascii')
        const webp = b.subarray(8, 12).toString('ascii')
        if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp'
      }
      // AVIF: ISO BMFF 'ftyp' with brand 'avif' or 'avis'
      if (b.length >= 16) {
        const box = b.subarray(4, 8).toString('ascii')
        if (box === 'ftyp') {
          const brand = b.subarray(8, 12).toString('ascii')
          if (brand === 'avif' || brand === 'avis') return 'image/avif'
        }
      }

      return null
    } finally {
      await fh.close()
    }
  } catch {
    return null
  }
}

function sniffImageMimeFromBuffer(buf) {
  try {
    const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf)
    if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
    if (
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a
    )
      return 'image/png'
    if (b.length >= 6) {
      const sig6 = b.subarray(0, 6).toString('ascii')
      if (sig6 === 'GIF87a' || sig6 === 'GIF89a') return 'image/gif'
    }
    if (b.length >= 12) {
      const riff = b.subarray(0, 4).toString('ascii')
      const webp = b.subarray(8, 12).toString('ascii')
      if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp'
    }
    if (b.length >= 16) {
      const box = b.subarray(4, 8).toString('ascii')
      if (box === 'ftyp') {
        const brand = b.subarray(8, 12).toString('ascii')
        if (brand === 'avif' || brand === 'avis') return 'image/avif'
      }
    }
    return null
  } catch {
    return null
  }
}

const allowedMimes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/heic',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

const allowedPrivateMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/heic'])

const multerStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await ensureUploadDir()
      cb(null, uploadDir)
    } catch (e) {
      cb(e)
    }
  },
  filename: (req, file, cb) => {
    const ext = extensionFromMime(file.mimetype)
    const safeExt = ext ? `.${ext}` : ''
    const filename = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}${safeExt}`
    cb(null, filename)
  },
})

const privateMulterStorage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await ensurePrivateUploadDir()
      cb(null, privateUploadDir)
    } catch (e) {
      cb(e)
    }
  },
  filename: (_req, file, cb) => {
    const ext = extensionFromMime(file.mimetype)
    const safeExt = ext ? `.${ext}` : ''
    const filename = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}${safeExt}`
    cb(null, filename)
  },
})

const upload = multer({
  storage: multerStorage,
  limits: {
    files: 12,
    fileSize: 50 * 1024 * 1024, // 50MB per file
  },
  fileFilter: (req, file, cb) => {
    if (allowedMimes.has(file.mimetype)) return cb(null, true)
    const err = new Error(`Unsupported file type: ${file.mimetype || 'unknown'}`)
    err.code = 'UNSUPPORTED_MEDIA_TYPE'
    return cb(err, false)
  },
})

const privateUpload = multer({
  storage: privateMulterStorage,
  limits: {
    files: 3, // ID front/back/selfie
    fileSize: 12 * 1024 * 1024, // 12MB per image
  },
  fileFilter: (_req, file, cb) => {
    if (allowedPrivateMimes.has(file.mimetype)) return cb(null, true)
    const err = new Error(`Unsupported file type: ${file.mimetype || 'unknown'}`)
    err.code = 'UNSUPPORTED_MEDIA_TYPE'
    return cb(err, false)
  },
})

// Gentle abuse protection: per-user upload request limits in production.
// High enough not to affect normal UX, but stops bots from spamming uploads.
const uploadMediaRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 30, // 30 upload requests / 10min / user
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req?.user?.sub ?? req.ip,
  skip: () => env.NODE_ENV !== 'production',
  message: { message: 'Too many uploads. Please wait a few minutes and try again.' },
})

const uploadBase64RateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req?.user?.sub ?? req.ip,
  skip: () => env.NODE_ENV !== 'production',
  message: { message: 'Too many uploads. Please wait a few minutes and try again.' },
})

const uploadPrivateRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 15, // fewer private uploads; they are more sensitive
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req?.user?.sub ?? req.ip,
  skip: () => env.NODE_ENV !== 'production',
  message: { message: 'Too many uploads. Please wait a few minutes and try again.' },
})

// Multipart uploads for multiple media files (images + videos)
// POST /api/uploads/media  form-data: files=<File> (repeat)
// Returns { files: [{ url, mime, kind, size, original_name }] }
uploadsRouter.post('/media', requireAuth, uploadMediaRateLimit, (req, res, next) => {
  const handler = upload.array('files', 12)
  handler(req, res, (err) => {
    if (!err) return next()
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'File too large (max 50MB per file)' })
    if (err?.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ message: 'Too many files (max 12)' })
    if (err?.code === 'UNSUPPORTED_MEDIA_TYPE') return res.status(415).json({ message: err.message })
    return res.status(400).json({ message: err?.message || 'Upload failed' })
  })
}, asyncHandler(async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : []
  if (!files.length) return res.status(400).json({ message: 'No files uploaded (use field name "files")' })

  // HEIC (iPhone) → JPEG so rest of pipeline and browsers work
  const sharp = (await import('sharp')).default
  for (const f of files) {
    if (f.mimetype !== 'image/heic') continue
    try {
      const jpegPath = f.path.replace(/\.(heic|HEIC)$/i, '.jpg') || f.path + '.jpg'
      await sharp(f.path).rotate().jpeg({ quality: 90 }).toFile(jpegPath)
      await fs.unlink(f.path).catch(() => {})
      f.path = jpegPath
      f.mimetype = 'image/jpeg'
      f.filename = path.basename(jpegPath)
      f.size = (await fs.stat(jpegPath)).size
    } catch {
      await fs.unlink(f.path).catch(() => {})
      return res.status(415).json({ message: 'HEIC conversion failed. Try saving as JPEG on your device.' })
    }
  }

  // Extra safety: verify image content matches the declared mimetype.
  // (We keep videos as-is; deeper video validation is heavier and optional.)
  for (const f of files) {
    if (kindFromMime(f.mimetype) !== 'image') continue
    const sniffed = await sniffImageMimeFromFile(f.path)
    if (!sniffed || sniffed !== f.mimetype) {
      // Remove suspicious file from disk best-effort, then reject the request.
      await fs.unlink(f.path).catch(() => {})
      return res.status(415).json({ message: 'Upload rejected: file content did not match image type.' })
    }
  }

  const out = await Promise.all(
    files.map(async (f) => {
      const base =
        typeof st.uploadMulterFile === 'function'
          ? await st.uploadMulterFile(f)
          : st.describeMulterFile?.(f) ?? { storage: 'local', storage_key: f.filename, url: `/api/uploads/${f.filename}` }
      const extra =
        kindFromMime(f.mimetype) === 'image'
          ? await maybeGenerateImageThumb({
              storageKey: base.storage_key,
              absolutePath: f.path,
            }).catch(() => null)
          : null
      return {
        ...base,
        ...(extra ?? {}),
        mime: f.mimetype,
        kind: kindFromMime(f.mimetype),
        size: f.size,
        original_name: f.originalname,
      }
    }),
  )

  return res.status(201).json({
    files: out,
  })
}))

// Private uploads for sensitive documents (e.g., Ghana Card verification).
// POST /api/uploads/private/media  form-data:
// - purpose: "id_verification" (required)
// - files: <File> (repeat, max 3)
// Returns { files: [{ id, url, mime, kind, size, original_name }] }
uploadsRouter.post('/private/media', requireAuth, uploadPrivateRateLimit, (req, res, next) => {
  const handler = privateUpload.array('files', 3)
  handler(req, res, (err) => {
    if (!err) return next()
    if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'File too large (max 12MB per file)' })
    if (err?.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ message: 'Too many files (max 3)' })
    if (err?.code === 'UNSUPPORTED_MEDIA_TYPE') return res.status(415).json({ message: err.message })
    return res.status(400).json({ message: err?.message || 'Upload failed' })
  })
}, asyncHandler(async (req, res) => {
  const purpose = String(req.body?.purpose || '').trim()
  if (!purpose) return res.status(400).json({ message: 'purpose is required' })

  const files = Array.isArray(req.files) ? req.files : []
  if (!files.length) return res.status(400).json({ message: 'No files uploaded (use field name "files")' })

  // HEIC → JPEG for private uploads (e.g. ID verification)
  const sharp = (await import('sharp')).default
  for (const f of files) {
    if (f.mimetype === 'image/heic') {
      try {
        const jpegPath = f.path.replace(/\.(heic|HEIC)$/i, '.jpg') || f.path + '.jpg'
        await sharp(f.path).rotate().jpeg({ quality: 90 }).toFile(jpegPath)
        await fs.unlink(f.path).catch(() => {})
        f.path = jpegPath
        f.mimetype = 'image/jpeg'
        f.filename = path.basename(jpegPath)
        f.size = (await fs.stat(jpegPath)).size
      } catch {
        await fs.unlink(f.path).catch(() => {})
        return res.status(415).json({ message: 'HEIC conversion failed. Try saving as JPEG.' })
      }
    }
    const sniffed = await sniffImageMimeFromFile(f.path)
    if (!sniffed || sniffed !== f.mimetype) {
      await fs.unlink(f.path).catch(() => {})
      return res.status(415).json({ message: 'Upload rejected: file content did not match image type.' })
    }
  }

  const out = []
  for (const f of files) {
    const r = await pool.query(
      `insert into private_uploads (user_id, purpose, storage, storage_key, mime, kind, size_bytes, original_name)
       values ($1,$2,'local',$3,$4,'image',$5,$6)
       returning id`,
      [req.user.sub, purpose, f.filename, f.mimetype, f.size, f.originalname],
    )
    const id = r.rows[0].id
    out.push({
      id,
      url: `/api/uploads/private/${id}`,
      mime: f.mimetype,
      kind: 'image',
      size: f.size,
      original_name: f.originalname,
    })
  }

  return res.status(201).json({ files: out })
}))

// Serve private uploads (admin or owner only).
// NOTE: This is intentionally NOT served by express.static.
uploadsRouter.get('/private/:id', requireAuth, asyncHandler(async (req, res) => {
  const id = String(req.params.id || '').trim()
  if (!id) return res.status(400).json({ message: 'Invalid id' })

  const r = await pool.query('select * from private_uploads where id = $1', [id])
  const row = r.rows[0]
  if (!row) return res.status(404).json({ message: 'Not found' })

  const isOwner = row.user_id === req.user.sub
  const isAdmin = req.user.role === 'admin'
  if (!isOwner && !isAdmin) return res.status(403).json({ message: 'Forbidden' })

  const key = String(row.storage_key || '')
  if (!key) return res.status(404).json({ message: 'Not found' })

  await ensurePrivateUploadDir()
  const filepath = path.join(privateUploadDir, key)

  // Strong no-sniffing for sensitive docs.
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Cache-Control', 'private, no-store')
  res.type(String(row.mime || 'application/octet-stream'))
  return res.sendFile(filepath)
}))

// POST /api/uploads  { dataUrl: "data:image/png;base64,..." }
// Returns { url: "/api/uploads/<filename>" }
uploadsRouter.post('/', requireAuth, uploadBase64RateLimit, asyncHandler(async (req, res) => {
  const dataUrl = req.body?.dataUrl
  if (!dataUrl || typeof dataUrl !== 'string') return res.status(400).json({ message: 'dataUrl is required' })

  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
  if (!m) return res.status(400).json({ message: 'Invalid dataUrl (expected base64 image data URL)' })

  const mime = m[1]
  const b64 = m[2]

  const ext = extensionFromMime(mime)
  if (!ext) return res.status(400).json({ message: 'Unsupported image type (use jpg, png, webp, gif, or avif)' })

  let buf
  try {
    buf = Buffer.from(b64, 'base64')
  } catch {
    return res.status(400).json({ message: 'Invalid base64' })
  }

  const sniffed = sniffImageMimeFromBuffer(buf)
  if (!sniffed || sniffed !== mime) {
    return res.status(415).json({ message: 'Upload rejected: file content did not match image type.' })
  }

  // Keep this small for MVP; for production we’d use S3/R2/Cloudinary.
  const maxBytes = 4 * 1024 * 1024 // 4MB
  if (buf.byteLength > maxBytes) return res.status(413).json({ message: 'Image too large (max 4MB)' })

  await ensureUploadDir()
  const filename = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID()}.${ext}`
  const filepath = path.join(uploadDir, filename)

  await fs.writeFile(filepath, buf)
  const extra = await maybeGenerateImageThumb({ storageKey: filename, absolutePath: filepath }).catch(() => null)
  let base
  if (typeof st.uploadFromPath === 'function') {
    const uploaded = await st.uploadFromPath(filepath, filename, mime)
    base = { storage: 's3', storage_key: uploaded.storage_key, url: uploaded.url }
    await fs.unlink(filepath).catch(() => {})
  } else {
    base =
      st.publicUrlForKey?.(filename) != null
        ? { storage: 'local', storage_key: filename, url: st.publicUrlForKey(filename) }
        : { url: `/api/uploads/${filename}` }
  }
  return res.status(201).json({ ...base, ...(extra ?? {}) })
}))

// Serve uploaded files
uploadsRouter.use('/', async (req, res, next) => {
  try {
    await ensureUploadDir()
    return next()
  } catch (e) {
    return next(e)
  }
})
uploadsRouter.use('/', express.static(uploadDir, { fallthrough: true }))


