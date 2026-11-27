// node out/work/p6s/buf-walk.mjs <url> <name> [presses=4] [size=320x320] [way]
// Which buffer the page writes when a frame stands inside bufferSubData. Once every season is in the GPU's hands, Space is
// pressed, and again when the shake has landed. Every write of 100,000 bytes or more is kept: when, how long the call
// took, how many bytes, which buffer (by the attributes that read it), which write of its frame it was, and how many
// draws and bytes the frame had sent before it.
// way: '' the page as it is; 'orphan' gives the buffer new storage of the same size before each such write;
// 'drawn' writes only as many items as the last draw of that buffer drew; 'one' writes the four as they are but asks the
// GPU for an answer (getError) before the first, so that the wait, if any, falls there.
import fs from 'node:fs'
import { launch } from '../../../tools/lib/browser.mjs'
const [, , url = 'http://localhost:4180/?quality=low', name = 'buf-walk', pressesArg = '4', size = '320x320', way = ''] = process.argv
const presses = Number(pressesArg)
const [width, height] = size.split('x').map(Number)
const browser = await launch()
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
const page = await context.newPage()
const lines = []
page.on('console', (m) => lines.push(`${m.type()}: ${m.text()}`))
page.on('pageerror', (e) => lines.push(`pageerror: ${e.message}`))
await page.addInitScript((way) => {
  const w = (window.__gl = { way, links: [], waits: [], gaps: [], shown: [], made: [], busy: [], keys: [], frames: [], subs: [], datas: [], names: {}, sizes: {}, usage: {}, renderer: null, ext: null, draws: [] })
  let last = performance.now()
  setInterval(() => {
    const t = performance.now()
    if (t - last > 50) w.gaps.push({ from: Math.round(last), ms: Math.round(t - last) })
    last = t
  }, 16)
  let frameNo = 0
  let drawsInFrame = 0
  let bytesInFrame = 0
  let subsInFrame = 0
  let linksInFrame = 0
  const frame = () => {
    w.frames.push([Math.round(performance.now()), drawsInFrame, bytesInFrame, subsInFrame])
    frameNo++
    drawsInFrame = 0
    bytesInFrame = 0
    subsInFrame = 0
    linksInFrame = 0
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
  const C = window.WebGL2RenderingContext
  const ids = new WeakMap()
  let nextId = 0
  const bound = new Map()
  const locs = new WeakMap()
  let program = null
  const drawnOf = {}
  const itemsOf = {}
  const real = {}
  for (const key of Object.getOwnPropertyNames(C.prototype)) {
    const d = Object.getOwnPropertyDescriptor(C.prototype, key)
    if (d && typeof d.value === 'function') real[key] = d.value
  }
  const idOf = (b) => (b ? ids.get(b) ?? 0 : 0)
  C.prototype.createBuffer = function () {
    const b = real.createBuffer.call(this)
    if (b) ids.set(b, ++nextId)
    return b
  }
  C.prototype.bindBuffer = function (target, b) {
    bound.set(target, b)
    return real.bindBuffer.call(this, target, b)
  }
  C.prototype.useProgram = function (p) {
    program = p
    return real.useProgram.call(this, p)
  }
  C.prototype.getAttribLocation = function (p, n) {
    const at = real.getAttribLocation.call(this, p, n)
    let m = locs.get(p)
    if (!m) locs.set(p, (m = {}))
    m[at] = n
    return at
  }
  C.prototype.vertexAttribPointer = function (at, size, ...rest) {
    const id = idOf(bound.get(this.ARRAY_BUFFER))
    if (id) {
      const n = (program && locs.get(program)?.[at]) || `loc${at}`
      const set = (w.names[id] ??= [])
      const label = `${n}:${size}`
      if (!set.includes(label)) set.push(label)
      itemsOf[id] = size
    }
    return real.vertexAttribPointer.call(this, at, size, ...rest)
  }
  C.prototype.linkProgram = function (...a) {
    const t = performance.now()
    linksInFrame++
    try {
      return real.linkProgram.apply(this, a)
    } finally {
      w.links.push([Math.round(t), Math.round((performance.now() - t) * 10) / 10])
    }
  }
  C.prototype.bufferData = function (target, x, usage, ...rest) {
    const id = idOf(bound.get(target))
    const bytes = typeof x === 'number' ? x : x ? x.byteLength : 0
    const t = performance.now()
    try {
      return real.bufferData.call(this, target, x, usage, ...rest)
    } finally {
      const ms = performance.now() - t
      w.sizes[id] = bytes
      w.usage[id] = usage
      if (bytes >= 100000 || ms >= 5) w.datas.push([Math.round(t), Math.round(ms * 10) / 10, bytes, id, frameNo])
    }
  }
  const BIG = 100000
  C.prototype.bufferSubData = function (target, offset, src, srcOffset, length) {
    const id = idOf(bound.get(target))
    const per = src && src.BYTES_PER_ELEMENT ? src.BYTES_PER_ELEMENT : 1
    let bytes = src ? (length ? length * per : src.byteLength - (srcOffset ?? 0) * per) : 0
    const big = bytes >= BIG
    let asked = 0
    if (big && way === 'one' && subsInFrame === 0) {
      const t0 = performance.now()
      real.getError.call(this)
      asked = performance.now() - t0
    }
    if (big && way === 'orphan' && offset === 0 && w.sizes[id] === bytes) real.bufferData.call(this, target, bytes, w.usage[id] ?? this.DYNAMIC_DRAW)
    let items = null
    if (big && way === 'drawn' && offset === 0 && !length && drawnOf.count > 0 && itemsOf[id]) {
      items = Math.min(src.length, drawnOf.count * itemsOf[id])
      bytes = items * per
    }
    const t = performance.now()
    try {
      if (items !== null) return real.bufferSubData.call(this, target, offset, src, 0, items)
      return length !== undefined ? real.bufferSubData.call(this, target, offset, src, srcOffset, length) : srcOffset !== undefined ? real.bufferSubData.call(this, target, offset, src, srcOffset) : real.bufferSubData.call(this, target, offset, src)
    } finally {
      const ms = performance.now() - t
      if (big || ms >= 5) w.subs.push([Math.round(t), Math.round(ms * 10) / 10, bytes, id, frameNo, subsInFrame, bytesInFrame, drawsInFrame, linksInFrame, Math.round(asked * 10) / 10])
      if (big) subsInFrame++
      bytesInFrame += bytes
    }
  }
  for (const key of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) {
    C.prototype[key] = function (...a) {
      drawsInFrame++
      const id = idOf(bound.get(this.ARRAY_BUFFER))
      const t = performance.now()
      try {
        return real[key].apply(this, a)
      } finally {
        const ms = performance.now() - t
        if (key === 'drawArrays' && a[0] === this.POINTS) drawnOf.count = a[2]
        if (key === 'drawElementsInstanced' && a[4] > 1000) drawnOf.count = a[4]
        if (ms >= 5) w.waits.push([key, Math.round(t), Math.round(ms)])
        if ((key === 'drawArrays' && a[0] === this.POINTS) || (key === 'drawElementsInstanced' && a[4] > 1000)) {
          if (w.draws.length < 4000) w.draws.push([Math.round(t), key === 'drawArrays' ? a[2] : a[4], frameNo, key === 'drawArrays' ? 'points' : 'quads'])
        }
        void id
      }
    }
  }
  const WAITS = ['getProgramInfoLog', 'getProgramParameter', 'getShaderInfoLog', 'getShaderParameter', 'getUniformLocation', 'getActiveUniform', 'getActiveAttrib', 'texSubImage2D', 'texImage2D', 'texSubImage3D', 'texImage3D', 'readPixels', 'getError', 'finish', 'flush', 'clientWaitSync', 'getSyncParameter', 'getParameter', 'checkFramebufferStatus', 'compileShader', 'getBufferSubData', 'blitFramebuffer', 'clear', 'generateMipmap', 'copyTexSubImage2D', 'copyTexImage2D', 'compressedTexImage2D', 'compressedTexSubImage2D', 'texStorage2D', 'texStorage3D', 'bindFramebuffer', 'deleteBuffer', 'deleteTexture', 'fenceSync']
  for (const key of WAITS) {
    if (!real[key]) continue
    C.prototype[key] = function (...a) {
      const t = performance.now()
      try {
        return real[key].apply(this, a)
      } finally {
        const ms = performance.now() - t
        if (ms >= 5) w.waits.push([key, Math.round(t), Math.round(ms)])
      }
    }
  }
  const getContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    const c = getContext.call(this, kind, ...rest)
    if (c && kind === 'webgl2' && w.ext === null) {
      w.ext = (c.getSupportedExtensions() ?? []).includes('KHR_parallel_shader_compile')
      const dbg = c.getExtension('WEBGL_debug_renderer_info')
      w.renderer = dbg ? real.getParameter.call(c, dbg.UNMASKED_RENDERER_WEBGL) : real.getParameter.call(c, c.RENDERER)
    }
    return c
  }
  window.addEventListener('keydown', (e) => w.keys.push({ at: Math.round(performance.now()), key: e.key }), true)
  new MutationObserver((list) => {
    for (const m of list) {
      const el = m.target
      if (!(el instanceof Element)) continue
      const t = Math.round(performance.now())
      const value = el.getAttribute(m.attributeName ?? '')
      if (m.attributeName === 'data-interface') w.shown.push({ at: t, value })
      else if (m.attributeName === 'data-made') w.made.push({ at: t, value })
      else if (m.attributeName === 'aria-disabled' && el.matches('[data-control="shake"]')) w.busy.push({ at: t, busy: value === 'true' })
    }
  }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-interface', 'data-made', 'aria-disabled'] })
}, way)
const cdp = await context.newCDPSession(page)
// The GPU process's threads, by what each spent on the CPU, ten times a second: whether its own thread draws or waits.
const { execSync } = await import('node:child_process')
const gpuPid = () => {
  try {
    const rows = execSync('ps -eo pid,args', { encoding: 'utf8' }).split('\n').filter((l) => l.includes('--type=gpu-process'))
    return rows.length ? Number(rows[rows.length - 1].trim().split(/\s+/)[0]) : null
  } catch {
    return null
  }
}
const samples = []
const threadNames = {}
let gpu = null
const sampler = setInterval(() => {
  gpu ??= gpuPid()
  if (!gpu) return
  try {
    const row = { at: Date.now(), t: {} }
    for (const tid of fs.readdirSync(`/proc/${gpu}/task`)) {
      const stat = fs.readFileSync(`/proc/${gpu}/task/${tid}/stat`, 'utf8')
      const close = stat.lastIndexOf(')')
      threadNames[tid] ??= stat.slice(stat.indexOf('(') + 1, close)
      const f = stat.slice(close + 2).split(' ')
      row.t[tid] = Number(f[11]) + Number(f[12])
    }
    samples.push(row)
  } catch {}
}, 100)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const key = { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32, text: ' ' }
const press = async () => {
  void cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...key }).catch(() => undefined)
  await sleep(60)
  const { text: _text, ...up } = key
  void cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...up }).catch(() => undefined)
}
const began = Date.now()
await page.goto(url, { waitUntil: 'commit' })
let sent = 0
let restFrom = null
while (Date.now() - began < 2400000) {
  const now = await page.evaluate(() => ({ shown: window.__gl.shown.find((s) => s.value === 'shown')?.at ?? null, made: window.__gl.made.some((r) => r.value === 'ready'), busy: window.__gl.busy })).catch(() => null)
  if (!now || now.shown === null || !now.made) {
    await sleep(200)
    continue
  }
  const free = now.busy.length === 0 || !now.busy[now.busy.length - 1].busy
  const answered = now.busy.filter((b) => b.busy).length >= sent
  if (free && answered) {
    restFrom ??= Date.now()
    if (Date.now() - restFrom > 3000) {
      if (sent >= presses) break
      await press()
      sent++
      restFrom = null
      await sleep(400)
    }
  } else restFrom = null
  await sleep(100)
}
const got = await page.evaluate(() => ({ ...window.__gl, now: Math.round(performance.now()), origin: performance.timeOrigin }))
clearInterval(sampler)
await browser.close()

