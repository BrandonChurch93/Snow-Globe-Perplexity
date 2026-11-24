import * as THREE from 'three'
import { config } from '../config'
import { stageShader } from '../core/materials'
import type { SeasonKit } from '../seasons/kit'
import { roomUniforms } from './room'
import type { StageFrame } from './frame'

const footRadius = config.globe.baseDiameterMm / 2
export const SLAB_MM = 6000
export const FADE_FROM_MM = 1400
export const FADE_TO_MM = 2900
export const KEY_POOL_MM = 650

export const surfaceUniforms = {
  uSlab: { value: new THREE.Color(0.0075, 0.008, 0.0095) },
  uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
  uKeyCol: { value: new THREE.Color() },
  uSky: { value: new THREE.Color() },
  uFoot: { value: new THREE.Vector4(0, 0, footRadius, 0) },
  uPool: { value: new THREE.Color() },
  uReflect: { value: new THREE.Vector4(1, 0, 0, 0) },
  uBaked: { value: new THREE.Color() },
}

const SLAB = `
uniform vec3 uSlab;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec4 uFoot;
uniform vec3 uPool;
uniform vec4 uReflect;
uniform vec3 uBaked;
uniform vec3 uRoomFloor;
void main() {
  vec3 v = normalize(vStageWorld - cameraPosition);
  float nv = clamp(-v.y, 0.0, 1.0);
  float fresnel = 0.05 + 0.95 * pow(1.0 - nv, 5.0);
  float d = length(vStageWorld.xz - uFoot.xy);
  float lift = uFoot.w;
  float contact = (0.8 / (1.0 + lift * 0.1)) * (1.0 - smoothstep(uFoot.z * 0.85, uFoot.z * (1.5 + lift * 0.03), d));
  vec2 throwAt = uFoot.xy - uKeyDir.xz / max(uKeyDir.y, 0.2) * (40.0 + lift);
  float thrown = 0.45 * (1.0 - smoothstep(uFoot.z * 0.6, uFoot.z * 1.5, length(vStageWorld.xz - throwAt)));
  float shade = (1.0 - contact) * (1.0 - thrown);
  float lit = exp(-d * d / (2.0 * ${KEY_POOL_MM.toFixed(1)} * ${KEY_POOL_MM.toFixed(1)}));
  vec3 col = uRoomFloor * (1.0 - 0.6 * contact) + uSlab * uKeyCol * max(uKeyDir.y, 0.0) * shade * lit;
  col += uSlab * uPool * 3.0 * exp(-d * d / (2.0 * 110.0 * 110.0)) * (1.0 - 0.6 * contact);
  vec3 r = reflect(v, vec3(0.0, 1.0, 0.0));
  col += uKeyCol * 0.5 * pow(max(dot(r, uKeyDir), 0.0), 220.0);
  float blob = 1.0 - smoothstep(uFoot.z * 0.7, uFoot.z * 1.25, length(vec2(vStageWorld.x - uFoot.x, (vStageWorld.z - uFoot.y) * 0.5)));
  col += uBaked * fresnel * blob * uReflect.y;
  float away = smoothstep(${FADE_FROM_MM.toFixed(1)}, ${FADE_TO_MM.toFixed(1)}, length(vStageWorld.xz));
  col = mix(col, uRoomFloor, away);
  gl_FragColor = vec4(col, fresnel * uReflect.x * 0.85 * (1.0 - away));
  if (uDiag != 0) {
    if (away >= 1.0) discard;
    gl_FragColor = vec4(stageDiag(uSlab, vec3(0.0, 1.0, 0.0), 0.0, 0.0, 0.0).rgb, 0.0);
  }
}`

const DRESSING = `
uniform vec3 uTint;
uniform vec3 uShape;
uniform vec4 uFoot;
uniform vec3 uSky;
uniform vec3 uKeyCol;
uniform vec3 uKeyDir;
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  float d = length(vStageWorld.xz - uFoot.xy);
  float a = uShape.x * (1.0 - smoothstep(uFoot.z, uShape.y, d));
  vec3 col = uTint * (uSky + uKeyCol * max(uKeyDir.y, 0.0)) * 0.22;
  gl_FragColor = vec4(col, a);
  if (uDiag != 0) gl_FragColor = stageDiag(uTint, vec3(0.0, 1.0, 0.0), 0.0, c, 0.0);
  else if (a < 0.004) discard;
}`

export function makeSlab(): THREE.Mesh {
  const m = stageShader({
    part: 'surface',
    uniforms: { ...surfaceUniforms, uRoomFloor: roomUniforms.uRoomFloor },
    fragment: SLAB,
    params: {
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.SrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.ZeroFactor,
      depthWrite: false,
    },
  })
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(SLAB_MM, SLAB_MM), m)
  slab.rotation.x = -Math.PI / 2
  slab.userData.standIn = 'surface'
  slab.frustumCulled = false
  slab.renderOrder = -3
  return slab
}

export function makeDressing(kit: SeasonKit): THREE.Mesh {
  const d = kit.surfaceDressing
  const m = stageShader({
    part: `surface-dressing-${kit.season}`,
    change: 'surface-dressing',
    uniforms: {
      uTint: { value: new THREE.Color(d.tint[0], d.tint[1], d.tint[2]) },
      uShape: { value: new THREE.Vector3(d.amount, d.reachMm, 0) },
      uFoot: surfaceUniforms.uFoot,
      uSky: surfaceUniforms.uSky,
      uKeyCol: surfaceUniforms.uKeyCol,
      uKeyDir: surfaceUniforms.uKeyDir,
    },
    fragment: DRESSING,
    params: { transparent: true, depthWrite: false },
  })
  const ring = new THREE.Mesh(new THREE.RingGeometry(footRadius - 1, d.reachMm, 96, 1), m)
  ring.rotation.x = -Math.PI / 2
  ring.position.y = 0.08
  ring.userData.standIn = `surface-dressing-${kit.season}`
  ring.renderOrder = 2
  return ring
}

export function updateSurface(f: StageFrame): void {
  const su = surfaceUniforms
  const g = f.globe
  const t = f.mix.base
  su.uKeyDir.value.copy(f.keyDir)
  su.uKeyCol.value.copy(f.keyCol)
  su.uSky.value.copy(f.ambient)
  su.uFoot.value.set(g.x, g.z, footRadius, g.y)
  su.uPool.value.copy(f.pool)
  su.uReflect.value.set(f.planar ? 1 : 0, f.planar ? 0 : 1, 0, 0)
  const a = f.from.main
  const b = f.to.main
  su.uBaked.value.setRGB(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
}
