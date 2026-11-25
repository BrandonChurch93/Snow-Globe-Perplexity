import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { scriptPlan } from '../src/app/replay'
import { APP_SCRIPTS, appLabelKind, appLegend, namesSeason, plainSeasonsLegend, appMarks, appParts, appSpacing } from '../tools/lib/appsheets.mjs'

const per = config.critics.contactSheetFrames
const sheetsOf = (name: string): number => {
  const p = appParts(scriptPlan(name), per)
  return p.all.filter((x) => p.usual.includes(x.id)).reduce((n, x) => n + Math.ceil(x.frames.length / per), 0)
}

describe('the sheets of the app scripts', () => {
  it('holds every part inside its script, in rising order, with no frame twice', () => {
    for (const name of APP_SCRIPTS) {
      const plan = scriptPlan(name)
      const parts = appParts(plan, per)
      expect(parts.all.map((x) => x.id)).toContain('whole')
      for (const id of parts.usual) expect(parts.all.some((x) => x.id === id)).toBe(true)
      for (const part of parts.all) {
        expect(part.frames.length).toBeGreaterThan(0)
        part.frames.forEach((f, k) => {
          expect(Number.isInteger(f) && f >= 0 && f < plan.frameCount).toBe(true)
          if (k) expect(f).toBeGreaterThan(part.frames[k - 1]!)
        })
        expect(appSpacing(part, plan.fps)).toMatch(/frames? /)
      }
    }
  })

  it('gives all four scripts in one message of a critic', () => {
    expect(APP_SCRIPTS.reduce((n, name) => n + sheetsOf(name), 0)).toBeLessThanOrEqual(config.critics.maxFilesPerMessage)
  })

  it('shows a shake and a jump from the press to a second after the landing with no gap', () => {
    for (const name of ['shake', 'jump']) {
      const plan = scriptPlan(name)
      const [press, landing] = plan.events.map((e) => e.frame) as [number, number]
      const parts = appParts(plan, per)
      const bar = parts.all.find((x) => x.id === 'bar')!
      const land = parts.all.find((x) => x.id === 'landing')!
      expect(bar.frames[0]).toBe(press)
      expect(bar.frames.at(-1)! + bar.stride).toBeGreaterThanOrEqual(landing)
      expect(bar.frames.at(-1)!).toBeLessThan(landing)
      expect(land.frames[0]).toBe(landing)
      expect(land.frames.at(-1)! + land.stride).toBeGreaterThanOrEqual(landing + plan.fps)
      const strokeFrames = ((landing - press) * config.shake.strokeBeats) / config.film.beatsPerBar / config.shake.strokes
      expect(strokeFrames / bar.stride).toBeGreaterThanOrEqual(2)
      const whole = parts.all.find((x) => x.id === 'whole')!
      expect(whole.frames[0]).toBe(0)
      expect(whole.frames.at(-1)).toBe(plan.frameCount - 1)
    }
  })

  it('starts the stir and the drag where the pointer goes down and ends on the last frame', () => {
    for (const name of ['stir', 'drag']) {
      const plan = scriptPlan(name)
      const turn = appParts(plan, per).all.find((x) => x.id === 'turn')!
      expect(turn.frames[0]).toBe(plan.events[0]!.frame)
      expect(turn.frames.at(-1)).toBe(plan.frameCount - 1)
      expect(turn.frames.length).toBe(per)
    }
    const stir = appParts(scriptPlan('stir'), per).all.find((x) => x.id === 'turn')!
    const gaps = stir.frames.slice(1).map((f, k) => f - stir.frames[k]!)
    gaps.forEach((g, k) => {
      if (k) expect(g).toBeGreaterThanOrEqual(gaps[k - 1]! - 1)
    })
  })

  it('writes a legend that names every event of the plan with its frame', () => {
    for (const name of APP_SCRIPTS) {
      const plan = scriptPlan(name)
      const marks = appMarks(plan, config.shake, config.film.beatsPerBar)
      marks.forEach((m: { frame: number }, k: number) => {
        if (k) expect(m.frame).toBeGreaterThanOrEqual(marks[k - 1]!.frame)
      })
      const part = appParts(plan, per).all[0]!
      const legend = appLegend({ what: part.what, sheet: 1, sheets: 1, label: '', frames: part.frames, spacing: appSpacing(part, plan.fps), plan, marks })
      for (const e of plan.events) expect(legend).toContain(`frame ${e.frame} (${(e.frame / plan.fps).toFixed(2)} s) ${e.what}`)
      expect(legend).not.toMatch(/[\u2014\u0021]/)
    }
  })

  it('names no season on a plain sheet and leaves the labelled sheet as it was', () => {
    const seasons = [...config.seasons] as string[]
    for (const name of APP_SCRIPTS) {
      const plan = scriptPlan(name)
      const marks = appMarks(plan, config.shake, config.film.beatsPerBar)
      const part = appParts(plan, per).all[0]!
      const spec = { what: part.what, sheet: 1, sheets: 1, frames: part.frames, spacing: appSpacing(part, plan.fps), plan, marks }
      const plain = appLegend({ ...spec, plain: true, label: appLabelKind(name, true) }, seasons)
      expect(namesSeason(plain, seasons)).toBe('')
      expect(plain).toContain(`frames ${part.frames[0]} to ${part.frames.at(-1)} of the script's ${plan.frameCount}`)
      expect(appLabelKind(name, true)).not.toBe('season')
      const labelled = appLegend({ ...spec, label: appLabelKind(name) }, seasons)
      expect(labelled).toBe(appLegend({ ...spec, label: appLabelKind(name) }))
      expect(namesSeason(labelled, seasons)).not.toBe('')
      for (const e of plan.events) expect(labelled).toContain(e.what)
    }
    expect(appLabelKind('shake')).toBe('season')
    expect(appLabelKind('jump')).toBe('season')
    expect(appLabelKind('drag', true)).toBe('yaw')
    const shake = scriptPlan('shake')
    const whole = appParts(shake, per).all[0]!
    const said = appLegend({ what: whole.what, sheet: 1, sheets: 1, label: 'season', frames: whole.frames, spacing: appSpacing(whole, shake.fps), plan: shake, marks: [] })
    expect(said.startsWith(`a shake from ${shake.from} to ${shake.to} in the app, across the whole script: frames 0 to ${shake.frameCount - 1}`)).toBe(true)
    expect(said).toContain('the season the app holds, written as the old season to the new one from the press to the landing')
    expect(namesSeason(plainSeasonsLegend(seasons.length), seasons)).toBe('')
    expect(() => appLegend({ what: `across ${seasons[0]}`, plain: true, sheet: 1, sheets: 1, label: '', frames: [0, 1], spacing: '', plan: shake, marks: [] }, seasons)).toThrow()
  })
})
