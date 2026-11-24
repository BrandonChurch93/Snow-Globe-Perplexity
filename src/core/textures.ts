import * as THREE from 'three'
import type { Assets } from './assets'

interface Entry {
  texture: THREE.Texture
  bytes: number
  group: string
}

const textures = new Map<string, Entry>()
const binaries = new Map<string, ArrayBuffer>()
const groups = new Map<string, Promise<void>>()
let anisotropy = 1

const PICTURE = /\.(png|webp|jpe?g)$/i
const MIP_SHARE = 4 / 3

export function setAnisotropy(value: number): void {
  anisotropy = Math.max(1, value)
  for (const e of textures.values()) e.texture.anisotropy = anisotropy
}

async function decode(path: string, data: ArrayBuffer, group: string): Promise<void> {
  const bitmap = await createImageBitmap(new Blob([data]), { colorSpaceConversion: 'none', premultiplyAlpha: 'none', imageOrientation: 'flipY' })
  const t = new THREE.Texture(bitmap)
  const colour = /\.srgb\./i.test(path)
  const tile = /\.tile\./i.test(path)
  t.colorSpace = colour ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.flipY = false
  t.wrapS = tile ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  t.wrapT = tile ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.magFilter = THREE.LinearFilter
  t.generateMipmaps = true
  t.anisotropy = anisotropy
  t.name = path
  t.needsUpdate = true
  textures.set(path, { texture: t, bytes: Math.round(bitmap.width * bitmap.height * 4 * MIP_SHARE), group })
}

export function prepareGroup(assets: Assets, group: string): Promise<void> {
  let p = groups.get(group)
  if (!p) {
    p = Promise.all(
      assets.files(group).map(async (f) => {
        const data = await assets.fetchFile(f.path)
        if (PICTURE.test(f.path)) {
          await decode(f.path, data, group)
          assets.release(f.path)
        } else binaries.set(f.path, data)
      }),
    ).then(() => undefined)
    groups.set(group, p)
  }
  return p
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
