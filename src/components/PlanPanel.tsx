import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Line, Circle, Text, Image as KonvaImage } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { usePlanStore } from '../store'
import type { Point, Tool } from '../types'

const S = 50 // пикселей в одном метре

const snap = (v: number) => Math.round(v * 10) / 10
const snapP = (p: Point): Point => ({ x: snap(p.x), y: snap(p.y) })
const dist = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y)

// доводка до оси: почти вертикаль/горизонталь становится точной
const snapAxis = (a: Point, p: Point): Point => {
  if (Math.abs(p.x - a.x) < 0.15) return { x: a.x, y: snap(p.y) }
  if (Math.abs(p.y - a.y) < 0.15) return { x: snap(p.x), y: a.y }
  return snapP(p)
}

const HINTS: Record<Tool, string> = {
  Выбор: 'Клик — выбрать стену. Узлы можно таскать. Delete — удалить.',
  Стена: 'Клики — точки стены (цепочкой). Двойной клик или Esc — закончить.',
  Дверь: 'Появится в следующем уроке.',
  Размер: 'Две точки на фото плана + реальная длина = масштаб подложки.',
}

type StageEvt = KonvaEventObject<MouseEvent | DragEvent>

export default function PlanPanel() {
  const tool = usePlanStore((s) => s.tool)
  const walls = usePlanStore((s) => s.walls)
  const addWall = usePlanStore((s) => s.addWall)
  const updateWallEnd = usePlanStore((s) => s.updateWallEnd)
  const removeWall = usePlanStore((s) => s.removeWall)
  const selectedWallId = usePlanStore((s) => s.selectedWallId)
  const selectWall = usePlanStore((s) => s.selectWall)
  const underlay = usePlanStore((s) => s.underlay)
  const setUnderlay = usePlanStore((s) => s.setUnderlay)
  const calibrateUnderlay = usePlanStore((s) => s.calibrateUnderlay)

  // размер холста по контейнеру
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 600, h: 500 })
  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const ro = new ResizeObserver(() =>
      setSize({ w: el.clientWidth, h: el.clientHeight }),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // «живое» состояние редактора — в store оно никому больше не нужно
  const [draft, setDraft] = useState<Point | null>(null)
  const [cursor, setCursor] = useState<Point | null>(null)
  const [calibA, setCalibA] = useState<Point | null>(null)

  // смена инструмента сбрасывает черновики
  useEffect(() => {
    setDraft(null)
    setCalibA(null)
  }, [tool])

  // картинка подложки
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!underlay) {
      setImg(null)
      return
    }
    const image = new window.Image()
    image.src = underlay.url
    image.onload = () => setImg(image)
  }, [underlay?.url])

  // Esc / Delete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') {
        setDraft(null)
        setCalibA(null)
        selectWall(null)
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWallId) {
        removeWall(selectedWallId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedWallId, removeWall, selectWall])

  const toMeters = (e: StageEvt): Point => {
    const pos = e.target.getStage()?.getPointerPosition()
    return pos ? { x: pos.x / S, y: pos.y / S } : { x: 0, y: 0 }
  }

  const onClick = (e: StageEvt) => {
    if (tool === 'Стена') {
      const p = toMeters(e)
      if (!draft) {
        setDraft(snapP(p))
        return
      }
      const b = snapAxis(draft, p)
      if (dist(draft, b) < 0.05) return
      addWall(draft, b)
      setDraft(b) // цепочка продолжается от последней точки
      return
    }

    if (tool === 'Размер') {
      if (!underlay) return
      const p = toMeters(e)
      if (!calibA) {
        setCalibA(p)
        return
      }
      const lPx = dist(calibA, p) * S
      setCalibA(null)
      if (lPx < 8) return
      const input = window.prompt('Реальное расстояние между точками, м:', '2.5')
      const d = parseFloat((input ?? '').replace(',', '.'))
      if (!isFinite(d) || d <= 0) return
      const sDraw = underlay.metersPerPx * S
      calibrateUnderlay((d * sDraw) / lPx)
      return
    }

    if (tool === 'Выбор') selectWall(null) // клик по пустому месту — снять выделение
  }

  const selected = walls.find((w) => w.id === selectedWallId) ?? null
  const imageScale = underlay ? underlay.metersPerPx * S : 1
  const preview = draft && cursor ? snapAxis(draft, cursor) : null

  // сетка с шагом 0.5 м
  const grid: React.ReactNode[] = []
  for (let x = 0; x <= size.w; x += 0.5 * S)
    grid.push(<Line key={`v${x}`} points={[x, 0, x, size.h]} stroke="#eee" listening={false} />)
  for (let y = 0; y <= size.h; y += 0.5 * S)
    grid.push(<Line key={`h${y}`} points={[0, y, size.w, y]} stroke="#eee" listening={false} />)

  return (
    <section className="panel plan">
      <div className="plan-head">
        <label className="tool">
          📷 План
          <input
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
  const f = e.target.files?.[0]
  if (!f) return
  const reader = new FileReader()
  reader.onload = () => setUnderlay(String(reader.result))
  reader.readAsDataURL(f)
  e.target.value = ''
}}
          />
        </label>
        <span className="hint">{HINTS[tool]}</span>
      </div>

      <div className="plan-canvas" ref={boxRef}>
        <Stage
          width={size.w}
          height={size.h}
          onClick={onClick}
          onDblClick={() => setDraft(null)}
          onMouseMove={(e) => setCursor(toMeters(e))}
          onMouseLeave={() => setCursor(null)}
        >
          <Layer>
            {grid}

            {img && underlay && (
              <KonvaImage image={img} scaleX={imageScale} scaleY={imageScale} opacity={0.6} />
            )}

            {/* стены */}
            {walls.map((w) => (
              <Line
                key={w.id}
                points={[w.a.x * S, w.a.y * S, w.b.x * S, w.b.y * S]}
                stroke={w.id === selectedWallId ? '#2563eb' : '#333'}
                strokeWidth={6}
                lineCap="round"
                hitStrokeWidth={14}
                onClick={(e) => {
                  if (tool !== 'Выбор') return
                  e.cancelBubble = true // не давать клику дойти до Stage (иначе снятие выделения)
                  selectWall(w.id)
                }}
              />
            ))}

            {/* размеры */}
            {walls.map((w) => (
              <Text
                key={w.id + 't'}
                x={((w.a.x + w.b.x) / 2) * S + 6}
                y={((w.a.y + w.b.y) / 2) * S - 16}
                text={`${dist(w.a, w.b).toFixed(2)} м`}
                fontSize={11}
                fill="#777"
                listening={false}
              />
            ))}

            {/* превью рисуемой стены */}
            {tool === 'Стена' && draft && preview && (
              <Line
                points={[draft.x * S, draft.y * S, preview.x * S, preview.y * S]}
                stroke="#2563eb"
                strokeWidth={2}
                dash={[6, 4]}
                listening={false}
              />
            )}
            {tool === 'Стена' && draft && (
              <Circle x={draft.x * S} y={draft.y * S} radius={4} fill="#2563eb" listening={false} />
            )}

            {/* линия калибровки */}
            {tool === 'Размер' && calibA && cursor && (
              <Line
                points={[calibA.x * S, calibA.y * S, cursor.x * S, cursor.y * S]}
                stroke="#dc2626"
                strokeWidth={1.5}
                dash={[4, 3]}
                listening={false}
              />
            )}

            {/* ручки выбранной стены */}
            {selected &&
              (['a', 'b'] as const).map((end) => (
                <Circle
                  key={end}
                  x={selected[end].x * S}
                  y={selected[end].y * S}
                  radius={6}
                  fill="#fff"
                  stroke="#2563eb"
                  strokeWidth={2}
                  draggable
                  onDragMove={(e) =>
                    updateWallEnd(selected.id, end, snapP(toMeters(e)))
                  }
                />
              ))}
          </Layer>
        </Stage>
      </div>
    </section>
  )
}