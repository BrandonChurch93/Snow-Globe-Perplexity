// Says whether the stamp of a clone is released for the final render: prints yes or no, and no for a stamp it
// cannot read. The flows ask it before the one line that proves the refusal of an unreleased stamp: with a released
// stamp that line would start the real render on a test machine, so it is left out there.
//   node released.mjs <folder of the clone>
import fs from 'node:fs'
import path from 'node:path'

let released = false
try {
  released = JSON.parse(fs.readFileSync(path.join(path.resolve(process.argv[2] ?? '.'), 'render', 'STAMP.json'), 'utf8')).releasedForFinalRender === true
} catch {}
console.log(released ? 'yes' : 'no')
