export type CatalogItem = {
  id: string
  name: string
  price: number
  size: [number, number, number]
}

export type PlacedItem = {
  uid: string
  item: CatalogItem
  pos: [number, number] // x и z в метрах, общие для 2D и 3D
  rotY: number
}

export type Point = { x: number; y: number }
export type Wall = { id: string; a: Point; b: Point }
export type Underlay = { url: string; metersPerPx: number }
export type Tool = 'Выбор' | 'Стена' | 'Дверь' | 'Размер'