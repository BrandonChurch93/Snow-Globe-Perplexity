import { Soup, clamp, cross3, dot3, fbm, mix, mulberry, norm3, smooth } from './lib.mjs'
import * as P from './profile.mjs'

const RAD = P.RAD
export const TILE_MM = 9.6
export const SAND_TILE_MM = 6.4
const place = (r, h, az) => [r * Math.sin(az * RAD), h, r * Math.cos(az * RAD)]

function stonePoint(f, az, s) {
  const q = P.atS(f.mer, s)
  const d = f.dAt(az, s)
  return place(q.r + q.nr * d, q.h + q.nh * d, az)
}

function stoneNormal(f, az, s) {
  const e = 0.12
  const a = stonePoint(f, az - e, s)
  const b = stonePoint(f, az + e, s)
  const c = stonePoint(f, az, Math.max(s - 0.1, 0))
  const d = stonePoint(f, az, Math.min(s + 0.1, f.mer.total))
  return norm3(cross3([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [d[0] - c[0], d[1] - c[1], d[2] - c[2]]))
}

function lathe(soup, profile, cols) {
  const normals = profile.map((_, i) => {
    const a = profile[Math.max(i - 1, 0)]
    const b = profile[Math.min(i + 1, profile.length - 1)]
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l]
  })
  soup.grid(cols.length, profile.length, (i, j) => {
    const az = cols[i]
    const [r, h, ao] = profile[j]
    return { p: place(r, h, az), n: place(normals[j][0], normals[j][1], az), uv: [(az / 360) * 38, h / TILE_MM], uv2: [P.uOfAz(az), 1], c: [ao, 0, 1] }
  })
}

export function buildStone(f) {
  const soup = new Soup('stone')
  const cols = []
  for (let az = -180; az < 180 - 1e-6; az += Math.abs(az + 0.2) <= P.FRONT_DEG + 6 ? 0.45 : 1.5) cols.push(az)
  cols.push(180)
  const rows = 152
  const repeats = Math.round((2 * Math.PI * 56) / TILE_MM)
  soup.grid(cols.length, rows, (i, j) => {
    const az = cols[i]
    const s = (j / (rows - 1)) * f.mer.total
    const u = P.uOfAz(az)
    const v = s / f.mer.total
    const cavity = f.at(f.d, u, v) - f.at(f.broad, u, v)
    const q = P.atS(f.mer, s)
    const under = smooth(0.0, 1.2, q.h)
    return { p: stonePoint(f, az, s), n: stoneNormal(f, az, s), uv: [(az / 360) * repeats, s / TILE_MM], uv2: [az === 180 ? 1 : u, v], c: [clamp(0.78 + 0.5 * cavity) * (0.25 + 0.75 * under), clamp(0.5 + 0.6 * cavity), 0] }
  })
  const body = soup.triangles
  const even = (n) => Array.from({ length: n + 1 }, (_, i) => -180 + (360 * i) / n)
  const cc = P.COLLAR.crown
  const glass = (h) => P.sphereRadiusAt(h) + P.COLLAR.gap
  lathe(
    soup,
    [
      [cc[0] - 0.13, cc[1], 0.5],
      [glass(cc[1] + 0.03) + 0.16, cc[1] + 0.05, 0.16],
      [glass(cc[1] + 0.3) + 0.06, cc[1] + 0.3, 0.1],
      [glass(cc[1] + 0.28) - 0.1, cc[1] + 0.28, 0.05],
      [glass(cc[1] - 0.28), cc[1] - 0.28, 0.02],
    ],
    even(192),
  )
  const cup = []
  const big = P.SPHERE_R + P.CUP.offset
  const beta1 = Math.acos((P.CENTRE_H - (cc[1] - 0.22)) / big)
  for (let i = 0; i <= 7; i++) {
    const beta = beta1 * (1 - i / 7)
    cup.push([Math.max(big * Math.sin(beta), 0.01), P.CENTRE_H - big * Math.cos(beta), 0.03])
  }
  lathe(soup, cup, even(48))
  lathe(soup, [[0.01, 0.02, 0.02], [P.BODY[0][0] - 0.25, 0.02, 0.02]].reverse(), even(48))
  return { soup, body, repeats }
}

