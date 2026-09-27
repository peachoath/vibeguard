const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (res.status === 401) {
    throw new ApiError(401, 'Unauthorized')
  }
  if (!res.ok) {
    throw new ApiError(res.status, `API error ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export function apiSseUrl(path: string): string {
  return `${API_BASE}${path}`
}
