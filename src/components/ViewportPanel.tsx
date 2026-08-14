import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren, ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { usePlanStore } from '../store'
import type { Opening, PlacedItem, Wall } from '../types'
import { WALL_T, wallBoxes, wallLen } from '../lib/openings'
import { collidesWalls, stackHeightAt } from '../lib/collision'

const snap = (v: number) => Math.round(v * 10) / 10

// на сколько поднять предмет, чтобы при наклоне по X/Z он не уходил под пол (y = 0)
function floorLift(
  size: [number, number, number],
  rotX: number,
  rotY: number,
  rotZ: number,
): number {
  const [w, h, d] = size
  const box = new THREE.Box3(
    new THREE.Vector3(-w / 2, 0, -d / 2),
    new THREE.Vector3(w / 2, h, d / 2),
  )
  box.applyMatrix4(
    new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'XYZ')),
  )
  return Math.max(0, -box.min.y)
}

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

function WallMesh({ wall, openings }: { wall: Wall; openings: Opening[] }) {
  const L = wallLen(wall)
  const boxes = useMemo(() => wallBoxes(wall, openings), [wall, openings])
  const angle = Math.atan2(wall.b.y - wall.a.y, wall.b.x - wall.a.x)
  const color = wall.color ?? '#dcdcdc'
  return (
    <>
      {boxes.map((b, i) => {
        const len = (b.t1 - b.t0) * L
        const tMid = (b.t0 + b.t1) / 2
        const mx = wall.a.x + (wall.b.x - wall.a.x) * tMid
        const mz = wall.a.y + (wall.b.y - wall.a.y) * tMid
        const h = b.y1 - b.y0
        return (
          <mesh
            key={i}
            position={[mx, (b.y0 + b.y1) / 2, mz]}
            rotation-y={-angle}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[len + WALL_T, h, WALL_T]} />
            <meshStandardMaterial color={color} />
          </mesh>
        )
      })}
    </>
  )
}

// наводим камеру на комнату один раз, когда появляются стены (иначе видна только «стандартная» зона)
function FrameCamera({
  hasWalls,
  bounds,
}: {
  hasWalls: boolean
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
}) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void } | null
  const size = useThree((s) => s.size)
  const done = useRef(false)

  useEffect(() => {
    if (done.current || !hasWalls) return
    const w = Math.max(bounds.maxX - bounds.minX, 1)
    const d = Math.max(bounds.maxZ - bounds.minZ, 1)
    const cx = (bounds.minX + bounds.maxX) / 2
    const cz = (bounds.minZ + bounds.maxZ) / 2
    const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
    const aspect = Math.max(size.width / Math.max(size.height, 1), 0.1)
    const distW = w / (2 * Math.tan(fov / 2) * aspect)
    const distD = d / (2 * Math.tan(fov / 2))
    const dist = Math.max(distW, distD) * 1.15 + 1
    camera.position.set(cx + dist * 0.55, dist * 0.7, cz + dist * 0.6)
    if (controls) {
      controls.target.set(cx, 0, cz)
      controls.update()
    } else {
      camera.lookAt(cx, 0, cz)
    }
    done.current = true
  }, [hasWalls, bounds, camera, controls, size])
  return null
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
  const rotateItemBy = usePlanStore((s) => s.rotateItemBy)
  const selectPlaced = usePlanStore((s) => s.selectPlaced)
  const placed = usePlanStore((s) => s.placed)
  const [w, h, d] = item.item.size
  const [x, z] = override ?? item.pos
  const lastRightClick = useRef(0)
  const lift = floorLift(item.item.size, item.rotX ?? 0, item.rotY, item.rotZ ?? 0)
  // во время перетаскивания высота считается по текущей точке (предмет встаёт на другой),
  // после отпускания — по сохранённому значению из store
  const baseY = override ? stackHeightAt(x, z, item.uid, placed) : (item.y ?? 0)

  const box = (
    <mesh position={[0, h / 2, 0]} castShadow>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={colorFor(item.item.id)} />
    </mesh>
  )

  return (
    <group
      position={[x, baseY + lift, z]}
      rotation={[item.rotX ?? 0, item.rotY, item.rotZ ?? 0]}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.stopPropagation()
        selectPlaced(item.uid)
        onStartDrag(item.uid, item.pos)
        document.body.style.cursor = 'grabbing'
      }}
      onDoubleClick={() => rotateItemBy(item.uid, Math.PI / 18)}
      onContextMenu={(e) => {
        e.stopPropagation()
        e.nativeEvent.preventDefault()
        const now = Date.now()
        if (now - lastRightClick.current < 350) {
          lastRightClick.current = 0
          rotateItemBy(item.uid, -Math.PI / 18)
        } else {
          lastRightClick.current = now
        }
      }}
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

