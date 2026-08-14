export type CatalogItem = {
  id: string
  name: string
  price: number
  size: [number, number, number]
  modelUrl?: string // если есть — грузим GLB, если нет — цветной бокс
  category?: string
}

export type PlacedItem = {
  uid: string
  item: CatalogItem
  pos: [number, number]
  rotY: number
  rotX?: number
  rotZ?: number
  y?: number // высота основания над полом — для мебели, стоящей на другой мебели
}

export type Point = { x: number; y: number }
export type Wall = { id: string; a: Point; b: Point; color?: string }
export type Underlay = { url: string; metersPerPx: number }
export type Tool = 'Выбор' | 'Стена' | 'Дверь' | 'Окно' | 'Размер'

export type OpeningKind = 'door' | 'window'
export type Opening = {
  id: string
  wallId: string
  kind: OpeningKind
  t: number // середина проёма вдоль стены, 0..1
  width: number // ширина проёма, м
  height: number // высота проёма, м (door: 2.1, window: 1.3)
  sill?: number // высота подоконника для окна, м
}
