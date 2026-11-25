import * as THREE from 'three'
import { config } from '../../config'
import { VEIL_LOOK } from '../../core/chunks/veil'
import { stageShader, stageUniforms } from '../../core/materials'
import { viewCode } from '../../diagnostics/views'
import { LIQUID_ROLL, LIQUID_SWIRL, ROLL_AXIS, ROLL_CENTRE, ROLL_MAX } from '../../globe/liquid'
import { groundAt, groundY } from '../../scene/layout'
import type { KitMoment, SeasonKit } from '../kit'

// Part `veil-spring` and the colours of the season's particle kinds.
//
// Two mists make the season's air, both drawn here as lit volumes inside the glass. The petal mist fills the liquid while it
// is disturbed: soft pink billows that go round with the liquid's roll, close over the miniature at the height of the storm
// and are gone when the water is still. The dawn mist lies low on the island at the landing and rises and thins as the water
// stills. The liquid's own veil (the shared chunk, read only) is kept thin: its drift is drawn as long white ribbons, which
// is snow, not petals.
export const standIns: string[] = []

export const veil: SeasonKit['veil'] = { tint: [1, 0.9, 0.93], density: 0.002, rest: 0 }
export const particles: SeasonKit['particles'] = { petal: { color: [1, 0.66, 0.76], glow: 0 }, mote: { color: [0.3, 0.27, 0.27], glow: 0 } }

const PART = 'veil-spring'
const INNER = config.globe.sphereDiameterMm / 2 - config.globe.glassThicknessMm

const look = {
  /** The sheets the volume is cut into, front to back, and how finely each is cut for the lens to bend it. */
  sheets: 36,
  cols: 28,
  rows: 8,
  topMm: 46,
  /** How high the mist stands (the height at which it has thinned to a third) on the landing and at rest, and how long it takes to rise. */
  heightMm: [3.2, 7.5],
  riseSeconds: 5,
  /** How thick it is on the landing and at rest. */
  density: [3.6, 1.1],
  thinSeconds: 7,
  /** How much of it the storm blows off. */
  blown: 0.7,
  tint: [1, 0.8, 0.82],
  cold: 3.2,
  warm: 2.6,
  /** How far the banks drift round in one period, mm. */
  driftMm: 5,
}

const GROUND = { cells: 96, lowMm: groundY - 6, spanMm: 20 }

// The height of the island under every place, for the mist to lie on: it thins into the ground and never ends at it in a line.
function groundMap(): THREE.DataTexture {
  const c = GROUND.cells
  const data = new Uint8Array(c * c)
  for (let j = 0; j < c; j++)
    for (let i = 0; i < c; i++) {
      const x = ((i + 0.5) / c - 0.5) * 2 * INNER
      const z = ((j + 0.5) / c - 0.5) * 2 * INNER
      data[j * c + i] = Math.round(255 * Math.min(1, Math.max(0, (groundAt(x, z) - GROUND.lowMm) / GROUND.spanMm)))
    }
  const t = new THREE.DataTexture(data, c, c, THREE.RedFormat, THREE.UnsignedByteType)
  t.magFilter = THREE.LinearFilter
  t.minFilter = THREE.LinearFilter
  t.colorSpace = THREE.NoColorSpace
  t.needsUpdate = true
  return t
}

const mistUniforms = {
  uMistGround: { value: null as THREE.Texture | null },
  /** The height in mm, the density of one sheet, the place in the period (0 to 1), the storm (0 to 1). */
  uMist: { value: new THREE.Vector4(look.heightMm[1], 0, 0, 0) },
}

const n = (x: number): string => x.toFixed(4)

