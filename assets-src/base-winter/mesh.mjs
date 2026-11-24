import { rayOf } from '../../tools/lib/refcam.mjs'
import { CONES } from './carve.mjs'
import { Soup, add3, clamp, cross3, dot3, fbm, mix, mulberry, norm3, smooth } from './lib.mjs'
import { BRASS, CARVE, SNOW, WOOD } from './maps.mjs'
import * as P from './profile.mjs'

const RAD = Math.PI / 180
const place = (r, h, az) => [r * Math.sin(az * RAD), h, r * Math.cos(az * RAD)]
const dir = (nr, nh, az) => [nr * Math.sin(az * RAD), nh, nr * Math.cos(az * RAD)]
const azOf = (p) => Math.atan2(p[0], p[2]) / RAD
const front = (az) => Math.abs(((az + 540) % 360) - 180)
const scale3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k]

function azList(from, to, spacing, radius) {
  const out = [from]
  let a = from
  for (;;) {
    const step = spacing(a) / (radius * RAD)
    if (a + step * 1.5 >= to) break
    a += step
    out.push(a)
  }
  out.push(to)
  return out
}

const woodRepeats = Math.round((2 * Math.PI * P.CARVING.rRef) / WOOD.tileMm)
const wander = (az) => 0.2 * Math.sin(2 * az * RAD + 0.4) + 0.07 * Math.sin(5 * az * RAD + 1.9)

export function buildWood(f) {
  const soup = new Soup('wood')
  const mer = f.mer
  const zoneA = P.sOfH(mer, 9.7)
  const zoneB = P.sOfH(mer, 23.5)
  const rows = []
  const span = (a, b, step) => {
    const n = Math.max(1, Math.round((b - a) / step))
    for (let i = 0; i < n; i++) rows.push(a + ((b - a) * i) / n)
  }
  span(0, zoneA, 0.85)
  span(zoneA, zoneB, 0.55)
  span(zoneB, mer.total, 1.15)
  rows.push(mer.total)
  const coarse = rows.filter((_, i) => i % 2 === 0 || i === rows.length - 1)
  const vertex = (az, s, strip) => {
    const m = P.atS(mer, s)
    const d = Math.max(f.atSoft(az, s), 0) * P.CARVING.relief
    const sv = clamp((s - f.sLow) / (f.sHigh - f.sLow))
    const t = (az - strip.from) / (strip.to - strip.from)
    const weight = smooth(f.sLow, f.sLow + 0.6, s) * (1 - smooth(f.sHigh - 0.6, f.sHigh, s))
    const ao = clamp(0.3 + 0.7 * smooth(0.5, 2.6, s)) * clamp(0.16 + 0.84 * Math.pow(smooth(0, 10.5, mer.total - s), 0.85))
    const wear = 0.65 * Math.exp(-(((m.h - 9.3) / 0.8) ** 2)) + 0.3 * Math.exp(-(((m.h - 31.2) / 0.5) ** 2))
    return {
      p: place(m.r + m.nr * d, m.h + m.nh * d, az),
      n: dir(m.nr, m.nh, az),
      uv: [(az / 360) * woodRepeats, s / WOOD.tileMm + wander(az)],
      uv2: [(0.5 + t * (CARVE.width - 1)) / CARVE.width, (strip.row + 0.5 + sv * (strip.rows - 1)) / CARVE.height],
      c: [ao, wear, weight],
    }
  }
  const spacing = (az) => (front(az) <= 65 ? 0.6 : front(az) <= 130 ? 1.0 : 2.6)
  for (const strip of CARVE.strips) {
    const cols = azList(strip.from, strip.to, spacing, P.CARVING.rRef)
    const list = strip.from >= 130 ? coarse : rows
    soup.grid(cols.length, list.length, (i, j) => vertex(cols[i], list[j], strip))
  }
  const bodyTriangles = soup.triangles

  const beadCols = azList(-180, 180, (az) => (front(az) <= 130 ? 1.4 : 3.6), P.BEAD.ringR)
  const beadRows = 6
  soup.grid(beadCols.length, beadRows, (i, j) => {
    const az = beadCols[i]
    const deg = mix(-72, 158, j / (beadRows - 1))
    const psi = deg * RAD
    const tube = P.BEAD.tube * (1 + 0.035 * (fbm(((az + 180) / 360) * 40, 0.5, 40, 4, 17, 2) - 0.5))
    return {
      p: place(P.BEAD.ringR + tube * Math.cos(psi), P.BEAD.h + tube * Math.sin(psi), az),
      n: dir(Math.cos(psi), Math.sin(psi), az),
      uv: [(az / 360) * woodRepeats, 0.37 + (psi * tube) / WOOD.tileMm + wander(az + 40)],
      uv2: [0.5, 0.5],
      c: [clamp(0.25 + 0.75 * smooth(-72, -15, deg) * (1 - smooth(105, 158, deg))), 0.8 * Math.exp(-(((deg - 42) / 34) ** 2)), 0],
    }
  })
  const beadTriangles = soup.triangles - bodyTriangles

  for (const cone of CONES) addCone(soup, f, cone)
  return { soup, bodyTriangles, beadTriangles, coneTriangles: soup.triangles - bodyTriangles - beadTriangles }
}

