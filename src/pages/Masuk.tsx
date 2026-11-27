import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { readStorage, removeStorage, writeStorage } from '../lib/storage'

const MAX_ATTEMPTS = 5
const LOCK_MS = 30_000
const LOCK_KEY = 'sikoshen.loginLock'

export default function Masuk() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { loggedOut?: boolean; from?: string } | null

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [userError, setUserError] = useState<string>()
  const [pwError, setPwError] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [checking, setChecking] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [lockUntil, setLockUntil] = useState<number>(() => readStorage<number>(LOCK_KEY, 0))
  const [now, setNow] = useState(() => Date.now())
  const [showLoggedOut, setShowLoggedOut] = useState(Boolean(state?.loggedOut))
  const pwRef = useRef<HTMLInputElement>(null)

  const locked = lockUntil > now
  const secondsLeft = Math.max(0, Math.ceil((lockUntil - now) / 1000))

  useEffect(() => {
    if (!locked) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [locked])

  useEffect(() => {
    if (lockUntil && !locked) {
      setLockUntil(0)
      setAttempts(0)
      setFailed(false)
      removeStorage(LOCK_KEY)
    }
  }, [locked, lockUntil])

  if (user) return <Navigate to="/beranda" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (locked || checking) return
    setShowLoggedOut(false)

    const uErr = !username.trim() ? 'Masukkan nama pengguna.' : undefined
    const pErr = !password ? 'Masukkan kata sandi.' : undefined
    setUserError(uErr)
    setPwError(pErr)
    if (uErr || pErr) return

    setChecking(true)
    setFailed(false)
    let ok: boolean
    try {
      ok = await login(username, password)
    } catch {
      setChecking(false)
      setUserError('Server belum terhubung. Jalankan backend lalu coba masuk lagi.')
      return
    }
    setChecking(false)

    if (ok) {
      navigate(state?.from ?? '/beranda', { replace: true })
      return
    }

    const next = attempts + 1
    setAttempts(next)
    setFailed(true)
    setPassword('')
    if (next >= MAX_ATTEMPTS) {
      const until = Date.now() + LOCK_MS
      setLockUntil(until)
      setNow(Date.now())
      writeStorage(LOCK_KEY, until)
    }
    window.setTimeout(() => pwRef.current?.focus(), 0)
  }

  const remaining = MAX_ATTEMPTS - attempts

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#121e2b] px-4 py-10">
      <main className="w-full max-w-[396px] rounded-[18px] bg-white px-7 py-8 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[#1e4fd7] text-[19px] font-bold text-white"
          >
            S
          </span>
          <div>
            <h1 className="text-[18.5px] font-bold leading-tight text-[#0f172a]">
              Sikoshen Stock Planner
            </h1>
            <p className="mt-0.5 text-[13px] text-[#64748b]">
              Bantu belanja stok berbasis data
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2" aria-live="polite">
          {showLoggedOut && (
            <div className="rounded-lg border border-[#abefc6] bg-[#ecfdf3] px-3 py-2 text-[12.5px] font-medium text-[#067647]">
              Anda sudah keluar dengan aman.
            </div>
          )}
          {locked ? (
            <div role="alert" className="rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[12.5px] text-[#b42318]">
              Terlalu banyak percobaan. Coba lagi dalam <strong className="tabular">{secondsLeft} detik</strong>.
            </div>
          ) : (
            failed && (
              <div role="alert" className="rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-[12.5px] text-[#b42318]">
                Nama pengguna atau kata sandi salah. Sisa percobaan: {remaining} kali.
              </div>
            )
          )}
        </div>

        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-username" className="mb-1.5 block text-[13px] font-medium text-[#334155]">
              Nama pengguna
            </label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setUserError(undefined)
              }}
              autoFocus
              className="h-11 w-full rounded-[9px] border border-[#cbd5e1] bg-white px-3.5 text-[14px] text-[#0f172a] transition-colors focus:border-[#1e4fd7] focus:outline-none focus:ring-2 focus:ring-[#1e4fd7]/20"
            />
            {userError && <p className="mt-1 text-[12px] text-[#b42318]">{userError}</p>}
          </div>

          <div>
            <label htmlFor="login-password" className="mb-1.5 block text-[13px] font-medium text-[#334155]">
              Kata sandi
            </label>
            <input
              ref={pwRef}
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setPwError(undefined)
              }}
              className="h-11 w-full rounded-[9px] border border-[#cbd5e1] bg-white px-3.5 text-[14px] text-[#0f172a] transition-colors focus:border-[#1e4fd7] focus:outline-none focus:ring-2 focus:ring-[#1e4fd7]/20"
            />
            {pwError && <p className="mt-1 text-[12px] text-[#b42318]">{pwError}</p>}
          </div>

          <button
            type="submit"
            disabled={locked || checking}
            className="mt-1 h-11 w-full rounded-[9px] bg-[#1e4fd7] text-[14px] font-semibold text-white transition-colors hover:bg-[#1a44bc] active:bg-[#163aa3] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checking ? 'Memeriksa…' : 'Masuk'}
          </button>
        </form>

        <p className="mt-5 text-center text-[12.5px] text-[#64748b]">
          Akses khusus pemilik dan staf Sikoshen Store.
        </p>
      </main>
    </div>
  )
}
