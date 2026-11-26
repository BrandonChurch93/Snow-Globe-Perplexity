import * as THREE from 'three'
import type { KitMoment } from '../kit'
import * as arrivalPart from './arrival'
import { sandMaterial } from './base'
import * as glassPart from './glass'

const PART = 'surface-dressing-summer'

// Where the sand lies on the slab, in mm from the globe's axis (x to the right of the hero camera, z toward it), measured
// from the approved image: the mound the spill builds against the foot on the right (a cone under the stream on a low
// dune), its shoulder round the front of the foot and a tongue toward the camera. Beside the foot on the left no sand
// is laid: single grains are sprinkled there, thick along the edge of the base's shadow and thinning out above it and
// toward the front. Everywhere else the table is bare.
const HEAP = {
  dune: { x: 68, z: -8, sx: 14, sz: 28, mm: 2.4 },
  cone: { x: 61.5, z: 6, mm: 9.0, reach: 24, round: 1.5, deep: 1.4, foot: 2.0 },
  bank: { mm: 3.2, r: 57.5, w: 8, az: [2, 100], ease: 16 },
  skirt: { x: 76, z: 26, sx: 13, sz: 18, mm: 2.6 },
  shoulder: { x: 52, z: 55, sx: 15, sz: 11, mm: 2.0 },
  fan: { x: 56, z: 88, sx: 22, sz: 34, mm: 1.3 },
  sprinkle: { at: [-63.8, -47.6], lit: [-0.918, -0.396], run: [-12, -2, 22, 78], rise: [0, 0.6], core: [0.95, 1.1], veil: [0.5, 6.5] },
  edge: { mm: [0.2, 0.45], sharp: 1.0, looseMm: 0.25, onHeap: 0.1, thickMm: 1.6, cover: [0.03, 1.2], far: [62, 88, 4.5], flat: [0.5, 4.5] },
  loose: { on: 0.05, fromMm: 0.03, edgeMm: 0.4, thinMm: 2.0, reach: 1.3, flung: 0.2, x: 84, z: 20, sx: 12, sz: 17, drift: { mm: [10, 22, 3.5, 9], edge: [0.42, 0.6], bare: 0.05, full: 2.4, rim: 0.45 } },
}
// The light on the sand of the table. The stage's lit material is made for the stone of the base; this takes its paint
// (every grain's own colour and tilt) and the stage's key, shadow, sky and card, and lights the sand as dry sand is lit
// by a low sun from behind: bright where a grain faces it, dark and cool in the shade, with no part burnt to white.
export const SAND_LIT = { tilt: 0.25, sun: 5.6, crest: [4.5, 11.0, 1.8, 1.3, 0.3, 0.6], face: [-0.05, 0.55], turn: [0.15, 0.6, 1.07, 0.05, 0.55], side: [0.5, 0.45], back: 1.0, sky: 3.4, card: 0.22, glint: 0.9, shade: 0.5, knee: 0.5, top: 1.0, high: 1.18, warm: [1.0, 0.74, 0.57], cool: [1.9, 1.75, 1.6], pale: 0.12, tint: [1.0, 0.9, 0.78], speck: 2.2, rows: 1080, grit: [0.42, 0.45, 0.7, 0.73, 0.65, 0.9], mote: [1.0, 4.5, 0.6], grain: [0.25, 0.75], spark: [12, 1.0], fray: [0.5, 1.3], thru: 1.2, cut: [-63.8, -47.6, -0.918, -0.396, -3.6, 0.6, -48, -30], deep: [0.5, 40], front: [0.12, 0.4, 12, 36], line: [61.5, 6, -0.866, 0.5], soft: [0, 10], wander: 1.2, from: [-25, 5], lift: [2, 16] }
export const SPRINKLE = { softMm: 5.0 } as const
export const SLAB = { liftMm: 0.5, footMm: 52.4, repose: 0.62, stepMm: 1.0, x: [-150, 142], z: [-232, 216] } as const

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
const bump = (x: number, z: number, g: { x: number; z: number; sx: number; sz: number; mm: number; turn?: number }): number => {
  const t = ((g.turn ?? 0) * Math.PI) / 180
  const u = (x - g.x) * Math.cos(t) + (z - g.z) * Math.sin(t)
  const v = (z - g.z) * Math.cos(t) - (x - g.x) * Math.sin(t)
  return g.mm * Math.exp(-((u / g.sx) ** 2 + (v / g.sz) ** 2))
}

