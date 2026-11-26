import * as THREE from 'three'
import type { KitMoment } from '../kit'
import * as arrivalPart from './arrival'
import { sandMaterial } from './base'
import * as glassPart from './glass'

const PART = 'surface-dressing-summer'

// Where the sand lies on the slab, in mm from the globe's axis (x to the right of the hero camera, z toward it), measured
// from the approved image: the mound the spill builds against the foot on the right (a cone under the stream on a low
// dune), its shoulder round the front of the foot, a tongue toward the camera, and a sheet behind the foot on the left.
// Everywhere else the table is bare.
const HEAP = {
  dune: { x: 67, z: 4, sx: 11, sz: 16, mm: 5.0 },
  cone: { x: 60.5, z: 1, mm: 10.5, run: 0.5, deep: 1.3 },
  skirt: { x: 72, z: 30, sx: 9, sz: 16, mm: 2.0 },
  shoulder: { x: 52, z: 55, sx: 15, sz: 11, mm: 2.0 },
  fan: { x: 50, z: 92, sx: 14, sz: 32, mm: 1.3 },
  sheet: { x: -92, z: -18, sx: 26, sz: 22, mm: 0.9 },
  edge: { mm: [0.3, 0.9], sharp: 1.0, looseMm: 0.25, cover: [0.1, 0.42] },
}
// The light on the sand of the table. The stage's lit material is made for the stone of the base; this takes its paint
// (every grain's own colour and tilt) and the stage's key, shadow, sky and card, and lights the sand as dry sand is lit
// by a low sun from behind: bright where a grain faces it, dark and cool in the shade, with no part burnt to white.
const LIT = { tilt: 0.75, sun: 1.0, face: [0.02, 0.62], back: 1.0, sky: 2.4, card: 0.22, glint: 0.9, shade: 0.5, knee: 0.5, top: 0.95, speck: 1.3, front: 0.08, frontZ: [8, 46], frontX: [96, 60] }
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
const bump = (x: number, z: number, g: { x: number; z: number; sx: number; sz: number; mm: number }): number => g.mm * Math.exp(-(((x - g.x) / g.sx) ** 2 + ((z - g.z) / g.sz) ** 2))

// The pile under the stream: a cone at the sand's angle of repose with its top against the foot, where the stream lands.
const cone = (x: number, z: number): number => Math.max(0, HEAP.cone.mm - HEAP.cone.run * Math.hypot(x - HEAP.cone.x, (z - HEAP.cone.z) / HEAP.cone.deep))

// What lies at a place before the heap's edge is drawn in: the heaps and the sheet, with their lumps.
function laid(x: number, z: number): number {
  const broad = noise(x / 23 + 3.1, z / 23 + 7.7, 11)
  const mid = noise(x / 7.3 + 1.7, z / 7.3 + 9.2, 13)
  const fine = noise(x / 2.1 + 5.3, z / 2.1 + 2.9, 17)
  const heap = (bump(x, z, HEAP.dune) + cone(x, z)) * (0.86 + 0.28 * broad) + bump(x, z, HEAP.skirt) * (0.5 + mid) + bump(x, z, HEAP.shoulder) * (0.6 + 0.8 * broad) + bump(x, z, HEAP.fan) * (0.35 + 1.3 * broad * mid)
  const sheet = bump(x, z, HEAP.sheet) * (0.5 + 1.1 * broad * mid)
  const lumps = (fine - 0.5) * 0.3 * Math.min(1, heap / 0.8) + (mid - 0.5) * 1.1 * Math.min(1, heap / 3)
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
    const shade = 0.14 + 0.86 * Math.min(1, Math.max(0, (r - 55.5) / 13))
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
  vec3 slabN = normalize(mix(nonPerturbedNormal, normal, ${f(LIT.tilt)}));
  vec3 slabUp = inverseTransformDirection(nonPerturbedNormal, viewMatrix);
  float slabNdl = dot(slabN, stageKeyL);
  float slabFace = smoothstep(${f(LIT.face[0]!)}, ${f(LIT.face[1]!)}, slabNdl);
  float slabBack = clamp(dot(-geometryViewDir, stageKeyL) * 0.5 + 0.5, 0.0, 1.0);
  float slabSun = stageKeyS * mix(${f(LIT.shade)}, 1.0, vSlab.y);
  slabSun *= mix(1.0, ${f(LIT.front)}, smoothstep(${f(LIT.frontZ[0]!)}, ${f(LIT.frontZ[1]!)}, vStageWorld.z) * smoothstep(${f(LIT.frontX[0]!)}, ${f(LIT.frontX[1]!)}, vStageWorld.x));
  vec3 slabIn = stageKeyC * (slabSun * slabFace * (${f(LIT.sun)} + ${f(LIT.back)} * slabBack * slabBack));
  slabIn += mix(uRigGround, uRigSky, 0.5 + 0.5 * slabUp.y) * (${f(LIT.sky)} * mix(0.45, 1.0, vSlab.y));
  slabIn += uRigCardCol * (${f(LIT.card)} * clamp(dot(slabN, normalize(mat3(viewMatrix) * uRigCardDir)) * 0.5 + 0.5, 0.0, 1.0) * mix(0.3, 1.0, vSlab.y));
  vec3 slabC = diffuseColor.rgb * RECIPROCAL_PI * slabIn;
  float slabHalf = max(dot(normal, normalize(stageKeyL + geometryViewDir)), 0.0);
  float slabSpark = slabHalf * slabHalf;
  slabSpark *= slabSpark;
  slabSpark *= slabSpark;
  slabSpark *= slabSpark;
  slabC += stageKeyC * (slabSun * ${f(LIT.glint)} * slabSpark * slabSpark);
  float slabL = dot(slabC, vec3(0.2126, 0.7152, 0.0722));
  float slabOver = max(slabL - ${f(LIT.knee)}, 0.0);
  slabC *= (min(slabL, ${f(LIT.knee)}) + ${f(LIT.top - LIT.knee)} * (1.0 - exp(-slabOver / ${f(LIT.top - LIT.knee)}))) / max(slabL, 1e-4);
  outgoingLight = slabC;
  float slabPx = max(min(length(dFdx(vStageWorld.xz)), length(dFdy(vStageWorld.xz))), 0.02);
  float slabCell = exp2(ceil(log2(slabPx * ${f(LIT.speck)})));
  slabCut = vSlab.x < 0.995 && vSlab.x < 0.04 + 0.94 * slabHash(vStageWorld.xz / slabCell);
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
