import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/features/auth/AppLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { RequireAuth } from '@/features/auth/RequireAuth'

/**
 * VibeGuard 앱 쉘. 화면 라우팅은 PRD §8 화면 정의 기준.
 * 각 페이지는 마일스톤에 따라 순차 구현합니다.
 */
function Placeholder({ title }: { title: string }) {
  return <div className="page-placeholder">{title} — 구현 예정</div>
}

export default function App() {
  return (
    <Routes>
      {/* 공개: 로그인 화면 (유일한 미인증 접근 경로) */}
      <Route path="/login" element={<LoginPage />} />

      {/* 보호: 인증 가드 + 공통 셸(헤더/로그아웃) 하위에 전체 화면 배치 */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Placeholder title="랜딩" />} />
          <Route path="/repositories" element={<Placeholder title="리포 선택" />} />
          <Route path="/scans/:id" element={<Placeholder title="Finding 목록" />} />
          <Route path="/scans/:id/live" element={<Placeholder title="스캔 진행(SSE)" />} />
          <Route path="/findings/:id" element={<Placeholder title="Finding 상세" />} />
          <Route path="/dashboard" element={<Placeholder title="대시보드" />} />
          <Route path="/history" element={<Placeholder title="스캔 이력" />} />
          <Route path="*" element={<Placeholder title="404" />} />
        </Route>
      </Route>
    </Routes>
  )
}
