import { Fragment, useEffect, useRef, useState } from 'react'
import { Stage, Layer, Line, Circle, Text, Image as KonvaImage, Rect, Arc } from 'react-konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { usePlanStore } from '../store'
import { S } from '../lib/plan'
import type { Opening, Point, Tool, Wall } from '../types'
import {
  openingSpan,
  pointAtT,
  projectT,
  wallLen,
  wallSolidParts,
} from '../lib/openings'
import { collidesAt } from '../lib/collision'

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
  Выбор: 'Клик — выбрать стену/проём/мебель. Проёмы и мебель тащатся, Delete — удалить.',
  Стена: 'Клики — точки стены (цепочкой). Двойной клик или Esc — закончить.',
  Дверь: 'Клик по стене — поставить дверь. Тащите проём вдоль стены, края — ширина.',
  Окно: 'Клик по стене — поставить окно. Тащите проём вдоль стены, края — ширина.',
  Размер: 'Две точки на фото плана + реальная длина = масштаб подложки.',
}

type StageEvt = KonvaEventObject<MouseEvent | DragEvent>

const findWallAt = (p: Point, walls: Wall[], maxDist = 0.3): Wall | null => {
  let best: Wall | null = null
  let bestD = maxDist
  for (const w of walls) {
    const L = wallLen(w)
    if (L < 1e-6) continue
    const t = projectT(w, p)
    const proj = pointAtT(w, t)
    const d = Math.hypot(p.x - proj.x, p.y - proj.y)
    if (d < bestD) {
      bestD = d
      best = w
    }
  }
  return best
}

