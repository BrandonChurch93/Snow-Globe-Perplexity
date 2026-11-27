// node out/work/p6s/keys-walk.mjs <url> [size=600x600] [folder for the pictures]
// The keys tools/visit.mjs does not press: the four arrows (the next and the last season, round the ends), the arrows with
// the focus on a mark (the focus goes with the season), and `s` where there is no sound. Read as states, with a picture of each.
import fs from 'node:fs'
import path from 'node:path'
import { launch } from '../../../tools/lib/browser.mjs'
const [, , url = 'http://localhost:4180/?quality=low', size = '600x600', outDir = '/tmp/p6s-look/keys'] = process.argv
const [width, height] = size.split('x').map(Number)
fs.mkdirSync(outDir, { recursive: true })
const browser = await launch()
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
const page = await context.newPage()
const lines = []
page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const read = () =>
  page.evaluate(() => {
    const ui = document.getElementById('ui')
    const marks = [...(ui?.querySelectorAll('[data-season]') ?? [])]
    const shake = ui?.querySelector('[data-control="shake"]')
    const sound = ui?.querySelector('[data-control="sound"]')
    const a = document.activeElement
    return {
      shown: ui?.dataset.interface === 'shown',
      lit: marks.filter((m) => m.getAttribute('aria-pressed') === 'true').map((m) => m.dataset.season).join(),
      target: marks.filter((m) => m.hasAttribute('data-target')).map((m) => m.dataset.season).join(),
      busy: shake?.getAttribute('aria-disabled') === 'true',
      sound: sound ? (sound.getBoundingClientRect().width > 0 ? (sound.getAttribute('aria-pressed') === 'true' ? 'on' : 'off') : 'hidden') : 'absent',
      said: ui?.querySelector('[role="status"]')?.textContent ?? '',
      focus: a && a !== document.body ? (a.getAttribute('data-season') ?? a.getAttribute('data-control') ?? a.tagName.toLowerCase()) : '',
    }
  })
const until = async (test, timeout = 120000) => {
  const t0 = Date.now()
  for (;;) {
    const s = await read()
    if (test(s)) return { ok: true, seconds: Math.round((Date.now() - t0) / 100) / 10, state: s }
    if (Date.now() - t0 > timeout) return { ok: false, seconds: Math.round((Date.now() - t0) / 100) / 10, state: s }
    await sleep(300)
  }
}
const out = []
let n = 0
const note = async (name, ok, facts) => {
  n++
  const file = `${String(n).padStart(2, '0')}-${name}.png`
  await page.screenshot({ path: path.join(outDir, file), scale: 'css', timeout: 120000 }).catch(() => null)
  out.push(`${ok ? 'ok ' : 'NOT'} ${name} ${JSON.stringify(facts)}`)
}
await page.goto(url, { waitUntil: 'domcontentloaded' })
await until((s) => s.shown)
const order = ['winter', 'spring', 'summer', 'fall']
const turn = async (key, name, wantFocus) => {
  const before = await read()
  const from = order.indexOf(before.lit)
  const by = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1
  const want = order[(from + by + 4) % 4]
  await page.keyboard.press(key)
  const during = await until((s) => s.busy || s.lit === want, 20000)
  const landed = await until((s) => !s.busy && s.lit === want)
  const end = landed.state
  await note(name, during.ok && during.state.target === want && landed.ok && end.said.toLowerCase() === want && (wantFocus === undefined || end.focus === wantFocus(want)), {
    key,
    from: before.lit,
    want,
    targetDuring: during.state.target,
    busyDuring: during.state.busy,
    landedIn: end.lit,
    said: end.said,
    focusBefore: before.focus,
    focusAfter: end.focus,
    seconds: landed.seconds,
  })
  await sleep(1500)
}
// No focus on the controls: the arrows change the season and take no focus.
await turn('ArrowRight', 'arrow-right', () => '')
await turn('ArrowLeft', 'arrow-left', () => '')
await turn('ArrowUp', 'arrow-up-round-the-end', () => '')
await turn('ArrowDown', 'arrow-down-round-the-end', () => '')
// With the focus on a mark the focus goes with the season.
await page.keyboard.press('Tab')
const focused = await read()
await turn('ArrowRight', 'arrow-right-from-a-mark', (want) => want)
// A key held through the landing repeats: a repeat is not a press, so no second shake starts.
const held = await read()
const next = order[(order.indexOf(held.lit) + 1) % 4]
await page.keyboard.down('ArrowRight')
const heldLanded = await until((s) => !s.busy && s.lit === next)
await sleep(900)
for (let i = 0; i < 3; i++) {
  await page.keyboard.down('ArrowRight')
  await sleep(200)
}
await sleep(1500)
const heldAfter = await read()
await page.keyboard.up('ArrowRight')
await note('arrow-held-through-the-landing', heldLanded.ok && heldAfter.lit === next && !heldAfter.busy && heldAfter.target === '', { from: held.lit, landedIn: heldLanded.state.lit, afterThreeRepeats: heldAfter.lit, busyAfter: heldAfter.busy, targetAfter: heldAfter.target })
// `s` where there is no sound: nothing changes and nothing is said.
const s0 = await read()
await page.keyboard.press('s')
await sleep(1200)
const s1 = await read()
await note('s-with-no-sound', JSON.stringify(s0) === JSON.stringify(s1), { sound: s1.sound, before: s0.lit, after: s1.lit, busy: s1.busy })
await browser.close()
console.log(`${url} · ${width} x ${height} · focus after Tab: ${focused.focus}`)
for (const l of out) console.log(l)
console.log(`console: ${lines.length} lines${lines.length ? `\n${lines.join('\n')}` : ''}`)
