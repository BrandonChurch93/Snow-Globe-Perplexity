import { rel } from '../../tools/lib/paths.mjs'
import { blur, clamp, fbm, hashInt, writePng } from './lib.mjs'

// Hammered iron: a field of shallow dents, each one a facet, as a normal (r, g) and a roughness (b), tiling.
export async function ironDetail(dir) {
  const px = 1024
  const cells = 22
  const H = new Float32Array(px * px)
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const u = (x / px) * cells
      const v = (y / px) * cells
      const cx = Math.floor(u)
      const cy = Math.floor(v)
      let best = 9
      let second = 9
      let id = 0
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const gx = cx + i
          const gy = cy + j
          const wx = ((gx % cells) + cells) % cells
          const wy = ((gy % cells) + cells) % cells
          const px0 = gx + 0.15 + 0.7 * hashInt(wx, wy, 5)
          const py0 = gy + 0.15 + 0.7 * hashInt(wx, wy, 9)
          const d = Math.hypot(u - px0, (v - py0) * (0.8 + 0.4 * hashInt(wx, wy, 13)))
          if (d < best) {
            second = best
            best = d
            id = hashInt(wx, wy, 21)
          } else if (d < second) second = d
        }
      }
      const dent = clamp(1 - (best / 0.62) ** 2, 0, 1)
      const ridge = clamp((second - best) / 0.22, 0, 1)
      H[y * px + x] = -0.55 * dent * (0.5 + 0.9 * id) + 0.25 * ridge + 0.5 * fbm((x / px) * 6, (y / px) * 6, 6, 6, 3, 4) + 0.12 * fbm((x / px) * 48, (y / px) * 48, 48, 48, 8, 2)
    }
  }
  const S = blur(H, px, px, 1.1, true, true)
  const out = new Uint8Array(px * px * 3)
  const k = 9
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const xm = S[y * px + ((x + px - 1) % px)]
      const xp = S[y * px + ((x + 1) % px)]
      const ym = S[((y + px - 1) % px) * px + x]
      const yp = S[((y + 1) % px) * px + x]
      const gx = (xp - xm) * k
      const gy = (yp - ym) * k
      const l = Math.hypot(gx, gy, 1)
      const i = (y * px + x) * 3
      out[i] = Math.round(clamp(0.5 - (0.5 * gx) / l) * 255)
      out[i + 1] = Math.round(clamp(0.5 - (0.5 * gy) / l) * 255)
      const pit = fbm((x / px) * 90, (y / px) * 90, 90, 90, 31, 2)
      out[i + 2] = Math.round(clamp(0.35 + 0.5 * fbm((x / px) * 10, (y / px) * 10, 10, 10, 15, 4) + 0.5 * (pit - 0.5) - 0.25 * (S[y * px + x] + 0.2)) * 255)
    }
  }
  return writePng(rel(dir, 'base-iron-detail.lin.tile.w1024.png'), px, px, 3, out)
}

