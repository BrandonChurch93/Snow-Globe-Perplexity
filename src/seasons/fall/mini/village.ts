import * as THREE from 'three'
import { afterLight } from '../../../core/chunks/light'
import { stageMaterial, type Rgb } from '../../../core/materials'
import { geometry, prepareModel } from '../../../core/models'
import { texture } from '../../../core/textures'
import { GLOW, glowGeometry, glowMaterial, glowPiece, haloGeometry, haloMaterial, type GlowLook } from '../../../miniature/glow'
import { MIRROR_GLSL, mirrorUniforms } from '../../../miniature/mirror'
import { prepareVillage, villageGeometry, villageGrain } from '../../../miniature/model'
import { isIvy, lampFlame, lampFoot, shrubs } from '../../../miniature/roof'
import { BUMP_GLSL, NEAR_LIGHT, SURFACE_VERT_MAIN, SURFACE_VERT_PARS, surfaceMaterial, withSurface, type Cover, type GlowSource } from '../../../miniature/surface'
import { anchors, cottage, cottageFrame, cottagePoint, fence, groundAt, moundSlope, pond, pondField, solidDistance, steps, stones, tree } from '../../../scene/layout'
import { gainOf } from '../../../scene/lightgrid'
import type { InnerLight, KitMoment } from '../../kit'
import { isTree, season, tones } from './palette'
import { PUMPKINS, ROCKS, STONES, atticAt, boardDistance, fenceBoards, pumpkinCentre, pumpkinFace, pumpkinTall, rockCentre, stoneBase, type Point } from './props'

const MODEL = 'fall/village-fall.glb'
const EARTH = 'fall/village-earth.srgb.tile.w1024.png'
const LITTER = 'fall/village-litter.srgb.tile.w1024.png'
const PART = `miniature-${season}`
const LIGHT = `light-${season}`

