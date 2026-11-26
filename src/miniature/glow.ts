import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { stageShader } from '../core/materials'

export const GLOW = { bulb: 0, glass: 1, flame: 2, pane: 3 } as const

export interface GlowLook {
  bulb: number
  bulbCore: number
  glass: readonly [number, number, number]
  flame: readonly [number, number, number]
  room: readonly [number, number, number]
  curtain: readonly [number, number, number]
  frost: readonly [number, number, number]
  frostAmount: number
  flicker: number
  cycles: number
  through?: number
  paneHot?: number
}

export function glowPiece(source: THREE.BufferGeometry, kindOf: (i: number, a: number, b: number) => readonly [number, number, number, number]): THREE.BufferGeometry {
  const src = source.index ? source.toNonIndexed() : source.clone()
  const n = src.getAttribute('position').count
  const data = src.getAttribute('uv1')
  const kind = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) kind.set(kindOf(i, data ? data.getX(i) : 0, data ? data.getY(i) : 0), i * 4)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', src.getAttribute('position'))
  g.setAttribute('normal', src.getAttribute('normal'))
  g.setAttribute('uv', src.getAttribute('uv'))
  g.setAttribute('color', src.getAttribute('color'))
  g.setAttribute('aKind', new THREE.BufferAttribute(kind, 4))
  return g
}

export const glowGeometry = (pieces: THREE.BufferGeometry[]): THREE.BufferGeometry => mergeGeometries(pieces)

export interface HaloLook {
  radiusMm: number
  strength: number
  hot: number
  pullMm: number
  flicker: number
  cycles: number
  through?: number
  wide?: number
  bloom?: number
  glare?: readonly [number, number, number]
}

export interface HaloPoint {
  size: number
  rest: number
  hot: number
  bloom: number
}

const HALO_REACH = Math.sqrt(3)

