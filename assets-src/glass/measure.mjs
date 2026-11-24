import { CENTRE, REF_GLASS, rayOf, refCamera } from '../../tools/lib/refcam.mjs'
import { loadConfig } from '../../tools/lib/paths.mjs'

const config = loadConfig()
const R = config.globe.sphereDiameterMm / 2
const DEG = 180 / Math.PI

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a) => mul(a, 1 / Math.hypot(a[0], a[1], a[2]))

export function pixelOf(share, angleDeg) {
  const a = angleDeg / DEG
  return [REF_GLASS.x + REF_GLASS.r * share * Math.cos(a), REF_GLASS.y - REF_GLASS.r * share * Math.sin(a)]
}

export function reflectionOf(px, py) {
  const ray = rayOf(px, py)
  const oc = sub(ray.origin, CENTRE)
  const b = dot(oc, ray.dir)
  const disc = b * b - (dot(oc, oc) - R * R)
  if (disc < 0) return null
  const hit = add(ray.origin, mul(ray.dir, -b - Math.sqrt(disc)))
  const n = unit(sub(hit, CENTRE))
  const c = -dot(ray.dir, n)
  return { n, cos: c, dir: unit(add(ray.dir, mul(n, 2 * c))) }
}

function describe(name, outline) {
  const dirs = outline.map(([share, angle]) => reflectionOf(...pixelOf(share, angle))).filter(Boolean)
  const centre = unit(dirs.reduce((s, d) => add(s, d.dir), [0, 0, 0]))
  const first = dirs[0].dir
  const last = dirs[dirs.length - 1].dir
  const along = unit(sub(sub(last, first), mul(centre, dot(sub(last, first), centre))))
  const across = cross(centre, along)
  let u0 = Infinity
  let u1 = -Infinity
  let v0 = Infinity
  let v1 = -Infinity
  for (const d of dirs) {
    const k = 1 / dot(d.dir, centre)
    const u = Math.atan(dot(d.dir, along) * k) * DEG
    const v = Math.atan(dot(d.dir, across) * k) * DEG
    u0 = Math.min(u0, u)
    u1 = Math.max(u1, u)
    v0 = Math.min(v0, v)
    v1 = Math.max(v1, v)
  }
  const f = (v) => v.map((x) => x.toFixed(4)).join(', ')
  console.log(`${name}: centre [${f(centre)}], along [${f(along)}], across [${f(across)}]`)
  console.log(`  along ${u0.toFixed(1)} to ${u1.toFixed(1)} deg, across ${v0.toFixed(1)} to ${v1.toFixed(1)} deg, cos of incidence ${Math.min(...dirs.map((d) => d.cos)).toFixed(3)} to ${Math.max(...dirs.map((d) => d.cos)).toFixed(3)}`)
}

const shapes = {
  'first pane (outer face)': [[0.978, 15], [0.933, 15], [0.94, 30], [0.979, 30], [0.979, 45], [0.95, 45], [0.956, 58], [0.979, 58], [0.979, 73], [0.962, 73]],
  'second pane (inner face)': [[0.866, 16], [0.7935, 16], [0.7935, 30], [0.866, 30], [0.866, 49], [0.81, 49]],
  'third band': [[0.77, 4], [0.706, 4], [0.706, 28], [0.77, 28], [0.77, 53], [0.706, 53]],
}

const cam = refCamera()
console.log(`reference camera at [${cam.eye.map((v) => v.toFixed(1)).join(', ')}], glass ${REF_GLASS.r} px at (${REF_GLASS.x}, ${REF_GLASS.y})`)
for (const [name, outline] of Object.entries(shapes)) describe(name, outline)
