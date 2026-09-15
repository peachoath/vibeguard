import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { queryClient } from '@/lib/queryClient'
import { initTheme } from '@/lib/theme'
import App from '@/App'
import { Toaster } from '@/components/Toaster'
import { OfflineBanner } from '@/components/OfflineBanner'
import '@/index.css'

initTheme()

async function mount() {
  if (import.meta.env.DEV) {
    const { worker } = await import('@/mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <OfflineBanner />
          <App />
          <Toaster />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
}

mount()