function addCone(soup, f, cone) {
  const mer = f.mer
  const rng = mulberry(Math.round(cone.az * 100) + 7)
  const s0 = P.sOfH(mer, cone.h)
  const m = P.atS(mer, s0)
  const N = dir(m.nr, m.nh, cone.az)
  const T = [Math.cos(cone.az * RAD), 0, -Math.sin(cone.az * RAD)]
  const B = cross3(N, T)
  const C = place(m.r, m.h, cone.az)
  const lean = cone.lean * RAD
  const D = norm3(add3(scale3(T, Math.sin(lean)), B, -Math.cos(lean)))
  const X = cross3(D, N)
  const L = cone.long / 2
  const half = cone.wide / 2
  const rise = cone.wide * 0.37
  const shape = (x) => Math.pow(Math.max(1 - x * x, 0), 0.42) * (1 - 0.32 * smooth(-0.3, 1, x))
  const point = (x, om, k = 1) => {
    const w = shape(x) * k
    return add3(add3(add3(C, D, x * L), X, Math.sin(om) * half * w), N, Math.cos(om) * rise * w - 0.2)
  }
  const normalAt = (x, om) => {
    const e = 0.01
    const a = add3(point(Math.min(x + e, 0.999), om), point(Math.max(x - e, -0.999), om), -1)
    const b = add3(point(x, om + e), point(x, om - e), -1)
    let n = norm3(cross3(a, b))
    const out = norm3(add3(scale3(X, Math.sin(om)), N, Math.cos(om)))
    if (dot3(n, out) < 0) n = scale3(n, -1)
    return n
  }
  const uvOf = (p) => [(azOf(p) / 360) * woodRepeats, (s0 + dot3(add3(p, C, -1), B)) / WOOD.tileMm + wander(cone.az) + 0.13]
  const coreCols = 9
  const coreRows = 9
  soup.grid(coreCols, coreRows, (i, j) => {
    const x = mix(-0.985, 0.985, i / (coreCols - 1))
    const om = mix(-104, 104, j / (coreRows - 1)) * RAD
    const p = point(x, om, 0.84)
    return { p, n: normalAt(x, om), uv: uvOf(p), uv2: [0.5, 0.5], c: [0.12, 0, 0] }
  })
  const seg = cone.fine ? 8 : 6
  const K = 7
  for (let k = 0; k < K; k++) {
    const x = -0.87 + (1.74 * (k + 0.5)) / K
    const w = shape(x)
    const arc = 196 * RAD * Math.hypot(half, rise) * 0.72 * w
    const count = Math.max(2, Math.round(arc / 1.5))
    const along = (1.74 * L) / K
    const across = arc / (count + 0.5)
    for (let j = 0; j < count; j++) {
      const om = (-98 + (196 * (j + 0.5 + (k % 2) * 0.5)) / (count + 0.5)) * RAD
      const Pc = point(x + (rng() - 0.5) * 0.03, om)
      const Ns = normalAt(x, om)
      const e1 = norm3(add3(D, Ns, -dot3(D, Ns)))
      const e2 = cross3(Ns, e1)
      const rho = 0.7 * Math.max(along, across) * (0.94 + 0.14 * rng())
      const hgt = rho * (0.36 + 0.1 * rng())
      const tilt = norm3(add3(Ns, e1, 0.8))
      const first = soup.count
      const top = add3(add3(Pc, tilt, hgt), e1, 0.34 * rho)
      soup.vert(top, tilt, uvOf(top), [0.5, 0.5], [1, 0.85, 0])
      for (let ring = 0; ring < 2; ring++) {
        for (let q = 0; q < seg; q++) {
          const al = (q / seg) * 2 * Math.PI + (ring ? Math.PI / seg : 0)
          const rhomb = (ring ? 1.16 : 1.04) / Math.pow(Math.abs(Math.cos(al)) + Math.abs(Math.sin(al)), 0.8)
          const rad = add3(scale3(e1, Math.cos(al)), e2, Math.sin(al))
          const lead = Math.cos(al)
          const reachOut = ring ? rhomb * (lead > 0 ? 1 + 0.18 * lead : 1) : rhomb * (0.66 + 0.2 * lead)
          const p = add3(add3(Pc, rad, rho * reachOut), tilt, hgt * (ring ? -0.35 - 0.3 * Math.max(lead, 0) : 0.8 + 0.12 * lead))
          const n = norm3(add3(scale3(tilt, ring ? 0.3 : 1), rad, ring ? 1 : 0.62))
          soup.vert(p, n, uvOf(p), [0.5, 0.5], ring ? [0.2, 0, 0] : [0.82, 0.4, 0])
        }
      }
      for (let q = 0; q < seg; q++) {
        const a = first + 1 + q
        const b = first + 1 + ((q + 1) % seg)
        soup.tri(first, a, b)
        const c = first + 1 + seg + q
        const d = first + 1 + seg + ((q + 1) % seg)
        soup.tri(a, c, b)
        soup.tri(b, c, d)
      }
    }
  }
}

