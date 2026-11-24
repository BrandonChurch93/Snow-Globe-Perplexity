import path from 'node:path'
import sharp from 'sharp'
import { REF_GLASS, REF_SIZE } from '../../tools/lib/refcam.mjs'
import { parseArgs, rel } from '../../tools/lib/paths.mjs'

const args = parseArgs(process.argv.slice(2))
const season = args.season && args.season !== true ? String(args.season) : 'winter'
const [W, H] = REF_SIZE
const files = { approved: rel('references', 'approved', `${season}-rest.png`), render: args._[0] ? path.resolve(args._[0]) : rel('out', 'work', 'stills', `${season}-rest-hero-hd-draft-rig.png`) }
const from = Number(args.from ?? -20)
const to = Number(args.to ?? 200)

for (const [name, file] of Object.entries(files)) {
  const buf = await sharp(file).removeAlpha().resize({ width: W, height: H, fit: 'fill', kernel: 'lanczos3' }).greyscale().raw().toBuffer()
  const at = (x, y) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = x - x0
    const fy = y - y0
    const p = (i, j) => buf[Math.min(Math.max(j, 0), H - 1) * W + Math.min(Math.max(i, 0), W - 1)]
    return (p(x0, y0) * (1 - fx) + p(x0 + 1, y0) * fx) * (1 - fy) + (p(x0, y0 + 1) * (1 - fx) + p(x0 + 1, y0 + 1) * fx) * fy
  }
  const pts = []
  for (let a = from; a <= to; a += 2) {
    const c = Math.cos((a * Math.PI) / 180)
    const s = Math.sin((a * Math.PI) / 180)
    let best = 0
    let where = 0
    for (let r = REF_GLASS.r - 30; r <= REF_GLASS.r + 30; r += 0.25) {
      const inside = (at(REF_GLASS.x + (r - 2.5) * c, REF_GLASS.y - (r - 2.5) * s) + at(REF_GLASS.x + (r - 1.5) * c, REF_GLASS.y - (r - 1.5) * s)) / 2
      const outside = (at(REF_GLASS.x + (r + 2.5) * c, REF_GLASS.y - (r + 2.5) * s) + at(REF_GLASS.x + (r + 1.5) * c, REF_GLASS.y - (r + 1.5) * s)) / 2
      if (inside - outside > best) {
        best = inside - outside
        where = r
      }
    }
    if (best > 12) pts.push([REF_GLASS.x + where * c, REF_GLASS.y - where * s, a, where])
  }
  let cx = REF_GLASS.x
  let cy = REF_GLASS.y
  let r = REF_GLASS.r
  for (let pass = 0; pass < 3; pass++) {
    for (let it = 0; it < 200; it++) {
      let gx = 0
      let gy = 0
      let gr = 0
      for (const [x, y] of pts) {
        const d = Math.hypot(x - cx, y - cy)
        const e = d - r
        gx += (-e * (x - cx)) / d
        gy += (-e * (y - cy)) / d
        gr += -e
      }
      cx -= (0.9 * gx) / pts.length
      cy -= (0.9 * gy) / pts.length
      r -= (0.9 * gr) / pts.length
    }
    const res = pts.map(([x, y]) => Math.abs(Math.hypot(x - cx, y - cy) - r)).sort((a, b) => a - b)
    const cutoff = Math.max(res[Math.floor(res.length * 0.8)], 0.75)
    for (let i = pts.length - 1; i >= 0; i--) if (Math.abs(Math.hypot(pts[i][0] - cx, pts[i][1] - cy) - r) > cutoff * 1.5) pts.splice(i, 1)
  }
  const rms = Math.sqrt(pts.reduce((s, [x, y]) => s + (Math.hypot(x - cx, y - cy) - r) ** 2, 0) / pts.length)
  console.log(`${name.padEnd(9)} outline of the glass: centre (${cx.toFixed(1)}, ${cy.toFixed(1)}), radius ${r.toFixed(1)} px of the approved image, ${pts.length} edge points from ${from} to ${to} degrees, rms ${rms.toFixed(2)} px`)
  if (args.points === true) console.log(pts.map((p) => `${p[2]}:${p[3].toFixed(1)}`).join(' '))
}
