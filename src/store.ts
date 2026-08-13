import { create } from 'zustand'
import { temporal } from 'zundo'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
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

const r2 = (v: number) => Math.max(0.05, Math.round(v * 100) / 100)

export type Persisted = {
  walls: Wall[]
  placed: PlacedItem[]
  underlay: Underlay | null
}

const LS_KEY = 'room-planner:v1'

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return { walls: p.walls ?? [], placed: p.placed ?? [], underlay: p.underlay ?? null }
    }
  } catch {
    /* повреждённые данные — начинаем с чистого листа */
  }
  return { walls: [], placed: [], underlay: null }
}

type PlanState = Persisted & {
  addToRoom: (item: CatalogItem) => void
  removeFromRoom: (uid: string) => void
  clearRoom: () => void
  moveItem: (uid: string, pos: [number, number]) => void
  rotateItem: (uid: string) => void
  hydrate: (p: Persisted) => void
  exportJson: () => void
  importJson: (file: File) => Promise<void>

  customCatalog: CatalogItem[]
  uploadModel: (file: File) => Promise<void>

  tool: Tool
  setTool: (t: Tool) => void
  addWall: (a: Point, b: Point) => void
  updateWallEnd: (id: string, end: 'a' | 'b', p: Point) => void
  removeWall: (id: string) => void
  selectedWallId: string | null
  selectWall: (id: string | null) => void
  setUnderlay: (url: string) => void
  calibrateUnderlay: (metersPerPx: number) => void
}

export const usePlanStore = create<PlanState>()(
  temporal(
    (set, get) => ({
      ...loadPersisted(),

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

      hydrate: (p) =>
        set({ walls: p.walls, placed: p.placed, underlay: p.underlay, selectedWallId: null }),

      exportJson: () => {
        const { walls, placed, underlay } = get()
        const blob = new Blob([JSON.stringify({ walls, placed, underlay }, null, 2)], {
          type: 'application/json',
        })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'room-plan.json'
        a.click()
        URL.revokeObjectURL(a.href)
      },

      importJson: async (file) => {
        try {
          const p = JSON.parse(await file.text())
          get().hydrate({
            walls: p.walls ?? [],
            placed: p.placed ?? [],
            underlay: p.underlay ?? null,
          })
        } catch {
          alert('Это не похоже на JSON проекта')
        }
      },

      customCatalog: [],
      uploadModel: async (file) => {
        try {
          const url = URL.createObjectURL(file)
          const gltf = await new GLTFLoader().loadAsync(url)
          const v = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3())
          const item: CatalogItem = {
            id: 'custom-' + crypto.randomUUID(),
            name: file.name.replace(/\.(glb|gltf)$/i, ''),
            price: 0,
            size: [r2(v.x), r2(v.y), r2(v.z)],
            modelUrl: url,
          }
          set((s) => ({ customCatalog: [...s.customCatalog, item] }))
          get().addToRoom(item)
        } catch {
          alert('Не удалось прочитать файл модели. Нужен .glb или .gltf.')
        }
      },

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

// автосохранение: каждое изменение, но не чаще раза в 500 мс
let saveTimer: number | undefined
usePlanStore.subscribe((state) => {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({ walls: state.walls, placed: state.placed, underlay: state.underlay }),
      )
    } catch {
      console.warn('Не удалось сохранить проект (кваота localStorage)')
    }
  }, 500)
})