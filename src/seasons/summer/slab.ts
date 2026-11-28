import * as THREE from 'three'
import { GUST, MODE, setPresence } from '../../core/materials'
import { ROOM_RIG } from '../../scene/lighting'
import { inSteps, stepsOf, whole } from '../../scene/steps'
import { SHUTTER_CHANGE, changeRamp, leaveOut } from '../../shake/change'
import type { KitMoment } from '../kit'
import * as arrivalPart from './arrival'
import { sandMaterial } from './base'
import * as glassPart from './glass'
import { rig } from './rig'

const PART = 'surface-dressing-summer'

// Where the sand lies on the slab, in mm from the globe's axis (x to the right of the hero camera, z toward it), measured
// from the approved image: one low heap under the stream, three tenths of the base's height where it leans on the foot.
// To the right it falls to nothing over a long run; toward the camera it stands at the angle sand lies at, and that face
// is in its own shade. Round it lies an apron a grain or two deep that thins out into single grains, and a low bank
// along the foot. Everywhere else the table is bare.
const HEAP = {
  cone: { x: 59.3, z: 17.2, mm: 10.2, tip: 0.25, foot: 0.2, round: [[-180, 1.3], [-18, 1.5], [14, 1.6], [150, 1.5], [180, 1.3]], reach: [[-180, 20], [-90, 22], [-50, 27], [-20, 28], [12, 31], [40, 28], [90, 29], [125, 29], [155, 26], [180, 20]] },
  apron: { mm: 2.0, from: 0.6, lean: 2.5, extra: [[-180, 6], [-90, 6], [-30, 30], [0, 34], [25, 30], [50, 12], [90, 6], [130, 5], [180, 6]], patch: [-0.6, 0.3, 0.5] },
  bank: { mm: [[-180, 0], [-10, 0], [15, 2.0], [40, 5.0], [62, 7.5], [85, 7.5], [105, 3.0], [135, 0], [180, 0]], r: 58, w: 14 },
  skirt: { at: [96, 8], mm: [22, 9], high: 0.7, patch: [0.05, 0.5] },
  lumps: [0.06, 0.22, 0.8],
  sprinkle: { at: [-63.8, -47.6], lit: [-0.918, -0.396], run: [-12, -2, 22, 78], core: [0.95, 1.1], veil: [0.5, 6.5], edge: { out: [-6.5, 3.5], swing: [0.65, 19, 0.35, 5.3], fray: [2.5, 2.3], soft: [0.6, 2.4, 9.1], veil: [3.5, 3.0, 7.7] } },
  cover: [0.02, 3.0],
  ragged: { mm: [1.7, 4.3], most: 0.55 },
  spread: { looseMm: 0.25, onHeap: 0.1, thickMm: 1.6 },
  proud: { thin: 0.1, flank: 0.25, low: [1.5, 3.5], high: [2.5, 6.0] },
  strewn: { from: 0.8, side: [-5, 20, 0.25], drift: 0.25 },
}
// The light on the sand. The stage's lit material is made for the stone of the base; this takes its paint (every grain's
// own colour and tilt) and the stage's key, sky and card, and lights the sand as dry sand is lit by a low sun from behind.
export const SAND_LIT = { tilt: 0.25, ramp: [0.02, 0.26], gain: [0.45, 1.4], sun: 4.3, back: 1.0, sky: [3.6, 5.2, 8.0], card: 0.05, knee: 1.8, high: 3.2, pale: 0.75, tint: [1.0, 0.98, 0.93], thin: [0.5, 0.3, 4.0], lone: [1.0, 0.92, 0.84], speck: 1.8, finer: 1.6, rows: 1080, pit: [0.8, 0.33], pitTint: [1.0, 0.75, 0.5], warm: [0.22, 0.45], lean: [0.15, 0.45], tone: [0.6, 1.25], fade: 0.14, fill: [0.5, 1.0], soft: [0.8, 0.05], cast: [0.3, 0.1, 34], turned: { by: 0.6, low: 0.4, w: [0.6, 0.3], mm: 60, blur: 2.5 }, shade: [1.2, 0.93, 0.74], shadeTo: 0.25, ragged: [0.75, 0.5, 5.3], blur: [1.5, 2.5], unsharp: [0.75, 1.25], small: [0.5, 0.6], crest: { mm: [7.0, 9.5], tint: [0.88, 0.72, 0.6] } }
export const SPRINKLE = { softMm: 9.0 } as const
export const SLAB = { liftMm: 0.5, footMm: 52.4, repose: 0.62, stepMm: 0.5, skin: 2, bare: 0.0019, x: [-150, 142], z: [-232, 216], heap: { x: [-8, 132], z: [-78, 74] } } as const

