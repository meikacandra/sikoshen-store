import { Navigate, Outlet, createBrowserRouter, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AppShell } from './components/layout/AppShell'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import ComponentGallery from './pages/ComponentGallery'

/** Route terlindungi: belum masuk → /login (menyimpan tujuan awal). */
function RequireAuth() {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          {
            path: '/dashboard',
            lazy: async () => ({ Component: (await import('./pages/Dashboard')).default }),
          },
          {
            path: '/upload',
            lazy: async () => ({ Component: (await import('./pages/Upload')).default }),
          },
          {
            path: '/produk',
            lazy: async () => ({ Component: (await import('./pages/Products')).default }),
          },
          {
            path: '/produk/:skuId',
            lazy: async () => ({ Component: (await import('./pages/SkuDetail')).default }),
          },
          {
            path: '/klasifikasi',
            lazy: async () => ({ Component: (await import('./pages/Classification')).default }),
          },
          {
            path: '/rekomendasi',
            lazy: async () => ({ Component: (await import('./pages/Recommendations')).default }),
          },
          {
            path: '/laporan',
            lazy: async () => ({ Component: (await import('./pages/Reports')).default }),
          },
          { path: '/komponen', element: <ComponentGallery /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFound /> },
])
