// Diagnosis of film frame 2828 (order diag-2828, decision 286). Branch agent/p6-diag-2828, never merged.
// Draws hd film frame 2828 at draft once, in a browser started anew, by the tool's own calls (Session.open, Pages.first, drawJudged with force),
// with the watching script of hook.js in the page, and keeps one record of the stages S, U, T, P, A, C and F beside it.
// usage: node tools/diag-2828/run.mjs <name> [full|lite|trace] [--whatif '<json list>'] [--raw] [--arrays] [--src] [--keep-trace] [--keep-png] [--pictures N --whatifs file.json]
// DIAG_OUT names the folder of the records (default /tmp/l9/d2828/).
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..') + path.sep
const OUT = (process.env.DIAG_OUT || '/tmp/l9/d2828').replace(/\/$/, '') + '/'
fs.mkdirSync(OUT, { recursive: true })
const { Session } = await import(ROOT + 'tools/lib/page.mjs')
const { Pages, drawJudged } = await import(ROOT + 'tools/lib/measures.mjs')

const argv = process.argv.slice(2)
const name = argv[0]
const mode = ['full', 'lite', 'trace'].includes(argv[1]) ? argv[1] : 'full'
const flag = (f) => argv.includes(f)
const valueOf = (f) => (argv.includes(f) ? argv[argv.indexOf(f) + 1] : undefined)
const whatifs = valueOf('--whatifs') ? JSON.parse(fs.readFileSync(valueOf('--whatifs'), 'utf8')) : [valueOf('--whatif') ? JSON.parse(valueOf('--whatif')) : []]
const refFile = OUT + 'ref.json'
const ref = fs.existsSync(refFile) ? JSON.parse(fs.readFileSync(refFile, 'utf8')) : null
const X = 731
const Y = 694
// --delay <word>:<ms>[,<word>:<ms>] holds back the loads whose address holds the word
const delays = (valueOf('--delay') ?? '').split(',').filter(Boolean).map((t) => ({ word: t.split(':')[0], ms: Number(t.split(':')[1]) }))
const cfg = { mode, x: X, y: Y, w: 1920, h: 1080, whatif: whatifs[0], keepRaw: flag('--raw'), keepArrays: flag('--arrays') || mode === 'trace', keepSrc: flag('--src') || mode === 'trace' }
if (ref && mode !== 'trace' && !flag('--raw')) {
  cfg.refReads = ref.readHashes
  cfg.refUps = ref.upHashes
}
const hook = `window.__D_CFG = ${JSON.stringify(cfg)};\n` + fs.readFileSync(HERE + '/hook.js', 'utf8')
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex')
const sha16 = (s) => sha(s).slice(0, 16)

const TEX = /^(texImage|texSubImage|texStorage|compressedTex|generateMipmap|copyTexImage|copyTexSubImage|deleteTexture|createTexture)/
const UP = /^buffer(Sub)?Data /
const UNI = /^uniform/
const DRAW = /^draw(Arrays|Elements|RangeElements)/