const hash = (x: number, y: number, s: number): number => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}
function noise(x: number, y: number, s: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const u = fx * fx * (3 - 2 * fx)
  const v = fy * fy * (3 - 2 * fy)
  const a = hash(xi, yi, s)
  const b = hash(xi + 1, yi, s)
  const c = hash(xi, yi + 1, s)
  const d = hash(xi + 1, yi + 1, s)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const ease = (t: number): number => {
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

// A length that is given for some bearings from the top of the heap (0 toward the camera, 90 to the right), at any bearing.
const toward = (K: readonly number[][], deg: number): number => {
  for (let i = 0; i + 1 < K.length; i++) if (deg <= K[i + 1]![0]!) return K[i]![1]! + (K[i + 1]![1]! - K[i]![1]!) * ease((deg - K[i]![0]!) / (K[i + 1]![0]! - K[i]![0]!))
  return K[K.length - 1]![1]!
}
const bearing = (x: number, z: number): number => (Math.atan2(x - HEAP.cone.x, z - HEAP.cone.z) * 180) / Math.PI

// How far out from the top of the heap a place lies, as a share of the heap's reach that way: 1 on its edge.
const coneOut = (x: number, z: number): number => Math.hypot(x - HEAP.cone.x, z - HEAP.cone.z) / toward(HEAP.cone.reach, bearing(x, z))

// The heap under the stream: one low rounded cone with its top against the foot, where the stream lands, that falls to
// nothing over a long run and ends in a foot that thins out.
const cone = (x: number, z: number): number => {
  const C = HEAP.cone
  const t = Math.min(1, coneOut(x, z))
  const c = 1 - ((Math.hypot(t, C.tip) - C.tip) / (Math.hypot(1, C.tip) - C.tip)) ** toward(C.round, bearing(x, z))
  return (C.mm * (c < 2 * C.foot ? (c * c) / (4 * C.foot) : c - C.foot)) / (1 - C.foot)
}

// The sand that lies up against the foot of the stone from the front round to the right, so that no bare table shows under its belly.
const bank = (x: number, z: number): number => {
  const B = HEAP.bank
  const az = (Math.atan2(x, z) * 180) / Math.PI
  const out = Math.max(Math.hypot(x, z) - B.r, 0) / B.w
  return toward(B.mm, az) * Math.exp(-out * out)
}

// The thin sand round the heap: a grain or two deep at the heap's foot, thinner with every millimetre out, and the
// farther out the more of it is bare table between patches.
const apron = (x: number, z: number): number => {
  const A = HEAP.apron
  const deg = bearing(x, z)
  const reach = toward(HEAP.cone.reach, deg)
  const out = Math.min(1, Math.max(0, (Math.hypot(x - HEAP.cone.x, z - HEAP.cone.z) - A.from * reach) / ((1 - A.from) * reach + toward(A.extra, deg))))
  const patch = 0.6 * noise(x / 13 + 1.3, z / 17 + 7.1, 41) + 0.4 * noise(x / 4.3 + 5.9, z / 6.1 + 2.7, 43)
  return A.mm * (1 - out ** A.lean) * ease((patch - A.patch[0]! - (A.patch[1]! - A.patch[0]!) * out) / A.patch[2]!)
}

// The sand that the stream's grains have thrown past the heap, to the right and level with it as the camera sees it: a
// skirt less than a grain deep, in patches. None of it lies behind the heap, where thin sand on the dark table reads as
// grains in the air.
const skirt = (x: number, z: number): number => {
  const K = HEAP.skirt
  const patch = 0.55 * noise(x / 11 + 4.1, z / 15 + 2.3, 71) + 0.45 * noise(x / 3.7 + 9.3, z / 5.3 + 6.7, 73)
  return K.high * Math.exp(-(((x - K.at[0]!) / K.mm[0]!) ** 2) - ((z - K.at[1]!) / K.mm[1]!) ** 2) * ease((patch - K.patch[0]!) / K.patch[1]!)
}

// How high the sand lies at a place: the heap, the bank and the apron, with their lumps. It thins out to nothing; nowhere does it end in a step.
export function sandHeight(x: number, z: number): number {
  const mid = noise(x / 7.3 + 1.7, z / 7.3 + 9.2, 13)
  const fine = noise(x / 2.1 + 5.3, z / 2.1 + 2.9, 17)
  const grit = noise(x / 1.1 + 4.7, z / 1.1 + 1.3, 31)
  const heap = Math.hypot(cone(x, z), Math.max(bank(x, z) * (0.8 + 0.4 * mid), apron(x, z), skirt(x, z)))
  const L = HEAP.lumps
  return Math.max(0, heap + (grit - 0.5) * L[0]! * Math.min(1, heap / 1.5) + (fine - 0.5) * L[1]! * Math.min(1, heap / 2.5) + (mid - 0.5) * L[2]! * Math.min(1, heap / 4))
}

// How much of the table the sand covers at a height: whole from a little over a millimetre, single grains below.
const coverAt = (h: number): number => ease((h - HEAP.cover[0]!) / (HEAP.cover[1]! - HEAP.cover[0]!))

// How much of it the skin shows there: where the sand thins out its edge is ragged, patches of whole sand and patches
// of single grains, so the slab ends in no line.
const keepAt = (x: number, z: number, h: number): number => {
  const c = coverAt(h)
  const R = HEAP.ragged
  const n = 0.55 * noise(x / R.mm[0]! + 3.1, z / R.mm[0]! + 8.7, 59) + 0.45 * noise(x / R.mm[1]! + 6.3, z / R.mm[1]! + 1.9, 61)
  return Math.min(1, Math.max(0, c + (2 * n - 1) * R.most * 4 * c * (1 - c)))
}

// How deep the sand lies at a place, as the skin's own tone reads it: 0 where a grain lies alone on the table.
export function sandDeep(x: number, z: number): number {
  return ease((sandHeight(x, z) - SAND_LIT.thin[1]!) / (SAND_LIT.thin[2]! - SAND_LIT.thin[1]!))
}

// How many of the landing's loose grains come to lie at a place: on the thin sand and a little way out from its edge.
export function sandSpread(x: number, z: number): number {
  const h = sandHeight(x, z)
  return 0.2 * Math.min(1, h / HEAP.spread.looseMm) * (HEAP.spread.onHeap + (1 - HEAP.spread.onHeap) / (1 + (h / HEAP.spread.thickMm) ** 2))
}

// The sprinkle beside the foot on the left lies along the edge of the base's shadow, and that edge is ruled: a round
// base throws a shadow with straight sides. The grains lay whole from that edge on and thinned out behind it over a
// width that was the same all the way along, so the sprinkle ended on a ruled line on that side while its other sides
// thin out into single grains (decision 294, W5). Its own edge on that side swings about the ruled one now, a long
// swing and a short one, frayed at the size of a few grains, and the grains come in over a width that is its own at
// every place: no line of equal cover is straight.
//
// How far into the light from the ruled edge the sprinkle's own edge lies at a place, in mm (behind it where under 0).
const sprinkleEdge = (s: number, x: number, z: number): number => {
  const E = HEAP.sprinkle.edge
  const swing = E.swing[0]! * noise(s / E.swing[1]! + 7.1, 0.61, 41) + E.swing[2]! * noise(s / E.swing[3]! + 2.9, 0.23, 43)
  return E.out[0]! + (E.out[1]! - E.out[0]!) * swing + E.fray[0]! * (noise(x / E.fray[1]! + 1.7, z / E.fray[1]! + 6.1, 59) - 0.5)
}
// How soft the sprinkle comes in at `s` mm along the edge, in mm (the width of the step a grain's chance rises over).
const sprinkleSoft = (s: number): number => {
  const E = HEAP.sprinkle.edge
  return E.soft[0]! + (E.soft[1]! - E.soft[0]!) * noise(s / E.soft[2]! + 5.3, 0.37, 47)
}

// The grains sprinkled beside the foot on the left: how thick they lie at a place, most a little way into the light
// from the sprinkle's own edge, less with every millimetre further and with the distance from the base. None of them
// lies behind the ruled edge (arrival.ts lays them from there on), so where the sprinkle's own edge is behind it they
// come in from the ruled one: from nothing, over a width of their own, and from a little further into the light at
// one place than at the next.
export function sandSprinkle(x: number, z: number): number {
  const S = HEAP.sprinkle
  const ease = (a: number, b: number, v: number): number => {
    const c = Math.min(1, Math.max(0, (v - a) / (b - a)))
    return c * c * (3 - 2 * c)
  }
  const s = (x - S.at[0]!) * S.lit[1]! - (z - S.at[1]!) * S.lit[0]!
  const d = (x - S.at[0]!) * S.lit[0]! + (z - S.at[1]!) * S.lit[1]! - Math.max(sprinkleEdge(s, x, z), 0) - S.edge.veil[1] * noise(s / S.edge.veil[2] + 9.7, 0.83, 61)
  const along = ease(S.run[0]!, S.run[1]!, s) * (1 - ease(S.run[2]!, S.run[3]!, s)) ** 1.3
  const in_ = Math.max(d, 0)
  const across = ease(0, S.edge.veil[0] * sprinkleSoft(s), d) * (S.core[0]! * Math.exp(-in_ / S.core[1]!) + S.veil[0]! * Math.exp(-in_ / S.veil[1]!))
  return Math.min(1, along * across * (0.6 + 0.8 * noise(x / 5.1 + 3.3, z / 5.1 + 8.8, 37)))
}

// How thick the sprinkle's core lies along its edge: thinning out toward the base's shadow in single grains, as it
// does on its other sides, with no step and no corner in a grain's chance.
export function sandSprinkleRun(x: number, z: number): number {
  const S = HEAP.sprinkle
  const ease = (a: number, b: number, v: number): number => {
    const c = Math.min(1, Math.max(0, (v - a) / (b - a)))
    return c * c * (3 - 2 * c)
  }
  const s = (x - S.at[0]!) * S.lit[1]! - (z - S.at[1]!) * S.lit[0]!
  const d = (x - S.at[0]!) * S.lit[0]! + (z - S.at[1]!) * S.lit[1]! - sprinkleEdge(s, x, z)
  return (1 / (1 + Math.exp(-d / sprinkleSoft(s)))) * ease(S.run[0]!, S.run[1]!, s) * (1 - ease(S.run[2]!, S.run[3]!, s)) ** 1.3 * (0.55 + 0.45 * noise(x / 5.1 + 3.3, z / 5.1 + 8.8, 37))
}

// The place on the table that lies `s` mm along the edge of the base's shadow and `d` mm into the light from it.
export function sandSprinkleAt(s: number, d: number): [number, number] {
  const S = HEAP.sprinkle
  return [S.at[0]! + s * S.lit[1]! + d * S.lit[0]!, S.at[1]! - s * S.lit[0]! + d * S.lit[1]!]
}

// The grains that stand proud of the heap's skin: most on its crest and upper flank and where it thins out, so that
// no outline of the heap, from any side, is the skin's.
export function sandProud(x: number, z: number): number {
  const h = sandHeight(x, z)
  const c = coverAt(h)
  if (c <= 0) return 0
  const P = HEAP.proud
  return Math.min(1, Math.max(P.flank * ease((h - P.low[0]!) / (P.low[1]! - P.low[0]!)), ease((h - P.high[0]!) / (P.high[1]! - P.high[0]!))) + P.thin * 4 * c * (1 - c))
}

// The single grains strewn round the heap: thick where it thins out, fewer with every millimetre beyond (`reach` is the
// way over which they thin, as a share of the heap's length), most to the right, where the stream's grains bounce off
// the heap, and in drifts.
export function sandStrewn(x: number, z: number, reach: number): number {
  const c = coverAt(sandHeight(x, z))
  if (c >= 1) return 0
  const T = HEAP.strewn
  const side = T.side[2]! + (1 - T.side[2]!) * ease((x - HEAP.cone.x - T.side[0]!) / (T.side[1]! - T.side[0]!))
  const drift = T.drift + (1 - T.drift) * ease((0.6 * noise(x / 9 + 1.3, z / 19 + 7.1, 47) + 0.4 * noise(x / 3.5 + 5.9, z / 8 + 2.7, 53) - 0.3) / 0.4)
  return (1 - c) * side * drift * Math.exp(-Math.max(coneOut(x, z) - T.from, 0) / reach)
}

const keyDir = (): [number, number, number] => {
  const d = [rig.key.from[0] - ROOM_RIG.targetMm[0], rig.key.from[1] - ROOM_RIG.targetMm[1], rig.key.from[2] - ROOM_RIG.targetMm[2]] as const
  const l = Math.hypot(d[0], d[1], d[2])
  return [d[0] / l, d[1] / l, d[2] / l]
}

// The sun a slope of sand takes by the angle the key meets it at (the shader's sandFace).
const faceOf = (nl: number): number => ease((nl - SAND_LIT.ramp[0]!) / (SAND_LIT.ramp[1]! - SAND_LIT.ramp[0]!)) * (SAND_LIT.gain[0]! + SAND_LIT.gain[1]! * Math.min(1, Math.max(0, nl)))

interface Field {
  nx: number
  nz: number
  h: Float32Array
  cast: Float32Array
  lit: Float32Array
}
let made: Field | undefined
let laying: Generator<void, Field> | undefined

// The heap on a grid: its height, the shade its own lumps and crest throw along the key, and the sun each place takes.
// The shade is thrown as by a sun lower than the room's, so the near face lies in it from the crest to the floor and a
// little way out on the floor, where it ends softly and not in a line.
// It is laid a row of the grid at a time, with a place to stop after each (src/scene/steps.ts): laid in one piece it held
// the page's thread for a fifth of a second while the picture was being drawn. Each row is a plain function of its own,
// so that the numbers are worked through as they were and come out the same to the last bit.
function* fieldRows(): Generator<void, Field> {
  const step = SLAB.stepMm
  const [x0, x1] = SLAB.heap.x
  const [z0, z1] = SLAB.heap.z
  const nx = Math.round((x1 - x0) / step) + 1
  const nz = Math.round((z1 - z0) / step) + 1
  const h = new Float32Array(nx * nz)
  // Under the foot the sand does not stop at a wall: it runs down from where it leant on the base at its angle of repose,
  // so when the globe is lifted clear the heap has a slumped inner face and a whole footprint, not a notch.
  const under = (x: number, z: number): number => {
    const r = Math.hypot(x, z)
    if (r >= SLAB.footMm) return sandHeight(x, z)
    if (r < 1) return 0
    const k = SLAB.footMm / r
    const gone = SLAB.footMm - r
    return Math.max(0, sandHeight(x * k, z * k) - SLAB.repose * gone * (0.8 + 0.4 * noise(x / 3.1 + 2.3, z / 3.1 + 6.1, 19)) - 0.02 * gone * gone)
  }
  const high = (j: number): void => {
    for (let i = 0; i < nx; i++) h[j * nx + i] = under(x0 + i * step, z0 + j * step)
  }
  for (let j = 0; j < nz; j++) {
    high(j)
    yield
  }
  const at = (i: number, j: number): number => h[Math.min(Math.max(j, 0), nz - 1) * nx + Math.min(Math.max(i, 0), nx - 1)]!
  const soft = (u: number, v: number): number => {
    const i = Math.floor(u)
    const j = Math.floor(v)
    const fu = u - i
    const fv = v - j
    return (at(i, j) * (1 - fu) + at(i + 1, j) * fu) * (1 - fv) + (at(i, j + 1) * (1 - fu) + at(i + 1, j + 1) * fu) * fv
  }
  const key = keyDir()
  const plan = Math.hypot(key[0], key[2])
  const cast = new Float32Array(nx * nz).fill(1)
  const near = new Float32Array(nx * nz).fill(1)
  const face = new Float32Array(nx * nz)
  const lit = new Float32Array(nx * nz)
  const C = SAND_LIT.cast
  // The heap's shade is cast twice: along the key as it stands, which leaves lit sand as lit as it was, and from
  // further behind and lower, which lays the heap's near face in one soft shade.
  const T = SAND_LIT.turned
  const way = [key[0] / plan, key[2] / plan] as const
  const behind = [way[0] * (1 - T.by), way[1] * (1 - T.by) - T.by] as const
  const turned = [behind[0] / Math.hypot(behind[0], behind[1]), behind[1] / Math.hypot(behind[0], behind[1])] as const
  // Most of a ray runs over ground too low to shade the place it starts from. For each cell `over` holds the highest
  // ground a stretch of eight steps begun over it can pass, and a stretch that cannot lower the answer is not walked.
  // The steps that are walked are the same ones, so the field is the same to the last bit, from a fraction of the samples.
  const STRETCH = 8
  function* over(dir: readonly [number, number]): Generator<void, Float32Array> {
    const span = (k: number): [number, number] => [Math.floor(Math.min(0, k * (STRETCH - 1))) - 1, Math.ceil(Math.max(0, k * (STRETCH - 1))) + 2]
    const [ax, bx] = span(dir[0])
    const [az, bz] = span(dir[1])
    const along = new Float32Array(nx * nz)
    const top = new Float32Array(nx * nz)
    const across = (j: number): void => {
      for (let i = 0; i < nx; i++) {
        let most = -Infinity
        for (let d = ax; d <= bx; d++) most = Math.max(most, at(i + d, j))
        along[j * nx + i] = most
      }
    }
    const down = (j: number): void => {
      for (let i = 0; i < nx; i++) {
        let most = -Infinity
        for (let d = az; d <= bz; d++) most = Math.max(most, along[Math.min(Math.max(j + d, 0), nz - 1) * nx + i]!)
        top[j * nx + i] = most
      }
    }
    for (let j = 0; j < nz; j++) {
      across(j)
      yield
    }
    for (let j = 0; j < nz; j++) {
      down(j)
      yield
    }
    return top
  }
  const march = (i: number, j: number, dir: readonly [number, number], top: Float32Array, rise: number, reach: number, edge: number, w0: number, w1: number): number => {
    const here = h[j * nx + i]!
    let least = 1
    for (let s = step, k = 0; s < reach && least > 0; s += step, k++) {
      if (k % STRETCH === 0) {
        const far = s + (STRETCH - 1) * step
        const most = top[Math.min(Math.max(Math.floor(j + (dir[1] * s) / step), 0), nz - 1) * nx + Math.min(Math.max(Math.floor(i + (dir[0] * s) / step), 0), nx - 1)]! - here
        if (Math.min(edge - (most - rise * s) / (w0 + w1 * s), edge - (most - rise * far) / (w0 + w1 * far)) > least + 1e-6) {
          s += (STRETCH - 1) * step
          k += STRETCH - 1
          continue
        }
      }
      least = Math.min(least, edge - (soft(i + (dir[0] * s) / step, j + (dir[1] * s) / step) - here - rise * s) / (w0 + w1 * s))
    }
    return Math.max(least, 0)
  }
  const overWay = yield* over(way)
  const overTurned = yield* over(turned)
  const shaded = (j: number): void => {
    for (let i = 0; i < nx; i++) {
      const o = j * nx + i
      cast[o] = march(i, j, way, overWay, key[1] / plan, C[2]!, 0.5, C[0]!, C[1]!)
      const low = T.low * (SAND_LIT.ragged[0]! + SAND_LIT.ragged[1]! * noise((x0 + i * step) / SAND_LIT.ragged[2]! + 1.7, (z0 + j * step) / SAND_LIT.ragged[2]! + 4.1, 23)) * (key[1] / plan)
      near[o] = march(i, j, turned, overTurned, low, T.mm, 1, T.w[0]!, T.w[1]!)
      const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * step)
      const gz = (at(i, j + 1) - at(i, j - 1)) / (2 * step)
      face[o] = faceOf((key[1] - gx * key[0] - gz * key[2]) / Math.hypot(gx, 1, gz))
    }
  }
  for (let j = 0; j < nz; j++) {
    shaded(j)
    yield
  }
  // The edge of that shade is not a line: the skin takes it over a grain or two, and a grain that stands proud takes the
  // sun a little before the skin under it does.
  function* blurred(a: Float32Array, cells: number): Generator<void, Float32Array> {
    const reach = Math.ceil(cells * 2.5)
    const w: number[] = []
    for (let k = -reach; k <= reach; k++) w.push(Math.exp(-0.5 * (k / cells) ** 2))
    const sum = w.reduce((p, c) => p + c, 0)
    const mid = new Float32Array(nx * nz)
    const out = new Float32Array(nx * nz)
    const across = (j: number): void => {
      for (let i = 0; i < nx; i++) {
        let v = 0
        for (let k = -reach; k <= reach; k++) v += w[k + reach]! * a[j * nx + Math.min(Math.max(i + k, 0), nx - 1)]!
        mid[j * nx + i] = v / sum
      }
    }
    const down = (j: number): void => {
      for (let i = 0; i < nx; i++) {
        let v = 0
        for (let k = -reach; k <= reach; k++) v += w[k + reach]! * mid[Math.min(Math.max(j + k, 0), nz - 1) * nx + i]!
        out[j * nx + i] = v / sum
      }
    }
    for (let j = 0; j < nz; j++) {
      across(j)
      yield
    }
    for (let j = 0; j < nz; j++) {
      down(j)
      yield
    }
    return out
  }
  const wide = yield* blurred(near, T.blur)
  for (let o = 0; o < cast.length; o++) {
    cast[o] = Math.min(cast[o]!, wide[o]!)
    lit[o] = face[o]! * cast[o]!
  }
  return { nx, nz, h, cast: yield* blurred(cast, SAND_LIT.blur[0]!), lit: yield* blurred(lit, SAND_LIT.blur[1]!) }
}

// There is one field, and one laying of it for all who ask: whoever asks next lays the next row. A second dressing made
// beside the first, or a grain that asks for its sun in between, lays no field of its own and waits for no other.
function* fieldInSteps(): Generator<void, Field> {
  laying ??= fieldRows()
  for (;;) {
    if (made) return made
    const row = laying.next()
    if (row.done) return (made = row.value)
    yield
  }
}

const field = (): Field => made ?? whole(fieldInSteps())

// The sun a grain that lies at a place takes, as the skin under it does.
export function sandLitAt(x: number, z: number): number {
  const F = field()
  const u = (x - SLAB.heap.x[0]) / SLAB.stepMm
  const v = (z - SLAB.heap.z[0]) / SLAB.stepMm
  if (u < 0 || v < 0 || u > F.nx - 1 || v > F.nz - 1) return faceOf(keyDir()[1])
  const i = Math.min(Math.floor(u), F.nx - 2)
  const j = Math.min(Math.floor(v), F.nz - 2)
  const fu = u - i
  const fv = v - j
  const o = j * F.nx + i
  return (F.lit[o]! * (1 - fu) + F.lit[o + 1]! * fu) * (1 - fv) + (F.lit[o + F.nx]! * (1 - fu) + F.lit[o + F.nx + 1]! * fu) * fv
}

// The skin is drawn from every second node of the field, each with the slope the fine field has there. A cell none of
// whose corners has cover enough for one grain, whole or growing (slabGrain draws none under 0.002), is not drawn.
function* heapGeometry(): Generator<void, THREE.BufferGeometry> {
  const F = yield* fieldInSteps()
  const step = SLAB.stepMm
  const { nx, nz, h } = F
  const at = (i: number, j: number): number => h[Math.min(Math.max(j, 0), nz - 1) * nx + Math.min(Math.max(i, 0), nx - 1)]!
  const slot = new Int32Array(nx * nz).fill(-1)
  const position: number[] = []
  const normal: number[] = []
  const color: number[] = []
  const slab: number[] = []
  const index: number[] = []
  const vertex = (i: number, j: number): number => {
    const o = j * nx + i
    if (slot[o]! >= 0) return slot[o]!
    const x = SLAB.heap.x[0] + i * step
    const z = SLAB.heap.z[0] + j * step
    const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * step)
    const gz = (at(i, j + 1) - at(i, j - 1)) / (2 * step)
    const l = Math.hypot(gx, 1, gz)
    position.push(x, SLAB.liftMm + h[o]!, z)
    normal.push(-gx / l, 1 / l, -gz / l)
    const shade = 0.7 + 0.3 * Math.min(1, Math.max(0, (Math.hypot(x, z) - 55.5) / 13))
    color.push(1, shade, 0)
    slab.push(keepAt(x, z, h[o]!), shade, F.cast[o]!)
    slot[o] = position.length / 3 - 1
    return slot[o]!
  }
  const m = SLAB.skin
  const shows = (i: number, j: number): boolean => {
    const o = j * nx + i
    return Math.max(coverAt(h[o]!), keepAt(SLAB.heap.x[0] + i * step, SLAB.heap.z[0] + j * step, h[o]!)) >= SLAB.bare
  }
  const strip = (j: number): void => {
    for (let i = 0; i + m < nx; i += m) {
      if (!shows(i, j) && !shows(i + m, j) && !shows(i, j + m) && !shows(i + m, j + m)) continue
      const a = vertex(i, j)
      const b = vertex(i + m, j)
      const c = vertex(i, j + m)
      const d = vertex(i + m, j + m)
      index.push(a, c, b, b, c, d)
    }
  }
  for (let j = 0; j + m < nz; j += m) {
    strip(j)
    yield
  }
  const g = new THREE.BufferGeometry()
  const count = position.length / 3
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3))
  g.setAttribute('aSlab', new THREE.Float32BufferAttribute(slab, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
  g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
  g.setIndex(index)
  g.computeBoundingSphere()
  return g
}

const f = (v: number): string => v.toFixed(3)

// What the skin and the single grains (arrival.ts) share. The shade of the stone: the base's own outline (radius at
// height, assets-src/base-summer/profile.mjs) thrown along the key, with an edge that widens with the way the light has
// still to go. The sun a slope of sand takes: grains shade one another at grazing light, so it leaves the sand well
// before the slope turns from it. And the sand's tone: sun and sky on its paint, paler the brighter, nothing burnt to white.
export const SAND_GLSL = `
float sandStone(float h) {
  float low = max(11.2 - h, 0.0);
  return 60.3 - 0.00505 * low * low * low - 0.134 * pow(max(min(h, 30.5) - 11.2, 1e-6), 1.35) - 0.0143 * pow(max(h - 30.5, 1e-6), 2.49);
}
float sandBaseShade(vec3 p, vec3 key) {
  vec2 l = key.xz;
  float a = dot(l, l);
  if (a < 1e-6) return 1.0;
  float up = abs(key.y);
  float y = abs(p.y);
  float mid = -dot(p.xz, l) / a;
  float span = sqrt(max(3636.1 - dot(p.xz, p.xz) + mid * mid * a, 0.0) / a);
  float top = max(41.3 - y, 0.0) / max(up, 1e-3);
  float lo = clamp(mid - span, 0.0, top);
  float hi = clamp(mid + span, 0.0, top);
  float least = 1e3;
  for (int k = 0; k < 10; k++) {
    float s = mix(lo, hi, float(k) / 9.0);
    least = min(least, (length(p.xz + l * s) - sandStone(y + up * s)) / (${f(SAND_LIT.soft[0]!)} + ${f(SAND_LIT.soft[1]!)} * s));
  }
  return smoothstep(-1.0, 1.0, least);
}
float sandFace(float nl) {
  return smoothstep(${f(SAND_LIT.ramp[0]!)}, ${f(SAND_LIT.ramp[1]!)}, nl) * (${f(SAND_LIT.gain[0]!)} + ${f(SAND_LIT.gain[1]!)} * clamp(nl, 0.0, 1.0));
}
vec3 sandTone(vec3 paint, vec3 sun, vec3 sky) {
  vec3 c = paint * RECIPROCAL_PI * (sun * ${f(SAND_LIT.sun)} + sky * vec3(${SAND_LIT.sky.map(f).join(', ')}));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return mix(c, vec3(l), ${f(SAND_LIT.pale)} * smoothstep(${f(SAND_LIT.knee * 0.5)}, ${f(SAND_LIT.high)}, l));
}
vec3 sandShade(float sun) {
  return mix(vec3(${SAND_LIT.shade.map(f).join(', ')}), vec3(1.0), clamp(sun * ${f(1 / SAND_LIT.shadeTo)}, 0.0, 1.0));
}
vec3 sandCrest(float y) {
  return mix(vec3(1.0), vec3(${SAND_LIT.crest.tint.map(f).join(', ')}), smoothstep(${f(SAND_LIT.crest.mm[0]!)}, ${f(SAND_LIT.crest.mm[1]!)}, y));
}
vec3 sandKnee(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return c * (min(l, ${f(SAND_LIT.knee)}) + ${f(SAND_LIT.high - SAND_LIT.knee)} * (1.0 - exp(-max(l - ${f(SAND_LIT.knee)}, 0.0) / ${f(SAND_LIT.high - SAND_LIT.knee)}))) / max(l, 1e-4);
}
`

// The sand comes with the landing in patches, those by the base first and fewer with the distance. The skin and the single
// grains (arrival.ts) ask the same patches; a grain is a little before or after its patch by its own number.
const COMES = { near: [55, 150], spread: 0.6, late: 0.75, soft: 0.2, patchMm: [11, 3.7], own: 0.3 } as const
export const SAND_BORN = `
float sandSeed(vec2 c) {
  uvec2 q = uvec2(ivec2(c) + 32768);
  q = q * 1664525u + 1013904223u;
  q.x += q.y * 374761393u;
  q.x ^= q.x >> 15u;
  q.x *= 668265263u;
  q.x ^= q.x >> 13u;
  return float(q.x >> 8u) / 16777216.0;
}
float sandPatch(vec2 p) {
  vec2 c = floor(p);
  vec2 t = p - c;
  t = t * t * (3.0 - 2.0 * t);
  return mix(mix(sandSeed(c), sandSeed(c + vec2(1.0, 0.0)), t.x), mix(sandSeed(c + vec2(0.0, 1.0)), sandSeed(c + vec2(1.0, 1.0)), t.x), t.y);
}
float sandCome(vec2 p, float own, float grow) {
  float away = smoothstep(${f(COMES.near[0])}, ${f(COMES.near[1])}, length(p));
  float lot = 0.65 * sandPatch(p * ${f(1 / COMES.patchMm[0])}) + 0.35 * sandPatch(p * ${f(1 / COMES.patchMm[1])} + 19.0);
  float born = ${f(COMES.late)} * mix(away, mix(lot, own, ${f(COMES.own)}), ${f(COMES.spread)});
  return smoothstep(born, born + ${f(COMES.soft)}, grow);
}
`

// How the sand leaves the table in a change of season. It breaks up where it lies: nothing of it is moved as one piece,
// so no frame holds the heap's outline away from its place. `run` is the share of the span `surface-leave` that has
// passed (change.ts, `leaveOut`: 0 at rest and in every change that does not take the sand away), and all of it is a
// function of that one number, so any frame can be drawn alone:
// - The heap is cut down (`sandCap`, `sandSlumped`): sand that stood h high stands cap * (1 - exp(-h / cap)) high, and the
//   cap comes down from far above the peak to nothing at `slumpBy` of the span. So the peak comes down first and the low
//   sand last, and the heap's shadow is cut with it (`slabShadow`).
// - Its skin goes in patches (`sandGo`), those by the foot first, as the gust comes out from under the glass: where a
//   patch has thinned the sand is single grains with the table between them, and then the table.
// - The single grains on it and round it (arrival.ts) are taken out by that gust (`sandGust`), as the petals and the
//   leaves are (materials.ts, `GUST`: its reach and its height): each along the line out from the stage's axis, slowly at
//   first and then fast, lifted a little, those by the foot first and each a little before or after its place by its
//   own number. A grain thins from `thin` of its way on, and every grain has gone its whole way when the span is over.
//   A grain is drawn whole in every sample, a row of beads a step apart: under `loosePx[0]` pixels a step the beads
//   touch and are the line the grain leaves; past it they stand apart, so a grain thins from there and is not drawn
//   past `loosePx[1]`, where the line a grain that small leaves is too faint to see.
// - Sand in the air is a soft body and not a bundle of lines (`sandFlight`). A grain that has left its place is drawn as
//   a soft disc `puffMm` wide by its own number, `puffAt` of that from the first instant and whole at the end of its
//   way, and it hides the less the wider it is drawn, as a grain out of focus does: so the many are one haze, and no
//   single one is a line. Each takes its own heading, up to `fan` to either side of the line out, so their ways cross.
//   It keeps the paint and the light of the place it lay in, so the sand in the air is the sand that lay there. A grain
//   that lies is a speck over the heap's skin, and the skin is the warmer and the darker of the two (its grit takes
//   green and blue from it, `SAND_LIT.warm`, and every grain of it shades a pit): seen whole and many deep, the grains
//   were a grey white cloud over a golden heap. So a grain in the air is painted `paint` of its own colour, which is the
//   skin's tone. The sand of a patch goes together, a patch more and a patch less (`wisp`, by the skin's own patches),
//   so the body in the air has wisps and is no even fog, and it hides `dense` of what its sand would. A grain
//   that still lies comes down with the heap under it. One that lies on the heap (`onHeapMm` and more above the table)
//   and has not left is lost in the sand in the air as the gust comes over it: by `dim` of the leaving it hides nothing,
//   so no row of specks stands on the heap's outline against the sand behind it. Sand strewn on the table lies as it
//   lay until it goes.
// - The skin's grain is read ahead of its place along the heap's line out (`uSlabOut`, its last place: `sandStream`), up
//   to `streamMm`, more as the leaving goes on. So where the skin has thinned to single grains each is a soft trail and
//   not a still dot, and the heap that comes down in a frame is not a row of upright strokes. The first two places of
//   `uSlabOut`, a way along the table, stay 0: the skin is read where it lies and nothing of it is moved.
export const LEAVE = {
  slumpBy: 0.85,
  highMm: 10,
  flat: 1000,
  near: [55, 150],
  spread: 0.6,
  late: 0.6,
  soft: 0.4,
  patchMm: [11, 3.7],
  own: 0.3,
  grain: { late: 0.5, own: 0.5, thin: 0.55, up: [0.2, 1.0], fan: 0.5, puffMm: [1.0, 2.4], puffAt: 0.6, dense: 0.85, wisp: [0.3, 1.0], paint: [0.7, 0.58, 0.4], dim: 0.12, onHeapMm: 0.5 },
  streamMm: 5,
  streamBy: 0.35,
  tapsACell: 6,
  taps: 32,
  loosePx: [4, 8],
} as const
const LEAVE_WAY = [HEAP.cone.x / Math.hypot(HEAP.cone.x, HEAP.cone.z), HEAP.cone.z / Math.hypot(HEAP.cone.x, HEAP.cone.z)] as const

/** The height in mm the heap is cut down to when `run` of its leaving has passed: no cut before it, nothing left from `slumpBy` on. */
export function sandCap(run: number): number {
  if (!(run > 0)) return Infinity
  const u = ease(run / LEAVE.slumpBy)
  return u >= 1 ? 0 : LEAVE.highMm * (1 / u - 1)
}

/** What stands of sand `tallMm` high under that cut: the low sand keeps its height longest, the peak comes down first. */
export function sandSlumped(tallMm: number, capMm: number): number {
  return capMm === Infinity ? tallMm : capMm > 0 ? capMm * (1 - Math.exp(-tallMm / capMm)) : 0
}

const step = (a: number, b: number, v: number): number => ease((v - a) / (b - a))

/** How far from the foot a place `mm` from the stage's axis is, 0 to 1: the gust reaches the near places first. */
const leaveAway = (mm: number): number => step(LEAVE.near[0], LEAVE.near[1], mm)

/** The share of the skin's sand left at a place `mm` from the axis, in a patch whose number is `lot`, when `run` has passed: what `sandGo` gives. */
export function sandLeft(mm: number, lot: number, own: number, run: number): number {
  const dies = LEAVE.late * (leaveAway(mm) + (lot + (own - lot) * LEAVE.own - leaveAway(mm)) * LEAVE.spread)
  return 1 - step(dies, dies + LEAVE.soft, run)
}

/**
 * A grain in the gust when `run` has passed: how far out along its line it is (mm), how high (mm) and the share of it
 * that is left. `a` and `b` are its own numbers, `stepPx` the pixels a sample for a millimetre a share of the span (0
 * where the samples of a frame are not joined). What `sandGust` gives.
 */
export function sandGustAt(mm: number, a: number, b: number, run: number, stepPx = 0): [number, number, number] {
  const G = LEAVE.grain
  const start = G.late * (leaveAway(mm) + (b - leaveAway(mm)) * G.own)
  const q = Math.min(1, Math.max(0, (run - start) / (1 - start)))
  const reach = GUST.reachOutMm * (0.5 + a)
  const pace = (2 * reach * q) / (1 - start)
  const high = G.up[0] + (G.up[1] - G.up[0]) * ((a * 7.3 + b * 3.1) % 1)
  return [reach * q * q, GUST.heightMm * high * Math.sin((Math.PI / 2) * q), (1 - step(G.thin, 1, q)) * (1 - step(LEAVE.loosePx[0], LEAVE.loosePx[1], pace * stepPx))]
}

/** The share of its flight that a grain at `mm` from the axis has behind it when `run` has passed (`b` is its own number). */
export function sandFlown(mm: number, b: number, run: number): number {
  const G = LEAVE.grain
  const start = G.late * (leaveAway(mm) + (b - leaveAway(mm)) * G.own)
  return Math.min(1, Math.max(0, (run - start) / (1 - start)))
}

/** The turn of a grain's own heading from the line out, in radians: no two grains go the same way. */
export function sandTurn(a: number, b: number): number {
  return LEAVE.grain.fan * (2 * ((a * 13.7 + b * 5.9) % 1) - 1)
}

/** The radius in mm of the soft disc a grain is drawn as when `q` of its flight is behind it: nothing while it lies. */
export function sandPuff(q: number, a: number): number {
  if (!(q > 0)) return 0
  const G = LEAVE.grain
  return (G.puffMm[0] + (G.puffMm[1] - G.puffMm[0]) * ((a * 3.7 + 0.31) % 1)) * (G.puffAt + (1 - G.puffAt) * Math.min(q, 1))
}

/** How far ahead of its place, in mm along the heap's line out, the skin's grain is read when `run` has passed: the last place of `uSlabOut`. */
export function sandStream(run: number): number {
  return run > 0 ? LEAVE.streamMm * step(0, LEAVE.streamBy, run) : 0
}

/** `uSandGust`: x the share of the leaving that has passed, y one over the height the heap is cut to (0 for no cut), z the pixels a sample for a millimetre a share. */
export const sandGust = { value: new THREE.Vector4(0, 0, 0, 0) }

/** What `uSandGust` holds in one sample (`pxPerMm` is a millimetre of the table at the heap, on the picture). */
export function sandLeaving(leaves: boolean, change: number, sample: { t: number; of?: number; hold?: number } | null, pxPerMm: number): { run: number; flat: number; stepPx: number } {
  const go = leaveOut(leaves, change, sample, GUST.reachOutMm, 0)
  const cap = sandCap(go.run)
  return { run: go.run, flat: cap === Infinity ? 0 : cap > 0 ? Math.min(1 / cap, LEAVE.flat) : LEAVE.flat, stepPx: go.of > 0 ? (SHUTTER_CHANGE / go.of / changeRamp('surface-leave').length) * pxPerMm : 0 }
}

// For a vertex shader that has `SAND_BORN`: the three laws above.
export const SAND_GONE = `
uniform vec4 uSandGust;
float sandAway(vec2 p) {
  return smoothstep(${f(LEAVE.near[0])}, ${f(LEAVE.near[1])}, length(p));
}
float sandGo(vec2 p, float own) {
  float lot = 0.65 * sandPatch(p * ${f(1 / LEAVE.patchMm[0])}) + 0.35 * sandPatch(p * ${f(1 / LEAVE.patchMm[1])} + 19.0);
  float dies = ${f(LEAVE.late)} * mix(sandAway(p), mix(lot, own, ${f(LEAVE.own)}), ${f(LEAVE.spread)});
  return 1.0 - smoothstep(dies, dies + ${f(LEAVE.soft)}, uSandGust.x);
}
float sandSlump(float tall) {
  return uSandGust.y > 0.0 ? (1.0 - exp(-tall * uSandGust.y)) / uSandGust.y : tall;
}
vec3 sandGust(vec2 p, float a, float b) {
  float start = ${f(LEAVE.grain.late)} * mix(sandAway(p), b, ${f(LEAVE.grain.own)});
  float q = clamp((uSandGust.x - start) / (1.0 - start), 0.0, 1.0);
  float reach = ${f(GUST.reachOutMm)} * (0.5 + a);
  float pace = 2.0 * reach * q / (1.0 - start);
  float kept = (1.0 - smoothstep(${f(LEAVE.grain.thin)}, 1.0, q)) * (1.0 - smoothstep(${f(LEAVE.loosePx[0])}, ${f(LEAVE.loosePx[1])}, pace * uSandGust.z));
  return vec3(reach * q * q, ${f(GUST.heightMm)} * mix(${f(LEAVE.grain.up[0])}, ${f(LEAVE.grain.up[1])}, fract(a * 7.3 + b * 3.1)) * sin(1.5707963 * q), kept);
}
// A grain in the air: x the share of its flight behind it, y the turn of its heading from the line out, z the radius of
// the soft disc it is drawn as (0 while it lies).
vec3 sandFlight(vec2 p, float a, float b) {
  float start = ${f(LEAVE.grain.late)} * mix(sandAway(p), b, ${f(LEAVE.grain.own)});
  float q = clamp((uSandGust.x - start) / (1.0 - start), 0.0, 1.0);
  float wide = mix(${f(LEAVE.grain.puffMm[0])}, ${f(LEAVE.grain.puffMm[1])}, fract(a * 3.7 + 0.31)) * mix(${f(LEAVE.grain.puffAt)}, 1.0, q);
  return vec3(q, ${f(LEAVE.grain.fan)} * (2.0 * fract(a * 13.7 + b * 5.9) - 1.0), q > 0.0 ? wide : 0.0);
}
// How much of what its sand would hide a grain in the air hides, by the patch of the skin it lay in.
float sandWisp(vec2 p) {
  float lot = 0.65 * sandPatch(p * ${f(1 / LEAVE.patchMm[0])}) + 0.35 * sandPatch(p * ${f(1 / LEAVE.patchMm[1])} + 19.0);
  return ${f(LEAVE.grain.dense)} * mix(${f(LEAVE.grain.wisp[0])}, ${f(LEAVE.grain.wisp[1])}, smoothstep(0.3, 0.7, lot));
}
`

// How the heap comes with a landing. It is fed by the sand that jumps and falls, so it is not there at once: the fall
// pours and the heap grows under it for `seconds`. What stands of it is cut as in the leaving, the other way round
// (`feedCap`): sand that will stand h high stands cap * (1 - exp(-h / cap)) high, and the cap goes up from nothing to far
// above the peak, quickly at first and slowly at the end. So a low fan lies over the heap's ground first, the flanks
// are whole next and the peak last, and from `seconds` on no cut is left: the heap is the heap of the still pictures to
// the last place. Its normals lean with the cut and its shadow is cut with it, as in the leaving. The single grains on
// it (arrival.ts) lie as high as the heap stands under them, and a grain in the air comes down on it where it stands.
// The spill off the ledge is plainly denser at the landing (`spill`): for `hold` seconds every thread of the fall
// carries `long` more of its length in sand and is `wide` thicker, and that goes down to the standing fall by `over`.
// All of it is a function of the time since the foot came down, so any frame can be drawn alone.
export const FEED = { seconds: 2, capMm: 2.5, flat: 1000, spill: { hold: 0.35, over: 2, long: 1.2, wide: 0.8 } } as const

/** The height in mm the growing heap is cut to, `seconds` after the foot came down: nothing at the landing, no cut from `FEED.seconds` on, at rest and before the landing. */
export function feedCap(seconds: number): number {
  if (!(seconds >= 0) || !(seconds < FEED.seconds)) return Infinity
  const left = (1 - seconds / FEED.seconds) ** 2
  return (FEED.capMm * (1 - left)) / left
}

/** How much more than the standing fall the spill carries, 0 to 1, `seconds` after the foot came down. */
export function feedSurge(seconds: number): number {
  if (!(seconds >= 0) || !(seconds < FEED.spill.over)) return 0
  return 1 - step(FEED.spill.hold, FEED.spill.over, seconds)
}

/** `uSandFeed`: x one over the height the growing heap is cut to (0 for no cut), y the surge of the spill. The other two are 0. */
export const sandFed = { value: new THREE.Vector4(0, 0, 0, 0) }

/** What `uSandFeed` holds `seconds` after the foot came down. */
export function sandFeed(seconds: number): { flat: number; surge: number } {
  const cap = feedCap(seconds)
  return { flat: cap === Infinity ? 0 : cap > 0 ? Math.min(1 / cap, FEED.flat) : FEED.flat, surge: feedSurge(seconds) }
}

// For a vertex shader: what stands of sand `tall` high while the heap grows.
export const SAND_FED = `
uniform vec4 uSandFeed;
float sandFed(float tall) {
  return uSandFeed.x > 0.0 ? (1.0 - exp(-tall * uSandFeed.x)) / uSandFeed.x : tall;
}
`

const SLAB_PARS = `
varying vec3 vSlab;
uniform vec4 uSlabLens;
uniform vec2 uSlabFocus;
uniform float uSlabPx;
uniform vec4 uSlabOut;
uniform float uSandDown;
uniform vec2 uSandFoot;
${SAND_GLSL}
vec4 slabCell(vec2 p) {
  uvec2 q = uvec2(ivec2(floor(p)) + 32768);
  q = q * 1664525u + 1013904223u;
  q.x += q.y * 374761393u;
  q.x ^= q.x >> 15u;
  q.x *= 668265263u;
  q.x ^= q.x >> 13u;
  q.x *= 1274126177u;
  q.x ^= q.x >> 16u;
  return vec4(float(q.x & 255u), float((q.x >> 8u) & 255u), float((q.x >> 16u) & 255u), float(q.x >> 24u)) / 255.0;
}
// One layer of grains, a grain to a cell, there where the sand's cover reaches the cell's own number. x: the light on
// the grain, more on the side that faces the sun and less on the other, y: how much of the place it covers, z: how much
// of that light is the warmer light of a tan grain among the pale ones; x and z are times y.
vec3 slabGrain(vec2 at, float seed, float keep, vec3 lean) {
  vec2 cell = floor(at);
  vec4 h = slabCell(cell + seed);
  float size = mix(0.6, 1.0, h.z) * mix(${f(SAND_LIT.small[0]!)}, 1.0, smoothstep(0.0, ${f(SAND_LIT.small[1]!)}, keep));
  vec2 off = at - cell - 0.5 - (1.0 - size) * (h.xy - 0.5);
  float cover = (1.0 - smoothstep(0.45, 1.0, 2.0 * length(off) / size)) * step(h.w * 0.996 + 0.002, keep);
  float light = mix(${f(SAND_LIT.tone[0]!)}, ${f(SAND_LIT.tone[1]!)}, fract(h.z * 7.0 + h.w * 3.0)) * (1.0 + lean.z * clamp(2.0 * dot(off, lean.xy) / size, -1.0, 1.0));
  return vec3(light, 1.0, light * h.x * h.x) * cover;
}
// The grain of the sand, in two layers that do not share a grid: the larger grains, and finer ones between them.
vec3 slabGrit(vec2 at, float keep, vec3 lean) {
  vec3 a = slabGrain(at, 7.0, keep, lean);
  vec3 b = slabGrain(mat2(0.8, 0.6, -0.6, 0.8) * at * ${f(SAND_LIT.finer)} + 17.3, 67.0, keep, vec3(mat2(0.8, 0.6, -0.6, 0.8) * lean.xy, lean.z));
  return a + b * (1.0 - a.y);
}
`

const SLAB_LIGHT = `
float slabAlpha = 1.0;
#ifdef STAGE_LIGHT_DONE
{
  vec3 slabN = normalize(mix(nonPerturbedNormal, normal, ${f(SAND_LIT.tilt)}));
  vec3 slabUp = inverseTransformDirection(nonPerturbedNormal, viewMatrix);
  // While the globe stands the stone's shade is its outline, thrown; while it is in the air, the stage's own shadow.
  float slabStone = mix(stageKeyS, sandBaseShade(vStageWorld - vec3(uSandFoot.x, 0.0, uSandFoot.y), uRigKeyDir), uSandDown);
  float slabSun = sandFace(dot(slabN, stageKeyL)) * vSlab.z * slabStone;
  float slabBack = clamp(dot(-geometryViewDir, stageKeyL) * 0.5 + 0.5, 0.0, 1.0);
  vec3 slabSky = (mix(uRigGround, uRigSky, 0.5 + 0.5 * slabUp.y) + uRigCardCol * (${f(SAND_LIT.card)} * clamp(dot(slabN, normalize(mat3(viewMatrix) * uRigCardDir)) * 0.5 + 0.5, 0.0, 1.0))) * vSlab.y * sandShade(slabSun);
  // Where the sand thins out, and where the skin turns from the eye, it is single grains with the table between them;
  // and a grain that lies alone is darker and more of its own colour than sand that lies deep, which is lit by its neighbours too.
  float slabKeep = vSlab.x * smoothstep(0.0, ${f(SAND_LIT.fade)}, dot(normalize(nonPerturbedNormal), geometryViewDir));
  // A grain that lies alone and out of focus is not painted. Paint cannot be blurred as the lens blurs a grain: it is
  // drawn again from each of the lens's points, a row of beads. The grains of arrival.ts lie there, each one soft disc.
  float slabFar = max(-(viewMatrix * vec4(vStageWorld, 1.0)).z, 1.0);
  float slabBlur = uSlabFocus.x * abs(slabFar * uSlabFocus.y - 1.0) * uSlabPx / slabFar * ${f(SAND_LIT.rows / 2)} / min(uSlabLens.x, uSlabLens.y);
  slabKeep *= 1.0 - smoothstep(${f(SAND_LIT.unsharp[0]!)}, ${f(SAND_LIT.unsharp[1]!)}, slabBlur) * (1.0 - smoothstep(${f(SAND_LIT.fill[0]!)}, ${f(SAND_LIT.fill[1]!)}, slabKeep));
  float slabDeep = smoothstep(${f(SAND_LIT.thin[1]!)}, ${f(SAND_LIT.thin[2]!)}, vStageWorld.y - ${f(SLAB.liftMm)});
  vec3 slabC = sandTone(diffuseColor.rgb * vec3(${SAND_LIT.tint.map(f).join(', ')}) * sandCrest(vStageWorld.y) * mix(vec3(${SAND_LIT.lone.map(f).join(', ')}) * ${f(SAND_LIT.thin[0]!)}, vec3(1.0), max(slabDeep, 1.0 - clamp(slabSun, 0.0, 1.0))), stageKeyC * (slabSun * (1.0 + ${f(SAND_LIT.back)} * slabBack * slabBack)), slabSky);
  // The lens parts red from blue toward the frame's edge (post.ts), and a grain a pixel wide would come out of it as a
  // red, a green and a blue one. The grain of the sand is laid for each of the three as arrival.ts lays its grains: on the
  // pixels the post reads them from, with its weights.
  vec2 slabFoot = max(abs(dFdx(vStageWorld.xz)) + abs(dFdy(vStageWorld.xz)), vec2(0.02));
  vec2 slabStep = exp2(ceil(log2(slabFoot * (${f(SAND_LIT.speck)} * min(uSlabLens.x, uSlabLens.y) / ${f(SAND_LIT.rows / 2)}))));
  vec2 slabLay = (vStageWorld.xz - uSlabOut.xy) / slabStep;
  vec2 slabToSun = uRigKeyDir.xz * slabStep;
  float slabLit = clamp(slabSun, 0.0, 1.0);
  vec3 slabLean = vec3((dot(slabToSun, slabToSun) > 0.0 ? normalize(slabToSun) : vec2(1.0, 0.0)), mix(${f(SAND_LIT.lean[0]!)}, ${f(SAND_LIT.lean[1]!)}, slabLit));
  vec2 slabQ = gl_FragCoord.xy - uSlabLens.xy;
  float slabR = dot(slabQ, slabQ) / dot(uSlabLens.xy, uSlabLens.xy);
  vec2 slabPx = slabQ / max(length(slabQ), 1e-4) * (uSlabLens.z * pow(max(slabR, 1e-12), 0.5 * uSlabLens.w));
  vec2 slabX = dFdx(vStageWorld.xz) / slabStep;
  vec2 slabY = dFdy(vStageWorld.xz) / slabStep;
  vec2 slabLowR = floor(slabPx);
  vec2 slabFarR = slabPx - slabLowR;
  vec2 slabLowB = floor(-slabPx);
  vec2 slabFarB = -slabPx - slabLowB;
  vec3 slabGr = vec3(0.0);
  vec3 slabGg = vec3(0.0);
  vec3 slabGb = vec3(0.0);
  // The leaving (LEAVE, above): the grain is read at places along the heap's way, most where the heap is in this sample
  // and none past uSlabOut.z behind it and uSlabOut.w ahead of it, each pixel and sample at its own places.
  float slabSpan = uSlabOut.z + uSlabOut.w;
  vec2 slabWay = vec2(${LEAVE_WAY[0].toFixed(6)}, ${LEAVE_WAY[1].toFixed(6)}) / slabStep;
  int slabTaps = int(clamp(ceil(${f(LEAVE.tapsACell)} * slabSpan * max(abs(slabWay.x), abs(slabWay.y))), 1.0, ${f(LEAVE.taps)}));
  float slabTurn = slabTaps > 1 ? stageHash(vec3(gl_FragCoord.xy, uSeed + 0.37)) : 0.0;
  float slabBehind = slabTaps > 1 ? uSlabOut.z / slabSpan : 0.5;
  for (int slabTap = 0; slabTap < slabTaps; slabTap++) {
  vec2 slabAt = slabLay;
  if (slabTaps > 1) {
    float slabQ1 = (float(slabTap) + slabTurn) / float(slabTaps);
    slabAt -= slabWay * (slabQ1 < slabBehind ? -uSlabOut.z * (1.0 - sqrt(slabQ1 / slabBehind)) : uSlabOut.w * (1.0 - sqrt((1.0 - slabQ1) / (1.0 - slabBehind))));
  }
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec2 k = vec2(float(i), float(j));
      vec2 wR = mix(1.0 - slabFarR, slabFarR, k);
      vec2 wB = mix(1.0 - slabFarB, slabFarB, k);
      vec2 oR = slabLowR + k;
      vec2 oB = slabLowB + k;
      slabGr += wR.x * wR.y * slabGrit(slabAt - slabX * oR.x - slabY * oR.y, slabKeep, slabLean);
      slabGb += wB.x * wB.y * slabGrit(slabAt - slabX * oB.x - slabY * oB.y, slabKeep, slabLean);
    }
  }
  vec2 slabSide = slabFarR * (1.0 - slabFarR);
  vec2 slabMid = 1.0 - 2.0 * slabSide;
  for (int j = -1; j < 2; j++) {
    for (int i = -1; i < 2; i++) {
      float w = (i == 0 ? slabMid.x : slabSide.x) * (j == 0 ? slabMid.y : slabSide.y);
      slabGg += w * slabGrit(slabAt + slabX * float(i) + slabY * float(j), slabKeep, slabLean);
    }
  }
  }
  slabGr /= float(slabTaps);
  slabGg /= float(slabTaps);
  slabGb /= float(slabTaps);
  // Between the grains lies the pit each one shades, and where the sand thins out, the table.
  float slabFill = smoothstep(${f(SAND_LIT.fill[0]!)}, ${f(SAND_LIT.fill[1]!)}, slabKeep);
  float slabPit = slabFill * mix(${f(SAND_LIT.pit[0]!)}, ${f(SAND_LIT.pit[1]!)}, slabLit);
  vec3 slabCover = vec3(slabGr.y, slabGg.y, slabGb.y);
  vec3 slabGrain = vec3(slabGr.x, slabGg.x - ${f(SAND_LIT.warm[0]!)} * slabGg.z, slabGb.x - ${f(SAND_LIT.warm[1]!)} * slabGb.z) + slabPit * vec3(${SAND_LIT.pitTint.map(f).join(', ')}) * (1.0 - slabCover);
  slabCover += slabFill * (1.0 - slabCover);
  if (max(slabCover.r, max(slabCover.g, slabCover.b)) <= 0.0) discard;
  slabGrain /= max(slabCover, vec3(1e-4));
  outgoingLight = vec3(sandKnee(slabC * slabGrain.r).r, sandKnee(slabC * slabGrain.g).g, sandKnee(slabC * slabGrain.b).b) * slabCover;
  slabAlpha = slabCover.g;
}
#endif
diffuseColor.a = slabAlpha;
`

// While the heap grows (arrival.ts) it is as high as it has grown, and its skin comes in patches, those by the base first.
// Where the heap leant on the foot it stands, as the foot leaves, as the cast of the foot's edge. It does not stand long:
// within the second the sand slides down into the print at its angle of repose, and the print is closed.
const SLUMP = { from: 0.33, seconds: 1.0, steep: 5.0 } as const
const SLAB_RISE = `
float slabStood = uSandLift < 0.0 ? 0.0 : 1.0 - smoothstep(${f(SLUMP.from)}, ${f(SLUMP.from + SLUMP.seconds)}, uSandLift);
float slabCut = ${f(SLUMP.steep)} * slabStood * slabStood * slabStood * max(${f(SLAB.footMm)} - length(position.xz), 0.0);
float slabTall = max(position.y - ${f(SLAB.liftMm)} - slabCut, 0.0);
if (uSandGust.x > 0.0) slabTall = sandSlump(slabTall);
if (uSandFeed.x > 0.0) slabTall = sandFed(slabTall);
transformed.y = ${f(SLAB.liftMm)} + slabTall;
float slabGrown = clamp((slabTall - ${f(HEAP.cover[0]!)}) / ${f(HEAP.cover[1]! - HEAP.cover[0]!)}, 0.0, 1.0);
vSlab = vec3(mix(slabGrown * slabGrown * (3.0 - 2.0 * slabGrown), aSlab.x * sandCome(position.xz, 0.5, uSandGrow), step(slabCut, 0.0)), aSlab.yz);
if (uSandGust.x > 0.0) vSlab.x *= sandGo(position.xz, 0.5);
`
// Sand cut down lies flatter by the slope of the cut, and is lit as it lies.
const SLAB_LEAN = `
if (uSandGust.x > 0.0) {
  float slabFlat = exp(-max(position.y - ${f(SLAB.liftMm)}, 0.0) * uSandGust.y);
  objectNormal = normalize(vec3(objectNormal.x * slabFlat, max(objectNormal.y, 1e-4), objectNormal.z * slabFlat));
}
if (uSandFeed.x > 0.0) {
  float slabLow = exp(-max(position.y - ${f(SLAB.liftMm)}, 0.0) * uSandFeed.x);
  objectNormal = normalize(vec3(objectNormal.x * slabLow, max(objectNormal.y, 1e-4), objectNormal.z * slabLow));
}
`

// The heap is the stage's sand (base.ts) with the light and the edge of this file put in place of its own.
function slabSand(): THREE.Material {
  const m = sandMaterial(PART, 'surface-dressing', `${PART}-sand`)
  m.transparent = true
  m.blending = THREE.CustomBlending
  m.blendEquation = THREE.AddEquation
  m.blendSrc = THREE.OneFactor
  m.blendDst = THREE.OneMinusSrcAlphaFactor
  m.blendSrcAlpha = THREE.ZeroFactor
  m.blendDstAlpha = THREE.OneFactor
  const inner = m.onBeforeCompile
  m.onBeforeCompile = (shader, renderer) => {
    inner.call(m, shader, renderer)
    shader.uniforms.uSlabLens = arrivalPart.grainLens
    shader.uniforms.uSlabFocus = arrivalPart.grainFocus
    shader.uniforms.uSlabPx = arrivalPart.grainPx
    shader.uniforms.uSlabOut = slabOut
    shader.uniforms.uSandDown = arrivalPart.sandDown
    shader.uniforms.uSandGrow = arrivalPart.sandGrow
    shader.uniforms.uSandLift = arrivalPart.sandLift
    shader.uniforms.uSandFoot = arrivalPart.sandFoot
    shader.uniforms.uSandGust = sandGust
    shader.uniforms.uSandFeed = sandFed
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nattribute vec3 aSlab;\nvarying vec3 vSlab;\nuniform float uSandGrow;\nuniform float uSandLift;${SAND_BORN}${SAND_GONE}${SAND_FED}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${SLAB_LEAN}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SLAB_RISE}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SLAB_PARS}`)
      .replace('#include <opaque_fragment>', `${SLAB_LIGHT}\n#include <opaque_fragment>`)
  }
  return m
}

