import fs from 'node:fs'
import { parseArgs, rel } from './lib/paths.mjs'
import { STILL_FILE, STILL_SEED, STILL_SIDE, STILL_SIGMA, stillSource } from './lib/stilltile.mjs'

/**
 * The tile of levels by which a part gives way where the page draws one sample a frame (`stageStill` in
 * src/core/materials.ts), written into the source as a literal.
 *
 *   node tools/stilltile.mjs           writes src/core/still.ts
 *   node tools/stilltile.mjs --check   writes nothing and says whether the file is what this makes; exit 1 if not
 *
 * The tile is made by tools/lib/stilltile.mjs from nothing but its own numbers, so every run writes the same file. Run it
 * after a change to that file and at no other time: the page never makes the tile, and tests/shake-change.test.ts holds the
 * file in the source against this.
 */

const args = parseArgs(process.argv.slice(2))
const file = rel(...STILL_FILE.split('/'))
const made = stillSource()
const stands = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null
const what = `${STILL_SIDE} x ${STILL_SIDE}, seed ${STILL_SEED}, width ${STILL_SIGMA}`
if (args.check) {
  console.log(stands === made ? `${STILL_FILE} is the tile this makes (${what})` : `${STILL_FILE} is not the tile this makes (${what})`)
  process.exit(stands === made ? 0 : 1)
}
if (stands === made) console.log(`${STILL_FILE} stands as it is (${what})`)
else {
  fs.writeFileSync(file, made)
  console.log(`${STILL_FILE} written (${what})`)
}
