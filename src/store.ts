import { create } from 'zustand'
import { temporal } from 'zundo'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { CatalogItem, Opening, PlacedItem, Point, Tool, Underlay, Wall } from './types'
import { blobUrl, idbGet, idbSet, toBlob } from './lib/idb'
import { wallLen } from './lib/openings'
import { stackHeightAt } from './lib/collision'
import type { RoomTemplate } from './data/templates'

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
  openings: Opening[]
  customCatalog: CatalogItem[]
}

const LS_KEY = 'room-planner:v1'
const LS_PROJECT = 'room-planner:project'

function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      return {
        walls: p.walls ?? [],
        placed: p.placed ?? [],
        underlay: p.underlay ?? null,
        openings: p.openings ?? [],
        customCatalog: p.customCatalog ?? [],
      }
    }
  } catch {
    /* повреждённые данные — начинаем с чистого листа */
  }
  return { walls: [], placed: [], underlay: null, openings: [], customCatalog: [] }
}

function loadProjectMeta(): { projectId: string | null; readOnly: boolean } {
  try {
    const raw = localStorage.getItem(LS_PROJECT)
    if (raw) {
      const m = JSON.parse(raw)
      return { projectId: m.projectId ?? null, readOnly: !!m.readOnly }
    }
  } catch {
    /* повреждённые данные — без привязки к облачному проекту */
  }
  return { projectId: null, readOnly: false }
}

type PlanState = Persisted & {
  addToRoom: (item: CatalogItem) => void
  removeFromRoom: (uid: string) => void
  clearRoom: () => void
  moveItem: (uid: string, pos: [number, number]) => void
  rotateItem: (uid: string) => void
  rotateItemBy: (uid: string, angle: number) => void
  rotateItemAround: (uid: string, axis: 'x' | 'y' | 'z', angle: number) => void
  hydrate: (p: Partial<Persisted>) => void
  exportJson: () => void
  importJson: (file: File) => Promise<void>

  customCatalog: CatalogItem[]
  uploadModel: (file: File) => Promise<void>

  tool: Tool
  setTool: (t: Tool) => void
  addWall: (a: Point, b: Point) => void
  updateWallEnd: (id: string, end: 'a' | 'b', p: Point) => void
  removeWall: (id: string) => void
  clearWalls: () => void
  applyTemplate: (tpl: RoomTemplate) => void
  selectedWallId: string | null
  selectWall: (id: string | null) => void
  setWallColor: (id: string, color: string) => void
  paintAllWalls: (color: string) => void
  setUnderlay: (url: string) => void
  setUnderlayUrl: (url: string) => void
  clearUnderlay: () => void
  calibrateUnderlay: (metersPerPx: number) => void
  setCustomModelUrl: (id: string, url: string) => void

  openings: Opening[]
  addOpening: (wallId: string, t: number, kind: Opening['kind']) => void
  updateOpening: (id: string, patch: Partial<Opening>) => void
  removeOpening: (id: string) => void
  selectedOpeningId: string | null
  selectOpening: (id: string | null) => void

  selectedPlacedId: string | null
  selectPlaced: (id: string | null) => void

  projectId: string | null
  setProjectId: (id: string | null) => void
  readOnly: boolean
  setReadOnly: (b: boolean) => void
}