// The heap's shadow is the shadow of the heap as it stands: the light's own picture of it is cut down with it.
function slabShadow(): THREE.Material {
  const m = new THREE.MeshDepthMaterial()
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSandGust = sandGust
    shader.uniforms.uSandFeed = sandFed
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SAND_BORN}${SAND_GONE}${SAND_FED}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nif (uSandGust.x > 0.0) transformed.y = ${f(SLAB.liftMm)} + sandSlump(max(position.y - ${f(SLAB.liftMm)}, 0.0));\nif (uSandFeed.x > 0.0) transformed.y = ${f(SLAB.liftMm)} + sandFed(max(position.y - ${f(SLAB.liftMm)}, 0.0));`)
  }
  return m
}

export async function prepare(): Promise<void> {}

const heaps: THREE.Mesh[] = []
const strewn: THREE.Mesh[] = []
// All four are 0 and stay 0: a vector of four made with no numbers has a 1 in its last place, which would read the grain
// a millimetre ahead of every place in every picture.
const slabOut = { value: new THREE.Vector4(0, 0, 0, 0) }

// Made in steps where the page is drawing (src/scene/steps.ts): the same statements in the same order as in one piece,
// with a place to stop after the pool, after each row of the field and of the skin, and after each lot of grains.
export const dressing = inSteps(function* (): Generator<void, THREE.Object3D> {
  const group = new THREE.Group()
  const pool = (glassPart as { surfacePool?: () => THREE.Object3D }).surfacePool?.()
  if (pool) group.add(pool)
  yield
  const sand = new THREE.Mesh(yield* heapGeometry(), slabSand())
  sand.castShadow = true
  sand.receiveShadow = true
  sand.renderOrder = 3
  sand.customDepthMaterial = slabShadow()
  heaps.push(sand)
  yield
  const loose = yield* stepsOf(arrivalPart.grains)
  loose.renderOrder = 4
  strewn.push(loose)
  group.add(sand, loose)
  return group
})

// Where a place on the table falls on the picture, in pixels from its middle, x to the right and y down.
function onPicture(f: KitMoment['frame'], x: number, z: number): [number, number] {
  const c = f.pose.position
  const l = Math.hypot(c.x - f.pose.aim.x, c.y - f.pose.aim.y, c.z - f.pose.aim.z)
  const bx = (c.x - f.pose.aim.x) / l
  const by = (c.y - f.pose.aim.y) / l
  const bz = (c.z - f.pose.aim.z) / l
  const flat = Math.hypot(bx, bz)
  if (!(flat > 1e-9)) return [0, 0]
  const rx = bz / flat
  const rz = -bx / flat
  const depth = -(bx * (x - c.x) - by * c.y + bz * (z - c.z))
  return [(f.focalPx * (rx * (x - c.x) + rz * (z - c.z))) / depth, (-f.focalPx * (by * rz * (x - c.x) - (bz * rx - bx * rz) * c.y - by * rx * (z - c.z))) / depth]
}

export function update(moment: KitMoment): void {
  const come = arrivalPart.sandGrown(moment)
  const f = moment.frame
  // The leaving (`LEAVE`): the sand stays where it lies, and `uSandGust` says how much of its leaving has passed in this
  // sample. A millimetre of the heap's way out on the picture, in pixels, is taken where the heap's top is.
  const here = onPicture(f, HEAP.cone.x, HEAP.cone.z)
  const next = onPicture(f, HEAP.cone.x + LEAVE_WAY[0], HEAP.cone.z + LEAVE_WAY[1])
  const go = sandLeaving(f.from !== f.to && f.from.season === 'summer', f.change, f.sample, Math.hypot(next[0] - here[0], next[1] - here[1]))
  sandGust.value.set(go.run, go.flat, go.stepPx, 0)
  slabOut.value.w = sandStream(go.run)
  // The growing (`FEED`): while the heap is fed it stands as high as its cut lets it, and is not scaled as one piece.
  const fed = sandFeed(arrivalPart.sinceDown(moment))
  sandFed.value.set(fed.flat, fed.surge, 0, 0)
  const grown = fed.flat > 0 && come > 0 ? 1 : come
  for (const heap of heaps) {
    heap.visible = come > 0 && go.run < 1
    heap.scale.y = Math.max(grown, 1e-3)
    heap.position.set(0, SLAB.liftMm * (1 - grown), 0)
    if (go.run > 0) setPresence(heap.material as THREE.Material, MODE.always, 1)
    heap.updateMatrix()
  }
  for (const grains of strewn) {
    grains.visible = go.run < 1
    grains.position.set(0, 0, 0)
    if (go.run > 0) setPresence(grains.material as THREE.Material, MODE.always, 1)
    grains.updateMatrix()
  }
}
