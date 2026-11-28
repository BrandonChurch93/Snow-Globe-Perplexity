// What the shader compiler of this machine writes about the shaders of a clone, any clone: the film's own page is
// opened in the installed Chrome as the render opens it, a handful of frames of film B and of the loop are drawn
// small and in one sample so that every program is compiled, and every program's log is listed with its shaders.
// The maths probe of that clone is asked too. Nothing of the clone is changed and nothing is pushed.
//   node shader-warnings.mjs <the clone> <folder to write to> <the folder tools/lib that holds handoff-shaders.mjs>
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const clone = path.resolve(process.argv[2])
const out = path.resolve(process.argv[3])
const lib = path.resolve(process.argv[4])
fs.mkdirSync(out, { recursive: true })
process.chdir(clone)
const git = (...args) => (spawnSync('git', args, { cwd: clone, encoding: 'utf8' }).stdout ?? '').trim()
const S = await import(pathToFileURL(path.join(lib, 'handoff-shaders.mjs')).href)

const head = git('rev-parse', 'HEAD')
const branch = process.env.SHADERS_BRANCH || git('rev-parse', '--abbrev-ref', 'HEAD')
// Two pictures of the walk are kept to look at: fall in storm and fall at rest, which show fall's leaves. They are
// the walk's own pictures, 960 x 540 and one sample, written as the page gave them.
const KEPT = { 'film-b': [2160, 2440] }
const looks = path.join(out, '..', 'looks')
const kept = []
const keep = (what, frame, png) => {
  if (!(KEPT[what] ?? []).includes(frame)) return
  fs.mkdirSync(looks, { recursive: true })
  const name = `${what}-${String(frame).padStart(6, '0')}-walk.png`
  fs.writeFileSync(path.join(looks, name), png)
  kept.push({ name, what, frame, bytes: png.length })
}
// the proof's own trial on a Linux machine has no Chrome: SHADERS_LOCAL=no draws with the pinned browser of the tool tests
const w = await S.walkShaders({ lib: path.join(clone, 'tools', 'lib'), dist: path.join(clone, 'dist'), local: process.env.SHADERS_LOCAL !== 'no', say: (t) => console.log(t), keep })
for (const k of kept) fs.writeFileSync(path.join(looks, `${k.name}.json`), JSON.stringify({ ...k, width: w.format.width, height: w.format.height, samples: 1, branch, head, renderer: w.renderer, browser: w.browser, switches: process.env.SHOWCASE_LOCAL_ARGS ?? '', time: new Date().toISOString() }, null, 1))
const text = S.shaderList(w.seen, S.walkHead(w, [
  'Snow Globe Seasons: what the shader compiler wrote, program by program',
  `written   ${new Date().toISOString()}`,
  `branch    ${branch}`,
  `head      ${head}`,
  `machine   ${process.platform} ${process.arch} ${process.env.ImageOS ?? ''} ${process.env.ImageVersion ?? ''}`.trimEnd(),
]), { srcDir: path.join(clone, 'src') })
fs.writeFileSync(path.join(out, 'shader-messages.txt'), text)
S.writeShaders(w.seen, path.join(out, 'shaders'))
fs.writeFileSync(path.join(out, 'shader-messages.json'), JSON.stringify({ branch, head, renderer: w.renderer, browser: w.browser, maths: w.maths, drawn: w.drawn, notDrawn: w.notDrawn, errors: w.errors, linked: w.seen.linked, withLog: w.seen.logs.length, different: S.briefLogs(w.seen) }, null, 1))
console.log(text)
