// node out/work/p6s/reveal-read.mjs <url> <name> [size=1920x1080] [seconds after the live mark=24] [every=3]
// Job 5: the first still never ends before the canvas is in full sight. One page alone, read by the page itself:
// at every animation frame (what that frame shows: the canvas's opacity as computed, how many pictures of the still are
// in the page), at the moment the still leaves (the same task), and on a timer every 100 ms (the wall against the page's
// clock, which is the time of its last frame). Nothing of the app is wrapped.
import fs from 'node:fs'
import { launch } from '../../../tools/lib/browser.mjs'
const [, , url = 'http://localhost:4180/', name = 'reveal', size = '1920x1080', secondsArg = '24', everyArg = '3'] = process.argv
const [width, height] = size.split('x').map(Number)
const seconds = Number(secondsArg)
const every = Number(everyArg)
const browser = await launch()
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
const page = await context.newPage()
const lines = []
page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
await page.addInitScript(() => {
  const w = (window.__rv = { wall0: Date.now(), frames: [], ticks: [], events: [], count: 0, last: null })
  const canvas = () => document.getElementById('view')
  const look = (kind) => {
    const c = canvas()
    const fade = c && c.getAnimations ? c.getAnimations().map((a) => (typeof a.currentTime === 'number' ? Math.round(a.currentTime) : null)) : []
    return {
      kind,
      wall: Date.now() - w.wall0,
      now: Math.round(performance.now()),
      clock: w.last === null ? null : Math.round(w.last),
      line: document.timeline && document.timeline.currentTime !== null ? Math.round(document.timeline.currentTime) : null,
      frames: w.count,
      opacity: c ? Number(getComputedStyle(c).opacity) : null,
      stills: document.querySelectorAll('#first img').length,
      live: !!c && c.dataset.live !== undefined,
      own: c ? c.style.transition : null,
      fade,
    }
  }
  const frame = (t) => {
    w.count++
    w.last = t
    if (w.frames.length < 6000) w.frames.push(look('frame'))
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  setInterval(() => w.ticks.length < 6000 && w.ticks.push(look('tick')), 100)
  for (const type of ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel'])
    document.addEventListener(type, (e) => e.target === canvas() && w.events.push({ ...look(type), property: e.propertyName }), true)
  let had = 0
  new MutationObserver(() => {
    const c = canvas()
    const n = document.querySelectorAll('#first img').length
    if (had > 0 && n === 0) w.events.push(look('the still left'))
    if (had === 0 && n > 0) w.events.push(look('the still came'))
    had = n
    if (c && c.dataset.live !== undefined && !w.marked) {
      w.marked = true
      w.events.push(look('the live mark'))
    }
  }).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-live'] })
})
const t0 = Date.now()
await page.goto(url, { waitUntil: 'domcontentloaded' })
const marked = async () => page.evaluate(() => window.__rv.events.find((e) => e.kind === 'the live mark') ?? null)
let mark = null
while (!(mark = await marked()) && Date.now() - t0 < 240000) await new Promise((r) => setTimeout(r, 250))
const out = []
const say = (s) => {
  out.push(s)
  console.log(s)
}
const f4 = (v) => (v === null ? 'none' : v.toFixed(4))
const line = (at, s) => `${at}: opacity ${f4(s.opacity)}, still ${s.stills} pictures, ${s.frames} animation frames, page clock ${s.clock} ms, wall ${s.wall} ms${s.fade.length ? `, ${s.fade.join()} ms of the fade run` : ''}${s.own ? `, the canvas's own style says transition ${s.own}` : ''}`
const info = await page.evaluate(() => {
  const c = document.createElement('canvas').getContext('webgl2')
  const d = c && c.getExtension('WEBGL_debug_renderer_info')
  return { renderer: c && d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown', engine: document.documentElement.dataset.engine ?? null }
})
say(`${name} · ${url} · ${width}x${height} · ${info.renderer}`)
if (!mark) {
  say('NOT ok: the live mark did not come in 240 s')
} else {
  say(line('the live mark', mark))
  for (let k = 1; k * every <= seconds; k++) {
    const due = mark.wall + k * every * 1000
    for (;;) {
      const wall = await page.evaluate(() => Date.now() - window.__rv.wall0)
      if (wall >= due) break
      await new Promise((r) => setTimeout(r, Math.min(250, due - wall)))
    }
    say(line(`${k * every} s after it`, await page.evaluate(() => window.__rv.ticks[window.__rv.ticks.length - 1])))
  }
  const rv = await page.evaluate(() => window.__rv)
  const left = rv.events.find((e) => e.kind === 'the still left')
  const ended = rv.events.find((e) => e.kind === 'transitionend')
  for (const e of rv.events) say(`  ${e.kind}${e.property ? ` (${e.property})` : ''} at wall ${e.wall} ms, page clock ${e.clock} ms, frame ${e.frames}: opacity ${f4(e.opacity)}, still ${e.stills}${e.own ? `, own transition ${e.own}` : ''}${e.fade.length ? `, fade at ${e.fade.join()} ms` : ''}`)
  const after = rv.frames.filter((f) => f.live)
  const bare = after.filter((f) => f.stills === 0 && f.opacity < 1)
  const full = after.find((f) => f.opacity >= 1)
  const fading = after.filter((f) => f.stills > 0 && f.opacity < 1)
  say(`frames drawn from the live mark on: ${after.length}; with the still under a canvas short of full sight (the fade): ${fading.length}, opacity ${fading.map((f) => f.opacity.toFixed(3)).slice(0, 40).join(' ')}`)
  say(`frames with the still gone and the canvas short of full sight: ${bare.length}${bare.length ? `, from wall ${bare[0].wall} to ${bare[bare.length - 1].wall} ms, opacity ${bare.map((f) => f.opacity.toFixed(3)).slice(0, 40).join(' ')}` : ''}`)
  const gap = left && full ? full.wall - left.wall : null
  say(`the still left ${left ? `${left.wall - mark.wall} ms after the live mark by the wall, ${left.clock - mark.clock} ms by the page's clock, ${ended && rv.events.indexOf(ended) < rv.events.indexOf(left) ? 'at the end of the fade (transitionend)' : 'when the wait was over (no transitionend before it)'}, the canvas at ${f4(left.opacity)}` : 'not in this time'}; the canvas was first drawn in full sight ${full ? `${full.wall - mark.wall} ms after the mark` : 'not in this time'}${gap !== null ? `; ${left.opacity < 1 ? `the page stood nearly black for ${gap} ms` : 'at no time was the page without a whole picture'}` : ''}`)
  const ok = !!left && bare.length === 0 && left.opacity >= 1 && !!full
  say(`${ok ? 'ok' : 'NOT ok'}: ${ok ? 'at no frame was the still gone and the canvas under full opacity' : 'the still was gone under a canvas short of full sight, or it did not leave'}`)
  fs.writeFileSync(new URL(`./reveal-${name}.json`, import.meta.url), JSON.stringify({ url, size, info, mark, rv }, null, 1))
}
say(`console ${lines.length} ${JSON.stringify(lines.slice(0, 5))}`)
fs.writeFileSync(new URL(`./reveal-${name}.txt`, import.meta.url), out.join('\n') + '\n')
await browser.close()
