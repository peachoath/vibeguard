import { mergeConfig, defineConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Vitest는 이 파일을 우선 사용합니다. 빌드(tsc -b)는 vite.config.ts만 타입체크합니다.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
    },
  }),
)
