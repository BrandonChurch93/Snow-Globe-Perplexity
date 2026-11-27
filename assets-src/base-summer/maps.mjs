import { blur, clamp, fbm, hashInt, mix, mulberry, smooth, writePng } from './lib.mjs'
import * as P from './profile.mjs'
import { FIELD } from './field.mjs'

export const GRAIN = { px: 512 }
export const SAND = { px: 512, grains: 2600 }
// A slope of the relief of FACE.slope (mm out per mm up) reads as fully turned up or down; a crumb that stands out takes the light as well.
const FACE = { slope: 0.24, gain: 0.8, broad: 0.5, form: 0.4, grain: 0.25, wide: 2.4, hollow: 0.25, deep: 0.35, steep: 0.6 }

// Row 0 of a picture is its top; the maps are worked out from the foot up.
const up = (bytes, w, h, ch) => {
  const out = new Uint8Array(bytes.length)
  const row = w * ch
  for (let y = 0; y < h; y++) out.set(bytes.subarray(y * row, y * row + row), (h - 1 - y) * row)
  return out
}

const slopeByte = (gx, gy) => {
  const l = Math.hypot(gx, gy, 1)
  return [Math.round(clamp(0.5 - (0.5 * gx) / l) * 255), Math.round(clamp(0.5 - (0.5 * gy) / l) * 255)]
}

// The relief the mesh cannot hold, as a normal in red and green: what of the mound is finer than its mesh, the narrow swirls, the creases and
// the crumbs, which are in no mesh. Blue is how the relief is turned to the light from above: over the middle a face turned up (the upper
// side of a swell, the lower lip of a crease, the sunlit face of the roll above its ledge), under it a face turned down (the underside of a
// swell, the shade under a ledge). Round a thing set in the sand it is held back, so the thing lies in a soft shade and not in a dark outline.
export async function carveMap(dir, f) {
  const { W, H } = FIELD
  const fine = blur(f.d, W, H, 2.4, true, false)
  const out = new Uint8Array(W * H * 3)
  const stepV = f.mer.total / (H - 1)
  // A hollow is what lies under the mean of the relief round it: there the sand stays damp and takes the warm light from below.
  const near = blur(f.rel, W, H, 0.4 / stepV, true, false)
  const soft = blur(f.rel, W, H, 0.8 / stepV, true, false)
  const far = blur(f.rel, W, H, FACE.wide / stepV, true, false)
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const o = j * W + i
      const u = (i + 0.5) / W
      const front = Math.abs(u - 0.5) <= P.FRONT_SHARE / 2
      const stepU = (front ? (2 * P.FRONT_DEG) / (P.FRONT_SHARE * W) : (2 * (180 - P.FRONT_DEG)) / ((1 - P.FRONT_SHARE) * W)) * P.RAD * 56
      const l = j * W + ((i + W - 1) % W)
      const r = j * W + ((i + 1) % W)
      const d = Math.max(j - 1, 0) * W + i
      const t = Math.min(j + 1, H - 1) * W + i
      const hp = (k) => f.d[k] - fine[k] + f.fine[k]
      const run = ((t - d) / W) * stepV
      // On a wall of the fold the map is drawn out along the wall: there its grain is held back, or every crumb shows as a streak.
      const flat = 1 / (1 + 4 * Math.max(Math.abs(fine[t] - fine[d]) / run - FACE.steep, 0) ** 2)
      const [rb, gb] = slopeByte(((hp(r) - hp(l)) / (2 * stepU)) * flat, ((hp(t) - hp(d)) / (2 * stepV)) * flat)
      out[o * 3] = rb
      out[o * 3 + 1] = gb
      const face = FACE.gain * Math.tanh(-(f.rel[t] - soft[t] - f.rel[d] + soft[d]) / run / FACE.slope) + FACE.form * Math.tanh(-(soft[t] - soft[d]) / run / FACE.broad)
      const hollow = Math.tanh((far[o] - near[o]) / FACE.hollow)
      out[o * 3 + 2] = Math.round(clamp(0.5 + 0.5 * clamp(face - FACE.deep * hollow + f.lip[o] + FACE.grain * flat * f.grain[o], -1, 1) * (1 - f.halo[o]) ** 2) * 255)
    }
  }
  return [await writePng(`${dir}/base-carve.lin.w2048.png`, W, H, 3, up(out, W, H, 3))]
}

