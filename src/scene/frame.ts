import * as THREE from 'three'
import type { Rgb } from '../core/materials'
import type { Sample } from '../core/sampler'
import type { Moment, StageQuality } from '../core/stage'
import type { SeasonKit } from '../seasons/kit'
import type { GlobePose } from '../shake/table'
import type { Pose } from './cameras'

export interface StageFrame {
  width: number
  height: number
  pose: Pose
  sample: Sample | null
  live: boolean
  view: string
  lensOn: boolean
  moment: Moment
  time: number
  period: number
  clock: number
  arrived: number
  from: SeasonKit
  to: SeasonKit
  /** The season a change has just left, while the cover of that change dies away over the season that came (core/stage.ts, `Moment.left`); null everywhere else. The lamps of the backdrop come up from it (backdrop.ts), the room's light inside the glass comes up from the level of the dimmer of the two (lighting.ts, `rigInside`) and the last of its veil goes over it (`withVeilLeft`). */
  left: SeasonKit | null
  change: number
  /** How far each thing has crossed. `bloom` is the cover of a change, an exponent, and `shown` how far the picture has gone under it (change.ts, `changeBloom`, `changeShown`). */
  mix: { light: number; veil: number; base: number; particles: number; bloom: number; shown: number }
  grids: [THREE.Data3DTexture | null, THREE.Data3DTexture | null]
  keyDir: THREE.Vector3
  keyCol: THREE.Color
  rimDir: THREE.Vector3
  rimCol: THREE.Color
  sky: THREE.Color
  ground: THREE.Color
  fill: number
  ambient: THREE.Color
  pool: THREE.Color
  /** `pool` as winter's frost on the table takes it: the same but for the pour of a change, of which what lies on the table takes less (lighting.ts, `CHANGE_BLOOM.pourOn`; the petals and the leaves take theirs through the glow of the light chunk). */
  poolOn: THREE.Color
  /** The share of `poolOn` that is the pour of a change: what lies on the table takes it close round the foot, as the table does (surface.ts, `slabPourShare`). */
  pourOn: THREE.Color
  /** `pool` as the mirror image of the glass takes it where the slab bakes that image (surface.ts, the level `low`): the same but under the cover of a change, where it is the lights inside at rest held through the fallen exposure, with a share of the pour on top and not drawn in under the flash (lighting.ts, `CHANGE_BLOOM.image`). */
  image: THREE.Color
  bloomTint: THREE.Color
  /** How many times over the lamps of the backdrop are drawn: 1 but under the cover of a change, where they fall with the exposure and do not go out (lighting.ts, `CHANGE_BLOOM.lamps`). */
  lamps: number
  liquid: ArrayLike<number>
  turbulence: number
  globe: GlobePose
  globeUp: THREE.Vector3
  quality: StageQuality
  planar: boolean
  /** How much of the table's picture of the globe is the mirror: 1 the mirror alone, 0 the baked glow alone. */
  reflect: number
  focalPx: number
  blurMm: number
  /** False in the one still that leaves the air out (a measuring aid): a season that paints its still air on a surface leaves that out too. */
  air: boolean
  kinds: Record<string, { color: Rgb; glow: number }>
}

/**
 * Runs `lay` on the frame as the shared veil is laid from it. On the tail of a change the season that came stands alone
 * and the last of the veil of the season that left is still going (change.ts, `veilCrossed`; `mix.veil` is between 0 and 1
 * there): for `lay` the frame goes from the season that left to the one that came, as it did inside the window, and is
 * put back after it. Everywhere else the frame is laid as it stands.
 */
export function withVeilLeft(f: StageFrame, lay: (f: StageFrame) => void): void {
  const stands = f.from
  if (f.left && f.mix.veil > 0 && f.mix.veil < 1) f.from = f.left
  lay(f)
  f.from = stands
}

export function newFrame(kit: SeasonKit, quality: StageQuality): StageFrame {
  return {
    width: 1,
    height: 1,
    pose: null as unknown as Pose,
    sample: null,
    live: false,
    view: '',
    lensOn: true,
    moment: null as unknown as Moment,
    time: 0,
    period: 1,
    clock: 0,
    arrived: 1,
    from: kit,
    to: kit,
    left: null,
    change: 0,
    mix: { light: 0, veil: 0, base: 0, particles: 0, bloom: 0, shown: 0 },
    grids: [null, null],
    keyDir: new THREE.Vector3(0, 1, 0),
    keyCol: new THREE.Color(),
    rimDir: new THREE.Vector3(0, 1, 0),
    rimCol: new THREE.Color(),
    sky: new THREE.Color(),
    ground: new THREE.Color(),
    fill: 0,
    ambient: new THREE.Color(),
    pool: new THREE.Color(),
    poolOn: new THREE.Color(),
    pourOn: new THREE.Color(),
    image: new THREE.Color(),
    bloomTint: new THREE.Color(),
    lamps: 1,
    liquid: [0, 0, 0, 0, 0, 0, 0],
    turbulence: 0,
    globe: { x: 0, y: 0, z: 0, tiltX: 0, tiltZ: 0 },
    globeUp: new THREE.Vector3(0, 1, 0),
    quality,
    planar: true,
    reflect: 1,
    focalPx: 1,
    blurMm: 0,
    air: true,
    kinds: {},
  }
}
