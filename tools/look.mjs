import fs from 'node:fs'
import path from 'node:path'
import { rel, parseArgs } from './lib/paths.mjs'
import { addLook } from './lib/looks.mjs'

const args = parseArgs(process.argv.slice(2))
if (!args.add || !args.caption) {
  console.error('usage: npm run look -- --add FILE --caption TEXT [--by NAME]')
  process.exit(2)
}
const src = path.resolve(String(args.add))
if (!fs.existsSync(src)) {
  console.error(`no such file: ${src}`)
  process.exit(1)
}
const entry = addLook(src, String(args.caption), String(args.by ?? 'builder'), { copy: !src.startsWith(rel('out')) })
console.log(`look ${entry.n}: ${entry.file} · ${entry.caption} · by ${entry.by}`)
