import * as THREE from 'three'
import type { KitMoment } from '../kit'
import * as arrivalPart from './arrival'
import { sandMaterial } from './base'
import * as glassPart from './glass'

const PART = 'surface-dressing-summer'

// Where the sand lies on the slab, in mm from the globe's axis (x to the right of the hero camera, z toward it), measured
// from the approved image: the mound the spill builds against the foot on the right (a cone under the stream on a low
// dune), its shoulder round the front of the foot, a tongue toward the camera, and a sheet beside the foot on the left that runs out to the front along the edge of the base's shadow.
// Everywhere else the table is bare.
const HEAP = {
  dune: { x: 66, z: -12, sx: 11, sz: 30, mm: 3.0 },
  cone: { x: 61.5, z: 6, mm: 9.0, run: 0.42, deep: 1.3 },
  bank: { mm: 3.2, r: 57.5, w: 8, az: [2, 100], ease: 16 },
  skirt: { x: 66, z: 30, sx: 11, sz: 15, mm: 1.5 },
  shoulder: { x: 52, z: 55, sx: 15, sz: 11, mm: 2.0 },
  fan: { x: 56, z: 88, sx: 22, sz: 34, mm: 1.3 },
  sheet: { x: -75.4, z: -30.8, sx: 46, sz: 11, mm: 1.6, turn: 113.3, from: [-104, -96] },
  edge: { mm: [0.2, 0.45], sharp: 1.0, looseMm: 0.25, cover: [0.04, 0.75] },
  loose: { on: 0.05, fromMm: 0.03, edgeMm: 0.4, reach: 1.3, flung: 0.5, x: 88, z: 12, sx: 15, sz: 24 },
}
// The light on the sand of the table. The stage's lit material is made for the stone of the base; this takes its paint
// (every grain's own colour and tilt) and the stage's key, shadow, sky and card, and lights the sand as dry sand is lit
// by a low sun from behind: bright where a grain faces it, dark and cool in the shade, with no part burnt to white.
export const SAND_LIT = { tilt: 0.5, sun: 4.8, face: [-0.05, 0.55], back: 1.0, sky: 3.4, card: 0.22, glint: 0.9, shade: 0.5, knee: 0.9, top: 3.0, warm: [1.0, 0.74, 0.57], pale: 0.55, tint: [1.0, 0.94, 0.93], speck: 1.3, grain: [0.86, 1.06], thru: 1.2, cut: [-63.8, -47.6, -0.918, -0.396, -0.8, 1.2, -48, -30], deep: [0.15, 40], front: [0.03, 0.2, 4, 45], line: [61.5, 6, -0.866, 0.5], soft: [-3, 7], wander: 1.2, from: [-25, 5], lift: [7.5, 11.5] }
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

// The pile under the stream: a cone at the sand's angle of repose with its top against the foot, where the stream lands.
const cone = (x: number, z: number): number => Math.max(0, HEAP.cone.mm - HEAP.cone.run * Math.hypot(x - HEAP.cone.x, (z - HEAP.cone.z) / HEAP.cone.deep))

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
  const sheet = bump(x, z, HEAP.sheet) * Math.min(1, Math.max(0, (x - HEAP.sheet.from[0]!) / (HEAP.sheet.from[1]! - HEAP.sheet.from[0]!))) * (0.55 + 0.9 * broad * mid)
  const grit = noise(x / 1.1 + 4.7, z / 1.1 + 1.3, 31)
  const lumps = (grit - 0.5) * 0.15 * Math.min(1, heap / 1.5) + (fine - 0.5) * 0.25 * Math.min(1, heap / 2.5) + (mid - 0.5) * 0.6 * Math.min(1, heap / 4)
  return Math.max(0, heap + sheet + lumps)
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

// How many of the landing's loose grains come to lie at a place: on the thin sand and a little way out from its edge.
export function sandSpread(x: number, z: number): number {
  return 0.2 * Math.min(1, laid(x, z) / HEAP.edge.looseMm)
}

// The share of single grains that lie loose at a place: a few on the heaps, many along their edges, fewer and fewer on
// the bare table beyond, and a scatter where the stream's grains bounce off the mound to the right.
export function sandLoose(x: number, z: number): number {
  const raw = laid(x, z)
  const whole = sandHeight(x, z) >= HEAP.edge.cover[1]
  const L = HEAP.loose
  const flung = L.flung * Math.exp(-(((x - L.x) / L.sx) ** 2 + ((z - L.z) / L.sz) ** 2))
  return whole ? L.on : Math.min(1, Math.min(1, Math.max(0, raw - L.fromMm) / L.edgeMm) ** L.reach + flung)
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
    const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * step)
    const gz = (at(i, j + 1) - at(i, j - 1)) / (2 * step)
    const l = Math.hypot(gx, 1, gz)
    const r = Math.hypot(x, z)
    position.push(x, SLAB.liftMm + h[o]!, z)
    normal.push(-gx / l, 1 / l, -gz / l)
    const shade = 0.7 + 0.3 * Math.min(1, Math.max(0, (r - 55.5) / 13))
    const t = Math.min(1, Math.max(0, (h[o]! - HEAP.edge.cover[0]) / (HEAP.edge.cover[1] - HEAP.edge.cover[0])))
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
  return `(mix(1.0, mix(${f(L.front[0]!)}, ${f(L.front[1]!)}, smoothstep(${f(L.front[2]!)}, ${f(L.front[3]!)}, ${sandLine(at)})), smoothstep(${f(L.soft[0]!)}, ${f(L.soft[1]!)}, ${sandLine(at)} + ${f(L.wander)} * sin(${at}.x * 0.37 + ${at}.z * 0.23)) * ${sandGate(at)} * (1.0 - smoothstep(${f(L.lift[0]!)}, ${f(L.lift[1]!)}, ${at}.y))) * mix(smoothstep(${f(L.cut[4]!)}, ${f(L.cut[5]!)}, (${at}.x - ${f(L.cut[0]!)}) * ${f(L.cut[2]!)} + (${at}.z - ${f(L.cut[1]!)}) * ${f(L.cut[3]!)}), 1.0, smoothstep(${f(L.cut[6]!)}, ${f(L.cut[7]!)}, ${at}.x)))`
}
export const sandOpen = (at: string, key: string): string => `mix(${f(SAND_LIT.deep[0]!)}, 1.0, mix(${key}, 1.0 - smoothstep(0.0, ${f(SAND_LIT.deep[1]!)}, ${sandLine(at)}), ${sandGate(at)}))`