const brassRepeats = Math.round((2 * Math.PI * P.FOOT_R) / BRASS.tileMm)

function lathe(soup, profile, cols, vStart, seed) {
  const arc = [0]
  for (let i = 1; i < profile.length; i++) arc.push(arc[i - 1] + Math.hypot(profile[i][0] - profile[i - 1][0], profile[i][1] - profile[i - 1][1]))
  const normals = profile.map((_, i) => {
    const a = profile[Math.max(i - 1, 0)]
    const b = profile[Math.min(i + 1, profile.length - 1)]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l]
  })
  soup.grid(cols.length, profile.length, (i, j) => {
    const az = cols[i]
    const [r, h, ao, wear, patina] = profile[j]
    const wob = seed ? (fbm(((az + 180) / 360) * 24, 0.5, 24, 4, seed, 3) - 0.5) * 0.07 : 0
    return {
      p: place(r + wob * normals[j][0], h + wob * normals[j][1], az),
      n: dir(normals[j][0], normals[j][1], az),
      uv: [(az / 360) * brassRepeats, vStart + arc[j] / BRASS.tileMm],
      uv2: [0.5, 0.5],
      c: [ao, wear, patina],
    }
  })
}

export function buildBrass() {
  const soup = new Soup('brass')
  const even = (n) => Array.from({ length: n + 1 }, (_, i) => -180 + (360 * i) / n)
  lathe(
    soup,
    [
      [57.55, 0.02, 0.05, 0, 1],
      [57.7, 0.95, 0.06, 0, 1],
      [58.55, 1.08, 0.12, 0.1, 0.9],
      [59.02, 1.22, 0.55, 0.8, 0.2],
      [59.1, 1.6, 0.95, 0.5, 0.15],
      [58.95, 2.5, 1, 0.2, 0.2],
      [58.78, 3.15, 1, 0.75, 0.12],
      [58.45, 3.5, 0.8, 0.5, 0.22],
      [57.9, P.RIM.top + 0.04, 0.42, 0.1, 0.62],
      [56.5, P.RIM.top + 0.1, 0.1, 0, 0.92],
    ],
    even(128),
    0,
    3,
  )
  lathe(
    soup,
    [
      [55.7, 4.3, 0.03, 0, 1],
      [55.75, 7.7, 0.03, 0, 1],
    ],
    even(64),
    0.9,
    0,
  )
  const rimTriangles = soup.triangles

  const R = P.ROPE
  const rows = 9
  const ropePoint = (k, frac, psi, wobble) => {
    const theta = (2 * Math.PI * (k + frac + (R.strands * psi) / (2 * Math.PI))) / R.lobes - Math.PI
    const lobe = Math.sqrt(Math.max(1 - (2 * frac - 1) ** 2, 0))
    const rho = R.tube * (1 - R.depth + R.depth * Math.pow(lobe, 0.9)) * wobble
    return { az: theta / RAD, r: R.ringR + rho * Math.cos(psi), h: R.h + rho * Math.sin(psi), lobe }
  }
  const rng = mulberry(41)
  for (let k = 0; k < R.lobes; k++) {
    const centre = ((k + 0.5) / R.lobes) * 360 - 180
    const cols = front(centre) <= 134 ? 4 : 2
    const wobble = 0.97 + 0.06 * rng()
    soup.grid(cols + 1, rows, (i, j) => {
      const frac = i / cols
      const deg = mix(-72, 158, j / (rows - 1))
      const psi = deg * RAD
      const q = ropePoint(k, frac, psi, wobble)
      const e = 0.03
      const fa = ropePoint(k, Math.min(frac + e, 1), psi, wobble)
      const fb = ropePoint(k, Math.max(frac - e, 0), psi, wobble)
      const pa = ropePoint(k, frac, psi + e, wobble)
      const pb = ropePoint(k, frac, psi - e, wobble)
      const df = add3(place(fa.r, fa.h, fa.az), place(fb.r, fb.h, fb.az), -1)
      const dp = add3(place(pa.r, pa.h, pa.az), place(pb.r, pb.h, pb.az), -1)
      let n = norm3(cross3(dp, df))
      const out = dir(Math.cos(psi), Math.sin(psi), q.az)
      if (dot3(n, out) < 0) n = scale3(n, -1)
      const open = smooth(-72, -25, deg) * (1 - smooth(110, 158, deg))
      return {
        p: place(q.r, q.h, q.az),
        n,
        uv: [(q.az / 360) * brassRepeats, 0.31 + (psi * R.tube) / BRASS.tileMm],
        uv2: [0.5, 0.5],
        c: [clamp(0.1 + 0.9 * Math.pow(q.lobe, 0.7) * (0.25 + 0.75 * open)), q.lobe * q.lobe * open * 0.9, clamp(1 - Math.pow(q.lobe, 0.6) * (0.35 + 0.65 * open))],
      }
    })
  }
  const ropeTriangles = soup.triangles - rimTriangles

  const lip = []
  for (let i = 0; i <= 9; i++) {
    const deg = mix(-128, 214, i / 9)
    const psi = deg * RAD
    const open = smooth(-128, -70, deg) * (1 - smooth(150, 214, deg))
    lip.push([P.LIP.ringR + P.LIP.tube * Math.cos(psi), P.LIP.h + P.LIP.tube * Math.sin(psi), 0.15 + 0.85 * open, 0.85 * Math.exp(-(((deg - 48) / 44) ** 2)), 0.9 - 0.75 * open])
  }
  lathe(soup, lip, even(128), 0.55, 5)
  const [fo, fi] = [P.LEDGE.outer, P.LEDGE.inner]
  const floor = [0, 0.34, 0.68, 1].map((t) => [mix(fo[0] - 0.15, fi[0] + 0.15, t), mix(fo[1], fi[1], t) - 0.16 * Math.sin(Math.PI * t), 0.55 + 0.2 * Math.sin(Math.PI * t), 0.02, 0.94])
  lathe(soup, floor, even(96), 0.12, 7)
  const glass = (h) => P.sphereRadiusAt(h) + P.COLLAR.gap
  const [cf, cc] = [P.COLLAR.foot, P.COLLAR.crown]
  lathe(
    soup,
    [
      [fi[0] + 0.15, fi[1] - 0.04, 0.3, 0, 0.85],
      [cf[0] + 0.22, cf[1] + 0.2, 0.8, 0.2, 0.3],
      [cf[0], cf[1] + 0.68, 1, 0.5, 0.1],
      [cc[0] + 0.38, cc[1] - 0.16, 1, 0.8, 0.06],
      [cc[0] + 0.05, cc[1], 1, 0.7, 0.08],
      [cc[0] - 0.1, cc[1] - 0.01, 0.85, 0.3, 0.25],
      [glass(cc[1] - 0.06) + 0.24, cc[1] - 0.06, 0.04, 0, 1],
      [glass(cc[1] - 0.22), cc[1] - 0.22, 0.02, 0, 1],
    ],
    even(128),
    0.78,
    9,
  )
  const cup = []
  const big = P.SPHERE_R + P.CUP.offset
  const beta1 = Math.acos((P.CENTRE_H - (cc[1] - 0.22)) / big)
  for (let i = 0; i <= 7; i++) {
    const beta = beta1 * (1 - i / 7)
    cup.push([Math.max(big * Math.sin(beta), 0.01), P.CENTRE_H - big * Math.cos(beta), 0.03, 0, 1])
  }
  lathe(soup, cup, even(48), 0.05, 0)
  return { soup, rimTriangles, ropeTriangles, seatTriangles: soup.triangles - rimTriangles - ropeTriangles }
}

