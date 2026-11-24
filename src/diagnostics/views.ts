import { config, particleKinds, shots } from '../config'

export const VIEWS = ['ids', 'standins', 'albedo', 'normals', 'depth', 'texels', 'cover', 'flow', 'lightgrid', 'refraction', 'change'] as const
export type View = (typeof VIEWS)[number]

export const viewCode = (view: string): number => VIEWS.indexOf(view as View) + 1
export const DEPTH_RANGE_MM = 4096
export const FLOW_RANGE_MM_S = 400
export const LIGHT_RANGE = 1

export const SEASON_PARTS = ['base', 'miniature', 'glass-dressing', 'surface-dressing', 'light', 'veil', 'arrival'] as const
export const SHARED_PARTS = ['glass', 'liquid', 'surface', 'backdrop', 'lens', 'shake', 'particle-engine', 'light-engine'] as const
export const WHOLE_PARTS = ['interface', 'sound-engine', 'quality-levels', 'opening', 'loop'] as const

export function partNames(): string[] {
  const out: string[] = [...SHARED_PARTS]
  const seen = new Set<string>()
  for (const s of config.seasons) {
    for (const p of SEASON_PARTS) out.push(`${p}-${s}`)
    for (const k of particleKinds(s)) {
      if (seen.has(k.kind)) continue
      seen.add(k.kind)
      out.push(`particle-${k.kind}`)
    }
  }
  for (const shot of shots) if (shot.kind === 'shake') out.push(`change-${shot.from}-${shot.to}`)
  out.push(...WHOLE_PARTS)
  return out
}

const names = partNames()
const table = new Map<string, [number, number, number]>()

function build(): void {
  const levels = [0.52, 0.36, 0.68]
  const sats = [0.95, 0.7]
  const used = new Set<number>()
  names.forEach((name, i) => {
    let step = i
    for (;;) {
      const h = (step * 0.61803398875) % 1
      const l = levels[step % levels.length]!
      const s = sats[Math.floor(step / levels.length) % sats.length]!
      const c = (1 - Math.abs(2 * l - 1)) * s
      const x = c * (1 - Math.abs(((h * 6) % 2) - 1))
      const m = l - c / 2
      const k = Math.floor(h * 6)
      const rgb = k === 0 ? [c, x, 0] : k === 1 ? [x, c, 0] : k === 2 ? [0, c, x] : k === 3 ? [0, x, c] : k === 4 ? [x, 0, c] : [c, 0, x]
      const bytes: [number, number, number] = [Math.round((rgb[0]! + m) * 255), Math.round((rgb[1]! + m) * 255), Math.round((rgb[2]! + m) * 255)]
      const near = [...used].some((u) => Math.max(Math.abs((u >> 16) - bytes[0]), Math.abs(((u >> 8) & 255) - bytes[1]), Math.abs((u & 255) - bytes[2])) < 12)
      if (!near) {
        used.add((bytes[0] << 16) | (bytes[1] << 8) | bytes[2])
        table.set(name, bytes)
        return
      }
      step += names.length
    }
  })
}
build()

export function partBytes(name: string): [number, number, number] {
  const c = table.get(name)
  if (!c) throw new Error(`no such part: ${name}`)
  return c
}

export const partHex = (name: string): number => {
  const c = partBytes(name)
  return (c[0] << 16) | (c[1] << 8) | c[2]
}

export const allParts = (): { name: string; color: number }[] => names.map((name) => ({ name, color: partHex(name) }))
