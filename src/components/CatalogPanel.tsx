import { useState } from 'react'
import { CATALOG } from '../data/catalog'
import { usePlanStore } from '../store'

export default function CatalogPanel() {
  const addToRoom = usePlanStore((s) => s.addToRoom)

  // поиск — локальное состояние, в store ему делать нечего
  const [query, setQuery] = useState('')

  const visible = CATALOG.filter((item) =>
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
      {visible.length === 0 && <p>Ничего не найдено</p>}
      {visible.map((item) => (
        <div key={item.id} className="card">
          <div className="name">{item.name}</div>
          <div className="meta">
            {item.size.map((s) => s.toFixed(1)).join(' × ')} м
          </div>
          <button onClick={() => addToRoom(item)}>В комнату</button>
        </div>
      ))}
    </aside>
  )
}