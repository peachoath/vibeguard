/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** REST 베이스 URL. dev는 프록시로 '/api/v1', 배포는 BE 호스트 주입 (AI_Learn_First §9). */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
