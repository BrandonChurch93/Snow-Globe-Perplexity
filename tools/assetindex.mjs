import { writeAssetIndex } from './lib/hashes.mjs'

const index = writeAssetIndex()
const count = (set) => Object.values(index.sets[set]).reduce((n, files) => n + files.length, 0)
console.log(`asset index: ${count('web')} files in the web set, ${count('full')} in the full set`)