// A surface given in the frame of something set into the stone: x along the ring, y up the wall, z out of it. The frame is bent
// to the wall, so a thing lies on the stone from edge to edge and no side of it stands off.
function frameOf(f, it) {
  const s = it.s ?? P.sOfH(f.mer, it.h)
  const d0 = f.dAt(it.az, s)
  const q0 = P.atS(f.mer, s)
  const o = place(q0.r + q0.nr * d0, q0.h + q0.nh * d0, it.az)
  const ez = norm3(place(q0.nr, q0.nh, it.az))
  const t = (it.turn ?? 0) * RAD
  const world = (p) => {
    const a = p[0] * Math.cos(t) - p[1] * Math.sin(t)
    const b = p[0] * Math.sin(t) + p[1] * Math.cos(t)
    const q = P.atS(f.mer, s + b)
    const d = d0 + p[2]
    return place(q.r + q.nr * d, q.h + q.nh * d, it.az + a / (q0.r * RAD))
  }
  return { o, ez, world }
}

function surf(soup, fr, nu, nv, local, attr, wrapU = false) {
  const pts = []
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) pts.push(local(i / (nu - 1), j / (nv - 1)))
  const wp = pts.map(fr.world)
  const at = (i, j) => wp[Math.min(Math.max(j, 0), nv - 1) * nu + (wrapU ? ((i % (nu - 1)) + (nu - 1)) % (nu - 1) : Math.min(Math.max(i, 0), nu - 1))]
  const under = [fr.o[0] - 0.5 * fr.ez[0], fr.o[1] - 0.5 * fr.ez[1], fr.o[2] - 0.5 * fr.ez[2]]
  let sign = 0
  const normals = []
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = at(i - 1, j)
    const b = at(i + 1, j)
    const c = at(i, j - 1)
    const d = at(i, j + 1)
    let n = cross3([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [d[0] - c[0], d[1] - c[1], d[2] - c[2]])
    const l = Math.hypot(n[0], n[1], n[2])
    const p = at(i, j)
    // Where a whole row is one point (the middle of a dome, the hinge of a shell) there is no slope to read: the normal there is the frame's own, set after the others have chosen their side.
    if (!(l > 1e-9)) {
      normals.push(null)
      continue
    }
    n = [n[0] / l, n[1] / l, n[2] / l]
    sign += n[0] * (p[0] - under[0]) + n[1] * (p[1] - under[1]) + n[2] * (p[2] - under[2])
    normals.push(n)
  }
  const k = sign < 0 ? -1 : 1
  for (let q = 0; q < normals.length; q++) if (!normals[q]) normals[q] = [fr.ez[0] * k, fr.ez[1] * k, fr.ez[2] * k]
  soup.grid(nu, nv, (i, j) => {
    const p = pts[j * nu + i]
    const n = normals[j * nu + i]
    const a = attr(i / (nu - 1), j / (nv - 1), p)
    return { p: wp[j * nu + i], n: [n[0] * k, n[1] * k, n[2] * k], uv: a.uv ?? [p[0] / 4, p[1] / 4], uv2: a.uv2, c: a.c }
  })
}

const tone = (c, k) => [c[0] * k, c[1] * k, c[2] * k]

