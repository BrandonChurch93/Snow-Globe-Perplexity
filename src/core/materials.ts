import * as THREE from 'three'
import { DEPTH_RANGE_MM, partBytes, viewCode } from '../diagnostics/views'
import { LENS_GLSL, innerRadiusMm, lensIor, lensRadiusMm } from '../globe/lens'
import { BASE_PASS, CHANGE_COVER, DRESSING_CHANGE, SHUTTER_CHANGE, changeRamp } from '../shake/change'
import { LIGHT_FRAG, LIGHT_FRAG_PARS, lightUniforms } from './chunks/light'
import { VEIL_FRAG, VEIL_FRAG_PARS, veilUniforms } from './chunks/veil'
import type { Sample } from './sampler'
import { flagStandIn } from './standins'
import { STILL_SIDE, stillBytes } from './still'

export type Rgb = readonly [number, number, number]

const STILL = stillBytes()

function stillPicture(): THREE.DataTexture {
  const t = new THREE.DataTexture(STILL, STILL_SIDE, STILL_SIDE, THREE.RedFormat, THREE.UnsignedByteType)
  t.needsUpdate = true
  return t
}

export const stageUniforms = {
  uLensCentre: { value: new THREE.Vector3() },
  uLens: { value: new THREE.Vector4(lensRadiusMm, lensIor, 1, innerRadiusMm) },
  uGlobeInv: { value: new THREE.Matrix4() },
  ...lightUniforms,
  ...veilUniforms,
  uDiag: { value: 0 },
  uSeed: { value: 0 },
  uChange: { value: 0 },
  uPass: { value: new THREE.Vector4(0, 0, 0, 1) },
  uStill: { value: stillPicture() },
  uCoc: { value: new THREE.Vector3() },
}

export const MODE = { always: 0, incoming: 1, outgoing: 2 } as const

export const DRESSING_FRONT = { gain: 2, fromMm: 58, toMm: 230 } as const

/**
 * How the parts outside the glass give way, all of them inside the one span of change.ts and under its cover.
 * The base is never morphed: every pixel of a sample holds one base or the other, and the share that holds the new one grows
 * over `BASE_PASS`, longer than the span. Both stand in the light the glass pours (`pourOnBase` below, set by lighting.ts,
 * `CHANGE_BLOOM`): lip and shoulder near white in it, the flank in its own colour and dim, so the eye follows a base from
 * frame to frame while one shape passes into the other over the frames of `BASE_PASS`, and nothing steps.
 * Which base a pixel holds is a hash against that share. Drawn afresh at each sample of a frame, the hash left the strip between
 * the two lines as grain a critic reads at native pixels: a pixel held the new base in a number of samples that fell by chance.
 * So a frame has one hash to a pixel and one share (`uPass`, set in stage.ts): of N samples the hash is set at the middle of one
 * of N even levels, and each sample steps it on by whole levels and round again (`passLevel`). Every pixel then holds the new
 * base in the same number of the frame's samples, the share to the nearest of N. The globe travels while the shutter is open,
 * so a base's line that stands across the travel is drawn out, and a pixel there is under that base for a part of the shutter
 * only. The step therefore goes by the sample's place in the shutter, `passStride` levels a place: the samples that hold the new
 * base fall evenly over any part of the shutter, at every pixel.
 * The share to the nearest of N is the share itself where N is large. Of few samples it is a few states: a frame of two holds
 * the old base, half of each or the new, and the pass was two steps however many frames it ran. So under `PASS_EVEN` samples
 * the odd sample is shared out among the pixels by the still tile (`stageStill`, `passShare`, in `stageChange`): a pixel holds the new base in
 * the whole number of samples under the share times N plus its own level on the tile. Any patch then holds the share itself,
 * at every frame of the pass, and a pixel that has taken one sample more keeps it. From `PASS_EVEN` samples on every pixel
 * holds the same number, as before, and no grain is there to read.
 * Where the page draws one sample a frame and shows it (`uPass.w` 0, `passCount`), nothing averages the hash away, and a hash
 * drawn afresh each frame made every pixel of a part that gives way flicker for as long as the change ran. There the level
 * is the pixel's own and never the frame's (`stageStill`): a pixel goes once and stays gone, comes once and stays. The levels
 * are a tile in the order of the void and the cluster (still.ts): at every share the pixels that are gone stand as far from
 * one another as they can, so a part thins evenly. A white hash leaves clumps, and a lattice such as interleaved gradient
 * noise, which this was first, sets its dots in rows that the eye reads as a weave across the part.
 * The table's dressing never holds two seasons, and it is not swapped under the cover: the old season's leaves over the six
 * frames before the base begins to pass, in sight, as the cover rises, and the new season's comes when the base has passed,
 * with the cover's tail (`DRESSING_CHANGE`); between them the table is bare. The old goes from the foot outward and the new
 * comes from the far places in to the foot; the edge of that front is broken into
 * patches (`cellMm`, `fineMm`) drawn out along the way a gust runs (`streak` times as long as wide, `rayMm` to a radian across)
 * and feathered across the samples of a frame (`feather`), so a field of frost or of sand thins in fingers and never along a line.
 * The cover is the fall of the exposure with the light of the glass poured over the room, and all of that is set in
 * lighting.ts (`CHANGE_BLOOM`). The one light laid here is what a base takes of that pour (`pourOnBase`).
 * The code of a part's kind rides in `uState.z`: 0 and above is the lag of a part inside the glass, under 0 the table's gain,
 * under `-BASE_CODE` the base's.
 */