// The pile under the stream: a cone at the sand's angle of repose with its top against the foot, where the stream lands,
// and a foot that eases into the sand round it.
const cone = (x: number, z: number): number => {
  const v = HEAP.cone.mm * (1 - (Math.hypot(x - HEAP.cone.x, (z - HEAP.cone.z) / HEAP.cone.deep) / HEAP.cone.reach) ** HEAP.cone.round)
  const k = HEAP.cone.foot
  return v > k ? v : v > -k ? (v + k) ** 2 / (4 * k) : 0
}

// The sand that lies up against the foot of the stone from the front round to the right, so that no bare table shows under its belly.
const bank = (x: number, z: number): number => {
  const B = HEAP.bank
  const az = (Math.atan2(x, z) * 180) / Math.PI
  const ease = (t: number): number => {
    const c = Math.min(1, Math.max(0, t))
    return c * c * (3 - 2 * c)
  }
  const out = Math.max(Math.hypot(x, z) - B.r, 0) / B.w
  return B.mm * ease((az - B.az[0]!) / B.ease) * ease((B.az[1]! - az) / B.ease) * Math.exp(-out * out)
}

// What lies at a place before the heap's edge is drawn in: the heaps and the sheet, with their lumps.
function laid(x: number, z: number): number {
  const broad = noise(x / 23 + 3.1, z / 23 + 7.7, 11)
  const mid = noise(x / 7.3 + 1.7, z / 7.3 + 9.2, 13)
  const fine = noise(x / 2.1 + 5.3, z / 2.1 + 2.9, 17)
  const heap = (bump(x, z, HEAP.dune) + cone(x, z)) * (0.86 + 0.28 * broad) + bank(x, z) * (0.8 + 0.4 * mid) + bump(x, z, HEAP.skirt) * (0.75 + 0.5 * mid) + bump(x, z, HEAP.shoulder) * (0.6 + 0.8 * broad) + bump(x, z, HEAP.fan) * (0.75 + 0.5 * broad * mid)
  const grit = noise(x / 1.1 + 4.7, z / 1.1 + 1.3, 31)
  const lumps = (grit - 0.5) * 0.15 * Math.min(1, heap / 1.5) + (fine - 0.5) * 0.25 * Math.min(1, heap / 2.5) + (mid - 0.5) * 0.6 * Math.min(1, heap / 4)
  return Math.max(0, heap + lumps)
}

// A heap of dry sand does not thin out into a film: it ends, on a ragged line, in a few loose grains. Below the edge's
// height (which wanders along the edge) what is laid falls away fast, so the layer is whole or it is not there, and the
// table beside it is bare.
export function sandHeight(x: number, z: number): number {
  const raw = laid(x, z)
  const E = HEAP.edge
  const cut = E.mm[0] + (E.mm[1] - E.mm[0]) * noise(x / 3.3 + 8.1, z / 3.3 + 4.4, 23) * (0.4 + 1.2 * noise(x / 11 + 2.2, z / 11 + 6.6, 29))
  return raw >= cut ? raw : raw * (raw / cut) ** E.sharp
}

// The height at which the heap covers the table whole: more toward its far end on the right, where it thins out over a longer way.
const sandFar = (x: number): number => Math.min(1, Math.max(0, (x - HEAP.edge.far[0]) / (HEAP.edge.far[1] - HEAP.edge.far[0])))
const sandWhole = (x: number): number => HEAP.edge.cover[1] + HEAP.edge.far[2] * sandFar(x)

// How many of the landing's loose grains come to lie at a place: on the thin sand and a little way out from its edge.
export function sandSpread(x: number, z: number): number {
  const h = laid(x, z)
  return 0.2 * Math.min(1, h / HEAP.edge.looseMm) * (HEAP.edge.onHeap + (1 - HEAP.edge.onHeap) / (1 + (h / HEAP.edge.thickMm) ** 2))
}

