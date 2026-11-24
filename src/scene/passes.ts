import * as THREE from 'three'
import type { Backdrop } from './backdrop'
import type { StageFrame } from './frame'

const MIRROR = new THREE.Matrix4().makeScale(1, -1, 1)
const saved = new THREE.Matrix4()

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

export function drawPasses(c: PassContext, o: PassOptions, _frame: StageFrame): void {
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
    c.orient(-1)
    saved.copy(key.shadow.matrix)
    key.shadow.matrix.multiply(MIRROR)
    renderer.render(c.scene, c.camera)
    key.shadow.matrix.copy(saved)
    c.orient(1)
  }
  c.globe.visible = false
  c.floor.visible = true
  renderer.render(c.scene, c.camera)
  c.globe.visible = true
  dome.visible = true
}
