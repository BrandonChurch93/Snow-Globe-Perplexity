import * as THREE from 'three'
import { config } from '../../config'
import { VEIL_LOOK } from '../../core/chunks/veil'
import { stageShader, stageUniforms } from '../../core/materials'
import { viewCode } from '../../diagnostics/views'
import { LIQUID_ROLL, LIQUID_SWIRL, ROLL_AXIS, ROLL_MAX } from '../../globe/liquid'
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
export const particles: SeasonKit['particles'] = { petal: { color: [1, 0.74, 0.82], glow: 0 }, mote: { color: [0.2, 0.18, 0.18], glow: 0 } }

const PART = 'veil-spring'
const INNER = config.globe.sphereDiameterMm / 2 - config.globe.glassThicknessMm

const look = {
  /** The sheets the volume is cut into, front to back, and how finely each is cut for the lens to bend it. */
  sheets: 26,
  cols: 10,
  rows: 4,
  topMm: 46,
  /** How high the mist stands (the height at which it has thinned to a third) on the landing and at rest, and how long it takes to rise. */
  heightMm: [3.2, 7.5],
  riseSeconds: 5,
  /** The mist begins to rise this long after the landing, seconds: after the petals' jump and the first water, and after the first beads on the glass. */
  riseAfter: 1,
  /** How thick it is on the landing and at rest. */
  density: [3.2, 0.7],
  thinSeconds: 7,
  /** How much of it the storm blows off. */
  blown: 0.7,
  tint: [1, 0.8, 0.82],
  cold: 3.2,
  warm: 0.6,
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
const TAU_ = Math.PI * 2

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
  // While the liquid is stirred the mist is thrown out to the glass; in still liquid it keeps off it.
  float wall = 1.0 - smoothstep(mix(0.84, 0.95, uMist.w), mix(0.985, 0.999, uMist.w), length(p) / ${n(INNER)});
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
  cells: 10,
  /** The mist's thickness per mm: closed over the miniature at the height of the storm, while the liquid is stirred, while it only rolls. */
  flood: 0.26,
  stirred: 0.04,
  rolling: 0.008,
  /** What is left in still liquid: the pink, lit air about the lamp and behind the tree of the approved rest, far too thin to hide anything. */
  calm: 0.0055,
  /** Where that rest hangs: its middle, and how far it reaches across, up and in depth, mm. Nothing of it stands in the upper left. */
  calmAt: [18, -13, -21],
  calmReach: [21, 10, 14],
  /** The air about the lamp at rest: a halo that is the lantern's own (thickest at it, thinning with the square of the distance, gone by `lampFar`), standing at and behind the lantern so its point stays sharp before it. */
  lampAt: [1.3, -18.2, 3.9],
  lamp: 8,
  lampCoreMm: 6,
  lampFar: [8, 32],
  /** The back of the liquid at rest: a thin lit sheet of mist behind the miniature, low down, which the cottage, the trunk and the nearer petals stand before. */
  back: 0.42,
  backZ: [-10, -26],
  backY: [6, -20],
  rollPower: 1.4,
  /** The release of the flood: how long after the landing it is over (the landed state's moment), which share of the release the set down takes (nearly all of it: at the landing the scene and the dark gaps show between the streaks), and by which share of it the flood has let go of the liquid's turbulence. */
  releaseSeconds: config.states.landedSeconds,
  releaseLanding: 0.88,
  releaseOwn: 0.3,
  /** The release is quick at first: the power its place in time is raised to before it is eased (below 1, the flood has thinned to streaks by the middle of the set down). */
  releaseEarly: 0.6,
  /** While the flood closes the liquid it is not one flat colour: how far its light follows the streaks, the dashes and the lanes of the turning liquid (its thickness, and so what it hides, is not changed by this). */
  floodDrawn: 0.8,
  /** The billows: two sizes, mm, and how much of the mist is even between them at the flood and after. */
  wideMm: 96,
  fineMm: 34,
  even: [0.75, 0],
  /** How much of the mist is left at the top of the liquid once the flood is over. */
  top: 0.6,
  /** From which height down to which (mm above the middle) the mist thickens from that share to the whole: above, the petals themselves draw the turn and its dark lanes. */
  topFrom: 22,
  topTo: -14,
  /** Thinner in the eye of the roll than at its rim. */
  eye: 0.75,
  /** After the flood the mist stands behind the miniature and thins toward the eye: the share left in front, and from where to where (mm toward the eye) it thins. */
  near: 0.34,
  nearFrom: -6,
  nearTo: 18,
  /** The side of the tree: how much further toward the eye the mist stands there (it is the crown the storm whitens, and the cottage and the lamp it leaves to be read), and how much thicker it is there than on the cottage's side. */
  treeSideMm: 12,
  treeSide: 1.5,
  cottageSide: 1.6,
  /** How much of the tree side's thickening is gone again right of the crown, toward the glass, where the lanes are to stay open. */
  treeFar: 0.7,
  /** The island's bank, below the lawn: how thick the mist stays there before the miniature (a share of its thickness behind), and up to how far above the lawn that reaches, mm. */
  bank: 0.45,
  bankTopMm: 4,
  /** The streaks: the mist is drawn out along the liquid's turn in fine dashes. The tile of their pattern across the turn (mm), how slowly it changes along the turn, and how much of the mist they carry. */
  /** How far the axis the streaks are drawn about is raised from the liquid's roll axis to the vertical, the place it passes through, and how much finer the streaks are layered along it than across it. */
  upright: 0.75,
  axisAt: [-8, 6, 0],
  layer: 0.55,
  streakMm: 16,
  streakLong: 0.4,
  streak: 0.45,
  /** The dashes: the few places where the streaks are thick enough to be seen one by one, how many times the mist's thickness they have, and how white they are. */
  dash: 4.5,
  dashWhite: 0.55,
  /** The long dark lanes between the bands of the turn, through which the room behind is seen. */
  laneMm: 110,
  lane: 0.92,
  tint: [1, 0.71, 0.78],
  /** While the liquid turns, the mist before the crown and about the lantern is the brightest and whitest of all: the blossom is a white ghost in it and the lantern a white core (the approved shake image). Where, how far it reaches (mm), how much brighter, how much whiter. */
  crownAt: [16, 12, 2],
  crownReach: [19, 12, 22],
  crownGain: 1.9,
  crownWhite: 0.42,
  /** The mist before the crown is thicker than elsewhere and the lanes do not cut it: how many times thicker, and how much of the lanes it closes. */
  crownThick: 0.1,
  crownWhole: 0.7,
  /** How much of the dashes and streaks is evened out before the crown. */
  crownEven: 0.5,
  lampReach: 19,
  lampGain: 5,
  /** How many times thicker the mist is in the glow (a soft lit cloud about the lantern and the foot of the tree, nowhere else). */
  lampThick: 2.3,
  /** The second warm glow, at the foot of the tree on the side away from the lantern: where, how far it reaches, its share of the lantern's. */
  footAt: [25, -15, -2],
  footReach: 11,
  foot: 0.85,
  lampWhite: 0.9,
  /** The colour the glow about the lantern and the foot of the tree goes to: warm, not white. */
  flareTint: [1, 0.87, 0.68],
  /** The glow stands behind the lantern's post and the trunk, which are dark before it: where toward the eye it ends (mm, from whole to none). */
  flareZ: [2, 6],
  /** The trunk is kept clear of the mist before it while the liquid turns: where it is across the liquid, how wide the opening, below what height (mm, from none to whole), and how much of the mist is taken away. */
  trunkAt: 15,
  trunkMm: 6,
  trunkY: [-3, -10],
  trunk: 0.85,
  /** The darker pocket above the crown, where the turning liquid has thrown the mist outward and the room shows through: where, how far it reaches (mm), how much of the mist is gone there. */
  pocketAt: [2, 31, 0],
  pocketReach: [17, 9, 45],
  pocket: 0.85,
  soft: 1.1,
  key: 3.4,
  grid: 1.2,
  /** How much of the key the mist's own depth takes away, per mm of the way to the glass at full thickness. */
  shadow: 0.3,
  keyFloor: 0.4,
  /** The wash on the inside of the glass low down, where the turning liquid throws the petals outward: its radius, where it lies (mm above the middle), and the thickness of the mist at which it is whole. */
  washAtMm: INNER - 0.35,
  washTopMm: -8,
  washLowMm: -50,
  washFull: 0.03,
  wash: 0.88,
  /** How much of the wash is even (the rest stands only in the streaks and dashes), how much of it is left in the lanes, and how much of it is taken away before the pond's glint, over how many mm to each side. */
  washEven: 0.3,
  washGap: 0.25,
  /** The trunk is kept clear as the pond's glint is: where the wash is thin before it (mm across the glass, as the hero sees the trunk), how wide, how much. */
  washTrunkAt: 17,
  washTrunkMm: 6.5,
  washTrunk: 0.75,
  washPond: 0.75,
  washPondMm: 9,
  washLight: 1.75,
}

