import { useState } from 'react'

const TOOLS = ['Выбор', 'Стена', 'Дверь', 'Размер'] as const
type Tool = (typeof TOOLS)[number]

export default function Toolbar() {
  const [active, setActive] = useState<Tool>('Выбор')

  return (
    <header className="toolbar">
      {TOOLS.map((t) => (
        <button
          key={t}
          className={t === active ? 'tool active' : 'tool'}
          onClick={() => setActive(t)}
        >
          {t}
        </button>
      ))}
    </header>
  )
}