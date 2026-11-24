import * as THREE from 'three'
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fromThree, writeGlb } from '../../tools/lib/glb.mjs'
import { rel } from '../../tools/lib/paths.mjs'
import { blurWrap, loadSource, luma, readPicture, seamless, toBytes, writePng } from '../trunk/source.mjs'

const TAU = Math.PI * 2
const NEEDLE_CELL = 0.62
const SNOW_CELL = 0.45
const NEEDLE_TILE_MM = 9
const SNOW_TILE_MM = 7
const STAR_AT = [0.25, 45.2, 0.1]
const STAR_R = 2.2
const STAR = { deep: 0.62, edge: 0.17, inset: 0.9, valley: 0.72, crest: 1.12, glow: [0.07, 0.035, 0.02], stem: [0.2, 0.11], collar: 0.27 }
const CORE_R = 0.155
const WIRE_R = 0.075
const SNOW_KEY = [-0.42, 0.819, 0.39]
const BULBS = { stem: [2.3, 3.4], limb: [2.2, 3.3], lead: 0.16, pad: 0.32, clear: 0.3 }

const [T, R] = await loadSource(['/src/miniature/trunk.ts', '/src/core/rng.ts'])
const rng = R.stream('tree-winter')
const lerp = (a, b, t) => a + (b - a) * t
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const smooth = (a, b, v) => {
  const t = clamp01((v - a) / (b - a))
  return t * t * (3 - 2 * t)
}

const needleField = T.crownField
const snowField = T.crownCap

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

function crownBox(margin) {
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  for (const c of T.clusters) {
    for (let j = 0; j < 3; j++) {
      box[j] = Math.min(box[j], c.local[j] - c.radius - margin)
      box[j + 3] = Math.max(box[j + 3], c.local[j] + c.radius + margin)
    }
  }
  return box
}

const openness = (f, x, h, z, n, reach) => clamp01(f(x + n[0] * reach, h + n[1] * reach, z + n[2] * reach) / reach)