const MOUNDS = [
  { a0: -86, a1: -44, ea: 9, eb: 12, peak: 2.2, glass: 1, r1: 52.3 },
  { a0: -41, a1: -7, ea: 9, eb: 9, peak: 1.5, glass: 0.12, r0: 46.5, r1: 52.7 },
  { a0: -6, a1: 30, ea: 8, eb: 10, peak: 1.1, glass: 0.18, r0: 46, r1: 52.5 },
  { a0: 14, a1: 97, ea: 14, eb: 9, peak: 2.5, glass: 1, r1: 52.8, over: [27, 76] },
  { a0: 99, a1: 141, ea: 10, eb: 12, peak: 1.6, glass: 0.8, r1: 52.5, over: [112, 128] },
  { a0: -131, a1: -92, ea: 12, eb: 9, peak: 1.5, glass: 0.7, r1: 52.2, over: [-118, -104] },
  { a0: 150, a1: 216, ea: 14, eb: 14, peak: 1.8, glass: 1, r1: 53, over: [170, 196] },
]

const lipOuter = P.LIP.ringR + P.LIP.tube
const snowEdge = lipOuter + 1.25

function snowSupport(r) {
  const [fo, fi] = [P.LEDGE.outer, P.LEDGE.inner]
  const floorLine = fi[1] + ((r - fi[0]) * (fo[1] - fi[1])) / (fo[0] - fi[0])
  if (r >= lipOuter) return P.LIP.h - 0.25 - (r - lipOuter) * 2.1
  if (r >= P.LIP.ringR - P.LIP.tube) return Math.max(P.LIP.h + Math.sqrt(Math.max(P.LIP.tube ** 2 - (r - P.LIP.ringR) ** 2, 0)), floorLine)
  if (r >= fi[0]) return floorLine
  const crown = P.COLLAR.crown
  if (r >= crown[0]) return mix(crown[1], fi[1], (r - crown[0]) / (fi[0] - crown[0]))
  return crown[1]
}

