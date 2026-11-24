import * as THREE from 'three'
import type { Backdrop } from './backdrop'
import type { StageFrame } from './frame'
import { surfaceUniforms } from './surface'

const MIRROR = new THREE.Matrix4().makeScale(1, -1, 1)
const saved = new THREE.Matrix4()
const clear = new THREE.Color()

export const MIRROR_SCALE = { still: 1, live: 0.5 }

let mirror: THREE.WebGLRenderTarget | null = null

export interface PassContext {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  floor: THREE.Group
  globe: THREE.Group
  backdrop: Backdrop
  key: THREE.DirectionalLight
  orient(sign: number): void
}

export interface PassOptions {
  shadows: boolean
  mirror: boolean
  sliceOnly: boolean
  emitters: boolean
}

const DEPTH_BYTES = 4
const colourBytes = (type: THREE.TextureDataType): number => (type === THREE.UnsignedByteType ? 4 : 8)

export const mirrorBytes = (): number => (mirror ? Math.round(mirror.width * mirror.height * (colourBytes(mirror.texture.type) * (4 / 3) + DEPTH_BYTES)) : 0)

function mirrorType(renderer: THREE.WebGLRenderer, main: THREE.WebGLRenderTarget | null): THREE.TextureDataType {
  if (main) return main.texture.type === THREE.UnsignedByteType ? THREE.UnsignedByteType : THREE.HalfFloatType
  const has = (name: string) => renderer.extensions.has(name)
  return has('EXT_color_buffer_float') || has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType
}

function mirrorTarget(width: number, height: number, type: THREE.TextureDataType): THREE.WebGLRenderTarget {
  if (mirror && mirror.texture.type !== type) {
    mirror.dispose()
    mirror = null
  }
  if (!mirror) {
    mirror = new THREE.WebGLRenderTarget(width, height, {
      type,
      format: THREE.RGBAFormat,
      colorSpace: THREE.NoColorSpace,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: true,
      depthBuffer: true,
      stencilBuffer: false,
    })
    mirror.texture.name = 'scene-mirror'
  } else if (mirror.width !== width || mirror.height !== height) mirror.setSize(width, height)
  return mirror
}

export function drawPasses(c: PassContext, o: PassOptions, frame: StageFrame): void {
  const { renderer, key } = c
  const { dome, lights } = c.backdrop
  c.floor.visible = false
  lights.visible = false
  c.orient(1)
  renderer.shadowMap.needsUpdate = o.shadows && !o.sliceOnly
  renderer.render(c.scene, c.camera)
  renderer.shadowMap.needsUpdate = false
  if (o.sliceOnly) return
  dome.visible = false
  lights.visible = o.emitters
  if (o.mirror) {
    const main = renderer.getRenderTarget()
    const scale = frame.live ? MIRROR_SCALE.live : MIRROR_SCALE.still
    const width = Math.max(2, Math.round(frame.width * scale))
    const height = Math.max(2, Math.round(frame.height * scale))
    const target = mirrorTarget(width, height, mirrorType(renderer, main as THREE.WebGLRenderTarget | null))
    const alpha = renderer.getClearAlpha()
    renderer.getClearColor(clear)
    renderer.setRenderTarget(target)
    renderer.setClearColor(0x000000, 0)
    renderer.clear(true, true, false)
    c.orient(-1)
    saved.copy(key.shadow.matrix)
    key.shadow.matrix.multiply(MIRROR)
    renderer.render(c.scene, c.camera)
    key.shadow.matrix.copy(saved)
    c.orient(1)
    renderer.setRenderTarget(main)
    renderer.setClearColor(clear, alpha)
    surfaceUniforms.uMirror.value = target.texture
    surfaceUniforms.uMirrorSize.value.set(1 / frame.width, 1 / frame.height, width / frame.width, 0)
  }
  c.globe.visible = false
  c.floor.visible = true
  renderer.render(c.scene, c.camera)
  c.globe.visible = true
  dome.visible = true
}
