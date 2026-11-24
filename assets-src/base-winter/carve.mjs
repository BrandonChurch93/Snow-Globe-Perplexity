import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { blur, clamp, fbm, luminance, readRgb, sampleBilinear, smooth } from './lib.mjs'
import { CARVING, lift, meridian, sOfH } from './profile.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const RAD = Math.PI / 180
export const PX_PER_MM = 30

const SOURCES = {
  one: 'gen/carving-take1.png',
  two: 'gen/carving-take2.png',
}

const MOTIFS = {
  sprayL1: { src: 'one', box: [25, 15, 1350, 375], anchor: [670, 345] },
  sprayL2: { src: 'one', box: [25, 400, 1350, 755], anchor: [670, 728] },
  sprayL3: { src: 'one', box: [25, 765, 1350, 1125], anchor: [670, 1098] },
  sprayL4: { src: 'one', box: [25, 1150, 1350, 1510], anchor: [670, 1480] },
  sprayR1: { src: 'one', box: [1395, 15, 2715, 375], anchor: [2035, 345] },
  sprayR2: { src: 'one', box: [1395, 400, 2715, 755], anchor: [2035, 728] },
  halfLeft: { src: 'one', box: [25, 15, 684, 375], anchor: [670, 345] },
  halfRight: { src: 'one', box: [660, 765, 1350, 1125], anchor: [670, 1098] },
  berries: { src: 'one', box: [1950, 1318, 2170, 1500], anchor: [2062, 1420] },
  twigA: { src: 'two', box: [20, 160, 405, 350] },
  twigB: { src: 'two', box: [440, 160, 820, 350] },
  twigC: { src: 'two', box: [850, 160, 1230, 350] },
  twigD: { src: 'two', box: [1265, 165, 1655, 350] },
  twigE: { src: 'two', box: [20, 575, 410, 775] },
  fan: { src: 'two', box: [445, 560, 815, 785], anchor: [630, 748] },
  twigG: { src: 'two', box: [850, 580, 1235, 770] },
  twigH: { src: 'two', box: [1260, 585, 1660, 770] },
}

export const STAMPS = [
  { motif: 'halfLeft', az: 0.4, h: 11.2, rot: -3, mmPerPx: 0.037 },
  { motif: 'halfRight', az: 0.9, h: 11.2, rot: 4, mmPerPx: 0.0405 },
  { motif: 'berries', az: 0.6, h: 11.0, rot: 6, mmPerPx: 0.024, gain: 1.12 },
  { motif: 'sprayL2', az: -47, h: 12.7, rot: -5, mmPerPx: 0.032 },
  { motif: 'fan', az: -80.5, h: 11.8, rot: 3, width: 20 },
  { motif: 'twigD', az: -104, h: 16.2, rot: 10, width: 23 },
  { motif: 'twigA', az: -143, h: 16.0, rot: -8, width: 26.6, flip: true },
  { motif: 'sprayR2', az: 179.2, h: 11.9, rot: 0, mmPerPx: 0.0335 },
  { motif: 'berries', az: 179.0, h: 11.6, rot: -8, mmPerPx: 0.02, gain: 1.1 },
  { motif: 'fan', az: 145, h: 11.6, rot: -4, width: 19, flip: true },
  { motif: 'sprayL3', az: 111.8, h: 12.2, rot: 3, mmPerPx: 0.032, flip: true },
  { motif: 'sprayR1', az: 66, h: 12.5, rot: 6, mmPerPx: 0.032 },
]

export const CONES = [
  { az: 37.8, h: 15.5, long: 12.2, wide: 10, lean: 28, fine: true },
  { az: -122.5, h: 15.4, long: 10.6, wide: 8.8, lean: -22, fine: false },
]

async function loadMotifs() {
  const pictures = {}
  for (const [k, f] of Object.entries(SOURCES)) {
    const img = await readRgb(path.join(HERE, f))
    pictures[k] = { w: img.w, h: img.h, l: luminance(img) }
  }
  const out = {}
  for (const [name, m] of Object.entries(MOTIFS)) {
    const pic = pictures[m.src]
    const [x0, y0, x1, y1] = m.box
    const w = x1 - x0
    const h = y1 - y0
    const data = new Float32Array(w * h)
    let peak = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) peak = Math.max(peak, pic.l[(y + y0) * pic.w + x + x0])
    const feather = Math.max(4, Math.round(w * 0.012))
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = pic.l[(y + y0) * pic.w + x + x0] / peak
        const edge = Math.min(x, y, w - 1 - x, h - 1 - y)
        const body = smooth(0.035, 0.13, l)
        data[y * w + x] = body * (0.42 + 0.58 * Math.pow(l, 0.8)) * smooth(0, feather, edge)
      }
    }
    const soft = blur(data, w, h, m.src === 'one' ? 1.1 : 0.55)
    const anchor = m.anchor ? [m.anchor[0] - x0, m.anchor[1] - y0] : [w / 2, h / 2]
    out[name] = { w, h, data: soft, anchor }
  }
  return out
}

