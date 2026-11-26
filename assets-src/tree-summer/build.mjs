import fs from 'node:fs'
import * as THREE from 'three'
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { readGlb, writeGlb as packedGlb } from '../../tools/lib/glbpack.mjs'
import { rel } from '../../tools/lib/paths.mjs'
import { blurWrap, loadSource, luma, readPicture, seamless, toBytes, writePng } from '../trunk/source.mjs'

const TAU = Math.PI * 2
const LEAF_CELL = 0.85
const LEVEL_SPRIGS = { medium: 0.45, low: 0.3 }
const LEAF_TILE_MM = 11
const SPRIGS = { share: 0.8, size: [1.8, 3.1], rise: 0.35, out: 0.34 }
const TONE = { deep: [0.22, 0.5, 0.34], mid: [0.4, 0.76, 0.46], tip: [1.6, 1.15, 0.4] }
// Only the top of a pad, with open air over it, takes the light. Its sides and its underside are in deep shade.
const SHADE = { body: 0.04, clearMm: 2.4, upFrom: 0.2, upTo: 0.85, tight: 1.25 }
const PAPER = { orange: [1, 0.3, 0.045], peach: [1, 0.38, 0.06], cream: [1, 0.62, 0.12] }
const CAP = [0.035, 0.028, 0.022]
const WIRE = [0.05, 0.04, 0.03]

const [T, R, C, LN] = await loadSource(['/src/miniature/trunk.ts', '/src/core/rng.ts', '/src/seasons/summer/mini/crown.ts', '/src/seasons/summer/mini/lanterns.ts'])
const rng = R.stream('tree-summer')
const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const leafField = C.leafField

const gradient = (f, x, h, z, e = 0.08) => {
  const g = new THREE.Vector3(f(x + e, h, z) - f(x - e, h, z), f(x, h + e, z) - f(x, h - e, z), f(x, h, z + e) - f(x, h, z - e))
  return g.lengthSq() > 0 ? g.normalize() : g.set(0, 1, 0)
}

const CORNER = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
const EDGE = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]

function surface(field, box, cell, hidden) {
  const nx = Math.ceil((box[3] - box[0]) / cell) + 1
  const ny = Math.ceil((box[4] - box[1]) / cell) + 1
  const nz = Math.ceil((box[5] - box[2]) / cell) + 1
  const val = new Float32Array(nx * ny * nz)
  let o = 0
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) val[o++] = field(box[0] + i * cell, box[1] + j * cell, box[2] + k * cell)
  const at = (i, j, k) => i + nx * (j + ny * k)
  const made = new Map()
  const pos = []
  const tris = []
  const vert = (i, j, k, e) => {
    const ca = CORNER[EDGE[e][0]]
    const cb = CORNER[EDGE[e][1]]
    const ia = at(i + ca[0], j + ca[1], k + ca[2])
    const ib = at(i + cb[0], j + cb[1], k + cb[2])
    const lo = Math.min(ia, ib)
    const span = Math.abs(ia - ib)
    const key = lo * 4 + (span === 1 ? 0 : span === nx ? 1 : 2)
    let v = made.get(key)
    if (v === undefined) {
      const t = val[ia] / (val[ia] - val[ib])
      v = pos.length / 3
      pos.push(box[0] + (i + ca[0] + (cb[0] - ca[0]) * t) * cell, box[1] + (j + ca[1] + (cb[1] - ca[1]) * t) * cell, box[2] + (k + ca[2] + (cb[2] - ca[2]) * t) * cell)
      made.set(key, v)
    }
    return v
  }
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let c = 0
        for (let n = 0; n < 8; n++) if (val[at(i + CORNER[n][0], j + CORNER[n][1], k + CORNER[n][2])] < 0) c |= 1 << n
        if (!edgeTable[c]) continue
        for (let t = c * 16; triTable[t] !== -1; t += 3) tris.push(vert(i, j, k, triTable[t]), vert(i, j, k, triTable[t + 1]), vert(i, j, k, triTable[t + 2]))
      }
    }
  }
  const count = pos.length / 3
  const nor = new Float32Array(count * 3)
  const buried = new Uint8Array(count)
  for (let v = 0; v < count; v++) {
    const g = gradient(field, pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])
    nor.set([g.x, g.y, g.z], v * 3)
    buried[v] = hidden(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]) < -0.25 ? 1 : 0
  }
  const remap = new Int32Array(count).fill(-1)
  const outPos = []
  const outNor = []
  const index = []
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const use = (v) => {
    if (remap[v] < 0) {
      remap[v] = outPos.length / 3
      outPos.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])
      outNor.push(nor[v * 3], nor[v * 3 + 1], nor[v * 3 + 2])
    }
    return remap[v]
  }
  for (let t = 0; t < tris.length; t += 3) {
    const i0 = tris[t]
    const i1 = tris[t + 1]
    const i2 = tris[t + 2]
    if (i0 === i1 || i1 === i2 || i0 === i2) continue
    if (buried[i0] && buried[i1] && buried[i2]) continue
    a.fromArray(pos, i0 * 3)
    b.fromArray(pos, i1 * 3).sub(a)
    c.fromArray(pos, i2 * 3).sub(a)
    b.cross(c)
    const facing = b.x * (nor[i0 * 3] + nor[i1 * 3] + nor[i2 * 3]) + b.y * (nor[i0 * 3 + 1] + nor[i1 * 3 + 1] + nor[i2 * 3 + 1]) + b.z * (nor[i0 * 3 + 2] + nor[i1 * 3 + 2] + nor[i2 * 3 + 2])
    if (facing >= 0) index.push(use(i0), use(i1), use(i2))
    else index.push(use(i0), use(i2), use(i1))
  }
  return { pos: outPos, nor: outNor, index }
}

