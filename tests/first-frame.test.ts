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

type Still = [string, number, number, number, number, string, number, number]
interface Table {
  season: string
  seasons: string[]
  stills: Still[]
  a: number[]
  g: number[][]
  c: { q: string[]; m: Record<string, [number, number]> } | null
  e: [number, number, number]
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
  getBoundingClientRect(): { height: number } {
    return { height: this.style.cssText?.includes('env(safe-area-inset-bottom') ? El.inset : 0 }
  }
  /** The safe area under the page, as the browser would lay out an element that is that high. */
  static inset = 0
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

interface Screen {
  coarse?: boolean
  inset?: number
  /** What the browser answers to a media rule, where the test asks for another answer than the screen gives. */
  media?: (query: string) => boolean
  table?: Table
}

/** A browser's answer to the media rules the interface is written with. */
function holds(query: string, width: number, height: number, coarse: boolean): boolean {
  return query.split(',').some((part) =>
    part.split(' and ').every((term) => {
      const m = /^\s*\(\s*([a-z-]+)\s*:\s*([^)]+?)\s*\)\s*$/.exec(term)
      if (!m) return false
      const [, name, value] = m
      const px = Number.parseFloat(value!)
      if (name === 'min-width') return width >= px
      if (name === 'max-width') return width <= px
      if (name === 'min-height') return height >= px
      if (name === 'max-height') return height <= px
      if (name === 'orientation') return (value === 'portrait') === height >= width
      if (name === 'pointer') return value === (coarse ? 'coarse' : 'fine')
      if (name === 'hover') return value === (coarse ? 'none' : 'hover')
      return false
    }),
  )
}

