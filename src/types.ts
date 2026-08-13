export type CatalogItem = {
  id: string
  name: string
  price: number
  size: [number, number, number]
}

// экземпляр мебели в комнате: тот же диван можно поставить дважды
export type PlacedItem = {
  uid: string
  item: CatalogItem
}