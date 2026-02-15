export function randEmail(prefix = 'user') {
  const n = Date.now()
  return `${prefix}_${n}_${Math.floor(Math.random() * 1e6)}@example.com`
}

export async function apiRegister(request, apiBaseURL, { name, email, phone, password, role }) {
  const res = await request.post(`${apiBaseURL}/register`, {
    data: { name, email, phone, password, role },
  })
  if (!res.ok()) {
    throw new Error(`register failed: ${res.status()} ${await res.text()}`)
  }
  return await res.json()
}

export async function apiLogin(request, apiBaseURL, { email, password }) {
  const res = await request.post(`${apiBaseURL}/login`, { data: { email, password } })
  if (!res.ok()) {
    throw new Error(`login failed: ${res.status()} ${await res.text()}`)
  }
  return await res.json()
}

export async function createUserAndLogin(request, baseURL, { role, prefix = role }) {
  const apiBaseURL = `${baseURL.replace(/\/$/, '')}/api`
  const email = randEmail(prefix)
  const password = 'password123'

  await apiRegister(request, apiBaseURL, {
    name: `${role} user`,
    email,
    phone: '+233000000000',
    password,
    role,
  })
  const loggedIn = await apiLogin(request, apiBaseURL, { email, password })
  if (!loggedIn?.token || !loggedIn?.user) throw new Error('login response missing token/user')
  return { token: loggedIn.token, user: loggedIn.user, email, password }
}

export async function setAuthStorage(page, { token, user }) {
  await page.addInitScript(
    ({ token: t, user: u }) => {
      localStorage.setItem('locallink_token', t)
      localStorage.setItem('locallink_user', JSON.stringify(u))
    },
    { token, user },
  )
}


