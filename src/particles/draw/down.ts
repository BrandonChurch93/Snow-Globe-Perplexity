import * as THREE from 'three'
import { stream } from '../../core/rng'
import { CARD } from './looks'

/**
 * The down of a seed's head, drawn once at start into one sheet and read by every seed card.
 *
 * A head is a small ball of down: some hundred fine hairs of nearly one length that stand out from the hub over a
 * cap of a sphere. That many hairs is more than a card can draw one by one for every pixel, and fewer is a wheel of
 * spokes. So each of `CARD.down.forms` (a head with its own count of hairs and its own cap, from an open cup to
 * nearly a whole ball) is drawn here at `CARD.down.tilts` leans, from seen along its stalk (a round disc, brightest
 * at its heart, where the hairs that point at the eye lie over one another) to seen from the side (a cup on its
 * stalk). A card takes the form its particle was given and the lean its own axes have, and turns the picture to
 * its stalk; the stalk and the grain are still lines of the card itself.
 *
 * The sheet is a pure function of the seed: no clock and no random source but the engine's own stream. What it
 * holds is the sum of the hairs' cover over `CARD.down.most`, so the smaller copies (each the mean of four pixels
 * of the one before, made here and not by the graphics driver, so they are the same on every machine) are what a
 * head of fine hairs is when it is small or out of focus: a soft ball with a bright heart.
 */
export function downAtlas(): THREE.DataTexture {
  const D = CARD.down
  const size = D.tile
  const width = size * D.tilts
  const height = size * D.forms.length
  const sum = new Float32Array(width * height)
  const rng = stream('seed-down')
  // texels for one hair length
  const unit = size / (2 * D.half)
  // a soft round dab: the sum of dabs a step apart along a hair is a line whose middle is as bright as `v`
  const kernel = new Float64Array(64)
  const dab = (x: number, y: number, v: number, x0: number, y0: number, sigma: number) => {
    const reach = Math.min(15, Math.ceil(2.5 * sigma))
    const ix = Math.round(x)
    const iy = Math.round(y)
    const inv = 1 / (2 * sigma * sigma)
    for (let i = -reach; i <= reach; i++) {
      const dx = ix + i - x
      const dy = iy + i - y
      kernel[i + reach] = Math.exp(-dx * dx * inv)
      kernel[32 + i + reach] = Math.exp(-dy * dy * inv)
    }
    for (let j = -reach; j <= reach; j++) {
      const row = iy + j
      if (row < y0 || row >= y0 + size) continue
      const vy = v * kernel[32 + j + reach]!
      for (let i = -reach; i <= reach; i++) {
        const col = ix + i
        if (col < x0 || col >= x0 + size) continue
        sum[row * width + col]! += vy * kernel[i + reach]!
      }
    }
  }
  const step = 0.8 * D.wide
  const each = step / (Math.sqrt(2 * Math.PI) * D.wide)
  D.forms.forEach((form, row) => {
    const hairs: { x: number; y: number; z: number; long: number; seen: number; bow: number; tip: number }[] = []
    for (let i = 0; i < form.hairs; i++) {
      // even over the cap by area, each hair a golden angle on from the last: no rows and no wedges
      const up = form.cap[0] + ((form.cap[1] - form.cap[0]) * (i + rng.next())) / form.hairs
      const turn = i * 2.3999632 + rng.range(-D.jitter, D.jitter)
      const out = Math.sqrt(Math.max(0, 1 - up * up))
      const fine = rng.next() < D.fineShare
      hairs.push({
        x: out * Math.cos(turn),
        y: out * Math.sin(turn),
        z: up,
        long: rng.range(D.long[0], D.long[1]) * (fine ? D.fineLong : 1),
        seen: rng.range(D.weight[0], D.weight[1]) * (fine ? D.fineSeen : 1),
        bow: rng.range(-D.bow, D.bow),
        tip: rng.next() < D.tips ? D.tipSeen : 0,
      })
    }
    for (let k = 0; k < D.tilts; k++) {
      const tilt = ((Math.PI / 2) * k) / (D.tilts - 1)
      const st = Math.sin(tilt)
      const ct = Math.cos(tilt)
      const x0 = k * size
      const y0 = row * size
      const cx = x0 + size / 2
      const cy = y0 + size / 2
      for (const hr of hairs) {
        // on the picture the stalk's axis stands up by the sine of the lean; what points at the eye is short
        const tx = hr.x * hr.long * unit
        const ty = (hr.y * ct + hr.z * st) * hr.long * unit
        const len = Math.hypot(tx, ty)
        const count = Math.max(1, Math.ceil(len / step))
        for (let n = 0; n < count; n++) {
          const t = (n + 0.5) / count
          const side = hr.bow * t * t
          dab(cx + tx * t - ty * side, cy + ty * t + tx * side, hr.seen * each * (len / count / step) * (1 - D.tipFade * t), x0, y0, D.wide)
        }
        // a faint tuft at the tip of most hairs: wider than the hair and far dimmer, so the rim of a head is soft and dotted
        if (hr.tip > 0) dab(cx + tx - ty * hr.bow, cy + ty + tx * hr.bow, hr.tip, x0, y0, D.wide * D.tipWide)
      }
      // the heart, where every hair meets
      dab(cx, cy, D.heart, x0, y0, D.heartWide * unit)
    }
  })
  // every smaller copy down to one pixel, so the sheet is whole on any driver; a card reads no further than `lodMost`
  const levels: { data: Uint8Array; width: number; height: number }[] = []
  let w = width
  let h = height
  let from = sum
  for (;;) {
    const bytes = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) bytes[i] = Math.round(255 * Math.min(1, from[i]! / D.most))
    levels.push({ data: bytes, width: w, height: h })
    if (w === 1 && h === 1) break
    const hw = Math.max(1, w >> 1)
    const hh = Math.max(1, h >> 1)
    const next = new Float32Array(hw * hh)
    for (let j = 0; j < hh; j++) {
      const j0 = Math.min(2 * j, h - 1) * w
      const j1 = Math.min(2 * j + 1, h - 1) * w
      for (let i = 0; i < hw; i++) {
        const i0 = Math.min(2 * i, w - 1)
        const i1 = Math.min(2 * i + 1, w - 1)
        next[j * hw + i] = 0.25 * (Math.min(D.most, from[j0 + i0]!) + Math.min(D.most, from[j0 + i1]!) + Math.min(D.most, from[j1 + i0]!) + Math.min(D.most, from[j1 + i1]!))
      }
    }
    from = next
    w = hw
    h = hh
  }
  const sheet = new THREE.DataTexture(levels[0]!.data, width, height, THREE.RedFormat, THREE.UnsignedByteType)
  sheet.mipmaps = levels as unknown as THREE.DataTexture['mipmaps']
  sheet.generateMipmaps = false
  sheet.minFilter = THREE.LinearMipmapLinearFilter
  sheet.magFilter = THREE.LinearFilter
  sheet.wrapS = THREE.ClampToEdgeWrapping
  sheet.wrapT = THREE.ClampToEdgeWrapping
  sheet.colorSpace = THREE.NoColorSpace
  sheet.unpackAlignment = 1
  sheet.needsUpdate = true
  return sheet
}
