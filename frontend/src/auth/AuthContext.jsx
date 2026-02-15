import { useCallback, useMemo, useState } from 'react'
import { http } from '../api/http.js'
import { AuthContext, LS_TOKEN, LS_USER, readLocal, removeLocal, safeParse, writeLocal } from './authContext.js'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => readLocal(LS_TOKEN))
  const [user, setUser] = useState(() => safeParse(readLocal(LS_USER) ?? ''))
  const booted = true

  const setSession = useCallback((nextToken, nextUser) => {
    setToken(nextToken)
    setUser(nextUser)
    if (nextToken) writeLocal(LS_TOKEN, nextToken)
    else removeLocal(LS_TOKEN)
    if (nextUser) writeLocal(LS_USER, JSON.stringify(nextUser))
    else removeLocal(LS_USER)
  }, [])

  const clearSession = useCallback(() => {
    setToken(null)
    setUser(null)
    removeLocal(LS_TOKEN)
    removeLocal(LS_USER)
  }, [])

  const login = useCallback(async ({ email, password }) => {
    const res = await http.post('/login', { email, password })
    const nextToken = res.data?.token ?? res.data?.accessToken ?? null
    const nextUser = res.data?.user ?? null
    if (!nextToken || !nextUser) {
      throw new Error('Login response missing token/user')
    }
    setSession(nextToken, nextUser)
    return nextUser
  }, [setSession])

  const register = useCallback(async ({ name, email, phone, password, role }) => {
    const res = await http.post('/register', { name, email, phone, password, role })
    // Support either: register returns token+user, or just user.
    const nextToken = res.data?.token ?? res.data?.accessToken ?? null
    const nextUser = res.data?.user ?? res.data ?? null
    if (nextToken && nextUser) setSession(nextToken, nextUser)
    return nextUser
  }, [setSession])

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
    [booted, token, user, login, register, clearSession, setSession],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