const stormUniforms = {
  /** The thickness per mm, the liquid's swirl as an angle, the place in the period (0 to 1), how even the mist is. */
  uStorm: { value: new THREE.Vector4(0, 0, 0, 0) },
  /** How much of the wash stands on the inside of the glass (0 to 1). */
  uWash: { value: new THREE.Vector4(0, 0, 0, 0) },
}

// The axis the mist's streaks and lanes are drawn about: between the liquid's roll axis and the vertical, so that from the
// hero they are flat arcs lying one over another, as in the approved shake image, and not rings about the middle of the glass.
const ROLL = new THREE.Vector3(ROLL_AXIS[0], ROLL_AXIS[1], ROLL_AXIS[2]).normalize().lerp(new THREE.Vector3(0, 1, 0), storm.upright).normalize()
const SIDE = new THREE.Vector3(1, 0, 0).cross(ROLL).normalize()
const OTHER = new THREE.Vector3().crossVectors(ROLL, SIDE).normalize()
const v3 = (v: THREE.Vector3 | readonly number[]): string => (Array.isArray(v) ? `vec3(${(v as number[]).map(n).join(', ')})` : `vec3(${n((v as THREE.Vector3).x)}, ${n((v as THREE.Vector3).y)}, ${n((v as THREE.Vector3).z)})`)

