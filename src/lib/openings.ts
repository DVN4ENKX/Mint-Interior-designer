import type { Opening, Point, Wall } from '../types'

export const WALL_H = 2.7
export const WALL_T = 0.12

export const wallLen = (w: Wall) => Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y)

export const pointAtT = (w: Wall, t: number): Point => ({
  x: w.a.x + (w.b.x - w.a.x) * t,
  y: w.a.y + (w.b.y - w.a.y) * t,
})

export const projectT = (w: Wall, p: Point): number => {
  const dx = w.b.x - w.a.x
  const dy = w.b.y - w.a.y
  const l2 = dx * dx + dy * dy
  if (l2 < 1e-9) return 0
  const t = ((p.x - w.a.x) * dx + (p.y - w.a.y) * dy) / l2
  return Math.min(Math.max(t, 0), 1)
}

// интервал проёма [t0, t1] в долях длины стены (с учётом ширины проёма)
export function openingSpan(w: Wall, o: Opening): [number, number] {
  const L = wallLen(w)
  if (L < 1e-9) return [0, 0]
  const half = Math.min(o.width / 2, L / 2 - 1e-4)
  const t = Math.min(Math.max(o.t, 0), 1)
  return [Math.max(0, t - half / L), Math.min(1, t + half / L)]
}

// вертикальные диапазоны, занимаемые проёмом (лишний материал стены)
type Cut = { t0: number; t1: number; y0: number; y1: number }

export type WallBox = { t0: number; t1: number; y0: number; y1: number }

// стена разрезается на выпуклые боксы (для 3D-рендера)
export function wallBoxes(wall: Wall, openings: Opening[]): WallBox[] {
  const L = wallLen(wall)
  if (L < 1e-6) return []

  const cuts: Cut[] = []
  for (const o of openings.filter((x) => x.wallId === wall.id)) {
    const [t0, t1] = openingSpan(wall, o)
    if (t1 - t0 < 1e-6) continue
    if (o.kind === 'door') {
      // дверь: убираем материал от пола до height (сверху остаётся фрамуга)
      cuts.push({ t0, t1, y0: 0, y1: o.height })
    } else {
      const sill = o.sill ?? 0.9
      // окно: убираем проём от подоконника до его верха (низ и фрамуга остаются)
      cuts.push({ t0, t1, y0: sill, y1: sill + o.height })
    }
  }
  if (cuts.length === 0) return [{ t0: 0, t1: 1, y0: 0, y1: WALL_H }]

  const ts = [0, 1]
  for (const c of cuts) ts.push(c.t0, c.t1)
  ts.sort((a, b) => a - b)

  const boxes: WallBox[] = []
  for (let i = 0; i < ts.length - 1; i++) {
    const ta = ts[i]
    const tb = ts[i + 1]
    if (tb - ta < 1e-6) continue
    const covering = cuts.filter((c) => c.t0 <= ta + 1e-6 && c.t1 >= tb - 1e-6)
    const vSpan = covering
      .map((c) => [c.y0, c.y1] as [number, number])
      .sort((a, b) => a[0] - b[0])
    let curY = 0
    for (const [s, e] of vSpan) {
      if (s > curY + 1e-6) boxes.push({ t0: ta, t1: tb, y0: curY, y1: Math.min(s, WALL_H) })
      curY = Math.max(curY, Math.min(e, WALL_H))
    }
    if (curY < WALL_H - 1e-6) boxes.push({ t0: ta, t1: tb, y0: curY, y1: WALL_H })
  }
  return boxes
}

// сплошные части стены на 2D-плане (двери/окна — это разрыв линии)
export function wallSolidParts(wall: Wall, openings: Opening[]): [number, number][] {
  const spans: [number, number][] = []
  for (const o of openings.filter((x) => x.wallId === wall.id)) {
    const [t0, t1] = openingSpan(wall, o)
    if (t1 - t0 > 1e-6) spans.push([t0, t1])
  }
  if (spans.length === 0) return [[0, 1]]
  spans.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const c of spans) {
    const last = merged[merged.length - 1]
    if (last && c[0] <= last[1]) last[1] = Math.max(last[1], c[1])
    else merged.push([...c])
  }
  const parts: [number, number][] = []
  let cur = 0
  for (const [s, e] of merged) {
    if (s > cur + 1e-6) parts.push([cur, s])
    cur = Math.max(cur, e)
  }
  if (cur < 1 - 1e-6) parts.push([cur, 1])
  return parts
}