function needles() {
  const s = surface(needleField, crownBox(1.2), NEEDLE_CELL, snowField)
  const count = s.pos.length / 3
  const uv = []
  const col = []
  const flag = []
  const shadeAt = (v) => {
    const x = s.pos[v * 3]
    const h = s.pos[v * 3 + 1]
    const z = s.pos[v * 3 + 2]
    const n = [s.nor[v * 3], s.nor[v * 3 + 1], s.nor[v * 3 + 2]]
    const open = 0.6 * openness(needleField, x, h, z, n, 0.7) + 0.4 * openness(needleField, x, h, z, n, 1.8)
    const roof = smooth(0.1, 1.4, snowField(x, h + 0.9, z))
    const sky = 0.5 + 0.5 * n[1]
    const shade = (0.4 + 0.6 * open) * (0.35 + 0.65 * Math.pow(sky, 1.5)) * (0.65 + 0.35 * roof)
    const hue = 0.5 + 0.5 * Math.sin(0.7 * x + 1.3 * h + 0.9 * z) * Math.sin(1.1 * x - 0.6 * z + 2)
    return [shade * (0.72 + 0.2 * hue), shade * (1 + 0.04 * hue), shade * (1 - 0.14 * hue)]
  }
  for (let v = 0; v < count; v++) {
    uv.push(s.pos[v * 3] / NEEDLE_TILE_MM, s.pos[v * 3 + 1] / NEEDLE_TILE_MM)
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
  for (let v = 0; v < count; v++) {
    if (rng.next() > 0.25) continue
    p.fromArray(s.pos, v * 3)
    n.fromArray(s.nor, v * 3)
    if (snowField(p.x, p.y, p.z) < 0.25) continue
    const size = rng.range(0.9, 1.7)
    t.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1))
    t.sub(n.clone().multiplyScalar(t.dot(n)))
    if (t.lengthSq() < 1e-4) continue
    t.normalize()
    b.crossVectors(n, t)
    const lean = n.clone().addScaledVector(t, rng.range(-0.35, 0.35)).addScaledVector(b, rng.range(-0.35, 0.35)).normalize()
    const centre = p.clone().addScaledVector(lean, size * 0.3)
    const cell = rng.int(4)
    const u0 = (cell % 2) * 0.5
    const v0 = Math.floor(cell / 2) * 0.5
    const c = shadeAt(v).map((k) => Math.min(1, k * 1.05 + 0.02))
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
        const lift = 0.85 + 0.3 * (dv + 0.5)
        col.push(c[0] * lift, c[1] * lift, c[2] * lift)
        flag.push(1, id)
      }
      index.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
    tufts++
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('uv1', new THREE.Float32BufferAttribute(flag, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(index)
  return { g, tufts }
}

function snow() {
  const s = surface(snowField, crownBox(2.6), SNOW_CELL, needleField)
  const count = s.pos.length / 3
  const uv = []
  const thin = []
  const col = []
  for (let v = 0; v < count; v++) {
    const x = s.pos[v * 3]
    const h = s.pos[v * 3 + 1]
    const z = s.pos[v * 3 + 2]
    const n = [s.nor[v * 3], s.nor[v * 3 + 1], s.nor[v * 3 + 2]]
    const both = (a, bb, c) => Math.min(snowField(a, bb, c), needleField(a, bb, c))
    const open = 0.45 * openness(both, x, h, z, n, 0.6) + 0.55 * openness(both, x, h, z, n, 1.8)
    const lit = 0.5 + 0.5 * (n[0] * SNOW_KEY[0] + n[1] * SNOW_KEY[1] + n[2] * SNOW_KEY[2])
    const deep = needleField(x, h, z)
    const shade = (0.4 + 0.6 * Math.pow(open, 1.3)) * (0.36 + 0.78 * Math.pow(lit, 4)) * (0.6 + 0.4 * smooth(0.1, 1.7, deep))
    const cool = 1 - lit * lit
    uv.push(x / SNOW_TILE_MM, h / SNOW_TILE_MM)
    thin.push(deep, 0)
    col.push(shade * (1 - 0.34 * cool), shade * (1 - 0.2 * cool), shade)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(s.nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('uv1', new THREE.Float32BufferAttribute(thin, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(s.index)
  return g
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

function strings() {
  const bulbs = []
  const wires = []
  const tubes = T.chainSolid(T.limbs.filter((l) => l.kind !== 'stem').map((l) => ({ points: l.local, radii: l.radii })))
  const wood = T.chainSolid(T.limbs.map((l) => ({ points: l.local, radii: l.radii })))
  const drop = (at, out, group) => bulbs.push({ at: at.clone(), out: out.clone().normalize(), phase: rng.int(64) / 64, warm: rng.next(), size: rng.range(0.86, 1.16), group })
  const free = (p) => needleField(p.x, p.y, p.z) > BULBS.clear && snowField(p.x, p.y, p.z) > BULBS.clear

  const helix = []
  const h0 = 12.3
  const h1 = 30.4
  const turns = 2.35
  let last = null
  let run = 0
  let next = 0.5
  for (let h = h0; h <= h1; h += 0.04) {
    const phi = 1.75 + (TAU * turns * (h - h0)) / (h1 - h0) + 0.25 * Math.sin(1.3 * h)
    const [ax, az] = T.trunkAxis(h)
    const r = T.trunkRadius(phi, h)
    const out = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi))
    const p = new THREE.Vector3(ax + out.x * (r + 0.07), h, az + out.z * (r + 0.07))
    if (last) run += p.distanceTo(last)
    if (!last || p.distanceTo(helix[helix.length - 1]) > 0.6) helix.push(p)
    last = p
    const at = p.clone().addScaledVector(out, 0.17)
    if (run >= next && tubes(at.x, at.y, at.z) > 0.3 && free(at)) {
      drop(at, out, 'stem')
      next = run + rng.range(BULBS.stem[0], BULBS.stem[1])
    }
  }
  wires.push(helix)

  for (const limb of T.limbs) {
    if (limb.kind !== 'limb') continue
    const f = frames(limb.local)
    const total = f[f.length - 1].along
    const spin = rng.range(0, TAU)
    const wire = []
    let mark = total * BULBS.lead + rng.range(0, 1.2)
    for (let i = 1; i < f.length; i++) {
      const a = f[i - 1]
      const b = f[i]
      for (let s = 0; s < 2; s++) {
        const t = s / 2
        const along = lerp(a.along, b.along, t)
        if (along < total * 0.08) continue
        const ang = spin + along * 0.8
        const r = lerp(limb.radii[i - 1], limb.radii[i], t)
        const centre = a.p.clone().lerp(b.p, t)
        const out = a.nrm.clone().lerp(b.nrm, t).multiplyScalar(Math.cos(ang)).add(a.bin.clone().lerp(b.bin, t).multiplyScalar(Math.sin(ang))).normalize()
        const p = centre.clone().addScaledVector(out, r * 1.06 + 0.07)
        if (needleField(p.x, p.y, p.z) < -0.4) continue
        wire.push(p)
        const at = p.clone().addScaledVector(out, 0.17)
        if (along >= mark && free(at) && wood(at.x, at.y, at.z) > 0.12) {
          drop(at, out, limb.pad)
          mark = along + rng.range(BULBS.limb[0], BULBS.limb[1])
        }
      }
    }
    if (wire.length > 2) wires.push(wire)
  }

  T.localPads.forEach((pad, i) => {
    const ax = T.padAxes(pad)
    const up = new THREE.Vector3(...ax.up)
    const side = new THREE.Vector3(...ax.side)
    const depth = new THREE.Vector3(...ax.depth)
    const centre = new THREE.Vector3(...pad.at)
    const n = Math.max(7, Math.round(pad.size[0] * pad.size[2] * BULBS.pad))
    const ring = []
    for (let k = 0; k < n; k++) {
      const even = (k / n) * TAU + rng.range(-0.25, 0.25)
      const th = even + 0.55 * Math.cos(even)
      const rim = rng.next() < 0.4
      const rho = rim ? 1.25 : rng.range(0.35, 0.8)
      const start = centre.clone().addScaledVector(side, Math.cos(th) * rho * pad.size[0]).addScaledVector(depth, Math.sin(th) * rho * pad.size[2])
      const dir = new THREE.Vector3()
      if (rim) {
        start.addScaledVector(up, rng.range(-0.6, -0.25) * pad.size[1])
        dir.copy(centre).addScaledVector(up, -0.45 * pad.size[1]).sub(start).normalize()
      } else {
        start.addScaledVector(up, -pad.size[1] - 2.5)
        dir.copy(up)
      }
      let hit = null
      for (let s = 0; s < 14; s += 0.12) {
        const q = start.clone().addScaledVector(dir, s)
        if (needleField(q.x, q.y, q.z) < 0.22) {
          hit = q
          break
        }
      }
      if (!hit || snowField(hit.x, hit.y, hit.z) < 0.3 || wood(hit.x, hit.y, hit.z) < 0.2) continue
      const out = gradient(needleField, hit.x, hit.y, hit.z)
      drop(hit, out, i)
      ring.push({ th, p: hit })
    }
    ring.sort((a, b) => a.th - b.th)
    const wire = []
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k].p
      const b = ring[(k + 1) % ring.length].p
      const steps = Math.max(2, Math.round(a.distanceTo(b) / 1.1))
      for (let s = 0; s < steps; s++) {
        const q = a.clone().lerp(b, s / steps)
        for (let it = 0; it < 5; it++) {
          const f = needleField(q.x, q.y, q.z)
          if (f >= 0.1) break
          q.addScaledVector(gradient(needleField, q.x, q.y, q.z), 0.12 - f)
        }
        wire.push(q)
      }
    }
    if (wire.length > 2) {
      wire.push(wire[0].clone())
      wires.push(wire)
    }
  })
  return { bulbs, wires }
}

function colourOf(g, r, gr, b, a) {
  const n = g.getAttribute('position').count
  const col = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) col.set([r, gr, b, a], i * 4)
  g.setAttribute('color', new THREE.BufferAttribute(col, 4))
  return g
}

function phaseOf(g, phase, kind) {
  const n = g.getAttribute('position').count
  const uv = new Float32Array(n * 2)
  for (let i = 0; i < n; i++) uv.set([phase, kind], i * 2)
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

function wireTube(points, radius) {
  const f = frames(points.map((p) => [p.x, p.y, p.z]))
  const pos = []
  const index = []
  for (let i = 0; i < f.length; i++) {
    for (let j = 0; j < 3; j++) {
      const a = (j / 3) * TAU
      const p = f[i].p.clone().addScaledVector(f[i].nrm, Math.cos(a) * radius).addScaledVector(f[i].bin, Math.sin(a) * radius)
      pos.push(p.x, p.y, p.z)
    }
  }
  for (let i = 0; i < f.length - 1; i++) {
    for (let j = 0; j < 3; j++) {
      const a = i * 3 + j
      const b = i * 3 + ((j + 1) % 3)
      index.push(a, b, a + 3, b, b + 3, a + 3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

function star() {
  const rim = []
  for (let k = 0; k < 10; k++) {
    const a = Math.PI / 2 + (k * TAU) / 10
    const r = k % 2 === 0 ? STAR_R * (0.97 + 0.06 * rng.next()) : STAR_R * 0.42
    rim.push([Math.cos(a) * r, Math.sin(a) * r])
  }
  const ring = (scale, z) => rim.map(([x, y]) => new THREE.Vector3(x * scale, y * scale, z))
  const pos = []
  const col = []
  const face = (pts, tones, glowShare) => {
    pts.forEach((q, i) => {
      pos.push(q.x, q.y, q.z)
      col.push(tones[i], 0.72 * tones[i], 0.28 * tones[i], glowShare * tones[i])
    })
  }
  const tone = (k) => (k % 2 === 0 ? 1 : STAR.valley)
  const front = new THREE.Vector3(0, 0, STAR.deep)
  const back = new THREE.Vector3(0, 0, -STAR.deep)
  const near = ring(STAR.inset, STAR.edge)
  const mid = ring(1, 0)
  const far = ring(STAR.inset, -STAR.edge)
  for (let k = 0; k < 10; k++) {
    const j = (k + 1) % 10
    face([front, near[k], near[j]], [STAR.crest, tone(k), tone(j)], k % 2 === 0 ? STAR.glow[0] : STAR.glow[1])
    face([near[k], mid[k], mid[j]], [tone(k), tone(k), tone(j)], STAR.glow[2])
    face([near[k], mid[j], near[j]], [tone(k), tone(j), tone(j)], STAR.glow[2])
    face([far[k], mid[j], mid[k]], [tone(k), tone(j), tone(k)], STAR.glow[2])
    face([far[k], far[j], mid[j]], [tone(k), tone(j), tone(j)], STAR.glow[2])
    face([back, far[j], far[k]], [STAR.crest, tone(j), tone(k)], STAR.glow[2])
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
  g.computeVertexNormals()
  g.applyMatrix4(new THREE.Matrix4().makeRotationY(0.22).multiply(new THREE.Matrix4().makeRotationZ(-0.06)))
  g.applyMatrix4(new THREE.Matrix4().makeTranslation(STAR_AT[0], STAR_AT[1], STAR_AT[2]))
  const [ax, az] = T.trunkAxis(T.trunkShape.top)
  const seat = STAR_AT[1] - STAR_R * 0.42
  const stem = rod([new THREE.Vector3(ax, T.trunkShape.top + 2.2, az), new THREE.Vector3(lerp(ax, STAR_AT[0], 0.6), T.trunkShape.top + 4.4, lerp(az, STAR_AT[2], 0.6)), new THREE.Vector3(STAR_AT[0], seat + 0.1, STAR_AT[2])], [STAR.stem[0], lerp(STAR.stem[0], STAR.stem[1], 0.5), STAR.stem[1]])
  colourOf(stem, 0.5, 0.37, 0.14, 0)
  const collar = rod([new THREE.Vector3(STAR_AT[0], seat - 0.62, STAR_AT[2]), new THREE.Vector3(STAR_AT[0], seat - 0.5, STAR_AT[2]), new THREE.Vector3(STAR_AT[0], seat - 0.12, STAR_AT[2]), new THREE.Vector3(STAR_AT[0], seat + 0.16, STAR_AT[2])], [STAR.stem[1], STAR.collar, STAR.collar, STAR.stem[1]])
  colourOf(collar, 0.72, 0.53, 0.2, 0.012)
  const all = mergeGeometries([phaseOf(g, 0.31, 2), phaseOf(stem, 0.31, 0).toNonIndexed(), phaseOf(collar, 0.31, 0).toNonIndexed()])
  return all
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

function lights() {
  const { bulbs, wires } = strings()
  const parts = []
  for (const b of bulbs) {
    const g = new THREE.IcosahedronGeometry(CORE_R * b.size, 0)
    g.deleteAttribute('uv')
    const cp = g.getAttribute('position')
    const cn = g.getAttribute('normal')
    for (let i = 0; i < cp.count; i++) {
      const v = new THREE.Vector3(cp.getX(i), cp.getY(i), cp.getZ(i)).normalize()
      cn.setXYZ(i, v.x, v.y, v.z)
    }
    g.applyMatrix4(new THREE.Matrix4().makeScale(1, 1.32, 1))
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.out))
    g.applyMatrix4(new THREE.Matrix4().makeTranslation(b.at.x, b.at.y, b.at.z))
    colourOf(g, 1, 0.7 + 0.1 * b.warm, 0.34 + 0.1 * b.warm, 1)
    parts.push(phaseOf(g, b.phase, 1))
  }
  let wireTriangles = 0
  for (const w of wires) {
    const g = wireTube(w, WIRE_R)
    wireTriangles += g.index.count / 3
    colourOf(g, 0.07, 0.085, 0.05, 0)
    parts.push(phaseOf(g, 0, 0).toNonIndexed())
  }
  parts.push(star())
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))
  const list = []
  for (const b of bulbs) list.push(+b.at.x.toFixed(3), +b.at.y.toFixed(3), +b.at.z.toFixed(3), +b.phase.toFixed(3))
  const groups = {}
  for (const b of bulbs) groups[b.group] = (groups[b.group] ?? 0) + 1
  return { g, bulbs: list, count: bulbs.length, wireTriangles, groups }
}

function arrival() {
  const parts = []
  const up = new THREE.Vector3(0, 1, 0)
  let n = 0
  for (const limb of T.limbs) {
    if (limb.kind !== 'limb' && limb.kind !== 'root') continue
    n++
    const f = frames(limb.local)
    const total = f[f.length - 1].along
    const pos = []
    const base = []
    const uv = []
    const col = []
    const index = []
    const across = 7
    const most = limb.kind === 'root' ? 0.46 : 0.3
    for (let i = 0; i < f.length; i++) {
      const tan = f[i].tan
      const u = up.clone().sub(tan.clone().multiplyScalar(up.dot(tan)))
      const flat = u.length()
      u.normalize()
      const side = new THREE.Vector3().crossVectors(tan, u)
      const ends = smooth(limb.kind === 'root' ? 0.52 : 0.42, limb.kind === 'root' ? 0.74 : 0.6, f[i].along / total) * smooth(0, 0.1, 1 - f[i].along / total)
      const lump = 0.55 + 0.45 * Math.sin(f[i].along * 1.5 + n * 1.7) * Math.sin(f[i].along * 0.6 + n)
      const thick = most * smooth(0.45, 0.9, flat) * ends * smooth(0.36, 0.7, lump) * (0.8 + 0.2 * Math.sin(f[i].along * 3.7 + n * 0.9))
      const seed = clamp01(0.5 + 0.5 * Math.sin(f[i].along * 1.4 + n * 2.1))
      for (let j = 0; j < across; j++) {
        const a = lerp(-1.1, 1.1, j / (across - 1))
        const dir = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a))
        const r = limb.radii[i]
        const edge = Math.cos((a / 1.1) * (Math.PI / 2))
        const rise = thick * Math.pow(Math.max(edge, 0), 0.55)
        const p0 = f[i].p.clone().addScaledVector(dir, r * 0.86)
        const p1 = f[i].p.clone().addScaledVector(dir, r * 0.86 + (r * 0.24 + 0.02) * smooth(0, 0.06, rise) + rise)
        pos.push(p1.x, p1.y, p1.z)
        base.push(p0.x, p0.y, p0.z, seed)
        uv.push(p1.x / SNOW_TILE_MM, p1.z / SNOW_TILE_MM)
        const shade = 0.56 + 0.2 * edge
        col.push(shade * 0.93, shade * 0.96, shade)
      }
    }
    for (let i = 0; i < f.length - 1; i++) {
      for (let j = 0; j < across - 1; j++) {
        const a = i * across + j
        const b = a + across
        index.push(a, b, a + 1, a + 1, b, b + 1)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('tangent', new THREE.Float32BufferAttribute(base, 4))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
    g.setIndex(index)
    g.computeVertexNormals()
    const nor = g.getAttribute('normal')
    for (let i = 0; i < nor.count; i++) if (nor.getY(i) < 0) nor.setXYZ(i, -nor.getX(i), -nor.getY(i), -nor.getZ(i))
    for (let t = 0; t < index.length; t += 3) {
      const a = new THREE.Vector3().fromArray(pos, index[t] * 3)
      const b = new THREE.Vector3().fromArray(pos, index[t + 1] * 3).sub(a)
      const c = new THREE.Vector3().fromArray(pos, index[t + 2] * 3).sub(a)
      if (b.cross(c).y < 0) {
        const k = index[t + 1]
        index[t + 1] = index[t + 2]
        index[t + 2] = k
      }
    }
    g.setIndex(index)
    parts.push(g)
  }
  return mergeGeometries(parts)
}

async function needleMaps() {
  const src = await readPicture(rel('assets-src', 'tree-winter', 'needles-take1.png'), 2048)
  const img = seamless(src, 0.1)
  const { w, h } = img
  const l = luma(img)
  const wide = blurWrap(l, w, h, Math.round(w / 12))
  let mean = 0
  for (let i = 0; i < w * h; i++) mean += l[i] / (w * h)
  const colour = new Float32Array(img.px.length)
  for (let i = 0; i < w * h; i++) {
    const k = (0.45 + 0.55 * (mean / Math.max(wide[i], 0.04))) * Math.pow(Math.max(l[i], 0.01) / Math.max(wide[i], 0.04), 0.5)
    for (let c = 0; c < 3; c++) colour[i * 3 + c] = img.px[i * 3 + c] * k
  }
  await writePng(rel('assets-full', 'winter', 'tree-needles.srgb.tile.w1024.png'), toBytes(colour), w, h, 3, 2048)

  const fine = blurWrap(l, w, h, 5)
  const cell = 512
  const atlas = Buffer.alloc(cell * 2 * cell * 2 * 4)
  for (let s = 0; s < 4; s++) {
    const ox = Math.floor(rng.range(0, w - cell))
    const oy = Math.floor(rng.range(0, h - cell))
    const lobes = 3 + rng.int(3)
    const turn = rng.range(0, TAU)
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const i = (oy + y) * w + ox + x
        const dx = (x + 0.5) / cell - 0.5
        const dy = (y + 0.5) / cell - 0.5
        const d = (2 * Math.hypot(dx, dy)) / (0.8 + 0.16 * Math.sin(lobes * Math.atan2(dy, dx) + turn))
        const a = clamp01((0.9 - d) * 3 + (l[i] - fine[i]) * 9)
        const o = (((s >> 1) * cell + y) * cell * 2 + (s & 1) * cell + x) * 4
        atlas[o] = Math.round(clamp01(colour[i * 3]) * 255)
        atlas[o + 1] = Math.round(clamp01(colour[i * 3 + 1]) * 255)
        atlas[o + 2] = Math.round(clamp01(colour[i * 3 + 2]) * 255)
        atlas[o + 3] = Math.round(a * 255)
      }
    }
  }
  await writePng(rel('assets-full', 'winter', 'tree-sprigs.srgb.w512.png'), atlas, cell * 2, cell * 2, 4)
}

async function snowMap() {
  const n = 1024
  const noise = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) noise[i] = rng.next()
  const grain = blurWrap(noise, n, n, 1)
  const clump = blurWrap(noise, n, n, 5)
  const drift = blurWrap(noise, n, n, 28)
  const px = new Float32Array(n * n * 3)
  for (let i = 0; i < n * n; i++) {
    const crystal = noise[i] > 0.992 ? 0.1 : 0
    const v = clamp01(0.82 + (grain[i] - 0.5) * 0.9 + (clump[i] - 0.5) * 2.4 + (drift[i] - 0.5) * 3 + crystal)
    px[i * 3] = v * 0.965
    px[i * 3 + 1] = v * 0.98
    px[i * 3 + 2] = v
  }
  await writePng(rel('assets-full', 'winter', 'tree-snow.srgb.tile.w1024.png'), toBytes(px), n, n, 3)
}

const N = needles()
const S = snow()
const L = lights()
const A = arrival()
const tri = (g) => (g.index ? g.index.count : g.getAttribute('position').count) / 3
const counts = { needles: tri(N.g), snow: tri(S), lights: tri(L.g), arrival: tri(A) }
writeGlb(rel('assets-full', 'winter', 'tree-crown.glb'), [
  fromThree('needles', N.g, { triangles: counts.needles, tufts: N.tufts, tileMm: NEEDLE_TILE_MM }),
  fromThree('snow', S, { triangles: counts.snow, tileMm: SNOW_TILE_MM }),
  fromThree('lights', L.g, { triangles: counts.lights, bulbs: L.bulbs, star: STAR_AT }),
  fromThree('arrival', A, { triangles: counts.arrival, tileMm: SNOW_TILE_MM }),
])
await needleMaps()
await snowMap()
console.log(`tree-winter: needles ${counts.needles} triangles (${N.tufts} tufts), snow ${counts.snow}, lights ${counts.lights} (${L.count} bulbs ${JSON.stringify(L.groups)}, wire ${L.wireTriangles}), arrival ${counts.arrival}; ${T.clusters.length} clusters on ${T.localPads.length} pads`)
