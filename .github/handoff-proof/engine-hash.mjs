// Prints the engine hash of the clone in the folder given: node engine-hash.mjs <folder>
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = path.resolve(process.argv[2] ?? '.')
const m = await import(pathToFileURL(path.join(dir, 'tools', 'lib', 'hashes.mjs')).href)
console.log(m.engineHash())
