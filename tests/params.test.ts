import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../src/config'
import { Assets } from '../src/core/assets'
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

  // The published site holds the web set alone. An address that names the full set must still open the globe.
  describe('a set the host does not hold', () => {
    afterEach(() => vi.unstubAllGlobals())
    const index = { version: 1, sets: { web: { shared: [{ path: 'shared/a.png', bytes: 1, sha: 'aa' }] }, full: { shared: [{ path: 'shared/a.png', bytes: 2, sha: 'bb' }] } }, seasonHashes: {} }
    const host = (answer: (address: string) => { ok: boolean; type: string }) => {
      const asked: string[] = []
      vi.stubGlobal('document', { baseURI: 'https://globe.test/' })
      vi.stubGlobal('fetch', async (url: URL, init?: { method?: string }) => {
        const address = String(url)
        asked.push(`${init?.method ?? 'GET'} ${address.replace('https://globe.test/', '')}`)
        if (address.endsWith('assets/index.json')) return { ok: true, status: 200, json: async () => index, headers: { get: () => 'application/json' } }
        const a = answer(address)
        return { ok: a.ok, status: a.ok ? 200 : 404, headers: { get: () => a.type } }
      })
      return asked
    }

    it('falls back to web for a visitor, whether the host says missing or answers with its own page', async () => {
      for (const answer of [() => ({ ok: false, type: 'text/plain' }), () => ({ ok: true, type: 'text/html; charset=utf-8' })]) {
        const asked = host(answer)
        const assets = new Assets()
        await assets.init(readParams('?assets=full').assets, true)
        expect(assets.set).toBe('web')
        expect(assets.address('shared/a.png')).toBe('assets/shared/a.png?v=aa')
        expect(asked).toEqual(['GET assets/index.json', 'HEAD assets-full/shared/a.png?v=bb'])
      }
    })

    it('keeps the set where the host holds it, and asks nothing more for the web set', async () => {
      const asked = host(() => ({ ok: true, type: 'image/png' }))
      const full = new Assets()
      await full.init('full', true)
      expect(full.set).toBe('full')
      const web = new Assets()
      await web.init(readParams('').assets, true)
      expect(web.set).toBe('web')
      expect(asked).toEqual(['GET assets/index.json', 'HEAD assets-full/shared/a.png?v=bb', 'GET assets/index.json'])
    })

    it('leaves a capture on the set its tool asked for, without asking the host', async () => {
      const asked = host(() => ({ ok: false, type: 'text/plain' }))
      const assets = new Assets()
      await assets.init(readParams('?mode=capture').assets)
      expect(assets.set).toBe('full')
      expect(asked).toEqual(['GET assets/index.json'])
    })
  })
})
