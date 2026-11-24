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
  const zoneA = P.sOfH(mer, P.lift(9.7))
  const zoneB = P.sOfH(mer, P.lift(23.5))
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
    const wear = 0.65 * Math.exp(-(((m.h - P.lift(9.3)) / 0.8) ** 2)) + 0.3 * Math.exp(-(((m.h - P.lift(31.2)) / 0.5) ** 2))
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
  const s0 = P.sOfH(mer, P.lift(cone.h))
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
      [P.PLINTH.r, 0.02, 0.02, 0, 1],
      [P.PLINTH.r, P.PLINTH.top, 0.02, 0, 1],
      [58.55, P.PLINTH.top + 0.12, 0.3, 0.1, 0.5],
      [59.1, P.PLINTH.top + 0.42, 0.8, 0.45, 0.2],
      [59.3, P.PLINTH.top + 0.95, 1, 0.3, 0.15],
      [59.3, P.RIM.top - 1.35, 1, 0.25, 0.16],
      [59.15, P.RIM.top - 0.8, 1, 0.3, 0.15],
      [58.85, P.RIM.top - 0.38, 1, 0.7, 0.12],
      [58.4, P.RIM.top - 0.12, 0.85, 0.5, 0.2],
      [57.85, P.RIM.top + 0.04, 0.42, 0.1, 0.62],
      [56.5, P.RIM.top + 0.1, 0.1, 0, 0.92],
    ],
    even(128),
    0,
    3,
  )
  lathe(
    soup,
    [
      [55.7, P.RIM.top + 1.0, 0.03, 0, 1],
      [55.75, P.BEAD.h + 0.65, 0.03, 0, 1],
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
  const facing = []
  for (let az = -180; az < 180 - 1e-6; az += front(az + 1.4) <= 118 ? 2.8125 : 5.625) facing.push(az)
  facing.push(180)
  lathe(soup, lip, facing, 0.55, 5)
  const [fo, fi] = [P.LEDGE.outer, P.LEDGE.inner]
  const floor = [0, 0.34, 0.68, 1].map((t) => [mix(fo[0] - 0.15, fi[0] + 0.15, t), mix(fo[1], fi[1], t) - 0.16 * Math.sin(Math.PI * t), 0.7 + 0.2 * Math.sin(Math.PI * t), 0.1, 0.5])
  lathe(soup, floor, even(96), 0.12, 7)
  const glass = (h) => P.sphereRadiusAt(h) + P.COLLAR.gap
  const [cf, cc] = [P.COLLAR.foot, P.COLLAR.crown]
  const bead = (deg) => [cc[0] - 0.14 + P.COLLAR.bead * Math.cos(deg * RAD), cc[1] + 0.01 - P.COLLAR.bead + P.COLLAR.bead * Math.sin(deg * RAD)]
  lathe(
    soup,
    [
      [fi[0] + 0.15, fi[1] - 0.04, 0.55, 0.05, 0.6],
      [cf[0], cf[1], 0.65, 0.1, 0.45],
      [mix(cf[0], bead(-70)[0], 0.5) + 0.05, mix(cf[1], bead(-70)[1], 0.5), 0.7, 0.2, 0.3],
      [...bead(-70), 0.85, 0.4, 0.12],
      [...bead(-15), 1, 0.8, 0.05],
      [...bead(35), 1, 0.9, 0.04],
      [...bead(80), 1, 0.7, 0.08],
      [glass(cc[1] + 0.03) + 0.16, cc[1] + 0.03, 0.16, 0, 1],
      [glass(cc[1] + 0.3) + 0.06, cc[1] + 0.3, 0.1, 0, 1],
      [glass(cc[1] + 0.28) - 0.1, cc[1] + 0.28, 0.05, 0, 1],
      [glass(cc[1] - 0.28), cc[1] - 0.28, 0.02, 0, 1],
    ],
    facing,
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

const SNOW_FULL = 1.0
const HEAPS = [
  { a0: -138, a1: -78, ea: 20, eb: 15, p: 0.75, t: 0.5, bank: 3.4, r1: 55.4, over: [[-132, -96, 0.8]] },
  { a0: -100, a1: -60, ea: 10, eb: 12, t: 3.0, r0: 47.9, r1: 54.1 },
  { a0: -85, a1: -39, ea: 8, eb: 12, t: 3.0, r0: 47.7, r1: 53.9 },
  { a0: -40, a1: -12.5, ea: 9, eb: 12.5, p: 0.9, t: 3.3, r0: 46.6, r1: 54.3, skew: -0.5, over: [[-30.5, -24, 0.75], [-20.5, -13.5, 0.7]] },
  { a0: -5, a1: 6, ea: 4, eb: 5, t: 1.9, r0: 47.6, r1: 52.7 },
  { a0: -1, a1: 30, ea: 10, eb: 14, p: 1.0, t: 1.6, r0: 47.2, r1: 53.1, skew: -0.6 },
  { a0: 6, a1: 72, ea: 14, eb: 14, p: 1.0, t: 1.8, bank: 2.2, r1: 55, lip: [17, 26, 53.2], skew: -1.2, over: [[27, 35.5, 0.9], [51, 72, 0.9]] },
  { a0: 52, a1: 98, ea: 12, eb: 10, t: 1.9, bank: 2.4, r1: 55, over: [[52, 97, 0.9]] },
  { a0: 84, a1: 138, ea: 15, eb: 20, p: 0.75, t: 0.5, bank: 3.0, r1: 55.4, over: [[80, 132, 1]] },
  { a0: 136, a1: 184, ea: 12, eb: 12, t: 1.6, bank: 0.6, r1: 54.8, over: [[144, 172, 0.9]] },
  { a0: 180, a1: 228, ea: 12, eb: 12, t: 1.5, bank: 0.4, r1: 54.3, over: [[196, 216, 0.6]] },
]

const lipOuter = P.LIP.ringR + P.LIP.tube
const collarEdge = P.COLLAR.crown[0] - 0.14 + P.COLLAR.bead + 0.04
const snowEdge = lipOuter + 1.25
const noseFrom = P.LIP.ringR + 0.3
const turnTo = (az, mid) => {
  let a = az
  while (a - mid > 180) a -= 360
  while (a - mid < -180) a += 360
  return a
}
let hangAz = null

function snowSupport(r) {
  const [fo, fi] = [P.LEDGE.outer, P.LEDGE.inner]
  const floorLine = fi[1] + ((r - fi[0]) * (fo[1] - fi[1])) / (fo[0] - fi[0])
  if (r >= lipOuter) return P.LIP.h - 0.25 - (r - lipOuter) * 2.1
  if (r >= P.LIP.ringR - P.LIP.tube) return Math.max(P.LIP.h + Math.sqrt(Math.max(P.LIP.tube ** 2 - (r - P.LIP.ringR) ** 2, 0)), floorLine)
  if (r >= collarEdge) return Math.max(floorLine, P.COLLAR.crown[1] - (r - collarEdge) * 1.6)
  return P.COLLAR.crown[1]
}

let scallops = null
function scallop(azIn) {
  if (!scallops) {
    const rng = mulberry(4177)
    scallops = []
    let a = -180
    while (a < 180) {
      const w = 2.5 + 11 * rng() ** 2
      scallops.push({ a, w, k: rng() < 0.3 ? 0.05 : 0.35 + 0.65 * rng() })
      a += w
    }
  }
  const az = ((((azIn + 180) % 360) + 360) % 360) - 180
  for (const c of scallops) {
    if (az < c.a || az >= c.a + c.w) continue
    const x = ((az - c.a) / c.w) * 2 - 1
    return c.k * Math.pow(Math.max(1 - x * x, 0), 0.85)
  }
  return 0
}

function hangNear(azIn) {
  hangAz ??= MEASURED.map((m) => onCylinder(m.x, m.y1, P.ICE.r).az)
  let near = 0
  for (const az of hangAz) near = Math.max(near, 1 - smooth(0.9, 2.5, Math.abs(turnTo(azIn, az) - az)))
  return near
}

function snowLobes(azIn) {
  return Math.max(0.1 + 0.9 * scallop(azIn), hangNear(azIn))
}

function overOf(m, az) {
  let w = 0
  for (const [from, to, strength] of m.over ?? []) w = Math.max(w, strength * smooth(from - 2.5, from + 2.5, az) * (1 - smooth(to - 2.5, to + 2.5, az)))
  return w
}

function snowOver(azIn) {
  let best = 0
  for (const m of HEAPS) best = Math.max(best, overOf(m, turnTo(azIn, (m.a0 + m.a1) / 2)))
  return best * snowLobes(azIn)
}

function snowThickness(azIn, r) {
  const u = (azIn + 180) / 360
  const lobes = snowLobes(azIn)
  const wobble = (fbm(u * 60, r / 2.4, 60, 64, 173, 2) - 0.5) * 9
  let sum = 0
  for (const m of HEAPS) {
    const az = turnTo(azIn, (m.a0 + m.a1) / 2)
    const ragged = az + wobble
    const lead = (m.skew ?? 0) * (r - 49)
    const a = smooth(m.a0 + lead, m.a0 + lead + m.ea, ragged) * (1 - smooth(m.a1 - m.eb, m.a1, ragged))
    if (a <= 0) continue
    const over = overOf(m, az) * lobes
    const r1 = m.lip ? mix(m.lip[2], m.r1, smooth(m.lip[0], m.lip[1], az)) : m.r1
    const end = mix(r1, snowEdge - 0.4, over)
    const outer = Math.pow(1 - smooth(end - mix(3.4, 2.6, over), end, r), 0.45)
    const inner = m.r0 ? Math.sqrt(smooth(m.r0 - 0.8, m.r0 + 1.7, r)) : 1
    const bank = (m.bank ?? 0) * (1 - smooth(46, 56, r))
    const t = Math.pow(a, m.p ?? 0.55) * (m.t * inner + bank) * outer * SNOW_FULL
    sum += t ** 4
  }
  const t = Math.pow(sum, 0.25)
  const lump = 0.7 + 0.6 * fbm(u * 46, r / 5.2, 46, 64, 91, 3)
  const heap = 0.7 + 0.6 * fbm(u * 26, r / 7, 26, 64, 119, 2)
  const knob = (fbm(u * 96, r / 3.0, 96, 64, 127, 2) - 0.5) * 2.1 * Math.sqrt(Math.min(t, 4) / 4) + (fbm(u * 230, r / 1.3, 230, 64, 151, 2) - 0.5) * 0.4 * smooth(0.15, 1.1, t)
  const crumb = smooth(0.7, 0.84, fbm(u * 150, r / 2.1, 150, 64, 97, 2)) * 0.55 * smooth(0.04, 0.5, t + 0.25 * fbm(u * 20, r / 9, 20, 64, 103, 2))
  const dust = 0.34 * smooth(0.6, 0.8, fbm(u * 30, r / 6, 30, 64, 109, 3)) * (1 - smooth(45.5, 49.5, r))
  const loose = r > collarEdge + 1.4 ? 1 : 0
  return Math.max(t * lump * heap + knob, 0.55 * t, crumb * loose, dust * loose) - 0.1
}

export function buildSnow() {
  const soup = new Soup('snow')
  const cols = azList(-180, 180, (az) => (front(az) <= 132 ? 0.55 : 2.6), 48)
  const inner = 11
  const mid = 7
  const nose = 9
  const rowsN = inner + mid + nose
  const repeats = Math.round((2 * Math.PI * 48) / SNOW.tileMm)
  const grid = []
  const heavy = cols.map((az) => snowOver(az) * smooth(0.05, 0.6, Math.max(snowThickness(az, noseFrom), 0)))
  const spread = 2
  const eased = heavy.map((_, i) => {
    let sum = 0
    let weight = 0
    for (let d = -spread; d <= spread; d++) {
      const k = spread + 1 - Math.abs(d)
      sum += k * heavy[(i + d + cols.length) % cols.length]
      weight += k
    }
    return Math.min(heavy[i], sum / weight) * 0.4 + (sum / weight) * 0.6
  })
  for (let i = 0; i < cols.length; i++) {
    const az = cols[i]
    let lo = P.COLLAR.crown[0] - 0.3
    let hi = 50.4
    for (let it = 0; it < 18; it++) {
      const at = (lo + hi) / 2
      if (P.sphereRadiusAt(snowSupport(at) + Math.max(snowThickness(az, at), 0)) > at) lo = at
      else hi = at
    }
    const rin = lo - 0.25
    const column = []
    const u = (az + 180) / 360
    const w = eased[i]
    const tA = Math.max(snowThickness(az, noseFrom), 0)
    const hA = snowSupport(noseFrom) + tA
    const near = hangNear(az)
    const hB = P.LIP.h - 0.25 - (0.25 + 1.1 * fbm(u * 53, 0.71, 53, 4, 137, 3)) - 0.9 * near
    const reachOut = lipOuter + 0.45 + 0.9 * fbm(u * 37, 0.13, 37, 4, 139, 3) + 0.8 * near - noseFrom
    const low = mix(Math.min(hA - 0.15, P.LIP.h + 0.62), hB, smooth(0.3, 1, w))
    const reach = Math.max(0.6, reachOut * w)
    const turn = smooth(0, 0.22, w)
    for (let j = 0; j < rowsN; j++) {
      const k = j - inner - mid + 1
      const r = j < inner ? mix(rin, 50.4, j / inner) : k <= 0 ? mix(50.4, noseFrom, (j - inner) / (mid - 1)) : mix(noseFrom, snowEdge + 0.25, k / nose)
      const t = snowThickness(az, r)
      const flat = { r, t, h: snowSupport(r) + (t > 0 ? t : Math.max(t * 3, -0.45)), ru: r }
      if (k <= 0 || turn <= 0) {
        column.push(flat)
        continue
      }
      const th = (90 - (k * 200) / nose) * RAD
      const hung = { r: noseFrom + reach * Math.cos(th), h: (hA + low) / 2 + ((hA - low) / 2) * Math.sin(th), t: mix(Math.max(tA, 0.6), 0.34, smooth(nose / 3, nose, k)), ru: noseFrom + (k * 3.85) / nose }
      column.push({ r: mix(flat.r, hung.r, turn), h: mix(flat.h, hung.h, turn), t: mix(flat.t, hung.t, turn), ru: mix(flat.ru, hung.ru, turn) })
    }
    grid.push(column)
  }
  const first = soup.count
  for (let j = 0; j < rowsN; j++) {
    for (let i = 0; i < cols.length; i++) {
      const g = grid[i][j]
      soup.vert(place(g.r, g.h, cols[i]), [0, 1, 0], [(cols[i] / 360) * repeats, -g.ru / SNOW.tileMm], [0, 0], [clamp(g.t / 1.6), clamp(0.35 + 0.65 * fbm(((cols[i] + 180) / 360) * 80, g.ru / 3, 80, 64, 131, 2)), 1])
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

const ICE_RISE = 0.9
const MEASURED = [
  { x: 922, y0: 1070, y1: 1188, w: [22, 24, 23, 19, 12], spread: 17, lean: -0.45, bow: 0.25 },
  { x: 948, y0: 1085, y1: 1188, w: [17, 19, 21, 17, 11], spread: 15, lean: 0.3, drop: 0.5 },
  { x: 985, y0: 1090, y1: 1188, w: [13, 21, 24, 18, 8], lean: 0.2, bow: -0.3 },
  { x: 1045, y0: 1105, y1: 1198, w: [34, 29, 24, 19, 16], lean: 0.15 },
  { x: 1090, y0: 1110, y1: 1205, w: [29, 26, 22, 18, 15], lean: -0.3, drop: 0.5 },
  { x: 1167, y0: 1125, y1: 1275, w: [44, 35, 29, 23, 14], spread: 27, lean: -0.6, bow: 0.5, bulb: [0.62, 0.12] },
  { x: 1242, y0: 1125, y1: 1222, w: [20, 18, 15, 12, 9], spread: 13, lean: -0.35 },
  { x: 1262, y0: 1125, y1: 1222, w: [30, 26, 21, 16, 12], spread: 18, lean: 0.35, bulb: [0.45, 0.1] },
  { x: 1452, y0: 1135, y1: 1210, w: [33, 28, 23, 19, 15], spread: 22, lean: 0.1 },
  { x: 1512, y0: 1135, y1: 1228, w: [40, 27, 19, 13, 7], spread: 25, lean: 0.25, bow: -0.2 },
  { x: 1578, y0: 1132, y1: 1212, w: [22, 27, 24, 17, 11], lean: -0.2, drop: 0.6 },
  { x: 1684, y0: 1110, y1: 1300, w: [47, 37, 26, 18, 11], spread: 30, lean: -0.7, bow: 0.6, bulb: [0.3, 0.1] },
  { x: 1745, y0: 1105, y1: 1220, w: [21, 20, 17, 12, 8], spread: 14, lean: 0.2 },
  { x: 1765, y0: 1100, y1: 1215, w: [28, 26, 22, 15, 10], spread: 17, lean: 0.35 },
  { x: 1835, y0: 1090, y1: 1215, w: [33, 31, 27, 21, 15], lean: -0.2, bulb: [0.2, 0.12] },
  { x: 1868, y0: 1080, y1: 1210, w: [19, 18, 16, 12, 8], spread: 13 },
  { x: 1888, y0: 1075, y1: 1215, w: [21, 20, 18, 14, 10], spread: 13, lean: 0.2, drop: 0.4 },
  { x: 1900, y0: 1070, y1: 1200, w: [14, 13, 11, 9, 6], lean: 0.3 },
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

function through(xs, ys, x) {
  let i = 0
  while (i + 2 < xs.length && x > xs[i + 1]) i++
  const slope = (k) => {
    const a = Math.max(k - 1, 0)
    const b = Math.min(k + 1, xs.length - 1)
    return (ys[b] - ys[a]) / (xs[b] - xs[a])
  }
  const h = xs[i + 1] - xs[i]
  const u = clamp((x - xs[i]) / h)
  const u2 = u * u
  const u3 = u2 * u
  return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * slope(i) + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * slope(i + 1)
}

function icicleShape(it) {
  const rng = mulberry(977 + 131 * Math.round((it.az + 360) * 10))
  const total = it.length + 0.5 + P.ICE.up + ICE_RISE
  const cap = clamp(1.15 * it.r[4], 0.3, 1.4) / total
  const dome = 0.3 / total
  const knots = [0, 0.25, 0.5, 0.75, 1 - cap]
  const a1 = 0.03 + 0.06 * rng()
  const p1 = 3.2 + 3.3 * rng()
  const k1 = rng()
  const a2 = 0.012 + 0.022 * rng()
  const p2 = 1.5 + 0.9 * rng()
  const k2 = rng()
  const oval = 0.9 + 0.22 * rng()
  const a0 = rng() * 6.28
  const a3 = rng() * 6.28
  const twist = (rng() - 0.5) * 3
  const flute = 0.03 + 0.05 * rng()
  const off = 0.15 + (rng() - 0.5) * 0.3
  const body = (t) => {
    const u = (t - 1 + cap) / cap
    const core = u < 0 ? Math.max(through(knots, it.r, t), 0.05) : it.r[4] * Math.sqrt(Math.max(1 - u * u, 0))
    const lumps = 1 + (a1 * Math.sin(2 * Math.PI * ((t * total) / p1 + k1)) + a2 * Math.sin(2 * Math.PI * ((t * total) / p2 + k2))) * smooth(0, 0.1, t) * (1 - smooth(-0.6, 0.2, u))
    const bulb = it.bulb ? 1 + it.bulb[1] * Math.exp(-(((t - it.bulb[0]) / 0.08) ** 2)) : 1
    const drop = 1 + 0.42 * it.drop * Math.exp(-(((u - 0.4) / 0.42) ** 2))
    const top = t < dome ? Math.sqrt(Math.max(1 - (1 - t / dome) ** 2, 0)) : 1
    return core * lumps * bulb * drop * top
  }
  const along = (t) => 1 + (it.spread > it.r[0] ? (it.spread / it.r[0] - 1) * Math.exp(-Math.pow(Math.max(t * total - 0.9, 0) / 1.5, 2)) : 0.12 * Math.exp(-(t * total) / 0.8))
  const section = (al, t) => {
    const r = body(t) * (1 + flute * Math.cos(2 * al + a0 + twist * t) + 0.025 * Math.cos(3 * al + a3 - twist * t))
    return [Math.cos(al) * r * (2 - oval), Math.sin(al) * r * oval * along(t)]
  }
  return { total, cap, dome, body, section, off }
}

export function icicleList(f) {
  const list = []
  for (const m of MEASURED) {
    const foot = onCylinder(m.x, m.y1, P.ICE.r)
    const scale = 9.0 + 0.9 * clamp(foot.z / P.ICE.r, 0, 1)
    const r = m.w.map((w) => clamp((w / scale / 2) * 1.05, 0.2, 2.6))
    list.push({ az: foot.az, length: clamp((m.y1 - m.y0) / scale + 0.6, 3, 19), radius: r[0], r, spread: (m.spread ?? 0) / scale, swing: m.lean ?? 0, bow: m.bow ?? 0, bulb: m.bulb ?? null, drop: m.drop ?? 0, measured: true })
  }
  const rng = mulberry(20261123)
  let az = 97
  while (az < 262) {
    const big = rng() < 0.3
    const r0 = big ? 1.4 + 0.9 * rng() : 0.75 + 0.6 * rng()
    const kind = rng()
    const form = kind < 0.3 ? [1, 0.84, 0.68, 0.52, 0.38] : kind < 0.55 ? [0.6, 0.95, 1, 0.72, 0.34] : kind < 0.8 ? [1, 0.66, 0.44, 0.3, 0.16] : [1, 0.9, 0.7, 0.48, 0.24]
    const r = form.map((v) => Math.max(r0 * v * (0.92 + 0.16 * rng()), 0.2))
    list.push({ az: az > 180 ? az - 360 : az, length: big ? 11 + 7 * rng() : 4.5 + 6.5 * rng(), radius: r[0], r, spread: rng() < 0.35 ? r[0] * (1.3 + 0.5 * rng()) : 0, swing: (rng() - 0.5) * 1.2, bow: (rng() - 0.5) * 0.8, bulb: rng() < 0.3 ? [0.2 + 0.5 * rng(), 0.08 + 0.08 * rng()] : null, drop: rng() < 0.4 ? 0.3 + 0.5 * rng() : 0, measured: false })
    az += rng() < 0.3 ? 2.2 + 1.5 * rng() : 6 + 12 * rng()
  }
  list.sort((a, b) => a.az - b.az)
  const mer = f.mer
  return list.map((it, id) => {
    const shape = icicleShape(it)
    let need = 0
    for (let k = 3; k <= 10; k++) {
      const t = k / 10
      const s = P.sOfH(mer, Math.max(P.ICE.h - it.length * t, 7.6))
      let relief = 0
      for (const da of [-1.6, -0.8, 0, 0.8, 1.6]) for (const ds of [-0.8, 0, 0.8]) relief = Math.max(relief, f.atSoft(it.az + da, s + ds))
      const wood = P.atS(mer, s).r + relief * P.CARVING.relief
      need = Math.max(need, (wood + 0.4 + shape.body(Math.min(t, 0.999)) * 1.1 - P.ICE.r - shape.off) / Math.pow(t, 1.3))
    }
    return { ...it, id, lean: need, shape }
  })
}

export function buildIce(list) {
  const soup = new Soup('ice')
  for (const it of list) {
    const back = front(it.az) > 135
    const around = back ? 6 : 20
    const { total, cap, dome, body, section, off } = it.shape
    const ts = []
    const domeRows = back ? 2 : 5
    for (let j = 0; j < domeRows; j++) ts.push(dome * (1 - Math.cos((Math.PI / 2) * (j / domeRows))))
    const bodyRows = back ? 6 : clamp(Math.round(total / 0.42), 18, 44)
    for (let j = 0; j < bodyRows; j++) ts.push(dome + (1 - cap - dome) * (j / bodyRows))
    const capRows = back ? 2 : 6
    for (let j = 0; j <= capRows; j++) ts.push(1 - cap + cap * Math.sin((Math.PI / 2) * (j / capRows)))
    const root = place(P.ICE.r + off, P.ICE.h + 0.5 + P.ICE.up + ICE_RISE, it.az)
    const out = dir(1, 0, it.az)
    const side = [Math.cos(it.az * RAD), 0, -Math.sin(it.az * RAD)]
    const axis = (t) => add3(add3(add3(root, [0, -1, 0], total * t), out, it.lean * Math.pow(t, 1.3)), side, it.swing * t * t + it.bow * Math.sin(Math.PI * t) * (1 - 0.5 * t))
    const surface = (al, t) => {
      const [o, s] = section(al, t)
      return add3(add3(axis(t), out, o), side, s)
    }
    soup.grid(around + 1, ts.length, (i, j) => {
      const al = (i / around) * 2 * Math.PI
      const t = ts[j]
      const p = surface(al, t)
      const e = 0.012
      const tn = clamp(t, 0.1 * dome, 1 - 0.08 * cap)
      const da = add3(surface(al + e, tn), surface(al - e, tn), -1)
      const dt = add3(surface(al, Math.min(tn + e * 0.5, 1 - 0.02 * cap)), surface(al, Math.max(tn - e * 0.5, 0)), -1)
      let n = norm3(cross3(da, dt))
      const radial = add3(scale3(out, Math.cos(al)), side, Math.sin(al))
      if (dot3(n, add3(radial, [0, t < dome ? 1 : t > 1 - cap ? -1 : 0, 0])) < 0) n = scale3(n, -1)
      if (t >= 1) n = [0, -1, 0]
      if (t <= 0) n = norm3(add3(scale3(radial, 0.2), [0, 1, 0]))
      return { p, n, uv: [t, it.id], uv2: [i / around, clamp(body(t) / it.radius, 0, 2)], c: [root[0] / 128 + 0.5, root[1] / 128 + 0.5, root[2] / 128 + 0.5] }
    })
  }
  return { soup }
}
