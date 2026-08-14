export type TemplateWall = { a: [number, number]; b: [number, number] }
export type TemplateOpening = { wall: number; t: number; kind: 'door' | 'window' }

export type RoomTemplate = {
  id: string
  name: string
  description: string
  rooms: number
  walls: TemplateWall[]
  openings: TemplateOpening[]
}

// координаты в метрах; стены идут по часовой стрелке от (0,0)
export const ROOM_TEMPLATES: RoomTemplate[] = [
  {
    id: 'room-4x3',
    name: 'Комната 4×3 м',
    description: 'Прямоугольная комната с окном и дверью',
    rooms: 1,
    walls: [
      { a: [0, 0], b: [4, 0] },
      { a: [4, 0], b: [4, 3] },
      { a: [4, 3], b: [0, 3] },
      { a: [0, 3], b: [0, 0] },
    ],
    openings: [
      { wall: 0, t: 0.4, kind: 'window' },
      { wall: 2, t: 0.5, kind: 'door' },
    ],
  },
  {
    id: 'room-5x4',
    name: 'Комната 5×4 м',
    description: 'Просторная прямоугольная комната',
    rooms: 1,
    walls: [
      { a: [0, 0], b: [5, 0] },
      { a: [5, 0], b: [5, 4] },
      { a: [5, 4], b: [0, 4] },
      { a: [0, 4], b: [0, 0] },
    ],
    openings: [
      { wall: 0, t: 0.4, kind: 'window' },
      { wall: 2, t: 0.5, kind: 'door' },
    ],
  },
  {
    id: 'studio-6x5',
    name: 'Студия 6×5 м',
    description: 'Открытое пространство с двумя окнами',
    rooms: 1,
    walls: [
      { a: [0, 0], b: [6, 0] },
      { a: [6, 0], b: [6, 5] },
      { a: [6, 5], b: [0, 5] },
      { a: [0, 5], b: [0, 0] },
    ],
    openings: [
      { wall: 0, t: 0.3, kind: 'window' },
      { wall: 0, t: 0.65, kind: 'window' },
      { wall: 2, t: 0.5, kind: 'door' },
    ],
  },
  {
    id: 'apartment-1',
    name: '1-комнатная квартира',
    description: 'Жилая + кухня + ванная + прихожая (8×5 м)',
    rooms: 4,
    walls: [
      { a: [0, 0], b: [8, 0] },
      { a: [8, 0], b: [8, 5] },
      { a: [8, 5], b: [0, 5] },
      { a: [0, 5], b: [0, 0] },
      { a: [5, 0], b: [5, 5] },
      { a: [5, 3], b: [8, 3] },
      { a: [6.5, 3], b: [6.5, 5] },
    ],
    openings: [
      { wall: 0, t: 0.25, kind: 'window' },
      { wall: 0, t: 0.85, kind: 'window' },
      { wall: 3, t: 0.125, kind: 'door' },
      { wall: 5, t: 0.3, kind: 'door' },
      { wall: 5, t: 0.85, kind: 'door' },
      { wall: 7, t: 0.4, kind: 'door' },
    ],
  },
  {
    id: 'apartment-2',
    name: '2-комнатная квартира',
    description: 'Гостиная + спальня + ванная + кухня (10×6 м)',
    rooms: 4,
    walls: [
      { a: [0, 0], b: [10, 0] },
      { a: [10, 0], b: [10, 6] },
      { a: [10, 6], b: [0, 6] },
      { a: [0, 6], b: [0, 0] },
      { a: [6, 0], b: [6, 6] },
      { a: [6, 3.5], b: [10, 3.5] },
      { a: [8, 3.5], b: [8, 6] },
    ],
    openings: [
      { wall: 0, t: 0.2, kind: 'window' },
      { wall: 0, t: 0.7, kind: 'window' },
      { wall: 3, t: 0.15, kind: 'door' },
      { wall: 5, t: 0.85, kind: 'door' },
      { wall: 6, t: 0.85, kind: 'door' },
      { wall: 7, t: 0.5, kind: 'door' },
    ],
  },
  {
    id: 'apartment-3',
    name: '3-комнатная квартира',
    description: 'Три комнаты + кухня + ванная + прихожая (12×6 м)',
    rooms: 6,
    walls: [
      { a: [0, 0], b: [12, 0] },
      { a: [12, 0], b: [12, 6] },
      { a: [12, 6], b: [0, 6] },
      { a: [0, 6], b: [0, 0] },
      { a: [4, 0], b: [4, 6] },
      { a: [8, 0], b: [8, 3.5] },
      { a: [8, 3.5], b: [12, 3.5] },
      { a: [10, 3.5], b: [10, 6] },
    ],
    openings: [
      { wall: 0, t: 0.2, kind: 'window' },
      { wall: 0, t: 0.6, kind: 'window' },
      { wall: 0, t: 0.9, kind: 'window' },
      { wall: 3, t: 0.15, kind: 'door' },
      { wall: 5, t: 0.85, kind: 'door' },
      { wall: 6, t: 0.85, kind: 'door' },
      { wall: 7, t: 0.15, kind: 'door' },
      { wall: 8, t: 0.5, kind: 'door' },
    ],
  },
]
