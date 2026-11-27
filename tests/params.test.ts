import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { config, shots } from '../src/config'
import { copy } from '../src/copy'
import { Assets } from '../src/core/assets'
import { readParams } from '../src/core/params'
import { VIEWS } from '../src/diagnostics/views'
import { filmCut } from '../src/film/cut'

const CARRIED = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']

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

  // A capture page draws for a tool, and a tool never gets a format it did not name. Where the address names none of the
  // config's the page is the live page at hd: a visitor has the globe, and a tool finds no capture interface to draw with.
  it('opens the live page, not a dead one, for a capture address whose format the config does not name', () => {
    for (const format of [...CARRIED, 'no-such-format', '']) {
      const p = readParams(`?mode=capture&format=${format}`)
      expect(p.mode, format).toBe('live')
      expect(p.format, format).toBe(config.formats.hd.id)
      expect(p.assets, format).toBe('web')
    }
    for (const f of Object.values(config.formats)) {
      const p = readParams(`?mode=capture&format=${f.id}`)
      expect(p.mode).toBe('capture')
      expect(p.format).toBe(f.id)
      expect(p.assets).toBe('full')
    }
    expect(readParams('?mode=capture').mode).toBe('capture')
    expect(readParams('?mode=capture').format).toBe(config.formats.hd.id)
  })

  // The page lays its first still before the app runs, from the address alone (index.html): it reads a capture address as
  // the app does, so the live page a capture address fell back to has its still like the plain address.
  it('lays the first still for a capture address that is the live page, and for no capture page', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(readFileSync(new URL('../index.html', import.meta.url), 'utf8'))?.[1] ?? ''
    const named = /asked\.has\('format'\) && (\[[^\]]*\])\.indexOf\(asked\.get\('format'\)\) < 0/.exec(script)?.[1] ?? '[]'
    expect(JSON.parse(named.replaceAll("'", '"'))).toEqual(Object.values(config.formats).map((f) => f.id))
    const reached = new Error('the page went on to lay a picture')
    const lays = (search: string): boolean => {
      const win = { innerWidth: 600, innerHeight: 600, addEventListener: () => undefined }
      const doc = {
        getElementById: (id: string) => (id === 'first' ? { clientWidth: 600, clientHeight: 600 } : null),
        createElement: () => {
          throw reached
        },
      }
      try {
        new Function('window', 'document', 'location', script)(win, doc, { search })
      } catch (e) {
        if (e !== reached) throw e
      }
      return 'firstStill' in win
    }
    expect(lays('')).toBe(true)
    for (const format of [...CARRIED, 'no-such-format', '']) {
      expect(readParams(`?mode=capture&format=${format}`).mode, format).toBe('live')
      expect(lays(`?mode=capture&format=${format}`), format).toBe(true)
      expect(lays(`?format=${format}&mode=capture`), format).toBe(true)
    }
    for (const f of Object.values(config.formats)) {
      expect(lays(`?mode=capture&format=${f.id}`), f.id).toBe(false)
      expect(lays(`?format=${f.id}`), f.id).toBe(true)
    }
    expect(lays('?mode=capture')).toBe(false)
    for (const mode of ['autopilot', 'loop']) for (const format of ['', 'no-such-format', 'hd']) expect(lays(`?mode=${mode}&format=${format}`), `${mode} ${format}`).toBe(false)
    // An address may say a thing twice: the app and the page both take the first.
    expect(readParams('?mode=capture&format=no-such-format&format=hd').mode).toBe('live')
    expect(lays('?mode=capture&format=no-such-format&format=hd')).toBe(true)
    expect(readParams('?mode=capture&format=hd&format=no-such-format').mode).toBe('capture')
    expect(lays('?mode=capture&format=hd&format=no-such-format')).toBe(false)
  })

  it('hands out the capture interface only on a page whose address still reads as a capture', () => {
    const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').split('\n')
    expect(main).toContain("const capture = params.mode === 'capture'")
    const given = main.flatMap((l, i) => (/window\.showcase\s*=[^=]/.test(l) ? [i] : []))
    expect(given).toHaveLength(1)
    const from = main.indexOf('if (capture) {')
    const to = main.indexOf('} else {', from)
    expect(from).toBeGreaterThan(0)
    expect(given[0]).toBeGreaterThan(from)
    expect(given[0]).toBeLessThan(to)
  })

  it('stops for nothing a visitor can type', () => {
    const words = [...CARRIED, 'no-such-thing', '', '%00', '-1', '1e999', 'NaN', '[object Object]', 'a,b,,c']
    for (const key of ['mode', 'season', 'format', 'tier', 'assets', 'quality', 'frame', 'first', 'last', 'shot', 'diag', 'which', 'noext', 'simcache', 'detail', 'sim', 'camera']) {
      for (const word of words) {
        expect(() => readParams(`?${key}=${word}`), `${key}=${word}`).not.toThrow()
        expect(() => readParams(`?mode=capture&${key}=${word}`), `capture, ${key}=${word}`).not.toThrow()
      }
    }
  })

  // An unknown shot would start the whole film with no sound, and an unknown view would flatten the picture.
  it('takes a shot only if the film has it and a view only if the app has it', () => {
    for (const word of [...CARRIED, 'no-such-name', 'OPEN', ' open', 'ids ']) {
      expect(readParams(`?mode=autopilot&shot=${word}`).shot, word).toBe('')
      expect(readParams(`?diag=${word}`).diag, word).toBe('')
      expect(readParams(`?mode=capture&diag=${word}`).diag, word).toBe('')
    }
    for (const s of shots) expect(readParams(`?mode=autopilot&shot=${s.id}`).shot).toBe(s.id)
    for (const v of VIEWS) expect(readParams(`?diag=${v}`).diag).toBe(v)
    expect(readParams(`?diag=${copy.menu.none}`).diag).toBe('none')
    expect(readParams('').shot).toBe('')
    expect(readParams('').diag).toBe('')
  })

  it('knows the shots the film player can start from and the views the menu offers', () => {
    expect(filmCut().spans.map((s) => s.shot.id)).toEqual(shots.map((s) => s.id))
    expect(copy.menu.views).toEqual([...VIEWS])
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
