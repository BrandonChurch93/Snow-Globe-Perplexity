import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { config } from '../src/config'

/**
 * The page paints a still before the app has drawn anything (index.html, tools/poster.mjs). These tests run the page's own
 * script against the table and the files the tool wrote. They do not ask whether the table still agrees with the app's framing:
 * `node tools/poster.mjs --check` says that, and the app places the still exactly whatever the table holds.
 */

const root = path.resolve(__dirname, '..')
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8')
const BUDGET: Record<string, number> = { avif: 60000, webp: 90000 }

type Still = [string, number, number, number, number, string, number]
interface Table {
  season: string
  seasons: string[]
  stills: Still[]
  a: number[]
  h: number[]
  g: number[]
  p: [number, number, number, number][]
  b: Record<string, string[]>
}

const tableText = /\/\*first:begin\*\/([\s\S]*?)\/\*first:end\*\//.exec(html)?.[1]?.trim() ?? 'null'
const table = JSON.parse(tableText) as Table
const script = /<script>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''

interface Style {
  [key: string]: string
}
class El {
  style: Style = {}
  children: El[] = []
  parentNode: El | null = null
  attrs: Record<string, string> = {}
  listeners: Record<string, (() => void)[]> = {}
  src = ''
  srcset = ''
  type = ''
  constructor(readonly tag: string, public clientWidth = 0, public clientHeight = 0) {}
  get firstChild(): El | null {
    return this.children[0] ?? null
  }
  set textContent(_text: string) {
    for (const c of this.children) c.parentNode = null
    this.children = []
  }
  appendChild(c: El): El {
    c.parentNode?.removeChild(c)
    c.parentNode = this
    this.children.push(c)
    return c
  }
  insertBefore(c: El, before: El | null): El {
    c.parentNode?.removeChild(c)
    c.parentNode = this
    const at = before ? this.children.indexOf(before) : -1
    if (at < 0) this.children.push(c)
    else this.children.splice(at, 0, c)
    return c
  }
  removeChild(c: El): El {
    this.children = this.children.filter((x) => x !== c)
    c.parentNode = null
    return c
  }
  setAttribute(k: string, v: string): void {
    this.attrs[k] = v
  }
  addEventListener(name: string, fn: () => void): void {
    ;(this.listeners[name] ??= []).push(fn)
  }
  fire(name: string): void {
    for (const fn of this.listeners[name] ?? []) fn()
  }
  all(tag: string): El[] {
    return this.children.flatMap((c) => [...(c.tag === tag ? [c] : []), ...c.all(tag)])
  }
}

interface FirstStill {
  place(globe: { cx: number; cy: number; r: number } | null, again?: boolean): void
  end(): void
}

function open(width: number, height: number, search = ''): { box: El; win: { firstStill?: FirstStill; resize(w: number, h: number): void; later(): void } } {
  const box = new El('div', width, height)
  const listeners: Record<string, (() => void)[]> = {}
  const timers: (() => void)[] = []
  const win = {
    innerWidth: width,
    innerHeight: height,
    firstStill: undefined as FirstStill | undefined,
    addEventListener: (name: string, fn: () => void) => void (listeners[name] ??= []).push(fn),
    removeEventListener: (name: string, fn: () => void) => void (listeners[name] = (listeners[name] ?? []).filter((x) => x !== fn)),
    setTimeout: (fn: () => void) => timers.push(fn),
    resize(w: number, h: number) {
      box.clientWidth = win.innerWidth = w
      box.clientHeight = win.innerHeight = h
      for (const fn of listeners.resize ?? []) fn()
    },
    later() {
      for (const fn of timers.splice(0)) fn()
    },
  }
  const doc = { getElementById: (id: string) => (id === 'first' ? box : null), createElement: (tag: string) => new El(tag) }
  new Function('window', 'document', 'location', script)(win, doc, { search })
  return { box, win }
}

const px = (v: string | undefined): number => Number.parseFloat(v ?? 'NaN')
const isSoft = (img: El): boolean => img.src.startsWith('data:')
/** The stills in the page, lowest first, without the soft picture that came with the page. */
const stillsIn = (box: El): El[] => box.all('img').filter((img) => !isSoft(img))
const softIn = (box: El): El[] => box.all('img').filter(isSoft)
const boxOf = (img: El): { x: number; y: number; right: number; bottom: number } => ({ x: px(img.style.left), y: px(img.style.top), right: px(img.style.left) + px(img.style.width), bottom: px(img.style.top) + px(img.style.height) })
const judged = [config.formats.phone, config.formats.tablet, config.formats.hd]

