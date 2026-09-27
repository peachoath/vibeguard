import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Spring Boot 백엔드로 API 요청 프록시 (개발 환경)
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:8080/api/v1/:path*',
      },
      {
        source: '/oauth2/:path*',
        destination: 'http://localhost:8080/oauth2/:path*',
      },
    ]
  },
  images: {
    // GitHub 아바타 이미지 허용
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
}

export default nextConfig
