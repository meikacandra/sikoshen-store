import { RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AuthProvider } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { DemoProvider } from './context/DemoContext'
import { ToastProvider } from './context/ToastContext'
import { ClassificationProcessProvider } from './context/ClassificationProcessContext'
import { router } from './router'

export default function App() {
  return (
    // reducedMotion="user": Framer Motion mengikuti prefers-reduced-motion
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <DataProvider>
          <ToastProvider>
            <DemoProvider>
              <ClassificationProcessProvider>
                <RouterProvider router={router} />
              </ClassificationProcessProvider>
            </DemoProvider>
          </ToastProvider>
        </DataProvider>
      </AuthProvider>
    </MotionConfig>
  )
}