// What the volume and the wash share: the place turned back by the liquid's swirl, the billows, the streaks and the lanes, and
// the light a place in the liquid stands in.
const STORM_PARS = `
uniform vec4 uStorm;
uniform vec4 uWash;
// The place as the turning liquid has it: across the axis of its roll (xy, turned back by the swirl) and along it (z).
vec3 stormPlace(vec3 p, out float rad) {
  vec3 d = p - ${v3(storm.axisAt)};
  float h = dot(d, ${v3(ROLL)});
  vec2 r = vec2(dot(d, ${v3(SIDE)}), dot(d, ${v3(OTHER)}));
  rad = length(r);
  float cs = cos(uStorm.y);
  float sn = sin(uStorm.y);
  return vec3(r.x * cs + r.y * sn, r.y * cs - r.x * sn, h);
}
// The billows: two sizes that drift a little over the period.
float stormBillow(vec3 q, out float grain) {
  float turn = 6.2831853 * uStorm.z;
  vec4 wide = texture(uVeilNoise, q / ${n(storm.wideMm)} + vec3(0.03 * sin(turn), 0.03 * cos(turn), 0.17));
  vec4 fine = texture(uVeilNoise, q / ${n(storm.fineMm)} + vec3(wide.rg - 0.5, 0.0) * 0.5 + vec3(0.41, 0.07 * sin(turn + 2.1), 0.63));
  grain = fine.b;
  return smoothstep(0.46, 0.82, 0.62 * wide.a + 0.38 * fine.a);
}
// The streaks and the lanes: rings about the axis of the roll, which change slowly along the turn (by the turn's direction,
// never by its angle, so there is no seam), so that each is a dash of its own length and none is a whole ring.
void stormDrawn(vec3 q, float rad, out float streak, out float lane, out float dash) {
  vec2 dirn = q.xy / max(rad, 6.0);
  vec3 sc = vec3(rad / ${n(storm.streakMm)} + ${n(storm.streakLong)} * dirn.x, q.z / ${n(storm.streakMm * storm.layer)} + ${n(storm.streakLong)} * dirn.y, 0.37 + ${n(storm.streakLong * 0.5)} * (dirn.x - dirn.y));
  float s1 = texture(uVeilNoise, sc).a;
  float s2 = texture(uVeilNoise, sc * 2.3 + vec3(0.37, 0.11, 0.59)).a;
  streak = smoothstep(0.44, 0.74, 0.5 * s1 + 0.5 * s2);
  float s3 = texture(uVeilNoise, sc * 1.7 + vec3(0.63, 0.29, 0.13)).a;
  dash = smoothstep(0.58, 0.76, 0.5 * s2 + 0.5 * s3);
  vec3 lc = vec3(rad / ${n(storm.laneMm)} + 0.22 * dirn.x, q.z / ${n(storm.laneMm * storm.layer)} + 0.22 * dirn.y, 0.71 + 0.11 * (dirn.y - dirn.x));
  lane = smoothstep(0.4, 0.68, texture(uVeilNoise, lc).g);
}
// Lit as a volume: the key reaches a place through the mist between it and the glass; the small lights warm what is near them.
vec3 stormLit(vec3 p, float grain, float white) {
  float pk = dot(p, uVeilKey.xyz);
  float reach = -pk + sqrt(max(pk * pk - dot(p, p) + ${n(INNER * INNER)}, 0.0));
  float dim = ${n(storm.keyFloor)} + ${n(1 - storm.keyFloor)} * exp(-uStorm.x * ${n(storm.shadow)} * reach);
  vec3 toward;
  vec3 card = uRigCardCol * (uRigInside.x * uRigCard.w * stageGridOpen(p));
  vec3 lit = stageSoftIn(p) * ${n(storm.soft)} + (stageKeyIn(p, toward) + card) * (uRigPoint.x * ${n(storm.key)} * dim) + stageGrid(p) * ${n(storm.grid)};
  return mix(${v3(storm.tint)}, vec3(1.0), white) * lit * (0.82 + 0.36 * grain);
}
`

