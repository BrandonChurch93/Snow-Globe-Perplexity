import { openingPlan } from './opening'

export type PackPicture = { key: number } | { from: number; patches: [number, number, number][] }

export interface PackManifest {
  version: number
  width: number
  height: number
  fps: number
  frameCount: number
  background: string
  images: [number, number][]
  pictures: PackPicture[]
  frames: number[]
}

export type PackName = 'hd' | 'master'

export const PACK_VERSION = 1
export const HOSTED_PACK = 'opening/'
export const MASTER_PACK = 'opening-master/'
export const MASTER_OFFER = '__opening'
const FILES = { manifest: 'manifest.json', bin: 'opening.bin' }
const AHEAD = 12
const WINDOW_PICTURES = 4
const AGAIN = 'Make it again with npm run opening.'

const whole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0

export function readManifest(input: unknown, binBytes: number, plan: { frameCount: number; fps: number }): PackManifest {
  const m = input as PackManifest | null
  if (!m || typeof m !== 'object') throw new Error("the opening pack's manifest is not a manifest")
  if (m.version !== PACK_VERSION) throw new Error(`the opening pack is version ${String(m.version)}, and this build reads version ${PACK_VERSION}`)
  const lists = Array.isArray(m.images) && Array.isArray(m.pictures) && Array.isArray(m.frames)
  if (!lists || !whole(m.width) || !whole(m.height) || m.width < 1 || m.height < 1 || typeof m.background !== 'string') throw new Error("the opening pack's manifest is damaged")
  if (m.frameCount !== plan.frameCount || m.frames.length !== m.frameCount || m.fps !== plan.fps) throw new Error(`the opening pack holds ${m.frames.length} frames at ${String(m.fps)} a second, and the film's opening is ${plan.frameCount} frames at ${plan.fps}. ${AGAIN}`)
  if (!m.images.every((i) => Array.isArray(i) && whole(i[0]) && whole(i[1]) && i[1] > 0 && i[0] + i[1] <= binBytes)) throw new Error(`the pictures of the opening pack do not fit its file, so the pack is damaged. ${AGAIN}`)
  const image = (n: unknown): boolean => whole(n) && n < m.images.length
  const sound = m.pictures.every((p, q) => (p && 'key' in p ? image(p.key) : !!p && whole(p.from) && p.from < q && Array.isArray(p.patches) && p.patches.every((c) => Array.isArray(c) && image(c[0]) && whole(c[1]) && whole(c[2]))))
  if (!sound || !m.frames.every((p) => whole(p) && p < m.pictures.length)) throw new Error(`the opening pack's manifest names a picture it does not hold. ${AGAIN}`)
  return m
}

export const imagesOf = (p: PackPicture): number[] => ('key' in p ? [p.key] : p.patches.map((c) => c[0]))

export function chainTo(pictures: readonly PackPicture[], shown: number, target: number): number[] {
  const out: number[] = []
  for (let q = target; q !== shown; ) {
    out.push(q)
    const p = pictures[q]!
    if ('key' in p) break
    q = p.from
  }
  return out.reverse()
}

export function fitBox(w: number, h: number, pw: number, ph: number): { x: number; y: number; w: number; h: number; scale: number } {
  const scale = Math.min(w / pw, h / ph)
  const bw = Math.min(w, Math.round(pw * scale))
  const bh = Math.min(h, Math.round(ph * scale))
  return { x: Math.floor((w - bw) / 2), y: Math.floor((h - bh) / 2), w: bw, h: bh, scale }
}

export function imagePixels(bytes: Uint8Array, fallback: number): number {
  const tag = (o: number): string => String.fromCharCode(bytes[o]!, bytes[o + 1]!, bytes[o + 2]!, bytes[o + 3]!)
  if (bytes.length < 30 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return fallback
  if (tag(12) === 'VP8L' && bytes[20] === 0x2f) {
    const bits = bytes[21]! | (bytes[22]! << 8) | (bytes[23]! << 16) | (bytes[24]! << 24)
    return ((bits & 0x3fff) + 1) * (((bits >>> 14) & 0x3fff) + 1)
  }
  if (tag(12) === 'VP8X') return ((bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)) + 1) * ((bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) + 1)
  return fallback
}

export function windowOf(m: PackManifest, chain: readonly number[], frame: number, pixelsOf: (image: number) => number): Set<number> {
  const out = new Set<number>()
  let pixels = 0
  const add = (picture: number): void => {
    for (const n of imagesOf(m.pictures[picture]!)) {
      if (out.has(n)) continue
      out.add(n)
      pixels += pixelsOf(n)
    }
  }
  for (const q of chain) add(q)
  const budget = Math.max(pixels, WINDOW_PICTURES * m.width * m.height)
  let last = chain.length ? chain[chain.length - 1]! : m.frames[frame]!
  for (let f = frame + 1; f < m.frameCount && f <= frame + AHEAD && pixels < budget; f++) {
    const p = m.frames[f]!
    if (p === last) continue
    add(p)
    last = p
  }
  return out
}

