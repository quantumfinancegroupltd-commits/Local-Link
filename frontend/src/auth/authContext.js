import { createContext } from 'react'

export const AuthContext = createContext(null)

export const LS_TOKEN = 'locallink_token'
export const LS_USER = 'locallink_user'

export function safeParse(json) {
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

function hasStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readLocal(key) {
  if (!hasStorage()) return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocal(key, value) {
  if (!hasStorage()) return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
}

export function removeLocal(key) {
  if (!hasStorage()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}


