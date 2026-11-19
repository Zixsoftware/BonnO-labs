import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import {
  BufferGeometry, Color, Curve, Float32BufferAttribute, Group, MathUtils, Vector3,
} from 'three'

const violet = '#7958F5'
const mint = '#26D9C3'
const twoPi = Math.PI * 2
const camera = { position: [0, 0, 8.9] as [number, number, number], fov: 34, near: 0.1, far: 28 }
const contextOptions = { alpha: true, antialias: true, powerPreference: 'low-power' as const }
const dpr = [1, 1.35] as [number, number]
const canvasResize = { scroll: false }

function ribbonPoint(t: number, width: number, depth: number) {
  const radius = 1.42 + 0.39 * Math.cos(3 * t)
  const radialRate = -1.17 * Math.sin(3 * t)
  const cosine = Math.cos(2 * t)
  const sine = Math.sin(2 * t)
  const tangent = new Vector3(radialRate * cosine - 2 * radius * sine, radialRate * sine + 2 * radius * cosine, 1.62 * Math.cos(3 * t)).normalize()
  const across = new Vector3(cosine, sine, 0)
  across.addScaledVector(tangent, -across.dot(tangent)).normalize()
  const normal = new Vector3().crossVectors(tangent, across)
  const roll = t + 0.7 * Math.sin(3 * t) + 0.2
  return new Vector3(radius * cosine, radius * sine, 0.54 * Math.sin(3 * t))
    .addScaledVector(across, width * Math.cos(roll) - depth * Math.sin(roll))
    .addScaledVector(normal, width * Math.sin(roll) + depth * Math.cos(roll))
}

class RibbonEdge extends Curve<Vector3> {
  constructor(private width: number, private depth: number) {
    super()
  }

  getPoint(progress: number, target = new Vector3()) {
    return target.copy(ribbonPoint(progress * twoPi, this.width, this.depth))
  }
}