function scallop(soup, fr, it, rnd, opt) {
  const R = it.r * 1.24
  const long = it.long ?? 1
  const spread = opt.spread * RAD
  const ribs = opt.ribs
  const hinge = -0.9 * R * long
  // The two ears beside the hinge: small ridged tabs between the hinge line and the fan's first rib.
  if (opt.ears) {
    for (const side of [-1, 1]) {
      surf(
        soup,
        fr,
        4,
        3,
        (u, v) => {
          const ex = side * R * (0.5 + 0.02 * u)
          const ey = hinge + R * (-0.07 + 0.24 * u)
          return [(ex * v) / long, hinge + (ey - hinge) * v, -0.02 * R + 0.035 * R * Math.sin(u * Math.PI) * v + 0.012 * R * Math.cos(u * 4 * Math.PI) * v]
        },
        (u, v) => {
          const k = (0.86 + 0.1 * Math.cos(u * 4 * Math.PI)) * (0.84 + 0.16 * v)
          return { uv: [u, v], uv2: [0.62 + 0.3 * v, 0.25], c: [it.c[0] * k, it.c[1] * k, it.c[2] * k * 0.96] }
        },
      )
    }
  }
  const ribAt = (th) => Math.pow(0.5 + 0.5 * Math.cos(ribs * Math.PI * (th / spread)), 0.55)
  surf(
    soup,
    fr,
    opt.ears ? 83 : 89,
    34,
    (u, v) => {
      const th = (u * 2 - 1) * spread
      const sx = Math.sin(th)
      const cx = Math.cos(th)
      const b = hinge * cx
      const reach = -b + Math.sqrt(Math.max(b * b - (hinge * hinge - R * R * long * long), 0))
      const rib = ribAt(th)
      const L = reach * (1 + 0.04 * (rib - 0.5) * smooth(0.6, 1, v)) * (1 - 0.1 * Math.pow(Math.abs(th / spread), 6))
      const rho = Math.pow(v, 0.9)
      const x = (sx * L * rho) / long
      const y = hinge + cx * L * rho
      const dome = opt.dome * R * Math.pow(Math.max(4 * rho * (1 - rho * 0.95), 0), 0.62) * (1 - 0.35 * (th / spread) ** 2)
      const grow = rho * 7.5 + 0.5 * rnd.k
      const step = grow - Math.floor(grow)
      const z = dome + opt.rib * R * Math.pow(rho, 0.6) * (rib - 0.6) * (1 - 0.4 * smooth(0.9, 1, rho)) + 0.02 * R * (step * step - 0.33) * smooth(0.12, 0.4, rho) - 0.12 * R + 0.1 * R * (1 - rho)
      return [x, y, z]
    },
    (u, v) => {
      const th = (u * 2 - 1) * spread
      const rib = ribAt(th)
      const rho = Math.pow(v, 0.9)
      const grow = rho * 7.5 + 0.5 * rnd.k
      const step = grow - Math.floor(grow)
      const band = 0.5 + 0.5 * Math.sin(v * 31 + 6 * rnd.k + 1.5 * Math.sin(u * 9))
      const k = (0.84 + 0.16 * rib) * (0.9 + 0.1 * band) * (0.86 + 0.14 * step) * (0.8 + 0.2 * smooth(0, 0.35, v))
      const fold = mix((0.3 + 0.7 * rib * smooth(0.02, 0.2, v)) * (0.55 + 0.45 * smooth(1.0, 0.86, rho)), 0.92, it.plain ?? 0)
      return { uv: [u * ribs * 0.5, v * 3], uv2: [fold, it.gloss ?? 0.3], c: [it.c[0] * k, it.c[1] * k * (0.97 + 0.03 * band), it.c[2] * k * (0.92 + 0.08 * band)] }
    },
  )
}

function snail(soup, fr, it, rnd) {
  const R = it.r * 1.45
  const turns = 2.7
  const band = it.band ?? [0.5, 0.28, 0.14]
  surf(
    soup,
    fr,
    112,
    11,
    (u, v) => {
      const g = Math.exp(-2.35 * (1 - u))
      const phi = u * turns * 2 * Math.PI
      const rc = 0.6 * R * g
      const rt = 0.43 * R * g * (1 - 0.6 * smooth(0.95, 1, u))
      const psi = (v * 2 - 1) * 105 * RAD
      const rad = rc + rt * Math.sin(psi)
      const z = 0.62 * R * (1 - g) + rt * Math.cos(psi) * 0.95 - 0.25 * R - 0.5 * R * smooth(0.9, 1, u)
      return [rad * Math.cos(phi), rad * Math.sin(phi), z]
    },
    (u, v) => {
      const psi = v * 2 - 1
      const stripe = smooth(0.25, 0.6, 0.5 + 0.5 * Math.sin(psi * 7.5 + 1.2 + 0.6 * Math.sin(u * 60 + rnd.k * 9)))
      const growth = 0.94 + 0.06 * Math.sin(u * 240)
      const seam = 0.45 + 0.55 * smooth(0.0, 0.3, 1 - Math.abs(psi))
      const c = [mix(it.c[0], band[0], 0.75 * stripe) * growth, mix(it.c[1], band[1], 0.75 * stripe) * growth, mix(it.c[2], band[2], 0.75 * stripe) * growth]
      return { uv: [u * 30, v * 2], uv2: [seam, 0.7], c }
    },
  )
}

