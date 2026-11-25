import { limbs, placePoint, trunkAxis, trunkRadius } from '../../../miniature/trunk'
import { roofAt, roofLength, slopeLength } from '../../../miniature/roof'
import type { Vec3 } from '../../kit'

export type Tone = 'orange' | 'peach' | 'cream'

export interface Lantern {
  hang: Vec3
  at: Vec3
  cord: number
  radius: number
  tall: number
  tone: Tone
  phase: number
  order: number
  arm?: Vec3
}

export const STRING = { sagMm: 3.5, steps: 40, wireMm: 0.07, cordMm: 0.045 }
export const SHAPE = { squash: 0.92, gores: 12, groove: 0.07, cap: 0.34, capTall: 0.26, ring: 0.3 }

const wood = limbs.filter((l) => l.kind === 'limb' || l.kind === 'twig')

function under(x: number, y: number, z: number, radius: number): { hang: Vec3; cord: number } {
  const top = y + radius * SHAPE.squash + radius * SHAPE.capTall
  let best: Vec3 = [x, top + 1, z]
  let cost = Infinity
  for (const l of wood)
    for (let k = 0; k < l.points.length; k++) {
      const p = l.points[k]!
      const low = p[1] - l.radii[k]! * 0.8
      const gap = low - top
      if (gap < 0.25) continue
      const c = (p[0] - x) * (p[0] - x) + (p[2] - z) * (p[2] - z) + 0.2 * gap * gap
      if (c < cost) {
        cost = c
        best = [p[0], low, p[2]]
      }
    }
  return { hang: best, cord: best[1] - top }
}

function onTrunk(h: number, phi: number): Vec3 {
  const [ax, az] = trunkAxis(h)
  const r = trunkRadius(phi, h) - 0.2
  return placePoint([ax + Math.cos(phi) * r, h, az + Math.sin(phi) * r])
}

const fork = onTrunk(17.4, 2.2)
const peg = onTrunk(18.4, 1.35)
const rake = roofAt(-1, slopeLength * 0.4, roofLength + 0.9, -0.25)
const eave = roofAt(-1, slopeLength * 0.72, roofLength + 1.1, -0.3)

export const stringEnds: readonly [Vec3, Vec3] = [rake, fork]

export function stringAt(t: number): Vec3 {
  const [a, b] = stringEnds
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - STRING.sagMm * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t]
}

interface Spec {
  hang: Vec3
  arm?: Vec3
  cord: number
  radius: number
  tone: Tone
}

const onString = (t: number, radius: number, tone: Tone): Spec => ({ hang: stringAt(t), cord: 0.12, radius, tone })
const onWood = (x: number, y: number, z: number, radius: number, tone: Tone): Spec => ({ ...under(x, y, z, radius), radius, tone })

const specs: Spec[] = [
  { hang: eave, cord: 1.0, radius: 2.0, tone: 'cream' },
  onString(0.05, 1.8, 'orange'),
  onString(0.22, 1.4, 'peach'),
  onString(0.44, 1.9, 'orange'),
  onString(0.62, 1.65, 'peach'),
  onString(0.81, 2.0, 'orange'),
  onWood(2.0, -3.7, -4, 1.15, 'orange'),
  { hang: [13.2, -1.4, 0.9], arm: peg, cord: 0.25, radius: 2.75, tone: 'cream' },
  onWood(19.5, -7.2, -3, 1.15, 'orange'),
  onWood(25.4, -7.7, -3, 1.9, 'orange'),
]

export const lanterns: readonly Lantern[] = specs.map((s, i) => {
  const tall = 2 * s.radius * SHAPE.squash
  return { hang: s.hang, ...(s.arm ? { arm: s.arm } : {}), cord: s.cord, radius: s.radius, tall, tone: s.tone, phase: (0.17 + i * 0.381966) % 1, order: i, at: [s.hang[0], s.hang[1] - s.cord - tall / 2 - s.radius * SHAPE.capTall, s.hang[2]] }
})