// сетка адаптируется к расстоянию камеры: вблизи клетка 0.5м, при отдалении укрупняется,
// чтобы линии не сливались в кашу (на большом плане при жёсткой камере сетка была видна лишь «стандартным диапазоном»)
const GRID_LEVELS = [0.5, 1, 2, 5, 10]
function FloorGrid({ args, center }: { args: [number, number]; center: [number, number, number] }) {
  const [cell, setCell] = useState(0.5)
  const lastKey = useRef('')
  const centerV = useMemo(() => new THREE.Vector3(...center), [center])
  useFrame(({ camera }) => {
    const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180
    const visH = 2 * camera.position.distanceTo(centerV) * Math.tan(fov / 2)
    const target = visH / 50
    let level = GRID_LEVELS[0]
    for (const l of GRID_LEVELS) if (target >= l) level = l
    const key = String(level)
    if (key !== lastKey.current) {
      lastKey.current = key
      setCell(level)
    }
  })
  return (
    <Grid
      position={center}
      args={args}
      cellSize={cell}
      sectionSize={cell * 5}
      cellThickness={0.8}
      sectionThickness={1.6}
      cellColor="#cfc7b8"
      sectionColor="#b4a88f"
      fadeDistance={500}
    />
  )
}

function Scene() {
  const walls = usePlanStore((s) => s.walls)
  const placed = usePlanStore((s) => s.placed)
  const openings = usePlanStore((s) => s.openings)
  const moveItem = usePlanStore((s) => s.moveItem)
  const selectPlaced = usePlanStore((s) => s.selectPlaced)

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

  // точка для драга с учётом коллизий: при пересечении остаёмся на последней валидной
  const freePos = (cand: [number, number]): [number, number] => {
    const d = drag
    if (!d) return cand
    const self = placed.find((p) => p.uid === d.uid)
    if (!self) return cand
    const size = self.item.size
    // предметы можно ставить друг на друга — ограничиваем только стенами
    if (!collidesWalls(cand[0], cand[1], size, self.rotY, walls, openings)) return cand
    return d.pos
  }

  return (
    <>
      <FrameCamera hasWalls={walls.length > 0} bounds={b} />
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
        onPointerDown={() => selectPlaced(null)}
        onPointerMove={(e) => {
          if (drag) {
            const pos = freePos([snap(e.point.x), snap(e.point.z)])
            setDrag({ uid: drag.uid, pos })
          }
        }}
      >
        <planeGeometry args={[fw, fd]} />
        <meshStandardMaterial color="#efe9df" />
      </mesh>
      <FloorGrid args={[fw, fd]} center={[cx, 0.01, cz]} />

      {walls.map((w) => (
        <WallMesh key={w.id} wall={w} openings={openings} />
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
  const selectedPlacedId = usePlanStore((s) => s.selectedPlacedId)
  const rotateItemAround = usePlanStore((s) => s.rotateItemAround)
  const total = placed.reduce((sum, p) => sum + p.item.price, 0)
  const selectedItem = placed.find((p) => p.uid === selectedPlacedId) ?? null
  return (
    <section
      className="card viewport-panel position-relative overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      <Canvas
        shadows
        gl={{ preserveDrawingBuffer: true, alpha: true }}
        camera={{ position: [8, 7, 10], fov: 50 }}
      >
        <Scene />
      </Canvas>
      {selectedItem && (
        <div className="selection-controls">
          <span
            className="small fw-semibold text-truncate"
            title={selectedItem.item.name}
          >
            {selectedItem.item.name}
          </span>
          <span className="small text-secondary">X</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary py-0 px-2"
            onClick={() => rotateItemAround(selectedItem.uid, 'x', -Math.PI / 18)}
            title="Наклон по X на −10°"
          >
            −10°
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary py-0 px-2"
            onClick={() => rotateItemAround(selectedItem.uid, 'x', Math.PI / 18)}
            title="Наклон по X на +10°"
          >
            +10°
          </button>
          <span className="small text-secondary ms-1">Z</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary py-0 px-2"
            onClick={() => rotateItemAround(selectedItem.uid, 'z', -Math.PI / 18)}
            title="Наклон по Z на −10°"
          >
            −10°
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary py-0 px-2"
            onClick={() => rotateItemAround(selectedItem.uid, 'z', Math.PI / 18)}
            title="Наклон по Z на +10°"
          >
            +10°
          </button>
        </div>
      )}
      <div className="hud">
        Предметов: {placed.length} · Итого: {total.toLocaleString('ru-RU')} ₽
        <br />
        Мышь — обзор, колесо — зум, мебель тащим мышью. Двойной клик — поворот на 10°,
        ПКМ × 2 — на −10° (ось X/Z — кнопки на панели при выборе объекта). Предметы можно
        ставить друг на друга — верхний встанет на верхнюю грань нижнего
      </div>
    </section>
  )
}