export function haloGeometry(points: readonly (readonly [number, number, number])[], radiusMm: number, kinds?: readonly HaloPoint[], wide = 1): THREE.BufferGeometry {
  const ball = new THREE.OctahedronGeometry(radiusMm * HALO_REACH * wide, 0)
  const src = ball.getAttribute('position')
  const n = src.count
  const pos = new Float32Array(points.length * n * 3)
  const at = new Float32Array(points.length * n * 4)
  const size = new Float32Array(points.length * n * 4)
  points.forEach((p, k) => {
    const kind = kinds?.[k] ?? { size: 1, rest: 1, hot: 1, bloom: 1 }
    const s = kind.size
    for (let i = 0; i < n; i++) {
      const o = k * n + i
      pos.set([p[0] + s * src.getX(i), p[1] + s * src.getY(i), p[2] + s * src.getZ(i)], o * 3)
      at.set([p[0], p[1], p[2], (k * 0.381966) % 1], o * 4)
      size.set([s, kind.rest, kind.hot, kind.bloom], o * 4)
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('aHalo', new THREE.BufferAttribute(at, 4))
  g.setAttribute('aHaloSize', new THREE.BufferAttribute(size, 4))
  return g
}

export function haloMaterial(part: string, edge: readonly [number, number, number], core: readonly [number, number, number], look: HaloLook, clock: THREE.IUniform<number>, storm: THREE.IUniform<number> = { value: 0 }): THREE.ShaderMaterial {
  return stageShader({
    part,
    standIn: false,
    inside: true,
    change: 'light',
    uniforms: { uClock: clock, uHaloStorm: storm },
    params: { side: THREE.FrontSide, transparent: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, depthWrite: false },
    vertexPars: `
attribute vec4 aHalo;
attribute vec4 aHaloSize;
varying vec4 vHalo;
varying vec4 vHaloSize;
`,
    vertexMain: `
vHalo = vec4((modelMatrix * vec4(aHalo.xyz, 1.0)).xyz, aHalo.w);
vHaloSize = aHaloSize;
#ifdef STAGE_INSIDE
vec4 haloNear = projectionMatrix * vec4(stageView.xyz * (1.0 - ${look.pullMm.toFixed(2)} * aHaloSize.x / length(stageView.xyz)), 1.0);
gl_Position.z = haloNear.z / haloNear.w * gl_Position.w;
#endif
`,
    fragment: `
uniform float uClock;
uniform float uHaloStorm;
varying vec4 vHalo;
varying vec4 vHaloSize;
void main() {
  if (uDiag != 0) discard;
  float c = stageChange();
  if (stageGone(c)) discard;
  #ifdef STAGE_INSIDE
  if (stageOutside()) discard;
  #endif
  vec3 d = normalize(vStagePlaced - cameraPosition);
  vec3 oc = cameraPosition - uLensCentre;
  float b = dot(oc, d);
  float h = b * b - dot(oc, oc) + uLens.x * uLens.x;
  vec3 sight = normalize(cameraPosition + d * (-b - sqrt(max(h, 0.0))) - vStageWorld);
  vec3 off = cross(sight, vStageWorld - vHalo.xyz);
  float miss = dot(off, off) / (${(look.radiusMm * look.radiusMm).toFixed(4)} * vHaloSize.x * vHaloSize.x);
  float g = max(0.0, 1.0 - miss);
  float far = max(0.0, 1.0 - miss / ${((look.wide ?? 1) ** 2).toFixed(3)});
  float beat = 1.0 + ${look.flicker.toFixed(3)} * sin(6.2831853 * (${look.cycles.toFixed(1)} * uClock + vHalo.w));
  float glow = g * g;
  float hot = pow(abs(g), 12.0) * vHaloSize.z;
  float fog = stageVeil(vStageAux.x);
  float seen = min(1.0, ${(look.through ?? 1).toFixed(2)} * (1.0 - fog));
  float spread = ${(look.bloom ?? 0).toFixed(3)} * vHaloSize.w * max(fog, uHaloStorm) * far * far * far * far * seen;
  float body = (g * g * g * ${look.strength.toFixed(3)} * vHaloSize.y + hot) * beat * seen;
  vec3 warm = mix(${v3(edge)}, ${v3(core)}, glow) * (1.0 + ${look.hot.toFixed(2)} * hot);
  float a = clamp(body + spread, 0.0, 1.0);
  gl_FragColor = vec4((warm * body + ${v3(look.glare ?? core)} * (1.0 + 3.0 * pow(abs(far), 8.0)) * spread) / max(body + spread, 1e-4), a);
}
`,
  })
}

const v3 = (c: readonly [number, number, number]): string => `vec3(${c[0].toFixed(4)}, ${c[1].toFixed(4)}, ${c[2].toFixed(4)})`

export function glowMaterial(part: string, look: GlowLook, clock: THREE.IUniform<number>): THREE.ShaderMaterial {
  return stageShader({
    part,
    standIn: false,
    inside: true,
    change: 'light',
    uniforms: { uClock: clock },
    params: { side: THREE.DoubleSide },
    vertexPars: `
attribute vec4 aKind;
attribute vec3 color;
varying vec4 vKind;
varying vec2 vUv;
varying vec3 vTone;
varying vec3 vN;
varying vec3 vV;
`,
    vertexMain: `
vKind = aKind;
vUv = uv;
vTone = color;
vN = normalize(normalMatrix * normal);
vV = -mvPosition.xyz;
`,
    fragment: `
uniform float uClock;
varying vec4 vKind;
varying vec2 vUv;
varying vec3 vTone;
varying vec3 vN;
varying vec3 vV;
float glowHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float glowNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(glowHash(i), glowHash(i + vec2(1.0, 0.0)), f.x), mix(glowHash(i + vec2(0.0, 1.0)), glowHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float glowFbm(vec2 p) {
  return 0.5 * glowNoise(p) + 0.25 * glowNoise(p * 2.03 + 7.1) + 0.125 * glowNoise(p * 4.01 + 3.7) + 0.0625 * glowNoise(p * 8.07 + 1.3);
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  #ifdef STAGE_INSIDE
  if (stageOutside()) discard;
  #endif
  float kind = floor(vKind.x + 0.5);
  float facing = abs(dot(normalize(vN), normalize(vV)));
  float beat = 1.0 + ${look.flicker.toFixed(3)} * sin(6.2831853 * (${look.cycles.toFixed(1)} * uClock + vKind.y)) * (0.6 + 0.4 * sin(6.2831853 * (${(look.cycles * 3 + 1).toFixed(1)} * uClock + vKind.y * 5.0)));
  vec3 col;
  vec3 albedo;
  if (kind < 0.5) {
    float core = pow(abs(facing), 1.8);
    albedo = vTone;
    col = vTone * (${look.bulb.toFixed(3)} + ${look.bulbCore.toFixed(3)} * core) * beat;
  } else if (kind < 1.5) {
    float pane = fract(vUv.x * 4.0);
    float across = abs(pane - 0.5) * 2.0;
    float up = vUv.y;
    float soot = glowFbm(vec2(vUv.x * 9.0, up * 5.0));
    float core = exp(-(across * across) * 2.6 - (up - 0.42) * (up - 0.42) * 7.0);
    float edge = smoothstep(1.0, 0.72, across) * smoothstep(0.0, 0.14, up) * smoothstep(1.0, 0.86, up);
    float haze = 0.32 + 0.68 * core;
    albedo = ${v3(look.glass)};
    col = ${v3(look.glass)} * haze * (0.55 + 0.45 * edge) * (0.82 + 0.36 * soot) * beat + ${v3(look.flame)} * pow(abs(core), 5.0) * 0.5 * beat;
  } else if (kind < 2.5) {
    albedo = ${v3(look.flame)};
    col = ${v3(look.flame)} * (0.55 + 0.45 * facing) * beat;
  } else {
    vec2 mm = vUv * vKind.yz;
    vec2 q = vUv - vec2(0.5, 0.42);
    float lampIn = exp(-dot(q, q) * 3.2);
    float fold = 0.5 + 0.5 * sin(vUv.x * vKind.y * 7.4 + 1.3 * sin(vUv.y * 4.0 + vKind.w * 3.0));
    float side = smoothstep(0.2, 0.46, abs(vUv.x - 0.5)) * smoothstep(0.02, 0.3, vUv.y + 0.25 * abs(vUv.x - 0.5));
    float sway = glowFbm(mm * 1.7 + vKind.w * 11.0);
    vec3 room = ${v3(look.room)} * (0.78 + 0.52 * lampIn) * (0.86 + 0.28 * sway) + ${v3(look.glass)} * (${(look.paneHot ?? 0).toFixed(3)} * lampIn * lampIn);
    vec3 drape = ${v3(look.curtain)} * (0.55 + 0.45 * fold) * (0.7 + 0.5 * lampIn);
    col = mix(room, drape, side * 0.3);
    vec2 bars = (0.5 - abs(fract(vUv * vec2(2.0, 3.0)) - 0.5)) * vKind.yz / vec2(2.0, 3.0);
    float bar = min(bars.x, bars.y);
    col *= 0.78 + 0.22 * smoothstep(0.08, 0.5, bar);
    col = mix(col, ${v3(look.room)} * 0.16, smoothstep(0.15, 0.09, bar));
    float sheen = smoothstep(0.16, 0.0, abs(vUv.x + 0.55 * vUv.y - 0.62)) + 0.5 * smoothstep(0.05, 0.0, abs(vUv.x + 0.55 * vUv.y - 0.95));
    col += stageCold(vStageLocal) * 0.5 * sheen * (1.0 - facing * 0.6);
    vec2 corner = min(vUv, 1.0 - vUv) * vKind.yz;
    float rime = glowFbm(mm * 3.1 + vKind.w * 5.0);
    float frost = smoothstep(0.75, 0.05, min(corner.x, corner.y) + 0.22 * corner.x * corner.y - 0.55 * rime + 0.2) * ${look.frostAmount.toFixed(3)};
    frost = max(frost, smoothstep(0.34, 0.0, vUv.y * vKind.z - 0.3 * rime) * ${look.frostAmount.toFixed(3)});
    float grit = glowNoise(mm * 22.0);
    col = mix(col, ${v3(look.frost)} * (0.75 + 0.5 * grit) + col * 0.35, clamp(frost, 0.0, 1.0));
    col *= (0.9 + 0.1 * facing) * (1.0 + 0.5 * (beat - 1.0));
    albedo = ${v3(look.room)};
  }
  float fog = stageVeil(vStageAux.x);
  col *= min(1.0, ${(look.through ?? 1).toFixed(2)} * (1.0 - fog)) / max(1.0 - fog, 1e-3);
  gl_FragColor = vec4(stageFogged(col, stageGrid(vStageLocal), fog), 1.0);
  if (uDiag != 0) gl_FragColor = stageDiag(albedo, normalize(vN), fog, c, 0.0);
}
`,
  })
}
