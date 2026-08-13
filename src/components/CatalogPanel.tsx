import { useEffect, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { CATALOG } from '../data/catalog'
import { usePlanStore } from '../store'

export default function CatalogPanel() {
  const addToRoom = usePlanStore((s) => s.addToRoom)
  const customCatalog = usePlanStore((s) => s.customCatalog)
  const uploadModel = usePlanStore((s) => s.uploadModel)
  const [query, setQuery] = useState('')

  const all = [...CATALOG, ...customCatalog]

  // греем кэш моделей каталога заранее
  useEffect(() => {
    all.forEach((i) => i.modelUrl && useGLTF.preload(i.modelUrl))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const visible = all.filter((item) =>
    item.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <aside className="panel">
      <h2>Каталог</h2>
      <input
        className="search"
        placeholder="Поиск мебели…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <label className="tool upload">
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
      {visible.length === 0 && <p>Ничего не найдено</p>}
      {visible.map((item) => (
        <div key={item.id} className="card">
          <div className="name">{item.name}</div>
          <div className="meta">
            {item.size.map((s) => s.toFixed(1)).join(' × ')} м
            {item.modelUrl ? ' · 3D' : ''}
          </div>
          <button onClick={() => addToRoom(item)}>В комнату</button>
        </div>
      ))}
    </aside>
  )
}