export const OUTSIDE_FRONT = { rayMm: 110, streak: 3.4, cellMm: 6.5, fineMm: 2.3, fine: 0.36, contrast: 2.6, feather: 0.14 } as const
const BASE_CODE = 10
/** From this many samples a frame on, every pixel holds the new base in the same number of them; under it the still tile shares the odd sample out. */
export const PASS_EVEN = 8

/**
 * What a base takes of the light a change pours, whatever it is made of. A base is dark stuff (moss, blackened iron, oiled
 * wood) and stands in a room the cover has taken the exposure from: left to what the flood lays on it by its own shade it is
 * black against the room, or, lit as brightly as the table, it is a colour that is no season's base. So the glass lights it
 * as a lamp close over a dark thing does. `uPourBase` is the light at the collar, in the colour of the pour. The rim takes it
 * whole and falls off with the way out from the glass (`uPourBaseShape.x`, mm, to one part in e), `uPourBaseShape.y` of the way
 * from the stuff's colour to the colour of the light, so the lip and the shoulder go to white and lose their carving. The
 * flank takes `uPourBaseFlank.x` of that, falling off over `uPourBaseFlank.y` mm, in the stuff's own colour alone and by a
 * light with `uPourBaseFlank.z` of the pour's colour in it and the rest white: rose light on brown wood is terracotta, which
 * is no season's base, so the flank stays the dark thing it is, in its own colour, with a warm edge where the rim falls
 * off into it. Both are whole on a face that looks at the glass and
 * `uPourBaseShape.z` of that on a face that looks away. The stuff's colour is its albedo over its strongest channel to the
 * power `uPourBaseShape.w`: at 0 the albedo itself, so black iron would stay black; at 1 the bare hue, so a carving would
 * go flat; between, a dark base is lifted toward a pale one and keeps its grain.
 * It is laid after everything a base does to its own light, so no shade of a base cuts it, and with no cover it is nothing
 * (`uPourBase` is 0 then and the lines are not run). lighting.ts sets the three (`CHANGE_BLOOM`, `base` and on).
 * It is laid on what leaves the face (`outgoingLight`), on the line after three closes the sums of a base's own light
 * (`POUR_AFTER`), and under the coat of a base that has one. It is not laid into the diffuse sum: there it stood between a
 * base's last product and the sum that takes it, and the compiler joins those two otherwise when a line stands between them,
 * run or not. One pixel of summer's landed still moved by one level with no cover in the picture (measured on 82d0b882: the
 * still read f6c56497bedfc63d with the lines before `vec3 totalDiffuse =`, any lines at all, and main's cbe415cdef5fc7c5
 * with them here). Here no line of a base's own stands on either side, so a picture with no cover is the picture without
 * the pour, bit for bit.
 */
export const pourUniforms = {
  uPourBase: { value: new THREE.Color(0, 0, 0) },
  uPourBaseShape: { value: new THREE.Vector4(4, 0.8, 0.2, 0.5) },
  uPourBaseFlank: { value: new THREE.Vector3(0.05, 30, 0) },
}
/**
 * The room's own light as a base keeps it under the cover of a change. The cover takes the exposure from the room, and what
 * that takes from the dark of the backdrop is laid back over the picture (lighting.ts, `CHANGE_BLOOM.room`). A base is a
 * thing in that room and keeps its own look in the same way: these are the room's lights under the names the light chunk
 * reads them by, each `hold` times the room's own. lighting.ts sets them on every frame; with no cover `hold` is 1 and they
 * are the room's own, number for number. `pourOnBase` gives them to a base's material in place of the room's, so the key,
 * the rim, the card, the sky and the ground and the room in its polish stand on a base through the fall as they do at
 * rest, with everything the base does to its own light, and the base is its own colour under the pour.
 */
