import { config } from '../config'
import type { Moment } from '../core/stage'
import { loopBeat, loopGlobe, loopSeconds, loopSinceLanding, wrapLoop } from './loop'
import { eventAt, globePoseAt, lastLandingBefore, seasonAt, type Timeline } from './timeline'

// The same edge `seasonAt` reads the end of the swap window with: `left` begins on the frame where the season that comes stands alone.
const EDGE = 1e-7

export function timelineMoment(tl: Timeline, t: number, mix: number, seed: number): Moment {
  const hit = eventAt(tl, t)
  const left = hit === null || hit.event.from === hit.event.to || hit.beat < config.shake.swapWindow.toBeat - EDGE ? null : hit.event.from
  return { ...seasonAt(tl, t), sinceLanding: t - lastLandingBefore(tl, t), globe: globePoseAt(tl, t), mix, seed, time: t, beat: hit ? hit.beat : null, period: null, left }
}

export function loopMoment(season: string, t: number, seed: number): Moment {
  return { season, from: season, to: season, change: 0, sinceLanding: loopSinceLanding(t), globe: loopGlobe(t), mix: 1, seed, time: wrapLoop(t), beat: loopBeat(t), period: loopSeconds, left: null }
}