export const usePlanStore = create<PlanState>()(
  temporal(
    (set, get) => ({
      ...loadPersisted(),

      addToRoom: (item) =>
        set((s) => {
          const [cx, cy] = wallsCenter(s.walls)
          const n = s.placed.length
          const uid = crypto.randomUUID()
          const pos: [number, number] = [
            cx + (n % 3) * 0.7 - 0.7,
            cy + Math.floor(n / 3) * 0.7 - 0.7,
          ]
          return {
            placed: [
              ...s.placed,
              {
                uid,
                item,
                rotY: 0,
                rotX: 0,
                rotZ: 0,
                pos,
                y: stackHeightAt(pos[0], pos[1], uid, s.placed),
              },
            ],
            selectedPlacedId: null,
          }
        }),
      removeFromRoom: (uid) =>
        set((s) => ({
          placed: s.placed.filter((p) => p.uid !== uid),
          selectedPlacedId: s.selectedPlacedId === uid ? null : s.selectedPlacedId,
        })),
      clearRoom: () => set({ placed: [], selectedPlacedId: null }),
      moveItem: (uid, pos) =>
        set((s) => {
          const next = s.placed.map((p) => (p.uid === uid ? { ...p, pos } : p))
          return {
            // пересчитываем высоту основания всех предметов: предмет встаёт на самый
            // высокий предмет под своим центром (мебель можно ставить друг на друга)
            placed: next.map((p) => ({
              ...p,
              y: stackHeightAt(p.pos[0], p.pos[1], p.uid, next),
            })),
          }
        }),
      rotateItem: (uid) =>
        set((s) => ({
          placed: s.placed.map((p) =>
            p.uid === uid ? { ...p, rotY: p.rotY + Math.PI / 2 } : p,
          ),
        })),
      rotateItemBy: (uid, angle) =>
        set((s) => ({
          placed: s.placed.map((p) =>
            p.uid === uid ? { ...p, rotY: p.rotY + angle } : p,
          ),
        })),
      rotateItemAround: (uid, axis, angle) =>
        set((s) => ({
          placed: s.placed.map((p) => {
            if (p.uid !== uid) return p
            if (axis === 'x') return { ...p, rotX: (p.rotX ?? 0) + angle }
            if (axis === 'z') return { ...p, rotZ: (p.rotZ ?? 0) + angle }
            return { ...p, rotY: p.rotY + angle }
          }),
        })),

      hydrate: (p) =>
        set({
          walls: p.walls ?? [],
          placed: p.placed ?? [],
          underlay: p.underlay ?? null,
          openings: p.openings ?? [],
          customCatalog: p.customCatalog ?? [],
          selectedWallId: null,
          selectedOpeningId: null,
          selectedPlacedId: null,
        }),

      exportJson: () => {
        const { walls, placed, underlay, openings, customCatalog } = get()
        const out = {
          walls,
          placed,
          underlay,
          openings,
          customCatalog: customCatalog.map(({ modelUrl: _modelUrl, ...rest }) => rest),
        }
        const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })
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
            openings: p.openings ?? [],
            customCatalog: p.customCatalog ?? [],
          })
        } catch {
          alert('Это не похоже на JSON проекта')
        }
      },

      // инициализируется из loadPersisted() (см. разворачивание в начале состояния)
      uploadModel: async (file) => {
        try {
          const url = URL.createObjectURL(file)
          const gltf = await new GLTFLoader().loadAsync(url)
          const v = new THREE.Box3().setFromObject(gltf.scene).getSize(new THREE.Vector3())
          const id = 'custom-' + crypto.randomUUID()
          const item: CatalogItem = {
            id,
            name: file.name.replace(/\.(glb|gltf)$/i, ''),
            price: 0,
            size: [r2(v.x), r2(v.y), r2(v.z)],
            modelUrl: url,
            category: 'Мои модели',
          }
          await idbSet('model:' + id, file)
          set((s) => ({ customCatalog: [...s.customCatalog, item] }))
          get().addToRoom(item)
        } catch {
          alert('Не удалось прочитать файл модели. Нужен .glb или .gltf.')
        }
      },

      tool: 'Выбор',
      setTool: (tool) => set({ tool, selectedWallId: null, selectedOpeningId: null }),

      addWall: (a, b) =>
        set((s) => ({ walls: [...s.walls, { id: crypto.randomUUID(), a, b }] })),
      updateWallEnd: (id, end, p) =>
        set((s) => ({
          walls: s.walls.map((w) =>
            w.id === id ? (end === 'a' ? { ...w, a: p } : { ...w, b: p }) : w,
          ),
        })),
      removeWall: (id) =>
        set((s) => ({
          walls: s.walls.filter((w) => w.id !== id),
          openings: s.openings.filter((o) => o.wallId !== id),
          selectedOpeningId: s.selectedOpeningId && s.openings.find((o) => o.id === s.selectedOpeningId)?.wallId === id ? null : s.selectedOpeningId,
        })),
      clearWalls: () => set({ walls: [], openings: [], selectedWallId: null, selectedOpeningId: null }),

      // применяет шаблон комнаты/квартиры: заменяет стены и проёмы (мебель остаётся)
      applyTemplate: (tpl) =>
        set(() => {
          const walls = tpl.walls.map((w) => ({
            id: crypto.randomUUID(),
            a: { x: w.a[0], y: w.a[1] },
            b: { x: w.b[0], y: w.b[1] },
          }))
          const openings = tpl.openings.flatMap((o) => {
            const wall = walls[o.wall]
            if (!wall) return []
            const L = wallLen(wall)
            const width = o.kind === 'door' ? 0.9 : 1.2
            const height = o.kind === 'door' ? 2.1 : 1.3
            const half = Math.min(width / 2, L / 2 - 1e-4)
            const t = Math.min(Math.max(o.t, half / Math.max(L, 1e-9)), 1 - half / Math.max(L, 1e-9))
            return [
              {
                id: crypto.randomUUID(),
                wallId: wall.id,
                kind: o.kind,
                t,
                width,
                height,
                sill: o.kind === 'window' ? 0.9 : undefined,
              },
            ]
          })
          return {
            walls,
            openings,
            selectedWallId: null,
            selectedOpeningId: null,
          }
        }),

      selectedWallId: null,
      selectWall: (selectedWallId) => set({ selectedWallId, selectedOpeningId: null }),
      setWallColor: (id, color) =>
        set((s) => ({ walls: s.walls.map((w) => (w.id === id ? { ...w, color } : w)) })),
      paintAllWalls: (color) =>
        set((s) => ({ walls: s.walls.map((w) => ({ ...w, color })) })),

      setUnderlay: (url) => {
        set({ underlay: { url, metersPerPx: 0.02 } })
        void (async () => {
          try {
            const blob = await toBlob(url)
            await idbSet('underlay', blob)
            // заменяем тяжёлый data-URL на лёгкий blob-URL (сам файл теперь в IDB)
            usePlanStore.getState().setUnderlayUrl(URL.createObjectURL(blob))
          } catch {
            /* не сохранилось в IDB — используем URL как есть */
          }
        })()
      },
      setUnderlayUrl: (url) =>
        set((s) => (s.underlay ? { underlay: { ...s.underlay, url } } : {})),
      clearUnderlay: () => set({ underlay: null }),
      calibrateUnderlay: (metersPerPx) =>
        set((s) => (s.underlay ? { underlay: { ...s.underlay, metersPerPx } } : {})),

      setCustomModelUrl: (id, url) =>
        set((s) => ({
          customCatalog: s.customCatalog.map((i) => (i.id === id ? { ...i, modelUrl: url } : i)),
        })),

      openings: [],
      addOpening: (wallId, t, kind) =>
        set((s) => {
          const wall = s.walls.find((w) => w.id === wallId)
          if (!wall) return {}
          const L = wallLen(wall)
          const width = kind === 'door' ? 0.9 : 1.2
          const height = kind === 'door' ? 2.1 : 1.3
          const half = Math.min(width / 2, L / 2 - 1e-4)
          const tt = Math.min(Math.max(t, half / Math.max(L, 1e-9)), 1 - half / Math.max(L, 1e-9))
          const o: Opening = {
            id: crypto.randomUUID(),
            wallId,
            kind,
            t: tt,
            width,
            height,
            sill: kind === 'window' ? 0.9 : undefined,
          }
          return { openings: [...s.openings, o], selectedOpeningId: o.id }
        }),
      updateOpening: (id, patch) =>
        set((s) => ({ openings: s.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) })),
      removeOpening: (id) =>
        set((s) => ({
          openings: s.openings.filter((o) => o.id !== id),
          selectedOpeningId: s.selectedOpeningId === id ? null : s.selectedOpeningId,
        })),
      selectedOpeningId: null,
      selectOpening: (selectedOpeningId) => set({ selectedOpeningId, selectedWallId: null }),

      selectedPlacedId: null,
      selectPlaced: (selectedPlacedId) => set({ selectedPlacedId, selectedWallId: null, selectedOpeningId: null }),

      ...loadProjectMeta(),
      setProjectId: (projectId) => set({ projectId }),
      setReadOnly: (readOnly) => set({ readOnly }),
    }),
    {
      limit: 50,
      partialize: (state) => ({
        placed: state.placed,
        walls: state.walls,
        openings: state.openings,
      }),
    },
  ),
)