export const baseRoom = {
  hold: 1,
  uniforms: {
    uRigKeyCol: { value: new THREE.Color(0, 0, 0) },
    uRigRimCol: { value: new THREE.Color(0, 0, 0) },
    uRigCardCol: { value: new THREE.Color(0, 0, 0) },
    uRigSky: { value: new THREE.Color(0, 0, 0) },
    uRigGround: { value: new THREE.Color(0, 0, 0) },
    uRigRoom: { value: new THREE.Vector4(1, 1, 0.5, 0.6) },
  },
}
const POUR_PARS = `
uniform vec3 uPourBase;
uniform vec4 uPourBaseShape;
uniform vec3 uPourBaseFlank;
`
/** The line of three's own shader the pour follows: the sums of a face's own light, closed. tests/lens-glare.test.ts reads it out of three. */
const POUR_AFTER = 'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;'
const POUR_FRAG = `
if (uPourBase.r + uPourBase.g + uPourBase.b > 0.0) {
  float pourFar = max(length(vStageLocal), uLightFloodAt.x);
  float pourOut = pourFar - uLightFloodAt.x;
  vec3 pourN = uLightFrame * (inverseTransformDirection(geometryNormal, viewMatrix) * vec3(1.0, uLensCentre.y < 0.0 ? -1.0 : 1.0, 1.0));
  float pourFace = mix(uPourBaseShape.z, 1.0, clamp(0.5 - 0.5 * dot(pourN, vStageLocal) / pourFar, 0.0, 1.0));
  float pourTop = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
  vec3 pourStuff = pourTop > 1e-4 ? diffuseColor.rgb * pow(max(pourTop, 1e-4), -uPourBaseShape.w) : vec3(0.0);
  float pourRim = exp(-pourOut / uPourBaseShape.x);
  float pourFlank = uPourBaseFlank.x * exp(-pourOut / uPourBaseFlank.y);
  vec3 pourPlain = mix(vec3(max(uPourBase.r, max(uPourBase.g, uPourBase.b))), uPourBase, uPourBaseFlank.z);
  outgoingLight += pourFace * (uPourBase * (pourRim * mix(pourStuff, vec3(1.0), uPourBaseShape.y)) + pourPlain * (pourFlank * pourStuff));
}
`
/** Lays the pour on a base's material, after the part's own hook: `stageMaterial` calls it for every lit part of a base. */
export function pourOnBase(shader: { uniforms: Record<string, THREE.IUniform>; fragmentShader: string }): void {
  Object.assign(shader.uniforms, pourUniforms, baseRoom.uniforms)
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>\n${POUR_PARS}`).replace(POUR_AFTER, `${POUR_AFTER}\n${POUR_FRAG}`)
}

const OUTSIDE_RAMP = changeRamp('base')
/**
 * How far from its even share the number of samples in a band of levels and a first part of the shutter stands, in samples:
 * the root of the mean square over every band and every part.
 */
export function passSpread(count: number, stride: number): number {
  let sum = 0
  let terms = 0
  for (let from = 0; from < count; from++) {
    for (let long = 1; long < count; long++) {
      let held = 0
      for (let place = 0; place < count; place++) {
        if ((place * stride + from) % count < long) held++
        sum += (held - ((place + 1) * long) / count) ** 2
        terms++
      }
    }
  }
  return terms > 0 ? Math.sqrt(sum / terms) : 0
}

const strides = new Map<number, number>()
/** The levels a sample steps on for each place it stands later in the shutter: of the strides that visit every level, the one with the least `passSpread`. */
export function passStride(count: number): number {
  let best = strides.get(count)
  if (best === undefined) {
    best = 1
    let least = Infinity
    const shares = (a: number, b: number): number => (b === 0 ? a : shares(b, a % b))
    for (let g = 1; g < count; g++) {
      if (shares(g, count) !== 1) continue
      const d = passSpread(count, g)
      if (d < least - 1e-9) {
        least = d
        best = g
      }
    }
    strides.set(count, best)
  }
  return best
}

/** How far on a sample steps the hash, in levels of `count`, from where it stands in the shutter (`t`, 0 to 1). */
export function passStep(t: number, count: number): number {
  const place = Math.min(count - 1, Math.max(0, Math.floor(t * count)))
  return ((place * passStride(count)) % count) / count
}

/** How many samples a frame is the mean of, as `uPass.w` carries it. None: the page draws one sample a frame and shows it. */
export function passCount(sample: { of?: number } | null): number {
  return sample ? (sample.of ?? 1) : 0
}

/** The level the pixel of column `x` and row `y` stands at wherever one sample is a frame: what `stageStill` reads. */
export function stillLevel(x: number, y: number): number {
  return (STILL[(y & (STILL_SIDE - 1)) * STILL_SIDE + (x & (STILL_SIDE - 1))]! + 0.5) / 256
}

/**
 * The level a pixel's hash stands at in one sample of a frame of `count`: what the base's branch of `stageGone` works out.
 * The pixel holds the new base in that sample where this is under the share that has passed.
 */
export function passLevel(hash: number, step: number, count: number): number {
  const h = count > 1 ? (Math.floor(hash * count) + 0.5) / count : hash
  const v = h + step
  return v - Math.floor(v)
}

/**
 * The share a base's pixel is held against in a frame of `count` samples: what the base's branch of `stageChange` gives.
 * From `PASS_EVEN` samples on, and in a frame of one, it is the share that has passed. Between them it is the whole number
 * of samples under the share times `count` plus the pixel's own level on the still tile (`still`, `stillLevel`), as a share
 * of `count`: the pixel holds the new base in exactly that many samples of the frame.
 */
export function passShare(share: number, count: number, still: number): number {
  return count > 1 && count < PASS_EVEN ? Math.floor(share * count + still) / count : share
}

/**
 * The dressing on the glass is on the one thing the cover leaves in sight, so it is not there while the base changes: the old
 * season's goes as the cover rises, burnt off by the light, and the new season's comes as the cover falls.
 */
export const GLASS_LEAVE = { start: CHANGE_COVER.riseFrom, length: CHANGE_COVER.fullFrom - CHANGE_COVER.riseFrom } as const
export const GLASS_COME = { start: CHANGE_COVER.fullTo, length: CHANGE_COVER.goneAt - CHANGE_COVER.fullTo } as const
/** A place in the window as a share of the outside span, read past both of its ends: what `(uChange - uState.x) / uState.y` gives. */
const share = (at: number): number => (at - OUTSIDE_RAMP.start) / OUTSIDE_RAMP.length
const TABLE = {
  liftFrom: share(DRESSING_CHANGE.liftFrom),
  leaveFrom: share(DRESSING_CHANGE.leaveFrom),
  leaveLong: share(DRESSING_CHANGE.leaveTo) - share(DRESSING_CHANGE.leaveFrom),
  comeFrom: share(DRESSING_CHANGE.comeFrom),
  comeLong: share(DRESSING_CHANGE.comeTo) - share(DRESSING_CHANGE.comeFrom),
  closes: share(1),
} as const
const BASE = { from: share(BASE_PASS.from), long: share(BASE_PASS.to) - share(BASE_PASS.from) } as const

/**
 * The scatter on the table is carried, not swapped. What lies there lifts `leadOut` shares of the outside span
 * before its place is cleared (never before `DRESSING_CHANGE.liftFrom`), is blown out from the foot, faster and faster, and is
 * gone in the air; what the new season lays starts `leadIn` shares before its place fills, from further out, flies in and
 * comes down on its place, the far places first and the foot last. Both are in sight (`DRESSING_CHANGE`): the old is blown
 * out as the light of the glass bursts over it, a piece carried outward runs ahead of the front that clears its place and
 * is thinned as that front comes up with it, and the last of it is gone before the base begins to pass; the new comes down
 * with the cover's tail, and every new piece is down before the window closes (`GUST_LAST_DOWN` stays under `GUST_CLOSES`).
 * Lengths in millimetres. With one season on the stage the mode is 0 and nothing here is read.
 */
export const GUST = { leadOut: 1, longOut: 1.25, reachOutMm: 170, leadIn: 0.45, longIn: 0.65, reachInMm: 70, heightMm: 14 } as const
/** The share of the outside span at which the last new piece on the table is down. */
export const GUST_LAST_DOWN = TABLE.comeFrom + (TABLE.comeLong * (0.5 + DRESSING_FRONT.gain)) / (1 + DRESSING_FRONT.gain) - GUST.leadIn + 1.2 * GUST.longIn
export const GUST_CLOSES = TABLE.closes
/** The same instant as a place in the swap window. */
export const GUST_LAST_DOWN_AT = OUTSIDE_RAMP.start + GUST_LAST_DOWN * OUTSIDE_RAMP.length

/** For a vertex shader of a part of the table's dressing: x the way a piece is moved along the line out from the stage's axis, y its height as a share, z how far it is from lying (1 to 0). */
export const STAGE_GUST_GLSL = `
uniform float uChange;
uniform vec4 uState;
#ifdef STAGE_STREAK
uniform vec4 uGustSlot;
varying float vGustPart;
#endif
vec3 stageGust(vec2 rest, float a, float b) {
#ifdef STAGE_STREAK
  float part = float(gl_InstanceID % STAGE_STREAK);
  vGustPart = part;
#endif
  if (uState.w < 0.5 || uState.z >= 0.0) return vec3(0.0);
#ifdef STAGE_STREAK
  float s = (uGustSlot.x + uGustSlot.y * (part + 0.5) / float(STAGE_STREAK) - uState.x) / uState.y;
#else
  float s = (uChange - uState.x) / uState.y;
#endif
  float r = length(rest);
  float far = clamp((r - ${DRESSING_FRONT.fromMm.toFixed(1)}) / ${(DRESSING_FRONT.toMm - DRESSING_FRONT.fromMm).toFixed(1)}, 0.0, 1.0);
  if (uState.w < 1.5) {
    float at = (0.5 - uState.z * (1.0 - far)) / (1.0 - uState.z);
    float over = ${TABLE.comeFrom.toFixed(4)} + ${TABLE.comeLong.toFixed(4)} * at;
    float q = clamp((s - over + ${GUST.leadIn.toFixed(2)}) / (${GUST.longIn.toFixed(2)} * (0.8 + 0.4 * b)), 0.0, 1.0);
    float left = (1.0 - q) * (1.0 - q);
    return vec3(${GUST.reachInMm.toFixed(1)} * (0.5 + a) * left, q < 1.0 ? sin(3.14159265 * (0.2 + 0.8 * q)) : 0.0, left);
  }
  float at = (0.5 - uState.z * far) / (1.0 - uState.z);
  float over = ${TABLE.leaveFrom.toFixed(4)} + ${TABLE.leaveLong.toFixed(4)} * at;
  float q = clamp((s - max(over - ${GUST.leadOut.toFixed(2)}, ${TABLE.liftFrom.toFixed(4)})) / ${GUST.longOut.toFixed(2)}, 0.0, 1.0);
  return vec3(${GUST.reachOutMm.toFixed(1)} * (0.5 + a) * q * q, sin(1.5707963 * q), q);
}
`

/**
 * The scatter in the air, in a frame of the film. A piece is blown faster than the globe goes, and the globe's travel sets how
 * many samples a frame has (src/film/motion.ts): drawn once a sample, a petal at 3840 lay as 76 copies 8 to 14 pixels apart,
 * and its outline was a row of teeth. So while a piece of the scatter is in the air, in a frame of `join` samples or more, each
 * sample's share of the shutter is its rank in time (as `leaveOut` takes it, change.ts) cut into `parts` equal parts, the
 * scatter is drawn once at the middle of each part, and every pixel keeps one of them: its level in the still tile
 * (still.ts), turned on by `turn` of a whole with every sample, so that neighbours keep unlike parts and one pixel goes
 * round all of them. Over the frame a pixel then sees the scatter at as many moments as the frame has samples, one in each
 * sample's share, and where a row of copies stood there is one smear with a fine grain. The parts are
 * a second mesh over the same vertices (`gustTwin`), made when a film frame first asks for it and shown in place of the first
 * for those samples alone: the live page has no sample, a still and a frame with nothing in the air have the first mesh, and
 * their shader is the one it was (`STAGE_STREAK` is defined for the second mesh only).
 */
export const GUST_STREAK = { join: 8, parts: 8, turn: 0.6180339887 } as const
const gustSlot = { value: new THREE.Vector4() }
const GUST_AT = [0.5 / (1 + DRESSING_FRONT.gain), (0.5 + DRESSING_FRONT.gain) / (1 + DRESSING_FRONT.gain)] as const
/** The shares of the outside span between which a piece of the scatter is in the air: from the first that lifts to the last that is gone, and from the first that starts in to the last that is down. */
export const GUST_FLIGHT = {
  out: [Math.max(TABLE.leaveFrom + TABLE.leaveLong * GUST_AT[0] - GUST.leadOut, TABLE.liftFrom), Math.max(TABLE.leaveFrom + TABLE.leaveLong * GUST_AT[1] - GUST.leadOut, TABLE.liftFrom) + GUST.longOut],
  in: [TABLE.comeFrom + TABLE.comeLong * GUST_AT[0] - GUST.leadIn, GUST_LAST_DOWN],
} as const

/** Whether this sample draws the scatter in parts (`GUST_STREAK`), for a dressing that comes (`incoming`) or leaves; if so the sample's share of the shutter is set for the second mesh. */
export function gustStreaks(sample: Sample | null, incoming: boolean): boolean {
  const of = sample?.of ?? 1
  if (!sample || sample.hold === undefined || of < GUST_STREAK.join) return false
  const flight = incoming ? GUST_FLIGHT.in : GUST_FLIGHT.out
  if (!(share(sample.hold + SHUTTER_CHANGE) > flight[0] && share(sample.hold) < flight[1])) return false
  const rank = Math.floor(sample.t * of)
  gustSlot.value.set(sample.hold + (rank / of) * SHUTTER_CHANGE, SHUTTER_CHANGE / of, (rank * GUST_STREAK.turn) % 1, 0)
  return true
}

/** For the fragment shader of a part the gust carries: whether this pixel keeps another part of the sample's share than the one being drawn. */
export const STAGE_GUST_FRAG_GLSL = `
#ifdef STAGE_STREAK
uniform vec4 uGustSlot;
varying float vGustPart;
bool stageGustElse() {
  return floor(fract(stageStill(ivec2(gl_FragCoord.xy) + ivec2(53, 17)) + uGustSlot.z) * float(STAGE_STREAK)) != floor(vGustPart + 0.5);
}
#endif
`

/** The second mesh of a part the gust carries: the same vertices drawn `GUST_STREAK.parts` times, with the first mesh's uniforms and its place in the change. Returns the switch between the two; the second is made the first time it is asked for. */
export function gustTwin(mesh: THREE.Mesh): (on: boolean) => void {
  let twin: THREE.Mesh | null = null
  const make = (): THREE.Mesh => {
    const from = mesh.geometry
    const g = new THREE.InstancedBufferGeometry()
    for (const [name, a] of Object.entries(from.attributes)) {
      const each = a as THREE.InstancedBufferAttribute
      g.setAttribute(name, each.isInstancedBufferAttribute ? new THREE.InstancedBufferAttribute(each.array, each.itemSize, each.normalized, each.meshPerAttribute * GUST_STREAK.parts) : a)
    }
    g.setIndex(from.getIndex())
    for (const group of from.groups) g.addGroup(group.start, group.count, group.materialIndex)
    g.setDrawRange(from.drawRange.start, from.drawRange.count)
    const own = (from as THREE.InstancedBufferGeometry).isInstancedBufferGeometry ? (from as THREE.InstancedBufferGeometry).instanceCount : 1
    g.instanceCount = own * GUST_STREAK.parts
    const first = mesh.material as THREE.ShaderMaterial
    const m = first.clone()
    m.uniforms = { ...first.uniforms, uGustSlot: gustSlot }
    m.defines = { ...first.defines, STAGE_STREAK: GUST_STREAK.parts }
    m.userData.stage = first.userData.stage
    const second = new THREE.Mesh(g, m)
    second.frustumCulled = mesh.frustumCulled
    second.renderOrder = mesh.renderOrder
    second.position.copy(mesh.position)
    second.quaternion.copy(mesh.quaternion)
    second.scale.copy(mesh.scale)
    mesh.parent?.add(second)
    return second
  }
  return (on: boolean): void => {
    if (!on && !twin) return
    twin ??= make()
    twin.visible = on
    mesh.visible = !on
  }
}

export interface StageHandle {
  part: string
  onGlass: boolean
  uPart: { value: THREE.Vector4 }
  uState: { value: THREE.Vector4 }
  uFlags: { value: THREE.Vector4 }
}

export interface PartSpec {
  part: string
  standIn?: boolean
  inside?: boolean
  miniature?: boolean
  textured?: boolean
  texels?: number
  change?: string
}

export function makeHandle(spec: PartSpec): StageHandle {
  const c = partBytes(spec.part)
  const standIn = spec.standIn !== false
  if (standIn) flagStandIn(spec.part)
  const ramp = spec.change === 'surface-dressing' ? OUTSIDE_RAMP : changeRamp(spec.change ?? 'none')
  return {
    part: spec.part,
    onGlass: spec.change === 'glass-dressing',
    uPart: { value: new THREE.Vector4(c[0] / 255, c[1] / 255, c[2] / 255, standIn ? 1 : 0) },
    uState: { value: new THREE.Vector4(ramp.start, ramp.length, spec.change === 'surface-dressing' ? -DRESSING_FRONT.gain : spec.change === 'base' ? -BASE_CODE - 1 : ramp.lag, MODE.always) },
    uFlags: { value: new THREE.Vector4(spec.miniature ? 1 : 0, spec.textured ? (spec.texels ?? 0) : 0, spec.inside ? 1 : 0, 1) },
  }
}

export const handleOf = (m: THREE.Material): StageHandle => m.userData.stage as StageHandle

export function setPresence(m: THREE.Material, mode: number, presence = 1): void {
  const h = handleOf(m)
  h.uState.value.w = mode
  if (h.onGlass && mode !== MODE.always) {
    const r = mode === MODE.outgoing ? GLASS_LEAVE : GLASS_COME
    h.uState.value.x = r.start
    h.uState.value.y = r.length
  }
  h.uFlags.value.w = presence
}

export const STAGE_VERT_PARS = `
${LENS_GLSL}
uniform mat4 uGlobeInv;
uniform int uDiag;
uniform vec3 uCoc;
varying vec3 vStageWorld;
varying vec3 vStageLocal;
varying vec3 vStageAux;
varying vec3 vStagePlaced;
varying float vStageSeen;
`

export const STAGE_VERT_MAIN = `
vec4 stageWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
stageWorld = instanceMatrix * stageWorld;
#endif
stageWorld = modelMatrix * stageWorld;
vStageWorld = stageWorld.xyz;
vStageLocal = (uGlobeInv * stageWorld).xyz;
vStageAux = vec3(0.0, -mvPosition.z, length(mvPosition.xyz));
vStagePlaced = stageWorld.xyz;
vStageSeen = 1.0;
#ifdef STAGE_INSIDE
vec4 stagePlaced = lensPlace(stageWorld.xyz, cameraPosition, vStageSeen);
vec4 stageView = viewMatrix * vec4(stagePlaced.xyz, 1.0);
gl_Position = projectionMatrix * stageView;
// y is the depth the lens focuses at. Each lens sample places the vertex again from its own eye, so what is held sharp
// follows the image of the point behind the glass and not the depth it is placed at (the door: sharp at 152 mm, placed
// at 171). The true depth is right near the middle of the globe; the texels view takes the image itself, from the
// parallax of an eye moved 4 mm across and 4 mm up, and of the two keeps the one further from the focus. A vertex that
// one of the three eyes cannot see is placed on the limb, whose parallax is no image's: it keeps the depth it is placed at
vStageAux = vec3(stagePlaced.w, -mvPosition.z, length(stageView.xyz));
vStagePlaced = stagePlaced.xyz;
if (uDiag == ${viewCode('texels')}) {
  vec3 stageRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 stageUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  float stageSeenA;
  float stageSeenB;
  vec3 stageA = (viewMatrix * vec4(lensPlace(stageWorld.xyz, cameraPosition + 4.0 * stageRight, stageSeenA).xyz, 1.0)).xyz;
  vec3 stageB = (viewMatrix * vec4(lensPlace(stageWorld.xyz, cameraPosition + 4.0 * stageUp, stageSeenB).xyz, 1.0)).xyz;
  float stageAcross = ((stageA.x - 4.0) / stageA.z - stageView.x / stageView.z) / 4.0;
  float stageDown = ((stageB.y - 4.0) / stageB.z - stageView.y / stageView.z) / 4.0;
  vStageAux.y = 1.0 / max(abs(stageAcross - uCoc.y) > abs(stageDown - uCoc.y) ? stageAcross : stageDown, 1e-5);
  if (vStageSeen + stageSeenA + stageSeenB < 2.5) vStageAux.y = max(-stageView.z, 1.0);
}
#endif
`

export const STAGE_FRAG_PARS = `
uniform int uDiag;
uniform float uSeed;
uniform float uChange;
uniform vec4 uPass;
uniform highp sampler2D uStill;
uniform vec3 uCoc;
uniform vec4 uPart;
uniform vec4 uState;
uniform vec4 uFlags;
uniform vec3 uLensCentre;
uniform vec4 uLens;
varying vec3 vStageWorld;
varying vec3 vStageLocal;
varying vec3 vStageAux;
varying vec3 vStagePlaced;
varying float vStageSeen;
// A triangle whose corners are all unseen is a sliver on the outline (src/globe/lens.ts), and a fragment of such a sliver can
// come with varyings that are no number. A comparison with no number is false whichever way it is asked, so both tests here
// are asked the way that is true for it, and the fragment is dropped. Asked the other way (seen <= 0, dot > r * r) it was kept
// and painted no number into one sample of a frame, and the mean of the samples keeps that: one dark pixel in a final frame.
bool stageOutside() {
  if (!(vStageSeen > 0.0)) return true;
  vec3 c = cross(normalize(vStagePlaced - cameraPosition), uLensCentre - cameraPosition);
  return !(dot(c, c) <= uLens.x * uLens.x);
}
float stageHash(vec3 p) {
  uvec3 v = uvec3(uint(p.x), uint(p.y), uint(p.z * 4096.0));
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return float(v.x >> 8u) / 16777216.0;
}
${LIGHT_FRAG_PARS}
float stageEdge = -1.0;
float stageNoise(vec3 p) {
  vec3 q = p + 2048.0;
  vec3 i = floor(q);
  vec3 f = q - i;
  f = f * f * (3.0 - 2.0 * f);
  float z0 = i.z / 4096.0;
  float z1 = (i.z + 1.0) / 4096.0;
  float a = mix(mix(stageHash(vec3(i.x, i.y, z0)), stageHash(vec3(i.x + 1.0, i.y, z0)), f.x), mix(stageHash(vec3(i.x, i.y + 1.0, z0)), stageHash(vec3(i.x + 1.0, i.y + 1.0, z0)), f.x), f.y);
  float b = mix(mix(stageHash(vec3(i.x, i.y, z1)), stageHash(vec3(i.x + 1.0, i.y, z1)), f.x), mix(stageHash(vec3(i.x, i.y + 1.0, z1)), stageHash(vec3(i.x + 1.0, i.y + 1.0, z1)), f.x), f.y);
  return mix(a, b, f.z);
}
float stagePatch(vec3 p) {
  float n = ${(1 - OUTSIDE_FRONT.fine).toFixed(2)} * stageNoise(p / ${OUTSIDE_FRONT.cellMm.toFixed(1)}) + ${OUTSIDE_FRONT.fine.toFixed(2)} * stageNoise(p / ${OUTSIDE_FRONT.fineMm.toFixed(1)} + 37.0);
  return (n - 0.5) * ${OUTSIDE_FRONT.contrast.toFixed(1)} + 0.5;
}
float stageStill(ivec2 at);
float stageChange() {
  if (uState.w < 0.5) return 0.0;
  if (uState.z < 0.0) {
    float s = (uChange - uState.x) / uState.y;
    if (uState.z < -${(BASE_CODE - 1).toFixed(1)}) {
      float pass = clamp(((uPass.z - uState.x) / uState.y + ${(-BASE.from).toFixed(4)}) / ${BASE.long.toFixed(4)}, 0.0, 1.0);
      return uPass.w > 1.5 && uPass.w < ${(PASS_EVEN - 0.5).toFixed(1)} ? floor(pass * uPass.w + stageStill(ivec2(gl_FragCoord.xy))) / uPass.w : pass;
    }
    float far = clamp((length(vStageWorld.xz) - ${DRESSING_FRONT.fromMm.toFixed(1)}) / ${(DRESSING_FRONT.toMm - DRESSING_FRONT.fromMm).toFixed(1)}, 0.0, 1.0);
    float run = uState.w > 1.5 ? (s - ${TABLE.leaveFrom.toFixed(4)}) / ${TABLE.leaveLong.toFixed(4)} : (s - ${TABLE.comeFrom.toFixed(4)}) / ${TABLE.comeLong.toFixed(4)};
    float reach = clamp(run, 0.0, 1.0) * (1.0 - uState.z) + uState.z * (uState.w > 1.5 ? far : 1.0 - far);
    stageEdge = stagePatch(vec3((dot(vStageWorld.xz, vStageWorld.xz) > 0.0 ? atan(vStageWorld.x, vStageWorld.z) : 0.0) * ${OUTSIDE_FRONT.rayMm.toFixed(1)}, 0.0, length(vStageWorld.xz) / ${OUTSIDE_FRONT.streak.toFixed(1)}));
    return clamp(reach, 0.0, 1.0);
  }
  float side = clamp(0.5 + vStageLocal.z / (2.0 * uGrid.w), 0.0, 1.0);
  return clamp((uChange - uState.x - uState.z * side) / uState.y, 0.0, 1.0);
}
float stageStill(ivec2 at) {
  return (floor(texelFetch(uStill, at & ${STILL_SIDE - 1}, 0).r * 255.0 + 0.5) + 0.5) / 256.0;
}
bool stageGoneStill(float c) {
  if (uState.w > 0.5) {
    float h = stageStill(ivec2(gl_FragCoord.xy));
    if (!(uState.z < -${(BASE_CODE - 1).toFixed(1)}) && stageEdge > -0.5) h = clamp(stageEdge + (h - 0.5) * ${OUTSIDE_FRONT.feather.toFixed(2)}, 0.001, 0.999);
    if (uState.w > 1.5 ? h < c : h >= c) return true;
  }
  return uFlags.w < 1.0 && stageStill(ivec2(gl_FragCoord.yx) + 29) >= uFlags.w;
}
bool stageGone(float c) {
  if (uPass.w < 0.5) return stageGoneStill(c);
  if (uState.w > 0.5) {
    float h = stageHash(vec3(gl_FragCoord.xy, uSeed));
    if (uState.z < -${(BASE_CODE - 1).toFixed(1)}) {
      h = stageHash(vec3(gl_FragCoord.xy, uPass.x));
      if (uPass.w > 1.5) h = (floor(h * uPass.w) + 0.5) / uPass.w;
      h = fract(h + uPass.y);
    } else if (stageEdge > -0.5) h = clamp(stageEdge + (h - 0.5) * ${OUTSIDE_FRONT.feather.toFixed(2)}, 0.001, 0.999);
    if (uState.w > 1.5 ? h < c : h >= c) return true;
  }
  if (uFlags.w < 1.0 && stageHash(vec3(gl_FragCoord.xy + 29.0, uSeed + 0.61)) >= uFlags.w) return true;
  return false;
}
${VEIL_FRAG_PARS}
float stageBlur() {
  return clamp(uCoc.x * abs(1.0 / max(vStageAux.y, 1.0) - uCoc.y) / 8.0, 0.0, 1.0);
}
vec4 stageDiag(vec3 albedo, vec3 n, float veil, float c, float texels) {
  if (uDiag == ${viewCode('ids')}) return vec4(uPart.rgb, 1.0);
  if (uDiag == ${viewCode('standins')}) return vec4(uPart.rgb * uPart.a, 1.0);
  if (uDiag == ${viewCode('albedo')}) return vec4(albedo, 1.0);
  if (uDiag == ${viewCode('normals')}) return vec4(n * 0.5 + 0.5, 1.0);
  if (uDiag == ${viewCode('depth')}) {
    float q = floor(clamp(vStageAux.z / ${DEPTH_RANGE_MM}.0, 0.0, 1.0) * 65535.0);
    float hi = floor(q / 256.0);
    return vec4(hi / 255.0, (q - hi * 256.0) / 255.0, uFlags.z, 1.0);
  }
  if (uDiag == ${viewCode('texels')}) return vec4(clamp(texels / 4.0, 0.0, 1.0), stageBlur(), uFlags.y > 0.0 ? 1.0 : 0.0, 1.0);
  if (uDiag == ${viewCode('cover')}) return uFlags.x > 0.5 ? vec4(veil, 0.0, 1.0, 1.0) : vec4(0.0);
  if (uDiag == ${viewCode('change')}) return vec4(c, 0.0, 0.0, 1.0);
  return vec4(0.0, 0.0, 0.0, 1.0);
}
`

const FRAG_HEAD = `
float stageC = stageChange();
if (stageGone(stageC)) discard;
#ifdef STAGE_INSIDE
if (stageOutside()) discard;
#endif
`

const FRAG_LIGHT = LIGHT_FRAG

const FRAG_TAIL = `
${VEIL_FRAG}
if (uDiag != 0) {
  float stageTexels = 0.0;
  #ifdef USE_MAP
  vec2 stageUv = vMapUv * uFlags.y;
  stageTexels = max(length(dFdx(stageUv)), length(dFdy(stageUv)));
  #endif
  gl_FragColor = stageDiag(diffuseColor.rgb, inverseTransformDirection(normal, viewMatrix), stageFog, stageC, stageTexels);
}
`

export interface LitSpec extends PartSpec {
  color?: THREE.ColorRepresentation
  vertexColors?: boolean
  roughness?: number
  metalness?: number
  emissive?: Rgb
  map?: THREE.Texture
  side?: THREE.Side
  physical?: boolean
  extra?: THREE.MeshPhysicalMaterialParameters
  hook?: (shader: THREE.WebGLProgramParametersWithUniforms) => void
  key?: string
}

export function stageMaterial(spec: LitSpec): THREE.MeshStandardMaterial {
  const handle = makeHandle({ ...spec, texels: spec.map ? Math.max((spec.map.image as { width: number }).width, (spec.map.image as { height: number }).height) : 0, textured: !!spec.map && spec.textured !== false })
  const given = {
    color: spec.color ?? 0xffffff,
    vertexColors: !!spec.vertexColors,
    roughness: spec.roughness ?? 0.8,
    metalness: spec.metalness ?? 0,
    map: spec.map ?? null,
    side: spec.side ?? THREE.FrontSide,
    ...spec.extra,
  }
  const m = spec.physical ? new THREE.MeshPhysicalMaterial(given) : new THREE.MeshStandardMaterial(given)
  if (spec.emissive) m.emissive.setRGB(spec.emissive[0], spec.emissive[1], spec.emissive[2])
  m.userData.stage = handle
  if (spec.inside) m.defines = { ...m.defines, STAGE_INSIDE: 1 }
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, stageUniforms, { uPart: handle.uPart, uState: handle.uState, uFlags: handle.uFlags })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${STAGE_VERT_PARS}`)
      .replace('#include <project_vertex>', `#include <project_vertex>\n${STAGE_VERT_MAIN}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${STAGE_FRAG_PARS}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\n${FRAG_HEAD}`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>\n${FRAG_LIGHT}`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${FRAG_TAIL}`)
    spec.hook?.(shader)
    if (spec.change === 'base') pourOnBase(shader)
  }
  const key = spec.key ?? (spec.hook ? spec.part : '')
  m.customProgramCacheKey = () => `stage:${spec.inside ? 'in' : 'out'}:${key}`
  return m
}

export interface ShaderSpec extends PartSpec {
  vertexPars?: string
  vertexMain?: string
  fragment: string
  uniforms?: Record<string, THREE.IUniform>
  params?: THREE.ShaderMaterialParameters
}

export function stageShader(spec: ShaderSpec): THREE.ShaderMaterial {
  const handle = makeHandle(spec)
  const m = new THREE.ShaderMaterial({
    ...spec.params,
    uniforms: { ...stageUniforms, uPart: handle.uPart, uState: handle.uState, uFlags: handle.uFlags, ...spec.uniforms },
    defines: spec.inside ? { STAGE_INSIDE: 1 } : {},
    vertexShader: `#include <common>
${STAGE_VERT_PARS}
${spec.vertexPars ?? ''}
void main() {
  vec3 transformed = position;
  vec4 mvPosition = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
  #endif
  mvPosition = modelViewMatrix * mvPosition;
  gl_Position = projectionMatrix * mvPosition;
  ${STAGE_VERT_MAIN}
  ${spec.vertexMain ?? ''}
}`,
    fragmentShader: `#include <common>
${STAGE_FRAG_PARS}
${spec.fragment}`,
  })
  m.userData.stage = handle
  return m
}
