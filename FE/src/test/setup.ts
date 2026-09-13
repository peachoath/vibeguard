import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetMockState } from '@/mocks/handlers'
import { server } from '@/mocks/server'

// MSW: 테스트 중 네트워크 목킹 (PRD §12 — MSW)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => { server.resetHandlers(); resetMockState() })
afterAll(() => server.close())
