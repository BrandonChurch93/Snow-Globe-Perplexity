import { loadConfig } from './paths.mjs'

const cfg = loadConfig()
export const LENS_STEPS = 12
export const lensRadiusMm = cfg.globe.sphereDiameterMm / 2
export const innerRadiusMm = lensRadiusMm - cfg.globe.glassThicknessMm
export const lensIor = cfg.globe.liquidIor
export const sphereCentreMm = cfg.globe.baseHeightMm - cfg.globe.collarDepthMm + cfg.globe.sphereDiameterMm / 2

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a) => Math.hypot(a[0], a[1], a[2])
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

function refract2(dx, dy, nx, ny, eta) {
  const c = nx * dx + ny * dy
  const k = 1 - eta * eta * (1 - c * c)
  const m = eta * c + Math.sqrt(Math.max(k, 0))
  return [eta * dx - m * nx, eta * dy - m * ny]
}

export function lensPlace(p, eye, centre, radius = lensRadiusMm, ior = lensIor, steps = LENS_STEPS) {
  const oe = sub(eye, centre)
  const dist = len(oe)
  if (dist < radius * 1.0001) return { apparent: [p[0], p[1], p[2]], exit: [p[0], p[1], p[2]], pathMm: 0, seen: true }
  const u = [oe[0] / dist, oe[1] / dist, oe[2] / dist]
  const op = sub(p, centre)
  const a = dot(op, u)
  const side = [op[0] - a * u[0], op[1] - a * u[1], op[2] - a * u[2]]
  const b = len(side)
  let v
  if (b > 1e-5) v = [side[0] / b, side[1] / b, side[2] / b]
  else {
    const c = cross(u, Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])
    const l = len(c)
    v = [c[0] / l, c[1] / l, c[2] / l]
  }
  const cl = radius / dist
  const lx = cl
  const ly = Math.sqrt(Math.max(1 - cl * cl, 0))
  const eta = 1 / ior
  const normalAt = (s) => {
    const x = 1 + (lx - 1) * s
    const y = ly * s
    const l = Math.hypot(x, y)
    return [x / l, y / l]
  }
  const miss = (s) => {
    const [nx, ny] = normalAt(s)
    const ax = nx * radius
    const ay = ny * radius
    const dl = Math.hypot(ax - dist, ay)
    const [tx, ty] = refract2((ax - dist) / dl, ay / dl, nx, ny, eta)
    return tx * (b - ay) - ty * (a - ax)
  }
  let lo = 0
  let hi = 1
  let flo = -b
  let fhi = miss(1)
  const seen = fhi > 0
  for (let i = 0; i < steps; i++) {
    const mid = 0.5 * (lo + hi)
    const f = miss(mid)
    if (f < 0) {
      lo = mid
      flo = f
    } else {
      hi = mid
      fhi = f
    }
  }
  const s = seen ? (fhi > flo ? lo + ((hi - lo) * -flo) / (fhi - flo) : lo) : 1
  const [nx, ny] = normalAt(s)
  const exit = [centre[0] + radius * (nx * u[0] + ny * v[0]), centre[1] + radius * (nx * u[1] + ny * v[1]), centre[2] + radius * (nx * u[2] + ny * v[2])]
  const inside = len(sub(p, exit))
  const ray = sub(exit, eye)
  const outside = len(ray)
  const k = (outside + ior * inside) / outside
  return { apparent: [eye[0] + ray[0] * k, eye[1] + ray[1] * k, eye[2] + ray[2] * k], exit, pathMm: inside, seen }
}

export function refractInto(origin, dir, centre, radius = lensRadiusMm, ior = lensIor) {
  const oc = sub(origin, centre)
  const b = dot(oc, dir)
  const c = dot(oc, oc) - radius * radius
  const disc = b * b - c
  if (disc <= 0) return null
  const t = -b - Math.sqrt(disc)
  if (t <= 0) return null
  const hit = [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t]
  const n = [(hit[0] - centre[0]) / radius, (hit[1] - centre[1]) / radius, (hit[2] - centre[2]) / radius]
  const eta = 1 / ior
  const ci = -dot(n, dir)
  const k = 1 - eta * eta * (1 - ci * ci)
  if (k < 0) return null
  const m = eta * ci - Math.sqrt(k)
  return { origin: hit, dir: [eta * dir[0] + m * n[0], eta * dir[1] + m * n[1], eta * dir[2] + m * n[2]] }
}