const STORM = `
${STORM_PARS}
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
  float rad;
  vec3 q = stormPlace(p, rad);
  float grain;
  float billow = stormBillow(q, grain);
  float streak;
  float lane;
  float dash;
  stormDrawn(q, rad, streak, lane, dash);
  float eye = mix(${n(storm.eye)}, 1.0, smoothstep(5.0, 38.0, rad));
  float wall = 1.0 - smoothstep(0.94, 1.0, far);
  // After the flood the mist hangs low, where the petals come down, and the top of the liquid clears first.
  float low = mix(mix(${n(storm.top)}, 1.0, smoothstep(${n(storm.topFrom)}, ${n(storm.topTo)}, p.y)), 1.0, uStorm.w / ${n(storm.even[0])});
  // 0 while the flood closes the liquid, 1 once it is over; and 1 where only what still liquid keeps is left.
  float after = 1.0 - uStorm.w / ${n(storm.even[0])};
  float still = smoothstep(0.5, 1.0, ${n(storm.calm)} / uStorm.x);
  float stirred = after * (1.0 - still);
  // After the flood the mist stands behind the miniature and thins toward the eye, so the cottage, the lamp and the trunk
  // stand before a bright veil and are not blotted out by it.
  float tree = smoothstep(-6.0, 16.0, p.x) * (1.0 - ${n(storm.treeFar)} * smoothstep(26.0, 42.0, p.x));
  vec3 ec = (p - ${v3(storm.crownAt)}) / ${v3(storm.crownReach)};
  float crown = exp(-dot(ec, ec)) * stirred;
  float thin = mix(1.0, ${n(storm.near)}, smoothstep(${n(storm.nearFrom)}, ${n(storm.nearTo)}, p.z - ${n(storm.treeSideMm)} * tree)) * mix(${n(storm.cottageSide)}, ${n(storm.treeSide)}, tree);
  // Below the lawn the mist is not thinned toward the eye: it lies on the island's bank down to the collar while the liquid turns.
  thin = mix(thin, max(thin, ${n(storm.bank)}), smoothstep(${n(groundY + storm.bankTopMm)}, ${n(groundY)}, p.y));
  // The mist opens before the miniature by equal ratios as the flood lets go, not all at its end.
  float front = pow(thin, after);
  // What still liquid keeps hangs about the lamp and behind the tree, and nowhere else.
  vec3 e = (p - ${v3(storm.calmAt)}) / ${v3(storm.calmReach)};
  vec3 l = p - ${v3(storm.lampAt)};
  float ld = length(l);
  float halo = ${n(storm.lamp)} * smoothstep(${n(storm.lampFar[1])}, ${n(storm.lampFar[0])}, ld) / (1.0 + ld * ld / ${n(storm.lampCoreMm * storm.lampCoreMm)}) * smoothstep(7.0, -3.0, l.z);
  float back = ${n(storm.back)} * smoothstep(${n(storm.backZ[0])}, ${n(storm.backZ[1])}, p.z) * smoothstep(${n(storm.backY[0])}, ${n(storm.backY[1])}, p.y);
  float rest = mix(1.0, 2.7 * exp(-dot(e, e)) + halo + back, still);
  vec3 lf = p - ${v3(storm.footAt)};
  float lantern = max(exp(-ld * ld / ${n(storm.lampReach * storm.lampReach)}), ${n(storm.foot)} * exp(-dot(lf, lf) / ${n(storm.footReach * storm.footReach)})) * stirred * smoothstep(${n(storm.flareZ[1])}, ${n(storm.flareZ[0])}, p.z);
  float trunk = 1.0 - ${n(storm.trunk)} * stirred * exp(-(p.x - ${n(storm.trunkAt)}) * (p.x - ${n(storm.trunkAt)}) / ${n(storm.trunkMm * storm.trunkMm)}) * smoothstep(${n(storm.trunkY[0])}, ${n(storm.trunkY[1])}, p.y) * smoothstep(-6.0, 2.0, p.z);
  // While the liquid turns the mist is drawn out along the turn in fine dashes, with dark lanes between its bands.
  float drawn = mix(1.0, ${n(1 - storm.streak)} + ${n(storm.streak * 2.6)} * streak, stirred) * mix(1.0, 1.0 - ${n(storm.lane)} * (1.0 - lane), stirred * (1.0 - ${n(storm.crownWhole)} * crown)) * (1.0 + ${n(storm.crownThick)} * crown);
  // Before the crown the mist is an even veil, not dashes: the blossom is to be read through it, whitened.
  drawn = mix(drawn, 1.0 + ${n(storm.crownThick)} * crown, ${n(storm.crownEven)} * crown) * (1.0 + ${n(storm.lampThick)} * lantern);
  float soft = drawn * mix(billow * 3.4, 1.0, max(uStorm.w, ${n(storm.crownEven)} * crown));
  float dashes = ${n(storm.dash)} * dash * stirred * (0.12 + 0.88 * lane) * (1.0 - ${n(storm.crownEven)} * crown);
  vec3 pc = (p - ${v3(storm.pocketAt)}) / ${v3(storm.pocketReach)};
  float pocket = 1.0 - ${n(storm.pocket)} * stirred * exp(-dot(pc, pc));
  float sigma = uStorm.x * wall * eye * low * front * rest * trunk * pocket * (soft + dashes);
  // One sheet's share of the way through the liquid, along the eye's ray.
  float slant = max(abs(normalize(vStageWorld - cameraPosition).z), 0.35);
  float a = 1.0 - exp(-sigma * ${n((2 * INNER * 0.97) / storm.sheets)} / slant);
  if (a <= 0.002) discard;
  if (uDiag != 0) {
    if (uDiag != ${viewCode('cover')}) discard;
    gl_FragColor = vec4(a, 0.0, a, a);
    return;
  }
  vec3 lit = stormLit(p, grain, ${n(storm.dashWhite)} * dashes / max(soft + dashes, 1e-4));
  // The flood is read as petals in turning liquid, not as a fill: lighter along the streaks and dashes, darker in the lanes.
  lit *= mix(1.0, (0.5 + 0.55 * streak + 0.4 * dash) * (0.7 + 0.3 * lane), ${n(storm.floodDrawn)} * (1.0 - after));
  float most = max(lit.r, max(lit.g, lit.b));
  lit = mix(mix(lit, vec3(most), min(${n(storm.crownWhite)} * crown, 1.0)), most * ${v3(storm.flareTint)}, min(${n(storm.lampWhite)} * lantern, 1.0)) * (1.0 + ${n(storm.crownGain)} * crown + ${n(storm.lampGain)} * lantern);
  gl_FragColor = vec4(lit, a);
}
`

