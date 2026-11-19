import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  AdditiveBlending, BufferGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, Group, InstancedMesh,
  MathUtils, Object3D, Path, PMREMGenerator, PointLight, ShaderMaterial, Shape, Vector3,
} from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const mint = '#26d9c3'
const violet = '#7958f5'
const ice = '#a4c8ff'
const lens = { position: [0, 0.3, 12] as [number, number, number], fov: 54, near: 0.16, far: 100 }
const glOptions = { alpha: true, antialias: true }
const pixelRatio = [1, 1.25] as [number, number]
const resizeOptions = { scroll: false }
const panLook = new Vector3()

// Camera position and target are measured against the actual document sections.
const flight = [
  { section: '.hero', pose: [0, 0.3, 12, 0.5, -0.1, -11] },
  { section: '#services', pose: [3.8, 1.6, -12, -2.8, 0.1, -36] },
  { section: '#solutions', pose: [-1.0, 1.1, -24, -0.2, -0.3, -49] },
  { section: '#technologies', pose: [-4.5, -0.8, -37, 1.5, 0.6, -62] },
  { section: '#about', pose: [3.5, -1.7, -62, -2.8, 0.9, -87] },
  { section: '#portfolio', pose: [-4.3, 1.4, -87, 2.9, -0.5, -111] },
  { section: '#contact', pose: [3.7, -0.6, -112, -2.3, 0.1, -138] },
  { section: null, pose: [-2.3, 1.4, -137, 1.5, -1.0, -162] },
] as const

const chambers = [
  { x: 0.5, y: 0.4, z: -9, tilt: -0.26, yaw: -0.23, color: violet, accent: mint, sides: 8 },
  { x: -2.5, y: 0.4, z: -34, tilt: 0.53, yaw: 0.41, color: '#ac64fa', accent: ice, sides: 6 },
  { x: 2.1, y: 1.0, z: -59, tilt: -0.47, yaw: -0.38, color: '#36b9dc', accent: mint, sides: 12 },
  { x: -2.8, y: 1.5, z: -84, tilt: 0.30, yaw: 0.52, color: '#9b69fc', accent: '#efb8ff', sides: 5 },
  { x: 2.2, y: -0.3, z: -109, tilt: -0.62, yaw: -0.41, color: '#6c80ff', accent: '#5df1d4', sides: 8 },
  { x: -2.0, y: 0.7, z: -134, tilt: 0.34, yaw: 0.26, color: '#6668fa', accent: '#70ffd4', sides: 6 },
  { x: 1.0, y: -0.6, z: -158, tilt: -0.20, yaw: -0.35, color: '#2bc3ba', accent: '#b0faff', sides: 10 },
] as const

type Stop = { scroll: number; pose: readonly number[] }
type WorldProps = { onReady: (ready: boolean) => void; onLoss: () => void }

function measureFlight(): Stop[] {
  const end = Math.max(1, document.documentElement.scrollHeight - innerHeight)
  return flight.map(({ section, pose }, index) => {
    if (!section) return { scroll: end, pose }
    const node = document.querySelector(section)
    const top = node ? node.getBoundingClientRect().top + scrollY : end * index / (flight.length - 1)
    return { scroll: index === 0 ? 0 : MathUtils.clamp(top - innerHeight * 0.3, 1, end - 1), pose }
  })
}

