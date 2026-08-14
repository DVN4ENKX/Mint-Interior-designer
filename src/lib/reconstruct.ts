// клиент Python-сервиса TripoSR (см. reconstructor/)
const BASE = import.meta.env.VITE_RECONSTRUCTOR_URL ?? 'http://localhost:8788'

export type ReconstructStatus = {
  status: 'queued' | 'processing' | 'done' | 'error'
  size?: [number, number, number]
  name?: string
  error?: string
}

const readErr = async (r: Response) => {
  const body = (await r.json().catch(() => ({}))) as { error?: string }
  return body.error ?? `Ошибка ${r.status}`
}

export const startReconstruct = async (image: File, height: number, name: string) => {
  const fd = new FormData()
  fd.append('image', image)
  fd.append('height', String(height))
  fd.append('name', name)
  const r = await fetch(`${BASE}/api/reconstruct`, { method: 'POST', body: fd })
  if (!r.ok) throw new Error(await readErr(r))
  return (await r.json()) as { job_id: string }
}

export const fetchReconstructStatus = async (id: string): Promise<ReconstructStatus> => {
  const r = await fetch(`${BASE}/api/reconstruct/${id}`)
  if (!r.ok) throw new Error(await readErr(r))
  return (await r.json()) as ReconstructStatus
}

export const fetchReconstructFile = async (id: string) => {
  const r = await fetch(`${BASE}/api/reconstruct/${id}/file`)
  if (!r.ok) throw new Error(await readErr(r))
  return r.blob()
}
