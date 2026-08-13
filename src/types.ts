export type CatalogItem = {
  id: string
  name: string
  price: number
  size: [number, number, number]
  modelUrl?: string // если есть — грузим GLB, если нет — цветной бокс
}

export type PlacedItem = {
  uid: string
  item: CatalogItem
  pos: [number, number]
  rotY: number
}

export type Point = { x: number; y: number }
export type Wall = { id: string; a: Point; b: Point }
export type Underlay = { url: string; metersPerPx: number }
export type Tool = 'Выбор' | 'Стена' | 'Дверь' | 'Размер'