function snowThickness(azIn, r) {
  const u = (azIn + 180) / 360
  const reach = fbm(u * 31, 0.37, 31, 4, 113, 3)
  const heap = 0.5 + 1.0 * fbm(u * 19, r / 12, 19, 64, 119, 2)
  let t = 0
  for (const m of MOUNDS) {
    let az = azIn
    const mid = (m.a0 + m.a1) / 2
    while (az - mid > 180) az -= 360
    while (az - mid < -180) az += 360
    const a = smooth(m.a0, m.a0 + m.ea, az) * (1 - smooth(m.a1 - m.eb, m.a1, az))
    if (a <= 0) continue
    const window = m.over ? smooth(m.over[0] - 3, m.over[0] + 3, az) * (1 - smooth(m.over[1] - 3, m.over[1] + 3, az)) : 0
    const over = window * smooth(0.3, 0.52, reach)
    const end = mix(m.r1 + 0.9 * (reach - 0.5), snowEdge - 0.75 + 1.5 * (reach - 0.3), over)
    const outer = Math.sqrt(1 - smooth(end - mix(4.2, 2.4, over), end, r))
    const inner = m.r0 ? mix(m.glass, 1, smooth(m.r0 - 2.2, m.r0 + 0.6, r)) : mix(m.glass, 1, smooth(43, 46, r))
    const lean = 1 + 0.4 * m.glass * (1 - smooth(43.5, 47.5, r))
    t += m.peak * a * outer * inner * lean
  }
  const lump = 0.62 + 0.76 * fbm(u * 46, r / 5.2, 46, 64, 91, 3)
  const crumb = smooth(0.7, 0.84, fbm(u * 150, r / 2.1, 150, 64, 97, 2)) * 0.55 * smooth(0.04, 0.5, t + 0.25 * fbm(u * 20, r / 9, 20, 64, 103, 2))
  const dust = 0.34 * smooth(0.6, 0.8, fbm(u * 30, r / 6, 30, 64, 109, 3)) * (1 - smooth(45.5, 49.5, r))
  const knob = 0.72 + 0.56 * fbm(u * 128, r / 2.4, 128, 64, 127, 2)
  return Math.max(t * lump * heap * knob, crumb, dust) - 0.1
}