describe('the stills the page paints first', () => {
  it('has a table, written by the tool, that names the seasons of the config', () => {
    expect(table, 'index.html holds no table: run node tools/poster.mjs').not.toBeNull()
    expect(table.season).toBe(config.defaultSeason)
    expect(table.seasons).toEqual(config.seasons)
    expect(table.stills.length).toBeGreaterThan(0)
    expect(table.g).toHaveLength(table.a.length * table.h.length * 2)
    for (const axis of [table.a, table.h]) expect([...axis].sort((x, y) => x - y)).toEqual(axis)
    expect(table.g.every((v) => Number.isInteger(v) && v > 0)).toBe(true)
  })

  it('has one small file of each kind for every season and every still, the files the tool recorded', () => {
    const record = JSON.parse(fs.readFileSync(path.join(root, 'public', 'first', 'stills.json'), 'utf8')) as { stills: Record<string, Record<string, { bytes: number; sha: string }>> }
    const named = new Set<string>()
    for (const season of config.seasons) {
      for (const still of table.stills) {
        for (const kind of Object.keys(BUDGET)) {
          const name = `${season}-${still[0]}.${kind}`
          const file = path.join(root, 'public', 'first', name)
          expect(fs.existsSync(file), name).toBe(true)
          const bytes = fs.readFileSync(file)
          expect(bytes.length, name).toBeLessThanOrEqual(BUDGET[kind]!)
          expect(bytes.length, name).toBeGreaterThan(8000)
          expect(crypto.createHash('sha256').update(bytes).digest('hex'), name).toBe(record.stills[`${season}-${still[0]}`]?.[kind]?.sha)
          named.add(name)
        }
      }
    }
    const kept = fs.readdirSync(path.join(root, 'public', 'first')).filter((f) => /\.(avif|webp)$/.test(f))
    expect(kept.sort()).toEqual([...named].sort())
  })

  it('names no season in the page itself: a season is a row of the table', () => {
    const own = html.replace(tableText, '')
    for (const season of config.seasons) expect(own.includes(season), season).toBe(false)
  })
})

describe('the page before the app runs', () => {
  it('fills each judged screen with one still, laid on the screen it was drawn for', () => {
    for (const f of judged) {
      const { box } = open(f.width, f.height)
      const imgs = stillsIn(box)
      expect(imgs, f.id).toHaveLength(1)
      const b = boxOf(imgs[0]!)
      expect(b.x, f.id).toBeCloseTo(0, 6)
      expect(b.y, f.id).toBeCloseTo(0, 6)
      expect(b.right, f.id).toBeCloseTo(f.width, 6)
      expect(b.bottom, f.id).toBeCloseTo(f.height, 6)
      expect(imgs[0]!.style.maskImage, f.id).toBe('')
    }
  })

  it('shows the season the link names, and the season the app opens on when it names none or one that is not there', () => {
    const f = config.formats.phone
    const fileOf = (search: string): { webp: string; avif: string } => {
      const { box } = open(f.width, f.height, search)
      return { webp: stillsIn(box)[0]!.src, avif: box.all('source')[0]!.srcset }
    }
    for (const season of config.seasons) {
      const got = fileOf(`?season=${season}`)
      expect(got.webp).toMatch(new RegExp(`^first/${season}-[a-z0-9]+\\.webp\\?v=[0-9a-f]+$`))
      expect(got.avif).toMatch(new RegExp(`^first/${season}-[a-z0-9]+\\.avif\\?v=[0-9a-f]+$`))
    }
    expect(fileOf('').webp.startsWith(`first/${config.defaultSeason}-`)).toBe(true)
    expect(fileOf('?season=monsoon').webp.startsWith(`first/${config.defaultSeason}-`)).toBe(true)
    expect(fileOf('?mode=probe&season=fall').webp.startsWith('first/fall-')).toBe(true)
  })

  it('paints nothing on the pages that are not the app: the films, the loop, the capture page', () => {
    for (const mode of ['autopilot', 'loop', 'capture']) {
      const { box, win } = open(1920, 1080, `?mode=${mode}`)
      expect(box.children, mode).toHaveLength(0)
      expect(win.firstStill, mode).toBeUndefined()
    }
  })

  it('covers a screen no still was drawn for: a larger copy lies under the still where it does not reach', () => {
    for (const [w, h] of [[360, 800], [1366, 768], [3440, 1080], [600, 1000], [844, 390]] as const) {
      const { box } = open(w, h)
      const imgs = stillsIn(box)
      const over = imgs[imgs.length - 1]!
      const b = boxOf(over)
      const reaches = b.x <= 0.5 && b.y <= 0.5 && b.right >= w - 0.5 && b.bottom >= h - 0.5
      if (reaches) {
        expect(imgs, `${w}x${h}`).toHaveLength(1)
        continue
      }
      expect(imgs, `${w}x${h}`).toHaveLength(2)
      expect(over.style.maskImage, `${w}x${h}`).toContain('linear-gradient')
      const u = boxOf(imgs[0]!)
      expect(u.x, `${w}x${h}`).toBeLessThanOrEqual(1e-6)
      expect(u.y, `${w}x${h}`).toBeLessThanOrEqual(1e-6)
      expect(u.right, `${w}x${h}`).toBeGreaterThanOrEqual(w - 1e-6)
      expect(u.bottom, `${w}x${h}`).toBeGreaterThanOrEqual(h - 1e-6)
    }
  })
})

