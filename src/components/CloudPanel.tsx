import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { usePlanStore } from '../store'
import {
  createProject,
  fetchMe,
  getToken,
  login,
  register,
  saveProject,
  setToken,
  shareProject,
} from '../lib/api'
import type { CloudUser } from '../lib/api'

export default function CloudPanel() {
  const projectId = usePlanStore((s) => s.projectId)
  const setProjectId = usePlanStore((s) => s.setProjectId)
  const readOnly = usePlanStore((s) => s.readOnly)
  const setReadOnly = usePlanStore((s) => s.setReadOnly)
  const walls = usePlanStore((s) => s.walls)
  const placed = usePlanStore((s) => s.placed)
  const underlay = usePlanStore((s) => s.underlay)
  const openings = usePlanStore((s) => s.openings)
  const customCatalog = usePlanStore((s) => s.customCatalog)

  const [user, setUser] = useState<CloudUser | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    if (getToken()) fetchMe().then(setUser).catch(() => setToken(null))
  }, [])

  const planData = () => ({
    walls,
    placed,
    underlay,
    openings,
    customCatalog: customCatalog.map(({ modelUrl: _modelUrl, ...rest }) => rest),
  })

  const saveOrFork = async (): Promise<string> => {
    if (projectId && !readOnly) {
      await saveProject(projectId, planData())
      return projectId
    }
    const { id } = await createProject(planData())
    setProjectId(id)
    setReadOnly(false)
    return id
  }

  const handleSave = async () => {
    if (!user) return setStatus('Сначала войдите в аккаунт')
    setBusy(true)
    try {
      const wasFork = readOnly || !projectId
      await saveOrFork()
      setStatus(wasFork ? 'Создана личная копия (форк)' : 'Сохранено в облако')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Не удалось сохранить')
    } finally {
      setBusy(false)
    }
  }

  const handleShare = async () => {
    if (!user) return setStatus('Сначала войдите в аккаунт')
    setBusy(true)
    try {
      const id = await saveOrFork()
      await shareProject(id)
      const link = `${location.origin}${location.pathname}#p=${id}`
      await navigator.clipboard.writeText(link)
      setStatus('Проект публичный, ссылка скопирована')
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Не удалось поделиться')
    } finally {
      setBusy(false)
    }
  }

  const handleAuth = async (e: FormEvent) => {
    e.preventDefault()
    if (email.trim().length < 3 || password.length < 6)
      return setStatus('Email некорректен или пароль короче 6 символов')
    setBusy(true)
    try {
      const res = mode === 'login' ? await login(email.trim(), password) : await register(email.trim(), password)
      setToken(res.token)
      setUser({ id: res.id, email: res.email })
      setPassword('')
      setStatus(mode === 'login' ? 'Вы вошли' : 'Аккаунт создан')
      setAuthOpen(false)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Ошибка запроса')
    } finally {
      setBusy(false)
    }
  }

  const handleLogout = () => {
    setToken(null)
    setUser(null)
    setProjectId(null)
    setReadOnly(false)
    setStatus('Вы вышли из аккаунта')
  }

  return (
    <div className="cloudbar d-flex align-items-center gap-2 flex-wrap px-3 py-2">
      {user ? (
        <>
          <span className="fw-semibold">☁️ {user.email}</span>
          {projectId && (
            <span className="small text-secondary">
              {readOnly
                ? 'Просмотр по ссылке — сохранение создаст личную копию'
                : `Проект #${projectId.slice(0, 8)}`}
            </span>
          )}
          <span className="ms-auto" />
          <button className="btn btn-sm btn-primary" onClick={handleSave} disabled={busy}>
            {busy ? '…' : '💾 Сохранить'}
          </button>
          <button className="btn btn-sm btn-outline-primary" onClick={handleShare} disabled={busy}>
            🔗 Поделиться
          </button>
          <button className="btn btn-sm btn-outline-secondary" onClick={handleLogout}>
            Выйти
          </button>
        </>
      ) : (
        <>
          <span className="small text-secondary">Облако: сохраняйте проекты и делитесь ссылками</span>
          <span className="ms-auto" />
          <button className="btn btn-sm btn-primary" onClick={() => setAuthOpen(true)}>
            Войти / Зарегистрироваться
          </button>
        </>
      )}
      {status && <span className="small text-primary">{status}</span>}

      {authOpen && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">{mode === 'login' ? 'Вход в аккаунт' : 'Регистрация'}</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Закрыть"
                    onClick={() => setAuthOpen(false)}
                  />
                </div>
                <form onSubmit={handleAuth}>
                  <div className="modal-body d-flex flex-column gap-2">
                    <input
                      className="form-control"
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <input
                      className="form-control"
                      type="password"
                      placeholder="Пароль (6+ символов)"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    {status && <div className="small text-danger mb-0">{status}</div>}
                    <button
                      type="button"
                      className="btn btn-link btn-sm align-self-start p-0"
                      disabled={busy}
                      onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
                    >
                      {mode === 'login' ? 'Нет аккаунта? Создать' : 'Есть аккаунт? Войти'}
                    </button>
                  </div>
                  <div className="modal-footer">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => setAuthOpen(false)}
                    >
                      Отмена
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                      {busy ? '…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={() => setAuthOpen(false)} />
        </>
      )}
    </div>
  )
}