const SLAB_PARS = `
varying vec2 vSlab;
float slabHash(vec2 p) {
  uvec2 q = uvec2(ivec2(floor(p)) + 32768);
  q = q * 1664525u + 1013904223u;
  q.x += q.y * 374761393u;
  q.x ^= q.x >> 15u;
  q.x *= 668265263u;
  q.x ^= q.x >> 13u;
  return float(q.x >> 8u) / 16777216.0;
}
`

const SLAB_LIGHT = `
bool slabCut = false;
#ifdef STAGE_LIGHT_DONE
{
  vec3 slabN = normalize(mix(nonPerturbedNormal, normal, ${f(SAND_LIT.tilt)}));
  vec3 slabUp = inverseTransformDirection(nonPerturbedNormal, viewMatrix);
  float slabNdl = dot(slabN, stageKeyL);
  float slabFace = smoothstep(${f(SAND_LIT.face[0]!)}, ${f(SAND_LIT.face[1]!)}, slabNdl);
  float slabBack = clamp(dot(-geometryViewDir, stageKeyL) * 0.5 + 0.5, 0.0, 1.0);
  float slabSun = stageKeyS * mix(${f(SAND_LIT.shade)}, 1.0, vSlab.y);
  slabSun *= ${sandShade('vStageWorld')};
  vec3 slabIn = stageKeyC * (slabSun * slabFace * (${f(SAND_LIT.sun)} + ${f(SAND_LIT.back)} * slabBack * slabBack));
  slabIn += mix(uRigGround, uRigSky, 0.5 + 0.5 * slabUp.y) * vec3(${SAND_LIT.warm.map(f).join(', ')}) * (${f(SAND_LIT.sky)} * mix(0.45, 1.0, vSlab.y) * ${sandOpen('vStageWorld', 'stageKeyS')});
  slabIn += uRigCardCol * (${f(SAND_LIT.card)} * clamp(dot(slabN, normalize(mat3(viewMatrix) * uRigCardDir)) * 0.5 + 0.5, 0.0, 1.0) * mix(0.3, 1.0, vSlab.y));
  vec3 slabC = diffuseColor.rgb * vec3(${SAND_LIT.tint.map(f).join(', ')}) * RECIPROCAL_PI * slabIn;
  float slabHalf = max(dot(normal, normalize(stageKeyL + geometryViewDir)), 0.0);
  float slabSpark = slabHalf * slabHalf;
  slabSpark *= slabSpark;
  slabSpark *= slabSpark;
  slabSpark *= slabSpark;
  slabC += stageKeyC * (slabSun * ${f(SAND_LIT.glint)} * slabSpark * slabSpark);
  vec2 slabFoot = max(abs(dFdx(vStageWorld.xz)) + abs(dFdy(vStageWorld.xz)), vec2(0.02));
  vec2 slabAt = vStageWorld.xz / exp2(ceil(log2(slabFoot * ${f(SAND_LIT.speck)})));
  slabC *= mix(${f(SAND_LIT.grain[0]!)}, ${f(SAND_LIT.grain[1]!)}, slabHash(slabAt + 41.0));
  float slabL = dot(slabC, vec3(0.2126, 0.7152, 0.0722));
  float slabOver = max(slabL - ${f(SAND_LIT.knee)}, 0.0);
  slabC *= (min(slabL, ${f(SAND_LIT.knee)}) + ${f(SAND_LIT.top - SAND_LIT.knee)} * (1.0 - exp(-slabOver / ${f(SAND_LIT.top - SAND_LIT.knee)}))) / max(slabL, 1e-4);
  slabC = mix(slabC, vec3(dot(slabC, vec3(0.2126, 0.7152, 0.0722))), ${f(SAND_LIT.pale)} * smoothstep(${f(SAND_LIT.knee * 0.5)}, ${f(SAND_LIT.top)}, slabL));
  outgoingLight = slabC;
  slabCut = vSlab.x < 0.995 && vSlab.x < 0.04 + 0.94 * slabHash(slabAt);
}
#endif
`

// The heap is the stage's sand (base.ts) with the light and the edge of this file put in place of its own.
function slabSand(): THREE.Material {
  const m = sandMaterial(PART, 'surface-dressing', `${PART}-sand`)
  const inner = m.onBeforeCompile
  m.onBeforeCompile = (shader, renderer) => {
    inner.call(m, shader, renderer)
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aSlab;\nvarying vec2 vSlab;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvSlab = aSlab;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SLAB_PARS}`)
      .replace('#include <opaque_fragment>', `${SLAB_LIGHT}\n#include <opaque_fragment>`)
      .replace(/\}\s*$/, 'if (slabCut) discard;\n}')
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