function makeRibbon() {
  const profile = [
    [0.28, 0.045], [0.23, 0.082], [-0.23, 0.082], [-0.28, 0.045],
    [-0.28, -0.045], [-0.23, -0.082], [0.23, -0.082], [0.28, -0.045],
  ]
  const segments = 144
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const shadow = new Color('#263566')
  const highlight = new Color('#967cff')

  for (let segment = 0; segment < segments; segment++) {
    const t = (segment / segments) * twoPi
    profile.forEach(([width, depth], corner) => {
      const position = ribbonPoint(t, width, depth)
      positions.push(position.x, position.y, position.z)
      const color = shadow.clone().lerp(highlight, 0.48 + 0.38 * Math.sin(3 * t + corner * 0.35))
      colors.push(color.r, color.g, color.b)
      const index = segment * profile.length + corner
      const adjacent = segment * profile.length + (corner + 1) % profile.length
      const next = ((segment + 1) % segments) * profile.length
      indices.push(index, adjacent, next + corner, adjacent, next + (corner + 1) % profile.length, next + corner)
    })
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function makeDust() {
  const positions: number[] = []
  for (let index = 0; index < 84; index++) {
    const angle = index * 2.399963
    const radius = 1.9 + ((index * 37) % 89) / 56
    positions.push(Math.sin(angle) * radius, Math.cos(angle) * radius * 0.81, ((index * 43) % 97) / 49 - 1.25)
  }
  return new Float32BufferAttribute(positions, 3)
}

type SceneProps = {
  stage: RefObject<HTMLDivElement | null>
  onReady: (ready: boolean) => void
  onLoss: () => void
}

function OrbitalAssembly({ stage, onReady, onLoss }: SceneProps) {
  const sculpture = useRef<Group>(null)
  const surroundings = useRef<Group>(null)
  const target = useRef({ visible: true, scroll: 0, x: 0, y: 0 })
  const firstFrame = useRef(true)
  const invalidate = useThree((state) => state.invalidate)
  const canvas = useThree((state) => state.gl.domElement)
  const ribbon = useMemo(makeRibbon, [])
  const dust = useMemo(makeDust, [])
  const mintEdge = useMemo(() => new RibbonEdge(0.26, 0.071), [])
  const violetEdge = useMemo(() => new RibbonEdge(-0.26, -0.071), [])

  useEffect(() => () => ribbon.dispose(), [ribbon])

  useEffect(() => {
    const area = stage.current
    const hero = area?.closest<HTMLElement>('.hero')
    if (!area || !hero) return
    let height = area.clientHeight

    function invalidateVisible() {
      if (target.current.visible && !document.hidden) invalidate()
    }

    function scroll() {
      target.current.scroll = MathUtils.clamp(window.scrollY / (height + 80), 0, 1)
      invalidateVisible()
    }

    function point(event: PointerEvent) {
      const { left, top, width, height } = hero!.getBoundingClientRect()
      target.current.x = ((event.clientX - left) / width - 0.5) * 0.3
      target.current.y = ((event.clientY - top) / height - 0.5) * 0.26
      invalidateVisible()
    }

    function resetPointer() {
      target.current.x = target.current.y = 0
      invalidateVisible()
    }

    const resize = new ResizeObserver(() => {
      height = area.clientHeight
      scroll()
    })
    resize.observe(area)
    const visibility = new IntersectionObserver(([entry]) => {
      target.current.visible = entry.isIntersecting
      if (entry.isIntersecting) scroll()
    })
    visibility.observe(area)
    window.addEventListener('scroll', scroll, { passive: true })
    document.addEventListener('visibilitychange', invalidateVisible)
    hero.addEventListener('pointermove', point, { passive: true })
    hero.addEventListener('pointerleave', resetPointer)
    canvas.addEventListener('webglcontextlost', onLoss)
    scroll()

    return () => {
      resize.disconnect()
      visibility.disconnect()
      window.removeEventListener('scroll', scroll)
      document.removeEventListener('visibilitychange', invalidateVisible)
      hero.removeEventListener('pointermove', point)
      hero.removeEventListener('pointerleave', resetPointer)
      canvas.removeEventListener('webglcontextlost', onLoss)
    }
  }, [canvas, invalidate, onLoss, stage])

  useFrame((_, delta) => {
    const object = sculpture.current
    const rings = surroundings.current
    const { visible, scroll, x, y } = target.current
    if (!object || !rings || !visible || document.hidden) return
    const next = [
      [object.rotation, 'x', 0.24 + y + scroll * 0.42],
      [object.rotation, 'y', -0.37 + x + scroll * 0.96],
      [object.rotation, 'z', -0.21 + scroll * 0.42],
      [object.position, 'y', 0.06 + scroll * 0.64],
      [rings.rotation, 'y', 0.15 + x * 0.42 + scroll * 0.26],
      [rings.rotation, 'z', -0.12 + scroll * 0.34],
    ] as const
    let moving = false
    for (const [transform, axis, goal] of next) {
      const value = firstFrame.current ? goal : MathUtils.damp(transform[axis], goal, 5, Math.min(delta, 0.05))
      transform[axis] = value
      moving ||= Math.abs(value - goal) > 0.001
    }
    if (firstFrame.current) {
      firstFrame.current = false
      onReady(true)
    }
    if (moving) invalidate()
  })

  return (
    <>
      <hemisphereLight args={['#c7cfff', '#281358', 1.45]} />
      <directionalLight position={[-3, 4, 4]} color="#c8ddff" intensity={3.8} />
      <directionalLight position={[3, 1, -3]} color={violet} intensity={3.4} />
      <pointLight position={[2.5, -3, 3]} color={mint} intensity={31} />
      <group ref={sculpture}>
        <mesh geometry={ribbon}>
          <meshStandardMaterial vertexColors color="#f4efff" emissive="#302575" emissiveIntensity={0.4} metalness={0.32} roughness={0.31} />
        </mesh>
        <mesh>
          <tubeGeometry args={[mintEdge, 144, 0.021, 6, true]} />
          <meshBasicMaterial color="#73ffe6" />
        </mesh>
        <mesh>
          <tubeGeometry args={[violetEdge, 144, 0.013, 5, true]} />
          <meshBasicMaterial color="#ae94ff" />
        </mesh>
      </group>
      <group ref={surroundings}>
        <mesh rotation={[0.56, -0.19, 0.15]}>
          <torusGeometry args={[2.36, 0.008, 5, 96]} />
          <meshBasicMaterial color="#9476ff" transparent opacity={0.49} />
        </mesh>
        <mesh rotation={[0.66, -0.37, 0.3]}>
          <torusGeometry args={[2.57, 0.006, 5, 88, Math.PI * 1.63]} />
          <meshBasicMaterial color="#7f9cd9" transparent opacity={0.26} />
        </mesh>
        <mesh rotation={[1.02, 0.25, -0.38]}>
          <torusGeometry args={[2.46, 0.007, 5, 88, Math.PI * 1.43]} />
          <meshBasicMaterial color={mint} transparent opacity={0.39} />
        </mesh>
        <points>
          <bufferGeometry><primitive attach="attributes-position" object={dust} /></bufferGeometry>
          <pointsMaterial color="#a9b7ff" size={0.026} transparent opacity={0.63} depthWrite={false} />
        </points>
        <mesh position={[-1.93, 1.1, 0.58]}>
          <icosahedronGeometry args={[0.075, 0]} />
          <meshBasicMaterial color="#9e88ff" />
        </mesh>
        <mesh position={[1.85, -1.25, 0.62]}>
          <icosahedronGeometry args={[0.05, 0]} />
          <meshBasicMaterial color="#a4f9e8" />
        </mesh>
      </group>
    </>
  )
}

export default function OrbitScene(props: SceneProps) {
  return (
    <Canvas camera={camera} dpr={dpr} gl={contextOptions} resize={canvasResize} frameloop="demand" tabIndex={-1}>
      <OrbitalAssembly {...props} />
    </Canvas>
  )
}