const views = new WeakMap<HTMLElement, { canvas: HTMLCanvasElement; pen: CanvasRenderingContext2D; reel: Reel | null; picture: number }>()

class Reel {
  readonly board: HTMLCanvasElement
  shown = -1
  broken = false
  private readonly pen: CanvasRenderingContext2D
  private readonly held = new Map<number, ImageBitmap>()
  private readonly asked = new Set<number>()
  private readonly pinned: Set<number>
  private readonly sizes = new Map<number, number>()
  private window = new Set<number>()
  private waiting: { root: HTMLElement; frame: number } | null = null
  private busy: Promise<void> = Promise.resolve()

  constructor(
    readonly name: PackName,
    readonly m: PackManifest,
    private readonly bin: ArrayBuffer,
  ) {
    this.board = document.createElement('canvas')
    this.board.width = m.width
    this.board.height = m.height
    const pen = this.board.getContext('2d', { alpha: false })
    if (!pen) throw new Error('this browser gives the opening no canvas to draw on')
    this.pen = pen
    this.pinned = new Set(imagesOf(m.pictures[m.frames[0]!]!))
  }

  private bytes(n: number): Uint8Array<ArrayBuffer> {
    const [at, length] = this.m.images[n]!
    return new Uint8Array(this.bin, at, length)
  }

  private pixels = (n: number): number => {
    let s = this.sizes.get(n)
    if (s === undefined) this.sizes.set(n, (s = imagePixels(this.bytes(n), this.m.width * this.m.height)))
    return s
  }

  private async decode(n: number): Promise<ImageBitmap> {
    const blob = new Blob([this.bytes(n)], { type: 'image/webp' })
    try {
      return await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
    } catch {
      throw new Error(`a picture of the opening pack could not be decoded (image ${n}), so the pack is damaged. ${AGAIN}`)
    }
  }

  private put(q: number, bitmaps: readonly ImageBitmap[]): void {
    const p = this.m.pictures[q]!
    const { width, height } = this.m
    if ('key' in p) {
      const b = bitmaps[0]!
      if (b.width !== width || b.height !== height) throw new Error(`a whole picture of the opening pack is ${b.width} x ${b.height}, not ${width} x ${height}. ${AGAIN}`)
      this.pen.drawImage(b, 0, 0)
    } else {
      p.patches.forEach(([, x, y], i) => {
        const b = bitmaps[i]!
        if (x + b.width > width || y + b.height > height) throw new Error(`a part of a picture of the opening pack lies outside the picture. ${AGAIN}`)
        this.pen.drawImage(b, x, y)
      })
    }
    this.shown = q
  }

  private ask(n: number): void {
    if (this.held.has(n) || this.asked.has(n)) return
    this.asked.add(n)
    void this.decode(n).then(
      (b) => {
        this.asked.delete(n)
        if (this.broken || (!this.window.has(n) && !this.pinned.has(n))) return b.close()
        this.held.set(n, b)
        const w = this.waiting
        if (w) this.show(w.root, w.frame)
      },
      () => {
        this.asked.delete(n)
        this.broken = true
      },
    )
  }

  private trim(): void {
    for (const [n, b] of this.held) {
      if (this.window.has(n) || this.pinned.has(n)) continue
      b.close()
      this.held.delete(n)
    }
  }

  show(root: HTMLElement, frame: number): void {
    if (this.broken) return
    const chain = chainTo(this.m.pictures, this.shown, this.m.frames[frame]!)
    this.window = windowOf(this.m, chain, frame, this.pixels)
    for (const n of this.window) this.ask(n)
    if (!chain.every((q) => imagesOf(this.m.pictures[q]!).every((n) => this.held.has(n)))) {
      this.waiting = { root, frame }
      return
    }
    this.waiting = null
    try {
      for (const q of chain) this.put(q, imagesOf(this.m.pictures[q]!).map((n) => this.held.get(n)!))
      this.trim()
      paint(root, this)
    } catch {
      this.broken = true
    }
  }

  exact(root: HTMLElement | null, frame: number): Promise<void> {
    const run = this.busy.then(async () => {
      for (const q of chainTo(this.m.pictures, this.shown, this.m.frames[frame]!)) {
        const images = imagesOf(this.m.pictures[q]!)
        const own: ImageBitmap[] = []
        const bitmaps = await Promise.all(
          images.map(async (n) => {
            const kept = this.held.get(n)
            if (kept) return kept
            const b = await this.decode(n)
            if (this.pinned.has(n) && !this.held.has(n)) this.held.set(n, b)
            else own.push(b)
            return b
          }),
        )
        try {
          this.put(q, bitmaps)
        } finally {
          for (const b of own) b.close()
        }
      }
      if (root) paint(root, this)
    })
    this.busy = run.catch(() => undefined)
    return run
  }
}

