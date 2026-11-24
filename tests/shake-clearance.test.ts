import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { poseOfRig, reachOf, rigOf } from '../src/film/moves'
import { FRAME, livePath } from '../src/app/framing'
import { REST_POSE, makeShake, rimGapMm, shakeMotion, tiltSine, type GlobePose } from '../src/shake/table'

/** Decision 45. The glass keeps this share of the frame's height under the top edge, from `hero` at 16:9. */
const TOP_ROOM = 0.045
/** Decision 45. The lowest point of the foot's rim stays this far above the surface from the end of the lift to the start of the set down. */
const RIM_ROOM_MM = 1
/** The felt under the foot: how far the model lets the rim sink while the foot rolls on the surface. */
const PAD_MM = 0.05

const s = config.shake
const BEAT_S = 60 / config.film.defaultBpm
const FRAME_BEATS = 1 / config.film.fps / BEAT_S
const DEG = 180 / Math.PI
const HALF = config.globe.baseDiameterMm / 2

const film = config.film.shots.filter((shot) => shot.kind === 'shake').map((shot) => shot.id)
const NAMES = ['test', ...config.seasons.map((season) => `test:${season}`), 'preroll', ...film, 'loop', ...Array.from({ length: FRAME.shakePaths }, (_, i) => `live-${i}`)]

const hero = poseOfRig(rigOf('hero'))
const roomOf = (g: GlobePose): number => (1 - reachOf(hero, g).top) / 2

/** The lowest point of the foot's rim, turned and placed as the stage and `reachOf` turn and place the globe. */
function rimLow(g: GlobePose): number {
  const sz = Math.sin(g.tiltZ)
  const cx = Math.cos(g.tiltX)
  const sx = Math.sin(g.tiltX)
  let low = Infinity
  for (let i = 0; i < 720; i++) {
    const a = (i / 720) * Math.PI * 2
    const x = Math.cos(a) * HALF
    const z = Math.sin(a) * HALF
    low = Math.min(low, x * sz * cx - z * sx + g.y)
  }
  return low
}

describe('the shake keeps its room', () => {
  it('covers every path the film, the loop, the test shake and the app use', () => {
    expect(film).toEqual(['shake-1', 'shake-2', 'shake-3', 'shake-4'])
    expect(new Set(NAMES).size).toBe(NAMES.length)
    expect(config.formats.hd.width / config.formats.hd.height).toBeCloseTo(16 / 9, 9)
    for (let n = 0; n < FRAME.shakePaths; n++) expect(livePath(n)).toBe(makeShake(`live-${n}`))
    expect(roomOf(REST_POSE)).toBeGreaterThan(TOP_ROOM)
  })

  it(`keeps ${TOP_ROOM * 100} percent of the frame under the top edge on every frame, at any phase of the frame clock`, () => {
    for (const name of NAMES) {
      const path = makeShake(name)
      const end = shakeMotion(name).endBeat
      let worst = { room: 1, beat: 0 }
      for (let b = 0; b <= end + FRAME_BEATS; b += FRAME_BEATS / 8) {
        const room = roomOf(path.poseAt(b))
        if (room < worst.room) worst = { room, beat: b }
      }
      expect(worst.room, `${name} at beat ${worst.beat.toFixed(3)}`).toBeGreaterThanOrEqual(TOP_ROOM)
      expect(worst.room, `${name} wastes its room`).toBeLessThan(TOP_ROOM + 0.004)
    }
  })

  it(`holds the rim ${RIM_ROOM_MM} mm clear of the surface from the top of the lift to the start of the set down`, () => {
    for (const name of NAMES) {
      const path = makeShake(name)
      const m = shakeMotion(name)
      let low = Infinity
      for (let b = path.parts.liftEnd; b <= path.parts.strokesEnd + 1e-9; b += 1 / m.knotsPerBeat / 2) {
        const g = path.poseAt(Math.min(b, path.parts.strokesEnd))
        const gap = rimLow(g)
        expect(Math.abs(gap - rimGapMm(g))).toBeLessThan(1e-4)
        low = Math.min(low, gap)
      }
      expect(low, name).toBeGreaterThanOrEqual(RIM_ROOM_MM)
      expect(low, `${name} wastes its tilt`).toBeLessThan(RIM_ROOM_MM + 0.25)
    }
  })

  it('never puts the rim under the surface, and clears it once: up in the lift, down in the set down', () => {
    for (const name of NAMES) {
      const path = makeShake(name)
      const m = shakeMotion(name)
      let spans = 0
      let clear = false
      let first = 0
      let last = 0
      for (let b = 0; b <= m.endBeat + 0.01; b += 0.0005) {
        const gap = rimGapMm(path.poseAt(b))
        expect(gap, `${name} at beat ${b.toFixed(4)}`).toBeGreaterThan(-PAD_MM)
        const now = gap >= RIM_ROOM_MM
        if (now && !clear) {
          spans++
          first = b
        }
        if (now) last = b
        clear = now
      }
      expect(spans, name).toBe(1)
      expect(first).toBeLessThan(path.parts.liftEnd)
      expect(first).toBeGreaterThan(m.plan.liftOff)
      expect(last).toBeGreaterThan(path.parts.strokesEnd)
      expect(last).toBeLessThan(path.parts.landing)
    }
  })

  it('never lifts the foot above the lift, never tilts past the config, and leans the top away from the lens while it is held', () => {
    for (const name of NAMES) {
      const path = makeShake(name)
      const m = shakeMotion(name)
      for (let b = 0; b <= m.endBeat; b += 0.0005) {
        const g = path.poseAt(b)
        expect(g.y, `${name} at ${b}`).toBeLessThanOrEqual(s.liftMm + 1e-9)
        expect(Math.asin(Math.min(1, tiltSine(g.tiltX, g.tiltZ))) * DEG, `${name} at ${b}`).toBeLessThanOrEqual(s.tiltDeg + 1e-9)
        if (b >= path.parts.liftEnd && b <= path.parts.strokesEnd) {
          expect(g.tiltX, `${name} at ${b}`).toBeLessThan(0)
          expect(g.z, `${name} at ${b}`).toBeLessThan(0)
        }
      }
    }
  })
})
