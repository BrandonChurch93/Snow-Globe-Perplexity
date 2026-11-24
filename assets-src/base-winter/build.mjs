import fs from 'node:fs'
import { writeGlb } from '../../tools/lib/glb.mjs'
import { loadConfig, rel } from '../../tools/lib/paths.mjs'
import { buildField, CONES, STAMPS } from './carve.mjs'
import { BRASS, CARVE, SNOW, WOOD, brassMaps, carveMap, snowMaps, woodMaps } from './maps.mjs'
import { buildBrass, buildIce, buildSnow, buildWood, icicleList } from './mesh.mjs'
import * as P from './profile.mjs'

const cfg = loadConfig()
const dir = rel('assets-full', 'winter')
fs.mkdirSync(dir, { recursive: true })
const only = process.argv.slice(2)
const want = (k) => only.length === 0 || only.includes(k)
const limit = cfg.assetSets.full.baseMapPx
for (const [name, px] of [
  ['wood', WOOD.px],
  ['carve', CARVE.width],
  ['brass', BRASS.px],
  ['snow', SNOW.px],
]) {
  if (px > limit) throw new Error(`the ${name} map is ${px} px, over the full set's ${limit}`)
}

const started = process.hrtime.bigint()
const field = await buildField()
console.log(`carving field ${field.W} by ${field.H} px, ${STAMPS.length} stamps, ${CONES.length} cones`)

const sizes = {}
if (want('maps')) {
  const wood = await woodMaps(dir)
  console.log(`wood sheet: mean linear colour ${wood.mean.map((v) => v.toFixed(4)).join(', ')}`)
  const carve = await carveMap(dir, field)
  const brass = await brassMaps(dir)
  const snow = await snowMaps(dir)
  sizes.maps = [...wood.bytes, ...carve.bytes, ...brass.bytes, ...snow.bytes].reduce((a, b) => a + b, 0)
}

if (want('mesh') || only.length === 0) {
  const wood = buildWood(field)
  const brass = buildBrass()
  const snow = buildSnow()
  const list = icicleList(field)
  const ice = buildIce(list)
  const body = []
  for (let i = 0; i <= 29; i++) {
    const h = 6 + i
    body.push(Number((h < P.BODY[0][1] ? P.BEAD.ringR + P.BEAD.tube : h > P.LIP.h - 0.7 ? P.LIP.ringR + P.LIP.tube : P.bodyRadiusAt(field.mer, h)).toFixed(3)))
  }
  const extras = {
    wood: { repeats: Math.round((2 * Math.PI * P.CARVING.rRef) / WOOD.tileMm), tileMm: WOOD.tileMm },
    brass: { tileMm: BRASS.tileMm },
    snow: { tileMm: SNOW.tileMm },
    ice: {
      count: list.length,
      rootHeight: P.ICE.h + 0.5,
      bodyFrom: 6,
      bodyStep: 1,
      body,
      icicles: list.map((it) => ({ az: Number(it.az.toFixed(2)), length: Number(it.length.toFixed(2)), radius: Number(it.radius.toFixed(2)), measured: it.measured })),
    },
  }
  const meshes = [wood.soup.mesh(extras.wood), brass.soup.mesh(extras.brass), snow.soup.mesh(extras.snow), ice.soup.mesh(extras.ice)]
  const file = rel('assets-full', 'winter', 'base-winter.glb')
  writeGlb(file, meshes, { part: 'base-winter' })
  sizes.glb = fs.statSync(file).size
  const tri = meshes.map((m) => m.index.length / 3)
  console.log(`wood ${tri[0]} triangles (body ${wood.bodyTriangles}, bead ${wood.beadTriangles}, cones ${wood.coneTriangles})`)
  console.log(`brass ${tri[1]} triangles (rim ${brass.rimTriangles}, rope ${brass.ropeTriangles}, lip, floor, collar and cup ${brass.seatTriangles})`)
  console.log(`snow ${tri[2]} triangles, ice ${tri[3]} triangles in ${list.length} icicles`)
  console.log(`total ${tri.reduce((a, b) => a + b, 0)} triangles in ${meshes.length} meshes, ${(sizes.glb / 1e6).toFixed(2)} MB`)
  console.log('icicles, azimuth in degrees, length and root radius in mm:')
  console.log(list.map((it) => `${it.az.toFixed(1)} ${it.length.toFixed(1)} ${it.radius.toFixed(2)}${it.measured ? '' : ' (placed)'}`).join('; '))
}
for (const line of P.PROFILE_NOTES) console.log(line)
const over = fs.readdirSync(dir).filter((n) => n.startsWith('base-') && fs.statSync(rel('assets-full', 'winter', n)).size > cfg.repo.maxFileMb * 1e6)
if (over.length) throw new Error(`over ${cfg.repo.maxFileMb} MB: ${over.join(', ')}`)
console.log(`files: ${fs.readdirSync(dir).filter((n) => n.startsWith('base-')).map((n) => `${n} ${(fs.statSync(rel('assets-full', 'winter', n)).size / 1e6).toFixed(2)} MB`).join(', ')}`)
console.log(`done in ${(Number(process.hrtime.bigint() - started) / 1e9).toFixed(1)} s`)
