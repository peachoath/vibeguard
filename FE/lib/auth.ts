export interface AuthUser {
  id: string
  githubId: number
  login: string
  displayName: string
  avatarUrl: string | null
  email: string | null
}