export async function buildField() {
  const mer = meridian()
  const sLow = sOfH(mer, CARVING.low)
  const sHigh = sOfH(mer, CARVING.high)
  const around = 2 * Math.PI * CARVING.rRef
  const W = Math.round(around * PX_PER_MM)
  const H = Math.round((sHigh - sLow) * PX_PER_MM)
  const field = new Float32Array(W * H)
  const motifs = await loadMotifs()
  const xOf = (az) => (az * RAD + Math.PI) * CARVING.rRef * PX_PER_MM
  const yOf = (h) => (sOfH(mer, lift(h)) - sLow) * PX_PER_MM
  for (const st of STAMPS) {
    const m = motifs[st.motif]
    const mmPerPx = st.mmPerPx ?? st.width / m.w
    const scale = mmPerPx * PX_PER_MM
    const cx = xOf(st.az)
    const cy = yOf(st.h)
    const c = Math.cos((st.rot ?? 0) * RAD)
    const s = Math.sin((st.rot ?? 0) * RAD)
    const reach = Math.hypot(m.w, m.h) * scale
    const gain = st.gain ?? 1
    for (let j = Math.max(0, Math.floor(cy - reach)); j <= Math.min(H - 1, Math.ceil(cy + reach)); j++) {
      for (let i0 = Math.floor(cx - reach); i0 <= Math.ceil(cx + reach); i0++) {
        const dx = i0 + 0.5 - cx
        const dy = j + 0.5 - cy
        const lx = (dx * c + dy * s) / scale
        const ly = (-dx * s + dy * c) / scale
        const u = m.anchor[0] + (st.flip ? -lx : lx)
        const v = m.anchor[1] - ly
        if (u < 0 || v < 0 || u > m.w - 1 || v > m.h - 1) continue
        const val = sampleBilinear(m.data, m.w, m.h, u, v) * gain
        const i = ((i0 % W) + W) % W
        if (val > field[j * W + i]) field[j * W + i] = val
      }
    }
  }
  const fadeRows = Math.round(0.9 * PX_PER_MM)
  for (let j = 0; j < H; j++) {
    const edge = smooth(0, fadeRows, Math.min(j, H - 1 - j))
    for (let i = 0; i < W; i++) {
      const tool = (fbm((i / W) * 900, (j / H) * 46, 900, 46, 71, 3) - 0.5) * 0.016 + (fbm((i / W) * 5200, (j / H) * 260, 5200, 260, 13, 2) - 0.5) * 0.005
      const v = field[j * W + i]
      field[j * W + i] = clamp(v * edge + tool * (1 - smooth(0.05, 0.4, v)), -0.05, 1.2)
    }
  }
  const soft = blur(field, W, H, 0.2 * PX_PER_MM, true, false)
  const wide = blur(field, W, H, 0.75 * PX_PER_MM, true, false)
  const sample = (data) => (az, s) => {
    const x = (((az * RAD + Math.PI) / (2 * Math.PI)) % 1 + 1) % 1 * W - 0.5
    const y = (s - sLow) * PX_PER_MM - 0.5
    if (y < 0 || y > H - 1) return 0
    const x0 = Math.floor(x)
    const fx = x - x0
    const y0 = Math.min(Math.floor(y), H - 2)
    const fy = y - y0
    const xa = ((x0 % W) + W) % W
    const xb = (xa + 1) % W
    const a = data[y0 * W + xa]
    const b = data[y0 * W + xb]
    const c2 = data[(y0 + 1) * W + xa]
    const d = data[(y0 + 1) * W + xb]
    return a + (b - a) * fx + (c2 - a) * fy + (a - b - c2 + d) * fx * fy
  }
  return { W, H, field, soft, wide, sLow, sHigh, mer, at: sample(field), atSoft: sample(soft), atWide: sample(wide) }
}
