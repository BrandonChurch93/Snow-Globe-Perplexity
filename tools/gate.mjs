import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs, rel, readJson, writeJson } from './lib/paths.mjs'
import { fileSha, listFiles } from './lib/hashes.mjs'
import { compareFiles, pixels, stats } from './lib/pixels.mjs'

const args = parseArgs(process.argv.slice(2))
const phase = Number(args.phase)
if (!Number.isInteger(phase) || phase < 0 || phase > 6) throw new Error('give --phase N, from 0 to 6')
const cfg = readJson(rel('config', 'showcase.json'))
const only = args.only && args.only !== true ? String(args.only).split(',') : null
const dir = rel('out', 'work', 'gate')
fs.mkdirSync(dir, { recursive: true })
const run = (cmd, argv, opts = {}) => spawnSync(cmd, argv, { cwd: rel(), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts })
const tail = (text, n = 12) => String(text ?? '').trim().split('\n').slice(-n).join('\n')
const git = (...a) => run('git', a).stdout

const checks = {}

checks.G1 = {
  from: 0,
  name: 'the build is clean',
  async run() {
    const t = Date.now()
    const r = run('npm', ['run', 'build'])
    return { pass: r.status === 0, detail: r.status === 0 ? `npm run build exited 0 in ${((Date.now() - t) / 1000).toFixed(1)} s, no type errors` : tail(r.stdout + r.stderr) }
  },
}

