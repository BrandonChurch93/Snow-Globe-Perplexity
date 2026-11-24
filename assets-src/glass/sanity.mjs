// Counts the values outside the finite range in a still, camera by camera and state by state (the count of measure M1).
// node assets-src/glass/sanity.mjs [--cameras hero,macro,interior,base,surface,low] [--states rest,landed] [--tier draft] [--season winter] [--keep]
// With --keep every still is written to out/work/glass/sanity-<state>-<camera>.png, to be looked at.
import fs from 'node:fs'
import { parseArgs, rel } from '../../tools/lib/paths.mjs'
import { Session, cfg } from '../../tools/lib/page.mjs'

const args = parseArgs(process.argv.slice(2))
const list = (v, d) => (v && v !== true ? String(v).split(',') : d)
const cameras = list(args.cameras, ['hero', 'macro', 'interior', 'base', 'surface', 'low'])
const states = list(args.states, ['rest', 'landed'])
const tier = args.tier && args.tier !== true ? String(args.tier) : 'draft'
const season = args.season && args.season !== true ? String(args.season) : cfg.defaultSeason
const session = await Session.open({ what: 'glass sanity' })
let bad = 0
try {
  const page = await session.page({ format: cfg.formats.hd.id })
  for (const state of states) {
    for (const camera of cameras) {
      const got = await page.evaluate(
        async ([s, st, c, t]) => {
          const sc = window.showcase
          sc.setDiagnostic('none')
          await sc.renderStill({ season: s, state: st, camera: c, tier: t })
          return sc.dev.sanity()
        },
        [season, state, camera, tier],
      )
      if (got.invalid) bad++
      if (args.keep === true) {
        fs.mkdirSync(rel('out', 'work', 'glass'), { recursive: true })
        fs.writeFileSync(rel('out', 'work', 'glass', `sanity-${state}-${camera}.png`), await session.grab(page))
      }
      console.log(`SANITY ${state} ${camera} ${JSON.stringify(got)}`)
    }
  }
  if (page.errors.length) console.log(`page messages:\n${page.errors.slice(0, 10).join('\n')}`)
} finally {
  await session.close()
}
console.log(bad ? `sanity: FAIL, ${bad} stills with invalid values` : 'sanity: pass')
process.exitCode = bad ? 1 : 0
