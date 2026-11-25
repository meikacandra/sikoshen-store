import { Compass, LayoutDashboard } from 'lucide-react'
import { ButtonLink, EmptyState } from '../components/ui'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface p-4">
      <div className="w-full max-w-lg rounded-card border border-border bg-white shadow-card">
        <EmptyState
          icon={Compass}
          title="Halaman tidak ditemukan"
          description="Alamat yang Anda buka tidak ada atau sudah dipindahkan."
          action={
            <ButtonLink to="/dashboard" leftIcon={<LayoutDashboard className="h-4 w-4" aria-hidden="true" />}>
              Kembali ke Dashboard
            </ButtonLink>
          }
        />
      </div>
    </div>
  )
}