function makeAtmosphere() {
  const positions: number[] = []
  const colors: number[] = []
  const variations: number[] = []
  const palette = [new Color('#9fd6ff'), new Color('#ac87ff'), new Color('#55eacf')]
  const random = MathUtils.seededRandom
  random(4817)

  for (let index = 0; index < 1150; index++) {
    positions.push((random() - 0.5) * 53, (random() - 0.5) * 30, 10 - random() * 187)
    palette[index % 3].toArray(colors, index * 3)
    variations.push(random())
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setAttribute('variation', new Float32BufferAttribute(variations, 1))
  return geometry
}

const dustVertex = `
  attribute float variation;
  attribute vec3 color;
  uniform float time;
  varying vec3 tint;
  varying float glow;
  void main() {
    vec3 point = position + vec3(sin(time*.28 + variation*31.)*.26, cos(time*.22 + variation*24.)*.22, 0.);
    vec4 view = modelViewMatrix * vec4(point, 1.);
    float d = -view.z;
    tint = color;
    glow = smoothstep(2., 9., d) * (1.-smoothstep(30., 82., d)) * (.47+.46*variation);
    gl_PointSize = clamp((.78+1.75*variation) * (24./max(d,3.)), 1.05, 6.);
    gl_Position = projectionMatrix * view;
  }`
const dustFragment = `
  varying vec3 tint;
  varying float glow;
  void main() {
    float d = length(gl_PointCoord - .5) * 2.;
    gl_FragColor = vec4(tint, (1.-smoothstep(.03, 1., d)) * glow);
    #include <colorspace_fragment>
  }`

const hazeVertex = `
  varying vec2 plate;
  void main() {
    plate = uv * 2. - 1.;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }`
const hazeFragment = `
  uniform vec3 tint;
  varying vec2 plate;
  void main() {
    float distanceToCenter = length(plate);
    float haze = exp(-4.7 * distanceToCenter * distanceToCenter) * (1. - smoothstep(.66, 1., distanceToCenter));
    gl_FragColor = vec4(tint, haze * .15);
    #include <colorspace_fragment>
  }`

function flightLines() {
  const positions: number[] = []
  const colors: number[] = []
  const mintLight = new Color('#5bffe4')
  const violetLight = new Color('#897aff')
  for (let lane = 0; lane < 10; lane++) {
    const side = lane % 2 ? -1 : 1
    const line = Math.floor(lane / 2)
    for (let step = 0; step < 100; step++) {
      for (const t of [step, step + 0.66]) {
        const depth = 12 - t * 1.9
        const wave = Math.sin(t * 0.077 + line * 0.41)
        const x = side * (6.2 + line * 1.64) + wave * 3.5
        const y = -7.7 + line * 0.68 + Math.cos(t * 0.081 + lane) * 1.15
        positions.push(x, y, depth)
        const color = lane % 3 ? violetLight : mintLight
        colors.push(color.r, color.g, color.b)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  return geometry
}

function Shards() {
  const shards = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const mesh = shards.current
    if (!mesh) return
    const object = new Object3D()
    const random = MathUtils.seededRandom
    random(2087)
    for (let index = 0; index < 86; index++) {
      const side = index % 2 ? 1 : -1
      const x = side * (5.2 + random() * 13)
      const y = (random() - 0.5) * 19
      const z = 12 - random() * 184
      const size = 0.11 + random() * 0.48
      object.position.set(x, y, z)
      object.rotation.set(random() * 3, random() * 3, random() * 3)
      object.scale.set(size * (0.72 + random()), size * (0.7 + random()), size)
      object.updateMatrix()
      mesh.setMatrixAt(index, object.matrix)
      mesh.setColorAt(index, new Color(index % 4 === 0 ? '#38d7c6' : '#a08afb'))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [])
  return (
    <instancedMesh ref={shards} args={[undefined, undefined, 86]}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#bccaed" emissive="#372360" emissiveIntensity={0.35} metalness={0.5} roughness={0.31} />
    </instancedMesh>
  )
}

function opticalFrame(lobes: number) {
  const shape = new Shape()
  const aperture = new Path()
  const detail: number[] = []
  for (let step = 0; step < 128; step++) {
    const angle = step / 128 * Math.PI * 2
    const wave = Math.cos(angle * Math.min(lobes, 8)) * 0.22 + Math.sin(angle * 3) * 0.43
    const outside = 7.64 + wave
    const inside = 6.99 + wave
    const x = Math.cos(angle)
    const y = Math.sin(angle) * 0.93
    if (!step) {
      shape.moveTo(x * outside, y * outside)
      aperture.moveTo(x * inside, y * inside)
    } else {
      shape.lineTo(x * outside, y * outside)
      aperture.lineTo(x * inside, y * inside)
    }
    detail.push(x * (inside + 0.12), y * (inside + 0.12), 0.41)
  }
  shape.closePath()
  aperture.closePath()
  shape.holes.push(aperture)
  const metal = new ExtrudeGeometry(shape, {
    steps: 1, depth: 0.33, bevelEnabled: true, bevelThickness: 0.095, bevelSize: 0.105, bevelSegments: 3,
  })
  const line = new BufferGeometry()
  line.setAttribute('position', new Float32BufferAttribute(detail, 3))
  return { metal, line }
}

function Gate({ color, accent, sides }: Pick<(typeof chambers)[number], 'color' | 'accent' | 'sides'>) {
  const glow = useMemo(() => ({ tint: { value: new Color(color) } }), [color])
  const frame = useMemo(() => opticalFrame(sides), [sides])
  useEffect(() => () => {
    frame.metal.dispose()
    frame.line.dispose()
  }, [frame])

  return (
    <>
      <mesh position={[0.6, 0.75, -3.1]}>
        <planeGeometry args={[27, 23]} />
        <shaderMaterial uniforms={glow} vertexShader={hazeVertex} fragmentShader={hazeFragment}
          transparent depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <mesh geometry={frame.metal}>
        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.18}
          metalness={0.72} roughness={0.23} clearcoat={0.72} clearcoatRoughness={0.24} />
      </mesh>
      <lineLoop geometry={frame.line}><lineBasicMaterial color={accent} transparent opacity={0.81} /></lineLoop>
      <mesh position={[0.1, -0.1, -1.45]} rotation={[0.15, -0.18, 1.4]}>
        <torusGeometry args={[8.85, 0.042, 5, 56, Math.PI * 1.49]} />
        <meshBasicMaterial color={color} transparent opacity={0.64} />
      </mesh>
      <mesh position={[0, 0, -0.65]} rotation={[-0.28, 0.34, -1.65]}>
        <torusGeometry args={[9.62, 0.023, 4, 64, Math.PI * 1.13]} />
        <meshBasicMaterial color={accent} transparent opacity={0.45} />
      </mesh>
    </>
  )
}

function Crystal({ color, accent }: { color: string; accent: string }) {
  return (
    <>
      <mesh>
        <octahedronGeometry args={[1, 0]} />
        <meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0.16} metalness={0.38}
          roughness={0.24} clearcoat={0.65} transparent opacity={0.62} depthWrite={false} />
      </mesh>
      <mesh scale={1.01}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial color={accent} transparent opacity={0.57} wireframe depthWrite={false} />
      </mesh>
    </>
  )
}

function FlightWorld({ onReady, onLoss }: WorldProps) {
  const rig = useThree(state => state.camera)
  const renderer = useThree(state => state.gl)
  const scene = useThree(state => state.scene)
  const canvas = useThree(state => state.gl.domElement)
  const invalidate = useThree(state => state.invalidate)
  const guideLight = useRef<PointLight>(null)
  const gates = useRef<(Group | null)[]>([])
  const floaters = useRef<(Group | null)[]>([])
  const position = useRef<number[]>([...flight[0].pose])
  const motion = useRef({ scroll: 0, stops: [] as Stop[], previousFrame: -Infinity, timer: undefined as number | undefined, lastScroll: -Infinity, first: true })
  const atmosphere = useMemo(makeAtmosphere, [])
  const lines = useMemo(flightLines, [])
  const dustMaterial = useRef<ShaderMaterial>(null)
  const dustUniforms = useMemo(() => ({ time: { value: 0 } }), [])

  useEffect(() => {
    const room = new RoomEnvironment()
    const generator = new PMREMGenerator(renderer)
    const lightMap = generator.fromScene(room, 0.08)
    scene.environment = lightMap.texture
    scene.environmentIntensity = 0.8
    room.dispose()
    generator.dispose()
    return () => {
      scene.environment = null
      lightMap.dispose()
    }
  }, [renderer, scene])

  const requestFrame = useCallback((interactive: boolean) => {
    const active = motion.current
    if (document.hidden) return
    if (active.timer !== undefined) {
      if (!interactive) return
      clearTimeout(active.timer)
    }
    const interval = interactive ? 1000 / 60 : 1000 / 14
    const delay = Math.max(0, interval - (performance.now() - active.previousFrame))
    active.timer = window.setTimeout(() => {
      active.timer = undefined
      if (!document.hidden) invalidate()
    }, delay)
  }, [invalidate])

  useEffect(() => () => {
    atmosphere.dispose()
    lines.dispose()
  }, [atmosphere, lines])

  useEffect(() => {
    const active = motion.current
    function scroll() {
      active.scroll = scrollY
      active.lastScroll = performance.now()
      requestFrame(true)
    }
    function measure() {
      active.stops = measureFlight()
      scroll()
    }
    function visibility() {
      clearTimeout(active.timer)
      active.timer = undefined
      if (!document.hidden) measure()
    }
    const observer = new ResizeObserver(measure)
    observer.observe(document.body)
    window.addEventListener('resize', measure, { passive: true })
    window.addEventListener('scroll', scroll, { passive: true })
    document.addEventListener('visibilitychange', visibility)
    canvas.addEventListener('webglcontextlost', onLoss)
    measure()
    return () => {
      observer.disconnect()
      clearTimeout(active.timer)
      active.timer = undefined
      window.removeEventListener('scroll', scroll)
      window.removeEventListener('resize', measure)
      document.removeEventListener('visibilitychange', visibility)
      canvas.removeEventListener('webglcontextlost', onLoss)
    }
  }, [canvas, onLoss, requestFrame])

  useFrame((_, frameDelta) => {
    const active = motion.current
    if (document.hidden || !active.stops.length) return
    const now = performance.now()
    active.previousFrame = now
    const elapsed = now * 0.001
    const { scroll, stops } = active
    const upperIndex = stops.findIndex(stop => stop.scroll >= scroll)
    const after = stops[upperIndex < 0 ? stops.length - 1 : upperIndex]
    const before = upperIndex > 0 ? stops[upperIndex - 1] : after
    const blend = before === after ? 0 : MathUtils.clamp((scroll - before.scroll) / Math.max(1, after.scroll - before.scroll), 0, 1)
    const pose = position.current
    let settling = false
    for (let index = 0; index < pose.length; index++) {
      const goal = MathUtils.lerp(before.pose[index], after.pose[index], blend)
      pose[index] = active.first ? goal : MathUtils.damp(pose[index], goal, 7.5, Math.min(frameDelta, 0.07))
      settling ||= Math.abs(pose[index] - goal) > 0.015
    }
    const [x, y, z, lookX, lookY, lookZ] = pose
    rig.position.set(x + Math.sin(elapsed * 0.34) * 0.08, y + Math.sin(elapsed * 0.31) * 0.095, z)
    rig.lookAt(panLook.set(lookX, lookY, lookZ))
    guideLight.current?.position.set(x + 2.6, y + 4, z - 8)
    if (dustMaterial.current) dustMaterial.current.uniforms.time.value = elapsed

    chambers.forEach((room, index) => {
      const ring = gates.current[index]
      const crystal = floaters.current[index]
      const depth = room.z - z
      if (ring) {
        ring.visible = depth < 12 && depth > -73
        ring.rotation.z = room.tilt + Math.sin(elapsed * 0.27 + index) * 0.067 + depth * 0.005
      }
      if (crystal) {
        crystal.visible = depth < 12 && depth > -63
        crystal.rotation.y = index * 0.68 + elapsed * 0.15 - depth * 0.023
        crystal.rotation.z = room.tilt + Math.sin(elapsed * 0.31 + index) * 0.19
        crystal.position.y = (index % 2 ? 2.6 : 3.1) + Math.sin(elapsed * 0.52 + index) * 0.36
      }
    })

    if (active.first) {
      active.first = false
      onReady(true)
    }
    requestFrame(settling || now - active.lastScroll < 170)
  })

  return (
    <>
      <fog attach="fog" args={['#0c1327', 11, 78]} />
      <hemisphereLight args={['#bbcafa', '#322166', 1.45]} />
      <directionalLight color="#bcceff" intensity={3.15} position={[-8, 10, 7]} />
      <directionalLight color={violet} intensity={2.3} position={[6, 4, -10]} />
      <pointLight ref={guideLight} color={mint} intensity={145} distance={32} position={[3, 4, 1]} />
      <points geometry={atmosphere}>
        <shaderMaterial ref={dustMaterial} uniforms={dustUniforms} vertexShader={dustVertex} fragmentShader={dustFragment}
          transparent blending={AdditiveBlending} depthWrite={false} />
      </points>
      <lineSegments geometry={lines}>
        <lineBasicMaterial vertexColors transparent opacity={0.38} depthWrite={false} />
      </lineSegments>
      <Shards />
      {chambers.map((room, index) => (
        <group key={room.z}>
          <group ref={node => { gates.current[index] = node }} position={[room.x, room.y, room.z]}
            rotation={[0.24 + (index % 2) * -0.30, room.yaw, room.tilt]}>
            <Gate color={room.color} accent={room.accent} sides={room.sides} />
          </group>
          <group ref={node => { floaters.current[index] = node }}
            position={[room.x + (index % 2 ? 8.8 : -8.1), 3.1, room.z + 4.6]}
            rotation={[0.3, index, room.tilt]} scale={[1.35, 2.8, 1.48]}>
            <Crystal color={room.color} accent={room.accent} />
          </group>
          <group position={[room.x + (index % 2 ? -7.4 : 8.6), -3.2, room.z + 0.4]}
            rotation={[-0.32, index * 1.1, 0.55]} scale={[1.8, 1.37, 1.45]}>
            <Crystal color={room.accent} accent={room.color} />
          </group>
        </group>
      ))}
    </>
  )
}

export default function WorldScene(props: WorldProps) {
  return (
    <Canvas camera={lens} gl={glOptions} dpr={pixelRatio} resize={resizeOptions} frameloop="demand" tabIndex={-1}>
      <FlightWorld {...props} />
    </Canvas>
  )
}
