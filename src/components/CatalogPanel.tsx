import { useState } from 'react'
import type { CatalogItem } from '../types'

type Props = {
  catalog: CatalogItem[]
  onAdd: (item: CatalogItem) => void
}

export default function CatalogPanel({ catalog, onAdd }: Props) {
  // Поиск — локальное состояние: оно не интересует никого, кроме каталога
  const [query, setQuery] = useState('')

  const visible = catalog.filter((item) =>
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
          <div className="meta">{item.size.map((s) => s.toFixed(1)).join(' × ')} м</div>
          <button onClick={() => onAdd(item)}>В комнату</button>
        </div>
      ))}
    </aside>
  )
}