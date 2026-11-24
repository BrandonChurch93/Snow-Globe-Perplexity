import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { config } from '../config'
import { stageMaterial, type Rgb } from '../core/materials'
import { anchors, centreHeightMm, groundAt, innerRadiusMm, islandEdge, outerRadiusMm, shapes, type Role, type Shape } from '../scene/layout'
import type { InnerLight } from './kit'

export type Palette = Record<Role | 'ground', Rgb>

let blank: THREE.DataTexture | null = null
function blankMap(): THREE.DataTexture {
  if (!blank) {
    const n = 64
    blank = new THREE.DataTexture(new Uint8Array(n * n * 4).fill(255), n, n, THREE.RGBAFormat, THREE.UnsignedByteType)
    blank.colorSpace = THREE.NoColorSpace
    blank.needsUpdate = true
  }
  return blank
}

function tint(g: THREE.BufferGeometry, c: Rgb): THREE.BufferGeometry {
  const n = g.getAttribute('position').count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) a.set(c, i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}

function shapeGeometry(s: Shape, grow = 0): THREE.BufferGeometry {
  const m = new THREE.Matrix4()
  if (s.kind === 'box') {
    const g = new THREE.BoxGeometry(2 * (s.half[0] + grow), 2 * (s.half[1] + grow), 2 * (s.half[2] + grow))
    m.makeRotationFromEuler(new THREE.Euler(s.roll, s.yaw, 0, 'YXZ')).setPosition(s.centre[0], s.centre[1], s.centre[2])
    return g.applyMatrix4(m)
  }
  if (s.kind === 'cone') {
    const g = new THREE.CylinderGeometry(s.top + grow, s.radius + grow, s.height, 28, 1)
    return g.applyMatrix4(m.makeTranslation(s.foot[0], s.foot[1] + s.height / 2, s.foot[2]))
  }
  if (s.kind === 'ball') {
    const g = new THREE.SphereGeometry(s.radius + grow, 40, 24)
    return g.applyMatrix4(m.makeTranslation(s.centre[0], s.centre[1], s.centre[2]))
  }
  const g = new THREE.CylinderGeometry(1, 1, 0.5, 40, 1)
  m.makeRotationY(s.yaw).scale(new THREE.Vector3(s.rx + grow, 1, s.rz + grow)).setPosition(s.centre[0], s.centre[1], s.centre[2])
  return g.applyMatrix4(m)
}

