import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren, ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { usePlanStore } from '../store'
import type { PlacedItem, Wall } from '../types'

const H = 2.7
const T = 0.12
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

// если модель упала с ошибкой — показываем бокс, не роняя всю сцену
class ModelErrorBoundary extends Component<
  PropsWithChildren<{ fallback: ReactNode }>,
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

function ModelBody({ url, target }: { url: string; target: [number, number, number] }) {
  const { scene } = useGLTF(url, true) // true — поддержка Draco-сжатия
  const { model, size, center, minY } = useMemo(() => {
    const m = scene.clone(true)
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    const box = new THREE.Box3().setFromObject(m)
    return {
      model: m,
      size: box.getSize(new THREE.Vector3()),
      center: box.getCenter(new THREE.Vector3()),
      minY: box.min.y,
    }
  }, [scene])

  const scale: [number, number, number] = [
    target[0] / Math.max(size.x, 0.001),
    target[1] / Math.max(size.y, 0.001),
    target[2] / Math.max(size.z, 0.001),
  ]

  return (
    <group scale={scale}>
      {/* центрируем и опускаем на пол в локальных координатах модели */}
      <group position={[-center.x, -minY, -center.z]}>
        <primitive object={model} />
      </group>
    </group>
  )
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

  const box = (
    <mesh castShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={colorFor(item.item.id)} />
    </mesh>
  )

  return (
    <group
      position={[x, item.item.modelUrl ? 0 : h / 2, z]}
      rotation-y={item.rotY}
      onPointerDown={(e) => {
        e.stopPropagation()
        onStartDrag(item.uid, item.pos)
        document.body.style.cursor = 'grabbing'
      }}
      onDoubleClick={() => rotateItem(item.uid)}
    >
      {item.item.modelUrl ? (
        <ModelErrorBoundary fallback={box}>
          <Suspense fallback={box}>
            <ModelBody url={item.item.modelUrl} target={[w, h, d]} />
          </Suspense>
        </ModelErrorBoundary>
      ) : (
        box
      )}
    </group>
  )
}

function Scene() {
  const walls = usePlanStore((s) => s.walls)
  const placed = usePlanStore((s) => s.placed)
  const moveItem = usePlanStore((s) => s.moveItem)

  const [drag, setDrag] = useState<{ uid: string; pos: [number, number] } | null>(null)
  const dragRef = useRef(drag)
  dragRef.current = drag

  useEffect(() => {
    const up = () => {
      const d = dragRef.current
      if (d) {
        moveItem(d.uid, d.pos)
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
      <Canvas shadows gl={{ preserveDrawingBuffer: true }} camera={{ position: [8, 7, 10], fov: 50 }}>
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