import { CENTRE, REF_GLASS, rayOf } from '../../tools/lib/refcam.mjs'
import { loadConfig } from '../../tools/lib/paths.mjs'

const config = loadConfig()
const R = config.globe.sphereDiameterMm / 2
const IOR = config.globe.glassIor
const DEG = 180 / Math.PI
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const unit = (a) => mul(a, 1 / Math.hypot(a[0], a[1], a[2]))

export const pixelOf = (share, angleDeg) => [REF_GLASS.x + REF_GLASS.r * share * Math.cos(angleDeg / DEG), REF_GLASS.y - REF_GLASS.r * share * Math.sin(angleDeg / DEG)]

export function seenDir(px, py, face) {
  const ray = rayOf(px, py)
  const oc = sub(ray.origin, CENTRE)
  const b = dot(oc, ray.dir)
  const disc = b * b - (dot(oc, oc) - R * R)
  if (disc < 0) return null
  const n = unit(sub(add(ray.origin, mul(ray.dir, -b - Math.sqrt(disc))), CENTRE))
  const c = Math.min(1, Math.max(0, -dot(ray.dir, n)))
  const t = add(ray.dir, mul(n, c))
  const s = Math.hypot(t[0], t[1], t[2])
  const tang = s > 1e-6 ? mul(t, 1 / s) : [1, 0, 0]
  let theta = Math.atan2(s, c)
  if (face) {
    const inGlass = s / IOR
    const s2 = inGlass / face
    if (s2 >= 1) return null
    theta += 2 * (Math.asin(s2) - Math.asin(inGlass))
  }
  return { n, dir: add(mul(n, Math.cos(theta)), mul(tang, Math.sin(theta))) }
}

export function windowCoords(share, angleDeg, face, win) {
  const seen = seenDir(...pixelOf(share, angleDeg), face)
  if (!seen) return null
  const z = dot(seen.dir, win.c)
  if (z < 0.2) return null
  return [Math.atan2(dot(seen.dir, win.a), z) * DEG, Math.atan2(dot(seen.dir, win.b), z) * DEG]
}

export const windowOf = (centre, along, across) => ({ c: unit(centre), a: unit(along), b: unit(across) })

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(2).map((s) => s.replace(/^--/, '').split('=')))
  const win = windowOf((args.centre ?? '0.4179,0.3537,-0.8368').split(',').map(Number), (args.along ?? '-0.5279,0.8442,0.0931').split(',').map(Number), (args.across ?? '0.7394,0.4029,0.5395').split(',').map(Number))
  const face = Number(args.face ?? 0)
  const shares = (args.shares ?? '0.795,0.83,0.866').split(',').map(Number)
  for (const angle of (args.angles ?? '16,20,25,30,35,40,45,49').split(',').map(Number)) {
    console.log(`angle ${String(angle).padStart(5)}: ${shares.map((s) => { const q = windowCoords(s, angle, face, win); return `share ${s.toFixed(3)} -> ${q ? `along ${q[0].toFixed(2).padStart(7)}, across ${q[1].toFixed(2).padStart(7)}` : 'not seen'}` }).join(' | ')}`)
  }
}