// The wash: where the liquid turns, the petals are thrown outward and run round the inside of the glass low down, over the
// edge of the island. One thin layer just inside the glass, drawn out in the same dashes as the mist; it breaks up into
// dashes as the liquid stills and is gone when it is still.
const WASH = `
${STORM_PARS}
void main() {
  float c = stageChange();
  if (stageGone(c)) discard;
  #ifdef STAGE_INSIDE
  if (stageOutside()) discard;
  #endif
  if (uWash.x <= 0.0) discard;
  vec3 p = vStageLocal;
  float rad;
  vec3 q = stormPlace(p, rad);
  float grain;
  float billow = stormBillow(q, grain);
  float streak;
  float lane;
  float dash;
  stormDrawn(q, rad, streak, lane, dash);
  float band = smoothstep(${n(storm.washTopMm)}, ${n(groundY - 1)}, p.y) * smoothstep(${n(storm.washLowMm)}, ${n(storm.washLowMm + 4)}, p.y);
  // As the liquid stills the wash does not fade: less and less of it is left, the thin places first.
  float field = 0.45 * streak + 0.25 * lane + 0.3 * smoothstep(0.2, 0.8, billow + 0.35);
  float left = smoothstep(1.0 - uWash.x, 1.0 - uWash.x + 0.4, field + 0.25 * uWash.x);
  // Not one ribbon: it is whole only in the dashes, the lanes are gaps through to the scene, and before the pond's glint it is thin.
  float pond = 1.0 - ${n(storm.washPond)} * exp(-(p.x - ${n(storm.lampAt[0])}) * (p.x - ${n(storm.lampAt[0])}) / ${n(storm.washPondMm * storm.washPondMm)}) * smoothstep(0.0, 20.0, p.z);
  pond *= 1.0 - ${n(storm.washTrunk)} * exp(-(p.x - ${n(storm.washTrunkAt)}) * (p.x - ${n(storm.washTrunkAt)}) / ${n(storm.washTrunkMm * storm.washTrunkMm)}) * smoothstep(0.0, 20.0, p.z) * smoothstep(-36.0, -24.0, p.y);
  float a = ${n(storm.wash)} * band * left * pond * (${n(storm.washEven)} + ${n((1 - storm.washEven) * 0.45)} * streak + ${n((1 - storm.washEven) * 0.55)} * dash) * mix(${n(storm.washGap)}, 1.0, lane);
  if (a <= 0.004) discard;
  if (uDiag != 0) {
    if (uDiag != ${viewCode('cover')}) discard;
    gl_FragColor = vec4(a, 0.0, a, a);
    return;
  }
  gl_FragColor = vec4(stormLit(p * 0.96, grain, ${n(storm.dashWhite)} * dash) * (${n(storm.washLight)} * (0.8 + 0.25 * streak + 0.25 * dash)), a);
}
`

