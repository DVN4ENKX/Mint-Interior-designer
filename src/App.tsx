import { useEffect, useRef, useState } from 'react'
import Toolbar from './components/Toolbar'
import PlanPanel from './components/PlanPanel'
import ViewportPanel from './components/ViewportPanel'
import CatalogPanel from './components/CatalogPanel'
import CloudPanel from './components/CloudPanel'
import { usePlanStore } from './store'
import type { Persisted } from './store'
import { fetchMe, fetchProject, getToken } from './lib/api'
import { S, MIN_W, clampW } from './lib/plan'

const clampCatalogW = (w: number) =>
  Math.max(160, Math.min(Math.round(window.innerWidth * 0.4), Math.round(w)))

// ручка ресайза между секциями; onResize получает смещение мыши по X
function Resizer({ onResize }: { onResize: (dx: number) => void }) {
  const resizing = useRef(false)
  const startX = useRef(0)
  return (
    <div
      className="plan-resizer"
      onPointerDown={(e) => {
        e.preventDefault()
        resizing.current = true
        startX.current = e.clientX
        e.currentTarget.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (!resizing.current) return
        onResize(e.clientX - startX.current)
        startX.current = e.clientX
      }}
      onPointerUp={(e) => {
        if (!resizing.current) return
        resizing.current = false
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
      onPointerCancel={(e) => {
        if (!resizing.current) return
        resizing.current = false
        e.currentTarget.releasePointerCapture(e.pointerId)
      }}
    />
  )
}

export default function App() {
  const walls = usePlanStore((s) => s.walls)

  // панель плана: видимость, ширина, ручной ресайз (авто-подгонка работает до первого ручного ресайза)
  const [planVisible, setPlanVisible] = useState(true)
  const [planWidth, setPlanWidth] = useState(MIN_W)
  const [planManual, setPlanManual] = useState(false)
  const [catalogVisible, setCatalogVisible] = useState(true)
  const [catalogWidth, setCatalogWidth] = useState(280)

  useEffect(() => {
    if (planManual) return
    let minX = Infinity, maxX = -Infinity
    for (const w of walls) {
      minX = Math.min(minX, w.a.x, w.b.x)
      maxX = Math.max(maxX, w.a.x, w.b.x)
    }
    const span = isFinite(minX) ? maxX - minX + 1.5 : 0
    setPlanWidth(clampW(span > 0 ? Math.ceil(span * S) : MIN_W))
  }, [walls, planManual])

  useEffect(() => {
    const m = window.location.hash.match(/^#p=([0-9a-f-]{36})/i)
    if (!m) return
    const id = m[1]
    fetchProject(id)
      .then((p) => {
        const d = (p.data ?? {}) as Persisted
        usePlanStore.getState().hydrate({
          walls: d.walls ?? [],
          placed: d.placed ?? [],
          underlay: d.underlay ?? null,
          openings: d.openings ?? [],
          customCatalog: d.customCatalog ?? [],
        })
        usePlanStore.getState().setProjectId(p.id)
        if (getToken()) {
          fetchMe()
            .then((u) => usePlanStore.getState().setReadOnly(u.id !== p.owner_id))
            .catch(() => usePlanStore.getState().setReadOnly(true))
        } else {
          usePlanStore.getState().setReadOnly(true)
        }
      })
      .catch(() => alert('Не удалось открыть проект по ссылке'))
  }, [])

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
      <CloudPanel />
      <main className="d-flex flex-grow-1 gap-2 p-2 overflow-hidden">
        {planVisible ? (
          <>
            <PlanPanel width={planWidth} onHide={() => setPlanVisible(false)} />
            <Resizer
              onResize={(dx) => {
                setPlanManual(true)
                setPlanWidth((w) => clampW(w + dx))
              }}
            />
          </>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary align-self-center"
            onClick={() => setPlanVisible(true)}
            title="Показать панель плана"
          >
            📐
          </button>
        )}
        <ViewportPanel />
        {catalogVisible ? (
          <>
            <Resizer onResize={(dx) => setCatalogWidth((w) => clampCatalogW(w - dx))} />
            <CatalogPanel width={catalogWidth} onHide={() => setCatalogVisible(false)} />
          </>
        ) : (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary align-self-center"
            onClick={() => setCatalogVisible(true)}
            title="Показать каталог"
          >
            ☰
          </button>
        )}
      </main>
    </div>
  )
}