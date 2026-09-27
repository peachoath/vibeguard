import type { Metadata } from 'next'
import './globals.css'
import PageTransition from './components/page-transition'
import { Providers } from './components/providers'

export const metadata: Metadata = {
  title: 'VibeGuard',
  description: '취약점은 줄이고 기능은 그대로. 검증부터 회귀 테스트와 PR 생성까지 자동화합니다.',
  icons: {
    icon: '/vibeguard-icon.png',
  },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body>
        <Providers>
          <PageTransition>{children}</PageTransition>
        </Providers>
      </body>
    </html>
  )
}
