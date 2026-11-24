import type * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { binary } from './textures'

const models = new Map<string, Map<string, THREE.BufferGeometry>>()
const loading = new Map<string, Promise<void>>()

export function prepareModel(path: string): Promise<void> {
  let p = loading.get(path)
  if (!p) {
    p = new GLTFLoader().parseAsync(binary(path), '').then((gltf) => {
      const found = new Map<string, THREE.BufferGeometry>()
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh
        if (!mesh.isMesh) return
        mesh.geometry.userData.extras = o.userData
        found.set(o.name, mesh.geometry)
        ;(mesh.material as THREE.Material).dispose()
      })
      models.set(path, found)
    })
    loading.set(path, p)
  }
  return p
}

export function geometry(path: string, name: string): THREE.BufferGeometry {
  const g = models.get(path)?.get(name)
  if (!g) throw new Error(`model is not prepared or has no mesh named ${name}: ${path}`)
  return g
}

export const hasModel = (path: string): boolean => models.has(path)

export function geometryNames(path: string): string[] {
  return [...(models.get(path)?.keys() ?? [])]
}

export function modelTriangles(path: string): number {
  let n = 0
  for (const g of models.get(path)?.values() ?? []) n += (g.index ? g.index.count : g.getAttribute('position').count) / 3
  return n
}
