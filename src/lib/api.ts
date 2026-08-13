const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'
const TOKEN_KEY = 'room-planner:token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string | null) => {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

export type CloudUser = { id: string; email: string }
export type ProjectData = {
  walls: unknown
  placed: unknown
  underlay: unknown
  openings?: unknown
  customCatalog?: unknown
}

const api = async <T>(path: string, opts: RequestInit = {}): Promise<T> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string> | undefined) ?? {}),
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, { ...opts, headers })
  const body = (await res.json().catch(() => ({}))) as { error?: string } | null
  if (!res.ok) throw new Error(body?.error ?? `Ошибка ${res.status}`)
  return body as T
}

export const register = (email: string, password: string) =>
  api<CloudUser & { token: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

export const login = (email: string, password: string) =>
  api<CloudUser & { token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })

export const fetchMe = () => api<CloudUser>('/api/me')

export const createProject = (data: ProjectData) =>
  api<{ id: string }>('/api/projects', { method: 'POST', body: JSON.stringify({ data }) })

export const saveProject = (id: string, data: ProjectData) =>
  api<{ ok: true }>(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify({ data }) })

export const shareProject = (id: string) =>
  api<{ ok: true }>(`/api/projects/${id}/share`, { method: 'POST' })

export type RemoteProject = {
  id: string
  owner_id: string
  is_public: boolean
  data: ProjectData
}

export const fetchProject = (id: string) => api<RemoteProject>(`/api/projects/${id}`)
