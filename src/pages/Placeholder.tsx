import { Hammer, Shapes } from 'lucide-react'
import { PageHeader } from '../components/layout/PageHeader'
import { ButtonLink, Card, EmptyState } from '../components/ui'

/** Pengganti sementara untuk halaman yang dibangun di fase berikutnya. */
export default function Placeholder({ title, phase, description }: { title: string; phase: number; description: string }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card>
        <EmptyState
          icon={Hammer}
          title={`Dibangun pada Fase ${phase}`}
          description="Kerangka navigasi, topbar, dan transisi halaman sudah aktif. Isi halaman ini menyusul."
          action={
            <ButtonLink to="/komponen" variant="secondary" leftIcon={<Shapes className="h-4 w-4" aria-hidden="true" />}>
              Lihat galeri komponen
            </ButtonLink>
          }
        />
      </Card>
    </>
  )
}
