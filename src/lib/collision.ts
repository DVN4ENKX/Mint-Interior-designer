import type { CatalogItem, Opening, Wall } from '../types'
import { WALL_T, pointAtT, wallLen, wallSolidParts } from './openings'

// «плоские» предметы (ковры и т.п.) не участвуют в коллизиях
export const isFlat = (size: [number, number, number]) => size[1] < 0.1

// углы прямоугольника w×d с центром (x, z) и поворотом r (как rotation.y в three.js)
function corners(
  w: number,
  d: number,
  r: number,
  x: number,
  z: number,
): [number, number][] {
  const c = Math.cos(r)
  const s = Math.sin(r)
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([lx, lz]) => [x + lx * c - lz * s, z + lx * s + lz * c])
}

function project(corners: [number, number][], ax: number, az: number): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const [x, z] of corners) {
    const v = x * ax + z * az
    if (v < min) min = v
    if (v > max) max = v
  }
  return [min, max]
}

// точная проверка пересечения двух повёрнутых прямоугольников (SAT)
export function overlapsRect(
  x1: number,
  z1: number,
  w1: number,
  d1: number,
  r1: number,
  x2: number,
  z2: number,
  w2: number,
  d2: number,
  r2: number,
): boolean {
  const c1 = corners(w1, d1, r1, x1, z1)
  const c2 = corners(w2, d2, r2, x2, z2)
  const axes: [number, number][] = [
    [Math.cos(r1), Math.sin(r1)],
    [-Math.sin(r1), Math.cos(r1)],
    [Math.cos(r2), Math.sin(r2)],
    [-Math.sin(r2), Math.cos(r2)],
  ]
  for (const [ax, az] of axes) {
    const [mn1, mx1] = project(c1, ax, az)
    const [mn2, mx2] = project(c2, ax, az)
    if (mx1 <= mn2 || mx2 <= mn1) return false
  }
  return true
}

// можно ли поставить предмет в точку (x, z): не пересекается ли с другой «неплоской» мебелью
export function collidesAt(
  x: number,
  z: number,
  size: [number, number, number],
  rotY: number,
  uid: string,
  placed: { uid: string; pos: [number, number]; rotY: number; item: CatalogItem }[],
): boolean {
  if (isFlat(size)) return false
  for (const o of placed) {
    if (o.uid === uid) continue
    if (isFlat(o.item.size)) continue
    const [w2, , d2] = o.item.size
    if (overlapsRect(x, z, size[0], size[2], rotY, o.pos[0], o.pos[1], w2, d2, o.rotY)) {
      return true
    }
  }
  return false
}

// лежит ли точка (px, pz) внутри повёрнутого прямоугольника w×d (центр (x, z), поворот r)
export function pointInRect(
  px: number,
  pz: number,
  x: number,
  z: number,
  w: number,
  d: number,
  r: number,
): boolean {
  const dx = px - x
  const dz = pz - z
  const c = Math.cos(-r)
  const s = Math.sin(-r)
  const lx = dx * c - dz * s
  const lz = dx * s + dz * c
  return Math.abs(lx) <= w / 2 && Math.abs(lz) <= d / 2
}

// высота основания предмета в точке (x, z): предмет встаёт на самый высокий предмет,
// под центром которого лежит его центр — так мебель можно ставить друг на друга
export function stackHeightAt(
  x: number,
  z: number,
  uid: string,
  placed: { uid: string; pos: [number, number]; rotY: number; y?: number; item: CatalogItem }[],
): number {
  let top = 0
  for (const o of placed) {
    if (o.uid === uid) continue
    const [w2, , d2] = o.item.size
    if (!pointInRect(x, z, o.pos[0], o.pos[1], w2, d2, o.rotY)) continue
    top = Math.max(top, (o.y ?? 0) + o.item.size[1])
  }
  return top
}

// пересекается ли предмет со сплошными участками стен (проёмы дверей/окон проходимы)
export function collidesWalls(
  x: number,
  z: number,
  size: [number, number, number],
  rotY: number,
  walls: Wall[],
  openings: Opening[],
): boolean {
  if (isFlat(size)) return false
  const [w2, , d2] = size
  for (const w of walls) {
    const L = wallLen(w)
    if (L < 1e-6) continue
    const parts = wallSolidParts(w, openings.filter((o) => o.wallId === w.id))
    for (const [t0, t1] of parts) {
      const p0 = pointAtT(w, t0)
      const p1 = pointAtT(w, t1)
      const len = Math.hypot(p1.x - p0.x, p1.y - p0.y)
      if (len < 1e-6) continue
      const cx = (p0.x + p1.x) / 2
      const cz = (p0.y + p1.y) / 2
      const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x)
      if (overlapsRect(x, z, w2, d2, rotY, cx, cz, len, WALL_T, ang)) return true
    }
  }
  return false
}
