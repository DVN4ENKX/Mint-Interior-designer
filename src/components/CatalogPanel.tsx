import { useEffect, useMemo, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { CATALOG, CATEGORIES } from '../data/catalog'
import { usePlanStore } from '../store'

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
