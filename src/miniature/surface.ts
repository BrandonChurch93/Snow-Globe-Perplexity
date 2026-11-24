import * as THREE from 'three'
import { afterLight } from '../core/chunks/light'
import { stageMaterial, type Rgb } from '../core/materials'

export interface GlowSource {
  at: readonly [number, number, number]
  color: Rgb
  power: number
  reachMm: number
}

const WRAP = 0.22

export function withSurface(g: THREE.BufferGeometry, glow: readonly GlowSource[]): THREE.BufferGeometry {
  const surf = g.getAttribute('uv1')
  if (surf && !g.getAttribute('aSurf')) g.setAttribute('aSurf', surf)
  const P = g.getAttribute('position')
  const N = g.getAttribute('normal')
  const out = new Float32Array(P.count * 3)
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i)
    const y = P.getY(i)
    const z = P.getZ(i)
    const nx = N.getX(i)
    const ny = N.getY(i)
    const nz = N.getZ(i)
    let r = 0
    let gg = 0
    let b = 0
    for (const l of glow) {
      const dx = l.at[0] - x
      const dy = l.at[1] - y
      const dz = l.at[2] - z
      const d2 = dx * dx + dy * dy + dz * dz
      const reach2 = l.reachMm * l.reachMm
      if (d2 > reach2 * 180) continue
      const d = Math.sqrt(d2) || 1e-6
      const facing = Math.max(0, ((nx * dx + ny * dy + nz * dz) / d) * (1 - WRAP) + WRAP)
      const f = (l.power * facing) / (1 + d2 / reach2)
      r += l.color[0] * f
      gg += l.color[1] * f
      b += l.color[2] * f
    }
    out[i * 3] = r
    out[i * 3 + 1] = gg
    out[i * 3 + 2] = b
  }
  g.setAttribute('aGlow', new THREE.BufferAttribute(out, 3))
  return g
}

export const SURFACE_VERT_PARS = `
attribute vec2 aSurf;
attribute vec3 aGlow;
varying vec2 vSurf;
varying vec3 vGlow;
varying vec3 vObjN;
`

export const SURFACE_VERT_MAIN = `
vSurf = aSurf;
vGlow = aGlow;
vObjN = normal;
`

export const BUMP_GLSL = `
uniform float uGlowGain;
varying vec2 vSurf;
varying vec3 vGlow;
varying vec3 vObjN;
vec3 villageBump(vec3 pos, vec3 n, vec2 dH, float face) {
  vec3 sx = dFdx(pos);
  vec3 sy = dFdy(pos);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1) * face;
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  return normalize(abs(det) * n - grad);
}
`

export const NEAR_LIGHT = 'reflectedLight.indirectDiffuse += vGlow * uGlowGain * material.diffuseContribution;'

const SURFACE_PARS = `
${BUMP_GLSL}
float villageHeightAt(vec2 uv, vec3 k) {
  return dot(texture2D(map, uv).rgb, k) + 0.45 * k.x * texture2D(map, uv * 2.7 + 0.13).r;
}
`

const SURFACE_MAP = `
vec3 villageGrain = texture2D(map, vMapUv).rgb;
float villageMottle = texture2D(map, vMapUv * 0.31 + 0.37).b;
float villageKind = floor(vSurf.x + 0.001);
float villageStone = 1.0 - step(0.5, villageKind);
float villageWood = step(0.5, villageKind) * (1.0 - step(1.5, villageKind));
float villageIron = step(1.5, villageKind) * (1.0 - step(2.5, villageKind));
float villageLeaf = step(2.5, villageKind);
vec3 villageK = villageStone * vec3(0.11, 0.0, 0.03) + villageWood * vec3(0.0, 0.06, 0.012) + villageIron * vec3(0.014, 0.0, 0.01) + villageLeaf * vec3(0.0, 0.0, 0.04);
float villageFine = texture2D(map, vMapUv * 2.7 + 0.13).r;
float villageTone = villageStone * (0.15 + 0.36 * villageGrain.r + 0.46 * villageFine) + villageWood * (0.6 + 0.78 * villageGrain.g) + villageIron * (0.8 + 0.4 * villageGrain.r) + villageLeaf * (0.72 + 0.56 * villageGrain.b);
diffuseColor.rgb *= villageTone * (0.78 + 0.44 * villageMottle);
float villageRough = clamp((fract(vSurf.x) - 0.02) / 0.9 + 0.22 * (0.5 - dot(villageGrain, villageStone * vec3(1.0, 0.0, 0.0) + villageWood * vec3(0.0, 1.0, 0.0) + (villageIron + villageLeaf) * vec3(0.0, 0.0, 1.0))), 0.08, 1.0);
float villageMetal = villageIron * 0.55;
`

const SURFACE_NORMAL = `
{
  vec2 villageDx = dFdx(vMapUv);
  vec2 villageDy = dFdy(vMapUv);
  float villageH = villageHeightAt(vMapUv, villageK);
  vec2 villageDh = vec2(villageHeightAt(vMapUv + villageDx, villageK) - villageH, villageHeightAt(vMapUv + villageDy, villageK) - villageH);
  normal = villageBump(-vViewPosition, normal, villageDh, faceDirection);
}
`

export interface Cover {
  pars: string
  apply: string
  uniforms: Record<string, THREE.IUniform>
}

export function surfaceMaterial(o: { part: string; map: THREE.Texture; gain: THREE.IUniform<number>; cover?: Cover; key: string; change?: string }): THREE.MeshStandardMaterial {
  return stageMaterial({
    part: o.part,
    standIn: false,
    inside: true,
    miniature: true,
    vertexColors: true,
    map: o.map,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
    extra: { shadowSide: THREE.BackSide },
    change: o.change ?? 'miniature',
    key: o.key,
    hook: (shader) => {
      Object.assign(shader.uniforms, { uGlowGain: o.gain }, o.cover?.uniforms)
      shader.vertexShader = shader.vertexShader.replace('#include <uv_pars_vertex>', `#include <uv_pars_vertex>\n${SURFACE_VERT_PARS}`).replace('#include <uv_vertex>', `#include <uv_vertex>\n${SURFACE_VERT_MAIN}`)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>\n${SURFACE_PARS}\n${o.cover?.pars ?? ''}`)
        .replace('#include <map_fragment>', SURFACE_MAP)
        .replace('#include <color_fragment>', `#include <color_fragment>\n${o.cover?.apply ?? ''}`)
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = villageRough;')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = villageMetal;')
        .replace('#include <normal_fragment_maps>', SURFACE_NORMAL)
      afterLight(shader, NEAR_LIGHT)
    },
  })
}