checks.G2 = {
  from: 0,
  name: 'unit tests',
  async run() {
    const out = path.join(dir, 'tests.json')
    fs.rmSync(out, { force: true })
    const r = run('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${out}`])
    if (!fs.existsSync(out)) return { pass: false, detail: tail(r.stdout + r.stderr) }
    const j = readJson(out)
    const failed = j.numFailedTests + (j.numFailedTestSuites ?? 0)
    return { pass: r.status === 0 && failed === 0, detail: `${j.numPassedTests} of ${j.numTotalTests} tests pass in ${j.testResults.length} files${failed ? `, ${failed} fail` : ''}` }
  },
}

checks.G3 = {
  from: 0,
  name: 'determinism',
  async run() {
    const r = run('node', ['tools/determinism.mjs', ...(phase >= 2 ? ['--film'] : [])])
    const file = rel('out', 'work', 'determinism', 'result.json')
    if (!fs.existsSync(file)) return { pass: false, detail: tail(r.stdout + r.stderr) }
    const j = readJson(file)
    const bad = j.pictures.filter((p) => !p.identical)
    return {
      pass: r.status === 0 && j.pass,
      detail: j.pass
        ? `${new Set(j.pictures.map((p) => p.picture)).size} pictures pixel-identical across ${j.passes.length} fresh page loads in ${j.passes.length} orders (${j.format}, ${j.tier}${j.film ? ', with a late film frame and a loop frame' : ', stills in the three states'})`
        : `${bad.length} comparisons differ: ${bad.slice(0, 4).map((p) => `${p.picture} pass ${p.pass} (${p.differing} pixels)`).join(', ')}${j.pageErrors.length ? `; page messages: ${j.pageErrors[0]}` : ''}`,
    }
  },
}

checks.G4 = {
  from: 0,
  name: 'sizes and counts',
  async run() {
    const { Session, stillSpec, renderStill } = await import('./lib/page.mjs')
    const session = await Session.open({ what: 'gate G4' })
    const problems = []
    const seen = []
    let counts
    try {
      for (const f of Object.values(cfg.formats)) {
        const r = await renderStill(session, stillSpec({ season: cfg.defaultSeason, state: 'rest', camera: 'hero', tier: 'draft', format: f.id }))
        const p = await pixels(r.file)
        seen.push(`${f.id} ${p.width} x ${p.height}`)
        if (p.width !== f.width || p.height !== f.height) problems.push(`a ${f.id} still is ${p.width} x ${p.height}, not ${f.width} x ${f.height}`)
      }
      const page = await session.page({ format: cfg.formats.preview.id })
      counts = await page.evaluate(() => ({ film: window.showcase.film().frameCount, loop: window.showcase.loop().frameCount, opening: window.showcase.opening().frameCount }))
      await page.context().close()
    } finally {
      await session.close()
    }
    const formats = Object.fromEntries(Object.values(cfg.formats).map((f) => [f.id, f]))
    let kept = 0
    for (const file of listFiles(rel('out', 'work', 'stills')).filter((f) => f.endsWith('.png'))) {
      if (!fs.existsSync(`${file}.json`)) continue
      const rec = readJson(`${file}.json`)
      const f = formats[rec.format]
      const p = await pixels(file)
      kept++
      if (!f || p.width !== f.width || p.height !== f.height) problems.push(`${path.basename(file)} is ${p.width} x ${p.height}, its format ${rec.format} is ${f ? `${f.width} x ${f.height}` : 'unknown'}`)
    }
    const loopWant = Math.round(cfg.deliver.cardLoop.seconds * cfg.film.fps)
    if (counts.loop !== loopWant) problems.push(`loop().frameCount is ${counts.loop}, not ${loopWant}`)
    let filmNote = ''
    if (phase >= 2) {
      const cut = rel('cut', 'CUTLIST.json')
      if (!fs.existsSync(cut)) problems.push('cut/CUTLIST.json does not exist')
      else {
        const want = readJson(cut).frameCount
        if (counts.film !== want) problems.push(`film().frameCount is ${counts.film}, cut/CUTLIST.json says ${want}`)
        filmNote = `, film().frameCount ${counts.film} matches the cut list`
      }
    }
    return { pass: problems.length === 0, detail: problems.length ? problems.join('; ') : `a still in every format has its exact size (${seen.join(', ')}), ${kept} stills on disk agree with their records, loop().frameCount is ${counts.loop}${filmNote}` }
  },
}

checks.G8 = {
  from: 0,
  name: 'sources and recipes',
  async run() {
    const assetsMd = fs.readFileSync(rel('ASSETS.md'), 'utf8')
    const recipes = listFiles(rel('assets-src')).filter((f) => path.basename(f) === 'RECIPE.md')
    const recipeText = recipes.map((f) => fs.readFileSync(f, 'utf8')).join('\n')
    const heads = [...recipeText.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim())
    const covered = (p) =>
      heads.some((h) => {
        if (h === p) return true
        if (h.endsWith('/') && p.startsWith(h)) return true
        if (h.includes('*')) return new RegExp(`^${h.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')}$`).test(p)
        return false
      })
    const shipped = [...listFiles(rel('public')), ...listFiles(rel('assets-full'))].map((f) => path.relative(rel(), f).split(path.sep).join('/'))
    const builtByBuild = new Set(['public/assets/index.json'])
    const problems = []
    let third = 0
    let made = 0
    for (const p of shipped) {
      if (builtByBuild.has(p)) continue
      if (assetsMd.includes(p)) third++
      else if (covered(p)) made++
      else problems.push(`${p} has neither a row in ASSETS.md nor a recipe in assets-src/`)
    }
    for (const f of recipes) {
      const text = fs.readFileSync(f, 'utf8')
      for (const block of text.split(/^## /m).slice(1)) {
        for (const field of ['Made by:', 'From:', 'Prompt or command:', 'Takes:', 'Why this one:', 'Date:']) if (!block.includes(field)) problems.push(`${path.relative(rel(), f)}: "${block.split('\n')[0]}" has no "${field}" line`)
      }
    }
    const kept = fs.existsSync(rel('audio', 'kept')) ? listFiles(rel('audio', 'kept')).filter((f) => /\.(wav|mp3|flac|ogg|m4a)$/.test(f)) : []
    const sounds = [...kept, ...listFiles(rel('public', 'audio')).filter((f) => /\.(wav|mp3|flac|ogg|m4a|bin)$/.test(f))]
    const soundIndex = rel('audio', 'RECORDS.json')
    const records = fs.existsSync(soundIndex) ? readJson(soundIndex) : { kept: [] }
    for (const s of kept) if (!fs.existsSync(`${s}.json`)) problems.push(`${path.relative(rel(), s)} has no record beside it`)
    for (const k of records.kept ?? []) if (!assetsMd.includes(k.cue)) problems.push(`the kept sound ${k.cue} has no row in ASSETS.md`)
    return { pass: problems.length === 0, detail: problems.length ? problems.slice(0, 8).join('; ') : `${shipped.length} shipped files checked: ${third} third-party with rows, ${made} made with recipes, ${shipped.length - third - made} written by the build; ${recipes.length} recipe files well formed; ${sounds.length} sound files and ${(records.kept ?? []).length} kept sound records in order` }
  },
}

const SECRETS = [
  ['a private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['an sk key', /\bsk[-_](?:live_|proj-)?[A-Za-z0-9]{32,}\b/],
  ['a GitHub token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b/],
  ['an AWS key id', /\bAKIA[0-9A-Z]{16}\b/],
  ['an api key header with a value', /xi-api-key["']?\s*[:=]\s*["']?[A-Za-z0-9_]{24,}/i],
  ['a bearer token', /Bearer\s+[A-Za-z0-9._-]{40,}/],
  ['a pplx key', /\bpplx-[A-Za-z0-9]{32,}\b/],
  ['a Google key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['a Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
]

checks.G9 = {
  from: 0,
  name: 'the repo',
  async run() {
    const files = git('ls-files', '-z').split('\0').filter(Boolean)
    const problems = []
    let total = 0
    let largest = { size: 0, file: '' }
    for (const f of files) {
      const p = rel(f)
      if (!fs.existsSync(p)) continue
      const size = fs.statSync(p).size
      total += size
      if (size > largest.size) largest = { size, file: f }
      if (size > cfg.repo.maxFileMb * 1048576) problems.push(`${f} is ${(size / 1048576).toFixed(1)} MB, over repo.maxFileMb`)
      if (size < 3 * 1048576 && !/\.(png|jpg|jpeg|webp|mp4|webm|mov|wav|mp3|flac|ogg|glb|bin|ktx2|woff2?|ttf|otf|zip|gz|pdf|ico|exr|hdr)$/i.test(f)) {
        const text = fs.readFileSync(p, 'utf8')
        for (const [what, re] of SECRETS) if (re.test(text)) problems.push(`${f} holds what looks like ${what}`)
      }
    }
    if (total > cfg.repo.maxTreeGb * 1073741824) problems.push(`the tracked files are ${(total / 1073741824).toFixed(2)} GB, over repo.maxTreeGb`)
    for (const d of ['references/cache', 'out/work']) {
      const tracked = git('ls-files', d).trim()
      if (tracked) problems.push(`${d}/ has tracked files: ${tracked.split('\n').slice(0, 3).join(', ')}`)
    }
    for (const name of ['.env']) if (files.includes(name)) problems.push(`${name} is tracked`)
    const manifest = fs.readFileSync(rel('references', 'approved', 'MANIFEST.sha256'), 'utf8').trim().split('\n')
    let held = 0
    for (const line of manifest) {
      const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/)
      if (!m) continue
      const p = rel('references', 'approved', m[2])
      if (!fs.existsSync(p)) problems.push(`references/approved/${m[2]} is missing`)
      else if (fileSha(p) !== m[1]) problems.push(`references/approved/${m[2]} no longer has its listed hash`)
      else held++
    }
    return { pass: problems.length === 0, detail: problems.length ? problems.slice(0, 8).join('; ') : `${files.length} tracked files, ${(total / 1048576).toFixed(0)} MB in all, the largest ${(largest.size / 1048576).toFixed(1)} MB (${largest.file}); no secret found; references/cache/ and out/work/ untracked; ${held} of ${manifest.length} approved files hold their hashes` }
  },
}

checks.G10 = {
  from: 0,
  name: 'portable WebGL2',
  async run() {
    const caps = readJson(rel('config', 'webgl-caps.json'))
    const portable = new Set(caps.extensions.filter((e) => e.portable).map((e) => e.name))
    const notPortable = caps.extensions.filter((e) => !e.portable).map((e) => e.name)
    const problems = []
    const asked = new Set()
    for (const f of listFiles(rel('src')).filter((f) => /\.(ts|glsl)$/.test(f))) {
      const text = fs.readFileSync(f, 'utf8')
      for (const m of text.matchAll(/getExtension\(\s*['"`]([A-Za-z0-9_]+)['"`]/g)) asked.add(m[1])
      if (/#extension\s+GL_/.test(text)) problems.push(`${path.relative(rel(), f)} enables a shader extension`)
    }
    const optional = new Set(['EXT_color_buffer_half_float'])
    for (const name of asked) if (!portable.has(name) && !optional.has(name)) problems.push(`src asks for ${name}, which is not marked portable`)
    const { Session, stillSpec, renderStill } = await import('./lib/page.mjs')
    const session = await Session.open({ what: 'gate G10' })
    const spec = stillSpec({ season: cfg.defaultSeason, state: 'rest', camera: 'hero', tier: 'draft', format: cfg.formats.preview.id })
    const file = (n) => path.join(dir, `g10-${n}.png`)
    const runs = {}
    try {
      runs.all = await renderStill(session, spec, { file: file('all'), force: true })
      runs.portable = await renderStill(session, spec, { file: file('portable-only'), noext: notPortable, force: true })
      runs.half = await renderStill(session, spec, { file: file('half-float'), noext: ['EXT_color_buffer_float'], force: true })
      runs.byte = await renderStill(session, spec, { file: file('no-float'), noext: ['EXT_color_buffer_float', 'EXT_color_buffer_half_float'], force: true })
    } finally {
      await session.close()
    }
    const expected = (k, line) => (k === 'half' || k === 'byte') && /^warning: THREE\.WebGLRenderer: EXT_color_buffer_float extension not supported\.$/.test(line)
    for (const [k, r] of Object.entries(runs)) {
      const logged = r.record.errors.filter((line) => !expected(k, line))
      if (logged.length) problems.push(`the ${k} run logged: ${logged[0]}`)
    }
    const same = await compareFiles(runs.all.file, runs.portable.file)
    if (!same.identical) problems.push(`with every extension that is not portable denied the still differs in ${same.differing} pixels`)
    if (runs.portable.record.precision !== 'float32') problems.push(`with only portable extensions the accumulation is ${runs.portable.record.precision}`)
    const half = await compareFiles(runs.all.file, runs.half.file)
    if (runs.half.record.precision !== 'half') problems.push(`without EXT_color_buffer_float the path is ${runs.half.record.precision}, not half float`)
    if (!(half.psnr >= 40)) problems.push(`the half float path is only ${half.psnr.toFixed(1)} dB from the float path`)
    const byte = await compareFiles(runs.all.file, runs.byte.file)
    const lum = await stats(runs.byte.file)
    if (lum.max - lum.min < 40) problems.push('with no float target at all the picture is blank')
    return {
      pass: problems.length === 0,
      detail: problems.length
        ? problems.slice(0, 6).join('; ')
        : `src asks for ${[...asked].join(', ')}; with all ${notPortable.length} extensions that are not portable denied the still is pixel-identical; without EXT_color_buffer_float it renders on the half float path at ${half.psnr.toFixed(1)} dB from the float path; with no float target it still renders (${byte.psnr.toFixed(1)} dB)`,
    }
  },
}

const wanted = Object.entries(checks).filter(([id, c]) => c.from <= phase && (!only || only.includes(id)))
const results = []
for (const [id, c] of wanted) {
  const t = Date.now()
  let r
  try {
    r = await c.run()
  } catch (e) {
    r = { pass: false, detail: `the check itself failed: ${e.message}` }
  }
  const line = { id, name: c.name, pass: !!r.pass, detail: r.detail, seconds: (Date.now() - t) / 1000 }
  results.push(line)
  console.log(`${id} ${line.pass ? 'pass' : 'FAIL'} · ${c.name}: ${r.detail}`)
}
const file = path.join(dir, `phase-${phase}.json`)
const before = fs.existsSync(file) && only ? readJson(file).results.filter((r) => !only.includes(r.id)) : []
const all = [...before, ...results].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)))
const { engineHash } = await import('./lib/hashes.mjs')
writeJson(file, { phase, time: new Date().toISOString(), engineHash: engineHash(), commit: git('rev-parse', '--short', 'HEAD').trim(), results: all })
fs.writeFileSync(path.join(dir, `phase-${phase}.md`), all.map((r) => `- ${r.id} ${r.pass ? 'pass' : 'FAIL'} · ${r.name}: ${r.detail}`).join('\n') + '\n')
const red = all.filter((r) => !r.pass)
console.log(red.length ? `gate, phase ${phase}: ${red.length} red (${red.map((r) => r.id).join(', ')})` : `gate, phase ${phase}: all ${all.length} green`)
process.exit(results.some((r) => !r.pass) ? 1 : 0)
