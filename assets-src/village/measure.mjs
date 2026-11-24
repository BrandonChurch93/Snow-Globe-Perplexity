import { insideRayOf, projectInside } from '../../tools/lib/refcam.mjs'

export function atDepth(px, py, z) {
  const r = insideRayOf(px, py)
  if (!r) return null
  const t = (z - r.origin[2]) / r.dir[2]
  return [r.origin[0] + t * r.dir[0], r.origin[1] + t * r.dir[1], z]
}

export function atHeight(px, py, y) {
  const r = insideRayOf(px, py)
  if (!r) return null
  const t = (y - r.origin[1]) / r.dir[1]
  if (t < 0) return null
  return [r.origin[0] + t * r.dir[0], y, r.origin[2] + t * r.dir[2]]
}

const args = process.argv.slice(2)
if (args[0] === 'ray') {
  const r = insideRayOf(+args[1], +args[2])
  console.log(JSON.stringify(r))
} else if (args[0] === 'z') {
  for (let i = 1; i + 2 < args.length + 1; i += 3) console.log(args[i], args[i + 1], 'z', args[i + 2], '->', atDepth(+args[i], +args[i + 1], +args[i + 2]).map((v) => +v.toFixed(2)).join(', '))
} else if (args[0] === 'p') {
  console.log(projectInside([+args[1], +args[2], +args[3]]).map((v) => +v.toFixed(1)).join(', '))
}