const LAMP = { power: 3, reachMm: 10, flicker: 0.06, cycles: 3, phase: 0.1 }
const WINDOW = { power: 1.5, reachMm: 8, flicker: 0.1, cycles: 5, phase: 0.4 }
const SIDE = { power: 0.75, reachMm: 7, flicker: 0.1, cycles: 4, phase: 0.75 }
const ATTIC_LIGHT = { power: 0.6, reachMm: 6, flicker: 0.1, cycles: 4, phase: 0.2 }
const PUMPKIN = { power: 1.3, reachMm: 7, flicker: 0.16, cycles: 6 }
const POND = { power: 0.3, reachMm: 20, flicker: 0.08, cycles: 2, phase: 0.8, liftMm: 2.5 }
const NEAR = { lamp: { power: 16, reachMm: 13 }, pane: { power: 5, reachMm: 3.2 }, pumpkin: { power: 8, reachMm: 5.5, ends: 4 }, door: { power: 7, reachMm: 4.5 } }
const NEAR_WALL = { lamp: { power: 2.4, reachMm: 9, ends: 3 }, pane: { power: 3.6, reachMm: 4.2, ends: 3 }, pumpkin: { power: 8, reachMm: 4.5, ends: 3 }, door: { power: 6, reachMm: 5, ends: 3 } }
const HALO = { radiusMm: 0.75, strength: 1, hot: 2, pullMm: 1.6, flicker: 0.07, cycles: 2, through: 5, wide: 2.4, bloom: 1, glare: [1.6, 1.12, 0.66] as Rgb }
const HALO_KIND = { lamp: { size: 5.6, rest: 0.32, hot: 0, bloom: 0.3 }, pumpkin: { size: 4.2, rest: 0.16, hot: 0, bloom: 0.2 }, pool: { size: 7, rest: 0, hot: 0, bloom: 0.17 } }
const PANE_HALO = { radiusMm: 0.75, strength: 0.5, hot: 0, pullMm: 1.6, flicker: 0.07, cycles: 2, through: 5, wide: 2.4, bloom: 0.6 }
const PANE_SIZE = { size: 3.2, rest: 0.3, hot: 0, bloom: 0.3 }
const THROUGH = 6
const LAMP_GLASS: Rgb = [3.4, 1.25, 0.24]
const WALL_FILL = 3.8
const GROUND_FILL = 8
const PATH = { tone: [0.96, 0.76, 0.58] as Rgb, nearMm: 2.6, highMm: 1.4 }
const FENCE = { reachMm: 1.25, sinkMm: 5 }
const MOSS = { low: [0.7, 0.9, 0.6] as Rgb, high: [0.88, 1.02, 0.86] as Rgb, tallMm: 9, soot: 0.8 }
// The shared stones run from 0.03 (a joint) over 0.12 (the middle stone) to 0.9 (a few white ones). The approved wall is
// dark grey green stones between black joints, so the tone is bent: joints stay near black, the middle stone sits at a
// third of `top`, and only the palest stones reach it, which keeps stone from stone apart without a white one.
const STONE = { top: 0.115, knee: 0.17, power: 2.2 }
// The shared chimney is pale brick. The approved one is the wall's dark stone, a little greyer.
const CHIMNEY = { tone: [0.9, 0.95, 0.9] as Rgb, top: 0.26, knee: 0.5, power: 2.2, fromMm: 1.5, reachMm: 0.9 }
// The shared slates run from 0.02 (a slate's shadowed top edge) to 0.12 (its lit lower edge). The approved roof is big warm
// slates with bright lower edges over black gaps, so the tone is bent about `mid` and weathered in patches a few slates wide.
const ROOF = { tone: [1.65, 1.22, 0.95] as Rgb, grey: 0.55, mid: 0.045, bend: 1.6, patch: [0.6, 1.7] as [number, number] }
const DOOR: Rgb = [0.15, 0.31, 0.33]
// The shared stones are a few large blocks; the approved wall is small chipped stones. Upright stone is broken up by the
// grain map read coarser, through its levels, so the chips hold their size at any distance.
const CHIP = { scale: 0.4, low: 0.4, span: 1.2, edges: [0.3, 0.7] as [number, number] }
// The shared door is one smooth leaf. The approved one is planks: each a tone of its own, a dark groove between them,
// drawn across the door with the groove's edge held one pixel soft.
const PLANK = { wideMm: 0.84, groove: 0.16, dark: 0.92, tone: [0.4, 1.35] as [number, number], grain: [0.55, 0.9] as [number, number] }
const doorFrame = cottageFrame()
const chipped: Cover = {
  uniforms: {},
  pars: '',
  apply: `
{
  float fallChip = texture2D(map, vMapUv * ${CHIP.scale.toFixed(2)} + 0.61).r;
  float fallUpright = 1.0 - smoothstep(0.3, 0.6, abs(vObjN.y) / max(length(vObjN), 1e-4));
  diffuseColor.rgb *= mix(1.0, ${CHIP.low.toFixed(2)} + ${CHIP.span.toFixed(2)} * smoothstep(${CHIP.edges[0].toFixed(2)}, ${CHIP.edges[1].toFixed(2)}, fallChip), villageStone * fallUpright);
  vec2 fallAt = vStageLocal.xz - vec2(${cottage.x.toFixed(3)}, ${cottage.z.toFixed(3)});
  float fallAcross = dot(fallAt, vec2(${doorFrame.v[0].toFixed(5)}, ${doorFrame.v[1].toFixed(5)})) - ${cottage.door.across.toFixed(3)};
  float fallAlong = dot(fallAt, vec2(${doorFrame.u[0].toFixed(5)}, ${doorFrame.u[1].toFixed(5)})) - ${cottage.halfLength.toFixed(3)};
  float fallDoor = villageWood * step(abs(fallAcross), ${(cottage.door.width / 2 + 0.6).toFixed(3)}) * step(abs(fallAlong), 1.4) * step(vStageLocal.y, ${(doorFrame.floor + cottage.wall).toFixed(3)});
  float fallPlank = fallAcross / ${PLANK.wideMm.toFixed(3)};
  float fallSoft = max(fwidth(fallPlank), 1e-4);
  float fallGroove = smoothstep(${(0.5 - PLANK.groove).toFixed(3)} - fallSoft, ${(0.5 - PLANK.groove).toFixed(3)} + fallSoft, abs(fract(fallPlank) - 0.5));
  float fallBoard = ${PLANK.tone[0].toFixed(2)} + ${PLANK.tone[1].toFixed(2)} * fract(sin(floor(fallPlank) * 12.9898) * 43758.5453);
  float fallGrain = ${PLANK.grain[0].toFixed(2)} + ${PLANK.grain[1].toFixed(2)} * texture2D(map, vec2(fallAcross * 0.5, vStageLocal.y * 0.05) + 0.37).r;
  diffuseColor.rgb *= mix(1.0, fallBoard * fallGrain * (1.0 - ${PLANK.dark.toFixed(2)} * fallGroove), fallDoor);
}
`,
}
const TIMBER: Rgb = [0.4, 0.42, 0.34]
const DRY: readonly Rgb[] = [[0.42, 0.16, 0.05], [0.5, 0.26, 0.07], [0.3, 0.12, 0.05], [0.4, 0.3, 0.1]]
// The shared shrubs are one soft mass. Dry leaves stand apart: each takes its own tone and its own depth of shade.
const BUSH = { gain: 5.2, cap: 2, low: 0.35 }
const GROUND = { soil: 2.3, leaf: 1.05, leafScale: 0.85, soilMm: 0.26, wideMm: 0.5, leafMm: 0.34 }
const WATER = { rough: 0.07, rippleMm: 0.18, lamp: 4.5, pane: 1.6, pumpkin: 4.5, tight: 0.003, wide: 0.012, wideShare: 0.03, calm: 0.3, lowMm: 3.4, fog: 0.42, trunkMm: 3.4, dim: 0.85, shore: [0.9, 0.99] as [number, number] }

const TALL_LAMP = { reachMm: 2.6, neckMm: 9.5, post: [1.6, 1.2] as [number, number], head: [1.5, 1.5] as [number, number] }
const foot = lampFoot()