function islandGeometry(): THREE.BufferGeometry {
  const rings = 14
  const skirt = 10
  const around = 72
  const r = innerRadiusMm - 0.6
  const pos: number[] = []
  const uv: number[] = []
  const index: number[] = []
  const row = around + 1
  for (let k = 0; k <= rings + skirt; k++) {
    for (let j = 0; j <= around; j++) {
      const a = (j / around) * Math.PI * 2
      const c = Math.cos(a)
      const s = Math.sin(a)
      const edge = islandEdge(a)
      let x: number
      let y: number
      let z: number
      if (k <= rings) {
        const rr = (edge * k) / rings
        x = c * rr
        z = s * rr
        y = groundAt(x, z)
      } else {
        const ye = groundAt(c * edge, s * edge)
        const phi = Math.atan2(edge, -ye) * (1 - (k - rings) / skirt)
        x = c * r * Math.sin(phi)
        z = s * r * Math.sin(phi)
        y = -r * Math.cos(phi)
      }
      pos.push(x, y, z)
      uv.push(x / (2 * r) + 0.5, z / (2 * r) + 0.5)
    }
  }
  for (let k = 0; k < rings + skirt; k++) {
    for (let j = 0; j < around; j++) {
      const a = k * row + j
      const b = a + row
      index.push(a, b + 1, b, a, a + 1, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(index)
  g.computeVertexNormals()
  return g
}

function tag<T extends THREE.Object3D>(o: T, part: string): T {
  o.userData.standIn = part
  return o
}

export function blockMiniature(season: string, palette: Palette): THREE.Object3D {
  const parts = [tint(islandGeometry(), palette.ground), ...shapes.map((s) => tint(shapeGeometry(s), palette[s.role]))]
  const mesh = new THREE.Mesh(mergeGeometries(parts), stageMaterial({ part: `miniature-${season}`, inside: true, miniature: true, vertexColors: true, roughness: 0.85, map: blankMap(), change: 'miniature' }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return tag(mesh, `miniature-${season}`)
}

export function blockArrival(season: string, color: Rgb): THREE.Object3D {
  const caps: THREE.BufferGeometry[] = []
  for (const s of shapes) {
    if (s.role === 'roof') caps.push(shapeGeometry(s, 0.7))
    if (s.role === 'crown' && s.kind === 'ball') {
      const g = new THREE.SphereGeometry(s.radius + 0.8, 40, 12, 0, Math.PI * 2, 0, Math.PI * 0.36)
      caps.push(g.applyMatrix4(new THREE.Matrix4().makeTranslation(s.centre[0], s.centre[1], s.centre[2])))
    }
    if (s.role === 'fence' && s.kind === 'box' && s.half[0] > 2) caps.push(shapeGeometry({ ...s, centre: [s.centre[0], s.centre[1] + 0.7, s.centre[2]] }, 0.35))
  }
  const spots: [number, number][] = [[-30, 6], [-4, 30], [22, 22], [34, 4], [-22, 38], [12, 40]]
  for (const [x, z] of spots) caps.push(shapeGeometry({ kind: 'disc', role: 'path', centre: [x, groundAt(x, z) + 0.5, z], rx: 4.5, rz: 3.2, yaw: 0.4 * x }))
  const mesh = new THREE.Mesh(mergeGeometries(caps), stageMaterial({ part: `arrival-${season}`, inside: true, color: new THREE.Color(color[0], color[1], color[2]), roughness: 0.9, change: 'arrival' }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return tag(mesh, `arrival-${season}`)
}

export function blockLights(season: string, lights: readonly InnerLight[]): THREE.Object3D {
  const group = tag(new THREE.Group(), `light-${season}`)
  for (const l of lights) {
    const near = Math.hypot(l.at[0] - anchors.lamp[0], l.at[1] - anchors.lamp[1], l.at[2] - anchors.lamp[2]) < 1
    const m = stageMaterial({ part: `light-${season}`, inside: true, color: 0x000000, emissive: [l.color[0] * 3, l.color[1] * 3, l.color[2] * 3], change: 'light' })
    const mesh = tag(new THREE.Mesh(new THREE.SphereGeometry(near ? 2.3 : 1.5, 20, 12), m), `light-${season}`)
    mesh.position.set(l.at[0], l.at[1], l.at[2])
    mesh.userData.light = l
    group.add(mesh)
  }
  return group
}

export function blockBase(season: string, color: Rgb, waist: number): THREE.Object3D {
  const G = config.globe
  const r = G.baseDiameterMm / 2
  const h = G.baseHeightMm
  const cup = Math.sqrt(Math.max(outerRadiusMm * outerRadiusMm - (centreHeightMm - h) * (centreHeightMm - h), 1))
  const profile: [number, number][] = [
    [0, 0],
    [r, 0],
    [r, 3],
    [r - 3, 5],
    [r * waist, h * 0.45],
    [r - 5, h - 9],
    [r - 2, h - 6],
    [r - 2, h - 1.5],
    [cup + 2.5, h],
    [cup + 0.6, h - 0.2],
    [cup * 0.6, h - G.collarDepthMm * 0.75],
    [0, h - G.collarDepthMm],
  ]
  const g = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 96)
  const mesh = new THREE.Mesh(g, stageMaterial({ part: `base-${season}`, color: new THREE.Color(color[0], color[1], color[2]), roughness: 0.55, map: blankMap(), change: 'base', side: THREE.DoubleSide }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return tag(mesh, `base-${season}`)
}