function dome(soup, fr, it, rnd, a, b, c, sink, gloss, groove) {
  surf(
    soup,
    fr,
    groove ? 41 : 19,
    groove ? 15 : 9,
    (u, v) => {
      const phi = u * 2 * Math.PI
      const al = Math.pow(v, 0.8) * 108 * RAD
      const x = a * Math.sin(al) * Math.cos(phi)
      const y = b * Math.sin(al) * Math.sin(phi)
      const z = c * Math.cos(al) - sink - (groove ? 0.07 * c * Math.exp(-((y / (0.13 * b)) ** 2)) * smooth(1, 0.3, Math.abs(x) / a) : 0)
      return [x, y, z]
    },
    (u, v, p) => {
      const k = groove ? 0.93 + 0.07 * Math.sin(p[1] * 5 + rnd.k * 4) : 1
      return { uv: [u * 4, v * 2], uv2: [0.5 + 0.5 * smooth(1, 0.45, v), gloss], c: tone(it.c, k) }
    },
    true,
  )
}

function seaGlass(soup, fr, it, rnd) {
  const R = it.r * 1.08
  const long = it.long ?? 1
  const tri = Math.min(it.tri ?? 0.04 + 0.05 * rnd.a, 0.085)
  const two = 0.05 + 0.07 * rnd.b
  const p2 = rnd.c * 6.28
  const p3 = rnd.d * 6.28
  const T = Math.min(0.62 * R, 2.1)
  // How thick the piece is under a point, 1 in the middle and 0 at the rim: level in the middle, so nothing made of it comes to a point there.
  const thick = (v) => Math.pow(Math.max(1 - Math.pow(Math.sin((v * Math.PI) / 2), 2.6), 0), 0.5)
  surf(
    soup,
    fr,
    49,
    13,
    (u, v) => {
      const phi = u * 2 * Math.PI
      const out = R * (1 + two * Math.cos(2 * phi + p2) + tri * Math.cos(3 * phi + p3) + 0.012 * Math.cos(5 * phi + p2 * 2) + 0.004 * Math.cos(8 * phi + p3 * 3))
      const rho = Math.sin((v * Math.PI) / 2)
      const lump = 1 + 0.12 * (fbm(u * 5 + rnd.a * 9, v * 2 + rnd.b * 5, 5, 64, 91, 2) - 0.5) * smooth(0.25, 0.6, rho)
      return [out * rho * Math.cos(phi), out * rho * Math.sin(phi) * long, T * thick(v) * lump - 0.3 * T]
    },
    (u, v, p) => ({ uv: [p[0] / 3, p[1] / 3], uv2: [thick(v), it.frost ? 1 : 0.25 + 0.3 * rnd.a], c: it.c }),
    true,
  )
}

export function buildSet(f) {
  const shells = new Soup('shells')
  const glass = new Soup('seaglass')
  const count = { glass: 0, scallop: 0, cockle: 0, snail: 0, olive: 0, pearl: 0 }
  P.SET.forEach((it, i) => {
    const r = mulberry(4000 + i * 37)
    const rnd = { a: r(), b: r(), c: r(), d: r(), k: r() }
    const fr = frameOf(f, it)
    count[it.kind]++
    if (it.kind === 'glass') seaGlass(glass, fr, it, rnd)
    else if (it.kind === 'scallop') scallop(shells, fr, it, rnd, { spread: 74, ribs: it.ribs ?? 9, dome: 0.3, rib: it.rib ?? 0.13, ears: true })
    else if (it.kind === 'cockle') scallop(shells, fr, it, rnd, { spread: it.spread ?? 86, ribs: it.ribs ?? 11, dome: it.dome ?? 0.46, rib: it.rib ?? 0.1 })
    else if (it.kind === 'snail') snail(shells, fr, it, rnd)
    else if (it.kind === 'olive') dome(shells, fr, it, rnd, it.r * 1.12, it.r * 0.76, it.r * 0.56, 0.1 * it.r, 0.85, true)
    else dome(shells, fr, it, rnd, it.r, it.r, it.r, 0.3 * it.r, 1, false)
  })
  return { shells, glass, count }
}

