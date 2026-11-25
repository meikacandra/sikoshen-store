import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BarChart3, ClipboardCheck, FileSpreadsheet, KeyRound, LogIn } from 'lucide-react'
import { DEMO_EMAIL, DEMO_PASSWORD, useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { Banner, Button, Input, Modal, PasswordInput } from '../components/ui'
import { readStorage, removeStorage, writeStorage } from '../lib/storage'

const MAX_ATTEMPTS = 5
/** Kunci 5 menit di sistem nyata; untuk demo cukup 30 detik. */
const LOCK_MS = 30_000
const LOCK_KEY = 'sikoshen.loginLock'

const BENEFITS = [
  {
    icon: FileSpreadsheet,
    title: 'Unggah kartu stok, langsung rapi',
    text: 'File Excel/CSV harian diperiksa dan dirapikan otomatis.',
  },
  {
    icon: BarChart3,
    title: 'Tahu mana yang cepat dan lambat laku',
    text: 'Setiap SKU diberi label Fast-Moving atau Slow-Moving dari riwayatnya.',
  },
  {
    icon: ClipboardCheck,
    title: 'Saran tindakan yang jelas',
    text: 'Mana yang perlu diprioritaskan, dipantau, atau ditahan pembeliannya.',
  },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const { user, login } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as { loggedOut?: boolean; from?: string } | null

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string>()
  const [pwError, setPwError] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [checking, setChecking] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [lockUntil, setLockUntil] = useState<number>(() => readStorage<number>(LOCK_KEY, 0))
  const [now, setNow] = useState(() => Date.now())
  const [forgotOpen, setForgotOpen] = useState(false)
  const [showLoggedOut, setShowLoggedOut] = useState(Boolean(state?.loggedOut))
  const pwRef = useRef<HTMLInputElement>(null)

  const locked = lockUntil > now
  const secondsLeft = Math.max(0, Math.ceil((lockUntil - now) / 1000))

  // Hitung mundur saat terkunci
  useEffect(() => {
    if (!locked) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [locked])

  // Selesai terkunci → reset percobaan
  useEffect(() => {
    if (lockUntil && !locked) {
      setLockUntil(0)
      setAttempts(0)
      setFailed(false)
      removeStorage(LOCK_KEY)
    }
  }, [locked, lockUntil])

  if (user) return <Navigate to="/dashboard" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (locked || checking) return
    setShowLoggedOut(false)

    const eErr = !email.trim() ? 'Masukkan email Anda.' : !EMAIL_RE.test(email.trim()) ? 'Format email belum benar, contoh: nama@toko.id' : undefined
    const pErr = !password ? 'Masukkan kata sandi.' : undefined
    setEmailError(eErr)
    setPwError(pErr)
    if (eErr || pErr) return

    setChecking(true)
    setFailed(false)
    const ok = await login(email, password)
    setChecking(false)

    if (ok) {
      toast({ title: 'Selamat datang kembali', description: 'Data toko siap ditinjau.' })
      navigate(state?.from ?? '/dashboard', { replace: true })
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
    <div className="flex min-h-dvh flex-col bg-white lg:flex-row">
      {/* Panel merek */}
      <section aria-label="Tentang Sikoshen Store" className="bg-charcoal text-white lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:p-12">
        {/* Ponsel/tablet: header ringkas */}
        <div className="flex items-center gap-3 px-5 py-5 sm:px-8 lg:p-0">
          <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-control bg-white/10 text-section-title font-bold text-denim-200">
            S
          </span>
          <div>
            <p className="text-body-lg font-bold leading-5">Sikoshen Store</p>
            <p className="text-caption text-white/65">Manajemen persediaan pakaian pria · Tanah Abang</p>
          </div>
        </div>

        <div className="hidden lg:block">
          <h2 className="max-w-md text-[32px] font-bold leading-10">Stok toko lebih teratur, keputusan belanja lebih tenang.</h2>
          <ul className="mt-10 space-y-6">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-white/10">
                  <Icon className="h-5 w-5 text-denim-200" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="mt-0.5 text-caption-lg text-white/70">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="hidden text-caption text-white/55 lg:block">Prototipe untuk presentasi · data tiruan</p>
      </section>

      {/* Form */}
      <main className="flex flex-1 items-start justify-center px-5 py-10 sm:px-8 lg:items-center">
        <div className="w-full max-w-[400px]">
          <h1 className="text-[24px] font-bold leading-8 sm:text-page-title">Masuk</h1>
          <p className="mt-1 text-body text-muted">Masuk sebagai Owner untuk melihat stok dan saran persediaan.</p>

          <div className="mt-6 space-y-3" aria-live="polite">
            {showLoggedOut && (
              <Banner tone="success" title="Anda sudah keluar dengan aman." onDismiss={() => setShowLoggedOut(false)} />
            )}
            {locked ? (
              <Banner tone="danger" title="Terlalu banyak percobaan masuk" assertive>
                Demi keamanan, form dikunci sementara. Coba lagi dalam{' '}
                <strong className="tabular">{secondsLeft} detik</strong>.
              </Banner>
            ) : (
              failed && (
                <Banner tone="danger" title="Email atau kata sandi salah" assertive>
                  Periksa kembali lalu coba lagi. Sisa percobaan: {remaining} kali.
                </Banner>
              )
            )}
          </div>

          <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailError(undefined)
              }}
              error={emailError}
              placeholder="nama@toko.id"
              autoFocus
            />
            <div>
              <PasswordInput
                ref={pwRef}
                label="Kata sandi"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setPwError(undefined)
                }}
                error={pwError}
              />
              <div className="mt-1 flex justify-end">
                <Button variant="link" size="sm" onClick={() => setForgotOpen(true)} className="h-9">
                  Lupa kata sandi?
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={checking}
              loadingText="Memeriksa…"
              leftIcon={<LogIn className="h-4 w-4" aria-hidden="true" />}
              disabledReason={locked ? `Form terkunci. Coba lagi dalam ${secondsLeft} detik.` : undefined}
            >
              Masuk
            </Button>
          </form>

          <div className="mt-6 rounded-control border border-border bg-surface p-3 text-caption-lg text-muted">
            <p className="flex items-center gap-1.5 font-semibold text-charcoal">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              Akun demo
            </p>
            <p className="mt-1">
              Email <code className="font-semibold text-charcoal">{DEMO_EMAIL}</code> · Sandi{' '}
              <code className="font-semibold text-charcoal">{DEMO_PASSWORD}</code>
            </p>
          </div>
        </div>
      </main>

      <Modal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Lupa kata sandi"
        size="sm"
        footer={<Button onClick={() => setForgotOpen(false)}>Mengerti</Button>}
      >
        <p className="text-body text-charcoal">
          Hubungi pengelola sistem toko untuk mengatur ulang kata sandi. Fitur atur ulang mandiri belum tersedia di prototipe ini.
        </p>
      </Modal>
    </div>
  )
}
