const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '/api/v1'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T = void>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    credentials: 'include',
  })

  if (res.status === 204 || res.headers.get('Content-Length') === '0') {
    return undefined as T
  }

  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`
    try {
      const body = await res.json()
      message = body.message ?? body.title ?? message
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, message)
  }

  return res.json() as Promise<T>
}
