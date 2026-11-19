import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'
import {
  BufferGeometry, Color, Curve, Float32BufferAttribute, Group, MathUtils, Vector3,
} from 'three'

const violet = '#7958F5'
const mint = '#26D9C3'
const twoPi = Math.PI * 2
const camera = { position: [0, 0, 8.65] as [number, number, number], fov: 35, near: 0.1, far: 28 }
const contextOptions = { alpha: true, antialias: true }
const dpr = [1, 1.35] as [number, number]
const canvasResize = { scroll: false }
const minimumFrameInterval = 1000 / 75

// Position, rotation and camera position are keyed to the document sections.
const choreography = [
  { section: '.hero', pose: [0.05, 0.04, 0, 0.24, -0.42, -0.22, 0, 0, 8.65] },
  { section: '#services', pose: [0.52, 0.37, 0.15, -0.41, 0.68, 0.55, 0.51, 0.28, 8.65] },
  { section: '#technologies', pose: [-0.53, -0.46, 0.17, 0.59, 1.52, 1.24, -0.49, -0.32, 8.35] },
  { section: '#about', pose: [0.42, 0.42, 0.28, -0.33, 2.45, 1.73, 0.45, 0.4, 8.85] },
  { section: '#portfolio', pose: [-0.42, -0.22, 0.15, 0.43, 3.32, 2.31, -0.44, -0.18, 8.65] },
  { section: '#contact', pose: [0.32, 0.28, 0.05, -0.54, 4.38, 2.91, 0.4, 0.28, 8.6] },
] as const
type ScrollStop = { scroll: number; pose: readonly number[] }

function scrollStops(main: HTMLElement): ScrollStop[] {
  return choreography.flatMap(({ section, pose }, index) => {
    const element = main.querySelector(section)
    if (!element) return []
    return [{ scroll: index === 0 ? 0 : element.getBoundingClientRect().top + window.scrollY - 155, pose }]
  })
}

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
  for (let index = 0; index < 48; index++) {
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
  const target = useRef({ visible: true, scroll: 0, width: 1, height: 1, stops: [] as ScrollStop[] })
  const fittedPose = useRef<number[]>([...choreography[0].pose])
  const firstFrame = useRef(true)
  const lastFrame = useRef(-Infinity)
  const pendingFrame = useRef<number | undefined>(undefined)
  const invalidate = useThree((state) => state.invalidate)
  const sceneCamera = useThree((state) => state.camera)
  const canvas = useThree((state) => state.gl.domElement)
  const ribbon = useMemo(makeRibbon, [])
  const dust = useMemo(makeDust, [])
  const mintEdge = useMemo(() => new RibbonEdge(0.26, 0.071), [])
  const violetEdge = useMemo(() => new RibbonEdge(-0.26, -0.071), [])

  const requestFrame = useCallback(() => {
    if (!target.current.visible || document.hidden || pendingFrame.current !== undefined) return
    const delay = minimumFrameInterval - (performance.now() - lastFrame.current)
    if (delay <= 0) {
      invalidate()
      return
    }
    pendingFrame.current = window.setTimeout(() => {
      pendingFrame.current = undefined
      if (target.current.visible && !document.hidden) invalidate()
    }, delay)
  }, [invalidate])

  useEffect(() => () => ribbon.dispose(), [ribbon])

  useEffect(() => {
    const area = stage.current
    const main = area?.closest<HTMLElement>('main')
    if (!area || !main) return

    function scroll() {
      target.current.scroll = window.scrollY
      requestFrame()
    }

    function measure() {
      target.current.stops = scrollStops(main!)
      target.current.width = area!.clientWidth
      target.current.height = area!.clientHeight
      scroll()
    }
    const resize = new ResizeObserver(measure)
    resize.observe(main)
    resize.observe(area)
    const visibility = new IntersectionObserver(([entry]) => {
      target.current.visible = entry.isIntersecting
      if (entry.isIntersecting) scroll()
    }, { threshold: 0.05 })
    visibility.observe(area)
    window.addEventListener('scroll', scroll, { passive: true })
    document.addEventListener('visibilitychange', requestFrame)
    canvas.addEventListener('webglcontextlost', onLoss)
    measure()

    return () => {
      resize.disconnect()
      visibility.disconnect()
      window.removeEventListener('scroll', scroll)
      document.removeEventListener('visibilitychange', requestFrame)
      canvas.removeEventListener('webglcontextlost', onLoss)
      window.clearTimeout(pendingFrame.current)
      pendingFrame.current = undefined
    }
  }, [canvas, onLoss, requestFrame, stage])

  useFrame((_, delta) => {
    lastFrame.current = performance.now()
    const object = sculpture.current
    const rings = surroundings.current
    const { visible, scroll, width, height, stops } = target.current
    if (!object || !rings || !visible || document.hidden || width < 1 || height < 1 || stops.length === 0) return

    const index = stops.findIndex((stop) => stop.scroll >= scroll)
    const after = stops[index < 0 ? stops.length - 1 : index]
    const before = index > 0 ? stops[index - 1] : after
    const fraction = before === after ? 0 : MathUtils.clamp((scroll - before.scroll) / (after.scroll - before.scroll), 0, 1)
    const pose = fittedPose.current
    let moving = false
    for (let i = 0; i < pose.length; i++) {
      const goal = MathUtils.lerp(before.pose[i], after.pose[i], fraction)
      const value = firstFrame.current ? goal : MathUtils.damp(pose[i], goal, 7, Math.min(delta, 0.05))
      pose[i] = value
      moving ||= Math.abs(value - goal) > 0.001
    }
    const [x, y, z, pitch, yaw, roll, cameraX, cameraY, cameraZ] = pose
    const fit = Math.min(1.05, Math.max(0.6, (width / height) * 1.17))
    object.scale.setScalar(fit)
    object.position.set(x * fit, y * fit, z)
    object.rotation.set(pitch, yaw, roll)
    rings.scale.setScalar(fit)
    rings.position.set(x * fit * 0.38, y * fit * 0.42, -0.22)
    rings.rotation.set(pitch * 0.23, yaw * 0.24, roll * 0.31)
    sceneCamera.position.set(cameraX, cameraY, cameraZ)
    sceneCamera.lookAt(0, 0, 0)
    if (firstFrame.current) {
      firstFrame.current = false
      onReady(true)
    }
    if (moving) requestFrame()
  })

  return (
    <>
      <hemisphereLight args={['#c7cfff', '#281358', 1.15]} />
      <directionalLight position={[-3, 4, 4]} color="#e9ecff" intensity={4.25} />
      <directionalLight position={[3, 1, -3]} color={violet} intensity={4.1} />
      <pointLight position={[2.5, -3, 3]} color={mint} intensity={38} />
      <group ref={sculpture}>
        <mesh geometry={ribbon}>
          <meshPhysicalMaterial vertexColors color="#f4efff" emissive="#37267f" emissiveIntensity={0.46}
            metalness={0.39} roughness={0.27} clearcoat={0.46} clearcoatRoughness={0.29} />
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
