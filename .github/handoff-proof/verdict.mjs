// The last step of every job of the proof: reads what the lines did, checks that every line that was run is written
// in the handoff file, and writes the verdict to the log and to verdict.txt. It always ends with exit code 0: the
// verdict is in what it writes.  node verdict.mjs <folder of the artifact> <name of the job> <names that must be there>
import fs from 'node:fs'
import path from 'node:path'

const out = path.resolve(process.argv[2])
const job = process.argv[3] ?? 'job'
const expect = String(process.argv[4] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
fs.mkdirSync(out, { recursive: true })
const read = (f) => {
  try {
    return fs.readFileSync(path.join(out, f), 'utf8').replace(/^\uFEFF/, '')
  } catch {
    return ''
  }
}
const rows = read('results.tsv').split(/\r?\n/).filter(Boolean).map((l) => {
  const [name, line, code, want, ok, calls, last] = l.split('\t')
  return { name, line, code, want, ok: ok === 'yes', calls, last: last ?? '' }
})
const clone = read('clone-path.txt').trim()
let md = ''
try {
  md = fs.readFileSync(path.join(clone, 'RENDER-ON-YOUR-PC.md'), 'utf8')
} catch {}
const written = new Set([...md.matchAll(/```[a-z]*\r?\n([\s\S]*?)```/g)].flatMap((m) => m[1].split(/\r?\n/)).map((l) => l.trim()).filter(Boolean))
const asWritten = (line) => line.replace(/--branch \S+ https:/, '--branch main https:')
// the job that lists shader messages runs no line of the file: it clones and builds another head with its own lines
const ofFile = process.env.PROOF_MODE !== 'shaders'
const ofTheFile = (line) => ofFile && /^(node tools\/handoff\.mjs|git |cd |winget |brew |node --version)/.test(line)
// the word of the upload's own test is a word of the tool that the file must never name
const TEST_WORD_LINE = 'node tools/handoff.mjs upload-test'
const lines = []
const say = (t = '') => lines.push(t)
say(`===== VERDICT of ${job} =====`)
const problems = []
for (const r of rows) {
  const inFile = r.line === TEST_WORD_LINE ? "the word of the tool's own test: by design no line of the file" : !ofTheFile(r.line) ? 'not a line of the file' : written.has(asWritten(r.line)) ? 'written in the file' : 'NOT WRITTEN IN THE FILE'
  if (inFile.startsWith('NOT')) problems.push(`${r.name}: the line that was run is not in RENDER-ON-YOUR-PC.md`)
  if (!r.ok) problems.push(`${r.name}: exit code ${r.code} where ${r.want} was wanted${r.last ? ` (${r.last.slice(0, 200)})` : ''}`)
  say(`${r.ok ? 'ok   ' : 'FAILS'}  ${r.name}`)
  say(`       line   ${r.line}   (${inFile})`)
  say(`       exit   ${r.code}, wanted ${r.want}, ${r.calls} ${r.calls === '1' ? 'call' : 'calls'}`)
  if (r.last) say(`       said   ${r.last.slice(0, 400)}`)
}
for (const name of expect) if (!rows.some((r) => r.name === name)) problems.push(`${name}: never ran (the job stopped before it)`)
if (!md && ofFile) problems.push('RENDER-ON-YOUR-PC.md was not found in the clone')
if (md.includes('upload-test')) problems.push("RENDER-ON-YOUR-PC.md names the word of the upload's own test, which it must never do")
say('')
const notes = read('notes.txt').split(/\r?\n/).filter(Boolean)
if (notes.length) {
  say('notes:')
  for (const n of notes) say(`  ${n}`)
  say('')
}
for (const n of notes) if (/^PROBLEM: /.test(n)) problems.push(n.slice(9))
say(problems.length ? `VERDICT: FAIL, ${problems.length} ${problems.length === 1 ? 'thing' : 'things'}:` : `VERDICT: PASS, ${rows.length} lines ran as wanted`)
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
process.exit(0)
