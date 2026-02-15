/**
 * S3 / R2 storage driver.
 * Set STORAGE_DRIVER=s3 and S3_* env vars to enable.
 * Works with AWS S3 and Cloudflare R2 (S3-compatible API).
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { promises as fs } from 'fs'
import { env } from '../../config.js'

let _client = null

function getClient() {
  if (_client) return _client
  const region = env.S3_REGION || 'auto'
  const endpoint = env.S3_ENDPOINT || undefined
  const forcePathStyle = Boolean(env.S3_FORCE_PATH_STYLE)
  _client = new S3Client({
    region,
    ...(endpoint ? { endpoint } : {}),
    ...(forcePathStyle ? { forcePathStyle: true } : {}),
    credentials: env.S3_ACCESS_KEY_ID
      ? {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY || '',
        }
      : undefined,
  })
  return _client
}

export function getBucket() {
  return env.S3_BUCKET || ''
}

export function publicUrlForKey(key) {
  const custom = env.S3_PUBLIC_URL
  if (custom) return `${custom.replace(/\/$/, '')}/${encodeURIComponent(key)}`
  const region = env.S3_REGION || 'auto'
  const bucket = getBucket()
  if (!bucket) return `/api/uploads/${encodeURIComponent(key)}`
  if (env.S3_ENDPOINT && env.S3_ENDPOINT.includes('r2.cloudflarestorage')) {
    const accountId = env.R2_ACCOUNT_ID || ''
    if (accountId) return `https://pub-${env.R2_PUBLIC_HASH || ''}.r2.dev/${key}`
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

export async function uploadFromPath(filepath, key, contentType) {
  const bucket = getBucket()
  if (!bucket) throw new Error('S3_BUCKET is required when STORAGE_DRIVER=s3')
  const body = await fs.readFile(filepath)
  const client = getClient()
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    }),
  )
  return { storage_key: key, url: publicUrlForKey(key) }
}

export function describeMulterFile(f) {
  const key = f?.filename
  if (!key) return null
  return {
    storage: 's3',
    storage_key: key,
    url: publicUrlForKey(key),
  }
}

export async function uploadMulterFile(f) {
  if (!f?.path || !f?.filename) return null
  const { storage_key, url } = await uploadFromPath(f.path, f.filename, f.mimetype)
  return { storage: 's3', storage_key, url }
}
