import fs from 'node:fs'
import { writeGlb } from '../../tools/lib/glb.mjs'
import { loadConfig, rel } from '../../tools/lib/paths.mjs'
import { FIELD, buildField } from './field.mjs'
import { GRAIN, SAND, carveMap, grainMap, sandMap, toneMap } from './maps.mjs'
import { SAND_TILE_MM, SPILL, TILE_MM, buildSand, buildSet, buildStone } from './mesh.mjs'
import * as P from './profile.mjs'
import { lighter, thin } from '../base-spring/thin.mjs'

// G15: how much of each full list stays (the surface moves by at most `error` mm), and the error of the two lighter lists.
const THIN = { stone: { share: 0.68, error: 0.06 }, shells: { share: 0.72, error: 0.05 }, glass: { share: 0.75, error: 0.05 }, sand: { share: 0.66, error: 0.08 }, levels: { medium: { error: 0.09, worth: 1 }, low: { error: 0.22, worth: 1 } } }

const cfg = loadConfig()
const dir = rel('assets-full', 'summer')
fs.mkdirSync(dir, { recursive: true })
const only = process.argv.slice(2)
const want = (k) => only.length === 0 || only.includes(k)
const limit = cfg.assetSets.full.baseMapPx
for (const [name, px] of [['carve', FIELD.W], ['grain', GRAIN.px], ['sand', SAND.px]]) if (px > limit) throw new Error(`the ${name} map is ${px} px, over the full set's ${limit}`)

const started = process.hrtime.bigint()
const field = buildField()
console.log(`relief field ${field.W} by ${field.H} px over a meridian of ${field.mer.total.toFixed(2)} mm, ${P.SET.length} things set into the stone`)

if (want('maps')) {
  const bytes = [...(await carveMap(dir, field)), ...(await toneMap(dir, field)), ...(await grainMap(dir)), ...(await sandMap(dir))]
  console.log(`maps: ${(bytes.reduce((a, b) => a + b, 0) / 1e6).toFixed(2)} MB in ${bytes.length} files`)
}
if (want('mesh')) {
  const stone = buildStone(field)
  const set = buildSet(field)
  const sand = buildSand(field)
  const meshes = [
    await thin(stone.soup.mesh({ repeats: stone.repeats, tileMm: TILE_MM }), THIN.stone),
    await thin(set.shells.mesh({}), THIN.shells),
    await thin(set.glass.mesh({}), THIN.glass),
    await thin(sand.soup.mesh({ tileMm: SAND_TILE_MM, spill: SPILL, ledgeH: P.LEDGE_H }), THIN.sand),
  ]
  const file = rel('assets-full', 'summer', 'base-summer.glb')
  writeGlb(file, meshes, { part: 'base-summer' })
  const lists = await lighter(file, THIN.levels)
  console.log(`quality levels: ${lists.map((m) => `${m.name} ${m.triangles}/${m.medium ?? '-'}/${m.low ?? '-'}`).join('; ')}`)
  const tri = meshes.map((m) => m.index.length / 3)
  console.log(`stone ${tri[0]} triangles (body ${stone.body}), shells ${tri[1]}, sea glass ${tri[2]}, sand ${tri[3]} (ring ${sand.ring}, drape ${sand.drape})`)
  console.log(`set into the stone: ${Object.entries(set.count).map(([k, v]) => `${v} ${k}`).join(', ')}`)
  console.log(`total ${tri.reduce((a, b) => a + b, 0)} triangles in ${meshes.length} meshes, ${(fs.statSync(file).size / 1e6).toFixed(2)} MB`)
}
const over = fs.readdirSync(dir).filter((n) => n.startsWith('base-') && fs.statSync(rel('assets-full', 'summer', n)).size > cfg.repo.maxFileMb * 1e6)
if (over.length) throw new Error(`over ${cfg.repo.maxFileMb} MB: ${over.join(', ')}`)
console.log(`files: ${fs.readdirSync(dir).filter((n) => n.startsWith('base-')).map((n) => `${n} ${(fs.statSync(rel('assets-full', 'summer', n)).size / 1e6).toFixed(2)} MB`).join(', ')}`)
console.log(`done in ${(Number(process.hrtime.bigint() - started) / 1e9).toFixed(1)} s`)