const MIST = `
uniform vec4 uMist;
uniform sampler2D uMistGround;
float mistHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float mistNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(mistHash(i), mistHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(mistHash(i + vec3(0.0, 1.0, 0.0)), mistHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(mistHash(i + vec3(0.0, 0.0, 1.0)), mistHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(mistHash(i + vec3(0.0, 1.0, 1.0)), mistHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  #ifdef STAGE_INSIDE
  if (stageOutside()) discard;
  #endif
  if (uMist.y <= 0.0) discard;
  vec3 p = vStageLocal;
  float y = p.y - (${n(GROUND.lowMm)} + ${n(GROUND.spanMm)} * texture2D(uMistGround, p.xz / ${n(2 * INNER)} + 0.5).r);
  // Banks: two sizes of billow that drift round once a period and lean with the height, so no sheet shows as a sheet.
  float turn = 6.2831853 * uMist.z;
  vec3 drift = ${n(look.driftMm)} * vec3(sin(turn), 0.0, cos(turn));
  float coarse = mistNoise(vec3(p.x, y * 1.6, p.z) * 0.058 + drift * 0.058 + 3.7);
  float fine = mistNoise(vec3(p.x, y * 1.3, p.z) * 0.17 - drift.zyx * 0.17 + vec3(0.0, 0.25 * sin(turn + 1.3), 0.0) + 11.3);
  float bank = smoothstep(0.24, 0.78, 0.68 * coarse + 0.32 * fine);
  float high = uMist.x * (0.55 + 0.9 * coarse);
  float low = exp(-max(y, 0.0) / high) * smoothstep(0.0, 2.6, y);
  float wall = 1.0 - smoothstep(0.84, 0.985, length(p) / ${n(INNER)});
  float dens = uMist.y * low * wall * (0.28 + 0.72 * bank) * (1.0 - ${n(look.blown)} * uMist.w);
  float a = 1.0 - exp(-dens);
  if (a <= 0.002) discard;
  vec3 lit = stageCold(p) * ${n(look.cold)} + stageGrid(p) * ${n(look.warm)};
  vec3 col = vec3(${look.tint.map(n).join(', ')}) * lit * (0.8 + 0.4 * fine);
  float fog = stageVeil(vStageAux.x);
  gl_FragColor = vec4(stageFogged(col, stageGrid(p), fog), a);
  if (uDiag != 0) {
    if (a < 0.5) discard;
    gl_FragColor = stageDiag(vec3(${look.tint.map(n).join(', ')}), vec3(0.0, 0.0, 1.0), fog, c, 0.0);
  }
}
`

function sheetsGeometry(): THREE.BufferGeometry {
  const at: number[] = []
  const idx: number[] = []
  const reach = Math.sqrt(INNER * INNER - groundY * groundY) * 0.98
  for (let s = 0; s < look.sheets; s++) {
    // Back to front, so the sheets blend in the order the camera needs.
    const z = reach * 0.94 * (-1 + (2 * (s + 0.5)) / look.sheets)
    const half = Math.sqrt(Math.max(reach * reach - z * z, 1))
    const base = at.length / 3
    for (let i = 0; i <= look.rows; i++)
      for (let k = 0; k <= look.cols; k++) at.push(half * (-1 + (2 * k) / look.cols), groundY - 4 + (look.topMm * i) / look.rows, z)
    const row = look.cols + 1
    for (let i = 0; i < look.rows; i++)
      for (let k = 0; k < look.cols; k++) {
        const a = base + i * row + k
        idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row)
      }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(at, 3))
  g.setIndex(idx)
  return g
}

const storm = {
  /** The sheets the liquid is cut into, back to front, and how finely each is cut for the lens to bend it. */
  sheets: 22,
  cells: 18,
  /** The mist's thickness per mm: closed over the miniature at the height of the storm, while the liquid is stirred, while it only rolls. */
  flood: 0.2,
  stirred: 0.03,
  rolling: 0.011,
  rollPower: 1.4,
  /** The billows: two sizes, mm, and how much of the mist is even between them at the flood and after. */
  wideMm: 96,
  fineMm: 34,
  even: [0.75, 0],
  /** Thinner in the eye of the roll than at its rim. */
  eye: 0.5,
  tint: [1, 0.76, 0.83],
  soft: 1.1,
  key: 3.0,
  grid: 3.2,
  /** How much of the key the mist's own depth takes away, per mm of the way to the glass at full thickness. */
  shadow: 0.35,
  keyFloor: 0.35,
}

const stormUniforms = {
  /** The thickness per mm, the liquid's swirl as an angle, the place in the period (0 to 1), how even the mist is. */
  uStorm: { value: new THREE.Vector4(0, 0, 0, 0) },
}

const ROLL = new THREE.Vector3(ROLL_AXIS[0], ROLL_AXIS[1], ROLL_AXIS[2]).normalize()
const SIDE = new THREE.Vector3(1, 0, 0).cross(ROLL).normalize()
const OTHER = new THREE.Vector3().crossVectors(ROLL, SIDE).normalize()
const v3 = (v: THREE.Vector3 | readonly number[]): string => (Array.isArray(v) ? `vec3(${(v as number[]).map(n).join(', ')})` : `vec3(${n((v as THREE.Vector3).x)}, ${n((v as THREE.Vector3).y)}, ${n((v as THREE.Vector3).z)})`)