function tallLamp(p: Point): Point {
  const h = p[1] - foot[1]
  const head = h > TALL_LAMP.neckMm
  const wide = head ? TALL_LAMP.head[0] : TALL_LAMP.post[0]
  const up = head ? TALL_LAMP.neckMm * TALL_LAMP.post[1] + (h - TALL_LAMP.neckMm) * TALL_LAMP.head[1] : h * TALL_LAMP.post[1]
  return [foot[0] + (p[0] - foot[0]) * wide, foot[1] + up, foot[2] + (p[2] - foot[2]) * wide]
}

function stretched(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = source.clone()
  const P = g.getAttribute('position')
  for (let i = 0; i < P.count; i++) {
    const q = tallLamp([P.getX(i), P.getY(i), P.getZ(i)])
    P.setXYZ(i, q[0], q[1], q[2])
  }
  return g
}

const flame = tallLamp(lampFlame())
const STACK = { fromMm: 17.6, keep: 0.84, reachMm: 0.5 }
const BUSHES = shrubs().filter((s) => !isIvy(s.r))
const IVY = shrubs().filter((s) => isIvy(s.r))
const inIvy = (x: number, y: number, z: number): boolean => IVY.some((s) => Math.hypot((x - s.centre[0]) / s.r[0], (y - s.centre[1]) / s.r[1], (z - s.centre[2]) / s.r[2]) < 1.5)

function bushDistance(x: number, y: number, z: number): number {
  let d = Infinity
  for (const s of BUSHES) {
    const k = Math.hypot((x - s.centre[0]) / s.r[0], (y - s.centre[1]) / s.r[1], (z - s.centre[2]) / s.r[2])
    d = Math.min(d, (k - 1) * Math.min(s.r[0], s.r[1], s.r[2]))
  }
  return d
}
const mirrored: Point = [flame[0], flame[1] - WATER.lowMm, flame[2]]
const attic = atticAt()
const pumpkinLights = PUMPKINS.map((p) => pumpkinFace(p, 0.55, 0.05))
// The approved door has warm light at its foot, on the step and up the planks.
const doorFoot: Point = cottagePoint(cottage.door.across + 1.2, 1.2, cottage.halfLength + 2.2)
const pumpkinPools = PUMPKINS.map((p): Point => {
  const f = pumpkinFace(p, 1.45)
  return [f[0], groundAt(f[0], f[2]) + 1.1, f[2]]
})
const pondAt: Point = [anchors.pond[0], groundAt(pond.x, pond.z) + POND.liftMm, anchors.pond[2]]

const list: InnerLight[] = [
  { at: flame, color: tones.lampLight, ...LAMP },
  { at: anchors.window, color: tones.purpleLight, ...WINDOW },
  { at: anchors.sideWindow, color: tones.greenLight, ...SIDE },
  { at: attic, color: tones.greenLight, ...ATTIC_LIGHT },
  ...pumpkinLights.map((at, i): InnerLight => ({ at, color: tones.pumpkinLight, power: PUMPKIN.power, reachMm: PUMPKIN.reachMm, flicker: PUMPKIN.flicker, cycles: PUMPKIN.cycles, phase: 0.27 + 0.41 * i })),
  { at: pondAt, color: tones.pondLight, power: POND.power, reachMm: POND.reachMm, flicker: POND.flicker, cycles: POND.cycles, phase: POND.phase },
]

export const innerLights = (): InnerLight[] => list

const sources = (on: typeof NEAR | typeof NEAR_WALL, lampTone: Rgb): GlowSource[] => [
  ...bounce(),
  { at: flame, color: lampTone, ...on.lamp },
  { at: anchors.window, color: tones.purpleLight, ...on.pane },
  { at: anchors.sideWindow, color: tones.greenLight, ...on.pane },
  { at: attic, color: tones.greenLight, ...on.pane },
  ...pumpkinPools.map((at): GlowSource => ({ at, color: tones.pumpkinLight, ...on.pumpkin })),
  { at: doorFoot, color: tones.pumpkinLight, ...on.door },
]

// Light the glass and the lit fog throw back: on the faces of the fence the viewer sees, on the cottage's side wall and
// on the rocks of the east bank, which the key (upper right) and the lamp all miss. The approved shows them lit,
// grey-brown, olive and pale green.
const BOUNCE = { fence: { color: [1, 0.76, 0.52] as Rgb, power: 1.5, reachMm: 9, ends: 2.6, outMm: 5, upMm: 6.5 }, side: { color: [0.86, 0.9, 0.66] as Rgb, power: 6, reachMm: 13, ends: 2.4, outMm: 9, upMm: 7, alongMm: 2 }, bank: { color: [0.8, 0.95, 0.7] as Rgb, power: 7, reachMm: 10, ends: 2.4, outMm: 7, upMm: 5 } }

