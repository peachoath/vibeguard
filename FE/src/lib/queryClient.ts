import { QueryClient } from '@tanstack/react-query'

// 서버 상태는 전부 TanStack Query로 관리 (PRD §8.1)
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})
