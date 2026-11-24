import { describe, expect, it } from 'vitest'
import raw from '../config/showcase.json'
import { configProblems } from '../src/configCheck'

type Any = Record<string, any>
const present = raw.keys.map((k) => k.image)
const copy = (): Any => JSON.parse(JSON.stringify(raw))
const problems = (change: (c: Any) => void, images: string[] = present) => {
  const c = copy()
  change(c)
  return configProblems(c, images)
}
const expectProblem = (change: (c: Any) => void, text: RegExp, images?: string[]) => {
  const out = problems(change, images)
  expect(out.length, 'a problem is reported').toBeGreaterThan(0)
  expect(out.join('\n')).toMatch(text)
}

describe('config validation', () => {
  it('accepts the config as it stands', () => {
    expect(configProblems(raw, present)).toEqual([])
  })

  it('fails when a key is missing', () => {
    expectProblem((c) => delete c.seed, /seed is missing/)
    expectProblem((c) => delete c.film.fps, /film\.fps is missing/)
    expectProblem((c) => delete c.shake.swapWindow, /shake\.swapWindow is missing/)
    expectProblem((c) => delete c.cameras.hero.fovDeg, /cameras\.hero\.fovDeg is missing/)
    expectProblem((c) => (c.keys = []), /keys is missing or is an empty list/)
    expectProblem((c) => (c.deliver.sandboxMaster = 'no'), /deliver\.sandboxMaster/)
    expectProblem((c) => delete c.particles.summer, /particles\.summer is missing/)
  })

  it('fails when every top level key is removed in turn', () => {
    for (const key of Object.keys(raw)) {
      const out = problems((c) => delete c[key])
      expect(out.length, key).toBeGreaterThan(0)
    }
  })

  it('fails when a shot names a season that does not exist', () => {
    expectProblem((c) => (c.film.shots[0].season = 'monsoon'), /shot open names a season that does not exist/)
    expectProblem((c) => (c.film.shots[1].to = 'monsoon'), /shot shake-1 names a season that does not exist/)
  })

  it('fails when a key or a still names a season or a camera that does not exist', () => {
    expectProblem((c) => (c.keys[0].season = 'monsoon'), /winter-rest names a season that does not exist/)
    expectProblem((c) => (c.keys[0].camera = 'crane'), /winter-rest names a camera that does not exist/)
    expectProblem((c) => (c.stills[0].season = 'monsoon'), /winter-interior names a season that does not exist/)
    expectProblem((c) => (c.stills[0].camera = 'crane'), /winter-interior names a camera that does not exist/)
    expectProblem((c) => (c.stills[0].format = 'imax'), /names a format that does not exist/)
    expectProblem((c) => (c.stills[0].state = 'frozen'), /names a state that does not exist/)
    expectProblem((c) => (c.stills[0].unit = 'nowhere'), /names a unit that does not exist/)
    expectProblem((c) => (c.deliver.cardLoop.camera = 'crane'), /cardLoop names a camera that does not exist/)
    expectProblem((c) => (c.defaultSeason = 'monsoon'), /defaultSeason names a season that does not exist/)
  })

  it('fails when the phase boxes do not add up to the run', () => {
    expectProblem((c) => (c.budget.phaseHours['3'] += 1), /budget\.phaseHours adds up to/)
    expectProblem((c) => (c.budget.runHours -= 0.5), /budget\.phaseHours adds up to/)
  })

  it('fails when the three parts of the shake do not fill a bar', () => {
    expectProblem((c) => (c.shake.strokeBeats = 3), /add up to 5, not to film\.beatsPerBar/)
    expectProblem((c) => (c.film.beatsPerBar = 3), /not to film\.beatsPerBar/)
  })

  it('fails when the swap window leaves the strokes', () => {
    expectProblem((c) => (c.shake.swapWindow.fromBeat = 0.5), /does not lie inside the strokes/)
    expectProblem((c) => (c.shake.swapWindow.toBeat = 3.5), /does not lie inside the strokes/)
    expectProblem((c) => (c.shake.swapWindow = { fromBeat: 2.5, toBeat: 2.5 }), /does not lie inside the strokes/)
  })

  it('fails when a shake does not join the holds around it', () => {
    expectProblem((c) => (c.film.shots[1].from = 'fall'), /which is not the season of the hold before it/)
    expectProblem((c) => (c.film.shots[1].to = 'fall'), /which is not the season of the hold after it/)
    expectProblem((c) => c.film.shots.splice(2, 1), /which is not the season of the hold after it/)
    expectProblem((c) => (c.film.shots[1].bars = 2), /is not one bar long/)
    expectProblem((c) => (c.film.shots[0].kind = 'pan'), /neither hold nor shake/)
  })

  it('fails when the frame rates do not divide', () => {
    expectProblem((c) => (c.film.previewFps = 25), /not a whole multiple of film\.previewFps/)
    expectProblem((c) => (c.deliver.cardLoop.fps = 24), /not a whole multiple of deliver\.cardLoop\.fps/)
  })

  it('fails when the card loop cannot hold a shake and its spin down', () => {
    expectProblem((c) => (c.deliver.cardLoop.seconds = 6), /which is not less than deliver\.cardLoop\.seconds/)
    expectProblem((c) => (c.deliver.cardLoop.shakeStartSeconds = 2.2), /which is not less than deliver\.cardLoop\.seconds/)
    expectProblem((c) => (c.shake.spinDownSeconds = 5), /which is not less than deliver\.cardLoop\.seconds/)
  })

  it('fails when an approved image is missing', () => {
    expectProblem(() => undefined, /the approved image of winter-rest is missing/, present.slice(1))
    expectProblem(() => undefined, /the approved image of fall-shake is missing/, present.slice(0, -1))
  })

  it('fails when two pictures share an id', () => {
    expectProblem((c) => (c.stills[1].id = c.stills[0].id), /two pictures share the id/)
  })
})