function washGeometry(): THREE.BufferGeometry {
  const at: number[] = []
  const idx: number[] = []
  const cols = 72
  const rows = 8
  const R = storm.washAtMm
  const yTop = storm.washTopMm
  const yLow = Math.max(storm.washLowMm, -R + 1)
  // Columns from the back of the glass round both sides to the front, so the far side is drawn before the near.
  const order: number[] = []
  for (let k = 0; k < cols; k++) order.push(k)
  const azOf = (k: number): number => (TAU_ * (k + 0.5)) / cols
  order.sort((x, y) => Math.cos(azOf(x)) - Math.cos(azOf(y)))
  for (const k of order) {
    const base = at.length / 3
    for (let i = 0; i <= rows; i++) {
      const y = yLow + ((yTop - yLow) * i) / rows
      const s = Math.sqrt(Math.max(R * R - y * y, 0))
      for (let e = 0; e < 2; e++) {
        const az = (TAU_ * (k + e)) / cols
        at.push(s * Math.sin(az), y, s * Math.cos(az))
      }
    }
    for (let i = 0; i < rows; i++) {
      const a0 = base + i * 2
      idx.push(a0, a0 + 1, a0 + 2, a0 + 1, a0 + 3, a0 + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(at, 3))
  g.setIndex(idx)
  return g
}

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
let washed: THREE.Mesh | null = null

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
  const washMaterial = stageShader({
    part: PART,
    standIn: false,
    inside: true,
    change: 'miniature',
    uniforms: stormUniforms,
    fragment: WASH,
    params: { side: THREE.DoubleSide, transparent: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8 },
  })
  washed = new THREE.Mesh(washGeometry(), washMaterial)
  washed.renderOrder = 3.2
  washed.frustumCulled = false
  washed.visible = false
  washed.onBeforeRender = () => {
    const cover = stageUniforms.uDiag.value === viewCode('cover')
    washMaterial.blendSrc = cover ? THREE.DstAlphaFactor : THREE.SrcAlphaFactor
    washMaterial.blendSrcAlpha = cover ? THREE.ZeroFactor : null
    washMaterial.blendDstAlpha = cover ? THREE.OneFactor : null
  }
  air = new THREE.Group()
  air.add(sheets, billows, washed)
  return air
}

const ramp = (v: number, from: number, to: number): number => {
  const t = Math.min(1, Math.max(0, (v - from) / (to - from)))
  return t * t * (3 - 2 * t)
}

/** The petal mist's thickness per mm and how even it is, from the liquid alone: its turbulence, its roll, the lift of the globe and the swap's window. */
export function stormAt(moment: KitMoment): { thick: number; even: number; wash: number } {
  const f = moment.frame
  const L = VEIL_LOOK
  const turb = Math.min(1, Math.max(0, f.turbulence))
  const w = Math.min(1, Math.max(0, (turb - L.whiteFrom) / (L.whiteTo - L.whiteFrom)))
  const up = Math.min(1, Math.max(0, (turb - L.shakenFrom) / (L.shakenTo - L.shakenFrom)))
  const held = ramp(f.globe.y / config.shake.liftMm, L.heldFrom, L.heldTo)
  const shut = config.shake.swapWindow.toBeat
  const beat = f.moment.beat
  const since = f.moment.sinceLanding
  const rolling = Math.min(1, Math.max(0, (f.liquid[LIQUID_ROLL] ?? 0) / ROLL_MAX))
  const stir = Math.max(storm.stirred * Math.pow(turb, L.hazePower), storm.rolling * Math.pow(rolling, storm.rollPower))
  const after = Math.max(stir, storm.calm)
  // The flood does not open in a step. From the close of the swap it thins through the set down and the landing and is the
  // stirred mist `releaseSeconds` after the landing: 0 to 1 over that whole time, the landing at `releaseLanding` of it.
  const u =
    beat !== null
      ? Math.min(1, Math.max(0, (beat - shut) / config.shake.setDownBeats)) * storm.releaseLanding
      : since >= 0 && since < L.openHoldSeconds
        ? storm.releaseLanding + (1 - storm.releaseLanding) * Math.min(1, since / storm.releaseSeconds)
        : 0
  const v = Math.pow(u, storm.releaseEarly)
  const e = v * v * (3 - 2 * v)
  const raw = Math.max(Math.pow(w, L.whitePower), held * Math.pow(up, L.shakenPower))
  // Once the release is under way the flood no longer hangs on the turbulence of that instant, only on the release.
  const flood = u > 0 ? raw + (1 - raw) * ramp(u, 0, storm.releaseOwn) : raw
  // Thickness falls by equal ratios in equal times (the eye reads thickness by its logarithm), from the flood's to the stirred mist's.
  const thick = Math.max(after, storm.flood * flood * Math.pow(after / storm.flood, e))
  const wash = Math.min(1, (thick > after ? thick : stir) / storm.washFull)
  return { thick, even: storm.even[1]! + (storm.even[0]! - storm.even[1]!) * flood * (1 - e), wash }
}

/** The mist at a moment: on the ground and thick at the landing, risen and thin at rest; `bare` between the swap and the landing. */
export function mistAt(sinceLanding: number): { heightMm: number; density: number } {
  const t = sinceLanding < Infinity ? Math.max(0, sinceLanding - look.riseAfter) : 1e4
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
  stormUniforms.uWash.value.set(air.wash, 0, 0, 0)
  if (billows) billows.visible = air.thick > 1e-4
  if (washed) washed.visible = air.wash > 1e-3
  if (sheets) sheets.visible = !bare
}