export function buildSnow() {
  const soup = new Soup('snow')
  const cols = azList(-180, 180, (az) => (front(az) <= 132 ? 0.9 : 2.6), 48)
  const rowsN = 18
  const repeats = Math.round((2 * Math.PI * 48) / SNOW.tileMm)
  const grid = []
  for (let i = 0; i < cols.length; i++) {
    const az = cols[i]
    let rin = P.COLLAR.crown[0] - 0.3
    for (let it = 0; it < 4; it++) {
      const top = snowSupport(rin) + Math.max(snowThickness(az, rin), 0)
      rin = P.sphereRadiusAt(top) + 0.08
    }
    const column = []
    for (let j = 0; j < rowsN; j++) {
      const q = j / (rowsN - 1)
      const r = q < 0.4 ? mix(rin, 50.4, q / 0.4) : mix(50.4, snowEdge + 0.25, (q - 0.4) / 0.6)
      const t = snowThickness(az, r)
      column.push({ r, t, h: snowSupport(r) + (t > 0 ? t : Math.max(t * 3, -0.45)) })
    }
    grid.push(column)
  }
  const first = soup.count
  for (let j = 0; j < rowsN; j++) {
    for (let i = 0; i < cols.length; i++) {
      const g = grid[i][j]
      soup.vert(place(g.r, g.h, cols[i]), [0, 1, 0], [(cols[i] / 360) * repeats, -g.r / SNOW.tileMm], [0, 0], [clamp(g.t / 1.6), clamp(0.35 + 0.65 * fbm(((cols[i] + 180) / 360) * 80, g.r / 3, 80, 64, 131, 2)), 1])
    }
  }
  const acc = new Float32Array(cols.length * rowsN * 3)
  for (let j = 0; j + 1 < rowsN; j++) {
    for (let i = 0; i + 1 < cols.length; i++) {
      const c4 = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
      if (!c4.some((g) => g.t > 0)) continue
      const a = first + j * cols.length + i
      const b = a + 1
      const c = a + cols.length + 1
      const d = a + cols.length
      for (const [x, y, z] of [
        [a, c, b],
        [a, d, c],
      ]) {
        soup.tri(x, y, z)
        const px = soup.position.slice(x * 3, x * 3 + 3)
        const py = soup.position.slice(y * 3, y * 3 + 3)
        const pz = soup.position.slice(z * 3, z * 3 + 3)
        const n = cross3(add3(py, px, -1), add3(pz, px, -1))
        for (const v of [x, y, z]) for (let k = 0; k < 3; k++) acc[(v - first) * 3 + k] += n[k]
      }
    }
  }
  let up = 0
  for (let v = 0; v < cols.length * rowsN; v++) up += acc[v * 3 + 1]
  const sign = up < 0 ? -1 : 1
  if (sign < 0) for (let i = 0; i < soup.index.length; i += 3) [soup.index[i + 1], soup.index[i + 2]] = [soup.index[i + 2], soup.index[i + 1]]
  for (let v = 0; v < cols.length * rowsN; v++) {
    const n = norm3([acc[v * 3] * sign, acc[v * 3 + 1] * sign + 1e-6, acc[v * 3 + 2] * sign])
    soup.normal[(first + v) * 3] = n[0]
    soup.normal[(first + v) * 3 + 1] = n[1]
    soup.normal[(first + v) * 3 + 2] = n[2]
  }
  return { soup }
}

