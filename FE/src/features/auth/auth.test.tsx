import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { server } from '@/mocks/server'
import { LoginPage } from './LoginPage'
import { RequireAuth } from './RequireAuth'

function renderApp(initialPath: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/dashboard" element={<div>보호된 대시보드</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const unauthenticated = () =>
  server.use(http.get('/api/v1/auth/me', () => new HttpResponse(null, { status: 401 })))

describe('인증 플로우', () => {
  it('미인증 상태에서 로그인 페이지는 GitHub 로그인 버튼을 보여준다', async () => {
    unauthenticated()
    renderApp('/login')
    expect(await screen.findByRole('button', { name: /GitHub으로 로그인/ })).toBeInTheDocument()
  })

  it('인증된 상태에서 보호 라우트를 렌더한다', async () => {
    // 기본 MSW 핸들러가 인증됨을 반환.
    renderApp('/dashboard')
    expect(await screen.findByText('보호된 대시보드')).toBeInTheDocument()
  })

  it('미인증 상태에서 보호 라우트는 로그인으로 리다이렉트한다', async () => {
    unauthenticated()
    renderApp('/dashboard')
    expect(await screen.findByRole('button', { name: /GitHub으로 로그인/ })).toBeInTheDocument()
    expect(screen.queryByText('보호된 대시보드')).not.toBeInTheDocument()
  })
})
