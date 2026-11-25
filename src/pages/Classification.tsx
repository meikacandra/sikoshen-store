import { useState } from 'react'
import { ArrowRight, ClipboardList, Play, UploadCloud } from 'lucide-react'
import { ConfusionMatrix } from '../components/charts/ConfusionMatrix'
import { FeatureImportance } from '../components/charts/FeatureImportance'
import { ClassificationHistory } from '../components/inventory/ClassificationHistory'
import { ClassificationResults } from '../components/inventory/ClassificationResults'
import { ProcessProgress } from '../components/inventory/ProcessProgress'
import { PageHeader } from '../components/layout/PageHeader'
import { Banner, Button, ButtonLink, Card, CardHeader, Checkbox, ConfirmDialog, EmptyState, HelpTip, LabelChip, StatusChip } from '../components/ui'
import { useClassificationProcess } from '../context/ClassificationProcessContext'
import { useData } from '../context/DataContext'
import { classificationSteps } from '../lib/classifyInventory'
import { formatDateTime, formatNumber, formatPeriod } from '../lib/format'
import { skuPath } from '../lib/inventoryViews'

const decimal2 = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function formatPercent(value: number) {
  return `${decimal2.format(value)}%`
}

export default function Classification() {
  const { inventory, products, model, classifications, status } = useData()
  const process = useClassificationProcess()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [simulateFailure, setSimulateFailure] = useState(false)
  const [withoutLeakage, setWithoutLeakage] = useState(false)
  const skus = inventory.skus
  const recognized = skus.filter((sku) => sku.recognizedByModel)
  const analyzable = recognized.filter((sku) => sku.historyMonths >= 3)
  const shortHistory = skus.filter((sku) => sku.historyMonths < 3)
  const unknown = skus.filter((sku) => !sku.recognizedByModel)
  const withoutLabel = skus.filter((sku) => !sku.label)
  const running = process.status === 'running'
  const latest = classifications[0]
  const stale = status.lastUpload > status.lastClassification
  const stats = [
    { label: 'Periode data', value: formatPeriod(status.periodStart, status.periodEnd) },
    { label: 'SKU siap dianalisis', value: formatNumber(analyzable.length) },
    { label: 'Dikenali model', value: `${formatNumber(recognized.length)} dari ${formatNumber(skus.length)}` },
    { label: 'Klasifikasi terakhir', value: latest ? formatDateTime(latest.at) : 'Belum pernah dijalankan' },
  ]
  const unavailable = running ? 'Klasifikasi sedang berjalan.'
    : !analyzable.length ? 'Butuh SKU yang dikenali model dengan riwayat minimal tiga bulan.' : undefined

  return (
    <>
      <PageHeader title="Klasifikasi Pergerakan" description="Lihat label Fast-Moving dan Slow-Moving dari riwayat kartu stok." />
      <div className="space-y-6">
        {!skus.length ? <Card>
          <EmptyState icon={ClipboardList} title="Belum ada data untuk diklasifikasikan" description="Siapkan kartu stok untuk memulai."
            steps={['Siapkan kartu stok.', 'Unggah dan periksa file.', 'Jalankan klasifikasi saat data siap.']}
            action={<ButtonLink to="/upload" leftIcon={<UploadCloud size={18} />}>Unggah kartu stok</ButtonLink>} />
        </Card> : <>
          <Card>
            <CardHeader title="Kesiapan data"
              action={<Button leftIcon={<Play size={17} />} onClick={() => setConfirmOpen(true)} disabledReason={unavailable}>Jalankan ulang klasifikasi</Button>} />
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {stats.map(({ label, value }) => (
                <div key={label} className="min-w-0 rounded-control border border-border bg-surface p-3">
                  <dt className="text-caption-lg text-muted">{label}</dt><dd className="mt-1 break-words font-bold">{value}</dd>
                </div>
              ))}
            </dl>
            {running ? <div className="mt-5"><ProcessProgress steps={classificationSteps} progress={process.progress} currentStep={process.currentStep} onCancel={process.cancel} /></div>
              : <div className="mt-4"><Checkbox label="Simulasikan kegagalan klasifikasi berikutnya" checked={simulateFailure} onChange={setSimulateFailure} /></div>}
          </Card>

          {process.status === 'failed' && <Banner tone="danger" title="Klasifikasi gagal" assertive
            actions={<Button variant="secondary" onClick={() => process.start()} disabledReason={unavailable}>Coba lagi</Button>}>
            Tidak ada data yang berubah. Kode kejadian <code>{process.errorCode}</code>.
          </Banner>}
          {process.status === 'success' && latest && !stale && <Banner tone="success" title="Klasifikasi selesai"
            actions={<ButtonLink to="/rekomendasi" variant="secondary" rightIcon={<ArrowRight size={16} />}>Lihat rekomendasi</ButtonLink>}>
            <p className="mb-2">Hasil label dan rekomendasi diperbarui pada {formatDateTime(latest.at)}.</p>
            <StatusChip kind="tone" tone="success" label={`${latest.changes.length} SKU berubah label`} />
          </Banner>}
          {stale && <Banner tone="warning" title="Data stok lebih baru dari hasil klasifikasi">
            Jalankan ulang klasifikasi agar label memakai periode terbaru.
          </Banner>}

          {!!(shortHistory.length || unknown.length) && <Banner tone="warning" title={`${withoutLabel.length} SKU belum diklasifikasikan`}>
            {!!shortHistory.length && <p>Riwayat minimal tiga bulan diperlukan untuk memberi label.</p>}
            {!!unknown.length && <p>Tim pengembang perlu melatih ulang model untuk mengenali varian atau jenis baru. SKU lain tetap dapat diproses.</p>}
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {withoutLabel.slice(0, 5).map((sku) => <li key={sku.id}>
                <ButtonLink to={skuPath(sku.id)} variant="link" size="sm">{sku.id}</ButtonLink> · riwayat {sku.historyMonths} bulan
              </li>)}
            </ul>
          </Banner>}
        </>}

        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Bagaimana label & prediksi ditentukan?" />
            <ol className="mb-4 space-y-3">
              {[
                ['Ciri SKU (Model A — Klasifikasi)', 'Jenis produk, varian warna (one-hot), dan urutan ukuran diproses oleh Random Forest Classifier tanpa fitur stok agar bebas target leakage.'],
                ['Pola musiman & lag (Model B — Regresi)', 'Random Forest Regressor (300 pohon) memakai penjualan 1–6 bulan lalu dan kalender Ramadan/Lebaran untuk memprediksi penjualan bulan depan.'],
                ['Stok pengaman & saran pesan', 'Saran pesan dihitung dari prediksi penjualan ditambah stok pengaman (Z × RMSE SKU) dikurangi stok saat ini.'],
              ].map(([title, detail], index) => (
                <li key={title} className="flex gap-3">
                  <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-denim-50 text-caption-lg font-bold text-denim">{index + 1}</span>
                  <div><p className="font-semibold">{title}</p><p className="text-caption-lg text-muted">{detail}</p></div>
                </li>
              ))}
            </ol>
            <div className="mb-4 flex flex-wrap gap-2"><LabelChip value="fast" /><LabelChip value="slow" /></div>
            {model.regression && (
              <div className="rounded-control border border-border bg-surface p-3 text-caption-lg">
                <p className="font-semibold text-charcoal">Model B: Prediksi Bulan Depan ({model.regression.predictionMonth})</p>
                <p className="mt-1 text-muted">
                  MAE <strong className="text-charcoal">{decimal2.format(model.regression.mae)} unit</strong> ·
                  RMSE <strong className="text-charcoal">{decimal2.format(model.regression.rmse)} unit</strong> ·
                  WAPE <strong className="text-charcoal">{decimal2.format(model.regression.wape * 100)}%</strong> ·
                  Z = <strong className="text-charcoal">{decimal2.format(model.regression.zService)}</strong>
                </p>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Seberapa tepat modelnya?" description={`${model.correctLabels} dari ${model.testSkuCount} SKU uji diberi label dengan tepat.`} />
            <dl className="mb-4 grid grid-cols-2 gap-3 text-caption-lg">
              <div><dt className="text-muted">Akurasi <HelpTip label="akurasi">Persentase semua SKU uji yang diberi label dengan benar. RF Default maupun RF Tuned (100 pohon, kedalaman maks. 10) sama-sama mencapai 96,15% (25/26).</HelpTip></dt>
                <dd className="tabular font-bold">{formatPercent(model.accuracyPercent)}</dd></div>
              <div><dt className="text-muted">Recall <HelpTip label="recall">Bagian dari SKU yang sebenarnya Fast atau Slow yang berhasil dikenali dengan label yang tepat.</HelpTip></dt>
                <dd className="tabular font-bold">Fast {decimal2.format(model.fastRecall)} · Slow {decimal2.format(model.slowRecall)}</dd></div>
              <div><dt className="text-muted">Validasi silang <HelpTip label="validasi silang">StratifiedKFold (shuffle, random_state=42) menghasilkan 90,79% ± 5,79%. Perbedaan dengan GridSearchCV 5-fold tanpa shuffle (88%–90%) berasal dari pembagian fold, bukan dari perubahan model.</HelpTip></dt>
                <dd className="tabular font-bold">{formatPercent(model.crossValidation.averagePercent)} ± {formatPercent(model.crossValidation.standardDeviationPercent)}</dd></div>
              <div><dt className="text-muted">MAE (estimasi keluar)</dt><dd className="font-semibold">{withoutLeakage ? model.noLeakageMetrics.mae : model.mae}</dd></div>
            </dl>
            <ConfusionMatrix matrix={model.confusionMatrix} />
            <p className="mt-3 text-caption-lg text-muted">
              Data uji hanya {model.testSkuCount} SKU. RF Default (CV 5-fold 93%) dan RF Tuned (CV 5-fold 90%) sama-sama mencapai 96,15% pada data uji, sehingga keunggulan berasal dari algoritma Random Forest, bukan semata dari tuning.
            </p>
          </Card>
        </div>

        {!!skus.length && <ClassificationResults skus={skus} products={products} />}

        <Card>
          <CardHeader
            title="Pengaruh fitur"
            description={`Perkiraan pengaruh masukan pada ${model.algorithm}. ${model.trees} pohon dengan kedalaman maksimum ${model.maxDepth}. Model dilatih dengan ${model.trainSkuCount} SKU.`}
            action={
              <Checkbox
                label="Uji tanpa fitur bocor (tanpa Total barang masuk)"
                checked={withoutLeakage}
                onChange={setWithoutLeakage}
              />
            }
          />
          {withoutLeakage && (
            <Banner className="mb-4" tone="info" title="Pengujian Regressor tanpa fitur Total barang masuk (7 fitur)">
              Tanpa fitur <strong>Total barang masuk</strong>, fitur <strong>Naik-turun stok (0,64)</strong> menjadi penentu utama. Akurasi label pada data uji tetap tinggi di <strong>{formatPercent(model.noLeakageMetrics.accuracyPercent)}</strong> dengan MAE estimasi total keluar <strong>{model.noLeakageMetrics.mae}</strong>.
            </Banner>
          )}
          <FeatureImportance items={withoutLeakage ? model.featureImportanceNoLeakage : model.featureImportance} />
        </Card>

        <ClassificationHistory records={classifications} />
      </div>

      <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Jalankan ulang klasifikasi?"
        description={`${analyzable.length} SKU siap dianalisis. Label dan rekomendasi akan diperbarui setelah proses selesai.`}
        confirmLabel="Jalankan klasifikasi" onConfirm={() => {
          process.start(simulateFailure)
          setSimulateFailure(false)
          setConfirmOpen(false)
        }} />
    </>
  )
}
