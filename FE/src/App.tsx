import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/features/auth/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const ScanLivePage      = lazy(() => import('@/features/scan/ScanLivePage').then(m => ({ default: m.ScanLivePage })))
const ScanReportPage    = lazy(() => import('@/features/scan/ScanReportPage').then(m => ({ default: m.ScanReportPage })))
const RepositoriesPage  = lazy(() => import('@/features/repository/RepositoriesPage').then(m => ({ default: m.RepositoriesPage })))
const HistoryPage       = lazy(() => import('@/features/history/HistoryPage').then(m => ({ default: m.HistoryPage })))
const DashboardPage     = lazy(() => import('@/features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })))
const FindingDetailPage = lazy(() => import('@/features/finding/FindingDetailPage').then(m => ({ default: m.FindingDetailPage })))
const NotFoundPage      = lazy(() => import('@/features/common/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

function PageLoader() {
  return <div className="page-loader"><div className="page-loader-bar" /></div>
}

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <Routes>
      {/* 공개: 로그인 화면 */}
      <Route path="/login" element={<LoginPage />} />

      {/* 보호: 인증 가드 + 공통 셸 */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/"              element={<LazyPage><DashboardPage /></LazyPage>} />
          <Route path="/repositories" element={<LazyPage><RepositoriesPage /></LazyPage>} />
          <Route path="/scans/:id"     element={<LazyPage><ScanReportPage /></LazyPage>} />
          <Route path="/scans/:id/live" element={<LazyPage><ScanLivePage /></LazyPage>} />
          <Route path="/history"       element={<LazyPage><HistoryPage /></LazyPage>} />
          <Route path="/findings/:id"  element={<LazyPage><FindingDetailPage /></LazyPage>} />
          <Route path="*"             element={<LazyPage><NotFoundPage /></LazyPage>} />
        </Route>
      </Route>
    </Routes>
  )
}
