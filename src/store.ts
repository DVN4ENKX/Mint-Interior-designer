import { create } from 'zustand'
import { temporal } from 'zundo'
import type { CatalogItem, PlacedItem } from './types'

type PlanState = {
  placed: PlacedItem[]
  addToRoom: (item: CatalogItem) => void
  removeFromRoom: (uid: string) => void
  clearRoom: () => void
}

export const usePlanStore = create<PlanState>()(
  temporal(
    (set) => ({
      placed: [],
      addToRoom: (item) =>
        set((s) => ({ placed: [...s.placed, { uid: crypto.randomUUID(), item }] })),
      removeFromRoom: (uid) =>
        set((s) => ({ placed: s.placed.filter((p) => p.uid !== uid) })),
      clearRoom: () => set({ placed: [] }),
    }),
    {
      limit: 50, // история не бесконечная
      partialize: (state) => ({ placed: state.placed }), // что попадает в историю
    },
  ),
)