function paint(root: HTMLElement, reel: Reel): void {
  let view = views.get(root)
  if (!view) {
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;display:block'
    const pen = canvas.getContext('2d', { alpha: false })
    if (!pen) throw new Error('this browser gives the opening no canvas to draw on')
    root.replaceChildren(canvas)
    views.set(root, (view = { canvas, pen, reel: null, picture: -1 }))
  }
  const hidden = root.hidden
  if (hidden) root.hidden = false
  const ratio = window.devicePixelRatio || 1
  const w = Math.max(1, Math.round(root.clientWidth * ratio))
  const h = Math.max(1, Math.round(root.clientHeight * ratio))
  if (hidden) root.hidden = true
  const { canvas, pen } = view
  const resized = canvas.width !== w || canvas.height !== h
  if (resized) {
    canvas.width = w
    canvas.height = h
  }
  if (!resized && view.reel === reel && view.picture === reel.shown) return
  const box = fitBox(w, h, reel.m.width, reel.m.height)
  if (box.w < w || box.h < h) {
    pen.fillStyle = reel.m.background
    pen.fillRect(0, 0, w, h)
  }
  pen.imageSmoothingEnabled = box.w !== reel.m.width || box.h !== reel.m.height
  pen.imageSmoothingQuality = 'high'
  pen.drawImage(reel.board, box.x, box.y, box.w, box.h)
  view.reel = reel
  view.picture = reel.shown
  root.dataset.pack = reel.name === 'master' ? 'master' : box.w > reel.m.width ? 'hd, enlarged' : 'hd'
}

const packs = new Map<string, Promise<Reel>>()
let live: Reel | null = null
let ready: Promise<void> | null = null
let asked: { root: HTMLElement; frame: number } | null = null
let offer: Promise<boolean> | null = null

async function load(dir: string, name: PackName): Promise<Reel> {
  const base = new URL(dir, document.baseURI)
  const get = async (file: string): Promise<Response> => {
    let r: Response
    try {
      r = await fetch(new URL(file, base))
    } catch {
      throw new Error(`the opening pack could not be fetched: ${dir}${file} did not answer`)
    }
    if (!r.ok) throw new Error(`the opening pack is missing: ${dir}${file} answered ${r.status}. Make it with npm run opening.`)
    return r
  }
  const [manifest, bin] = await Promise.all([
    get(FILES.manifest).then((r) => r.json() as Promise<unknown>).catch((e: unknown) => {
      throw e instanceof SyntaxError ? new Error(`the opening pack's manifest (${dir}${FILES.manifest}) is not JSON, so the pack is damaged. ${AGAIN}`) : e
    }),
    get(FILES.bin).then((r) => r.arrayBuffer()),
  ])
  return new Reel(name, readManifest(manifest, bin.byteLength, openingPlan()), bin)
}

function pack(dir: string, name: PackName): Promise<Reel> {
  let p = packs.get(dir)
  if (!p) packs.set(dir, (p = load(dir, name)))
  return p
}

function masterOffered(): Promise<boolean> {
  return (offer ??= fetch(new URL(MASTER_OFFER, document.baseURI)).then(
    async (r) => r.ok && ((await r.json()) as { master?: unknown }).master === true,
    () => false,
  ).catch(() => false))
}

export const openingLoaded = (): boolean => live !== null

export function loadOpening(): Promise<void> {
  return (ready ??= pack(HOSTED_PACK, 'hd')
    .then(async (reel) => {
      await reel.exact(null, 0)
      live = reel
      const a = asked
      asked = null
      if (a) drawOpening(a.root, a.frame)
    })
    .catch(() => undefined))
}

export function drawOpening(root: HTMLElement, frame: number): void {
  if (!live) {
    asked = { root, frame }
    void loadOpening()
    return
  }
  live.show(root, Math.max(0, Math.min(live.m.frameCount - 1, Math.round(frame))))
}

export async function renderOpening(root: HTMLElement, frame: number, surfaceWidth: number): Promise<void> {
  const hd = await pack(HOSTED_PACK, 'hd')
  const reel = surfaceWidth > hd.m.width && (await masterOffered()) ? await pack(MASTER_PACK, 'master') : hd
  if (!Number.isInteger(frame) || frame < 0 || frame >= reel.m.frameCount) throw new Error(`the opening has no frame ${frame}: it holds ${reel.m.frameCount}`)
  await reel.exact(root, frame)
}