// The carved faces, of our own design: triangles for eyes and nose, a grin with teeth. Four of them, each as a signed
// distance to the edge of its openings (0.5 at the edge, more inside), in one sheet of two by two.
const tri = (cx, cy, w, h, lean, flip = 1) => [
  [cx - (w / 2) * flip, cy - h / 2 + lean * flip * 0],
  [cx + (w / 2) * flip, cy - h / 2 - lean],
  [cx + (w / 2) * flip * 0.2, cy + h / 2],
]
// A mouth: a crescent whose two edges meet at the corners, with teeth standing into it from above and from below
// (pointed, or square with `square`).
function grin(w, top, bottom, lift, teeth, bite, square = false) {
  const n = 120
  const up = []
  const low = []
  const wave = (x, shift) => {
    const f = ((x / (2 * w) + 0.5) * teeth + shift) % 1
    return square ? (f > 0.28 && f < 0.72 ? 1 : 0) : 1 - Math.abs(f * 2 - 1)
  }
  for (let i = 0; i <= n; i++) {
    const x = -w + (2 * w * i) / n
    const q = (x / w) ** 2
    const open = (top - bottom) * (1 - q)
    const b = Math.min(bite, open * 0.42)
    up.push([x, top + lift * q - b * wave(x, 0.5)])
    low.push([x, top + lift * q - open + b * wave(x, 0)])
  }
  return [...up, ...low.reverse().slice(1, -1)]
}
// Four carvings that no one would take for copies of one: a sly one with slanted eyes, a brute with a brow and three big
// teeth, a startled one with round eyes of two sizes, and a scowl.
const arch = (cx, cy, w, h, thick) => {
  const top = []
  const low = []
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * (i / 10)
    top.push([cx - (w / 2) * Math.cos(a), cy + h * Math.sin(a)])
    low.push([cx - (w / 2 - thick * 0.4) * Math.cos(a), cy + (h - thick) * Math.sin(a) - thick * 0.1])
  }
  return [...top, ...low.reverse()]
}
const quad = (cx, cy, w, h, slant, flip) => [
  [cx - (w / 2) * flip, cy + h / 2 + slant],
  [cx + (w / 2) * flip, cy + h / 2 - slant],
  [cx + (w / 2) * flip * 0.8, cy - h / 2],
  [cx - (w / 2) * flip * 0.9, cy - h / 2 + slant * 0.3],
]
const round = (cx, cy, rx, ry, n = 14) => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((2 * Math.PI * i) / n), cy + ry * Math.sin((2 * Math.PI * i) / n)])
const DESIGNS = [
  [tri(-0.36, 0.3, 0.46, 0.34, 0.2, 1), tri(0.36, 0.3, 0.46, 0.34, 0.2, -1), [[-0.07, -0.04], [0.07, -0.04], [0, 0.1]], grin(0.68, -0.3, -0.6, 0.34, 5, 0.12)],
  [quad(-0.36, 0.32, 0.5, 0.3, 0.13, 1), quad(0.36, 0.32, 0.5, 0.3, 0.13, -1), [[-0.12, -0.1], [0, -0.02], [0.12, -0.1], [0, 0.16]], grin(0.74, -0.26, -0.74, 0.24, 4, 0.17, true)],
  [round(-0.36, 0.3, 0.2, 0.17, 12), round(0.34, 0.33, 0.16, 0.2, 12), [[-0.08, -0.06], [0.08, -0.06], [0, 0.1]], grin(0.62, -0.24, -0.66, 0.3, 4, 0.14)],
  [tri(-0.36, 0.34, 0.44, -0.3, -0.1, 1), tri(0.36, 0.34, 0.44, -0.3, -0.1, -1), [[-0.03, -0.12], [0.03, -0.12], [0.03, 0.1], [-0.03, 0.1]], grin(0.62, -0.36, -0.64, -0.22, 6, 0.1)],
]
function inside(poly, x, y) {
  let c = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
function distance(poly, x, y) {
  let best = 9
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j]
    const [bx, by] = poly[i]
    const dx = bx - ax
    const dy = by - ay
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1)
    best = Math.min(best, Math.hypot(x - ax - dx * t, y - ay - dy * t))
  }
  return best
}
export const FACE_RANGE = 0.25
export async function faces(dir) {
  const cell = 512
  const px = cell * 2
  const out = new Uint8Array(px * px)
  DESIGNS.forEach((polys, k) => {
    const ox = (k % 2) * cell
    const oy = Math.floor(k / 2) * cell
    for (let y = 0; y < cell; y++) {
      for (let x = 0; x < cell; x++) {
        const u = ((x + 0.5) / cell) * 2 - 1
        const v = 1 - ((y + 0.5) / cell) * 2
        let d = 9
        let within = false
        for (const p of polys) {
          d = Math.min(d, distance(p, u, v))
          within = within || inside(p, u, v)
        }
        out[(oy + y) * px + ox + x] = Math.round(clamp(0.5 + ((within ? d : -d) / FACE_RANGE) * 0.5) * 255)
      }
    }
  })
  return writePng(rel(dir, 'base-faces.lin.w1024.png'), px, px, 1, out)
}