const MEASURED = [
  [922, 1070, 1188, 26],
  [948, 1085, 1188, 22],
  [985, 1090, 1188, 24],
  [1045, 1105, 1198, 24],
  [1090, 1110, 1205, 26],
  [1167, 1125, 1275, 34],
  [1242, 1125, 1222, 20],
  [1262, 1125, 1222, 20],
  [1452, 1135, 1210, 26],
  [1512, 1135, 1228, 30],
  [1578, 1132, 1212, 24],
  [1705, 1110, 1300, 44],
  [1745, 1105, 1220, 30],
  [1765, 1100, 1215, 22],
  [1835, 1090, 1215, 30],
  [1868, 1080, 1210, 22],
  [1888, 1075, 1215, 20],
  [1900, 1070, 1200, 14],
]

function onCylinder(px, py, radius) {
  const { origin: o, dir: d } = rayOf(px, py)
  const a = d[0] * d[0] + d[2] * d[2]
  const b = 2 * (o[0] * d[0] + o[2] * d[2])
  const c = o[0] * o[0] + o[2] * o[2] - radius * radius
  const disc = b * b - 4 * a * c
  const t = disc >= 0 ? (-b - Math.sqrt(disc)) / (2 * a) : -b / (2 * a)
  const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t]
  return { az: azOf(p), h: p[1], z: p[2], hit: disc >= 0 }
}

