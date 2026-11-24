import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { rel } from '../../tools/lib/paths.mjs'
import { blurWrap, loadSource, luma, normalsOf, readPicture, seamless, toBytes, writePng } from './source.mjs'

const TAU = Math.PI * 2
const AROUND = 144
const MAP_PX = 2048
const PLATES = { across: 10, down: 6, tall: 0.6, crack: 0.09, dark: 0.14, sway: 0.1, hue: 0.72 }
const lerp = (a, b, t) => a + (b - a) * t

const [T] = await loadSource(['/src/miniature/trunk.ts'])
const S = T.trunkShape
const smooth = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
const hash = (n) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

const tubes = T.limbs.filter((l) => l.kind !== 'stem')
const tubeSolid = T.chainSolid(tubes.map((l) => ({ points: l.local, radii: l.radii })))
const stemSolid = T.chainSolid(T.limbs.filter((l) => l.kind === 'stem').map((l) => ({ points: l.local, radii: l.radii })))

function finish(pos, uv, col, index, rows, row) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  const n = g.getAttribute('normal')
  for (let k = 0; k < rows; k++) {
    const a = k * row
    const b = a + row - 1
    const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize()
    n.setXYZ(a, v.x, v.y, v.z)
    n.setXYZ(b, v.x, v.y, v.z)
  }
  return g
}

