import sharp from 'sharp'
import { createServer } from 'vite'
import { rel } from '../../tools/lib/paths.mjs'

export async function loadSource(files) {
  const server = await createServer({ root: rel(), configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } })
  try {
    const out = []
    for (const f of files) out.push(await server.ssrLoadModule(f))
    return out
  } finally {
    await server.close()
  }
}

export async function readPicture(file, size) {
  const { data, info } = await sharp(file).resize(size, size, { kernel: 'lanczos3' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const px = new Float32Array(info.width * info.height * 3)
  for (let i = 0; i < px.length; i++) px[i] = data[i] / 255
  return { px, w: info.width, h: info.height }
}

export function seamless(img, margin) {
  const { px, w, h } = img
  const m = Math.round(w * margin)
  const ow = w - m
  const oh = h - m
  const ramp = (t) => t * t * (3 - 2 * t)
  const tmp = new Float32Array(ow * h * 3)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < ow; x++) {
      const t = x < m ? ramp(x / m) : 1
      for (let c = 0; c < 3; c++) tmp[(y * ow + x) * 3 + c] = px[(y * w + x) * 3 + c] * t + (t < 1 ? px[(y * w + x + ow) * 3 + c] * (1 - t) : 0)
    }
  }
  const out = new Float32Array(ow * oh * 3)
  for (let y = 0; y < oh; y++) {
    const t = y < m ? ramp(y / m) : 1
    for (let x = 0; x < ow; x++) {
      for (let c = 0; c < 3; c++) out[(y * ow + x) * 3 + c] = tmp[(y * ow + x) * 3 + c] * t + (t < 1 ? tmp[((y + oh) * ow + x) * 3 + c] * (1 - t) : 0)
    }
  }
  return { px: out, w: ow, h: oh }
}

export function blurWrap(src, w, h, radius) {
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  const k = 2 * radius + 1
  for (let pass = 0; pass < 2; pass++) {
    const a = pass === 0 ? src : out
    for (let y = 0; y < h; y++) {
      let s = 0
      for (let i = -radius; i <= radius; i++) s += a[y * w + ((i + w) % w)]
      for (let x = 0; x < w; x++) {
        tmp[y * w + x] = s / k
        s += a[y * w + ((x + radius + 1) % w)] - a[y * w + ((x - radius + w) % w)]
      }
    }
    for (let x = 0; x < w; x++) {
      let s = 0
      for (let i = -radius; i <= radius; i++) s += tmp[((i + h) % h) * w + x]
      for (let y = 0; y < h; y++) {
        out[y * w + x] = s / k
        s += tmp[((y + radius + 1) % h) * w + x] - tmp[((y - radius + h) % h) * w + x]
      }
    }
  }
  return out
}

export const luma = (img) => {
  const out = new Float32Array(img.w * img.h)
  for (let i = 0; i < out.length; i++) out[i] = 0.2126 * img.px[i * 3] + 0.7152 * img.px[i * 3 + 1] + 0.0722 * img.px[i * 3 + 2]
  return out
}

export function normalsOf(height, w, h, strength) {
  const out = Buffer.alloc(w * h * 3)
  for (let y = 0; y < h; y++) {
    const yu = (y - 1 + h) % h
    const yd = (y + 1) % h
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w
      const xr = (x + 1) % w
      const dx = (height[y * w + xr] - height[y * w + xl]) * 0.5 * strength
      const dy = (height[yd * w + x] - height[yu * w + x]) * 0.5 * strength
      const l = Math.hypot(dx, dy, 1)
      const o = (y * w + x) * 3
      out[o] = Math.round((-dx / l) * 127.5 + 127.5)
      out[o + 1] = Math.round((dy / l) * 127.5 + 127.5)
      out[o + 2] = Math.round((1 / l) * 127.5 + 127.5)
    }
  }
  return out
}

export async function writePng(file, bytes, w, h, channels, size) {
  let s = sharp(bytes, { raw: { width: w, height: h, channels } })
  if (size && (size !== w || size !== h)) s = s.resize(size, size, { kernel: 'lanczos3' })
  await s.png({ compressionLevel: 9 }).toFile(file)
}

export const toBytes = (px) => {
  const out = Buffer.alloc(px.length)
  for (let i = 0; i < px.length; i++) out[i] = Math.round(Math.min(1, Math.max(0, px[i])) * 255)
  return out
}