const STORM = `
uniform vec4 uStorm;
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  #ifdef STAGE_INSIDE
  if (stageOutside()) discard;
  #endif
  if (uStorm.x <= 0.0) discard;
  vec3 p = vStageLocal;
  float far = length(p) / ${n(INNER)};
  if (far >= 1.0) discard;
  // The billows go round with the liquid: the place is turned back by the liquid's swirl about the axis of its roll.
  vec3 d = p - ${v3(ROLL_CENTRE)};
  float h = dot(d, ${v3(ROLL)});
  vec2 r = vec2(dot(d, ${v3(SIDE)}), dot(d, ${v3(OTHER)}));
  float rad = length(r);
  float cs = cos(uStorm.y);
  float sn = sin(uStorm.y);
  vec3 q = vec3(r.x * cs + r.y * sn, r.y * cs - r.x * sn, h);
  float turn = 6.2831853 * uStorm.z;
  vec4 wide = texture(uVeilNoise, q / ${n(storm.wideMm)} + vec3(0.03 * sin(turn), 0.03 * cos(turn), 0.17));
  vec4 fine = texture(uVeilNoise, q / ${n(storm.fineMm)} + vec3(wide.rg - 0.5, 0.0) * 0.5 + vec3(0.41, 0.07 * sin(turn + 2.1), 0.63));
  float billow = smoothstep(0.46, 0.82, 0.62 * wide.a + 0.38 * fine.a);
  float eye = mix(${n(storm.eye)}, 1.0, smoothstep(5.0, 38.0, rad));
  float wall = 1.0 - smoothstep(0.9, 1.0, far);
  float sigma = uStorm.x * wall * eye * mix(billow * 3.4, 1.0, uStorm.w);
  // One sheet's share of the way through the liquid, along the eye's ray.
  float slant = max(abs(normalize(vStageWorld - cameraPosition).z), 0.35);
  float a = 1.0 - exp(-sigma * ${n((2 * INNER * 0.97) / storm.sheets)} / slant);
  if (a <= 0.002) discard;
  if (uDiag != 0) {
    if (uDiag != ${viewCode('cover')}) discard;
    gl_FragColor = vec4(a, 0.0, a, a);
    return;
  }
  // Lit as a volume: the key reaches a place through the mist between it and the glass.
  float pk = dot(p, uVeilKey.xyz);
  float reach = -pk + sqrt(max(pk * pk - dot(p, p) + ${n(INNER * INNER)}, 0.0));
  float dim = ${n(storm.keyFloor)} + ${n(1 - storm.keyFloor)} * exp(-uStorm.x * ${n(storm.shadow)} * reach);
  vec3 toward;
  vec3 card = uRigCardCol * (uRigInside.x * uRigCard.w * stageGridOpen(p));
  vec3 lit = stageSoftIn(p) * ${n(storm.soft)} + (stageKeyIn(p, toward) + card) * (uRigPoint.x * ${n(storm.key)} * dim) + stageGrid(p) * ${n(storm.grid)};
  vec3 col = ${v3(storm.tint)} * lit * (0.82 + 0.36 * fine.b);
  gl_FragColor = vec4(col, a);
}
`

function stormGeometry(): THREE.BufferGeometry {
  const at: number[] = []
  const idx: number[] = []
  const row = storm.cells + 1
  for (let s = 0; s < storm.sheets; s++) {
    // Back to front, so the sheets blend in the order the camera needs.
    const z = INNER * 0.97 * (-1 + (2 * (s + 0.5)) / storm.sheets)
    const half = Math.sqrt(Math.max(INNER * INNER - z * z, 1))
    const base = at.length / 3
    for (let i = 0; i <= storm.cells; i++) for (let k = 0; k <= storm.cells; k++) at.push(half * (-1 + (2 * k) / storm.cells), half * (-1 + (2 * i) / storm.cells), z)
    for (let i = 0; i < storm.cells; i++)
      for (let k = 0; k < storm.cells; k++) {
        const a = base + i * row + k
        idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row)
      }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(at, 3))
  g.setIndex(idx)
  return g
}

let air: THREE.Group | null = null
let billows: THREE.Mesh | null = null

let sheets: THREE.Mesh | null = null