describe('the first paint, before the still has arrived', () => {
  it('holds a soft picture of every season in the page, a few hundred bytes each', () => {
    expect(table.p.length).toBeGreaterThan(0)
    for (const [still, width, height, rim] of table.p) {
      expect(table.stills[still]).toBeDefined()
      expect(Math.max(width, height)).toBeLessThanOrEqual(48)
      expect(rim).toBeGreaterThan(0)
    }
    for (const still of table.stills) expect(table.p[still[6]], still[0]).toBeDefined()
    for (const season of config.seasons) {
      expect(table.b[season], season).toHaveLength(table.p.length)
      for (const data of table.b[season]!) {
        const bytes = Buffer.from(data, 'base64')
        expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF')
        expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP')
        expect(bytes.length).toBeLessThan(900)
      }
    }
    expect(Buffer.byteLength(html)).toBeLessThan(40000)
  })

  it('lays the soft picture of the season over the whole screen, out of focus, with the still unseen above it', () => {
    for (const f of [...judged, { id: 'wide', width: 2560, height: 1080 }, { id: 'tall', width: 360, height: 800 }]) {
      for (const season of [config.defaultSeason, 'summer']) {
        const { box } = open(f.width, f.height, `?season=${season}`)
        const soft = softIn(box)
        expect(soft, f.id).toHaveLength(1)
        expect(table.b[season]!.some((data) => soft[0]!.src === `data:image/webp;base64,${data}`), f.id).toBe(true)
        const b = boxOf(soft[0]!)
        expect(b.x, f.id).toBeLessThanOrEqual(0)
        expect(b.y, f.id).toBeLessThanOrEqual(0)
        expect(b.right, f.id).toBeGreaterThanOrEqual(f.width)
        expect(b.bottom, f.id).toBeGreaterThanOrEqual(f.height)
        expect(soft[0]!.style.filter, f.id).toMatch(/^blur\([0-9.]+px\)$/)
        expect(box.all('img')[0], f.id).toBe(soft[0])
        for (const still of stillsIn(box)) expect(still.style.opacity, f.id).toBe('0')
      }
    }
  })

  it('brings the still in over the soft picture when it has arrived, then drops the soft picture', () => {
    const { box, win } = open(config.formats.phone.width, config.formats.phone.height)
    const still = stillsIn(box)[0]!
    expect(still.style.opacity).toBe('0')
    still.fire('load')
    expect(still.style.opacity).toBe('1')
    expect(still.style.transition).toContain('opacity')
    expect(softIn(box)).toHaveLength(1)
    win.later()
    expect(softIn(box)).toHaveLength(0)
    expect(stillsIn(box)).toEqual([still])
  })

  it('moves the soft picture with the still when the app says where its glass is', () => {
    const f = config.formats.hd
    const { box, win } = open(f.width, f.height)
    const [soft, still] = [softIn(box)[0]!, stillsIn(box)[0]!]
    const before = [boxOf(soft), boxOf(still)]
    const s = table.stills.find((x) => still.src.includes(`-${x[0]}.`))!
    win.firstStill!.place({ cx: f.width / 2 - 2, cy: (s[3] / 1e5) * f.height + 4, r: (s[4] / 1e5) * f.height })
    const after = [boxOf(soft), boxOf(still)]
    for (const k of [0, 1]) {
      expect(after[k]!.x - before[k]!.x).toBeCloseTo(-2, 6)
      expect(after[k]!.y - before[k]!.y).toBeCloseTo(4, 6)
    }
  })
})

describe('the page once the app runs', () => {
  it('moves the still to where the app says its glass is, without changing the still', () => {
    const f = config.formats.phone
    const { box, win } = open(f.width, f.height)
    const img = stillsIn(box)[0]!
    const before = boxOf(img)
    const still = table.stills.find((s) => img.src.includes(`-${s[0]}.`))!
    const r = (still[4] / 1e5) * f.height
    win.firstStill!.place({ cx: f.width / 2 + 3, cy: (still[3] / 1e5) * f.height + 5, r })
    expect(stillsIn(box)[stillsIn(box).length - 1]).toBe(img)
    const after = boxOf(img)
    expect(after.x - before.x).toBeCloseTo(3, 6)
    expect(after.y - before.y).toBeCloseTo(5, 6)
    expect(after.right - after.x).toBeCloseTo(before.right - before.x, 6)
  })

  it('keeps the still in place while a screen that changed shape waits for a better one, then drops the old one', () => {
    const { box, win } = open(config.formats.hd.width, config.formats.hd.height)
    const first = stillsIn(box)[0]!
    first.fire('load')
    win.later()
    win.resize(config.formats.phone.width, config.formats.phone.height)
    const now = stillsIn(box)
    const next = now[now.length - 1]!
    expect(next.src).not.toBe(first.src)
    expect(now).toContain(first)
    // Nothing soft goes over a still that is there, and the one that follows it is not held back.
    expect(softIn(box)).toHaveLength(0)
    expect(next.style.opacity).toBeUndefined()
    next.fire('load')
    expect(stillsIn(box)).not.toContain(first)
    expect(stillsIn(box)).toContain(next)
  })

  it('leaves nothing behind when the app says the still is no longer needed', () => {
    const { box, win } = open(1920, 1080)
    win.firstStill!.end()
    expect(box.children).toHaveLength(0)
    expect(win.firstStill).toBeUndefined()
  })
})
