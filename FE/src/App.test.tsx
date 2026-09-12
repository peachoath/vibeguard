import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from '@/App'

describe('App', () => {
  it('인증된 상태의 랜딩 경로에서 VibeGuard 브랜드를 렌더한다', async () => {
    // '/' 는 이제 인증 가드 하위이며 /auth/me 를 조회한다. 기본 MSW 핸들러가 인증됨을 반환.
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    // 헤더 브랜드 + 화면 제목 두 군데에 나타난다.
    expect((await screen.findAllByText(/VibeGuard/)).length).toBeGreaterThan(0)
  })
})