function bounce(): GlowSource[] {
  const dx = fence.to[0] - fence.from[0]
  const dz = fence.to[1] - fence.from[1]
  const len = Math.hypot(dx, dz)
  const out = dx / len > 0 ? [-dz / len, dx / len] : [dz / len, -dx / len]
  const fx = (fence.from[0] + fence.to[0]) / 2 + out[0]! * BOUNCE.fence.outMm
  const fz = (fence.from[1] + fence.to[1]) / 2 + out[1]! * BOUNCE.fence.outMm
  const f = cottageFrame()
  const across = -(cottage.halfWidth + BOUNCE.side.outMm)
  const sx = cottage.x + across * f.v[0] + BOUNCE.side.alongMm * f.u[0]
  const sz = cottage.z + across * f.v[1] + BOUNCE.side.alongMm * f.u[1]
  const rocks = ROCKS.map(rockCentre)
  const bx = rocks.reduce((m, c) => m + c[0], 0) / rocks.length
  const bz = rocks.reduce((m, c) => m + c[2], 0) / rocks.length + BOUNCE.bank.outMm
  return [
    { at: [bx, groundAt(bx, bz) + BOUNCE.bank.upMm, bz], color: BOUNCE.bank.color, power: BOUNCE.bank.power, reachMm: BOUNCE.bank.reachMm, ends: BOUNCE.bank.ends },
    { at: [fx, groundAt(fx, fz) + BOUNCE.fence.upMm, fz], color: BOUNCE.fence.color, power: BOUNCE.fence.power, reachMm: BOUNCE.fence.reachMm, ends: BOUNCE.fence.ends },
    { at: [sx, f.floor + BOUNCE.side.upMm, sz], color: BOUNCE.side.color, power: BOUNCE.side.power, reachMm: BOUNCE.side.reachMm, ends: BOUNCE.side.ends },
  ]
}

const gain = { value: 1 }
const clock = { value: 0 }
const glsl = (c: Rgb): string => `vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`
const smooth = (a: number, b: number, v: number): number => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const wave = (x: number, y: number, z: number): number => 0.5 + 0.25 * Math.sin(x * 1.31 + z * 0.77 + 1.7) * Math.sin(z * 1.13 - x * 0.41 + y * 0.9 + 0.6) + 0.25 * Math.sin(x * 2.9 + y * 2.3 + 4.1) * Math.sin(z * 3.3 + y * 1.7 + 2.2)

export async function prepare(): Promise<void> {
  await Promise.all([prepareVillage(), prepareModel(MODEL)])
}

const BOARDS = fenceBoards()
const fenceBox = BOARDS.reduce(
  (m, b) => ({ x0: Math.min(m.x0, b.a[0], b.b[0]), x1: Math.max(m.x1, b.a[0], b.b[0]), z0: Math.min(m.z0, b.a[2], b.b[2]), z1: Math.max(m.z1, b.a[2], b.b[2]) }),
  { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity },
)

const inFence = (x: number, y: number, z: number): boolean => {
  const dx = fence.to[0] - fence.from[0]
  const dz = fence.to[1] - fence.from[1]
  const t = Math.min(1.1, Math.max(-0.1, ((x - fence.from[0]) * dx + (z - fence.from[1]) * dz) / (dx * dx + dz * dz)))
  if (Math.hypot(x - fence.from[0] - dx * t, z - fence.from[1] - dz * t) > FENCE.reachMm) return false
  const up = y - groundAt(x, z)
  return up > -1.5 && up < fence.height + 2
}

const frame = cottageFrame()
function cottageLocal(x: number, z: number): { across: number; along: number } {
  const dx = x - cottage.x
  const dz = z - cottage.z
  return { across: dx * frame.v[0] + dz * frame.v[1], along: dx * frame.u[0] + dz * frame.u[1] }
}

