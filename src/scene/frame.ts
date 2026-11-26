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
  change: number
  mix: { light: number; veil: number; base: number; particles: number; bloom: number }
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
  /** `pool` as the mirror image of the glass takes it where the slab bakes that image (surface.ts, the level `low`): the same but under the cover of a change, where it is the lights inside at rest held through the fallen exposure, with a share of the pour on top and not drawn in under the flash (lighting.ts, `CHANGE_BLOOM.image`). */
  image: THREE.Color
  bloomTint: THREE.Color
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
    change: 0,
    mix: { light: 0, veil: 0, base: 0, particles: 0, bloom: 0 },
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
    image: new THREE.Color(),
    bloomTint: new THREE.Color(),
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