// The grains sprinkled beside the foot on the left: how thick they lie at a place, most along the edge of the base's
// shadow, less with every millimetre into the light and with the distance from the base.
export function sandSprinkle(x: number, z: number): number {
  const S = HEAP.sprinkle
  const ease = (a: number, b: number, v: number): number => {
    const c = Math.min(1, Math.max(0, (v - a) / (b - a)))
    return c * c * (3 - 2 * c)
  }
  const d = (x - S.at[0]!) * S.lit[0]! + (z - S.at[1]!) * S.lit[1]!
  const s = (x - S.at[0]!) * S.lit[1]! - (z - S.at[1]!) * S.lit[0]!
  const along = ease(S.run[0]!, S.run[1]!, s) * (1 - ease(S.run[2]!, S.run[3]!, s)) ** 1.3
  const in_ = Math.max(d, 0)
  const across = ease(S.rise[0]!, S.rise[1]!, d) * (S.core[0]! * Math.exp(-in_ / S.core[1]!) + S.veil[0]! * Math.exp(-in_ / S.veil[1]!))
  return Math.min(1, along * across * (0.6 + 0.8 * noise(x / 5.1 + 3.3, z / 5.1 + 8.8, 37)))
}

// How thick the sprinkle's core lies along the edge of the base's shadow: whole from the edge on, and thinning out over
// a few millimetres into the shadow.
export function sandSprinkleRun(x: number, z: number): number {
  const S = HEAP.sprinkle
  const ease = (a: number, b: number, v: number): number => {
    const c = Math.min(1, Math.max(0, (v - a) / (b - a)))
    return c * c * (3 - 2 * c)
  }
  const d = (x - S.at[0]!) * S.lit[0]! + (z - S.at[1]!) * S.lit[1]!
  const s = (x - S.at[0]!) * S.lit[1]! - (z - S.at[1]!) * S.lit[0]!
  return ease(-SPRINKLE.softMm, 0, d) * ease(S.run[0]!, S.run[1]!, s) * (1 - ease(S.run[2]!, S.run[3]!, s)) ** 1.3 * (0.55 + 0.45 * noise(x / 5.1 + 3.3, z / 5.1 + 8.8, 37))
}

// The place on the table that lies `s` mm along the edge of the base's shadow and `d` mm into the light from it.
export function sandSprinkleAt(s: number, d: number): [number, number] {
  const S = HEAP.sprinkle
  return [S.at[0]! + s * S.lit[1]! + d * S.lit[0]!, S.at[1]! - s * S.lit[0]! + d * S.lit[1]!]
}

// The share of single grains that lie loose at a place: a few on the heaps, many along their edges, fewer and fewer on
// the bare table beyond, and a scatter where the stream's grains bounce off the mound to the right.
export function sandLoose(x: number, z: number): number {
  const raw = laid(x, z)
  const whole = sandHeight(x, z) >= sandWhole(x)
  const L = HEAP.loose
  // They lie in drifts, with bare table between.
  const D = L.drift
  const lie = Math.min(1, Math.max(0, (0.6 * noise(x / D.mm[0]! + 1.3, z / D.mm[1]! + 7.1, 41) + 0.4 * noise(x / D.mm[2]! + 5.9, z / D.mm[3]! + 2.7, 43) - D.edge[0]!) / (D.edge[1]! - D.edge[0]!)))
  const drift = lie * lie * (3 - 2 * lie)
  const flung = L.flung * Math.exp(-(((x - L.x) / L.sx) ** 2 + ((z - L.z) / L.sz) ** 2)) * (D.bare + (D.full - D.bare) * drift)
  return whole ? L.on : Math.min(1, (Math.min(1, Math.max(0, raw - L.fromMm) / L.edgeMm) ** L.reach / (1 + (raw / L.thinMm) ** 2)) * (D.rim + (1 - D.rim) * drift) + flung)
}

