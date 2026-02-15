import { http } from './http.js'

export async function uploadMediaFiles(files) {
  const list = Array.isArray(files) ? files : []
  if (!list.length) return []

  const form = new FormData()
  for (const f of list) form.append('files', f)

  const res = await http.post('/uploads/media', form)
  const out = res.data?.files
  return Array.isArray(out) ? out : []
}

export async function uploadPrivateMediaFiles(files, { purpose } = {}) {
  const list = Array.isArray(files) ? files : []
  if (!list.length) return []

  const p = String(purpose || '').trim()
  if (!p) throw new Error('purpose is required')

  const form = new FormData()
  form.append('purpose', p)
  for (const f of list) form.append('files', f)

  const res = await http.post('/uploads/private/media', form)
  const out = res.data?.files
  return Array.isArray(out) ? out : []
}


