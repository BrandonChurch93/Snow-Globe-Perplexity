import * as THREE from 'three'
import type { ParticleSource } from '../stage'

export const COVER_MAX_MM = 4

const blank = (): THREE.DataTexture => {
  const t = new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType)
  t.minFilter = THREE.LinearFilter
  t.magFilter = THREE.LinearFilter
  t.needsUpdate = true
  return t
}

export const coverUniforms = {
  uCover: { value: blank() },
  uCoverSpan: { value: 1 },
}

export const COVER_GLSL = `
uniform sampler2D uCover;
uniform float uCoverSpan;
float stageCover(vec2 xz) {
  return texture2D(uCover, xz / uCoverSpan + 0.5).r * ${COVER_MAX_MM.toFixed(1)};
}
`

export function updateCover(source: ParticleSource): void {
  const c = source.cover
  if (!c) return
  let t = coverUniforms.uCover.value
  if (t.image.width !== c.n) {
    t.dispose()
    t = new THREE.DataTexture(new Uint8Array(c.n * c.n), c.n, c.n, THREE.RedFormat, THREE.UnsignedByteType)
    t.minFilter = THREE.LinearFilter
    t.magFilter = THREE.LinearFilter
    coverUniforms.uCover.value = t
  }
  const bytes = t.image.data as Uint8Array
  const k = 255 / COVER_MAX_MM
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.min(255, Math.max(0, Math.round(c.mm[i]! * k)))
  t.needsUpdate = true
  coverUniforms.uCoverSpan.value = c.spanMm
}
