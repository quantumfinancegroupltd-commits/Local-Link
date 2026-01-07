import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { http } from '../api/http.js'

const AuthContext = createContext(null)

const LS_TOKEN = 'locallink_token'
const LS_USER = 'locallink_user'

function safeParse(json) {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null)
  const [user, setUser] = useState(null)
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem(LS_TOKEN)
    const u = safeParse(localStorage.getItem(LS_USER) ?? '')
    if (t) setToken(t)
    if (u) setUser(u)
    setBooted(true)
  }, [])

  function setSession(nextToken, nextUser) {
    setToken(nextToken)
    setUser(nextUser)
    if (nextToken) localStorage.setItem(LS_TOKEN, nextToken)
    if (nextUser) localStorage.setItem(LS_USER, JSON.stringify(nextUser))
  }

  function clearSession() {
    setToken(null)
    setUser(null)
    localStorage.removeItem(LS_TOKEN)
    localStorage.removeItem(LS_USER)
  }

  async function login({ email, password }) {
    const res = await http.post('/login', { email, password })
    const nextToken = res.data?.token ?? res.data?.accessToken ?? null
    const nextUser = res.data?.user ?? null
    if (!nextToken || !nextUser) {
      throw new Error('Login response missing token/user')
    }
    setSession(nextToken, nextUser)
    return nextUser
  }

  async function register({ name, email, phone, password, role }) {
    const res = await http.post('/register', { name, email, phone, password, role })
    // Support either: register returns token+user, or just user.
    const nextToken = res.data?.token ?? res.data?.accessToken ?? null
    const nextUser = res.data?.user ?? res.data ?? null
    if (nextToken && nextUser) setSession(nextToken, nextUser)
    return nextUser
  }

  const value = useMemo(
    () => ({
      booted,
      token,
      user,
      isAuthed: Boolean(token && user),
      login,
      register,
      logout: clearSession,
      setSession,
    }),
    [booted, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