const shownAt = got.shown.find((x) => x.value === 'shown')?.at ?? 0
const madeAt = got.made.find((m) => m.value === 'ready')?.at ?? null
const out = []
const say = (line) => {
  out.push(line)
  console.log(line)
}
const label = (id) => `${(got.names[id] ?? ['?']).join('+')} (buffer ${id}, ${got.sizes[id] ?? '?'} bytes)`
say(`${name} · ${url} · ${size} · way "${way}" · ${got.renderer} · parallel compile ${got.ext} · Space ${presses} x, each once the page is at rest`)
say(`the controls came ${shownAt} ms after the page began; data-made=ready ${madeAt === null ? 'NEVER' : `${madeAt - shownAt} ms after the controls`}; ${got.links.filter((l) => madeAt === null || l[0] < madeAt).length} programs linked before it`)
const SLOW = 100
const spans = []
got.keys.forEach((k, i) => {
  const went = got.busy.find((b) => b.busy && b.at >= k.at - 5)
  const landed = went ? got.busy.find((b) => !b.busy && b.at > went.at) : null
  spans.push({ name: `shake ${i + 1}`, from: k.at, to: landed?.at ?? got.now, landed: Boolean(landed) })
})
const restSpans = []
if (madeAt !== null) {
  let from = madeAt
  for (const s of spans) {
    restSpans.push({ name: `rest before ${s.name}`, from, to: s.from })
    from = s.to
  }
}
const inSpan = (s, at) => at >= s.from && at < s.to
let slowInShakes = 0
let shakesWithSlow = 0
for (const s of spans) {
  const subs = got.subs.filter((x) => inSpan(s, x[0]) && x[2] >= 100000)
  const slow = subs.filter((x) => x[1] >= SLOW)
  const gaps = got.gaps.filter((g) => g.from + g.ms > s.from && g.from < s.to)
  const frames = got.frames.filter((f) => inSpan(s, f[0]))
  const links = got.links.filter((l) => inSpan(s, l[0]))
  slowInShakes += slow.length
  if (slow.length) shakesWithSlow++
  say(`${s.name}: ${s.landed ? `landed ${s.to - s.from} ms after the press` : 'NOT landed'}; ${frames.length} frames; ${links.length} programs linked; the thread stood ${gaps.length} x, ${gaps.reduce((a, g) => a + g.ms, 0)} ms in all, ${gaps.reduce((a, g) => Math.max(a, g.ms), 0)} ms at most; ${subs.length} writes of 100,000 bytes or more, ${slow.length} of them ${SLOW} ms or longer`)
  for (const x of slow) say(`    ${x[1]} ms at ${x[0] - s.from} ms after the press: ${x[2]} bytes into ${label(x[3])}; write ${x[5] + 1} of its frame, after ${x[6]} bytes, ${x[7]} draws and ${x[8]} links of that frame`)
  const other = got.waits.filter((x) => inSpan(s, x[1]) && x[2] >= SLOW)
  if (other.length) say(`    other calls of ${SLOW} ms or longer: ${other.map((x) => `${x[0]} ${x[2]} ms at ${x[1] - s.from}`).join(' · ')}`)
}
let slowInRests = 0
for (const s of restSpans) {
  const slow = got.subs.filter((x) => inSpan(s, x[0]) && x[2] >= 100000 && x[1] >= SLOW)
  slowInRests += slow.length
  for (const x of slow) say(`${s.name}: ${x[1]} ms: ${x[2]} bytes into ${label(x[3])}; write ${x[5] + 1} of its frame, after ${x[6]} bytes, ${x[7]} draws and ${x[8]} links of that frame`)
}
// Ticks of the CPU clock are hundredths of a second here.
const cpuIn = (fromMs, toMs) => {
  const a = samples.findLast((r) => r.at <= got.origin + fromMs) ?? samples[0]
  const b = samples.find((r) => r.at >= got.origin + toMs) ?? samples[samples.length - 1]
  if (!a || !b || b.at <= a.at) return ''
  const parts = {}
  for (const tid of Object.keys(b.t)) {
    const name = (threadNames[tid] ?? '?').replace(/[-:]?\d+$/, '')
    parts[name] = (parts[name] ?? 0) + (b.t[tid] - (a.t[tid] ?? b.t[tid]))
  }
  const wall = (b.at - a.at) / 1000
  return Object.entries(parts).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([n, v]) => `${n} ${(v / 100 / wall).toFixed(2)}`).join(', ')
}
const warm = got.subs.filter((x) => (madeAt === null || x[0] < madeAt) && x[2] >= 100000)
const warmSlow = warm.filter((x) => x[1] >= SLOW)
const warmFrames = new Set(warm.map((x) => x[4])).size
say(`before data-made=ready: ${warmFrames} frames with such writes, ${warmSlow.length} writes of ${SLOW} ms or longer`)
for (const x of warmSlow) say(`    ${x[1]} ms at ${x[0]} ms: ${x[2]} bytes into ${label(x[3])}; write ${x[5] + 1} of its frame, after ${x[6]} bytes, ${x[7]} draws and ${x[8]} links of that frame · the GPU process's threads on the CPU meanwhile (cores): ${cpuIn(x[0], x[0] + x[1])}`)
if (way === 'one') {
  const firsts = got.subs.filter((x) => x[2] >= 100000 && x[5] === 0)
  for (const [what, list] of [['before data-made=ready', firsts.filter((x) => madeAt === null || x[0] < madeAt)], ['after it', firsts.filter((x) => madeAt !== null && x[0] >= madeAt)]]) {
    const a = list.map((x) => x[9]).sort((p, q) => p - q)
    if (!a.length) continue
    say(`the answer asked of the GPU process before a frame's first write, ${what}: ${a.length} x, least ${a[0]} ms, middle ${a[Math.floor(a.length / 2)]} ms, most ${a[a.length - 1]} ms, ${a.filter((v) => v >= SLOW).length} of ${SLOW} ms or more, ${Math.round(a.reduce((p, q) => p + q, 0))} ms in all`)
  }
}
if (samples.length > 1) {
  say(`the GPU process's threads on the CPU, in cores, over the whole run: ${cpuIn(0, got.now)}`)
  if (madeAt !== null) say(`    after data-made=ready: ${cpuIn(madeAt, got.now)}`)
}
const frameTimes = got.frames.filter((f) => f[3] > 0).map((f) => f[0])
const between = frameTimes.slice(1).map((t, i) => t - frameTimes[i]).sort((p, q) => p - q)
if (between.length) say(`from one frame with such writes to the next: ${between.length} x, least ${between[0]} ms, middle ${between[Math.floor(between.length / 2)]} ms, most ${between[between.length - 1]} ms`)
const by = {}
for (const x of got.subs) {
  if (madeAt === null || x[0] < madeAt || x[2] < 100000) continue
  const b = (by[`${x[5] + 1}. ${x[2]} bytes into ${label(x[3])}`] ??= { n: 0, slow: 0, ms: 0, most: 0, over5: 0 })
  b.n++
  b.ms += x[1]
  b.most = Math.max(b.most, x[1])
  if (x[1] >= SLOW) b.slow++
  if (x[1] >= 5) b.over5++
}
say(`every write of 100,000 bytes or more after data-made=ready, by its place in the frame:`)
for (const [k, b] of Object.entries(by).sort((a, b) => b[1].n - a[1].n).slice(0, 14)) say(`    ${k}: ${b.n} x, ${Math.round(b.ms)} ms in all, mean ${(b.ms / b.n).toFixed(1)} ms, most ${b.most} ms, ${b.over5} of 5 ms or more, ${b.slow} of ${SLOW} ms or more`)
const drawn = got.draws.filter((d) => madeAt !== null && d[0] >= madeAt)
const counts = [...new Set(drawn.map((d) => `${d[3]} ${d[1]}`))]
say(`the draws of the particles after data-made=ready: ${drawn.length}, of ${counts.slice(0, 8).join(', ')}`)
say(`${slowInShakes} writes of ${SLOW} ms or longer in ${shakesWithSlow} of ${spans.length} shakes; ${slowInRests} in the rests between`)
say(`console ${lines.length} ${JSON.stringify(lines.slice(0, 5))}`)
fs.writeFileSync(`out/work/p6s/buf/${name}.json`, JSON.stringify({ url, size, presses, way, shownAt, madeAt, got, lines }))
fs.writeFileSync(`out/work/p6s/buf/${name}.txt`, out.join('\n') + '\n')