function autumn(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = source.clone()
  const P = g.getAttribute('position')
  const N = g.getAttribute('normal')
  const C = g.getAttribute('color')
  const S = g.getAttribute('uv1')
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i)
    const y = P.getY(i)
    const z = P.getZ(i)
    const kind = Math.floor(S.getX(i) + 0.001)
    let r = C.getX(i)
    let gr = C.getY(i)
    let b = C.getZ(i)
    const n = wave(x, y, z)
    if (kind === 2 && Math.hypot(x - foot[0], z - foot[2]) < TALL_LAMP.reachMm && y > foot[1] - 0.5) {
      const q = tallLamp([x, y, z])
      P.setXYZ(i, q[0], q[1], q[2])
    }
    const cl = cottageLocal(x, z)
    const inStack = Math.abs(cl.across - cottage.chimney.across) < cottage.chimney.half + STACK.reachMm && Math.abs(cl.along - cottage.chimney.along) < cottage.chimney.halfAlong + STACK.reachMm && y - frame.floor > STACK.fromMm
    if (inStack) {
      const top = frame.floor + STACK.fromMm + (y - frame.floor - STACK.fromMm) * STACK.keep
      if (kind === 2) P.setXYZ(i, x, Math.min(top, frame.floor + STACK.fromMm + (cottage.chimney.top - STACK.fromMm) * STACK.keep - 0.6), z)
      else P.setY(i, top)
    }
    if (kind === 3 && inIvy(x, y, z)) {
      P.setXYZ(i, IVY[0]!.centre[0], groundAt(IVY[0]!.centre[0], IVY[0]!.centre[2]) - FENCE.sinkMm, IVY[0]!.centre[2])
    } else if (inFence(x, y, z) && kind === 1) {
      P.setXYZ(i, fence.from[0], groundAt(fence.from[0], fence.from[1]) - FENCE.sinkMm, fence.from[1])
    } else if (kind === 3) {
      const lum = Math.min(BUSH.cap, (0.3 * r + 0.6 * gr + 0.1 * b) * BUSH.gain) * (BUSH.low + (1 - BUSH.low) * wave(x * 5.3, y * 6.1, z * 4.7))
      const tone = DRY[Math.floor(wave(x * 7.1, y * 6.7, z * 7.3) * 3.999)]!
      r = tone[0] * lum
      gr = tone[1] * lum
      b = tone[2] * lum
    } else if (kind === 0) {
      const c = cottageLocal(x, z)
      const up = y - frame.floor
      const near = Math.abs(c.across) < cottage.halfWidth + 3.5 && Math.abs(c.along) < cottage.halfLength + 3.5
      const onPath = y - groundAt(x, z) < PATH.highMm && [...steps, ...stones].some(([sx, sz]) => Math.hypot(x - sx, z - sz) < PATH.nearMm)
      if (onPath) {
        r *= PATH.tone[0] * (0.8 + 0.4 * n)
        gr *= PATH.tone[1] * (0.8 + 0.4 * n)
        b *= PATH.tone[2] * (0.8 + 0.4 * n)
      } else if (near && up > cottage.wall + CHIMNEY.fromMm && Math.abs(c.across - cottage.chimney.across) < cottage.chimney.half + CHIMNEY.reachMm && Math.abs(c.along - cottage.chimney.along) < cottage.chimney.halfAlong + CHIMNEY.reachMm) {
        const lum = 0.3 * r + 0.6 * gr + 0.1 * b
        const v = CHIMNEY.top * (1 - Math.exp(-Math.pow(lum / CHIMNEY.knee, CHIMNEY.power))) * (0.55 + 0.9 * n)
        r = v * CHIMNEY.tone[0]
        gr = v * CHIMNEY.tone[1]
        b = v * CHIMNEY.tone[2]
      } else if (near && up > cottage.wall - 1.2 && Math.abs(c.across) > 0.01 && N.getY(i) > 0.25) {
        const lum = 0.3 * r + 0.6 * gr + 0.1 * b
        r = (lum * ROOF.grey + r * (1 - ROOF.grey)) * ROOF.tone[0]
        gr = (lum * ROOF.grey + gr * (1 - ROOF.grey)) * ROOF.tone[1]
        b = (lum * ROOF.grey + b * (1 - ROOF.grey)) * ROOF.tone[2]
      } else {
        const m = (1 - smooth(0, MOSS.tallMm, up)) * (0.35 + 0.65 * n) + 0.35 * smooth(0.55, 0.8, n)
        const k = Math.min(1, Math.max(0, m))
        const soot = near ? 1 - MOSS.soot * smooth(cottage.wall + 1, cottage.wall + 7, up) : 1
        const lum = 0.3 * r + 0.6 * gr + 0.1 * b
        const bite = ((STONE.top * (1 - Math.exp(-Math.pow(lum / STONE.knee, STONE.power)))) / Math.max(lum, 1e-4)) * soot
        r *= (MOSS.high[0] + (MOSS.low[0] - MOSS.high[0]) * k) * bite
        gr *= (MOSS.high[1] + (MOSS.low[1] - MOSS.high[1]) * k) * bite
        b *= (MOSS.high[2] + (MOSS.low[2] - MOSS.high[2]) * k) * bite
      }
    } else if (kind === 1) {
      const c = cottageLocal(x, z)
      if (Math.abs(c.across - cottage.door.across) < cottage.door.width / 2 + 0.6 && Math.abs(c.along - cottage.halfLength) < 1.4 && y - frame.floor < cottage.wall) {
        r *= DOOR[0]
        gr *= DOOR[1]
        b *= DOOR[2]
      } else if (Math.abs(c.across) < cottage.halfWidth + 3.5 && Math.abs(c.along) < cottage.halfLength + 3.5 && y - frame.floor > cottage.wall - 1.2 && N.getY(i) > 0.25) {
        const lum = 0.3 * r + 0.6 * gr + 0.1 * b
        const bend = (Math.pow(lum / ROOF.mid, ROOF.bend) * ROOF.mid) / Math.max(lum, 1e-4) * (ROOF.patch[0] + (ROOF.patch[1] - ROOF.patch[0]) * wave(x * 0.9, y * 0.9, z * 0.9))
        r = (lum * ROOF.grey + r * (1 - ROOF.grey)) * ROOF.tone[0] * bend
        gr = (lum * ROOF.grey + gr * (1 - ROOF.grey)) * ROOF.tone[1] * bend
        b = (lum * ROOF.grey + b * (1 - ROOF.grey)) * ROOF.tone[2] * bend
      } else {
        const lum = 0.3 * r + 0.6 * gr + 0.1 * b
        r = (0.5 * lum + 0.5 * r) * TIMBER[0]
        gr = (0.5 * lum + 0.5 * gr) * TIMBER[1]
        b = (0.5 * lum + 0.5 * b) * TIMBER[2]
      }
    }
    C.setXYZ(i, r, gr, b)
  }
  return g
}