// The sand on the ledge: it lies in the seat against the glass and thins to single grains toward the rim, and at SPILL runs over it.
export const SPILL = { az: 80, half: 17, lipR: 52.5, lipH: 38.8 + P.RISE }
export const spillAt = (az) => {
  let d = az - SPILL.az
  d -= 360 * Math.round(d / 360)
  return Math.exp(-((d / SPILL.half) ** 2))
}
export function ledgeSand(f, az, t) {
  const A = (((az % 360) + 360) % 360) / 360
  const sp = spillAt(az)
  const reach = Math.min(3.6 + 3.2 * fbm(A * 17, 0.7, 17, 4, 203, 3) + 5.5 * sp, 9.2)
  const s = f.mer.total - 0.1 - reach * t
  const q = P.atS(f.mer, s)
  const d = f.dAt(az, s)
  const heap = 0.55 + 0.9 * (fbm(A * 11, 0.3, 11, 4, 201, 3) - 0.35) + 0.9 * sp
  const fall = Math.pow(1 - t, 1.25)
  const lumps = (0.5 * (fbm(A * 60, t * 3, 60, 64, 205, 3) - 0.5) + 0.22 * (fbm(A * 170, t * 7, 170, 64, 207, 2) - 0.5)) * Math.sin(Math.PI * Math.min(t * 1.15, 1))
  const lee = 1 - 0.97 * smooth(-45, -75, az) * smooth(-178, -150, az)
  const thick = (Math.max(Math.max(heap, 0.25) * 1.5 * fall + lumps * (0.3 + sp), 0) + 0.04) * lee
  const lift = 0.03 + 0.45 * thick
  const h = q.h + q.nh * (d + lift)
  const r = Math.max(q.r + q.nr * (d + lift), P.sphereRadiusAt(h) + 0.06)
  return { r, h, thick }
}

export function buildSand(f) {
  const soup = new Soup('sand')
  const cols = 720
  const rows = 22
  const pt = (i, j) => {
    const az = -180 + (360 * i) / cols
    const q = ledgeSand(f, az, j / (rows - 1))
    return { q, az, p: place(q.r, q.h, az) }
  }
  soup.grid(cols + 1, rows, (i, j) => {
    const { q, az, p } = pt(i, j)
    const a = pt(i - 1, j).p
    const b = pt(i + 1, j).p
    const c = pt(i, Math.max(j - 1, 0)).p
    const d = pt(i, Math.min(j + 1, rows - 1)).p
    let n = norm3(cross3([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [d[0] - c[0], d[1] - c[1], d[2] - c[2]]))
    if (n[1] < 0) n = [-n[0], -n[1], -n[2]]
    return { p, n, uv: [p[0] / SAND_TILE_MM, p[2] / SAND_TILE_MM], uv2: [0, 0], c: [clamp(q.thick / 1.2), 0.55 + 0.45 * smooth(0, 0.5, j / (rows - 1)), 0] }
  })
  const ring = soup.triangles
  // The drape: sand running down the wall under the spill.
  const dc = 96
  const dr = 40
  const top = P.sOfH(f.mer, 39.3 + P.RISE)
  const drape = (i, j) => {
    const az = SPILL.az - 30 + (60 * i) / (dc - 1)
    const down = j / (dr - 1)
    const s = top - down * 15
    const A = (az + 360) / 360
    const across = spillAt(az)
    const stream = smooth(0.42, 0.62, fbm(A * 260, down * 1.5, 2600, 64, 213, 2)) * (1 - 0.5 * smooth(0.2, 1, down))
    const tongue = across * stream * (1.15 - down * (0.9 + 0.9 * fbm(A * 40, 0.4, 400, 4, 209, 2)))
    const thick = Math.max(tongue, 0) * 0.9 * (0.6 + 0.8 * fbm(A * 90, down * 6, 900, 64, 211, 2)) * smooth(0, 0.06, down + 0.02)
    const q = P.atS(f.mer, s)
    const d = f.dAt(az, s) + 0.05 + thick
    return { thick, p: place(q.r + q.nr * d, q.h + q.nh * d, az) }
  }
  soup.grid(dc, dr, (i, j) => {
    const { thick, p } = drape(i, j)
    const a = drape(Math.max(i - 1, 0), j).p
    const b = drape(Math.min(i + 1, dc - 1), j).p
    const c = drape(i, Math.max(j - 1, 0)).p
    const d = drape(i, Math.min(j + 1, dr - 1)).p
    let n = norm3(cross3([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [d[0] - c[0], d[1] - c[1], d[2] - c[2]]))
    if (dot3(n, [p[0], 0, p[2]]) < 0) n = [-n[0], -n[1], -n[2]]
    return { p, n, uv: [(Math.atan2(p[0], p[2]) * 56) / SAND_TILE_MM, p[1] / SAND_TILE_MM], uv2: [j / (dr - 1), 0], c: [clamp(thick / 1.2), 0.8, 1] }
  })
  return { soup, ring, drape: soup.triangles - ring }
}
