import { useEffect, useMemo, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { CATALOG, CATEGORIES } from '../data/catalog'
import { usePlanStore } from '../store'
import {
  fetchReconstructFile,
  fetchReconstructStatus,
  startReconstruct,
} from '../lib/reconstruct'

const orderOf = (cat?: string) => {
  const i = CATEGORIES.indexOf((cat ?? '') as (typeof CATEGORIES)[number])
  return i === -1 ? 99 : i
}

export default function CatalogPanel({
  width,
  onHide,
}: {
  width: number
  onHide: () => void
}) {
  const addToRoom = usePlanStore((s) => s.addToRoom)
  const customCatalog = usePlanStore((s) => s.customCatalog)
  const uploadModel = usePlanStore((s) => s.uploadModel)
  const placed = usePlanStore((s) => s.placed)
  const removeFromRoom = usePlanStore((s) => s.removeFromRoom)
  const clearRoom = usePlanStore((s) => s.clearRoom)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<string>('Все')

  // генерация 3D-модели из фото (TripoSR, см. reconstructor/)
  const [reconOpen, setReconOpen] = useState(false)
  const [reconFile, setReconFile] = useState<File | null>(null)
  const [reconHeight, setReconHeight] = useState('1.0')
  const [reconName, setReconName] = useState('')
  const [reconStatus, setReconStatus] = useState<string | null>(null)
  const [reconBusy, setReconBusy] = useState(false)
  const [reconJob, setReconJob] = useState<string | null>(null)

  // опрос статуса генерации, пока задача не завершится
  useEffect(() => {
    if (!reconJob) return
    const timer = window.setInterval(async () => {
      try {
        const st = await fetchReconstructStatus(reconJob)
        if (st.status === 'done') {
          window.clearInterval(timer)
          const blob = await fetchReconstructFile(reconJob)
          const file = new File(
            [blob],
            `${reconName.trim() || '3D из фото'}.glb`,
            { type: 'model/gltf-binary' },
          )
          await uploadModel(file)
          const size = st.size ? ` (${st.size.map((s) => s.toFixed(2)).join(' × ')} м)` : ''
          setReconStatus(`Готово${size}, модель добавлена в комнату`)
          setReconJob(null)
          setReconBusy(false)
        } else if (st.status === 'error') {
          window.clearInterval(timer)
          setReconStatus(`Ошибка: ${st.error ?? 'неизвестная'}`)
          setReconJob(null)
          setReconBusy(false)
        }
      } catch {
        // сеть недоступна — продолжаем опрашивать
      }
    }, 2000)
    return () => window.clearInterval(timer)
  }, [reconJob, reconName, uploadModel])

  const handleReconstruct = async () => {
    if (!reconFile) return setReconStatus('Выберите фото объекта')
    const h = parseFloat(reconHeight.replace(',', '.'))
    if (!isFinite(h) || h < 0.1 || h > 10)
      return setReconStatus('Высота должна быть в диапазоне 0.1–10 м')
    setReconBusy(true)
    setReconStatus('Отправка фото…')
    try {
      const { job_id } = await startReconstruct(reconFile, h, reconName.trim())
      setReconJob(job_id)
      setReconStatus('Генерация 3D-модели… (на CPU 1–5 минут)')
    } catch (e) {
      setReconStatus(
        e instanceof Error ? e.message : 'Не удалось отправить фото на сервер',
      )
      setReconBusy(false)
    }
  }

  const closeReconstruct = () => {
    setReconOpen(false)
    if (!reconBusy) {
      setReconFile(null)
      setReconStatus(null)
    }
  }

  const all = useMemo(() => [...CATALOG, ...customCatalog], [customCatalog])

  // греем кэш моделей каталога заранее
  useEffect(() => {
    all.forEach((i) => i.modelUrl && useGLTF.preload(i.modelUrl))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((item) => {
      if (cat !== 'Все' && (item.category ?? 'Прочее') !== cat) return false
      return !q || item.name.toLowerCase().includes(q)
    })
  }, [all, query, cat])

  const groups = useMemo(() => {
    const m = new Map<string, typeof visible>()
    for (const item of visible) {
      const c = item.category ?? 'Прочее'
      if (!m.has(c)) m.set(c, [])
      m.get(c)!.push(item)
    }
    return [...m.entries()].sort((a, b) => orderOf(a[0]) - orderOf(b[0]))
  }, [visible])

  const searching = query.trim().length > 0

  return (
    <aside className="card catalog-panel overflow-auto" style={{ width }}>
      <div className="card-header d-flex align-items-center gap-2 py-2">
        <h2 className="h6 mb-0 flex-grow-1">Каталог</h2>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          onClick={onHide}
          title="Скрыть каталог"
        >
          ▶
        </button>
      </div>
      <div className="card-body d-flex flex-column gap-2">
        <input
          className="form-control form-control-sm"
          placeholder="Поиск мебели…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="d-flex flex-wrap gap-1">
          {['Все', ...CATEGORIES, 'Мои модели'].map((c) => (
            <button
              key={c}
              type="button"
              className={`btn btn-sm ${cat === c ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <label className="btn btn-sm btn-outline-secondary w-100 mb-0">
          ⬆ Своя модель (.glb)
          <input
            type="file"
            accept=".glb,.gltf,model/gltf-binary"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) uploadModel(f)
              e.target.value = ''
            }}
          />
        </label>
        <button
          type="button"
          className="btn btn-sm btn-outline-primary w-100"
          onClick={() => setReconOpen(true)}
          title="Сгенерировать 3D-модель из одного фото (TripoSR)"
        >
          📷 3D из фото
        </button>

        {visible.length === 0 && <p className="small text-secondary mb-0">Ничего не найдено</p>}

        {searching &&
          visible.map((item) => (
            <ItemCard key={item.id} item={item} onAdd={() => addToRoom(item)} />
          ))}

        {!searching &&
          groups.map(([category, items]) => (
            <div key={category}>
              <div className="small fw-semibold text-secondary border-bottom mb-1 mt-2">
                {category}
              </div>
              {items.map((item) => (
                <ItemCard key={item.id} item={item} onAdd={() => addToRoom(item)} />
              ))}
            </div>
          ))}

        <div className="border-top pt-2 mt-2">
          <div className="d-flex align-items-center mb-1">
            <span className="small fw-semibold text-secondary flex-grow-1">
              В комнате: {placed.length}
            </span>
            {placed.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger py-0 px-2"
                onClick={() => {
                  if (confirm('Убрать всю мебель из комнаты?')) clearRoom()
                }}
              >
                🗑 Очистить
              </button>
            )}
          </div>
          {placed.map((p) => (
            <div key={p.uid} className="room-row d-flex align-items-center px-2 py-1 mb-1">
              <span className="small flex-grow-1 text-truncate">{p.item.name}</span>
              <span className="small text-secondary me-2">
                {p.item.price > 0 ? p.item.price.toLocaleString('ru-RU') + ' ₽' : ''}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger py-0 px-2"
                onClick={() => removeFromRoom(p.uid)}
                title="Убрать из комнаты"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {reconOpen && (
        <>
          <div className="modal fade show d-block" tabIndex={-1} role="dialog">
            <div className="modal-dialog">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">📷 3D-модель из фото</h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Закрыть"
                    onClick={closeReconstruct}
                    disabled={reconBusy}
                  />
                </div>
                <div className="modal-body d-flex flex-column gap-2">
                  <p className="small text-secondary mb-0">
                    Одно фото объекта (лучше на контрастном фоне) → генерация 3D-модели
                    на сервере (TripoSR). Укажите реальную высоту объекта в метрах — по ней
                    модель получит настоящий масштаб.
                  </p>
                  <input
                    className="form-control form-control-sm"
                    type="file"
                    accept="image/*"
                    disabled={reconBusy}
                    onChange={(e) => {
                      setReconFile(e.target.files?.[0] ?? null)
                      setReconStatus(null)
                    }}
                  />
                  <div className="d-flex gap-2">
                    <input
                      className="form-control form-control-sm"
                      type="number"
                      min="0.1"
                      max="10"
                      step="0.05"
                      value={reconHeight}
                      disabled={reconBusy}
                      onChange={(e) => setReconHeight(e.target.value)}
                      placeholder="Высота, м"
                    />
                    <input
                      className="form-control form-control-sm"
                      type="text"
                      value={reconName}
                      disabled={reconBusy}
                      onChange={(e) => setReconName(e.target.value)}
                      placeholder="Название (необязательно)"
                    />
                  </div>
                  {reconStatus && <div className="small text-primary mb-0">{reconStatus}</div>}
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeReconstruct}
                    disabled={reconBusy}
                  >
                    Закрыть
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleReconstruct}
                    disabled={reconBusy}
                  >
                    {reconBusy ? 'Генерация…' : 'Сгенерировать'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" onClick={closeReconstruct} />
        </>
      )}
    </aside>
  )
}

function ItemCard({ item, onAdd }: { item: (typeof CATALOG)[number]; onAdd: () => void }) {
  return (
    <div className="item-card p-2">
      <div className="fw-semibold small">{item.name}</div>
      <div className="text-secondary" style={{ fontSize: 12 }}>
        {item.size.map((s) => s.toFixed(1)).join(' × ')} м
        {item.modelUrl ? ' · 3D' : ''}
      </div>
      <button className="btn btn-sm btn-primary w-100 mt-2" onClick={onAdd}>
        В комнату
      </button>
    </div>
  )
}
