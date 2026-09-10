import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { queryClient } from '@/lib/queryClient'
import { initTheme } from '@/lib/theme'
import App from '@/App'
import '@/index.css'

// 저장된 테마(없으면 라이트)를 첫 렌더 전에 적용. 추후 토글 스위치도 이 상태를 공유한다.
initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