function groundMaterial(): THREE.MeshStandardMaterial {
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    map: texture(EARTH),
    roughness: 0.95,
    metalness: 0,
    change: 'miniature',
    key: 'village-ground-fall',
    hook: (shader) => {
      Object.assign(shader.uniforms, { uGlowGain: gain, uLitter: { value: texture(LITTER) } })
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}`)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
${BUMP_GLSL}
uniform sampler2D uLitter;
float fallRough = 0.95;
vec4 fallLeaf(vec2 at) {
  vec2 uv = at * ${GROUND.leafScale.toFixed(2)};
  vec4 a = texture2D(uLitter, uv);
  vec4 b = texture2D(uLitter, vec2(0.7071 * (uv.x - uv.y), 0.7071 * (uv.x + uv.y)) * 0.77 + vec2(0.31, 0.57));
  a.a *= step(1.0 - vSurf.x, a.a);
  b.a *= step(1.0 - 0.8 * vSurf.x, b.a);
  return a.a >= b.a ? a : b;
}
float fallHeight(vec2 uv) {
  vec4 e = texture2D(map, uv);
  vec4 l = fallLeaf(uv);
  float soil = e.a * ${GROUND.soilMm.toFixed(3)} + texture2D(map, uv * 0.23 + 0.41).a * ${GROUND.wideMm.toFixed(3)};
  return mix(soil, soil * 0.4 + ${GROUND.leafMm.toFixed(3)} * (0.6 + 0.4 * l.a) + 0.08 * dot(l.rgb, vec3(0.6, 0.3, 0.1)), step(0.03, l.a));
}`,
        )
        .replace(
          '#include <map_fragment>',
          `
vec4 fallE = texture2D(map, vMapUv);
vec4 fallL = fallLeaf(vMapUv);
float fallShow = step(0.03, fallL.a);
float fallWide = texture2D(map, vMapUv * 0.19 + 0.37).a;
float fallMoss = smoothstep(0.42, 0.62, vSurf.y + 0.55 * (fallE.a - 0.5) + 0.3 * (fallWide - 0.5));
vec3 fallSoil = mix(fallE.rgb * ${GROUND.soil.toFixed(2)}, ${glsl(tones.moss)} * (0.3 + 0.7 * fallE.a), fallMoss);
diffuseColor.rgb *= mix(fallSoil, fallL.rgb * ${GROUND.leaf.toFixed(2)}, fallShow);
fallRough = mix(0.96, 0.8, fallShow);
`,
        )
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = fallRough;')
        .replace(
          '#include <normal_fragment_maps>',
          `
{
  float fallH = fallHeight(vMapUv);
  vec2 fallDh = vec2(fallHeight(vMapUv + dFdx(vMapUv)) - fallH, fallHeight(vMapUv + dFdy(vMapUv)) - fallH);
  normal = villageBump(-vViewPosition, normal, fallDh, faceDirection);
}
`,
        )
      afterLight(shader, `${NEAR_LIGHT}\nreflectedLight.directDiffuse += stageKeyC * (RECIPROCAL_PI * ${GROUND_FILL.toFixed(2)} * stageWrap(dot(geometryNormal, stageKeyL), 2.0)) * material.diffuseContribution;`)
    },
  })
}

const trunkFoot: Point = [tree.x, groundAt(tree.x, tree.z), tree.z]
const vec = (p: Point): string => `vec3(${p[0].toFixed(3)}, ${p[1].toFixed(3)}, ${p[2].toFixed(3)})`