function heapGeometry(): THREE.BufferGeometry {
  const step = SLAB.stepMm
  const nx = Math.round((SLAB.x[1] - SLAB.x[0]) / step) + 1
  const nz = Math.round((SLAB.z[1] - SLAB.z[0]) / step) + 1
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
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) h[j * nx + i] = under(SLAB.x[0] + i * step, SLAB.z[0] + j * step)
  const at = (i: number, j: number): number => h[Math.min(Math.max(j, 0), nz - 1) * nx + Math.min(Math.max(i, 0), nx - 1)]!
  const slot = new Int32Array(nx * nz).fill(-1)
  const position: number[] = []
  const normal: number[] = []
  const color: number[] = []
  const cover: number[] = []
  const index: number[] = []
  const vertex = (i: number, j: number): number => {
    const o = j * nx + i
    if (slot[o]! >= 0) return slot[o]!
    const x = SLAB.x[0] + i * step
    const z = SLAB.z[0] + j * step
    // Where the far end thins out the sand lies flat on the table, and is lit as the table is: its end has no dark face.
    const thin = Math.min(1, Math.max(0, (h[o]! - HEAP.edge.flat[0]) / (HEAP.edge.flat[1] - HEAP.edge.flat[0])))
    const lie = 1 - sandFar(x) * (1 - thin * thin * (3 - 2 * thin))
    const gx = (lie * (at(i + 1, j) - at(i - 1, j))) / (2 * step)
    const gz = (lie * (at(i, j + 1) - at(i, j - 1))) / (2 * step)
    const l = Math.hypot(gx, 1, gz)
    const r = Math.hypot(x, z)
    position.push(x, SLAB.liftMm + h[o]!, z)
    normal.push(-gx / l, 1 / l, -gz / l)
    const shade = 0.7 + 0.3 * Math.min(1, Math.max(0, (r - 55.5) / 13))
    const t = Math.min(1, Math.max(0, (h[o]! - HEAP.edge.cover[0]!) / (sandWhole(x) - HEAP.edge.cover[0]!)))
    color.push(1, shade, 0)
    cover.push(t * t * (3 - 2 * t), shade)
    slot[o] = position.length / 3 - 1
    return slot[o]!
  }
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const top = Math.max(at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1))
      if (top < 0.1) continue
      const a = vertex(i, j)
      const b = vertex(i + 1, j)
      const c = vertex(i, j + 1)
      const d = vertex(i + 1, j + 1)
      index.push(a, c, b, b, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  const count = position.length / 3
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(color, 3))
  g.setAttribute('aSlab', new THREE.Float32BufferAttribute(cover, 2))
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
  g.setAttribute('uv1', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
  g.setIndex(index)
  g.computeBoundingSphere()
  return g
}

const f = (v: number): string => v.toFixed(3)

// The shade the base and the globe lay over the sand in front of the foot, as the approved image has it: everything in
// front and to the left of a line from the top of the mound to its end at the right front, with a soft, wandering edge.
// `sandShade` is what is left of the key there: least close under the mound, more toward the front, where the light
// that comes through the globe falls. `sandOpen` is what is left of the sky in the shade (to the left, where the
// stage's own shadow of the base falls, that shadow counts).
const sandLine = (at: string): string => `((${at}.x - ${f(SAND_LIT.line[0]!)}) * ${f(SAND_LIT.line[2]!)} + (${at}.z - ${f(SAND_LIT.line[1]!)}) * ${f(SAND_LIT.line[3]!)})`
const sandGate = (at: string): string => `smoothstep(${f(SAND_LIT.from[0]!)}, ${f(SAND_LIT.from[1]!)}, ${at}.x)`
export const sandShade = (at: string): string => {
  const L = SAND_LIT
  return `mix(1.0, (mix(1.0, mix(${f(L.front[0]!)}, ${f(L.front[1]!)}, smoothstep(${f(L.front[2]!)}, ${f(L.front[3]!)}, ${sandLine(at)})), smoothstep(${f(L.soft[0]!)}, ${f(L.soft[1]!)}, ${sandLine(at)} + ${f(L.wander)} * sin(${at}.x * 0.37 + ${at}.z * 0.23)) * ${sandGate(at)} * (1.0 - smoothstep(${f(L.lift[0]!)}, ${f(L.lift[1]!)}, ${at}.y))) * mix(smoothstep(${f(L.cut[4]!)}, ${f(L.cut[5]!)}, (${at}.x - ${f(L.cut[0]!)}) * ${f(L.cut[2]!)} + (${at}.z - ${f(L.cut[1]!)}) * ${f(L.cut[3]!)}), 1.0, smoothstep(${f(L.cut[6]!)}, ${f(L.cut[7]!)}, ${at}.x))), uSandDown)`
}
export const sandOpen = (at: string, key: string): string => `mix(${f(SAND_LIT.deep[0]!)}, 1.0, mix(${key}, 1.0 - smoothstep(0.0, ${f(SAND_LIT.deep[1]!)}, ${sandLine(at)}), ${sandGate(at)} * uSandDown))`

