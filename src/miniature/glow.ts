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
    float core = pow(facing, 1.8);
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
    col = ${v3(look.glass)} * haze * (0.55 + 0.45 * edge) * (0.82 + 0.36 * soot) * beat + ${v3(look.flame)} * pow(core, 5.0) * 0.5 * beat;
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
    vec3 room = ${v3(look.room)} * (0.5 + 0.8 * lampIn) * (0.86 + 0.28 * sway);
    vec3 drape = ${v3(look.curtain)} * (0.55 + 0.45 * fold) * (0.7 + 0.5 * lampIn);
    col = mix(room, drape, side * 0.85);
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
  gl_FragColor = vec4(stageFogged(col, stageGrid(vStageLocal), fog), 1.0);
  if (uDiag != 0) gl_FragColor = stageDiag(albedo, normalize(vN), fog, c, 0.0);
}
`,
  })
}