function waterMaterial(): THREE.MeshStandardMaterial {
  const lit = [{ at: mirrored, strength: WATER.lamp }, { at: anchors.window, strength: WATER.pane }, ...PUMPKINS.map((p) => ({ at: pumpkinFace(p, 0.9, -0.9), strength: WATER.pumpkin }))]
  return stageMaterial({
    part: PART,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    map: texture(EARTH),
    roughness: WATER.rough,
    metalness: 0,
    change: 'miniature',
    key: 'village-water-fall',
    hook: (shader) => {
      Object.assign(shader.uniforms, { uGlowGain: gain, uClock: clock }, mirrorUniforms(lit))
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}`)
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <map_pars_fragment>',
          `#include <map_pars_fragment>
${BUMP_GLSL}
${MIRROR_GLSL}
uniform float uClock;
vec3 pondFlat = vec3(0.0, 0.0, 1.0);
float pondHeight(vec2 uv) {
  vec2 drift = vec2(cos(6.2831853 * uClock), sin(6.2831853 * uClock)) * 0.02;
  return (texture2D(map, uv * 0.55 + drift).a + 0.6 * texture2D(map, uv * 1.3 - drift.yx + 0.37).a) * ${WATER.rippleMm.toFixed(4)};
}`,
        )
        .replace(
          '#include <map_fragment>',
          `
float pondShore = smoothstep(${WATER.shore[0].toFixed(2)}, ${WATER.shore[1].toFixed(2)}, vSurf.x + 0.03 * (texture2D(map, vMapUv * 0.8).a - 0.5));
diffuseColor.rgb = mix(${glsl(tones.water)}, ${glsl(tones.moss)} * 0.5, pondShore);
`,
        )
        .replace('#include <roughnessmap_fragment>', `float roughnessFactor = mix(${WATER.rough.toFixed(3)}, 0.6, pondShore);`)
        .replace(
          '#include <normal_fragment_maps>',
          `
{
  float pondH = pondHeight(vMapUv);
  vec2 pondDh = vec2(pondHeight(vMapUv + dFdx(vMapUv)) - pondH, pondHeight(vMapUv + dFdy(vMapUv)) - pondH);
  pondFlat = normal;
  normal = villageBump(-vViewPosition, normal, pondDh, faceDirection);
}
`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `
{
  vec3 pondN = villageInside(normal);
  vec3 pondSight = villageSight();
  float pondFresnel = 0.03 + 0.97 * pow(abs(1.0 - clamp(dot(pondN, pondSight), 0.0, 1.0)), 5.0);
  vec3 pondStill = mix(pondFlat, normal, ${WATER.calm.toFixed(2)});
  vec3 pondCalm = villageInside(dot(pondStill, pondStill) > 0.0 ? normalize(pondStill) : normal);
  float pondGlint = villageMirror(pondCalm, pondSight, ${WATER.tight.toFixed(5)}, ${WATER.wide.toFixed(5)}, ${WATER.wideShare.toFixed(3)});
  float pondLap = 0.5 * (texture2D(map, vMapUv * 0.11 + 0.2).a + texture2D(map, vMapUv * 0.07 + 0.6).a);
  float pondPosts = max(villagePost(pondN, pondSight, ${vec(trunkFoot)}, ${WATER.trunkMm.toFixed(1)}, 80.0), villagePost(pondN, pondSight, ${vec(foot)}, 0.8, ${(flame[1] - foot[1] + 2).toFixed(1)}));
  totalEmissiveRadiance += (${glsl(tones.lamp)} * pondGlint * pondFresnel + ${glsl(tones.fogGlint)} * (${WATER.fog.toFixed(2)} * pondFresnel * (0.55 + 0.9 * smoothstep(0.3, 0.75, pondLap)) * (1.0 - ${WATER.dim.toFixed(2)} * pondPosts))) * uGlowGain * (1.0 - pondShore);
}
`,
        )
      afterLight(shader, `reflectedLight.indirectDiffuse += vGlow * (uGlowGain * 0.3) * material.diffuseContribution;`)
    },
  })
}

const shadowed = <T extends THREE.Mesh>(m: T, cast = true): T => {
  m.castShadow = cast
  m.receiveShadow = true
  return m
}

export function build(): THREE.Object3D {
  const stone = surfaceMaterial({ part: PART, map: villageGrain(), gain, cover: chipped, key: 'village-solid-fall', fill: WALL_FILL })
  const walls = shadowed(new THREE.Mesh(withSurface(autumn(villageGeometry('solid')), sources(NEAR_WALL, tones.lampLight)), stone))
  const decor = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'decor').clone(), sources(NEAR_WALL, tones.lampLight)), stone))
  const earth = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'ground').clone(), sources(NEAR, tones.lampLight)), groundMaterial()), false)
  const water = shadowed(new THREE.Mesh(withSurface(geometry(MODEL, 'water').clone(), sources(NEAR, tones.lampLight)), waterMaterial()), false)
  return new THREE.Group().add(walls, decor, earth, water)
}

const scaled = (c: Rgb, k: number): Rgb => [c[0] * k, c[1] * k, c[2] * k]

// The jury read the panes as flat lit colour. The shared pane gives a room, drapes, a hot centre and a frost at the
// corners and the sill: fall dims the room, keeps the hot centre, and uses the frost slot as dark grime on the glass.
const PANE = { room: 0.45, drape: 0.3, hot: 1.0, grime: [0.014, 0.013, 0.009] as Rgb, grimeAmount: 0.7 }

function paneLook(room: Rgb, drape: Rgb): GlowLook {
  return { bulb: 1, bulbCore: 1, glass: scaled(room, 2.4), flame: tones.flame, room: scaled(room, PANE.room), curtain: scaled(drape, PANE.drape), frost: PANE.grime, frostAmount: PANE.grimeAmount, flicker: 0.07, cycles: 3, through: THROUGH, paneHot: PANE.hot }
}

export function lights(): THREE.Object3D {
  const warm: GlowLook = { bulb: 2.2, bulbCore: 4.4, glass: LAMP_GLASS, flame: scaled(tones.flame, 6), room: tones.lamp, curtain: tones.lamp, frost: [0, 0, 0], frostAmount: 0, flicker: 0.1, cycles: 5, through: THROUGH, paneHot: 0 }
  const warmPieces = [
    glowPiece(stretched(villageGeometry('lamp-glass')), (_i, isFlame) => [isFlame > 0.5 ? GLOW.flame : GLOW.glass, LAMP.phase, 0, 0]),
    glowPiece(geometry(MODEL, 'glow'), (_i, _inner, index) => [GLOW.bulb, 0.27 + 0.41 * index, index, 0]),
  ]
  const purple = new THREE.Mesh(glowGeometry([glowPiece(villageGeometry('pane-gable'), (_i, w, h) => [GLOW.pane, w, h, 1])]), glowMaterial(LIGHT, paneLook(tones.purple, tones.purpleDrape), clock))
  const green = new THREE.Mesh(
    glowGeometry([glowPiece(villageGeometry('pane-side'), (_i, w, h) => [GLOW.pane, w, h, 2]), glowPiece(geometry(MODEL, 'pane-attic'), (_i, w, h) => [GLOW.pane, w, h, 3])]),
    glowMaterial(LIGHT, paneLook(tones.green, tones.greenDrape), clock),
  )
  const lit = (x: number, z: number): Point => [x, groundAt(x, z) + 1.5, z]
  const pools = [lit(flame[0] + 0.4, flame[2] + 1.6)]
  const faces = PUMPKINS.map((p) => pumpkinFace(p, 0.95, -0.1))
  const halos = new THREE.Mesh(
    haloGeometry([flame, ...faces, ...pools], HALO.radiusMm, [HALO_KIND.lamp, ...faces.map(() => HALO_KIND.pumpkin), ...pools.map(() => HALO_KIND.pool)], HALO.wide),
    haloMaterial(LIGHT, tones.haloEdge, tones.haloCore, HALO, clock),
  )
  halos.renderOrder = 3
  const purpleHalo = new THREE.Mesh(haloGeometry([anchors.window], PANE_HALO.radiusMm, [PANE_SIZE], PANE_HALO.wide), haloMaterial(LIGHT, scaled(tones.purple, 0.5), tones.purpleLight, PANE_HALO, clock))
  purpleHalo.renderOrder = 3
  const greenHalo = new THREE.Mesh(haloGeometry([anchors.sideWindow, attic], PANE_HALO.radiusMm, [PANE_SIZE, PANE_SIZE], PANE_HALO.wide), haloMaterial(LIGHT, scaled(tones.green, 0.5), tones.greenLight, PANE_HALO, clock))
  greenHalo.renderOrder = 3
  return new THREE.Group().add(new THREE.Mesh(glowGeometry(warmPieces), glowMaterial(LIGHT, warm, clock)), purple, green, halos, purpleHalo, greenHalo)
}

const keep = (role: string): boolean => !isTree(role) && role !== 'ground' && role !== 'pond' && role !== 'fence'
const SINK = { depthMm: 3.2, from: 0.74, to: 0.97 }

function groundDistance(x: number, y: number, z: number): number {
  const t = smooth(SINK.from, SINK.to, pondField(x, z))
  const slope = moundSlope(z)
  return (y - (groundAt(x, z) - (SINK.depthMm - pond.dip) * (1 - t))) / Math.sqrt(1 + slope * slope)
}

function fenceDistance(x: number, y: number, z: number): number {
  const far = Math.hypot(Math.max(fenceBox.x0 - x, 0, x - fenceBox.x1), Math.max(fenceBox.z0 - z, 0, z - fenceBox.z1))
  return far > 6 ? far - 1 : boardDistance(x, y, z, BOARDS)
}

function propDistance(x: number, y: number, z: number): number {
  let d = Infinity
  for (const p of PUMPKINS) {
    const c = pumpkinCentre(p)
    const tall = pumpkinTall(p)
    const k = Math.hypot((x - c[0]) / p.r, (y - c[1]) / tall, (z - c[2]) / p.r)
    d = Math.min(d, (k - 1) * Math.min(p.r, tall))
  }
  {
    const top = flame[1] + 1.2
    const dy = y - Math.min(top, Math.max(foot[1], y))
    const r = y > flame[1] - 2.4 ? 1.7 : 1.1
    d = Math.min(d, Math.hypot(x - foot[0], dy, z - foot[2]) - r)
  }
  for (const r of ROCKS) {
    const c = rockCentre(r)
    const cs = Math.cos(r.yaw)
    const sn = Math.sin(r.yaw)
    const dx = x - c[0]
    const dz = z - c[2]
    const k = Math.hypot((dx * cs - dz * sn) / r.r[0], (y - c[1]) / r.r[1], (dx * sn + dz * cs) / r.r[2])
    d = Math.min(d, (k - 1) * Math.min(r.r[0], r.r[1], r.r[2]))
  }
  for (const s of STONES) {
    const cy = stoneBase(s)
    const c = Math.cos(s.yaw)
    const sn = Math.sin(s.yaw)
    const dx = x - s.at[0]
    const dz = z - s.at[1]
    const qx = Math.abs(dx * c - dz * sn) - s.w / 2
    const qy = Math.abs(y - cy) - s.h / 2
    const qz = Math.abs(dx * sn + dz * c) - s.d / 2
    d = Math.min(d, Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0))
  }
  return d
}

export function solid(x: number, y: number, z: number): number {
  return Math.min(solidDistance(x, y, z, keep), bushDistance(x, y, z), groundDistance(x, y, z), fenceDistance(x, y, z), propDistance(x, y, z))
}

export const places = { pond: { x: pond.x, z: pond.z, rx: pond.rx, rz: pond.rz, yaw: pond.yaw }, tree: { x: tree.x, z: tree.z }, lampFoot: lampFoot() }

export function update(moment: KitMoment): void {
  clock.value = (((moment.time / moment.period) % 1) + 1) % 1
  gain.value = gainOf(list, moment.time, moment.period)
}