const SLAB_PARS = `
varying vec2 vSlab;
uniform vec4 uSlabLens;
uniform float uSandDown;
float slabHash(vec2 p) {
  uvec2 q = uvec2(ivec2(floor(p)) + 32768);
  q = q * 1664525u + 1013904223u;
  q.x += q.y * 374761393u;
  q.x ^= q.x >> 15u;
  q.x *= 668265263u;
  q.x ^= q.x >> 13u;
  return float(q.x >> 8u) / 16777216.0;
}
float slabNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 t = p - i;
  t = t * t * (3.0 - 2.0 * t);
  return mix(mix(slabHash(i), slabHash(i + vec2(1.0, 0.0)), t.x), mix(slabHash(i + vec2(0.0, 1.0)), slabHash(i + vec2(1.0, 1.0)), t.x), t.y);
}
float slabSpeck(vec2 at, float seed) {
  vec2 cell = floor(at);
  vec2 off = at - cell - 0.5 - ${f(SAND_LIT.grit[0]!)} * (vec2(slabHash(cell + seed), slabHash(cell + seed + 16.0)) - 0.5);
  float size = mix(0.7, 1.0, slabHash(cell + seed + 52.0));
  return (1.0 - smoothstep(${f(SAND_LIT.grit[1]!)}, ${f(SAND_LIT.grit[2]!)}, 2.0 * length(off) / size)) * (1.0 - mix(${f(SAND_LIT.grain[0]!)}, ${f(SAND_LIT.grain[1]!)}, slabHash(cell + seed + 34.0)));
}
// The grain of the sand: on the lit ground, the small shade each grain throws on the next, in two layers that do not
// share a grid, and here and there a grain that glints.
vec2 slabGrit(vec2 at, float whole) {
  vec2 cell = floor(at);
  float g = (1.0 - slabSpeck(at, 7.0)) * (1.0 - slabSpeck(mat2(0.8, 0.6, -0.6, 0.8) * at * ${f(SAND_LIT.grit[3]!)} + 17.3, 67.0));
  g *= mix(mix(${f(SAND_LIT.fray[0]!)}, ${f(SAND_LIT.fray[1]!)}, slabHash(cell + 7.0)), 1.0, whole);
  vec2 mid = at - cell - 0.5;
  return vec2(g, step(${f(1 - 1 / SAND_LIT.spark[0]!)}, slabHash(cell + 17.0)) * (1.0 - smoothstep(0.2, 0.9, 2.0 * length(mid))));
}
`

