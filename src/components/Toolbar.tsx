import { useState } from 'react'
import { useStore } from 'zustand'
import { usePlanStore } from '../store'
import type { Tool } from '../types'
import TemplateModal from './TemplateModal'

const TOOLS: Tool[] = ['Выбор', 'Стена', 'Дверь', 'Окно', 'Размер']

const screenshot = () => {
  const canvas = document.querySelector('canvas') as HTMLCanvasElement | null
  if (!canvas) return
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = 'room-plan.png'
  a.click()
}

export default function Toolbar() {
  const tool = usePlanStore((s) => s.tool)
  const setTool = usePlanStore((s) => s.setTool)
  const canUndo = useStore(usePlanStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(usePlanStore.temporal, (s) => s.futureStates.length > 0)
  const [tplOpen, setTplOpen] = useState(false)

  return (
    <header className="toolbar d-flex align-items-center gap-2 flex-wrap px-3 py-2">
      <span className="app-title me-1">🏠 Room Planner</span>
      <div className="btn-group btn-group-sm">
        {TOOLS.map((t) => (
          <button
            key={t}
            className={`btn ${t === tool ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => setTool(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="btn-group btn-group-sm ms-auto">
        <button className="btn btn-outline-secondary" onClick={() => setTplOpen(true)}>🏗 Шаблоны</button>
        <button className="btn btn-outline-secondary" onClick={screenshot}>📷 PNG</button>
        <button className="btn btn-outline-secondary" onClick={() => usePlanStore.getState().exportJson()}>💾 Экспорт</button>
        <label className="btn btn-outline-secondary mb-0">
          📂 Импорт
          <input
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) usePlanStore.getState().importJson(f)
              e.target.value = ''
            }}
          />
        </label>
        <button className="btn btn-outline-secondary" disabled={!canUndo}
          onClick={() => usePlanStore.temporal.getState().undo()}>↩</button>
        <button className="btn btn-outline-secondary" disabled={!canRedo}
          onClick={() => usePlanStore.temporal.getState().redo()}>↪</button>
      </div>
      <div className="btn-group btn-group-sm">
        <button
          className="btn btn-outline-danger"
          onClick={() => {
            if (confirm('Очистить все стены (и проёмы)?')) usePlanStore.getState().clearWalls()
          }}
        >
          🧱 Стены
        </button>
        <button
          className="btn btn-outline-danger"
          onClick={() => {
            if (confirm('Убрать всю мебель из комнаты?')) usePlanStore.getState().clearRoom()
          }}
        >
          🪑 Мебель
        </button>
      </div>
      <TemplateModal open={tplOpen} onClose={() => setTplOpen(false)} />
    </header>
  )
}
