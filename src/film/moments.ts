import type { Moment } from '../core/stage'
import { loopBeat, loopGlobe, loopSeconds, loopSinceLanding, wrapLoop } from './loop'
import { eventAt, globePoseAt, lastLandingBefore, seasonAt, type Timeline } from './timeline'

export function timelineMoment(tl: Timeline, t: number, mix: number, seed: number): Moment {
  const hit = eventAt(tl, t)
  return { ...seasonAt(tl, t), sinceLanding: t - lastLandingBefore(tl, t), globe: globePoseAt(tl, t), mix, seed, time: t, beat: hit ? hit.beat : null, period: null }
}

export function loopMoment(season: string, t: number, seed: number): Moment {
  return { season, from: season, to: season, change: 0, sinceLanding: loopSinceLanding(t), globe: loopGlobe(t), mix: 1, seed, time: wrapLoop(t), beat: loopBeat(t), period: loopSeconds }
}