const SLAB_LIGHT = `
float slabAlpha = 1.0;
#ifdef STAGE_LIGHT_DONE
{
  vec3 slabN = normalize(mix(nonPerturbedNormal, normal, ${f(SAND_LIT.tilt)}));
  vec3 slabUp = inverseTransformDirection(nonPerturbedNormal, viewMatrix);
  // The mound is seen from the side the sun does not reach. It is turned in a light that comes more from its side, so that
  // its shade follows the turn of its back, and what is turned away keeps a little of the light the sand round it throws back.
  float slabTurn = dot(slabN, normalize(stageKeyL + ${f(SAND_LIT.side[0]!)} * viewMatrix[0].xyz + ${f(SAND_LIT.side[1]!)} * viewMatrix[2].xyz));
  float slabLit = smoothstep(${f(SAND_LIT.turn[0]!)}, ${f(SAND_LIT.turn[1]!)}, slabTurn);
  float slabFace = ${f(SAND_LIT.turn[2]!)} * mix(${f(SAND_LIT.turn[3]!)}, 1.0, slabLit);
  float slabBack = clamp(dot(-geometryViewDir, stageKeyL) * 0.5 + 0.5, 0.0, 1.0);
  float slabSun = mix(stageKeyS, 1.0, ${sandGate('vStageWorld')} * uSandDown) * mix(${f(SAND_LIT.shade)}, 1.0, vSlab.y);
  slabSun *= ${sandShade('vStageWorld')};
  // The top of the mound stands in the light that comes over it from behind, and glows.
  float slabHigh = smoothstep(${f(SAND_LIT.crest[0]!)}, ${f(SAND_LIT.crest[1]!)}, vStageWorld.y - ${f(SLAB.liftMm)}) * smoothstep(${f(SAND_LIT.crest[4]!)}, ${f(SAND_LIT.crest[5]!)}, slabTurn);
  vec3 slabIn = stageKeyC * (slabSun * slabFace * (${f(SAND_LIT.sun)} + ${f(SAND_LIT.back)} * slabBack * slabBack) * (1.0 + ${f(SAND_LIT.crest[2]!)} * slabHigh));
  slabIn += mix(uRigGround, uRigSky, 0.5 + 0.5 * slabUp.y) * mix(vec3(${SAND_LIT.cool.map(f).join(', ')}), vec3(${SAND_LIT.warm.map(f).join(', ')}), slabSun) * (${f(SAND_LIT.sky)} * mix(0.45, 1.0, vSlab.y) * mix(${f(SAND_LIT.turn[4]!)}, 1.0, slabLit) * ${sandOpen('vStageWorld', 'stageKeyS')});
  slabIn += uRigCardCol * (${f(SAND_LIT.card)} * clamp(dot(slabN, normalize(mat3(viewMatrix) * uRigCardDir)) * 0.5 + 0.5, 0.0, 1.0) * mix(0.3, 1.0, vSlab.y));
  vec3 slabC = diffuseColor.rgb * vec3(${SAND_LIT.tint.map(f).join(', ')}) * RECIPROCAL_PI * slabIn;
  float slabHalf = max(dot(normal, normalize(stageKeyL + geometryViewDir)), 0.0);
  float slabSpark = slabHalf * slabHalf;
  slabSpark *= slabSpark;
  slabSpark *= slabSpark;
  slabSpark *= slabSpark;
  slabC += stageKeyC * (slabSun * ${f(SAND_LIT.glint)} * slabSpark * slabSpark);
  // The lens parts red from blue toward the frame's edge (post.ts), and a grain a pixel wide would come out of it as a
  // red, a green and a blue one. The grain of the sand is laid for each of the three as arrival.ts lays its grains: on the
  // pixels the post reads them from, with its weights.
  vec2 slabFoot = max(abs(dFdx(vStageWorld.xz)) + abs(dFdy(vStageWorld.xz)), vec2(0.02));
  vec2 slabStep = exp2(ceil(log2(slabFoot * (${f(SAND_LIT.speck)} * min(uSlabLens.x, uSlabLens.y) / ${f(SAND_LIT.rows / 2)}))));
  vec2 slabAt = vStageWorld.xz / slabStep;
  vec2 slabQ = gl_FragCoord.xy - uSlabLens.xy;
  float slabR = dot(slabQ, slabQ) / dot(uSlabLens.xy, uSlabLens.xy);
  vec2 slabPx = slabQ / max(length(slabQ), 1e-4) * (uSlabLens.z * pow(max(slabR, 1e-12), 0.5 * uSlabLens.w));
  vec2 slabX = dFdx(vStageWorld.xz) / slabStep;
  vec2 slabY = dFdy(vStageWorld.xz) / slabStep;
  vec2 slabLowR = floor(slabPx);
  vec2 slabFarR = slabPx - slabLowR;
  vec2 slabLowB = floor(-slabPx);
  vec2 slabFarB = -slabPx - slabLowB;
  vec2 slabGr = vec2(0.0);
  vec2 slabGg = vec2(0.0);
  vec2 slabGb = vec2(0.0);
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      vec2 k = vec2(float(i), float(j));
      vec2 wR = mix(1.0 - slabFarR, slabFarR, k);
      vec2 wB = mix(1.0 - slabFarB, slabFarB, k);
      vec2 oR = slabLowR + k;
      vec2 oB = slabLowB + k;
      slabGr += wR.x * wR.y * slabGrit(slabAt - slabX * oR.x - slabY * oR.y, vSlab.x);
      slabGb += wB.x * wB.y * slabGrit(slabAt - slabX * oB.x - slabY * oB.y, vSlab.x);
    }
  }
  vec2 slabSide = slabFarR * (1.0 - slabFarR);
  vec2 slabMid = 1.0 - 2.0 * slabSide;
  for (int j = -1; j < 2; j++) {
    for (int i = -1; i < 2; i++) {
      float w = (i == 0 ? slabMid.x : slabSide.x) * (j == 0 ? slabMid.y : slabSide.y);
      slabGg += w * slabGrit(slabAt + slabX * float(i) + slabY * float(j), vSlab.x);
    }
  }
  float slabL = dot(slabC, vec3(0.2126, 0.7152, 0.0722));
  float slabOver = max(slabL - ${f(SAND_LIT.knee)}, 0.0);
  float slabSpan = ${f(SAND_LIT.high - SAND_LIT.knee)} * (1.0 + ${f(SAND_LIT.crest[3]!)} * slabHigh);
  slabC *= (min(slabL, ${f(SAND_LIT.knee)}) + slabSpan * (1.0 - exp(-slabOver / slabSpan))) / max(slabL, 1e-4);
  slabC = mix(slabC, vec3(dot(slabC, vec3(0.2126, 0.7152, 0.0722))), ${f(SAND_LIT.pale)} * smoothstep(${f(SAND_LIT.knee * 0.5)}, ${f(SAND_LIT.high)}, slabL));
  slabC *= mix(vec3(1.0), vec3(slabGr.x, slabGg.x, slabGb.x), mix(${f(SAND_LIT.grit[4]!)}, ${f(SAND_LIT.grit[5]!)}, clamp(slabSun, 0.0, 1.0)));
  slabC += stageKeyC * (slabSun * slabSun * (0.35 + 0.65 * slabFace) * ${f(SAND_LIT.spark[1]!)}) * vec3(slabGr.y, slabGg.y, slabGb.y);
  outgoingLight = slabC;
  // The heap's rim is not cut: it lies over the table by its cover, thinner in drifts a few grains wide, and the single
  // grains of arrival.ts lie on it and beyond it.
  float slabThin = slabNoise(vStageWorld.xz / vec2(${f(SAND_LIT.mote[0]!)}, ${f(SAND_LIT.mote[1]!)}));
  slabAlpha = smoothstep(0.0, 1.0, vSlab.x * (1.0 + ${f(SAND_LIT.mote[2]!)}) - ${f(SAND_LIT.mote[2]!)} * slabThin);
  slabAlpha *= mix(slabAlpha, 1.0, vSlab.x);
}
#endif
diffuseColor.a = slabAlpha;
`

