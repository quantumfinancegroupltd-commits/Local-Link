export async function ensureAdmin(request, apiBaseURL) {
  const secret = process.env.E2E_ADMIN_BOOTSTRAP_SECRET || 'dev_only_change_me'
  const email = process.env.E2E_ADMIN_EMAIL || 'diag-admin@locallink.test'
  const password = process.env.E2E_ADMIN_PASSWORD || 'DiagPass123!'

  const boot = await request.post(`${apiBaseURL}/bootstrap/admin`, {
    data: { secret, name: 'Diagnostics Admin', email, password },
  })

  if (boot.ok()) {
    const data = await boot.json()
    return { token: data?.token, user: data?.user }
  }

  if (boot.status() === 409) {
    const login = await request.post(`${apiBaseURL}/login`, { data: { email, password } })
    if (!login.ok()) throw new Error(`admin login failed: ${login.status()} ${await login.text()}`)
    const data = await login.json()
    return { token: data?.token, user: data?.user }
  }

  throw new Error(`admin bootstrap failed: ${boot.status()} ${await boot.text()}`)
}