export function icicleList(f) {
  const list = []
  for (const [x, , y1, w] of MEASURED) {
    const foot = onCylinder(x, y1, P.ICE.r)
    const scale = 9.0 + 0.9 * clamp(foot.z / P.ICE.r, 0, 1)
    list.push({ az: foot.az, length: clamp(P.ICE.h - foot.h, 3, 19), radius: clamp((w / scale / 2) * 1.26, 0.8, 2.8), measured: true })
  }
  const rng = mulberry(20261123)
  let az = 97
  while (az < 262) {
    const big = rng() < 0.3
    list.push({ az: az > 180 ? az - 360 : az, length: big ? 11 + 5 * rng() : 5 + 5 * rng(), radius: big ? 1.4 + 0.6 * rng() : 0.8 + 0.5 * rng(), measured: false })
    az += 6 + 9 * rng()
  }
  list.sort((a, b) => a.az - b.az)
  const mer = f.mer
  return list.map((it, id) => {
    const tipH = P.ICE.h - it.length
    const s = P.sOfH(mer, Math.max(tipH, 7.6))
    const wood = P.atS(mer, s).r + Math.max(f.atSoft(it.az, s), f.atSoft(it.az, s + 1.2), 0) * P.CARVING.relief
    const need = Math.max(0, wood + 0.45 + it.radius * 0.18 - P.ICE.r)
    return { ...it, id, lean: need }
  })
}

export function buildIce(list) {
  const soup = new Soup('ice')
  const rng = mulberry(977)
  const around = 8
  const ts = [0, 0.04, 0.1, 0.19, 0.29, 0.39, 0.49, 0.59, 0.69, 0.79, 0.88, 0.955, 1]
  for (const it of list) {
    const root = place(P.ICE.r + 0.25 * (rng() - 0.5), P.ICE.h + 0.5, it.az)
    const out = dir(1, 0, it.az)
    const side = [Math.cos(it.az * RAD), 0, -Math.sin(it.az * RAD)]
    const swing = (rng() - 0.5) * 0.9
    const k1 = rng()
    const k2 = rng()
    const a0 = rng() * 6.28
    const a1 = rng() * 6.28
    const total = it.length + 0.5
    const axis = (t) => add3(add3(add3(root, [0, -1, 0], total * t), out, it.lean * Math.pow(t, 1.3)), side, swing * t * t)
    const radius = (t) => {
      const body = it.radius * (0.8 * Math.pow(1 - t, 0.55) + 0.2)
      const ripple = 1 + 0.15 * Math.sin(2 * Math.PI * ((t * total) / 3.6 + k1)) * smooth(0.02, 0.15, t) + 0.08 * Math.sin(2 * Math.PI * ((t * total) / 2.1 + k2)) + 0.04 * Math.sin(2 * Math.PI * ((t * total) / 1.1 + 3 * k1))
      const flare = it.radius * 0.34 * Math.exp(-t / 0.05)
      const cap = t > 0.88 ? Math.sqrt(Math.max(1 - ((t - 0.88) / 0.12) ** 2, 0)) : 1
      return Math.max(body * ripple, 0) * cap + flare * cap
    }
    const surface = (al, t) => {
      const c = axis(t)
      const wobble = 1 + 0.11 * Math.cos(2 * al + a0) + 0.05 * Math.cos(3 * al + a1)
      const r = radius(t) * wobble
      return add3(add3(c, out, Math.cos(al) * r), side, Math.sin(al) * r)
    }
    soup.grid(around + 1, ts.length, (i, j) => {
      const al = (i / around) * 2 * Math.PI
      const t = ts[j]
      const p = surface(al, t)
      const e = 0.012
      const da = add3(surface(al + e, Math.min(t, 0.985)), surface(al - e, Math.min(t, 0.985)), -1)
      const dt = add3(surface(al, Math.min(t + e, 0.99)), surface(al, Math.max(t - e, 0)), -1)
      let n = norm3(cross3(da, dt))
      const radial = add3(scale3(out, Math.cos(al)), side, Math.sin(al))
      if (dot3(n, radial) < 0) n = scale3(n, -1)
      if (t >= 1) n = norm3(add3(scale3(radial, 0.4), [0, -1, 0]))
      return { p, n, uv: [t, it.id], uv2: [i / around, radius(t) / it.radius], c: [root[0] / 128 + 0.5, root[1] / 128 + 0.5, root[2] / 128 + 0.5] }
    })
  }
  return { soup }
}
