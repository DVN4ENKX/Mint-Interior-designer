import { useStore } from 'zustand'
import { usePlanStore } from '../store'
import type { Tool } from '../types'

const TOOLS: Tool[] = ['Выбор', 'Стена', 'Дверь', 'Размер']

export default function Toolbar() {
  const tool = usePlanStore((s) => s.tool)
  const setTool = usePlanStore((s) => s.setTool)
  const canUndo = useStore(usePlanStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(usePlanStore.temporal, (s) => s.futureStates.length > 0)

  return (
    <header className="toolbar">
      {TOOLS.map((t) => (
        <button
          key={t}
          className={t === tool ? 'tool active' : 'tool'}
          onClick={() => setTool(t)}
        >
          {t}
        </button>
      ))}
      <span className="spacer" />
      <button className="tool" disabled={!canUndo}
        onClick={() => usePlanStore.temporal.getState().undo()}>↩ Назад</button>
      <button className="tool" disabled={!canRedo}
        onClick={() => usePlanStore.temporal.getState().redo()}>↪ Вперёд</button>
    </header>
  )
}