/** The kept lines by their place in the run: before the first sample, each sample (drawing, adding), between samples, after the last. */
function stages(lines) {
  const samples = []
  let cur = null
  let part = 'load'
  const load = []
  const resolve = []
  const after = []
  let gap = load
  const tex = []
  for (const l of lines) {
    let m
    if ((m = /^#sample (\d+) begin/.exec(l))) {
      cur = { k: Number(m[1]), gap, draw: [], add: [], texBefore: tex.length }
      samples.push(cur)
      part = 'draw'
      continue
    }
    if (/^#sample \d+ drawn/.test(l)) {
      part = 'add'
      continue
    }
    if (/^#sample \d+ added/.test(l)) {
      cur.texAfter = tex.length
      cur.texHash = sha16(tex.join('\n'))
      part = 'gap'
      gap = []
      continue
    }
    if (l === '#grab') {
      part = 'after'
      continue
    }
    if (TEX.test(l)) tex.push(l)
    if (part === 'load') load.push(l)
    else if (part === 'draw') cur.draw.push(l)
    else if (part === 'add') cur.add.push(l)
    else if (part === 'gap') gap.push(l)
    else after.push(l)
  }
  // what follows the last sample and comes before the picture is handed over
  resolve.push(...gap)
  const out = { load: { lines: load.length, hash: sha16(load.join('\n')), tex: load.filter((l) => TEX.test(l)).length }, samples: [], resolve: { lines: resolve.length, hash: sha16(resolve.join('\n')) }, after: { lines: after.length } }
  for (const s of samples) {
    const all = [...s.draw, ...s.add]
    const noRead = all.filter((l) => !l.startsWith('readPixels') && !l.startsWith('bindFramebuffer'))
    out.samples.push({
      k: s.k,
      gapLines: s.k === 0 ? load.length : s.gap.length,
      gapHash: sha16(s.gap.join('\n')),
      gapTex: s.gap.filter((l) => TEX.test(l)).length,
      U: { all: sha16(noRead.join('\n')), up: sha16(all.filter((l) => UP.test(l)).join('\n')), uni: sha16(all.filter((l) => UNI.test(l)).join('\n')), draw: sha16(all.filter((l) => DRAW.test(l)).join('\n')), lines: all.length, ups: all.filter((l) => UP.test(l)).length, unis: all.filter((l) => UNI.test(l)).length, draws: all.filter((l) => DRAW.test(l)).length },
      T: { hash: s.texHash, uploadsSoFar: s.texAfter, inSample: s.texAfter - s.texBefore },
    })
  }
  return out
}

const consoleLines = []
const session = await Session.open({ what: `diag 2828 ${name}` })
let code = 0
try {
  const make = session.browser.newContext.bind(session.browser)
  session.browser.newContext = async (...a) => {
    const c = await make(...a)
    await c.addInitScript({ content: hook })
    // what-if on the loads themselves, nothing changed in the page: the answers to the requests whose address holds the word are held back by so many milliseconds
    for (const d of delays) {
      await c.route(
        (url) => url.pathname.includes(d.word),
        async (route) => {
          await new Promise((r) => setTimeout(r, d.ms))
          await route.continue()
        },
      )
    }
    c.on('console', (m) => consoleLines.push(`${m.type()}: ${m.text()}`))
    c.on('weberror', (e) => consoleLines.push(`weberror: ${String(e.error()?.message ?? e.error())}`))
    return c
  }
  const pages = new Pages(session)
  const page = await pages.first()
  await page.evaluate(() => window.__d2828.install())
  if (mode === 'full') await page.evaluate(([x, y]) => window.showcase.dev.watchSamples(true, { x, y }), [X, Y])
  const entry = { id: 'trial-film-2828', kind: 'film', format: 'hd', camera: 'hero', frame: 2828 }
  for (let pic = 0; pic < whatifs.length; pic++) {
    const tag = whatifs.length > 1 ? `${name}-${String(pic).padStart(2, '0')}` : name
    if (pic > 0) await page.evaluate((w) => window.__d2828.again(w), whatifs[pic])
    const view = await drawJudged(session, pages, entry, { tier: 'draft', diag: '', force: true })
    const png = fs.readFileSync(view.file)
    const F = sha(png)
    const got = await page.evaluate(() => {
      const D = window.__d2828
      const progs = {}
      return { made: D.made(), meshes: window.showcase.dev.meshes(), S: D.S, reads: D.reads, ups: D.ups, C: D.C, fetches: D.fetches, bitmaps: D.bitmaps, px: D.px, notes: D.notes, facts: window.showcase.dev.sampleFacts(), lines: D.lines.length, drawNo: D.drawNo, raws: D.raws.map((r) => ({ ...r, data: undefined, bytes: r.data.length })), lost: window.__contextLost, progs }
    })
    const lines = []
    for (let a = 0; a < got.lines; a += 40000) lines.push(...(await page.evaluate(([from, to]) => window.__d2828.lines.slice(from, to).join('\n'), [a, a + 40000])).split('\n'))
    const st = stages(lines)
    const P = got.reads.filter((r) => r.w === 1920 && r.h === 1080 && r.sample >= 0)
    const Astrips = got.reads.filter((r) => r.w === 1920 && r.h > 1 && r.h < 1080 && r.sample < 0)
    const rec = {
      name: tag,
      mode,
      whatif: whatifs[pic],
      delays,
      notes: got.notes,
      head: 'see status',
      F,
      C: got.C,
      A: { hash: sha16(Astrips.map((r) => r.hash).join(' ')), strips: Astrips.map((r) => r.hash) },
      P: P.map((r, i) => ({ sample: r.sample, hash: r.hash, at: got.facts[i]?.at ?? null, peak: got.facts[i]?.peak ?? null })),
      S: got.S.map((s) => ({ k: s.k, hash: sha16(JSON.stringify([s.count, s.step, s.arrays, s.metaHash, s.liquid, s.cover])), count: s.count, step: s.step, arrays: s.arrays, metaHash: s.metaHash, owed: s.owed, memory: s.memory, programs: s.programs, meta: s.meta })),
      stages: st,
      loadOrder: { fetchEnds: sha16(got.fetches.filter((f) => f.method === 'GET').sort((a, b) => a.end - b.end).map((f) => f.url).join('\n')), bitmapsDone: sha16([...got.bitmaps].sort((a, b) => a.done - b.done).map((b) => b.tag).join('\n')), fetches: got.fetches.length, bitmaps: got.bitmaps.length },
      timings: view.record.timings,
      seconds: view.record.seconds,
      errors: view.record.errors,
      console: consoleLines.length,
      contextLost: got.lost,
      crashed: !!page.crashed,
      browser: session.browserVersion,
      drawNo: got.drawNo,
      traceLines: lines.length,
      traceHash: sha16(lines.join('\n')),
    }
    // which stages are not the reference's, in the order of the stages
    const differs = []
    if (ref && ref.S) {
      const ss = st.samples
      for (const k of [0, 1]) if (rec.S[k]?.hash !== ref.S[k]) differs.push(`S${k}`)
      for (const k of [0, 1]) for (const [part, word] of [['up', 'uploads'], ['uni', 'uniforms'], ['draw', 'draws'], ['all', 'all']]) if (ss[k]?.U[part] !== ref.U[k][part]) differs.push(`U${k}.${word}`)
      for (const k of [0, 1]) if (ss[k]?.T.hash !== ref.T[k]) differs.push(`T${k}`)
      if (mode === 'full') for (const k of [0, 1]) if (rec.P[k]?.hash !== ref.P[k]) differs.push(`P${k}`)
      if (rec.A.hash !== ref.A) differs.push('A')
      if (rec.C?.hash !== ref.C) differs.push('C')
      if (F !== ref.F) differs.push('F')
    }
    rec.differs = differs
    rec.made = got.made
    const detail = { meshes: got.meshes, fetches: got.fetches, bitmaps: got.bitmaps, reads: got.reads, ups: got.ups, px: got.px, S: got.S, raws: got.raws }
    const odd = ref && F !== ref.F
    const firstOfAll = !ref && mode !== 'trace'
    fs.writeFileSync(`${OUT}${tag}.json`, JSON.stringify(rec, null, 1))
    const other = ref && (rec.traceHash !== ref.traceHash?.[mode] || odd || differs.length > 0)
    if (flag('--keep-trace') || mode === 'trace' || firstOfAll || other || !ref?.traceHash?.[mode]) {
      fs.writeFileSync(`${OUT}${tag}.trace.gz`, zlib.gzipSync(lines.join('\n')))
      fs.writeFileSync(`${OUT}${tag}.detail.json.gz`, zlib.gzipSync(JSON.stringify(detail)))
    }
    if (flag('--keep-png') || odd || firstOfAll || mode === 'trace' || whatifs.length > 1 || whatifs[0].length) fs.copyFileSync(view.file, `${OUT}${tag}.png`)
    if (consoleLines.length) fs.writeFileSync(`${OUT}${tag}.console.txt`, consoleLines.join('\n') + '\n')
    // whole samples, strips of the mean and uploads that the page kept (asked for, or not among the reference's)
    for (let i = 0; i < got.raws.length; i++) {
      const r = got.raws[i]
      const file = `${OUT}${tag}.${r.what}${r.what === 'A' ? `-y${r.y}` : `-s${r.sample}`}${r.what === 'U' ? `-n${r.n}-${r.buf}` : ''}.raw`
      const fd = fs.openSync(file, 'w')
      for (let from = 0; from < r.bytes; from += 6 << 20) {
        const b64 = await page.evaluate(([j, a, b]) => {
          const u8 = window.__d2828.raws[j].data.subarray(a, b)
          let s = ''
          for (let o = 0; o < u8.length; o += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(o, o + 0x8000))
          return btoa(s)
        }, [i, from, Math.min(r.bytes, from + (6 << 20))])
        fs.writeSync(fd, Buffer.from(b64, 'base64'))
      }
      fs.closeSync(fd)
    }
    if (mode === 'trace') {
      // the particles that were found on the watched pixel, as the simulation held them at each sample
      const idx = [...new Set(got.px.flatMap((p) => (p.units?.found ?? []).map((f) => f.index)))]
      const parts = await page.evaluate((list) => {
        const D = window.__d2828
        const src = window.__diag.particles
        return D.kept.map((k) => list.map((i) => ({ index: i, kind: src.kinds[k.kindOf[i]], kindOf: k.kindOf[i], size: k.sizes[i], opacity: k.opacity ? k.opacity[i] : null, phase: k.phase ? k.phase[i] : null, state: k.state[i], pos: [k.pos[i * 3], k.pos[i * 3 + 1], k.pos[i * 3 + 2]], prev: [k.prev[i * 3], k.prev[i * 3 + 1], k.prev[i * 3 + 2]] })))
      }, idx)
      fs.writeFileSync(`${OUT}${tag}.particles.json`, JSON.stringify(parts, null, 1))
      const src = await page.evaluate(() => window.__d2828.src)
      fs.writeFileSync(`${OUT}${tag}.shaders.json.gz`, zlib.gzipSync(JSON.stringify(src)))
    }
    const s0 = rec.S[0] ?? {}
    const s1 = rec.S[1] ?? {}
    const u0 = st.samples[0] ?? { U: {}, T: {} }
    const u1 = st.samples[1] ?? { U: {}, T: {} }
    console.log(
      [tag, mode, `F=${F.slice(0, 16)}`, `C=${got.C?.hash ?? '-'}`, `A=${rec.A.hash}`, `P=${rec.P.map((p) => p.hash).join('/') || '-'}`, `U=${u0.U.all}/${u1.U.all}`, `T=${u0.T.hash}/${u1.T.hash}`, `S=${s0.hash}/${s1.hash}`, `load=${st.load.hash}`, `trace=${rec.traceHash}`, `steps=${view.record.timings.steps}`, `sec=${view.record.seconds.toFixed(1)}`, `console=${consoleLines.length}`, `lost=${got.lost}`, `made=${got.made.map((m) => `${m.season}:${m.idMin}-${m.idMax}`).join(',')}`, `order=${rec.loadOrder.fetchEnds.slice(0, 6)}/${rec.loadOrder.bitmapsDone.slice(0, 6)}`, `differs=${ref && ref.S ? differs.join(',') || 'nothing' : 'no reference'}`].join(' '),
    )
  }
} catch (e) {
  console.log(`${name} FAILED ${String(e?.stack ?? e)}`)
  code = 1
} finally {
  await session.close()
}
process.exit(code)
