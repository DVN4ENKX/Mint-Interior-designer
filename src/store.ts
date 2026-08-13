import { create } from 'zustand'
import { temporal } from 'zundo'
import type { CatalogItem, PlacedItem, Point, Tool, Underlay, Wall } from './types'

const wallsCenter = (walls: Wall[]): [number, number] => {
  if (walls.length === 0) return [0, 0]
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const w of walls)
    for (const p of [w.a, w.b]) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
    }
  return [(minX + maxX) / 2, (minY + maxY) / 2]
}

type PlanState = {
  placed: PlacedItem[]
  addToRoom: (item: CatalogItem) => void
  removeFromRoom: (uid: string) => void
  clearRoom: () => void
  moveItem: (uid: string, pos: [number, number]) => void
  rotateItem: (uid: string) => void

  tool: Tool
  setTool: (t: Tool) => void

  walls: Wall[]
  addWall: (a: Point, b: Point) => void
  updateWallEnd: (id: string, end: 'a' | 'b', p: Point) => void
  removeWall: (id: string) => void

  selectedWallId: string | null
  selectWall: (id: string | null) => void

  underlay: Underlay | null
  setUnderlay: (url: string) => void
  calibrateUnderlay: (metersPerPx: number) => void
}

export const usePlanStore = create<PlanState>()(
  temporal(
    (set) => ({
      placed: [],
      addToRoom: (item) =>
        set((s) => {
          const [cx, cy] = wallsCenter(s.walls)
          const n = s.placed.length
          return {
            placed: [
              ...s.placed,
              {
                uid: crypto.randomUUID(),
                item,
                rotY: 0,
                pos: [cx + (n % 3) * 0.7 - 0.7, cy + Math.floor(n / 3) * 0.7 - 0.7],
              },
            ],
          }
        }),
      removeFromRoom: (uid) =>
        set((s) => ({ placed: s.placed.filter((p) => p.uid !== uid) })),
      clearRoom: () => set({ placed: [] }),
      moveItem: (uid, pos) =>
        set((s) => ({
          placed: s.placed.map((p) => (p.uid === uid ? { ...p, pos } : p)),
        })),
      rotateItem: (uid) =>
        set((s) => ({
          placed: s.placed.map((p) =>
            p.uid === uid ? { ...p, rotY: p.rotY + Math.PI / 2 } : p,
          ),
        })),

      tool: 'Выбор',
      setTool: (tool) => set({ tool, selectedWallId: null }),

      walls: [],
      addWall: (a, b) =>
        set((s) => ({ walls: [...s.walls, { id: crypto.randomUUID(), a, b }] })),
      updateWallEnd: (id, end, p) =>
        set((s) => ({
          walls: s.walls.map((w) =>
            w.id === id ? (end === 'a' ? { ...w, a: p } : { ...w, b: p }) : w,
          ),
        })),
      removeWall: (id) =>
        set((s) => ({ walls: s.walls.filter((w) => w.id !== id) })),

      selectedWallId: null,
      selectWall: (selectedWallId) => set({ selectedWallId }),

      underlay: null,
      setUnderlay: (url) => set({ underlay: { url, metersPerPx: 0.02 } }),
      calibrateUnderlay: (metersPerPx) =>
        set((s) => (s.underlay ? { underlay: { ...s.underlay, metersPerPx } } : {})),
    }),
    {
      limit: 50,
      partialize: (state) => ({ placed: state.placed, walls: state.walls }),
    },
  ),
)