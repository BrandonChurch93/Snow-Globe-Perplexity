// The last step checks the exact guide command and separately verifies permitted substitutions.
// node verdict.mjs <folder of the artifact> <job name> <names that must be there>
import fs from 'node:fs'
import path from 'node:path'
import { bootstrapGuide, chooseGuideLine, guideCommands, planGuideLine } from './guide-lines.mjs'

const out = path.resolve(process.argv[2])
const job = process.argv[3] ?? 'job'
const mode = process.env.PROOF_MODE ?? ''
const expect = new Set(String(process.argv[4] ?? '').split(',').map((s) => s.trim()).filter(Boolean))
fs.mkdirSync(out, { recursive: true })
const readFile = (file) => {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  } catch {
    return ''
  }
}
const read = (f) => readFile(path.join(out, f))
const rows = read('results.tsv').split(/\r?\n/).filter(Boolean).map((l) => {
  const [name, line, code, want, ok, calls, last, json] = l.split('\t')
  let evidence = null
  try { evidence = JSON.parse(json) } catch {}
  return { name, line, code, want, ok: ok === 'yes', calls, last: last ?? '', evidence }
})
const clone = read('clone-path.txt').trim()
const md = clone ? readFile(path.join(clone, 'RENDER-ON-YOUR-PC.md')) : ''
const written = { bootstrap: guideCommands(readFile(bootstrapGuide)), clone: guideCommands(md) }
const shaderRows = new Set(['clone', 'cd', 'checkout', 'install', 'build', 'shader-list', 'still-fall-rest'])
const TEST_WORD_LINE = 'node tools/handoff.mjs upload-test'
const lines = []
const say = (t = '') => lines.push(t)
say(`===== VERDICT of ${job} =====`)
const problems = []
let pictureOnly = false

function provenance(r) {
  const e = r.evidence
  if (mode === 'shaders' && shaderRows.has(r.name) && !e) return { label: 'the shader job ran its own line, not a guide command' }
  if (mode === 'upload' && r.name === 'upload-test' && r.line === TEST_WORD_LINE && !e) return { label: "the upload's own test, by design not a guide command" }
  if (e?.source !== 'bootstrap' && e?.source !== 'clone') return { problem: 'no recorded guide source for the command that ran' }
  try {
    const checked = planGuideLine(written[e.source], e.selector, e.source, { branch: process.env.PROOF_BRANCH ?? e.branch })
    if (e.original !== checked.original || e.actual !== checked.actual || e.change !== checked.change || e.branch !== checked.branch ||
        r.line !== e.actual.replace(/\t/g, ' ')) {
      return { problem: 'the command that ran does not match the guide or a permitted proof substitution' }
    }
    const where = e.source === 'bootstrap' ? 'helper checkout' : 'film clone'
    if (e.actual === e.original) return { label: 'written in the file', where }
    return { label: `changed for this proof: ${checked.change}`, original: e.original, where }
  } catch (e) {
    return { problem: e.message }
  }
}

for (const r of rows) {
  const from = provenance(r)
  const start = problems.length
  if (from.problem) problems.push(`${r.name}: ${from.problem}`)
  if (!r.ok) problems.push(`${r.name}: MEASURED exit ${r.code}, STATED wanted ${r.want}${r.last ? ` (${r.last.slice(0, 200)})` : ''}`)
  if (r.evidence?.selector === 'test' && r.want === '0' && r.code === '0') {
    const ending = read(`${r.name}.out.txt`).trim().split(/\r?\n/).at(-1) || r.last
    if (/^PASS: the picture passed on .+ and the render is not ready:\s*\S/.test(ending)) {
      pictureOnly = true
      if (job !== 'windows-3840') problems.push(`${r.name}: this job needs a render-ready short test, not a picture-only pass`)
    } else if (!/^PASS: (?!the picture passed on )/.test(ending) || ending.includes('the render is not ready')) {
      problems.push(`${r.name}: no terminal short-test pass was recorded`)
    }
  }
  say(`${problems.length === start ? 'ok   ' : 'FAILS'}  ${r.name}`)
  say(`       line   ${from.problem ? r.line : r.evidence?.actual ?? r.line}   (${from.label ?? 'not proven to be written in the file'})`)
  if (from.original) say(`       guide  ${from.original}`)
  if (from.where) say(`       from   RENDER-ON-YOUR-PC.md in the ${from.where}`)
  say(`       exit   MEASURED ${r.code}, STATED wanted ${r.want}, MEASURED ${r.calls} ${r.calls === '1' ? 'call' : 'calls'}`)
  if (r.last) say(`       said   ${r.last.slice(0, 400)}`)
}

if (['small', 'uhd', 'installs'].includes(mode)) {
  expect.add('status-before-clone').add('status-after-clone')
  if (job.startsWith('macos-')) expect.add('brew-version')
}
if (mode === 'small') {
  try {
    if (chooseGuideLine(written.clone, 'approve-render', true)) {
      expect.add('render-refuses-unapproved').add('approve-render-before-first').add('approve-render-after-mid-test')
      if (rows.some((r) => r.name === 'test-after-update')) expect.add('approve-render-after-update')
      for (const r of rows) if (r.name.startsWith('test-after-real-update-')) expect.add(r.name.replace(/^test-/, 'approve-render-'))
    }
    if (chooseGuideLine(written.clone, 'approve-upload', true)) expect.add('approve-upload-before-deliver').add('approve-upload-refuses')
  } catch (e) {
    problems.push(e.message)
  }
}
// with a released stamp the flows leave the render line out (it would start the real render), so it is not wanted then
let released = false
try {
  released = JSON.parse(fs.readFileSync(path.join(clone, 'render', 'STAMP.json'), 'utf8')).releasedForFinalRender === true
} catch {}
for (const name of expect) {
  if (name === 'render-refuses-unreleased' && released) continue
  if (!rows.some((r) => r.name === name)) problems.push(`${name}: never ran (the job stopped before it)`)
}
if (!rows.length) problems.push('no command results were recorded')
if (!md && mode !== 'shaders') problems.push('RENDER-ON-YOUR-PC.md was not found in the clone')
if (md.includes('upload-test')) problems.push("RENDER-ON-YOUR-PC.md names the word of the upload's own test, which it must never do")
say('')
const notes = read('notes.txt').split(/\r?\n/).filter(Boolean)
if (notes.length) {
  say('notes:')
  for (const n of notes) say(`  ${n}`)
  say('')
}
for (const n of notes) if (/^PROBLEM: /.test(n)) problems.push(n.slice(9))
say(problems.length ? `VERDICT: FAIL, MEASURED ${problems.length} ${problems.length === 1 ? 'problem' : 'problems'}:` : `VERDICT: PASS, MEASURED ${rows.length} lines ran as wanted${pictureOnly ? ' (picture only; render not ready)' : ''}`)
for (const p of problems) say(`  - ${p}`)
say(`===== END OF VERDICT of ${job} =====`)
const text = lines.join('\n') + '\n'
console.log(text)
fs.writeFileSync(path.join(out, 'verdict.txt'), text)
if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### ${job}\n\n\`\`\`\n${text}\`\`\`\n`)
  } catch {}
}
process.exitCode = problems.length ? 1 : 0