function frames(points) {
  const pts = points.map((q) => new THREE.Vector3(q[0], q[1], q[2]))
  const out = []
  let nrm = new THREE.Vector3(0, 0, 1)
  let along = 0
  for (let i = 0; i < pts.length; i++) {
    const tan = pts[Math.min(pts.length - 1, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize()
    nrm = nrm.clone().sub(tan.clone().multiplyScalar(nrm.dot(tan)))
    if (nrm.lengthSq() < 1e-6) nrm.set(1, 0, 0).sub(tan.clone().multiplyScalar(tan.x))
    nrm.normalize()
    if (i > 0) along += pts[i].distanceTo(pts[i - 1])
    out.push({ p: pts[i], tan, nrm: nrm.clone(), bin: new THREE.Vector3().crossVectors(tan, nrm), along })
  }
  return out
}

function rod(points, radii, sides = 6) {
  const f = frames(points.map((p) => [p.x, p.y, p.z]))
  const pos = []
  const index = []
  for (let i = 0; i < f.length; i++) {
    for (let j = 0; j < sides; j++) {
      const a = (j / sides) * TAU
      const p = f[i].p.clone().addScaledVector(f[i].nrm, Math.cos(a) * radii[i]).addScaledVector(f[i].bin, Math.sin(a) * radii[i])
      pos.push(p.x, p.y, p.z)
    }
  }
  for (let i = 0; i < f.length - 1; i++) {
    for (let j = 0; j < sides; j++) {
      const a = i * sides + j
      const b = i * sides + ((j + 1) % sides)
      index.push(a, b, a + sides, b, b + sides, a + sides)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}


function crownBox(margin) {
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  const take = (p, r) => {
    for (let j = 0; j < 3; j++) {
      box[j] = Math.min(box[j], p[j] - r - margin)
      box[j + 3] = Math.max(box[j + 3], p[j] + r + margin)
    }
  }
  for (const c of T.clusters) take(c.local, c.radius)
  for (let o = 0; o < C.lumps.length; o += 4) take([C.lumps[o], C.lumps[o + 1], C.lumps[o + 2]], C.lumps[o + 3])
  return box
}

const openness = (f, x, h, z, n, reach) => clamp01(f(x + n[0] * reach, h + n[1] * reach, z + n[2] * reach) / reach)

function leaves() {
  const s = surface(leafField, crownBox(1.4), LEAF_CELL, () => 1)
  const count = s.pos.length / 3
  const uv = []
  const col = []
  const flag = []
  const shadeAt = (v) => {
    const x = s.pos[v * 3]
    const h = s.pos[v * 3 + 1]
    const z = s.pos[v * 3 + 2]
    const n = [s.nor[v * 3], s.nor[v * 3 + 1], s.nor[v * 3 + 2]]
    const open = 0.45 * openness(C.leafBody, x, h, z, n, 0.7) + 0.55 * openness(C.leafBody, x, h, z, n, 2.4)
    const top = smooth(SHADE.upFrom, SHADE.upTo, n[1]) * Math.pow(openness(C.leafBody, x, h, z, [0, 1, 0], SHADE.clearMm), SHADE.tight)
    const shade = (0.1 + 0.9 * Math.pow(open, 1.7)) * (SHADE.body + (1 - SHADE.body) * top)
    const hue = 0.5 + 0.5 * Math.sin(0.7 * x + 1.3 * h + 0.9 * z) * Math.sin(1.1 * x - 0.6 * z + 2)
    const tip = top * (0.6 + 0.4 * hue)
    const base = [lerp(TONE.deep[0], TONE.mid[0], hue), lerp(TONE.deep[1], TONE.mid[1], hue), lerp(TONE.deep[2], TONE.mid[2], hue)]
    return [shade * lerp(base[0], TONE.tip[0], tip), shade * lerp(base[1], TONE.tip[1], tip), shade * lerp(base[2], TONE.tip[2], tip)]
  }
  for (let v = 0; v < count; v++) {
    uv.push(s.pos[v * 3] / LEAF_TILE_MM, s.pos[v * 3 + 1] / LEAF_TILE_MM)
    col.push(...shadeAt(v))
    flag.push(0, 0)
  }
  const pos = [...s.pos]
  const nor = [...s.nor]
  const index = [...s.index]
  let tufts = 0
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  const t = new THREE.Vector3()
  const b = new THREE.Vector3()
  const plant = (v, size) => {
    p.fromArray(s.pos, v * 3)
    n.fromArray(s.nor, v * 3)
    t.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1))
    t.sub(n.clone().multiplyScalar(t.dot(n)))
    if (t.lengthSq() < 1e-4) return
    t.normalize()
    b.crossVectors(n, t)
    const lean = n.clone().addScaledVector(t, rng.range(-0.5, 0.5)).addScaledVector(b, rng.range(-0.5, 0.5))
    lean.y += SPRIGS.rise
    lean.normalize()
    const centre = p.clone().addScaledVector(lean, size * SPRIGS.out)
    const cell = rng.int(4)
    const u0 = (cell % 2) * 0.5
    const v0 = Math.floor(cell / 2) * 0.5
    const c = shadeAt(v).map((k) => Math.min(1.6, k * 1.12 + 0.02))
    const id = rng.int(64)
    for (const across of [t, b]) {
      const base = pos.length / 3
      const flip = rng.sign()
      for (const [du, dv] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
        const q = centre.clone().addScaledVector(across, du * size * flip).addScaledVector(lean, dv * size)
        pos.push(q.x, q.y, q.z)
        const m = n.clone().addScaledVector(lean, 0.4 + dv).normalize()
        nor.push(m.x, m.y, m.z)
        uv.push(u0 + (du + 0.5) * 0.5, v0 + (dv + 0.5) * 0.5)
        const lift = 0.4 + 1.1 * (dv + 0.5)
        col.push(c[0] * lift, c[1] * lift, c[2] * lift)
        flag.push(1, id)
      }
      index.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
    tufts++
  }
  for (let v = 0; v < count; v++) if (rng.next() <= SPRIGS.share) plant(v, rng.range(SPRIGS.size[0], SPRIGS.size[1]))
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('uv1', new THREE.Float32BufferAttribute(flag, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(index)
  return { g, tufts, surface: s.index.length }
}

function dress(g, colour, pivot, phase, order, kind) {
  const src = g.index ? g.toNonIndexed() : g
  const P = src.getAttribute('position')
  const n = P.count
  const col = new Float32Array(n * 4)
  const tan = new Float32Array(n * 4)
  const uv = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const c = typeof colour === 'function' ? colour(P.getX(i), P.getY(i), P.getZ(i)) : colour
    col.set(c, i * 4)
    const pv = pivot ?? [P.getX(i), P.getY(i), P.getZ(i)]
    tan.set([pv[0], pv[1], pv[2], phase], i * 4)
    uv.set([order, kind], i * 2)
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', P)
  out.setAttribute('normal', src.getAttribute('normal'))
  out.setAttribute('color', new THREE.BufferAttribute(col, 4))
  out.setAttribute('tangent', new THREE.BufferAttribute(tan, 4))
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return out
}

function lanternBody(l) {
  const S = LN.SHAPE
  const lat = 12
  const lon = S.gores * 3
  const pos = []
  const index = []
  const half = l.tall / 2
  for (let j = 0; j <= lat; j++) {
    const v = j / lat
    const th = lerp(0.3, Math.PI - 0.3, v)
    const ring = Math.sin(th)
    const y = Math.cos(th) * half
    for (let i = 0; i <= lon; i++) {
      const phi = (i / lon) * TAU
      const groove = 1 - S.groove * Math.pow(Math.abs(Math.cos((phi * S.gores) / 2)), 6) * ring
      const r = l.radius * ring * groove
      pos.push(l.at[0] + Math.cos(phi) * r, l.at[1] + y, l.at[2] + Math.sin(phi) * r)
    }
  }
  for (let j = 0; j < lat; j++) {
    for (let i = 0; i < lon; i++) {
      const a = j * (lon + 1) + i
      const b = a + lon + 1
      index.push(a, a + 1, b, a + 1, b + 1, b)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  const tone = PAPER[l.tone]
  const paint = (x, y, z) => {
    const phi = Math.atan2(z - l.at[2], x - l.at[0])
    const rib = 1 - 0.38 * Math.pow(Math.abs(Math.cos((phi * LN.SHAPE.gores) / 2)), 10)
    const up = (y - l.at[1]) / half
    const band = 1 - 0.3 * smooth(0.6, 1, Math.abs(up))
    const low = 1 + 0.18 * smooth(0.2, -0.7, up)
    const k = rib * band * low
    return [tone[0] * k, tone[1] * k * (0.9 + 0.1 * low), tone[2] * k, 1]
  }
  return dress(g, paint, l.hang, l.phase, l.order, 1)
}

function lanternParts(l) {
  const S = LN.SHAPE
  const out = [lanternBody(l)]
  const half = l.tall / 2
  const capR = l.radius * S.cap
  const capH = l.radius * S.capTall
  const top = new THREE.CylinderGeometry(capR * 0.82, capR, capH, 16, 1)
  top.translate(l.at[0], l.at[1] + half * Math.cos(0.3) + capH * 0.42, l.at[2])
  const bottom = new THREE.CylinderGeometry(capR * S.ring / S.cap * 1.1, capR * 0.75, capH * 0.6, 16, 1)
  bottom.translate(l.at[0], l.at[1] - half * Math.cos(0.3) - capH * 0.22, l.at[2])
  const loop = new THREE.TorusGeometry(capR * 0.55, LN.STRING.cordMm * 1.2, 5, 12)
  loop.translate(l.at[0], l.at[1] + half * Math.cos(0.3) + capH * 0.95, l.at[2])
  const cord = rod([new THREE.Vector3(...l.hang), new THREE.Vector3(l.hang[0], (l.hang[1] + l.at[1] + half) / 2, l.hang[2]), new THREE.Vector3(l.at[0], l.at[1] + half * Math.cos(0.3) + capH, l.at[2])], [LN.STRING.cordMm, LN.STRING.cordMm, LN.STRING.cordMm], 5)
  for (const g of [top, bottom, loop]) {
    g.deleteAttribute('uv')
    out.push(dress(g, [...CAP, 0], l.hang, l.phase, l.order, 0))
  }
  out.push(dress(cord, [...WIRE, 0], l.hang, l.phase, l.order, 0))
  if (l.arm) out.push(dress(rod([new THREE.Vector3(...l.arm), new THREE.Vector3((l.arm[0] + l.hang[0]) / 2, (l.arm[1] + l.hang[1]) / 2 + 0.25, (l.arm[2] + l.hang[2]) / 2), new THREE.Vector3(...l.hang)], [0.2, 0.15, 0.1], 6), [...WIRE, 0], null, 0, 0, 0))
  return out
}

function lanternMesh() {
  const parts = []
  for (const l of LN.lanterns) parts.push(...lanternParts(l))
  const line = []
  for (let i = 0; i <= LN.STRING.steps; i++) line.push(new THREE.Vector3(...LN.stringAt(i / LN.STRING.steps)))
  parts.push(dress(rod(line, line.map(() => LN.STRING.wireMm), 5), [...WIRE, 0], null, 0, 0, 0))
  return mergeVertices(mergeGeometries(parts), 1e-4)
}

async function leafMaps() {
  const src = await readPicture(rel('assets-src', 'tree-summer', 'gen', 'leaves-take1.png'), 2048)
  const img = seamless(src, 0.1)
  const { w, h } = img
  const l = luma(img)
  const wide = blurWrap(l, w, h, Math.round(w / 10))
  let mean = 0
  for (let i = 0; i < w * h; i++) mean += l[i] / (w * h)
  const colour = new Float32Array(img.px.length)
  for (let i = 0; i < w * h; i++) {
    const k = 0.5 + 0.5 * (mean / Math.max(wide[i], 0.03))
    for (let c = 0; c < 3; c++) colour[i * 3 + c] = img.px[i * 3 + c] * k
  }
  await writePng(rel('assets-full', 'summer', 'tree-leaves.srgb.tile.w1024.png'), toBytes(colour), w, h, 3, 2048)

  const fine = blurWrap(l, w, h, 7)
  const cell = 512
  const atlas = Buffer.alloc(cell * 2 * cell * 2 * 4)
  for (let s = 0; s < 4; s++) {
    const ox = Math.floor(rng.range(0, w - cell))
    const oy = Math.floor(rng.range(0, h - cell))
    const lobes = 3 + rng.int(4)
    const turn = rng.range(0, TAU)
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const i = (oy + y) * w + ox + x
        const dx = (x + 0.5) / cell - 0.5
        const dy = (y + 0.5) / cell - 0.5
        const ang = Math.atan2(dy, dx)
        const d = (2 * Math.hypot(dx, dy)) / (0.74 + 0.14 * Math.sin(lobes * ang + turn) + 0.08 * Math.sin((2 * lobes + 1) * ang + 2 * turn))
        const a = clamp01((0.92 - d) * 3 + (l[i] - fine[i]) * 14)
        const o = (((s >> 1) * cell + y) * cell * 2 + (s & 1) * cell + x) * 4
        atlas[o] = Math.round(clamp01(colour[i * 3]) * 255)
        atlas[o + 1] = Math.round(clamp01(colour[i * 3 + 1]) * 255)
        atlas[o + 2] = Math.round(clamp01(colour[i * 3 + 2]) * 255)
        atlas[o + 3] = Math.round(a * 255)
      }
    }
  }
  await writePng(rel('assets-full', 'summer', 'tree-sprigs.srgb.w512.png'), atlas, cell * 2, cell * 2, 4)
}

const N = leaves()
const LM = lanternMesh()
const tri = (g) => (g.index ? g.index.count : g.getAttribute('position').count) / 3
const counts = { leaves: tri(N.g), lanterns: tri(LM) }
const SNAP = { position: 128, normal: 32 }
function snap(mesh) {
  for (const k of Object.keys(SNAP)) for (let i = 0; i < mesh[k].length; i++) mesh[k][i] = Math.round(mesh[k][i] * SNAP[k]) / SNAP[k]
  return mesh
}
writeGlb(rel('assets-full', 'summer', 'tree-summer.glb'), [snap(fromThree('leaves', N.g, { triangles: counts.leaves, tufts: N.tufts, tileMm: LEAF_TILE_MM })), snap(fromThree('lanterns', LM, { triangles: counts.lanterns, count: LN.lanterns.length }))])

// Lighter list for the lower quality levels of the live page (src/core/models.ts reads `extras.levels`, and
// tools/lib/glblevels.mjs leaves a mesh alone that names its own). The simplifier cannot thin leaf cards, so the crown names
// its own list: the whole leaf surface and an even share of the sprigs that stand on it.
function addLists(file, lists) {
  const { json, bin } = readGlb(fs.readFileSync(file))
  const parts = [bin]
  let length = bin.length
  for (const mesh of json.meshes) {
    const want = lists[mesh.name]
    if (!want) continue
    const prim = mesh.primitives[0]
    const type = json.accessors[prim.indices].componentType
    const levels = {}
    for (const [level, list] of Object.entries(want)) {
      const data = type === 5123 ? Uint16Array.from(list) : Uint32Array.from(list)
      const padding = (4 - (length % 4)) % 4
      if (padding) parts.push(Buffer.alloc(padding))
      length += padding
      json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.byteLength })
      json.accessors.push({ bufferView: json.bufferViews.length - 1, componentType: type, count: data.length, type: 'SCALAR' })
      parts.push(Buffer.from(data.buffer, data.byteOffset, data.byteLength))
      length += data.byteLength
      levels[level] = json.accessors.length - 1
    }
    prim.extras = { ...(prim.extras ?? {}), levels }
  }
  json.buffers[0].byteLength = length
  fs.writeFileSync(file, packedGlb(json, Buffer.concat(parts, length)))
}
const leafMedium = []
const leafLow = []
{
  const I = N.g.index.array
  for (let i = 0; i < N.surface; i++) {
    leafMedium.push(I[i])
    leafLow.push(I[i])
  }
  for (let i = N.surface, k = 0; i < I.length; i += 12, k++) {
    const u = (k * 0.6180339887) % 1
    if (u < LEVEL_SPRIGS.medium) for (let j = 0; j < 12; j++) leafMedium.push(I[i + j])
    if (u < LEVEL_SPRIGS.low) for (let j = 0; j < 12; j++) leafLow.push(I[i + j])
  }
}
addLists(rel('assets-full', 'summer', 'tree-summer.glb'), { leaves: { medium: leafMedium, low: leafLow } })
await leafMaps()
console.log(`tree-summer: leaves ${counts.leaves} triangles (${N.tufts} tufts, ${leafMedium.length / 3} triangles at medium, ${leafLow.length / 3} at low), lanterns ${counts.lanterns} (${LN.lanterns.length} lanterns); ${C.lumps.length / 4} lumps on ${T.localPads.length} pads`)