function open(width: number, height: number, search = '', screen: Screen = {}): { box: El; win: { firstStill?: FirstStill; resize(w: number, h: number): void; later(): void } } {
  const box = new El('div', width, height)
  El.inset = screen.inset ?? 0
  const listeners: Record<string, (() => void)[]> = {}
  const timers: (() => void)[] = []
  const win = {
    innerWidth: width,
    innerHeight: height,
    firstStill: undefined as FirstStill | undefined,
    addEventListener: (name: string, fn: () => void) => void (listeners[name] ??= []).push(fn),
    removeEventListener: (name: string, fn: () => void) => void (listeners[name] = (listeners[name] ?? []).filter((x) => x !== fn)),
    setTimeout: (fn: () => void) => timers.push(fn),
    matchMedia: (query: string) => ({ matches: screen.media ? screen.media(query) : holds(query, win.innerWidth, win.innerHeight, screen.coarse === true) }),
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
  new Function('window', 'document', 'location', screen.table ? script.replace(tableText, JSON.stringify(screen.table)) : script)(win, doc, { search })
  return { box, win }
}

const px = (v: string | undefined): number => Number.parseFloat(v ?? 'NaN')
const isSoft = (img: El): boolean => img.src.startsWith('data:')
/** The stills in the page, lowest first, without the soft picture that came with the page. */
const stillsIn = (box: El): El[] => box.all('img').filter((img) => !isSoft(img))
const softIn = (box: El): El[] => box.all('img').filter(isSoft)
const boxOf = (img: El): { x: number; y: number; right: number; bottom: number } => ({ x: px(img.style.left), y: px(img.style.top), right: px(img.style.left) + px(img.style.width), bottom: px(img.style.top) + px(img.style.height) })
const judged = [config.formats.phone, config.formats.tablet, config.formats.hd]

/** A still or a copy of it as the page laid it: its box, the globe in it (the glass and the row its foot ends at) and how far
 * in from its top, right, bottom and left the page thins it out. */
interface Laid {
  x: number
  y: number
  right: number
  bottom: number
  globe: { cx: number; cy: number; r: number; foot: number }
  thin: [number, number, number, number]
}
/** The way the page writes the thinning toward the top, the right, the bottom and the left of a picture. */
const TOWARD = ['bottom', 'left', 'top', 'right']
/** The glass with the rim of light around it: what of a copy must not show beside the still. */
const RIM = 1.02
/** The still of a page and the copies under it, the still first and the largest copy last. */
function laidIn(box: El): Laid[] {
  return stillsIn(box)
    .reverse()
    .map((img) => {
      const b = boxOf(img)
      const s = table.stills.find((x) => img.src.includes(`-${x[0]}.`))!
      const high = b.bottom - b.y
      const thin: [number, number, number, number] = [0, 0, 0, 0]
      for (const m of (img.style.maskImage ?? '').matchAll(/to (\w+), transparent, #000 ([\d.]+)px/g)) thin[TOWARD.indexOf(m[1]!)] = Number(m[2])
      return { ...b, thin, globe: { cx: (b.x + b.right) / 2, cy: b.y + (s[3] / 1e5) * high, r: (s[4] / 1e5) * high, foot: b.y + (s[7] / 1e5) * high } }
    })
}
/** How far each edge of a picture is from the edge of the screen it does not reach: top, right, bottom, left. */
const bareOf = (l: Laid, w: number, h: number): number[] => [l.y, w - l.right, h - l.bottom, l.x]
/** How far inside the part of `over` that is not thinned out the globe of `under` ends, toward each edge: under 0 it shows. */
const clearOf = (over: Laid, under: Laid): number[] => [
  under.globe.cy - RIM * under.globe.r - (over.y + over.thin[0]),
  over.right - over.thin[1] - (under.globe.cx + RIM * under.globe.r),
  over.bottom - over.thin[2] - under.globe.foot,
  under.globe.cx - RIM * under.globe.r - (over.x + over.thin[3]),
]

describe('the stills the page paints first', () => {
  it('has a table, written by the tool, that names the seasons of the config', () => {
    expect(table, 'index.html holds no table: run node tools/poster.mjs').not.toBeNull()
    expect(table.season).toBe(config.defaultSeason)
    expect(table.seasons).toEqual(config.seasons)
    expect(table.stills.length).toBeGreaterThan(0)
    for (const s of table.stills) {
      expect(s, s[0]).toHaveLength(8)
      expect(s[3] + s[4], s[0]).toBeLessThan(s[7])
      expect(s[7], s[0]).toBeLessThan(1e5)
    }
    expect(table.g).toHaveLength(table.a.length)
    expect([...table.a].sort((x, y) => x - y)).toEqual(table.a)
    expect(new Set(table.a).size).toBe(table.a.length)
    for (const row of table.g) {
      expect(row.length % 3).toBe(0)
      expect(row.length).toBeGreaterThanOrEqual(6)
      const shares = row.filter((_, i) => i % 3 === 0)
      expect(shares.every((u, i) => u >= 0 && (i === 0 || u > shares[i - 1]!))).toBe(true)
      expect(row.every((v, i) => i % 3 === 0 || (Number.isInteger(v) && v > 0))).toBe(true)
    }
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

  it('covers a screen no still was drawn for: larger copies lie under the still where it does not reach, the lowest over all of it', () => {
    for (const [w, h] of [[360, 800], [1366, 768], [3440, 1080], [600, 1000], [844, 390]] as const) {
      const { box } = open(w, h)
      const imgs = stillsIn(box)
      const over = imgs[imgs.length - 1]!
      const b = boxOf(over)
      const reaches = b.x <= 1e-6 && b.y <= 1e-6 && b.right >= w - 1e-6 && b.bottom >= h - 1e-6
      if (reaches) {
        expect(imgs, `${w}x${h}`).toHaveLength(1)
        expect(over.style.maskImage, `${w}x${h}`).toBe('')
        continue
      }
      expect(imgs.length, `${w}x${h}`).toBeGreaterThanOrEqual(2)
      expect(new Set(imgs.map((img) => img.src)).size, `${w}x${h}`).toBe(1)
      expect(over.style.maskImage, `${w}x${h}`).toContain('linear-gradient')
      expect(imgs[0]!.style.maskImage, `${w}x${h}`).toBe('')
      const u = boxOf(imgs[0]!)
      expect(u.x, `${w}x${h}`).toBeLessThanOrEqual(1e-6)
      expect(u.y, `${w}x${h}`).toBeLessThanOrEqual(1e-6)
      expect(u.right, `${w}x${h}`).toBeGreaterThanOrEqual(w - 1e-6)
      expect(u.bottom, `${w}x${h}`).toBeGreaterThanOrEqual(h - 1e-6)
    }
  })

  it('shows one globe on a screen of any shape: no copy shows its glass or its foot where the picture over it thins out or ends', () => {
    const widths = [300, 320, 360, 390, 414, 480, 540, 600, 650, 673, 700, 719, 720, 768, 820, 834, 853, 912, 1024, 1180, 1366, 1600, 1920, 2560, 3440]
    let screens = 0
    let copied = 0
    for (const coarse of [false, true]) {
      for (const w of widths) {
        for (let aspect = 0.4; aspect <= 3.2; aspect *= 1.04) {
          const h = Math.round(w / aspect)
          if (h < 280 || h > 2600) continue
          const at = `${w}x${h}${coarse ? ' touch' : ''}`
          const { box } = open(w, h, '', { coarse })
          const layers = laidIn(box)
          const lowest = layers[layers.length - 1]!
          screens++
          if (layers.length > 1) copied++
          expect(Math.max(...bareOf(lowest, w, h)), at).toBeLessThanOrEqual(1e-6)
          expect(lowest.thin, at).toEqual([0, 0, 0, 0])
          for (let j = 0; j + 1 < layers.length; j++) {
            const bare = bareOf(layers[j]!, w, h)
            const clear = clearOf(layers[j]!, layers[j + 1]!)
            for (let e = 0; e < 4; e++) {
              if (bare[e]! > 1e-6) expect(clear[e], `${at}: the globe of copy ${j + 1} toward the ${TOWARD[(e + 2) % 4]} of the picture over it`).toBeGreaterThanOrEqual(-1e-6)
              else expect(layers[j]!.thin[e], at).toBe(0)
              if (bare[e]! > 0.5) expect(layers[j]!.thin[e], `${at}: picture ${j} ends at a line`).toBeGreaterThanOrEqual(1)
            }
          }
        }
      }
    }
    expect(screens).toBeGreaterThan(2000)
    expect(copied).toBeGreaterThan(screens / 4)
  })

  it('thins a still out over a part the eye does not read as a line, on the tablets and the windows it shows a band beside', () => {
    const tablets = [[820, 1180], [834, 1194], [834, 1210], [853, 1280], [912, 1368]] as const
    const windows = [[600, 600, false], [650, 561, false], [640, 700, false], [650, 550, true], [694, 768, true], [673, 841, true], [1920, 600, false], [2660, 837, false], [1820, 572, true], [1000, 1000, false]] as const
    for (const [w, h, coarse] of [...tablets.map(([tw, th]) => [tw, th, true] as const), ...windows]) {
      const at = `${w}x${h}${coarse ? ' touch' : ''}`
      const layers = laidIn(open(w, h, '', { coarse }).box)
      for (let j = 0; j + 1 < layers.length; j++) {
        const bare = bareOf(layers[j]!, w, h)
        for (let e = 0; e < 4; e++) if (bare[e]! > 3) expect(layers[j]!.thin[e], `${at}: picture ${j}, ${bare[e]!.toFixed(1)} px short of the ${TOWARD[(e + 2) % 4]}`).toBeGreaterThanOrEqual(8)
      }
    }
    for (const [w, h] of tablets) {
      const layers = laidIn(open(w, h, '', { coarse: true }).box)
      expect(layers.length, `${w}x${h}`).toBeGreaterThan(1)
      expect(layers[0]!.thin[0], `${w}x${h}: the still thins out toward the top`).toBeGreaterThanOrEqual(8)
    }
  })

  it('lays every copy about the glass of the still, larger than the one over it', () => {
    for (const [w, h, coarse] of [[820, 1180, true], [600, 600, false], [1920, 600, false], [360, 800, false], [3440, 1080, false]] as const) {
      const layers = laidIn(open(w, h, '', { coarse }).box)
      for (let j = 1; j < layers.length; j++) {
        expect(layers[j]!.globe.cx, `${w}x${h}`).toBeCloseTo(layers[0]!.globe.cx, 6)
        expect(layers[j]!.globe.cy, `${w}x${h}`).toBeCloseTo(layers[0]!.globe.cy, 6)
        expect(layers[j]!.globe.r, `${w}x${h}`).toBeGreaterThan(layers[j - 1]!.globe.r)
      }
    }
  })

  it('takes the copies away again on a screen the still fills', () => {
    const { box, win } = open(820, 1180, '', { coarse: true })
    expect(stillsIn(box).length).toBeGreaterThan(1)
    const f = config.formats.tablet
    win.resize(f.width, f.height)
    expect(stillsIn(box)).toHaveLength(1)
    expect(stillsIn(box)[0]!.style.maskImage).toBe('')
  })
})

describe('the still stands where the globe stays once the controls are measured', () => {
  const glassOf = (width: number, height: number, screen: Screen = {}): { y: number; r: number } => {
    const { box } = open(width, height, '', screen)
    const img = stillsIn(box)[stillsIn(box).length - 1]!
    const s = table.stills.find((x) => img.src.includes(`-${x[0]}.`))!
    const k = px(img.style.height) / s[2]
    return { y: px(img.style.top) + (s[3] / 1e5) * s[2] * k, r: (s[4] / 1e5) * s[2] * k }
  }

  it('holds the height of the controls for every way the media rules of the interface hold together', () => {
    expect(table.c, 'the table holds no controls: run node tools/poster.mjs').not.toBeNull()
    expect(table.c!.q.length).toBeGreaterThan(0)
    expect(Object.keys(table.c!.m).length).toBeGreaterThan(1)
    for (const [key, [bar, from]] of Object.entries(table.c!.m)) {
      expect(key).toMatch(new RegExp(`^[01]{${table.c!.q.length}}$`))
      expect(bar, key).toBeGreaterThan(0)
      expect(from, key).toBeGreaterThanOrEqual(0)
    }
    expect(table.e).toHaveLength(3)
  })

  it('finds the controls of every judged screen in the table, with a mouse and with a finger', () => {
    for (const f of judged) {
      for (const coarse of [false, true]) {
        const key = table.c!.q.map((q) => (holds(q, f.width, f.height, coarse) ? '1' : '0')).join('')
        expect(table.c!.m[key], `${f.id} ${coarse ? 'finger' : 'mouse'}`).toBeDefined()
      }
    }
  })

  it('stands the glass higher than the bar the app takes without a measure would, where the controls are higher than that bar', () => {
    const f = config.formats.phone
    const key = table.c!.q.map((q) => (holds(q, f.width, f.height, true) ? '1' : '0')).join('')
    const bar = table.c!.m[key]![0]
    const taken = Math.min(Math.max(table.e[0] * f.height, table.e[1]), table.e[2] * f.height)
    const without = glassOf(f.width, f.height, { table: { ...table, c: null } })
    const measured = glassOf(f.width, f.height, { coarse: true })
    expect(Number.isFinite(without.y) && Number.isFinite(measured.y)).toBe(true)
    if (bar > taken) expect(measured.y).toBeLessThan(without.y)
    else expect(measured.y).toBeGreaterThanOrEqual(without.y)
  })

  it('raises the glass with the strip of a home indicator from the safe area on that the table names, and not before', () => {
    const [w, h] = [844, 390]
    const key = table.c!.q.map((q) => (holds(q, w, h, true) ? '1' : '0')).join('')
    const from = table.c!.m[key]![1]
    const none = glassOf(w, h, { coarse: true })
    expect(glassOf(w, h, { coarse: true, inset: from }).y).toBeCloseTo(none.y, 6)
    expect(glassOf(w, h, { coarse: true, inset: from + 24 }).y).toBeLessThan(none.y)
  })

  it('takes the nearest it knows where the rules hold together in a way the table has not met', () => {
    const f = config.formats.phone
    const known = glassOf(f.width, f.height, { coarse: true })
    const odd = glassOf(f.width, f.height, { media: () => true })
    expect(Number.isFinite(odd.y) && Number.isFinite(odd.r)).toBe(true)
    expect(Math.abs(odd.y - known.y)).toBeLessThan(f.height * 0.2)
  })
})

/**
 * A browser that knows `rel=expect` paints nothing until the element the link names has been parsed, so its first paint has
 * the soft picture in it and never the bare ground. The element stands right after the script and outside it: a parser
 * reaches it whether the script ran or threw, and a browser that does not know the link paints as it always did.
 */
const heldUntilLaid = (page: string): void => {
  const head = page.slice(0, page.indexOf('<body'))
  const link = /<link\b[^>]*\brel="expect"[^>]*>/.exec(head)?.[0] ?? ''
  expect(link).toContain('blocking="render"')
  const id = /\bhref="#([^"]+)"/.exec(link)?.[1] ?? ''
  expect(id).not.toBe('')
  const named = [...page.matchAll(new RegExp(`<([a-z]+)\\b[^>]*\\bid="${id}"[^>]*>`, 'g'))]
  expect(named).toHaveLength(1)
  const element = named[0]!
  expect(element[0]).toMatch(/\shidden\b/)
  const laid = page.indexOf('</script>', page.indexOf('/*first:end*/')) + '</script>'.length
  expect(page.indexOf('/*first:end*/')).toBeGreaterThan(head.length)
  expect(element.index!).toBeGreaterThanOrEqual(laid)
  expect(page.slice(laid, element.index!).trim()).toBe('')
  expect(page.slice(element.index!).startsWith(`${element[0]}</${element[1]}>`)).toBe(true)
}
const builtFile = path.join(root, 'dist', 'index.html')
const built = fs.existsSync(builtFile) ? fs.readFileSync(builtFile, 'utf8') : null
const builtOfThisPage = built !== null && tableText !== 'null' && /\/\*first:begin\*\/([\s\S]*?)\/\*first:end\*\//.exec(built)?.[1]?.trim() === tableText

describe('the first paint, before the still has arrived', () => {
  it('is held until the soft picture is laid: the head expects an element that stands right after the script', () => {
    heldUntilLaid(html)
  })

  it.skipIf(!builtOfThisPage)('is held the same way in the built page, where the workspace has one built of this page', () => {
    heldUntilLaid(built!)
  })

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
