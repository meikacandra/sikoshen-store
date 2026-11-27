import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ForecastProvider } from './context/ForecastContext'
import { PlannerLayout } from './layout/PlannerLayout'
import Beranda from './pages/Beranda'
import CekKombinasi from './pages/CekKombinasi'
import Masuk from './pages/Masuk'
import PerluPerhatian from './pages/PerluPerhatian'
import PetaPola from './pages/PetaPola'
import SaranPemesanan from './pages/SaranPemesanan'
import UnggahData from './pages/UnggahData'
import './styles/forecast.css'

export default function Website() {
  return (
    <AuthProvider>
      <ForecastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Masuk />} />
            <Route path="/masuk" element={<Masuk />} />
            <Route element={<PlannerLayout />}>
              <Route path="/beranda" element={<Beranda />} />
              <Route path="/dashboard" element={<Beranda />} />
              <Route path="/unggah-data" element={<UnggahData />} />
              <Route path="/saran-pemesanan" element={<SaranPemesanan />} />
              <Route path="/peta-pola" element={<PetaPola />} />
              <Route path="/cek-kombinasi" element={<CekKombinasi />} />
              <Route path="/perlu-perhatian" element={<PerluPerhatian />} />
            </Route>
            <Route path="*" element={<Navigate to="/beranda" replace />} />
          </Routes>
        </BrowserRouter>
      </ForecastProvider>
    </AuthProvider>
  )
}
