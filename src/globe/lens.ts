import { config } from '../config'

export const LENS_STEPS = 12
export const lensRadiusMm = config.globe.sphereDiameterMm / 2
export const innerRadiusMm = lensRadiusMm - config.globe.glassThicknessMm
export const lensIor = config.globe.liquidIor

export const LENS_GLSL = `
uniform vec3 uLensCentre;
uniform vec4 uLens;
vec2 lensRefract(vec2 d, vec2 n, float eta) {
  float c = dot(n, d);
  float k = 1.0 - eta * eta * (1.0 - c * c);
  return eta * d - (eta * c + sqrt(max(k, 0.0))) * n;
}
float lensMiss(float s, vec2 eye, vec2 limb, vec2 p, float r, float eta) {
  vec2 n = normalize(mix(vec2(1.0, 0.0), limb, s));
  vec2 at = n * r;
  vec2 t = lensRefract(normalize(at - eye), n, eta);
  return t.x * (p.y - at.y) - t.y * (p.x - at.x);
}
// seen is 1 where a ray from the eye reaches p through the glass and 0 where none does. Such a point is placed on the
// outline, and a triangle whose corners are all unseen is a sliver along the outline with no area of the scene in it:
// the wrapper in src/core/materials.ts takes seen as a varying and draws nothing where it is 0 (stageOutside)
vec4 lensPlace(vec3 p, vec3 eye, out float seen) {
  seen = 1.0;
  vec3 oe = eye - uLensCentre;
  float dist = length(oe);
  float r = uLens.x;
  if (uLens.z < 0.5 || dist < r * 1.0001) return vec4(p, 0.0);
  vec3 u = oe / dist;
  vec3 op = p - uLensCentre;
  float a = dot(op, u);
  vec3 side = op - a * u;
  float b = length(side);
  vec3 v = b > 1e-5 ? side / b : normalize(cross(u, abs(u.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec2 e2 = vec2(dist, 0.0);
  vec2 p2 = vec2(a, b);
  float cl = r / dist;
  vec2 limb = vec2(cl, sqrt(max(1.0 - cl * cl, 0.0)));
  float eta = 1.0 / uLens.y;
  float lo = 0.0;
  float hi = 1.0;
  float flo = -b;
  float fhi = lensMiss(1.0, e2, limb, p2, r, eta);
  bool through = fhi > 0.0;
  seen = through ? 1.0 : 0.0;
  for (int i = 0; i < ${LENS_STEPS}; i++) {
    float mid = 0.5 * (lo + hi);
    float f = lensMiss(mid, e2, limb, p2, r, eta);
    if (f < 0.0) { lo = mid; flo = f; } else { hi = mid; fhi = f; }
  }
  float s = through ? (fhi > flo ? lo + (hi - lo) * (-flo) / (fhi - flo) : lo) : 1.0;
  vec2 n2 = normalize(mix(vec2(1.0, 0.0), limb, s));
  vec3 at = uLensCentre + r * (n2.x * u + n2.y * v);
  float inside = length(p - at);
  vec3 ray = at - eye;
  float outside = length(ray);
  return vec4(eye + ray * ((outside + uLens.y * inside) / outside), inside);
}
vec4 lensPlace(vec3 p, vec3 eye) {
  float seen;
  return lensPlace(p, eye, seen);
}
`

type V3 = readonly [number, number, number]

export interface LensResult {
  apparent: [number, number, number]
  exit: [number, number, number]
  pathMm: number
  seen: boolean
}

const sub = (a: V3, b: V3): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const len = (a: V3) => Math.hypot(a[0], a[1], a[2])
const cross = (a: V3, b: V3): [number, number, number] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

function refract2(dx: number, dy: number, nx: number, ny: number, eta: number): [number, number] {
  const c = nx * dx + ny * dy
  const k = 1 - eta * eta * (1 - c * c)
  const m = eta * c + Math.sqrt(Math.max(k, 0))
  return [eta * dx - m * nx, eta * dy - m * ny]
}

export function lensPlace(p: V3, eye: V3, centre: V3, radius: number = lensRadiusMm, ior: number = lensIor, steps: number = LENS_STEPS): LensResult {
  const oe = sub(eye, centre)
  const dist = len(oe)
  if (dist < radius * 1.0001) return { apparent: [p[0], p[1], p[2]], exit: [p[0], p[1], p[2]], pathMm: 0, seen: true }
  const u: [number, number, number] = [oe[0] / dist, oe[1] / dist, oe[2] / dist]
  const op = sub(p, centre)
  const a = dot(op, u)
  const side: [number, number, number] = [op[0] - a * u[0], op[1] - a * u[1], op[2] - a * u[2]]
  const b = len(side)
  let v: [number, number, number]
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
  const normalAt = (s: number): [number, number] => {
    const x = 1 + (lx - 1) * s
    const y = ly * s
    const l = Math.hypot(x, y)
    return [x / l, y / l]
  }
  const miss = (s: number): number => {
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
  const exit: [number, number, number] = [
    centre[0] + radius * (nx * u[0] + ny * v[0]),
    centre[1] + radius * (nx * u[1] + ny * v[1]),
    centre[2] + radius * (nx * u[2] + ny * v[2]),
  ]
  const inside = len(sub(p, exit))
  const ray = sub(exit, eye)
  const outside = len(ray)
  const k = (outside + ior * inside) / outside
  return { apparent: [eye[0] + ray[0] * k, eye[1] + ray[1] * k, eye[2] + ray[2] * k], exit, pathMm: inside, seen }
}
