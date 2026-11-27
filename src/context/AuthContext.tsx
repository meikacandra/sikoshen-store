import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { readStorage, removeStorage, writeStorage } from '../lib/storage'

const SESSION_KEY = 'sikoshen.session'

export interface User {
  name: string
  email: string
  role: 'Owner'
}

interface AuthApi {
  user: User | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthCtx = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readStorage<User | null>(SESSION_KEY, null))

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (response.status === 401) return false
    if (!response.ok) throw new Error('Server login belum tersedia.')
    const res = (await response.json()) as { ok: boolean; user: User }
    if (res.ok && res.user) {
      writeStorage(SESSION_KEY, res.user)
      setUser(res.user)
      return true
    }
    return false
  }, [])

  const logout = useCallback(() => {
    removeStorage(SESSION_KEY)
    setUser(null)
  }, [])

  const api = useMemo(() => ({ user, login, logout }), [user, login, logout])
  return <AuthCtx.Provider value={api}>{children}</AuthCtx.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthCtx)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