export default function PlanPanel({
  width,
  onHide,
}: {
  width: number
  onHide: () => void
}) {
  const tool = usePlanStore((s) => s.tool)
  const walls = usePlanStore((s) => s.walls)
  const addWall = usePlanStore((s) => s.addWall)
  const updateWallEnd = usePlanStore((s) => s.updateWallEnd)
  const removeWall = usePlanStore((s) => s.removeWall)
  const selectedWallId = usePlanStore((s) => s.selectedWallId)
  const selectWall = usePlanStore((s) => s.selectWall)
  const setWallColor = usePlanStore((s) => s.setWallColor)
  const paintAllWalls = usePlanStore((s) => s.paintAllWalls)
  const underlay = usePlanStore((s) => s.underlay)
  const setUnderlay = usePlanStore((s) => s.setUnderlay)
  const calibrateUnderlay = usePlanStore((s) => s.calibrateUnderlay)

  const openings = usePlanStore((s) => s.openings)
  const addOpening = usePlanStore((s) => s.addOpening)
  const updateOpening = usePlanStore((s) => s.updateOpening)
  const removeOpening = usePlanStore((s) => s.removeOpening)
  const selectedOpeningId = usePlanStore((s) => s.selectedOpeningId)
  const selectOpening = usePlanStore((s) => s.selectOpening)

  const placed = usePlanStore((s) => s.placed)
  const moveItem = usePlanStore((s) => s.moveItem)
  const rotateItem = usePlanStore((s) => s.rotateItem)
  const removeFromRoom = usePlanStore((s) => s.removeFromRoom)
  const selectedPlacedId = usePlanStore((s) => s.selectedPlacedId)
  const selectPlaced = usePlanStore((s) => s.selectPlaced)

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
  }, [underlay, underlay?.url])

  // Esc / Delete
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return
      if (e.key === 'Escape') {
        setDraft(null)
        setCalibA(null)
        selectWall(null)
        selectOpening(null)
        selectPlaced(null)
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedPlacedId) removeFromRoom(selectedPlacedId)
        else if (selectedOpeningId) removeOpening(selectedOpeningId)
        else if (selectedWallId) removeWall(selectedWallId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedWallId, selectedOpeningId, selectedPlacedId, removeWall, removeOpening, removeFromRoom, selectWall, selectOpening, selectPlaced])

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

    if (tool === 'Дверь' || tool === 'Окно') {
      const p = toMeters(e)
      const wall = findWallAt(p, walls)
      if (wall) addOpening(wall.id, projectT(wall, p), tool === 'Дверь' ? 'door' : 'window')
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

    if (tool === 'Выбор') {
      selectWall(null)
      selectOpening(null)
      selectPlaced(null)
    }
  }

  const selected = walls.find((w) => w.id === selectedWallId) ?? null
  const selectedOpening = openings.find((o) => o.id === selectedOpeningId) ?? null
  const imageScale = underlay ? underlay.metersPerPx * S : 1
  const preview = draft && cursor ? snapAxis(draft, cursor) : null

  // сетка с шагом 0.5 м; полотно больше вьюпорта, если контент не влезает
  let maxX = 0, maxY = 0
  for (const w of walls) {
    maxX = Math.max(maxX, w.a.x, w.b.x)
    maxY = Math.max(maxY, w.a.y, w.b.y)
  }
  for (const p of placed) {
    maxX = Math.max(maxX, p.pos[0])
    maxY = Math.max(maxY, p.pos[1])
  }
  const contentW = Math.max(size.w, Math.ceil((maxX + 1.5) * S))
  const contentH = Math.max(size.h, Math.ceil((maxY + 1.5) * S))

  const grid: React.ReactNode[] = []
  for (let x = 0; x <= contentW; x += 0.5 * S)
    grid.push(<Line key={`v${x}`} points={[x, 0, x, contentH]} stroke="rgba(255,255,255,0.06)" listening={false} />)
  for (let y = 0; y <= contentH; y += 0.5 * S)
    grid.push(<Line key={`h${y}`} points={[0, y, contentW, y]} stroke="rgba(255,255,255,0.06)" listening={false} />)

  // символ проёма: дверь — дуга + полотно, окно — двойная линия
  const openingSymbol = (w: Wall, o: Opening) => {
    const [t0f, t1f] = openingSpan(w, o)
    const L = wallLen(w)
    const widthM = (t1f - t0f) * L
    const h0 = pointAtT(w, t0f)
    const h1 = pointAtT(w, t1f)
    const ux = L > 1e-6 ? (w.b.x - w.a.x) / L : 0
    const uy = L > 1e-6 ? (w.b.y - w.a.y) / L : 0
    const uAng = Math.atan2(uy, ux) * (180 / Math.PI)
    const isSel = o.id === selectedOpeningId
    const stroke = isSel ? '#10B981' : o.kind === 'door' ? '#FB7185' : '#2DD4BF'

    const hit = (
      <Line
        points={[h0.x * S, h0.y * S, h1.x * S, h1.y * S]}
        stroke="transparent"
        strokeWidth={16}
        hitStrokeWidth={16}
        onClick={(e) => {
          if (tool !== 'Выбор') return
          e.cancelBubble = true
          selectOpening(o.id)
        }}
      />
    )

    if (o.kind === 'door') {
      const nx = -uy * widthM * S
      const ny = ux * widthM * S
      return (
        <Fragment key={o.id}>
          <Arc
            x={h0.x * S}
            y={h0.y * S}
            innerRadius={0}
            outerRadius={widthM * S}
            angle={90}
            rotation={uAng}
            clockwise
            fill="transparent"
            stroke={stroke}
            strokeWidth={1.5}
            listening={false}
          />
          <Line
            points={[h0.x * S, h0.y * S, h0.x * S + nx, h0.y * S + ny]}
            stroke={stroke}
            strokeWidth={1.5}
            listening={false}
          />
          {hit}
        </Fragment>
      )
    }

    const n = 4 // смещение двойной линии окна
    return (
      <Fragment key={o.id}>
        <Line
          points={[h0.x * S - uy * n, h0.y * S + ux * n, h1.x * S - uy * n, h1.y * S + ux * n]}
          stroke={stroke}
          strokeWidth={1.5}
          listening={false}
        />
        <Line
          points={[h0.x * S + uy * n, h0.y * S - ux * n, h1.x * S + uy * n, h1.y * S - ux * n]}
          stroke={stroke}
          strokeWidth={1.5}
          listening={false}
        />
        {hit}
      </Fragment>
    )
  }

  // ручки выбранного проёма: центр — вдоль стены, края — ширина
  const openingHandles = (w: Wall, o: Opening) => {
    const [t0f, t1f] = openingSpan(w, o)
    const L = wallLen(w)
    const clampT = (t: number) => {
      const half = Math.min(o.width / 2, L / 2 - 1e-4)
      return Math.min(Math.max(t, half / Math.max(L, 1e-9)), 1 - half / Math.max(L, 1e-9))
    }
    const moveTo = (e: StageEvt) => {
      const p = toMeters(e)
      const tt = clampT(projectT(w, p))
      updateOpening(o.id, { t: tt })
      const pt = pointAtT(w, tt)
      e.target.position({ x: pt.x * S, y: pt.y * S })
    }
    const resizeTo = (e: StageEvt, fixedT: number) => {
      const p = toMeters(e)
      const tP = clampT(projectT(w, p))
      const t0 = Math.min(tP, fixedT)
      const t1 = Math.max(tP, fixedT)
      const width = Math.max(0.4, (t1 - t0) * L)
      const tMid = clampT((t0 + t1) / 2)
      updateOpening(o.id, { t: tMid, width })
      const pt = pointAtT(w, tMid)
      e.target.position({ x: pt.x * S, y: pt.y * S })
    }
    const c = pointAtT(w, (t0f + t1f) / 2)
    const e0 = pointAtT(w, t0f)
    const e1 = pointAtT(w, t1f)
    return (
      <Fragment key={o.id + '-h'}>
        <Circle
          x={c.x * S}
          y={c.y * S}
          radius={5}
          fill="#EAE6EE"
          stroke="#10B981"
          strokeWidth={2}
          draggable
          onDragMove={moveTo}
        />
        <Circle
          x={e0.x * S}
          y={e0.y * S}
          radius={4}
          fill="#EAE6EE"
          stroke="#10B981"
          strokeWidth={2}
          draggable
          onDragMove={(ev) => resizeTo(ev, t1f)}
        />
        <Circle
          x={e1.x * S}
          y={e1.y * S}
          radius={4}
          fill="#EAE6EE"
          stroke="#10B981"
          strokeWidth={2}
          draggable
          onDragMove={(ev) => resizeTo(ev, t0f)}
        />
      </Fragment>
    )
  }

  // схематичная мебель на плане (вид сверху)
  const furniture = placed.map((p) => {
    const [w, , d] = p.item.size
    const isSel = p.uid === selectedPlacedId
    const stroke = isSel ? '#10B981' : '#A78BFA'
    return (
      <Fragment key={p.uid}>
        <Rect
          x={p.pos[0] * S}
          y={p.pos[1] * S}
          width={w * S}
          height={d * S}
          offsetX={(w * S) / 2}
          offsetY={(d * S) / 2}
          rotation={(p.rotY * 180) / Math.PI}
          fill={isSel ? 'rgba(16,185,129,0.18)' : 'rgba(167,139,250,0.14)'}
          stroke={stroke}
          strokeWidth={2}
          draggable={tool === 'Выбор'}
          onDragStart={(e) => {
            e.cancelBubble = true
            document.body.style.cursor = 'grabbing'
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true
            document.body.style.cursor = ''
            const px = snap(e.target.x() / S)
            const py = snap(e.target.y() / S)
            const self = placed.find((x) => x.uid === p.uid)
            const others = placed.filter((x) => x.uid !== p.uid)
            const rejected =
              self &&
              collidesAt(px, py, self.item.size, self.rotY, p.uid, others)
            if (rejected) {
              e.target.x(p.pos[0] * S)
              e.target.y(p.pos[1] * S)
              e.target.getLayer()?.batchDraw()
              return
            }
            moveItem(p.uid, [px, py])
          }}
          onClick={(e) => {
            if (tool !== 'Выбор') return
            e.cancelBubble = true
            selectPlaced(p.uid)
          }}
          onDblClick={(e) => {
            e.cancelBubble = true
            rotateItem(p.uid)
          }}
        />
        <Text
          x={p.pos[0] * S}
          y={p.pos[1] * S - (d * S) / 2 - 12}
          width={Math.max(40, w * S)}
          offsetX={Math.max(40, w * S) / 2}
          align="center"
          text={p.item.name.length > 12 ? p.item.name.slice(0, 11) + '…' : p.item.name}
          fontSize={9}
          fill={isSel ? '#10B981' : '#A78BFA'}
          listening={false}
        />
      </Fragment>
    )
  })

  return (
    <section className="card plan-panel overflow-hidden" style={{ width }}>
      <div className="card-header d-flex align-items-center gap-2 py-2">
        <label className="btn btn-sm btn-outline-secondary mb-0">
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
        <span className="small text-secondary">{HINTS[tool]}</span>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary ms-auto"
          onClick={onHide}
          title="Скрыть панель плана"
        >
          ◀
        </button>
      </div>

      {selected && (
        <div className="d-flex align-items-center gap-2 px-2 py-1 border-top">
          <span className="small text-secondary">Цвет стены:</span>
          <input
            type="color"
            className="form-control form-control-color w-auto"
            value={selected.color ?? '#dcdcdc'}
            onChange={(e) => setWallColor(selected.id, e.target.value)}
            title="Цвет выбранной стены"
          />
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => paintAllWalls(selected.color ?? '#dcdcdc')}
          >
            Ко всем стенам
          </button>
        </div>
      )}

      <div className="plan-canvas" ref={boxRef}>
        <Stage
          width={contentW}
          height={contentH}
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

            {/* стены — сегментами, разрыв в местах дверей и окон */}
            {walls.map((w) => {
              const parts = wallSolidParts(w, openings.filter((o) => o.wallId === w.id))
              const stroke = w.id === selectedWallId ? '#10B981' : '#EAE6EE'
              return parts.map(([t0, t1], i) => {
                const p0 = pointAtT(w, t0)
                const p1 = pointAtT(w, t1)
                return (
                  <Line
                    key={w.id + '-' + i}
                    points={[p0.x * S, p0.y * S, p1.x * S, p1.y * S]}
                    stroke={stroke}
                    strokeWidth={6}
                    lineCap="round"
                    hitStrokeWidth={14}
                    onClick={(e) => {
                      if (tool !== 'Выбор') return
                      e.cancelBubble = true
                      selectWall(w.id)
                    }}
                  />
                )
              })
            })}

            {/* проёмы */}
            {walls.flatMap((w) =>
              openings
                .filter((o) => o.wallId === w.id)
                .map((o) => openingSymbol(w, o)),
            )}

            {/* размеры */}
            {walls.map((w) => (
              <Text
                key={w.id + 't'}
                x={((w.a.x + w.b.x) / 2) * S + 6}
                y={((w.a.y + w.b.y) / 2) * S - 16}
                text={`${wallLen(w).toFixed(2)} м`}
                fontSize={11}
                fill="rgba(214,209,222,0.55)"
                listening={false}
              />
            ))}

            {/* превью рисуемой стены */}
            {tool === 'Стена' && draft && preview && (
              <Line
                points={[draft.x * S, draft.y * S, preview.x * S, preview.y * S]}
                stroke="#10B981"
                strokeWidth={2}
                dash={[6, 4]}
                listening={false}
              />
            )}
            {tool === 'Стена' && draft && (
              <Circle x={draft.x * S} y={draft.y * S} radius={4} fill="#10B981" listening={false} />
            )}

            {/* подсказка, куда встанет дверь/окно */}
            {(tool === 'Дверь' || tool === 'Окно') && cursor && (
              (() => {
                const w = findWallAt(cursor, walls)
                if (!w) return null
                const t = projectT(w, cursor)
                const p = pointAtT(w, t)
                return (
                  <Circle
                    x={p.x * S}
                    y={p.y * S}
                    radius={5}
                    fill={tool === 'Дверь' ? '#FB7185' : '#2DD4BF'}
                    listening={false}
                  />
                )
              })()
            )}

            {/* линия калибровки */}
            {tool === 'Размер' && calibA && cursor && (
              <Line
                points={[calibA.x * S, calibA.y * S, cursor.x * S, cursor.y * S]}
                stroke="#FB7185"
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
                  fill="#EAE6EE"
                  stroke="#10B981"
                  strokeWidth={2}
                  draggable
                  onDragMove={(e) =>
                    updateWallEnd(selected.id, end, snapP(toMeters(e)))
                  }
                />
              ))}

            {/* ручки выбранного проёма */}
            {selectedOpening && tool === 'Выбор' && (
              (() => {
                const w = walls.find((x) => x.id === selectedOpening.wallId)
                return w ? openingHandles(w, selectedOpening) : null
              })()
            )}

            {/* схематичная мебель (вид сверху) */}
            {furniture}
          </Layer>
        </Stage>
      </div>
    </section>
  )
}
