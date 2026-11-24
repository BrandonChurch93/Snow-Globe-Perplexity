import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { rel } from './lib/paths.mjs'

const [part, ...rest] = process.argv.slice(2)
if (!part) {
  console.log(`usage: npm run make -- <part> [arguments for its script]\nparts with a script: ${fs.readdirSync(rel('assets-src')).filter((d) => fs.existsSync(rel('assets-src', d, 'build.mjs'))).join(', ') || 'none'}`)
  process.exit(1)
}
const script = rel('assets-src', part, 'build.mjs')
if (!fs.existsSync(script)) {
  console.error(`no script at assets-src/${part}/build.mjs`)
  process.exit(1)
}
const r = spawnSync(process.execPath, [script, ...rest], { cwd: rel(), stdio: 'inherit' })
process.exit(r.status ?? 1)
