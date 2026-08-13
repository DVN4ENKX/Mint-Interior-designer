import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { usePlanStore } from '../store'
import type { PlacedItem, Wall } from '../types'

const H = 2.7  // высота потолка
const T = 0.12 // толщина стен
const snap = (v: number) => Math.round(v * 10) / 10

function bbox(walls: Wall[]) {
  if (walls.length === 0) return { minX: -3, maxX: 3, minZ: -3, maxZ: 3 }
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const w of walls)
    for (const p of [w.a, w.b]) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
      minZ = Math.min(minZ, p.y); maxZ = Math.max(maxZ, p.y)
    }
  return { minX, maxX, minZ, maxZ }
}

const colorFor = (id: string) => {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${h}, 45%, 62%)`
}

function WallMesh({ wall }: { wall: Wall }) {
  const len = Math.hypot(wall.b.x - wall.a.x, wall.b.y - wall.a.y)
  const mx = (wall.a.x + wall.b.x) / 2
  const mz = (wall.a.y + wall.b.y) / 2
  const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x)
  return (
    <mesh position={[mx, H / 2, mz]} rotation-y={-angle} castShadow receiveShadow>
      <boxGeometry args={[len + T, H, T]} />
      <meshStandardMaterial color="#dcdcdc" />
    </mesh>
  )
}

function ItemMesh({
  item,
  override,
  onStartDrag,
}: {
  item: PlacedItem
  override: [number, number] | null
  onStartDrag: (uid: string, pos: [number, number]) => void
}) {
  const rotateItem = usePlanStore((s) => s.rotateItem)
  const [w, h, d] = item.item.size
  const [x, z] = override ?? item.pos
  return (
    <mesh
      position={[x, h / 2, z]}
      rotation-y={item.rotY}
      castShadow
      onPointerDown={(e) => {
        e.stopPropagation()
        onStartDrag(item.uid, item.pos)
        document.body.style.cursor = 'grabbing'
      }}
      onDoubleClick={() => rotateItem(item.uid)}
    >
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={colorFor(item.item.id)} />
    </mesh>
  )
}

function Scene() {
  const walls = usePlanStore((s) => s.walls)
  const placed = usePlanStore((s) => s.placed)
  const moveItem = usePlanStore((s) => s.moveItem)

  // «живая» позиция во время перетаскивания — в store попадёт только commit
  const [drag, setDrag] = useState<{ uid: string; pos: [number, number] } | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag

  useEffect(() => {
    const up = () => {
      const d = dragRef.current
      if (d) {
        moveItem(d.uid, d.pos) // ровно ОДНА запись в истории undo на весь drag
        setDrag(null)
        document.body.style.cursor = ''
      }
    }
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [moveItem])

  const b = useMemo(() => bbox(walls), [walls])
  const cx = (b.minX + b.maxX) / 2
  const cz = (b.minZ + b.maxZ) / 2
  const fw = b.maxX - b.minX + 4
  const fd = b.maxZ - b.minZ + 4

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[cx + 6, 10, cz + 4]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      {/* пол: он же «ловит» мышь во время перетаскивания */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[cx, 0, cz]}
        receiveShadow
        onPointerMove={(e) => {
          if (drag) setDrag({ uid: drag.uid, pos: [snap(e.point.x), snap(e.point.z)] })
        }}
      >
        <planeGeometry args={[fw, fd]} />
        <meshStandardMaterial color="#efe9df" />
      </mesh>
      <Grid
        position={[cx, 0.01, cz]}
        args={[fw, fd]}
        cellSize={0.5}
        sectionSize={1}
        cellColor="#ddd6c9"
        sectionColor="#c9c0ae"
        fadeDistance={Math.max(fw, fd) * 2}
      />

      {walls.map((w) => (
        <WallMesh key={w.id} wall={w} />
      ))}
      {placed.map((p) => (
        <ItemMesh
          key={p.uid}
          item={p}
          override={drag?.uid === p.uid ? drag.pos : null}
          onStartDrag={(uid, pos) => setDrag({ uid, pos })}
        />
      ))}

      <OrbitControls makeDefault enabled={!drag} target={[cx, 0, cz]} />
    </>
  )
}

export default function ViewportPanel() {
  const placed = usePlanStore((s) => s.placed)
  const total = placed.reduce((sum, p) => sum + p.item.price, 0)
  return (
    <section className="panel viewport">
      <Canvas shadows camera={{ position: [8, 7, 10], fov: 50 }}>
        <Scene />
      </Canvas>
      <div className="hud">
        Предметов: {placed.length} · Итого: {total.toLocaleString('ru-RU')} ₽
        <br />
        Мышь — обзор, колесо — зум, мебель тащим мышью, двойной клик — поворот на 90°
      </div>
    </section>
  )
}