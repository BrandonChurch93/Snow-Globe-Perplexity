import * as THREE from 'three'
import { stageShader, type Rgb } from '../core/materials'

/**
 * A plume of smoke drawn from a picture of one: a card that stands on the flue and faces the front of the globe, with
 * the picture's brightness as the smoke's density. The picture is still; what moves is where each point of the card
 * reads it, pushed by a field that rises with the clock and comes round once a period. The stem holds and the lobes
 * drift. In the storm the card leans downwind, flattens and thins.
 */
export interface Wisp {
  /** Where the stem leaves the pipe, in the miniature's millimetres. */
  from: readonly [number, number, number]
  /** Width and height of the card. */
  size: readonly [number, number]
  /** Where across the picture the foot of the stem is, 0 to 1. */
  foot: number
  /** The card's direction across, a unit vector on the ground. */
  across: readonly [number, number]
  /** How far the top of the card is pushed across, mm: the lobes hang over the stem's side. */
  lean: number
  sway: number
  cols: number
  rows: number
  swept: readonly [number, number]
  sweepMm: number
}

const TURN = Math.PI * 2

export function wispPose(g: THREE.BufferGeometry, w: Wisp, phase: number, storm: number): void {
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  let o = 0
  for (let i = 0; i <= w.rows; i++) {
    const v = i / w.rows
    const gust = storm * Math.pow(v, 1.2) * w.sweepMm
    const lean = w.lean * Math.pow(v, 1.5) + w.sway * v * v * Math.sin(TURN * phase + 2.4 * v) * (1 + storm)
    const y = w.from[1] + v * w.size[1] * (1 - 0.55 * storm)
    for (let k = 0; k <= w.cols; k++) {
      const x = (k / w.cols - w.foot) * w.size[0] * (1 + 0.5 * storm * v) + lean
      pos.setXYZ(o, w.from[0] + w.across[0] * x + w.swept[0] * gust, y, w.from[2] + w.across[1] * x + w.swept[1] * gust)
      o++
    }
  }
  pos.needsUpdate = true
}

export function wispGeometry(w: Wisp): THREE.BufferGeometry {
  const row = w.cols + 1
  const count = (w.rows + 1) * row
  const uv: number[] = []
  const nor: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= w.rows; i++)
    for (let k = 0; k <= w.cols; k++) {
      uv.push(k / w.cols, i / w.rows)
      nor.push(-w.across[1], 0, w.across[0])
    }
  for (let i = 0; i < w.rows; i++)
    for (let k = 0; k < w.cols; k++) {
      const a = i * row + k
      const b = a + row
      idx.push(a, a + 1, b, a + 1, b + 1, b)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  wispPose(g, w, 0, 0)
  return g
}

export interface WispLook {
  /** The picture's brightness that reads as no smoke, and the one that reads as solid smoke. */
  thin: number
  dense: number
  /** The power between them: above 1 the thin smoke of the lobes lets more of the night through. */
  curve: number
  /** How much of the lobes' density is kept at the top of the card; the stem keeps all of it. */
  crown: number
  /** How far the lobes drift, as a share of the card. */
  drift: number
  /** Brightness of the smoke under the cold light and under the lights of the scene. */
  cold: number
  warm: number
  laps: number
}

export function wispMaterial(part: string, tint: Rgb, look: WispLook, map: THREE.Texture, clock: THREE.IUniform<number>, storm: THREE.IUniform<number>): THREE.ShaderMaterial {
  const f = (n: number): string => n.toFixed(4)
  const tone = `vec3(${f(tint[0])}, ${f(tint[1])}, ${f(tint[2])})`
  return stageShader({
    part,
    standIn: false,
    inside: true,
    miniature: true,
    change: 'miniature',
    uniforms: { uClock: clock, uStorm: storm, uPlume: { value: map } },
    params: { side: THREE.DoubleSide, transparent: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, depthWrite: false },
    vertexPars: `
varying vec2 vUv;
varying vec3 vN;
`,
    vertexMain: `
vUv = uv;
vN = normalize(normalMatrix * normal);
`,
    fragment: `
uniform float uClock;
uniform float uStorm;
uniform sampler2D uPlume;
varying vec2 vUv;
varying vec3 vN;
const float WISP_ROWS = 6.0;
float wispHash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}
float wispNoise(vec2 p, float rows) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float y0 = mod(i.y, rows);
  float y1 = mod(i.y + 1.0, rows);
  return mix(mix(wispHash(vec2(i.x, y0)), wispHash(vec2(i.x + 1.0, y0)), f.x), mix(wispHash(vec2(i.x, y1)), wispHash(vec2(i.x + 1.0, y1)), f.x), f.y);
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  #ifdef STAGE_INSIDE
  if (stageOutside()) discard;
  #endif
  float t = vUv.y;
  float rise = uClock * ${look.laps.toFixed(1)} * WISP_ROWS;
  vec2 p = vec2(vUv.x * 5.0, t * WISP_ROWS - rise);
  float n1 = wispNoise(p, WISP_ROWS);
  float n2 = wispNoise(p * 2.0 + vec2(1.7, 0.0), WISP_ROWS * 2.0);
  float n3 = wispNoise(p * 2.0 + vec2(5.3, 0.5), WISP_ROWS * 2.0);
  float loose = smoothstep(0.1, 0.8, t) * (1.0 + uStorm);
  vec2 uv = vUv + ${f(look.drift)} * loose * vec2(n1 + 0.5 * n2 - 0.75, 0.7 * (n3 - 0.5));
  float d = texture2D(uPlume, uv).r;
  float body = pow(clamp((d - ${f(look.thin)}) / ${f(look.dense - look.thin)}, 0.0, 1.0), ${f(look.curve)});
  float along = smoothstep(0.0, 0.035, t) * mix(1.0, ${f(look.crown)}, smoothstep(0.42, 0.92, t));
  float a = clamp(body * along * (1.0 - 0.85 * uStorm), 0.0, 1.0);
  vec3 lit = stageCold(vStageLocal) * ${f(look.cold)} + stageGrid(vStageLocal) * ${f(look.warm)};
  vec3 col = ${tone} * lit * (0.72 + 0.4 * d);
  float fog = stageVeil(vStageAux.x);
  gl_FragColor = vec4(stageFogged(col, stageGrid(vStageLocal), fog), a);
  if (uDiag != 0) {
    if (a < 0.35) discard;
    gl_FragColor = stageDiag(${tone}, normalize(vN), fog, c, 0.0);
  }
}
`,
  })
}