let dragStartSnapshot: { placed: PlacedItem[]; walls: Wall[]; openings: Opening[] } | null = null

function planSnapshot(s: { placed: PlacedItem[]; walls: Wall[]; openings: Opening[] }) {
  return { placed: s.placed, walls: s.walls, openings: s.openings }
}

export function beginDrag() {
  dragStartSnapshot = planSnapshot(usePlanStore.getState())
  usePlanStore.temporal.getState().pause()
}

export function endDrag() {
  usePlanStore.temporal.getState().resume()
  const start = dragStartSnapshot
  dragStartSnapshot = null
  if (!start) return
  const current = planSnapshot(usePlanStore.getState())
  if (JSON.stringify(start) === JSON.stringify(current)) return
  const temporal = usePlanStore.temporal.getState() as unknown as {
    _handleSet: (past: unknown, replace: unknown, current: unknown, delta?: unknown) => void
  }
  temporal._handleSet(start, void 0, current, void 0)
}

// автосохранение: каждое изменение, но не чаще раза в 500 мс
let saveTimer: number | undefined
usePlanStore.subscribe((state) => {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          walls: state.walls,
          placed: state.placed,
          underlay: state.underlay,
          openings: state.openings,
          // blob-URL умирает при перезагрузке — сам файл лежит в IDB, вернём через restoreAssets
          customCatalog: state.customCatalog.map(({ modelUrl: _modelUrl, ...rest }) => rest),
        }),
      )
      localStorage.setItem(
        LS_PROJECT,
        JSON.stringify({ projectId: state.projectId, readOnly: state.readOnly }),
      )
    } catch {
      console.warn('Не удалось сохранить проект (квota localStorage)')
    }
  }, 500)
})

// после загрузки страницы восстанавливаем object-URL моделей и подложки из IndexedDB
export async function restoreAssets() {
  const s = usePlanStore.getState()

  for (const item of s.customCatalog) {
    if (item.modelUrl) continue
    const blob = await idbGet('model:' + item.id).catch(() => null)
    if (blob) usePlanStore.getState().setCustomModelUrl(item.id, blobUrl(blob))
  }

  const u = s.underlay
  if (u) {
    if (u.url.startsWith('blob:')) {
      const blob = await idbGet('underlay').catch(() => null)
      if (blob) usePlanStore.getState().setUnderlayUrl(blobUrl(blob))
      else usePlanStore.getState().clearUnderlay()
    } else if (u.url.startsWith('data:')) {
      // миграция старых data-URL в IDB, чтобы не занимать квоту localStorage
      try {
        const blob = await toBlob(u.url)
        await idbSet('underlay', blob)
        usePlanStore.getState().setUnderlayUrl(blobUrl(blob))
      } catch {
        /* оставляем data-URL как есть */
      }
    }
  }
}

// стартуем восстановление сразу после инициализации (клиент)
if (typeof window !== 'undefined') void restoreAssets()
