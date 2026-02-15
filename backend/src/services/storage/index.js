import * as local from './local.js'
import * as s3 from './s3.js'

export function storageDriver() {
  return String(process.env.STORAGE_DRIVER || 'local').toLowerCase()
}

export function storage() {
  const driver = storageDriver()
  if (driver === 'local') return local
  if (driver === 's3') return s3
  throw new Error(`Unsupported STORAGE_DRIVER '${driver}'. Use 'local' or 's3'.`)
}