/** The dawn mist: mounted with the glass dressing, inside the glass. */
export function mist(): THREE.Object3D {
  if (air) return air
  mistUniforms.uMistGround.value = groundMap()
  sheets = new THREE.Mesh(
    sheetsGeometry(),
    stageShader({
      part: PART,
      standIn: false,
      inside: true,
      change: 'miniature',
      uniforms: mistUniforms,
      fragment: MIST,
      // Not `transparent`: the glass stamps its depth before the transparent things are drawn, and the mist must be drawn
      // before that, after the miniature (as the smoke of winter's chimney is).
      params: { side: THREE.DoubleSide, transparent: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, depthWrite: false },
    }),
  )
  sheets.renderOrder = 3
  sheets.frustumCulled = false
  const material = stageShader({
    part: PART,
    standIn: false,
    inside: true,
    change: 'miniature',
    uniforms: stormUniforms,
    fragment: STORM,
    params: { side: THREE.DoubleSide, transparent: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, depthWrite: false },
  })
  billows = new THREE.Mesh(stormGeometry(), material)
  billows.renderOrder = 3.1
  billows.frustumCulled = false
  billows.visible = false
  // In the view that measures how much of the miniature is hidden, the mist adds its share as the particles do: only where
  // the miniature is, and without taking its mark away.
  billows.onBeforeRender = () => {
    const cover = stageUniforms.uDiag.value === viewCode('cover')
    material.blendSrc = cover ? THREE.DstAlphaFactor : THREE.SrcAlphaFactor
    material.blendSrcAlpha = cover ? THREE.ZeroFactor : null
    material.blendDstAlpha = cover ? THREE.OneFactor : null
  }
  air = new THREE.Group()
  air.add(sheets, billows)
  return air
}

const ramp = (v: number, from: number, to: number): number => {
  const t = Math.min(1, Math.max(0, (v - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/** The petal mist's thickness per mm and how even it is, from the liquid alone: its turbulence, its roll, the lift of the globe and the swap's window. */
export function stormAt(moment: KitMoment): { thick: number; even: number } {
  const f = moment.frame
  const L = VEIL_LOOK
  const turb = Math.min(1, Math.max(0, f.turbulence))
  const w = Math.min(1, Math.max(0, (turb - L.whiteFrom) / (L.whiteTo - L.whiteFrom)))
  const up = Math.min(1, Math.max(0, (turb - L.shakenFrom) / (L.shakenTo - L.shakenFrom)))
  const held = ramp(f.globe.y / config.shake.liftMm, L.heldFrom, L.heldTo)
  const shut = config.shake.swapWindow.toBeat
  const beat = f.moment.beat
  const since = f.moment.sinceLanding
  const open = beat !== null ? ramp(beat, shut + L.openFromBeats, shut + L.openToBeats) : since >= 0 && since < L.openHoldSeconds ? 1 : 0
  const flood = Math.max(Math.pow(w, L.whitePower), held * Math.pow(up, L.shakenPower)) * (1 - open)
  const rolling = Math.min(1, Math.max(0, (f.liquid[LIQUID_ROLL] ?? 0) / ROLL_MAX))
  const after = Math.max(storm.stirred * Math.pow(turb, L.hazePower), storm.rolling * Math.pow(rolling, storm.rollPower))
  return { thick: Math.max(storm.flood * flood, after), even: storm.even[1]! + (storm.even[0]! - storm.even[1]!) * flood }
}

/** The mist at a moment: on the ground and thick at the landing, risen and thin at rest; `bare` between the swap and the landing. */
export function mistAt(sinceLanding: number): { heightMm: number; density: number } {
  const t = sinceLanding < Infinity ? Math.max(0, sinceLanding) : 1e4
  const risen = 1 - Math.exp(-t / look.riseSeconds)
  const thinned = 1 - Math.exp(-t / look.thinSeconds)
  return { heightMm: look.heightMm[0]! + (look.heightMm[1]! - look.heightMm[0]!) * risen, density: look.density[0]! + (look.density[1]! - look.density[0]!) * thinned }
}

export function updateMist(moment: KitMoment, bare: boolean): void {
  const m = mistAt(moment.sinceLanding)
  const storm = Math.min(1, Math.max(0, moment.frame.turbulence))
  mistUniforms.uMist.value.set(m.heightMm, bare ? 0 : m.density / look.sheets, (moment.time / moment.period) % 1, storm)
  const air = stormAt(moment)
  stormUniforms.uStorm.value.set(air.thick, moment.frame.liquid[LIQUID_SWIRL] ?? 0, (moment.time / moment.period) % 1, air.even)
  if (billows) billows.visible = air.thick > 1e-4
  if (sheets) sheets.visible = !bare
}