function column() {
  const hs = []
  for (let h = S.deep; h < S.fork + 1.4; h += 0.19) hs.push(h)
  for (let h = hs[hs.length - 1] + 0.8; h < S.top - 0.4; h += 0.85) hs.push(h)
  hs.push(S.top)
  const row = AROUND + 1
  const pos = []
  const uv = []
  const col = []
  const index = []
  let v = 0
  let last = null
  for (let k = 0; k < hs.length; k++) {
    const h = hs[k]
    const [ax, az] = T.trunkAxis(h)
    const mean = T.trunkRadius(1.1, h)
    if (last) v += Math.hypot(h - last.h, mean - last.mean)
    last = { h, mean }
    for (let j = 0; j <= AROUND; j++) {
      const phi = (j / AROUND) * TAU
      const r = T.trunkRadius(phi, h)
      const x = ax + Math.cos(phi) * r
      const z = az + Math.sin(phi) * r
      pos.push(x, h, z)
      uv.push(((phi + T.trunkTwist(h)) / TAU) * S.barkAround, v / S.barkMm)
      const ridge = T.trunkRidge(phi, h)
      const near = tubeSolid(x, h, z)
      const crotch = h > 4 ? smooth(-0.1, 1.3, near) : 1
      const low = 0.8 + 0.2 * smooth(-1, 5, h)
      const shade = (0.42 + 0.58 * Math.pow(smooth(0.05, 0.9, ridge), 1.4)) * (0.4 + 0.6 * crotch) * low
      const warm = 0.94 + 0.12 * hash(Math.round(((phi + T.trunkTwist(h)) / TAU) * 11) + 7)
      col.push(shade * warm, shade * (0.98 + 0.04 * hash(k * 0.37)), shade * (2 - warm) * 0.98)
    }
  }
  for (let k = 0; k < hs.length - 1; k++) {
    for (let j = 0; j < AROUND; j++) {
      const a = k * row + j
      const b = a + row
      index.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
  return finish(pos, uv, col, index, hs.length, row)
}

function tube(limb, n) {
  const sides = limb.kind === 'limb' ? 14 : limb.kind === 'root' ? 10 : 5
  const pts = limb.local.map((p) => new THREE.Vector3(p[0], p[1], p[2]))
  const count = pts.length
  const row = sides + 1
  const pos = []
  const uv = []
  const col = []
  const index = []
  const tangent = (i) => pts[Math.min(count - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize()
  let t = tangent(0)
  let nrm = new THREE.Vector3(1, 0, 0)
  if (Math.abs(t.x) > 0.9) nrm.set(0, 0, 1)
  nrm.sub(t.clone().multiplyScalar(nrm.dot(t))).normalize()
  let along = hash(n * 3.1) * 4
  const tint = 0.9 + 0.2 * hash(n * 1.7 + 2)
  const flutes = limb.kind === 'twig' ? 0 : 5
  for (let i = 0; i <= count; i++) {
    const k = Math.min(i, count - 1)
    const tk = tangent(k)
    nrm.sub(tk.clone().multiplyScalar(nrm.dot(tk))).normalize()
    t = tk
    const bin = new THREE.Vector3().crossVectors(t, nrm)
    if (i > 0 && i < count) along += pts[k].distanceTo(pts[k - 1])
    const r = i === count ? 0.03 : limb.radii[k] * (1 + 0.1 * Math.sin(along * 1.9 + n))
    const c = pts[k].clone()
    if (i === count) c.add(t.clone().multiplyScalar(0.15))
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * TAU
      const plate = Math.sin(along * 1.15 + 2.2 * Math.sin(2 * a + n) + 1.1 * Math.sin(5 * a + 0.7 * along))
      const ridge = flutes ? Math.pow(Math.abs(Math.sin(flutes * 0.5 * a + along * 0.12 + n)), 0.6) * (0.5 + 0.5 * (1 - Math.exp(-(plate * plate) / 0.12))) : 0.7
      const rr = r * (1 + 0.12 * (ridge - 0.66))
      const p = c.clone().add(nrm.clone().multiplyScalar(Math.cos(a) * rr)).add(bin.clone().multiplyScalar(Math.sin(a) * rr))
      pos.push(p.x, p.y, p.z)
      uv.push(j / sides + n * 0.37, along / S.barkMm)
      const stem = limb.kind === 'twig' ? 1 : smooth(-0.3, 1.1, stemSolid(p.x, p.y, p.z))
      const shade = (0.5 + 0.5 * Math.pow(smooth(0.1, 0.8, ridge), 1.3)) * (0.4 + 0.6 * stem) * tint * (limb.kind === 'twig' ? 0.8 : 1)
      col.push(shade, shade * 0.99, shade * 0.97)
    }
  }
  for (let i = 0; i < count; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * row + j
      const b = a + row
      index.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  return finish(pos, uv, col, index, count + 1, row)
}

async function barkMaps() {
  const src = await readPicture(rel('assets-src', 'trunk', 'bark-take1.png'), MAP_PX)
  const img = seamless(src, 0.1)
  const { w, h } = img
  const l = luma(img)
  const wide = blurWrap(l, w, h, Math.round(w / 14))
  const colour = new Float32Array(img.px.length)
  const height = new Float32Array(w * h)
  const seeds = []
  for (let cy = 0; cy < PLATES.down; cy++) for (let cx = 0; cx < PLATES.across; cx++) seeds.push([cx + 0.15 + 0.7 * hash(cx * 7.3 + cy * 13.1 + 1), cy + 0.15 + 0.7 * hash(cx * 3.7 + cy * 5.9 + 2), hash(cx * 11.7 + cy * 2.3 + 3)])
  for (let i = 0; i < w * h; i++) {
    const grain = l[i] / Math.max(wide[i], 0.05)
    const px = (((i % w) / w) * PLATES.across + PLATES.sway * (grain - 1) + PLATES.across) % PLATES.across
    const py = (Math.floor(i / w) / h) * PLATES.down
    const cx = Math.floor(px)
    const cy = Math.floor(py)
    let f1 = 9
    let f2 = 9
    let tone = 0
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const sx = (((cx + ox) % PLATES.across) + PLATES.across) % PLATES.across
        const sy = (((cy + oy) % PLATES.down) + PLATES.down) % PLATES.down
        const seed = seeds[sy * PLATES.across + sx]
        const d = Math.hypot(seed[0] - sx + cx + ox - px, (seed[1] - sy + cy + oy - py) * PLATES.tall)
        if (d < f1) {
          f2 = f1
          f1 = d
          tone = seed[2]
        } else if (d < f2) f2 = d
      }
    }
    const whole = smooth(0.02, PLATES.crack, f2 - f1)
    const flat = 0.3 / Math.max(wide[i], 0.05)
    const k = (0.55 + 0.45 * flat) * Math.pow(grain, 0.2) * (PLATES.dark + (1 - PLATES.dark) * whole) * (0.84 + 0.3 * tone)
    const r = Math.pow(img.px[i * 3] * k, 0.92) * 1.16
    const g = Math.pow(img.px[i * 3 + 1] * k, 0.92) * 1.02
    const b = Math.pow(img.px[i * 3 + 2] * k, 0.92) * 0.9
    const grey = 0.3 * r + 0.6 * g + 0.1 * b
    colour[i * 3] = lerp(grey, r, PLATES.hue + 0.2 * tone)
    colour[i * 3 + 1] = lerp(grey, g, PLATES.hue + 0.2 * tone)
    colour[i * 3 + 2] = lerp(grey, b, PLATES.hue + 0.2 * tone)
    height[i] = 0.45 * grain + 0.9 * whole + 0.3 * tone
  }
  const soft = blurWrap(height, w, h, 2)
  const fine = blurWrap(height, w, h, 1)
  for (let i = 0; i < w * h; i++) height[i] = 0.7 * soft[i] + 0.3 * fine[i]
  await writePng(rel('assets-full', 'shared', 'trunk-bark.srgb.tile.w1024.png'), toBytes(colour), w, h, 3, MAP_PX)
  await writePng(rel('assets-full', 'shared', 'trunk-bark-n.lin.tile.w1024.png'), normalsOf(height, w, h, 5.5), w, h, 3, MAP_PX)
}

const parts = [column(), ...tubes.map((l, i) => tube(l, i + 1))]
const merged = mergeGeometries(parts)
const triangles = merged.index.count / 3
writeGlb(rel('assets-full', 'shared', 'trunk-wood.glb'), [fromThree('trunk', merged, { triangles })])
await barkMaps()
const at = merged.getAttribute('position')
let out = 0
let close = 0
for (let i = 0; i < at.count; i++) {
  const q = T.placePoint([at.getX(i), at.getY(i), at.getZ(i)])
  const d = T.trunkSolid(q[0], q[1], q[2])
  out = Math.max(out, d)
  if (d > -0.5) close++
}
console.log(`trunk: ${triangles} triangles in ${parts.length} pieces (${T.limbs.length} chains), bark maps ${MAP_PX} px; no vertex lies more than ${out.toFixed(2)} mm outside the solid, ${((100 * close) / at.count).toFixed(1)}% lie on it or less than 0.5 mm under it`)
