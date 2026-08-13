import { useEffect } from 'react'
import Toolbar from './components/Toolbar'
import PlanPanel from './components/PlanPanel'
import ViewportPanel from './components/ViewportPanel'
import CatalogPanel from './components/CatalogPanel'
import { usePlanStore } from './store'

export default function App() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // не перехватываем undo, пока пользователь печатает в input (например, в поиске)
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      if (!(e.ctrlKey || e.metaKey)) return // metaKey — для Mac (Cmd+Z)
      const key = e.key.toLowerCase()

      if (key === 'z') {
        e.preventDefault()
        if (e.shiftKey) usePlanStore.temporal.getState().redo()
        else usePlanStore.temporal.getState().undo()
      } else if (key === 'y') {
        e.preventDefault()
        usePlanStore.temporal.getState().redo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    // cleanup: снимает слушатель при размонтировании, иначе будут дубли
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="app">
      <Toolbar />
      <main className="panels">
        <PlanPanel />
        <ViewportPanel />
        <CatalogPanel />
      </main>
    </div>
  )
}