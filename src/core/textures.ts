import * as THREE from 'three'
import type { AssetFile, Assets } from './assets'

interface Entry {
  texture: THREE.Texture
  bytes: number
  group: string
}

/** A picture drawn from its `.first.` file, whose whole file is still to come. */
interface Owed {
  name: string
  group: string
  file: AssetFile
}

const textures = new Map<string, Entry>()
const binaries = new Map<string, ArrayBuffer>()
const groups = new Map<string, Promise<void>>()
const owed: Owed[] = []
let anisotropy = 1
let fetching: Promise<void> | null = null

const MIP_SHARE = 4 / 3
/** How many whole files are fetched and decoded side by side while the picture runs. */
const DETAIL_LANES = 2
const PLAIN: ImageBitmapOptions = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' }

export function setAnisotropy(value: number): void {
  anisotropy = Math.max(1, value)
  for (const e of textures.values()) e.texture.anisotropy = anisotropy
}

const decode = (data: ArrayBuffer): Promise<ImageBitmap> => createImageBitmap(new Blob([data]), { ...PLAIN, imageOrientation: 'flipY' })

/**
 * A `.first.` file holds the picture at half the size. It is drawn at the size of the whole picture, each pixel four times, so
 * that every mip level but the largest is what the whole picture gives, and so that code which reads the size of a texture
 * when it builds a material reads the size it will have.
 */
async function decodeFirst(data: ArrayBuffer): Promise<ImageBitmap> {
  const half = await decode(data)
  try {
    return await createImageBitmap(half, { ...PLAIN, resizeWidth: half.width * 2, resizeHeight: half.height * 2, resizeQuality: 'pixelated' })
  } finally {
    half.close()
  }
}

function add(name: string, bitmap: ImageBitmap, group: string): void {
  const t = new THREE.Texture(bitmap)
  const colour = /\.srgb\./i.test(name)
  const tile = /\.tile\./i.test(name)
  t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.flipY = false
  t.wrapS = tile ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  t.wrapT = tile ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.generateMipmaps = true
  t.anisotropy = anisotropy
  t.name = name
  t.needsUpdate = true
  textures.set(name, { texture: t, bytes: Math.round(bitmap.width * bitmap.height * 4 * MIP_SHARE), group })
}

export function prepareGroup(assets: Assets, group: string): Promise<void> {
  let p = groups.get(group)
  if (!p) {
    p = Promise.all(
      assets.entries(group).map(async (e) => {
        const file = assets.early(e)
        const data = await assets.fetchFile(file.path)
        if (!e.picture) {
          binaries.set(e.name, data)
          return
        }
        const first = file !== e.file
        add(e.name, first ? await decodeFirst(data) : await decode(data), group)
        assets.release(file.path)
        if (first) owed.push({ name: e.name, group, file: e.file })
      }),
    ).then(() => undefined)
    groups.set(group, p)
  }
  return p
}

/** How many pictures are drawn from their `.first.` file and still wait for the whole one. */
export const detailOwed = (group?: string): number => owed.filter((o) => !group || o.group === group).length

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    if (typeof requestAnimationFrame !== 'function' || document.visibilityState === 'hidden') setTimeout(resolve, 16)
    else requestAnimationFrame(() => resolve())
  })

/** A page whose frames take longer than this is slow for other reasons, and gains nothing from spreading uploads over frames. */
const SLOW_FRAME_MS = 100
let frameAt = 0
let frameMs = 0

/**
 * Waits for the turn of the next picture to go to the GPU: the next frame, so that no frame carries more than one upload.
 * Where the page needed more than SLOW_FRAME_MS to give the last frame, every picture that is decoded within that time of
 * it goes with it instead, so a slow device does not also wait a frame for each picture.
 */
async function turn(): Promise<void> {
  if (frameMs > SLOW_FRAME_MS && performance.now() - frameAt < frameMs) return
  const asked = performance.now()
  await nextFrame()
  frameAt = performance.now()
  frameMs = frameAt - asked
}

/**
 * Fetches the whole file of every picture that was drawn from its `.first.` file, and puts it in place of the half one.
 * Fetching and decoding happen off the page's thread; a picture is handed to the GPU between two frames, one picture a frame
 * (see `turn`), so the picture never waits for more than one upload. Safe to call again: pictures of groups prepared later
 * are taken up.
 */
export function loadDetail(assets: Assets): Promise<void> {
  if (fetching) return fetching.then(() => (owed.length ? loadDetail(assets) : undefined))
  if (!owed.length) return Promise.resolve()
  let handing: Promise<void> = Promise.resolve()
  const failed: Owed[] = []
  const lane = async (): Promise<void> => {
    for (let o = owed.shift(); o; o = owed.shift()) {
      const { name, file } = o
      try {
        const bitmap = await decode(await assets.fetchFile(file.path, true))
        assets.release(file.path)
        handing = handing.then(turn).then(() => {
          const e = textures.get(name)
          if (!e) return bitmap.close()
          const old = e.texture.image as ImageBitmap
          if (old.width !== bitmap.width || old.height !== bitmap.height) e.texture.dispose()
          e.texture.image = bitmap
          e.texture.needsUpdate = true
          e.bytes = Math.round(bitmap.width * bitmap.height * 4 * MIP_SHARE)
          old.close()
        })
        await handing
      } catch {
        // The first picture stays until the next call asks again, which the app makes whenever a season has been prepared.
        assets.release(file.path)
        failed.push(o)
      }
    }
  }
  fetching = Promise.all(Array.from({ length: DETAIL_LANES }, lane)).then(() => {
    fetching = null
    owed.push(...failed)
  })
  return fetching
}

export function texture(path: string): THREE.Texture {
  const e = textures.get(path)
  if (!e) throw new Error(`texture is not prepared: ${path}`)
  return e.texture
}

export const hasTexture = (path: string): boolean => textures.has(path)

export function binary(path: string): ArrayBuffer {
  const b = binaries.get(path)
  if (!b) throw new Error(`file is not prepared: ${path}`)
  return b
}

export const hasBinary = (path: string): boolean => binaries.has(path)

export function preparedBytes(group?: string): number {
  let n = 0
  for (const e of textures.values()) if (!group || e.group === group) n += e.bytes
  return n
}
