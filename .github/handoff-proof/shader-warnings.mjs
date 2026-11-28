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
// the proof's own trial on a Linux machine has no Chrome: SHADERS_LOCAL=no draws with the pinned browser of the tool tests
const w = await S.walkShaders({ lib: path.join(clone, 'tools', 'lib'), dist: path.join(clone, 'dist'), local: process.env.SHADERS_LOCAL !== 'no', say: (t) => console.log(t) })
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