// The heap is the stage's sand (base.ts) with the light and the edge of this file put in place of its own.
function slabSand(): THREE.Material {
  const m = sandMaterial(PART, 'surface-dressing', `${PART}-sand`)
  m.transparent = true
  const inner = m.onBeforeCompile
  m.onBeforeCompile = (shader, renderer) => {
    inner.call(m, shader, renderer)
    shader.uniforms.uSlabLens = arrivalPart.grainLens
    shader.uniforms.uSandDown = arrivalPart.sandDown
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aSlab;\nvarying vec2 vSlab;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSlab = aSlab;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SLAB_PARS}`)
      .replace('#include <opaque_fragment>', `${SLAB_LIGHT}\n#include <opaque_fragment>`)
  }
  return m
}

export async function prepare(): Promise<void> {}

export function dressing(): THREE.Object3D {
  const group = new THREE.Group()
  const pool = (glassPart as { surfacePool?: () => THREE.Object3D }).surfacePool?.()
  if (pool) group.add(pool)
  const sand = new THREE.Mesh(heapGeometry(), slabSand())
  sand.castShadow = true
  sand.receiveShadow = true
  sand.renderOrder = 3
  const loose = arrivalPart.grains()
  loose.renderOrder = 4
  group.add(sand, loose)
  return group
}

export function update(_moment: KitMoment): void {}
