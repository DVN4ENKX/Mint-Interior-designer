import type { CatalogItem } from '../types'

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
