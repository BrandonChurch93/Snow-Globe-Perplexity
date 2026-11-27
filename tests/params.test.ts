import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { config, shots } from '../src/config'
import { copy } from '../src/copy'
import { Assets } from '../src/core/assets'
import { readParams, TOOL_HOSTS } from '../src/core/params'
import { VIEWS } from '../src/diagnostics/views'
import { filmCut } from '../src/film/cut'

const CARRIED = ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']
/** Where the tools' own server answers (tools/lib/server.mjs). */
const HERE = '127.0.0.1'
/** Hosts that are not this machine: the published site, names that only look like this machine's, a page opened from a file. */
const ELSEWHERE = ['snow-globe-seasons.pplx.app', 'globe.test', 'localhost.globe.test', 'notlocalhost', '127.0.0.1.globe.test', '127.0.0.2', '0.0.0.0', '::1', '[::2]', '192.168.1.20', '', ...CARRIED]
const KNOWN = Object.values(config.formats).map((f) => f.id)

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
    for (const host of TOOL_HOSTS) {
      for (const format of [...CARRIED, 'no-such-format', '']) {
        const p = readParams(`?mode=capture&format=${format}`, host)
        expect(p.mode, format).toBe('live')
        expect(p.format, format).toBe(config.formats.hd.id)
        expect(p.assets, format).toBe('web')
      }
      for (const id of KNOWN) {
        const p = readParams(`?mode=capture&format=${id}`, host)
        expect(p.mode).toBe('capture')
        expect(p.format).toBe(id)
        expect(p.assets).toBe('full')
      }
      expect(readParams('?mode=capture', host).mode).toBe('capture')
      expect(readParams('?mode=capture', host).format).toBe(config.formats.hd.id)
    }
  })

  // A capture page shows a visitor nothing, and with `simcache=1` it reads and writes checkpoints on the machine that
  // serves it. The published site is a static host: it would show a dead page and refuse those requests. So a capture
  // address is a capture page only where a tool serves it, and anywhere else it reads as the same address without its mode.
  describe('a capture address on a host that is not this machine', () => {
    afterEach(() => vi.unstubAllGlobals())
    const REST = ['', '&simcache=1', '&assets=web', '&assets=web&simcache=1', '&assets=full&simcache=1', '&season=fall&quality=low', '&diag=standins&simcache=1', '&noext=a,b&which=a&frame=7&first=2&last=9&tier=final']

    it('is the live page, with the web set and no checkpoints, in every format', () => {
      expect([...TOOL_HOSTS].sort()).toEqual(['127.0.0.1', '[::1]', 'localhost'])
      for (const host of ELSEWHERE) {
        for (const format of [null, ...KNOWN, 'no-such-format']) {
          for (const rest of REST) {
            const said = `${format === null ? '' : `&format=${format}`}${rest}`
            const p = readParams(`?mode=capture${said}`, host)
            const why = `${host} ${said}`
            expect(p.mode, why).toBe('live')
            expect(p.simcache, why).toBe(false)
            if (!rest.includes('assets=full')) expect(p.assets, why).toBe('web')
            expect(p, why).toEqual(readParams(`?${said.slice(1)}`, host))
            expect(p, why).toEqual(readParams(`?${said.slice(1)}`, HERE))
          }
        }
      }
    })

    it('arms the checkpoints only on a capture page', () => {
      for (const host of [...TOOL_HOSTS, ...ELSEWHERE]) {
        for (const mode of ['live', 'autopilot', 'loop', 'probe', 'no-such-mode']) expect(readParams(`?mode=${mode}&simcache=1`, host).simcache, `${host} ${mode}`).toBe(false)
        expect(readParams('?simcache=1', host).simcache, host).toBe(false)
        expect(readParams('?mode=capture&simcache=1&format=no-such-format', host).simcache, host).toBe(false)
        expect(readParams('?mode=capture&simcache=1', host).simcache, host).toBe(TOOL_HOSTS.includes(host))
        expect(readParams('?mode=capture&simcache=0', host).simcache, host).toBe(false)
        expect(readParams('?mode=capture', host).simcache, host).toBe(false)
      }
    })

    // The host decides one thing, whether a capture address is a capture page. The addresses that are handed out name no
    // capture, so a host name must never change what they open.
    it('opens the plain page, the two films, the loop and the probe alike under every host name', () => {
      const HANDED: [string, string, string][] = [
        ['', 'live', 'b'],
        ['?mode=autopilot', 'autopilot', 'b'],
        ['?mode=autopilot&which=a', 'autopilot', 'a'],
        ['?mode=loop', 'loop', 'b'],
        ['?mode=probe', 'probe', 'b'],
      ]
      for (const [address, mode, which] of HANDED) {
        const here = readParams(address, HERE)
        expect([here.mode, here.which, here.assets, here.format, here.simcache], address).toEqual([mode, which, 'web', 'hd', false])
        for (const host of [...TOOL_HOSTS, ...ELSEWHERE]) expect(readParams(address, host), `${host} ${address}`).toEqual(here)
        for (const more of ['&quality=low', '&season=fall', '&simcache=1', '&format=phone']) {
          const there = readParams(`${address || '?'}${more}`, HERE)
          expect(there.mode, `${address}${more}`).toBe(mode)
          for (const host of [...TOOL_HOSTS, ...ELSEWHERE]) expect(readParams(`${address || '?'}${more}`, host), `${host} ${address}${more}`).toEqual(there)
        }
      }
    })

    it('reads the host of the page itself where it is not told one, as the app asks it', () => {
      const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').split('\n')
      expect(main).toContain('const params = readParams(location.search)')
      expect(readParams('?mode=capture&simcache=1').mode).toBe('live')
      for (const hostname of ELSEWHERE) {
        vi.stubGlobal('location', { hostname, search: '' })
        const p = readParams('?mode=capture&simcache=1')
        expect([p.mode, p.assets, p.simcache], hostname).toEqual(['live', 'web', false])
      }
      for (const hostname of TOOL_HOSTS) {
        vi.stubGlobal('location', { hostname, search: '' })
        const p = readParams('?mode=capture&simcache=1')
        expect([p.mode, p.assets, p.simcache], hostname).toEqual(['capture', 'full', true])
      }
    })
  })

  // The page lays its first still before the app runs, from the address alone (index.html): it reads a capture address as
  // the app does, so the live page a capture address fell back to has its still like the plain address.
  it('lays the first still for a capture address that is the live page, and for no capture page', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(readFileSync(new URL('../index.html', import.meta.url), 'utf8'))?.[1] ?? ''
    const named = /asked\.has\('format'\) && (\[[^\]]*\])\.indexOf\(asked\.get\('format'\)\) < 0/.exec(script)?.[1] ?? '[]'
    expect(JSON.parse(named.replaceAll("'", '"'))).toEqual(KNOWN)
    const served = /mode === 'capture' && \((\[.*?\])\.indexOf\(location\.hostname\) < 0/.exec(script)?.[1] ?? '[]'
    expect(JSON.parse(served.replaceAll("'", '"'))).toEqual([...TOOL_HOSTS])
    const reached = new Error('the page went on to lay a picture')
    const run = new Function('window', 'document', 'location', script)
    const lays = (search: string, hostname: string = HERE): boolean => {
      const win = { innerWidth: 600, innerHeight: 600, addEventListener: () => undefined }
      const doc = {
        getElementById: (id: string) => (id === 'first' ? { clientWidth: 600, clientHeight: 600 } : null),
        createElement: () => {
          throw reached
        },
      }
      try {
        run(win, doc, { search, hostname })
      } catch (e) {
        if (e !== reached) throw e
      }
      return 'firstStill' in win
    }
    const LAID: string[] = ['live', 'probe']
    expect(lays('')).toBe(true)
    for (const format of [...CARRIED, 'no-such-format', '']) {
      expect(readParams(`?mode=capture&format=${format}`, HERE).mode, format).toBe('live')
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
    expect(readParams('?mode=capture&format=no-such-format&format=hd', HERE).mode).toBe('live')
    expect(lays('?mode=capture&format=no-such-format&format=hd')).toBe(true)
    expect(readParams('?mode=capture&format=hd&format=no-such-format', HERE).mode).toBe('capture')
    expect(lays('?mode=capture&format=hd&format=no-such-format')).toBe(false)
    // On a host that is not this machine every capture address is the live page, and the page lays its still as for the plain address.
    for (const host of ELSEWHERE) {
      for (const said of ['?mode=capture', '?mode=capture&simcache=1', '?simcache=1&mode=capture&assets=web', ...KNOWN.map((id) => `?mode=capture&format=${id}`), '?mode=capture&format=no-such-format', '?mode=capture&mode=live']) {
        expect(readParams(said, host).mode, `${host} ${said}`).toBe('live')
        expect(lays(said, host), `${host} ${said}`).toBe(true)
      }
      for (const mode of ['autopilot', 'loop']) expect(lays(`?mode=${mode}`, host), `${host} ${mode}`).toBe(false)
    }
    // The page and the app read every address alike, on every host: a still is laid where the app is the live page, and nowhere else.
    for (const host of [...TOOL_HOSTS, ...ELSEWHERE]) {
      for (const mode of [null, 'live', 'autopilot', 'loop', 'capture', 'probe', 'no-such-mode', '']) {
        for (const format of [null, ...KNOWN, 'no-such-format', '']) {
          for (const more of ['', '&simcache=1', '&mode=capture', '&mode=live', '&format=hd']) {
            const said = `?${[mode === null ? '' : `mode=${mode}`, format === null ? '' : `format=${format}`].filter(Boolean).join('&')}${more}`
            expect(lays(said, host), `${host} ${said}`).toBe(LAID.includes(readParams(said, host).mode))
          }
        }
      }
    }
  })

  it('hands out the capture interface, and the store of checkpoints, only on a page whose address still reads as a capture', () => {
    const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8').split('\n')
    expect(main).toContain("const capture = params.mode === 'capture'")
    const from = main.indexOf('if (capture) {')
    const to = main.indexOf('} else {', from)
    expect(from).toBeGreaterThan(0)
    for (const made of [/window\.showcase\s*=[^=]/, /httpStore\(/, /new SimDriver\(/]) {
      const given = main.flatMap((l, i) => (made.test(l) && !l.startsWith('import ') ? [i] : []))
      expect(given, String(made)).toHaveLength(1)
      expect(given[0], String(made)).toBeGreaterThan(from)
      expect(given[0], String(made)).toBeLessThan(to)
    }
    expect(main.filter((l) => l.includes('httpStore('))).toEqual([expect.stringContaining('params.simcache ? httpStore(')])
  })

  it('counts as this machine the host the tools serve from, and the visit opens a capture address under a name that is not one', () => {
    const server = readFileSync(new URL('../tools/lib/server.mjs', import.meta.url), 'utf8')
    const served = /const url = `http:\/\/([^:`]+):\$\{server\.address\(\)\.port\}\/`/.exec(server)?.[1]
    expect(served).toBe(HERE)
    expect(TOOL_HOSTS).toContain(served)
    expect(readParams('?mode=capture&simcache=1', served).simcache).toBe(true)
    const visit = readFileSync(new URL('../tools/visit.mjs', import.meta.url), 'utf8')
    const hosts = /const onThisMachine = (\[.*?\])\.includes\(here\.hostname\)/.exec(visit)?.[1] ?? '[]'
    expect(JSON.parse(hosts.replaceAll("'", '"'))).toEqual([...TOOL_HOSTS])
    const other = /const ELSEWHERE = '([^']+)'/.exec(visit)?.[1] ?? ''
    expect(other).not.toBe('')
    expect(TOOL_HOSTS).not.toContain(other)
    expect(readParams('?mode=capture&simcache=1', other).mode).toBe('live')
  })

  it('stops for nothing a visitor can type', () => {
    const words = [...CARRIED, 'no-such-thing', '', '%00', '-1', '1e999', 'NaN', '[object Object]', 'a,b,,c']
    for (const key of ['mode', 'season', 'format', 'tier', 'assets', 'quality', 'frame', 'first', 'last', 'shot', 'diag', 'which', 'noext', 'simcache', 'detail', 'sim', 'camera']) {
      for (const word of words) {
        expect(() => readParams(`?${key}=${word}`), `${key}=${word}`).not.toThrow()
        expect(() => readParams(`?mode=capture&${key}=${word}`), `capture, ${key}=${word}`).not.toThrow()
        expect(() => readParams(`?mode=capture&${key}=${word}`, HERE), `capture here, ${key}=${word}`).not.toThrow()
        expect(() => readParams(`?mode=capture&${key}=${word}`, word), `capture on ${word}, ${key}=${word}`).not.toThrow()
      }
    }
  })

  // An unknown shot would start the whole film with no sound, and an unknown view would flatten the picture.
  it('takes a shot only if the film has it and a view only if the app has it', () => {
    for (const word of [...CARRIED, 'no-such-name', 'OPEN', ' open', 'ids ']) {
      expect(readParams(`?mode=autopilot&shot=${word}`).shot, word).toBe('')
      expect(readParams(`?diag=${word}`).diag, word).toBe('')
      expect(readParams(`?mode=capture&diag=${word}`, HERE).diag, word).toBe('')
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
      const p = readParams('?mode=capture', HERE)
      await assets.init(p.assets, p.mode !== 'capture')
      expect(assets.set).toBe('full')
      expect(asked).toEqual(['GET assets/index.json'])
    })

    it('asks the published site for nothing it does not hold when the address is a capture', async () => {
      for (const said of ['?mode=capture', '?mode=capture&simcache=1', '?mode=capture&format=phone&simcache=1']) {
        const asked = host(() => ({ ok: false, type: 'text/plain' }))
        const assets = new Assets()
        const p = readParams(said, 'globe.test')
        await assets.init(p.assets, p.mode !== 'capture')
        expect(assets.set, said).toBe('web')
        expect(asked, said).toEqual(['GET assets/index.json'])
      }
    })
  })
})
