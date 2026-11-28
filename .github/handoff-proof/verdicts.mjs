// The last job of the proof: one table of the verdicts of all jobs, for the summary of the run.
//   node verdicts.mjs <folder that holds verdict-<job>/verdict.txt> <job,job,...> [file for the table]
// A green run means only that the machines ran. A job whose verdict is missing, or cannot be read as PASS or FAIL,
// is a row NOT RUN, never a PASS. This program always ends with exit code 0: it reports, it does not judge the run.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const HEAD_LINE = 'A green run means only that the machines ran. The verdict is this table.'

/** One row of the table from the text of a job's verdict.txt, or from nothing. */
export function verdictRow(job, text) {
  const lines = String(text ?? '').split(/\r?\n/)
  const at = lines.findIndex((l) => /^VERDICT: (PASS|FAIL)\b/.test(l))
  const whole = at >= 0 && lines.some((l) => l === `===== END OF VERDICT of ${job} =====`)
  if (!whole) return { job, verdict: 'NOT RUN', what: text ? 'its verdict is not whole or is of another job' : 'no verdict was written' }
  if (lines[at].startsWith('VERDICT: PASS')) return { job, verdict: 'PASS', what: lines[at].replace(/^VERDICT: PASS,?\s*/, '') }
  const first = lines.slice(at + 1).find((l) => /^\s+- /.test(l))
  return { job, verdict: 'FAIL', what: first ? first.replace(/^\s+- /, '') : lines[at].replace(/^VERDICT: FAIL,?\s*/, '') }
}

const cell = (t) => String(t).replace(/\|/g, '/').replace(/\s+/g, ' ').trim().slice(0, 300)

export function verdictTable(rows) {
  const count = (v) => rows.filter((r) => r.verdict === v).length
  return [
    HEAD_LINE,
    '',
    `MEASURED by the verdict of each job: ${count('PASS')} PASS, ${count('FAIL')} FAIL, ${count('NOT RUN')} NOT RUN, of ${rows.length} jobs.`,
    '',
    '| job | verdict | what it says (for a FAIL, its first failing line) |',
    '| --- | --- | --- |',
    ...rows.map((r) => `| ${cell(r.job)} | ${r.verdict} | ${cell(r.what)} |`),
    '',
  ].join('\n')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const folder = path.resolve(process.argv[2] ?? '.')
  const jobs = String(process.argv[3] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const rows = jobs.map((job) => {
    let text = ''
    try {
      text = fs.readFileSync(path.join(folder, `verdict-${job}`, 'verdict.txt'), 'utf8').replace(/^\uFEFF/, '')
    } catch {}
    return verdictRow(job, text)
  })
  const table = verdictTable(rows)
  console.log(table)
  for (const target of [process.argv[4], process.env.GITHUB_STEP_SUMMARY]) {
    if (!target) continue
    try {
      fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true })
      fs.appendFileSync(target, `${table}\n`)
    } catch (e) {
      console.log(`the table could not be written to ${target}: ${e.message}`)
    }
  }
  process.exitCode = 0
}
