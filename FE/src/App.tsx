import { Route, Routes } from 'react-router-dom'

/**
 * VibeGuard 앱 쉘. 화면 라우팅은 PRD §8 화면 정의 기준.
 * 각 페이지는 마일스톤에 따라 순차 구현합니다.
 */
function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: 32 }}>
      <h1 style={{ fontFamily: 'var(--font-mono)' }}>🛡️ VibeGuard</h1>
      <p style={{ color: 'var(--color-muted)' }}>{title} — 구현 예정</p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Placeholder title="랜딩" />} />
      <Route path="/repositories" element={<Placeholder title="리포 선택" />} />
      <Route path="/scans/:id" element={<Placeholder title="Finding 목록" />} />
      <Route path="/scans/:id/live" element={<Placeholder title="스캔 진행(SSE)" />} />
      <Route path="/findings/:id" element={<Placeholder title="Finding 상세" />} />
      <Route path="/dashboard" element={<Placeholder title="대시보드" />} />
      <Route path="/history" element={<Placeholder title="스캔 이력" />} />
      <Route path="*" element={<Placeholder title="404" />} />
    </Routes>
  )
}
