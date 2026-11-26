import { describe, expect, it } from 'vitest'
import { config } from '../src/config'
import { readParams } from '../src/core/params'

// What a visitor types into the address must never stop the globe: a value the config does not name falls back.
describe('the address of the page', () => {
  it('reads the defaults from an empty address', () => {
    const p = readParams('')
    expect(p.mode).toBe('live')
    expect(p.format).toBe(config.formats.hd.id)
    expect(p.assets).toBe('web')
    expect(p.season).toBe(config.defaultSeason)
  })

  it('takes only an asset set the config holds itself, never a name every object has', () => {
    for (const hostile of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf', 'nothing-like-it']) {
      expect(readParams(`?assets=${hostile}`).assets).toBe('web')
    }
    for (const id of Object.keys(config.assetSets)) expect(readParams(`?assets=${id}`).assets).toBe(id)
  })

  it('falls back to hd for a format it does not know, in every mode a visitor can open', () => {
    for (const mode of ['live', 'autopilot', 'loop', 'probe']) {
      expect(readParams(`?mode=${mode}&format=constructor`).format).toBe(config.formats.hd.id)
      expect(readParams(`?mode=${mode}&format=`).format).toBe(config.formats.hd.id)
    }
    for (const f of Object.values(config.formats)) expect(readParams(`?format=${f.id}`).format).toBe(f.id)
  })

  it('still stops a capture that asks for a format the config does not name', () => {
    expect(() => readParams('?mode=capture&format=no-such-format')).toThrow(/no such format/)
  })

  it('falls back to the default season and to live for values it does not know', () => {
    expect(readParams('?season=constructor').season).toBe(config.defaultSeason)
    expect(readParams('?mode=constructor').mode).toBe('live')
  })
})