// The colour of packed sand: one pale cream, a little warmer low down and in broad soft patches, and warm in the trough above the foot.
// The loose sand on the top of the roll is paler and dry.
export async function toneMap(dir, f) {
  const { W, H } = FIELD
  const out = new Uint8Array(W * H * 3)
  const cream = [0.94, 0.89, 0.8]
  const ochre = [0.9, 0.81, 0.67]
  const rust = [0.56, 0.38, 0.24]
  const pale = [0.96, 0.93, 0.86]
  const loose = [0.97, 0.94, 0.87]
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const o = j * W + i
      const A = P.azOfU((i + 0.5) / W) / 360 + 0.5
      const h = f.hgt[o]
      // The warm stain in the trough is deep on the sunlit left and faint in the ball's shade.
      const stain = Math.exp(-(((h - f.groove[o] - 0.4) / 2.1) ** 2)) * (0.55 + 0.45 * fbm(A * 14, h / 5, 14, 64, 307, 3)) * mix(1, 0.35, smooth(-12, 18, P.azOfU((i + 0.5) / W)))
      const low = smooth(13, 3, h) * 0.3
      const blotch = fbm(A * 9, h / 9, 9, 64, 309, 3)
      const top = smooth(30, 37, h) * 0.5
      let c = [0, 1, 2].map((q) => mix(cream[q], ochre[q], clamp(low + 0.5 * (blotch - 0.5))))
      c = c.map((v, q) => mix(v, pale[q], top))
      c = c.map((v, q) => mix(v, rust[q], clamp(0.35 * stain)))
      c = c.map((v, q) => mix(v, loose[q], 0.75 * f.drift[o]))
      const speck = 0.94 + 0.12 * hashInt(i, j, 311) * hashInt(i >> 1, j >> 1, 313) + 0.05 * (fbm(A * 400, h * 2.2, 400, 512, 315, 2) - 0.5)
      // Round each thing set into the sand the sand is in its shade.
      const dark = (1 - 0.14 * f.halo[o] ** 2 - 0.3 * f.halo[o] ** 4) * (1 - 0.42 * f.under[o] ** 2)
      for (let q = 0; q < 3; q++) out[o * 3 + q] = Math.round(clamp(c[q] * speck * dark) * 255)
    }
  }
  return [await writePng(`${dir}/base-stone.srgb.w2048.png`, W, H, 3, up(out, W, H, 3))]
}

function normalFromHeight(h, n, gain) {
  const out = new Uint8Array(n * n * 3)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const gx = (h[y * n + ((x + 1) % n)] - h[y * n + ((x + n - 1) % n)]) * gain
    const gy = (h[((y + 1) % n) * n + x] - h[((y + n - 1) % n) * n + x]) * gain
    const [r, g] = slopeByte(gx, gy)
    out[(y * n + x) * 3] = r
    out[(y * n + x) * 3 + 1] = g
  }
  return out
}

// The stone's grain: packed sand grains held in cement. Normal in red and green, roughness in blue.
export async function grainMap(dir) {
  const n = GRAIN.px
  const rnd = mulberry(811)
  const a = new Float32Array(n * n)
  const b = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) {
    a[i] = rnd()
    b[i] = rnd()
  }
  const fine = blur(a, n, n, 0.9, true, true)
  const coarse = blur(b, n, n, 2.75, true, true)
  const h = new Float32Array(n * n)
  for (let i = 0; i < n * n; i++) h[i] = (fine[i] - 0.5) * 5 + (coarse[i] - 0.5) * 9
  const out = normalFromHeight(h, n, 2.8)
  for (let i = 0; i < n * n; i++) out[i * 3 + 2] = Math.round(clamp(0.5 + (fine[i] - 0.5) * 4 - (coarse[i] - 0.5) * 3) * 255)
  return [await writePng(`${dir}/base-grain.lin.tile.w512.png`, n, n, 3, up(out, n, n, 3))]
}

// Loose sand: single grains as small domes, each with its own number in blue (0 where no grain lies), so a thin layer can
// be cut grain by grain.
export async function sandMap(dir) {
  const n = SAND.px
  const rnd = mulberry(977)
  const h = new Float32Array(n * n)
  const id = new Float32Array(n * n)
  for (let g = 0; g < SAND.grains; g++) {
    const cx = rnd() * n
    const cy = rnd() * n
    const r = (9 + 15 * rnd() * rnd()) * (n / 1024)
    const ax = 0.75 + 0.5 * rnd()
    const rot = rnd() * Math.PI
    const top = 0.35 + 0.65 * rnd()
    const tag = 0.06 + 0.94 * rnd()
    const R = Math.ceil(r * 1.3)
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const x = dx * Math.cos(rot) + dy * Math.sin(rot)
      const y = (-dx * Math.sin(rot) + dy * Math.cos(rot)) / ax
      const q = (x * x + y * y) / (r * r)
      if (q >= 1) continue
      const z = top * Math.pow(1 - q, 0.45) * ((r * 1024) / n / 24 + 0.5)
      const o = ((((Math.round(cy) + dy) % n) + n) % n) * n + ((((Math.round(cx) + dx) % n) + n) % n)
      if (z > h[o]) {
        h[o] = z
        id[o] = tag
      }
    }
  }
  const out = normalFromHeight(h, n, 18)
  for (let i = 0; i < n * n; i++) out[i * 3 + 2] = Math.round(id[i] * 255)
  return [await writePng(`${dir}/base-sand.lin.tile.w512.png`, n, n, 3, up(out, n, n, 3))]
}
