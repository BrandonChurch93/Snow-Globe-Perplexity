import { parseArgs, rel } from './lib/paths.mjs'
import { Session, noAirProblem, stillName, stillSpec, renderStill } from './lib/page.mjs'
import { addLook } from './lib/looks.mjs'
import path from 'node:path'

const args = parseArgs(process.argv.slice(2), { aid: true })
const spec = stillSpec(args)
const noext = args.noext && args.noext !== true ? String(args.noext).split(',') : []
const file = args.out && args.out !== true ? path.resolve(String(args.out)) : undefined
const problem = noAirProblem(spec, file ?? stillName(spec), true)
if (problem) throw new Error(problem)
const session = await Session.open({ local: args.local === true })
try {
  const r = await renderStill(session, spec, { noext, force: args.force === true, file, aid: true })
  const what = `${spec.id || `${spec.season} ${spec.state} ${spec.camera}`}, ${spec.format}, ${spec.tier}${spec.diag ? `, ${spec.diag} view` : ''}${spec.noAir ? ', without the air (a measuring aid, not a judged picture)' : ''}`
  if (!r.reused && args.look !== 'no') addLook(r.file, `Still: ${what}`)
  console.log(`${r.reused ? 'reused' : 'rendered'} ${path.relative(rel(), r.file)}${r.reused ? '' : ` in ${r.record.seconds.toFixed(1)} s (simulation ${(r.record.timings.simMs / 1000).toFixed(1)} s, ${r.record.timings.samples} samples in ${(r.record.timings.drawMs / 1000).toFixed(1)} s, ${r.record.precision}, ${r.record.renderer ?? 'swiftshader'})`}`)
  if (r.record.errors?.length) console.log(`page messages:\n${r.record.errors.join('\n')}`)
} finally {
  await session.close()
}
