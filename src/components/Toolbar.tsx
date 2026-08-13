import { useStore } from 'zustand'
import { usePlanStore } from '../store'
import type { Tool } from '../types'

const TOOLS: Tool[] = ['Выбор', 'Стена', 'Дверь', 'Размер']

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

  return (
    <header className="toolbar">
      {TOOLS.map((t) => (
        <button key={t} className={t === tool ? 'tool active' : 'tool'} onClick={() => setTool(t)}>
          {t}
        </button>
      ))}
      <span className="spacer" />
      <button className="tool" onClick={screenshot}>📷 PNG</button>
      <button className="tool" onClick={() => usePlanStore.getState().exportJson()}>💾 Экспорт</button>
      <label className="tool">
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
      <button className="tool" disabled={!canUndo}
        onClick={() => usePlanStore.temporal.getState().undo()}>↩</button>
      <button className="tool" disabled={!canRedo}
        onClick={() => usePlanStore.temporal.getState().redo()}>↪</button>
    </header>
  )
}