import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { apiLogin } from '../lib/api'
import { readStorage, removeStorage, writeStorage } from '../lib/storage'

export const DEMO_EMAIL = 'owner@sikoshen.id'
export const DEMO_PASSWORD = 'sikoshen123'

const SESSION_KEY = 'sikoshen.session'

export interface User {
  name: string
  email: string
  role: 'Owner'
}

interface AuthApi {
  user: User | null
  /** Memeriksa kredensial ke server Backend API MySQL Laragon (fallback ke akun demo bila offline). */
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

const AuthCtx = createContext<AuthApi | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readStorage<User | null>(SESSION_KEY, null))

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await apiLogin(email, password)
      if (res.ok && res.user) {
        writeStorage(SESSION_KEY, res.user)
        setUser(res.user)
        return true
      }
      return false
    } catch (err) {
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 401) {
        return false
      }
      await new Promise((r) => window.setTimeout(r, 800))
      const ok = email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD
      if (ok) {
        const u: User = { name: 'Owner Sikoshen', email: DEMO_EMAIL, role: 'Owner' }
        writeStorage(SESSION_KEY, u)
        setUser(u)
      }
      return ok
    }
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
