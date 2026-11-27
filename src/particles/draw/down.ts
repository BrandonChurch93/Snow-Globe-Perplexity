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
 * After those come the stars (`CARD.down.stars`): the same head as it reads when it is small on the picture, some
 * sixty fine hairs of unequal length that are each told apart, wider on the sheet so that a hair is a whole line at
 * that size and not a row of dots. Each is a little bowed and opens to a soft fan toward its tip, as a hair of down
 * does, so the rim of a head is feathered and never a ring of beads. A card reads a star where its head is small
 * and the dense form where it is large, and both across the sizes between. The stars are drawn after the dense
 * forms, so the dense forms take the same numbers from the stream as they did.
 *
 * After the stars come the puffs (`CARD.down.puffs`), the heads at rest: round tufts whose hairs are of nearly one length
 * and thin from a small bright heart to nothing at the tip, so a head is a soft ball and not a wheel of spokes with blunt
 * ends. Last come the drifts (`CARD.down.drifts`), the heads as the storm leaves them: fewer hairs, and of some only those
 * of one side (`part`), the others torn off. Both are drawn after all that came before, which takes its numbers as it did.
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
  type Form = { hairs: number; cap: readonly [number, number]; long?: readonly [number, number]; weight?: readonly [number, number]; part?: number }
  const rows: { form: Form; star: boolean; puff: boolean }[] = [...D.forms.map((form) => ({ form, star: false, puff: false })), ...D.stars.map((form) => ({ form, star: true, puff: false })), ...D.puffs.map((form) => ({ form, star: false, puff: true })), ...D.drifts.map((form) => ({ form, star: true, puff: false }))]
  const height = size * rows.length
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
  rows.forEach(({ form, star, puff }, row) => {
    const S = D.star
    const P = D.puff
    const wide = star ? S.wide : puff ? P.wide : D.wide
    const step = 0.8 * wide
    const each = step / (Math.sqrt(2 * Math.PI) * wide)
    const tipFade = star ? S.tipFade : puff ? P.tipFade : D.tipFade
    const tipWide = puff ? P.tipWide : D.wide * D.tipWide
    const hairs: { x: number; y: number; z: number; long: number; seen: number; bow: number; tip: number; beadAt: number; beadLong: number }[] = []
    for (let i = 0, made = 0; made < form.hairs; i++) {
      // a part drift keeps the hairs of one side only: the others were torn off in the storm
      if (form.part !== undefined && ((i * 2.3999632) / (2 * Math.PI)) % 1 > form.part) continue
      // even over the cap by area, each hair a golden angle on from the last: no rows and no wedges
      const up = form.cap[0] + ((form.cap[1] - form.cap[0]) * (made + rng.next())) / form.hairs
      made++
      const turn = i * 2.3999632 + rng.range(-D.jitter, D.jitter)
      const out = Math.sqrt(Math.max(0, 1 - up * up))
      const fine = rng.next() < D.fineShare
      // the dense forms take their numbers from the stream in the order they always did
      const long = star ? rng.range((form.long ?? S.long)[0], (form.long ?? S.long)[1]) : puff ? rng.range(P.long[0], P.long[1]) : rng.range(D.long[0], D.long[1]) * (fine ? D.fineLong : 1)
      const seen = star ? rng.range((form.weight ?? S.weight)[0], (form.weight ?? S.weight)[1]) : puff ? rng.range(P.weight[0], P.weight[1]) : rng.range(D.weight[0], D.weight[1]) * (fine ? D.fineSeen : 1)
      hairs.push({
        x: out * Math.cos(turn),
        y: out * Math.sin(turn),
        z: up,
        long,
        seen,
        bow: star ? rng.range(-S.bow, S.bow) : puff ? rng.range(-P.bow, P.bow) : rng.range(-D.bow, D.bow),
        tip: star ? 0 : puff ? P.tip : rng.next() < D.tips ? D.tipSeen : 0,
        // a puff's hair can be beaded, its light coming and going along it, each hair at its own place and pace (`puff.bead` is how much: none now)
        beadAt: puff ? rng.range(0, 2 * Math.PI) : 0,
        beadLong: puff ? rng.range(P.beadLong[0], P.beadLong[1]) : 1,
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
          // a star's hair is a tapered line: stout where it leaves the heart and drawn out to a fine point
          const open = star ? 1 + S.flare * Math.pow(t, S.flarePow) : 1
          const bead = puff ? (1 + P.bead * Math.sin(hr.beadAt + (2 * Math.PI * t * len) / (unit * hr.beadLong))) * Math.min(1, t / P.root) : 1
          dab(cx + tx * t - ty * side, cy + ty * t + tx * side, hr.seen * each * (len / count / step) * (1 - tipFade * t) * bead * Math.pow(open, -S.flareHold), x0, y0, wide * open)
        }
        // a faint tuft at the tip of most hairs: wider than the hair and far dimmer, so the rim of a head is soft and dotted
        if (hr.tip > 0) dab(cx + tx - ty * hr.bow, cy + ty + tx * hr.bow, hr.tip, x0, y0, tipWide)
      }
      // the heart, where every hair meets
      dab(cx, cy, star ? S.heart : puff ? P.heart : D.heart, x0, y0, (star ? S.heartWide : puff ? P.heartWide : D.heartWide) * unit)
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
