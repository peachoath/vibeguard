import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { queryClient } from '@/lib/queryClient'
import { initPreferences } from '@/lib/preferences'
import { initTheme } from '@/lib/theme'
import App from '@/App'
import '@/index.css'

// 저장된 테마·개인 설정(없으면 기본값)을 첫 렌더 전에 적용.
initTheme()
initPreferences()

/**
 * dev 목 모드: VITE_ENABLE_MOCKS=true 이면 MSW 워커를 켜서 BE 없이 FE 단독 시연.
 * (기본값 off — 실제 BE 프록시 연동에는 영향 없음)
 */
async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  const { worker } = await import('@/mocks/browser')
  await worker.start({ onUnhandledRequest: 'bypass' })
}

enableMocking().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
})
