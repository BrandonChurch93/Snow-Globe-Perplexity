import fs from 'node:fs'
import { rel } from '../../tools/lib/paths.mjs'

const src = fs.readFileSync(rel('src', 'post', 'grade.ts'), 'utf8')
const one = (k) => Number(src.match(new RegExp(`\\b${k}: ([-0-9.e]+)`))[1])
const three = (k) => src.match(new RegExp(`\\b${k}: \\[([^\\]]+)\\]`))[1].split(',').map(Number)
const g = {
  exposure: one('exposure'), gain: one('curveGain'), toe: one('curveToe'), shoulder: one('curveShoulder'), mid: one('curveMid'), black: one('curveBlack'),
  hold: one('colourHold'), holdFrom: one('colourHoldFrom'), holdFull: one('colourHoldFull'), whiteFrom: one('whiteFrom'), whiteFull: one('whiteFull'),
  lift: three('lift'), gamma: three('gamma'), gainRgb: three('gain'), sat: one('saturation'), shadow: three('shadowTint'), shadowTo: one('shadowTintTo'),
}
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const curve = (x) => Math.min(1, Math.max(0, (x * (g.gain * x + g.toe)) / (x * (g.shoulder * x + g.mid) + g.black)))
const encode = (c) => (c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(Math.max(c, 0), 1 / 2.4) - 0.055)

export function display(lin) {
  const x = lin.map((v) => Math.max(v, 0) * g.exposure)
  const top = Math.max(...x)
  const each = x.map(curve)
  const held = x.map((v) => (v * curve(top)) / Math.max(top, 1e-5))
  const hold = g.hold * ss(g.holdFrom, g.holdFull, top) * (1 - ss(g.whiteFrom, g.whiteFull, top))
  let c = each.map((v, i) => v + (held[i] - v) * hold)
  c = c.map((v, i) => Math.pow(Math.max(v * g.gainRgb[i] + g.lift[i] * (1 - v), 0), 1 / g.gamma[i]))
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  c = c.map((v) => Math.max(l + (v - l) * g.sat, 0))
  const k = ss(0, g.shadowTo, l)
  c = c.map((v, i) => v * (g.shadow[i] + (1 - g.shadow[i]) * k))
  return c.map((v) => Math.round(255 * Math.min(1, Math.max(0, encode(v)))))
}

export function linear(rgb) {
  let x = rgb.map((v) => Math.pow(v / 255, 2.2) * 0.9 + 1e-4)
  for (let it = 0; it < 400; it++) {
    const d = display(x)
    let worst = 0
    x = x.map((v, i) => {
      const e = rgb[i] - d[i]
      worst = Math.max(worst, Math.abs(e))
      return Math.max(v * (1 + 0.012 * e) + 0.00002 * e, 1e-6)
    })
    if (worst < 0.5) break
  }
  return x
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2).map((s) => s.split(',').map(Number))
  for (const v of a) {
    if (v.some((n) => n > 12)) console.log(`display (${v.join(', ')}) needs linear (${linear(v).map((n) => n.toFixed(4)).join(', ')})`)
    else console.log(`linear (${v.join(', ')}) shows as (${display(v).join(', ')})`)
  }
}
