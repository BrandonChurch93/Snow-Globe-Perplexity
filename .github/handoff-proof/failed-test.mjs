// After a short test that failed, or after one that passed following it: looks for the one folder a failed test
// leaves on the Desktop for the build thread, and says in one line what it found. A line that begins with PROBLEM
// fails the verdict of the job.   node failed-test.mjs <the clone> there|gone [uhd|small]
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const clone = path.resolve(process.argv[2])
const want = process.argv[3]
const mode = process.argv[4] ?? 'small'
const from = (name) => import(pathToFileURL(path.join(clone, 'tools', 'lib', name)).href)
let folder = ''
try {
  const X = await from('handoff-machine.mjs')
  const L = await from('handoff.mjs')
  folder = path.join(X.readMachine().desktop, L.failedTestName())
} catch (e) {
  console.log(`PROBLEM: the folder of a failed test could not be looked for: ${String(e.message).split('\n')[0]}`)
  process.exit(0)
}
const names = fs.existsSync(folder) ? fs.readdirSync(folder).sort() : null
if (want === 'gone') {
  console.log(names ? `PROBLEM: the folder of the failed test is still on the Desktop after a test that passed: ${folder}` : `after the test that passed, the folder of the failed test is gone from the Desktop: ${folder}`)
  process.exit(0)
}
if (!names) {
  console.log(`PROBLEM: a short test failed and left no folder on the Desktop: ${folder}`)
  process.exit(0)
}
const missing = []
const has = (re) => names.some((n) => re.test(n))
if (!has(/^report-test\.txt$/)) missing.push('report-test.txt')
if (!has(/^test\.json$/)) missing.push('test.json')
if (!has(/^doctor\.json$/)) missing.push('doctor.json')
if (mode === 'uhd') {
  if (!has(/^contact-sheet\.jpg$/)) missing.push('contact-sheet.jpg')
  if (!has(/-here-half\.webp$/)) missing.push('a picture this machine drew')
  if (!has(/-apart-half\.png$/)) missing.push('a picture of the difference')
}
let report = ''
try {
  report = fs.readFileSync(path.join(folder, 'report-test.txt'), 'utf8')
} catch {}
const lines = report.trimEnd().split('\n')
if (report && !/^FAIL: /.test(lines.at(-1))) missing.push('a report that ends with FAIL')
if (report && !report.includes(`  folder   ${folder}`)) missing.push('a report that names this folder in its block TO SEND')
const bytes = names.reduce((a, n) => a + fs.statSync(path.join(folder, n)).size, 0)
const list = names.map((n) => `${n} ${fs.statSync(path.join(folder, n)).size}`).join(', ')
console.log(missing.length ? `PROBLEM: the folder of the failed test lacks ${missing.join(', ')}. It holds: ${list}` : `the failed test left one folder on the Desktop: ${folder}, ${names.length} files, ${bytes} bytes: ${list}`)
