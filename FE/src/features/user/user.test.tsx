import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { server } from '@/mocks/server'
import { MyPage } from './MyPage'

function renderMyPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<MyPage />} />
          <Route path="/login" element={<div>로그인 화면</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('마이페이지', () => {
  it('기본으로 프로필 섹션과 좌측 탭을 렌더한다', async () => {
    renderMyPage()
    // 좌측 네비 탭
    expect(screen.getByRole('button', { name: '환경설정' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '스캔 정책' })).toBeInTheDocument()
    // 프로필 섹션(기본 활성)
    expect(await screen.findByText('@octocat')).toBeInTheDocument()
  })

  it('프로필 수정 → 저장하면 PATCH 결과가 반영된다', async () => {
    server.use(
      http.get('/api/v1/users/me', () =>
        HttpResponse.json({
          githubId: 1,
          login: 'octocat',
          displayName: 'octocat',
          email: null,
          avatarUrl: null,
          createdAt: '2026-01-15T09:00:00Z',
        }),
      ),
      http.patch('/api/v1/users/me', () =>
        HttpResponse.json({
          githubId: 1,
          login: 'octocat',
          displayName: 'Octo Cat',
          email: 'octo@example.com',
          avatarUrl: null,
          createdAt: '2026-01-15T09:00:00Z',
        }),
      ),
    )
    const user = userEvent.setup()
    renderMyPage()

    const nameInput = await screen.findByPlaceholderText('octocat')
    await user.clear(nameInput)
    await user.type(nameInput, 'Octo Cat')
    await user.click(screen.getByRole('button', { name: '변경사항 저장' }))

    // 저장 후 표시 이름이 화면(히어로·미리보기)에 반영된다.
    await waitFor(() => expect(screen.getAllByText('Octo Cat').length).toBeGreaterThan(0))
  })

  it('환경설정 탭에서 테마를 선택할 수 있다', async () => {
    const user = userEvent.setup()
    renderMyPage()

    await user.click(screen.getByRole('button', { name: '환경설정' }))
    const dark = await screen.findByRole('radio', { name: /다크/ })
    await user.click(dark)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('계정 탭의 탈퇴 모달은 로그인 아이디를 정확히 입력해야 활성화된다', async () => {
    const user = userEvent.setup()
    renderMyPage()

    await user.click(screen.getByRole('button', { name: '계정' }))
    await user.click(await screen.findByRole('button', { name: '계정 삭제' }))
    const del = screen.getByRole('button', { name: '영구 삭제' })
    expect(del).toBeDisabled()

    await user.type(screen.getByPlaceholderText('octocat'), 'octocat')
    expect(del).toBeEnabled()
  })
})
