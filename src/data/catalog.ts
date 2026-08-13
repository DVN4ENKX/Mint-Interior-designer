import type { CatalogItem } from '../types'

export const CATEGORIES = ['Мебель', 'Освещение', 'Текстиль', 'Декор'] as const

export const CATALOG: CatalogItem[] = [
  { id: 'sofa', name: 'Модульный диван', price: 45900, size: [2.4, 0.8, 1.0], category: 'Мебель' },
  {
    id: 'chair', name: 'Кресло', price: 21900, size: [0.7, 0.9, 0.7], category: 'Мебель',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/SheenChair/glTF-Binary/SheenChair.glb',
  },
  { id: 'table', name: 'Журнальный стол', price: 12900, size: [0.9, 0.45, 0.9], category: 'Мебель' },
  { id: 'dining', name: 'Обеденный стол', price: 24900, size: [1.6, 0.75, 0.9], category: 'Мебель' },
  { id: 'stool', name: 'Стул', price: 5900, size: [0.45, 0.85, 0.5], category: 'Мебель' },
  { id: 'shelf', name: 'Стеллаж', price: 18900, size: [1.2, 2.2, 0.4], category: 'Мебель' },
  { id: 'wardrobe', name: 'Шкаф', price: 32900, size: [1.6, 2.4, 0.6], category: 'Мебель' },
  { id: 'bed', name: 'Кровать', price: 39900, size: [1.8, 1.0, 2.1], category: 'Мебель' },
  { id: 'dresser', name: 'Комод', price: 15900, size: [1.2, 0.9, 0.45], category: 'Мебель' },
  {
    id: 'lamp', name: 'Торшер', price: 7400, size: [0.4, 1.4, 0.4], category: 'Освещение',
    modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Lantern/glTF-Binary/Lantern.glb',
  },
  { id: 'rug', name: 'Ковёр', price: 8900, size: [2.0, 0.02, 3.0], category: 'Текстиль' },
  { id: 'mirror', name: 'Зеркало', price: 4900, size: [0.9, 1.6, 0.05], category: 'Декор' },
]
