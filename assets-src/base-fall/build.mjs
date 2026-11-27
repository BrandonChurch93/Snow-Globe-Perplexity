import fs from 'node:fs'
import { writeGlb } from '../../tools/lib/glb.mjs'
import { loadConfig, rel } from '../../tools/lib/paths.mjs'
import * as L from './layout.mjs'
import { FACE_RANGE, faces, ironDetail } from './maps.mjs'
import { buildIron, buildPumpkins, buildWax, buildWeb } from './mesh.mjs'

const cfg = loadConfig()
const dir = rel('assets-full', 'fall')
fs.mkdirSync(dir, { recursive: true })
const started = process.hrtime.bigint()

const bytes = [await ironDetail('assets-full/fall'), await faces('assets-full/fall')]
console.log(`maps: iron detail ${(bytes[0] / 1e6).toFixed(2)} MB, faces ${(bytes[1] / 1e6).toFixed(2)} MB`)

const iron = buildIron()
const pumpkins = buildPumpkins()
const wax = buildWax()
const web = buildWeb(iron.heroTips)
const extras = {
  faces: L.FACES.map((f) => ({ az: f.az, h: f.h, rad: f.rad, tall: f.tall, cell: f.cell, r: Number((L.drumR(f.h) + 3.4).toFixed(2)), seen: f.seen })),
  faceRange: FACE_RANGE,
}
const meshes = [iron.soup.mesh({ tileMm: 16 }), pumpkins.soup.mesh(extras), wax.soup.mesh({}), web.soup.mesh({})]
const file = rel('assets-full', 'fall', 'base-fall.glb')
writeGlb(file, meshes, { part: 'base-fall' })
const tri = meshes.map((m) => m.index.length / 3)
console.log(`iron ${tri[0]} triangles (drum and seat ${iron.drumTriangles}), ${iron.strands} strands, ${iron.thorns} thorns, ${iron.refused} thorns refused for crossing a face, the slab or the sheaf`)
console.log(`pumpkins ${tri[1]} triangles in ${L.FACES.length} faces: ${L.FACES.map((f) => `${f.az.toFixed(1)}@${f.h.toFixed(1)}`).join(', ')}`)
console.log(`wax ${tri[2]} triangles, ${wax.drips} runs; web ${tri[3]} triangles`)
const size = fs.statSync(file).size
if (size > cfg.repo.maxFileMb * 1e6) throw new Error(`base-fall.glb is over ${cfg.repo.maxFileMb} MB`)
console.log(`total ${tri.reduce((a, b) => a + b, 0)} triangles, ${(size / 1e6).toFixed(2)} MB, done in ${(Number(process.hrtime.bigint() - started) / 1e9).toFixed(1)} s`)
